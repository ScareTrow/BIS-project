"""Keep multi-step Telegram conversations across free-host restarts."""
from dataclasses import asdict
from hashlib import sha256
import json

from aiogram.fsm.state import State
from aiogram.fsm.storage.base import BaseStorage
from backend.website import db
from backend.website.models import TelegramConversation


class DatabaseStorage(BaseStorage):
    def __init__(self, app):
        self.app = app

    def _id(self, key):
        return sha256(json.dumps(asdict(key), sort_keys=True).encode()).hexdigest()

    def _read(self, key, field):
        with self.app.app_context():
            row = db.session.get(TelegramConversation, self._id(key))
            return getattr(row, field) if row else None

    def _write(self, key, field, value):
        with self.app.app_context():
            row = db.session.get(TelegramConversation, self._id(key))
            if row is None:
                row = TelegramConversation(key=self._id(key), data={})
                db.session.add(row)
            setattr(row, field, value)
            db.session.commit()

    async def set_state(self, key, state=None):
        self._write(key, 'state', state.state if isinstance(state, State) else state)

    async def get_state(self, key):
        return self._read(key, 'state')

    async def set_data(self, key, data):
        self._write(key, 'data', dict(data))

    async def get_data(self, key):
        return dict(self._read(key, 'data') or {})

    async def close(self):
        pass
