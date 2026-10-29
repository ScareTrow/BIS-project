"""Transactional storage of validated request photos."""
from pathlib import Path
from uuid import uuid4

from flask import current_app
from . import db, notifications
from sqlalchemy import and_, or_
from werkzeug.exceptions import BadRequest
from .models import Application, ApplicationMedia, ApplicationResponse, ModerationStatus, ResponseStatus
from .validation import validate_photos


def save_photos(application, files):
    validate_photos(files)
    for file in files:
        extension = Path(file.filename).suffix.lower()
        save_media_file(application, file, 'image/png' if extension == '.png' else 'image/jpeg')


def save_media_file(application, file, file_type):
    folder = Path(current_app.config['UPLOAD_FOLDER'])
    folder.mkdir(parents=True, exist_ok=True)
    filename = f'app_{application.id}_{uuid4().hex}{Path(file.filename).suffix.lower()}'
    target = folder / filename
    db.session.info.setdefault('new_uploads', []).append(str(target))
    file.save(target)
    db.session.add(ApplicationMedia(application_id=application.id, file_path=filename, file_type=file_type))


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


def visible_requests(user, status='active'):
    if status not in ('active', 'all', 'open', 'in_progress', 'completed'):
        raise BadRequest('Неизвестный статус заявки')
    active_response = ApplicationResponse.query.filter(
        ApplicationResponse.application_id == Application.id,
        ApplicationResponse.status.in_([ResponseStatus.ACCEPTED, ResponseStatus.COMPLETED]),
    ).exists()
    state = Application.is_resolved.is_(True) if status == 'completed' else Application.is_resolved.is_(False)
    if status == 'open':
        state = and_(state, ~active_response)
    elif status == 'in_progress':
        state = and_(state, active_response)
    public = and_(Application.moderation_status == ModerationStatus.APPROVED, state)
    if user.is_authenticated:
        public = or_(public, and_(Application.user_id == user.id,
            Application.moderation_status == ModerationStatus.PENDING,
            Application.is_resolved.is_(False)))
    return Application.query.filter(public, Application.is_false_call.is_(False))
