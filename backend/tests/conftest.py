"""Isolated application fixtures using the production app factory.

Set ASAR_TEST_DATABASE_URL to a dedicated PostgreSQL test database to run
this same suite against PostgreSQL. Tables in that database are recreated.
"""
import os
import sys
from pathlib import Path
import pytest
from datetime import datetime, timezone, timedelta

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.website import db, create_app
from backend.website.models import (
    User, Application, ApplicationCategory, ModerationStatus, Rating,
    ApplicationResponse, ResponseStatus, Notification, ApplicationMedia,
)

@pytest.fixture(autouse=True)
def _push_request_context():
    # Override pytest-flask's test-wide context. Each HTTP request must get
    # its own Flask g so multiple clients cannot share a cached current_user.
    yield

@pytest.fixture
def app(tmp_path):
    database_url = os.getenv('ASAR_TEST_DATABASE_URL', 'sqlite:///:memory:')
    if database_url.startswith('postgresql://'):
        database_url = database_url.replace('postgresql://', 'postgresql+psycopg2://', 1)
    if not database_url.startswith('sqlite:'):
        from sqlalchemy.engine import make_url
        target = make_url(database_url)
        if not target.database or not target.database.endswith('_test'):
            raise ValueError('ASAR_TEST_DATABASE_URL must name a disposable database ending in _test')
    app = create_app({
        'TESTING': True,
        'SECRET_KEY': 'asar-test-only',
        'SQLALCHEMY_DATABASE_URI': database_url,
        'UPLOAD_FOLDER': str(tmp_path / 'uploads'),
        'AUTO_CREATE_DATABASE': False,
    })
    with app.app_context():
        db.create_all()
    yield app
    with app.app_context():
        db.session.remove()
        db.drop_all()

@pytest.fixture(autouse=True)
def isolate_external_services(monkeypatch):
    # Unit/integration tests do not depend on public geocoding or send messages.
    monkeypatch.setattr('backend.website.views.get_location_info', lambda *args: ('Almaty', 'Almaty Region'))
    monkeypatch.setattr('backend.website.views.get_full_address', lambda *args: 'Almaty, Kazakhstan')
    monkeypatch.setattr('backend.telegram_bot.config.Config.TELEGRAM_BOT_TOKEN', None)

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def runner(app):
    """Создает CLI runner для тестирования команд"""
    return app.test_cli_runner()


@pytest.fixture
def auth_headers(client):
    """Создает пользователя и возвращает заголовки авторизации"""
    user_data = {
        'email': 'test@example.com',
        'password': 'Asar8!River2',
        'firstName': 'Test',
        'lastName': 'User',
        'password1': 'Asar8!River2',
        'password2': 'Asar8!River2',
        'phone': '+77001234567',
        'city': 'Almaty'
    }
    
    # Регистрация
    response = client.post('/api/auth/signup', json=user_data)
    assert response.status_code in [200, 201]
    
    # Вход
    login_response = client.post('/api/auth/login', json={
        'email': user_data['email'],
        'password': user_data['password']
    })
    assert login_response.status_code == 200
    
    # Возвращаем cookies для последующих запросов
    return client


@pytest.fixture
def test_user(app):
    """Создает тестового пользователя в БД"""
    with app.app_context():
        # Убеждаемся, что таблицы созданы
        db.create_all()
        
        from werkzeug.security import generate_password_hash
        user = User(
            email='test@example.com',
            password=generate_password_hash('Asar8!River2', method='pbkdf2:sha256', salt_length=8),
            first_name='Test',
            last_name='User',
            isAdmin=False,
            city='Almaty'
        )
        db.session.add(user)
        db.session.commit()
        db.session.refresh(user)
        return user


@pytest.fixture
def admin_user(app):
    """Создает тестового администратора в БД"""
    with app.app_context():
        # Убеждаемся, что таблицы созданы
        db.create_all()
        
        from werkzeug.security import generate_password_hash
        admin = User(
            email='admin@example.com',
            password=generate_password_hash('Admin1234!@#$', method='pbkdf2:sha256', salt_length=8),
            first_name='Admin',
            last_name='User',
            isAdmin=True,
            is_super_admin=True,
            city='Almaty'
        )
        db.session.add(admin)
        db.session.commit()
        db.session.refresh(admin)
        return admin


@pytest.fixture
def test_application(app, test_user):
    """Создает тестовую заявку"""
    with app.app_context():
        # Убеждаемся, что таблицы созданы
        db.create_all()
        
        application = Application(
            description='Test application description',
            latitude=43.2220,
            longitude=76.8512,
            category=ApplicationCategory.FOOD,
            user_id=test_user.id,
            moderation_status=ModerationStatus.APPROVED,
            city='Almaty',
            region='Almaty Region'
        )
        db.session.add(application)
        db.session.commit()
        db.session.refresh(application)
        return application


@pytest.fixture
def test_application_pending(app, test_user):
    """Создает тестовую заявку в статусе pending"""
    with app.app_context():
        # Убеждаемся, что таблицы созданы
        db.create_all()
        
        application = Application(
            description='Pending application',
            latitude=43.2220,
            longitude=76.8512,
            category=ApplicationCategory.MEDICINE,
            user_id=test_user.id,
            moderation_status=ModerationStatus.PENDING,
            city='Almaty'
        )
        db.session.add(application)
        db.session.commit()
        db.session.refresh(application)
        return application


@pytest.fixture
def test_response(app, test_application, test_user):
    """Создает тестовый отклик на заявку"""
    with app.app_context():
        # Убеждаемся, что таблицы созданы
        db.create_all()
        
        from werkzeug.security import generate_password_hash
        # Создаем второго пользователя для отклика
        responder = User(
            email='responder@example.com',
            password=generate_password_hash('Asar8!River2', method='pbkdf2:sha256', salt_length=8),
            first_name='Responder',
            last_name='User',
            city='Almaty'
        )
        db.session.add(responder)
        db.session.commit()
        db.session.refresh(responder)
        
        response = ApplicationResponse(
            application_id=test_application.id,
            responder_id=responder.id,
            status=ResponseStatus.PENDING
        )
        db.session.add(response)
        db.session.commit()
        db.session.refresh(response)
        db.session.refresh(responder)
        return response, responder


@pytest.fixture
def test_rating(app, test_user):
    """Создает тестовый рейтинг"""
    with app.app_context():
        # Убеждаемся, что таблицы созданы
        db.create_all()
        
        from werkzeug.security import generate_password_hash
        # Создаем второго пользователя для рейтинга
        rated_user = User(
            email='rated@example.com',
            password=generate_password_hash('Asar8!River2', method='pbkdf2:sha256', salt_length=8),
            first_name='Rated',
            last_name='User',
            city='Almaty'
        )
        db.session.add(rated_user)
        db.session.commit()
        db.session.refresh(rated_user)
        
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
        db.session.refresh(application)
        
        rating = Rating(
            rater_id=test_user.id,
            rated_id=rated_user.id,
            application_id=application.id,
            rating_value=5,
            comment='Great help!'
        )
        db.session.add(rating)
        db.session.commit()
        db.session.refresh(rating)
        db.session.refresh(rated_user)
        return rating, rated_user, application

