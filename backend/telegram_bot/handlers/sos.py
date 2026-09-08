import logging
from aiogram.types import Message
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from backend.telegram_bot.middleware.auth import require_auth
from backend.telegram_bot.states import ApplicationStates

logger = logging.getLogger(__name__)


async def cmd_sos(message: Message, state: FSMContext):
    user = await require_auth(message, state)
    if not user:
        return
    
    try:
        sos_text = (
            "🚨 <b>SOS - Экстренная ситуация!</b>\n\n"
            "📍 Отправь геолокацию (Location) для создания SOS заявки\n\n"
            "⚠️ <i>Эта заявка будет приоритетной и видна всем пользователям</i>"
        )
        
        sent_msg = await message.answer(sos_text, parse_mode="HTML")
        await state.update_data(help_message_id=sent_msg.message_id)
        await state.set_state(ApplicationStates.waiting_sos_location)
    except Exception as e:
        logger.error(f"Error in cmd_sos: {e}")
        await message.answer("😔 Произошла ошибка. Попробуй позже")

