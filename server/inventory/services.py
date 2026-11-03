"""
Posting and cancelling documents — the only place where stock balances change.

Posting (one transaction):
  1. lock the document and the affected stock rows (SELECT ... FOR UPDATE)
  2. compute delta per line:
       receipt   → +quantity on warehouse
       writeoff  → −quantity on warehouse
       transfer  → −quantity on warehouse, +quantity on destination
       inventory → quantity − current stock (expected_quantity = current stock)
  3. INSERT stock_movements, UPDATE stock
  4. status = posted, posted_by/at, version += 1
  5. on commit: low-stock / incoming-transfer notifications
Cancelling repeats the movements with the opposite delta.
"""
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from core.permissions import is_manager, is_member

from .models import Document, DocumentLine, Stock, StockMovement, Warehouse


class DocumentError(Exception):
    """Business rule violation (shown to the user as-is)."""


def can_post(user, document):
    return is_manager(user, document.warehouse_id)


def can_edit(user, document):
    """Drafts only: managers edit any draft of their warehouse, workers only their own."""
    if not document.is_draft:
        return False
    if is_manager(user, document.warehouse_id):
        return True
    return document.created_by_id == user.pk and is_member(user, document.warehouse_id)


def _locked_stock(warehouse_id, product_id):
    Stock.objects.get_or_create(warehouse_id=warehouse_id, product_id=product_id)
    return Stock.objects.select_for_update().get(warehouse_id=warehouse_id, product_id=product_id)


def _move(stock, delta, line, document, user, movement_type):
    stock.quantity += delta
    stock.save(update_fields=["quantity", "updated_at"])
    StockMovement.objects.create(
        warehouse_id=stock.warehouse_id,
        product_id=stock.product_id,
        document=document,
        document_line=line,
        delta=delta,
        balance_after=stock.quantity,
        movement_type=movement_type,
        created_by=user,
    )


def _add_missing_inventory_lines(document):
    """Full inventory: products on the warehouse that were not counted are counted as zero."""
    counted = set(document.lines.values_list("product_id", flat=True))
    missing = (
        Stock.objects.filter(warehouse_id=document.warehouse_id)
        .exclude(quantity=0)
        .exclude(product_id__in=counted)
        .values_list("product_id", flat=True)
    )
    DocumentLine.objects.bulk_create(
        [DocumentLine(document=document, product_id=product_id, quantity=Decimal(0)) for product_id in missing]
    )


@transaction.atomic
def post_document(document, user):
    doc = Document.objects.select_for_update().get(pk=document.pk)
    if doc.is_deleted:
        raise DocumentError("Документ видалено")
    if doc.status != Document.DRAFT:
        raise DocumentError("Проводити можна лише чернетку")
    if doc.type == Document.TRANSFER and not doc.destination_warehouse_id:
        raise DocumentError("Для переміщення вкажіть склад-одержувач")
    if doc.type == Document.INVENTORY and doc.inventory_mode == Document.FULL:
        _add_missing_inventory_lines(doc)

    # Lock in a stable order so two concurrent postings cannot deadlock.
    lines = list(doc.lines.select_related("product").order_by("product_id"))
    if not lines:
        raise DocumentError("Документ не містить жодного товару")
    inactive = [line.product.name for line in lines if not line.product.is_active]
    if inactive:
        raise DocumentError(f"Товари неактивні: {', '.join(inactive)}")

    touched = set()
    for line in lines:
        stock = _locked_stock(doc.warehouse_id, line.product_id)
        if doc.type == Document.RECEIPT:
            delta = line.quantity
        elif doc.type == Document.WRITEOFF:
            delta = -line.quantity
        elif doc.type == Document.TRANSFER:
            delta = -line.quantity
        else:  # inventory: the expected value is the balance at the moment of posting
            line.expected_quantity = stock.quantity
            line.save(update_fields=["expected_quantity", "updated_at"])
            delta = line.quantity - stock.quantity
        if delta:
            _move(stock, delta, line, doc, user, doc.type)
        touched.add((doc.warehouse_id, line.product_id))

        if doc.type == Document.TRANSFER:
            incoming = _locked_stock(doc.destination_warehouse_id, line.product_id)
            _move(incoming, line.quantity, line, doc, user, doc.type)
            touched.add((doc.destination_warehouse_id, line.product_id))

    doc.status = Document.POSTED
    doc.posted_by = user
    doc.posted_at = timezone.now()
    doc.bump_version()
    doc.save()

    from sync import services as notifications

    transaction.on_commit(lambda: notifications.after_document_posted(doc, touched))
    return doc


@transaction.atomic
def cancel_document(document, user):
    doc = Document.objects.select_for_update().get(pk=document.pk)
    if doc.status != Document.POSTED:
        raise DocumentError("Скасувати можна лише проведений документ")
    movements = list(doc.movements.exclude(movement_type=StockMovement.CANCEL).order_by("product_id", "warehouse_id"))
    for movement in movements:
        stock = _locked_stock(movement.warehouse_id, movement.product_id)
        _move(stock, -movement.delta, movement.document_line, doc, user, StockMovement.CANCEL)
    doc.status = Document.CANCELLED
    doc.cancelled_by = user
    doc.cancelled_at = timezone.now()
    doc.bump_version()
    doc.save()
    return doc


def default_warehouse(user):
    membership = user.memberships.select_related("warehouse").order_by("-is_default", "id").first()
    if membership:
        return membership.warehouse
    return Warehouse.objects.filter(is_active=True).order_by("id").first()


@transaction.atomic
def post_opening_balance(product, quantity, user, warehouse=None):
    """Initial stock entered on the product card becomes a posted receipt (balances change only via documents)."""
    warehouse = warehouse or default_warehouse(user)
    if warehouse is None:
        raise DocumentError("Немає жодного складу для початкового залишку")
    doc = Document.objects.create(
        type=Document.RECEIPT, warehouse=warehouse, created_by=user, note=f"Початковий залишок: {product.sku}"
    )
    DocumentLine.objects.create(document=doc, product=product, quantity=quantity)
    return post_document(doc, user)
