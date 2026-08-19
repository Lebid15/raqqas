"""مرشّحات البحث — تقابل شاشة search.html في مجلد design/."""

from decimal import Decimal

import django_filters as filters
from django.db.models import Case, DecimalField, F, Q, Value, When

from apps.catalog.models import Category
from apps.core import money
from apps.core.models import AppConfig

from .models import Listing

SORTS = {
    "newest": ["-is_featured", "-published_at", "-created_at"],
    "oldest": ["published_at", "created_at"],
    # الفرز بالسعر يجري على القيمة **بعد التحويل إلى الدولار** لا على الرقم
    # الخام: 4,500,000 ل.س أكبر عدديًا من 8,500 $ وأقلّ منها قيمةً بكثير.
    # الحقل `price_base` يُحسب في `annotate_base_price` أدناه.
    "price_asc": ["price_base", "-published_at"],
    "price_desc": ["-price_base", "-published_at"],
    "views": ["-views_count", "-published_at"],
}


def annotate_base_price(queryset, rates: dict):
    """
    يضيف `price_base`: سعر الإعلان محسوبًا بالدولار وقت الاستعلام.

    نحسبه في قاعدة البيانات ولا نخزّنه عمودًا: عمود مخزَّن يعني إعادة حساب كل
    صفّ عند كل تعديل لسعر الصرف، وصفوفًا قديمة تحمل قيمًا بأسعار الأمس بلا
    أن يلاحظ أحد. هنا القيمة دائمًا مبنيّة على الجدول الحالي.
    """
    table = money.full_rates(rates)
    whens = [
        When(price_currency=code, then=F("price") / Value(Decimal(str(rate))))
        for code, rate in table.items()
        if rate
    ]
    return queryset.annotate(
        price_base=Case(
            *whens,
            default=F("price"),
            output_field=DecimalField(max_digits=20, decimal_places=6),
        )
    )


class ListingFilter(filters.FilterSet):
    q = filters.CharFilter(method="filter_search", label="بحث نصّي")
    category = filters.CharFilter(method="filter_category", label="القسم (id أو slug)")
    city = filters.CharFilter(method="filter_city", label="المحافظة (id أو slug أو قائمة)")
    condition = filters.ChoiceFilter(choices=Listing.Condition.choices)
    # حدّا السعر بعملة القارئ (المعامل `currency`)، ويُقارَنان بعد التحويل.
    # مقارنة الرقم الخام كانت ستخلط بين «500 دولار» و«500 ليرة سورية».
    min_price = filters.NumberFilter(method="filter_min_price", label="أدنى سعر")
    max_price = filters.NumberFilter(method="filter_max_price", label="أقصى سعر")
    currency = filters.CharFilter(method="filter_noop", label="عملة حدّي السعر")
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

    # ------------------------------------------------------------------ السعر

    def _rates(self) -> dict:
        config = AppConfig.get_solo()
        return config.rates or {}

    def _bound_currency(self) -> str:
        """عملة الحدّين — من المعامل `currency`، وإلا الافتراضية في الإعدادات."""
        requested = (self.data.get("currency") or "").upper()
        return AppConfig.get_solo().currency_for(requested or None)

    def _filter_price(self, queryset, value, direction: str):
        """
        يبني شرطًا لكل عملة على حدة بحدّها المحوَّل.

        البديل — تحويل عمود السعر في الاستعلام — كان سيمنع استعمال الفهرس على
        `price`. هنا كل فرع يقارن رقمًا خامًا برقم ثابت، فيبقى الفهرس نافعًا.
        """
        source = self._bound_currency()
        rates = self._rates()
        lookup = Q()
        for code in money.CURRENCY_CODES:
            bound = money.convert(value, source, code, rates)
            if bound is None:
                continue
            key = f"price__{direction}"
            lookup |= Q(price_currency=code, **{key: bound})
        if not lookup:
            return queryset
        return queryset.filter(lookup)

    def filter_min_price(self, queryset, name, value):
        return self._filter_price(queryset, value, "gte")

    def filter_max_price(self, queryset, name, value):
        return self._filter_price(queryset, value, "lte")

    def filter_noop(self, queryset, name, value):
        """`currency` معامل قراءة يستعمله مرشّح السعر — لا يرشّح بنفسه شيئًا."""
        return queryset

    def apply_sort(self, queryset, name, value):
        order = SORTS.get(value, SORTS["newest"])
        if any("price_base" in field for field in order):
            queryset = annotate_base_price(queryset, self._rates())
        return queryset.order_by(*order)
