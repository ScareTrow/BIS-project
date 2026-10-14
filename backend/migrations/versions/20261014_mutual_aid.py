"""Add mutual-aid capabilities, needs, resources and triage without replacing legacy records.

Revision ID: 20261014_mutual_aid
Revises: 2a3b4c5d6e7f
Prepared on 2026-10-15; revision label is the owner's retrospective scope date.
"""

from alembic import op
import sqlalchemy as sa

revision = "20261014_mutual_aid"
down_revision = "2a3b4c5d6e7f"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        with op.get_context().autocommit_block():
            for value in [
                "CLOTHING",
                "HOUSEHOLD",
                "DELIVERY",
                "VOLUNTEERING",
                "SOCIAL_PROJECT",
            ]:
                op.execute(
                    sa.text(
                        "ALTER TYPE applicationcategory ADD VALUE IF NOT EXISTS '"
                        + value
                        + "'"
                    )
                )
    columns = {c["name"] for c in sa.inspect(bind).get_columns("application")}
    for column in [
        sa.Column("needed_help", sa.Text()),
        sa.Column(
            "priority_source",
            sa.String(24),
            nullable=False,
            server_default="user_normal",
        ),
        sa.Column("created_via", sa.String(16), nullable=False, server_default="web"),
    ]:
        if column.name not in columns:
            op.add_column("application", column)
    constraints = {
        c["name"]
        for c in sa.inspect(bind).get_unique_constraints("application_response")
    }
    # Fail on pre-existing duplicates rather than silently deleting volunteer history.
    with op.batch_alter_table("application_response") as batch:
        if "uq_response_application" not in constraints:
            batch.create_unique_constraint(
                "uq_response_application", ["id", "application_id"]
            )
        if "uq_response_volunteer" not in constraints:
            batch.create_unique_constraint(
                "uq_response_volunteer", ["application_id", "responder_id"]
            )

    rating_constraints = {
        c["name"] for c in sa.inspect(bind).get_unique_constraints("rating")
    }
    if "uq_rating_response_pair" not in rating_constraints:
        with op.batch_alter_table("rating") as batch:
            batch.create_unique_constraint(
                "uq_rating_response_pair", ["application_id", "rater_id", "rated_id"]
            )
    if not sa.inspect(op.get_bind()).has_table("capabilities"):
        op.create_table(
            "capabilities",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("code", sa.String(length=64), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("code"),
        )
    if not sa.inspect(op.get_bind()).has_table("triage_rules"):
        op.create_table(
            "triage_rules",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("category", sa.String(length=32), nullable=True),
            sa.Column("keyword", sa.String(length=160), nullable=True),
            sa.Column("priority", sa.String(length=16), nullable=False),
            sa.Column("rule_order", sa.Integer(), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.CheckConstraint(
                "priority IN ('normal', 'high', 'sos')", name="ck_triage_priority"
            ),
            sa.CheckConstraint(
                "category IS NOT NULL OR keyword IS NOT NULL",
                name="ck_triage_condition",
            ),
            sa.PrimaryKeyConstraint("id"),
        )
    if not sa.inspect(op.get_bind()).has_table("resources"):
        op.create_table(
            "resources",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("owner_id", sa.Integer(), nullable=False),
            sa.Column("category", sa.String(length=32), nullable=False),
            sa.Column("city", sa.String(length=200), nullable=False),
            sa.Column("name", sa.String(length=160), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("latitude", sa.Float(), nullable=False),
            sa.Column("longitude", sa.Float(), nullable=False),
            sa.Column(
                "availability",
                sa.String(length=16),
                server_default="available",
                nullable=False,
            ),
            sa.Column("last_confirmed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.CheckConstraint(
                "availability IN ('available', 'unavailable', 'outdated')",
                name="ck_resource_availability",
            ),
            sa.CheckConstraint(
                "latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180",
                name="ck_resource_coordinates",
            ),
            sa.ForeignKeyConstraint(["owner_id"], ["user.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    if not sa.inspect(op.get_bind()).has_table("user_capabilities"):
        op.create_table(
            "user_capabilities",
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("capability_id", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(["capability_id"], ["capabilities.id"]),
            sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
            sa.PrimaryKeyConstraint("user_id", "capability_id"),
        )
    if not sa.inspect(op.get_bind()).has_table("volunteer_preferences"):
        op.create_table(
            "volunteer_preferences",
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column(
                "is_available", sa.Boolean(), server_default=sa.false(), nullable=False
            ),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
            sa.PrimaryKeyConstraint("user_id"),
        )
    if not sa.inspect(op.get_bind()).has_table("application_capabilities"):
        op.create_table(
            "application_capabilities",
            sa.Column("application_id", sa.Integer(), nullable=False),
            sa.Column("capability_id", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(["application_id"], ["application.id"]),
            sa.ForeignKeyConstraint(["capability_id"], ["capabilities.id"]),
            sa.PrimaryKeyConstraint("application_id", "capability_id"),
        )
    if not sa.inspect(op.get_bind()).has_table("application_needs"):
        op.create_table(
            "application_needs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("application_id", sa.Integer(), nullable=False),
            sa.Column("resource_name", sa.String(length=160), nullable=False),
            sa.Column("unit", sa.String(length=32), nullable=False),
            sa.Column(
                "quantity_needed", sa.Numeric(precision=12, scale=3), nullable=False
            ),
            sa.CheckConstraint("quantity_needed > 0", name="ck_need_positive"),
            sa.ForeignKeyConstraint(["application_id"], ["application.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("id", "application_id", name="uq_need_application"),
        )
    if not sa.inspect(op.get_bind()).has_table("moderation_actions"):
        op.create_table(
            "moderation_actions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("application_id", sa.Integer(), nullable=False),
            sa.Column("admin_id", sa.Integer(), nullable=False),
            sa.Column("action", sa.String(length=24), nullable=False),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("previous_status", sa.String(length=24), nullable=True),
            sa.Column("new_status", sa.String(length=24), nullable=True),
            sa.Column("previous_priority", sa.Integer(), nullable=True),
            sa.Column("new_priority", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["admin_id"], ["user.id"]),
            sa.ForeignKeyConstraint(["application_id"], ["application.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    if not sa.inspect(op.get_bind()).has_table("resource_confirmations"):
        op.create_table(
            "resource_confirmations",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("resource_id", sa.Integer(), nullable=False),
            sa.Column("responsible_user_id", sa.Integer(), nullable=False),
            sa.Column("reminder_sent_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("answer", sa.String(length=16), nullable=True),
            sa.Column("answered_at", sa.DateTime(timezone=True), nullable=True),
            sa.CheckConstraint(
                "answer IS NULL OR answer IN ('available', 'unavailable')",
                name="ck_confirmation_answer",
            ),
            sa.ForeignKeyConstraint(["resource_id"], ["resources.id"]),
            sa.ForeignKeyConstraint(["responsible_user_id"], ["user.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    if not sa.inspect(op.get_bind()).has_table("contributions"):
        op.create_table(
            "contributions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("application_id", sa.Integer(), nullable=False),
            sa.Column("need_id", sa.Integer(), nullable=False),
            sa.Column("response_id", sa.Integer(), nullable=False),
            sa.Column(
                "quantity_promised", sa.Numeric(precision=12, scale=3), nullable=False
            ),
            sa.Column(
                "quantity_delivered",
                sa.Numeric(precision=12, scale=3),
                server_default="0",
                nullable=False,
            ),
            sa.Column(
                "status",
                sa.String(length=16),
                server_default="promised",
                nullable=False,
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.CheckConstraint(
                "status IN ('promised', 'delivered', 'cancelled')",
                name="ck_contribution_status",
            ),
            sa.CheckConstraint(
                "quantity_promised > 0 AND quantity_delivered >= 0 AND quantity_delivered <= quantity_promised",
                name="ck_contribution_quantities",
            ),
            sa.ForeignKeyConstraint(["application_id"], ["application.id"]),
            sa.ForeignKeyConstraint(
                ["need_id", "application_id"],
                ["application_needs.id", "application_needs.application_id"],
                name="fk_contribution_need_application",
            ),
            sa.ForeignKeyConstraint(
                ["response_id", "application_id"],
                ["application_response.id", "application_response.application_id"],
                name="fk_contribution_response_application",
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("need_id", "response_id", name="uq_need_response"),
        )

    op.execute(
        sa.text(
            "UPDATE application SET priority_source = 'user_sos', priority = 5 WHERE is_sos = TRUE AND priority_source = 'user_normal'"
        )
    )
    for code, name in [
        ("has_car", "Есть машина"),
        ("deliver_food", "Могу доставить продукты"),
        ("transport_items", "Могу перевозить вещи"),
        ("translate", "Могу переводить"),
        ("household_help", "Могу помочь с бытовыми задачами"),
    ]:
        exists = bind.execute(
            sa.text("SELECT id FROM capabilities WHERE code = :code"), {"code": code}
        ).first()
        if not exists:
            bind.execute(
                sa.text("INSERT INTO capabilities (code, name) VALUES (:code, :name)"),
                {"code": code, "name": name},
            )


def downgrade():
    raise RuntimeError(
        "This additive migration contains user contributions and confirmation history. Restore a verified backup instead of discarding those records automatically."
    )
