import logging
import os
import sys
from datetime import datetime, timezone
from aiogram.types import Message
from aiogram.filters import Command

backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
project_root = os.path.dirname(backend_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.website import create_app
from backend.website.models import Application, ApplicationCategory, ModerationStatus
from backend.telegram_bot.middleware.auth import require_auth

logger = logging.getLogger(__name__)


async def cmd_resources(message: Message):
    user = await require_auth(message)
    if not user:
        return
    
    try:
        from backend.telegram_bot.bot import flask_app
        with flask_app.app_context():
            resources = Application.query.filter(
                Application.category.in_([
                    ApplicationCategory.FOOD,
                    ApplicationCategory.SHELTER,
                    ApplicationCategory.MEDICINE
                ]),
                Application.moderation_status == ModerationStatus.APPROVED,
                Application.expires_at > datetime.now(timezone.utc)
            ).limit(10).all()
            
            if not resources:
                await message.answer("Нет доступных точек ресурсов")
                return
            
            message_text = "Точки ресурсов:\n\n"
            for res in resources:
                message_text += (
                    f"📍 {res.description[:50]}...\n"
                    f"Координаты: {res.latitude}, {res.longitude}\n"
                    f"Действует до: {res.expires_at.strftime('%d.%m.%Y')}\n\n"
                )
            
            await message.answer(message_text)
    except Exception as e:
        logger.error(f"Error in cmd_resources: {e}")
        await message.answer("Произошла ошибка при получении точек ресурсов")

