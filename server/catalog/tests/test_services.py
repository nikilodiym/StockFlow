from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from catalog.models import Barcode, ImportJob, Product
from catalog.services import resolve_barcode, run_import, set_primary_barcode

pytestmark = pytest.mark.django_db


class TestResolveBarcode:
    def test_unit_code_gives_base_unit(self, make_product, units):
        product = make_product(barcode="4820000000011")
        assert resolve_barcode("4820000000011") == (product, units["pcs"], 1)

    def test_pack_code_gives_factor(self, make_product, units):
        product = make_product(barcode="4820000000011", pack=12)
        Barcode.objects.create(code="4820000000019", product=product, unit=units["pack"])
        found, unit, factor = resolve_barcode("4820000000019")
        assert found == product and unit == units["pack"] and factor == Decimal(12)

    def test_unknown_or_inactive(self, make_product):
        product = make_product(barcode="4820000000011")
        assert resolve_barcode("0000") == (None, None, None)
        product.is_active = False
        product.save()
        assert resolve_barcode("4820000000011") == (None, None, None)


class TestPrimaryBarcode:
    def test_replacing_primary_keeps_old_as_secondary(self, make_product):
        product = make_product(barcode="111")
        set_primary_barcode(product, "222")
        assert product.primary_barcode.code == "222"
        assert product.barcodes.filter(code="111", is_primary=False).exists()

    def test_code_of_other_product_is_rejected(self, make_product):
        make_product(barcode="111")
        with pytest.raises(ValueError):
            set_primary_barcode(make_product(), "111")


class TestImport:
    def make_job(self, admin, text):
        return ImportJob.objects.create(file=SimpleUploadedFile("p.csv", text.encode()), created_by=admin)

    def test_creates_and_updates_by_sku(self, admin, make_product, units, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        make_product(sku="OLD-1", name="Стара назва")
        csv_text = (
            "sku;barcode;name;category;unit;price;min_stock\n"
            "OLD-1;4820000000011;Нова назва;Напої;шт;10,50;5\n"
            "NEW-1;4820000000012;Новий товар;Бакалія;кг;20;1\n"
            ";;Без артикула;;;;\n"
            "BAD-1;;Погана одиниця;;тонна;1;1\n"
        )
        job = run_import(self.make_job(admin, csv_text))
        assert (job.status, job.rows_total, job.rows_created, job.rows_updated, job.rows_failed) == ("done", 4, 1, 1, 2)
        assert [e["row"] for e in job.errors] == [4, 5]
        old = Product.objects.get(sku="OLD-1")
        assert old.name == "Нова назва" and old.price == Decimal("10.50") and old.version == 2
        assert Product.objects.get(sku="NEW-1").base_unit == units["kg"]
