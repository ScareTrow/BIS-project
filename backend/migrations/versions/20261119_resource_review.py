"""Moderate help points before publication, with optional photos."""
from alembic import op
import sqlalchemy as sa

revision = '20261119_resource_review'
down_revision = '20261119_application_uuid'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('resources', sa.Column('moderation_status', sa.String(16), nullable=False, server_default='pending'))
    op.add_column('resources', sa.Column('rejection_reason', sa.String(1000)))
    op.add_column('resources', sa.Column('photos', sa.JSON()))
    op.create_check_constraint('ck_resource_moderation_status', 'resources',
                               "moderation_status IN ('pending', 'approved', 'rejected')")


def downgrade():
    op.drop_constraint('ck_resource_moderation_status', 'resources', type_='check')
    op.drop_column('resources', 'photos')
    op.drop_column('resources', 'rejection_reason')
    op.drop_column('resources', 'moderation_status')
