from django.db import transaction
from .models import Product


@transaction.atomic
def apply_document_stock(document):
    """Apply a posted warehouse document exactly once at the call site."""
    for line in document.lines.all():
        product = Product.objects.select_for_update().get(pk=line.product_id)
        if document.type == "receipt":
            product.stock += line.quantity
        elif document.type == "writeoff":
            if product.stock < line.quantity:
                raise ValueError(f"Недостатній залишок: {product.name}")
            product.stock -= line.quantity
        elif document.type == "inventory":
            product.stock = line.quantity
        # Warehouse-specific stock balances are a follow-up data-model task;
        # transfers are recorded but do not change the global product total.
        product.save(update_fields=["stock", "updated_at"])
