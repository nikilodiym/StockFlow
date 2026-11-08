"""Authentication services: password / PIN login, device registration, JWT issuing."""
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.models import update_last_login
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from core.exceptions import AccessDenied, DomainError

from .models import Device

User = get_user_model()


class InvalidCredentials(DomainError):
    code = "invalid_credentials"
    status_code = status.HTTP_401_UNAUTHORIZED


class PinLocked(DomainError):
    code = "pin_locked"
    status_code = status.HTTP_423_LOCKED


def register_device(user, state):
    """Create/update the phone the user is logging in from. Blocked phones are refused."""
    if not state or not state.get("id"):
        return None
    device, _ = Device.objects.get_or_create(pk=state["id"])
    if device.is_blocked:
        raise AccessDenied("Пристрій заблоковано адміністратором", code="device_blocked")
    device.user = user
    device.apply_state(state)
    device.save()
    return device


def issue_tokens(user):
    """JWT pair + profile the clients need right after login."""
    from .serializers import MembershipSerializer

    refresh = RefreshToken.for_user(user)
    memberships = user.memberships.select_related("warehouse", "user")
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.get_full_name(),
            "is_staff": user.is_staff,
            "has_pin": user.has_pin,
            "memberships": MembershipSerializer(memberships, many=True).data,
        },
    }


def login_with_password(request, email, password, device_state=None):
    """Email (case-insensitive) + password → tokens. Blocked users and wrong passwords get the same answer."""
    user = authenticate(request, username=email.strip().lower(), password=password)
    if not user:
        raise InvalidCredentials("Невірний email або пароль")
    register_device(user, device_state)
    update_last_login(None, user)
    return issue_tokens(user)


def login_with_pin(device_id, user_id, pin):
    """Quick login on a phone where the user already signed in with a password."""
    device = Device.objects.filter(pk=device_id).first()
    user = User.objects.filter(pk=user_id, is_active=True).first()
    if not device or device.is_blocked or not user:
        raise AccessDenied("Вхід за PIN недоступний на цьому пристрої", code="pin_unavailable")
    if user.is_pin_locked():
        raise PinLocked("PIN тимчасово заблоковано. Увійдіть за паролем.")
    if not user.check_pin(pin):
        raise InvalidCredentials("Невірний PIN")
    device.user = user
    device.apply_state({})
    device.save(update_fields=["user", "last_seen_at"])
    update_last_login(None, user)
    return issue_tokens(user)
