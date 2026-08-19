from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Device, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ["-created_at"]
    list_display = ("name", "display_phone", "role", "status", "listings_approved_count", "created_at")
    list_filter = ("role", "status", "language", "phone_verified")
    search_fields = ("name", "phone", "whatsapp_number")
    readonly_fields = ("created_at", "last_seen_at", "listings_approved_count")

    fieldsets = (
        (None, {"fields": ("phone", "password")}),
        ("المعلومات", {"fields": ("name", "whatsapp_number", "language")}),
        ("الصلاحيات والحالة", {"fields": ("role", "status", "suspension_reason", "phone_verified")}),
        ("إحصاءات", {"fields": ("listings_approved_count", "created_at", "last_seen_at")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("phone", "name", "password1", "password2", "role"),
        }),
    )
    filter_horizontal = ()


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ("user", "platform", "app_version", "is_active", "updated_at")
    list_filter = ("platform", "is_active")
    search_fields = ("user__name", "user__phone", "token")
