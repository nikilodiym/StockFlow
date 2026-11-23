from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    DashboardView, DocumentViewSet, ScansByDayView, ScansByHourView, StockMovementViewSet, StockViewSet, WarehouseViewSet,
    WorkerActivityView,
)

router = DefaultRouter()
router.register("warehouses", WarehouseViewSet, basename="warehouse")
router.register("stock", StockViewSet, basename="stock")
router.register("stock-movements", StockMovementViewSet, basename="stock-movement")
router.register("documents", DocumentViewSet, basename="document")

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("reports/scans-by-hour/", ScansByHourView.as_view(), name="scans-by-hour"),
    path("reports/scans-by-day/", ScansByDayView.as_view(), name="scans-by-day"),
    path("reports/workers/", WorkerActivityView.as_view(), name="worker-activity"),
    *router.urls,
]
