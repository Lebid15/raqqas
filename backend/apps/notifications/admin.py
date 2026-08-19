from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("title_ar", "user", "kind", "is_read", "pushed_at", "created_at")
    list_filter = ("kind", "is_read")
    search_fields = ("title_ar", "user__name", "user__phone")
