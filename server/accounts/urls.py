from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import DeviceViewSet, LoginView, LogoutView, MembershipViewSet, MeView, PinLoginView, SetPinView, UserViewSet

router = DefaultRouter()
router.register("users", UserViewSet)
router.register("memberships", MembershipViewSet)
router.register("devices", DeviceViewSet)

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/pin/", PinLoginView.as_view(), name="pin-login"),
    path("auth/pin/set/", SetPinView.as_view(), name="pin-set"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/me/", MeView.as_view(), name="me"),
    *router.urls,
]
