"""Lavozim va stavka bo'yicha yillik o'quv yuklamasi me'yorlari."""

from decimal import Decimal, InvalidOperation


POSITION_NORM_DEFAULTS = {
    'teacher': (750, 800),
    'assistant': (800, 850),
    'senior_teacher': (750, 800),
    'associate_professor': (700, 750),
    'professor': (650, 700),
}


RATE_FACTORS = {
    'rate_1_5': Decimal('1.5'),
    'rate_1': Decimal('1'),
    'rate_0_5': Decimal('0.5'),
    'rate_0_5_ichki': Decimal('0.5'),
    'rate_0_5_tashqi': Decimal('0.5'),
    'rate_0_25': Decimal('0.25'),
}


def default_position_norm(position):
    return POSITION_NORM_DEFAULTS.get(position, POSITION_NORM_DEFAULTS['teacher'])


def rate_factor(rate):
    """Teacher.rate kodi yoki sonli qiymatni stavka koeffitsiyentiga aylantiradi."""
    if rate in RATE_FACTORS:
        return RATE_FACTORS[rate]
    try:
        factor = Decimal(str(rate))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal('1')
    return factor if factor > 0 else Decimal('1')


def scaled_position_norm(minimum, maximum, rate):
    """Bir stavkalik minimum va maksimumni o'qituvchi stavkasiga moslaydi."""
    factor = rate_factor(rate)

    def scaled(value):
        result = Decimal(str(value)) * factor
        return int(result) if result == result.to_integral_value() else float(result)

    return scaled(minimum), scaled(maximum)
