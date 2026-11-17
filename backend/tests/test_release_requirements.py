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


def test_sos_public_immediately_and_fourth_request_limited(app, client, test_user):
    login(client, test_user)
    for _ in range(3):
        response = submit(client, path='/api/sos')
        assert response.status_code == 201, response.json
        aid = response.json['id']
        point = next(p for p in app.test_client().get('/api/map/points').json if p['id'] == aid)
        assert point['is_sos'] and point['status'] == 'open'
    assert submit(client, path='/api/sos').status_code == 429
    # The general form and Telegram must share the same hourly counter.
    assert submit(client, priority='sos').status_code == 429
    with app.app_context():
        assert Application.query.count() == ApplicationMedia.query.count() == 3


def test_sos_limit_expires_after_hour(app, client, test_user):
    login(client, test_user)
    with app.app_context():
        for _ in range(3):
            db.session.add(Application(user_id=test_user.id, description='Old SOS request',
                latitude=43.22, longitude=76.85, category=ApplicationCategory.EMERGENCY,
                is_sos=True, date=datetime.now(timezone.utc) - timedelta(minutes=61)))
        db.session.commit()
    assert submit(client, path='/api/sos').status_code == 201


def test_volunteer_coordinates_private_and_validated(client, test_user):
    login(client, test_user)
    response = client.put('/api/user/location', json={'latitude': 43.222, 'longitude': 76.8512})
    assert response.status_code == 200
    assert client.get('/api/user/location').json['latitude'] == 43.222
    assert client.put('/api/user/location', json={'latitude': 91, 'longitude': 76}).status_code == 400
    assert 'latitude' not in client.get(f'/api/users/{test_user.id}').json


def test_nearby_alerts_ignore_tags_availability_and_city(app, client, test_user, admin_user, monkeypatch):
    from werkzeug.security import generate_password_hash
    sent = []
    monkeypatch.setattr('backend.telegram_bot.utils.notifications.send_notification',
                        lambda **kw: sent.append(kw) or True)
    with app.app_context():
        for name, lat, city in [('near', 43.225, 'Different city'), ('far', 44.0, 'Almaty')]:
            user = User(email=f'{name}@example.com', first_name=name,
                password=generate_password_hash('Asar8!River2'), telegram_id=name, city=city)
            db.session.add(user)
            db.session.flush()
            db.session.add(VolunteerPreference(user_id=user.id, is_available=False,
                latitude=lat, longitude=76.8512))
        db.session.commit()
    login(client, test_user)
    aid = submit(client).json['id']
    admin = app.test_client()
    login(admin, admin_user, 'Admin1234!@#$')
    assert admin.post(f'/api/admin/applications/{aid}/approve').status_code == 200
    assert admin.post(f'/api/admin/applications/{aid}/approve').status_code == 200
    alerts = [s for s in sent if s['notification_type'] == 'new_request']
    assert len(alerts) == 1 and alerts[0]['telegram_id'] == 'near'
    assert 'км' in alerts[0]['message'] and f'/applications/{aid}' in alerts[0]['message']
    assert 'Продукты' in alerts[0]['message']


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


def test_rejection_requires_reason_and_notifies_author(app, client, test_user, admin_user, test_application_pending, monkeypatch):
    sent = []
    monkeypatch.setattr('backend.telegram_bot.utils.notifications.send_notification',
                        lambda **kw: sent.append(kw) or True)
    with app.app_context():
        db.session.get(User, test_user.id).telegram_id = 'requester'
        db.session.commit()
    login(client, admin_user, 'Admin1234!@#$')
    path = f'/api/admin/applications/{test_application_pending.id}/reject'
    assert client.post(path, json={}).status_code == 400
    reason = 'Уточните адрес получения помощи'
    assert client.post(path, json={'reason': reason}).status_code == 200
    with app.app_context():
        assert ModerationAction.query.one().reason == reason
        assert reason in Notification.query.filter_by(user_id=test_user.id).one().message
    assert reason in sent[0]['message']


def test_response_status_updates_send_telegram(app, client, test_user, test_application, test_response, monkeypatch):
    response, helper = test_response
    sent = []
    monkeypatch.setattr('backend.telegram_bot.utils.notifications.send_notification',
                        lambda **kw: sent.append(kw) or True)
    with app.app_context():
        db.session.get(User, helper.id).telegram_id = 'helper'
        db.session.commit()
    login(client, test_user)
    assert client.post(f'/api/applications/{test_application.id}/responses/{response.id}/accept').status_code == 200
    assert client.post(f'/api/applications/{test_application.id}/resolve').status_code == 200
    assert {'response_accepted', 'application_resolved'}.issubset({s['notification_type'] for s in sent})


def test_new_response_notifies_author_once(app, client, test_user, admin_user, test_application, monkeypatch):
    sent = []
    monkeypatch.setattr('backend.telegram_bot.utils.notifications.send_notification', lambda **kw: sent.append(kw))
    with app.app_context():
        db.session.get(User, test_user.id).telegram_id = 'author'
        db.session.commit()
    login(client, admin_user, 'Admin1234!@#$')
    path = f'/api/applications/{test_application.id}/respond'
    assert client.post(path).status_code == 200
    assert client.post(path).status_code == 400
    assert len(sent) == 1 and sent[0]['telegram_id'] == 'author'
    assert sent[0]['notification_type'] == 'new_response'


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


def test_sos_appears_in_review_queue_and_can_be_rejected(app, client, test_user, admin_user):
    login(client, test_user)
    aid = submit(client, path='/api/sos').json['id']
    admin = app.test_client()
    login(admin, admin_user, 'Admin1234!@#$')
    assert aid in {a['id'] for a in admin.get('/api/admin/applications?status=pending').json}
    assert admin.post(f'/api/admin/applications/{aid}/reject', json={'reason': 'Ложный вызов'}).status_code == 200
    assert not app.test_client().get('/api/map/points').json
    assert client.get(f'/api/applications/{aid}').json['rejection_reason'] == 'Ложный вызов'


def test_false_sos_leaves_review_queue_and_notifies_author(app, client, test_user, admin_user):
    login(client, test_user)
    aid = submit(client, path='/api/sos').json['id']
    admin = app.test_client()
    login(admin, admin_user, 'Admin1234!@#$')
    assert admin.get('/api/admin/stats').json['pending_applications'] == 1
    assert admin.post(f'/api/admin/applications/{aid}/mark-false').status_code == 200
    assert admin.get('/api/admin/applications?status=pending').json == []
    assert admin.get('/api/admin/stats').json['pending_applications'] == 0
    assert any(n['notification_type'] == 'application_false_call' for n in client.get('/api/notifications').json['notifications'])


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


def test_rolled_back_notice_does_not_send(app, test_user, monkeypatch):
    from backend.website.notifications import create_notification
    sent = []
    monkeypatch.setattr('backend.telegram_bot.utils.notifications.send_notification', lambda **kw: sent.append(kw))
    with app.app_context():
        db.session.get(User, test_user.id).telegram_id = 'requester'
        db.session.commit()
        create_notification(test_user.id, 'Notice', 'Message', 'new_response')
        db.session.rollback()
        assert Notification.query.count() == 0
    assert not sent


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


@pytest.mark.asyncio
@pytest.mark.parametrize('invalid_image', [False, True])
async def test_bot_uses_same_photo_and_hourly_rules(app, client, test_user, monkeypatch, invalid_image):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock
    from backend.telegram_bot.handlers import common
    monkeypatch.setattr(common, 'create_app', lambda: app)
    monkeypatch.setattr(common, 'require_auth', AsyncMock(return_value=test_user))
    login(client, test_user)
    for _ in range(2):
        assert submit(client, path='/api/sos').status_code == 201
    state = SimpleNamespace(get_data=AsyncMock(return_value={
        'photo_file_id': 'photo', 'photo_filename': 'proof.png',
    }), clear=AsyncMock())

    async def download(_path, destination):
        destination.write(b'MZ-executable' if invalid_image else PNG)

    message = SimpleNamespace(location=SimpleNamespace(latitude=43.222, longitude=76.8512),
        answer=AsyncMock(), bot=SimpleNamespace(
            get_file=AsyncMock(return_value=SimpleNamespace(file_size=len(PNG), file_path='photo.png')),
            download_file=AsyncMock(side_effect=download)))
    await common.process_sos_location(message, state)
    with app.app_context():
        assert Application.query.count() == (2 if invalid_image else 3)
        if not invalid_image:
            created = Application.query.filter_by(created_via='telegram').one()
            assert created.is_sos and created.moderation_status == ModerationStatus.APPROVED
    if not invalid_image:
        await common.process_sos_location(message, state)
        assert 'Лимит SOS' in message.answer.call_args.args[0]
        with app.app_context():
            assert Application.query.count() == ApplicationMedia.query.count() == 3


def test_volunteer_location_migration_preserves_existing_rows(app, test_user):
    import importlib.util
    from sqlalchemy import text, inspect
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    path = Path(__file__).parents[1] / 'migrations/versions/20261117_volunteer_location.py'
    spec = importlib.util.spec_from_file_location('location_migration', path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    with app.app_context():
        engine = db.engine
    with engine.begin() as connection:
        connection.execute(text('ALTER TABLE volunteer_preferences DROP COLUMN latitude, DROP COLUMN longitude'))
        connection.execute(text('INSERT INTO volunteer_preferences (user_id, is_available, updated_at) VALUES (:user_id, true, now())'), {'user_id': test_user.id})
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            migration.upgrade()
        assert {'latitude', 'longitude'}.issubset({c['name'] for c in inspect(connection).get_columns('volunteer_preferences')})
        assert connection.execute(text('SELECT user_id, is_available, latitude FROM volunteer_preferences')).one() == (test_user.id, True, None)
