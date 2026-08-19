from django.contrib import admin

from .models import Category, City, Neighborhood


class NeighborhoodInline(admin.TabularInline):
    model = Neighborhood
    extra = 0
    fields = ("name_ar", "name_tr", "name_en", "slug", "sort_order", "is_active")


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ("name_ar", "name_tr", "name_en", "is_active", "sort_order")
    list_editable = ("is_active", "sort_order")
    prepopulated_fields = {"slug": ("name_en",)}
    inlines = [NeighborhoodInline]


@admin.register(Neighborhood)
class NeighborhoodAdmin(admin.ModelAdmin):
    list_display = ("name_ar", "city", "name_tr", "name_en", "is_active", "sort_order")
    list_filter = ("city", "is_active")
    list_editable = ("is_active", "sort_order")
    search_fields = ("name_ar", "name_tr", "name_en")


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("__str__", "icon", "name_tr", "name_en", "is_active", "sort_order")
    list_filter = ("is_active", "parent")
    list_editable = ("is_active", "sort_order")
    search_fields = ("name_ar", "name_tr", "name_en", "slug")
