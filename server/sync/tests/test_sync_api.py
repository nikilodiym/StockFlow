import uuid
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from accounts.models import Device
from inventory.models import Document
from inventory.services import post_document
from sync.models import Notification, SyncBatch, SyncConflict

pytestmark = pytest.mark.django_db


def doc_data(warehouse, product, quantity=2, **extra):
    return {"type": "receipt", "warehouse": warehouse.pk, "lines": [{"product": product.pk, "quantity": quantity}], **extra}


def push(client, items, device_id=None, batch_id=None, device=None):
    body = {"batch_id": str(batch_id or uuid.uuid4()), "device_id": str(device_id or uuid.uuid4()), "items": items}
    if device:
        body["device"] = device
    return client.post("/api/sync/push/", body, format="json")


def item(op, doc_id, data=None, base_version=None):
    entry = {"entity": "document", "id": str(doc_id), "op": op, "data": data or {}}
    if base_version is not None:
        entry["base_version"] = base_version
    return entry


class TestPush:
    def test_create_document(self, client_for, worker, warehouse, make_product):
        doc_id = uuid.uuid4()
        response = push(client_for(worker), [item("create", doc_id, doc_data(warehouse, make_product()))])
        assert response.status_code == 200, response.data
        result = response.data["results"][0]
        assert result["result"] == "applied" and result["version"] == 1 and result["number"].startswith("ПР-")
        doc = Document.objects.get(pk=doc_id)
        assert doc.created_by == worker and doc.device_id is not None

    def test_same_batch_twice_is_idempotent(self, client_for, worker, warehouse, make_product):
        client, batch_id, doc_id = client_for(worker), uuid.uuid4(), uuid.uuid4()
        items = [item("create", doc_id, doc_data(warehouse, make_product()))]
        first = push(client, items, batch_id=batch_id).data
        second = push(client, items, batch_id=batch_id).data
        assert first == second
        assert Document.objects.count() == 1 and SyncBatch.objects.count() == 1

    def test_same_document_in_new_batch_is_duplicate(self, client_for, worker, warehouse, make_product):
        client, doc_id = client_for(worker), uuid.uuid4()
        items = [item("create", doc_id, doc_data(warehouse, make_product()))]
        push(client, items)
        assert push(client, items).data["results"][0]["result"] == "duplicate"

    def test_update_with_stale_version_is_conflict(self, client_for, worker, manager, warehouse, make_document, make_product):
        doc = make_document("receipt", warehouse, worker, [(make_product(), 1)])
        client_for(manager).patch(f"/api/documents/{doc.pk}/", {"note": "manager edit"}, format="json")  # version 2
        response = push(client_for(worker), [item("update", doc.pk, {"note": "phone edit"}, base_version=1)])
        result = response.data["results"][0]
        assert result["result"] == "conflict" and result["reason"] == "version_mismatch"
        assert result["server_version"] == 2 and result["server"]["note"] == "manager edit"
        conflict = SyncConflict.objects.get()
        assert conflict.status == "open" and conflict.local_data == {"note": "phone edit"}
        assert set(Notification.objects.filter(type="sync_conflict").values_list("user", flat=True)) == {worker.pk, manager.pk}

    def test_update_posted_document_is_conflict(self, client_for, worker, manager, warehouse, make_document, make_product):
        doc = make_document("receipt", warehouse, worker, [(make_product(), 1)])
        post_document(doc, manager)
        result = push(client_for(worker), [item("update", doc.pk, {"note": "x"})]).data["results"][0]
        assert result["reason"] == "already_posted"

    def test_update_and_delete(self, client_for, worker, warehouse, make_document, make_product):
        doc = make_document("receipt", warehouse, worker, [(make_product(), 1)])
        client = client_for(worker)
        result = push(client, [item("update", doc.pk, {"note": "оновлено"}, base_version=1)]).data["results"][0]
        assert result["result"] == "applied" and result["version"] == 2
        result = push(client, [item("delete", doc.pk, base_version=2)]).data["results"][0]
        assert result["result"] == "applied"
        doc.refresh_from_db()
        assert doc.is_deleted

    def test_post_needs_manager(self, client_for, worker, manager, warehouse, make_document, make_product, stock_of):
        product = make_product()
        doc = make_document("receipt", warehouse, worker, [(product, 4)])
        result = push(client_for(worker), [item("post", doc.pk)]).data["results"][0]
        assert result["result"] == "error" and stock_of(product, warehouse) == 0
        assert Notification.objects.filter(user=worker, type="sync_failed").exists()
        result = push(client_for(manager), [item("post", doc.pk, base_version=1)]).data["results"][0]
        assert result["result"] == "applied" and stock_of(product, warehouse) == 4
        assert push(client_for(manager), [item("post", doc.pk)]).data["results"][0]["result"] == "duplicate"

    def test_inactive_product_is_conflict(self, client_for, worker, warehouse, make_product):
        product = make_product(is_active=False)
        result = push(client_for(worker), [item("create", uuid.uuid4(), doc_data(warehouse, product))]).data["results"][0]
        assert result["reason"] == "product_inactive"

    def test_foreign_warehouse_is_error(self, client_for, worker, warehouse2, make_product):
        result = push(client_for(worker), [item("create", uuid.uuid4(), doc_data(warehouse2, make_product()))]).data
        assert result["results"][0]["result"] == "error" and result["status"] == "failed"

    def test_partial_batch(self, client_for, worker, warehouse, warehouse2, make_product):
        product = make_product()
        data = push(client_for(worker), [
            item("create", uuid.uuid4(), doc_data(warehouse, product)),
            item("create", uuid.uuid4(), doc_data(warehouse2, product)),
        ]).data
        assert data["status"] == "partial"
        batch = SyncBatch.objects.get()
        assert (batch.items_total, batch.items_ok, batch.items_failed) == (2, 1, 1)

    def test_blocked_device_is_refused(self, client_for, worker):
        device = Device.objects.create(is_blocked=True)
        assert push(client_for(worker), [], device_id=device.pk).status_code == 403

    def test_device_state_replaces_heartbeat(self, client_for, worker, manager):
        device_id = uuid.uuid4()
        push(client_for(worker), [], device_id=device_id, device={"battery_level": 10, "is_charging": False, "app_version": "2.0"})
        device = Device.objects.get(pk=device_id)
        assert device.user == worker and device.battery_level == 10 and device.app_version == "2.0"
        assert device.last_seen_at and device.last_sync_at
        assert Notification.objects.get(type="low_battery").user == manager
        push(client_for(worker), [], device_id=device_id, device={"battery_level": 9})
        assert Notification.objects.filter(type="low_battery").count() == 1, "only when crossing the threshold"


class TestPull:
    def test_first_pull_returns_everything(self, client_for, worker, warehouse, warehouse2, make_product, make_document, admin):
        product = make_product(barcode="4820000000011")
        post_document(make_document("receipt", warehouse, admin, [(product, 5)]), admin)
        post_document(make_document("receipt", warehouse2, admin, [(product, 7)]), admin)
        data = client_for(worker).get("/api/sync/pull/").data
        assert [p["sku"] for p in data["products"]] == [product.sku]
        assert [b["code"] for b in data["barcodes"]] == ["4820000000011"]
        assert [w["id"] for w in data["warehouses"]] == [warehouse.pk]
        assert [(s["warehouse"], Decimal(s["quantity"])) for s in data["stock"]] == [(warehouse.pk, 5)]
        assert len(data["documents"]) == 1
        assert data["cursor"]

    def test_cursor_returns_only_changes_including_deactivated(self, client_for, worker, make_product):
        client = client_for(worker)
        product, other = make_product(), make_product()
        cursor = client.get("/api/sync/pull/").data["cursor"]
        product.is_active = False
        product.save()
        data = client.get("/api/sync/pull/", {"cursor": cursor.isoformat()}).data
        assert [(p["id"], p["is_active"]) for p in data["products"]] == [(product.pk, False)]
        assert other.pk not in [p["id"] for p in data["products"]]

    def test_notifications_come_with_pull(self, client_for, worker):
        client = client_for(worker)
        cursor = client.get("/api/sync/pull/").data["cursor"]
        Notification.objects.create(user=worker, type="low_stock", title="Мало кави")
        data = client.get("/api/sync/pull/", {"cursor": cursor.isoformat()}).data
        assert [n["title"] for n in data["notifications"]] == ["Мало кави"]

    def test_bad_cursor(self, client_for, worker):
        assert client_for(worker).get("/api/sync/pull/", {"cursor": "yesterday"}).status_code == 400

    def test_pull_with_device_is_journaled(self, client_for, worker):
        device_id = uuid.uuid4()
        client_for(worker).get("/api/sync/pull/", {"device_id": str(device_id), "battery_level": 50})
        assert SyncBatch.objects.get().direction == "pull"
        assert Device.objects.get(pk=device_id).battery_level == 50


class TestConflicts:
    def make_conflict(self, client_for, worker, manager, doc):
        client_for(manager).patch(f"/api/documents/{doc.pk}/", {"note": "manager"}, format="json")
        push(client_for(worker), [item("update", doc.pk, {"note": "phone"}, base_version=1)])
        return SyncConflict.objects.get()

    def test_keep_local_applies_phone_version(self, client_for, worker, manager, warehouse, make_document, make_product):
        doc = make_document("receipt", warehouse, worker, [(make_product(), 1)])
        conflict = self.make_conflict(client_for, worker, manager, doc)
        response = client_for(manager).post(f"/api/sync/conflicts/{conflict.pk}/resolve/", {"decision": "kept_local"}, format="json")
        assert response.status_code == 200 and response.data["status"] == "kept_local"
        doc.refresh_from_db()
        assert doc.note == "phone" and doc.version == 3

    def test_accept_server(self, client_for, worker, manager, warehouse, make_document, make_product):
        doc = make_document("receipt", warehouse, worker, [(make_product(), 1)])
        conflict = self.make_conflict(client_for, worker, manager, doc)
        client_for(worker).post(f"/api/sync/conflicts/{conflict.pk}/resolve/", {"decision": "kept_server"}, format="json")
        doc.refresh_from_db()
        assert doc.note == "manager"
        again = client_for(manager).post(f"/api/sync/conflicts/{conflict.pk}/resolve/", {"decision": "kept_local"}, format="json")
        assert again.status_code == 400


class TestLegacySync:
    """The current mobile app still posts {device_id, changes: [{client_id, document}]} to /api/sync/."""

    def payload(self, warehouse, product, doc_id, status="draft"):
        return {"device_id": "android", "changes": [{"client_id": str(doc_id), "document": {
            "id": str(doc_id), "type": "receipt", "status": status, "warehouse": warehouse.pk, "note": "",
            "created_at": timezone.now().isoformat(), "lines": [{"product": product.pk, "quantity": 3, "unit": "шт"}],
        }}]}

    def test_old_payload_is_accepted(self, client_for, worker, warehouse, make_product):
        doc_id = uuid.uuid4()
        response = client_for(worker).post("/api/sync/", self.payload(warehouse, make_product(), doc_id), format="json")
        assert response.status_code == 200, response.data
        assert response.data["results"][0] == {"client_id": str(doc_id), "status": "accepted", "entity_id": str(doc_id), "version": 1}
        assert Document.objects.get(pk=doc_id).client_created_at is not None

    def test_resend_does_not_double_stock(self, client_for, manager, warehouse, make_product, stock_of):
        product, doc_id, client = make_product(), uuid.uuid4(), client_for(manager)
        body = self.payload(warehouse, product, doc_id, status="posted")
        client.post("/api/sync/", body, format="json")
        again = client.post("/api/sync/", body, format="json")
        assert again.status_code == 200
        assert stock_of(product, warehouse) == 3

    def test_conflict_returns_409(self, client_for, worker, manager, warehouse, make_product):
        product, doc_id = make_product(), uuid.uuid4()
        client_for(worker).post("/api/sync/", self.payload(warehouse, product, doc_id), format="json")
        post_document(Document.objects.get(pk=doc_id), manager)
        changed = self.payload(warehouse, product, doc_id)
        changed["changes"][0]["document"]["note"] = "змінено на телефоні"
        response = client_for(worker).post("/api/sync/", changed, format="json")
        assert response.status_code == 409 and response.data["results"][0]["status"] == "conflict"


class TestNotificationsApi:
    def test_list_read_and_read_all(self, client_for, worker, manager):
        mine = Notification.objects.create(user=worker, type="low_stock", title="1")
        Notification.objects.create(user=worker, type="low_stock", title="2")
        Notification.objects.create(user=manager, type="low_stock", title="чуже")
        client = client_for(worker)
        assert len(client.get("/api/notifications/").data) == 2
        assert client.post(f"/api/notifications/{mine.pk}/read/").data["read_at"]
        assert len(client.get("/api/notifications/?unread=1").data) == 1
        assert client.post("/api/notifications/read-all/").data == {"marked": 1}


def test_stale_devices_command(worker, manager, settings):
    from django.core.management import call_command

    Device.objects.create(user=worker, last_sync_at=timezone.now() - timedelta(hours=settings.STALE_DEVICE_HOURS + 1))
    call_command("check_devices")
    call_command("check_devices")
    assert Notification.objects.filter(type="stale_device", user=manager).count() == 1
