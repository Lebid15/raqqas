"""
وقت نسبي بثلاث لغات: «منذ ساعتين» · «2 saat önce» · «2 hours ago».

نحسبه في الخادم لا في التطبيق: ساعة الجهاز قد تكون غير مضبوطة،
وقد رأينا هواتف تعرض «منذ 3 أيام» لإعلان نُشر قبل دقيقة.
"""

from __future__ import annotations

from django.utils import timezone

FORMS = {
    "ar": {
        "now": "الآن",
        "minute": ("منذ دقيقة", "منذ دقيقتين", "منذ {n} دقائق", "منذ {n} دقيقة"),
        "hour": ("منذ ساعة", "منذ ساعتين", "منذ {n} ساعات", "منذ {n} ساعة"),
        "day": ("أمس", "منذ يومين", "منذ {n} أيام", "منذ {n} يومًا"),
        "month": ("منذ شهر", "منذ شهرين", "منذ {n} أشهر", "منذ {n} شهرًا"),
        "year": ("منذ سنة", "منذ سنتين", "منذ {n} سنوات", "منذ {n} سنة"),
    },
    "tr": {
        "now": "şimdi",
        "minute": ("1 dakika önce", "{n} dakika önce"),
        "hour": ("1 saat önce", "{n} saat önce"),
        "day": ("dün", "{n} gün önce"),
        "month": ("1 ay önce", "{n} ay önce"),
        "year": ("1 yıl önce", "{n} yıl önce"),
    },
    "en": {
        "now": "just now",
        "minute": ("a minute ago", "{n} minutes ago"),
        "hour": ("an hour ago", "{n} hours ago"),
        "day": ("yesterday", "{n} days ago"),
        "month": ("a month ago", "{n} months ago"),
        "year": ("a year ago", "{n} years ago"),
    },
}


def _arabic(forms: tuple, n: int) -> str:
    """العربية لها مفرد ومثنّى وجمع قلّة (3–10) وجمع كثرة (11+)."""
    if n == 1:
        return forms[0]
    if n == 2:
        return forms[1]
    if 3 <= n <= 10:
        return forms[2].format(n=n)
    return forms[3].format(n=n)


def _plural(forms: tuple, n: int) -> str:
    return forms[0] if n == 1 else forms[1].format(n=n)


def time_ago(value, lang: str = "ar") -> str:
    if not value:
        return ""
    table = FORMS.get(lang, FORMS["ar"])
    seconds = (timezone.now() - value).total_seconds()

    if seconds < 60:
        return table["now"]

    units = [
        ("minute", 60, 60),
        ("hour", 3600, 24),
        ("day", 86400, 30),
        ("month", 2592000, 12),
        ("year", 31536000, None),
    ]
    for key, size, limit in units:
        count = int(seconds // size)
        if limit is None or count < limit:
            count = max(count, 1)
            forms = table[key]
            return _arabic(forms, count) if lang == "ar" else _plural(forms, count)

    return table["now"]


def format_price(amount, currency: str, lang: str = "ar") -> str:
    """
    «8,500 $» — الرقم كما كتبه البائع، والرمز من عملة إعلانه هو.

    وقّعناها بعملة صريحة بدل قراءتها من الإعدادات: لكل إعلان عملته الآن،
    وقراءة عملة عامّة هنا كانت ستطبع رمزًا لا يخصّ هذا السعر.
    """
    from . import money

    return money.format_amount(amount, currency, lang)
