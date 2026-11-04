import uuid

import pytest
from django.db import IntegrityError, transaction

from accounts.models import Device, Membership, User

pytestmark = pytest.mark.django_db


class TestUser:
    def test_email_is_login_and_lowercased(self):
        user = User.objects.create_user(email="  Ivan@Example.COM ", password="x")
        assert user.email == "ivan@example.com"
        assert User.USERNAME_FIELD == "email"

    def test_email_unique_case_insensitive(self):
        User.objects.create_user(email="a@test.ua", password="x")
        with pytest.raises(IntegrityError):
            User.objects.create(email="A@TEST.UA")  # save() lowercases → same value

    def test_superuser_is_staff(self):
        user = User.objects.create_superuser(email="root@test.ua", password="x")
        assert user.is_staff and user.is_superuser

    def test_full_name_falls_back_to_email(self):
        assert User(email="x@test.ua").get_full_name() == "x@test.ua"
        assert User(email="x@test.ua", full_name="Іван").get_full_name() == "Іван"


class TestPin:
    def test_set_and_check_pin(self, worker):
        worker.set_pin("1234")
        worker.save()
        assert worker.has_pin
        assert worker.pin_hash != "1234"
        assert worker.check_pin("1234")
        assert not worker.check_pin("0000")

    def test_pin_locks_after_max_attempts(self, worker, settings):
        settings.PIN_MAX_ATTEMPTS = 5
        worker.set_pin("1234")
        worker.save()
        for _ in range(5):
            assert not worker.check_pin("0000")
        assert worker.is_pin_locked()
        assert not worker.check_pin("1234"), "correct PIN is refused while locked"

    def test_success_resets_failed_attempts(self, worker):
        worker.set_pin("1234")
        worker.save()
        worker.check_pin("0000")
        worker.check_pin("1234")
        worker.refresh_from_db()
        assert worker.pin_failed_attempts == 0


class TestMembership:
    def test_one_role_per_warehouse(self, worker, warehouse):
        with pytest.raises(IntegrityError):
            Membership.objects.create(user=worker, warehouse=warehouse, role="manager")

    def test_only_one_default_warehouse(self, worker, warehouse2):
        with pytest.raises(IntegrityError):
            Membership.objects.create(user=worker, warehouse=warehouse2, role="worker", is_default=True)

    def test_second_non_default_membership_is_fine(self, worker, warehouse2):
        Membership.objects.create(user=worker, warehouse=warehouse2, role="manager")
        assert worker.memberships.count() == 2

    def test_role_must_be_worker_or_manager(self, make_user, warehouse):
        user = make_user("x@test.ua")
        with pytest.raises(IntegrityError):
            Membership.objects.create(user=user, warehouse=warehouse, role="admin")

    def test_deleting_user_removes_memberships(self, worker):
        worker.delete()
        assert not Membership.objects.exists()


class TestDevice:
    def test_battery_must_be_0_100(self, worker):
        with pytest.raises(IntegrityError), transaction.atomic():
            Device.objects.create(user=worker, battery_level=101)
        assert Device.objects.create(user=worker, battery_level=100).battery_level == 100

    def test_apply_state_updates_last_seen(self, worker):
        device = Device.objects.create(id=uuid.uuid4(), user=worker)
        device.apply_state({"battery_level": 40, "app_version": "1.2.0", "unknown": "ignored"})
        assert device.battery_level == 40
        assert device.app_version == "1.2.0"
        assert device.last_seen_at is not None

    def test_user_deletion_keeps_device(self, worker):
        device = Device.objects.create(user=worker)
        worker.delete()
        device.refresh_from_db()
        assert device.user is None
