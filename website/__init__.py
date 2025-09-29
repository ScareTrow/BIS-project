from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from pathlib import Path

db = SQLAlchemy()
DB_NAME = "database.db"


def create_app():
    app = Flask(__name__)
    app.config.from_pyfile("settings.py")
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DB_NAME}"

    db.init_app(app)

    from .views import views
    from .auth import auth
    app.register_blueprint(views, url_prefix="/")
    app.register_blueprint(auth, url_prefix="/")

    from .models import User

    login_manager = LoginManager()
    login_manager.login_view = "auth.login"
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        
        return User.query.get(int(user_id))

    init_database(app)
    return app


def init_database(app):
    db_path = Path("website") / DB_NAME
    if not db_path.exists():
        with app.app_context():
            db.create_all()
        print("Created Database!")
