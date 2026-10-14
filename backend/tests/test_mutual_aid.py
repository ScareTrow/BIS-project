"""Revised TSIS journeys: matching, shared quantities, resources and triage."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import importlib.util
from pathlib import Path

import pytest
from sqlalchemy import MetaData, create_engine, inspect
from alembic.migration import MigrationContext
from alembic.operations import Operations
from werkzeug.security import generate_password_hash

from backend.website import db
from backend.website.models import (
    User,
    Application,
    ApplicationCategory,
    ApplicationResponse,
    ResponseStatus,
    Capability,
    ApplicationCapability,
    ApplicationNeed,
    Contribution,
    ResourceConfirmation,
    Resource,
    ModerationAction,
)


def login(client, user, password="Asar8!River2"):
    assert (
        client.post(
            "/api/auth/login", json={"email": user.email, "password": password}
        ).status_code
        == 200
    )


@pytest.fixture
def helper(app):
    with app.app_context():
        u = User(
            email="mutual-helper@example.com",
            password=generate_password_hash("Asar8!River2"),
            first_name="Mарат",
            city="Almaty",
        )
        db.session.add(u)
        db.session.commit()
        db.session.refresh(u)
        return u


@pytest.fixture
def capability(app):
    with app.app_context():
        c = Capability(code="has_car", name="Есть машина")
        db.session.add(c)
        db.session.commit()
        db.session.refresh(c)
        return c


def test_social_request_matching_and_private_moderation(
    app, client, test_user, admin_user, helper, capability
):
    volunteer = app.test_client()
    login(volunteer, helper)
    assert (
        volunteer.put(
            "/api/user/capabilities",
            json={"is_available": True, "capability_ids": [capability.id]},
        ).status_code
        == 200
    )
    login(client, test_user)
    created = client.post(
        "/api/applications",
        json={
            "description": "Нужна доставка вещей",
            "latitude": 43.22,
            "longitude": 76.85,
            "category": "clothing",
            "city": "Almaty",
            "capability_ids": [capability.id],
            "needs": [{"resource_name": "Наборы", "unit": "шт", "quantity_needed": 10}],
        },
    )
    assert created.status_code == 200, created.json
    aid = created.json["id"]
    assert volunteer.get(f"/api/applications/{aid}").status_code == 404
    assert volunteer.get(f"/api/applications/{aid}/aid").status_code == 404
    assert not volunteer.get("/api/applications/matching").json
    admin = app.test_client()
    login(admin, admin_user, "Admin1234!@#$")
    assert admin.post(f"/api/admin/applications/{aid}/approve").status_code == 200
    assert [a["id"] for a in volunteer.get("/api/applications/matching").json] == [aid]
    assert any(
        n["notification_type"] == "new_request"
        for n in volunteer.get("/api/notifications").json["notifications"]
    )
    admin.post(f"/api/admin/applications/{aid}/approve")
    notices = volunteer.get("/api/notifications").json["notifications"]
    assert len([n for n in notices if n["notification_type"] == "new_request"]) == 1
    with app.app_context():
        assert ModerationAction.query.filter_by(application_id=aid).count() == 2


@pytest.mark.parametrize("bad", [-1, 0, "NaN", "Infinity", True, 1.0001])
def test_invalid_needs_leave_no_partial_application(app, client, test_user, bad):
    login(client, test_user)
    response = client.post(
        "/api/applications",
        json={
            "description": "Помощь с продуктами",
            "latitude": 43.22,
            "longitude": 76.85,
            "category": "food",
            "needs": [{"resource_name": "Рис", "unit": "кг", "quantity_needed": bad}],
        },
    )
    assert response.status_code == 400
    with app.app_context():
        assert Application.query.count() == 0


def test_contributions_are_scoped_and_cannot_overpromise(
    app, client, test_user, helper, test_application
):
    with app.app_context():
        n = ApplicationNeed(
            application_id=test_application.id,
            resource_name="Продукты",
            unit="набор",
            quantity_needed=10,
        )
        r = ApplicationResponse(
            application_id=test_application.id,
            responder_id=helper.id,
            status=ResponseStatus.ACCEPTED,
        )
        db.session.add_all([n, r])
        db.session.commit()
        nid, rid = n.id, r.id
    volunteer = app.test_client()
    login(volunteer, helper)
    login(client, test_user)
    path = f"/api/responses/{rid}/contributions"
    assert (
        client.put(path, json={"need_id": nid, "quantity_promised": 3}).status_code
        == 403
    )
    assert (
        volunteer.put(path, json={"need_id": nid, "quantity_promised": 11}).status_code
        == 409
    )
    assert (
        volunteer.put(
            path, json={"need_id": nid, "quantity_promised": 3, "quantity_delivered": 2}
        ).status_code
        == 200
    )
    assert client.post(f"/api/responses/{rid}/complete").status_code == 409
    assert (
        volunteer.put(
            path, json={"need_id": nid, "quantity_promised": 3, "quantity_delivered": 1}
        ).status_code
        == 400
    )
    assert (
        volunteer.put(
            path, json={"need_id": nid, "quantity_promised": 3, "quantity_delivered": 3}
        ).status_code
        == 200
    )
    assert client.post(f"/api/responses/{rid}/complete").status_code == 200
    assert (
        volunteer.post(f"/api/responses/{rid}/rating", json={"score": 5}).status_code
        == 403
    )
    assert (
        client.post(f"/api/responses/{rid}/rating", json={"score": 5}).status_code
        == 201
    )
    assert (
        client.post(f"/api/responses/{rid}/rating", json={"score": 4}).status_code
        == 409
    )
    totals = client.get(f"/api/applications/{test_application.id}/aid").json["needs"][0]
    assert (
        totals["quantity_delivered"] == 3
        and totals["still_needed"] == 7
        and totals["unpromised"] == 7
    )
    assert (
        client.post(f"/api/applications/{test_application.id}/resolve").status_code
        == 409
    )


def test_other_request_need_is_rejected(
    app, client, test_user, helper, test_application
):
    with app.app_context():
        other = Application(
            description="Другой запрос",
            category=ApplicationCategory.FOOD,
            latitude=0,
            longitude=0,
            user_id=test_user.id,
        )
        db.session.add(other)
        db.session.flush()
        n = ApplicationNeed(
            application_id=other.id, resource_name="Вода", unit="л", quantity_needed=5
        )
        r = ApplicationResponse(
            application_id=test_application.id,
            responder_id=helper.id,
            status=ResponseStatus.ACCEPTED,
        )
        db.session.add_all([n, r])
        db.session.commit()
        nid, rid = n.id, r.id
    login(client, helper)
    assert (
        client.put(
            f"/api/responses/{rid}/contributions",
            json={"need_id": nid, "quantity_promised": 1},
        ).status_code
        == 400
    )


def test_two_helpers_share_one_need(app, client, test_user, helper, test_application):
    with app.app_context():
        second = User(
            email="second-helper@example.com",
            first_name="Дана",
            password=generate_password_hash("Asar8!River2"),
            city="Almaty",
        )
        n = ApplicationNeed(
            application_id=test_application.id,
            resource_name="Наборы",
            unit="шт",
            quantity_needed=10,
        )
        db.session.add_all([second, n])
        db.session.flush()
        r1 = ApplicationResponse(
            application_id=test_application.id,
            responder_id=helper.id,
            status=ResponseStatus.ACCEPTED,
        )
        r2 = ApplicationResponse(
            application_id=test_application.id,
            responder_id=second.id,
            status=ResponseStatus.ACCEPTED,
        )
        db.session.add_all([r1, r2])
        db.session.commit()
        nid, id1, id2 = n.id, r1.id, r2.id
        db.session.refresh(second)
    first = app.test_client()
    other = app.test_client()
    login(first, helper)
    login(other, second)
    assert (
        first.put(
            f"/api/responses/{id1}/contributions",
            json={"need_id": nid, "quantity_promised": 3, "quantity_delivered": 3},
        ).status_code
        == 200
    )
    assert (
        other.put(
            f"/api/responses/{id2}/contributions",
            json={"need_id": nid, "quantity_promised": 4, "quantity_delivered": 2},
        ).status_code
        == 200
    )
    assert (
        other.put(
            f"/api/responses/{id2}/contributions",
            json={"need_id": nid, "quantity_promised": 8, "quantity_delivered": 2},
        ).status_code
        == 409
    )
    totals = client.get(f"/api/applications/{test_application.id}/aid").json["needs"][0]
    assert (
        totals["quantity_promised"],
        totals["quantity_delivered"],
        totals["still_needed"],
        totals["unpromised"],
    ) == (7, 5, 5, 3)


def test_resource_owner_confirmation_and_expiration(app, client, test_user, helper):
    login(client, test_user)
    created = client.post(
        "/api/resources",
        json={
            "name": "Пункт выдачи одежды",
            "city": "Almaty",
            "category": "clothing",
            "latitude": 43.22,
            "longitude": 76.85,
        },
    )
    assert created.status_code == 201
    rid = created.json["id"]
    reminder = client.post(f"/api/resources/{rid}/reminders")
    cid = reminder.json["id"]
    assert reminder.status_code == 201
    other = app.test_client()
    login(other, helper)
    assert (
        other.post(
            f"/api/resource-confirmations/{cid}/answer", json={"answer": "available"}
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/resource-confirmations/{cid}/answer", json={"answer": "available"}
        ).status_code
        == 200
    )
    assert (
        client.post(
            f"/api/resource-confirmations/{cid}/answer", json={"answer": "available"}
        ).status_code
        == 400
    )
    nextreminder = client.post(f"/api/resources/{rid}/reminders").json["id"]
    with app.app_context():
        db.session.get(ResourceConfirmation, nextreminder).expires_at = datetime.now(
            timezone.utc
        ) - timedelta(seconds=1)
        db.session.commit()
    assert client.get("/api/resources").json[0]["availability"] == "outdated"
    assert (
        client.post(
            f"/api/resource-confirmations/{nextreminder}/answer",
            json={"answer": "available"},
        ).status_code
        == 400
    )


def test_triage_keeps_user_sos_and_checks_admin(app, client, test_user, admin_user):
    login(client, test_user)
    rule = {"category": "household", "keyword": "срочно", "priority": "high"}
    assert client.post("/api/admin/triage-rules", json=rule).status_code == 403
    admin = app.test_client()
    login(admin, admin_user, "Admin1234!@#$")
    assert admin.post("/api/admin/triage-rules", json=rule).status_code == 200
    assert (
        admin.post("/api/admin/triage-rules", json={"priority": "sos"}).status_code
        == 400
    )
    for priority, expected in [("normal", 3), ("sos", 5)]:
        made = client.post(
            "/api/applications",
            json={
                "description": "срочно нужна бытовая помощь",
                "latitude": 0,
                "longitude": 0,
                "category": "household",
                "priority": priority,
            },
        )
        assert made.status_code == 200
        detail = client.get(f"/api/applications/{made.json['id']}").json
        assert detail["priority"] == expected
        assert detail["priority_source"] == (
            "auto" if priority == "normal" else "user_sos"
        )


def test_additive_migration_keeps_existing_records(app):
    """Exercise the static migration against an isolated pre-update SQLite schema."""
    old = MetaData()
    names = [
        "user",
        "application",
        "application_response",
        "application_media",
        "rating",
        "notification",
        "news",
        "note",
        "name_change_history",
    ]
    for name in names:
        db.metadata.tables[name].to_metadata(old)
    for name in ["needed_help", "priority_source", "created_via"]:
        old.tables["application"]._columns.remove(old.tables["application"].c[name])
    for constraint in list(old.tables["application_response"].constraints):
        if constraint.name in ["uq_response_application", "uq_response_volunteer"]:
            old.tables["application_response"].constraints.remove(constraint)
    for constraint in list(old.tables["rating"].constraints):
        if constraint.name == "uq_rating_response_pair":
            old.tables["rating"].constraints.remove(constraint)
    engine = create_engine("sqlite:///:memory:")
    old.create_all(engine)
    path = Path(__file__).parents[1] / "migrations/versions/20261014_mutual_aid.py"
    spec = importlib.util.spec_from_file_location("mutual_aid_revision", path)
    revision = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(revision)
    with engine.begin() as connection:
        connection.execute(
            old.tables["user"]
            .insert()
            .values(
                id=42,
                email="preserved@example.com",
                password="hash",
                first_name="Existing",
                isAdmin=False,
                is_super_admin=False,
                rating_sum=5,
                rating_count=1,
                city_hidden=False,
                is_blocked=False,
            )
        )
        with Operations.context(MigrationContext.configure(connection)):
            revision.upgrade()
            revision.upgrade()  # bootstrap/retry is idempotent
        assert connection.execute(old.tables["user"].select()).first().id == 42
        assert inspect(connection).has_table("contributions")
        assert inspect(connection).has_table("resource_confirmations")
        assert len(connection.exec_driver_sql("SELECT * FROM capabilities").all()) == 5


def test_capabilities_reject_unknown_ids_and_string_boolean(client, test_user):
    login(client, test_user)
    assert (
        client.put(
            "/api/user/capabilities",
            json={"capability_ids": [999], "is_available": True},
        ).status_code
        == 400
    )
    assert (
        client.put(
            "/api/user/capabilities",
            json={"capability_ids": [], "is_available": "false"},
        ).status_code
        == 400
    )


@pytest.mark.asyncio
async def test_telegram_confirmation_verifies_linked_owner(
    app, test_user, helper, monkeypatch
):
    import sys
    from types import SimpleNamespace
    from unittest.mock import AsyncMock
    from backend.telegram_bot.handlers.resources import confirm_resource_callback

    monkeypatch.setitem(
        sys.modules, "backend.telegram_bot.bot", SimpleNamespace(flask_app=app)
    )
    with app.app_context():
        owner = db.session.get(User, test_user.id)
        owner.telegram_id = "9001001"
        other = db.session.get(User, helper.id)
        other.telegram_id = "9001002"
        resource = Resource(
            owner_id=owner.id,
            name="Одежда",
            category="clothing",
            city="Almaty",
            latitude=43.22,
            longitude=76.85,
        )
        db.session.add(resource)
        db.session.flush()
        c = ResourceConfirmation(
            resource_id=resource.id,
            responsible_user_id=owner.id,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        )
        db.session.add(c)
        db.session.commit()
        cid = c.id
        rid = resource.id
    wrong = SimpleNamespace(
        data=f"resource_confirm_{cid}_available",
        from_user=SimpleNamespace(id=9001002),
        answer=AsyncMock(),
    )
    await confirm_resource_callback(wrong)
    assert wrong.answer.call_args.kwargs["show_alert"] is True
    correct = SimpleNamespace(
        data=f"resource_confirm_{cid}_unavailable",
        from_user=SimpleNamespace(id=9001001),
        answer=AsyncMock(),
    )
    await confirm_resource_callback(correct)
    with app.app_context():
        assert db.session.get(Resource, rid).availability == "unavailable"
        assert db.session.get(ResourceConfirmation, cid).answer == "unavailable"
