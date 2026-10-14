from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.departments.views import OTMViewSet, FacultyViewSet, DepartmentViewSet
from apps.academics.views import SubjectViewSet, GroupViewSet, DlMdViewSet
from apps.teachers.views import TeacherViewSet
from apps.workload.views import (
    KafedraYuklamaViewSet,
    RejaViewSet,
    TopshiriqViewSet,
    TasdiqlashViewSet,
    NormativViewSet,
    DlMdBiriktirmaViewSet,
    YuklamaExcelImportView,
    FanlarShakllantirView,
)

router = DefaultRouter()

# Tashkilot tuzilmasi
router.register(r'otm', OTMViewSet, basename='otm')
router.register(r'fakultetlar', FacultyViewSet, basename='fakultetlar')
router.register(r'kafedralar', DepartmentViewSet, basename='kafedralar')
router.register(r'guruhlar', GroupViewSet, basename='guruhlar')
router.register(r'fanlar', SubjectViewSet, basename='fanlar')

# Yuklama
router.register(r'kafedra-yuklama', KafedraYuklamaViewSet, basename='kafedra-yuklama')
# DL/MD biriktirma (o'qituvchiga diplom/dissertatsiya rahbarligi)
router.register(r'dl-md', DlMdBiriktirmaViewSet, basename='dl-md')
# Eski DlMd (fan turlari) — boshqa nom ostida qoldiriladi
router.register(r'dlmd-turlari', DlMdViewSet, basename='dlmd-turlari')

# Shaxsiy reja va tasdiqlash
router.register(r'rejalar', RejaViewSet, basename='rejalar')
router.register(r'topshiriqlar', TopshiriqViewSet, basename='topshiriqlar')
router.register(r'tasdiqlash', TasdiqlashViewSet, basename='tasdiqlash')

# Normativlar
router.register(r'normativlar', NormativViewSet, basename='normativlar')
router.register(r'oqituvchilar', TeacherViewSet, basename='oqituvchilar')

urlpatterns = [
    # Excel import (O'quv yuklamasi hajmi) — semestrlarga ajratib qaytaradi
    path('yuklama-excel/', YuklamaExcelImportView.as_view(), name='yuklama-excel'),
    path('fanlar-shakllantir/', FanlarShakllantirView.as_view(), name='fanlar-shakllantir'),
    path('', include(router.urls)),
]
