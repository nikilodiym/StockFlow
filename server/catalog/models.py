from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Q

from core.models import SoftDeleteModel, TimeStampedModel, VersionedModel


class Category(TimeStampedModel, SoftDeleteModel):
    name = models.CharField(max_length=120)
    parent = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="children")
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = "categories"
        ordering = ["sort_order", "name"]
        verbose_name_plural = "categories"
        constraints = [
            models.UniqueConstraint(fields=["parent", "name"], name="category_parent_name_unique"),
            # NULL parents are never equal in SQL, so root names need their own constraint.
            models.UniqueConstraint(fields=["name"], condition=Q(parent__isnull=True), name="category_root_name_unique"),
        ]

    def __str__(self):
        return f"{self.parent} → {self.name}" if self.parent_id else self.name


class Unit(SoftDeleteModel):
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=20)
    precision = models.PositiveSmallIntegerField(default=0, help_text="0 — ціле (шт), 3 — 0.250 (кг)")
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        db_table = "units"
        ordering = ["id"]

    def __str__(self):
        return self.name


class Product(TimeStampedModel, SoftDeleteModel, VersionedModel):
    """No `stock` field here: balances live in inventory.Stock, per warehouse."""

    sku = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name="products")
    base_unit = models.ForeignKey(Unit, on_delete=models.PROTECT, related_name="products")
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    min_stock = models.DecimalField(max_digits=14, decimal_places=3, default=0)

    class Meta:
        db_table = "products"
        ordering = ["name"]
        constraints = [
            models.CheckConstraint(condition=Q(price__gte=0), name="product_price_non_negative"),
            models.CheckConstraint(condition=Q(min_stock__gte=0), name="product_min_stock_non_negative"),
        ]
        # GIN pg_trgm index for name search is created in migration 0002 (PostgreSQL only).

    def __str__(self):
        return f"{self.name} ({self.sku})"

    @property
    def primary_barcode(self):
        for barcode in self.barcodes.all():
            if barcode.is_primary and barcode.is_active:
                return barcode
        return None

    def factor_for(self, unit):
        """How many base units are in one `unit` (1 for the base unit)."""
        if unit is None or unit.pk == self.base_unit_id:
            return Decimal(1)
        packing = self.packings.filter(unit=unit).first()
        if not packing:
            raise ValueError(f"Для товару «{self.name}» не задано фасування «{unit.name}»")
        return packing.factor


class ProductUnit(models.Model):
    """Packing: '1 pack = 12 pcs'. Not needed for the base unit (factor = 1)."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="packings")
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT, related_name="+")
    factor = models.DecimalField(max_digits=14, decimal_places=3)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        db_table = "product_units"
        constraints = [
            models.UniqueConstraint(fields=["product", "unit"], name="product_unit_unique"),
            models.CheckConstraint(condition=Q(factor__gt=0), name="product_unit_factor_positive"),
        ]

    def __str__(self):
        return f"1 {self.unit} = {self.factor} {self.product.base_unit}"


class Barcode(SoftDeleteModel):
    EAN13, EAN8, CODE128, QR, INTERNAL = "ean13", "ean8", "code128", "qr", "internal"
    TYPES = [(EAN13, "EAN-13"), (EAN8, "EAN-8"), (CODE128, "Code 128"), (QR, "QR"), (INTERNAL, "Внутрішній")]

    code = models.CharField(max_length=64, unique=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="barcodes")
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT, null=True, blank=True, related_name="+",
                             help_text="порожньо — базова одиниця; «упак» — код на упаковці")
    type = models.CharField(max_length=10, choices=TYPES, default=EAN13)
    is_primary = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        db_table = "barcodes"
        constraints = [
            models.UniqueConstraint(fields=["product"], condition=Q(is_primary=True), name="barcode_one_primary_per_product"),
        ]

    def __str__(self):
        return self.code

    @staticmethod
    def guess_type(code):
        if code.isdigit() and len(code) == 13:
            return Barcode.EAN13
        if code.isdigit() and len(code) == 8:
            return Barcode.EAN8
        return Barcode.CODE128


class ImportJob(models.Model):
    PENDING, PROCESSING, DONE, FAILED = "pending", "processing", "done", "failed"
    STATUSES = [(PENDING, "Очікує"), (PROCESSING, "Обробляється"), (DONE, "Готово"), (FAILED, "Помилка")]

    file = models.FileField(upload_to="imports/")
    status = models.CharField(max_length=12, choices=STATUSES, default=PENDING)
    rows_total = models.PositiveIntegerField(default=0)
    rows_created = models.PositiveIntegerField(default=0)
    rows_updated = models.PositiveIntegerField(default=0)
    rows_failed = models.PositiveIntegerField(default=0)
    errors = models.JSONField(default=list, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "import_jobs"
        ordering = ["-created_at"]
