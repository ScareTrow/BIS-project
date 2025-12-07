import logging
from aiogram.types import Message
from aiogram.filters import Command

logger = logging.getLogger(__name__)


async def cmd_help(message: Message):
    try:
        help_text = (
            "Доступные командлы:\n\n"
            "/start - Начать работу с ботом\n"
            "/create - Создать заявку\n"
            "/sos - Экстренная ситуация (SOS)\n"
            "/resources - Просмотр точек ресурсов\n"
            "/help - Показать эту справку\n\n"
            "Для создания заявки:\n"
            "1. Отправьте /create\n"
            "2. Отправьте описание (можно с фото)\n"
            "3. Отправьте геолокацию"
        )
        await message.answer(help_text)
    except Exception as e:
        logger.error(f"Error in cmd_help: {e}")
        await message.answer("Произошла ошибка. Попробуйте позже")

