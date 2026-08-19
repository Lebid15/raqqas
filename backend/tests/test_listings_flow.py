"""دورة الإعلان الكاملة: نشر → مراجعة → قبول/رفض — وقواعد العملة والوقت."""

from django.test import TestCase
from django.utils import timezone

from decimal import Decimal

from apps.core import money
from apps.core.models import AppConfig
from apps.core.timeutils import format_price, time_ago
from apps.listings.models import Listing
from apps.notifications.models import Notification

from .test_access_rules import BaseAPITest


class ListingLifecycleTests(BaseAPITest):
    def _create(self, client, **overrides):
        payload = {
            "title": "غسالة سامسونغ سبعة كيلو",
            "description": "مستعملة سنتين وشغالة مئة بالمئة.",
            "price": 450000,
            "condition": "used",
            "category": self.category.id,
            "city": self.city.id,
        }
        payload.update(overrides)
        return client.post("/api/v1/listings", payload, format="json")

    def test_new_listing_starts_pending(self):
        client = self.as_user(self.seller)
        response = self._create(client)
        self.assertEqual(response.status_code, 201)
        listing = Listing.objects.get(pk=response.data["id"])
        self.assertEqual(listing.status, Listing.Status.PENDING)
        self.assertIsNone(listing.published_at)

    def test_pending_listing_hidden_from_guests_but_visible_to_owner(self):
        client = self.as_user(self.seller)
        listing_id = self._create(client).data["id"]

        self.assertEqual(self.guest.get(f"/api/v1/listings/{listing_id}").status_code, 404)
        self.assertEqual(client.get(f"/api/v1/listings/{listing_id}").status_code, 200)

    def test_admin_is_notified_of_new_listing(self):
        client = self.as_user(self.seller)
        self._create(client)
        self.assertTrue(
            Notification.objects.filter(
                user=self.admin, kind=Notification.Kind.NEW_PENDING
            ).exists()
        )

    def test_admin_approves_and_seller_is_notified(self):
        seller_client = self.as_user(self.seller)
        listing_id = self._create(seller_client).data["id"]

        admin_client = self.as_user(self.admin)
        response = admin_client.post(
            "/api/v1/admin/listings/approve", {"ids": [listing_id]}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)

        listing = Listing.objects.get(pk=listing_id)
        self.assertEqual(listing.status, Listing.Status.PUBLISHED)
        self.assertIsNotNone(listing.published_at)
        self.assertIsNotNone(listing.expires_at)

        self.seller.refresh_from_db()
        self.assertEqual(self.seller.listings_approved_count, 1)
        self.assertTrue(
            Notification.objects.filter(
                user=self.seller, kind=Notification.Kind.LISTING_PUBLISHED
            ).exists()
        )
        self.assertEqual(self.guest.get(f"/api/v1/listings/{listing_id}").status_code, 200)

    def test_rejection_requires_a_reason(self):
        seller_client = self.as_user(self.seller)
        listing_id = self._create(seller_client).data["id"]
        admin_client = self.as_user(self.admin)

        blank = admin_client.post(
            "/api/v1/admin/listings/reject", {"ids": [listing_id]}, format="json"
        )
        self.assertEqual(blank.status_code, 400)

        response = admin_client.post(
            "/api/v1/admin/listings/reject",
            {"ids": [listing_id], "reason": "الصور غير واضحة."},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        listing = Listing.objects.get(pk=listing_id)
        self.assertEqual(listing.status, Listing.Status.REJECTED)
        self.assertEqual(listing.rejection_reason, "الصور غير واضحة.")

    def test_editing_published_listing_sends_it_back_to_review(self):
        client = self.as_user(self.seller)
        response = client.patch(
            f"/api/v1/listings/{self.listing.id}",
            {"title": "آيفون 15 برو — سعر جديد"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.status, Listing.Status.PENDING)

    def test_user_cannot_edit_someone_elses_listing(self):
        client = self.as_user(self.buyer)
        response = client.patch(
            f"/api/v1/listings/{self.listing.id}", {"title": "اختطاف"}, format="json"
        )
        self.assertEqual(response.status_code, 403)

    def test_daily_limit_is_enforced(self):
        config = AppConfig.get_solo()
        config.daily_listing_limit = 2
        config.save()

        client = self.as_user(self.buyer)
        self.assertEqual(self._create(client).status_code, 201)
        self.assertEqual(self._create(client).status_code, 201)
        blocked = self._create(client)
        self.assertEqual(blocked.status_code, 400)

    def test_owner_view_does_not_inflate_view_count(self):
        client = self.as_user(self.seller)
        client.get(f"/api/v1/listings/{self.listing.id}")
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.views_count, 0)

        self.guest.get(f"/api/v1/listings/{self.listing.id}")
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.views_count, 1)

    def test_deleting_is_soft(self):
        client = self.as_user(self.seller)
        response = client.delete(f"/api/v1/listings/{self.listing.id}")
        self.assertEqual(response.status_code, 204)
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.status, Listing.Status.DELETED)

    def test_review_mode_off_publishes_immediately(self):
        config = AppConfig.get_solo()
        config.review_mode = "off"
        config.save()

        client = self.as_user(self.buyer)
        listing_id = self._create(client).data["id"]
        self.assertEqual(Listing.objects.get(pk=listing_id).status, Listing.Status.PUBLISHED)

    def test_review_mode_new_users_trusts_established_sellers(self):
        config = AppConfig.get_solo()
        config.review_mode = "new_users"
        config.review_threshold = 3
        config.save()

        self.buyer.listings_approved_count = 5
        self.buyer.save()

        client = self.as_user(self.buyer)
        listing_id = self._create(client).data["id"]
        self.assertEqual(Listing.objects.get(pk=listing_id).status, Listing.Status.PUBLISHED)


class SearchAndFilterTests(BaseAPITest):
    def test_category_filter_includes_subcategories(self):
        response = self.guest.get("/api/v1/listings", {"category": "mobiles"})
        self.assertEqual(response.data["count"], 1)

    def test_price_range_filter(self):
        self.assertEqual(
            self.guest.get("/api/v1/listings", {"min_price": 2000000}).data["count"], 0
        )
        self.assertEqual(
            self.guest.get("/api/v1/listings", {"max_price": 2000000}).data["count"], 1
        )

    def test_sorting_by_price(self):
        Listing.objects.create(
            user=self.seller, category=self.category, city=self.city,
            title="هاتف رخيص للبيع", description="بحالة جيدة جدًا.",
            price=50000, status=Listing.Status.PUBLISHED,
            published_at=timezone.now(),
        )
        response = self.guest.get("/api/v1/listings", {"sort": "price_asc"})
        prices = [row["price"] for row in response.data["results"]]
        self.assertEqual(prices, sorted(prices))


class CurrencyTests(TestCase):
    """
    العملات: رقم البائع ملكه، والتحويل عرضٌ لا تخزين.

    (تعديل على plan2 §6 — لم تعد هناك «عملة متجر» واحدة.)
    """

    def test_price_reads_in_the_currency_the_seller_chose(self):
        self.assertEqual(format_price(450000, "SYP", "ar"), "450,000 ل.س")
        self.assertEqual(format_price(8500, "USD", "ar"), "8,500 $")
        self.assertEqual(format_price(8500, "TRY", "tr"), "8,500 ₺")
        self.assertEqual(format_price(8500, "TRY", "ar"), "8,500 ل.ت")

    def test_rate_change_never_moves_the_sellers_number(self):
        """
        جوهر التصميم: الأدمن يضاعف سعر الصرف، والسعر المكتوب لا يهتزّ.
        هذا ما يمنع مشتريًا من أن يظنّ أن البائع رفع سعره.
        """
        config = AppConfig.get_solo()
        config.rates = {"SYP": 13000}
        config.save()
        before = format_price(450000, "SYP", "ar")

        config.rates = {"SYP": 26000}
        config.save()
        self.assertEqual(format_price(450000, "SYP", "ar"), before)

    def test_conversion_goes_through_the_dollar_pivot(self):
        rates = {"SYP": 13000, "TRY": 40}
        # 260,000 ل.س = 20 دولارًا = 800 ليرة تركية
        self.assertEqual(money.convert(260000, "SYP", "TRY", rates), Decimal(800))
        self.assertEqual(money.convert(20, "USD", "SYP", rates), Decimal(260000))

    def test_conversion_says_i_dont_know_instead_of_guessing(self):
        """سعر ناقص يعيد None — لا صفرًا ولا الرقم كما هو."""
        self.assertIsNone(money.convert(100, "USD", "EUR", {"SYP": 13000}))
        self.assertIsNone(money.format_converted(100, "USD", "EUR", {}, "ar"))

    def test_converted_amount_is_rounded_so_it_reads_as_an_estimate(self):
        text = money.format_converted(8500, "USD", "SYP", {"SYP": 13000}, "ar")
        # 110,500,000 بالضبط — نعرضها بثلاثة أرقام معنوية ومسبوقة بعلامة التقريب،
        # لأن الرقم مأخوذ من جدول يدوي قد يكون عمره أيام: الدقّة هنا ادّعاء.
        self.assertTrue(text.startswith("≈ "))
        self.assertEqual(text, "≈ 111,000,000 ل.س")

    def test_no_conversion_shown_when_currencies_match(self):
        self.assertIsNone(money.format_converted(8500, "USD", "USD", {"SYP": 13000}, "ar"))

    def test_admin_cannot_save_a_zero_or_negative_rate(self):
        self.assertEqual(money.clean_rates({"SYP": 0, "TRY": -5, "EUR": 0.9}), {"EUR": 0.9})

    def test_no_price_reads_as_negotiable(self):
        config = AppConfig.get_solo()
        self.assertEqual(format_price(None, config, "ar"), "على السوم")
        self.assertEqual(format_price(None, config, "en"), "Negotiable")


class TimeAgoTests(TestCase):
    def test_arabic_dual_and_plural_forms(self):
        now = timezone.now()
        self.assertEqual(time_ago(now - timezone.timedelta(hours=1), "ar"), "منذ ساعة")
        self.assertEqual(time_ago(now - timezone.timedelta(hours=2), "ar"), "منذ ساعتين")
        self.assertEqual(time_ago(now - timezone.timedelta(hours=5), "ar"), "منذ 5 ساعات")
        self.assertEqual(time_ago(now - timezone.timedelta(days=1), "ar"), "أمس")

    def test_other_languages(self):
        now = timezone.now()
        self.assertEqual(time_ago(now - timezone.timedelta(hours=3), "en"), "3 hours ago")
        self.assertEqual(time_ago(now - timezone.timedelta(hours=3), "tr"), "3 saat önce")


class CrossCurrencySearchTests(BaseAPITest):
    """
    الترشيح والفرز بالسعر عبر عملات مختلفة.

    هذا أخطر جزء في نظام العملات: الرقم الخام يكذب. 4,500,000 ل.س أكبر عدديًا
    من 8,500 $ وأقلّ منها قيمةً بكثير — ومن يفرز «الأرخص أولًا» على العمود
    الخام يرى أغلى إعلان في الأعلى ولا يفهم لماذا.
    """

    def setUp(self):
        super().setUp()
        config = AppConfig.get_solo()
        config.rates = {"SYP": 13000, "TRY": 40, "EUR": 0.9}
        config.save()

        self.cheap_syp = self._listing(1_300_000, "SYP")   # = 100 دولار
        self.mid_usd = self._listing(500, "USD")           # = 500 دولار
        self.dear_try = self._listing(40_000, "TRY")       # = 1000 دولار

    def _listing(self, price, currency):
        return Listing.objects.create(
            user=self.seller, category=self.category, city=self.city,
            title=f"إعلان بسعر {price} {currency}",
            description="وصف كافٍ للاختبار.",
            price=price, price_currency=currency,
            status=Listing.Status.PUBLISHED, published_at=timezone.now(),
        )

    def _ordered_ids(self, sort: str) -> list[int]:
        """ترتيب إعلانات هذا الاختبار وحدها — الجهاز يحمل إعلانات أخرى من التهيئة."""
        response = self.guest.get("/api/v1/listings", {"sort": sort})
        mine = {self.cheap_syp.id, self.mid_usd.id, self.dear_try.id}
        return [row["id"] for row in response.data["results"] if row["id"] in mine]

    def test_price_sort_uses_value_not_raw_number(self):
        self.assertEqual(
            self._ordered_ids("price_asc"),
            [self.cheap_syp.id, self.mid_usd.id, self.dear_try.id],
        )

    def test_price_sort_descending(self):
        self.assertEqual(
            self._ordered_ids("price_desc"),
            [self.dear_try.id, self.mid_usd.id, self.cheap_syp.id],
        )

    def test_price_range_is_read_in_the_requested_currency(self):
        """«من 400 إلى 600 دولار» يجب أن يلتقط الإعلان الدولاري وحده."""
        response = self.guest.get(
            "/api/v1/listings",
            {"min_price": 400, "max_price": 600, "currency": "USD"},
        )
        ids = [row["id"] for row in response.data["results"]]
        self.assertIn(self.mid_usd.id, ids)
        self.assertNotIn(self.cheap_syp.id, ids)
        self.assertNotIn(self.dear_try.id, ids)

    def test_same_range_written_in_syp_finds_the_same_listing(self):
        """
        نفس النطاق مكتوبًا بالليرة السورية (5.2م – 7.8م) = نفس النتيجة.
        لو كانت المقارنة على الرقم الخام لعادت فارغة.
        """
        response = self.guest.get(
            "/api/v1/listings",
            {"min_price": 5_200_000, "max_price": 7_800_000, "currency": "SYP"},
        )
        ids = [row["id"] for row in response.data["results"]]
        self.assertIn(self.mid_usd.id, ids)
        self.assertNotIn(self.cheap_syp.id, ids)
        self.assertNotIn(self.dear_try.id, ids)

    def test_listing_keeps_its_own_currency_in_the_response(self):
        response = self.guest.get(f"/api/v1/listings/{self.cheap_syp.id}")
        self.assertEqual(response.data["price_currency"], "SYP")
        self.assertEqual(response.data["price_text"], "1,300,000 ل.س")

    def test_seller_cannot_use_a_currency_the_admin_disabled(self):
        config = AppConfig.get_solo()
        config.enabled_currencies = ["USD", "SYP"]
        config.save()

        client = self.as_user(self.seller)
        response = client.post("/api/v1/listings", {
            "title": "عنوان صالح للاختبار",
            "description": "وصف كافٍ للاختبار.",
            "price": 100, "price_currency": "EUR",
            "category": self.category.id, "city": self.city.id,
            "condition": "used",
        }, format="json")
        self.assertEqual(response.status_code, 400)
