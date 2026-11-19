"""Production-route contracts used by the restored Next.js client."""
from backend.tests.request_helpers import png_bytes
import io
import json
from backend.website import db
from backend.website.models import User

PASSWORD = 'Asar8!River2'
PNG = png_bytes()


def sign_in(client, email, password=PASSWORD):
    response = client.post('/api/auth/login', json={'email': email, 'password': password})
    assert response.status_code == 200, response.json


def test_request_moderation_response_and_rating(app, client, test_user, admin_user):
    with app.app_context():
        db.session.get(User, test_user.id).social_links = json.dumps({'phone': '+77005550100'})
        db.session.commit()
    helper = app.test_client()
    response = helper.post('/api/auth/signup', json={
        'email': 'helper-flow@example.com', 'firstName': 'Helper',
        'password1': PASSWORD, 'password2': PASSWORD,
        'phone': '+77005550101', 'city': 'Almaty',
    })
    assert response.status_code == 200
    helper_id = response.json['user']['id']
    sign_in(helper, 'helper-flow@example.com')
    sign_in(client, test_user.email)
    assert client.post('/api/profile/edit', data={'city': 'Almaty'}).status_code == 200
    response = client.post('/api/applications', data={
        'latitude': '43.22', 'longitude': '76.85', 'category': 'food',
        'description': 'Food request from a full workflow',
        'media_files': (io.BytesIO(PNG), 'proof.png'),
    })
    assert response.status_code == 201, response.json
    application_id = response.json['id']
    application_ref = response.json['public_id']
    admin = app.test_client()
    sign_in(admin, admin_user.email, 'Admin1234!@#$')
    assert client.post(f'/api/admin/applications/{application_id}/approve').status_code == 403
    assert admin.post(f'/api/admin/applications/{application_id}/approve').status_code == 200
    points = client.get('/api/map/points').json
    assert any(p['id'] == application_id for p in points)
    response = helper.post(f'/api/applications/{application_id}/respond')
    assert response.status_code == 200, response.json
    response_id = response.json['response_id']
    assert 'author_contact' not in helper.get(f'/api/applications/{application_ref}').json
    assert 'email' not in helper.get(f'/api/users/{test_user.id}').json
    assert client.post(f'/api/applications/{application_id}/responses/{response_id}/accept').status_code == 200
    assert helper.get(f'/api/applications/{application_ref}').json['author_contact'] == {'phone': '+77005550100'}
    assert 'author_contact' not in app.test_client().get(f'/api/applications/{application_ref}').json
    assert client.post(f'/api/applications/{application_id}/resolve').status_code == 200
    rating = client.post(f'/api/applications/{application_id}/rate-volunteer-simple',
                         json={'helper_id': helper_id, 'is_positive': True})
    assert rating.status_code == 200, rating.json
    assert helper.get('/api/notifications').json['unread_count'] > 0
    assert helper.post('/api/notifications/read-all').status_code == 200
    assert helper.get('/api/notifications').json['unread_count'] == 0
    assert client.get('/api/search?q=Food').status_code == 200


def test_news_lifecycle_and_profile(app, client, test_user, admin_user):
    sign_in(client, admin_user.email, 'Admin1234!@#$')
    created = client.post('/api/admin/news', json={
        'title': 'ASAR test news', 'content': 'Verified news content',
        'news_type': 'general', 'is_published': True,
    })
    assert created.status_code in (200, 201), created.json
    news_id = created.json['news']['id']
    guest = app.test_client()
    assert guest.get(f'/api/news/{news_id}').json['title'] == 'ASAR test news'
    assert guest.get('/api/news').json['total'] == 1
    assert client.put(f'/api/admin/news/{news_id}', json={'is_published': False}).status_code == 200
    assert guest.get(f'/api/news/{news_id}').status_code == 404
    assert client.delete(f'/api/admin/news/{news_id}').status_code == 200
    sign_in(guest, test_user.email)
    assert guest.post('/api/admin/news', json={'title': 'Forbidden'}).status_code == 403
    profile = guest.post('/api/profile/edit', data={'first_name': 'Updated', 'city': 'Almaty'})
    assert profile.status_code == 200, profile.json
    assert guest.get('/api/user/current').json['user']['first_name'] == 'Updated'
