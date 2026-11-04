from rest_framework import serializers

from accounts.serializers import DeviceStateSerializer

from .models import Notification, SyncBatch, SyncConflict


class PushItemSerializer(serializers.Serializer):
    entity = serializers.ChoiceField(choices=["document"], default="document")
    id = serializers.UUIDField()
    op = serializers.ChoiceField(choices=["create", "update", "delete", "post"])
    base_version = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    data = serializers.DictField(required=False, default=dict)


class PushSerializer(serializers.Serializer):
    batch_id = serializers.UUIDField()
    device_id = serializers.UUIDField()
    device = DeviceStateSerializer(required=False)
    client_sent_at = serializers.DateTimeField(required=False, allow_null=True)
    items = PushItemSerializer(many=True)

    def validate_device(self, value):
        value.pop("id", None)
        return value


class LegacySyncSerializer(serializers.Serializer):
    device_id = serializers.CharField(required=False, allow_blank=True)
    changes = serializers.ListField(child=serializers.DictField())


class SyncBatchSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.get_full_name", read_only=True, default=None)
    device_name = serializers.CharField(source="device.__str__", read_only=True, default=None)

    class Meta:
        model = SyncBatch
        fields = [
            "id", "device", "device_name", "user", "user_name", "direction", "status", "items_total", "items_ok",
            "items_conflict", "items_failed", "error", "client_sent_at", "received_at", "processed_at", "response",
        ]


class SyncConflictSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncConflict
        fields = [
            "id", "batch", "entity_type", "entity_id", "base_version", "server_version", "local_data", "server_data",
            "conflict_reason", "status", "resolved_by", "resolved_at", "created_at",
        ]


class ResolveConflictSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=[SyncConflict.KEPT_LOCAL, SyncConflict.KEPT_SERVER])


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "type", "title", "body", "warehouse", "payload", "is_pushed", "read_at", "created_at"]
        read_only_fields = fields
