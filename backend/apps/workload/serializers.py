from rest_framework import serializers
from .models import (
    Yuklama, Monitoring, Reja, DlMdBiriktirma, AcademicYear,
    WorkloadType, WorkloadNorm, Assignment, Approval,
    PositionNorm,
)
from apps.academics.serializers import SubjectSerializer, GroupSerializer, DakSerializer, DlMdSerializer
from apps.teachers.models import Teacher
from apps.departments.models import Department


class DlMdBiriktirmaSerializer(serializers.ModelSerializer):
    """DL/MD biriktirma — frontend camelCase nomlari bilan."""
    oqituvchiId = serializers.PrimaryKeyRelatedField(source='teacher', queryset=Teacher.objects.all())
    kafedraId = serializers.PrimaryKeyRelatedField(source='department', queryset=Department.objects.all())
    talimShakli = serializers.CharField(source='talim_shakli', required=False, allow_blank=True)
    talabaSoni = serializers.IntegerField(source='talaba_soni', required=False)
    soatBirligi = serializers.IntegerField(source='soat_birligi', required=False)
    jamiSoat = serializers.IntegerField(source='jami_soat', required=False)
    oquvYili = serializers.CharField(source='oquv_yili', required=False, allow_blank=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='edited_at', read_only=True)
    oqituvchi = serializers.SerializerMethodField(read_only=True)
    kafedra = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = DlMdBiriktirma
        fields = ['id', 'oqituvchiId', 'kafedraId', 'tur', 'talimShakli', 'semestr',
                  'talabaSoni', 'soatBirligi', 'jamiSoat', 'oquvYili', 'oqituvchi',
                  'kafedra', 'createdAt', 'updatedAt']

    def get_oqituvchi(self, obj):
        t = obj.teacher
        if not t:
            return None
        return {
            'id': str(t.id), 'fio': t.full_name, 'kafedraId': str(obj.department_id),
            'lavozim': t.position, 'ilmiyDaraja': t.degree, 'ilmiyUnvon': t.academic_title,
        }

    def get_kafedra(self, obj):
        dep = obj.department
        if not dep:
            return None
        fac = getattr(dep, 'faculty', None)
        otm = getattr(fac, 'otm', None) if fac else None
        return {
            'id': str(dep.id), 'nomi': dep.name,
            'fakultet': {
                'id': str(fac.id), 'nomi': fac.name, 'otmId': str(otm.id) if otm else '',
                'otm': {'id': str(otm.id), 'nomi': otm.name, 'qisqaNomi': otm.short_name} if otm else None,
            } if fac else None,
        }


class YuklamaSerializer(serializers.ModelSerializer):
    # O'qishda bog'liq jadvallarning to'liq ma'lumoti (nested, read-only).
    # Yozishda esa oddiy PK maydonlari (subject, group, dak, dl_md, department)
    # '__all__' orqali ishlatiladi.
    subject = SubjectSerializer(read_only=True)
    group = GroupSerializer(read_only=True)
    dak = DakSerializer(read_only=True)
    dl_md = DlMdSerializer(read_only=True)
    department = serializers.SerializerMethodField(read_only=True)

    # Yozish uchun PK maydonlari (subject_id=..., group_id=... ko'rinishida)
    subject_id = serializers.PrimaryKeyRelatedField(
        source='subject', queryset=Yuklama._meta.get_field('subject').related_model.objects.all(),
        required=False, allow_null=True, write_only=True,
    )
    group_id = serializers.PrimaryKeyRelatedField(
        source='group', queryset=Yuklama._meta.get_field('group').related_model.objects.all(),
        required=False, allow_null=True, write_only=True,
    )
    dak_id = serializers.PrimaryKeyRelatedField(
        source='dak', queryset=Yuklama._meta.get_field('dak').related_model.objects.all(),
        required=False, allow_null=True, write_only=True,
    )
    dl_md_id = serializers.PrimaryKeyRelatedField(
        source='dl_md', queryset=Yuklama._meta.get_field('dl_md').related_model.objects.all(),
        required=False, allow_null=True, write_only=True,
    )
    department_id = serializers.PrimaryKeyRelatedField(
        source='department', queryset=Yuklama._meta.get_field('department').related_model.objects.all(),
        required=False, allow_null=True, write_only=True,
    )

    class Meta:
        model = Yuklama
        fields = '__all__'

    def get_department(self, obj):
        d = obj.department
        if not d:
            return None
        return {'id': d.id, 'nomi': d.name, 'faculty_id': d.faculty_id}


class MonitoringSerializer(serializers.ModelSerializer):
    class Meta:
        model = Monitoring
        fields = '__all__'


class AcademicYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicYear
        fields = ['id', 'name', 'starts_on', 'ends_on', 'is_active']


class WorkloadTypeSerializer(serializers.ModelSerializer):
    bandRaqami = serializers.IntegerField(source='clause_number')
    kod = serializers.CharField(source='code')
    nomi = serializers.CharField(source='name')
    formulaIfoda = serializers.CharField(source='formula_expression', allow_blank=True, required=False)
    hisobSoatbay = serializers.BooleanField(source='is_hourly', required=False)
    faol = serializers.BooleanField(source='is_active', required=False)
    normativlarSoni = serializers.IntegerField(source='norms.count', read_only=True)

    class Meta:
        model = WorkloadType
        fields = ['id', 'bandRaqami', 'kod', 'nomi', 'formulaIfoda',
                  'hisobSoatbay', 'faol', 'normativlarSoni']


class WorkloadNormSerializer(serializers.ModelSerializer):
    yuklamaTuriId = serializers.PrimaryKeyRelatedField(
        source='workload_type', queryset=WorkloadType.objects.all(),
    )
    otmProfil = serializers.CharField(source='institution_profile')
    koeffitsient = serializers.FloatField(source='coefficient')
    limitMin = serializers.IntegerField(source='minimum', allow_null=True, required=False)
    limitMax = serializers.IntegerField(source='maximum', allow_null=True, required=False)
    amalBoshi = serializers.DateField(source='valid_from')
    amalOxiri = serializers.DateField(source='valid_until', allow_null=True, required=False)
    izoh = serializers.CharField(source='note', allow_blank=True, allow_null=True, required=False)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = WorkloadNorm
        fields = ['id', 'yuklamaTuriId', 'otmProfil', 'koeffitsient',
                  'limitMin', 'limitMax', 'amalBoshi', 'amalOxiri', 'izoh', 'createdAt']

    def validate(self, attrs):
        minimum = attrs.get('minimum', getattr(self.instance, 'minimum', None))
        maximum = attrs.get('maximum', getattr(self.instance, 'maximum', None))
        valid_from = attrs.get('valid_from', getattr(self.instance, 'valid_from', None))
        valid_until = attrs.get('valid_until', getattr(self.instance, 'valid_until', None))
        if minimum is not None and maximum is not None and minimum > maximum:
            raise serializers.ValidationError({'limitMax': "Maksimal qiymat minimal qiymatdan kichik bo'lmasligi kerak."})
        if valid_from and valid_until and valid_from > valid_until:
            raise serializers.ValidationError({'amalOxiri': "Tugash sanasi boshlanish sanasidan oldin bo'lmasligi kerak."})
        return attrs

    def validate_izoh(self, value):
        return value or ''


class PositionNormSerializer(serializers.ModelSerializer):
    oquvYili = serializers.CharField(source='academic_year.name', read_only=True)
    lavozim = serializers.CharField(source='position')
    minimum = serializers.IntegerField(source='minimum_hours')
    maximum = serializers.IntegerField(source='maximum_hours')

    class Meta:
        model = PositionNorm
        fields = ['id', 'lavozim', 'oquvYili', 'minimum', 'maximum']


class AssignmentSerializer(serializers.ModelSerializer):
    rejaId = serializers.PrimaryKeyRelatedField(source='reja', queryset=Reja.objects.all())
    yuklamaTuriId = serializers.PrimaryKeyRelatedField(source='workload_type', queryset=WorkloadType.objects.all())
    fanId = serializers.PrimaryKeyRelatedField(source='subject', queryset=Yuklama._meta.get_field('subject').related_model.objects.all(), allow_null=True, required=False)
    guruhId = serializers.PrimaryKeyRelatedField(source='group', queryset=Yuklama._meta.get_field('group').related_model.objects.all(), allow_null=True, required=False)
    semesterRaqami = serializers.IntegerField(source='semester_number')
    soat = serializers.FloatField(source='hours')
    hisobTuri = serializers.CharField(source='calculation_type', required=False)
    formulaInput = serializers.JSONField(source='formula_input', required=False)
    izoh = serializers.CharField(source='note', allow_blank=True, allow_null=True, required=False)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    yuklamaTuri = WorkloadTypeSerializer(source='workload_type', read_only=True)
    fan = SubjectSerializer(source='subject', read_only=True)
    guruh = GroupSerializer(source='group', read_only=True)

    class Meta:
        model = Assignment
        fields = ['id', 'rejaId', 'yuklamaTuriId', 'fanId', 'guruhId',
                  'semesterRaqami', 'soat', 'hisobTuri', 'formulaInput', 'izoh',
                  'createdAt', 'yuklamaTuri', 'fan', 'guruh']

    def validate_izoh(self, value):
        return value or ''


class ApprovalSerializer(serializers.ModelSerializer):
    rejaId = serializers.PrimaryKeyRelatedField(source='reja', queryset=Reja.objects.all())
    bosqich = serializers.CharField(source='stage')
    holat = serializers.CharField(source='state', required=False)
    izoh = serializers.CharField(source='comment', allow_blank=True, allow_null=True, required=False)
    tasdiqlaganAt = serializers.DateTimeField(source='acted_at', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = Approval
        fields = ['id', 'rejaId', 'bosqich', 'holat', 'izoh', 'tasdiqlaganAt', 'createdAt']
        validators = []

    def validate_izoh(self, value):
        return value or ''


# Yuklama soat ustunlari -> topshiriq turi nomi
_TURI_FIELDS = [
    ('maruza_jami', "Ma'ruza"),
    ('amaliy_jami', "Amaliyot"),
    ('laboratoriya_jami', "Laboratoriya"),
]


class RejaSerializer(serializers.ModelSerializer):
    # Frontend camelCase nomlari bilan ishlaydi
    oqituvchiId = serializers.PrimaryKeyRelatedField(
        source='teacher', queryset=Teacher.objects.all(), required=False, allow_null=True,
    )
    departmentId = serializers.PrimaryKeyRelatedField(
        source='department', queryset=Department.objects.all(),
        required=False, allow_null=True, write_only=True,
    )
    oquvYiliNomi = serializers.CharField(source='oquv_yili', required=False, allow_blank=True)
    jamiSoat = serializers.IntegerField(source='jami_soat', required=False)
    fio = serializers.SerializerMethodField(read_only=True)
    oqituvchi = serializers.SerializerMethodField(read_only=True)
    kafedraId = serializers.SerializerMethodField(read_only=True)
    topshiriqlar = serializers.SerializerMethodField(read_only=True)
    data = serializers.JSONField(required=False)

    class Meta:
        model = Reja
        fields = ['id', 'oqituvchiId', 'departmentId', 'kafedraId', 'oquvYiliNomi',
                  'jamiSoat', 'status', 'fio', 'oqituvchi', 'topshiriqlar', 'data',
                  'created_at', 'edited_at']

    def get_fio(self, obj):
        return obj.teacher.full_name if obj.teacher else ''

    def get_kafedraId(self, obj):
        return obj.department_id

    def get_oqituvchi(self, obj):
        """Shablon (titul) uchun o'qituvchi + kafedra/fakultet/OTM ma'lumotlari."""
        t = obj.teacher
        dep = obj.department
        fac = getattr(dep, 'faculty', None) if dep else None
        otm = getattr(fac, 'otm', None) if fac else None
        return {
            'fio': t.full_name if t else '',
            'lavozim': t.position if t else '',
            'ilmiyDaraja': t.degree if t else '',
            'stavka': t.rate if t else '',
            'kafedraNomi': dep.name if dep else '',
            'fakultetNomi': fac.name if fac else '',
            'otmNomi': otm.name if otm else '',
            'otmQisqaNomi': otm.short_name if otm else '',
        }

    def get_topshiriqlar(self, obj):
        """Kafedra yuklama_data (kuzgi+bahorgi) dan topshiriqlar ro'yxatini yasaydi."""
        assignments = obj.assignments.select_related('workload_type', 'subject', 'group').all()
        if assignments.exists():
            return AssignmentSerializer(assignments, many=True).data
        data = obj.data if isinstance(obj.data, dict) else {}
        rows = list(data.get('kuzgi', []) or []) + list(data.get('bahorgi', []) or [])
        out, idx = [], 0
        for r in rows:
            fan_nomi = r.get('fan_nomi') or ''
            sem = r.get('semestr')
            for field, turi_nomi in _TURI_FIELDS:
                soat = r.get(field) or 0
                if soat:
                    idx += 1
                    out.append({
                        'id': f'auto-{idx}',
                        'yuklamaTuriId': field,
                        'yuklamaTuri': {'nomi': turi_nomi},
                        'fanId': None,
                        'fan': {'nomi': fan_nomi} if fan_nomi else None,
                        'semesterRaqami': sem,
                        'soat': soat,
                    })
        return out
