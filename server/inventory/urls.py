from rest_framework.routers import DefaultRouter
from .views import ProductViewSet,DocumentViewSet,WarehouseViewSet,MembershipViewSet,UserViewSet
router=DefaultRouter(); router.register('products',ProductViewSet); router.register('documents',DocumentViewSet); router.register('warehouses',WarehouseViewSet); router.register('memberships',MembershipViewSet); router.register('users',UserViewSet)
urlpatterns=router.urls
