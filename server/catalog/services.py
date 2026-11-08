import csv
import io
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import Barcode, Category, ImportJob, Product, Unit


def find_unit(value):
    """Unit by code ('pcs') or by name ('шт')."""
    if isinstance(value, Unit):
        return value
    if value in (None, ""):
        return None
    return Unit.objects.filter(Q(code__iexact=value) | Q(name__iexact=value)).first()


def category_by_name(name):
    if not name:
        return None
    category, _ = Category.objects.get_or_create(name=name.strip(), parent=None)
    return category


def resolve_barcode(code):
    """Scan → (product, unit, factor). Unknown or inactive code → (None, None, None)."""
    barcode = (
        Barcode.objects.select_related("product__base_unit", "unit")
        .filter(code=code, is_active=True, product__is_active=True)
        .first()
    )
    if not barcode:
        return None, None, None
    product = barcode.product
    unit = barcode.unit or product.base_unit
    return product, unit, product.factor_for(unit)


@transaction.atomic
def set_primary_barcode(product, code):
    """Make `code` the product's primary barcode (creating it if needed)."""
    code = (code or "").strip()
    if not code:
        product.barcodes.filter(is_primary=True).update(is_primary=False)
        return None
    existing = Barcode.objects.filter(code=code).first()
    if existing and existing.product_id != product.pk:
        raise ValueError(f"Штрихкод {code} вже належить товару «{existing.product.name}»")
    product.barcodes.filter(is_primary=True).exclude(code=code).update(is_primary=False)
    if existing:
        existing.is_primary = True
        existing.is_active = True
        existing.save(update_fields=["is_primary", "is_active", "updated_at"])
        return existing
    return Barcode.objects.create(product=product, code=code, type=Barcode.guess_type(code), is_primary=True)


IMPORT_COLUMNS = ["sku", "barcode", "name", "category", "unit", "price", "min_stock"]


def _decimal(value, default="0"):
    try:
        return Decimal(str(value or default).replace(",", "."))
    except InvalidOperation:
        raise ValueError(f"Некоректне число: {value}")


def _csv_rows(data: bytes) -> list[dict]:
    text = data.decode("utf-8-sig")
    dialect = csv.Sniffer().sniff(text.splitlines()[0] if text else ",", delimiters=",;\t")
    return list(csv.DictReader(io.StringIO(text), dialect=dialect))


def _xlsx_rows(data: bytes) -> list[dict]:
    """First sheet; the first row holds the column names."""
    from openpyxl import load_workbook

    sheet = load_workbook(io.BytesIO(data), read_only=True, data_only=True).worksheets[0]
    values = list(sheet.iter_rows(values_only=True))
    if not values:
        return []
    header = [str(cell or "").strip() for cell in values[0]]
    rows = []
    for row in values[1:]:
        if row is None or all(cell in (None, "") for cell in row):
            continue
        rows.append({header[i]: "" if cell is None else str(cell) for i, cell in enumerate(row) if i < len(header)})
    return rows


def read_rows(data: bytes) -> list[dict]:
    """CSV (comma, semicolon or tab) or Excel .xlsx — detected by content (xlsx is a zip: starts with PK)."""
    return _xlsx_rows(data) if data[:2] == b"PK" else _csv_rows(data)


def run_import(job: ImportJob):
    """CSV/XLSX import: upsert products by sku, barcodes by code. Errors are collected per row."""
    job.status = ImportJob.PROCESSING
    job.save(update_fields=["status"])
    job.file.open("rb")
    data = job.file.read()
    job.file.close()
    rows = read_rows(data)
    default_unit = Unit.objects.filter(code="pcs").first()
    errors = []
    created = updated = 0
    for number, row in enumerate(rows, start=2):
        row = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items()}
        try:
            with transaction.atomic():
                if not row.get("sku") or not row.get("name"):
                    raise ValueError("sku і name обов’язкові")
                unit = find_unit(row["unit"]) if row.get("unit") else default_unit
                if unit is None:
                    raise ValueError(f"Невідома одиниця: {row.get('unit') or '—'}")
                product, is_new = Product.objects.update_or_create(
                    sku=row["sku"],
                    defaults={
                        "name": row["name"],
                        "category": category_by_name(row.get("category")),
                        "base_unit": unit,
                        "price": _decimal(row.get("price")),
                        "min_stock": _decimal(row.get("min_stock")),
                        "is_active": True,
                    },
                )
                if not is_new:
                    product.bump_version()
                    product.save(update_fields=["version"])
                if row.get("barcode"):
                    set_primary_barcode(product, row["barcode"])
                created += is_new
                updated += not is_new
        except Exception as exc:  # one bad row must not stop the import
            errors.append({"row": number, "sku": row.get("sku", ""), "error": str(exc)})
    job.rows_total = len(rows)
    job.rows_created, job.rows_updated, job.rows_failed = created, updated, len(errors)
    job.errors = errors
    job.status = ImportJob.FAILED if rows and len(errors) == len(rows) else ImportJob.DONE
    job.finished_at = timezone.now()
    job.save()
    return job
