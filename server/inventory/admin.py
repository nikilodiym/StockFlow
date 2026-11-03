from django.contrib import admin

from .models import Document, DocumentLine, Stock, StockMovement, Warehouse


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "address", "is_active"]


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    """Read-only: balances change only by posting documents. Negative rows are problems to check."""

    list_display = ["product", "warehouse", "quantity", "updated_at"]
    list_filter = ["warehouse"]
    search_fields = ["product__name", "product__sku"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(StockMovement)
class StockMovementAdmin(StockAdmin):
    list_display = ["created_at", "product", "warehouse", "delta", "balance_after", "movement_type", "document"]
    list_filter = ["warehouse", "movement_type"]


class DocumentLineInline(admin.TabularInline):
    model = DocumentLine
    extra = 0


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ["number", "type", "status", "warehouse", "created_by", "created_at", "is_deleted"]
    list_filter = ["type", "status", "warehouse", "is_deleted"]
    search_fields = ["number", "note"]
    readonly_fields = ["status", "posted_by", "posted_at", "cancelled_by", "cancelled_at", "version"]
    inlines = [DocumentLineInline]
