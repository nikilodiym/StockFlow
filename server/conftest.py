"""Shared pytest fixtures for every app's tests."""
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from accounts.models import Membership, User
from catalog.models import Category, Product, ProductUnit, Unit
from catalog.services import set_primary_barcode
from inventory.models import Document, DocumentLine, Stock, Warehouse

PASSWORD = "Sklad-2026!"


@pytest.fixture(autouse=True)
def _clear_cache():
    """Login throttling counts requests in the cache; every test starts from zero."""
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def units(db):
    data = [("pcs", "шт", 0), ("kg", "кг", 3), ("pack", "упак", 0)]
    return {code: Unit.objects.create(code=code, name=name, precision=p) for code, name, p in data}


@pytest.fixture
def warehouse(db):
    return Warehouse.objects.create(code="KYIV-01", name="Склад Київ")


@pytest.fixture
def warehouse2(db):
    return Warehouse.objects.create(code="LVIV-01", name="Склад Львів")


@pytest.fixture
def make_user(db):
    def factory(email, role=None, warehouse=None, staff=False, password=PASSWORD, **extra):
        user = User.objects.create_user(email=email, password=password, is_staff=staff, **extra)
        if role and warehouse:
            Membership.objects.create(user=user, warehouse=warehouse, role=role, is_default=True)
        return user

    return factory


@pytest.fixture
def admin(make_user):
    return make_user("admin@test.ua", staff=True, full_name="Адмін")


@pytest.fixture
def manager(make_user, warehouse):
    return make_user("manager@test.ua", role="manager", warehouse=warehouse, full_name="Менеджер")


@pytest.fixture
def worker(make_user, warehouse):
    return make_user("worker@test.ua", role="worker", warehouse=warehouse, full_name="Комірник")


@pytest.fixture
def make_product(db, units):
    counter = {"n": 0}

    def factory(name="Товар", unit="pcs", min_stock=0, price=0, barcode=None, pack=None, sku=None, **extra):
        counter["n"] += 1
        product = Product.objects.create(
            sku=sku or f"SKU-{counter['n']:03d}", name=name, base_unit=units[unit],
            min_stock=Decimal(str(min_stock)), price=Decimal(str(price)),
            category=Category.objects.get_or_create(name="Загальне", parent=None)[0], **extra,
        )
        if barcode:
            set_primary_barcode(product, barcode)
        if pack:
            ProductUnit.objects.create(product=product, unit=units["pack"], factor=Decimal(str(pack)))
        return product

    return factory


@pytest.fixture
def make_document(db):
    def factory(type, warehouse, user, lines=(), **extra):
        doc = Document.objects.create(type=type, warehouse=warehouse, created_by=user, **extra)
        for product, quantity in lines:
            DocumentLine.objects.create(document=doc, product=product, quantity=Decimal(str(quantity)))
        return doc

    return factory


@pytest.fixture
def stock_of(db):
    def get(product, warehouse):
        row = Stock.objects.filter(product=product, warehouse=warehouse).first()
        return row.quantity if row else Decimal(0)

    return get


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def client_for():
    def make(user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    return make
