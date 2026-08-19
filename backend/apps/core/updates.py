"""
خادم التحديث عن بُعد (OTA) — بروتوكول Expo Updates، مستضاف عندنا.

الفكرة (plan2 §7.2): تعديل في شاشات التطبيق أو نصوصه أو منطقه يصل للناس عند
فتح التطبيق التالي، **بلا أن يعيدوا تنزيل ملف APK**. ولا يبقى ملف جديد لازمًا
إلا حين تتغيّر الطبقة الأصلية (مكتبة جديدة · إذن جهاز جديد · أيقونة).

كيف يعمل:
    التطبيق عند الإقلاع  →  GET /api/v1/updates/manifest
                             مع ترويسات: المنصّة · runtimeVersion · رقم نسخته الحالية
    الخادم               →  بيان (manifest) بأحدث حزمة لهذه الـ runtimeVersion
    التطبيق              →  ينزّلها في الخلفية ويطبّقها عند الفتح التالي

لماذا «عند الفتح التالي» لا فورًا؟ لأن `fallbackToCacheTimeout: 0` يجعل التطبيق
يفتح من نسخته المخزّنة **بلا انتظار الشبكة**. على إنترنت الرقة، انتظار التحديث
قبل ظهور الشاشة الأولى يعني شاشة بيضاء لثوانٍ في كل مرة.

⚠️ runtimeVersion يمثّل **الطبقة الأصلية** لا إصدار التطبيق. لا يُرفع إلا عند
تغيير المكتبات الأصلية — وإلا انقطع التحديث عن كل من يحمل النسخة القديمة.
"""

from __future__ import annotations

import json
import mimetypes
import uuid
from pathlib import Path

from django.conf import settings
from django.db import models

from .models import TimeStampedModel

# امتدادات لا يعرفها mimetypes وحده
EXTRA_TYPES = {
    ".hbc": "application/javascript",
    ".bundle": "application/javascript",
    ".js": "application/javascript",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".webp": "image/webp",
}


class OtaUpdate(TimeStampedModel):
    """حزمة تحديث منشورة. الملفات على القرص، والسجلّ هنا ليمكن التراجع بضغطة."""

    class Platform(models.TextChoices):
        ANDROID = "android", "أندرويد"
        IOS = "ios", "آيفون"

    update_id = models.UUIDField("معرّف التحديث", default=uuid.uuid4, unique=True, editable=False)
    runtime_version = models.CharField(
        "نسخة الطبقة الأصلية", max_length=32, db_index=True,
        help_text="لا تُرفع إلا عند تغيير المكتبات الأصلية",
    )
    platform = models.CharField(
        "المنصّة", max_length=10, choices=Platform.choices, default=Platform.ANDROID
    )
    directory = models.CharField("مجلد الحزمة", max_length=255)
    is_active = models.BooleanField("النشط", default=False, db_index=True)
    notes = models.CharField("ملاحظة", max_length=200, blank=True)
    published_by = models.ForeignKey(
        "accounts.User", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="published_updates",
    )

    class Meta:
        verbose_name = "تحديث عن بُعد"
        verbose_name_plural = "التحديثات عن بُعد"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["runtime_version", "platform", "is_active"])]

    def __str__(self) -> str:
        return f"{self.runtime_version} · {self.platform} · {self.update_id}"

    # ------------------------------------------------------------------

    def activate(self):
        """تفعيل هذه الحزمة وإلغاء ما سواها لنفس المنصّة والـ runtime."""
        OtaUpdate.objects.filter(
            runtime_version=self.runtime_version, platform=self.platform, is_active=True
        ).exclude(pk=self.pk).update(is_active=False)
        self.is_active = True
        self.save(update_fields=["is_active", "updated_at"])

    @property
    def path(self) -> Path:
        return Path(self.directory)

    @classmethod
    def current(cls, runtime_version: str, platform: str) -> "OtaUpdate | None":
        return cls.objects.filter(
            runtime_version=runtime_version, platform=platform, is_active=True
        ).order_by("-created_at").first()


# ---------------------------------------------------------------- بناء البيان


def content_type_for(name: str) -> str:
    suffix = Path(name).suffix.lower()
    if suffix in EXTRA_TYPES:
        return EXTRA_TYPES[suffix]
    guessed, _ = mimetypes.guess_type(name)
    return guessed or "application/octet-stream"


EXPO_CLIENT_FILE = "expo-client.json"


def read_expo_client(update: OtaUpdate) -> dict:
    """
    إعدادات التطبيق (app.json) المحفوظة مع الحزمة.

    ⚠️ ليست تفصيلًا كماليًا. حين يشغّل الجهاز حزمة تحديث، لا يقرأ
    `Constants.expoConfig` من الملف المثبَّت بل **من هنا**. وإسقاطها يعني تطبيقًا
    يجهل إصداره — وقد كلّفنا ذلك دوامة تحديث لا تنتهي: التطبيق يظنّ نفسه 1.0.0
    فيطالب بالتحديث، فيثبّت المستخدم النسخة نفسها، فيعود إلى الشاشة ذاتها.
    """
    path = update.path / EXPO_CLIENT_FILE
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def build_manifest(update: OtaUpdate, base_url: str) -> dict:
    """
    يحوّل مخرجات `expo export` إلى بيان يفهمه expo-updates.

    ملف metadata.json الذي ينتجه Expo يحمل مسار الحزمة وقائمة الأصول؛ ومفتاح
    كل أصل هو اسم ملفه (Expo يسمّيه ببصمته أصلًا)، فلا نحتاج حساب بصمات.
    """
    metadata_file = update.path / "metadata.json"
    if not metadata_file.exists():
        raise FileNotFoundError(f"لا يوجد metadata.json في {update.directory}")

    metadata = json.loads(metadata_file.read_text(encoding="utf-8"))
    platform_data = (metadata.get("fileMetadata") or {}).get(update.platform)
    if not platform_data:
        raise ValueError(f"مخرجات التصدير لا تحوي منصّة {update.platform}")

    prefix = f"{base_url.rstrip('/')}/updates/{update.runtime_version}/{update.update_id}"

    bundle = platform_data["bundle"]
    launch_asset = {
        "key": Path(bundle).stem,
        "contentType": "application/javascript",
        "fileExtension": Path(bundle).suffix or ".bundle",
        "url": f"{prefix}/{bundle}",
    }

    assets = []
    for asset in platform_data.get("assets", []):
        path = asset["path"]
        extension = asset.get("ext", "")
        extension = f".{extension.lstrip('.')}" if extension else Path(path).suffix
        assets.append({
            "key": Path(path).stem or Path(path).name,
            "contentType": content_type_for(f"x{extension}"),
            "fileExtension": extension,
            "url": f"{prefix}/{path}",
        })

    return {
        "id": str(update.update_id),
        "createdAt": update.created_at.isoformat().replace("+00:00", "Z"),
        "runtimeVersion": update.runtime_version,
        "launchAsset": launch_asset,
        "assets": assets,
        "metadata": {},
        "extra": {"note": update.notes, "expoClient": read_expo_client(update)},
    }
