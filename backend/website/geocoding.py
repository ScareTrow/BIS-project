"""User-triggered OSM searches and cached reverse lookups for ASAR locations."""
from collections import OrderedDict
import threading
import time

import requests
from flask import Blueprint, current_app, jsonify, request
from flask_login import login_required, current_user
from .regions import canonical_city
from .validation import coordinates
from werkzeug.exceptions import BadRequest, ServiceUnavailable

locations = Blueprint('locations', __name__)
_lock = threading.Lock()
_cache = OrderedDict()
_last_request = 0.0


def lookup(path, **params):
    global _last_request
    base = current_app.config.get('GEOCODER_URL', 'https://nominatim.openstreetmap.org').rstrip('/')
    key = (base, path, tuple(sorted(params.items())))
    # Production has one Gunicorn worker. All searches and reverse lookups
    # share this lock, cache and provider-wide one-request-per-second limit.
    with _lock:
        cached = _cache.get(key)
        if cached and cached[0] > time.monotonic():
            _cache.move_to_end(key)
            return cached[1]
        delay = 1 - (time.monotonic() - _last_request)
        if delay > 0:
            time.sleep(delay)
        _last_request = time.monotonic()
        site = current_app.config.get('WEB_APP_URL', 'https://asar-one.vercel.app')
        try:
            response = requests.get(base + '/' + path, params=params,
                headers={'User-Agent': f'ASAR/1.0 ({site})', 'Referer': site}, timeout=8)
            response.raise_for_status()
            data = response.json()
        except (requests.RequestException, ValueError):
            raise ServiceUnavailable('Поиск адресов временно недоступен. Попробуйте позже или выберите место на карте.') from None
        _cache[key] = (time.monotonic() + 3600, data)
        while len(_cache) > 256:
            _cache.popitem(last=False)
        return data


@locations.post('/api/locations/search')
@login_required
def search_location():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        raise BadRequest('Некорректный запрос адреса')
    query, city = data.get('query', ''), data.get('city', '')
    if not isinstance(query, str) or not 3 <= len(query.strip()) <= 200:
        raise BadRequest('Введите адрес или название здания: от 3 до 200 символов')
    if not isinstance(city, str) or len(city) > 200:
        raise BadRequest('Некорректный город')
    results = lookup('search', q=', '.join(filter(None, [query.strip(), canonical_city(city or current_user.city)])),
        format='jsonv2', countrycodes='kz', limit=5, addressdetails=1, namedetails=1)
    return jsonify([dict(address=short_address(r), latitude=float(r['lat']),
        longitude=float(r['lon'])) for r in results])


@locations.post('/api/locations/reverse')
@login_required
def reverse_location():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise BadRequest('Некорректный запрос адреса')
    try:
        latitude, longitude = coordinates(data.get('latitude'), data.get('longitude'))
    except (TypeError, ValueError) as error:
        raise BadRequest(str(error)) from error
    result = lookup('reverse', format='jsonv2', lat=latitude, lon=longitude, zoom=18,
                    addressdetails=1, namedetails=1)
    return jsonify(address=short_address(result) if result.get('display_name') else '',
                   latitude=latitude, longitude=longitude)


def short_address(place):
    address = place.get('address') or {}
    names = place.get('namedetails') or {}
    name = names.get('name:ru') or place.get('name') or names.get('name')
    street = next((address[k] for k in ('road','pedestrian','residential','footway','path') if address.get(k)), None)
    parts = []
    for part in (name, street, address.get('house_number')):
        if part and part.lower() not in [p.lower() for p in parts]:
            parts.append(part)
    return ', '.join(parts) if parts else ', '.join(place['display_name'].split(',')[:2]).strip()
