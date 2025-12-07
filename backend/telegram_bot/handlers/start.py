import logging
from aiogram import F
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton
from aiogram.filters import Command
from backend.telegram_bot.utils.database import get_user_by_telegram_id
from backend.telegram_bot.config import Config

logger = logging.getLogger(__name__)


async def cmd_start(message: Message):
    telegram_id = str(message.from_user.id)
    
    try:
        user = get_user_by_telegram_id(telegram_id)
        
        if user:
            greeting = f"👋 Привет, {user.first_name}!"
            if user.last_name:
                greeting += f" {user.last_name}"
            
            welcome_text = (
                f"{greeting}\n\n"
                "Рад видеть тебя снова! 😊\n\n"
                "Чем могу помочь?"
            )
            
            keyboard = ReplyKeyboardMarkup(
                keyboard=[
                    [KeyboardButton(text="📝 Создать заявку")],
                    [KeyboardButton(text="🚨 SOS - Экстренная помощь")],
                    [KeyboardButton(text="📋 Мои заявки")],
                    [KeyboardButton(text="ℹ️ Помощь")]
                ],
                resize_keyboard=True,
                one_time_keyboard=False
            )
            
            await message.answer(welcome_text, reply_markup=keyboard)
        else:
            help_text = (
                "👋 Привет! Я бот платформы ASAR\n\n"
                "Для использования бота нужно связать твой Telegram аккаунт с аккаунтом на сайте\n\n"
                f"📱 <b>Твой Telegram ID:</b> <code>{telegram_id}</code>\n\n"
                "📝 <b>Как привязать:</b>\n"
                "1. Открой сайт и войди в свой аккаунт (или зарегистрируйся)\n"
                "2. Перейди в раздел 'Мой профиль'\n"
                "3. Введи свой Telegram ID и сохрани\n"
                "4. После привязки используй /start снова\n\n"
                f"🌐 <b>Сайт:</b> {Config.WEB_APP_URL}\n\n"
                "💡 <i>При регистрации также можно указать Telegram ID</i>"
            )
            
            keyboard = InlineKeyboardMarkup(
                inline_keyboard=[
                    [InlineKeyboardButton(text="🌐 Открыть сайт", url=Config.WEB_APP_URL)]
                ]
            )
            
            await message.answer(help_text, parse_mode="HTML", reply_markup=keyboard)
    except Exception as e:
        logger.error(f"Error in cmd_start: {e}")
        await message.answer("😔 Произошла ошибка. Попробуй позже")

