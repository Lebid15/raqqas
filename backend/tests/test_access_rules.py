"""
اختبارات قاعدة الوصول — القرار 17.

    الزائر يتصفّح كل شيء بلا تسجيل.
    الزائر لا ينشر ولا يراسل ولا يحفظ في المفضلة على الخادم.
    رقم البائع لا يظهر في أي رد عام — أبدًا.
"""

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog.models import Category, City, Neighborhood
from apps.listings.models import Favorite, Listing


class BaseAPITest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.city = City.objects.create(slug="raqqa", name_ar="الرقة", name_en="Raqqa")
        cls.hood = Neighborhood.objects.create(
            city=cls.city, slug="mashlab", name_ar="المشلب", name_en="Al-Mashlab"
        )
        cls.parent = Category.objects.create(slug="mobiles", name_ar="موبايلات", icon="📱")
        cls.category = Category.objects.create(
            slug="phones", name_ar="هواتف", parent=cls.parent
        )

        cls.seller = User.objects.create_user(
            phone="0994123456", password="test1234", name="أحمد"
        )
        cls.buyer = User.objects.create_user(
            phone="0991887220", password="test1234", name="محمد"
        )
        cls.admin = User.objects.create_user(
            phone="0900000000", password="test1234", name="المدير", role=User.Role.ADMIN
        )

        cls.listing = Listing.objects.create(
            user=cls.seller, category=cls.category, city=cls.city, address="حي المشلب",
            title="آيفون 15 برو بحالة ممتازة", description="جهاز نظيف جدًا مع علبته.",
            price=1000000, status=Listing.Status.PUBLISHED,
        )
        cls.listing.publish()

    def setUp(self):
        self.guest = APIClient()

    def as_user(self, user) -> APIClient:
        client = APIClient()
        response = client.post(
            "/api/v1/auth/login",
            {"phone": user.phone, "password": "test1234"},
            format="json",
        )
        assert response.status_code == 200, response.data
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['tokens']['access']}")
        return client


class GuestBrowsingTests(BaseAPITest):
    def test_guest_reads_app_config(self):
        response = self.guest.get("/api/v1/app-config")
        self.assertEqual(response.status_code, 200)
        self.assertIn("theme", response.data)
        self.assertEqual(response.data["currency"]["code"], "SYP")

    def test_app_config_returns_304_when_unchanged(self):
        first = self.guest.get("/api/v1/app-config")
        etag = first["ETag"]
        second = self.guest.get("/api/v1/app-config", HTTP_IF_NONE_MATCH=etag)
        self.assertEqual(second.status_code, 304)

    def test_guest_browses_listings(self):
        response = self.guest.get("/api/v1/listings")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)

    def test_guest_opens_listing_detail(self):
        response = self.guest.get(f"/api/v1/listings/{self.listing.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], self.listing.title)

    def test_guest_reads_categories_and_home(self):
        self.assertEqual(self.guest.get("/api/v1/categories").status_code, 200)
        self.assertEqual(self.guest.get("/api/v1/cities").status_code, 200)
        self.assertEqual(self.guest.get("/api/v1/home").status_code, 200)

    def test_guest_searches(self):
        response = self.guest.get("/api/v1/listings", {"q": "آيفون"})
        self.assertEqual(response.data["count"], 1)
        response = self.guest.get("/api/v1/listings", {"q": "سيارة"})
        self.assertEqual(response.data["count"], 0)


class SellerPhoneNeverPublicTests(BaseAPITest):
    """أهم اختبار أمني في المشروع."""

    def _flatten(self, data) -> str:
        import json

        return json.dumps(data, ensure_ascii=False, default=str)

    def test_phone_absent_from_public_detail(self):
        response = self.guest.get(f"/api/v1/listings/{self.listing.id}")
        body = self._flatten(response.data)
        self.assertNotIn(self.seller.phone, body)
        self.assertNotIn("0994", body)
        self.assertNotIn("phone", response.data["seller"])

    def test_phone_absent_from_public_list(self):
        body = self._flatten(self.guest.get("/api/v1/listings").data)
        self.assertNotIn(self.seller.phone, body)

    def test_guest_cannot_call_contact_endpoint(self):
        response = self.guest.get(f"/api/v1/listings/{self.listing.id}/contact")
        self.assertEqual(response.status_code, 401)

    def test_logged_in_user_gets_whatsapp_link(self):
        client = self.as_user(self.buyer)
        response = client.get(f"/api/v1/listings/{self.listing.id}/contact")
        self.assertEqual(response.status_code, 200)
        self.assertIn("wa.me/963994123456", response.data["whatsapp_url"])
        self.assertIn(self.listing.title, response.data["message"])

    def test_contact_uses_separate_whatsapp_number_when_set(self):
        # حالة واقعية: الحساب برقم سوري وواتسابه على رقم تركي
        self.seller.whatsapp_number = "05551234567"
        self.seller.save()
        client = self.as_user(self.buyer)
        response = client.get(f"/api/v1/listings/{self.listing.id}/contact")
        self.assertIn("wa.me/905551234567", response.data["whatsapp_url"])
        self.assertNotIn("963994123456", response.data["whatsapp_url"])

    def test_contact_is_counted(self):
        client = self.as_user(self.buyer)
        client.get(f"/api/v1/listings/{self.listing.id}/contact")
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.contacts_count, 1)


class GuestCannotWriteTests(BaseAPITest):
    def test_guest_cannot_create_listing(self):
        response = self.guest.post("/api/v1/listings", {
            "title": "شيء للبيع هنا", "description": "وصف كافٍ للاختبار",
            "price": 1000, "condition": "used",
            "category": self.category.id, "city": self.city.id, "address": "حي المشلب",
        }, format="json")
        self.assertEqual(response.status_code, 401)

    def test_guest_cannot_favorite(self):
        response = self.guest.post(
            "/api/v1/favorites", {"listing": self.listing.id}, format="json"
        )
        self.assertEqual(response.status_code, 401)

    def test_guest_cannot_report(self):
        response = self.guest.post(
            f"/api/v1/listings/{self.listing.id}/report",
            {"reason": "fraud"}, format="json",
        )
        self.assertEqual(response.status_code, 401)

    def test_guest_cannot_reach_admin(self):
        for url in ("/api/v1/admin/dashboard", "/api/v1/admin/review-queue",
                    "/api/v1/admin/app-config"):
            self.assertEqual(self.guest.get(url).status_code, 401, url)

    def test_normal_user_cannot_reach_admin(self):
        client = self.as_user(self.buyer)
        self.assertEqual(client.get("/api/v1/admin/dashboard").status_code, 403)


class GuestFavoritesMergeTests(BaseAPITest):
    """الزائر يحفظ محليًا — وعند أول تسجيل دخول ننقل ما جمعه."""

    def test_merge_moves_local_favorites(self):
        client = self.as_user(self.buyer)
        response = client.post(
            "/api/v1/favorites/merge",
            {"listing_ids": [self.listing.id, 999999]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["merged"], 1)
        self.assertTrue(Favorite.objects.filter(user=self.buyer, listing=self.listing).exists())

        self.listing.refresh_from_db()
        self.assertEqual(self.listing.favorites_count, 1)

    def test_merge_is_idempotent(self):
        client = self.as_user(self.buyer)
        payload = {"listing_ids": [self.listing.id]}
        client.post("/api/v1/favorites/merge", payload, format="json")
        second = client.post("/api/v1/favorites/merge", payload, format="json")
        self.assertEqual(second.data["merged"], 0)
        self.assertEqual(Favorite.objects.filter(user=self.buyer).count(), 1)
