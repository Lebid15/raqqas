from django.urls import path

from . import update_views, views

urlpatterns = [
    path("health", views.health, name="health"),
    path("app-config", views.AppConfigView.as_view(), name="app-config"),
    path("theme-presets", views.theme_presets, name="theme-presets"),
    path("downloads/track", views.track_download, name="track-download"),
    # لوحة الإدارة
    path("admin/app-config", views.AdminAppConfigView.as_view(), name="admin-app-config"),
    path("admin/theme-check", views.theme_check, name="admin-theme-check"),
    # التحديث عن بُعد
    path("updates/manifest", update_views.manifest, name="ota-manifest"),
    path("admin/updates", update_views.update_list, name="admin-updates"),
    path("admin/updates/<int:pk>/activate", update_views.activate_update,
         name="admin-activate-update"),
]
