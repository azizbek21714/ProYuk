"""Teacher dashboard derived from the authenticated user's assigned workload."""
from django.db.models import Q

from apps.teachers.models import Teacher
from .models import DlMdBiriktirma, PositionNorm
from .norms import default_position_norm, scaled_position_norm
from .services import reja_fan_hours


def teacher_dashboard_data(user):
    teacher = Teacher.objects.filter(user=user).first()
    if teacher is None:
        return {'oqituvchi': None, 'reja': None, 'topshiriqlar': []}

    reja = teacher.rejalar.select_related('department__faculty__otm').order_by('-oquv_yili', '-created_at').first()
    department = reja.department if reja and reja.department else teacher.departments.select_related('faculty__otm').first()
    rates = {'rate_1_5': 1.5, 'rate_1': 1, 'rate_0_5_ichki': 0.5,
             'rate_0_5_tashqi': 0.5, 'rate_0_25': 0.25}
    profile = {
        'id': str(teacher.pk), 'fio': teacher.full_name,
        'lavozim': teacher.position, 'ilmiyDaraja': teacher.degree,
        'ilmiyUnvon': teacher.academic_title, 'stavka': rates.get(teacher.rate, 1),
        'stavkaKodi': teacher.rate,
        'stajYil': None, 'kafedraNomi': department.name if department else None,
        'otmNomi': department.faculty.otm.name if department else None,
        'otmProfil': '',
    }
    if reja is None:
        return {'oqituvchi': profile, 'reja': None, 'topshiriqlar': []}

    tasks = []

    def add_task(task_id, name, hours, semester, kind, label, fan_id=None):
        try:
            hours = float(hours or 0)
        except (TypeError, ValueError):
            return
        if hours <= 0:
            return
        tasks.append({
            'id': task_id, 'yuklamaTuriId': kind, 'fanId': fan_id,
            'guruhId': None, 'semesterRaqami': 2 if semester == 'bahorgi' else 1,
            'soat': hours, 'hisobTuri': 'rejali', 'formulaInput': '{}',
            'izoh': None, 'createdAt': reja.created_at.isoformat(),
            'yuklamaTuri': {'id': kind, 'nomi': label, 'kod': kind,
                            'bandRaqami': 1 if kind == 'FAN' else 2,
                            'hisobSoatbay': False, 'formulaIfoda': ''},
            'fan': {'id': fan_id, 'nomi': name} if name else None, 'guruh': None,
        })

    relational_assignments = reja.assignments.select_related('workload_type', 'subject', 'group').all()
    if relational_assignments.exists():
        for item in relational_assignments:
            if item.hours <= 0:
                continue
            add_task(str(item.pk), item.subject.name if item.subject else item.note, item.hours,
                     'bahorgi' if item.semester_number % 2 == 0 else 'kuzgi',
                     item.workload_type.code, item.workload_type.name,
                     str(item.subject_id) if item.subject_id else None)
            tasks[-1]['mashgulotTuri'] = item.lesson_type
            tasks[-1]['canEditLessonType'] = bool(item.subject_id) and reja.status in ('loyiha', 'rad_etilgan')
            tasks[-1]['izoh'] = item.note or None
            tasks[-1]['guruh'] = ({'id': str(item.group_id), 'nomi': item.group.name,
                                  'talabaSoni': item.group.students} if item.group else None)
    else:
        data = reja.data if isinstance(reja.data, dict) else {}
        variants = data.get('variants')
        assignments = variants.values() if isinstance(variants, dict) else [data]
        for variant_index, variant in enumerate(assignments):
            if not isinstance(variant, dict):
                continue
            for index, fan in enumerate(variant.get('fanlar') or []):
                if isinstance(fan, dict):
                    add_task(f'fan-{variant_index}-{index}', fan.get('nomi', ''),
                             fan.get('soat'), fan.get('semestr'), 'FAN', "O'quv mashg'ulotlari",
                             str(fan['id']) if fan.get('id') is not None else None)

    # Eski DL/MD yozuvlarida o'quv yili bo'sh saqlangan. Shaxsiy ish reja ham
    # ularni ko'rsatadi, shuning uchun profil jami ham joriy yil + bo'sh yilni oladi.
    dlmd_entries = DlMdBiriktirma.objects.filter(teacher=teacher).filter(
        Q(oquv_yili=reja.oquv_yili) | Q(oquv_yili='')
    )
    dlmd_total = 0
    for entry in dlmd_entries:
        dlmd_total += entry.jami_soat
        add_task(f'dlmd-{entry.pk}', '', entry.jami_soat, entry.semestr,
                 entry.tur.upper(), 'Diplom loyihasi' if entry.tur == 'dl' else 'Magistrlik dissertatsiyasi')

    norm = PositionNorm.objects.filter(
        position=teacher.position, academic_year__name=reja.oquv_yili,
    ).first() or PositionNorm.objects.filter(
        position=teacher.position, academic_year__is_active=True,
    ).first()
    min_norm, max_norm = (
        (norm.minimum_hours, norm.maximum_hours)
        if norm else default_position_norm(teacher.position)
    )
    min_norm, max_norm = scaled_position_norm(min_norm, max_norm, teacher.rate)

    data = reja.data if isinstance(reja.data, dict) else {}
    raw_variants = data.get('variants') if isinstance(data.get('variants'), dict) else None
    if raw_variants is None:
        legacy_rate = 'rate_0_5' if data.get('stavka') == 'rate_0_5' else 'rate_1'
        raw_variants = {legacy_rate: {'doc': data.get('doc', {})}}

    def personal_doc(rate):
        variant = raw_variants.get(rate, {})
        doc = variant.get('doc', {}) if isinstance(variant, dict) else {}
        doc = doc if isinstance(doc, dict) else {}
        return {
            'uslubiy': doc.get('uslubiy', []) if isinstance(doc.get('uslubiy'), list) else [],
            'ilmiy': doc.get('ilmiy', []) if isinstance(doc.get('ilmiy'), list) else [],
            'ustozShogird': doc.get('ustozShogird', []) if isinstance(doc.get('ustozShogird'), list) else [],
            'reyting': doc.get('reyting', {}) if isinstance(doc.get('reyting'), dict) else {},
        }

    active_rate = data.get('stavka')
    if active_rate not in ('rate_1', 'rate_0_5', 'rate_0_25'):
        active_rate = ('rate_0_25' if '0_25' in teacher.rate else
                       'rate_0_5' if '0_5' in teacher.rate else 'rate_1')

    return {
        'oqituvchi': profile,
        'reja': {'id': str(reja.pk), 'oquvYiliNomi': reja.oquv_yili,
                 'status': reja.status, 'jamiSoat': float(reja_fan_hours(reja)) + dlmd_total,
                 'minNorm': min_norm, 'maxNorm': max_norm,
                 'topshiriqlar': tasks,
                 'shaxsiyReja': {
                     'activeStavka': active_rate,
                     'variants': {
                         'rate_1': personal_doc('rate_1'),
                         'rate_0_5': personal_doc('rate_0_5'),
                         'rate_0_25': personal_doc('rate_0_25'),
                     },
                 },
                 'tasdiqlashlar': [
                     {'id': str(a.pk), 'bosqich': a.stage, 'holat': a.state,
                      'izoh': a.comment or None,
                      'tasdiqlaganAt': a.acted_at.isoformat() if a.acted_at else None}
                     for a in reja.approvals.all()
                 ]},
        'topshiriqlar': tasks,
    }
