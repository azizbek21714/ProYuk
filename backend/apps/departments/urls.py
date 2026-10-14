from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OTMViewSet, FacultyViewSet, DepartmentViewSet

router = DefaultRouter()
router.register(r'otm', OTMViewSet, basename='otm')
router.register(r'fakultetlar', FacultyViewSet, basename='fakultetlar')
router.register(r'kafedralar', DepartmentViewSet, basename='kafedralar')

urlpatterns = [
    path('', include(router.urls)),
]
