"""
طبقة تحقّق الهاتف — مجرّدة الآن، تُفعَّل لاحقًا بلا تعديل في بقية الكود.

القرار الحالي (plan2 §9 قرار 7): تسجيل بهاتف وكلمة مرور بلا تحقّق.
حين نريد التفعيل: نضيف مزوّد SMS هنا ونقلب المفتاح `phone_verification`
في لوحة الإدارة — لا شيء آخر يتغيّر.
"""

from __future__ import annotations

import secrets
from abc import ABC, abstractmethod

from django.core.cache import cache

CODE_TTL = 300  # خمس دقائق


class PhoneVerifier(ABC):
    @abstractmethod
    def send_code(self, phone: str, lang: str = "ar") -> dict: ...

    @abstractmethod
    def check_code(self, phone: str, code: str) -> bool: ...

    @property
    def enabled(self) -> bool:
        return True


class NullVerifier(PhoneVerifier):
    """الوضع الحالي: لا تحقّق — كل رقم يُقبل مباشرة."""

    def send_code(self, phone: str, lang: str = "ar") -> dict:
        return {"sent": False, "reason": "التحقّق غير مفعَّل حاليًا."}

    def check_code(self, phone: str, code: str) -> bool:
        return True

    @property
    def enabled(self) -> bool:
        return False


class CacheOtpVerifier(PhoneVerifier):
    """
    توليد وتخزين الرمز جاهزان — ينقص فقط الإرسال الفعلي عبر مزوّد SMS.
    مفيد للاختبار: الرمز يُعاد في الرد حين DEBUG.
    """

    def _key(self, phone: str) -> str:
        return f"otp:{phone}"

    def send_code(self, phone: str, lang: str = "ar") -> dict:
        code = f"{secrets.randbelow(1000000):06d}"
        cache.set(self._key(phone), code, CODE_TTL)
        self.deliver(phone, code, lang)
        return {"sent": True, "expires_in": CODE_TTL}

    def deliver(self, phone: str, code: str, lang: str) -> None:  # pragma: no cover
        """يُستبدل بمزوّد SMS حقيقي."""
        import logging

        logging.getLogger(__name__).info("رمز التحقّق لـ %s هو %s", phone, code)

    def check_code(self, phone: str, code: str) -> bool:
        stored = cache.get(self._key(phone))
        if stored and secrets.compare_digest(str(stored), str(code)):
            cache.delete(self._key(phone))
            return True
        return False


def get_verifier() -> PhoneVerifier:
    from apps.core.models import AppConfig

    if AppConfig.get_solo().feature("phone_verification"):
        return CacheOtpVerifier()
    return NullVerifier()
