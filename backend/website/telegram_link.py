"""Short-lived, single-use links prove ownership of a Telegram account."""
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from hashlib import sha256
import secrets

import requests
from flask import Blueprint, current_app, jsonify
from flask_login import current_user, login_required
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import ServiceUnavailable

from . import db
from .models import TelegramLinkToken, User

telegram_link = Blueprint('telegram_link', __name__)


@lru_cache(maxsize=4)
def _bot_username(token):
    try:
        response = requests.get(f'https://api.telegram.org/bot{token}/getMe', timeout=10)
        data = response.json()
        if response.ok and data.get('ok') and data['result'].get('username'):
            return data['result']['username']
    except (requests.RequestException, ValueError, KeyError):
        pass
    raise ServiceUnavailable('Бот временно недоступен. Попробуйте позже.')


def bot_url():
    token = current_app.config.get('TELEGRAM_BOT_TOKEN')
    if not token:
        raise ServiceUnavailable('Telegram-бот не настроен')
    return 'https://t.me/' + _bot_username(token)


@telegram_link.post('/api/telegram/link')
@login_required
def create_link():
    url = bot_url()
    user = User.query.filter_by(id=current_user.id).with_for_update().one()
    TelegramLinkToken.query.filter_by(user_id=user.id).delete()
    token = secrets.token_urlsafe(24)
    db.session.add(TelegramLinkToken(token_hash=sha256(token.encode()).hexdigest(),
        user_id=user.id, expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)))
    db.session.commit()
    response = jsonify(bot_url=url + '?start=link_' + token, expires_in=600)
    response.headers['Cache-Control'] = 'private, no-store'
    return response


def consume_link(token, telegram_id, username=None):
    token_hash = sha256(token.encode()).hexdigest()
    record = TelegramLinkToken.query.filter_by(token_hash=token_hash).first()
    if record is not None:
        # Match create_link's lock order so refreshing a link cannot deadlock
        # with Telegram consuming the preceding link.
        user = User.query.filter_by(id=record.user_id).with_for_update().one()
        record = TelegramLinkToken.query.filter_by(token_hash=token_hash).populate_existing().with_for_update().first()
    now = datetime.now(timezone.utc)
    if record is None or record.expires_at <= now:
        db.session.rollback()
        raise ValueError('Ссылка истекла или уже использована. Откройте профиль на сайте и получите новую ссылку.')
    existing = User.query.filter_by(telegram_id=str(telegram_id)).first()
    if existing and existing.id != user.id:
        db.session.rollback()
        raise ValueError('Этот Telegram уже привязан к другому аккаунту ASAR.')
    user.telegram_id = str(telegram_id)
    user.telegram_username = username
    TelegramLinkToken.query.filter_by(user_id=user.id).delete()
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise ValueError('Этот Telegram уже привязан к другому аккаунту ASAR.') from None
    return user
