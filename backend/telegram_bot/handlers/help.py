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
            "2. Отправьте описание (10–1000 символов) и фото JPEG/PNG до 10 МБ\n"
            "3. Отправьте геолокацию (Location)\n\n"
            "<b>Как создать SOS:</b>\n"
            "1. Нажмите кнопку \"🚨 SOS - Экстренная помощь\"\n"
            "2. Отправьте фото, затем геолокацию (Location)\n"
            "3. SOS сразу появится на карте; не более 3 SOS за час\n\n"
            "/location — сохранить точку для оповещений о помощи в радиусе 10 км\n\n"
            "💡 <i>Обычная заявка появится после модерации. SOS проверяется после публикации.</i>"
        )
        await message.answer(help_text, parse_mode="HTML")
    except Exception as e:
        logger.error(f"Error in cmd_help: {e}")
        await message.answer("Произошла ошибка. Попробуйте позже")

