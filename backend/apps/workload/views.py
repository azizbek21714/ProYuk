from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from .models import (
    Yuklama, Monitoring, Reja, DlMdBiriktirma, WorkloadType,
    WorkloadNorm, Assignment, Approval, AcademicYear,
    PositionNorm,
)
from .serializers import (
    YuklamaSerializer, MonitoringSerializer, RejaSerializer, DlMdBiriktirmaSerializer,
    WorkloadTypeSerializer, WorkloadNormSerializer, AssignmentSerializer,
    ApprovalSerializer, AcademicYearSerializer,
    PositionNormSerializer,
)
from .excel_parser import parse_workload_excel
from .importer import import_rows_to_yuklama, build_subjects_from_data
from apps.departments.models import Department
from .services import sync_reja_assignments


ALLOWED_EXCEL_EXTENSIONS = ('.xlsx', '.xlsm', '.xls')
MAX_EXCEL_SIZE = 10 * 1024 * 1024  # 10 MB


class YuklamaExcelImportView(APIView):
    """O'QUV YUKLAMASI HAJMI Excel faylini qabul qilib, ma'lumotlarni
    kuzgi va bahorgi semestrlarga ajratib qaytaradi.

    POST /api/crud/yuklama-excel/  (multipart/form-data)
      file          - Excel fayl (.xlsx/.xlsm/.xls), majburiy
      save          - "true" bo'lsa ma'lumot Yuklama jadvaliga yoziladi
      department_id - (ixtiyoriy) qaysi kafedraga bog'lanadi

    save=true bo'lmasa — faqat o'qib, oldindan ko'rish (preview) qaytaradi.
    """

    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        if file_obj is None:
            return Response(
                {'detail': "Fayl yuborilmadi. 'file' maydonida Excel fayl yuboring."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        name = (file_obj.name or '').lower()
        if not name.endswith(ALLOWED_EXCEL_EXTENSIONS):
            return Response(
                {'detail': "Faqat .xlsx, .xlsm yoki .xls formatdagi Excel fayl qabul qilinadi."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if file_obj.size and file_obj.size > MAX_EXCEL_SIZE:
            return Response(
                {'detail': "Fayl hajmi 10 MB dan oshmasligi kerak."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            data = parse_workload_excel(file_obj)
        except Exception as exc:  # noqa: BLE001 - foydalanuvchiga toza xabar qaytaramiz
            return Response(
                {'detail': f"Faylni o'qishda xatolik: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data['counts'] = {
            'kuzgi': len(data['kuzgi']),
            'bahorgi': len(data['bahorgi']),
        }

        save_flag = str(request.data.get('save', '')).lower() in ('1', 'true', 'yes', 'ha')
        if save_flag:
            department = None
            dep_id = request.data.get('department_id') or request.query_params.get('department_id')
            if dep_id:
                department = Department.objects.filter(pk=dep_id).first()
                if department is None:
                    return Response(
                        {'detail': f"department_id={dep_id} bo'yicha kafedra topilmadi."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            with transaction.atomic():
                created = import_rows_to_yuklama(data, department=department)

                # Kafedra bo'lsa — shakllantirilgan yuklamani va yillik soatni saqlaymiz
                if department is not None:
                    department.yuklama_data = {
                        'meta': data['meta'],
                        'kuzgi': data['kuzgi'],
                        'bahorgi': data['bahorgi'],
                        'totals': data['totals'],
                    }
                    yillik = (data['totals'].get('yillik') or {}).get('jami')
                    if isinstance(yillik, (int, float)):
                        department.yillik_yuklama = int(yillik)
                    department.save(update_fields=['yuklama_data', 'yillik_yuklama', 'edited_at'])

            data['saved'] = True
            data['created'] = created
            data['created_counts'] = {
                'kuzgi': len(created['kuzgi']),
                'bahorgi': len(created['bahorgi']),
            }

        return Response(data, status=status.HTTP_200_OK)


class FanlarShakllantirView(APIView):
    """Kafedra yuklama_data sidan fanlarni (Subject) shakllantiradi (dedup bilan).

    POST /api/crud/fanlar-shakllantir/  body: { department_id }
    """

    def post(self, request, *args, **kwargs):
        dep_id = request.data.get('department_id') or request.data.get('departmentId')
        department = Department.objects.filter(pk=dep_id).first() if dep_id else None
        if department is None:
            return Response(
                {'detail': "department_id bo'yicha kafedra topilmadi."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        result = build_subjects_from_data(department)
        return Response(result, status=status.HTTP_200_OK)

    def delete(self, request, *args, **kwargs):
        """Kafedra yuklamasi va undan shakllangan barcha fanlarni o'chiradi."""
        from apps.academics.models import Subject
        dep_id = (request.query_params.get('department_id')
                  or request.query_params.get('departmentId')
                  or request.data.get('department_id'))
        department = Department.objects.filter(pk=dep_id).first() if dep_id else None
        if department is None:
            return Response(
                {'detail': "department_id bo'yicha kafedra topilmadi."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        sub_count = Subject.objects.filter(department=department).count()
        with transaction.atomic():
            Subject.objects.filter(department=department).delete()
            Yuklama.objects.filter(department=department).delete()
            department.yillik_yuklama = 0
            department.yuklama_data = {}
            department.save(update_fields=['yillik_yuklama', 'yuklama_data', 'edited_at'])
        return Response({'deleted_subjects': sub_count}, status=status.HTTP_200_OK)


class KafedraYuklamaViewSet(viewsets.ModelViewSet):
    queryset = Yuklama.objects.select_related(
        'department', 'department__faculty', 'group', 'subject',
        'subject__department', 'subject__department__faculty', 'dak', 'dl_md',
    ).all()
    serializer_class = YuklamaSerializer
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = super().get_queryset()
        kafedra_id = self.request.query_params.get('kafedraId')
        if kafedra_id:
            qs = qs.filter(department_id=kafedra_id)
        return qs


class RejaViewSet(viewsets.ModelViewSet):
    queryset = Reja.objects.select_related(
        'teacher', 'department', 'department__faculty', 'department__faculty__otm'
    ).prefetch_related(
        'assignments__workload_type', 'assignments__subject', 'assignments__group', 'approvals',
    ).all()
    serializer_class = RejaSerializer
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get('oqituvchiId'):
            qs = qs.filter(teacher_id=p['oqituvchiId'])
        oquv = p.get('oquvYili') or p.get('oquvYiliNomi')
        if oquv:
            qs = qs.filter(oquv_yili=oquv)
        kaf = p.get('departmentId') or p.get('kafedraId')
        if kaf:
            qs = qs.filter(department_id=kaf)
        return qs

    def create(self, request, *args, **kwargs):
        teacher_id = request.data.get('oqituvchiId')
        oquv_yili = request.data.get('oquvYiliNomi', '') or ''
        if teacher_id and Reja.objects.filter(teacher_id=teacher_id, oquv_yili=oquv_yili).exists():
            return Response({'detail': 'Bu o\'qituvchida shu o\'quv yili uchun reja mavjud'},
                            status=status.HTTP_409_CONFLICT)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        # Kafedra yuklama_data ni rejaga nusxalaymiz (ko'rish uchun)
        dep = obj.department
        if (not obj.data and dep is not None and isinstance(dep.yuklama_data, dict)
                and dep.yuklama_data):
            obj.data = dep.yuklama_data
            if not obj.jami_soat:
                obj.jami_soat = dep.yillik_yuklama or 0
            obj.save(update_fields=['data', 'jami_soat', 'edited_at'])
        sync_reja_assignments(obj)
        Approval.objects.bulk_create([
            Approval(reja=obj, stage=stage) for stage in ('kafedra', 'dekan', 'oquv_bolimi')
        ], ignore_conflicts=True)
        return Response(self.get_serializer(obj).data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        obj = serializer.save()
        sync_reja_assignments(obj)


class TopshiriqViewSet(viewsets.ModelViewSet):
    queryset = Assignment.objects.select_related('reja', 'workload_type', 'subject', 'group')
    serializer_class = AssignmentSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        reja_id = self.request.query_params.get('rejaId')
        return qs.filter(reja_id=reja_id) if reja_id else qs


class TasdiqlashViewSet(viewsets.ModelViewSet):
    queryset = Approval.objects.select_related('reja', 'acted_by')
    serializer_class = ApprovalSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        reja_id = self.request.query_params.get('rejaId')
        return qs.filter(reja_id=reja_id) if reja_id else qs

    def perform_create(self, serializer):
        state = serializer.validated_data.get('state', 'kutilmoqda')
        acted = state in ('tasdiqlangan', 'rad_etilgan')
        obj = serializer.save(
            acted_by=self.request.user if acted else None,
            acted_at=timezone.now() if acted else None,
        )
        if acted:
            obj.reja.status = state
            obj.reja.save(update_fields=['status', 'edited_at'])

    def perform_update(self, serializer):
        state = serializer.validated_data.get('state', serializer.instance.state)
        acted = state in ('tasdiqlangan', 'rad_etilgan')
        obj = serializer.save(
            acted_by=self.request.user if acted else None,
            acted_at=timezone.now() if acted else None,
        )
        if acted:
            obj.reja.status = state
            obj.reja.save(update_fields=['status', 'edited_at'])


class NormativViewSet(viewsets.ModelViewSet):
    queryset = WorkloadNorm.objects.select_related('workload_type')
    serializer_class = WorkloadNormSerializer

    def list(self, request, *args, **kwargs):
        record_type = request.query_params.get('type', 'normativ')
        if record_type == 'yuklama_turi':
            qs = WorkloadType.objects.prefetch_related('norms').all()
            return Response(WorkloadTypeSerializer(qs, many=True).data)
        if record_type == 'academic_year':
            return Response(AcademicYearSerializer(AcademicYear.objects.all(), many=True).data)
        if record_type == 'position_norm':
            year = request.query_params.get('oquvYili')
            qs = PositionNorm.objects.select_related('academic_year')
            if year:
                qs = qs.filter(academic_year__name=year)
            return Response(PositionNormSerializer(qs, many=True).data)
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        qs = super().get_queryset()
        workload_type_id = self.request.query_params.get('yuklamaTuriId')
        return qs.filter(workload_type_id=workload_type_id) if workload_type_id else qs

    @staticmethod
    def _overlaps(attrs, exclude_pk=None):
        qs = WorkloadNorm.objects.filter(
            workload_type=attrs['workload_type'],
            institution_profile=attrs['institution_profile'],
        )
        if exclude_pk:
            qs = qs.exclude(pk=exclude_pk)
        start = attrs['valid_from']
        end = attrs.get('valid_until')
        qs = qs.filter(Q(valid_until__isnull=True) | Q(valid_until__gte=start))
        if end:
            qs = qs.filter(valid_from__lte=end)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        overlaps = self._overlaps(serializer.validated_data)
        if overlaps.exists() and not request.data.get('force'):
            return Response({
                'overlap': True,
                'warning': "Tanlangan davrda ushbu profil uchun normativ mavjud.",
                'overlapping': self.get_serializer(overlaps, many=True).data,
            })
        with transaction.atomic():
            if overlaps.exists():
                new_start = serializer.validated_data['valid_from']
                overlaps.filter(valid_from__lt=new_start).update(valid_until=new_start - timedelta(days=1))
                overlaps.filter(valid_from__gte=new_start).delete()
            self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DlMdBiriktirmaViewSet(viewsets.ModelViewSet):
    queryset = DlMdBiriktirma.objects.select_related(
        'teacher', 'department', 'department__faculty', 'department__faculty__otm'
    ).all()
    serializer_class = DlMdBiriktirmaSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get('oqituvchiId'):
            qs = qs.filter(teacher_id=p['oqituvchiId'])
        if p.get('kafedraId'):
            qs = qs.filter(department_id=p['kafedraId'])
        if p.get('fakultetId'):
            qs = qs.filter(department__faculty_id=p['fakultetId'])
        if p.get('otmId'):
            qs = qs.filter(department__faculty__otm_id=p['otmId'])
        if p.get('tur'):
            qs = qs.filter(tur=p['tur'])
        return qs

    def perform_create(self, serializer):
        # Soat birligi: DL = 28, MD = 50 (talaba boshiga)
        tur = self.request.data.get('tur') or 'dl'
        sb = 50 if tur == 'md' else 28
        ts = int(self.request.data.get('talabaSoni') or 0)
        serializer.save(soat_birligi=sb, jami_soat=ts * sb)

    def perform_update(self, serializer):
        obj = serializer.instance
        tur = self.request.data.get('tur') or obj.tur
        sb = 50 if tur == 'md' else 28
        ts = int(self.request.data.get('talabaSoni', obj.talaba_soni) or 0)
        serializer.save(soat_birligi=sb, jami_soat=ts * sb)


class MonitoringViewSet(viewsets.ModelViewSet):
    queryset = Monitoring.objects.select_related('department', 'group', 'subject').all()
    serializer_class = MonitoringSerializer
