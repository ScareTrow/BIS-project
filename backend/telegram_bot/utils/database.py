import logging
import os
import sys
from functools import lru_cache

backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
project_root = os.path.dirname(backend_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.website.models import User

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _standalone_app():
    from backend.website import create_app
    return create_app()


def get_app():
    from flask import current_app, has_app_context
    return current_app._get_current_object() if has_app_context() else _standalone_app()


def get_user_by_telegram_id(telegram_id):
    try:
        from flask import has_app_context
        if has_app_context():
            return User.query.filter_by(telegram_id=str(telegram_id)).first()
        flask_app = get_app()
        with flask_app.app_context():
            return User.query.filter_by(telegram_id=str(telegram_id)).first()
    except Exception as e:
        logger.error(f"Error getting user by telegram_id {telegram_id}: {e}")
        return None

