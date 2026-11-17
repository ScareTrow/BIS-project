"""Allow modern Werkzeug scrypt hashes without truncating credentials."""
from alembic import op
import sqlalchemy as sa

revision = '20261117_password_hashes'
down_revision = '20261117_telegram_webhook'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('user', 'password', existing_type=sa.String(150), type_=sa.String(255))


def downgrade():
    # Existing long hashes must never be truncated during a rollback.
    pass
