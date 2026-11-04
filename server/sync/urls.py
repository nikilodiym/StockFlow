from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import LegacySyncView, NotificationViewSet, SyncBatchViewSet, SyncConflictViewSet, SyncPullView, SyncPushView

router = DefaultRouter()
router.register("sync/batches", SyncBatchViewSet, basename="sync-batch")
router.register("sync/conflicts", SyncConflictViewSet, basename="sync-conflict")
router.register("notifications", NotificationViewSet, basename="notification")

urlpatterns = [
    path("sync/", LegacySyncView.as_view(), name="sync-legacy"),
    path("sync/push/", SyncPushView.as_view(), name="sync-push"),
    path("sync/pull/", SyncPullView.as_view(), name="sync-pull"),
    *router.urls,
]
