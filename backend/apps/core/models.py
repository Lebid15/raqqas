"""
النماذج الأساسية — أهمّها AppConfig: النسخة الواحدة التي تتحكّم بكل شيء.

قاعدة plan2 §4.2: أي شيء يريد الأدمن تغييره لاحقًا يمرّ من هنا ولا يُكتب في الكود.
"""

from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from . import defaults

CONFIG_CACHE_KEY = "app_config:v1"
CONFIG_CACHE_TTL = 300


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField("أُنشئ في", auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField("عُدّل في", auto_now=True)

    class Meta:
        abstract = True


class TranslatedNameModel(models.Model):
    """
    كل ما يكتبه الأدمن يُخزَّن بثلاث لغات (plan2 §8.5).
    العربية إلزامية — والباقي يقع عليها عند الفراغ.
    """

    name_ar = models.CharField("الاسم (عربي)", max_length=120)
    name_tr = models.CharField("الاسم (تركي)", max_length=120, blank=True)
    name_en = models.CharField("الاسم (إنكليزي)", max_length=120, blank=True)

    class Meta:
        abstract = True

    def name_for(self, lang: str) -> str:
        return getattr(self, f"name_{lang}", "") or self.name_ar

    def __str__(self) -> str:
        return self.name_ar


class AppConfig(TimeStampedModel):
    """
    نسخة واحدة (singleton) — id ثابت على 1.
    كل حفظ يرفع `version`، والتطبيق يقارن الرقم ليعرف أن عليه تحديث نسخته المخزّنة.
    """

    SHADOWS = [(s, s) for s in defaults.SHADOW_PRESETS]
    DENSITIES = [(d, d) for d in defaults.DENSITY_PRESETS]
    POSITIONS = [("before", "قبل المبلغ"), ("after", "بعد المبلغ")]
    REVIEW_MODES = [
        ("all", "مراجعة كل إعلان"),
        ("new_users", "مراجعة إعلانات الأعضاء الجدد فقط"),
        ("off", "نشر فوري بلا مراجعة"),
    ]

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    version = models.PositiveIntegerField("رقم النسخة", default=1, editable=False)

    # ---------------- الهوية
    app_name_ar = models.CharField("اسم التطبيق (عربي)", max_length=40, default="سوق الرقة")
    app_name_tr = models.CharField("اسم التطبيق (تركي)", max_length=40, blank=True)
    app_name_en = models.CharField("اسم التطبيق (إنكليزي)", max_length=40, blank=True)
    brand_mark = models.CharField(
        "حرف العلامة", max_length=4, default="س",
        help_text="يظهر داخل المربّع حين لا يوجد شعار مرفوع",
    )
    logo = models.ImageField(
        "شعار التطبيق", upload_to="brand/", blank=True, null=True,
        help_text="يظهر في ترويسة التطبيق فورًا بلا إعادة بناء",
    )
    launcher_icon = models.ImageField(
        "أيقونة الجوال", upload_to="brand/", blank=True, null=True,
        help_text=(
            "أيقونة الشاشة الرئيسية للجوال. تُحفظ هنا وتُطبَّق عند بناء نسخة APK "
            "التالية — أندرويد لا يسمح بتغييرها على جهاز مثبَّت"
        ),
    )

    # ---------------- التصميم
    theme_light = models.JSONField("ألوان الوضع النهاري", default=dict, blank=True)
    theme_dark = models.JSONField("ألوان الوضع الليلي", default=dict, blank=True)
    font_family = models.CharField("الخط", max_length=64, default="Cairo")
    font_scale = models.FloatField(
        "مقياس الخط", default=1.0,
        validators=[MinValueValidator(0.85), MaxValueValidator(1.3)],
    )
    radius = models.JSONField("الاستدارة", default=dict, blank=True)
    shadows = models.CharField("الظلال", max_length=12, choices=SHADOWS, default="soft")
    density = models.CharField("الكثافة", max_length=12, choices=DENSITIES, default="normal")
    dark_mode_enabled = models.BooleanField("تفعيل الوضع الليلي", default=True)

    # ---------------- العملة (plan2 §6)
    currency_code = models.CharField("رمز العملة", max_length=8, default="SYP")
    currency_symbol = models.CharField("العلامة", max_length=8, default="ل.س")
    currency_symbol_tr = models.CharField("العلامة (تركي)", max_length=8, blank=True)
    currency_symbol_en = models.CharField("العلامة (إنكليزي)", max_length=8, blank=True)
    currency_position = models.CharField(
        "موضع العلامة", max_length=8, choices=POSITIONS, default="after"
    )
    currency_decimals = models.PositiveSmallIntegerField("عدد الخانات العشرية", default=0)

    # ---------------- اللغات
    default_language = models.CharField("اللغة الافتراضية", max_length=2, default="ar")
    supported_languages = models.JSONField("اللغات المدعومة", default=list, blank=True)

    # ---------------- الصفحة التعريفية
    landing_ar = models.JSONField("الصفحة التعريفية (عربي)", default=dict, blank=True)
    landing_tr = models.JSONField("الصفحة التعريفية (تركي)", default=dict, blank=True)
    landing_en = models.JSONField("الصفحة التعريفية (إنكليزي)", default=dict, blank=True)
    landing_image = models.ImageField(
        "صورة الصفحة التعريفية", upload_to="landing/", blank=True, null=True
    )

    # ---------------- التطبيق والتوزيع (plan2 §7.2)
    apk_url = models.URLField("رابط ملف APK", blank=True)
    apk_sha256 = models.CharField("بصمة الملف", max_length=64, blank=True)
    apk_size_mb = models.FloatField("حجم الملف (ميغا)", default=0)
    latest_version = models.CharField("آخر إصدار", max_length=16, default="1.0.0")
    min_version = models.CharField("أدنى إصدار مسموح", max_length=16, default="1.0.0")
    update_message_ar = models.CharField("رسالة التحديث (عربي)", max_length=200, blank=True)
    update_message_tr = models.CharField("رسالة التحديث (تركي)", max_length=200, blank=True)
    update_message_en = models.CharField("رسالة التحديث (إنكليزي)", max_length=200, blank=True)

    # ---------------- المزايا والحدود
    features = models.JSONField("المزايا", default=dict, blank=True)
    review_mode = models.CharField(
        "نمط المراجعة", max_length=12, choices=REVIEW_MODES, default="all"
    )
    review_threshold = models.PositiveSmallIntegerField(
        "عدد الإعلانات المقبولة قبل الثقة", default=3,
        help_text="يُستخدم مع نمط «الأعضاء الجدد فقط» (plan2 §8.6)",
    )
    listing_expiry_days = models.PositiveSmallIntegerField("مدة صلاحية الإعلان (يوم)", default=60)
    daily_listing_limit = models.PositiveSmallIntegerField("حد الإعلانات اليومي", default=5)
    max_photos_per_listing = models.PositiveSmallIntegerField("أقصى عدد صور", default=10)

    # ---------------- التواصل
    support_whatsapp = models.CharField("واتساب الدعم", max_length=24, blank=True)
    support_email = models.EmailField("بريد الدعم", blank=True)

    updated_by = models.ForeignKey(
        "accounts.User", verbose_name="آخر من عدّل",
        null=True, blank=True, on_delete=models.SET_NULL, related_name="config_updates",
    )

    class Meta:
        verbose_name = "إعدادات التطبيق"
        verbose_name_plural = "إعدادات التطبيق"

    def __str__(self) -> str:
        return f"إعدادات التطبيق (نسخة {self.version})"

    # ------------------------------------------------------------------

    def save(self, *args, **kwargs):
        self.pk = 1
        if not self.theme_light:
            self.theme_light = dict(defaults.DEFAULT_THEME_LIGHT)
        if not self.theme_dark:
            self.theme_dark = dict(defaults.DEFAULT_THEME_DARK)
        if not self.radius:
            self.radius = dict(defaults.DEFAULT_RADIUS)
        if not self.features:
            self.features = dict(defaults.DEFAULT_FEATURES)
        if not self.supported_languages:
            self.supported_languages = ["ar", "tr", "en"]
        if not self.landing_ar:
            self.landing_ar = defaults.default_landing("ar")
        if not self.landing_tr:
            self.landing_tr = defaults.default_landing("tr")
        if not self.landing_en:
            self.landing_en = defaults.default_landing("en")

        # «ل.س» داخل واجهة إنكليزية يبدو خطأً — نملأ الرمز المعروف لكل لغة
        # عند الفراغ، ويبقى للأدمن أن يكتب ما يريد فوقه.
        known = next(
            (c for c in defaults.KNOWN_CURRENCIES if c["code"] == self.currency_code), None
        )
        if known:
            self.currency_symbol = self.currency_symbol or known["symbol_ar"]
            self.currency_symbol_tr = self.currency_symbol_tr or known["symbol_tr"]
            self.currency_symbol_en = self.currency_symbol_en or known["symbol_en"]

        # لا نرفع النسخة إلا عند تعديل فعلي بعد الإنشاء
        if self.pk and AppConfig.objects.filter(pk=1).exists():
            self.version = models.F("version") + 1

        super().save(*args, **kwargs)
        self.refresh_from_db(fields=["version"])
        cache.delete(CONFIG_CACHE_KEY)

    def clean(self):
        if self.default_language not in (self.supported_languages or ["ar"]):
            raise ValidationError(
                {"default_language": "اللغة الافتراضية يجب أن تكون ضمن اللغات المدعومة."}
            )

    # ------------------------------------------------------------------

    @classmethod
    def get_solo(cls) -> "AppConfig":
        config = cache.get(CONFIG_CACHE_KEY)
        if config is None:
            config, _ = cls.objects.get_or_create(pk=1)
            cache.set(CONFIG_CACHE_KEY, config, CONFIG_CACHE_TTL)
        return config

    def feature(self, key: str, fallback=False):
        return (self.features or {}).get(key, defaults.DEFAULT_FEATURES.get(key, fallback))

    def currency_symbol_for(self, lang: str) -> str:
        return getattr(self, f"currency_symbol_{lang}", "") or self.currency_symbol

    def landing_for(self, lang: str) -> dict:
        return getattr(self, f"landing_{lang}", None) or self.landing_ar or {}

    def update_message_for(self, lang: str) -> str:
        return getattr(self, f"update_message_{lang}", "") or self.update_message_ar

    def app_name_for(self, lang: str) -> str:
        return getattr(self, f"app_name_{lang}", "") or self.app_name_ar


class AdminLog(models.Model):
    """سجلّ إجراءات الإدارة — من فعل ماذا ومتى (plan2 §8.5)."""

    ACTIONS = [
        ("approve", "قبول إعلان"),
        ("reject", "رفض إعلان"),
        ("suspend", "إيقاف إعلان"),
        ("delete", "حذف إعلان"),
        ("feature", "تمييز إعلان"),
        ("user_suspend", "إيقاف مستخدم"),
        ("user_ban", "حظر مستخدم"),
        ("user_activate", "تفعيل مستخدم"),
        ("user_auto_publish", "تبديل النشر التلقائي"),
        ("config", "تعديل الإعدادات"),
        ("report_resolve", "معالجة بلاغ"),
    ]

    actor = models.ForeignKey(
        "accounts.User", verbose_name="المنفّذ",
        null=True, on_delete=models.SET_NULL, related_name="admin_logs",
    )
    action = models.CharField("الإجراء", max_length=24, choices=ACTIONS, db_index=True)
    target_type = models.CharField("نوع الهدف", max_length=32, blank=True)
    target_id = models.PositiveIntegerField("رقم الهدف", null=True, blank=True)
    note = models.TextField("ملاحظة", blank=True)
    meta = models.JSONField("تفاصيل", default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "سجلّ إدارة"
        verbose_name_plural = "سجلّ الإدارة"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["target_type", "target_id"])]

    def __str__(self) -> str:
        return f"{self.get_action_display()} — {self.target_type}#{self.target_id}"

    @classmethod
    def record(cls, actor, action, target=None, note="", **meta):
        return cls.objects.create(
            actor=actor if getattr(actor, "is_authenticated", False) else None,
            action=action,
            target_type=target.__class__.__name__.lower() if target else "",
            target_id=getattr(target, "pk", None),
            note=note,
            meta=meta,
        )


class DownloadEvent(models.Model):
    """عدّاد تنزيلات APK — بديلنا عن إحصاءات المتجر (plan2 §7.2)."""

    version = models.CharField(max_length=16, blank=True)
    source = models.CharField(max_length=32, blank=True, help_text="landing | qr | share")
    user_agent = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "تنزيل"
        verbose_name_plural = "التنزيلات"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"تنزيل {self.version} — {self.created_at:%Y-%m-%d}"


def now():
    return timezone.now()


# نموذج التحديث عن بُعد يعيش في ملف مستقل — نستورده هنا ليكتشفه Django
from .updates import OtaUpdate  # noqa: E402,F401
