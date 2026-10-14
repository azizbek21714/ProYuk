from rest_framework import viewsets
from .models import Teacher, TeacherSubject, TeacherGroup
from .serializers import TeacherSerializer, TeacherSubjectSerializer, TeacherGroupSerializer


class TeacherViewSet(viewsets.ModelViewSet):
    queryset = Teacher.objects.all()
    serializer_class = TeacherSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        # Kafedra (Department.teachers M2M, related_name='departments')
        if params.get('kafedraId'):
            qs = qs.filter(departments__id=params['kafedraId'])
        if params.get('fakultetId'):
            qs = qs.filter(departments__faculty_id=params['fakultetId'])
        if params.get('otmId'):
            qs = qs.filter(departments__faculty__otm_id=params['otmId'])
        # Stavka (rate)
        if params.get('rate'):
            qs = qs.filter(rate=params['rate'])
        return qs.distinct()


class TeacherSubjectViewSet(viewsets.ModelViewSet):
    queryset = TeacherSubject.objects.select_related('teacher', 'subject').all()
    serializer_class = TeacherSubjectSerializer


class TeacherGroupViewSet(viewsets.ModelViewSet):
    queryset = TeacherGroup.objects.select_related('teacher', 'group').all()
    serializer_class = TeacherGroupSerializer
