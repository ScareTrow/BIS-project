import logging
from aiogram.types import Message
from aiogram.fsm.context import FSMContext
from backend.telegram_bot.utils.database import get_user_by_telegram_id

logger = logging.getLogger(__name__)


async def require_auth(message: Message, state: FSMContext = None):
    telegram_id = str(message.from_user.id)
    user = get_user_by_telegram_id(telegram_id)
    
    if not user:
        await message.answer("Сначала авторизуйтесь через /start")
        if state and hasattr(state, 'clear'):
            try:
                await state.clear()
            except (TypeError, AttributeError):
                pass
        return None
    
    return user

