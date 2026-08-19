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
]
