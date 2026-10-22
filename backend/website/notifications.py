"""Remove uncommitted upload files and keep committed files."""
from pathlib import Path
from sqlalchemy import event
from sqlalchemy.orm import Session


@event.listens_for(Session, 'after_commit')
def dispatch_committed_notices(session):
    session.info.pop('new_uploads', None)


@event.listens_for(Session, 'after_rollback')
def discard_uncommitted_effects(session):
    for filename in session.info.pop('new_uploads', []):
        Path(filename).unlink(missing_ok=True)
