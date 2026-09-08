import logging
from aiogram.types import Message
from aiogram.filters import Command

logger = logging.getLogger(__name__)


async def cmd_help(message: Message):
    try:
        help_text = (
            "<b>📖 Справка по использованию бота</b>\n\n"
            "<b>Основные функции:</b>\n"
            "📝 <b>Создать заявку</b> - создайте новую заявку о помощи\n"
            "🚨 <b>SOS - Экстренная помощь</b> - экстренная ситуация, требующая немедленной помощи\n\n"
            "<b>Как создать заявку:</b>\n"
            "1. Нажмите кнопку \"📝 Создать заявку\"\n"
            "2. Отправьте описание проблемы (можно с фото)\n"
            "3. Отправьте геолокацию (Location)\n\n"
            "<b>Как создать SOS:</b>\n"
            "1. Нажмите кнопку \"🚨 SOS - Экстренная помощь\"\n"
            "2. Отправьте геолокацию (Location)\n\n"
            "💡 <i>После создания заявка будет отправлена на модерацию. Вы получите уведомление, когда заявка будет одобрена.</i>"
        )
        await message.answer(help_text, parse_mode="HTML")
    except Exception as e:
        logger.error(f"Error in cmd_help: {e}")
        await message.answer("Произошла ошибка. Попробуйте позже")

