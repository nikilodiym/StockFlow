from rest_framework.routers import DefaultRouter
from .views import ProductViewSet,DocumentViewSet,WarehouseViewSet,MembershipViewSet
router=DefaultRouter(); router.register('products',ProductViewSet); router.register('documents',DocumentViewSet); router.register('warehouses',WarehouseViewSet); router.register('memberships',MembershipViewSet)
urlpatterns=router.urls
