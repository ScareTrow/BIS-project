"""P0 regression tests from QA_REPORT.md (T-01..T-10).

Tests marked ``xfail(strict=True)`` document defects that exist today. When a
defect is fixed the test XPASSes, which fails the run as a reminder to drop
the marker. Bug IDs refer to section 2 of QA_REPORT.md.
"""

import io
import os
import threading
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from werkzeug.security import generate_password_hash

from backend.website import db, create_app
from backend.website.models import (
    User,
    Application,
    ApplicationCategory,
    ApplicationMedia,
    ApplicationResponse,
    ModerationStatus,
    Notification,
    ResponseStatus,
    VolunteerPreference,
    ApplicationNeed,
    Contribution,
)

PASSWORD = "Asar8!River2"
ON_POSTGRES = os.getenv("ASAR_TEST_DATABASE_URL", "").startswith("postgresql")


def make_user(app, email, **fields):
    with app.app_context():
        user = User(
            email=email,
            password=generate_password_hash(PASSWORD),
            first_name=fields.pop("first_name", "Qa"),
            city=fields.pop("city", "Almaty"),
            **fields,
        )
        db.session.add(user)
        db.session.commit()
        db.session.refresh(user)
        return user


def make_application(app, user, **fields):
    with app.app_context():
        application = Application(
            description=fields.pop("description", "Нужна помощь продуктами"),
            latitude=43.2220,
            longitude=76.8512,
            category=fields.pop("category", ApplicationCategory.FOOD),
            user_id=user.id,
            moderation_status=fields.pop("moderation_status", ModerationStatus.APPROVED),
            city="Almaty",
            **fields,
        )
        db.session.add(application)
        db.session.commit()
        db.session.refresh(application)
        return application


def login(app, user, password=PASSWORD):
    client = app.test_client()
    response = client.post("/api/auth/login", json={"email": user.email, "password": password})
    assert response.status_code == 200
    return client


# T-01 -----------------------------------------------------------------------

@pytest.mark.security
@pytest.mark.xfail(strict=True, reason="SEC-01: /auth/telegram logs in by bare telegram_id")
def test_telegram_id_alone_does_not_create_session(app):
    make_user(app, "victim@example.com", telegram_id="111111")
    attacker = app.test_client()

    attacker.get("/auth/telegram?telegram_id=111111")

    assert attacker.get("/api/user/current").status_code == 401


# T-02 -----------------------------------------------------------------------

@pytest.mark.security
@pytest.mark.xfail(strict=True, reason="SEC-02: any telegram_id is linked without proof of ownership")
def test_link_telegram_requires_proof_of_ownership(app, test_user):
    client = login(app, test_user)

    response = client.post("/api/link-telegram", json={"telegram_id": "222222"})

    assert response.status_code in (400, 403)
    with app.app_context():
        assert db.session.get(User, test_user.id).telegram_id is None


@pytest.mark.security
@pytest.mark.xfail(strict=True, reason="SEC-02: signup binds a client-supplied telegram_id")
def test_signup_ignores_client_supplied_telegram_id(app, client):
    response = client.post("/api/auth/signup", json={
        "email": "newcomer@example.com", "firstName": "New", "lastName": "User",
        "password1": PASSWORD, "password2": PASSWORD,
        "phone": "+77001234567", "city": "Almaty", "telegram_id": "333333",
    })

    assert response.status_code == 200
    with app.app_context():
        assert User.query.filter_by(email="newcomer@example.com").one().telegram_id is None


# T-03 -----------------------------------------------------------------------

@pytest.mark.security
@pytest.mark.xfail(strict=True, reason="SEC-03: SECRET_KEY falls back to 'default_secret'")
def test_app_refuses_to_start_without_secret_key(monkeypatch, tmp_path):
    monkeypatch.delenv("SECRET_KEY", raising=False)

    with pytest.raises(Exception):
        create_app({
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "UPLOAD_FOLDER": str(tmp_path / "uploads"),
            "AUTO_CREATE_DATABASE": False,
        })


# T-04 -----------------------------------------------------------------------

@pytest.mark.security
@pytest.mark.xfail(strict=True, reason="SEC-04: public profile exposes email, phone and hidden city")
def test_public_profile_hides_personal_data(app, client):
    user = make_user(
        app, "private@example.com",
        city_hidden=True, social_links='{"phone": "+77007654321"}',
    )

    data = client.get(f"/api/users/{user.id}").get_json()

    assert "email" not in data
    assert "+77007654321" not in str(data.get("social_links"))
    assert data.get("city") is None


@pytest.mark.security
@pytest.mark.xfail(strict=True, reason="SEC-04: anonymous user search returns email addresses")
def test_anonymous_user_search_hides_email(app, client):
    make_user(app, "findme@example.com", first_name="Findme")

    users = client.get("/api/search?q=Findme&type=users").get_json()["users"]

    assert users
    assert all("email" not in u for u in users)


# T-05 -----------------------------------------------------------------------

@pytest.mark.security
@pytest.mark.xfail(strict=True, reason="SEC-05: rate-helper accepts any helper_id")
def test_rate_helper_rejects_user_who_never_responded(app, test_user):
    stranger = make_user(app, "stranger@example.com")
    application = make_application(app, test_user, is_resolved=True)
    author = login(app, test_user)

    response = author.post(
        f"/api/applications/{application.id}/rate-helper",
        json={"helper_id": stranger.id, "rating_value": 1},
    )

    assert response.status_code in (400, 403, 409)


@pytest.mark.security
@pytest.mark.xfail(strict=True, reason="SEC-05: fake 1-star ratings block the victim's SOS")
def test_fake_ratings_cannot_disable_victims_sos(app, test_user):
    victim = make_user(app, "sos-victim@example.com")
    attacker = login(app, test_user)
    for _ in range(4):
        application = make_application(app, test_user, moderation_status=ModerationStatus.PENDING)
        attacker.post(
            f"/api/applications/{application.id}/rate-helper",
            json={"helper_id": victim.id, "rating_value": 1},
        )

    response = login(app, victim).post("/api/sos", json={"latitude": 43.2, "longitude": 76.9})

    assert response.status_code == 200


def test_simple_rating_still_requires_accepted_response(app, test_user):
    stranger = make_user(app, "simple-stranger@example.com")
    application = make_application(app, test_user, is_resolved=True)
    author = login(app, test_user)

    response = author.post(
        f"/api/applications/{application.id}/rate-volunteer-simple",
        json={"helper_id": stranger.id, "is_positive": False},
    )

    assert response.status_code == 400


# T-06 -----------------------------------------------------------------------

@pytest.mark.security
@pytest.mark.xfail(strict=True, reason="SEC-06: legacy /send-task stores any file extension")
def test_legacy_send_task_rejects_html_upload(app, test_user):
    client = login(app, test_user)

    client.post("/send-task", data={
        "latitude": "43.2", "longitude": "76.9", "category": "food",
        "description": "Нужна помощь продуктами",
        "media_files": (io.BytesIO(b"<script>alert(1)</script>"), "x.html"),
    }, content_type="multipart/form-data")

    with app.app_context():
        assert ApplicationMedia.query.filter(ApplicationMedia.file_path.like("%.html")).count() == 0


@pytest.mark.security
@pytest.mark.xfail(strict=True, reason="SEC-06: avatar upload accepts SVG/HTML")
def test_avatar_upload_rejects_svg(app, test_user):
    client = login(app, test_user)

    client.post("/api/profile/edit", data={
        "first_name": test_user.first_name, "last_name": test_user.last_name,
        "avatar": (io.BytesIO(b'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), "a.svg"),
    }, content_type="multipart/form-data")

    with app.app_context():
        assert db.session.get(User, test_user.id).avatar is None


def test_api_create_application_rejects_html_upload(app, test_user):
    client = login(app, test_user)

    response = client.post("/api/applications", data={
        "latitude": "43.2", "longitude": "76.9", "category": "food",
        "description": "Нужна помощь продуктами",
        "media_files": (io.BytesIO(b"<script>alert(1)</script>"), "x.html"),
    }, content_type="multipart/form-data")

    assert response.status_code == 400


@pytest.mark.security
@pytest.mark.xfail(strict=True, reason="SEC-06/SEC-09: uploads are served without nosniff")
def test_uploads_are_served_with_nosniff(app, test_user):
    application = make_application(app, test_user)
    with app.app_context():
        with open(os.path.join(app.config["UPLOAD_FOLDER"], "qa.jpg"), "wb") as f:
            f.write(b"\xff\xd8\xff\xe0 not really a jpeg")
        db.session.add(ApplicationMedia(application_id=application.id, file_path="qa.jpg", file_type="image/jpeg"))
        db.session.commit()

    response = app.test_client().get("/api/uploads/qa.jpg")

    assert response.status_code == 200
    assert response.headers.get("X-Content-Type-Options") == "nosniff"


# T-07 (PostgreSQL only: SQLite in-memory cannot exercise real concurrency) ---

def run_concurrently(*calls):
    barrier = threading.Barrier(len(calls))
    results = [None] * len(calls)

    def worker(i, call):
        barrier.wait()
        results[i] = call()

    threads = [threading.Thread(target=worker, args=(i, c)) for i, c in enumerate(calls)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return results


@pytest.mark.skipif(not ON_POSTGRES, reason="needs ASAR_TEST_DATABASE_URL (PostgreSQL *_test)")
def test_parallel_duplicate_response_creates_one_row(app, test_user):
    application = make_application(app, test_user)
    volunteer = make_user(app, "racer@example.com")
    first, second = login(app, volunteer), login(app, volunteer)
    url = f"/api/applications/{application.id}/respond"

    statuses = [r.status_code for r in run_concurrently(lambda: first.post(url), lambda: second.post(url))]

    assert 500 not in statuses
    with app.app_context():
        assert ApplicationResponse.query.filter_by(application_id=application.id).count() == 1


@pytest.mark.skipif(not ON_POSTGRES, reason="needs ASAR_TEST_DATABASE_URL (PostgreSQL *_test)")
def test_parallel_promises_never_exceed_need(app, test_user):
    application = make_application(app, test_user)
    volunteers = [make_user(app, f"promise{i}@example.com") for i in range(2)]
    with app.app_context():
        need = ApplicationNeed(application_id=application.id, resource_name="Вода", unit="л", quantity_needed=Decimal("10"))
        db.session.add(need)
        responses = [
            ApplicationResponse(application_id=application.id, responder_id=v.id, status=ResponseStatus.ACCEPTED)
            for v in volunteers
        ]
        db.session.add_all(responses)
        db.session.commit()
        need_id, response_ids = need.id, [r.id for r in responses]
    clients = [login(app, v) for v in volunteers]

    run_concurrently(*[
        (lambda c=c, rid=rid, qty=qty: c.put(
            f"/api/responses/{rid}/contributions", json={"need_id": need_id, "quantity_promised": qty}))
        for c, rid, qty in zip(clients, response_ids, (7, 5))
    ])

    with app.app_context():
        promised = sum(c.quantity_promised for c in Contribution.query.filter_by(need_id=need_id))
        assert promised <= Decimal("10")


# T-08 -----------------------------------------------------------------------

def test_resolved_application_rejects_new_responses(app, test_user):
    application = make_application(app, test_user)
    assert login(app, test_user).post(f"/api/applications/{application.id}/resolve").status_code == 200
    volunteer = login(app, make_user(app, "late@example.com"))

    response = volunteer.post(f"/api/applications/{application.id}/respond")

    assert response.status_code in (400, 409)


@pytest.mark.xfail(strict=True, reason="BUG-10: resolve can be repeated")
def test_resolve_twice_is_rejected(app, test_user):
    application = make_application(app, test_user)
    author = login(app, test_user)
    author.post(f"/api/applications/{application.id}/resolve")

    assert author.post(f"/api/applications/{application.id}/resolve").status_code == 409


@pytest.mark.xfail(strict=True, reason="BUG-10: author can mark a resolved application as false")
def test_mark_false_after_resolve_is_rejected(app, test_user):
    application = make_application(app, test_user)
    author = login(app, test_user)
    author.post(f"/api/applications/{application.id}/resolve")

    assert author.post(f"/api/applications/{application.id}/mark-false").status_code == 409


# T-09 -----------------------------------------------------------------------

def bot_message(latitude=43.2, longitude=76.9):
    message = MagicMock()
    message.location = MagicMock(latitude=latitude, longitude=longitude)
    message.chat.id = 123456789
    message.answer = AsyncMock()
    message.bot.delete_message = AsyncMock()
    return message


def bot_state(data):
    state = MagicMock()
    state.get_data = AsyncMock(return_value=data)
    state.clear = AsyncMock()
    return state


@pytest.fixture
def blocked_user(app):
    return make_user(
        app, "blocked-bot@example.com", telegram_id="444444", is_blocked=True,
        blocked_until=datetime.now(timezone.utc) + timedelta(days=7),
    )


@pytest.mark.telegram
@pytest.mark.asyncio
@pytest.mark.xfail(strict=True, reason="BUG-04: bot lets blocked users create requests")
async def test_bot_blocked_user_cannot_create_request(app, blocked_user):
    from backend.telegram_bot.handlers import common
    state = bot_state({"description": "Нужна помощь", "category": "food"})

    with patch.object(common, "require_auth", AsyncMock(return_value=blocked_user)), \
         patch.object(common, "create_app", return_value=app):
        await common.process_location(bot_message(), state)

    with app.app_context():
        assert Application.query.filter_by(user_id=blocked_user.id).count() == 0


@pytest.mark.telegram
@pytest.mark.asyncio
@pytest.mark.xfail(strict=True, reason="BUG-04: bot lets blocked users send SOS")
async def test_bot_blocked_user_cannot_send_sos(app, blocked_user):
    from backend.telegram_bot.handlers import common

    with patch.object(common, "require_auth", AsyncMock(return_value=blocked_user)), \
         patch.object(common, "create_app", return_value=app):
        await common.process_sos_location(bot_message(), bot_state({}))

    with app.app_context():
        assert Application.query.filter_by(user_id=blocked_user.id).count() == 0


# T-10 -----------------------------------------------------------------------

def test_repeated_approval_notifies_matching_volunteer_once(app, monkeypatch, test_user, admin_user):
    monkeypatch.setattr("backend.telegram_bot.config.Config.TELEGRAM_BOT_TOKEN", "test-token")
    volunteer = make_user(app, "matched@example.com", telegram_id="555555")
    with app.app_context():
        db.session.add(VolunteerPreference(user_id=volunteer.id, is_available=True))
        db.session.commit()
    application = make_application(app, test_user, moderation_status=ModerationStatus.PENDING)
    admin = login(app, admin_user, "Admin1234!@#$")

    with patch("backend.telegram_bot.utils.notifications.send_notification") as send:
        for _ in range(2):
            assert admin.post(f"/api/admin/applications/{application.id}/approve").status_code == 200

    assert [c.args[0] for c in send.call_args_list] == ["555555"]
    with app.app_context():
        assert Notification.query.filter_by(user_id=volunteer.id, notification_type="new_request").count() == 1


@pytest.mark.telegram
@pytest.mark.xfail(strict=True, reason="BUG-01: create_notification imports a non-existent bot object")
def test_create_notification_delivers_to_telegram(app):
    from backend.website.views import create_notification
    user = make_user(app, "tg-recipient@example.com", telegram_id="666666")

    with app.app_context(), \
         patch("backend.telegram_bot.utils.notifications.send_notification") as send:
        create_notification(user.id, "Оцените волонтера", "Тест", "rate_volunteer_reminder", send_telegram=True)

    assert send.called


@pytest.mark.xfail(strict=True, reason="Top-10 #6: no administrator alert when an SOS is created")
def test_sos_alerts_administrators(app, test_user, admin_user):
    response = login(app, test_user).post("/api/sos", json={"latitude": 43.2, "longitude": 76.9})

    assert response.status_code == 200
    with app.app_context():
        assert Notification.query.filter_by(user_id=admin_user.id).count() >= 1
