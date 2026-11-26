"""Shared request rules for the website and Telegram intake."""
from datetime import datetime, timedelta, timezone
import math
from pathlib import Path
from uuid import uuid4

from flask import current_app
from sqlalchemy import and_, func, or_
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.exceptions import BadRequest, Conflict, Forbidden, TooManyRequests

from . import db
from .models import (
    Application, ApplicationMedia, ApplicationResponse, ModerationStatus, Notification,
    Rating, ResponseStatus, User, VolunteerPreference,
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
        link = f'{Config.WEB_APP_URL.rstrip("/")}/applications/{application.public_id}'
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


def application_link(application):
    from backend.telegram_bot.config import Config
    return f'{Config.WEB_APP_URL.rstrip("/")}/applications/{application.public_id}'


def open_application_button(application):
    from urllib.parse import urlsplit
    url = application_link(application)
    parsed = urlsplit(url)
    if parsed.scheme in ('http', 'https') and parsed.hostname not in (None, 'localhost', '127.0.0.1', '::1'):
        return [{'text': '🔗 Открыть заявку', 'url': url}]
    return []


def decide_response(application, response, actor_id, *, accept):
    """Apply a decision with the application row locked by the caller."""
    if application.user_id != actor_id:
        raise Forbidden('Управлять откликами может только автор заявки')
    if response.application_id != application.id:
        raise BadRequest('Отклик не относится к этой заявке')
    if response.status != ResponseStatus.PENDING:
        raise Conflict('Отклик уже обработан')
    if application.is_resolved or application.is_false_call or application.moderation_status != ModerationStatus.APPROVED:
        raise Conflict('Заявка больше не доступна для помощи')

    category = CATEGORY_NAMES[application.category.value]
    cancelled = [response]
    if accept:
        cancelled = [item for item in application.responses if item.status == ResponseStatus.ACCEPTED]
        response.status = ResponseStatus.ACCEPTED
        link_button = open_application_button(application)
        create_notification(response.responder_id, 'Отклик принят',
            f'Ваш отклик на заявку #{application.id} принят. Контакты автора доступны в заявке.',
            'response_accepted', application.id, telegram_buttons=[link_button] if link_button else None,
            telegram_message=f'Ваш отклик на заявку «{category}» принят. Контакты автора доступны в заявке.')
        create_notification(application.user_id, 'Отклик принят',
            f'Подтвердите получение помощи в заявке #{application.id}.',
            'rate_volunteer_reminder', application.id, related_user_id=response.responder_id,
            telegram_buttons=[[{'text': '✅ Помощь получена', 'callback_data': f'done:{application.id}'}]])
    for item in cancelled:
        item.status = ResponseStatus.CANCELLED
        create_notification(item.responder_id, 'Отклик отклонён',
            f'Ваш отклик на заявку #{application.id} был отклонён',
            'response_rejected', application.id)


def resolve(application):
    """Close a request already locked and checked by the author action."""
    application.is_resolved = True
    application.status = 'completed'
    application.resolved_at = datetime.now(timezone.utc)
    completed = 0
    for response in application.responses:
        if response.status != ResponseStatus.ACCEPTED:
            continue
        response.status = ResponseStatus.COMPLETED
        completed += 1
        create_notification(response.responder_id, 'Заявка завершена',
            f'Автор подтвердил помощь по заявке #{application.id}',
            'application_resolved', application.id)
    return completed


def validate_rating(data):
    if not isinstance(data, dict):
        raise BadRequest('Некорректная оценка')
    score = data.get('score')
    if type(score) is not int or not 1 <= score <= 5:
        raise BadRequest('Оценка должна быть от 1 до 5')
    comment = data.get('comment', '')
    if not isinstance(comment, str) or len(comment) > 1000:
        raise BadRequest('Отзыв должен содержать не более 1000 символов')
    return score, comment.strip()


def save_response_rating(response, actor_id, score, comment):
    if response.application.user_id != actor_id:
        raise Forbidden('Оценку оставляет автор заявки')
    if response.status != ResponseStatus.COMPLETED:
        raise Conflict('Помощь ещё не завершена')
    helper = User.query.filter_by(id=response.responder_id).with_for_update().one()
    if Rating.query.filter_by(application_id=response.application_id, rater_id=actor_id, rated_id=helper.id).first():
        raise Conflict('Вы уже оценили этот отклик')
    rating = Rating(application_id=response.application_id, rater_id=actor_id, rated_id=helper.id,
                    rating_value=score, comment=comment)
    db.session.add(rating)
    db.session.flush()
    helper.rating_sum, helper.rating_count = db.session.query(
        func.sum(Rating.rating_value), func.count(Rating.id)).filter(Rating.rated_id == helper.id).one()
    helper.update_badge()
    return rating


def notify_rating(rating):
    message = f'Ваша помощь по заявке #{rating.application_id} оценена на {rating.rating_value}/5'
    create_notification(rating.rated_id, 'Новая оценка', message, 'rating_received', rating.application_id,
        telegram_message=message + (f'\nОтзыв: {rating.comment}' if rating.comment else ''))


def close_with_ratings(application, ratings):
    completed = resolve(application)
    saved_ratings = []
    if ratings:
        try:
            with db.session.begin_nested():
                for response, score, comment in sorted(ratings, key=lambda item: item[0].responder_id):
                    saved_ratings.append(save_response_rating(response, application.user_id, score, comment))
        except (SQLAlchemyError, Conflict):
            current_app.logger.warning('Could not save ratings while resolving request %s', application.id, exc_info=True)
            saved_ratings = []
    for rating in saved_ratings:
        notify_rating(rating)
    request_rating(application)
    return completed


def rating_buttons(response):
    return [{'text': f'⭐{score}', 'callback_data': f'rate:{response.id}:{score}'} for score in range(1, 6)]


def request_rating(application):
    rated = {rating.rated_id for rating in Rating.query.filter_by(
        application_id=application.id, rater_id=application.user_id)}
    unrated = [response for response in application.responses
        if response.status == ResponseStatus.COMPLETED and response.responder_id not in rated]
    if not unrated:
        return
    category = CATEGORY_NAMES[application.category.value]
    caption = f'Оцените помощь по заявке «{category}».'
    rows = []
    for index, response in enumerate(unrated[:10], start=1):
        name = ' '.join(filter(None, (response.responder.first_name, response.responder.last_name)))
        caption += f'\n{index}. {name}'
        buttons = rating_buttons(response)
        if len(unrated) > 1:
            for button in buttons:
                button['text'] = f'{index} · {button["text"]}'
        rows.append(buttons)
    create_notification(application.user_id, 'Оцените помощников',
        f'Пожалуйста, оцените помощь по заявке #{application.id}',
        'rate_volunteers', application.id, telegram_buttons=rows, telegram_message=caption)


def remind_about_legacy_ratings(user_id):
    completed = ApplicationResponse.query.filter(
        ApplicationResponse.application_id == Application.id,
        ApplicationResponse.status == ResponseStatus.COMPLETED,
        ~Rating.query.filter(Rating.application_id == ApplicationResponse.application_id,
            Rating.rater_id == user_id, Rating.rated_id == ApplicationResponse.responder_id).exists(),
    ).exists()
    notified = Notification.query.filter(
        Notification.related_application_id == Application.id,
        Notification.user_id == user_id, Notification.notification_type == 'rate_volunteers',
    ).exists()
    applications = Application.query.filter_by(
        user_id=user_id, is_resolved=True, is_false_call=False,
    ).filter(completed, ~notified).order_by(Application.id.desc()).limit(10).all()
    for application in applications:
        application = Application.query.filter_by(id=application.id).with_for_update().first()
        if application and not Notification.query.filter_by(
            related_application_id=application.id, user_id=user_id, notification_type='rate_volunteers',
        ).first():
            request_rating(application)


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
    if user.is_authenticated and status in ('active', 'all'):
        public = or_(public, and_(Application.user_id == user.id,
            Application.moderation_status == ModerationStatus.PENDING,
            Application.is_resolved.is_(False), unexpired_request()))
    return Application.query.filter(public, Application.is_false_call.is_(False))


def unexpired_request():
    return or_(Application.expires_at.is_(None), Application.expires_at > datetime.now(timezone.utc))
