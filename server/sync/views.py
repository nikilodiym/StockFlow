from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import warehouse_ids

from . import services
from .models import Notification, SyncBatch, SyncConflict
from .serializers import (
    LegacySyncSerializer, NotificationSerializer, PushSerializer, ResolveConflictSerializer, SyncBatchSerializer,
    SyncConflictSerializer,
)


class SyncPushView(APIView):
    """Phone → server. Idempotent by batch_id; carries device state (battery etc.) instead of a heartbeat."""

    @extend_schema(request=PushSerializer, responses={200: dict})
    def post(self, request):
        data = PushSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return Response(services.process_push(request.user, data.validated_data))


class SyncPullView(APIView):
    """Server → phone: everything changed since `cursor`, including new notifications."""

    @extend_schema(
        parameters=[OpenApiParameter("cursor", str, description="ISO time from the previous pull"),
                    OpenApiParameter("device_id", str)],
        responses={200: dict},
    )
    def get(self, request):
        device_id = request.query_params.get("device_id")
        device_id = services._as_uuid(device_id) if device_id else None
        state = {k: request.query_params[k] for k in ("app_version", "platform") if k in request.query_params}
        if "battery_level" in request.query_params:
            state["battery_level"] = int(request.query_params["battery_level"])
        return Response(services.build_pull(request.user, request.query_params.get("cursor"), device_id, state))


class LegacySyncView(APIView):
    """Old endpoint of the current mobile app. Returns 409 when a document conflicts."""

    @extend_schema(request=LegacySyncSerializer, responses={200: dict, 409: dict})
    def post(self, request):
        data = LegacySyncSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        body, has_conflict = services.legacy_sync(request.user, data.validated_data)
        return Response(body, status=status.HTTP_409_CONFLICT if has_conflict else status.HTTP_200_OK)


class SyncBatchViewSet(viewsets.ReadOnlyModelViewSet):
    """Sync journal: staff see everything, others only their own batches."""

    serializer_class = SyncBatchSerializer
    filterset_fields = ["status", "direction", "device", "user"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return SyncBatch.objects.none()
        queryset = SyncBatch.objects.select_related("user", "device")
        return queryset if self.request.user.is_staff else queryset.filter(user=self.request.user)


class SyncConflictViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SyncConflictSerializer
    filterset_fields = ["status", "conflict_reason"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return SyncConflict.objects.none()
        queryset = SyncConflict.objects.select_related("batch")
        ids = warehouse_ids(self.request.user)
        if ids is None:
            return queryset
        from inventory.models import Document

        own_docs = Document.objects.filter(warehouse_id__in=ids).values("pk")
        return queryset.filter(entity_id__in=own_docs) | queryset.filter(batch__user=self.request.user)

    @extend_schema(request=ResolveConflictSerializer, responses=SyncConflictSerializer)
    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        """'Keep local' (kept_local) applies the phone's version; 'Accept server' (kept_server) closes it."""
        conflict = self.get_object()
        data = ResolveConflictSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        conflict = services.resolve_conflict(conflict, request.user, data.validated_data["decision"])
        return Response(self.get_serializer(conflict).data)


class NotificationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Own notifications (phones get them in /sync/pull too)."""

    serializer_class = NotificationSerializer
    filterset_fields = ["type", "warehouse"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Notification.objects.none()
        queryset = Notification.objects.filter(user=self.request.user)
        unread = self.request.query_params.get("unread")
        return queryset.filter(read_at__isnull=True) if unread == "1" else queryset

    @extend_schema(request=None)
    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        notification = self.get_object()
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at"])
        return Response(self.get_serializer(notification).data)

    @extend_schema(request=None, responses={200: dict})
    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        count = self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response({"marked": count})
