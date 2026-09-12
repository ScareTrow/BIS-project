"""
Тесты для CRUD операций с заявками
"""
import pytest
from datetime import datetime, timezone, timedelta
from backend.website.models import (
    Application, ApplicationCategory, ModerationStatus,
    ApplicationResponse, ResponseStatus, User
)
from backend.website import db


@pytest.mark.api
class TestApplications:
    """Тесты для работы с заявками"""
    
    def test_create_application(self, client, test_user):
        """Тест создания заявки"""
        # Входим
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        app_data = {
            'latitude': 43.2220,
            'longitude': 76.8512,
            'category': 'food',
            'description': 'Need food assistance',
            'expires_days': 7
        }
        
        response = client.post('/api/applications', json=app_data)
        assert response.status_code in [200, 201]
        data = response.get_json()
        assert 'id' in data or 'application' in data
        
        # Проверяем в БД
        with client.application.app_context():
            application = Application.query.filter_by(
                user_id=test_user.id,
                description=app_data['description']
            ).first()
            assert application is not None
            assert application.category == ApplicationCategory.FOOD
    
    def test_create_application_unauthorized(self, client):
        """Тест создания заявки без авторизации"""
        app_data = {
            'latitude': 43.2220,
            'longitude': 76.8512,
            'category': 'food',
            'description': 'Need food'
        }
        
        response = client.post('/api/applications', json=app_data)
        assert response.status_code == 401
    
    def test_create_application_invalid_description(self, client, test_user):
        """Тест создания заявки с невалидным описанием"""
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        # Пустое описание
        app_data = {
            'latitude': 43.2220,
            'longitude': 76.8512,
            'category': 'food',
            'description': ''
        }
        
        response = client.post('/api/applications', json=app_data)
        assert response.status_code == 400
    
    def test_create_application_xss_protection(self, client, test_user):
        """Тест защиты от XSS в описании"""
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        app_data = {
            'latitude': 43.2220,
            'longitude': 76.8512,
            'category': 'food',
            'description': '<script>alert("xss")</script>'
        }
        
        response = client.post('/api/applications', json=app_data)
        # Должно быть отклонено или санитизировано
        assert response.status_code in [200, 201, 400]
        
        if response.status_code in [200, 201]:
            # Проверяем, что скрипт не сохранен как есть
            with client.application.app_context():
                application = Application.query.filter_by(
                    user_id=test_user.id
                ).order_by(Application.id.desc()).first()
                assert '<script>' not in application.description
    
    def test_get_map_points(self, client, test_application):
        """Тест получения точек на карте"""
        response = client.get('/api/map/points')
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list) or isinstance(data, dict)
    
    def test_get_map_points_filtered_by_city(self, client, test_application):
        """Тест получения точек с фильтрацией по городу"""
        response = client.get('/api/map/points?city=Almaty')
        assert response.status_code == 200
    
    def test_get_applications_list(self, client, test_application):
        """Тест получения списка заявок"""
        response = client.get('/api/applications/list')
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list) or isinstance(data, dict)
    
    def test_get_application_detail(self, client, test_application):
        """Тест получения деталей заявки"""
        response = client.get(f'/api/applications/{test_application.id}')
        assert response.status_code == 200
        data = response.get_json()
        assert data['id'] == test_application.id
        assert data['description'] == test_application.description
    
    def test_get_application_not_found(self, client):
        """Тест получения несуществующей заявки"""
        response = client.get('/api/applications/99999')
        assert response.status_code == 404
    
    def test_create_sos_application(self, client, test_user):
        """Тест создания SOS заявки"""
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        sos_data = {
            'latitude': 43.2220,
            'longitude': 76.8512
        }
        
        response = client.post('/api/sos', json=sos_data)
        assert response.status_code in [200, 201]
        
        # Проверяем в БД
        with client.application.app_context():
            application = Application.query.filter_by(
                user_id=test_user.id,
                is_sos=True
            ).order_by(Application.id.desc()).first()
            assert application is not None
            assert application.is_sos is True
    
    def test_respond_to_application(self, client, test_application):
        """Тест отклика на заявку"""
        # Создаем второго пользователя для отклика
        with client.application.app_context():
            from werkzeug.security import generate_password_hash
            responder = User(
                email='responder@example.com',
                password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
                first_name='Responder',
                city='Almaty'
            )
            db.session.add(responder)
            db.session.commit()
        
        # Входим как responder
        client.post('/api/auth/login', json={
            'email': 'responder@example.com',
            'password': 'Test1234!@#$'
        })
        
        response = client.post(f'/api/applications/{test_application.id}/respond')
        assert response.status_code in [200, 201]
        
        # Проверяем в БД
        with client.application.app_context():
            app_response = ApplicationResponse.query.filter_by(
                application_id=test_application.id
            ).first()
            assert app_response is not None
            assert app_response.status == ResponseStatus.PENDING
    
    def test_respond_to_own_application(self, client, test_user, test_application):
        """Тест отклика на свою заявку (должна быть ошибка)"""
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        response = client.post(f'/api/applications/{test_application.id}/respond')
        # Должна быть ошибка
        assert response.status_code in [400, 403]
    
    def test_resolve_application(self, client, test_user, test_application):
        """Тест закрытия заявки"""
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        response = client.post(f'/api/applications/{test_application.id}/resolve')
        assert response.status_code in [200, 201]
        
        # Проверяем в БД
        with client.application.app_context():
            application = Application.query.get(test_application.id)
            assert application.is_resolved is True
            assert application.resolved_at is not None
    
    def test_mark_application_false(self, client, test_user, test_application):
        """Тест пометки заявки как ложный вызов"""
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        response = client.post(f'/api/applications/{test_application.id}/mark-false')
        assert response.status_code in [200, 201]
        
        # Проверяем в БД
        with client.application.app_context():
            application = Application.query.get(test_application.id)
            assert application.is_false_call is True
    
    def test_accept_response(self, client, test_user, test_application):
        """Тест принятия отклика на заявку"""
        # Создаем responder и отклик
        with client.application.app_context():
            from werkzeug.security import generate_password_hash
            responder = User(
                email='responder2@example.com',
                password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
                first_name='Responder2',
                city='Almaty'
            )
            db.session.add(responder)
            db.session.commit()
            
            app_response = ApplicationResponse(
                application_id=test_application.id,
                responder_id=responder.id,
                status=ResponseStatus.PENDING
            )
            db.session.add(app_response)
            db.session.commit()
            response_id = app_response.id
        
        # Входим как создатель заявки
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        response = client.post(
            f'/api/applications/{test_application.id}/responses/{response_id}/accept'
        )
        assert response.status_code in [200, 201]
        
        # Проверяем в БД
        with client.application.app_context():
            app_response = ApplicationResponse.query.get(response_id)
            assert app_response.status == ResponseStatus.ACCEPTED
    
    def test_reject_response(self, client, test_user, test_application):
        """Тест отклонения отклика"""
        # Создаем responder и отклик
        with client.application.app_context():
            from werkzeug.security import generate_password_hash
            responder = User(
                email='responder3@example.com',
                password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
                first_name='Responder3',
                city='Almaty'
            )
            db.session.add(responder)
            db.session.commit()
            
            app_response = ApplicationResponse(
                application_id=test_application.id,
                responder_id=responder.id,
                status=ResponseStatus.PENDING
            )
            db.session.add(app_response)
            db.session.commit()
            response_id = app_response.id
        
        # Входим как создатель заявки
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        response = client.post(
            f'/api/applications/{test_application.id}/responses/{response_id}/reject'
        )
        assert response.status_code in [200, 201]
        
        # Проверяем в БД
        with client.application.app_context():
            app_response = ApplicationResponse.query.get(response_id)
            assert app_response.status == ResponseStatus.CANCELLED

