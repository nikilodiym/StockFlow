from django.db.models import F, Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsStaffOrReadOnly, is_member, warehouse_ids

from . import reports
from .models import Document, Stock, StockMovement, Warehouse
from .serializers import DocumentSerializer, StockMovementSerializer, StockSerializer, WarehouseSerializer
from .services import DocumentError, can_edit, can_post, cancel_document, post_document


class WarehouseScopedMixin:
    """Non-staff users see only the warehouses they have a membership on."""

    warehouse_field = "warehouse_id"

    def scope(self, queryset):
        ids = warehouse_ids(self.request.user)
        return queryset if ids is None else queryset.filter(**{f"{self.warehouse_field}__in": ids})


class WarehouseViewSet(WarehouseScopedMixin, viewsets.ModelViewSet):
    serializer_class = WarehouseSerializer
    permission_classes = [IsStaffOrReadOnly]
    warehouse_field = "id"
    search_fields = ["name", "code"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Warehouse.objects.none()
        queryset = Warehouse.objects.all()
        if self.request.query_params.get("include_inactive") != "1":
            queryset = queryset.filter(is_active=True)
        return self.scope(queryset)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])


class StockViewSet(WarehouseScopedMixin, viewsets.ReadOnlyModelViewSet):
    """Current balances per warehouse. Read-only: balances change only by posting documents."""

    serializer_class = StockSerializer
    filterset_fields = ["warehouse", "product"]
    search_fields = ["product__name", "product__sku"]
    ordering_fields = ["quantity", "updated_at"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Stock.objects.none()
        queryset = self.scope(Stock.objects.select_related("product", "warehouse"))
        if self.request.query_params.get("low") == "1":
            queryset = queryset.filter(quantity__lte=F("product__min_stock"))
        return queryset

    @extend_schema(parameters=[
        OpenApiParameter("product", int, required=True), OpenApiParameter("warehouse", int), OpenApiParameter("days", int),
    ])
    @action(detail=False, methods=["get"])
    def history(self, request):
        """Daily balance changes of a product — data for the stock chart."""
        product = request.query_params.get("product")
        if not product:
            raise ValidationError({"product": "Обов’язковий параметр"})
        warehouse = request.query_params.get("warehouse")
        if warehouse and not is_member(request.user, int(warehouse)):
            raise PermissionDenied("Немає доступу до складу")
        days = int(request.query_params.get("days", 30))
        return Response(reports.stock_history(int(product), int(warehouse) if warehouse else None, days))


class StockMovementViewSet(WarehouseScopedMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = StockMovementSerializer
    filterset_fields = ["warehouse", "product", "document", "movement_type"]
    ordering_fields = ["created_at"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return StockMovement.objects.none()
        return self.scope(StockMovement.objects.select_related("product", "document"))


class DocumentViewSet(viewsets.ModelViewSet):
    """
    Warehouse documents.
    - workers: create and edit their own drafts on their warehouses;
    - managers: also edit any draft of their warehouse, post and cancel;
    - DELETE marks a draft as deleted (soft delete, so phones learn about it).
    Compatibility: creating/updating with "status": "posted" posts right away if allowed.
    """

    serializer_class = DocumentSerializer
    filterset_fields = ["type", "status", "warehouse", "destination_warehouse", "created_by"]
    search_fields = ["number", "note", "counterparty", "external_ref"]
    ordering_fields = ["created_at", "updated_at", "posted_at"]
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Document.objects.none()
        queryset = Document.objects.select_related(
            "warehouse", "destination_warehouse", "created_by"
        ).prefetch_related("lines__product__barcodes", "lines__product__base_unit", "lines__entered_unit")
        if self.request.query_params.get("include_deleted") != "1":
            queryset = queryset.filter(is_deleted=False)
        ids = warehouse_ids(self.request.user)
        if ids is not None:
            queryset = queryset.filter(Q(warehouse_id__in=ids) | Q(destination_warehouse_id__in=ids))
        return queryset

    # --- permissions -------------------------------------------------------
    def _check_can_edit(self, doc):
        if not doc.is_draft:
            raise ValidationError({"detail": "Змінювати можна лише чернетку. Проведений документ можна тільки скасувати."})
        if not can_edit(self.request.user, doc):
            raise PermissionDenied("Редагувати можна лише власні чернетки")

    def _post_if_requested(self, doc):
        if self.request.data.get("status") == Document.POSTED and can_post(self.request.user, doc):
            try:
                return post_document(doc, self.request.user)
            except DocumentError as exc:
                raise ValidationError({"detail": str(exc)})
        return doc

    # --- CRUD --------------------------------------------------------------
    def perform_create(self, serializer):
        warehouse = serializer.validated_data["warehouse"]
        if not is_member(self.request.user, warehouse.pk):
            raise PermissionDenied("Немає доступу до цього складу")
        doc = serializer.save(created_by=self.request.user)
        serializer.instance = self._post_if_requested(doc)

    def perform_update(self, serializer):
        self._check_can_edit(serializer.instance)
        warehouse = serializer.validated_data.get("warehouse")
        if warehouse and not is_member(self.request.user, warehouse.pk):
            raise PermissionDenied("Немає доступу до цього складу")
        doc = serializer.save()
        serializer.instance = self._post_if_requested(doc)

    def perform_destroy(self, doc):
        self._check_can_edit(doc)
        doc.is_deleted = True
        doc.bump_version()
        doc.save(update_fields=["is_deleted", "version", "updated_at"])

    # --- actions -----------------------------------------------------------
    def _run(self, func, doc):
        if not can_post(self.request.user, doc):
            raise PermissionDenied("Проводити та скасовувати документи може лише менеджер складу")
        try:
            doc = func(doc, self.request.user)
        except DocumentError as exc:
            raise ValidationError({"detail": str(exc)})
        return Response(self.get_serializer(self.get_queryset().get(pk=doc.pk)).data)

    @extend_schema(request=None)
    @action(detail=True, methods=["post"])
    def post(self, request, pk=None):
        """Post the draft: balances change, movements are written."""
        return self._run(post_document, self.get_object())

    @extend_schema(request=None)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Cancel a posted document: reverse movements with the opposite delta."""
        return self._run(cancel_document, self.get_object())

    @action(detail=True, methods=["get"])
    def discrepancies(self, request, pk=None):
        """Inventory: counted vs expected, with the money amount."""
        return Response(reports.inventory_discrepancies(self.get_object()))


class DashboardView(APIView):
    @extend_schema(responses={200: dict})
    def get(self, request):
        return Response(reports.dashboard(request.user, warehouse_ids(request.user)))

