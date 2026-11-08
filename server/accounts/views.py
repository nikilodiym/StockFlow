from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from core.permissions import IsStaff

from .models import Device, Membership
from .serializers import (
    DeviceSerializer, LoginSerializer, LogoutSerializer, MembershipSerializer, PinLoginSerializer,
    SetPinSerializer, UserSerializer,
)
from . import services

User = get_user_model()


class LoginView(APIView):
    """Email + password → JWT. Optionally registers the phone (`device`)."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    @extend_schema(request=LoginSerializer, responses={200: dict})
    def post(self, request):
        data = LoginSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        return Response(services.login_with_password(request, v["email"], v["password"], v.get("device")))


class PinLoginView(APIView):
    """Quick login on a phone where the user already signed in with a password."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "pin"

    @extend_schema(request=PinLoginSerializer, responses={200: dict})
    def post(self, request):
        data = PinLoginSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        return Response(services.login_with_pin(v["device_id"], v["user_id"], v["pin"]))


class SetPinView(APIView):
    @extend_schema(request=SetPinSerializer, responses={204: None})
    def post(self, request):
        data = SetPinSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        request.user.set_pin(data.validated_data["pin"])
        request.user.save(update_fields=["pin_hash", "pin_failed_attempts", "pin_locked_until"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class LogoutView(APIView):
    """Blacklists the refresh token so it can no longer issue access tokens."""

    @extend_schema(request=LogoutSerializer, responses={205: None})
    def post(self, request):
        data = LogoutSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        try:
            RefreshToken(data.validated_data["refresh"]).blacklist()
        except TokenError as exc:
            raise ValidationError({"refresh": str(exc)})
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=UserSerializer)
    def get(self, request):
        return Response(UserSerializer(request.user, context={"request": request}).data)


class UserViewSet(viewsets.ModelViewSet):
    """Staff accounts. DELETE blocks the account instead of removing it: documents keep their author."""

    queryset = User.objects.prefetch_related("memberships__warehouse")
    serializer_class = UserSerializer
    permission_classes = [IsStaff]
    search_fields = ["email", "full_name", "phone"]
    filterset_fields = ["is_active", "is_staff"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def perform_destroy(self, instance):
        if instance.pk == self.request.user.pk:
            raise ValidationError({"detail": "Не можна заблокувати власний акаунт"})
        instance.is_active = False
        instance.save(update_fields=["is_active"])


class MembershipViewSet(viewsets.ModelViewSet):
    queryset = Membership.objects.select_related("user", "warehouse")
    serializer_class = MembershipSerializer
    permission_classes = [IsStaff]
    filterset_fields = ["user", "warehouse", "role"]


class DeviceViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Phones list; staff can block a lost phone (PATCH is_blocked)."""

    queryset = Device.objects.select_related("user")
    serializer_class = DeviceSerializer
    permission_classes = [IsStaff]
    filterset_fields = ["user", "is_blocked", "platform"]
    http_method_names = ["get", "patch", "head", "options"]
