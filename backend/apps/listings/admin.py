from django.contrib import admin
from django.utils.html import format_html

from .models import Favorite, Listing, ListingMedia, RejectionReason, Report


class MediaInline(admin.TabularInline):
    model = ListingMedia
    extra = 0
    fields = ("preview", "kind", "is_main", "sort_order")
    readonly_fields = ("preview",)

    @admin.display(description="معاينة")
    def preview(self, obj):
        if obj.thumb:
            return format_html('<img src="{}" style="height:60px;border-radius:6px">', obj.thumb.url)
        return "—"


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "category", "city", "price",
                    "status", "is_featured", "created_at")
    list_filter = ("status", "condition", "is_featured", "category")
    search_fields = ("title", "description", "user__name", "user__phone")
    readonly_fields = ("views_count", "contacts_count", "favorites_count",
                       "reports_count", "reviewed_by", "reviewed_at", "created_at")
    inlines = [MediaInline]
    actions = ["approve_selected", "reject_selected"]

    @admin.action(description="قبول ونشر المحدّد")
    def approve_selected(self, request, queryset):
        from apps.core.models import AppConfig

        days = AppConfig.get_solo().listing_expiry_days
        for listing in queryset:
            listing.publish(reviewer=request.user, expiry_days=days)
        self.message_user(request, f"نُشر {queryset.count()} إعلانًا.")

    @admin.action(description="رفض المحدّد (بلا سبب — استخدم اللوحة للسبب)")
    def reject_selected(self, request, queryset):
        for listing in queryset:
            listing.reject("مخالف للشروط.", reviewer=request.user)


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("listing", "reason", "reporter", "status", "created_at")
    list_filter = ("reason", "status")
    search_fields = ("listing__title", "note")


@admin.register(RejectionReason)
class RejectionReasonAdmin(admin.ModelAdmin):
    list_display = ("name_ar", "name_tr", "name_en", "is_active", "sort_order")
    list_editable = ("is_active", "sort_order")


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ("user", "listing", "created_at")
    search_fields = ("user__name", "listing__title")
