"""
Конфигурация для pytest тестов
"""
import pytest
import os
import sys
import tempfile
from datetime import datetime, timezone, timedelta

# Добавляем путь к backend в sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
project_root = os.path.dirname(backend_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from flask import Flask
from flask_cors import CORS
from flask_login import LoginManager
from flask_migrate import Migrate
from backend.website.models import (
    User, Application, ApplicationCategory, ModerationStatus,
    Rating, ApplicationResponse, ResponseStatus, Notification,
    ApplicationMedia
)
from backend.website import db


def create_test_app():
    """Создает тестовое приложение Flask без требования PostgreSQL"""
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    instance_path = os.path.join(backend_dir, 'instance')
    app = Flask(__name__, instance_path=instance_path)
    
    # Используем SQLite в памяти для тестов (быстрее и не требует очистки)
    app.config['SECRET_KEY'] = 'test-secret-key-for-testing'
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['TESTING'] = True
    app.config['WTF_CSRF_ENABLED'] = False
    app.config['UPLOAD_FOLDER'] = tempfile.mkdtemp()
    app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024
    
    CORS(app, 
         origins=['http://localhost:3000', 'http://localhost:3001'],
         supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization'],
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
    
    db.init_app(app)
    migrate = Migrate()
    migrate.init_app(app, db)
    
    from backend.website.views import views
    from backend.website.auth import auth
    
    app.register_blueprint(views, url_prefix='/')
    app.register_blueprint(auth, url_prefix='/')
    
    login_manager = LoginManager()
    login_manager.login_view = 'auth.login'
    login_manager.login_message = 'Пожалуйста, войдите в систему для доступа'
    login_manager.login_message_category = 'info'
    login_manager.init_app(app)
    
    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))
    
    return app


@pytest.fixture(scope='session')
def app():
    """Создает тестовое приложение Flask"""
    app = create_test_app()
    
    try:
        with app.app_context():
            db.create_all()
            yield app
            db.session.remove()
            db.drop_all()
    finally:
        # SQLite в памяти не требует очистки файлов
        pass


@pytest.fixture(autouse=True)
def clean_db(app):
    """Автоматически очищает базу данных перед каждым тестом"""
    with app.app_context():
        # Удаляем все данные из таблиц в правильном порядке (с учетом внешних ключей)
        try:
            Notification.query.delete()
            Rating.query.delete()
            ApplicationResponse.query.delete()
            ApplicationMedia.query.delete()
            Application.query.delete()
            User.query.delete()
            db.session.commit()
        except Exception:
            db.session.rollback()
    yield
    # Очистка после теста (на случай если что-то осталось)
    with app.app_context():
        try:
            db.session.rollback()
            Notification.query.delete()
            Rating.query.delete()
            ApplicationResponse.query.delete()
            ApplicationMedia.query.delete()
            Application.query.delete()
            User.query.delete()
            db.session.commit()
        except Exception:
            db.session.rollback()


@pytest.fixture
def client(app):
    """Создает тестовый клиент Flask"""
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
        'password': 'Test1234!@#$',
        'firstName': 'Test',
        'lastName': 'User',
        'password1': 'Test1234!@#$',
        'password2': 'Test1234!@#$',
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
            password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
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
            password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
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
            password=generate_password_hash('Test1234!@#$', method='pbkdf2:sha256', salt_length=8),
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
        return rating, rated_user, application

