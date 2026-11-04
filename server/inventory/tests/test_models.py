from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from inventory.models import Document, DocumentLine, Stock, StockMovement

pytestmark = pytest.mark.django_db
YEAR = timezone.localdate().year


class TestDocument:
    def test_number_is_assigned_per_type(self, make_document, warehouse, worker):
        first = make_document("receipt", warehouse, worker)
        second = make_document("receipt", warehouse, worker)
        writeoff = make_document("writeoff", warehouse, worker)
        assert first.number == f"ПР-{YEAR}-000001"
        assert second.number == f"ПР-{YEAR}-000002"
        assert writeoff.number == f"СП-{YEAR}-000001"

    def test_uuid_from_phone_is_kept(self, warehouse, worker):
        import uuid

        doc_id = uuid.uuid4()
        doc = Document.objects.create(id=doc_id, type="receipt", warehouse=warehouse, created_by=worker)
        assert doc.pk == doc_id

    def test_defaults_for_writeoff_and_inventory(self, make_document, warehouse, worker):
        assert make_document("writeoff", warehouse, worker).writeoff_reason == "other"
        assert make_document("inventory", warehouse, worker).inventory_mode == "partial"
        receipt = make_document("receipt", warehouse, worker)
        assert receipt.writeoff_reason is None and receipt.inventory_mode is None

    def test_destination_only_for_transfer(self, make_document, warehouse, warehouse2, worker):
        with pytest.raises(IntegrityError), transaction.atomic():
            make_document("receipt", warehouse, worker, destination_warehouse=warehouse2)
        assert make_document("transfer", warehouse, worker, destination_warehouse=warehouse2).pk

    def test_destination_differs_from_source(self, make_document, warehouse, worker):
        with pytest.raises(IntegrityError):
            make_document("transfer", warehouse, worker, destination_warehouse=warehouse)

    def test_reason_only_for_writeoff(self, make_document, warehouse, worker):
        with pytest.raises(IntegrityError):
            make_document("receipt", warehouse, worker, writeoff_reason="damage")

    def test_mode_only_for_inventory(self, make_document, warehouse, worker):
        with pytest.raises(IntegrityError):
            make_document("receipt", warehouse, worker, inventory_mode="full")

    def test_invalid_status(self, make_document, warehouse, worker):
        with pytest.raises(IntegrityError):
            make_document("receipt", warehouse, worker, status="synced")

    def test_warehouse_with_documents_cannot_be_deleted(self, make_document, warehouse, worker):
        from django.db.models import ProtectedError

        make_document("receipt", warehouse, worker)
        with pytest.raises(ProtectedError):
            warehouse.delete()


class TestDocumentLine:
    def test_one_line_per_product(self, make_document, make_product, warehouse, worker):
        product = make_product()
        with pytest.raises(IntegrityError):
            make_document("receipt", warehouse, worker, [(product, 1), (product, 2)])

    def test_quantity_not_negative(self, make_document, make_product, warehouse, worker):
        with pytest.raises(IntegrityError):
            make_document("receipt", warehouse, worker, [(make_product(), -1)])

    def test_difference_is_computed(self):
        line = DocumentLine(quantity=Decimal(8), expected_quantity=Decimal(10))
        assert line.difference == -2
        assert DocumentLine(quantity=Decimal(8)).difference is None

    def test_lines_deleted_with_document(self, make_document, make_product, warehouse, worker):
        doc = make_document("receipt", warehouse, worker, [(make_product(), 1)])
        doc.delete()
        assert not DocumentLine.objects.exists()


class TestStock:
    def test_one_row_per_warehouse_and_product(self, make_product, warehouse):
        product = make_product()
        Stock.objects.create(warehouse=warehouse, product=product, quantity=1)
        with pytest.raises(IntegrityError):
            Stock.objects.create(warehouse=warehouse, product=product, quantity=2)

    def test_negative_stock_is_allowed(self, make_product, warehouse):
        row = Stock.objects.create(warehouse=warehouse, product=make_product(), quantity=-3)
        assert row.quantity == -3


class TestStockMovement:
    def test_movements_are_append_only(self, make_document, make_product, warehouse, admin):
        from inventory.services import post_document

        post_document(make_document("receipt", warehouse, admin, [(make_product(), 5)]), admin)
        movement = StockMovement.objects.get()
        movement.delta = 100
        with pytest.raises(ValueError):
            movement.save()
        with pytest.raises(ValueError):
            movement.delete()
