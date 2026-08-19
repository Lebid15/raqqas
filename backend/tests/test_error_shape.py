"""
شكل رسائل الخطأ.

اكتُشف على الخادم الحيّ: رسالة خطأ الدخول كانت تصل للمستخدم هكذا
    [ErrorDetail(string='رقم الهاتف أو كلمة المرور غير صحيحة.', code='invalid')]
بدل النصّ نفسه. الاختبارات هنا تمنع رجوع ذلك.
"""

from .test_access_rules import BaseAPITest


class ErrorMessageTests(BaseAPITest):
    def test_login_error_is_plain_arabic_text(self):
        response = self.guest.post(
            "/api/v1/auth/login",
            {"phone": self.seller.phone, "password": "wrong-password"},
            format="json",
        )
        message = response.data["error"]["message"]

        self.assertEqual(message, "رقم الهاتف أو كلمة المرور غير صحيحة.")
        self.assertNotIn("ErrorDetail", message)
        self.assertNotIn("[", message)
        self.assertNotIn("code=", message)

    def test_field_errors_are_lists_of_plain_strings(self):
        response = self.guest.post(
            "/api/v1/auth/register",
            {"name": "ا", "phone": "123", "password": "1"},
            format="json",
        )
        fields = response.data["error"]["fields"]

        self.assertTrue(fields)
        for name, messages in fields.items():
            self.assertIsInstance(messages, list, name)
            for message in messages:
                self.assertIsInstance(message, str, name)
                self.assertNotIn("ErrorDetail", message)

    def test_not_found_message_is_clean(self):
        response = self.guest.get("/api/v1/listings/999999")
        self.assertEqual(response.status_code, 404)
        self.assertNotIn("ErrorDetail", response.data["error"]["message"])

    def test_permission_error_is_clean(self):
        client = self.as_user(self.buyer)
        response = client.get("/api/v1/admin/dashboard")
        self.assertEqual(response.status_code, 403)
        message = response.data["error"]["message"]
        self.assertEqual(message, "هذا الإجراء متاح للإدارة فقط.")
        self.assertNotIn("ErrorDetail", message)

    def test_daily_limit_message_reaches_the_user(self):
        from apps.core.models import AppConfig

        config = AppConfig.get_solo()
        config.daily_listing_limit = 1
        config.save()

        client = self.as_user(self.buyer)
        payload = {
            "title": "شيء للبيع بعنوان كافٍ",
            "description": "وصف كافٍ للاختبار هنا.",
            "price": 100,
            "condition": "used",
            "category": self.category.id,
            "city": self.city.id,
        }
        self.assertEqual(client.post("/api/v1/listings", payload, format="json").status_code, 201)

        blocked = client.post("/api/v1/listings", payload, format="json")
        self.assertEqual(blocked.status_code, 400)
        message = blocked.data["error"]["message"]
        self.assertIn("الحد اليومي", message)
        self.assertNotIn("ErrorDetail", message)
