"""
نشر حزمة تحديث عن بُعد.

    python manage.py publish_update --source /srv/souq/app/dist --runtime 1 \
        --platform android --notes "إصلاح شاشة البحث"

يتحقّق من سلامة الحزمة قبل التفعيل — حزمة ناقصة تعني تطبيقًا لا يفتح لدى
كل من نزّلها، ولا سبيل للتراجع إلا بحزمة أخرى.
"""

import json
import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.core.updates import EXPO_CLIENT_FILE, OtaUpdate, build_manifest


class Command(BaseCommand):
    help = "نشر حزمة تحديث عن بُعد من مخرجات expo export"

    def add_arguments(self, parser):
        parser.add_argument("--source", required=True, help="مجلد dist الناتج عن expo export")
        parser.add_argument("--runtime", required=True, help="نسخة الطبقة الأصلية، مثل 1")
        parser.add_argument("--platform", default="android", choices=["android", "ios"])
        parser.add_argument("--notes", default="", help="ملاحظة تظهر في سجلّ التحديثات")
        parser.add_argument("--no-activate", action="store_true", help="ارفعها بلا تفعيل")
        parser.add_argument(
            "--app-json", default="",
            help="مسار app.json — يُحفظ مع الحزمة ليعرف التطبيق إصداره بعد التحديث",
        )

    def handle(self, *args, **options):
        source = Path(options["source"]).resolve()
        runtime = options["runtime"]
        platform = options["platform"]

        # ---------------------------------------------------------- التحقّق
        metadata_file = source / "metadata.json"
        if not metadata_file.exists():
            raise CommandError(f"لا يوجد metadata.json في {source} — هل صدّرت الحزمة؟")

        metadata = json.loads(metadata_file.read_text(encoding="utf-8"))
        platform_data = (metadata.get("fileMetadata") or {}).get(platform)
        if not platform_data:
            raise CommandError(f"الحزمة لا تحوي منصّة {platform}")

        bundle = source / platform_data["bundle"]
        if not bundle.exists():
            raise CommandError(f"ملف الحزمة مفقود: {bundle}")

        missing = [
            asset["path"] for asset in platform_data.get("assets", [])
            if not (source / asset["path"]).exists()
        ]
        if missing:
            raise CommandError(f"{len(missing)} ملف أصول مفقود، أوّلها: {missing[0]}")

        self.stdout.write(
            f"✓ الحزمة سليمة — {len(platform_data.get('assets', []))} أصلًا "
            f"+ حزمة بحجم {bundle.stat().st_size // 1024} كيلوبايت"
        )

        # ---------------------------------------------------------- النسخ
        update = OtaUpdate(runtime_version=runtime, platform=platform, notes=options["notes"])
        target = Path(settings.MEDIA_ROOT).parent / "updates" / runtime / str(update.update_id)
        target.mkdir(parents=True, exist_ok=True)

        shutil.copytree(source, target, dirs_exist_ok=True)
        update.directory = str(target)
        update.save()

        # ---------------------------------------------------------- إعدادات التطبيق
        # الجهاز الذي يشغّل حزمة تحديث يقرأ إصدارَه من البيان لا من الملف المثبَّت.
        # نحفظ نسخة app.json مع الحزمة لتُرسَل في `extra.expoClient` — وبلا هذا
        # يجهل التطبيق إصداره ويطالب بتحديث لا ينتهي.
        expo_client = self._read_app_config(options["app_json"], source)
        if expo_client:
            (target / EXPO_CLIENT_FILE).write_text(
                json.dumps(expo_client, ensure_ascii=False), encoding="utf-8"
            )
            self.stdout.write(f"✓ إعدادات التطبيق محفوظة — إصدار {expo_client.get('version', '?')}")
        else:
            self.stdout.write(self.style.WARNING(
                "⚠️ لم أجد app.json — سيجهل التطبيق إصداره بعد هذا التحديث."
            ))

        # ---------------------------------------------------------- فحص البيان
        try:
            manifest = build_manifest(update, "https://example.invalid")
        except Exception as error:
            shutil.rmtree(target, ignore_errors=True)
            update.delete()
            raise CommandError(f"تعذّر بناء البيان: {error}")

        self.stdout.write(f"✓ البيان صالح — {len(manifest['assets'])} أصلًا")

        if not options["no_activate"]:
            update.activate()
            self.stdout.write(self.style.SUCCESS(f"✅ نُشرت وفُعّلت: {update.update_id}"))
            self.stdout.write("   ستصل المستخدمين عند فتح التطبيق التالي.")
        else:
            self.stdout.write(f"رُفعت بلا تفعيل: {update.update_id}")

        # ---------------------------------------------------------- تنظيف
        # نبقي آخر خمس حزم فقط: القرص 40 جيجا وكل حزمة ~5 ميغا،
        # وخمس حزم تكفي للتراجع خطوات عدّة إلى الوراء.
        old = OtaUpdate.objects.filter(
            runtime_version=runtime, platform=platform, is_active=False
        ).order_by("-created_at")[5:]
        for item in old:
            shutil.rmtree(item.path, ignore_errors=True)
            item.delete()

    # ------------------------------------------------------------------

    @staticmethod
    def _read_app_config(explicit: str, source: Path) -> dict:
        """يقرأ قسم `expo` من app.json — من المسار المعطى أو من جوار مجلد dist."""
        candidates = [Path(explicit)] if explicit else []
        candidates += [source.parent / "app.json", source / "app.json"]
        for candidate in candidates:
            if not candidate.is_file():
                continue
            try:
                data = json.loads(candidate.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue
            return data.get("expo") or data
        return {}
