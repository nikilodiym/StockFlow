from decimal import Decimal

import pytest
from django.db import transaction
from django.db.models import Sum

from inventory.models import Document, Stock, StockMovement
from inventory.services import DocumentError, can_edit, can_post, cancel_document, post_document
from sync.models import Notification

pytestmark = pytest.mark.django_db


class TestPosting:
    def test_receipt_adds(self, make_document, make_product, warehouse, manager, stock_of):
        product = make_product()
        doc = post_document(make_document("receipt", warehouse, manager, [(product, 10)]), manager)
        assert stock_of(product, warehouse) == 10
        assert doc.status == "posted" and doc.posted_by == manager and doc.posted_at and doc.version == 2

    def test_writeoff_subtracts_and_may_go_negative(self, make_document, make_product, warehouse, manager, stock_of):
        product = make_product()
        post_document(make_document("receipt", warehouse, manager, [(product, 3)]), manager)
        post_document(make_document("writeoff", warehouse, manager, [(product, 5)]), manager)
        assert stock_of(product, warehouse) == -2  # offline write-off may arrive before the receipt

    def test_transfer_moves_between_warehouses(self, make_document, make_product, warehouse, warehouse2, admin, stock_of):
        product = make_product()
        post_document(make_document("receipt", warehouse, admin, [(product, 10)]), admin)
        doc = make_document("transfer", warehouse, admin, [(product, 4)], destination_warehouse=warehouse2)
        post_document(doc, admin)
        assert stock_of(product, warehouse) == 6
        assert stock_of(product, warehouse2) == 4
        assert sorted(m.delta for m in doc.movements.all()) == [-4, 4]

    def test_partial_inventory_sets_counted_and_expected(self, make_document, make_product, warehouse, manager, stock_of):
        counted, untouched = make_product(), make_product()
        post_document(make_document("receipt", warehouse, manager, [(counted, 10), (untouched, 5)]), manager)
        doc = post_document(make_document("inventory", warehouse, manager, [(counted, 8)]), manager)
        line = doc.lines.get()
        assert line.expected_quantity == 10 and line.difference == -2
        assert stock_of(counted, warehouse) == 8
        assert stock_of(untouched, warehouse) == 5

    def test_full_inventory_zeroes_uncounted(self, make_document, make_product, warehouse, manager, stock_of):
        counted, missing = make_product(), make_product()
        post_document(make_document("receipt", warehouse, manager, [(counted, 10), (missing, 5)]), manager)
        doc = make_document("inventory", warehouse, manager, [(counted, 10)], inventory_mode="full")
        post_document(doc, manager)
        assert stock_of(missing, warehouse) == 0
        assert doc.lines.get(product=missing).expected_quantity == 5

    def test_expected_quantity_is_taken_at_posting_time(self, make_document, make_product, warehouse, manager):
        product = make_product()
        post_document(make_document("receipt", warehouse, manager, [(product, 10)]), manager)
        inventory = make_document("inventory", warehouse, manager, [(product, 12)])
        # another document passes while the worker is counting offline
        post_document(make_document("receipt", warehouse, manager, [(product, 3)]), manager)
        post_document(inventory, manager)
        assert inventory.lines.get().expected_quantity == 13

    def test_posting_twice_is_refused(self, make_document, make_product, warehouse, manager, stock_of):
        product = make_product()
        doc = make_document("receipt", warehouse, manager, [(product, 10)])
        post_document(doc, manager)
        with pytest.raises(DocumentError):
            post_document(doc, manager)
        assert stock_of(product, warehouse) == 10

    def test_empty_document_is_refused(self, make_document, warehouse, manager):
        with pytest.raises(DocumentError):
            post_document(make_document("receipt", warehouse, manager), manager)

    def test_transfer_needs_destination(self, make_document, make_product, warehouse, manager):
        with pytest.raises(DocumentError):
            post_document(make_document("transfer", warehouse, manager, [(make_product(), 1)]), manager)

    def test_inactive_product_is_refused(self, make_document, make_product, warehouse, manager):
        product = make_product(is_active=False)
        with pytest.raises(DocumentError):
            post_document(make_document("receipt", warehouse, manager, [(product, 1)]), manager)

    def test_movements_sum_equals_stock(self, make_document, make_product, warehouse, manager):
        product = make_product()
        for doc_type, qty in [("receipt", 10), ("writeoff", 3), ("receipt", 7), ("inventory", 11)]:
            post_document(make_document(doc_type, warehouse, manager, [(product, qty)]), manager)
        total = StockMovement.objects.filter(product=product, warehouse=warehouse).aggregate(s=Sum("delta"))["s"]
        assert total == Stock.objects.get(product=product, warehouse=warehouse).quantity == 11

    def test_balance_after_is_recorded(self, make_document, make_product, warehouse, manager):
        product = make_product()
        post_document(make_document("receipt", warehouse, manager, [(product, 10)]), manager)
        post_document(make_document("writeoff", warehouse, manager, [(product, 4)]), manager)
        assert [m.balance_after for m in StockMovement.objects.order_by("id")] == [10, 6]


class TestCancel:
    def test_cancel_reverses_movements(self, make_document, make_product, warehouse, warehouse2, admin, stock_of):
        product = make_product()
        post_document(make_document("receipt", warehouse, admin, [(product, 10)]), admin)
        transfer = make_document("transfer", warehouse, admin, [(product, 4)], destination_warehouse=warehouse2)
        post_document(transfer, admin)
        cancelled = cancel_document(transfer, admin)
        assert cancelled.status == "cancelled" and cancelled.cancelled_by == admin
        assert stock_of(product, warehouse) == 10 and stock_of(product, warehouse2) == 0
        assert transfer.movements.filter(movement_type=StockMovement.CANCEL).count() == 2

    def test_only_posted_can_be_cancelled(self, make_document, make_product, warehouse, manager):
        doc = make_document("receipt", warehouse, manager, [(make_product(), 1)])
        with pytest.raises(DocumentError):
            cancel_document(doc, manager)
        post_document(doc, manager)
        cancel_document(doc, manager)
        with pytest.raises(DocumentError):
            cancel_document(doc, manager)


class TestRights:
    def test_can_post(self, make_document, warehouse, warehouse2, manager, worker, admin):
        doc = make_document("receipt", warehouse, worker)
        assert can_post(manager, doc) and can_post(admin, doc) and not can_post(worker, doc)
        assert not can_post(manager, make_document("receipt", warehouse2, admin))

    def test_can_edit(self, make_document, make_product, make_user, warehouse, manager, worker):
        other = make_user("other@test.ua", role="worker", warehouse=warehouse)
        own = make_document("receipt", warehouse, worker, [(make_product(), 1)])
        assert can_edit(worker, own) and can_edit(manager, own) and not can_edit(other, own)
        posted = post_document(own, manager)
        assert not can_edit(manager, posted), "posted documents are never edited"


class TestNotifications:
    def test_low_stock_notifies_managers_after_commit(
        self, make_document, make_product, warehouse, manager, worker, django_capture_on_commit_callbacks
    ):
        product = make_product(min_stock=5)
        with django_capture_on_commit_callbacks(execute=True):
            post_document(make_document("receipt", warehouse, manager, [(product, 10)]), manager)
        assert not Notification.objects.exists()
        with django_capture_on_commit_callbacks(execute=True):
            post_document(make_document("writeoff", warehouse, manager, [(product, 6)]), manager)
        notification = Notification.objects.get()
        assert notification.user == manager and notification.type == "low_stock"
        assert notification.payload["product_id"] == product.pk

    def test_unread_low_stock_is_not_repeated(
        self, make_document, make_product, warehouse, manager, django_capture_on_commit_callbacks
    ):
        product = make_product(min_stock=5)
        for _ in range(2):
            with django_capture_on_commit_callbacks(execute=True):
                post_document(make_document("writeoff", warehouse, manager, [(product, 1)]), manager)
        assert Notification.objects.count() == 1

    def test_no_notification_when_transaction_rolls_back(
        self, make_document, make_product, warehouse, manager, django_capture_on_commit_callbacks
    ):
        product = make_product(min_stock=5)
        with django_capture_on_commit_callbacks(execute=True):
            try:
                with transaction.atomic():
                    post_document(make_document("writeoff", warehouse, manager, [(product, 1)]), manager)
                    raise RuntimeError("boom")
            except RuntimeError:
                pass
        assert not Notification.objects.exists()
        assert not Document.objects.exists()

    def test_incoming_transfer_notifies_destination(
        self, make_document, make_product, make_user, warehouse, warehouse2, admin, django_capture_on_commit_callbacks
    ):
        receiver = make_user("lviv@test.ua", role="worker", warehouse=warehouse2)
        doc = make_document("transfer", warehouse, admin, [(make_product(), 1)], destination_warehouse=warehouse2)
        with django_capture_on_commit_callbacks(execute=True):
            post_document(doc, admin)
        assert Notification.objects.get(user=receiver).type == "transfer_incoming"
