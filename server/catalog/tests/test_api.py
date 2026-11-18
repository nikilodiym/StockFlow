from decimal import Decimal

import pytest

from catalog.models import Product
from inventory.models import Document

pytestmark = pytest.mark.django_db


class TestProductApi:
    def test_list_keeps_flat_fields_for_clients(self, client_for, worker, make_product):
        make_product(name="Кава", barcode="4820000000013", unit="pack", min_stock=8, price=349)
        item = client_for(worker).get("/api/products/").data[0]
        assert item["unit"] == "упак"
        assert item["barcode"] == "4820000000013"
        assert item["category"] == "Загальне"
        assert Decimal(item["stock"]) == 0
        assert item["is_low"] is True

    def test_create_with_opening_stock_posts_receipt(self, client_for, admin, warehouse, units, stock_of):
        payload = {"sku": "N-1", "name": "Новий", "category": "Напої", "unit": "шт", "barcode": "4820000000099",
                   "price": 10, "min_stock": 2, "stock": 15}
        response = client_for(admin).post("/api/products/", payload, format="json")
        assert response.status_code == 201, response.data
        assert Decimal(response.data["stock"]) == 15
        product = Product.objects.get(sku="N-1")
        assert stock_of(product, warehouse) == 15
        assert Document.objects.get(type="receipt").status == "posted"

    def test_stock_is_ignored_on_update(self, client_for, admin, make_product):
        product = make_product()
        response = client_for(admin).patch(f"/api/products/{product.pk}/", {"stock": 100, "name": "X"}, format="json")
        assert response.status_code == 200
        assert Decimal(response.data["stock"]) == 0 and response.data["version"] == 2

    def test_stock_per_warehouse(self, client_for, admin, make_product, make_document, warehouse, warehouse2):
        from inventory.services import post_document

        product = make_product()
        post_document(make_document("receipt", warehouse, admin, [(product, 5)]), admin)
        post_document(make_document("receipt", warehouse2, admin, [(product, 7)]), admin)
        client = client_for(admin)
        assert Decimal(client.get(f"/api/products/{product.pk}/").data["stock"]) == 12
        assert Decimal(client.get(f"/api/products/{product.pk}/?warehouse={warehouse2.pk}").data["stock"]) == 7

    def test_worker_cannot_change_catalog(self, client_for, worker, units):
        assert client_for(worker).post("/api/products/", {"sku": "X", "name": "X"}, format="json").status_code == 403

    def test_new_scanned_product_can_be_found_and_added_to_a_receipt(self, client_for, admin, warehouse, units):
        client = client_for(admin)
        created = client.post('/api/products/', {'sku': 'NEW-SCAN', 'name': 'Новий товар', 'barcode': '4821234567890', 'unit': 'шт'}, format='json')
        assert created.status_code == 201, created.data
        lookup = client.get('/api/products/by-barcode/?code=4821234567890')
        assert lookup.status_code == 200
        assert lookup.data['product']['id'] == created.data['id']
        receipt = client.post('/api/documents/', {'type': 'receipt', 'warehouse': warehouse.pk, 'lines': [{'product': created.data['id'], 'quantity': 2, 'unit': 'шт'}]}, format='json')
        assert receipt.status_code == 201, receipt.data
        assert receipt.data['lines'][0]['product'] == created.data['id']

    def test_delete_only_deactivates(self, client_for, admin, make_product):
        product = make_product()
        assert client_for(admin).delete(f"/api/products/{product.pk}/").status_code == 204
        product.refresh_from_db()
        assert product.is_active is False
        assert client_for(admin).get("/api/products/").data == []

    def test_search_by_barcode(self, client_for, worker, make_product):
        make_product(name="Вода", barcode="4820000000011")
        make_product(name="Сік", barcode="4820000000012")
        data = client_for(worker).get("/api/products/?search=0000000012").data
        assert [p["name"] for p in data] == ["Сік"]

    def test_by_barcode_lookup(self, client_for, worker, make_product, units):
        product = make_product(barcode="4820000000011", pack=12)
        product.barcodes.create(code="4820000000019", unit=units["pack"])
        response = client_for(worker).get("/api/products/by-barcode/?code=4820000000019")
        assert response.status_code == 200
        assert response.data["product"]["id"] == product.pk
        assert response.data["unit"] == "упак" and Decimal(response.data["factor"]) == 12
        assert client_for(worker).get("/api/products/by-barcode/?code=nope").status_code == 404

    def test_duplicate_barcode_rejected(self, client_for, admin, make_product, units):
        make_product(barcode="111")
        response = client_for(admin).post("/api/products/", {"sku": "Z", "name": "Z", "barcode": "111"}, format="json")
        assert response.status_code == 400 and "barcode" in response.data


def test_import_endpoint(client_for, admin, units, settings, tmp_path):
    from django.core.files.uploadedfile import SimpleUploadedFile

    settings.MEDIA_ROOT = tmp_path
    file = SimpleUploadedFile("p.csv", "sku,name,unit\nA-1,Товар,шт\n".encode(), content_type="text/csv")
    response = client_for(admin).post("/api/imports/", {"file": file}, format="multipart")
    assert response.status_code == 201, response.data
    assert response.data["status"] == "done" and response.data["rows_created"] == 1
