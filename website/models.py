from . import db
from flask_login import UserMixin
from sqlalchemy.sql import func


class Note(db.Model):  # type: ignore
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.String(10000))
    date = db.Column(db.DateTime(timezone=True), default=func.now())
    status = db.Column(db.String(150))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))


class User(db.Model, UserMixin):  # type: ignore
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(150), unique=True)
    password = db.Column(db.String(150))
    first_name = db.Column(db.String(150))
    last_name = db.Column(db.String(150))
    isAdmin = db.Column(db.Boolean, default=False)
    ban = db.Column(db.String(150))
    notes = db.relationship('Note')
