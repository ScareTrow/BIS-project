from . import db
from flask_login import UserMixin
from sqlalchemy.sql import func
from sqlalchemy import Enum
import enum


class ApplicationCategory(enum.Enum):
    FOOD = "food"
    MEDICINE = "medicine"
    SHELTER = "shelter"
    EMERGENCY = "emergency"


class ModerationStatus(enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ResponseStatus(enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(150), nullable=False)
    first_name = db.Column(db.String(150), nullable=False)
    last_name = db.Column(db.String(150))
    isAdmin = db.Column(db.Boolean, default=False, nullable=False)
    is_super_admin = db.Column(db.Boolean, default=False, nullable=False)
    
    rating_sum = db.Column(db.Integer, default=5, nullable=False)
    rating_count = db.Column(db.Integer, default=1, nullable=False)
    badge = db.Column(db.String(50), nullable=True)
    
    telegram_id = db.Column(db.String(100), nullable=True, unique=True)
    telegram_username = db.Column(db.String(100), nullable=True)
    
    avatar = db.Column(db.String(500), nullable=True)
    city = db.Column(db.String(150), nullable=True)
    city_hidden = db.Column(db.Boolean, default=False, nullable=False)
    social_links = db.Column(db.Text, nullable=True)
    
    is_blocked = db.Column(db.Boolean, default=False, nullable=False)
    blocked_until = db.Column(db.DateTime(timezone=True), nullable=True)
    blocked_reason = db.Column(db.String(500), nullable=True)
    
    applications = db.relationship('Application', backref='user', lazy=True, foreign_keys='Application.user_id')
    ratings_given = db.relationship('Rating', backref='rater', lazy=True, foreign_keys='Rating.rater_id')
    ratings_received = db.relationship('Rating', backref='rated', lazy=True, foreign_keys='Rating.rated_id')
    responses = db.relationship('ApplicationResponse', backref='responder', lazy=True)
    moderated_applications = db.relationship('Application', backref='moderator', lazy=True, foreign_keys='Application.moderator_id')

    @property
    def average_rating(self):
        if self.rating_count == 0:
            return 5.0
        return round(self.rating_sum / self.rating_count, 2)

    def update_badge(self):
        if self.rating_count >= 10 and self.average_rating >= 4.0:
            resource_ratings = Rating.query.filter_by(
                rated_id=self.id
            ).join(Application).filter(
                Application.category.in_([ApplicationCategory.FOOD, ApplicationCategory.SHELTER])
            ).count()
            
            if resource_ratings >= 10:
                self.badge = "verified_help_source"
            else:
                self.badge = "reliable_volunteer"
        else:
            self.badge = None

    def decrease_rating(self, penalty_value=1):
        if self.rating_count > 0:
            self.rating_sum = max(0, self.rating_sum - penalty_value)
            self.rating_count = max(0, self.rating_count - 1)
            self.update_badge()

    def __repr__(self):
        return f'<User {self.email}>'


class Application(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.String(10000), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    category = db.Column(Enum(ApplicationCategory), nullable=False)
    date = db.Column(db.DateTime(timezone=True), default=func.now(), nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=True)
    
    status = db.Column(db.String(150), default='In progress')
    moderation_status = db.Column(Enum(ModerationStatus), default=ModerationStatus.PENDING, nullable=False)
    
    is_sos = db.Column(db.Boolean, default=False, nullable=False)
    sos_count = db.Column(db.Integer, default=0, nullable=False)
    
    is_resolved = db.Column(db.Boolean, default=False, nullable=False)
    is_false_call = db.Column(db.Boolean, default=False, nullable=False)
    resolved_at = db.Column(db.DateTime(timezone=True), nullable=True)
    
    priority = db.Column(db.Integer, default=0, nullable=False)
    city = db.Column(db.String(200), nullable=True)
    region = db.Column(db.String(200), nullable=True)
    
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    moderator_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    moderated_at = db.Column(db.DateTime(timezone=True), nullable=True)
    
    media_files = db.relationship('ApplicationMedia', backref='application', lazy=True, cascade='all, delete-orphan')
    ratings = db.relationship('Rating', backref='application', lazy=True)
    responses = db.relationship('ApplicationResponse', backref='application', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Application {self.id}>'


class ApplicationMedia(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    application_id = db.Column(db.Integer, db.ForeignKey('application.id'), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_type = db.Column(db.String(50), nullable=False)
    uploaded_at = db.Column(db.DateTime(timezone=True), default=func.now(), nullable=False)

    def __repr__(self):
        return f'<ApplicationMedia {self.id}>'


class Rating(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    rater_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    rated_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    application_id = db.Column(db.Integer, db.ForeignKey('application.id'), nullable=False)
    rating_value = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.String(1000), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=func.now(), nullable=False)

    def __repr__(self):
        return f'<Rating {self.id}>'


class ApplicationResponse(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    application_id = db.Column(db.Integer, db.ForeignKey('application.id'), nullable=False)
    responder_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(Enum(ResponseStatus), default=ResponseStatus.PENDING, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=func.now(), nullable=False)

    def __repr__(self):
        return f'<ApplicationResponse {self.id}>'


class Note(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    coordinates = db.Column(db.String(300))
    description = db.Column(db.String(10000))
    date = db.Column(db.DateTime(timezone=True), default=func.now())
    status = db.Column(db.String(150))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))

    def __repr__(self):
        return f'<Note {self.id}>'


class NameChangeHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    old_name = db.Column(db.String(150), nullable=False)
    new_name = db.Column(db.String(150), nullable=False)
    changed_at = db.Column(db.DateTime(timezone=True), default=func.now(), nullable=False)

    def __repr__(self):
        return f'<NameChangeHistory {self.id}>'


class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.String(1000), nullable=False)
    notification_type = db.Column(db.String(50), nullable=False)
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    related_application_id = db.Column(db.Integer, db.ForeignKey('application.id'), nullable=True)
    related_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=func.now(), nullable=False)
    
    user = db.relationship('User', foreign_keys=[user_id], backref='notifications', lazy=True)

    def __repr__(self):
        return f'<Notification {self.id}>'


class News(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    news_type = db.Column(db.String(50), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False)
    is_published = db.Column(db.Boolean, default=True, nullable=False)
    
    author = db.relationship('User', backref='news_articles', lazy=True)

    def __repr__(self):
        return f'<News {self.id}>'