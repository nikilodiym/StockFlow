from decimal import Decimal

import pytest

from inventory.models import Document
from inventory.services import post_document

pytestmark = pytest.mark.django_db


def draft(warehouse, product, **extra):
    return {"type": "receipt", "warehouse": warehouse.pk, "lines": [{"product": product.pk, "quantity": 2}], **extra}


class TestDocumentApi:
    def test_worker_creates_draft(self, client_for, worker, warehouse, make_product):
        response = client_for(worker).post("/api/documents/", draft(warehouse, make_product()), format="json")
        assert response.status_code == 201, response.data
        assert response.data["status"] == "draft" and response.data["number"].startswith("ПР-")
        assert response.data["created_by"] == worker.pk

    def test_worker_cannot_use_foreign_warehouse(self, client_for, worker, warehouse2, make_product):
        response = client_for(worker).post("/api/documents/", draft(warehouse2, make_product()), format="json")
        assert response.status_code == 403

    def test_list_is_scoped_to_own_warehouses(self, client_for, worker, admin, warehouse, warehouse2, make_document):
        make_document("receipt", warehouse, admin)
        make_document("receipt", warehouse2, admin)
        assert len(client_for(worker).get("/api/documents/").data) == 1
        assert len(client_for(admin).get("/api/documents/").data) == 2

    def test_packs_are_converted_to_base_unit(self, client_for, worker, warehouse, make_product):
        product = make_product(pack=12)
        payload = {"type": "receipt", "warehouse": warehouse.pk,
                   "lines": [{"product": product.pk, "quantity": 2, "unit": "упак"}]}
        line = client_for(worker).post("/api/documents/", payload, format="json").data["lines"][0]
        assert Decimal(line["quantity"]) == 24
        assert Decimal(line["entered_quantity"]) == 2 and line["unit"] == "упак"

    def test_repeated_scans_merge_into_one_line(self, client_for, worker, warehouse, make_product):
        product = make_product()
        payload = {"type": "receipt", "warehouse": warehouse.pk,
                   "lines": [{"product": product.pk, "quantity": 1}, {"product": product.pk, "quantity": 10}]}
        lines = client_for(worker).post("/api/documents/", payload, format="json").data["lines"]
        assert len(lines) == 1 and Decimal(lines[0]["quantity"]) == 11

    def test_worker_cannot_post(self, client_for, worker, warehouse, make_document, make_product):
        doc = make_document("receipt", warehouse, worker, [(make_product(), 1)])
        assert client_for(worker).post(f"/api/documents/{doc.pk}/post/").status_code == 403

    def test_manager_posts_and_cancels(self, client_for, worker, manager, warehouse, make_document, make_product, stock_of):
        product = make_product()
        doc = make_document("receipt", warehouse, worker, [(product, 5)])
        response = client_for(manager).post(f"/api/documents/{doc.pk}/post/")
        assert response.status_code == 200 and response.data["status"] == "posted"
        assert stock_of(product, warehouse) == 5
        response = client_for(manager).post(f"/api/documents/{doc.pk}/cancel/")
        assert response.data["status"] == "cancelled" and stock_of(product, warehouse) == 0

    def test_status_posted_on_create_posts_for_manager(self, client_for, manager, warehouse, make_product, stock_of):
        product = make_product()
        response = client_for(manager).post("/api/documents/", draft(warehouse, product, status="posted"), format="json")
        assert response.data["status"] == "posted" and stock_of(product, warehouse) == 2

    def test_status_posted_from_worker_stays_draft(self, client_for, worker, warehouse, make_product, stock_of):
        product = make_product()
        response = client_for(worker).post("/api/documents/", draft(warehouse, product, status="posted"), format="json")
        assert response.data["status"] == "draft" and stock_of(product, warehouse) == 0

    def test_posted_document_cannot_be_edited(self, client_for, manager, warehouse, make_document, make_product):
        doc = post_document(make_document("receipt", warehouse, manager, [(make_product(), 1)]), manager)
        response = client_for(manager).patch(f"/api/documents/{doc.pk}/", {"note": "x"}, format="json")
        assert response.status_code == 400

    def test_worker_cannot_edit_others_draft(self, client_for, make_user, worker, warehouse, make_document):
        other = make_user("other@test.ua", role="worker", warehouse=warehouse)
        doc = make_document("receipt", warehouse, other)
        assert client_for(worker).patch(f"/api/documents/{doc.pk}/", {"note": "x"}, format="json").status_code == 403

    def test_edit_bumps_version(self, client_for, worker, warehouse, make_document):
        doc = make_document("receipt", warehouse, worker)
        response = client_for(worker).patch(f"/api/documents/{doc.pk}/", {"note": "оновлено"}, format="json")
        assert response.data["version"] == 2

    def test_delete_is_soft(self, client_for, worker, warehouse, make_document):
        doc = make_document("receipt", warehouse, worker)
        assert client_for(worker).delete(f"/api/documents/{doc.pk}/").status_code == 204
        doc.refresh_from_db()
        assert doc.is_deleted and Document.objects.filter(pk=doc.pk).exists()
        assert client_for(worker).get("/api/documents/").data == []

    def test_type_specific_fields_are_validated(self, client_for, worker, warehouse, make_product):
        response = client_for(worker).post(
            "/api/documents/", draft(warehouse, make_product(), writeoff_reason="damage"), format="json"
        )
        assert response.status_code == 400 and "writeoff_reason" in response.data

    def test_inventory_discrepancies(self, client_for, manager, warehouse, make_document, make_product):
        product = make_product(price=10)
        post_document(make_document("receipt", warehouse, manager, [(product, 10)]), manager)
        doc = post_document(make_document("inventory", warehouse, manager, [(product, 7)]), manager)
        row = client_for(manager).get(f"/api/documents/{doc.pk}/discrepancies/").data[0]
        assert row["difference"] == -3 and row["amount"] == Decimal("-30.00")


class TestStockApi:
    def test_stock_is_read_only_and_scoped(self, client_for, worker, admin, warehouse, warehouse2, make_document, make_product):
        product = make_product()
        post_document(make_document("receipt", warehouse, admin, [(product, 3)]), admin)
        post_document(make_document("receipt", warehouse2, admin, [(product, 9)]), admin)
        client = client_for(worker)
        rows = client.get("/api/stock/").data
        assert [(r["warehouse"], Decimal(r["quantity"])) for r in rows] == [(warehouse.pk, 3)]
        assert client.post("/api/stock/", {}, format="json").status_code == 405

    def test_history(self, client_for, manager, warehouse, make_document, make_product):
        product = make_product()
        post_document(make_document("receipt", warehouse, manager, [(product, 3)]), manager)
        data = client_for(manager).get(f"/api/stock/history/?product={product.pk}&warehouse={warehouse.pk}").data
        assert data[0]["delta"] == 3


def test_dashboard_keeps_old_keys(client_for, admin, warehouse, make_document, make_product):
    product = make_product(min_stock=5)
    post_document(make_document("receipt", warehouse, admin, [(product, 2)]), admin)
    data = client_for(admin).get("/api/dashboard/").data
    for key in ("products_count", "stock_units", "low_stock_count", "documents_today", "active_workers",
                "recent_documents", "low_stock", "recent_syncs", "stock_value"):
        assert key in data
    assert data["low_stock_count"] == 1 and data["stock_units"] == 2


class TestTransferReceiptApi:
    def test_incoming_and_receive(self, client_for, admin, make_user, warehouse, warehouse2, make_document, make_product, stock_of):
        product = make_product()
        receiver = make_user("lviv@test.ua", role="worker", warehouse=warehouse2)
        transfer = post_document(make_document("transfer", warehouse, admin, [(product, 3)], destination_warehouse=warehouse2), admin)
        client = client_for(receiver)
        incoming = client.get("/api/v1/documents/incoming/").data
        assert [d["id"] for d in incoming] == [str(transfer.pk)] and incoming[0]["in_transit"] is True
        response = client.post(f"/api/v1/documents/{transfer.pk}/receive/")
        assert response.status_code == 200 and response.data["received_by"] == receiver.pk
        assert stock_of(product, warehouse2) == 3
        assert client.get("/api/v1/documents/incoming/").data == []

    def test_source_manager_cannot_receive(self, client_for, admin, manager, warehouse, warehouse2, make_document, make_product):
        transfer = post_document(make_document("transfer", warehouse, admin, [(make_product(), 1)], destination_warehouse=warehouse2), admin)
        response = client_for(manager).post(f"/api/v1/documents/{transfer.pk}/receive/")
        assert response.status_code == 403


def test_scans_by_hour(client_for, worker, warehouse, make_document, make_product):
    make_document("receipt", warehouse, worker, [(make_product(), 1), (make_product(), 2)])
    hours = client_for(worker).get("/api/v1/reports/scans-by-hour/?mine=1").data
    assert len(hours) == 24 and sum(h["scans"] for h in hours) == 2
    assert client_for(worker).get("/api/v1/reports/scans-by-hour/?date=nope").status_code == 400
