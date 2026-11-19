"""Regression cases reported during the mobile demo on 18 November."""
import pytest
from backend.website import db
from backend.website.models import Application, ApplicationCategory, ModerationStatus, Resource
from backend.tests.request_helpers import post_request
from backend.tests.test_mutual_aid import login


def test_quick_sos_requires_photo_and_coordinates_and_keeps_rate_limit(app, client, test_user):
    login(client, test_user)
    fields = dict(latitude=43.22, longitude=76.85)
    assert client.post('/api/sos', json=fields).status_code == 400
    for _ in range(3):
        result = post_request(client, fields, path='/api/sos')
        assert result.status_code == 201, result.json
        with app.app_context():
            made = db.session.get(Application, result.json['id'])
            assert made.is_sos and made.moderation_status == ModerationStatus.APPROVED
            assert made.city == 'Алматы'
    assert post_request(client, fields, path='/api/sos').status_code == 429
    assert post_request(client, dict(description='Обычная помощь нужна',latitude=43.22,longitude=76.85), path='/api/applications').status_code == 201


def test_profile_city_limits_feeds_and_aliases_keep_approved_requests_visible(app, client, test_user, admin_user):
    login(client, test_user)
    with app.app_context():
        rows=[]
        for city in ('Алматы','Almaty','Астана'):
            row=Application(description='Нужна помощь продуктами',user_id=test_user.id,category=ApplicationCategory.FOOD,
                city=city,latitude=43.22,longitude=76.85,moderation_status=ModerationStatus.PENDING)
            db.session.add(row);rows.append(row)
        db.session.commit()
        ids=[r.id for r in rows]
    admin=app.test_client();login(admin,admin_user,'Admin1234!@#$')
    for aid in ids: assert admin.post(f'/api/admin/applications/{aid}/approve').status_code==200
    for endpoint in ('/api/map/points','/api/applications/list'):
        assert {a['id'] for a in client.get(endpoint).json}==set(ids[:2])
        assert {a['id'] for a in client.get(endpoint+'?city=all').json}==set(ids[:2])
    assert {a['id'] for a in client.get('/api/search?q=помощь&type=applications').json['applications']}==set(ids[:2])
    guest=app.test_client()
    assert {a['id'] for a in guest.get('/api/applications/list?city=Almaty').json}==set(ids[:2])


def test_request_uses_profile_city_without_reentry(app,client,test_user):
    login(client,test_user)
    result=post_request(client,dict(description='Нужна помощь продуктами',latitude=43.22,longitude=76.85))
    assert result.status_code==201
    with app.app_context(): assert db.session.get(Application,result.json['id']).city=='Алматы'


def test_public_request_reference_respects_moderation_and_resolves_after_approval(app, client, test_user, admin_user):
    login(client, test_user)
    created = post_request(client, dict(description='Нужна помощь продуктами', latitude=43.22, longitude=76.85))
    assert created.status_code == 201
    ref = created.json['public_id']
    endpoint = f'/api/applications/{ref}'
    guest = app.test_client()
    assert guest.get(endpoint).status_code == 404
    assert client.get(endpoint).json['public_id'] == ref
    admin = app.test_client()
    login(admin, admin_user, 'Admin1234!@#$')
    assert admin.post(f'/api/admin/applications/{ref}/approve').status_code == 200
    assert guest.get(endpoint).json['public_id'] == ref


def test_capability_onboarding_is_claimed_once(client, test_user):
    login(client, test_user)
    path = '/api/user/capabilities/onboarding'
    assert client.post(path).json == {'show': True}
    assert client.post(path).json == {'show': False}
    assert client.get('/api/user/current').json['user']['capability_onboarding_seen'] is True


@pytest.mark.parametrize('password',['RiverStone','riverston8','RIVERSTON8','RiverStone8'])
def test_signup_accepts_three_conditions_and_returns_region(client,password):
    result=client.post('/api/auth/signup',json=dict(email='demo@example.com',firstName='Мирас',
        password1=password,password2=password,phone='+77771234567',city='Almaty'))
    assert result.status_code==200,result.json
    assert result.json['user']['city']=='Алматы'


def test_address_search_defaults_to_profile_region_and_uses_short_label(client,test_user,monkeypatch):
    login(client,test_user)
    calls=[]
    def lookup(path,**params):
        calls.append(params)
        return [dict(name='MEGA', display_name='MEGA, улица Розыбакиева, Алматы, Бостандыкский район, 050060, Казахстан',
            address=dict(road='улица Розыбакиева',house_number='247А',postcode='050060',suburb='Бостандыкский район'),lat='43.2',lon='76.9')]
    monkeypatch.setattr('backend.website.geocoding.lookup',lookup)
    result=client.post('/api/locations/search',json={'query':'Мега'})
    assert result.status_code==200
    assert result.json[0]['address']=='MEGA, улица Розыбакиева, 247А'
    assert calls[0]['q']=='Мега, Алматы'


def test_resources_and_stats_share_the_profile_region(app,client,test_user):
    with app.app_context():
        for city in ('Алматы','Almaty','Астана'):
            db.session.add(Resource(owner_id=test_user.id,name='Вода',category='food',city=city,latitude=43.22,longitude=76.85))
        db.session.commit()
    login(client,test_user)
    assert len(client.get('/api/resources?city=all').json)==2
    result=client.post('/api/resources',json=dict(name='Продукты',category='food',latitude=43.22,longitude=76.85))
    assert result.status_code==201 and result.json['city']=='Алматы'
    assert client.get('/api/stats/regional').json['city']=='Алматы'
