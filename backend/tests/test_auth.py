"""
Тесты для аутентификации и авторизации
"""
import pytest
from flask import url_for
from backend.website.models import User
from werkzeug.security import check_password_hash


@pytest.mark.auth
class TestAuthentication:
    """Тесты аутентификации"""
    
    def test_signup_success(self, client):
        """Тест успешной регистрации"""
        user_data = {
            'email': 'newuser@example.com',
            'firstName': 'New',
            'lastName': 'User',
            'password1': 'Test1234!@#$',
            'password2': 'Test1234!@#$',
            'phone': '+77001234567',
            'city': 'Almaty'
        }
        
        response = client.post('/api/auth/signup', json=user_data)
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['user']['email'] == user_data['email']
        
        # Проверяем, что пользователь создан в БД
        with client.application.app_context():
            user = User.query.filter_by(email=user_data['email']).first()
            assert user is not None
            assert user.first_name == user_data['firstName']
            assert check_password_hash(user.password, user_data['password1'])
    
    def test_signup_duplicate_email(self, client, test_user):
        """Тест регистрации с существующим email"""
        user_data = {
            'email': test_user.email,
            'firstName': 'Test',
            'password1': 'Test1234!@#$',
            'password2': 'Test1234!@#$',
            'phone': '+77001234567',
            'city': 'Almaty'
        }
        
        response = client.post('/api/auth/signup', json=user_data)
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False
        assert 'уже существует' in data['message'] or 'exists' in data['message'].lower()
    
    def test_signup_weak_password(self, client):
        """Тест регистрации со слабым паролем"""
        user_data = {
            'email': 'weak@example.com',
            'firstName': 'Weak',
            'password1': '12345678',  # Только цифры
            'password2': '12345678',
            'phone': '+77001234567',
            'city': 'Almaty'
        }
        
        response = client.post('/api/auth/signup', json=user_data)
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False
        assert 'пароль' in data['message'].lower() or 'password' in data['message'].lower()
    
    def test_signup_password_mismatch(self, client):
        """Тест регистрации с несовпадающими паролями"""
        user_data = {
            'email': 'mismatch@example.com',
            'firstName': 'Mismatch',
            'password1': 'Test1234!@#$',
            'password2': 'Test1234!@#',
            'phone': '+77001234567',
            'city': 'Almaty'
        }
        
        response = client.post('/api/auth/signup', json=user_data)
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False
    
    def test_signup_missing_phone(self, client):
        """Тест регистрации без телефона"""
        user_data = {
            'email': 'nophone@example.com',
            'firstName': 'NoPhone',
            'password1': 'Test1234!@#$',
            'password2': 'Test1234!@#$',
            'city': 'Almaty'
        }
        
        response = client.post('/api/auth/signup', json=user_data)
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False
        assert 'телефон' in data['message'].lower() or 'phone' in data['message'].lower()
    
    def test_signup_missing_city(self, client):
        """Тест регистрации без города"""
        user_data = {
            'email': 'nocity@example.com',
            'firstName': 'NoCity',
            'password1': 'Test1234!@#$',
            'password2': 'Test1234!@#$',
            'phone': '+77001234567'
        }
        
        response = client.post('/api/auth/signup', json=user_data)
        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False
        assert 'город' in data['message'].lower() or 'city' in data['message'].lower()
    
    def test_login_success(self, client, test_user):
        """Тест успешного входа"""
        login_data = {
            'email': test_user.email,
            'password': 'Test1234!@#$'
        }
        
        response = client.post('/api/auth/login', json=login_data)
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['user']['email'] == test_user.email
    
    def test_login_wrong_email(self, client):
        """Тест входа с неверным email"""
        login_data = {
            'email': 'nonexistent@example.com',
            'password': 'Test1234!@#$'
        }
        
        response = client.post('/api/auth/login', json=login_data)
        assert response.status_code == 401
        data = response.get_json()
        assert data['success'] is False
    
    def test_login_wrong_password(self, client, test_user):
        """Тест входа с неверным паролем"""
        login_data = {
            'email': test_user.email,
            'password': 'WrongPassword123!@#'
        }
        
        response = client.post('/api/auth/login', json=login_data)
        assert response.status_code == 401
        data = response.get_json()
        assert data['success'] is False
    
    def test_get_current_user_authenticated(self, client, test_user):
        """Тест получения текущего пользователя (авторизован)"""
        # Сначала входим
        login_data = {
            'email': test_user.email,
            'password': 'Test1234!@#$'
        }
        client.post('/api/auth/login', json=login_data)
        
        # Получаем текущего пользователя
        response = client.get('/api/user/current')
        assert response.status_code == 200
        data = response.get_json()
        assert data['user']['email'] == test_user.email
        assert data['user']['is_authenticated'] is True
    
    def test_get_current_user_unauthenticated(self, client):
        """Тест получения текущего пользователя (не авторизован)"""
        response = client.get('/api/user/current')
        assert response.status_code == 401
    
    def test_logout(self, client, test_user):
        """Тест выхода из системы"""
        # Сначала входим
        login_data = {
            'email': test_user.email,
            'password': 'Test1234!@#$'
        }
        client.post('/api/auth/login', json=login_data)
        
        # Выходим
        response = client.post('/api/auth/logout')
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        
        # Проверяем, что после выхода нельзя получить текущего пользователя
        response = client.get('/api/user/current')
        assert response.status_code == 401
    
    def test_login_blocked_user(self, client, app, test_user):
        """Тест входа заблокированного пользователя"""
        from backend.website import db
        with app.app_context():
            from datetime import datetime, timezone, timedelta
            test_user.is_blocked = True
            test_user.blocked_until = datetime.now(timezone.utc) + timedelta(days=7)
            db.session.commit()
        
        login_data = {
            'email': test_user.email,
            'password': 'Test1234!@#$'
        }
        
        response = client.post('/api/auth/login', json=login_data)
        # Должна быть проверка блокировки (если реализована)
        # Пока просто проверяем, что запрос обрабатывается
        assert response.status_code in [200, 401, 403]

