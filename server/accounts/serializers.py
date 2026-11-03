from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from core.permissions import ADMIN
from inventory.models import Warehouse

from .models import Device, Membership

User = get_user_model()

# 'admin' is not a warehouse role: it maps to users.is_staff (kept for the web UI).
USER_ROLES = Membership.ROLES + [(ADMIN, "Адміністратор")]


class MembershipSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = Membership
        fields = ["id", "user", "user_email", "warehouse", "warehouse_name", "warehouse_code", "role", "is_default", "created_at"]
        read_only_fields = ["created_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.user.is_staff:
            data["role"] = ADMIN
        return data

    @transaction.atomic
    def save(self, **kwargs):
        membership = super().save(**kwargs)
        if membership.is_default:
            Membership.objects.filter(user=membership.user, is_default=True).exclude(pk=membership.pk).update(is_default=False)
        return membership


class UserSerializer(serializers.ModelSerializer):
    """Admin-managed staff account; creating one also grants a role on a warehouse."""

    email = serializers.EmailField(max_length=254)
    name = serializers.CharField(source="full_name", required=False, allow_blank=True, max_length=150)
    password = serializers.CharField(write_only=True, required=False, style={"input_type": "password"})
    role = serializers.ChoiceField(choices=USER_ROLES, write_only=True, required=False)
    warehouse = serializers.PrimaryKeyRelatedField(
        queryset=Warehouse.objects.filter(is_active=True), write_only=True, required=False
    )
    memberships = MembershipSerializer(many=True, read_only=True)
    has_pin = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "email", "name", "phone", "password", "role", "warehouse", "is_active", "is_staff",
            "has_pin", "memberships", "date_joined", "last_login",
        ]
        read_only_fields = ["is_staff", "date_joined", "last_login"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["name"] = instance.get_full_name()
        return data

    def validate_email(self, value):
        value = value.strip().lower()
        taken = User.objects.filter(email__iexact=value)
        if self.instance:
            taken = taken.exclude(pk=self.instance.pk)
        if taken.exists():
            raise serializers.ValidationError("Користувач з таким email вже існує")
        return value

    def validate(self, attrs):
        if not self.instance:
            missing = {f: "Обов’язкове поле" for f in ("password", "role") if not attrs.get(f)}
            if attrs.get("role") != ADMIN and not attrs.get("warehouse"):
                missing["warehouse"] = "Обов’язкове поле"
            if missing:
                raise serializers.ValidationError(missing)
        request = self.context.get("request")
        is_self = bool(self.instance and request and self.instance.pk == request.user.pk)
        if is_self and attrs.get("is_active") is False:
            raise serializers.ValidationError({"is_active": "Не можна заблокувати власний акаунт"})
        if is_self and attrs.get("role") and attrs["role"] != ADMIN:
            raise serializers.ValidationError({"role": "Не можна зняти з себе права адміністратора"})
        if attrs.get("password"):
            probe = self.instance or User(email=attrs.get("email", ""), full_name=attrs.get("full_name", ""))
            try:
                validate_password(attrs["password"], probe)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs

    @staticmethod
    def _apply_role(user, role, warehouse):
        if role == ADMIN:
            user.is_staff = True
        elif role and not user.is_superuser:
            user.is_staff = False
        user.save(update_fields=["is_staff"])
        warehouse_role = Membership.MANAGER if role == ADMIN else role
        if warehouse:
            is_first = not user.memberships.exists()
            Membership.objects.update_or_create(
                user=user, warehouse=warehouse,
                defaults={"role": warehouse_role or Membership.WORKER, "is_default": is_first},
            )
        elif warehouse_role:
            user.memberships.update(role=warehouse_role)

    @transaction.atomic
    def create(self, validated_data):
        role, warehouse = validated_data.pop("role"), validated_data.pop("warehouse", None)
        password = validated_data.pop("password")
        user = User.objects.create_user(password=password, **validated_data)
        self._apply_role(user, role, warehouse)
        return user

    @transaction.atomic
    def update(self, instance, validated_data):
        role, warehouse = validated_data.pop("role", None), validated_data.pop("warehouse", None)
        password = validated_data.pop("password", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if password:
            instance.set_password(password)
        instance.save()
        if role or warehouse:
            self._apply_role(instance, role, warehouse)
        return instance


class DeviceStateSerializer(serializers.Serializer):
    """What a phone reports about itself on login and on every sync."""

    id = serializers.UUIDField(required=False)
    name = serializers.CharField(required=False, allow_blank=True, max_length=120)
    model = serializers.CharField(required=False, allow_blank=True, max_length=120)
    platform = serializers.CharField(required=False, allow_blank=True, max_length=20)
    os_version = serializers.CharField(required=False, allow_blank=True, max_length=40)
    app_version = serializers.CharField(required=False, allow_blank=True, max_length=40)
    push_token = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=255)
    battery_level = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=100)
    is_charging = serializers.BooleanField(required=False)


class DeviceSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = Device
        fields = [
            "id", "user", "user_email", "name", "model", "platform", "os_version", "app_version", "battery_level",
            "is_charging", "last_seen_at", "last_sync_at", "is_blocked", "created_at",
        ]
        read_only_fields = [f for f in fields if f != "is_blocked"]


class LoginSerializer(serializers.Serializer):
    email = serializers.CharField()
    password = serializers.CharField(style={"input_type": "password"})
    device = DeviceStateSerializer(required=False)


class PinLoginSerializer(serializers.Serializer):
    device_id = serializers.UUIDField()
    user_id = serializers.IntegerField()
    pin = serializers.RegexField(r"^\d{4}$")


class SetPinSerializer(serializers.Serializer):
    pin = serializers.RegexField(r"^\d{4}$", error_messages={"invalid": "PIN — це 4 цифри"})


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()
