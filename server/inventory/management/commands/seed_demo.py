from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import Membership
from catalog.models import Category, Product, ProductUnit, Unit
from catalog.services import set_primary_barcode
from inventory.models import Document, DocumentLine, Stock, Warehouse
from inventory.services import post_document

User = get_user_model()

UNITS = [("pcs", "шт", 0), ("kg", "кг", 3), ("pack", "упак", 0), ("l", "л", 3)]
WAREHOUSES = [("KYIV-01", "Склад №1 Київ", "Київ"), ("LVIV-01", "Склад №2 Львів", "Львів")]
USERS = [
    # email, password, name, is_staff, role per warehouse code
    ("admin@gmail.com", "admin", "Олена Коваль", True, {"KYIV-01": "manager", "LVIV-01": "manager"}),
    ("manager@gmail.com", "manager", "Андрій Мельник", False, {"KYIV-01": "manager"}),
    ("worker@gmail.com", "worker", "Іван Петренко", False, {"KYIV-01": "worker", "LVIV-01": "worker"}),
]
PRODUCTS = [
    # sku, barcode, name, category, unit, stock, min_stock, price, pack factor
    ("DRK-001", "4820000000011", "Вода мінеральна 1.5 л", "Напої", "pcs", 128, 24, "22.50", 6),
    ("DRK-002", "4820000000012", "Сік апельсиновий 1 л", "Напої", "pcs", 42, 18, "58.00", 12),
    ("FOO-001", "4820000000013", "Кава зернова 1 кг", "Бакалія", "pack", 18, 8, "349.00", None),
    ("FOO-002", "4820000000014", "Рис довгозернистий 1 кг", "Бакалія", "pack", 7, 12, "64.90", None),
    ("FOO-003", "4820000000016", "Цукор", "Бакалія", "kg", "35.500", 10, "38.00", None),
    ("HOM-001", "4820000000015", "Рушники паперові 2 шт", "Господарчі товари", "pack", 34, 10, "42.00", None),
]


class Command(BaseCommand):
    help = "Demo data: units, 2 warehouses, admin/manager/worker, products with opening stock."

    @transaction.atomic
    def handle(self, *args, **options):
        units = {code: Unit.objects.update_or_create(code=code, defaults={"name": name, "precision": p})[0] for code, name, p in UNITS}
        warehouses = {
            code: Warehouse.objects.update_or_create(code=code, defaults={"name": name, "address": address})[0]
            for code, name, address in WAREHOUSES
        }
        users = {}
        for email, password, name, is_staff, roles in USERS:
            user = User.objects.filter(email=email).first() or User(email=email)
            user.full_name, user.is_staff, user.is_superuser = name, is_staff, is_staff
            user.set_password(password)
            user.save()
            for index, (code, role) in enumerate(roles.items()):
                Membership.objects.update_or_create(
                    user=user, warehouse=warehouses[code], defaults={"role": role, "is_default": index == 0}
                )
            users[email] = user
        admin = users["admin@gmail.com"]

        opening = []
        for sku, barcode, name, category, unit, stock, min_stock, price, pack in PRODUCTS:
            product, _ = Product.objects.update_or_create(
                sku=sku,
                defaults={
                    "name": name, "category": Category.objects.get_or_create(name=category, parent=None)[0],
                    "base_unit": units[unit], "min_stock": Decimal(min_stock), "price": Decimal(price), "is_active": True,
                },
            )
            set_primary_barcode(product, barcode)
            if pack:
                ProductUnit.objects.update_or_create(product=product, unit=units["pack"], defaults={"factor": pack})
                pack_code = f"2{barcode[1:]}"  # in-store code for the pack
                if not product.barcodes.filter(code=pack_code).exists():
                    product.barcodes.create(code=pack_code, unit=units["pack"], type="ean13")
            if not Stock.objects.filter(product=product).exists():
                opening.append((product, Decimal(str(stock))))

        if opening:
            doc = Document.objects.create(
                type=Document.RECEIPT, warehouse=warehouses["KYIV-01"], created_by=admin, note="Початкові залишки (демо)"
            )
            DocumentLine.objects.bulk_create([DocumentLine(document=doc, product=p, quantity=q) for p, q in opening])
            post_document(doc, admin)

        self.stdout.write(self.style.SUCCESS(
            "Demo data ready: admin@gmail.com / admin, manager@gmail.com / manager, worker@gmail.com / worker"
        ))
