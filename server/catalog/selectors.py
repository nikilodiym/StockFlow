"""Read queries for the catalog (no side effects). Services change data, selectors read it."""
from decimal import Decimal

from django.db.models import DecimalField, Prefetch, Q, Sum, Value
from django.db.models.functions import Coalesce

from .models import Barcode, Product

QTY = DecimalField(max_digits=14, decimal_places=3)


def products_with_stock(warehouse_ids=None, *, include_inactive=False):
    """
    Products with `total_stock` = sum over the given warehouses (None = all warehouses),
    with category, unit, active barcodes and packings preloaded.
    """
    stock_filter = Q(stock_rows__warehouse_id__in=warehouse_ids) if warehouse_ids is not None else Q()
    queryset = (
        Product.objects.select_related("category", "base_unit")
        .prefetch_related(Prefetch("barcodes", queryset=Barcode.objects.filter(is_active=True)), "packings__unit")
        .annotate(total_stock=Coalesce(Sum("stock_rows__quantity", filter=stock_filter), Value(Decimal(0)), output_field=QTY))
        .order_by("name", "id")  # aggregate queries drop Meta.ordering; pagination needs a stable order
    )
    return queryset if include_inactive else queryset.filter(is_active=True)
