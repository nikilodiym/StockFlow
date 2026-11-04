from django.contrib import admin

from .models import Barcode, Category, ImportJob, Product, ProductUnit, Unit


class BarcodeInline(admin.TabularInline):
    model = Barcode
    extra = 0


class ProductUnitInline(admin.TabularInline):
    model = ProductUnit
    extra = 0


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ["sku", "name", "category", "base_unit", "price", "min_stock", "is_active"]
    list_filter = ["is_active", "category", "base_unit"]
    search_fields = ["sku", "name", "barcodes__code"]
    inlines = [BarcodeInline, ProductUnitInline]


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "parent", "sort_order", "is_active"]


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "precision", "is_active"]


@admin.register(ImportJob)
class ImportJobAdmin(admin.ModelAdmin):
    list_display = ["id", "status", "rows_total", "rows_created", "rows_updated", "rows_failed", "created_at"]
