from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import KafedraYuklamaViewSet, RejaViewSet, TopshiriqViewSet, TasdiqlashViewSet, NormativViewSet

router = DefaultRouter()
router.register(r'kafedra-yuklama', KafedraYuklamaViewSet, basename='kafedra-yuklama')
router.register(r'rejalar', RejaViewSet, basename='rejalar')
router.register(r'topshiriqlar', TopshiriqViewSet, basename='topshiriqlar')
router.register(r'tasdiqlash', TasdiqlashViewSet, basename='tasdiqlash')
router.register(r'normativlar', NormativViewSet, basename='normativlar')

urlpatterns = [
    path('', include(router.urls)),
]
