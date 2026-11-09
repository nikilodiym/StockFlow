"""Role checks. A role is granted per warehouse; users.is_staff is the global administrator."""
from rest_framework.permissions import SAFE_METHODS, BasePermission

WORKER = "worker"
MANAGER = "manager"
ADMIN = "admin"


def role_on(user, warehouse_id):
    """Role of `user` on one warehouse: 'admin' for staff, else 'manager'/'worker'/None."""
    if not user or not user.is_authenticated or not user.is_active:
        return None
    if user.is_staff:
        return ADMIN
    if warehouse_id is None:
        return None
    membership = user.memberships.filter(warehouse_id=warehouse_id).only("role").first()
    return membership.role if membership else None


def is_member(user, warehouse_id):
    return role_on(user, warehouse_id) is not None


def is_manager(user, warehouse_id):
    return role_on(user, warehouse_id) in (MANAGER, ADMIN)


def warehouse_ids(user):
    """Warehouses the user works on. None means 'all' (staff)."""
    if user.is_staff:
        return None
    return list(user.memberships.values_list("warehouse_id", flat=True))


class IsStaff(BasePermission):
    message = "Доступно лише адміністратору"

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class IsStaffOrReadOnly(BasePermission):
    message = "Змінювати може лише адміністратор"

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return request.method in SAFE_METHODS or request.user.is_staff
