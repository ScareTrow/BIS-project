import os
import sys
import logging
import asyncio
from aiogram import Bot, Dispatcher, F
from aiogram.types import Message, ErrorEvent
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.filters import ExceptionTypeFilter
from aiogram.exceptions import TelegramAPIError

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
project_root = os.path.dirname(backend_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from werkzeug.local import LocalProxy
from backend.telegram_bot.utils.database import get_app
from backend.telegram_bot.config import Config
from backend.telegram_bot.states import ApplicationStates
from backend.telegram_bot.handlers import start, create, sos, resources, help, common, rating

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

flask_app = LocalProxy(get_app)


def create_dispatcher(storage=None):
    dp = Dispatcher(storage=storage or MemoryStorage())


    dp.message.register(start.cmd_start, Command("start"))
    dp.message.register(create.cmd_create, Command("create"))
    dp.message.register(sos.cmd_sos, Command("sos"))
    dp.message.register(rating.cmd_rate, Command("rate"))
    dp.message.register(help.cmd_help, Command("help"))
    dp.message.register(resources.cmd_resources, Command("resources"))


    @dp.message(Command('location'))
    async def volunteer_location_prompt(message: Message, state: FSMContext):
        from backend.telegram_bot.middleware.auth import require_auth
        if not await require_auth(message, state):
            return
        await state.clear()
        await state.set_state(ApplicationStates.waiting_volunteer_location)
        await message.answer('Отправьте свою геолокацию для оповещений о заявках в радиусе 10 км. Точка не будет показана в публичном профиле.')

    dp.message.register(create.cmd_create, F.text == "📝 Создать заявку")
    dp.message.register(sos.cmd_sos, F.text == "🚨 SOS - Экстренная помощь")
    dp.message.register(help.cmd_help, F.text == "ℹ️ Помощь")
    dp.message.register(rating.handle_rating_comment, rating.RatingStates.waiting_comment)

    dp.message.register(
        common.process_description,
        ApplicationStates.waiting_description,
        F.photo | F.document | F.text
    )
    dp.message.register(common.process_photo, ApplicationStates.waiting_photo)
    dp.message.register(common.save_volunteer_location, ApplicationStates.waiting_volunteer_location, F.location)
    dp.message.register(
        common.process_location,
        ApplicationStates.waiting_location,
        F.location
    )
    dp.message.register(
        common.process_sos_location,
        ApplicationStates.waiting_sos_location,
        F.location
    )

    dp.callback_query.register(rating.handle_rate_callback, F.data.startswith("rate_"))
    dp.callback_query.register(rating.handle_rating_callback, F.data.startswith("rating_"))
    dp.callback_query.register(resources.confirm_resource_callback, F.data.startswith("resource_confirm_"))


    @dp.errors(ExceptionTypeFilter(TelegramAPIError))
    async def telegram_api_error_handler(event: ErrorEvent):
        logger.error("Telegram API error: %s", type(event.exception).__name__)
        return True


    @dp.errors()
    async def general_error_handler(event: ErrorEvent):
        logger.error("Unhandled bot error: %s", type(event.exception).__name__)
        from flask import current_app, has_app_context
        if has_app_context() and current_app.config.get('TELEGRAM_WEBHOOK_SECRET'):
            raise event.exception
        return True
    return dp


async def main():
    if not Config.TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not set in environment variables")
        return
    
    from backend.telegram_bot.storage import DatabaseStorage
    dp = create_dispatcher(DatabaseStorage(get_app()))
    bot = Bot(token=Config.TELEGRAM_BOT_TOKEN)
    logger.info("Telegram bot started...")
    await dp.start_polling(bot)


if __name__ == '__main__':
    asyncio.run(main())
