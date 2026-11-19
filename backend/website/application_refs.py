"""Resolve public request references while older links remain valid."""
from uuid import UUID

from flask_login import current_user
from sqlalchemy import or_
from werkzeug.exceptions import NotFound
from werkzeug.routing import BaseConverter, ValidationError


class ApplicationReference(BaseConverter):
    regex = r'(?:[0-9]{1,10}|[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12})'

    def to_python(self, value):
        if value.isdigit():
            number = int(value)
            if not 0 < number <= 2147483647:
                raise ValidationError()
            return number
        return UUID(value)


def register_application_references(app):
    from .models import Application, ModerationStatus
    app.url_map.converters['appref'] = ApplicationReference

    @app.url_value_preprocessor
    def resolve_application_reference(endpoint, values):
        reference = values.get('app_id') if values else None
        if isinstance(reference, UUID):
            query = Application.query.with_entities(Application.id).filter_by(public_id=reference)
            if not current_user.is_authenticated or not current_user.isAdmin:
                published = Application.moderation_status == ModerationStatus.APPROVED
                if current_user.is_authenticated:
                    published = or_(published, Application.user_id == current_user.id)
                query = query.filter(published)
            application = query.first()
            if application is None:
                raise NotFound()
            values['app_id'] = application.id
