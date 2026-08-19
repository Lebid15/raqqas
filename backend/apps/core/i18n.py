"""
تحديد لغة الطلب.

الترتيب: ?lang=  →  ترويسة X-Language  →  Accept-Language  →  الافتراضية من الإعدادات.
سبب وجود `?lang=`: يسهّل الاختبار ولوحة الإدارة، وبعض بوابات الإنترنت في المنطقة
تحذف الترويسات غير المعتادة.
"""

from django.conf import settings

SUPPORTED = tuple(settings.SUPPORTED_LANGUAGES)
RTL_LANGUAGES = {"ar"}


def normalize(value: str | None) -> str | None:
    if not value:
        return None
    code = value.strip().lower().replace("_", "-").split("-")[0]
    return code if code in SUPPORTED else None


def from_accept_header(header: str | None) -> str | None:
    """يقرأ Accept-Language مرتّبًا حسب q."""
    if not header:
        return None
    candidates: list[tuple[float, str]] = []
    for index, part in enumerate(header.split(",")):
        bits = part.split(";")
        code = normalize(bits[0])
        if not code:
            continue
        quality = 1.0
        for bit in bits[1:]:
            bit = bit.strip()
            if bit.startswith("q="):
                try:
                    quality = float(bit[2:])
                except ValueError:
                    quality = 0.0
        # الترتيب الأصلي يكسر التعادل
        candidates.append((quality - index * 1e-6, code))
    if not candidates:
        return None
    return max(candidates)[1]


def resolve(request) -> str:
    from .models import AppConfig

    code = (
        normalize(request.GET.get("lang"))
        or normalize(request.headers.get("X-Language"))
        or from_accept_header(request.headers.get("Accept-Language"))
    )
    if code:
        return code
    try:
        return AppConfig.get_solo().default_language or settings.DEFAULT_LANGUAGE
    except Exception:
        # قبل تشغيل الترحيلات أو عند تعذّر قاعدة البيانات
        return settings.DEFAULT_LANGUAGE


def is_rtl(code: str) -> bool:
    return code in RTL_LANGUAGES
