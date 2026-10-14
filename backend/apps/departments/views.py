from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import OTM, Faculty, Department
from .serializers import OTMSerializer, FacultySerializer, DepartmentSerializer


class OTMViewSet(viewsets.ModelViewSet):
    queryset = OTM.objects.all()
    serializer_class = OTMSerializer

    @action(detail=False, methods=['get', 'post'], url_path='hierarchy')
    def hierarchy(self, request):
        if request.method == 'GET':
            return self._hierarchy_get()
        return self._hierarchy_post(request)

    def _hierarchy_get(self):
        """OTM → Fakultet → Kafedra daraxt strukturasi"""
        data = []
        for otm in OTM.objects.prefetch_related('faculties__departments').all():
            faculties = []
            for faculty in otm.faculties.all():
                departments = list(faculty.departments.values('id', 'name', 'yillik_yuklama'))
                faculties.append({
                    'id': faculty.id,
                    'name': faculty.name,
                    'kafedralar': departments,
                })
            data.append({
                'id': otm.id,
                'name': otm.name,
                'short_name': otm.short_name,
                'fakultetlar': faculties,
            })
        return Response(data)

    def _hierarchy_post(self, request):
        """OTM + Fakultet + Kafedra birdan yaratish"""
        otm_nomi = request.data.get('otmNomi', '').strip()
        otm_qisqa = request.data.get('otmQisqaNomi', '').strip()
        fakultet_nomi = request.data.get('fakultetNomi', '').strip()
        kafedra_nomi = request.data.get('kafedraNomi', '').strip()

        if not all([otm_nomi, fakultet_nomi, kafedra_nomi]):
            return Response(
                {'detail': 'otmNomi, fakultetNomi va kafedraNomi majburiy.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otm, otm_created = OTM.objects.get_or_create(
            name=otm_nomi,
            defaults={'short_name': otm_qisqa},
        )
        fakultet, _ = Faculty.objects.get_or_create(
            name=fakultet_nomi,
            otm=otm,
        )
        kafedra, created = Department.objects.get_or_create(
            name=kafedra_nomi,
            faculty=fakultet,
        )

        return Response({
            'otm': {'id': otm.id, 'name': otm.name, 'short_name': otm.short_name},
            'fakultet': {'id': fakultet.id, 'name': fakultet.name},
            'kafedra': {'id': kafedra.id, 'name': kafedra.name},
            'created': created,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class FacultyViewSet(viewsets.ModelViewSet):
    queryset = Faculty.objects.select_related('otm', 'dean').all()
    serializer_class = FacultySerializer

    def get_queryset(self):
        qs = super().get_queryset()
        otm_id = self.request.query_params.get('otmId')
        if otm_id:
            qs = qs.filter(otm_id=otm_id)
        return qs


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.select_related('faculty', 'head_of_department').prefetch_related('teachers').all()
    serializer_class = DepartmentSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        fakultet_id = self.request.query_params.get('fakultetId')
        otm_id = self.request.query_params.get('otmId')
        if fakultet_id:
            qs = qs.filter(faculty_id=fakultet_id)
        if otm_id:
            qs = qs.filter(faculty__otm_id=otm_id)
        return qs
