from decimal import Decimal

import pytest
from django.db import IntegrityError

from catalog.models import Barcode, Category, Product, ProductUnit

pytestmark = pytest.mark.django_db


class TestCategory:
    def test_root_names_unique(self):
        Category.objects.create(name="Напої")
        with pytest.raises(IntegrityError):
            Category.objects.create(name="Напої")

    def test_same_name_allowed_under_different_parents(self):
        drinks = Category.objects.create(name="Напої")
        food = Category.objects.create(name="Їжа")
        Category.objects.create(name="Інше", parent=drinks)
        Category.objects.create(name="Інше", parent=food)
        assert Category.objects.filter(name="Інше").count() == 2

    def test_parent_with_children_cannot_be_deleted(self):
        from django.db.models import ProtectedError

        drinks = Category.objects.create(name="Напої")
        Category.objects.create(name="Соки", parent=drinks)
        with pytest.raises(ProtectedError):
            drinks.delete()


class TestProduct:
    def test_sku_unique(self, make_product):
        make_product(sku="A-1")
        with pytest.raises(IntegrityError):
            make_product(sku="A-1")

    def test_price_cannot_be_negative(self, make_product):
        with pytest.raises(IntegrityError):
            make_product(price=-1)

    def test_min_stock_cannot_be_negative(self, make_product):
        with pytest.raises(IntegrityError):
            make_product(min_stock=-1)

    def test_has_no_stock_field(self):
        assert "stock" not in {f.name for f in Product._meta.get_fields()}

    def test_new_product_is_active_version_1(self, make_product):
        product = make_product()
        assert product.is_active and product.version == 1


class TestPackingAndUnits:
    def test_factor_for_base_unit_is_1(self, make_product, units):
        product = make_product()
        assert product.factor_for(None) == 1
        assert product.factor_for(units["pcs"]) == 1

    def test_factor_for_pack(self, make_product, units):
        product = make_product(pack=12)
        assert product.factor_for(units["pack"]) == Decimal(12)

    def test_unknown_packing_raises(self, make_product, units):
        with pytest.raises(ValueError):
            make_product().factor_for(units["pack"])

    def test_factor_must_be_positive(self, make_product, units):
        with pytest.raises(IntegrityError):
            ProductUnit.objects.create(product=make_product(), unit=units["pack"], factor=0)

    def test_one_packing_per_unit(self, make_product, units):
        product = make_product(pack=12)
        with pytest.raises(IntegrityError):
            ProductUnit.objects.create(product=product, unit=units["pack"], factor=6)


class TestBarcode:
    def test_code_unique_across_products(self, make_product):
        make_product(barcode="4820000000011")
        with pytest.raises(IntegrityError):
            Barcode.objects.create(code="4820000000011", product=make_product())

    def test_one_primary_per_product(self, make_product):
        product = make_product(barcode="4820000000011")
        with pytest.raises(IntegrityError):
            Barcode.objects.create(code="4820000000099", product=product, is_primary=True)

    def test_many_secondary_codes(self, make_product, units):
        product = make_product(barcode="4820000000011")
        Barcode.objects.create(code="4820000000019", product=product, unit=units["pack"])
        Barcode.objects.create(code="SUP-777", product=product, type=Barcode.INTERNAL)
        assert product.barcodes.count() == 3
        assert product.primary_barcode.code == "4820000000011"

    def test_guess_type(self):
        assert Barcode.guess_type("4820000000011") == Barcode.EAN13
        assert Barcode.guess_type("48200001") == Barcode.EAN8
        assert Barcode.guess_type("ABC-1") == Barcode.CODE128
