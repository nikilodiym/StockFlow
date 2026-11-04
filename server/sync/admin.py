from django.contrib import admin

from .models import Notification, SyncBatch, SyncConflict


@admin.register(SyncBatch)
class SyncBatchAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "device", "direction", "status", "items_total", "items_ok", "items_conflict", "items_failed", "received_at"]
    list_filter = ["direction", "status"]


@admin.register(SyncConflict)
class SyncConflictAdmin(admin.ModelAdmin):
    list_display = ["entity_id", "conflict_reason", "status", "base_version", "server_version", "created_at"]
    list_filter = ["status", "conflict_reason"]


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["user", "type", "title", "is_pushed", "read_at", "created_at"]
    list_filter = ["type", "is_pushed"]
