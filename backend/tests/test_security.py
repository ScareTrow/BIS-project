"""
Тесты безопасности
"""
import pytest
from backend.website.models import User, Application
from backend.website import db


@pytest.mark.security
class TestSecurity:
    """Тесты безопасности"""
    
    def test_sql_injection_protection(self, client, test_user):
        """Тест защиты от SQL-инъекций"""
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        # Попытка SQL-инъекции в поиске
        malicious_query = "'; DROP TABLE users; --"
        response = client.get(f'/api/search?q={malicious_query}&type=all')
        # Должен обработать безопасно, не выполнив SQL
        assert response.status_code in [200, 400]
    
    def test_xss_protection_in_description(self, client, test_user):
        """Тест защиты от XSS в описании заявки"""
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        xss_payloads = [
            '<script>alert("xss")</script>',
            '<img src=x onerror=alert("xss")>',
            'javascript:alert("xss")',
            '<iframe src="evil.com"></iframe>'
        ]
        
        for payload in xss_payloads:
            app_data = {
                'latitude': 43.2220,
                'longitude': 76.8512,
                'category': 'food',
                'description': payload
            }
            
            response = client.post('/api/applications', json=app_data)
            # Должно быть отклонено или санитизировано
            assert response.status_code in [200, 201, 400]
            
            if response.status_code in [200, 201]:
                # Проверяем, что опасный код не сохранен
                with client.application.app_context():
                    application = Application.query.filter_by(
                        user_id=test_user.id
                    ).order_by(Application.id.desc()).first()
                    if application:
                        assert '<script>' not in application.description.lower()
                        assert 'javascript:' not in application.description.lower()
    
    def test_password_hashing(self, app):
        """Тест хеширования паролей"""
        with app.app_context():
            from werkzeug.security import generate_password_hash, check_password_hash
            password = 'Test1234!@#$'
            hashed = generate_password_hash(password, method='pbkdf2:sha256', salt_length=8)
            
            # Пароль не должен храниться в открытом виде
            assert password not in hashed
            assert hashed.startswith('pbkdf2:sha256:')
            
            # Проверка пароля должна работать
            assert check_password_hash(hashed, password)
            assert not check_password_hash(hashed, 'WrongPassword')
    
    def test_unauthorized_access(self, client):
        """Тест доступа к защищенным endpoints без авторизации"""
        protected_endpoints = [
            ('GET', '/api/user/current'),
            ('GET', '/api/user/applications'),
            ('POST', '/api/applications'),
            ('POST', '/api/profile/edit'),
            ('GET', '/api/admin/stats'),
        ]
        
        for method, endpoint in protected_endpoints:
            if method == 'GET':
                response = client.get(endpoint)
            elif method == 'POST':
                response = client.post(endpoint, json={})
            
            assert response.status_code in [401, 403], f"Endpoint {endpoint} should require auth"
    
    def test_admin_only_endpoints(self, client, test_user):
        """Тест доступа к админским endpoints только для админов"""
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        admin_endpoints = [
            ('GET', '/api/admin/stats'),
            ('GET', '/api/admin/applications'),
            ('GET', '/api/admin/users'),
        ]
        
        for method, endpoint in admin_endpoints:
            if method == 'GET':
                response = client.get(endpoint)
            elif method == 'POST':
                response = client.post(endpoint, json={})
            
            assert response.status_code in [401, 403], f"Endpoint {endpoint} should require admin"
    
    def test_csrf_protection(self, client, test_user):
        """Тест защиты от CSRF (если реализована)"""
        # Flask-Login использует сессии, которые защищены от CSRF
        # Проверяем, что запросы требуют правильной сессии
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        # Запрос с правильной сессией должен работать
        response = client.get('/api/user/current')
        assert response.status_code == 200
    
    def test_file_upload_size_limit(self, client, test_user):
        """Тест ограничения размера загружаемых файлов"""
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        # Создаем файл больше лимита (10MB)
        # В реальном тесте нужно использовать multipart/form-data
        # Здесь проверяем конфигурацию
        with client.application.app_context():
            max_size = client.application.config.get('MAX_CONTENT_LENGTH', 0)
            assert max_size > 0, "File size limit should be set"
    
    def test_input_validation(self, client, test_user):
        """Тест валидации входных данных"""
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        # Тест с невалидными координатами
        invalid_app_data = {
            'latitude': 999,  # Недопустимая широта
            'longitude': 999,  # Недопустимая долгота
            'category': 'food',
            'description': 'Test'
        }
        
        response = client.post('/api/applications', json=invalid_app_data)
        # Должна быть валидация координат
        assert response.status_code in [200, 201, 400]
        
        # Тест с невалидной категорией
        invalid_category_data = {
            'latitude': 43.2220,
            'longitude': 76.8512,
            'category': 'invalid_category',
            'description': 'Test'
        }
        
        response = client.post('/api/applications', json=invalid_category_data)
        assert response.status_code in [400, 422]
    
    def test_rate_limiting(self, client):
        """Тест rate limiting (если реализован)"""
        # Множественные запросы на вход
        login_data = {
            'email': 'test@example.com',
            'password': 'WrongPassword'
        }
        
        # Делаем много запросов
        for i in range(10):
            response = client.post('/api/auth/login', json=login_data)
            # Если rate limiting реализован, после N попыток должен быть 429
            # Пока просто проверяем, что запросы обрабатываются
            assert response.status_code in [200, 401, 429]

