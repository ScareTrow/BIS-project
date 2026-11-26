"""Normalize escaped descriptions and close requests with confirmed help."""
import html
import re

from alembic import op
import sqlalchemy as sa

revision = '20261126_application_cleanup'
down_revision = '20261119_resource_review'
branch_labels = None
depends_on = None

escaped = re.compile(r'&(?:amp|lt|gt|quot|#x27);')


def upgrade():
    connection = op.get_bind()
    table = sa.table('application', sa.column('id', sa.Integer), sa.column('description', sa.String))
    last_id = 0
    while True:
        rows = connection.execute(
            sa.select(table.c.id, table.c.description)
            .where(table.c.id > last_id, table.c.description.contains('&'))
            .order_by(table.c.id)
            .limit(1000)
        ).all()
        if not rows:
            break
        for app_id, description in rows:
            decoded = escaped.sub(lambda match: html.unescape(match[0]), description)
            if decoded != description:
                connection.execute(table.update().where(table.c.id == app_id).values(description=decoded))
        last_id = rows[-1].id

    connection.execute(sa.text("""
        UPDATE application
        SET is_resolved = TRUE, status = 'completed', resolved_at = CURRENT_TIMESTAMP
        WHERE is_resolved = FALSE AND is_false_call = FALSE AND moderation_status = 'APPROVED'
          AND EXISTS (
            SELECT 1 FROM application_response
            WHERE application_id = application.id AND status = 'COMPLETED'
          )
          AND NOT EXISTS (
            SELECT 1 FROM application_response
            WHERE application_id = application.id AND status = 'ACCEPTED'
          )
    """))


def downgrade():
    # Re-escape text for old clients. Retain confirmed resolutions and their timestamps.
    op.execute(sa.text("""
        UPDATE application SET description =
        replace(replace(replace(replace(replace(description, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), chr(39), '&#x27;')
    """))
