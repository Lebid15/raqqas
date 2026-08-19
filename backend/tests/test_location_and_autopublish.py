"""
المحافظة + العنوان اليدوي، والنشر التلقائي لمستخدم بعينه.

قرار: الأحياء كانت قائمة مغلقة لمدينة واحدة. صارت المحافظة قائمة (14 محافظة
سورية) والعنوان نصًّا يكتبه صاحب الإعلان. والمراجعة صار يمكن إسقاطها عن شخص
واحد بعينه بدل فتحها للجميع.
"""

from apps.accounts.models import User
from apps.catalog.models import City
from apps.listings.models import Listing, ListingMedia

from .test_access_rules import BaseAPITest


class LocationTests(BaseAPITest):
    def test_listing_exposes_city_and_address_not_neighborhood(self):
        response = self.guest.get(f"/api/v1/listings/{self.listing.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["city"]["name"], "الرقة")
        self.assertEqual(response.data["address"], "حي المشلب")
        self.assertNotIn("neighborhood", response.data)

    def test_create_requires_city_and_keeps_free_text_address(self):
        client = self.as_user(self.seller)
        response = client.post(
            "/api/v1/listings",
            {
                "title": "طاولة خشب زان",
                "description": "طاولة نظيفة استعمال خفيف.",
                "price": 200000,
                "condition": "used",
                "category": self.category.id,
                "city": self.city.id,
                "address": "  شارع تل أبيض   قرب الصيدلية  ",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        listing = Listing.objects.get(pk=response.data["id"])
        self.assertEqual(listing.city_id, self.city.id)
        # المسافات الزائدة تُطوى — العنوان يُعرض في بطاقة ضيّقة
        self.assertEqual(listing.address, "شارع تل أبيض قرب الصيدلية")

    def test_create_without_city_is_rejected(self):
        client = self.as_user(self.seller)
        response = client.post(
            "/api/v1/listings",
            {
                "title": "طاولة خشب زان",
                "description": "طاولة نظيفة استعمال خفيف.",
                "category": self.category.id,
                "address": "شارع تل أبيض",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("city", response.data["error"]["fields"])

    def test_filter_by_several_cities_at_once(self):
        aleppo = City.objects.create(slug="aleppo", name_ar="حلب", name_en="Aleppo")
        other = Listing.objects.create(
            user=self.seller, category=self.category, city=aleppo,
            title="براد سامسونغ نظيف", description="يعمل بكفاءة تامة.",
            price=500000, status=Listing.Status.PUBLISHED,
        )
        other.publish()

        both = self.guest.get(f"/api/v1/listings?city={self.city.id},{aleppo.id}")
        self.assertEqual(both.data["count"], 2)

        one = self.guest.get(f"/api/v1/listings?city={aleppo.slug}")
        self.assertEqual([row["id"] for row in one.data["results"]], [other.id])


class MediaDeletionTests(BaseAPITest):
    """
    حذف الصور — وخاصّةً الرئيسية.

    كان حذف الصورة الرئيسية يسقط بخطأ 500: الإعلان يُحمَّل بصوره مسبقًا
    (prefetch_related)، فبعد الحذف كانت الترقية تقع على صفٍّ لم يعد موجودًا.
    """

    def setUp(self):
        super().setUp()
        self.photos = [
            ListingMedia.objects.create(
                listing=self.listing, sort_order=index, is_main=(index == 0)
            )
            for index in range(3)
        ]
        self.client = self.as_user(self.seller)

    def _delete(self, media):
        return self.client.delete(f"/api/v1/listings/{self.listing.id}/media/{media.id}")

    def test_deleting_main_photo_promotes_the_next_one(self):
        response = self._delete(self.photos[0])
        self.assertEqual(response.status_code, 204)

        remaining = ListingMedia.objects.filter(listing=self.listing).order_by("sort_order")
        self.assertEqual(remaining.count(), 2)
        self.assertTrue(remaining.first().is_main)

    def test_deleting_every_photo_one_by_one_never_fails(self):
        # ترتيب المستخدم الفعلي الذي كشف العطل: الأخيرة ثم الوسطى ثم الرئيسية
        for media in (self.photos[2], self.photos[1], self.photos[0]):
            self.assertEqual(self._delete(media).status_code, 204, f"فشل حذف {media.id}")
        self.assertEqual(ListingMedia.objects.filter(listing=self.listing).count(), 0)

    def test_deleting_a_secondary_photo_keeps_the_main_one(self):
        self._delete(self.photos[1])
        self.photos[0].refresh_from_db()
        self.assertTrue(self.photos[0].is_main)

    def test_cannot_delete_photos_of_another_listing(self):
        response = self.as_user(self.buyer).delete(
            f"/api/v1/listings/{self.listing.id}/media/{self.photos[0].id}"
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(ListingMedia.objects.filter(listing=self.listing).count(), 3)


class AutoPublishTests(BaseAPITest):
    def _post_listing(self, user):
        return self.as_user(user).post(
            "/api/v1/listings",
            {
                "title": "دراجة هوائية للأطفال",
                "description": "دراجة بحالة جيدة جدًا.",
                "category": self.category.id,
                "city": self.city.id,
            },
            format="json",
        )

    def test_listing_waits_for_review_by_default(self):
        response = self._post_listing(self.seller)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Listing.objects.get(pk=response.data["id"]).status, "pending")

    def test_flagged_user_publishes_without_review(self):
        self.seller.auto_publish = True
        self.seller.save(update_fields=["auto_publish"])

        response = self._post_listing(self.seller)
        self.assertEqual(Listing.objects.get(pk=response.data["id"]).status, "published")

    def test_admin_toggles_the_flag_and_others_stay_under_review(self):
        client = self.as_user(self.admin)
        response = client.post(
            f"/api/v1/admin/users/{self.seller.id}/auto-publish",
            {"auto_publish": True},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["auto_publish"])
        self.seller.refresh_from_db()
        self.assertTrue(self.seller.auto_publish)

        # الثقة شخصية لا عامة: المشتري ما يزال تحت المراجعة
        self.assertEqual(Listing.objects.get(pk=self._post_listing(self.buyer).data["id"]).status,
                         "pending")

        client.post(
            f"/api/v1/admin/users/{self.seller.id}/auto-publish",
            {"auto_publish": False},
            format="json",
        )
        self.seller.refresh_from_db()
        self.assertFalse(self.seller.auto_publish)

    def test_ordinary_user_cannot_grant_himself_auto_publish(self):
        response = self.as_user(self.seller).post(
            f"/api/v1/admin/users/{self.seller.id}/auto-publish",
            {"auto_publish": True},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.seller.refresh_from_db()
        self.assertFalse(self.seller.auto_publish)
