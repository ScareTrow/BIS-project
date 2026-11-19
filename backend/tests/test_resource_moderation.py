import io

from backend.tests.request_helpers import png_bytes
from backend.tests.test_mutual_aid import login


def test_resource_photo_and_publication_require_review(app, client, test_user, admin_user):
    login(client, test_user)
    guest = app.test_client()
    moderator = app.test_client()
    login(moderator, admin_user, 'Admin1234!@#$')
    fields = dict(name='Water point', latitude='43.22', longitude='76.85', category='food')
    assert client.post('/api/resources', data={
        **fields, 'media_files': (io.BytesIO(b'invalid'), 'proof.png'),
    }).status_code == 415
    created = client.post('/api/resources', data={
        **fields, 'media_files': (io.BytesIO(png_bytes()), 'proof.png'),
    })
    assert created.status_code == 201
    resource = created.json
    assert resource['moderation_status'] == 'pending'
    photo = resource['photos'][0]
    endpoint = f"/api/admin/resources/{resource['id']}/review"
    assert guest.get('/api/resources').json == []
    assert guest.get(photo).status_code == 404
    assert client.get(photo).mimetype == 'image/png'
    assert moderator.get(photo).mimetype == 'image/png'
    assert client.get('/api/admin/resources').status_code == 403
    assert client.post(endpoint, json={'decision': 'approved'}).status_code == 403
    assert moderator.get('/api/admin/resources').json[0]['id'] == resource['id']
    assert moderator.post(endpoint, json={'decision': 'approved'}).status_code == 200
    assert guest.get('/api/resources').json[0]['id'] == resource['id']
    assert guest.get(photo).mimetype == 'image/png'
    assert moderator.post(endpoint, json={'decision': 'approved'}).status_code == 409


def test_rejection_reason_is_visible_to_author(app, client, test_user, admin_user):
    login(client, test_user)
    resource = client.post('/api/resources', json=dict(name='Water point', latitude=43.22, longitude=76.85)).json
    moderator = app.test_client()
    login(moderator, admin_user, 'Admin1234!@#$')
    endpoint = f"/api/admin/resources/{resource['id']}/review"
    assert moderator.post(endpoint, json={'decision': 'rejected'}).status_code == 400
    assert moderator.post(endpoint, json={'decision': 'rejected', 'reason': 'Incorrect address'}).status_code == 200
    assert app.test_client().get('/api/resources').json == []
    assert client.get('/api/resources/mine').json[0]['rejection_reason'] == 'Incorrect address'
