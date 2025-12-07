import logging
from aiogram.types import Message
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from backend.telegram_bot.middleware.auth import require_auth
from backend.telegram_bot.states import ApplicationStates

logger = logging.getLogger(__name__)


async def cmd_create(message: Message, state: FSMContext):
    user = await require_auth(message, state)
    if not user:
        return
    
    try:
        help_text = (
            "<b>Создание заявки</b>\n\n"
            "1️⃣ Отправь описание заявки текстом или с фото\n"
            "2️⃣ Отправь геолокацию (Location)\n\n"
            "💡 <i>Можно отправить фото с подписью или просто текст</i>"
        )
        
        sent_msg = await message.answer(help_text, parse_mode="HTML")
        await state.update_data(help_message_id=sent_msg.message_id)
        await state.set_state(ApplicationStates.waiting_description)
    except Exception as e:
        logger.error(f"Error in cmd_create: {e}")
        await message.answer("😔 Произошла ошибка. Попробуй позже.")

