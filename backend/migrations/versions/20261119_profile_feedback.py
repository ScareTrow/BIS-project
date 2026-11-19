"""Track capability onboarding and review visibility."""
from alembic import op
import sqlalchemy as sa

revision = '20261119_profile_feedback'
down_revision = '20261117_delivery_locations'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('user', sa.Column('capability_onboarding_seen', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.alter_column('user', 'capability_onboarding_seen', server_default=sa.false())
    op.add_column('rating', sa.Column('is_hidden', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    op.drop_column('rating', 'is_hidden')
    op.drop_column('user', 'capability_onboarding_seen')
