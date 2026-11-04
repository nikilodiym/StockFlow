import uuid

import pytest
from django.db import IntegrityError

from sync.models import Notification, SyncBatch, SyncConflict

pytestmark = pytest.mark.django_db


def batch(user):
    return SyncBatch.objects.create(id=uuid.uuid4(), user=user)


def test_batch_id_comes_from_phone(worker):
    batch_id = uuid.uuid4()
    assert SyncBatch.objects.create(id=batch_id, user=worker).pk == batch_id


def test_one_open_conflict_per_document(worker):
    entity = uuid.uuid4()
    SyncConflict.objects.create(batch=batch(worker), entity_id=entity, local_data={}, conflict_reason="version_mismatch")
    with pytest.raises(IntegrityError):
        SyncConflict.objects.create(batch=batch(worker), entity_id=entity, local_data={}, conflict_reason="version_mismatch")


def test_resolved_conflicts_do_not_block_new_ones(worker):
    entity = uuid.uuid4()
    SyncConflict.objects.create(
        batch=batch(worker), entity_id=entity, local_data={}, conflict_reason="version_mismatch", status="kept_server"
    )
    SyncConflict.objects.create(batch=batch(worker), entity_id=entity, local_data={}, conflict_reason="already_posted")
    assert SyncConflict.objects.filter(entity_id=entity).count() == 2


def test_json_fields_store_uuid_and_decimal(worker):
    from decimal import Decimal

    entity = uuid.uuid4()
    conflict = SyncConflict.objects.create(
        batch=batch(worker), entity_id=entity, conflict_reason="version_mismatch",
        local_data={"id": entity, "quantity": Decimal("1.5")},
    )
    conflict.refresh_from_db()
    assert conflict.local_data == {"id": str(entity), "quantity": "1.5"}


def test_notifications_newest_first(worker):
    first = Notification.objects.create(user=worker, type="low_stock", title="1")
    second = Notification.objects.create(user=worker, type="low_stock", title="2")
    assert list(Notification.objects.all()) == [second, first]


def test_urgent_types():
    assert {"low_stock", "sync_conflict", "transfer_incoming"} == Notification.URGENT
