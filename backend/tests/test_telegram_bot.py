"""
Тесты для Telegram бота
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from aiogram.types import Message, User as TelegramUser, Chat
from aiogram.fsm.context import FSMContext
from backend.telegram_bot.handlers import start, create, sos
from backend.website.models import User
from backend.website import db


@pytest.mark.telegram
class TestTelegramBot:
    """Тесты для Telegram бота"""
    
    @pytest.fixture
    def mock_message(self):
        """Создает мок сообщения Telegram"""
        message = MagicMock(spec=Message)
        message.from_user = MagicMock(spec=TelegramUser)
        message.from_user.id = 123456789
        message.from_user.username = "testuser"
        message.from_user.first_name = "Test"
        message.from_user.last_name = "User"
        message.chat = MagicMock(spec=Chat)
        message.chat.id = 123456789
        message.answer = AsyncMock()
        message.text = None
        return message
    
    @pytest.fixture
    def mock_state(self):
        """Создает мок FSM состояния"""
        state = MagicMock(spec=FSMContext)
        state.set_state = AsyncMock()
        state.update_data = AsyncMock()
        state.get_data = AsyncMock(return_value={})
        return state
    
    @pytest.mark.asyncio
    async def test_start_command_authorized(self, app, mock_message, mock_state):
        """Тест команды /start для авторизованного пользователя"""
        with app.app_context():
            from werkzeug.security import generate_password_hash
            # Создаем пользователя с telegram_id
            user = User(
                email='telegram_test@example.com',
                password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
                first_name='Telegram',
                last_name='Test',
                telegram_id=str(mock_message.from_user.id),
                city='Almaty'
            )
            db.session.add(user)
            db.session.commit()
        
        # Мокаем get_user_by_telegram_id
        with patch('backend.telegram_bot.handlers.start.get_user_by_telegram_id') as mock_get_user:
            mock_get_user.return_value = user
            
            await start.cmd_start(mock_message)
            
            # Проверяем, что ответ был отправлен
            assert mock_message.answer.called
            call_args = mock_message.answer.call_args
            # Проверяем, что в ответе есть приветствие (может быть на русском или английском)
            answer_text = call_args[0][0] if call_args[0] else str(call_args)
            assert 'Привет' in answer_text or 'Прив' in answer_text or 'Рад видеть' in answer_text or 'greeting' in answer_text.lower()
    
    @pytest.mark.asyncio
    async def test_start_command_unauthorized(self, app, mock_message, mock_state):
        """Тест команды /start для неавторизованного пользователя"""
        with app.app_context():
            # Убеждаемся, что пользователя нет
            User.query.filter_by(telegram_id=str(mock_message.from_user.id)).delete()
            db.session.commit()
        
        # Мокаем get_user_by_telegram_id
        with patch('backend.telegram_bot.handlers.start.get_user_by_telegram_id') as mock_get_user:
            mock_get_user.return_value = None
            
            await start.cmd_start(mock_message)
            
            # Проверяем, что отправлена инструкция по привязке
            assert mock_message.answer.called
            call_args = mock_message.answer.call_args
            assert 'Telegram ID' in call_args[0][0] or 'ID' in str(call_args)
    
    @pytest.mark.asyncio
    async def test_create_command(self, app, mock_message, mock_state):
        """Тест команды /create"""
        with app.app_context():
            from werkzeug.security import generate_password_hash
            user = User(
                email='create_test@example.com',
                password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
                first_name='Create',
                telegram_id=str(mock_message.from_user.id),
                city='Almaty'
            )
            db.session.add(user)
            db.session.commit()
        
        # Мокаем require_auth
        with patch('backend.telegram_bot.handlers.create.require_auth') as mock_auth:
            mock_auth.return_value = user
            
            await create.cmd_create(mock_message, mock_state)
            
            # Проверяем, что состояние установлено
            assert mock_state.set_state.called
            assert mock_message.answer.called
    
    @pytest.mark.asyncio
    async def test_sos_command(self, app, mock_message, mock_state):
        """Тест команды /sos"""
        with app.app_context():
            from werkzeug.security import generate_password_hash
            user = User(
                email='sos_test@example.com',
                password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
                first_name='SOS',
                telegram_id=str(mock_message.from_user.id),
                city='Almaty'
            )
            db.session.add(user)
            db.session.commit()
        
        # Мокаем require_auth
        with patch('backend.telegram_bot.handlers.sos.require_auth') as mock_auth:
            mock_auth.return_value = user
            
            await sos.cmd_sos(mock_message, mock_state)
            
            # Проверяем, что состояние установлено для SOS
            assert mock_state.set_state.called
            assert mock_message.answer.called
    
    @pytest.mark.asyncio
    async def test_auth_middleware(self, app, mock_message):
        """Тест middleware авторизации"""
        from backend.telegram_bot.middleware.auth import require_auth
        
        with app.app_context():
            from werkzeug.security import generate_password_hash
            user = User(
                email='middleware_test@example.com',
                password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
                first_name='Middleware',
                telegram_id=str(mock_message.from_user.id),
                city='Almaty'
            )
            db.session.add(user)
            db.session.commit()
        
        # Тест с авторизованным пользователем
        result = await require_auth(mock_message, MagicMock())
        assert result is not None
        assert result.telegram_id == str(mock_message.from_user.id)
        
        # Тест с неавторизованным пользователем
        mock_message.from_user.id = 999999999
        result = await require_auth(mock_message, MagicMock())
        assert result is None
        assert mock_message.answer.called

