"""
حذف الحساب — متطلّب إلزامي في Google Play.

سياسة «حذف بيانات المستخدم» تشترط شيئين معًا على كل تطبيق يسمح بإنشاء حساب:

  ① مسار **داخل التطبيق** يحذف الحساب.
  ② رابط **ويب عامّ** يصل إليه من لا يملك التطبيق (صفحة /delete-account).

وكلاهما يجب أن يحذف الحساب فعلًا لا أن «يعطّله». هذا الملفّ هو التنفيذ
الوحيد للحذف، ويستدعيه المساران معًا فلا يفترقان أبدًا.

ما الذي يُحذف؟ كل شيء:
  · الحساب نفسه (الاسم، الرقم، رقم واتساب، كلمة المرور)
  · إعلاناته وصورها — من قاعدة البيانات ومن القرص
  · مفضّلاته، أجهزته، بلاغاته، حظره
ما الذي يبقى؟ سطر واحد مجهول الهوية في DeletedAccount لا يمكن ردّه إلى شخص.
"""

from __future__ import annotations

import logging

from django.db import transaction

logger = logging.getLogger(__name__)


def _remove_files(user) -> int:
    """
    حذف ملفات الصور من القرص قبل حذف السجلّات.

    CASCADE في قاعدة البيانات يمحو الصفوف ولا يلمس الملفات — ولو اكتفينا به
    لبقيت صور المستخدم على الخادم بعد «حذف» حسابه، وهذا نقض للسياسة وللوعد.
    """
    from apps.listings.models import ListingMedia

    removed = 0
    media = ListingMedia.objects.filter(listing__user=user).only("id", "image", "thumb")
    for item in media.iterator():
        for field in (item.image, item.thumb):
            if not field:
                continue
            try:
                field.storage.delete(field.name)
                removed += 1
            except Exception:  # pragma: no cover - القرص ليس مصدر الحقيقة
                logger.warning("تعذّر حذف الملف %s", field.name, exc_info=True)
    return removed


@transaction.atomic
def delete_user_account(user, reason: str = "user_request") -> dict:
    """يحذف الحساب حذفًا تامًّا ويعيد ملخّصًا لِما حُذف."""
    from apps.core.models import AdminLog

    from .models import DeletedAccount

    listings_count = user.listings.count()
    files_removed = _remove_files(user)
    phone_hash = DeletedAccount.hash_phone(user.phone)
    user_id = user.pk

    DeletedAccount.objects.create(
        phone_hash=phone_hash,
        reason=reason,
        listings_removed=listings_count,
    )
    # سجلّ إداري بلا أي بيانات شخصية — للإحصاء وحلّ النزاعات فقط
    AdminLog.objects.create(
        actor=None,
        action="account_deleted",
        target_type="user",
        target_id=user_id,
        note="حذف حساب بطلب صاحبه" if reason == "user_request" else reason,
        meta={"listings_removed": listings_count, "files_removed": files_removed},
    )

    user.delete()

    return {
        "deleted": True,
        "user_id": user_id,
        "listings_removed": listings_count,
        "files_removed": files_removed,
    }
