import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("Email обов’язковий")
        user = self.model(email=self.normalize_email(email).strip().lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra["is_staff"] = True
        extra["is_superuser"] = True
        return self._create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    """Login is email (case-insensitive). is_staff = global administrator."""

    email = models.EmailField(max_length=254, unique=True)
    full_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    pin_hash = models.CharField(max_length=128, blank=True, null=True)
    pin_failed_attempts = models.PositiveSmallIntegerField(default=0)
    pin_locked_until = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "users"
        ordering = ["-is_active", "full_name", "email"]
        constraints = [models.UniqueConstraint(Lower("email"), name="users_email_ci_unique")]

    def __str__(self):
        return self.full_name or self.email

    def save(self, *args, **kwargs):
        self.email = (self.email or "").strip().lower()
        super().save(*args, **kwargs)

    def get_full_name(self):
        return self.full_name or self.email

    def get_short_name(self):
        return (self.full_name or self.email).split(" ")[0]

    def has_perm(self, perm, obj=None):
        # StockFlow's global administrator must also have Django model permissions.
        if self.is_active and self.is_staff:
            return True
        return super().has_perm(perm, obj)

    def has_module_perms(self, app_label):
        if self.is_active and self.is_staff:
            return True
        return super().has_module_perms(app_label)

    # --- PIN -----------------------------------------------------------------
    @property
    def has_pin(self):
        return bool(self.pin_hash)

    def set_pin(self, pin):
        self.pin_hash = make_password(pin)
        self.pin_failed_attempts = 0
        self.pin_locked_until = None

    def is_pin_locked(self):
        return bool(self.pin_locked_until and self.pin_locked_until > timezone.now())

    def check_pin(self, pin):
        """Check a PIN and count failures; after N failures the PIN is locked for a while."""
        if not self.pin_hash or self.is_pin_locked():
            return False
        if check_password(pin, self.pin_hash):
            self.pin_failed_attempts = 0
            self.pin_locked_until = None
            self.save(update_fields=["pin_failed_attempts", "pin_locked_until"])
            return True
        self.pin_failed_attempts += 1
        if self.pin_failed_attempts >= settings.PIN_MAX_ATTEMPTS:
            self.pin_locked_until = timezone.now() + timedelta(minutes=settings.PIN_LOCK_MINUTES)
            self.pin_failed_attempts = 0
        self.save(update_fields=["pin_failed_attempts", "pin_locked_until"])
        return False


class Membership(models.Model):
    """Role of a user on one particular warehouse."""

    WORKER = "worker"
    MANAGER = "manager"
    ROLES = [(WORKER, "Комірник"), (MANAGER, "Менеджер складу")]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships")
    warehouse = models.ForeignKey("inventory.Warehouse", on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=20, choices=ROLES, default=WORKER)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "memberships"
        ordering = ["-is_default", "id"]
        constraints = [
            models.UniqueConstraint(fields=["user", "warehouse"], name="membership_user_warehouse_unique"),
            models.UniqueConstraint(
                fields=["user"], condition=Q(is_default=True), name="membership_one_default_per_user"
            ),
            models.CheckConstraint(condition=Q(role__in=["worker", "manager"]), name="membership_role_valid"),
        ]

    def __str__(self):
        return f"{self.user} → {self.warehouse} ({self.get_role_display()})"


class Device(models.Model):
    """A phone. Its id is a UUID generated on the phone at first launch."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="devices"
    )
    name = models.CharField(max_length=120, blank=True)
    model = models.CharField(max_length=120, blank=True)
    platform = models.CharField(max_length=20, blank=True)
    os_version = models.CharField(max_length=40, blank=True)
    app_version = models.CharField(max_length=40, blank=True)
    push_token = models.CharField(max_length=255, blank=True, null=True)
    battery_level = models.PositiveSmallIntegerField(blank=True, null=True)
    is_charging = models.BooleanField(default=False)
    last_seen_at = models.DateTimeField(blank=True, null=True)
    last_sync_at = models.DateTimeField(blank=True, null=True)
    is_blocked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    STATE_FIELDS = ("name", "model", "platform", "os_version", "app_version", "push_token", "battery_level", "is_charging")

    class Meta:
        db_table = "devices"
        ordering = ["-last_seen_at"]
        constraints = [
            models.CheckConstraint(
                condition=Q(battery_level__isnull=True) | Q(battery_level__gte=0, battery_level__lte=100),
                name="device_battery_0_100",
            )
        ]

    def __str__(self):
        return self.name or self.model or str(self.id)

    def apply_state(self, state):
        """Copy the phone's self-reported state (battery, versions, push token) onto the row."""
        for field in self.STATE_FIELDS:
            if field in (state or {}):
                setattr(self, field, state[field])
        self.last_seen_at = timezone.now()
