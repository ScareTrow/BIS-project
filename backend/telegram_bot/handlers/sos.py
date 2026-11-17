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
        await state.clear()
        await state.update_data(sos_mode=True)
        sos_text = (
            "🚨 <b>SOS - Экстренная ситуация!</b>\n\n"
            "📷 Отправь фото JPEG/PNG до 10 МБ, затем геолокацию\n\n"
            "⚠️ <i>SOS публикуется сразу. Лимит — 3 SOS за час.</i>"
        )
        
        sent_msg = await message.answer(sos_text, parse_mode="HTML")
        await state.update_data(help_message_id=sent_msg.message_id)
        await state.set_state(ApplicationStates.waiting_photo)
    except Exception as e:
        logger.error(f"Error in cmd_sos: {e}")
        await message.answer("😔 Произошла ошибка. Попробуй позже")

