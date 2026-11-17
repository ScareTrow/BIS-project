"""Store uploads locally during development or in private Supabase Storage."""
from pathlib import Path
from urllib.parse import quote

import requests
from flask import current_app, redirect, send_from_directory
from werkzeug.exceptions import BadRequest, ServiceUnavailable

from . import db


def _object_path(filename):
    if not filename or '/' in filename or '\\' in filename or filename in ('.', '..'):
        raise BadRequest('Некорректное имя файла')
    bucket = quote(current_app.config['SUPABASE_STORAGE_BUCKET'], safe='')
    return f'{bucket}/{quote(filename, safe="")}'


def _request(method, path, **kwargs):
    key = current_app.config['SUPABASE_SECRET_KEY']
    headers = {'apikey': key, 'Authorization': f'Bearer {key}'}
    headers.update(kwargs.pop('headers', {}))
    try:
        response = requests.request(method,
            current_app.config['SUPABASE_URL'].rstrip('/') + '/storage/v1/' + path,
            headers=headers, timeout=30, **kwargs)
    except requests.RequestException:
        raise ServiceUnavailable('Хранилище файлов временно недоступно') from None
    if not response.ok:
        if method == 'DELETE' and response.status_code == 404:
            return response
        current_app.logger.error('Storage request failed: HTTP %s', response.status_code)
        raise ServiceUnavailable('Не удалось обработать файл в хранилище')
    return response


def save_upload(file, filename, content_type):
    # A rollback removes even an upload whose response was lost in transit.
    db.session.info.setdefault('new_uploads', []).append(filename)
    if current_app.config.get('SUPABASE_URL'):
        _request('POST', 'object/' + _object_path(filename), data=file.stream,
                 headers={'Content-Type': content_type, 'x-upsert': 'false'})
    else:
        folder = Path(current_app.config['UPLOAD_FOLDER'])
        folder.mkdir(parents=True, exist_ok=True)
        file.save(folder / filename)


def delete_upload(filename):
    if current_app.config.get('SUPABASE_URL'):
        _request('DELETE', 'object/' + quote(current_app.config['SUPABASE_STORAGE_BUCKET'], safe=''),
                 json={'prefixes': [filename]})
    else:
        _object_path(filename)
        (Path(current_app.config['UPLOAD_FOLDER']) / filename).unlink(missing_ok=True)


def serve_upload(filename):
    if not current_app.config.get('SUPABASE_URL'):
        return send_from_directory(current_app.config['UPLOAD_FOLDER'], filename)
    response = _request('POST', 'object/sign/' + _object_path(filename), json={'expiresIn': 60})
    signed_path = response.json()['signedURL']
    prefix = '' if signed_path.startswith('/storage/v1/') else '/storage/v1'
    result = redirect(current_app.config['SUPABASE_URL'].rstrip('/') + prefix + signed_path)
    result.headers['Cache-Control'] = 'private, no-store'
    return result
