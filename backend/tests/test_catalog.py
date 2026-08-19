"""شجرة الأقسام — أهمّها أن عدّاد القسم الرئيسي يشمل أبناءه."""

from apps.catalog.models import Category
from apps.listings.models import Listing

from .test_access_rules import BaseAPITest


class CategoryTreeTests(BaseAPITest):
    def test_root_count_includes_subcategories(self):
        """
        الإعلان الوحيد في بيانات الاختبار منشور في القسم الفرعي «هواتف».
        القسم الرئيسي «موبايلات» يجب أن يعرض 1 لا 0.
        """
        response = self.guest.get("/api/v1/categories")
        root = next(row for row in response.data if row["slug"] == "mobiles")

        self.assertEqual(root["listings_count"], 1)
        child = next(row for row in root["children"] if row["slug"] == "phones")
        self.assertEqual(child["listings_count"], 1)

    def test_count_grows_with_a_second_subcategory(self):
        accessories = Category.objects.create(
            slug="accessories", name_ar="إكسسوارات", parent=self.parent
        )
        listing = Listing.objects.create(
            user=self.seller, category=accessories, city=self.city,
            title="جراب هاتف بحالة جيدة", description="جراب أصلي بلا خدوش.",
            price=15000,
        )
        listing.publish()

        response = self.guest.get("/api/v1/categories")
        root = next(row for row in response.data if row["slug"] == "mobiles")
        self.assertEqual(root["listings_count"], 2)

    def test_pending_listings_are_not_counted(self):
        Listing.objects.create(
            user=self.seller, category=self.category, city=self.city,
            title="هاتف قيد المراجعة الآن", description="لم يُنشر بعد إطلاقًا.",
            price=1000, status=Listing.Status.PENDING,
        )
        response = self.guest.get("/api/v1/categories")
        root = next(row for row in response.data if row["slug"] == "mobiles")
        self.assertEqual(root["listings_count"], 1)

    def test_home_returns_same_tree(self):
        response = self.guest.get("/api/v1/home")
        root = next(row for row in response.data["categories"] if row["slug"] == "mobiles")
        self.assertEqual(root["listings_count"], 1)

    def test_inactive_category_is_hidden(self):
        self.parent.is_active = False
        self.parent.save()
        response = self.guest.get("/api/v1/categories")
        self.assertFalse(any(row["slug"] == "mobiles" for row in response.data))
