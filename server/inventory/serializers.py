from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from catalog.models import Product, Unit
from catalog.services import find_unit

from .models import Document, DocumentLine, Stock, StockMovement, Warehouse


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = ["id", "code", "name", "address", "is_active", "updated_at"]
        read_only_fields = ["updated_at"]


class StockSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    sku = serializers.CharField(source="product.sku", read_only=True)
    min_stock = serializers.DecimalField(source="product.min_stock", max_digits=14, decimal_places=3, read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = Stock
        fields = ["id", "warehouse", "warehouse_name", "product", "product_name", "sku", "quantity", "min_stock", "updated_at"]


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    document_number = serializers.CharField(source="document.number", read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            "id", "warehouse", "product", "product_name", "document", "document_number", "document_line", "delta",
            "balance_after", "movement_type", "created_by", "created_at",
        ]


class DocumentLineSerializer(serializers.ModelSerializer):
    """
    Input: `quantity` is what the user entered, in `unit` (name/code) or `entered_unit` (id).
    It is converted to the product's base unit via packings (2 packs × 12 = 24 pcs).
    """

    id = serializers.UUIDField(required=False)
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    unit = serializers.CharField(required=False, write_only=True, allow_blank=True)
    entered_unit = serializers.PrimaryKeyRelatedField(queryset=Unit.objects.all(), required=False, allow_null=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    sku = serializers.CharField(source="product.sku", read_only=True)
    barcode = serializers.SerializerMethodField()
    difference = serializers.DecimalField(max_digits=14, decimal_places=3, read_only=True)

    class Meta:
        model = DocumentLine
        fields = [
            "id", "product", "product_name", "sku", "barcode", "quantity", "entered_quantity", "entered_unit", "unit",
            "expected_quantity", "difference", "price", "scanned_barcode", "scanned_at", "updated_at",
        ]
        read_only_fields = ["entered_quantity", "expected_quantity", "updated_at"]

    def get_barcode(self, line) -> str:
        barcode = line.product.primary_barcode
        return barcode.code if barcode else ""

    def to_representation(self, line):
        data = super().to_representation(line)
        data["unit"] = (line.entered_unit or line.product.base_unit).name
        return data

    def validate(self, attrs):
        product = attrs["product"]
        unit = attrs.get("entered_unit")
        unit_name = attrs.pop("unit", None)
        if unit is None and unit_name:
            unit = find_unit(unit_name)
            if unit is None:
                raise serializers.ValidationError({"unit": f"Невідома одиниця: {unit_name}"})
        try:
            factor = product.factor_for(unit)
        except ValueError as exc:
            raise serializers.ValidationError({"unit": str(exc)})
        entered = attrs["quantity"]
        if entered < 0:
            raise serializers.ValidationError({"quantity": "Кількість не може бути від’ємною"})
        attrs["entered_quantity"] = entered
        attrs["entered_unit"] = unit or product.base_unit
        attrs["quantity"] = entered * factor
        return attrs


class DocumentSerializer(serializers.ModelSerializer):
    lines = DocumentLineSerializer(many=True, required=False)
    id = serializers.UUIDField(required=False)
    # `destination` is the old field name still used by clients.
    destination = serializers.PrimaryKeyRelatedField(
        source="destination_warehouse", queryset=Warehouse.objects.all(), required=False, allow_null=True
    )
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    destination_name = serializers.CharField(source="destination_warehouse.name", read_only=True, default=None)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    total_quantity = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id", "number", "type", "status", "warehouse", "warehouse_name", "destination", "destination_name",
            "writeoff_reason", "inventory_mode", "counterparty", "external_ref", "note", "created_by",
            "created_by_name", "device", "posted_by", "posted_at", "cancelled_by", "cancelled_at", "is_deleted",
            "version", "client_created_at", "created_at", "updated_at", "total_quantity", "lines",
        ]
        read_only_fields = [
            "number", "status", "created_by", "device", "posted_by", "posted_at", "cancelled_by", "cancelled_at",
            "is_deleted", "version", "created_at", "updated_at",
        ]

    def get_total_quantity(self, doc) -> str:
        return str(sum((line.quantity for line in doc.lines.all()), Decimal(0)))

    def validate(self, attrs):
        doc_type = attrs.get("type", getattr(self.instance, "type", None))
        if self.instance and "type" in attrs and attrs["type"] != self.instance.type:
            raise serializers.ValidationError({"type": "Тип документа змінювати не можна"})
        warehouse = attrs.get("warehouse", getattr(self.instance, "warehouse", None))
        destination = attrs.get("destination_warehouse", getattr(self.instance, "destination_warehouse", None))
        if doc_type != Document.TRANSFER and destination:
            raise serializers.ValidationError({"destination": "Склад-одержувач лише для переміщення"})
        if destination and warehouse and destination.pk == warehouse.pk:
            raise serializers.ValidationError({"destination": "Склад-одержувач має відрізнятися від складу-відправника"})
        if doc_type != Document.WRITEOFF and attrs.get("writeoff_reason"):
            raise serializers.ValidationError({"writeoff_reason": "Причина лише для списання"})
        if doc_type != Document.INVENTORY and attrs.get("inventory_mode"):
            raise serializers.ValidationError({"inventory_mode": "Режим лише для інвентаризації"})
        if "lines" in attrs:
            attrs["lines"] = self._merge_duplicate_products(attrs["lines"])
        return attrs

    @staticmethod
    def _merge_duplicate_products(lines):
        """One product = one line: repeated scans add up (UNIQUE(document, product))."""
        merged = {}
        for line in lines:
            key = line["product"].pk
            if key in merged:
                merged[key]["quantity"] += line["quantity"]
                merged[key]["entered_quantity"] += line["entered_quantity"]
            else:
                merged[key] = dict(line)
        return list(merged.values())

    @staticmethod
    def _write_lines(doc, lines):
        doc.lines.all().delete()
        DocumentLine.objects.bulk_create([DocumentLine(document=doc, **line) for line in lines])

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines", [])
        doc = Document.objects.create(**validated_data)
        self._write_lines(doc, lines)
        return doc

    @transaction.atomic
    def update(self, doc, validated_data):
        lines = validated_data.pop("lines", None)
        validated_data.pop("id", None)
        for key, value in validated_data.items():
            setattr(doc, key, value)
        doc.bump_version()
        doc.save()
        if lines is not None:
            self._write_lines(doc, lines)
        return doc
