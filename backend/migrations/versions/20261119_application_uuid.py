"""Assign public UUIDs to existing and new applications."""
from alembic import op
import sqlalchemy as sa

revision = '20261119_application_uuid'
down_revision = '20261119_profile_feedback'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('application', sa.Column('public_id', sa.Uuid(), nullable=True))
    op.execute('UPDATE application SET public_id = gen_random_uuid() WHERE public_id IS NULL')
    op.alter_column('application', 'public_id', nullable=False, server_default=sa.text('gen_random_uuid()'))
    op.create_unique_constraint('uq_application_public_id', 'application', ['public_id'])


def downgrade():
    op.drop_constraint('uq_application_public_id', 'application', type_='unique')
    op.drop_column('application', 'public_id')
