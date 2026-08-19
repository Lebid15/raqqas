"""
خادم التحديث عن بُعد.

لا نملك جهازًا حقيقيًا في الاختبار، فنتحقّق مما يمكن التحقّق منه: أن البيان
يطابق ما ينتظره expo-updates شكلًا وترويسات — لأن بيانًا مشوّهًا يعني تطبيقًا
لا يحدّث لدى كل من نزّله، بلا رسالة خطأ ظاهرة.
"""

import json
import shutil
import tempfile
from pathlib import Path

from django.test import override_settings

from django.core.management import call_command

from apps.core.updates import EXPO_CLIENT_FILE, OtaUpdate, build_manifest

from .test_access_rules import BaseAPITest

MANIFEST_URL = "/api/v1/updates/manifest"


def make_bundle(root: Path, platform: str = "android") -> Path:
    """ينشئ مجلدًا يحاكي مخرجات `expo export`."""
    bundle_rel = f"_expo/static/js/{platform}/index-abc123.hbc"
    (root / f"_expo/static/js/{platform}").mkdir(parents=True, exist_ok=True)
    (root / bundle_rel).write_text("// bundle", encoding="utf-8")

    (root / "assets").mkdir(exist_ok=True)
    (root / "assets/deadbeef").write_bytes(b"\x00\x01")

    (root / "metadata.json").write_text(
        json.dumps({
            "version": 0,
            "bundler": "metro",
            "fileMetadata": {
                platform: {
                    "bundle": bundle_rel,
                    "assets": [{"path": "assets/deadbeef", "ext": "ttf"}],
                }
            },
        }),
        encoding="utf-8",
    )
    return root


class OtaManifestTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.tmp = Path(tempfile.mkdtemp())
        make_bundle(self.tmp)
        self.update = OtaUpdate.objects.create(
            runtime_version="1", platform="android", directory=str(self.tmp), notes="اختبار"
        )
        self.update.activate()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)
        super().tearDown()

    # ------------------------------------------------------------------

    def test_manifest_shape_matches_protocol(self):
        manifest = build_manifest(self.update, "https://souq.example")

        self.assertEqual(manifest["id"], str(self.update.update_id))
        self.assertEqual(manifest["runtimeVersion"], "1")
        self.assertTrue(manifest["createdAt"].endswith("Z"))

        launch = manifest["launchAsset"]
        self.assertEqual(launch["key"], "index-abc123")
        self.assertEqual(launch["contentType"], "application/javascript")
        self.assertTrue(launch["url"].startswith("https://souq.example/updates/1/"))

        self.assertEqual(len(manifest["assets"]), 1)
        asset = manifest["assets"][0]
        self.assertEqual(asset["key"], "deadbeef")
        self.assertEqual(asset["fileExtension"], ".ttf")
        self.assertEqual(asset["contentType"], "font/ttf")

    def test_protocol_1_returns_multipart(self):
        response = self.guest.get(
            MANIFEST_URL,
            HTTP_EXPO_PLATFORM="android",
            HTTP_EXPO_RUNTIME_VERSION="1",
            HTTP_EXPO_PROTOCOL_VERSION="1",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("multipart/mixed", response["Content-Type"])
        self.assertEqual(response["expo-protocol-version"], "1")

        body = response.content.decode()
        self.assertIn('name="manifest"', body)
        self.assertIn(str(self.update.update_id), body)

    def test_protocol_0_returns_plain_json(self):
        response = self.guest.get(
            MANIFEST_URL,
            HTTP_EXPO_PLATFORM="android",
            HTTP_EXPO_RUNTIME_VERSION="1",
            HTTP_EXPO_PROTOCOL_VERSION="0",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("application/json", response["Content-Type"])
        self.assertEqual(json.loads(response.content)["id"], str(self.update.update_id))

    def test_same_update_returns_no_content(self):
        """التطبيق يحمل النسخة نفسها — لا نُرسل البيان مرة أخرى على إنترنت ضعيف."""
        response = self.guest.get(
            MANIFEST_URL,
            HTTP_EXPO_PLATFORM="android",
            HTTP_EXPO_RUNTIME_VERSION="1",
            HTTP_EXPO_PROTOCOL_VERSION="1",
            HTTP_EXPO_CURRENT_UPDATE_ID=str(self.update.update_id),
        )
        self.assertEqual(response.status_code, 204)

    def test_unknown_runtime_returns_no_content(self):
        """طبقة أصلية لا حزمة لها — التطبيق يكمل بنسخته المدمجة بلا خطأ."""
        response = self.guest.get(
            MANIFEST_URL,
            HTTP_EXPO_PLATFORM="android",
            HTTP_EXPO_RUNTIME_VERSION="99",
            HTTP_EXPO_PROTOCOL_VERSION="1",
        )
        self.assertEqual(response.status_code, 204)

    def test_missing_runtime_is_rejected(self):
        response = self.guest.get(MANIFEST_URL, HTTP_EXPO_PLATFORM="android")
        self.assertEqual(response.status_code, 400)

    def test_manifest_is_public(self):
        """التطبيق يطلب البيان قبل أي تسجيل دخول — يجب ألّا يحتاج رمزًا."""
        response = self.guest.get(
            MANIFEST_URL, HTTP_EXPO_PLATFORM="android", HTTP_EXPO_RUNTIME_VERSION="1"
        )
        self.assertIn(response.status_code, (200, 204))

    def test_corrupt_bundle_is_reported_not_served(self):
        (self.tmp / "metadata.json").unlink()
        response = self.guest.get(
            MANIFEST_URL, HTTP_EXPO_PLATFORM="android", HTTP_EXPO_RUNTIME_VERSION="1"
        )
        self.assertEqual(response.status_code, 500)
        self.assertIn("تالفة", response.data["error"]["message"])


class ExpoClientInManifestTests(BaseAPITest):
    """
    البيان يجب أن يحمل إعدادات التطبيق.

    ليس تفصيلًا: الجهاز الذي يشغّل حزمة تحديث يقرأ إصداره من هنا لا من الملف
    المثبَّت. وإسقاطها كلّفنا دوامة تحديث لا تنتهي — التطبيق يظنّ نفسه أقدم
    إصدار، فيطالب بتحديث، فيثبّت المستخدم النسخة نفسها، فيعود إلى الشاشة ذاتها.
    """

    def setUp(self):
        super().setUp()
        self.tmp = Path(tempfile.mkdtemp())
        make_bundle(self.tmp)
        self.update = OtaUpdate.objects.create(
            runtime_version="2", platform="android", directory=str(self.tmp), notes="اختبار"
        )
        self.update.activate()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)
        super().tearDown()

    def _write_expo_client(self, version: str):
        (self.tmp / EXPO_CLIENT_FILE).write_text(
            json.dumps({"name": "سوق الرقة", "version": version, "slug": "souq-raqqa"}),
            encoding="utf-8",
        )

    def test_manifest_carries_app_version(self):
        self._write_expo_client("1.2.0")
        manifest = build_manifest(self.update, "https://souq.example")
        self.assertEqual(manifest["extra"]["expoClient"]["version"], "1.2.0")

    def test_missing_config_degrades_but_does_not_crash(self):
        manifest = build_manifest(self.update, "https://souq.example")
        self.assertEqual(manifest["extra"]["expoClient"], {})

    def test_corrupt_config_is_ignored(self):
        (self.tmp / EXPO_CLIENT_FILE).write_text("{ ليس", encoding="utf-8")
        manifest = build_manifest(self.update, "https://souq.example")
        self.assertEqual(manifest["extra"]["expoClient"], {})

    def test_publish_command_saves_the_config_beside_the_bundle(self):
        source = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, source, ignore_errors=True)
        make_bundle(source)
        app_json = source.parent / "app.json"
        app_json.write_text(
            json.dumps({"expo": {"name": "سوق الرقة", "version": "1.3.0", "runtimeVersion": "2"}}),
            encoding="utf-8",
        )
        self.addCleanup(app_json.unlink, missing_ok=True)

        with tempfile.TemporaryDirectory() as media:
            with override_settings(MEDIA_ROOT=str(Path(media) / "media")):
                call_command(
                    "publish_update",
                    source=str(source), runtime="9", platform="android",
                    app_json=str(app_json), notes="اختبار", verbosity=0,
                )
                published = OtaUpdate.objects.get(runtime_version="9")
                manifest = build_manifest(published, "https://souq.example")
                self.assertEqual(manifest["extra"]["expoClient"]["version"], "1.3.0")


class OtaAdminTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.tmp = Path(tempfile.mkdtemp())
        make_bundle(self.tmp)
        self.old = OtaUpdate.objects.create(
            runtime_version="1", platform="android", directory=str(self.tmp), notes="قديمة"
        )
        self.new = OtaUpdate.objects.create(
            runtime_version="1", platform="android", directory=str(self.tmp), notes="جديدة"
        )
        self.new.activate()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)
        super().tearDown()

    def test_activating_one_deactivates_the_others(self):
        client = self.as_user(self.admin)
        response = client.post(f"/api/v1/admin/updates/{self.old.id}/activate")
        self.assertEqual(response.status_code, 200)

        self.old.refresh_from_db()
        self.new.refresh_from_db()
        self.assertTrue(self.old.is_active)
        self.assertFalse(self.new.is_active)

    def test_rollback_is_admin_only(self):
        client = self.as_user(self.buyer)
        self.assertEqual(
            client.post(f"/api/v1/admin/updates/{self.old.id}/activate").status_code, 403
        )

    def test_list_shows_which_is_active(self):
        client = self.as_user(self.admin)
        rows = client.get("/api/v1/admin/updates").data
        active = [row for row in rows if row["is_active"]]
        self.assertEqual(len(active), 1)
        self.assertEqual(active[0]["notes"], "جديدة")
