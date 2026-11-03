"""Read-only reports. No tables: everything is computed from stock, movements and documents."""
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db.models import DecimalField, ExpressionWrapper, F, Q, Sum, Value
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone

from accounts.models import Device
from catalog.models import Product

from .models import Document, Stock, StockMovement

ZERO = Value(Decimal(0))
QTY = DecimalField(max_digits=14, decimal_places=3)


def products_with_stock(warehouse_ids=None):
    stock_filter = Q(stock_rows__warehouse_id__in=warehouse_ids) if warehouse_ids is not None else Q()
    return Product.objects.filter(is_active=True).annotate(
        total_stock=Coalesce(Sum("stock_rows__quantity", filter=stock_filter), ZERO, output_field=QTY)
    )


def low_stock(warehouse_ids=None):
    return products_with_stock(warehouse_ids).filter(total_stock__lte=F("min_stock"))


def active_workers(warehouse_ids=None):
    since = timezone.now() - timedelta(minutes=settings.ACTIVE_DEVICE_MINUTES)
    devices = Device.objects.filter(last_seen_at__gte=since, user__is_active=True, is_blocked=False)
    if warehouse_ids is not None:
        devices = devices.filter(user__memberships__warehouse_id__in=warehouse_ids)
    return devices.values("user").distinct().count()


def stock_value(warehouse_ids=None):
    rows = Stock.objects.all()
    if warehouse_ids is not None:
        rows = rows.filter(warehouse_id__in=warehouse_ids)
    value = rows.aggregate(
        total=Sum(ExpressionWrapper(F("quantity") * F("product__price"), output_field=DecimalField(max_digits=20, decimal_places=2)))
    )["total"]
    return value or Decimal(0)


def stock_history(product_id, warehouse_id=None, days=30):
    """Balance at the end of each day (for the stock chart)."""
    since = timezone.now() - timedelta(days=days)
    movements = StockMovement.objects.filter(product_id=product_id, created_at__gte=since)
    if warehouse_id:
        movements = movements.filter(warehouse_id=warehouse_id)
    per_day = (
        movements.annotate(day=TruncDate("created_at")).values("day").annotate(delta=Sum("delta")).order_by("day")
    )
    return [{"day": row["day"], "delta": row["delta"]} for row in per_day]


def movements_summary(warehouse_ids=None, days=7):
    """Incoming / outgoing per day, for the dashboard chart."""
    since = timezone.now() - timedelta(days=days)
    movements = StockMovement.objects.filter(created_at__gte=since)
    if warehouse_ids is not None:
        movements = movements.filter(warehouse_id__in=warehouse_ids)
    rows = (
        movements.annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(
            incoming=Coalesce(Sum("delta", filter=Q(delta__gt=0)), ZERO, output_field=QTY),
            outgoing=Coalesce(Sum("delta", filter=Q(delta__lt=0)), ZERO, output_field=QTY),
        )
        .order_by("day")
    )
    return list(rows)


def inventory_discrepancies(document):
    rows = []
    for line in document.lines.select_related("product"):
        diff = line.difference
        if diff is None or diff == 0:
            continue
        rows.append({
            "product": line.product_id,
            "product_name": line.product.name,
            "expected": line.expected_quantity,
            "counted": line.quantity,
            "difference": diff,
            "amount": (diff * line.product.price).quantize(Decimal("0.01")),
        })
    return rows


def dashboard(user, warehouse_ids=None):
    from sync.models import SyncBatch

    from .serializers import DocumentSerializer

    docs = Document.objects.filter(is_deleted=False).select_related("warehouse", "created_by").prefetch_related(
        "lines__product__barcodes", "lines__product__base_unit", "lines__entered_unit"
    )
    batches = SyncBatch.objects.select_related("user", "device").order_by("-received_at")
    if warehouse_ids is not None:
        docs = docs.filter(Q(warehouse_id__in=warehouse_ids) | Q(destination_warehouse_id__in=warehouse_ids))
        batches = batches.filter(user=user)
    products = products_with_stock(warehouse_ids)
    low = low_stock(warehouse_ids)
    from catalog.serializers import ProductSerializer

    return {
        "products_count": products.count(),
        "stock_units": products.aggregate(total=Sum("total_stock"))["total"] or 0,
        "stock_value": stock_value(warehouse_ids),
        "low_stock_count": low.count(),
        "documents_today": docs.filter(created_at__date=timezone.localdate()).count(),
        "drafts_count": docs.filter(status=Document.DRAFT).count(),
        "active_workers": active_workers(warehouse_ids),
        "movements": movements_summary(warehouse_ids),
        "recent_documents": DocumentSerializer(docs[:6], many=True).data,
        "low_stock": ProductSerializer(
            low.select_related("category", "base_unit").prefetch_related("barcodes")[:8], many=True
        ).data,
        "recent_syncs": [
            {
                "id": batch.id,
                "user": batch.user.get_full_name() if batch.user else None,
                "device": str(batch.device) if batch.device else None,
                "status": batch.status,
                "items_total": batch.items_total,
                "items_ok": batch.items_ok,
                "items_conflict": batch.items_conflict,
                "items_failed": batch.items_failed,
                "received_at": batch.received_at,
            }
            for batch in batches[:6]
        ],
    }
