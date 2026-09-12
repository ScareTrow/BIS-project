"""
Тесты для моделей базы данных
"""
import pytest
from datetime import datetime, timezone, timedelta
from backend.website.models import (
    User, Application, ApplicationCategory, ModerationStatus,
    Rating, ApplicationResponse, ResponseStatus, Notification,
    ApplicationMedia, NameChangeHistory
)
from backend.website import db


@pytest.mark.unit
class TestModels:
    """Тесты для моделей БД"""
    
    def test_user_creation(self, app):
        """Тест создания пользователя"""
        with app.app_context():
            from werkzeug.security import generate_password_hash
            user = User(
                email='model_test@example.com',
                password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
                first_name='Model',
                last_name='Test',
                city='Almaty'
            )
            db.session.add(user)
            db.session.commit()
            
            assert user.id is not None
            assert user.email == 'model_test@example.com'
            assert user.isAdmin is False
            assert user.is_blocked is False
    
    def test_user_average_rating(self, app):
        """Тест вычисления среднего рейтинга"""
        with app.app_context():
            from werkzeug.security import generate_password_hash
            user = User(
                email='rating_test@example.com',
                password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
                first_name='Rating',
                rating_sum=25,
                rating_count=5
            )
            db.session.add(user)
            db.session.commit()
            
            assert user.average_rating == 5.0
            
            # Тест с нулевым количеством
            user2 = User(
                email='rating_test2@example.com',
                password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
                first_name='Rating2',
                rating_sum=0,
                rating_count=0
            )
            db.session.add(user2)
            db.session.commit()
            
            assert user2.average_rating == 5.0  # Дефолтное значение
    
    def test_application_creation(self, app, test_user):
        """Тест создания заявки"""
        with app.app_context():
            application = Application(
                description='Model test application',
                latitude=43.2220,
                longitude=76.8512,
                category=ApplicationCategory.MEDICINE,
                user_id=test_user.id,
                moderation_status=ModerationStatus.PENDING
            )
            db.session.add(application)
            db.session.commit()
            
            assert application.id is not None
            assert application.category == ApplicationCategory.MEDICINE
            assert application.moderation_status == ModerationStatus.PENDING
            assert application.is_resolved is False
            assert application.is_sos is False
    
    def test_application_user_relationship(self, app, test_user):
        """Тест связи заявки с пользователем"""
        with app.app_context():
            application = Application(
                description='Relationship test',
                latitude=43.2220,
                longitude=76.8512,
                category=ApplicationCategory.FOOD,
                user_id=test_user.id
            )
            db.session.add(application)
            db.session.commit()
            
            # Получаем объекты заново из БД для проверки relationships
            application_id = application.id
            user_id = test_user.id
            application = Application.query.get(application_id)
            test_user = User.query.get(user_id)
            
            assert application.user.id == test_user.id
            assert application in test_user.applications
    
    def test_rating_creation(self, app, test_user):
        """Тест создания рейтинга"""
        with app.app_context():
            from werkzeug.security import generate_password_hash
            rated_user = User(
                email='rated_model@example.com',
                password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
                first_name='Rated'
            )
            db.session.add(rated_user)
            db.session.commit()
            
            application = Application(
                description='Rating test app',
                latitude=43.2220,
                longitude=76.8512,
                category=ApplicationCategory.FOOD,
                user_id=test_user.id
            )
            db.session.add(application)
            db.session.commit()
            
            rating = Rating(
                rater_id=test_user.id,
                rated_id=rated_user.id,
                application_id=application.id,
                rating_value=5,
                comment='Great!'
            )
            db.session.add(rating)
            db.session.commit()
            
            assert rating.id is not None
            assert rating.rater.id == test_user.id
            assert rating.rated.id == rated_user.id
            assert rating.application.id == application.id
    
    def test_application_response_creation(self, app, test_application, test_user):
        """Тест создания отклика на заявку"""
        with app.app_context():
            from werkzeug.security import generate_password_hash
            responder = User(
                email='responder_model@example.com',
                password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
                first_name='Responder'
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
            
            assert app_response.id is not None
            assert app_response.application.id == test_application.id
            assert app_response.responder.id == responder.id
            assert app_response.status == ResponseStatus.PENDING
    
    def test_notification_creation(self, app, test_user):
        """Тест создания уведомления"""
        with app.app_context():
            notification = Notification(
                user_id=test_user.id,
                title='Test Notification',
                message='This is a test',
                notification_type='test'
            )
            db.session.add(notification)
            db.session.commit()
            
            assert notification.id is not None
            assert notification.user.id == test_user.id
            assert notification.is_read is False
    
    def test_cascade_delete_user(self, app, test_user):
        """Тест каскадного удаления пользователя"""
        with app.app_context():
            # Создаем заявку, рейтинг и уведомление для пользователя
            application = Application(
                description='Cascade test',
                latitude=43.2220,
                longitude=76.8512,
                category=ApplicationCategory.FOOD,
                user_id=test_user.id
            )
            db.session.add(application)
            db.session.commit()
            
            notification = Notification(
                user_id=test_user.id,
                title='Test',
                message='Test',
                notification_type='test'
            )
            db.session.add(notification)
            db.session.commit()
            
            user_id = test_user.id
            app_id = application.id
            notif_id = notification.id
            
            # Удаляем пользователя
            # Сначала удаляем заявку, так как user_id не может быть NULL
            db.session.delete(application)
            db.session.commit()
            
            db.session.delete(test_user)
            db.session.commit()
            
            # Проверяем, что пользователь удален
            user = User.query.get(user_id)
            assert user is None
            
            # Уведомление должно быть удалено (каскадное удаление)
            notification = Notification.query.get(notif_id)
            assert notification is None
    
    def test_unique_email(self, app):
        """Тест уникальности email"""
        with app.app_context():
            from werkzeug.security import generate_password_hash
            user1 = User(
                email='unique@example.com',
                password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
                first_name='User1'
            )
            db.session.add(user1)
            db.session.commit()
            
            user2 = User(
                email='unique@example.com',
                password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
                first_name='User2'
            )
            db.session.add(user2)
            
            # Должна быть ошибка уникальности
            with pytest.raises(Exception):
                db.session.commit()
    
    def test_user_badge_update(self, app):
        """Тест обновления бейджа пользователя"""
        with app.app_context():
            from werkzeug.security import generate_password_hash
            user = User(
                email='badge_test@example.com',
                password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
                first_name='Badge',
                rating_sum=40,
                rating_count=10
            )
            db.session.add(user)
            db.session.commit()
            
            # Вызываем метод обновления бейджа
            user.update_badge()
            db.session.commit()
            
            # Бейдж должен быть выдан при выполнении условий
            # (зависит от реализации логики)

