"""Address search, delivery routes and promise-free migration on PostgreSQL."""
from unittest.mock import Mock

import pytest
from sqlalchemy import inspect, text
from flask_migrate import stamp

from backend.tests.request_helpers import post_request
from backend.website import db
from backend.website import geocoding
from backend.website.models import Application, ApplicationCategory, Resource
from backend.tests.test_mutual_aid import login

ROUTE = {
    'pickup': dict(address='Алматы, Абая 10', entrance='Вход со двора', latitude=43.23, longitude=76.91),
    'dropoff': dict(address='Алматы, Сатпаева 20', entrance='Подъезд 2', latitude=43.22, longitude=76.92),
}


def test_address_search_auth_validation_and_shared_cache(app, client, test_user, monkeypatch):
    geocoding._cache.clear()
    assert client.post('/api/locations/search', json={'query': 'Абая 10'}).status_code == 401
    login(client, test_user)
    for body in ([1], {'query': 'ab'}, {'query': 'a' * 201}, {'query': 'Абая', 'city': 3}):
        assert client.post('/api/locations/search', json=body).status_code == 400
    response = Mock()
    response.json.return_value = [dict(display_name='Алматы, Абая 10', lat='43.23', lon='76.91')]
    get = Mock(return_value=response)
    monkeypatch.setattr(geocoding.requests, 'get', get)
    for _ in range(2):
        result = client.post('/api/locations/search', json={'query': 'Абая 10', 'city': 'Алматы'})
        assert result.status_code == 200
        assert result.json[0]['latitude'] == 43.23
    assert get.call_count == 1
    assert get.call_args.kwargs['params']['countrycodes'] == 'kz'
    assert 'ASAR' in get.call_args.kwargs['headers']['User-Agent']
    geocoding._cache.clear()


def test_geocoder_throttles_different_lookups_and_reports_outage(app, monkeypatch):
    import requests
    geocoding._cache.clear()
    monkeypatch.setattr(geocoding, '_last_request', 10.0)
    monkeypatch.setattr(geocoding.time, 'monotonic', lambda: 10.2)
    sleep = Mock()
    monkeypatch.setattr(geocoding.time, 'sleep', sleep)
    monkeypatch.setattr(geocoding.requests, 'get', Mock(side_effect=requests.Timeout))
    from werkzeug.exceptions import ServiceUnavailable
    with app.app_context(), pytest.raises(ServiceUnavailable):
        geocoding.lookup('search', q='Новый адрес')
    assert sleep.call_args.args[0] == pytest.approx(0.8)


def test_delivery_persists_both_locations_and_uses_destination(app, client, test_user):
    login(client, test_user)
    result = post_request(client, dict(description='Нужно забрать и доставить продукты', city='Алматы',
        category='delivery', delivery_details=ROUTE))
    assert result.status_code == 201, result.json
    detail = client.get(f"/api/applications/{result.json['id']}").json
    assert detail['delivery_details'] == ROUTE
    assert detail['address'] == ROUTE['dropoff']['address']
    assert detail['latitude'] == ROUTE['dropoff']['latitude']
    assert not detail['needed_help']


@pytest.mark.parametrize('bad', [None, {}, {'pickup': ROUTE['pickup']},
    {**ROUTE, 'dropoff': {**ROUTE['dropoff'], 'latitude': 100}},
    {**ROUTE, 'pickup': {**ROUTE['pickup'], 'entrance': 'x' * 201}}])
def test_delivery_rejects_incomplete_or_invalid_route(app, client, test_user, bad):
    login(client, test_user)
    result = post_request(client, dict(description='Нужно забрать и доставить продукты', city='Алматы',
        category='delivery', delivery_details=bad))
    assert result.status_code == 400
    with app.app_context():
        assert Application.query.count() == 0


def test_resources_filter_by_type_and_preserve_address(app, client, test_user):
    login(client, test_user)
    for category in ('medicine', 'food', 'shelter'):
        response = client.post('/api/resources', json=dict(name=category, city='Алматы', category=category,
            latitude=43.22, longitude=76.91, address='Абая 10'))
        assert response.status_code == 201
    filtered = client.get('/api/resources?category=medicine')
    assert [r['category'] for r in filtered.json] == ['medicine']
    assert filtered.json[0]['address'] == 'Абая 10'
    assert len(client.get('/api/resources').json) == 3
    assert client.get('/api/resources?category=invalid').status_code == 400


def test_delivery_migration_preserves_delivered_quantities_and_existing_requests(app, test_application, test_response):
    # Recreate the previous contribution columns and checks in this disposable database.
    with app.app_context():
        db.session.execute(text('ALTER TABLE contributions DROP CONSTRAINT ck_contribution_quantities'))
        db.session.execute(text('ALTER TABLE contributions DROP CONSTRAINT ck_contribution_status'))
        db.session.execute(text('ALTER TABLE contributions ADD COLUMN quantity_promised NUMERIC(12,3) NOT NULL DEFAULT 1'))
        db.session.execute(text("ALTER TABLE contributions ADD CONSTRAINT ck_contribution_status CHECK (status IN ('promised','delivered','cancelled'))"))
        db.session.execute(text('ALTER TABLE contributions ADD CONSTRAINT ck_contribution_quantities CHECK (quantity_promised > 0 AND quantity_delivered >= 0 AND quantity_delivered <= quantity_promised)'))
        db.session.execute(text('ALTER TABLE application DROP COLUMN address'))
        db.session.execute(text('ALTER TABLE application DROP COLUMN delivery_details'))
        db.session.execute(text('ALTER TABLE resources DROP COLUMN address'))
        params = dict(a=test_application.id, r=test_response[0].id)
        nid = db.session.execute(text("INSERT INTO application_needs (application_id,resource_name,unit,quantity_needed) VALUES (:a,'Вода','л',10) RETURNING id"), params).scalar()
        db.session.execute(text("INSERT INTO contributions (application_id,need_id,response_id,quantity_promised,quantity_delivered,status,created_at,updated_at) VALUES (:a,:n,:r,5,2,'promised',now(),now())"), {**params, 'n': nid})
        db.session.commit()
        stamp(revision='20261117_telegram_link')
    try:
        result = app.test_cli_runner().invoke(args=['prepare-deploy'])
        assert result.exit_code == 0, result.output
        with app.app_context():
            assert 'quantity_promised' not in {c['name'] for c in inspect(db.engine).get_columns('contributions')}
            row = db.session.execute(text('SELECT quantity_delivered,status FROM contributions')).one()
            assert row.quantity_delivered == 2 and row.status == 'delivered'
            assert db.session.get(Application, test_application.id).description == test_application.description
            assert db.session.get(Application, test_application.id).delivery_details is None
    finally:
        with app.app_context():
            db.session.execute(text('DROP TABLE IF EXISTS alembic_version'))
            db.session.commit()
