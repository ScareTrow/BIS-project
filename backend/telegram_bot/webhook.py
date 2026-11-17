"""Serve aiogram updates inside one Gunicorn worker with a persistent event loop."""
import asyncio
import atexit
from concurrent.futures import TimeoutError
from hmac import compare_digest
import threading

from aiogram import Bot
from aiogram.types import Update
from flask import jsonify, request
from pydantic import ValidationError

from backend.website import db
from backend.website.models import TelegramUpdateReceipt


class TelegramRuntime:
    def __init__(self, app):
        self.app = app
        self.loop = asyncio.new_event_loop()
        self.thread = threading.Thread(target=self.loop.run_forever, daemon=True)
        self.thread.start()
        try:
            asyncio.run_coroutine_threadsafe(self._start(), self.loop).result(timeout=10)
        except Exception:
            self.loop.call_soon_threadsafe(self.loop.stop)
            self.thread.join(timeout=2)
            if not self.thread.is_alive():
                self.loop.close()
            raise
        atexit.register(self.close)

    async def _start(self):
        from .bot import create_dispatcher
        from .storage import DatabaseStorage
        self.bot = Bot(token=self.app.config['TELEGRAM_BOT_TOKEN'])
        self.dispatcher = create_dispatcher(DatabaseStorage(self.app))
        self.lock = asyncio.Lock()

    async def _dispatch(self, update):
        # One worker and serialized updates keep conversation steps ordered.
        async with self.lock:
            with self.app.app_context():
                key = (self.bot.id, update.update_id)
                if db.session.get(TelegramUpdateReceipt, key):
                    return
                db.session.remove()
                await self.dispatcher.feed_update(self.bot, update)
                db.session.add(TelegramUpdateReceipt(bot_id=key[0], update_id=key[1]))
                db.session.commit()

    def dispatch(self, update):
        future = asyncio.run_coroutine_threadsafe(self._dispatch(update), self.loop)
        try:
            future.result(timeout=45)
        except TimeoutError:
            future.cancel()
            raise

    def close(self):
        if not self.loop.is_running():
            return
        try:
            asyncio.run_coroutine_threadsafe(self.bot.session.close(), self.loop).result(timeout=2)
        finally:
            self.loop.call_soon_threadsafe(self.loop.stop)
            self.thread.join(timeout=2)
            if not self.thread.is_alive():
                self.loop.close()


def register_webhook(app):
    startup_lock = threading.Lock()

    @app.post('/api/telegram/webhook')
    def telegram_webhook():
        secret = app.config.get('TELEGRAM_WEBHOOK_SECRET', '')
        if not secret or not app.config.get('TELEGRAM_BOT_TOKEN'):
            return jsonify(error='Webhook is not configured'), 404
        supplied = request.headers.get('X-Telegram-Bot-Api-Secret-Token', '')
        if not compare_digest(supplied.encode(), secret.encode()):
            return jsonify(error='Forbidden'), 403
        try:
            update = Update.model_validate(request.get_json())
        except ValidationError:
            return jsonify(error='Invalid Telegram update'), 400
        try:
            with startup_lock:
                runtime = app.extensions.get('telegram_webhook_runtime')
                if runtime is None:
                    runtime = TelegramRuntime(app)
                    app.extensions['telegram_webhook_runtime'] = runtime
            runtime.dispatch(update)
        except Exception:
            app.logger.error('Telegram update processing failed')
            return jsonify(error='Retry later'), 503
        return jsonify(ok=True)
