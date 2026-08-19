"""مرشّحات البحث — تقابل شاشة search.html في مجلد design/."""

import django_filters as filters
from django.db.models import Q

from apps.catalog.models import Category

from .models import Listing

SORTS = {
    "newest": ["-is_featured", "-published_at", "-created_at"],
    "oldest": ["published_at", "created_at"],
    "price_asc": ["price", "-published_at"],
    "price_desc": ["-price", "-published_at"],
    "views": ["-views_count", "-published_at"],
}


class ListingFilter(filters.FilterSet):
    q = filters.CharFilter(method="filter_search", label="بحث نصّي")
    category = filters.CharFilter(method="filter_category", label="القسم (id أو slug)")
    city = filters.CharFilter(method="filter_city", label="المحافظة (id أو slug أو قائمة)")
    condition = filters.ChoiceFilter(choices=Listing.Condition.choices)
    min_price = filters.NumberFilter(field_name="price", lookup_expr="gte")
    max_price = filters.NumberFilter(field_name="price", lookup_expr="lte")
    featured = filters.BooleanFilter(field_name="is_featured")
    has_photos = filters.BooleanFilter(method="filter_has_photos")
    seller = filters.NumberFilter(field_name="user_id")
    sort = filters.CharFilter(method="apply_sort")

    class Meta:
        model = Listing
        fields = ["condition", "featured"]

    # ------------------------------------------------------------------

    def filter_search(self, queryset, name, value):
        terms = [t for t in value.split() if len(t) > 1][:6]
        if not terms:
            return queryset
        # كل كلمة يجب أن ترد في العنوان أو الوصف — أدقّ من OR على الكلمات
        for term in terms:
            queryset = queryset.filter(
                Q(title__icontains=term) | Q(description__icontains=term)
            )
        return queryset

    def filter_category(self, queryset, name, value):
        lookup = Q(pk=value) if str(value).isdigit() else Q(slug=value)
        category = Category.objects.filter(lookup).first()
        if not category:
            return queryset.none()
        return queryset.filter(category_id__in=category.descendant_ids())

    def filter_city(self, queryset, name, value):
        """يقبل معرّفًا أو slug أو عدة معرّفات مفصولة بفواصل — «كل المحافظات» = لا مرشّح."""
        parts = [p.strip() for p in str(value).split(",") if p.strip()]
        if not parts:
            return queryset
        ids = [p for p in parts if p.isdigit()]
        slugs = [p for p in parts if not p.isdigit()]
        lookup = Q()
        if ids:
            lookup |= Q(city_id__in=ids)
        if slugs:
            lookup |= Q(city__slug__in=slugs)
        return queryset.filter(lookup)

    def filter_has_photos(self, queryset, name, value):
        return queryset.filter(media__isnull=not value).distinct()

    def apply_sort(self, queryset, name, value):
        return queryset.order_by(*SORTS.get(value, SORTS["newest"]))
