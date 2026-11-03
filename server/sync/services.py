"""
Synchronization and notifications (one app on purpose: phones receive notifications
inside the regular /sync/pull, and report their state — battery, versions — inside /sync/push,
so there is no separate heartbeat or notifications polling).
"""
import hashlib
import json
import logging
import urllib.request
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import PermissionDenied
from rest_framework.exceptions import ValidationError as DRFValidationError

from accounts.models import Device, Membership
from core.permissions import is_manager, is_member, warehouse_ids
from inventory.models import Document, Stock
from inventory.services import DocumentError, can_edit, can_post, post_document

from .models import Notification, SyncBatch, SyncConflict

log = logging.getLogger(__name__)
User = get_user_model()

APPLIED, DUPLICATE, CONFLICT, ERROR = "applied", "duplicate", "conflict", "error"


# ============================================================================
# Notifications
# ============================================================================
def managers_of(warehouse_id):
    return User.objects.filter(
        is_active=True, memberships__warehouse_id=warehouse_id, memberships__role=Membership.MANAGER
    ).distinct()


def members_of(warehouse_id):
    return User.objects.filter(is_active=True, memberships__warehouse_id=warehouse_id).distinct()


def notify(users, type, title, body="", warehouse_id=None, payload=None):
    """Create one notification per user; urgent ones also go out as Expo push after commit."""
    created = Notification.objects.bulk_create([
        Notification(user=user, type=type, title=title[:120], body=body, warehouse_id=warehouse_id, payload=payload or {})
        for user in {u.pk: u for u in users}.values()
    ])
    if created and type in Notification.URGENT and settings.EXPO_PUSH_ENABLED:
        ids = [n.pk for n in created if n.pk]
        transaction.on_commit(lambda: send_push(ids))
    return created


def send_push(notification_ids):
    """Send via Expo push service. Failures are logged, never raised: push is best-effort."""
    notifications = Notification.objects.filter(pk__in=notification_ids).select_related("user")
    messages, sent = [], []
    for notification in notifications:
        tokens = Device.objects.filter(user=notification.user, is_blocked=False).exclude(push_token__isnull=True).exclude(
            push_token=""
        ).values_list("push_token", flat=True)
        for token in tokens:
            messages.append({
                "to": token, "title": notification.title, "body": notification.body,
                "data": {"notification_id": notification.pk, **notification.payload},
            })
        if tokens:
            sent.append(notification.pk)
    if not messages:
        return
    request = urllib.request.Request(
        settings.EXPO_PUSH_URL, data=json.dumps(messages, default=str).encode(),
        headers={"Content-Type": "application/json", "Accept": "application/json"}, method="POST",
    )
    try:
        urllib.request.urlopen(request, timeout=10).read()
        Notification.objects.filter(pk__in=sent).update(is_pushed=True)
    except Exception:  # noqa: BLE001 - network problems must not break business operations
        log.exception("Expo push failed")


def after_document_posted(document, touched):
    """Called on commit of a posting: low stock alerts and incoming transfer notices."""
    rows = Stock.objects.select_related("product__base_unit", "warehouse").filter(
        quantity__lte=F("product__min_stock"), product__min_stock__gt=0
    )
    condition = Q()
    for warehouse_id, product_id in touched:
        condition |= Q(warehouse_id=warehouse_id, product_id=product_id)
    for row in rows.filter(condition) if touched else []:
        already = Notification.objects.filter(
            type=Notification.LOW_STOCK, read_at__isnull=True, warehouse_id=row.warehouse_id,
            payload__product_id=row.product_id,
        ).values_list("user_id", flat=True)
        recipients = managers_of(row.warehouse_id).exclude(pk__in=list(already))
        unit = row.product.base_unit.name
        notify(
            recipients, Notification.LOW_STOCK, f"Мало на складі: {row.product.name}",
            f"{row.warehouse.name}: залишок {row.quantity.normalize()} {unit}, мінімум {row.product.min_stock.normalize()} {unit}",
            warehouse_id=row.warehouse_id,
            payload={"product_id": row.product_id, "warehouse_id": row.warehouse_id, "document_id": str(document.pk)},
        )
    if document.type == Document.TRANSFER:
        notify(
            members_of(document.destination_warehouse_id), Notification.TRANSFER_INCOMING,
            f"Вхідне переміщення {document.number}", f"Зі складу «{document.warehouse.name}»",
            warehouse_id=document.destination_warehouse_id, payload={"document_id": str(document.pk)},
        )


def notify_stale_devices():
    """Periodic check (manage.py check_devices): phones that have not synced for a long time."""
    border = timezone.now() - timedelta(hours=settings.STALE_DEVICE_HOURS)
    count = 0
    for device in Device.objects.filter(is_blocked=False, user__isnull=False, last_sync_at__lt=border).select_related("user"):
        already = Notification.objects.filter(
            type=Notification.STALE_DEVICE, payload__device_id=str(device.pk), created_at__gte=border
        ).exists()
        if already:
            continue
        for membership in device.user.memberships.all():
            notify(
                managers_of(membership.warehouse_id), Notification.STALE_DEVICE,
                f"{device.user.get_full_name()} давно не синхронізувався",
                f"Пристрій {device}: остання синхронізація {timezone.localtime(device.last_sync_at):%d.%m %H:%M}",
                warehouse_id=membership.warehouse_id, payload={"device_id": str(device.pk)},
            )
            count += 1
    return count


# ============================================================================
# Devices
# ============================================================================
def touch_device(user, device_id, state):
    """Update the phone from the state it reports in every sync (replaces a heartbeat endpoint)."""
    device, _ = Device.objects.get_or_create(pk=device_id)
    if device.is_blocked:
        raise PermissionDenied("Пристрій заблоковано адміністратором")
    previous_level = device.battery_level
    device.user = user
    device.apply_state(state or {})
    device.save()
    level = device.battery_level
    low = settings.LOW_BATTERY_LEVEL
    if level is not None and level < low and not device.is_charging and (previous_level is None or previous_level >= low):
        for warehouse_id in user.memberships.values_list("warehouse_id", flat=True):
            notify(
                managers_of(warehouse_id), Notification.LOW_BATTERY, f"Низький заряд: {user.get_full_name()}",
                f"Пристрій {device}: {level}%", warehouse_id=warehouse_id, payload={"device_id": str(device.pk)},
            )
    return device


# ============================================================================
# Push (phone → server)
# ============================================================================
def _document_data(doc):
    from inventory.serializers import DocumentSerializer

    return DocumentSerializer(doc).data


def _error_text(exc):
    if isinstance(exc, DRFValidationError):
        return json.dumps(exc.detail, ensure_ascii=False, default=str)[:500]
    return str(exc)[:500]


def _conflict(batch, user, item, doc, reason):
    server_data = _document_data(doc) if doc else None
    conflict, _ = SyncConflict.objects.update_or_create(
        entity_type="document", entity_id=item["id"], status=SyncConflict.OPEN,
        defaults={
            "batch": batch, "base_version": item.get("base_version"), "server_version": doc.version if doc else None,
            "local_data": item.get("data") or {}, "server_data": server_data, "conflict_reason": reason,
        },
    )
    recipients = [user]
    if doc:
        recipients += list(managers_of(doc.warehouse_id))
    notify(
        recipients, Notification.SYNC_CONFLICT, "Конфлікт синхронізації",
        f"Документ {doc.number if doc else item['id']}: {conflict.get_conflict_reason_display()}",
        warehouse_id=doc.warehouse_id if doc else None,
        payload={"conflict_id": conflict.pk, "document_id": str(item["id"])},
    )
    return {
        "result": CONFLICT, "reason": reason, "conflict_id": conflict.pk,
        "server_version": doc.version if doc else None, "server": server_data,
    }


def _has_inactive_products(data):
    from catalog.models import Product

    ids = [line.get("product") for line in data.get("lines", []) if isinstance(line, dict)]
    return bool(ids) and Product.objects.filter(pk__in=ids, is_active=False).exists()


def _save_document(user, device, doc, data, doc_id=None):
    from inventory.serializers import DocumentSerializer

    payload = {k: v for k, v in data.items() if k not in ("status", "version", "number", "created_by")}
    if doc is None:
        payload["id"] = str(doc_id)
    serializer = DocumentSerializer(doc, data=payload, partial=doc is not None)
    serializer.is_valid(raise_exception=True)
    warehouse = serializer.validated_data.get("warehouse") or (doc.warehouse if doc else None)
    if not warehouse or not is_member(user, warehouse.pk):
        raise PermissionDenied("Немає доступу до цього складу")
    extra = {"device": device} if doc else {"device": device, "created_by": user}
    doc = serializer.save(**extra)
    if data.get("status") == Document.POSTED and can_post(user, doc):
        doc = post_document(doc, user)
    return doc


def _process_item(user, device, batch, item):
    doc_id, op, data = item["id"], item["op"], item.get("data") or {}
    base_version = item.get("base_version")
    result = {"id": str(doc_id), "op": op}
    try:
        with transaction.atomic():
            doc = Document.objects.filter(pk=doc_id).first()

            if op == "create":
                if doc:
                    return {**result, "result": DUPLICATE, "version": doc.version, "number": doc.number}
                if _has_inactive_products(data):
                    return {**result, **_conflict(batch, user, item, None, SyncConflict.PRODUCT_INACTIVE)}
                doc = _save_document(user, device, None, data, doc_id)
                return {**result, "result": APPLIED, "version": doc.version, "number": doc.number, "status": doc.status}

            if doc is None:
                return {**result, "result": ERROR, "error": "Документ не знайдено на сервері"}
            if not is_member(user, doc.warehouse_id):
                raise PermissionDenied("Немає доступу до цього складу")
            if op == "post" and doc.status == Document.POSTED:
                return {**result, "result": DUPLICATE, "version": doc.version, "status": doc.status}
            if doc.is_deleted:
                return {**result, **_conflict(batch, user, item, doc, SyncConflict.DELETED_ON_SERVER)}
            if doc.status != Document.DRAFT:
                return {**result, **_conflict(batch, user, item, doc, SyncConflict.ALREADY_POSTED)}
            if base_version is not None and base_version != doc.version:
                return {**result, **_conflict(batch, user, item, doc, SyncConflict.VERSION_MISMATCH)}

            if op == "update":
                if not can_edit(user, doc):
                    raise PermissionDenied("Редагувати можна лише власні чернетки")
                if _has_inactive_products(data):
                    return {**result, **_conflict(batch, user, item, doc, SyncConflict.PRODUCT_INACTIVE)}
                doc = _save_document(user, device, doc, data)
            elif op == "delete":
                if not can_edit(user, doc):
                    raise PermissionDenied("Видаляти можна лише власні чернетки")
                doc.is_deleted = True
                doc.bump_version()
                doc.save(update_fields=["is_deleted", "version", "updated_at"])
            elif op == "post":
                if not can_post(user, doc):
                    raise PermissionDenied("Проводити документи може лише менеджер складу")
                doc = post_document(doc, user)
            return {**result, "result": APPLIED, "version": doc.version, "number": doc.number, "status": doc.status}
    except (DocumentError, DRFValidationError, PermissionDenied, ValueError) as exc:
        return {**result, "result": ERROR, "error": _error_text(exc)}


def process_push(user, payload):
    """
    payload = {batch_id, device_id, device: {...state}, client_sent_at, items: [
        {entity: "document", id, op: create|update|delete|post, base_version, data: {...document + lines}}
    ]}
    """
    batch_id = payload["batch_id"]
    existing = SyncBatch.objects.filter(pk=batch_id).first()
    if existing:
        if existing.user_id != user.pk:
            raise PermissionDenied("Пакет належить іншому користувачу")
        if existing.response is not None:
            return existing.response  # idempotency: repeated batch, nothing is executed again

    device = touch_device(user, payload["device_id"], payload.get("device"))
    batch = existing or SyncBatch.objects.create(
        id=batch_id, device=device, user=user, direction=SyncBatch.PUSH, client_sent_at=payload.get("client_sent_at")
    )

    results = [_process_item(user, device, batch, item) for item in payload.get("items", [])]
    counts = {key: sum(1 for r in results if r["result"] == key) for key in (APPLIED, DUPLICATE, CONFLICT, ERROR)}
    batch.items_total = len(results)
    batch.items_ok = counts[APPLIED] + counts[DUPLICATE]
    batch.items_conflict = counts[CONFLICT]
    batch.items_failed = counts[ERROR]
    if not results or batch.items_ok == len(results):
        batch.status = SyncBatch.PROCESSED
    elif batch.items_ok == 0:
        batch.status = SyncBatch.FAILED
    else:
        batch.status = SyncBatch.PARTIAL
    batch.processed_at = timezone.now()
    batch.response = {"batch_id": str(batch_id), "status": batch.status, "results": results, "server_time": batch.processed_at}
    batch.error = "; ".join(r["error"] for r in results if r["result"] == ERROR)[:2000]
    batch.save()

    if batch.items_failed:
        notify(
            [user], Notification.SYNC_FAILED, "Не всі документи синхронізовано",
            f"Відхилено документів: {batch.items_failed}", payload={"batch_id": str(batch_id)},
        )
    device.last_sync_at = batch.processed_at
    device.save(update_fields=["last_sync_at"])
    # Re-read through the JSON encoder so the first response equals the stored one byte-for-byte.
    return SyncBatch.objects.get(pk=batch_id).response


# ============================================================================
# Pull (server → phone)
# ============================================================================
INITIAL_DOCUMENTS_DAYS = 30


def build_pull(user, cursor=None, device_id=None, device_state=None):
    from accounts.serializers import MembershipSerializer
    from catalog.models import Barcode, Category, Product, ProductUnit, Unit
    from catalog.serializers import BarcodeSerializer, CategorySerializer, ProductSerializer, ProductUnitSerializer, UnitSerializer
    from inventory.models import Warehouse
    from inventory.serializers import DocumentSerializer, StockSerializer, WarehouseSerializer

    from .serializers import NotificationSerializer

    now = timezone.now()
    since = parse_datetime(cursor) if cursor else None
    if cursor and since is None:
        raise DRFValidationError({"cursor": "Некоректний формат часу (ISO 8601)"})
    device = touch_device(user, device_id, device_state) if device_id else None

    def changed(queryset, field="updated_at"):
        return queryset.filter(**{f"{field}__gt": since}) if since else queryset

    ids = warehouse_ids(user)
    warehouses = Warehouse.objects.all() if ids is None else Warehouse.objects.filter(pk__in=ids)
    stock = Stock.objects.select_related("product", "warehouse")
    documents = Document.objects.select_related("warehouse", "destination_warehouse", "created_by").prefetch_related(
        "lines__product__barcodes", "lines__product__base_unit", "lines__entered_unit"
    )
    if ids is not None:
        stock = stock.filter(warehouse_id__in=ids)
        documents = documents.filter(Q(warehouse_id__in=ids) | Q(destination_warehouse_id__in=ids))
    if since is None:  # first pull: recent history + all open drafts
        documents = documents.filter(
            Q(created_at__gte=now - timedelta(days=INITIAL_DOCUMENTS_DAYS)) | Q(status=Document.DRAFT, is_deleted=False)
        )
    products = Product.objects.select_related("category", "base_unit").prefetch_related(
        "barcodes", "packings__unit", "stock_rows"
    )

    data = {
        "cursor": now,
        "categories": CategorySerializer(changed(Category.objects.all()), many=True).data,
        "units": UnitSerializer(changed(Unit.objects.all()), many=True).data,
        "products": ProductSerializer(changed(products), many=True).data,
        "product_units": ProductUnitSerializer(changed(ProductUnit.objects.select_related("unit")), many=True).data,
        "barcodes": BarcodeSerializer(changed(Barcode.objects.all()), many=True).data,
        "warehouses": WarehouseSerializer(changed(warehouses), many=True).data,
        "memberships": MembershipSerializer(user.memberships.select_related("warehouse", "user"), many=True).data,
        "stock": StockSerializer(changed(stock), many=True).data,
        "documents": DocumentSerializer(changed(documents), many=True).data,
        "notifications": NotificationSerializer(changed(user.notifications.all(), "created_at"), many=True).data,
    }
    if device:
        SyncBatch.objects.create(
            id=uuid.uuid4(), device=device, user=user, direction=SyncBatch.PULL, status=SyncBatch.PROCESSED,
            items_total=sum(len(v) for v in data.values() if isinstance(v, list)), processed_at=now,
        )
        device.last_sync_at = now
        device.save(update_fields=["last_sync_at"])
    return data


# ============================================================================
# Conflicts
# ============================================================================
@transaction.atomic
def resolve_conflict(conflict, user, decision):
    if conflict.status != SyncConflict.OPEN:
        raise DocumentError("Конфлікт уже розв’язано")
    if decision not in (SyncConflict.KEPT_LOCAL, SyncConflict.KEPT_SERVER):
        raise DocumentError("Рішення: kept_local або kept_server")
    doc = Document.objects.filter(pk=conflict.entity_id).first()
    if decision == SyncConflict.KEPT_LOCAL:
        if doc is None or not doc.is_draft:
            raise DocumentError("Документ на сервері вже не чернетка — локальну версію застосувати неможливо")
        _save_document(user, doc.device, doc, conflict.local_data)
    conflict.status = decision
    conflict.resolved_by = user
    conflict.resolved_at = timezone.now()
    conflict.save()
    return conflict


def can_resolve(user, conflict):
    doc = Document.objects.filter(pk=conflict.entity_id).only("warehouse_id").first()
    if doc and is_manager(user, doc.warehouse_id):
        return True
    return conflict.batch.user_id == user.pk


# ============================================================================
# Legacy /api/sync/ (current mobile app) → push
# ============================================================================
def _as_uuid(value):
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError):
        return None


def legacy_sync(user, payload):
    """
    Old format: {device_id: "android", changes: [{client_id, document: {...}}]}.
    Converted into a push batch; the batch id is derived from the content, so an identical
    re-send is idempotent while an edited document makes a new batch.
    Returns (body, has_conflict).
    """
    device_key = str(payload.get("device_id") or "unknown")
    device_id = _as_uuid(device_key) or uuid.uuid5(uuid.NAMESPACE_URL, f"stockflow:{user.pk}:{device_key}")
    changes = payload.get("changes") or []
    items, client_ids, rejected = [], [], {}
    for index, change in enumerate(changes):
        client_id = change.get("client_id")
        data = dict(change.get("document") or {})
        doc_id = _as_uuid(data.pop("id", None)) or _as_uuid(client_id)
        if not doc_id:
            rejected[index] = {"client_id": client_id, "status": "rejected", "reason": "client_id required"}
            continue
        if "created_at" in data:
            data["client_created_at"] = data.pop("created_at")
        exists = Document.objects.filter(pk=doc_id).exists()
        version = data.pop("version", None)
        items.append({
            "entity": "document", "id": doc_id, "op": "update" if exists else "create",
            "base_version": version if exists else None, "data": data,
        })
        client_ids.append((index, client_id))
    digest = hashlib.sha256(json.dumps(changes, sort_keys=True, default=str).encode()).hexdigest()
    batch_id = uuid.uuid5(uuid.NAMESPACE_URL, f"stockflow-legacy:{user.pk}:{digest}")
    response = process_push(user, {"batch_id": batch_id, "device_id": device_id, "device": {"platform": device_key}, "items": items})

    mapping = {APPLIED: "accepted", DUPLICATE: "accepted", CONFLICT: "conflict", ERROR: "rejected"}
    results = dict(rejected)
    for (index, client_id), item in zip(client_ids, response["results"]):
        entry = {"client_id": str(client_id), "status": mapping[item["result"]], "entity_id": item["id"]}
        if item["result"] == DUPLICATE:
            entry["duplicate"] = True
        if item.get("version") is not None:
            entry["version"] = item["version"]
        if item["result"] == ERROR:
            entry["reason"] = item.get("error")
        if item["result"] == CONFLICT:
            entry.update(server_version=item.get("server_version"), server=item.get("server"), reason=item.get("reason"))
        results[index] = entry
    body = {"results": [results[i] for i in sorted(results)], "server_time": response["server_time"]}
    return body, any(r["status"] == "conflict" for r in body["results"])
