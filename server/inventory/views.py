"""
HTTP layer only: parse the request, call a service (changes) or a selector (reads),
return the response. Business rules live in services.py, queries in selectors.py.
"""
from datetime import date

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsStaffOrReadOnly, warehouse_ids

from . import selectors, services
from .models import Document, Stock, StockMovement, Warehouse
from .serializers import DocumentSerializer, StockMovementSerializer, StockSerializer, WarehouseSerializer


def _int_param(request, name, default=None):
    value = request.query_params.get(name)
    if value in (None, ""):
        return default
    if not value.isdigit():
        raise ValidationError({name: "Очікується число"})
    return int(value)


class WarehouseViewSet(viewsets.ModelViewSet):
    serializer_class = WarehouseSerializer
    permission_classes = [IsStaffOrReadOnly]
    search_fields = ["name", "code"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Warehouse.objects.none()
        queryset = Warehouse.objects.all()
        if self.request.query_params.get("include_inactive") != "1":
            queryset = queryset.filter(is_active=True)
        ids = warehouse_ids(self.request.user)
        return queryset if ids is None else queryset.filter(pk__in=ids)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])


class StockViewSet(viewsets.ReadOnlyModelViewSet):
    """Current balances per warehouse. Read-only: balances change only by posting documents."""

    serializer_class = StockSerializer
    filterset_fields = ["warehouse", "product"]
    search_fields = ["product__name", "product__sku"]
    ordering_fields = ["quantity", "updated_at"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Stock.objects.none()
        return selectors.stock_rows(warehouse_ids(self.request.user), low_only=self.request.query_params.get("low") == "1")

    @extend_schema(parameters=[
        OpenApiParameter("product", int, required=True), OpenApiParameter("warehouse", int), OpenApiParameter("days", int),
    ])
    @action(detail=False, methods=["get"])
    def history(self, request):
        """Daily balance changes of a product — data for the stock chart."""
        product = _int_param(request, "product")
        if product is None:
            raise ValidationError({"product": "Обов’язковий параметр"})
        warehouse = _int_param(request, "warehouse")
        if warehouse is not None:
            services.ensure_member(request.user, warehouse)
        return Response(selectors.stock_history(product, warehouse, _int_param(request, "days", 30)))


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StockMovementSerializer
    filterset_fields = ["warehouse", "product", "document", "movement_type"]
    ordering_fields = ["created_at"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return StockMovement.objects.none()
        return selectors.movements(warehouse_ids(self.request.user))


class DocumentViewSet(viewsets.ModelViewSet):
    """
    Warehouse documents.
    - workers: create and edit their own drafts on their warehouses;
    - managers: also edit any draft of their warehouse, post and cancel;
    - destination warehouse: confirms receipt of a transfer;
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
        return selectors.visible_documents(
            warehouse_ids(self.request.user), include_deleted=self.request.query_params.get("include_deleted") == "1"
        )

    def perform_create(self, serializer):
        services.ensure_member(self.request.user, serializer.validated_data["warehouse"].pk)
        doc = serializer.save(created_by=self.request.user)
        serializer.instance = services.post_if_requested(doc, self.request.user, self.request.data.get("status"))

    def perform_update(self, serializer):
        services.ensure_can_edit(self.request.user, serializer.instance)
        if "warehouse" in serializer.validated_data:
            services.ensure_member(self.request.user, serializer.validated_data["warehouse"].pk)
        doc = serializer.save()
        serializer.instance = services.post_if_requested(doc, self.request.user, self.request.data.get("status"))

    def perform_destroy(self, doc):
        services.soft_delete(doc, self.request.user)

    def _respond(self, doc):
        return Response(self.get_serializer(self.get_queryset().get(pk=doc.pk)).data)

    @extend_schema(request=None)
    @action(detail=True, methods=["post"])
    def post(self, request, pk=None):
        """Post the draft: balances change, movements are written (transfer: goods leave the source)."""
        doc = self.get_object()
        services.ensure_can_post(request.user, doc)
        return self._respond(services.post_document(doc, request.user))

    @extend_schema(request=None)
    @action(detail=True, methods=["post"])
    def receive(self, request, pk=None):
        """Transfer: the destination warehouse confirms receipt, goods are added to its stock."""
        return self._respond(services.receive_document(self.get_object(), request.user))

    @extend_schema(request=None)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Cancel a posted document: reverse movements with the opposite delta."""
        doc = self.get_object()
        services.ensure_can_post(request.user, doc)
        return self._respond(services.cancel_document(doc, request.user))

    @action(detail=True, methods=["get"])
    def discrepancies(self, request, pk=None):
        """Inventory: counted vs expected, with the money amount."""
        return Response(selectors.inventory_discrepancies(self.get_object()))

    @action(detail=False, methods=["get"], url_path="incoming")
    def incoming(self, request):
        """Transfers waiting for this user's warehouses to confirm receipt."""
        docs = selectors.incoming_transfers(warehouse_ids(request.user))
        return Response(self.get_serializer(docs, many=True).data)


class DashboardView(APIView):
    @extend_schema(responses={200: dict})
    def get(self, request):
        return Response(selectors.dashboard(request.user, warehouse_ids(request.user)))


class ScansByHourView(APIView):
    """Scanned lines per hour (Profile chart). ?date=YYYY-MM-DD, ?mine=1 for the current user only."""

    @extend_schema(parameters=[OpenApiParameter("date", str), OpenApiParameter("mine", bool)], responses={200: dict})
    def get(self, request):
        raw = request.query_params.get("date")
        try:
            day = date.fromisoformat(raw) if raw else None
        except ValueError:
            raise ValidationError({"date": "Формат YYYY-MM-DD"})
        user = request.user if request.query_params.get("mine") == "1" else None
        return Response(selectors.scans_by_hour(warehouse_ids(request.user), day, user))
