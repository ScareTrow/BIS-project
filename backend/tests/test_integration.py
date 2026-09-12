"""
Интеграционные тесты - полные пользовательские сценарии
"""
import pytest
from backend.website.models import (
    Application, ApplicationResponse, ResponseStatus,
    Rating, ModerationStatus, ApplicationCategory, User
)
from backend.website import db


@pytest.mark.integration
class TestIntegrationScenarios:
    """Интеграционные тесты полных сценариев"""
    
    def test_full_user_journey(self, client, app):
        """Полный сценарий: Регистрация → Создание заявки → Отклик → Принятие → Закрытие → Оценка"""
        with app.app_context():
            from werkzeug.security import generate_password_hash
            
            # 1. Регистрация пользователя 1
            user1_data = {
                'email': 'journey1@example.com',
                'firstName': 'User1',
                'password1': 'Test1234!@#$',
                'password2': 'Test1234!@#$',
                'phone': '+77001234567',
                'city': 'Almaty'
            }
            response = client.post('/api/auth/signup', json=user1_data)
            assert response.status_code == 200
            
            # 2. Регистрация пользователя 2 (помощник)
            user2_data = {
                'email': 'journey2@example.com',
                'firstName': 'User2',
                'password1': 'Test1234!@#$',
                'password2': 'Test1234!@#$',
                'phone': '+77001234568',
                'city': 'Almaty'
            }
            response = client.post('/api/auth/signup', json=user2_data)
            assert response.status_code == 200
            
            # 3. Вход пользователя 1
            response = client.post('/api/auth/login', json={
                'email': user1_data['email'],
                'password': user1_data['password1']
            })
            assert response.status_code == 200
            
            # 4. Создание заявки пользователем 1
            app_data = {
                'latitude': 43.2220,
                'longitude': 76.8512,
                'category': 'food',
                'description': 'Need food assistance',
                'expires_days': 7
            }
            response = client.post('/api/applications', json=app_data)
            assert response.status_code in [200, 201]
            application_id = response.get_json().get('id') or response.get_json().get('application', {}).get('id')
            
            # 5. Выход пользователя 1
            client.post('/api/auth/logout')
            
            # 6. Вход пользователя 2
            response = client.post('/api/auth/login', json={
                'email': user2_data['email'],
                'password': user2_data['password1']
            })
            assert response.status_code == 200
            
            # 7. Отклик пользователя 2 на заявку
            response = client.post(f'/api/applications/{application_id}/respond')
            assert response.status_code in [200, 201]
            
            # 8. Выход пользователя 2
            client.post('/api/auth/logout')
            
            # 9. Вход пользователя 1
            client.post('/api/auth/login', json={
                'email': user1_data['email'],
                'password': user1_data['password1']
            })
            
            # 10. Получение откликов
            response = client.get(f'/api/applications/{application_id}')
            assert response.status_code == 200
            app_data = response.get_json()
            responses = app_data.get('responses', [])
            assert len(responses) > 0
            response_id = responses[0]['id']
            
            # 11. Принятие отклика
            response = client.post(
                f'/api/applications/{application_id}/responses/{response_id}/accept'
            )
            assert response.status_code in [200, 201]
            
            # 12. Закрытие заявки
            response = client.post(f'/api/applications/{application_id}/resolve')
            assert response.status_code in [200, 201]
            
            # 13. Оценка помощника
            user2 = User.query.filter_by(email=user2_data['email']).first()
            rating_data = {
                'helper_id': user2.id,
                'rating_value': 5,
                'comment': 'Great help!'
            }
            response = client.post(
                f'/api/applications/{application_id}/rate-helper',
                json=rating_data
            )
            assert response.status_code in [200, 201]
            
            # 14. Проверка финального состояния
            user1 = User.query.filter_by(email=user1_data['email']).first()
            user2 = User.query.filter_by(email=user2_data['email']).first()
            
            application = Application.query.get(application_id)
            assert application.is_resolved is True
            
            app_response = ApplicationResponse.query.get(response_id)
            assert app_response.status == ResponseStatus.COMPLETED
            
            rating = Rating.query.filter_by(
                application_id=application_id,
                rater_id=user1.id,
                rated_id=user2.id
            ).first()
            assert rating is not None
            assert rating.rating_value == 5
    
    def test_sos_scenario(self, client, app):
        """Сценарий SOS: Создание SOS заявки → Быстрый отклик"""
        with app.app_context():
            # 1. Регистрация и вход
            user_data = {
                'email': 'sos_user@example.com',
                'firstName': 'SOS',
                'password1': 'Test1234!@#$',
                'password2': 'Test1234!@#$',
                'phone': '+77001234569',
                'city': 'Almaty'
            }
            client.post('/api/auth/signup', json=user_data)
            
            client.post('/api/auth/login', json={
                'email': user_data['email'],
                'password': user_data['password1']
            })
            
            # 2. Создание SOS заявки
            sos_data = {
                'latitude': 43.2220,
                'longitude': 76.8512
            }
            response = client.post('/api/sos', json=sos_data)
            assert response.status_code in [200, 201]
            
            # 3. Проверка SOS заявки
            response_data = response.get_json()
            if response_data:
                application_id = response_data.get('id') or response_data.get('application_id') or (response_data.get('application', {}) or {}).get('id')
            else:
                application_id = None
            assert application_id is not None, "Failed to create SOS application"
            with client.application.app_context():
                application = Application.query.get(application_id)
            assert application.is_sos is True
            assert application.sos_count >= 0
    
    def test_moderation_scenario(self, client, app, admin_user):
        """Сценарий модерации: Создание заявки → Модерация → Одобрение"""
        with app.app_context():
            # 1. Создание обычного пользователя и заявки
            user_data = {
                'email': 'mod_user@example.com',
                'firstName': 'Mod',
                'password1': 'Test1234!@#$',
                'password2': 'Test1234!@#$',
                'phone': '+77001234570',
                'city': 'Almaty'
            }
            client.post('/api/auth/signup', json=user_data)
            
            client.post('/api/auth/login', json={
                'email': user_data['email'],
                'password': user_data['password1']
            })
            
            app_data = {
                'latitude': 43.2220,
                'longitude': 76.8512,
                'category': 'medicine',
                'description': 'Need medicine'
            }
            response = client.post('/api/applications', json=app_data)
            assert response.status_code in [200, 201]
            response_data = response.get_json()
            if response_data:
                application_id = response_data.get('id') or response_data.get('application_id') or (response_data.get('application', {}) or {}).get('id')
            else:
                application_id = None
            assert application_id is not None, "Failed to create application"
            
            # Проверяем, что заявка в статусе pending
            with client.application.app_context():
                application = Application.query.get(application_id)
            assert application.moderation_status == ModerationStatus.PENDING
            
            # 2. Выход и вход как админ
            client.post('/api/auth/logout')
            client.post('/api/auth/login', json={
                'email': admin_user.email,
                'password': 'Admin1234!@#$'
            })
            
            # 3. Одобрение заявки
            response = client.post(f'/api/admin/applications/{application_id}/approve')
            assert response.status_code in [200, 201]
            
            # 4. Проверка статуса
            with client.application.app_context():
                application = Application.query.get(application_id)
                assert application.moderation_status == ModerationStatus.APPROVED
                assert application.moderator_id == admin_user.id
    
    def test_notification_flow(self, client, app):
        """Сценарий уведомлений: Отклик → Уведомление → Чтение"""
        with app.app_context():
            # 1. Создание двух пользователей
            user1_data = {
                'email': 'notif1@example.com',
                'firstName': 'Notif1',
                'password1': 'Test1234!@#$',
                'password2': 'Test1234!@#$',
                'phone': '+77001234571',
                'city': 'Almaty'
            }
            user2_data = {
                'email': 'notif2@example.com',
                'firstName': 'Notif2',
                'password1': 'Test1234!@#$',
                'password2': 'Test1234!@#$',
                'phone': '+77001234572',
                'city': 'Almaty'
            }
            
            client.post('/api/auth/signup', json=user1_data)
            client.post('/api/auth/signup', json=user2_data)
            
            # 2. Пользователь 1 создает заявку
            client.post('/api/auth/login', json={
                'email': user1_data['email'],
                'password': user1_data['password1']
            })
            
            app_data = {
                'latitude': 43.2220,
                'longitude': 76.8512,
                'category': 'shelter',
                'description': 'Need shelter'
            }
            response = client.post('/api/applications', json=app_data)
            response_data = response.get_json()
            if response_data:
                application_id = response_data.get('id') or response_data.get('application_id') or (response_data.get('application', {}) or {}).get('id')
            else:
                application_id = None
            assert application_id is not None, "Failed to create application"
            
            client.post('/api/auth/logout')
            
            # 3. Пользователь 2 откликается
            client.post('/api/auth/login', json={
                'email': user2_data['email'],
                'password': user2_data['password1']
            })
            
            response = client.post(f'/api/applications/{application_id}/respond')
            assert response.status_code in [200, 201]
            
            # 4. Проверка уведомления для пользователя 1
            user1 = User.query.filter_by(email=user1_data['email']).first()
            notifications = Notification.query.filter_by(
                user_id=user1.id,
                related_application_id=application_id
            ).all()
            assert len(notifications) > 0
            
            # 5. Пользователь 1 читает уведомления
            client.post('/api/auth/logout')
            client.post('/api/auth/login', json={
                'email': user1_data['email'],
                'password': user1_data['password1']
            })
            
            response = client.get('/api/notifications')
            assert response.status_code == 200
            
            notifications_data = response.get_json()
            unread_count = sum(1 for n in notifications_data if not n.get('is_read', False))
            assert unread_count > 0
            
            # 6. Пометка всех как прочитанных
            response = client.post('/api/notifications/read-all')
            assert response.status_code in [200, 201]

