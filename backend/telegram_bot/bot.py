import os
import sys
import logging
import asyncio
from aiogram import Bot, Dispatcher, F
from aiogram.types import Message
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

from backend.website import create_app
from backend.telegram_bot.config import Config
from backend.telegram_bot.states import ApplicationStates
from backend.telegram_bot.handlers import start, create, sos, resources, help, common

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

Config.validate()

flask_app = create_app()
dp = Dispatcher(storage=MemoryStorage())


dp.message.register(start.cmd_start, Command("start"))
dp.message.register(create.cmd_create, Command("create"))
dp.message.register(sos.cmd_sos, Command("sos"))

dp.message.register(create.cmd_create, F.text == "📝 Создать заявку")
dp.message.register(sos.cmd_sos, F.text == "🚨 SOS - Экстренная помощь")

dp.message.register(
    common.process_description,
    ApplicationStates.waiting_description,
    F.photo | F.text
)
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


@dp.errors(ExceptionTypeFilter(TelegramAPIError))
async def telegram_api_error_handler(update, exception):
    logger.error(f"Telegram API error: {exception}")
    return True


@dp.errors()
async def general_error_handler(update, exception):
    logger.error(f"Unhandled error: {exception}", exc_info=True)
    return True


async def main():
    if not Config.TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not set in environment variables")
        return
    
    bot = Bot(token=Config.TELEGRAM_BOT_TOKEN)
    logger.info("Telegram bot started...")
    await dp.start_polling(bot)


if __name__ == '__main__':
    asyncio.run(main())
