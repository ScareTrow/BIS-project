from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from werkzeug.exceptions import RequestEntityTooLarge
import os
from urllib.parse import quote_plus
from dotenv import load_dotenv
from flask_login import LoginManager
from flask_migrate import Migrate


db = SQLAlchemy()
migrate = Migrate()
load_dotenv()


def create_app():
    import os
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    instance_path = os.path.join(backend_dir, 'instance')
    app = Flask(__name__, instance_path=instance_path)

    app.config['SECRET_KEY'] = os.getenv("SECRET_KEY", "default_secret")
    
    db_user = os.getenv('DB_USER')
    db_password = os.getenv('DB_PASSWORD')
    db_host = os.getenv('DB_HOST', 'localhost')
    db_port = os.getenv('DB_PORT', '5432')
    db_name = os.getenv('DB_NAME', 'asar_db')
    
    if not db_user or not db_password:
        raise ValueError(
            "PostgreSQL credentials are required! "
            "Please set DB_USER and DB_PASSWORD in your .env file. "
            "See .env.example for reference."
        )
    
    try:
        encoded_password = quote_plus(str(db_password))
        encoded_user = quote_plus(str(db_user))
        
        app.config['SQLALCHEMY_DATABASE_URI'] = (
            f"postgresql://{encoded_user}:{encoded_password}@{db_host}:{db_port}/{db_name}"
        )
        print(f"Connecting to PostgreSQL database: {db_name}@{db_host}:{db_port}")
    except Exception as e:
        raise ValueError(
            f"Error configuring PostgreSQL connection: {e}. "
            "Please check your database credentials in .env file."
        )
    
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['UPLOAD_FOLDER'] = os.path.join(app.instance_path, 'uploads')
    app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024
    
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    CORS(app, 
         origins=['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'],
         supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization'],
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])

    db.init_app(app)
    migrate.init_app(app, db)

    from .views import views
    from .auth import auth

    app.register_blueprint(views, url_prefix='/')
    app.register_blueprint(auth, url_prefix='/')

    from .models import User

    create_database(app)

    login_manager = LoginManager()
    login_manager.login_view = 'auth.login'
    login_msg = 'Пожалуйста, войдите в систему для доступа'
    login_manager.login_message = login_msg
    login_manager.login_message_category = 'info'
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))
    
    @app.errorhandler(RequestEntityTooLarge)
    def handle_request_entity_too_large(e):
        if request.path.startswith('/api/'):
            return jsonify({
                'error': 'Размер загружаемых файлов слишком большой. Пожалуйста, уменьшите размер файлов или загрузите меньше файлов.',
                'max_size': '100 МБ'
            }), 413
        return 'Файл слишком большой', 413
    
    @app.template_filter('from_json')
    def from_json_filter(value):
        import json
        if value:
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError, ValueError) as e:
                return {}
        return {}
    
    @app.cli.command('check-expired-applications')
    def check_expired_applications():
        from .models import Application, ApplicationResponse, ResponseStatus
        from datetime import datetime, timezone
        
        with app.app_context():
            expired_apps = Application.query.filter(
                Application.expires_at <= datetime.now(timezone.utc),
                Application.is_resolved == False,
                Application.is_false_call == False
            ).all()
            
            for app in expired_apps:
                accepted_responses = ApplicationResponse.query.filter_by(
                    application_id=app.id,
                    status=ResponseStatus.ACCEPTED
                ).all()
                
                unrated_helpers = []
                for response in accepted_responses:
                    from .models import Rating
                    existing_rating = Rating.query.filter_by(
                        rater_id=app.user_id,
                        rated_id=response.responder_id,
                        application_id=app.id
                    ).first()
                    if not existing_rating:
                        unrated_helpers.append(response.responder_id)
                
                if unrated_helpers:
                    from .views import create_notification
                    create_notification(
                        user_id=app.user_id,
                        title='Оцените волонтеров',
                        message=f'Срок заявки #{app.id} истек. Пожалуйста, оцените волонтеров, которые помогли, или отметьте, если помощь не была оказана.',
                        notification_type='rate_volunteers_expired',
                        related_application_id=app.id,
                        send_telegram=True
                    )
                    db.session.commit()

    return app


def create_database(app):
    with app.app_context():
        try:
            from sqlalchemy import inspect, text
            inspector = inspect(db.engine)
            existing_tables = inspector.get_table_names()
            
            if not existing_tables:
                db.create_all()
                print("Database tables created")
                return
            
            db.create_all()
            
            required_columns = {
                'user': ['is_super_admin', 'is_blocked', 'blocked_until', 'blocked_reason', 'avatar', 'city', 'city_hidden', 'social_links'],
                'application': ['is_resolved', 'is_false_call', 'resolved_at', 'priority', 'city', 'region'],
                'name_change_history': []
            }
            
            for table_name, columns in required_columns.items():
                if table_name not in existing_tables:
                    continue
                    
                existing_columns = [col['name'] for col in inspector.get_columns(table_name)]
                
                for col_name in columns:
                    if col_name not in existing_columns:
                        try:
                            if col_name == 'is_super_admin':
                                db.session.execute(text(f'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS {col_name} BOOLEAN NOT NULL DEFAULT FALSE'))
                            elif col_name == 'is_blocked':
                                db.session.execute(text(f'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS {col_name} BOOLEAN NOT NULL DEFAULT FALSE'))
                            elif col_name == 'blocked_until':
                                db.session.execute(text(f'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS {col_name} TIMESTAMP WITH TIME ZONE'))
                            elif col_name == 'blocked_reason':
                                db.session.execute(text(f'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS {col_name} VARCHAR(500)'))
                            elif col_name == 'avatar':
                                db.session.execute(text(f'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS {col_name} VARCHAR(500)'))
                            elif col_name == 'city':
                                db.session.execute(text(f'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS {col_name} VARCHAR(150)'))
                            elif col_name == 'city_hidden':
                                db.session.execute(text(f'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS {col_name} BOOLEAN NOT NULL DEFAULT FALSE'))
                            elif col_name == 'social_links':
                                db.session.execute(text(f'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS {col_name} TEXT'))
                            elif col_name == 'is_resolved':
                                db.session.execute(text(f'ALTER TABLE application ADD COLUMN IF NOT EXISTS {col_name} BOOLEAN NOT NULL DEFAULT FALSE'))
                            elif col_name == 'is_false_call':
                                db.session.execute(text(f'ALTER TABLE application ADD COLUMN IF NOT EXISTS {col_name} BOOLEAN NOT NULL DEFAULT FALSE'))
                            elif col_name == 'resolved_at':
                                db.session.execute(text(f'ALTER TABLE application ADD COLUMN IF NOT EXISTS {col_name} TIMESTAMP WITH TIME ZONE'))
                            elif col_name == 'priority' and table_name == 'application':
                                db.session.execute(text(f'ALTER TABLE application ADD COLUMN IF NOT EXISTS {col_name} INTEGER NOT NULL DEFAULT 0'))
                            elif col_name == 'city' and table_name == 'application':
                                db.session.execute(text(f'ALTER TABLE application ADD COLUMN IF NOT EXISTS {col_name} VARCHAR(200)'))
                            elif col_name == 'region' and table_name == 'application':
                                db.session.execute(text(f'ALTER TABLE application ADD COLUMN IF NOT EXISTS {col_name} VARCHAR(200)'))
                            
                            db.session.commit()
                            print(f"Added column {col_name} to {table_name}")
                        except Exception as e:
                            db.session.rollback()
                            if 'already exists' not in str(e).lower() and 'duplicate' not in str(e).lower():
                                print(f"Warning: Could not add column {col_name} to {table_name}: {e}")
            
            if 'name_change_history' not in existing_tables:
                try:
                    db.session.execute(text("""
                        CREATE TABLE IF NOT EXISTS name_change_history (
                            id SERIAL PRIMARY KEY,
                            user_id INTEGER NOT NULL,
                            old_name VARCHAR(150) NOT NULL,
                            new_name VARCHAR(150) NOT NULL,
                            changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (user_id) REFERENCES "user"(id)
                        )
                    """))
                    db.session.commit()
                    print("Created name_change_history table")
                except Exception as e:
                    db.session.rollback()
                    if 'already exists' not in str(e).lower():
                        print(f"Warning: Could not create name_change_history table: {e}")
            
            if 'news' not in existing_tables:
                try:
                    db.session.execute(text("""
                        CREATE TABLE IF NOT EXISTS news (
                            id SERIAL PRIMARY KEY,
                            title VARCHAR(200) NOT NULL,
                            content TEXT NOT NULL,
                            news_type VARCHAR(50) NOT NULL,
                            author_id INTEGER NOT NULL,
                            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            is_published BOOLEAN NOT NULL DEFAULT TRUE,
                            FOREIGN KEY (author_id) REFERENCES "user"(id)
                        )
                    """))
                    db.session.commit()
                    print("Created news table")
                except Exception as e:
                    db.session.rollback()
                    if 'already exists' not in str(e).lower():
                        print(f"Warning: Could not create news table: {e}")
            
            print("Database schema verified")
            
        except Exception as e:
            error_msg = str(e)
            print(f"Error verifying database schema: {error_msg}")
            if 'postgresql' not in error_msg.lower() and 'connection' not in error_msg.lower():
                raise
            elif 'UnicodeDecodeError' in error_msg or 'codec' in error_msg:
                print("\n" + "="*60)
                print("ENCODING ERROR DETECTED!")
                print("="*60)
                print("This usually means:")
                print("1. Your .env file has encoding issues")
                print("2. Database password contains special characters")
                print("\nSOLUTIONS:")
                print("1. Fix .env file encoding (save as UTF-8)")
                print("2. Use simple ASCII characters in DB credentials")
                print("3. Or URL-encode special characters in password")
                print("="*60 + "\n")
                raise
            elif 'postgresql' in error_msg.lower() or 'connection' in error_msg.lower() or 'psycopg' in error_msg.lower():
                print("\n" + "="*60)
                print("POSTGRESQL CONNECTION ERROR!")
                print("="*60)
                print("Make sure:")
                print("1. PostgreSQL is running")
                print("2. Database exists: CREATE DATABASE asar_db;")
                print("3. Credentials in .env are correct")
                print("4. PostgreSQL is accessible from this host")
                print("="*60 + "\n")
                raise
            else:
                raise
