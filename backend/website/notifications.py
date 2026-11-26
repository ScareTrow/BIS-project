"""Persist notices with the workflow; dispatch Telegram only after commit."""
from sqlalchemy import event
from sqlalchemy.orm import Session

from . import db
from .models import Notification, User


def create_notification(user_id, title, message, notification_type,
                        related_application_id=None, related_user_id=None,
                        send_telegram=True, telegram_buttons=None, telegram_message=None):
    notice = Notification(user_id=user_id, title=title, message=message[:1000],
        notification_type=notification_type, related_application_id=related_application_id,
        related_user_id=related_user_id)
    db.session.add(notice)
    db.session.flush()
    user = db.session.get(User, user_id)
    if send_telegram and user and user.telegram_id:
        db.session.info.setdefault('telegram_notices', []).append(dict(
            telegram_id=str(user.telegram_id), title=title, message=telegram_message or message,
            notification_type=notification_type, **({'reply_markup': telegram_buttons} if telegram_buttons else {})))
    return notice


@event.listens_for(Session, 'after_commit')
def dispatch_committed_notices(session):
    if session.in_nested_transaction():
        return
    from flask import current_app
    from backend.telegram_bot.utils.notifications import send_notification
    session.info.pop('new_uploads', None)
    _remove_uploads(session.info.pop('retired_uploads', []))
    for notice in session.info.pop('telegram_notices', []):
        try:
            send_notification(**notice)
        except Exception:
            current_app.logger.exception('Telegram transport failed after committing notification')


@event.listens_for(Session, 'after_rollback')
def discard_uncommitted_effects(session):
    if session.in_nested_transaction():
        return
    session.info.pop('telegram_notices', None)
    session.info.pop('retired_uploads', None)
    _remove_uploads(session.info.pop('new_uploads', []))


def _remove_uploads(filenames):
    from flask import current_app
    from .storage import delete_upload
    for filename in filenames:
        try:
            delete_upload(filename)
        except Exception:
            current_app.logger.warning('Unable to remove unused upload')
