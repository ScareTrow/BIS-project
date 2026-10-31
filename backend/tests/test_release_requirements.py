"""Acceptance checks for the mandatory TSIS 6–7 release scenarios."""
import io
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from PIL import Image

from backend.website import db
from backend.website.models import (
    Application, ApplicationCategory, ApplicationMedia, ApplicationResponse,
    ModerationAction, ModerationStatus, Notification, ResponseStatus,
    User, VolunteerPreference,
)

_image = io.BytesIO()
Image.new('RGB', (2, 2), 'white').save(_image, format='PNG')
PNG = _image.getvalue()


def login(client, user, password='Asar8!River2'):
    assert client.post('/api/auth/login', json={'email': user.email, 'password': password}).status_code == 200

def submit(client, *, path='/api/applications', files=None, **fields):
    data = dict(latitude='43.222', longitude='76.8512', category='food',
                description='Нужна помощь продуктами', city='Almaty')
    data.update(fields)
    data['media_files'] = files if files is not None else [(io.BytesIO(PNG), 'proof.png')]
    return client.post(path, data=data, content_type='multipart/form-data')

@pytest.mark.parametrize('description', ['x' * 9, 'x' * 1001])
def test_description_boundaries(client, test_user, description):
    login(client, test_user)
    assert submit(client, description=description).status_code == 400

@pytest.mark.parametrize('description', ['x' * 10, 'x' * 1000])
def test_description_allowed_boundaries(client, test_user, description):
    login(client, test_user)
    assert submit(client, description=description).status_code == 201

@pytest.mark.parametrize('files,code', [
    ([], 400),
    ([(b'', 'empty.png')], 400),
    ([(b'MZ-executable', 'proof.jpg')], 415),
    ([(PNG, 'proof.gif')], 415),
    ([(PNG, f'{i}.png') for i in range(4)], 400),
    ([(PNG + b'\0' * (10 * 1024 * 1024), 'large.png')], 413),
    ([(PNG, 'valid.png'), (b'MZ-executable', 'bad.jpg')], 415),
])
def test_invalid_upload_is_atomic(app, client, test_user, files, code):
    login(client, test_user)
    response = submit(client, files=[(io.BytesIO(content), name) for content, name in files])
    assert response.status_code == code, response.json
    with app.app_context():
        assert Application.query.count() == ApplicationMedia.query.count() == 0
    assert not list(Path(app.config['UPLOAD_FOLDER']).iterdir())

def test_three_large_photos_and_duplicate_names(app, client, test_user):
    login(client, test_user)
    content = PNG + b'\0' * (int(9.9 * 1024 * 1024) - len(PNG))
    response = submit(client, files=[(io.BytesIO(content), 'same.png') for _ in range(3)])
    assert response.status_code == 201, response.json
    with app.app_context():
        media = ApplicationMedia.query.all()
        assert len(media) == len({m.file_path for m in media}) == 3
        assert all((Path(app.config['UPLOAD_FOLDER']) / m.file_path).read_bytes() == content for m in media)

def test_photo_with_cyrillic_filename(client, test_user):
    login(client, test_user)
    assert submit(client, files=[(io.BytesIO(PNG), 'помощь.png')]).status_code == 201

def test_json_cannot_bypass_required_photo(app, client, test_user):
    login(client, test_user)
    response = client.post('/api/applications', json=dict(latitude=43.22, longitude=76.85,
                          description='Нужна помощь продуктами', category='food'))
    assert response.status_code == 400

def test_map_status_filter_and_own_pending(app, client, test_user, test_application):
    login(client, test_user)
    with app.app_context():
        pending = Application(user_id=test_user.id, description='My pending request',
            latitude=43.22, longitude=76.85, category=ApplicationCategory.FOOD)
        finished = Application(user_id=test_user.id, description='Completed request',
            latitude=43.22, longitude=76.85, category=ApplicationCategory.FOOD,
            moderation_status=ModerationStatus.APPROVED, is_resolved=True)
        db.session.add_all([pending, finished])
        db.session.commit()
        pending_id, finished_id = pending.id, finished.id
    for path in ['/api/map/points', '/api/applications/list']:
        assert {p['id'] for p in client.get(path + '?status=open').json} == {test_application.id, pending_id}
        assert {p['id'] for p in app.test_client().get(path + '?status=completed').json} == {finished_id}
        assert client.get(path + '?status=invalid').status_code == 400

def test_optional_verification_document_is_preserved_and_private(app, client, test_user):
    login(client, test_user)
    response = submit(client, verification_document=(io.BytesIO(b'%PDF-1.4\nverification'), 'verification.pdf'))
    assert response.status_code == 201
    aid = response.json['id']
    with app.app_context():
        document = ApplicationMedia.query.filter_by(application_id=aid, file_type='application/pdf').one()
        filename = document.file_path
    assert client.get('/api/uploads/' + filename).status_code == 200
    assert app.test_client().get('/api/uploads/' + filename).status_code == 403

def test_map_in_progress_filter(app, client, test_user, test_application, test_response):
    response, _helper = test_response
    login(client, test_user)
    assert client.post(f'/api/applications/{test_application.id}/responses/{response.id}/accept').status_code == 200
    guest = app.test_client()
    assert guest.get('/api/map/points?status=open').json == []
    assert guest.get('/api/map/points?status=in_progress').json[0]['id'] == test_application.id

def test_geojson_points_preserve_coordinate_order(client, test_application):
    response = client.get('/api/map/points?format=geojson&status=open')
    assert response.mimetype == 'application/geo+json'
    assert response.json['type'] == 'FeatureCollection'
    feature = response.json['features'][0]
    assert feature['type'] == 'Feature'
    assert feature['id'] == test_application.id
    assert feature['geometry'] == {'type': 'Point', 'coordinates': [76.8512, 43.222]}
    assert feature['properties']['status'] == 'open'

def test_partial_file_write_is_rolled_back(app, client, test_user, monkeypatch):
    from werkzeug.datastructures import FileStorage
    original_save = FileStorage.save
    calls = []

    def fail_second(file, target, *args, **kwargs):
        calls.append(target)
        if len(calls) == 2:
            raise OSError('Simulated disk failure')
        original_save(file, target, *args, **kwargs)

    monkeypatch.setattr(FileStorage, 'save', fail_second)
    login(client, test_user)
    with pytest.raises(OSError):
        submit(client, files=[(io.BytesIO(PNG), 'one.png'), (io.BytesIO(PNG), 'two.png')])
    assert not list(Path(app.config['UPLOAD_FOLDER']).iterdir())
    with app.app_context():
        assert Application.query.count() == ApplicationMedia.query.count() == 0
