"""Canonical city names for profile defaults and legacy request filtering."""
from flask import request
from flask_login import current_user
from sqlalchemy import func, and_, or_

CITY_NAMES = (
    ('Алматы','Almaty','Алма-Ата'), ('Астана','Astana','Нур-Султан'),
    ('Шымкент','Shymkent'), ('Караганда','Қарағанды','Karaganda'),
    ('Актобе','Ақтөбе','Aktobe'), ('Тараз','Taraz'), ('Павлодар','Pavlodar'),
    ('Усть-Каменогорск','Өскемен','Oskemen'), ('Семей','Semey','Семипалатинск'),
    ('Атырау','Atyrau'), ('Костанай','Қостанай','Kostanay'),
    ('Кызылорда','Қызылорда','Qyzylorda'), ('Уральск','Орал','Oral','Uralsk'),
    ('Петропавловск','Петропавл','Petropavl'), ('Актау','Ақтау','Aktau'),
    ('Туркестан','Түркістан','Turkistan'), ('Кокшетау','Көкшетау','Kokshetau'),
    ('Талдыкорган','Талдықорған','Taldykorgan'), ('Жезказган','Жезқазған','Zhezkazgan'),
    ('Конаев','Қонаев','Konaev','Капчагай'),
)


def city_names(value):
    value = (value or '').strip()
    return next((names for names in CITY_NAMES if value.lower() in [n.lower() for n in names]), (value,))


def canonical_city(value):
    return city_names(value)[0]


def selected_city(default=''):
    if current_user.is_authenticated and current_user.city:
        return canonical_city(current_user.city)
    return canonical_city(request.args.get('city', default))


def filter_city(query, column, city, owner_column=None):
    if not city or city == 'all':
        return query
    names = city_names(city)
    stored = func.trim(column)
    condition = or_(stored.in_(names), func.lower(stored).in_([name.lower() for name in names]))
    if owner_column is not None and current_user.is_authenticated:
        # Preserve the author's legacy rows that predate mandatory city selection.
        condition = or_(condition, and_(owner_column == current_user.id,
            or_(column.is_(None), func.trim(column) == '')))
    return query.filter(condition)
