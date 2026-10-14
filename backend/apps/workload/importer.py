"""
Excel'dan o'qilgan yuklama qatorlarini bazaga (asosiy jadval — Yuklama) yozish.

Har bir qator uchun:
  1. `fan_nomi` dan Subject atributlari aniqlanadi (program_type, study_format,
     course, semester, ta'lim tillari, dars soatlari).
  2. Subject topiladi yoki yaratiladi (nom + kafedra bo'yicha).
  3. Yuklama yozuvi yaratilib, Subject ga bog'lanadi.
"""

import re

from django.db import transaction

from apps.academics.models import (
    Subject, StudyFormat, ProgramType, Course, Semester, StudyLanguage,
)
from .models import Yuklama


def _upsert_subject(fields, department):
    subject = Subject.objects.filter(
        name__iexact=fields['name'], department=department,
    ).first()
    attrs = {key: value for key, value in fields.items() if key != 'name'}
    attrs['department'] = department
    if subject is None:
        return Subject.objects.create(name=fields['name'], **attrs), True
    for key, value in attrs.items():
        setattr(subject, key, value)
    subject.name = fields['name']
    subject.save()
    return subject, False


def _int(value):
    """Qiymatni butun songa keltiradi (None/matn -> 0)."""
    if isinstance(value, bool):
        return 0
    if isinstance(value, (int, float)):
        return int(value)
    return 0


def derive_program_type(name_lower, talim_shakli=None):
    """Fan nomidan ta'lim dasturi turini aniqlaydi."""
    if talim_shakli == 'magistr':
        return ProgramType.MASTER
    if 'magistr' in name_lower or 'magistratura' in name_lower:
        return ProgramType.MASTER
    if 'phd' in name_lower or 'doktorant' in name_lower:
        return ProgramType.PHD
    # "kunduzgi" yoki ko'rsatilmagan holatlar -> bakalavr
    return ProgramType.BACHELOR


def derive_study_format(name_lower, talim_shakli=None):
    """Fan nomidan ta'lim turini (shaklini) aniqlaydi."""
    if talim_shakli == 'sirtqi':
        return StudyFormat.PART_TIME
    if talim_shakli == 'masofaviy':
        return StudyFormat.DISTANCE
    if 'sirtqi' in name_lower:
        return StudyFormat.PART_TIME
    if 'masofa' in name_lower:  # masofaviy
        return StudyFormat.DISTANCE
    if 'kechki' in name_lower:
        return StudyFormat.EVENING
    # "kunduzgi" yoki ko'rsatilmagan holatlar -> kunduzgi (full_time)
    return StudyFormat.FULL_TIME


def derive_languages(talim_tili):
    """Ta'lim tili belgisidan til kodlari ro'yxatini qaytaradi.

    O' -> uz (o'zbek), R -> ru (rus), I -> en (ingliz).
    Masalan "O'R" -> ['uz', 'ru'].
    """
    if not talim_tili:
        return []
    up = str(talim_tili).upper()
    langs = []
    if 'O' in up:
        langs.append(StudyLanguage.UZ)
    if 'R' in up:
        langs.append(StudyLanguage.RU)
    if 'I' in up:
        langs.append(StudyLanguage.EN)
    return langs


def derive_course(name_lower, semestr):
    """Fan nomidagi 'N-kurs' dan, bo'lmasa semestrdan kursni aniqlaydi."""
    match = re.search(r'(\d+)\s*-?\s*kurs', name_lower)
    if match:
        n = int(match.group(1))
    elif semestr:
        n = (_int(semestr) + 1) // 2  # 1,2->1-kurs; 3,4->2-kurs; ...
    else:
        n = 1
    n = max(1, min(5, n))
    return getattr(Course, f'COURSE_{n}', Course.COURSE_1)


def derive_semester(semestr):
    """Semestr raqamidan Semester tanlovini aniqlaydi."""
    n = _int(semestr)
    if n < 1:
        return Semester.SEMESTER_1
    n = max(1, min(10, n))
    return getattr(Semester, f'SEMESTER_{n}', Semester.SEMESTER_1)


def build_subject_fields(row):
    """Excel qatoridan Subject maydonlarini quradi."""
    # Ko'p bo'sh joylarni bittaga keltirib normallashtiramiz (dedup uchun muhim:
    # "№1  (kunduzgi)" va "№1 (kunduzgi)" bir xil fan bo'lishi kerak)
    name = re.sub(r'\s+', ' ', (row.get('fan_nomi') or '')).strip()
    name_lower = name.lower()
    langs = derive_languages(row.get('talim_tili'))

    # Dars soati — o'quv rejasi (Reja) ustuni ustuvor, bo'lmasa jami ishlatiladi.
    # Reja = bir guruh/reja bo'yicha soat (yuklamadagi reja bilan mos kelishi uchun).
    maruza_hours = _int(row.get('maruza_reja')) or _int(row.get('maruza_jami'))
    amaliyot_hours = _int(row.get('amaliy_reja')) or _int(row.get('amaliy_jami'))
    laboratoriya_hours = _int(row.get('laboratoriya_reja')) or _int(row.get('laboratoriya_jami'))

    return {
        'name': name,
        'program_type': derive_program_type(name_lower, row.get('talim_shakli')),
        'study_format': derive_study_format(name_lower, row.get('talim_shakli')),
        'course': derive_course(name_lower, row.get('semestr')),
        'semester': derive_semester(row.get('semestr')),
        'study_language': langs[0] if langs else StudyLanguage.UZ,
        'study_languages': ','.join(langs),
        'maruza_hours': maruza_hours,
        'amaliyot_hours': amaliyot_hours,
        'laboratoriya_hours': laboratoriya_hours,
        'hours': maruza_hours + amaliyot_hours + laboratoriya_hours,
    }


def build_subjects_from_data(department):
    """Kafedra yuklama_data sidan fanlarni (Subject) yaratadi/yangilaydi.

    Dedup: bir xil (nom + kafedra) bo'yicha takror yaratilmaydi (get_or_create).
    Yuklama yozuvlari yaratilmaydi (faqat Subject).

    Qaytaradi: {'created': N, 'updated': M}
    """
    if department is None:
        return {'created': 0, 'updated': 0}
    data = department.yuklama_data if isinstance(department.yuklama_data, dict) else {}
    rows = list(data.get('kuzgi', []) or []) + list(data.get('bahorgi', []) or [])

    created = 0
    updated = 0
    for row in rows:
        fields = build_subject_fields(row)
        if not fields['name']:
            continue
        subject, is_new = _upsert_subject(fields, department)
        if is_new:
            created += 1
        else:
            updated += 1
    return {'created': created, 'updated': updated}


@transaction.atomic
def import_rows_to_yuklama(parsed, department=None):
    """Parse qilingan ma'lumotni Yuklama (asosiy jadval) ga yozadi.

    parsed     — parse_workload_excel() natijasi.
    department — Department instansi yoki None.

    Qaytaradi: yaratilgan yuklamalar haqida qisqa hisobot.
    """
    created = {'kuzgi': [], 'bahorgi': []}
    if department is not None:
        # Import is a complete replacement of one department's current source file.
        Yuklama.objects.filter(department=department).delete()

    for section in ('kuzgi', 'bahorgi'):
        for row in parsed.get(section, []):
            fields = build_subject_fields(row)
            if not fields['name']:
                continue

            subject, _is_new = _upsert_subject(fields, department)

            yuklama = Yuklama.objects.create(
                name=fields['name'],
                department=department,
                subject=subject,
                groups_count=_int(row.get('guruhlar_soni')),
                thread_count=_int(row.get('patok')),
                control=_int(row.get('nazorat')),
            )
            created[section].append({
                'yuklama_id': yuklama.id,
                'subject_id': subject.id,
                'name': yuklama.name,
                'program_type': subject.program_type,
                'study_format': subject.study_format,
                'study_languages': subject.study_languages,
                'maruza_hours': subject.maruza_hours,
                'amaliyot_hours': subject.amaliyot_hours,
            })

    return created
