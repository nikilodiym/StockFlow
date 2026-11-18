import pytest
from django.contrib.auth.models import Permission

pytestmark = pytest.mark.django_db


def test_global_admin_has_all_django_permissions_without_explicit_grants(admin):
    assert not admin.is_superuser
    assert not admin.user_permissions.exists()
    for permission in Permission.objects.select_related('content_type'):
        assert admin.has_perm(f'{permission.content_type.app_label}.{permission.codename}')
        assert admin.has_module_perms(permission.content_type.app_label)


def test_disabled_admin_has_no_django_permissions(admin):
    admin.is_active = False
    assert not admin.has_perm('inventory.change_document')
    assert not admin.has_module_perms('inventory')


def test_worker_does_not_inherit_admin_permissions(worker):
    assert not worker.has_perm('accounts.change_user')
    assert not worker.has_module_perms('accounts')
