import logging
import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
project_root = os.path.dirname(backend_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.website.models import User

logger = logging.getLogger(__name__)


def get_user_by_telegram_id(telegram_id):
    try:
        from backend.website import create_app
        flask_app = create_app()
        with flask_app.app_context():
            return User.query.filter_by(telegram_id=str(telegram_id)).first()
    except Exception as e:
        logger.error(f"Error getting user by telegram_id {telegram_id}: {e}")
        return None

