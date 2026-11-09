import uuid

import pytest

from inventory.models import Document

pytestmark = pytest.mark.django_db


def test_receipt_posts_even_with_an_invalid_transfer_in_same_queue(client_for, admin, warehouse, make_product, stock_of):
    product = make_product()
    transfer_id, receipt_id = str(uuid.uuid4()), str(uuid.uuid4())
    response = client_for(admin).post('/api/sync/', {
        'device_id': 'android',
        'changes': [
            {'client_id': doc_id, 'document': {'id': doc_id, 'type': kind, 'status': 'posted',
                'warehouse': warehouse.pk, 'lines': [{'product': product.pk, 'quantity': 3}]}}
            for doc_id, kind in [(transfer_id, 'transfer'), (receipt_id, 'receipt')]
        ],
    }, format='json')
    assert response.status_code == 200
    assert [r['status'] for r in response.data['results']] == ['rejected', 'accepted']
    receipt = Document.objects.get(pk=receipt_id)
    assert receipt.type == Document.RECEIPT and receipt.status == Document.POSTED
    assert stock_of(product, warehouse) == 3
