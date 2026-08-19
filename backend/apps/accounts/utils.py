"""
تطبيع أرقام الهواتف.

الناس يكتبون الرقم بصيغ كثيرة: 0994123456 · 994 123 456 · +963994123456 · 00963...
نخزّن صيغة واحدة (E.164) وإلا صار للمستخدم الواحد عدة حسابات بلا أن يدري.
"""

from __future__ import annotations

import re

from django.core.exceptions import ValidationError

# سوريا افتراضًا، وتركيا مدعومة لأن كثيرًا من أهل الرقة هناك
COUNTRY_CODES = {
    "SY": {"dial": "963", "national_len": 9, "mobile_prefix": "9"},
    "TR": {"dial": "90", "national_len": 10, "mobile_prefix": "5"},
}
DEFAULT_COUNTRY = "SY"

_DIGITS = re.compile(r"[^\d+]")
_ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")


def _validate_national(national: str, info: dict) -> bool:
    return len(national) == info["national_len"] and national.startswith(info["mobile_prefix"])


def normalize_phone(raw: str, country: str = DEFAULT_COUNTRY) -> str:
    """يعيد الرقم بصيغة +963XXXXXXXXX أو يرفع ValidationError."""
    if not raw:
        raise ValidationError("رقم الهاتف مطلوب.")

    value = _DIGITS.sub("", str(raw).translate(_ARABIC_DIGITS).strip())
    if value.startswith("00"):
        value = "+" + value[2:]

    # ------------------------------------------------ صيغة دولية صريحة
    if value.startswith("+"):
        digits = value[1:]
        for info in COUNTRY_CODES.values():
            if digits.startswith(info["dial"]):
                national = digits[len(info["dial"]):]
                if not _validate_national(national, info):
                    raise ValidationError(
                        "رقم الهاتف غير صحيح — تحقّق من عدد الخانات أو أنه رقم موبايل."
                    )
                return "+" + digits
        raise ValidationError(
            "رمز الدولة غير مدعوم. المدعوم حاليًا: سوريا (+963) وتركيا (+90)."
        )

    # ------------------------------------------------ صيغة محلية (0994… / 0555…)
    # لا نفترض الدولة: طول الرقم وبادئته يحدّدانها بلا لبس
    # (سوريا 9 خانات تبدأ بـ 9 · تركيا 10 خانات تبدأ بـ 5)
    national = value.lstrip("0")
    preferred = [country] + [c for c in COUNTRY_CODES if c != country]
    for code in preferred:
        info = COUNTRY_CODES[code]
        if _validate_national(national, info):
            return "+" + info["dial"] + national

    raise ValidationError("رقم الهاتف غير صحيح — تحقّق من عدد الخانات أو أنه رقم موبايل.")


def display_phone(e164: str) -> str:
    """0994 123 456 — الصيغة التي يعرفها الناس (تظهر في التطبيق ولوحة الإدارة)."""
    if not e164:
        return ""
    digits = e164.lstrip("+")
    for info in COUNTRY_CODES.values():
        if digits.startswith(info["dial"]):
            national = "0" + digits[len(info["dial"]):]
            return " ".join([national[:4], national[4:7], national[7:]]).strip()
    return e164


def whatsapp_link(e164: str, message: str = "") -> str:
    """رابط wa.me — بلا + وبلا فراغات، وإلا لم يفتح على بعض الأجهزة."""
    from urllib.parse import quote

    number = (e164 or "").lstrip("+")
    if not number:
        return ""
    base = f"https://wa.me/{number}"
    return f"{base}?text={quote(message)}" if message else base
