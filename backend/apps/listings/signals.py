"""
إشعار الإدارة فور وصول إعلان جديد للمراجعة (plan2 §8.6).

سبب استعمال إشارة بدل استدعاء مباشر في الـ view: الإعلان قد يُنشأ من
لوحة Django أو من أمر إداري أيضًا — ونريد التنبيه في كل الحالات.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Listing


@receiver(post_save, sender=Listing, dispatch_uid="notify_admins_on_pending_listing")
def on_listing_created(sender, instance: Listing, created: bool, **kwargs):
    if not created or instance.status != Listing.Status.PENDING:
        return
    from apps.notifications.services import notify_admins_new_listing

    notify_admins_new_listing(instance)
