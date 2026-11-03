import uuid

from django.conf import settings
from django.db import IntegrityError, models, transaction
from django.db.models import F, Q
from django.utils import timezone

from core.models import SoftDeleteModel, VersionedModel


class Warehouse(SoftDeleteModel):
    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=120)
    address = models.CharField(max_length=240, blank=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        db_table = "warehouses"
        ordering = ["id"]

    def __str__(self):
        return self.name


class Stock(models.Model):
    """Current balance of one product on one warehouse (base unit). Changed only by posting documents."""

    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="stock_rows")
    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT, related_name="stock_rows")
    # Negative is allowed: an offline write-off may arrive before the receipt.
    quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        db_table = "stock"
        constraints = [models.UniqueConstraint(fields=["warehouse", "product"], name="stock_warehouse_product_unique")]

    def __str__(self):
        return f"{self.product} @ {self.warehouse}: {self.quantity}"


class StockMovement(models.Model):
    """Append-only journal of every balance change. Cancelling adds rows with the opposite delta."""

    CANCEL = "cancel"

    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="+")
    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT, related_name="movements")
    document = models.ForeignKey("Document", on_delete=models.PROTECT, related_name="movements")
    document_line = models.ForeignKey("DocumentLine", on_delete=models.PROTECT, related_name="movements")
    delta = models.DecimalField(max_digits=14, decimal_places=3)
    balance_after = models.DecimalField(max_digits=14, decimal_places=3)
    movement_type = models.CharField(max_length=20)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "stock_movements"
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["warehouse", "product", "created_at"], name="movement_wh_product_time"),
            models.Index(fields=["created_at"], name="movement_time"),
        ]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValueError("Рух залишків не можна змінювати")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("Рух залишків не можна видаляти")


class Document(VersionedModel):
    RECEIPT, WRITEOFF, INVENTORY, TRANSFER = "receipt", "writeoff", "inventory", "transfer"
    TYPES = [(RECEIPT, "Прихід"), (WRITEOFF, "Списання"), (INVENTORY, "Інвентаризація"), (TRANSFER, "Переміщення")]
    NUMBER_PREFIX = {RECEIPT: "ПР", WRITEOFF: "СП", INVENTORY: "ІН", TRANSFER: "ПМ"}

    DRAFT, POSTED, CANCELLED = "draft", "posted", "cancelled"
    STATUSES = [(DRAFT, "Чернетка"), (POSTED, "Проведено"), (CANCELLED, "Скасовано")]

    WRITEOFF_REASONS = [("damage", "Пошкодження"), ("expired", "Прострочено"), ("loss", "Втрата"), ("other", "Інше")]
    PARTIAL, FULL = "partial", "full"
    INVENTORY_MODES = [(PARTIAL, "Вибіркова"), (FULL, "Повна")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)  # generated on the phone
    number = models.CharField(max_length=30, unique=True, null=True, blank=True)
    type = models.CharField(max_length=20, choices=TYPES)
    status = models.CharField(max_length=20, choices=STATUSES, default=DRAFT)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="documents")
    destination_warehouse = models.ForeignKey(
        Warehouse, on_delete=models.PROTECT, null=True, blank=True, related_name="incoming_transfers"
    )
    writeoff_reason = models.CharField(max_length=20, choices=WRITEOFF_REASONS, null=True, blank=True)
    inventory_mode = models.CharField(max_length=10, choices=INVENTORY_MODES, null=True, blank=True)
    counterparty = models.CharField(max_length=200, null=True, blank=True)
    external_ref = models.CharField(max_length=100, null=True, blank=True)
    note = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="documents")
    device = models.ForeignKey("accounts.Device", on_delete=models.SET_NULL, null=True, blank=True, related_name="documents")
    posted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    posted_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    cancelled_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    client_created_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        db_table = "documents"
        ordering = ["-created_at"]
        constraints = [
            # A draft transfer may not have its destination yet; posting requires it (see services).
            models.CheckConstraint(
                condition=Q(type="transfer") | Q(destination_warehouse__isnull=True), name="document_destination_only_transfer"
            ),
            models.CheckConstraint(
                condition=Q(destination_warehouse__isnull=True) | ~Q(destination_warehouse=F("warehouse")),
                name="document_destination_differs",
            ),
            models.CheckConstraint(
                condition=Q(type="writeoff") | Q(writeoff_reason__isnull=True), name="document_reason_only_writeoff"
            ),
            models.CheckConstraint(
                condition=Q(type="inventory") | Q(inventory_mode__isnull=True), name="document_mode_only_inventory"
            ),
            models.CheckConstraint(
                condition=Q(type__in=["receipt", "writeoff", "inventory", "transfer"]), name="document_type_valid"
            ),
            models.CheckConstraint(condition=Q(status__in=["draft", "posted", "cancelled"]), name="document_status_valid"),
        ]
        indexes = [models.Index(fields=["warehouse", "status"], name="document_wh_status")]

    def __str__(self):
        return self.number or str(self.id)

    def save(self, *args, **kwargs):
        if self.type == self.WRITEOFF and not self.writeoff_reason:
            self.writeoff_reason = "other"
        if self.type == self.INVENTORY and not self.inventory_mode:
            self.inventory_mode = self.PARTIAL
        if not self.number:
            self._save_with_number(*args, **kwargs)
        else:
            super().save(*args, **kwargs)

    def _save_with_number(self, *args, **kwargs):
        """Server assigns ПР-2026-000123 on first save; retries if two requests race for a number."""
        prefix = f"{self.NUMBER_PREFIX[self.type]}-{timezone.localdate().year}-"
        for _ in range(5):
            last = (
                Document.objects.filter(number__startswith=prefix).order_by("-number").values_list("number", flat=True).first()
            )
            self.number = f"{prefix}{int(last.rsplit('-', 1)[1]) + 1 if last else 1:06d}"
            try:
                with transaction.atomic():
                    super().save(*args, **kwargs)
                return
            except IntegrityError:
                if not Document.objects.filter(number=self.number).exists():
                    raise  # not a number clash (e.g. duplicate id) — do not retry
        raise IntegrityError("Не вдалося присвоїти номер документа")

    @property
    def is_draft(self):
        return self.status == self.DRAFT and not self.is_deleted


class DocumentLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)  # generated on the phone
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="lines")
    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT, related_name="document_lines")
    quantity = models.DecimalField(max_digits=14, decimal_places=3, help_text="у базовій одиниці — саме вона йде в облік")
    entered_quantity = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    entered_unit = models.ForeignKey("catalog.Unit", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    expected_quantity = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    scanned_barcode = models.CharField(max_length=64, null=True, blank=True)
    scanned_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "document_lines"
        ordering = ["scanned_at", "id"]
        constraints = [
            models.UniqueConstraint(fields=["document", "product"], name="line_document_product_unique"),
            models.CheckConstraint(condition=Q(quantity__gte=0), name="line_quantity_non_negative"),
        ]

    @property
    def difference(self):
        """Inventory discrepancy: counted minus expected (not stored)."""
        if self.expected_quantity is None:
            return None
        return self.quantity - self.expected_quantity
