"""Transactional storage of validated request photos."""
from pathlib import Path
from uuid import uuid4

from flask import current_app
from . import db, notifications
from .models import ApplicationMedia
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
