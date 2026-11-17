"""QA suite: responses, request lifecycle, priority/anti-spam, notifications, moderation.

Covers five QA tasks (see QA_WORKFLOW_REPORT.md):

* RL  - one response per user per request.
* LC  - full request lifecycle and forbidden transitions.
* PR  - priority ordering and spam protection.
* NT  - notifications to requesters and volunteers.
* MD  - moderator permissions and status changes.

Defects are marked ``xfail(strict=True)``; they turn into XPASS (failing the
run) once fixed. Known defects already covered by test_qa_p0.py (BUG-03,
BUG-10, SEC-05) are referenced in the report, not duplicated here.

Updated after merging main (Nov 2026): requests need 1-3 JPEG/PNG photos,
SOS is published immediately (3 per hour), a moderator must give a reason to
reject, and nearby volunteers (10 km, linked Telegram) are notified.
"""

import io
import json
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from PIL import Image
from werkzeug.security import generate_password_hash

from backend.website import db
from backend.website.community_models import (
    ModerationAction,
    TriageRule,
    VolunteerPreference,
)
from backend.website.models import (
    Application,
    ApplicationCategory,
    ApplicationResponse,
    ModerationStatus,
    Notification,
    ResponseStatus,
    User,
)

PASSWORD = "Asar8!River2"
ALMATY = (43.238949, 76.889709)


# --------------------------------------------------------------------------- helpers

def make_user(app, email, **fields):
    with app.app_context():
        user = User(
            email=email,
            password=generate_password_hash(PASSWORD, method="pbkdf2:sha256"),
            first_name=fields.pop("first_name", email.split("@")[0]),
            city=fields.pop("city", "Алматы"),
            **fields,
        )
        db.session.add(user)
        db.session.commit()
        db.session.refresh(user)
        return user


def client_for(app, user):
    client = app.test_client()
    response = client.post("/api/auth/login", json={"email": user.email, "password": PASSWORD})
    assert response.status_code == 200, response.get_json()
    client.user = user
    return client


@pytest.fixture
def people(app):
    """Requester, two volunteers, an outsider, an admin and a super admin."""
    names = {
        "author": {},
        "vol1": {},
        "vol2": {},
        "outsider": {},
        "admin": {"isAdmin": True},
        "root": {"isAdmin": True, "is_super_admin": True},
    }
    return {name: client_for(app, make_user(app, f"{name}@example.test", **extra))
            for name, extra in names.items()}


def jpeg():
    buffer = io.BytesIO()
    Image.new("RGB", (8, 8), (200, 60, 60)).save(buffer, "JPEG")
    buffer.seek(0)
    return (buffer, "photo.jpg")


def submit(client, path="/api/applications", description="Нужна помощь продуктами", priority="normal", **extra):
    """Multipart request with one real JPEG, as the website form sends it."""
    data = {
        "description": description,
        "latitude": str(ALMATY[0]),
        "longitude": str(ALMATY[1]),
        "category": "food",
        "city": "Алматы",
        "priority": priority,
        "media_files": [jpeg()],
    }
    for key, value in extra.items():
        data[key] = json.dumps(value) if isinstance(value, (list, dict)) else str(value)
    return client.post(path, data=data, content_type="multipart/form-data")


def create(client, description="Нужна помощь продуктами", priority="normal", **extra):
    response = submit(client, description=description, priority=priority, **extra)
    assert response.status_code == 201, response.get_json()
    return response.get_json()["id"]


def sos(client):
    return submit(client, "/api/sos", description="SOS: нужна срочная помощь")


def approve(admin, app_id):
    response = admin.post(f"/api/admin/applications/{app_id}/approve", json={})
    assert response.status_code == 200, response.get_json()


def reject(admin, app_id, reason="Нарушение правил"):
    return admin.post(f"/api/admin/applications/{app_id}/reject", json={"reason": reason})


def respond(client, app_id):
    return client.post(f"/api/applications/{app_id}/respond")


def accept(client, app_id, response_id):
    return client.post(f"/api/applications/{app_id}/responses/{response_id}/accept")


def notifications(app, user, kind=None):
    with app.app_context():
        query = Notification.query.filter_by(user_id=user.id)
        if kind:
            query = query.filter_by(notification_type=kind)
        return query.all()


def kinds(app, user):
    return sorted(n.notification_type for n in notifications(app, user))


def status(app, model, row_id):
    with app.app_context():
        return db.session.get(model, row_id)


@pytest.fixture
def approved(app, people):
    app_id = create(people["author"])
    approve(people["admin"], app_id)
    return app_id


# --------------------------------------------------------------------------- RL: one response per user

class TestOneResponsePerUser:
    def test_first_response_accepted(self, app, people, approved):
        response = respond(people["vol1"], approved)
        assert response.status_code == 200
        with app.app_context():
            rows = ApplicationResponse.query.filter_by(application_id=approved).all()
            assert [(r.responder_id, r.status) for r in rows] == [(people["vol1"].user.id, ResponseStatus.PENDING)]

    def test_second_response_same_user_rejected(self, app, people, approved):
        assert respond(people["vol1"], approved).status_code == 200
        again = respond(people["vol1"], approved)
        assert again.status_code == 400
        assert again.get_json()["error"] == "Вы уже откликнулись на эту заявку"
        with app.app_context():
            assert ApplicationResponse.query.filter_by(application_id=approved).count() == 1

    def test_repeated_attempts_do_not_spam_author(self, app, people, approved):
        for _ in range(5):
            respond(people["vol1"], approved)
        assert len(notifications(app, people["author"].user, "new_response")) == 1

    def test_different_users_can_each_respond_once(self, app, people, approved):
        assert respond(people["vol1"], approved).status_code == 200
        assert respond(people["vol2"], approved).status_code == 200
        with app.app_context():
            assert ApplicationResponse.query.filter_by(application_id=approved).count() == 2

    def test_same_user_can_respond_to_different_requests(self, app, people, approved):
        second = create(people["author"], "Нужна доставка")
        approve(people["admin"], second)
        assert respond(people["vol1"], approved).status_code == 200
        assert respond(people["vol1"], second).status_code == 200

    def test_after_rejection_user_cannot_respond_again(self, app, people, approved):
        response_id = respond(people["vol1"], approved).get_json()["response_id"]
        people["author"].post(f"/api/applications/{approved}/responses/{response_id}/reject")
        again = respond(people["vol1"], approved)
        assert again.status_code == 400

    def test_database_constraint_blocks_duplicates(self, app, people, approved):
        from sqlalchemy.exc import IntegrityError
        respond(people["vol1"], approved)
        with app.app_context():
            db.session.add(ApplicationResponse(application_id=approved, responder_id=people["vol1"].user.id))
            with pytest.raises(IntegrityError):
                db.session.commit()
            db.session.rollback()

    def test_author_cannot_respond_to_own_request(self, people, approved):
        response = respond(people["author"], approved)
        assert response.status_code == 403  # was 400 before main

    @pytest.mark.parametrize("state", ["pending", "rejected", "resolved", "false_call"])
    def test_cannot_respond_to_inactive_request(self, app, people, state):
        app_id = create(people["author"])
        if state != "pending":
            approve(people["admin"], app_id)
        with app.app_context():
            row = db.session.get(Application, app_id)
            if state == "rejected":
                row.moderation_status = ModerationStatus.REJECTED
            if state == "resolved":
                row.is_resolved = True
            if state == "false_call":
                row.is_false_call = True
            db.session.commit()
        assert respond(people["vol1"], app_id).status_code == 400

    def test_anonymous_cannot_respond(self, app, approved):
        assert respond(app.test_client(), approved).status_code == 401

    def test_unknown_request_404(self, people):
        assert respond(people["vol1"], 999999).status_code == 404


# --------------------------------------------------------------------------- LC: lifecycle

class TestLifecycle:
    def test_full_lifecycle(self, app, people):
        author, vol, admin = people["author"], people["vol1"], people["admin"]

        app_id = create(author)
        assert status(app, Application, app_id).moderation_status == ModerationStatus.PENDING
        assert app_id not in [p["id"] for p in app.test_client().get("/api/map/points").get_json()]

        approve(admin, app_id)
        assert status(app, Application, app_id).moderation_status == ModerationStatus.APPROVED
        assert app_id in [p["id"] for p in app.test_client().get("/api/map/points").get_json()]

        response_id = respond(vol, app_id).get_json()["response_id"]
        assert status(app, ApplicationResponse, response_id).status == ResponseStatus.PENDING

        assert accept(author, app_id, response_id).status_code == 200
        assert status(app, ApplicationResponse, response_id).status == ResponseStatus.ACCEPTED

        assert author.post(f"/api/responses/{response_id}/complete").status_code == 200
        assert status(app, ApplicationResponse, response_id).status == ResponseStatus.COMPLETED

        rated = author.post(f"/api/responses/{response_id}/rating", json={"score": 5, "comment": "Спасибо"})
        assert rated.status_code == 201
        with app.app_context():
            helper = db.session.get(User, vol.user.id)
            assert (helper.rating_count, helper.rating_sum) == (1, 5)

        resolved = author.post(f"/api/applications/{app_id}/resolve")
        assert resolved.status_code == 200
        row = status(app, Application, app_id)
        assert row.is_resolved and row.resolved_at is not None
        assert app_id not in [p["id"] for p in app.test_client().get("/api/map/points").get_json()]

        detail = author.get(f"/api/applications/{app_id}").get_json()
        assert detail["is_resolved"] is True
        assert [r["status"] for r in detail["responses"]] == ["completed"]

    def test_resolve_moves_accepted_responses_to_completed(self, app, people, approved):
        response_id = respond(people["vol1"], approved).get_json()["response_id"]
        accept(people["author"], approved, response_id)
        people["author"].post(f"/api/applications/{approved}/resolve")
        assert status(app, ApplicationResponse, response_id).status == ResponseStatus.COMPLETED

    def test_reject_path(self, app, people):
        app_id = create(people["author"])
        assert reject(people["admin"], app_id, "дубль").status_code == 200
        assert status(app, Application, app_id).moderation_status == ModerationStatus.REJECTED
        assert respond(people["vol1"], app_id).status_code == 400
        assert people["author"].post(f"/api/applications/{app_id}/resolve").status_code == 409

    def test_rejected_volunteer_response(self, app, people, approved):
        response_id = respond(people["vol1"], approved).get_json()["response_id"]
        r = people["author"].post(f"/api/applications/{approved}/responses/{response_id}/reject")
        assert r.status_code == 200
        assert status(app, ApplicationResponse, response_id).status == ResponseStatus.CANCELLED
        assert accept(people["author"], approved, response_id).status_code == 409

    def test_cannot_complete_before_accept(self, people, approved):
        response_id = respond(people["vol1"], approved).get_json()["response_id"]
        assert people["author"].post(f"/api/responses/{response_id}/complete").status_code == 409

    def test_cannot_rate_before_complete(self, people, approved):
        response_id = respond(people["vol1"], approved).get_json()["response_id"]
        accept(people["author"], approved, response_id)
        r = people["author"].post(f"/api/responses/{response_id}/rating", json={"score": 5})
        assert r.status_code == 409

    @pytest.mark.parametrize("score", [0, 6, "5", True, None])
    def test_invalid_score(self, people, approved, score):
        response_id = respond(people["vol1"], approved).get_json()["response_id"]
        accept(people["author"], approved, response_id)
        people["author"].post(f"/api/responses/{response_id}/complete")
        r = people["author"].post(f"/api/responses/{response_id}/rating", json={"score": score})
        assert r.status_code == 400

    def test_cannot_rate_twice(self, people, approved):
        response_id = respond(people["vol1"], approved).get_json()["response_id"]
        accept(people["author"], approved, response_id)
        people["author"].post(f"/api/responses/{response_id}/complete")
        assert people["author"].post(f"/api/responses/{response_id}/rating", json={"score": 4}).status_code == 201
        assert people["author"].post(f"/api/responses/{response_id}/rating", json={"score": 1}).status_code == 409

    def test_only_author_drives_transitions(self, people, approved):
        response_id = respond(people["vol1"], approved).get_json()["response_id"]
        outsider, vol = people["outsider"], people["vol1"]
        assert accept(outsider, approved, response_id).status_code == 403
        assert accept(vol, approved, response_id).status_code == 403
        accept(people["author"], approved, response_id)
        assert vol.post(f"/api/responses/{response_id}/complete").status_code == 403
        assert outsider.post(f"/api/applications/{approved}/resolve").status_code == 403
        assert people["admin"].post(f"/api/applications/{approved}/resolve").status_code == 403

    def test_resolve_pending_request_refused(self, people):
        app_id = create(people["author"])
        assert people["author"].post(f"/api/applications/{app_id}/resolve").status_code == 409

    def test_resolve_with_undelivered_need_refused(self, app, people):
        app_id = create(people["author"], needs=[{"resource_name": "Вода", "unit": "л", "quantity_needed": 10}])
        approve(people["admin"], app_id)
        assert people["author"].post(f"/api/applications/{app_id}/resolve").status_code == 409

    def test_false_call_closes_request(self, app, people, approved):
        r = people["admin"].post(f"/api/admin/applications/{approved}/mark-false", json={"reason": "фейк"})
        assert r.status_code == 200
        row = status(app, Application, approved)
        assert row.is_false_call and row.is_resolved
        assert approved not in [p["id"] for p in app.test_client().get("/api/map/points").get_json()]

    @pytest.mark.xfail(strict=True, reason="WF-BUG-01: expired requests stay on the map and accept responses")
    def test_expired_request_leaves_map(self, app, people, approved):
        with app.app_context():
            db.session.get(Application, approved).expires_at = datetime.now(timezone.utc) - timedelta(days=1)
            db.session.commit()
        ids = [p["id"] for p in app.test_client().get("/api/map/points").get_json()]
        assert approved not in ids
        assert respond(people["vol1"], approved).status_code == 400

    @pytest.mark.xfail(strict=True, reason="WF-BUG-02: moderator can reject/approve an already resolved request")
    def test_moderation_of_closed_request_refused(self, app, people, approved):
        people["author"].post(f"/api/applications/{approved}/resolve")
        r = reject(people["admin"], approved)
        assert r.status_code == 409
        assert status(app, Application, approved).moderation_status == ModerationStatus.APPROVED


# --------------------------------------------------------------------------- PR: priority and anti-spam

class TestPriorityAndSpam:
    def list_ids(self, client):
        return [a["id"] for a in client.get("/api/applications/list").get_json()]

    def test_sos_and_priority_first_in_list(self, app, people):
        admin = people["admin"]
        normal_old = create(people["author"], "Обычная, старая")
        sos_id = create(people["author"], "SOS через форму", priority="sos")
        normal_new = create(people["author"], "Обычная, новая")
        high = create(people["author"], "Админ поднял приоритет")
        for app_id in (normal_old, sos_id, normal_new, high):
            approve(admin, app_id)
        assert admin.post(f"/api/admin/applications/{high}/set-priority", json={"priority": 3}).status_code == 200
        with app.app_context():
            for offset, app_id in enumerate((normal_old, sos_id, high, normal_new)):
                db.session.get(Application, app_id).date = datetime(2026, 11, 1, 10 + offset, tzinfo=timezone.utc)
            db.session.commit()

        ids = self.list_ids(app.test_client())
        assert ids == [sos_id, high, normal_new, normal_old]

    def test_list_exposes_priority_and_sos_flags(self, app, people):
        sos_id = create(people["author"], "SOS: нужна помощь", priority="sos")
        item = next(a for a in app.test_client().get("/api/applications/list").get_json() if a["id"] == sos_id)
        assert item["is_sos"] is True and item["priority"] == 5

    def test_web_sos_endpoint_sets_top_priority(self, app, people):
        r = sos(people["author"])
        assert r.status_code == 201, r.get_json()
        with app.app_context():
            row = Application.query.filter_by(is_sos=True).one()
            assert (row.priority, row.priority_source, row.moderation_status) == (5, "user_sos", ModerationStatus.APPROVED)

    def test_sos_published_immediately(self, app, people):
        # Changed in main; docs/scope-october-2026.md still says SOS is moderated (WF-OBS-06).
        app_id = sos(people["author"]).get_json()["id"]
        assert app_id in self.list_ids(app.test_client())

    def test_sos_requires_photo(self, people):
        r = people["author"].post("/api/sos", data={"latitude": "43.2", "longitude": "76.9"},
                                  content_type="multipart/form-data")
        assert r.status_code == 400

    @pytest.mark.parametrize("priority", ["high", "5", 5, "urgent", ""])
    def test_user_cannot_set_own_priority(self, app, people, priority):
        r = submit(people["author"], priority=priority)
        assert r.status_code == 400
        with app.app_context():
            assert Application.query.count() == 0

    @pytest.mark.parametrize("value", [-1, 6, "abc", None])
    def test_admin_priority_validated(self, people, approved, value):
        r = people["admin"].post(f"/api/admin/applications/{approved}/set-priority", json={"priority": value})
        assert r.status_code == 400

    def test_triage_raises_priority_but_not_over_admin(self, app, people):
        r = people["admin"].post("/api/admin/triage-rules", json={"keyword": "кровь", "priority": "high"})
        assert r.status_code in (200, 201), r.get_json()
        app_id = create(people["author"], "Нужна кровь для донорства")
        row = status(app, Application, app_id)
        assert (row.priority, row.priority_source) == (3, "auto")

    def test_blocked_user_cannot_create_or_sos(self, app, people):
        r = people["admin"].post(f"/api/admin/users/{people['author'].user.id}/block", json={"days": 7, "reason": "спам"})
        assert r.status_code == 200
        assert submit(people["author"]).status_code == 403
        assert sos(people["author"]).status_code == 403

    def test_indefinite_block_holds(self, app, people):
        # WF-BUG-03 fixed in main (check_requester treats a missing end date as indefinite).
        uid = people["author"].user.id
        r = people["admin"].post(f"/api/admin/users/{uid}/block", json={"days": 0, "reason": "спам"})
        assert r.status_code == 200
        assert submit(people["author"]).status_code == 403
        assert sos(people["author"]).status_code == 403
        assert status(app, User, uid).is_blocked is True

    @pytest.mark.xfail(strict=True, reason="WF-BUG-04: non-numeric 'days' in block request crashes with 500")
    def test_block_with_bad_days_is_400(self, people):
        r = people["admin"].post(f"/api/admin/users/{people['author'].user.id}/block", json={"days": "abc"})
        assert r.status_code == 400

    def test_low_rating_no_longer_blocks_creation(self, app, people):
        # The "average rating < 2" rule was removed in main (it enabled SEC-05 abuse).
        with app.app_context():
            user = db.session.get(User, people["author"].user.id)
            user.rating_sum, user.rating_count = 3, 2
            db.session.commit()
        assert submit(people["author"]).status_code == 201

    def test_sos_limited_to_three_per_hour(self, app, people):
        codes = [sos(people["author"]).status_code for _ in range(4)]
        assert codes == [201, 201, 201, 429]
        with app.app_context():
            assert Application.query.filter_by(is_sos=True).count() == 3

    def test_sos_limit_is_per_user(self, people):
        for _ in range(3):
            sos(people["author"])
        assert sos(people["vol1"]).status_code == 201

    @pytest.mark.xfail(strict=True, reason="SEC-07: ordinary requests have no rate limit; 20 in a row are accepted")
    def test_request_flood_is_throttled(self, people):
        codes = [submit(people["author"]).status_code for _ in range(20)]
        assert 429 in codes


# --------------------------------------------------------------------------- NT: notifications

class TestNotifications:
    def test_requester_notified_on_approve_and_reject(self, app, people):
        a = create(people["author"])
        b = create(people["author"])
        approve(people["admin"], a)
        reject(people["admin"], b, "Дубликат")
        got = {(n.notification_type, n.related_application_id) for n in notifications(app, people["author"].user)}
        assert ("application_approved", a) in got and ("application_rejected", b) in got

    def test_requester_notified_on_new_response(self, app, people, approved):
        respond(people["vol1"], approved)
        [n] = notifications(app, people["author"].user, "new_response")
        assert n.related_application_id == approved and n.related_user_id == people["vol1"].user.id

    def test_volunteer_notified_on_accept_and_requester_reminded(self, app, people, approved):
        rid = respond(people["vol1"], approved).get_json()["response_id"]
        accept(people["author"], approved, rid)
        assert len(notifications(app, people["vol1"].user, "response_accepted")) == 1
        assert len(notifications(app, people["author"].user, "rate_volunteer_reminder")) == 1

    def test_volunteer_notified_on_rejection(self, app, people, approved):
        rid = respond(people["vol1"], approved).get_json()["response_id"]
        people["author"].post(f"/api/applications/{approved}/responses/{rid}/reject")
        assert len(notifications(app, people["vol1"].user, "response_rejected")) == 1

    def test_volunteer_notified_on_completion_rating_and_resolve(self, app, people, approved):
        rid = respond(people["vol1"], approved).get_json()["response_id"]
        accept(people["author"], approved, rid)
        people["author"].post(f"/api/responses/{rid}/complete")
        people["author"].post(f"/api/responses/{rid}/rating", json={"score": 5})
        got = kinds(app, people["vol1"].user)
        assert {"response_accepted", "response_completed", "rating_received"} <= set(got)

    def test_accepted_volunteer_notified_on_resolve(self, app, people, approved):
        rid = respond(people["vol1"], approved).get_json()["response_id"]
        accept(people["author"], approved, rid)
        people["author"].post(f"/api/applications/{approved}/resolve")
        assert len(notifications(app, people["vol1"].user, "application_resolved")) == 1
        assert len(notifications(app, people["author"].user, "rate_volunteers")) == 1

    def test_not_accepted_volunteer_not_told_about_resolve(self, app, people, approved):
        respond(people["vol2"], approved)
        people["author"].post(f"/api/applications/{approved}/resolve")
        assert notifications(app, people["vol2"].user, "application_resolved") == []

    def volunteer_at(self, app, client, latitude, longitude, available=True, telegram="700001"):
        with app.app_context():
            user = db.session.get(User, client.user.id)
            user.telegram_id = telegram
            db.session.add(VolunteerPreference(user_id=user.id, is_available=available,
                                               latitude=latitude, longitude=longitude))
            db.session.commit()

    def test_nearby_volunteer_notified_on_approve(self, app, people):
        self.volunteer_at(app, people["vol1"], 43.25, 76.90)  # ~1.5 km away
        app_id = create(people["author"])
        approve(people["admin"], app_id)
        [n] = notifications(app, people["vol1"].user, "new_request")
        assert n.related_application_id == app_id and "км" in n.message
        assert notifications(app, people["vol2"].user, "new_request") == []

    def test_volunteer_over_10_km_not_notified(self, app, people):
        self.volunteer_at(app, people["vol1"], 43.35, 76.90)  # ~12 km away
        approve(people["admin"], create(people["author"]))
        assert notifications(app, people["vol1"].user, "new_request") == []

    def test_nearby_volunteer_notified_on_sos_without_moderation(self, app, people):
        self.volunteer_at(app, people["vol1"], 43.25, 76.90)
        sos(people["author"])
        [n] = notifications(app, people["vol1"].user, "new_request")
        assert n.title.startswith("SOS")

    @pytest.mark.xfail(strict=True, reason="WF-BUG-10: volunteers who switched availability off are still notified")
    def test_unavailable_volunteer_not_notified(self, app, people):
        self.volunteer_at(app, people["vol1"], 43.25, 76.90, available=False)
        approve(people["admin"], create(people["author"]))
        assert notifications(app, people["vol1"].user, "new_request") == []

    @pytest.mark.xfail(strict=True, reason="WF-BUG-11: nearby volunteers without Telegram get no in-app notification")
    def test_nearby_volunteer_without_telegram_gets_in_app_notice(self, app, people):
        self.volunteer_at(app, people["vol1"], 43.25, 76.90, telegram=None)
        approve(people["admin"], create(people["author"]))
        assert len(notifications(app, people["vol1"].user, "new_request")) == 1

    def test_notifications_api_unread_and_read_all(self, app, people, approved):
        respond(people["vol1"], approved)
        body = people["author"].get("/api/notifications").get_json()
        assert body["unread_count"] == 2  # approved + new_response
        assert {n["notification_type"] for n in body["notifications"]} == {"application_approved", "new_response"}
        assert people["author"].post("/api/notifications/read-all").status_code == 200
        assert people["author"].get("/api/notifications").get_json()["unread_count"] == 0

    def test_user_cannot_read_or_mark_others_notifications(self, app, people, approved):
        respond(people["vol1"], approved)
        [n] = notifications(app, people["author"].user, "new_response")
        assert people["vol1"].post(f"/api/notifications/{n.id}/read").status_code in (403, 404)
        assert status(app, Notification, n.id).is_read is False
        assert all(x["id"] != n.id for x in people["vol1"].get("/api/notifications").get_json()["notifications"])

    def test_approve_sends_telegram_to_linked_requester(self, app, people):
        with app.app_context():
            db.session.get(User, people["author"].user.id).telegram_id = "123456"
            db.session.commit()
        app_id = create(people["author"])
        with patch("backend.telegram_bot.utils.notifications.send_notification", return_value=True) as send:
            approve(people["admin"], app_id)
        send.assert_called_once()
        assert send.call_args.kwargs["telegram_id"] == "123456"

    @pytest.mark.xfail(strict=True, reason="WF-BUG-05: volunteers are not told when an approved request is rejected")
    def test_accepted_volunteer_notified_when_request_rejected(self, app, people, approved):
        rid = respond(people["vol1"], approved).get_json()["response_id"]
        accept(people["author"], approved, rid)
        before = len(notifications(app, people["vol1"].user))
        reject(people["admin"], approved, "нарушение")
        assert len(notifications(app, people["vol1"].user)) > before

    def test_requester_notified_on_false_call(self, app, people, approved):
        # WF-BUG-06 fixed in main.
        people["admin"].post(f"/api/admin/applications/{approved}/mark-false", json={})
        assert len(notifications(app, people["author"].user, "application_false_call")) == 1

    def test_reject_requires_reason_and_tells_author(self, app, people):
        app_id = create(people["author"])
        assert people["admin"].post(f"/api/admin/applications/{app_id}/reject", json={}).status_code == 400
        assert reject(people["admin"], app_id, "Нет фото проблемы").status_code == 200
        [n] = notifications(app, people["author"].user, "application_rejected")
        assert "Нет фото проблемы" in n.message


# --------------------------------------------------------------------------- MD: moderator rights

def admin_rules(app):
    """Every /api/admin route with a sample URL and its methods."""
    rules = []
    for rule in app.url_map.iter_rules():
        if not rule.rule.startswith("/api/admin"):
            continue
        url = rule.rule
        for arg in rule.arguments:
            url = url.replace(f"<int:{arg}>", "1").replace(f"<{arg}>", "1")
        for method in sorted(rule.methods - {"HEAD", "OPTIONS"}):
            rules.append((method, url))
    return sorted(set(rules))


class TestModeratorRights:
    def test_every_admin_route_refuses_ordinary_user(self, app, people, approved):
        assert len(admin_rules(app)) >= 15
        allowed = []
        for method, url in admin_rules(app):
            r = people["outsider"].open(url, method=method, json={})
            if r.status_code not in (401, 403):
                allowed.append((method, url, r.status_code))
        # Legacy delete answers ordinary users with an HTML redirect (WF-OBS-01);
        # the deletion itself is refused, checked in the next test.
        assert allowed == [("POST", "/api/admin/users/1/delete", 302)]

    def test_ordinary_user_cannot_delete_user(self, app, people):
        victim = people["vol2"].user.id
        r = people["outsider"].post(f"/api/admin/users/{victim}/delete", json={})
        assert r.status_code in (302, 403)
        assert status(app, User, victim) is not None

    def test_every_admin_route_refuses_anonymous(self, app, approved):
        client = app.test_client()
        open_routes = [(m, u, client.open(u, method=m, json={}).status_code) for m, u in admin_rules(app)]
        assert [x for x in open_routes if x[2] not in (401, 403)] == []

    def test_ordinary_user_actions_leave_request_unchanged(self, app, people):
        app_id = create(people["author"])
        for action in ("approve", "reject", "mark-false"):
            people["vol1"].post(f"/api/admin/applications/{app_id}/{action}", json={})
        people["vol1"].post(f"/api/admin/applications/{app_id}/set-priority", json={"priority": 5})
        row = status(app, Application, app_id)
        assert (row.moderation_status, row.is_false_call, row.priority) == (ModerationStatus.PENDING, False, 0)
        with app.app_context():
            assert ModerationAction.query.count() == 0

    def test_author_cannot_moderate_own_request(self, app, people):
        app_id = create(people["author"])
        assert people["author"].post(f"/api/admin/applications/{app_id}/approve", json={}).status_code == 403

    def test_admin_status_changes_are_audited(self, app, people):
        app_id = create(people["author"])
        admin = people["admin"]
        approve(admin, app_id)
        admin.post(f"/api/admin/applications/{app_id}/set-priority", json={"priority": 4, "reason": "дети"})
        reject(admin, app_id, "дубль")
        admin.post(f"/api/admin/applications/{app_id}/mark-false", json={"reason": "фейк"})
        with app.app_context():
            log = [(a.action, a.previous_status, a.new_status, a.admin_id, a.reason)
                   for a in ModerationAction.query.order_by(ModerationAction.id)]
        uid = admin.user.id
        assert log == [
            ("approve", "pending", "approved", uid, None),
            ("prioritize", "approved", "approved", uid, "дети"),
            ("reject", "approved", "rejected", uid, "дубль"),
            ("mark_false_call", "rejected", "rejected", uid, "фейк"),
        ]
        row = status(app, Application, app_id)
        assert row.moderator_id == uid and row.moderated_at is not None and row.priority_source == "admin"

    def test_admin_sees_pending_and_ordinary_user_does_not(self, app, people):
        app_id = create(people["author"])
        assert people["admin"].get(f"/api/applications/{app_id}").status_code == 200
        assert people["outsider"].get(f"/api/applications/{app_id}").status_code in (403, 404)
        listed = people["admin"].get("/api/admin/applications?status=pending").get_json()
        items = listed if isinstance(listed, list) else listed.get("applications", [])
        assert app_id in [a["id"] for a in items]

    def test_only_super_admin_grants_admin(self, app, people):
        target = people["vol1"].user.id
        assert people["admin"].post(f"/api/admin/users/{target}/make-admin", json={}).status_code == 403
        assert status(app, User, target).isAdmin is False
        assert people["root"].post(f"/api/admin/users/{target}/make-admin", json={}).status_code == 200
        assert status(app, User, target).isAdmin is True

    def test_admin_cannot_block_super_admin(self, app, people):
        r = people["admin"].post(f"/api/admin/users/{people['root'].user.id}/block", json={"days": 1})
        assert r.status_code == 400
        assert status(app, User, people["root"].user.id).is_blocked is False

    def test_block_notifies_user_and_unblock_restores(self, app, people):
        uid = people["author"].user.id
        people["admin"].post(f"/api/admin/users/{uid}/block", json={"days": 3, "reason": "спам"})
        assert status(app, User, uid).is_blocked
        assert any("заблокирован" in n.message for n in notifications(app, people["author"].user))
        assert people["admin"].post(f"/api/admin/users/{uid}/unblock", json={}).status_code == 200
        assert status(app, User, uid).is_blocked is False
        create(people["author"])

    def test_blocked_admin_loses_nothing_but_ordinary_user_cannot_unblock(self, app, people):
        uid = people["author"].user.id
        people["admin"].post(f"/api/admin/users/{uid}/block", json={"days": 3})
        assert people["author"].post(f"/api/admin/users/{uid}/unblock", json={}).status_code == 403
        assert status(app, User, uid).is_blocked is True
