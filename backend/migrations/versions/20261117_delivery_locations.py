"""Store delivery locations and replace promises with delivered quantities."""
from alembic import op
import sqlalchemy as sa

revision = '20261117_delivery_locations'
down_revision = '20261117_telegram_link'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    columns = {c['name'] for c in sa.inspect(bind).get_columns('application')}
    if 'address' not in columns:
        op.add_column('application', sa.Column('address', sa.Text()))
    if 'delivery_details' not in columns:
        op.add_column('application', sa.Column('delivery_details', sa.JSON()))
    if 'address' not in {c['name'] for c in sa.inspect(bind).get_columns('resources')}:
        op.add_column('resources', sa.Column('address', sa.Text()))
    if 'quantity_promised' in {c['name'] for c in sa.inspect(bind).get_columns('contributions')}:
        op.drop_constraint('ck_contribution_quantities', 'contributions', type_='check')
        op.drop_constraint('ck_contribution_status', 'contributions', type_='check')
        op.execute("UPDATE contributions SET status = CASE WHEN quantity_delivered > 0 THEN 'delivered' ELSE 'cancelled' END WHERE status = 'promised'")
        op.drop_column('contributions', 'quantity_promised')
        op.alter_column('contributions', 'status', server_default='delivered')
        op.create_check_constraint('ck_contribution_quantities', 'contributions', 'quantity_delivered >= 0')
        op.create_check_constraint('ck_contribution_status', 'contributions', "status IN ('delivered', 'cancelled')")


def downgrade():
    # Delivered quantities are authoritative; removed promises cannot be restored.
    raise RuntimeError('This migration cannot reconstruct removed promise quantities.')
