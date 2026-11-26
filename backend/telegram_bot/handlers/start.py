import logging
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton
from backend.telegram_bot.utils.database import get_app, get_user_by_telegram_id
from backend.telegram_bot.config import Config

logger = logging.getLogger(__name__)


async def cmd_start(message: Message):
    telegram_id = str(message.from_user.id)

    text = message.text if isinstance(message.text, str) else ''
    parts = text.split(maxsplit=1)
    if len(parts) == 2 and parts[1].startswith('link_'):
        if message.chat.type != 'private':
            await message.answer('Для привязки откройте личный чат с ботом по ссылке из профиля ASAR.')
            return
        from backend.website.telegram_link import consume_link
        try:
            with get_app().app_context():
                consume_link(parts[1][5:], telegram_id, message.from_user.username)
        except ValueError as error:
            await message.answer(str(error))
            return
        await message.answer('Telegram успешно привязан к вашему аккаунту ASAR. Вернитесь на сайт — Telegram ID заполнится автоматически.')
    
    try:
        user = get_user_by_telegram_id(telegram_id)
        
        if user:
            name = ' '.join(filter(None, (user.first_name, user.last_name)))
            greeting = f'👋 Привет, {name}!'

            welcome_text = (
                f"{greeting}\n\n"
                "Рад видеть тебя снова! 😊\n\n"
                "Используй кнопки ниже для быстрого доступа к функциям бота."
            )
            
            keyboard = ReplyKeyboardMarkup(
                keyboard=[
                    [KeyboardButton(text="📝 Создать заявку")],
                    [KeyboardButton(text="🚨 SOS - Экстренная помощь")],
                    [KeyboardButton(text="📋 Мои заявки"), KeyboardButton(text="ℹ️ Помощь")]
                ],
                resize_keyboard=True,
                one_time_keyboard=False
            )
            
            await message.answer(welcome_text, reply_markup=keyboard)
            if message.chat.type == 'private':
                from backend.website import db
                from backend.website.application_service import remind_about_legacy_ratings

                try:
                    with get_app().app_context():
                        remind_about_legacy_ratings(user.id)
                        db.session.commit()
                except Exception:
                    logger.exception('Could not queue legacy rating reminders')
        else:
            help_text = (
                "Для использования бота необходимо связать ваш Telegram аккаунт с аккаунтом на сайте.\n\n"
                f"Ваш Telegram ID: <code>{telegram_id}</code>\n\n"
                "<b>Инструкция:</b>\n"
                "1. Откройте сайт и войдите в свой аккаунт (или зарегистрируйтесь)\n"
                "2. В профиле нажмите «Привязать Telegram»\n"
                "3. Откройте персональную ссылку и нажмите Start\n"
                "4. Аккаунт свяжется автоматически, вводить Telegram ID не нужно\n\n"
                f"Сайт: {Config.WEB_APP_URL}"
            )
            
            web_url = Config.WEB_APP_URL
            is_valid_url = web_url and not web_url.startswith('http://localhost') and not web_url.startswith('https://localhost')
            
            if is_valid_url:
                keyboard = InlineKeyboardMarkup(
                    inline_keyboard=[
                        [InlineKeyboardButton(text="🌐 Открыть сайт", url=web_url)]
                    ]
                )
                await message.answer(help_text, parse_mode="HTML", reply_markup=keyboard)
            else:
                await message.answer(help_text, parse_mode="HTML")
    except Exception as e:
        logger.error(f"Error in cmd_start: {e}")
        await message.answer("😔 Произошла ошибка. Попробуй позже")

