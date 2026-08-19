"""إدارة الأقسام من اللوحة: تعديل الأسماء · إضافة · إخفاء · حدود الحذف."""

from apps.catalog.models import Category
from apps.listings.models import Listing

from .test_access_rules import BaseAPITest

URL = "/api/v1/admin/categories"


class AdminCategoryTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.client = self.as_user(self.admin)

    # ------------------------------------------------------------------ قراءة

    def test_list_carries_the_counters_that_gate_deletion(self):
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 200)
        row = next(item for item in response.data if item["id"] == self.category.id)
        self.assertEqual(row["listings_count"], 1)
        self.assertEqual(row["children_count"], 0)

    def test_only_staff_may_manage_categories(self):
        self.assertEqual(self.as_user(self.seller).get(URL).status_code, 403)
        self.assertEqual(self.guest.get(URL).status_code, 401)

    # ------------------------------------------------------------------ تعديل

    def test_renaming_updates_all_three_languages(self):
        response = self.client.patch(
            f"{URL}/{self.category.id}",
            {"name_ar": "  هواتف   ذكية ", "name_tr": "Akıllı telefon", "name_en": "Smartphones"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.category.refresh_from_db()
        self.assertEqual(self.category.name_ar, "هواتف ذكية")
        self.assertEqual(self.category.name_en, "Smartphones")

    def test_rename_reaches_the_public_tree(self):
        self.client.patch(f"{URL}/{self.parent.id}", {"name_ar": "الإلكترونيات"}, format="json")
        tree = self.guest.get("/api/v1/categories?lang=ar")
        names = [row["name"] for row in tree.data]
        self.assertIn("الإلكترونيات", names)

    def test_hiding_removes_it_from_the_app_but_keeps_its_listings(self):
        self.client.patch(f"{URL}/{self.parent.id}", {"is_active": False}, format="json")
        tree = self.guest.get("/api/v1/categories?lang=ar")
        self.assertNotIn(self.parent.id, [row["id"] for row in tree.data])
        self.assertTrue(Listing.objects.filter(pk=self.listing.pk).exists())

    # ------------------------------------------------------------------ إضافة

    def test_new_category_gets_a_slug_generated_from_an_arabic_name(self):
        response = self.client.post(
            URL, {"name_ar": "أثاث منزلي", "icon": "🛋"}, format="json"
        )
        self.assertEqual(response.status_code, 201, response.data)
        created = Category.objects.get(pk=response.data["id"])
        self.assertTrue(created.slug, "المعرّف لا يجوز أن يكون فارغًا")
        self.assertIsNone(created.parent_id)

    def test_generated_slugs_never_collide(self):
        first = self.client.post(URL, {"name_ar": "قسم"}, format="json")
        second = self.client.post(URL, {"name_ar": "قسم"}, format="json")
        self.assertEqual(second.status_code, 201, second.data)
        self.assertNotEqual(
            Category.objects.get(pk=first.data["id"]).slug,
            Category.objects.get(pk=second.data["id"]).slug,
        )

    def test_subcategory_attaches_to_its_parent(self):
        response = self.client.post(
            URL, {"name_ar": "سماعات", "parent": self.parent.id}, format="json"
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Category.objects.get(pk=response.data["id"]).parent_id, self.parent.id)

    def test_three_levels_are_refused(self):
        response = self.client.post(
            URL, {"name_ar": "مستوى ثالث", "parent": self.category.id}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("parent", response.data["error"]["fields"])

    def test_a_parent_with_children_cannot_be_nested(self):
        response = self.client.patch(
            f"{URL}/{self.parent.id}", {"parent": self.category.id}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    # ------------------------------------------------------------------ حذف

    def test_deleting_a_category_in_use_is_refused_with_an_alternative(self):
        response = self.client.delete(f"{URL}/{self.category.id}")
        self.assertEqual(response.status_code, 400)
        self.assertIn("أخفِه", response.data["error"]["message"])
        self.assertTrue(Category.objects.filter(pk=self.category.id).exists())

    def test_deleting_a_parent_before_its_children_is_refused(self):
        response = self.client.delete(f"{URL}/{self.parent.id}")
        self.assertEqual(response.status_code, 400)

    def test_an_unused_category_deletes_cleanly(self):
        created = self.client.post(URL, {"name_ar": "قسم فارغ"}, format="json")
        response = self.client.delete(f"{URL}/{created.data['id']}")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Category.objects.filter(pk=created.data["id"]).exists())
