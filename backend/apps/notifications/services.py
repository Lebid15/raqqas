"""
إنشاء الإشعارات وإرسالها.

الدفع (FCM) اختياري: إن لم يُضبط المفتاح، يبقى الإشعار في قاعدة البيانات
ويظهر داخل التطبيق. لا شيء ينكسر بلا FCM — وهذا مقصود، لأن الخادم قد
يُشغَّل قبل ضبط Firebase.
"""

from __future__ import annotations

import logging

from django.conf import settings
from django.utils import timezone

from .models import Notification

logger = logging.getLogger(__name__)


def create(user, kind: str, texts: dict, *, listing=None, **data) -> Notification:
    """texts = {"ar": (title, body), "tr": (...), "en": (...)}"""
    notification = Notification.objects.create(
        user=user,
        kind=kind,
        listing=listing,
        title_ar=texts["ar"][0], body_ar=texts["ar"][1],
        title_tr=texts.get("tr", ("", ""))[0], body_tr=texts.get("tr", ("", ""))[1],
        title_en=texts.get("en", ("", ""))[0], body_en=texts.get("en", ("", ""))[1],
        data=data,
    )
    push(notification)
    return notification


def push(notification: Notification) -> bool:
    """يرسل عبر FCM لأجهزة المستخدم النشطة. يعيد False إن لم يُرسل."""
    if not settings.FCM_SERVER_KEY:
        return False

    tokens = list(
        notification.user.devices.filter(is_active=True).values_list("token", flat=True)
    )
    if not tokens:
        return False

    lang = notification.user.language or "ar"
    payload = {
        "title": notification.title_for(lang),
        "body": notification.body_for(lang),
        "data": {
            "kind": notification.kind,
            "listing_id": str(notification.listing_id or ""),
            **{k: str(v) for k, v in (notification.data or {}).items()},
        },
    }

    try:
        _send_fcm(tokens, payload)
    except Exception:
        logger.exception("تعذّر إرسال إشعار FCM")
        return False

    notification.pushed_at = timezone.now()
    notification.save(update_fields=["pushed_at"])
    return True


def _send_fcm(tokens: list[str], payload: dict) -> None:
    """
    نقطة الوصل مع Firebase.

    مفصولة عمدًا: عند إضافة firebase-admin لاحقًا نبدّل هذه الدالة وحدها،
    ولا نلمس أي مكان آخر في المشروع.
    """
    logger.info("FCM (غير مفعَّل بعد) → %d جهاز · %s", len(tokens), payload["title"])


# ---------------------------------------------------------------- إشعارات جاهزة

def notify_listing_published(listing) -> Notification:
    return create(
        listing.user,
        Notification.Kind.LISTING_PUBLISHED,
        {
            "ar": ("تم نشر إعلانك ✅", f"إعلانك «{listing.title}» ظاهر الآن للجميع."),
            "tr": ("İlanınız yayında ✅", f"«{listing.title}» ilanınız artık görünür."),
            "en": ("Your listing is live ✅", f"“{listing.title}” is now visible to everyone."),
        },
        listing=listing,
    )


def notify_listing_rejected(listing, reason: str) -> Notification:
    return create(
        listing.user,
        Notification.Kind.LISTING_REJECTED,
        {
            "ar": ("إعلانك يحتاج تعديلًا", f"«{listing.title}»: {reason}"),
            "tr": ("İlanınız düzeltme gerektiriyor", f"«{listing.title}»: {reason}"),
            "en": ("Your listing needs changes", f"“{listing.title}”: {reason}"),
        },
        listing=listing,
        reason=reason,
    )


def notify_listing_expiring(listing, days: int) -> Notification:
    return create(
        listing.user,
        Notification.Kind.LISTING_EXPIRING,
        {
            "ar": ("إعلانك يوشك على الانتهاء ⏳",
                   f"«{listing.title}» ينتهي خلال {days} أيام. جدّده ليبقى ظاهرًا."),
            "tr": ("İlanınızın süresi doluyor ⏳",
                   f"«{listing.title}» {days} gün içinde sona eriyor."),
            "en": ("Your listing is expiring ⏳",
                   f"“{listing.title}” expires in {days} days. Renew to keep it visible."),
        },
        listing=listing,
        days=days,
    )


def notify_admins_new_listing(listing) -> None:
    """إشعار فوري للإدارة عند وصول إعلان جديد (plan2 §8.6)."""
    from apps.accounts.models import User

    staff = User.objects.filter(role__in=[User.Role.ADMIN, User.Role.MODERATOR])
    for member in staff:
        create(
            member,
            Notification.Kind.NEW_PENDING,
            {
                "ar": ("إعلان جديد بانتظار المراجعة 🔔",
                       f"«{listing.title}» من {listing.user.name}"),
                "tr": ("Yeni ilan onay bekliyor 🔔", f"«{listing.title}»"),
                "en": ("New listing awaiting review 🔔", f"“{listing.title}”"),
            },
            listing=listing,
        )
