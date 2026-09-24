import io
import pytest
from backend.website import db
from backend.website.models import Application


def login(client, user):
    result = client.post('/api/auth/login', json={
        'email': user.email, 'password': 'Asar8!River2',
    })
    assert result.status_code == 200


def test_anonymous_api_is_json_not_html_redirect(client):
    response = client.get('/api/user/current')
    assert response.status_code == 401
    assert response.is_json


def test_cors_credential_preflight(client):
    response = client.options('/api/applications', headers={
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
    })
    assert response.headers['Access-Control-Allow-Origin'] == 'http://localhost:3000'
    assert response.headers['Access-Control-Allow-Credentials'] == 'true'
    foreign = client.options('/api/applications', headers={
        'Origin': 'https://untrusted.example',
        'Access-Control-Request-Method': 'POST',
    })
    assert 'Access-Control-Allow-Origin' not in foreign.headers


@pytest.mark.parametrize('path', ['/api/sos', '/api/applications'])
@pytest.mark.parametrize('latitude', ['bad', [], True, float('nan'), 91])
def test_invalid_coordinates_are_client_errors(client, test_user, path, latitude):
    login(client, test_user)
    response = client.post(path, json={
        'latitude': latitude, 'longitude': 76.85,
        'category': 'food', 'description': 'Contract test',
    })
    assert response.status_code == 400
    assert response.is_json


@pytest.mark.parametrize('filename,content', [('empty.jpg', b''), ('payload.html', b'<script>alert(1)</script>')])
def test_invalid_upload_has_no_database_or_file_side_effects(client, test_user, filename, content):
    login(client, test_user)
    response = client.post('/api/applications', data={
        'latitude': '43.22', 'longitude': '76.85',
        'category': 'food', 'description': 'Upload regression',
        'media_files': (io.BytesIO(content), filename),
    })
    assert response.status_code == 400
    with client.application.app_context():
        assert Application.query.count() == 0
    from pathlib import Path
    assert list(Path(client.application.config['UPLOAD_FOLDER']).iterdir()) == []


def test_request_limit_returns_json_413(client, test_user):
    login(client, test_user)
    client.application.config['MAX_CONTENT_LENGTH'] = 1024
    response = client.post('/api/applications', data={
        'media_files': (io.BytesIO(b'x' * 2048), 'large.jpg'),
    })
    assert response.status_code == 413
    assert response.is_json


def test_map_contract_uses_latitude_longitude(client, test_application):
    response = client.get('/api/map/points')
    assert response.status_code == 200
    point = next(item for item in response.json if item['id'] == test_application.id)
    assert point['latitude'] == 43.2220
    assert point['longitude'] == 76.8512
