"""Additive mutual-aid entities; existing accounts and requests retain their IDs."""

from sqlalchemy.sql import func
from . import db


class Capability(db.Model):
    __tablename__ = "capabilities"
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(64), unique=True, nullable=False)
    name = db.Column(db.String(120), nullable=False)


class UserCapability(db.Model):
    __tablename__ = "user_capabilities"
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), primary_key=True)
    capability_id = db.Column(
        db.Integer, db.ForeignKey("capabilities.id"), primary_key=True
    )


class ApplicationCapability(db.Model):
    __tablename__ = "application_capabilities"
    application_id = db.Column(
        db.Integer, db.ForeignKey("application.id"), primary_key=True
    )
    capability_id = db.Column(
        db.Integer, db.ForeignKey("capabilities.id"), primary_key=True
    )


class VolunteerPreference(db.Model):
    __tablename__ = "volunteer_preferences"
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), primary_key=True)
    is_available = db.Column(
        db.Boolean, nullable=False, default=False, server_default=db.false()
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        onupdate=func.now(),
    )


class ApplicationNeed(db.Model):
    __tablename__ = "application_needs"
    id = db.Column(db.Integer, primary_key=True)
    application_id = db.Column(
        db.Integer, db.ForeignKey("application.id"), nullable=False
    )
    resource_name = db.Column(db.String(160), nullable=False)
    unit = db.Column(db.String(32), nullable=False)
    quantity_needed = db.Column(db.Numeric(12, 3), nullable=False)
    __table_args__ = (
        db.UniqueConstraint("id", "application_id", name="uq_need_application"),
        db.CheckConstraint("quantity_needed > 0", name="ck_need_positive"),
    )


class Contribution(db.Model):
    __tablename__ = "contributions"
    id = db.Column(db.Integer, primary_key=True)
    application_id = db.Column(
        db.Integer, db.ForeignKey("application.id"), nullable=False
    )
    need_id = db.Column(db.Integer, nullable=False)
    response_id = db.Column(db.Integer, nullable=False)
    quantity_promised = db.Column(db.Numeric(12, 3), nullable=False)
    quantity_delivered = db.Column(
        db.Numeric(12, 3), nullable=False, default=0, server_default="0"
    )
    status = db.Column(
        db.String(16), nullable=False, default="promised", server_default="promised"
    )
    created_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=func.now()
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        onupdate=func.now(),
    )
    __table_args__ = (
        db.ForeignKeyConstraint(
            ["need_id", "application_id"],
            ["application_needs.id", "application_needs.application_id"],
            name="fk_contribution_need_application",
        ),
        db.ForeignKeyConstraint(
            ["response_id", "application_id"],
            ["application_response.id", "application_response.application_id"],
            name="fk_contribution_response_application",
        ),
        db.UniqueConstraint("need_id", "response_id", name="uq_need_response"),
        db.CheckConstraint(
            "quantity_promised > 0 AND quantity_delivered >= 0 AND quantity_delivered <= quantity_promised",
            name="ck_contribution_quantities",
        ),
        db.CheckConstraint(
            "status IN ('promised', 'delivered', 'cancelled')",
            name="ck_contribution_status",
        ),
    )


class Resource(db.Model):
    __tablename__ = "resources"
    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    category = db.Column(db.String(32), nullable=False)
    city = db.Column(db.String(200), nullable=False)
    name = db.Column(db.String(160), nullable=False)
    description = db.Column(db.Text)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    availability = db.Column(
        db.String(16), nullable=False, default="available", server_default="available"
    )
    last_confirmed_at = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=func.now()
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        onupdate=func.now(),
    )
    __table_args__ = (
        db.CheckConstraint(
            "availability IN ('available', 'unavailable', 'outdated')",
            name="ck_resource_availability",
        ),
        db.CheckConstraint(
            "latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180",
            name="ck_resource_coordinates",
        ),
    )


class ResourceConfirmation(db.Model):
    __tablename__ = "resource_confirmations"
    id = db.Column(db.Integer, primary_key=True)
    resource_id = db.Column(db.Integer, db.ForeignKey("resources.id"), nullable=False)
    responsible_user_id = db.Column(
        db.Integer, db.ForeignKey("user.id"), nullable=False
    )
    reminder_sent_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=func.now()
    )
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    answer = db.Column(db.String(16))
    answered_at = db.Column(db.DateTime(timezone=True))
    __table_args__ = (
        db.CheckConstraint(
            "answer IS NULL OR answer IN ('available', 'unavailable')",
            name="ck_confirmation_answer",
        ),
    )


class TriageRule(db.Model):
    __tablename__ = "triage_rules"
    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(32))
    keyword = db.Column(db.String(160))
    priority = db.Column(db.String(16), nullable=False)
    rule_order = db.Column(db.Integer, nullable=False, default=0)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    __table_args__ = (
        db.CheckConstraint(
            "category IS NOT NULL OR keyword IS NOT NULL", name="ck_triage_condition"
        ),
        db.CheckConstraint(
            "priority IN ('normal', 'high', 'sos')", name="ck_triage_priority"
        ),
    )


class ModerationAction(db.Model):
    __tablename__ = "moderation_actions"
    id = db.Column(db.Integer, primary_key=True)
    application_id = db.Column(
        db.Integer, db.ForeignKey("application.id"), nullable=False
    )
    admin_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    action = db.Column(db.String(24), nullable=False)
    reason = db.Column(db.Text)
    previous_status = db.Column(db.String(24))
    new_status = db.Column(db.String(24))
    previous_priority = db.Column(db.Integer)
    new_priority = db.Column(db.Integer)
    created_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=func.now()
    )
