from decimal import Decimal, InvalidOperation

from django.db import transaction

from apps.academics.models import Subject
from .models import Assignment, WorkloadType


def reja_fan_hours(reja):
    """Return effective teaching hours from the saved work plan, excluding DL/MD."""
    data = reja.data if isinstance(reja.data, dict) else {}
    variants = data.get('variants')
    containers = variants.values() if isinstance(variants, dict) else [data]
    total = Decimal('0')

    def add(value):
        nonlocal total
        try:
            total += Decimal(str(value or 0))
        except (InvalidOperation, TypeError, ValueError):
            pass

    for container in containers:
        if not isinstance(container, dict):
            continue
        doc = container.get('doc') if isinstance(container.get('doc'), dict) else {}
        rows = doc.get('oquvIshlari') if isinstance(doc.get('oquvIshlari'), list) else []
        if rows:
            for row in rows:
                if not isinstance(row, dict) or str(row.get('id') or '').startswith('dlmd-'):
                    continue
                add(row.get('jami'))
            continue
        for fan in container.get('fanlar') or []:
            if isinstance(fan, dict):
                add(fan.get('soat'))
    return total


@transaction.atomic
def sync_reja_assignments(reja):
    """Normalize the teaching assignments embedded by the current UI into rows."""
    workload_type, _ = WorkloadType.objects.get_or_create(
        code='FAN',
        defaults={
            'name': "O'quv mashg'ulotlari",
            'clause_number': 1,
            'formula_expression': 'biriktirilgan soat',
        },
    )
    data = reja.data if isinstance(reja.data, dict) else {}
    variants = data.get('variants')
    containers = variants.values() if isinstance(variants, dict) else [data]
    rows = []
    saved_types = {(a.subject_id, a.semester_number): a.lesson_type
                   for a in reja.assignments.filter(calculation_type='reja_taqsimoti')}
    for container in containers:
        if not isinstance(container, dict):
            continue
        for item in container.get('fanlar') or []:
            if not isinstance(item, dict):
                continue
            try:
                hours = Decimal(str(item.get('soat') or 0))
            except (InvalidOperation, TypeError, ValueError):
                continue
            if hours <= 0:
                continue
            # Yangi UI da bitta fan ma'ruza va guruhlar sonicha amaliyotga
            # ajratiladi. `id` — biriktirma kaliti, haqiqiy fan PK si esa
            # `subjectId` da saqlanadi. Eski yozuvlar uchun `id` fallback.
            subject_id = item.get('subjectId')
            # Eski formatda `id` Subject PK edi. Yangi formatdagi `lesson:...`
            # kalitni esa hech qachon integer PK sifatida querysetga bermaymiz.
            if subject_id in (None, ''):
                legacy_id = item.get('id')
                if str(legacy_id or '').isdigit():
                    subject_id = legacy_id
            try:
                subject = Subject.objects.filter(pk=int(subject_id)).first() if subject_id not in (None, '') else None
            except (TypeError, ValueError):
                subject = None
            semester = item.get('semestr')
            semester_number = 2 if semester == 'bahorgi' else 1
            lesson_type = item.get('lessonType') or saved_types.get(
                (subject.pk if subject else None, semester_number), ''
            )
            rows.append(Assignment(
                reja=reja,
                workload_type=workload_type,
                subject=subject,
                semester_number=semester_number,
                hours=hours,
                lesson_type=lesson_type,
                calculation_type='reja_taqsimoti',
                formula_input={
                    'assignmentKey': item.get('id'),
                    'groupIndex': item.get('groupIndex'),
                    'groupCount': item.get('groupCount'),
                    'workloadKind': item.get('workloadKind'),
                    'studentCount': item.get('studentCount'),
                    'hourPerStudent': item.get('hourPerStudent'),
                },
                note='' if subject else str(item.get('nomi') or ''),
            ))
    reja.assignments.filter(calculation_type='reja_taqsimoti').delete()
    Assignment.objects.bulk_create(rows)
    total_hours = sum((row.hours for row in rows), Decimal('0'))
    normalized_total = int(total_hours)
    if reja.jami_soat != normalized_total:
        reja.jami_soat = normalized_total
        reja.save(update_fields=['jami_soat', 'edited_at'])
    return len(rows)
