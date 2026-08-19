"""
فحص تباين الألوان (WCAG 2.1).

سبب وجوده (plan2 §4.3): الأدمن يغيّر لونًا واحدًا فيصير التطبيق غير مقروء
لكل الناس دفعة واحدة. اللوحة تُحذّر قبل الحفظ، لا بعده.
"""

from __future__ import annotations

from . import defaults

AA_TEXT = 4.5      # نص عادي
AA_LARGE = 3.0     # نص كبير أو عناصر واجهة


def _to_rgb(color: str) -> tuple[int, int, int]:
    value = color.lstrip("#")
    if len(value) == 3:
        value = "".join(c * 2 for c in value)
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def relative_luminance(color: str) -> float:
    channels = []
    for raw in _to_rgb(color):
        c = raw / 255
        channels.append(c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4)
    r, g, b = channels
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(foreground: str, background: str) -> float:
    a, b = relative_luminance(foreground), relative_luminance(background)
    lighter, darker = max(a, b), min(a, b)
    return round((lighter + 0.05) / (darker + 0.05), 2)


# أزواج (نص، خلفية) الحرجة فعليًا في التصميم — مأخوذة من style.css
CRITICAL_PAIRS = [
    ("ink", "bg", AA_TEXT, "النص الأساسي على خلفية الصفحة"),
    ("ink", "surface", AA_TEXT, "النص الأساسي على البطاقات"),
    ("ink2", "surface", AA_TEXT, "النص الثانوي على البطاقات"),
    ("ink3", "surface", AA_LARGE, "النص الخافت على البطاقات"),
    ("brandText", "surface", AA_TEXT, "السعر ولون العلامة على البطاقات"),
    ("brandText", "bg", AA_TEXT, "لون العلامة على خلفية الصفحة"),
    ("brandText", "brand50", AA_TEXT, "الأزرار الخفيفة وأيقونات القائمة"),
    ("onBrand", "brand", AA_TEXT, "نص الترويسة والأزرار فوق لون العلامة"),
    ("onGold", "gold", AA_TEXT, "شارة «مميز»"),
    ("danger", "surface", AA_LARGE, "لون الخطر"),
    ("success", "surface", AA_LARGE, "لون النجاح"),
]


def audit(theme: dict, mode: str = "light") -> list[dict]:
    """يعيد قائمة تحذيرات — فارغة تعني أن السمة سليمة."""
    base = defaults.DEFAULT_THEME_LIGHT if mode == "light" else defaults.DEFAULT_THEME_DARK
    colors = {**base, **(theme or {})}

    warnings: list[dict] = []
    for fg_key, bg_key, minimum, label in CRITICAL_PAIRS:
        fg, bg = colors.get(fg_key), colors.get(bg_key)
        if not fg or not bg:
            continue
        try:
            value = ratio(fg, bg)
        except (ValueError, IndexError):
            warnings.append({
                "mode": mode, "foreground": fg_key, "background": bg_key,
                "label": label, "level": "error", "message": "قيمة لون غير صالحة.",
            })
            continue
        if value < minimum:
            warnings.append({
                "mode": mode,
                "foreground": fg_key,
                "background": bg_key,
                "label": label,
                "ratio": value,
                "required": minimum,
                "level": "error" if value < minimum - 1 else "warning",
                "message": f"التباين {value}:1 وهو أقل من المطلوب {minimum}:1 — {label}.",
            })
    return warnings


def audit_both(theme_light: dict, theme_dark: dict) -> list[dict]:
    return audit(theme_light, "light") + audit(theme_dark, "dark")
