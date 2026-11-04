import uuid

import pytest

from accounts.models import Device, Membership, User
from conftest import PASSWORD

pytestmark = pytest.mark.django_db


def login(api, email, password=PASSWORD, **extra):
    return api.post("/api/auth/login/", {"email": email, "password": password, **extra}, format="json")


class TestLogin:
    def test_login_returns_tokens_and_memberships(self, api, worker, warehouse):
        response = login(api, " WORKER@test.ua ")
        assert response.status_code == 200, response.data
        assert {"access", "refresh", "user"} <= response.data.keys()
        membership = response.data["user"]["memberships"][0]
        assert membership["warehouse"] == warehouse.pk
        assert membership["role"] == "worker"

    def test_wrong_password(self, api, worker):
        assert login(api, worker.email, "wrong").status_code == 401

    def test_blocked_user_cannot_log_in(self, api, worker):
        worker.is_active = False
        worker.save()
        assert login(api, worker.email).status_code == 401

    def test_login_registers_device(self, api, worker):
        device_id = uuid.uuid4()
        response = login(api, worker.email, device={"id": str(device_id), "model": "Samsung A52", "battery_level": 80})
        assert response.status_code == 200
        device = Device.objects.get(pk=device_id)
        assert device.user == worker and device.model == "Samsung A52" and device.battery_level == 80

    def test_blocked_device_is_refused(self, api, worker):
        device = Device.objects.create(is_blocked=True)
        assert login(api, worker.email, device={"id": str(device.pk)}).status_code == 403

    def test_me(self, client_for, worker):
        response = client_for(worker).get("/api/auth/me/")
        assert response.data["email"] == worker.email


class TestPinLogin:
    def test_full_pin_flow(self, api, client_for, worker):
        device_id = uuid.uuid4()
        login(api, worker.email, device={"id": str(device_id)})
        assert client_for(worker).post("/api/auth/pin/set/", {"pin": "4321"}, format="json").status_code == 204

        ok = api.post("/api/auth/pin/", {"device_id": str(device_id), "user_id": worker.pk, "pin": "4321"}, format="json")
        assert ok.status_code == 200 and "access" in ok.data
        bad = api.post("/api/auth/pin/", {"device_id": str(device_id), "user_id": worker.pk, "pin": "0000"}, format="json")
        assert bad.status_code == 401

    def test_pin_needs_known_device(self, api, worker):
        worker.set_pin("1234")
        worker.save()
        response = api.post("/api/auth/pin/", {"device_id": str(uuid.uuid4()), "user_id": worker.pk, "pin": "1234"}, format="json")
        assert response.status_code == 403

    def test_pin_must_be_4_digits(self, client_for, worker):
        assert client_for(worker).post("/api/auth/pin/set/", {"pin": "12a"}, format="json").status_code == 400


class TestLogout:
    def test_logout_blacklists_refresh(self, api, worker):
        tokens = login(api, worker.email).data
        api.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        assert api.post("/api/auth/logout/", {"refresh": tokens["refresh"]}, format="json").status_code == 205
        api.credentials()
        assert api.post("/api/auth/refresh/", {"refresh": tokens["refresh"]}, format="json").status_code == 401


class TestUserManagement:
    payload = {"name": "Іван Петренко", "email": "Ivan@Example.com", "password": PASSWORD, "role": "worker"}

    def test_admin_creates_worker_who_can_log_in(self, api, client_for, admin, warehouse):
        response = client_for(admin).post("/api/users/", {**self.payload, "warehouse": warehouse.pk}, format="json")
        assert response.status_code == 201, response.data
        assert response.data["email"] == "ivan@example.com"
        assert response.data["memberships"][0]["role"] == "worker"
        assert "password" not in response.data
        assert login(api, "IVAN@example.com").status_code == 200

    def test_role_admin_means_is_staff(self, client_for, admin, warehouse):
        response = client_for(admin).post(
            "/api/users/", {**self.payload, "role": "admin", "warehouse": warehouse.pk}, format="json"
        )
        user = User.objects.get(pk=response.data["id"])
        assert user.is_staff
        assert response.data["memberships"][0]["role"] == "admin"
        assert Membership.objects.get(user=user).role == "manager"

    def test_duplicate_email(self, client_for, admin, worker, warehouse):
        response = client_for(admin).post(
            "/api/users/", {**self.payload, "email": "WORKER@test.ua", "warehouse": warehouse.pk}, format="json"
        )
        assert response.status_code == 400 and "email" in response.data

    def test_weak_password(self, client_for, admin, warehouse):
        response = client_for(admin).post(
            "/api/users/", {**self.payload, "password": "123", "warehouse": warehouse.pk}, format="json"
        )
        assert response.status_code == 400 and "password" in response.data

    def test_worker_cannot_manage_users(self, client_for, worker):
        assert client_for(worker).get("/api/users/").status_code == 403

    def test_delete_blocks_instead_of_removing(self, client_for, admin, worker):
        assert client_for(admin).delete(f"/api/users/{worker.pk}/").status_code == 204
        worker.refresh_from_db()
        assert worker.is_active is False

    def test_cannot_block_self(self, client_for, admin):
        assert client_for(admin).delete(f"/api/users/{admin.pk}/").status_code == 400
        response = client_for(admin).patch(f"/api/users/{admin.pk}/", {"is_active": False}, format="json")
        assert response.status_code == 400

    def test_change_role(self, client_for, admin, worker):
        response = client_for(admin).patch(f"/api/users/{worker.pk}/", {"role": "manager"}, format="json")
        assert response.status_code == 200
        assert worker.memberships.get().role == "manager"

    def test_admin_blocks_device(self, client_for, admin, worker):
        device = Device.objects.create(user=worker)
        response = client_for(admin).patch(f"/api/devices/{device.pk}/", {"is_blocked": True}, format="json")
        assert response.status_code == 200
        device.refresh_from_db()
        assert device.is_blocked
