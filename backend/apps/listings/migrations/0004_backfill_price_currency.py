"""
حفظ عملة الإعلانات المنشورة قبل أن يُحذف حقل «عملة المتجر» من الإعدادات.

قبل هذا التغيير كان السعر رقمًا بلا عملة، ومعناه يُقرأ من `AppConfig.currency_code`
العامّ. وبعده صارت لكل إعلان عملته. الإعلانات الموجودة كُتبت بعملة المتجر
القديمة — فننسخها إليها هنا **قبل** أن يزول مصدرها في core.0006.

لو تخطّينا هذه الخطوة لصار إعلانٌ سعره 4,500,000 ل.س يُقرأ 4,500,000 $.
"""

from django.db import migrations

DEFAULT_OLD_CURRENCY = "SYP"  # القيمة الافتراضية للحقل المحذوف


def backfill(apps, schema_editor):
    Listing = apps.get_model("listings", "Listing")
    connection = schema_editor.connection

    old_currency = DEFAULT_OLD_CURRENCY
    with connection.cursor() as cursor:
        columns = {c.name for c in connection.introspection.get_table_description(
            cursor, "core_appconfig"
        )}
        if "currency_code" in columns:
            cursor.execute("SELECT currency_code FROM core_appconfig WHERE id = 1")
            row = cursor.fetchone()
            if row and row[0]:
                old_currency = row[0]

    # العملات المعروفة فقط — قيمة قديمة غريبة لا تُكتب في عمود له خيارات
    if old_currency not in {"USD", "SYP", "TRY", "EUR"}:
        old_currency = DEFAULT_OLD_CURRENCY

    Listing.objects.update(price_currency=old_currency)


def noop(apps, schema_editor):
    """الرجوع لا يحتاج عملًا: العمود نفسه يُحذف في الترحيل السابق."""


class Migration(migrations.Migration):
    dependencies = [
        ("listings", "0003_listing_price_currency"),
        ("core", "0005_appconfig_store_url_alter_adminlog_action"),
    ]

    operations = [migrations.RunPython(backfill, noop)]
