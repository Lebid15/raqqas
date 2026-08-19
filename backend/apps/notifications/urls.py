from django.urls import path

from . import views

urlpatterns = [
    path("notifications", views.notification_list, name="notifications"),
    path("notifications/unread", views.unread_count, name="notifications-unread"),
    path("notifications/read", views.mark_read, name="notifications-read"),
]
