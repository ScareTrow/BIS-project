"""Store private volunteer coordinates for nearby request alerts."""
from alembic import op
import sqlalchemy as sa

revision = '20261117_volunteer_location'
down_revision = '20261014_mutual_aid'
branch_labels = None
depends_on = None


def upgrade():
    columns = {c['name'] for c in sa.inspect(op.get_bind()).get_columns('volunteer_preferences')}
    for name in ('latitude', 'longitude'):
        if name not in columns:
            op.add_column('volunteer_preferences', sa.Column(name, sa.Float(), nullable=True))


def downgrade():
    with op.batch_alter_table('volunteer_preferences') as batch:
        batch.drop_column('longitude')
        batch.drop_column('latitude')
