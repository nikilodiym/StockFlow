from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import IsStaff, IsStaffOrReadOnly

from .models import Barcode, Category, ImportJob, ProductUnit, Unit
from .serializers import (
    BarcodeSerializer, CategorySerializer, ImportJobSerializer, ProductSerializer, ProductUnitSerializer,
    UnitSerializer,
)
from . import selectors
from .services import resolve_barcode, run_import


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsStaffOrReadOnly]
    filterset_fields = ["parent", "is_active"]
    search_fields = ["name"]

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])


class UnitViewSet(viewsets.ModelViewSet):
    queryset = Unit.objects.all()
    serializer_class = UnitSerializer
    permission_classes = [IsStaffOrReadOnly]

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsStaffOrReadOnly]
    filterset_fields = {"category": ["exact"], "base_unit": ["exact"], "is_active": ["exact"]}
    search_fields = ["name", "sku", "barcodes__code"]
    ordering_fields = ["name", "sku", "price", "total_stock", "updated_at"]

    def get_queryset(self):
        warehouse = self.request.query_params.get("warehouse")
        queryset = selectors.products_with_stock(
            [int(warehouse)] if warehouse and warehouse.isdigit() else None,
            # lists show active products; a single (even deactivated) product stays reachable by id
            include_inactive=self.action != "list" or self.request.query_params.get("include_inactive") == "1",
        )
        return queryset.distinct() if self.request.query_params.get("search") else queryset

    def perform_destroy(self, instance):
        """Products stay in documents (PROTECT), so they are only deactivated."""
        instance.is_active = False
        instance.bump_version()
        instance.save(update_fields=["is_active", "version", "updated_at"])

    @extend_schema(parameters=[OpenApiParameter("code", str, required=True)])
    @action(detail=False, methods=["get"], url_path="by-barcode")
    def by_barcode(self, request):
        """Scan lookup: barcode → product + unit + factor (e.g. pack = 12 pcs)."""
        product, unit, factor = resolve_barcode(request.query_params.get("code", ""))
        if not product:
            return Response({"detail": "Штрихкод не знайдено"}, status=status.HTTP_404_NOT_FOUND)
        product = self.get_queryset().get(pk=product.pk)
        return Response({
            "product": self.get_serializer(product).data,
            "unit": unit.name,
            "unit_id": unit.pk,
            "factor": str(factor),
        })


class ProductUnitViewSet(viewsets.ModelViewSet):
    queryset = ProductUnit.objects.select_related("unit")
    serializer_class = ProductUnitSerializer
    permission_classes = [IsStaffOrReadOnly]
    filterset_fields = ["product"]


class BarcodeViewSet(viewsets.ModelViewSet):
    queryset = Barcode.objects.all()
    serializer_class = BarcodeSerializer
    permission_classes = [IsStaffOrReadOnly]
    filterset_fields = ["product", "is_primary", "is_active"]
    search_fields = ["code"]

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.is_primary = False
        instance.save(update_fields=["is_active", "is_primary", "updated_at"])


class ImportJobViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Upload a CSV (sku,barcode,name,category,unit,price,min_stock) — processed right away."""

    queryset = ImportJob.objects.all()
    serializer_class = ImportJobSerializer
    permission_classes = [IsStaff]

    def perform_create(self, serializer):
        job = serializer.save(created_by=self.request.user)
        run_import(job)
