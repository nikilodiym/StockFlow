from rest_framework.permissions import BasePermission, SAFE_METHODS
from .models import Membership


class IsManagerOrAdmin(BasePermission):
    """Allow warehouse team members to read; managers/admins may mutate."""
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_authenticated and (
            request.user.is_staff
            or Membership.objects.filter(
                user=request.user, role__in=["manager", "admin"]
            ).exists()
        )


class IsAdminOnly(BasePermission):
    """Only administrators may read or change user accounts."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_superuser
            or Membership.objects.filter(user=request.user, role="admin").exists()
        )


class IsAdmin(BasePermission):
    """Only administrators may change warehouse and membership records."""
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_authenticated and (
            request.user.is_superuser
            or Membership.objects.filter(user=request.user, role="admin").exists()
        )
