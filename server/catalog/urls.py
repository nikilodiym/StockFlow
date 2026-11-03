from rest_framework.routers import DefaultRouter

from .views import BarcodeViewSet, CategoryViewSet, ImportJobViewSet, ProductUnitViewSet, ProductViewSet, UnitViewSet

router = DefaultRouter()
router.register("categories", CategoryViewSet)
router.register("units", UnitViewSet)
router.register("products", ProductViewSet, basename="product")
router.register("product-units", ProductUnitViewSet)
router.register("barcodes", BarcodeViewSet)
router.register("imports", ImportJobViewSet)

urlpatterns = router.urls
