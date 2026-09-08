import logging
import asyncio
import threading
from aiogram import Bot
from backend.telegram_bot.config import Config

logger = logging.getLogger(__name__)


async def send_notification_async(telegram_id, title, message, notification_type=None):
    if not telegram_id:
        logger.warning(f"send_notification_async called with empty telegram_id")
        return False
    
    if not Config.TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN is not set, cannot send notification")
        return False
    
    bot = None
    try:
        bot = Bot(token=Config.TELEGRAM_BOT_TOKEN)
        
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
        
        logger.info(f"Sending Telegram notification to {telegram_id}: {title}")
        await bot.send_message(
            chat_id=telegram_id,
            text=text,
            parse_mode='HTML'
        )
        logger.info(f"Successfully sent Telegram notification to {telegram_id}")
        return True
    except Exception as e:
        logger.error(f"Error sending Telegram notification to {telegram_id}: {e}", exc_info=True)
        return False
    finally:
        if bot:
            try:
                await bot.session.close()
            except Exception as e:
                logger.warning(f"Error closing bot session: {e}")


def send_notification(telegram_id, title, message, notification_type=None):
    """
    Синхронная обертка для отправки уведомлений в Telegram.
    Запускает асинхронную функцию в отдельном потоке с новым event loop.
    """
    if not telegram_id:
        logger.warning(f"send_notification called with empty telegram_id")
        return False
    
    def run_in_thread():
        """Запускает асинхронную функцию в новом event loop в отдельном потоке"""
        try:
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            try:
                logger.info(f"Running send_notification_async in thread for telegram_id: {telegram_id}")
                result = new_loop.run_until_complete(
                    send_notification_async(telegram_id, title, message, notification_type)
                )
                logger.info(f"Notification thread completed for telegram_id: {telegram_id}, result: {result}")
                return result
            finally:
                new_loop.close()
        except Exception as e:
            logger.error(f"Error in notification thread for telegram_id {telegram_id}: {e}", exc_info=True)
            return False
    
    try:
        logger.info(f"Starting notification thread for telegram_id: {telegram_id}")
        thread = threading.Thread(target=run_in_thread, daemon=True)
        thread.start()
        return True
    except Exception as e:
        logger.error(f"Error starting notification thread for telegram_id {telegram_id}: {e}", exc_info=True)
        return False

