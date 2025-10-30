from flask import Flask
from flask_sqlalchemy import SQLAlchemy
import os
from dotenv import load_dotenv
from flask_login import LoginManager


db = SQLAlchemy()
load_dotenv()


def create_app():
    app = Flask(__name__)

    app.config['SECRET_KEY'] = os.getenv("SECRET_KEY", "default_secret")
    db_name = os.getenv('DB_NAME', 'database.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{db_name}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)

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
        return User.query.get(int(user_id))

    return app


def create_database(app):
    db_path = os.getenv('DB_NAME', 'database.db')
    instance_path = app.instance_path
    if not os.path.exists(instance_path):
        os.makedirs(instance_path)

    full_db_path = os.path.join(instance_path, db_path)

    if not os.path.exists(full_db_path):
        with app.app_context():
            db.create_all()
            print(f"Database created at: {full_db_path}")
    else:
        print(f"Database already exists at: {full_db_path}")
