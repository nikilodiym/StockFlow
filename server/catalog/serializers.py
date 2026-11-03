from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from .models import Barcode, Category, ImportJob, Product, ProductUnit, Unit
from .services import category_by_name, find_unit, set_primary_barcode


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "parent", "sort_order", "is_active", "updated_at"]
        read_only_fields = ["updated_at"]


class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = ["id", "code", "name", "precision", "is_active", "updated_at"]
        read_only_fields = ["updated_at"]


class ProductUnitSerializer(serializers.ModelSerializer):
    unit_name = serializers.CharField(source="unit.name", read_only=True)

    class Meta:
        model = ProductUnit
        fields = ["id", "product", "unit", "unit_name", "factor", "updated_at"]
        read_only_fields = ["updated_at"]


class BarcodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Barcode
        fields = ["id", "code", "product", "unit", "type", "is_primary", "is_active", "updated_at"]
        read_only_fields = ["updated_at"]

    @transaction.atomic
    def save(self, **kwargs):
        barcode = super().save(**kwargs)
        if barcode.is_primary:
            Barcode.objects.filter(product=barcode.product, is_primary=True).exclude(pk=barcode.pk).update(is_primary=False)
        return barcode


class ProductSerializer(serializers.ModelSerializer):
    """
    Product card. Besides the normalized fields it keeps the flat fields the web and
    mobile clients already use: `category` (name), `unit` (name), `barcode` (primary code)
    and `stock` (sum over warehouses, or one warehouse with ?warehouse=<id>).
    `stock` is writable only on create: it becomes a posted opening-balance receipt.
    """

    category = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    category_id = serializers.PrimaryKeyRelatedField(
        source="category", queryset=Category.objects.all(), required=False, allow_null=True
    )
    unit = serializers.CharField(required=False)
    base_unit = serializers.PrimaryKeyRelatedField(queryset=Unit.objects.filter(is_active=True), required=False)
    barcode = serializers.CharField(required=False, allow_blank=True)
    barcodes = BarcodeSerializer(many=True, read_only=True)
    packings = ProductUnitSerializer(many=True, read_only=True)
    stock = serializers.DecimalField(max_digits=14, decimal_places=3, required=False, min_value=Decimal(0))
    is_low = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "sku", "name", "description", "category", "category_id", "unit", "base_unit", "barcode",
            "barcodes", "packings", "price", "min_stock", "stock", "is_low", "is_active", "version",
            "created_at", "updated_at",
        ]
        read_only_fields = ["version", "created_at", "updated_at"]

    def _stock(self, product):
        value = getattr(product, "total_stock", None)
        if value is None:
            value = sum((row.quantity for row in product.stock_rows.all()), Decimal(0))
        return value

    def get_is_low(self, product) -> bool:
        return self._stock(product) <= product.min_stock

    def to_representation(self, product):
        data = super().to_representation(product)
        data["category"] = product.category.name if product.category_id else ""
        data["unit"] = product.base_unit.name
        barcode = product.primary_barcode
        data["barcode"] = barcode.code if barcode else ""
        data["stock"] = str(self._stock(product))
        return data

    def validate(self, attrs):
        if "category" in attrs and not isinstance(attrs["category"], Category):
            attrs["category"] = category_by_name(attrs["category"])
        unit_name = attrs.pop("unit", None)
        if unit_name and "base_unit" not in attrs:
            unit = find_unit(unit_name)
            if not unit:
                raise serializers.ValidationError({"unit": f"Невідома одиниця: {unit_name}"})
            attrs["base_unit"] = unit
        if not self.instance and "base_unit" not in attrs:
            attrs["base_unit"] = find_unit("pcs") or Unit.objects.first()
            if attrs["base_unit"] is None:
                raise serializers.ValidationError({"unit": "Спочатку створіть одиниці виміру"})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        barcode = validated_data.pop("barcode", "")
        opening = validated_data.pop("stock", None)
        product = Product.objects.create(**validated_data)
        self._save_barcode(product, barcode)
        if opening:
            from inventory.services import post_opening_balance

            post_opening_balance(product, opening, self.context["request"].user)
        return product

    @transaction.atomic
    def update(self, product, validated_data):
        barcode = validated_data.pop("barcode", None)
        validated_data.pop("stock", None)  # balances change only through documents
        for key, value in validated_data.items():
            setattr(product, key, value)
        product.bump_version()
        product.save()
        if barcode is not None:
            self._save_barcode(product, barcode)
        return product

    @staticmethod
    def _save_barcode(product, code):
        try:
            set_primary_barcode(product, code)
        except ValueError as exc:
            raise serializers.ValidationError({"barcode": str(exc)})


class ImportJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportJob
        fields = [
            "id", "file", "status", "rows_total", "rows_created", "rows_updated", "rows_failed", "errors",
            "created_by", "created_at", "finished_at",
        ]
        read_only_fields = [f for f in fields if f != "file"]
