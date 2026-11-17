"""Validate public building locations and separately stored entrance instructions."""
import json
from .validation import coordinates


def delivery_details(value):
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError:
            raise ValueError('Укажите маршрут доставки') from None
    if not isinstance(value, dict):
        raise ValueError('Укажите, откуда забрать и куда доставить')
    result = {}
    for key in ('pickup', 'dropoff'):
        place = value.get(key)
        if not isinstance(place, dict):
            raise ValueError('Выберите обе точки маршрута доставки')
        address, entrance = place.get('address'), place.get('entrance', '')
        if not isinstance(address, str) or not 1 <= len(address.strip()) <= 1000:
            raise ValueError('Укажите адрес получения и адрес доставки')
        if not isinstance(entrance, str) or len(entrance) > 200:
            raise ValueError('Указания для входа: не более 200 символов')
        latitude, longitude = coordinates(place.get('latitude'), place.get('longitude'))
        result[key] = dict(address=address.strip(), entrance=entrance.strip(),
                           latitude=latitude, longitude=longitude)
    return result
