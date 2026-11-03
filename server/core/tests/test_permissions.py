import pytest
from django.contrib.auth.models import AnonymousUser

from core.permissions import ADMIN, MANAGER, WORKER, is_manager, is_member, role_on, warehouse_ids

pytestmark = pytest.mark.django_db


def test_staff_is_admin_on_every_warehouse(admin, warehouse, warehouse2):
    assert role_on(admin, warehouse.pk) == ADMIN
    assert role_on(admin, warehouse2.pk) == ADMIN
    assert warehouse_ids(admin) is None  # None = all warehouses


def test_role_is_per_warehouse(manager, worker, warehouse, warehouse2):
    assert role_on(manager, warehouse.pk) == MANAGER
    assert role_on(worker, warehouse.pk) == WORKER
    assert role_on(manager, warehouse2.pk) is None
    assert warehouse_ids(worker) == [warehouse.pk]


def test_manager_of_one_warehouse_is_not_manager_of_another(manager, warehouse, warehouse2):
    assert is_manager(manager, warehouse.pk)
    assert not is_manager(manager, warehouse2.pk)
    assert not is_member(manager, warehouse2.pk)


def test_anonymous_has_no_role(warehouse):
    assert role_on(AnonymousUser(), warehouse.pk) is None


def test_versioned_model_bumps(make_product):
    product = make_product()
    assert product.version == 1
    product.bump_version()
    product.save()
    product.refresh_from_db()
    assert product.version == 2
