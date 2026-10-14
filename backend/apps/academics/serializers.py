from rest_framework import serializers
from .models import Subject, Group, DlMd, Practise, Dak, SubjectGroup


class SubjectSerializer(serializers.ModelSerializer):
    # Read-only nested kafedra chain (kafedra -> fakultet -> otm) for the UI cascade.
    # Write uses the plain `department` PK field (included via '__all__').
    kafedra = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Subject
        fields = '__all__'

    def get_kafedra(self, obj):
        d = obj.department
        if not d:
            return None
        fak = d.faculty
        return {
            'id': d.id,
            'nomi': d.name,
            'fakultet': {
                'id': fak.id,
                'nomi': fak.name,
                'otmId': fak.otm_id,
            } if fak else None,
        }


class GroupSerializer(serializers.ModelSerializer):
    # Read-only nested kafedra chain (kafedra -> fakultet -> otm) for the UI.
    # Write uses the plain `department` PK field (included via '__all__').
    kafedra = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Group
        fields = '__all__'

    def get_kafedra(self, obj):
        d = obj.department
        if not d:
            return None
        fak = d.faculty
        return {
            'id': d.id,
            'nomi': d.name,
            'fakultet': {
                'id': fak.id,
                'nomi': fak.name,
                'otmId': fak.otm_id,
            } if fak else None,
        }


class DlMdSerializer(serializers.ModelSerializer):
    class Meta:
        model = DlMd
        fields = '__all__'


class PractiseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Practise
        fields = '__all__'


class DakSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dak
        fields = '__all__'


class SubjectGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubjectGroup
        fields = '__all__'
