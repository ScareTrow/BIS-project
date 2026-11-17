"""Add expiring single-use Telegram account links."""
from alembic import op
import sqlalchemy as sa

revision = '20261117_telegram_link'
down_revision = '20261117_password_hashes'
branch_labels = None
depends_on = None


def upgrade():
    if not sa.inspect(op.get_bind()).has_table('telegram_link_token'):
        op.create_table('telegram_link_token',
            sa.Column('token_hash', sa.String(64), primary_key=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id', ondelete='CASCADE'), nullable=False, unique=True),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False))


def downgrade():
    op.drop_table('telegram_link_token')
