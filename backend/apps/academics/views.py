from rest_framework import viewsets
from .models import Subject, Group, DlMd, Practise, Dak, SubjectGroup
from .serializers import (
    SubjectSerializer,
    GroupSerializer,
    DlMdSerializer,
    PractiseSerializer,
    DakSerializer,
    SubjectGroupSerializer,
)


class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        kafedra_id = self.request.query_params.get('kafedraId')
        if kafedra_id:
            qs = qs.filter(department_id=kafedra_id)
        return qs


class GroupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.all()
    serializer_class = GroupSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get('kafedraId'):
            qs = qs.filter(department_id=params['kafedraId'])
        if params.get('fakultetId'):
            qs = qs.filter(department__faculty_id=params['fakultetId'])
        if params.get('otmId'):
            qs = qs.filter(department__faculty__otm_id=params['otmId'])
        if params.get('kurs'):
            kurs = params['kurs']
            qs = qs.filter(course=kurs if str(kurs).startswith('course_') else f'course_{kurs}')
        return qs


class DlMdViewSet(viewsets.ModelViewSet):
    queryset = DlMd.objects.all()
    serializer_class = DlMdSerializer


class PractiseViewSet(viewsets.ModelViewSet):
    queryset = Practise.objects.all()
    serializer_class = PractiseSerializer


class DakViewSet(viewsets.ModelViewSet):
    queryset = Dak.objects.all()
    serializer_class = DakSerializer


class SubjectGroupViewSet(viewsets.ModelViewSet):
    queryset = SubjectGroup.objects.select_related('subject', 'group').all()
    serializer_class = SubjectGroupSerializer
