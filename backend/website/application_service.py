"""Shared request rules for the website and Telegram intake."""
from datetime import datetime, timedelta, timezone
import math
from pathlib import Path
from uuid import uuid4

from flask import current_app
from sqlalchemy import and_, or_
from werkzeug.exceptions import BadRequest, Forbidden, TooManyRequests

from . import db
from .models import (
    Application, ApplicationMedia, ApplicationResponse, ModerationStatus,
    ResponseStatus, User, VolunteerPreference,
)
from .notifications import create_notification
from .validation import validate_photos
from .storage import save_upload

CATEGORY_NAMES = dict(food='Продукты', medicine='Медицина', shelter='Убежище',
    emergency='Экстренная помощь', clothing='Вещи', household='Бытовая помощь',
    delivery='Доставка', volunteering='Волонтёрство', social_project='Социальный проект')


def check_requester(user_id, *, sos=False):
    # A user row serializes SOS creation across web and bot on PostgreSQL.
    user = User.query.filter_by(id=user_id).with_for_update().one()
    now = datetime.now(timezone.utc)
    until = user.blocked_until
    if until and until.tzinfo is None:
        until = until.replace(tzinfo=timezone.utc)
    if user.is_blocked and (until is None or until > now):
        raise Forbidden('Вы заблокированы и не можете создавать заявки')
    if sos and Application.query.filter(
        Application.user_id == user_id, Application.is_sos.is_(True),
        Application.date > now - timedelta(hours=1),
    ).count() >= 3:
        raise TooManyRequests('Лимит SOS достигнут: не более 3 заявок за час')
    return user


def save_photos(application, files):
    validate_photos(files)
    for file in files:
        extension = Path(file.filename).suffix.lower()
        save_media_file(application, file, 'image/png' if extension == '.png' else 'image/jpeg')


def save_media_file(application, file, file_type):
    filename = f'app_{application.id}_{uuid4().hex}{Path(file.filename).suffix.lower()}'
    save_upload(file, filename, file_type)
    db.session.add(ApplicationMedia(application_id=application.id, file_path=filename, file_type=file_type))


def distance_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(math.radians, (lat1, lon1, lat2, lon2))
    a = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return 6371 * 2 * math.asin(math.sqrt(min(1, a)))


def notify_nearby(application):
    from backend.telegram_bot.config import Config
    volunteers = db.session.query(User, VolunteerPreference).join(
        VolunteerPreference, VolunteerPreference.user_id == User.id
    ).filter(User.id != application.user_id, User.is_blocked.is_(False),
        User.telegram_id.isnot(None), VolunteerPreference.latitude.isnot(None),
        VolunteerPreference.longitude.isnot(None)).all()
    for user, location in volunteers:
        distance = distance_km(application.latitude, application.longitude,
                               location.latitude, location.longitude)
        if distance > 10 or notification_exists(user.id, application.id):
            continue
        category = CATEGORY_NAMES[application.category.value]
        link = f'{Config.WEB_APP_URL.rstrip("/")}/applications/{application.id}'
        create_notification(user.id, 'SOS: рядом нужна помощь' if application.is_sos else 'Рядом нужна помощь',
            f'{category} · {distance:.1f} км\n{application.description[:150]}\n{link}',
            'new_request', application.id)


def notification_exists(user_id, application_id):
    from .models import Notification
    return Notification.query.filter_by(user_id=user_id, related_application_id=application_id,
        notification_type='new_request').first() is not None


def publish_sos(application):
    application.moderation_status = ModerationStatus.APPROVED
    application.status = 'open'
    application.is_sos = True
    application.priority = 5
    application.priority_source = 'user_sos'
    db.session.add(application)
    db.session.flush()
    notify_nearby(application)


def lifecycle(application):
    if application.is_false_call or application.moderation_status == ModerationStatus.REJECTED:
        return 'rejected'
    if application.moderation_status == ModerationStatus.PENDING:
        return 'pending'
    if application.is_resolved:
        return 'completed'
    if any(r.status in (ResponseStatus.ACCEPTED, ResponseStatus.COMPLETED) for r in application.responses):
        return 'in_progress'
    return 'open'


def pending_review():
    return or_(Application.moderation_status == ModerationStatus.PENDING,
        and_(Application.is_sos.is_(True), Application.moderated_at.is_(None),
             Application.moderation_status == ModerationStatus.APPROVED))


def visible_requests(user, status='active'):
    if status not in ('active', 'all', 'open', 'in_progress', 'completed'):
        raise BadRequest('Неизвестный статус заявки')
    active_response = ApplicationResponse.query.filter(
        ApplicationResponse.application_id == Application.id,
        ApplicationResponse.status.in_([ResponseStatus.ACCEPTED, ResponseStatus.COMPLETED]),
    ).exists()
    state = Application.is_resolved.is_(True) if status == 'completed' else Application.is_resolved.is_(False)
    if status != 'completed':
        state = and_(state, unexpired_request())
    if status == 'open':
        state = and_(state, ~active_response)
    elif status == 'in_progress':
        state = and_(state, active_response)
    public = and_(Application.moderation_status == ModerationStatus.APPROVED, state)
    if user.is_authenticated:
        public = or_(public, and_(Application.user_id == user.id,
            Application.moderation_status == ModerationStatus.PENDING,
            Application.is_resolved.is_(False), unexpired_request()))
    return Application.query.filter(public, Application.is_false_call.is_(False))


def unexpired_request():
    return or_(Application.expires_at.is_(None), Application.expires_at > datetime.now(timezone.utc))
