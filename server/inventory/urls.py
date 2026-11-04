from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import DashboardView, DocumentViewSet, StockMovementViewSet, StockViewSet, WarehouseViewSet

router = DefaultRouter()
router.register("warehouses", WarehouseViewSet, basename="warehouse")
router.register("stock", StockViewSet, basename="stock")
router.register("stock-movements", StockMovementViewSet, basename="stock-movement")
router.register("documents", DocumentViewSet, basename="document")

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    *router.urls,
]
