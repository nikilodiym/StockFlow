from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Device


def register_device(user, state):
    """Create/update the phone the user is logging in from. Blocked phones are refused."""
    if not state or not state.get("id"):
        return None
    device, _ = Device.objects.get_or_create(pk=state["id"])
    if device.is_blocked:
        raise PermissionDenied("Пристрій заблоковано адміністратором")
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
