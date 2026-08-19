from django.apps import AppConfig as DjangoAppConfig


class CoreConfig(DjangoAppConfig):
    name = "apps.core"
    label = "core"
    verbose_name = "الأساسيات والإعدادات"
