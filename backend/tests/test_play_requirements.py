"""
المتطلّبات الإلزامية في Google Play.

هذه ليست اختبارات ميزات بل اختبارات **امتثال**: كل واحد منها يقابل بندًا في
سياسة يترتّب على مخالفتها رفض التطبيق أو إزالته. الميزة قد تُكسر بإعادة بناء
عابرة، والكسر هنا لا يظهر لمستخدم — يظهر في بريد رفض بعد أسبوعين.
"""

from apps.accounts.models import Block, DeletedAccount, Device, User
from apps.listings.models import Favorite, Listing, ListingMedia

from .test_access_rules import BaseAPITest


class AccountDeletionTests(BaseAPITest):
    """سياسة «حذف بيانات المستخدم»: مسار داخل التطبيق + مسار ويب عام."""

    def setUp(self):
        super().setUp()
        self.listing = Listing.objects.create(
            user=self.seller, category=self.category, city=self.city,
            title="إعلان سيُحذف مع الحساب", description="وصف كافٍ للاختبار.",
            price=100, price_currency="USD", status=Listing.Status.PUBLISHED,
        )
        Favorite.objects.create(user=self.seller, listing=self.listing)
        Device.objects.create(user=self.seller, token="tok-1")

    def test_in_app_deletion_removes_everything(self):
        client = self.as_user(self.seller)
        response = client.post("/api/v1/auth/me/delete", {"password": "test1234"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.filter(pk=self.seller.pk).exists())
        self.assertFalse(Listing.objects.filter(pk=self.listing.pk).exists())
        self.assertFalse(Favorite.objects.filter(user_id=self.seller.pk).exists())
        self.assertFalse(Device.objects.filter(user_id=self.seller.pk).exists())

    def test_deletion_requires_the_password(self):
        """جهاز مفتوح في يد غير صاحبه يجب ألّا يكفي لمحو حساب كامل."""
        client = self.as_user(self.seller)
        response = client.post("/api/v1/auth/me/delete", {"password": "wrong"}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertTrue(User.objects.filter(pk=self.seller.pk).exists())

    def test_web_route_works_without_the_app(self):
        """المسار العام: من أزال التطبيق يحذف حسابه برقمه وكلمة مروره."""
        response = self.guest.post(
            "/api/v1/auth/delete-account",
            {"phone": self.seller.phone, "password": "test1234"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.filter(pk=self.seller.pk).exists())

    def test_web_route_rejects_a_wrong_password(self):
        """بلا هذا يستطيع أي شخص يعرف رقمك أن يمحو حسابك."""
        response = self.guest.post(
            "/api/v1/auth/delete-account",
            {"phone": self.seller.phone, "password": "definitely-wrong"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertTrue(User.objects.filter(pk=self.seller.pk).exists())

    def test_photo_files_are_erased_from_disk_not_only_the_rows(self):
        """
        CASCADE يمحو الصفوف ولا يلمس الملفات. لو اكتفينا به لبقيت صور المستخدم
        على الخادم بعد «حذف» حسابه — نقضٌ للسياسة وللوعد المكتوب في الصفحة.
        """
        from django.core.files.base import ContentFile

        media = ListingMedia.objects.create(listing=self.listing)
        media.image.save("t.jpg", ContentFile(b"fake-image-bytes"), save=True)
        storage, name = media.image.storage, media.image.name
        self.assertTrue(storage.exists(name))

        client = self.as_user(self.seller)
        client.post("/api/v1/auth/me/delete", {"password": "test1234"}, format="json")

        self.assertFalse(storage.exists(name))

    def test_only_an_anonymous_trace_survives(self):
        expected = Listing.objects.filter(user=self.seller).count()
        client = self.as_user(self.seller)
        client.post("/api/v1/auth/me/delete", {"password": "test1234"}, format="json")

        trace = DeletedAccount.objects.get()
        self.assertEqual(trace.listings_removed, expected)
        # البصمة لا تُشبه الرقم ولا يمكن ردّها إليه
        self.assertNotIn(self.seller.phone, trace.phone_hash)
        self.assertEqual(len(trace.phone_hash), 64)


class BlockingTests(BaseAPITest):
    """سياسة المحتوى من المستخدمين: لا يكفي الإبلاغ — يجب أن يُحجب شخص بعينه."""

    def setUp(self):
        super().setUp()
        self.listing = Listing.objects.create(
            user=self.seller, category=self.category, city=self.city,
            title="إعلان من معلن سيُحظر", description="وصف كافٍ للاختبار.",
            price=100, price_currency="USD", status=Listing.Status.PUBLISHED,
        )

    def _visible_ids(self, client):
        return [row["id"] for row in client.get("/api/v1/listings").data["results"]]

    def test_blocking_hides_every_listing_of_that_seller(self):
        client = self.as_user(self.buyer)
        self.assertIn(self.listing.id, self._visible_ids(client))

        client.post("/api/v1/auth/blocks", {"user_id": self.seller.id}, format="json")

        self.assertNotIn(self.listing.id, self._visible_ids(client))
        # وحتى الرابط المباشر لا يفتح
        self.assertEqual(client.get(f"/api/v1/listings/{self.listing.id}").status_code, 404)

    def test_block_is_one_sided_and_others_are_unaffected(self):
        """
        الحظر يخفي المحظور عن الحاظر وحده. لو أثّر على غيره لصار سلاحًا:
        من يحظر يُخفي إعلانات منافسه عن السوق كلّه.
        """
        self.as_user(self.buyer).post(
            "/api/v1/auth/blocks", {"user_id": self.seller.id}, format="json"
        )
        self.assertIn(self.listing.id, self._visible_ids(self.guest))

    def test_unblocking_brings_the_listings_back(self):
        """حظر لا يُفكّ ليس حظرًا — السياسة تشترط أن يكون قابلًا للرجوع."""
        client = self.as_user(self.buyer)
        client.post("/api/v1/auth/blocks", {"user_id": self.seller.id}, format="json")
        client.delete(f"/api/v1/auth/blocks/{self.seller.id}")

        self.assertIn(self.listing.id, self._visible_ids(client))

    def test_blocked_list_is_visible_to_its_owner(self):
        client = self.as_user(self.buyer)
        client.post("/api/v1/auth/blocks", {"user_id": self.seller.id}, format="json")

        results = client.get("/api/v1/auth/blocks").data["results"]
        self.assertEqual([row["user_id"] for row in results], [self.seller.id])

    def test_you_cannot_block_yourself(self):
        client = self.as_user(self.buyer)
        response = client.post("/api/v1/auth/blocks", {"user_id": self.buyer.id}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Block.objects.exists())

    def test_blocking_twice_is_not_an_error(self):
        """الضغط مرتين على زرّ في شبكة بطيئة أمر عادي — ولا يجوز أن يُعيد خطأ."""
        client = self.as_user(self.buyer)
        for _ in range(2):
            response = client.post(
                "/api/v1/auth/blocks", {"user_id": self.seller.id}, format="json"
            )
            self.assertEqual(response.status_code, 200)
        self.assertEqual(Block.objects.count(), 1)


class PermissionSurfaceTests(BaseAPITest):
    """
    الإعدادات التي يقرأها المراجع قبل أن يفتح التطبيق.

    نفحصها هنا لأن `app.json` يُعدَّل بلا مراجعة أحيانًا، وصلاحية واحدة تعود
    إليه (CAMERA مثلًا) تعني نموذج إقرار إضافي في الكونسول ورفضًا محتملًا.
    """

    def test_app_declares_no_sensitive_android_permissions(self):
        import json
        from pathlib import Path

        app_json = Path(__file__).resolve().parents[2] / "app" / "app.json"
        if not app_json.exists():  # pragma: no cover - الخلفية قد تُنشر وحدها
            self.skipTest("مجلد التطبيق غير موجود في هذه النسخة")

        android = json.loads(app_json.read_text(encoding="utf-8"))["expo"]["android"]

        self.assertNotIn("permissions", android, "لا نطلب أي صلاحية صراحةً")
        blocked = set(android.get("blockedPermissions", []))
        for permission in (
            "android.permission.CAMERA",
            "android.permission.RECORD_AUDIO",
            "android.permission.READ_MEDIA_IMAGES",
            # تضيفها مكتبة React Native تلقائيًا لقائمة المطوّر، ولا يستعملها
            # التطبيق. «العرض فوق التطبيقات الأخرى» صلاحية يلاحظها المراجع.
            "android.permission.SYSTEM_ALERT_WINDOW",
        ):
            self.assertIn(permission, blocked, f"{permission} يجب أن تبقى محجوبة")

    def test_config_exposes_the_legal_urls_the_app_must_link_to(self):
        response = self.guest.get("/api/v1/app-config")
        legal = response.data["legal"]
        for key in ("privacy", "terms", "delete_account"):
            self.assertTrue(legal[key], f"رابط {key} مفقود — التطبيق لن يعرضه")
