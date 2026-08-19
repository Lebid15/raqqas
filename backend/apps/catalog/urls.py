from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter(trailing_slash=False)
router.register("admin/categories", views.AdminCategoryViewSet, basename="admin-category")
router.register("admin/cities", views.AdminCityViewSet, basename="admin-city")
router.register("admin/neighborhoods", views.AdminNeighborhoodViewSet, basename="admin-neighborhood")

urlpatterns = [
    path("categories", views.category_tree, name="categories"),
    path("cities", views.city_tree, name="cities"),
    path("neighborhoods", views.neighborhoods, name="neighborhoods"),
    path("", include(router.urls)),
]
