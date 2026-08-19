from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path("register", views.RegisterView.as_view(), name="register"),
    path("login", views.LoginView.as_view(), name="login"),
    path("refresh", TokenRefreshView.as_view(), name="token-refresh"),
    path("logout", views.logout, name="logout"),
    path("me", views.MeView.as_view(), name="me"),
    path("password", views.change_password, name="change-password"),
    path("device", views.register_device, name="register-device"),
    path("check-phone", views.check_phone, name="check-phone"),

    # حذف الحساب — مساران إلزاميان في Google Play: داخل التطبيق وعبر الويب
    path("me/delete", views.delete_my_account, name="delete-my-account"),
    path("delete-account", views.delete_account_web, name="delete-account-web"),

    # حظر المعلنين — متطلّب سياسة المحتوى من المستخدمين
    path("blocks", views.blocks, name="blocks"),
    path("blocks/<int:user_id>", views.unblock, name="unblock"),
]
