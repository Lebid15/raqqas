"""المدن والأحياء والأقسام — كل ما يكتبه الأدمن يُخزَّن بثلاث لغات (plan2 §8.5)."""

from django.db import models

from apps.core.models import TimeStampedModel, TranslatedNameModel


class City(TranslatedNameModel, TimeStampedModel):
    """جدول المدن جاهز من الآن — الرقة فقط عند الإطلاق (plan2 §9 قرار 13)."""

    slug = models.SlugField("المعرّف", max_length=40, unique=True)
    is_active = models.BooleanField("مفعّلة", default=True, db_index=True)
    sort_order = models.PositiveSmallIntegerField("الترتيب", default=0)

    class Meta:
        verbose_name = "مدينة"
        verbose_name_plural = "المدن"
        ordering = ["sort_order", "name_ar"]


class Neighborhood(TranslatedNameModel, TimeStampedModel):
    city = models.ForeignKey(
        City, verbose_name="المدينة", on_delete=models.CASCADE, related_name="neighborhoods"
    )
    slug = models.SlugField("المعرّف", max_length=60)
    is_active = models.BooleanField("مفعّل", default=True, db_index=True)
    sort_order = models.PositiveSmallIntegerField("الترتيب", default=0)

    class Meta:
        verbose_name = "حي"
        verbose_name_plural = "الأحياء"
        ordering = ["sort_order", "name_ar"]
        constraints = [
            models.UniqueConstraint(fields=["city", "slug"], name="uniq_neighborhood_slug_per_city")
        ]

    def __str__(self) -> str:
        return f"{self.name_ar} — {self.city.name_ar}"


class CategoryQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True)

    def roots(self):
        return self.filter(parent__isnull=True)


class Category(TranslatedNameModel, TimeStampedModel):
    parent = models.ForeignKey(
        "self", verbose_name="القسم الأب", null=True, blank=True,
        on_delete=models.CASCADE, related_name="children",
    )
    slug = models.SlugField("المعرّف", max_length=60, unique=True)
    icon = models.CharField("الأيقونة", max_length=8, blank=True, help_text="رمز تعبيري، مثل 🚗")
    is_active = models.BooleanField("مفعّل", default=True, db_index=True)
    sort_order = models.PositiveSmallIntegerField("الترتيب", default=0)

    objects = CategoryQuerySet.as_manager()

    class Meta:
        verbose_name = "قسم"
        verbose_name_plural = "الأقسام"
        ordering = ["sort_order", "name_ar"]
        indexes = [models.Index(fields=["parent", "is_active"])]

    def __str__(self) -> str:
        return f"{self.parent.name_ar} › {self.name_ar}" if self.parent_id else self.name_ar

    @property
    def is_root(self) -> bool:
        return self.parent_id is None

    def descendant_ids(self) -> list[int]:
        """معرّفات القسم وأبنائه — للبحث داخل قسم رئيسي."""
        ids = [self.pk]
        ids.extend(self.children.values_list("id", flat=True))
        return ids
