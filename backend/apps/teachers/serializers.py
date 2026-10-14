from rest_framework import serializers
from .models import Teacher, TeacherSubject, TeacherGroup


class TeacherSerializer(serializers.ModelSerializer):
    class Meta:
        model = Teacher
        fields = '__all__'


class TeacherSubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherSubject
        fields = '__all__'


class TeacherGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherGroup
        fields = '__all__'
