from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models
from django.db.models import Q


class SyncBatch(models.Model):
    """
    One push/pull from a phone. Gives the sync journal on the dashboard and idempotency:
    the same batch sent twice returns the stored `response` without doing anything again.
    `response` also holds the per-document results (replaces a separate sync_items table).
    """

    PUSH, PULL = "push", "pull"
    RECEIVED, PROCESSED, PARTIAL, FAILED = "received", "processed", "partial", "failed"
    STATUSES = [(RECEIVED, "Отримано"), (PROCESSED, "Оброблено"), (PARTIAL, "Частково"), (FAILED, "Помилка")]

    id = models.UUIDField(primary_key=True)  # generated on the phone
    device = models.ForeignKey("accounts.Device", on_delete=models.SET_NULL, null=True, blank=True, related_name="batches")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="sync_batches")
    direction = models.CharField(max_length=4, choices=[(PUSH, "push"), (PULL, "pull")], default=PUSH)
    status = models.CharField(max_length=10, choices=STATUSES, default=RECEIVED)
    items_total = models.PositiveIntegerField(default=0)
    items_ok = models.PositiveIntegerField(default=0)
    items_conflict = models.PositiveIntegerField(default=0)
    items_failed = models.PositiveIntegerField(default=0)
    response = models.JSONField(null=True, blank=True, encoder=DjangoJSONEncoder)
    error = models.TextField(blank=True)
    client_sent_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(auto_now_add=True, db_index=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "sync_batches"
        ordering = ["-received_at", "-id"]


class SyncConflict(models.Model):
    """Shown on the conflicts screen: 'Keep local' / 'Accept server'."""

    VERSION_MISMATCH, ALREADY_POSTED, DELETED_ON_SERVER, PRODUCT_INACTIVE = (
        "version_mismatch", "already_posted", "deleted_on_server", "product_inactive",
    )
    REASONS = [
        (VERSION_MISMATCH, "Різні версії"), (ALREADY_POSTED, "Вже проведено"),
        (DELETED_ON_SERVER, "Видалено на сервері"), (PRODUCT_INACTIVE, "Товар неактивний"),
    ]
    OPEN, KEPT_LOCAL, KEPT_SERVER = "open", "kept_local", "kept_server"
    STATUSES = [(OPEN, "Відкритий"), (KEPT_LOCAL, "Залишено локальні"), (KEPT_SERVER, "Прийнято серверні")]

    batch = models.ForeignKey(SyncBatch, on_delete=models.CASCADE, related_name="conflicts")
    entity_type = models.CharField(max_length=20, default="document")
    entity_id = models.UUIDField()
    base_version = models.PositiveIntegerField(null=True, blank=True)
    server_version = models.PositiveIntegerField(null=True, blank=True)
    local_data = models.JSONField(encoder=DjangoJSONEncoder)
    server_data = models.JSONField(null=True, blank=True, encoder=DjangoJSONEncoder)
    conflict_reason = models.CharField(max_length=20, choices=REASONS)
    status = models.CharField(max_length=12, choices=STATUSES, default=OPEN)
    resolved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "sync_conflicts"
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["entity_type", "entity_id"], condition=Q(status="open"), name="sync_conflict_one_open_per_entity"
            )
        ]


class Notification(models.Model):
    """
    In-app notification. Delivered to phones inside /sync/pull (no separate polling),
    urgent ones additionally as an Expo push.
    """

    LOW_STOCK = "low_stock"
    SYNC_CONFLICT = "sync_conflict"
    SYNC_FAILED = "sync_failed"
    TRANSFER_INCOMING = "transfer_incoming"
    INVENTORY_STARTED = "inventory_started"
    LOW_BATTERY = "low_battery"
    STALE_DEVICE = "stale_device"
    TYPES = [
        (LOW_STOCK, "Мало на складі"), (SYNC_CONFLICT, "Конфлікт синхронізації"),
        (SYNC_FAILED, "Помилка синхронізації"), (TRANSFER_INCOMING, "Вхідне переміщення"),
        (INVENTORY_STARTED, "Інвентаризація"), (LOW_BATTERY, "Низький заряд"),
        (STALE_DEVICE, "Пристрій давно не синхронізувався"),
    ]
    URGENT = {LOW_STOCK, SYNC_CONFLICT, TRANSFER_INCOMING}

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    warehouse = models.ForeignKey("inventory.Warehouse", on_delete=models.CASCADE, null=True, blank=True, related_name="+")
    type = models.CharField(max_length=20, choices=TYPES)
    title = models.CharField(max_length=120)
    body = models.TextField(blank=True)
    payload = models.JSONField(default=dict, blank=True, encoder=DjangoJSONEncoder)
    is_pushed = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["user", "created_at"], name="notification_user_time")]

    def __str__(self):
        return f"{self.get_type_display()}: {self.title}"
