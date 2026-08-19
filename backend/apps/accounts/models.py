"""المستخدمون — التسجيل بالهاتف وكلمة المرور (plan2 §9 قرار 7)."""

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

from .utils import display_phone, normalize_phone, whatsapp_link


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create(self, phone, password, **extra):
        if not phone:
            raise ValueError("رقم الهاتف مطلوب.")
        user = self.model(phone=normalize_phone(phone), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, phone, password=None, **extra):
        extra.setdefault("role", User.Role.USER)
        return self._create(phone, password, **extra)

    def create_superuser(self, phone, password=None, **extra):
        extra["role"] = User.Role.ADMIN
        extra["status"] = User.Status.ACTIVE
        extra["is_superuser"] = True
        return self._create(phone, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        USER = "user", "مستخدم"
        MODERATOR = "moderator", "مشرف"
        ADMIN = "admin", "مدير"

    class Status(models.TextChoices):
        ACTIVE = "active", "نشط"
        SUSPENDED = "suspended", "موقوف"
        BANNED = "banned", "محظور"

    phone = models.CharField("رقم الهاتف", max_length=20, unique=True, db_index=True)
    name = models.CharField("الاسم", max_length=80)
    whatsapp_number = models.CharField(
        "رقم واتساب", max_length=20, blank=True,
        help_text="يُترك فارغًا إن كان واتسابه على نفس رقم الحساب (plan2 §7.4)",
    )

    role = models.CharField("الدور", max_length=12, choices=Role.choices, default=Role.USER)
    status = models.CharField("الحالة", max_length=12, choices=Status.choices, default=Status.ACTIVE)
    language = models.CharField("اللغة", max_length=2, default="ar")

    phone_verified = models.BooleanField("الهاتف موثّق", default=False)
    listings_approved_count = models.PositiveIntegerField(
        "عدد الإعلانات المقبولة", default=0,
        help_text="باب الخروج من المراجعة الكاملة (plan2 §8.6)",
    )
    auto_publish = models.BooleanField(
        "النشر التلقائي", default=False, db_index=True,
        help_text="إعلانات هذا المستخدم تُنشر فورًا بلا مراجعة — يمنحه الأدمن يدويًا",
    )

    suspension_reason = models.CharField("سبب الإيقاف", max_length=200, blank=True)
    last_seen_at = models.DateTimeField("آخر ظهور", null=True, blank=True)
    created_at = models.DateTimeField("انضمّ في", default=timezone.now, db_index=True)

    objects = UserManager()

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = ["name"]

    class Meta:
        verbose_name = "مستخدم"
        verbose_name_plural = "المستخدمون"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.name} ({self.display_phone})"

    def save(self, *args, **kwargs):
        if self.phone:
            self.phone = normalize_phone(self.phone)
        if self.whatsapp_number:
            self.whatsapp_number = normalize_phone(self.whatsapp_number)
        # الدور هو مصدر الحقيقة الوحيد للصلاحيات
        self.is_superuser = self.role == self.Role.ADMIN
        super().save(*args, **kwargs)

    # ------------------------------------------------------------------ خصائص

    @property
    def is_active(self) -> bool:
        return self.status == self.Status.ACTIVE

    @property
    def is_staff(self) -> bool:
        """صلاحية دخول لوحة Django."""
        return self.role in {self.Role.MODERATOR, self.Role.ADMIN}

    @property
    def is_staff_role(self) -> bool:
        return self.is_staff

    @property
    def display_phone(self) -> str:
        return display_phone(self.phone)

    @property
    def contact_number(self) -> str:
        """رقم التواصل الفعلي: واتساب إن وُجد، وإلا رقم الحساب."""
        return self.whatsapp_number or self.phone

    def whatsapp_url(self, message: str = "") -> str:
        return whatsapp_link(self.contact_number, message)

    @property
    def initial(self) -> str:
        return (self.name or "؟").strip()[:1]

    @property
    def joined_year(self) -> int:
        return self.created_at.year

    def touch(self):
        """تحديث آخر ظهور بلا استدعاء save كامل."""
        User.objects.filter(pk=self.pk).update(last_seen_at=timezone.now())


class Device(models.Model):
    """أجهزة المستخدم لإرسال إشعارات FCM (plan2 §7)."""

    class Platform(models.TextChoices):
        ANDROID = "android", "أندرويد"
        IOS = "ios", "آيفون"
        WEB = "web", "ويب"

    user = models.ForeignKey(
        User, verbose_name="المستخدم", on_delete=models.CASCADE, related_name="devices"
    )
    token = models.CharField("رمز الجهاز", max_length=255, unique=True)
    platform = models.CharField(
        "المنصّة", max_length=10, choices=Platform.choices, default=Platform.ANDROID
    )
    app_version = models.CharField("إصدار التطبيق", max_length=16, blank=True)
    language = models.CharField("اللغة", max_length=2, default="ar")
    is_active = models.BooleanField("نشط", default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "جهاز"
        verbose_name_plural = "الأجهزة"
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return f"{self.user.name} — {self.get_platform_display()}"
