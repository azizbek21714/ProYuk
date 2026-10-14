from rest_framework import serializers
from .models import OTM, Faculty, Department


class OTMSerializer(serializers.ModelSerializer):
    class Meta:
        model = OTM
        fields = ['id', 'name', 'short_name', 'edited_at', 'created_at']


class FacultySerializer(serializers.ModelSerializer):
    # Frontend "otmId" yoki "otm" yuborishi mumkin
    otmId = serializers.PrimaryKeyRelatedField(
        source='otm',
        queryset=OTM.objects.all(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = Faculty
        fields = ['id', 'name', 'otm', 'otmId', 'dean', 'edited_at', 'created_at']

    def validate(self, attrs):
        if 'otm' not in attrs and not self.instance:
            raise serializers.ValidationError({'otm': 'Bu maydon majburiy.'})
        return attrs


class DepartmentSerializer(serializers.ModelSerializer):
    # Frontend "fakultetId" yoki "faculty" yuborishi mumkin
    fakultetId = serializers.PrimaryKeyRelatedField(
        source='faculty',
        queryset=Faculty.objects.all(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = Department
        fields = ['id', 'name', 'faculty', 'fakultetId', 'head_of_department', 'teachers', 'yillik_yuklama', 'yuklama_data', 'edited_at', 'created_at']

    def validate(self, attrs):
        if 'faculty' not in attrs and not self.instance:
            raise serializers.ValidationError({'faculty': 'Bu maydon majburiy.'})
        return attrs
