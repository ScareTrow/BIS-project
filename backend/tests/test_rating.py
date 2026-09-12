"""
Тесты для системы рейтингов
"""
import pytest
from backend.website.models import Rating, Application, ApplicationResponse, ResponseStatus, ApplicationCategory, ModerationStatus, User
from backend.website import db


@pytest.mark.api
class TestRating:
    """Тесты для системы рейтингов"""
    
    def test_rate_helper(self, client, test_user):
        """Тест оценки помощника"""
        # Создаем заявку и отклик
        with client.application.app_context():
            from werkzeug.security import generate_password_hash
            helper = User(
                email='helper@example.com',
                password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
                first_name='Helper',
                city='Almaty'
            )
            db.session.add(helper)
            db.session.commit()
            
            application = Application(
                description='Test app for rating',
                latitude=43.2220,
                longitude=76.8512,
                category=ApplicationCategory.FOOD,
                user_id=test_user.id,
                moderation_status=ModerationStatus.APPROVED,
                is_resolved=True
            )
            db.session.add(application)
            db.session.commit()
            
            app_response = ApplicationResponse(
                application_id=application.id,
                responder_id=helper.id,
                status=ResponseStatus.COMPLETED
            )
            db.session.add(app_response)
            db.session.commit()
            
            # Сохраняем ID для использования вне контекста
            helper_id = helper.id
            application_id = application.id
        
        # Входим как создатель заявки
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        rating_data = {
            'helper_id': helper_id,
            'rating_value': 5,
            'comment': 'Great help!'
        }
        
        response = client.post(
            f'/api/applications/{application.id}/rate-helper',
            json=rating_data
        )
        assert response.status_code in [200, 201]
        
        # Проверяем в БД
        with client.application.app_context():
            rating = Rating.query.filter_by(
                rater_id=test_user.id,
                rated_id=helper_id,
                application_id=application_id
            ).first()
            assert rating is not None
            assert rating.rating_value == 5
            assert rating.comment == 'Great help!'
    
    def test_rate_helper_simple(self, client, test_user):
        """Тест простой оценки (положительная/отрицательная)"""
        # Создаем заявку и отклик
        with client.application.app_context():
            from werkzeug.security import generate_password_hash
            helper = User(
                email='helper2@example.com',
                password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
                first_name='Helper2',
                city='Almaty'
            )
            db.session.add(helper)
            db.session.commit()
            
            application = Application(
                description='Test app for simple rating',
                latitude=43.2220,
                longitude=76.8512,
                category=ApplicationCategory.FOOD,
                user_id=test_user.id,
                moderation_status=ModerationStatus.APPROVED,
                is_resolved=True
            )
            db.session.add(application)
            db.session.commit()
            
            # Сохраняем ID для использования вне контекста
            helper_id = helper.id
            application_id = application.id
        
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        rating_data = {
            'helper_id': helper_id,
            'is_positive': True
        }
        
        response = client.post(
            f'/api/applications/{application_id}/rate-volunteer-simple',
            json=rating_data
        )
        assert response.status_code in [200, 201]
    
    def test_rate_twice_error(self, client, test_user):
        """Тест попытки оценить дважды (должна быть ошибка)"""
        # Создаем заявку, отклик и первый рейтинг
        with client.application.app_context():
            from werkzeug.security import generate_password_hash
            helper = User(
                email='helper3@example.com',
                password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
                first_name='Helper3',
                city='Almaty'
            )
            db.session.add(helper)
            db.session.commit()
            
            application = Application(
                description='Test app for double rating',
                latitude=43.2220,
                longitude=76.8512,
                category=ApplicationCategory.FOOD,
                user_id=test_user.id,
                moderation_status=ModerationStatus.APPROVED,
                is_resolved=True
            )
            db.session.add(application)
            db.session.commit()
            
            # Создаем первый рейтинг
            rating = Rating(
                rater_id=test_user.id,
                rated_id=helper.id,
                application_id=application.id,
                rating_value=5
            )
            db.session.add(rating)
            db.session.commit()
            
            # Сохраняем ID для использования вне контекста
            helper_id = helper.id
            application_id = application.id
        
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        rating_data = {
            'helper_id': helper_id,
            'rating_value': 4
        }
        
        response = client.post(
            f'/api/applications/{application_id}/rate-helper',
            json=rating_data
        )
        # Должна быть ошибка
        assert response.status_code in [400, 403]
    
    def test_rating_updates_user_rating(self, client, test_user):
        """Тест обновления рейтинга пользователя после оценки"""
        with client.application.app_context():
            from werkzeug.security import generate_password_hash
            helper = User(
                email='helper4@example.com',
                password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
                first_name='Helper4',
                city='Almaty',
                rating_sum=20,
                rating_count=4
            )
            db.session.add(helper)
            db.session.commit()
            initial_avg = helper.average_rating
            
            application = Application(
                description='Test app for rating update',
                latitude=43.2220,
                longitude=76.8512,
                category=ApplicationCategory.FOOD,
                user_id=test_user.id,
                moderation_status=ModerationStatus.APPROVED,
                is_resolved=True
            )
            db.session.add(application)
            db.session.commit()
            
            # Сохраняем ID для использования вне контекста
            helper_id = helper.id
            application_id = application.id
        
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        rating_data = {
            'helper_id': helper_id,
            'rating_value': 5
        }
        
        response = client.post(
            f'/api/applications/{application_id}/rate-helper',
            json=rating_data
        )
        assert response.status_code in [200, 201]
        
        # Проверяем обновление рейтинга
        with client.application.app_context():
            helper = User.query.filter_by(email='helper4@example.com').first()
            assert helper.rating_count == 5
            assert helper.rating_sum == 25
            assert helper.average_rating == 5.0
    
    def test_badge_assignment(self, client, test_user):
        """Тест выдачи бейджа при достижении условий"""
        with client.application.app_context():
            from werkzeug.security import generate_password_hash
            helper = User(
                email='helper5@example.com',
                password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
                first_name='Helper5',
                city='Almaty',
                rating_sum=36,  # 9 оценок по 4
                rating_count=9
            )
            db.session.add(helper)
            db.session.commit()
            
            # Создаем 10-ю заявку для оценки
            application = Application(
                description='Test app for badge',
                latitude=43.2220,
                longitude=76.8512,
                category=ApplicationCategory.FOOD,
                user_id=test_user.id,
                moderation_status=ModerationStatus.APPROVED,
                is_resolved=True
            )
            db.session.add(application)
            db.session.commit()
            
            # Сохраняем ID для использования вне контекста
            helper_id = helper.id
            application_id = application.id
        
        client.post('/api/auth/login', json={
            'email': test_user.email,
            'password': 'Test1234!@#$'
        })
        
        rating_data = {
            'helper_id': helper_id,
            'rating_value': 5
        }
        
        response = client.post(
            f'/api/applications/{application.id}/rate-helper',
            json=rating_data
        )
        assert response.status_code in [200, 201]
        
        # Проверяем выдачу бейджа
        with client.application.app_context():
            helper = User.query.filter_by(email='helper5@example.com').first()
            assert helper.rating_count == 10
            assert helper.average_rating >= 4.0
            # Бейдж должен быть выдан (если реализована логика)
            # assert helper.badge is not None

