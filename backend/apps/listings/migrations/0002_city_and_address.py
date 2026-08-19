"""
الانتقال من «الحي» إلى «المحافظة + عنوان يكتبه المستخدم».

الأحياء كانت قائمة مغلقة لمدينة واحدة. المحافظات تغطّي سوريا كلها، والعنوان
التفصيلي يكتبه صاحب الإعلان بلغته — فلا نحتاج جدولًا جديدًا كلّما توسّعنا.

الإعلانات القائمة لا تفقد شيئًا: محافظتها تُشتقّ من مدينة حيّها، واسم الحي
يُنقل نصًّا إلى `address` — فتبقى مقروءة كما كتبها أصحابها.
"""

from django.db import migrations, models
import django.db.models.deletion


def carry_location_forward(apps, schema_editor):
    Listing = apps.get_model("listings", "Listing")
    rows = Listing.objects.filter(neighborhood__isnull=False).select_related(
        "neighborhood", "neighborhood__city"
    )
    for listing in rows.iterator():
        listing.city_id = listing.neighborhood.city_id
        if not listing.address:
            listing.address = listing.neighborhood.name_ar
        listing.save(update_fields=["city", "address"])


def restore_neighborhood_only(apps, schema_editor):
    """التراجع لا يفقد بيانات: الحي ما يزال مرتبطًا، ونكتفي بإفراغ ما أضفناه."""
    Listing = apps.get_model("listings", "Listing")
    Listing.objects.update(address="")


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0001_initial"),
        ("listings", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="listing",
            name="address",
            field=models.CharField(
                blank=True,
                help_text="يكتبه صاحب الإعلان بحرّية — لا قائمة ثابتة",
                max_length=200,
                verbose_name="العنوان",
            ),
        ),
        migrations.AddField(
            model_name="listing",
            name="city",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="listings",
                to="catalog.city",
                verbose_name="المحافظة",
            ),
        ),
        migrations.AlterField(
            model_name="listing",
            name="neighborhood",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="listings",
                to="catalog.neighborhood",
                verbose_name="الحي (متروك)",
            ),
        ),
        migrations.RunPython(carry_location_forward, restore_neighborhood_only),
        # بعد النقل لم يبقَ إعلان بلا محافظة — فنغلق الباب على الفراغ
        migrations.AlterField(
            model_name="listing",
            name="city",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="listings",
                to="catalog.city",
                verbose_name="المحافظة",
            ),
        ),
        migrations.RemoveIndex(model_name="listing", name="listings_li_neighbo_8b3825_idx"),
        migrations.AddIndex(
            model_name="listing",
            index=models.Index(fields=["city", "status"], name="listings_li_city_id_ac3561_idx"),
        ),
    ]
