"""Resource points are offers, not food/shelter requests."""

import logging
from aiogram.types import Message, CallbackQuery
from backend.website import db
from backend.website.models import Resource, ResourceConfirmation, User
from backend.website.community import expire_confirmations, answer_confirmation
from backend.telegram_bot.middleware.auth import require_auth

logger = logging.getLogger(__name__)


async def cmd_resources(message: Message):
    user = await require_auth(message)
    if not user:
        return
    try:
        from backend.telegram_bot.bot import flask_app

        with flask_app.app_context():
            expire_confirmations()
            db.session.commit()
            query = Resource.query.filter_by(availability="available")
            if user.city:
                query = query.filter_by(city=user.city)
            resources = query.order_by(Resource.id.desc()).limit(10).all()
            lines = [
                f"{r.name} — {r.city}\nКоординаты: {r.latitude}, {r.longitude}"
                for r in resources
            ]
        await message.answer(
            "Доступные ресурсы:\n\n" + "\n\n".join(lines)
            if lines
            else "Нет доступных точек ресурсов"
        )
    except Exception:
        logger.exception("Error listing resource points")
        await message.answer("Не удалось получить ресурсы. Попробуйте позже.")


async def confirm_resource_callback(callback: CallbackQuery):
    from backend.telegram_bot.bot import flask_app

    try:
        _, _, identifier, answer = callback.data.split("_", 3)
        with flask_app.app_context():
            user = User.query.filter_by(telegram_id=str(callback.from_user.id)).first()
            confirmation = db.session.get(ResourceConfirmation, int(identifier))
            if user is None or confirmation is None:
                await callback.answer(
                    "Подключите аккаунт ASAR или откройте действующее напоминание.",
                    show_alert=True,
                )
                return
            answer_confirmation(confirmation, user.id, answer)
            db.session.commit()
        await callback.answer("Доступность ресурса обновлена")
    except (ValueError, PermissionError) as error:
        await callback.answer(str(error), show_alert=True)
    except Exception:
        logger.exception("Error confirming a resource")
        await callback.answer(
            "Не удалось сохранить ответ. Попробуйте позже.", show_alert=True
        )
