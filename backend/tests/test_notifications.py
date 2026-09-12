"""
Тесты для системы уведомлений
"""
import pytest
from backend.website.models import Notification, ApplicationResponse, ResponseStatus, User
from backend.website import db


@pytest.mark.api
class TestNotifications:
    """Тесты для уведомлений"""
    
    def test_get_notifications(self, client, test_user):
        """Тест получения уведомлений"""
        # Создаем уведомление
        with client.application.app_context():
            notification = Notification(
                user_id=test_user.id,
                title='Test Notification',
                message='This is a test notification',
                notification_type='test'
            )
            db.session.add(notification)
            db.session.commit()
        
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        response = client.get('/api/notifications')
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list) or isinstance(data, dict)
    
    def test_mark_notification_read(self, client, test_user):
        """Тест пометки уведомления как прочитанного"""
        with client.application.app_context():
            notification = Notification(
                user_id=test_user.id,
                title='Test Notification',
                message='This is a test',
                notification_type='test',
                is_read=False
            )
            db.session.add(notification)
            db.session.commit()
            notification_id = notification.id
        
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        response = client.post(f'/api/notifications/{notification_id}/read')
        assert response.status_code in [200, 201]
        
        # Проверяем в БД
        with client.application.app_context():
            notification = Notification.query.get(notification_id)
            assert notification.is_read is True
    
    def test_mark_all_notifications_read(self, client, test_user):
        """Тест пометки всех уведомлений как прочитанных"""
        with client.application.app_context():
            # Создаем несколько непрочитанных уведомлений
            for i in range(3):
                notification = Notification(
                    user_id=test_user.id,
                    title=f'Test Notification {i}',
                    message=f'This is test {i}',
                    notification_type='test',
                    is_read=False
                )
                db.session.add(notification)
            db.session.commit()
        
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        response = client.post('/api/notifications/read-all')
        assert response.status_code in [200, 201]
        
        # Проверяем в БД
        with client.application.app_context():
            unread_count = Notification.query.filter_by(
                user_id=test_user.id,
                is_read=False
            ).count()
            assert unread_count == 0
    
    def test_notification_on_response(self, client, test_user, test_application):
        """Тест создания уведомления при отклике на заявку"""
        # Создаем responder
        with client.application.app_context():
            from werkzeug.security import generate_password_hash
            responder = User(
                email='notif_responder@example.com',
                password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
                first_name='Responder',
                city='Almaty'
            )
            db.session.add(responder)
            db.session.commit()
        
        # Входим как responder и откликаемся
        client.post('/api/auth/login', json={
            'email': 'notif_responder@example.com',
            'password': 'Test1234!@#$'
        })
        
        response = client.post(f'/api/applications/{test_application.id}/respond')
        assert response.status_code in [200, 201]
        
        # Проверяем уведомление для создателя заявки
        with client.application.app_context():
            notification = Notification.query.filter_by(
                user_id=test_application.user_id,
                related_application_id=test_application.id
            ).first()
            assert notification is not None
            assert 'отклик' in notification.message.lower() or 'response' in notification.message.lower()
    
    def test_notification_on_accept_response(self, client, test_user, test_application):
        """Тест создания уведомления при принятии отклика"""
        # Создаем responder и отклик
        with client.application.app_context():
            from werkzeug.security import generate_password_hash
            responder = User(
                email='notif_responder2@example.com',
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
        
        # Входим как создатель заявки и принимаем отклик
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        response = client.post(
            f'/api/applications/{test_application.id}/responses/{response_id}/accept'
        )
        assert response.status_code in [200, 201]
        
        # Проверяем уведомление для responder
        with client.application.app_context():
            # Получаем responder заново из БД
            responder = User.query.filter_by(email='notif_responder2@example.com').first()
            assert responder is not None, "Responder should exist"
            notification = Notification.query.filter_by(
                user_id=responder.id,
                related_application_id=test_application.id
            ).first()
            assert notification is not None

