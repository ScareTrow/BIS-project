"""Prove account ownership through private, expiring Telegram start links."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from backend.website import db
from backend.website.models import User, TelegramLinkToken, VolunteerPreference
from backend.website.telegram_link import consume_link
from backend.telegram_bot.handlers.start import cmd_start


@pytest.fixture
def link_client(app, client, test_user, monkeypatch):
    app.config['TELEGRAM_BOT_TOKEN'] = 'test-token'
    monkeypatch.setattr('backend.website.telegram_link._bot_username', lambda token: 'asar_test_bot')
    assert client.post('/api/auth/login', json={'email': test_user.email, 'password': 'Asar8!River2'}).status_code == 200
    return client


def new_link(client):
    response = client.post('/api/telegram/link')
    assert response.status_code == 200
    assert response.headers['Cache-Control'] == 'private, no-store'
    assert response.json['bot_url'].startswith('https://t.me/asar_test_bot?start=link_')
    return response.json['bot_url'].split('start=link_', 1)[1]


def test_link_requires_login_but_bot_address_is_public(app, monkeypatch):
    app.config['TELEGRAM_BOT_TOKEN'] = 'test-token'
    monkeypatch.setattr('backend.website.telegram_link._bot_username', lambda token: 'asar_test_bot')
    client = app.test_client()
    assert client.post('/api/telegram/link').status_code == 401
    assert client.get('/api/telegram-bot-info').json['bot_url'] == 'https://t.me/asar_test_bot'


def test_link_is_single_use_and_stores_only_hash(app, link_client, test_user):
    token = new_link(link_client)
    assert len('link_' + token) <= 64
    with app.app_context():
        assert TelegramLinkToken.query.one().token_hash != token
        consume_link(token, '123456', 'volunteer')
        assert db.session.get(User, test_user.id).telegram_id == '123456'
        assert db.session.get(User, test_user.id).telegram_username == 'volunteer'
        assert TelegramLinkToken.query.count() == 0
        with pytest.raises(ValueError):
            consume_link(token, '999999')
        assert db.session.get(User, test_user.id).telegram_id == '123456'


def test_expired_and_replaced_links_cannot_bind(app, link_client, test_user):
    old = new_link(link_client)
    token = new_link(link_client)
    with app.app_context():
        with pytest.raises(ValueError):
            consume_link(old, '123456')
        TelegramLinkToken.query.one().expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.session.commit()
        with pytest.raises(ValueError):
            consume_link(token, '123456')
        assert db.session.get(User, test_user.id).telegram_id is None


def test_cannot_take_telegram_from_another_user(app, link_client, test_user, admin_user):
    token = new_link(link_client)
    with app.app_context():
        db.session.get(User, admin_user.id).telegram_id = '123456'
        db.session.commit()
        with pytest.raises(ValueError):
            consume_link(token, '123456')
        assert db.session.get(User, test_user.id).telegram_id is None
        assert db.session.get(User, admin_user.id).telegram_id == '123456'


def test_raw_id_cannot_bypass_telegram_confirmation(app, link_client, test_user):
    assert link_client.post('/api/profile/edit', data={'telegram_id': '123456'}).status_code == 400
    assert link_client.post('/api/link-telegram', json={'telegram_id': '123456'}).status_code == 200
    with app.app_context():
        assert db.session.get(User, test_user.id).telegram_id is None


@pytest.mark.asyncio
async def test_private_start_binds_automatically(app, link_client, test_user):
    token = new_link(link_client)
    message = SimpleNamespace(text='/start link_' + token, chat=SimpleNamespace(type='private'),
        from_user=SimpleNamespace(id=123456, username='volunteer'), answer=AsyncMock())
    with app.app_context():
        await cmd_start(message)
        assert db.session.get(User, test_user.id).telegram_id == '123456'
    assert 'успешно привязан' in message.answer.call_args_list[0].args[0]


@pytest.mark.asyncio
async def test_group_start_cannot_bind(app, link_client, test_user):
    token = new_link(link_client)
    message = SimpleNamespace(text='/start link_' + token, chat=SimpleNamespace(type='group'),
        from_user=SimpleNamespace(id=123456, username='volunteer'), answer=AsyncMock())
    with app.app_context():
        await cmd_start(message)
        assert db.session.get(User, test_user.id).telegram_id is None


def test_matching_ignores_retired_availability_flag(app, link_client, test_user, test_application):
    from backend.website.community import matching_users
    with app.app_context():
        application = db.session.get(type(test_application), test_application.id)
        application.city = 'Almaty'
        user = User(email='matching@example.com', password='hash', first_name='Helper', city='Almaty')
        db.session.add(user)
        db.session.flush()
        db.session.add(VolunteerPreference(user_id=user.id, is_available=False))
        db.session.commit()
        assert user.id in {u.id for u in matching_users(application)}
