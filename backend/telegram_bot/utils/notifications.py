import logging
import asyncio
from aiogram import Bot
from backend.telegram_bot.config import Config

logger = logging.getLogger(__name__)

_bot_instance = None


def get_bot():
    global _bot_instance
    if _bot_instance is None and Config.TELEGRAM_BOT_TOKEN:
        _bot_instance = Bot(token=Config.TELEGRAM_BOT_TOKEN)
    return _bot_instance


async def send_notification_async(telegram_id, title, message, notification_type=None):
    if not telegram_id:
        return False
    
    bot = get_bot()
    if not bot:
        return False
    
    try:
        emoji_map = {
            'application_approved': '✅',
            'application_rejected': '❌',
            'new_response': '👋',
            'response_accepted': '👍',
            'application_resolved': '🎉',
            'rating_received': '⭐'
        }
        
        emoji = emoji_map.get(notification_type, '🔔')
        text = f"{emoji} <b>{title}</b>\n\n{message}"
        
        await bot.send_message(
            chat_id=telegram_id,
            text=text,
            parse_mode='HTML'
        )
        return True
    except Exception as e:
        logger.error(f"Error sending Telegram notification to {telegram_id}: {e}")
        return False


def send_notification(telegram_id, title, message, notification_type=None):
    if not telegram_id:
        return False
    
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(send_notification_async(telegram_id, title, message, notification_type))
        else:
            loop.run_until_complete(send_notification_async(telegram_id, title, message, notification_type))
        return True
    except Exception as e:
        logger.error(f"Error in send_notification: {e}")
        return False

