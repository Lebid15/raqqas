"""
العملات والتحويل بينها.

القاعدة التي يقوم عليها الملف كلّه: **السعر يُحفظ بالعملة التي كتبها البائع،
ولا يُحوَّل عند الحفظ أبدًا.** التحويل عرضٌ لا تخزين.

لماذا؟ لأن سعر الصرف يتحرّك والإعلان يبقى. لو خزّنّا كل شيء بالدولار لكان
بائعٌ كتب «٥٠٠٠٠٠٠ ل.س» يجد رقمه يتبدّل كلما عدّل الأدمن السعر — والمشتري
يظنّ أنه رفع سعره. الرقم الذي كتبه البائع ملكه، ولا يلمسه أحد.

الدولار هنا **محور تحويل** لا وعاء تخزين: الأدمن يكتب «١ دولار = كم» لكل
عملة، ومنه نشتقّ أي تحويل بين أي عملتين.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

# ------------------------------------------------------------------ الكتالوج

#: محور التحويل — كل الأسعار في جدول `rates` معبَّر عنها كـ «1 دولار = كم».
BASE_CURRENCY = "USD"

#: العملات الأربع. الترتيب هنا هو ترتيب ظهورها في التطبيق واللوحة.
#:
#: `decimals = 0` للجميع عن قصد: أسعار السوق أرقام صحيحة، و«8,500.00 $»
#: ضجيج بصري بلا معلومة. و`position` غير موجود لأن الرمز يأتي **بعد** الرقم
#: دائمًا في اللغات الثلاث — هكذا يكتبها الناس هنا، وهكذا تُرسم صحيحة في
#: النص من اليمين ومن اليسار معًا.
CURRENCIES: list[dict] = [
    {
        "code": "USD",
        "symbol_ar": "$", "symbol_tr": "$", "symbol_en": "$",
        "name_ar": "دولار أمريكي", "name_tr": "Amerikan doları", "name_en": "US dollar",
        "decimals": 0,
    },
    {
        "code": "SYP",
        "symbol_ar": "ل.س", "symbol_tr": "SYP", "symbol_en": "SYP",
        "name_ar": "ليرة سورية", "name_tr": "Suriye lirası", "name_en": "Syrian pound",
        "decimals": 0,
    },
    {
        "code": "TRY",
        "symbol_ar": "ل.ت", "symbol_tr": "₺", "symbol_en": "₺",
        "name_ar": "ليرة تركية", "name_tr": "Türk lirası", "name_en": "Turkish lira",
        "decimals": 0,
    },
    {
        "code": "EUR",
        "symbol_ar": "€", "symbol_tr": "€", "symbol_en": "€",
        "name_ar": "يورو", "name_tr": "Euro", "name_en": "Euro",
        "decimals": 0,
    },
]

CURRENCY_CODES = [c["code"] for c in CURRENCIES]
CURRENCY_CHOICES = [(c["code"], c["name_ar"]) for c in CURRENCIES]
BY_CODE = {c["code"]: c for c in CURRENCIES}

#: العملات التي يحتاج الأدمن أن يضع لها سعر صرف (كل شيء عدا المحور نفسه).
RATE_CODES = [code for code in CURRENCY_CODES if code != BASE_CURRENCY]


def catalogue(lang: str = "ar") -> list[dict]:
    """الكتالوج كما يستهلكه التطبيق واللوحة."""
    return [
        {
            "code": c["code"],
            "symbol": c.get(f"symbol_{lang}") or c["symbol_ar"],
            "symbols": {"ar": c["symbol_ar"], "tr": c["symbol_tr"], "en": c["symbol_en"]},
            "name": c.get(f"name_{lang}") or c["name_ar"],
            "names": {"ar": c["name_ar"], "tr": c["name_tr"], "en": c["name_en"]},
            "decimals": c["decimals"],
        }
        for c in CURRENCIES
    ]


def symbol_for(code: str, lang: str = "ar") -> str:
    entry = BY_CODE.get(code)
    if not entry:
        return code
    return entry.get(f"symbol_{lang}") or entry["symbol_ar"]


def is_valid(code: str) -> bool:
    return code in BY_CODE


# ------------------------------------------------------------------ الأسعار


def clean_rates(raw) -> dict[str, float]:
    """
    ينظّف جدول أسعار الصرف الآتي من اللوحة.

    نطرح كل ما ليس رقمًا موجبًا، وكل عملة خارج الكتالوج. سعر صفر أو سالب ليس
    «سعرًا سيئًا» بل قسمة على صفر وسعر بالسالب على شاشة المستخدم.
    """
    if not isinstance(raw, dict):
        return {}
    cleaned: dict[str, float] = {}
    for code, value in raw.items():
        if code not in BY_CODE or code == BASE_CURRENCY:
            continue
        try:
            number = Decimal(str(value))
        except (InvalidOperation, TypeError, ValueError):
            continue
        if number > 0:
            cleaned[code] = float(number)
    return cleaned


def full_rates(rates: dict | None) -> dict[str, float]:
    """جدول الأسعار مع المحور نفسه — `1 USD = 1 USD` ليست بيانات يدخلها أحد."""
    return {BASE_CURRENCY: 1.0, **clean_rates(rates or {})}


def convert(amount, source: str, target: str, rates: dict | None) -> Decimal | None:
    """
    يحوّل مبلغًا من عملة إلى عملة عبر محور الدولار.

    يعيد `None` — لا صفرًا ولا المبلغ كما هو — حين يتعذّر التحويل (سعر ناقص
    أو عملة مجهولة). الصفر رقمٌ يقرأه المستخدم على أنه سعر، و«لا نعرف» يجب
    أن يظهر بوصفه لا نعرف.
    """
    if amount is None or source == target:
        return None if amount is None else Decimal(str(amount))
    table = full_rates(rates)
    if source not in table or target not in table:
        return None
    try:
        in_base = Decimal(str(amount)) / Decimal(str(table[source]))
        return in_base * Decimal(str(table[target]))
    except (InvalidOperation, ZeroDivisionError, TypeError, ValueError):
        return None


def round_approx(value: Decimal, digits: int = 3) -> Decimal:
    """
    يقرّب المبلغ المحوَّل إلى أرقام معنوية قليلة.

    «≈ 4,512,347 ل.س» يوحي بدقّة لا نملكها — السعر مأخوذ من جدول يدوي قد
    يكون عمره أيام. «≈ 4,510,000» يقول الحقيقة: تقدير لا رقم.
    """
    if value is None or value == 0:
        return Decimal(0)
    from decimal import ROUND_HALF_UP

    shift = value.copy_abs().adjusted() + 1 - digits
    if shift <= 0:
        return value.quantize(Decimal(1), rounding=ROUND_HALF_UP)
    step = Decimal(10) ** shift
    return (value / step).quantize(Decimal(1), rounding=ROUND_HALF_UP) * step


# ------------------------------------------------------------------ العرض

NEGOTIABLE = {"ar": "على السوم", "tr": "Pazarlıklı", "en": "Negotiable"}


def format_amount(amount, code: str, lang: str = "ar") -> str:
    """«8,500 $» — الأرقام لاتينية في كل اللغات (plan2 §5)، والرمز بعدها."""
    if amount is None:
        return NEGOTIABLE.get(lang, NEGOTIABLE["ar"])
    decimals = BY_CODE.get(code, {}).get("decimals", 0)
    number = f"{Decimal(str(amount)):,.{decimals}f}"
    symbol = symbol_for(code, lang)
    return f"{number} {symbol}" if symbol else number


def format_converted(amount, source: str, target: str, rates, lang: str = "ar") -> str | None:
    """نصّ التحويل التقريبي — أو `None` إن تعذّر، فلا يُعرض شيء."""
    if amount is None or source == target:
        return None
    value = convert(amount, source, target, rates)
    if value is None:
        return None
    return "≈ " + format_amount(round_approx(value), target, lang)
