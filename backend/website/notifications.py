"""Persist notices with the workflow; dispatch Telegram only after commit."""
from pathlib import Path

from sqlalchemy import event
from sqlalchemy.orm import Session

from . import db
from .models import Notification, User


def create_notification(user_id, title, message, notification_type,
                        related_application_id=None, related_user_id=None,
                        send_telegram=True):
    notice = Notification(user_id=user_id, title=title, message=message[:1000],
        notification_type=notification_type, related_application_id=related_application_id,
        related_user_id=related_user_id)
    db.session.add(notice)
    db.session.flush()
    user = db.session.get(User, user_id)
    if send_telegram and user and user.telegram_id:
        db.session.info.setdefault('telegram_notices', []).append(dict(
            telegram_id=str(user.telegram_id), title=title, message=message,
            notification_type=notification_type))
    return notice


@event.listens_for(Session, 'after_commit')
def dispatch_committed_notices(session):
    from flask import current_app
    from backend.telegram_bot.utils.notifications import send_notification
    session.info.pop('new_uploads', None)
    for notice in session.info.pop('telegram_notices', []):
        try:
            send_notification(**notice)
        except Exception:
            current_app.logger.exception('Telegram transport failed after committing notification')


@event.listens_for(Session, 'after_rollback')
def discard_uncommitted_effects(session):
    session.info.pop('telegram_notices', None)
    for filename in session.info.pop('new_uploads', []):
        Path(filename).unlink(missing_ok=True)
