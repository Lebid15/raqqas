from django.apps import AppConfig


class ListingsConfig(AppConfig):
    name = "apps.listings"
    label = "listings"
    verbose_name = "الإعلانات"

    def ready(self):
        from . import signals  # noqa: F401
