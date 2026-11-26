"""Exercise deployment boundaries against the disposable PostgreSQL fixture."""
import io
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from aiogram.fsm.storage.base import StorageKey
from sqlalchemy import inspect, text
from werkzeug.datastructures import FileStorage

from backend.website import db
from backend.website.models import Application, ApplicationMedia, ModerationStatus, TelegramUpdateReceipt
from backend.website.storage import save_upload, serve_upload
from backend.telegram_bot.storage import DatabaseStorage
from backend.telegram_bot.webhook import TelegramRuntime
from backend.tests.request_helpers import png_bytes, post_request

PNG = png_bytes()


def cloud(app, monkeypatch):
    app.config.update(SUPABASE_URL='https://storage.example.test',
        SUPABASE_SECRET_KEY='server-test-key', SUPABASE_STORAGE_BUCKET='asar-files')
    calls = []
    def send(method, url, **kwargs):
        calls.append((method, url, kwargs))
        return SimpleNamespace(ok=True, status_code=200,
            json=lambda: {'signedURL': '/object/sign/asar-files/proof.png?token=temporary'})
    monkeypatch.setattr('backend.website.storage.requests.request', send)
    return calls


def test_cloud_upload_is_removed_on_database_rollback(app, monkeypatch):
    calls = cloud(app, monkeypatch)
    with app.app_context():
        db.session.execute(text('SELECT 1'))
        save_upload(FileStorage(stream=io.BytesIO(PNG), filename='proof.png'), 'proof.png', 'image/png')
        db.session.rollback()
    assert [call[0] for call in calls] == ['POST', 'DELETE']
    assert calls[-1][2]['json'] == {'prefixes': ['proof.png']}


def test_cloud_upload_stays_after_commit_and_signed_links_are_not_cached(app, monkeypatch):
    calls = cloud(app, monkeypatch)
    with app.app_context():
        db.session.execute(text('SELECT 1'))
        save_upload(FileStorage(stream=io.BytesIO(PNG), filename='proof.png'), 'proof.png', 'image/png')
        db.session.commit()
        response = serve_upload('proof.png')
    assert len(calls) == 2
    assert calls[1][1].endswith('/object/sign/asar-files/proof.png')
    assert response.location.startswith('https://storage.example.test/storage/v1/object/sign/')
    assert response.headers['Cache-Control'] == 'private, no-store'


def test_storage_failure_does_not_fall_back_to_local_disk(app, monkeypatch, tmp_path):
    import requests
    cloud(app, monkeypatch)
    def unavailable(*args, **kwargs):
        raise requests.ConnectionError('offline')
    monkeypatch.setattr('backend.website.storage.requests.request', unavailable)
    with app.app_context():
        from werkzeug.exceptions import ServiceUnavailable
        with pytest.raises(ServiceUnavailable):
            save_upload(FileStorage(stream=io.BytesIO(PNG), filename='proof.png'), 'proof.png', 'image/png')
    from pathlib import Path
    assert not (Path(app.config['UPLOAD_FOLDER']) / 'proof.png').exists()


def test_private_media_is_authorized_before_creating_cloud_links(app, client, test_user, monkeypatch):
    calls = cloud(app, monkeypatch)
    assert client.post('/api/auth/login', json={'email': test_user.email, 'password': 'Asar8!River2'}).status_code == 200
    response = post_request(client, {'description': 'Нужна помощь с доставкой вещей',
        'latitude': 43.22, 'longitude': 76.85, 'category': 'household'})
    assert response.status_code == 201
    with app.app_context():
        application = db.session.get(Application, response.json['id'])
        filename = application.media_files[0].file_path
        db.session.add(ApplicationMedia(application_id=application.id, file_path='verification.pdf', file_type='application/pdf'))
        db.session.commit()
    public = app.test_client()
    calls.clear()
    assert public.get('/api/uploads/' + filename).status_code == 403
    assert public.get('/api/uploads/verification.pdf').status_code == 403
    assert not calls
    assert client.get('/api/uploads/verification.pdf').status_code == 302
    with app.app_context():
        db.session.get(Application, response.json['id']).moderation_status = ModerationStatus.APPROVED
        db.session.commit()
    assert public.get('/api/uploads/' + filename).status_code == 302
    assert public.get('/api/uploads/verification.pdf').status_code == 403


def test_avatar_replacement_uses_storage_and_removes_the_old_object_after_commit(app, client, test_user, monkeypatch):
    calls = cloud(app, monkeypatch)
    assert client.post('/api/auth/login', json={'email': test_user.email, 'password': 'Asar8!River2'}).status_code == 200
    avatars = []
    for _ in range(2):
        response = client.post('/api/profile/edit', data={'avatar': (io.BytesIO(PNG), 'avatar.png')})
        assert response.status_code == 200, response.json
        avatars.append(response.json['user']['avatar'])
    assert avatars[0] != avatars[1]
    assert [call[0] for call in calls] == ['POST', 'POST', 'DELETE']
    assert calls[-1][2]['json'] == {'prefixes': [avatars[0]]}
    assert app.test_client().get('/api/uploads/' + avatars[1]).status_code == 302


def test_invalid_avatar_never_reaches_cloud_storage(app, client, test_user, monkeypatch):
    calls = cloud(app, monkeypatch)
    assert client.post('/api/auth/login', json={'email': test_user.email, 'password': 'Asar8!River2'}).status_code == 200
    response = client.post('/api/profile/edit', data={'avatar': (io.BytesIO(b'not a picture'), 'avatar.png')})
    assert response.status_code == 415
    assert not calls


@pytest.mark.asyncio
async def test_telegram_conversation_survives_storage_recreation(app):
    first = DatabaseStorage(app)
    key = StorageKey(bot_id=100, chat_id=200, user_id=300)
    await first.set_state(key, 'waiting_photo')
    await first.set_data(key, {'description': 'Помогите с доставкой вещей'})
    second = DatabaseStorage(app)
    assert await second.get_state(key) == 'waiting_photo'
    assert await second.get_data(key) == {'description': 'Помогите с доставкой вещей'}
    assert await second.get_data(StorageKey(bot_id=101, chat_id=200, user_id=300)) == {}
    await second.set_state(key, None)
    await second.set_data(key, {})
    assert await first.get_state(key) is None
    assert await first.get_data(key) == {}


def test_webhook_authenticates_and_rejects_invalid_updates(app, client):
    assert client.post('/api/telegram/webhook', json={'update_id': 1}).status_code == 404
    app.config.update(TELEGRAM_BOT_TOKEN='100:test', TELEGRAM_WEBHOOK_SECRET='only-telegram')
    assert client.post('/api/telegram/webhook', json={'update_id': 1}).status_code == 403
    headers = {'X-Telegram-Bot-Api-Secret-Token': 'only-telegram'}
    assert client.post('/api/telegram/webhook', headers=headers, json={}).status_code == 400
    assert 'telegram_webhook_runtime' not in app.extensions


def test_webhook_remembers_completed_updates_after_runtime_restart(app, client):
    app.config.update(TELEGRAM_BOT_TOKEN='100:test', TELEGRAM_WEBHOOK_SECRET='only-telegram')
    headers = {'X-Telegram-Bot-Api-Secret-Token': 'only-telegram'}
    for iteration in range(2):
        runtime = TelegramRuntime(app)
        runtime.dispatcher.feed_update = AsyncMock()
        app.extensions['telegram_webhook_runtime'] = runtime
        try:
            for _ in range(2):
                response = client.post('/api/telegram/webhook', headers=headers, json={'update_id': 321})
                assert response.status_code == 200
            assert runtime.dispatcher.feed_update.await_count == (1 if iteration == 0 else 0)
        finally:
            runtime.close()
            app.extensions.pop('telegram_webhook_runtime', None)
    with app.app_context():
        assert TelegramUpdateReceipt.query.count() == 1


def test_prepare_deploy_bootstraps_empty_database_and_can_run_again(app, test_user):
    with app.app_context():
        db.session.remove()
        db.drop_all()
    try:
        runner = app.test_cli_runner()
        for _ in range(2):
            result = runner.invoke(args=['prepare-deploy'])
            assert result.exit_code == 0, result.output
        with app.app_context():
            assert set(db.metadata.tables).issubset(inspect(db.engine).get_table_names())
            assert db.session.execute(text('SELECT version_num FROM alembic_version')).scalar() == '20261126_application_cleanup'
    finally:
        with app.app_context():
            db.session.execute(text('DROP TABLE IF EXISTS alembic_version'))
            db.session.commit()


def test_prepare_deploy_migrates_existing_records_without_replacing_them(app, test_user):
    from flask_migrate import stamp
    from backend.website.models import TelegramConversation, TelegramLinkToken, User
    user_id = test_user.id
    with app.app_context():
        TelegramLinkToken.__table__.drop(db.engine)
        TelegramUpdateReceipt.__table__.drop(db.engine)
        TelegramConversation.__table__.drop(db.engine)
        db.session.execute(text('ALTER TABLE "user" ALTER COLUMN password TYPE VARCHAR(150)'))
        db.session.execute(text('ALTER TABLE "user" DROP COLUMN capability_onboarding_seen'))
        db.session.execute(text('ALTER TABLE rating DROP COLUMN is_hidden'))
        db.session.execute(text('ALTER TABLE application DROP COLUMN public_id'))
        db.session.execute(text('ALTER TABLE resources DROP COLUMN moderation_status, DROP COLUMN rejection_reason, DROP COLUMN photos'))
        db.session.commit()
        stamp(revision='20261117_volunteer_location')
    try:
        result = app.test_cli_runner().invoke(args=['prepare-deploy'])
        assert result.exit_code == 0, result.output
        with app.app_context():
            user = db.session.get(User, user_id)
            assert user.email == 'test@example.com'
            assert user.capability_onboarding_seen is True
            column = next(c for c in inspect(db.engine).get_columns('user') if c['name'] == 'password')
            assert column['type'].length == 255
            assert inspect(db.engine).has_table('telegram_conversation')
            assert inspect(db.engine).has_table('telegram_link_token')
    finally:
        with app.app_context():
            db.session.execute(text('DROP TABLE IF EXISTS alembic_version'))
            db.session.commit()


def test_cleanup_migrates_escaped_text_and_confirmed_help(app, test_application, admin_user):
    from flask_migrate import stamp
    from backend.website.models import ApplicationResponse, ResponseStatus

    with app.app_context():
        application = db.session.get(Application, test_application.id)
        application.description = 'Нужны &quot;коробки&quot; &amp; табличка &lt;b&gt;'
        application.moderation_status = ModerationStatus.APPROVED
        db.session.add(ApplicationResponse(application_id=application.id, responder_id=admin_user.id,
            status=ResponseStatus.COMPLETED))
        db.session.commit()
        stamp(revision='20261119_resource_review')
    try:
        result = app.test_cli_runner().invoke(args=['prepare-deploy'])
        assert result.exit_code == 0, result.output
        with app.app_context():
            application = db.session.get(Application, test_application.id)
            assert application.description == 'Нужны "коробки" & табличка <b>'
            assert application.is_resolved and application.status == 'completed'
            assert application.resolved_at is not None
    finally:
        with app.app_context():
            db.session.execute(text('DROP TABLE IF EXISTS alembic_version'))
            db.session.commit()


def test_health_does_not_expose_configuration(client):
    response = client.get('/api/health')
    assert response.status_code == 200
    assert response.json == {'status': 'ok'}
