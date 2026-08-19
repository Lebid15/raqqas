"""الإشعارات — تُخزَّن في قاعدة البيانات دائمًا، وتُرسَل عبر FCM إن أمكن."""

from django.db import models


class Notification(models.Model):
    class Kind(models.TextChoices):
        LISTING_PUBLISHED = "listing_published", "نُشر إعلانك"
        LISTING_REJECTED = "listing_rejected", "رُفض إعلانك"
        LISTING_EXPIRING = "listing_expiring", "إعلانك يوشك على الانتهاء"
        LISTING_EXPIRED = "listing_expired", "انتهى إعلانك"
        NEW_PENDING = "new_pending", "إعلان جديد بانتظار المراجعة"
        ACCOUNT = "account", "تنبيه حساب"
        SYSTEM = "system", "رسالة من الإدارة"

    user = models.ForeignKey(
        "accounts.User", verbose_name="المستخدم",
        on_delete=models.CASCADE, related_name="notifications",
    )
    kind = models.CharField("النوع", max_length=24, choices=Kind.choices, db_index=True)

    # النصّ مخزّن بثلاث لغات لأن المستخدم قد يبدّل لغته بعد وصول الإشعار
    title_ar = models.CharField(max_length=140)
    title_tr = models.CharField(max_length=140, blank=True)
    title_en = models.CharField(max_length=140, blank=True)
    body_ar = models.TextField(blank=True)
    body_tr = models.TextField(blank=True)
    body_en = models.TextField(blank=True)

    listing = models.ForeignKey(
        "listings.Listing", null=True, blank=True,
        on_delete=models.CASCADE, related_name="notifications",
    )
    data = models.JSONField("بيانات إضافية", default=dict, blank=True)

    is_read = models.BooleanField("مقروء", default=False, db_index=True)
    pushed_at = models.DateTimeField("أُرسل عبر FCM في", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "إشعار"
        verbose_name_plural = "الإشعارات"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "is_read", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.title_ar} → {self.user_id}"

    def title_for(self, lang: str) -> str:
        return getattr(self, f"title_{lang}", "") or self.title_ar

    def body_for(self, lang: str) -> str:
        return getattr(self, f"body_{lang}", "") or self.body_ar
