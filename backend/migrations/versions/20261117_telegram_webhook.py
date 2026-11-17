"""Persist Telegram conversations and processed update IDs."""
from alembic import op
import sqlalchemy as sa

revision = '20261117_telegram_webhook'
down_revision = '20261117_volunteer_location'
branch_labels = None
depends_on = None


def upgrade():
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if 'telegram_conversation' not in tables:
        op.create_table('telegram_conversation',
            sa.Column('key', sa.String(64), primary_key=True),
            sa.Column('state', sa.String(255), nullable=True),
            sa.Column('data', sa.JSON(), nullable=False))
    if 'telegram_update_receipt' not in tables:
        op.create_table('telegram_update_receipt',
            sa.Column('bot_id', sa.BigInteger(), primary_key=True),
            sa.Column('update_id', sa.BigInteger(), primary_key=True))


def downgrade():
    op.drop_table('telegram_update_receipt')
    op.drop_table('telegram_conversation')
