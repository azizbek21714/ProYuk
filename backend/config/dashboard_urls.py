from django.urls import path
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from apps.teachers.models import Teacher
from apps.workload.models import Reja, DlMdBiriktirma, PositionNorm, AcademicYear, Approval
from apps.workload.dashboard import teacher_dashboard_data
from apps.workload.norms import default_position_norm, scaled_position_norm
from apps.workload.services import reja_fan_hours
from config.permissions import IsApplicationAdmin


def _position_norm(position, academic_year, rate='rate_1'):
    norm = PositionNorm.objects.filter(
        position=position, academic_year__name=academic_year,
    ).first()
    if norm is None:
        norm = PositionNorm.objects.filter(
            position=position, academic_year__is_active=True,
        ).first()
    minimum, maximum = ((norm.minimum_hours, norm.maximum_hours)
                        if norm else default_position_norm(position))
    return scaled_position_norm(minimum, maximum, rate)


@api_view(['GET'])
@permission_classes([IsApplicationAdmin])
def stats(request):
    teachers = Teacher.objects.count()
    rejalar = Reja.objects.select_related('teacher').all()

    # DL/MD biriktirma soatlari (o'qituvchi bo'yicha)
    dlmd_map = {
        (row['teacher_id'], row['oquv_yili']): row['s'] or 0
        for row in DlMdBiriktirma.objects.values('teacher_id', 'oquv_yili').annotate(s=Sum('jami_soat'))
    }
    legacy_dlmd_map = {
        row['teacher_id']: row['s'] or 0
        for row in DlMdBiriktirma.objects.filter(oquv_yili='')
        .values('teacher_id').annotate(s=Sum('jami_soat'))
    }

    bar = []
    past_count = 0
    for r in rejalar:
        t = r.teacher
        fio = t.full_name if t else ''
        parts = fio.split()
        short = (parts[0] + ' ' + parts[1][0] + '.') if len(parts) >= 2 else fio
        lavozim = t.position if t else ''
        min_norm, max_norm = _position_norm(lavozim, r.oquv_yili, t.rate if t else 'rate_1')
        # Haqiqiy yuklama: fanlar + DL/MD soatlari
        fan_total = reja_fan_hours(r)
        dlmd_total = (
            dlmd_map.get((r.teacher_id, r.oquv_yili), 0)
            + legacy_dlmd_map.get(r.teacher_id, 0)
        ) if t else 0
        soat = fan_total + Decimal(dlmd_total)
        if soat < min_norm:
            past_count += 1
        bar.append({
            'id': str(r.id),
            'fio': fio,
            'shortName': short,
            'jamiSoat': float(soat),
            'lavozim': lavozim,
            'minNorm': min_norm,
            'maxNorm': max_norm,
        })
    pending = Approval.objects.filter(state='kutilmoqda').select_related(
        'reja__teacher', 'reja__department',
    ).order_by('created_at')[:20]
    recent_approvals = Approval.objects.exclude(acted_at__isnull=True).select_related(
        'acted_by',
    ).order_by('-acted_at')[:20]
    return Response({
        'stats': {
            'jamiOqituvchilar': teachers,
            'tasdiqlanganRejalar': rejalar.filter(status='tasdiqlangan').count(),
            'kutilayotganTasdiqlar': Approval.objects.filter(state='kutilmoqda').count(),
            'pastYuklamalarSoni': past_count,
        },
        'barChartData': bar,
        'kutilayotganAmallar': [{
            'rejaId': str(item.reja_id), 'bosqich': item.stage,
            'oqituvchiFio': item.reja.teacher.full_name if item.reja.teacher else '',
            'kafedraNomi': item.reja.department.name if item.reja.department else None,
            'oquvYiliNomi': item.reja.oquv_yili,
            'createdAt': item.created_at.isoformat(),
            'kunSoni': (timezone.now().date() - item.created_at.date()).days,
        } for item in pending],
        'auditLogs': [{
            'id': str(item.pk), 'tableName': 'tasdiqlash',
            'action': 'tasdiqlash' if item.state == 'tasdiqlangan' else 'rad_etish',
            'kimFio': item.acted_by.get_full_name() or item.acted_by.username if item.acted_by else '',
            'kimRole': 'admin', 'rowId': str(item.reja_id),
            'sana': item.acted_at.isoformat(),
        } for item in recent_approvals],
    })


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def teacher_dashboard(request):
    if request.method == 'GET' and request.query_params.get('document') == '1':
        from django.shortcuts import get_object_or_404
        from apps.workload.serializers import RejaSerializer
        teacher = getattr(request.user, 'teacher_profile', None)
        reja = get_object_or_404(
            Reja.objects.select_related(
                'teacher', 'department', 'department__faculty', 'department__faculty__otm',
            ).prefetch_related('assignments__workload_type', 'assignments__subject',
                               'assignments__group', 'approvals'),
            pk=request.query_params.get('rejaId'), teacher=teacher,
        )
        return Response(RejaSerializer(reja).data)
    if request.method == 'PATCH':
        from apps.workload.models import Assignment
        from django.shortcuts import get_object_or_404
        from rest_framework import serializers
        if request.data.get('action') == 'save_personal_plan':
            class PersonalDocInput(serializers.Serializer):
                uslubiy = serializers.ListField(child=serializers.DictField(), max_length=200)
                ilmiy = serializers.ListField(child=serializers.DictField(), max_length=200)
                ustozShogird = serializers.ListField(child=serializers.DictField(), max_length=200)
                reyting = serializers.DictField()
                dekan = serializers.CharField(required=False, allow_blank=True, max_length=255)
                bayonnomaYil = serializers.CharField(required=False, allow_blank=True, max_length=20)
                bayonnomaSana = serializers.CharField(required=False, allow_blank=True, max_length=50)
                bayonnomaRaqam = serializers.CharField(required=False, allow_blank=True, max_length=50)
                xulosaKafedra = serializers.CharField(required=False, allow_blank=True, max_length=2000)
                xulosaKengash = serializers.CharField(required=False, allow_blank=True, max_length=2000)

            class PersonalPlanInput(serializers.Serializer):
                action = serializers.ChoiceField(choices=['save_personal_plan'])
                rejaId = serializers.IntegerField(min_value=1)
                activeStavka = serializers.ChoiceField(choices=['rate_1', 'rate_0_5', 'rate_0_25'])
                variants = serializers.DictField()

                def validate_variants(self, value):
                    clean = {}
                    for rate, doc in value.items():
                        if rate not in ('rate_1', 'rate_0_5', 'rate_0_25'):
                            raise serializers.ValidationError('Noto\'g\'ri stavka turi.')
                        nested = PersonalDocInput(data=doc)
                        nested.is_valid(raise_exception=True)
                        clean[rate] = nested.validated_data
                    return clean

            payload = PersonalPlanInput(data=request.data)
            payload.is_valid(raise_exception=True)
            teacher = getattr(request.user, 'teacher_profile', None)
            reja = get_object_or_404(Reja, pk=payload.validated_data['rejaId'], teacher=teacher)
            teacher_rate = teacher.rate
            allowed_rates = ('rate_1', 'rate_0_5') if teacher_rate == 'rate_1_5' else (
                ('rate_0_25',) if '0_25' in teacher_rate else
                ('rate_0_5',) if '0_5' in teacher_rate else ('rate_1',)
            )
            submitted = payload.validated_data['variants']
            if not submitted or any(rate not in allowed_rates for rate in submitted):
                return Response({'detail': 'Bu stavkani tahrirlashga ruxsat yo\'q.'}, status=403)

            plan_data = dict(reja.data) if isinstance(reja.data, dict) else {}
            raw_variants = plan_data.get('variants')
            if not isinstance(raw_variants, dict):
                legacy_rate = 'rate_0_5' if plan_data.get('stavka') == 'rate_0_5' else 'rate_1'
                raw_variants = {
                    legacy_rate: {
                        'fanlar': plan_data.get('fanlar', []),
                        'doc': plan_data.get('doc', {}),
                    },
                }
            variants = dict(raw_variants)
            for rate, personal_doc in submitted.items():
                variant = dict(variants.get(rate, {})) if isinstance(variants.get(rate), dict) else {}
                old_doc = variant.get('doc', {})
                merged_doc = dict(old_doc) if isinstance(old_doc, dict) else {}
                merged_doc.update(personal_doc)
                variant['doc'] = merged_doc
                variants[rate] = variant
            plan_data['variants'] = variants
            plan_data['stavka'] = payload.validated_data['activeStavka']
            plan_data.pop('fanlar', None)
            plan_data.pop('doc', None)
            reja.data = plan_data
            reja.save(update_fields=['data', 'edited_at'])
            return Response({'detail': 'Saqlandi'})

        class LessonTypeInput(serializers.Serializer):
            id = serializers.IntegerField(min_value=1)
            mashgulotTuri = serializers.ChoiceField(choices=Assignment._meta.get_field('lesson_type').choices, allow_blank=True)
        data = LessonTypeInput(data=request.data)
        data.is_valid(raise_exception=True)
        item = get_object_or_404(Assignment.objects.select_related('reja'),
                                 pk=data.validated_data['id'], reja__teacher__user=request.user)
        if not item.subject_id or item.reja.status not in ('loyiha', 'rad_etilgan'):
            return Response({'detail': "Bu yuklamaning mashg'ulot turini o'zgartirish mumkin emas."}, status=403)
        item.lesson_type = data.validated_data['mashgulotTuri']
        item.save(update_fields=['lesson_type'])
        return Response({'id': str(item.pk), 'mashgulotTuri': item.lesson_type})
    return Response(teacher_dashboard_data(request.user))


urlpatterns = [
    path('stats/', stats),
]

teacher_urlpatterns = [
    path('dashboard/', teacher_dashboard),
]
