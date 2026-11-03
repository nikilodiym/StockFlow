from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Device, Membership, User


class MembershipInline(admin.TabularInline):
    model = Membership
    extra = 0


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ["email"]
    list_display = ["email", "full_name", "is_staff", "is_active", "last_login"]
    list_filter = ["is_staff", "is_active"]
    search_fields = ["email", "full_name", "phone"]
    inlines = [MembershipInline]
    fieldsets = [
        (None, {"fields": ["email", "password"]}),
        ("Профіль", {"fields": ["full_name", "phone"]}),
        ("PIN", {"fields": ["pin_failed_attempts", "pin_locked_until"]}),
        ("Доступ", {"fields": ["is_active", "is_staff", "is_superuser", "groups", "user_permissions"]}),
        ("Дати", {"fields": ["last_login", "date_joined"]}),
    ]
    add_fieldsets = [(None, {"classes": ["wide"], "fields": ["email", "full_name", "password1", "password2"]})]


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "model", "platform", "battery_level", "last_seen_at", "is_blocked"]
    list_filter = ["is_blocked", "platform"]
