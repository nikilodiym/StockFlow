from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from .models import Warehouse, Membership

User = get_user_model()


class UserManagementTests(APITestCase):
    def setUp(self):
        self.warehouse = Warehouse.objects.create(name="Центральний склад", code="KYIV-01")
        self.admin = User.objects.create_user("admin@gmail.com", "admin@gmail.com", "admin")
        Membership.objects.create(user=self.admin, warehouse=self.warehouse, role="admin")
        self.client.force_authenticate(self.admin)

    def create_worker(self, **extra):
        payload = {
            "name": "Іван Петренко",
            "email": "Ivan@Example.com",
            "password": "Sklad-2026!",
            "role": "worker",
            "warehouse": self.warehouse.pk,
            **extra,
        }
        return self.client.post("/api/users/", payload, format="json")

    def test_admin_creates_worker_who_can_log_in(self):
        response = self.create_worker()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["email"], "ivan@example.com")
        self.assertEqual(response.data["name"], "Іван Петренко")
        self.assertEqual(response.data["memberships"][0]["role"], "worker")
        self.assertNotIn("password", response.data)

        self.client.force_authenticate(None)
        login = self.client.post(
            "/api/auth/login/",
            {"email": "IVAN@example.com ", "password": "Sklad-2026!"},
            format="json",
        )
        self.assertEqual(login.status_code, 200, login.data)
        self.assertEqual(login.data["user"]["memberships"][0]["warehouse_name"], "Центральний склад")

    def test_duplicate_email_rejected(self):
        self.create_worker()
        response = self.create_worker(email="ivan@example.com")
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

    def test_required_fields_and_weak_password(self):
        response = self.client.post("/api/users/", {"email": "a@b.com"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertTrue({"password", "role", "warehouse"} <= set(response.data))

        response = self.create_worker(password="123")
        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data)

    def test_non_admin_cannot_list_or_create(self):
        worker_id = self.create_worker().data["id"]
        self.client.force_authenticate(User.objects.get(pk=worker_id))
        self.assertEqual(self.client.get("/api/users/").status_code, 403)
        self.assertEqual(self.create_worker(email="x@y.com").status_code, 403)

        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/users/").status_code, 401)

    def test_block_and_unblock(self):
        worker_id = self.create_worker().data["id"]
        self.assertEqual(self.client.delete(f"/api/users/{worker_id}/").status_code, 204)
        self.assertFalse(User.objects.get(pk=worker_id).is_active)

        self.client.force_authenticate(None)
        login = self.client.post(
            "/api/auth/login/",
            {"email": "ivan@example.com", "password": "Sklad-2026!"},
            format="json",
        )
        self.assertEqual(login.status_code, 401)

        self.client.force_authenticate(self.admin)
        response = self.client.patch(f"/api/users/{worker_id}/", {"is_active": True}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(User.objects.get(pk=worker_id).is_active)

    def test_change_role(self):
        worker_id = self.create_worker().data["id"]
        response = self.client.patch(f"/api/users/{worker_id}/", {"role": "manager"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["memberships"][0]["role"], "manager")

    def test_admin_cannot_block_self(self):
        self.assertEqual(self.client.delete(f"/api/users/{self.admin.pk}/").status_code, 400)
        response = self.client.patch(f"/api/users/{self.admin.pk}/", {"is_active": False}, format="json")
        self.assertEqual(response.status_code, 400)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)
