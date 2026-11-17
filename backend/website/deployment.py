"""Deployment entry points for a single Render web service."""
import os
import click
from flask import jsonify
from flask_migrate import stamp, upgrade
from sqlalchemy import inspect, text

from . import db


def register_deployment(app):
    @app.get('/api/health')
    def health():
        try:
            db.session.execute(text('SELECT 1'))
        except Exception:
            db.session.rollback()
            return jsonify(status='unavailable'), 503
        return jsonify(status='ok')

    @app.cli.command('prepare-deploy')
    def prepare_deploy():
        """Bootstrap a new database, or migrate an already versioned database."""
        existing = set(inspect(db.engine).get_table_names())
        application_tables = set(db.metadata.tables)
        if not existing.intersection(application_tables):
            # The historical initial migration modifies tables from the old app;
            # it cannot create an empty database. A fresh install uses the full
            # current metadata and records that baseline before later upgrades.
            db.create_all()
            stamp()
            click.echo('Created application schema at the current migration head.')
        elif 'alembic_version' not in existing:
            raise click.ClickException('Existing unversioned application tables require an explicit migration baseline.')
        else:
            upgrade()
            click.echo('Application migrations applied.')
        if db.engine.dialect.name == 'postgresql':
            # Access goes through Flask. Keep these tables closed to Data API
            # roles even if Data API is subsequently enabled in the dashboard.
            with db.engine.begin() as connection:
                for name in application_tables:
                    quoted = db.engine.dialect.identifier_preparer.quote(name)
                    connection.execute(text(f'ALTER TABLE {quoted} ENABLE ROW LEVEL SECURITY'))

    @app.cli.command('set-telegram-webhook')
    def set_telegram_webhook():
        import requests
        base_url = os.getenv('RENDER_EXTERNAL_URL', '').rstrip('/')
        token = app.config['TELEGRAM_BOT_TOKEN']
        secret = app.config['TELEGRAM_WEBHOOK_SECRET']
        if not base_url:
            click.echo('Webhook registration skipped until RENDER_EXTERNAL_URL is available.')
            return
        if not token or not secret:
            raise click.ClickException('Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET.')
        try:
            response = requests.post(f'https://api.telegram.org/bot{token}/setWebhook',
                json={'url': base_url + '/api/telegram/webhook', 'secret_token': secret,
                      'max_connections': 1, 'allowed_updates': ['message', 'callback_query']}, timeout=20)
            success = response.ok and response.json().get('ok')
        except (requests.RequestException, ValueError):
            success = False
        if not success:
            raise click.ClickException('Telegram webhook registration failed; check the bot configuration.')
        click.echo('Telegram webhook registered.')

    from backend.telegram_bot.webhook import register_webhook
    register_webhook(app)
