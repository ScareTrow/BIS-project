"""O3 QA suite: request creation with photos, upload boundaries, map lat/lng.

Covers the O3 test plan (see QA_O3_REPORT.md):

* Happy path: create a request with photos, moderation, map visibility.
* Edge cases: 1000-character description, 3 photos of 9.9 MB each.
* Error cases: auth, coordinates, description, category, missing media.
* Boundary set: 10.0 MB, 10.1 MB, empty file, .exe.
* Map markers: latitude/longitude fields, types, precision and visibility.

The O3 requirement is "description up to 1000 characters, up to 3 photos,
each up to 10 MB" (MB = MiB, the unit the frontend uses). The backend
currently enforces 5000 characters, unlimited photos and 50 MiB per file.
Tests for limits that the backend does not enforce are marked
``xfail(strict=True)``: they fail today and turn into an XPASS (which fails
the run) once the limit is implemented, as a reminder to drop the marker.
"""

import io
import os

import pytest
from werkzeug.security import generate_password_hash

from backend.website import db
from backend.website.models import (
    Application,
    ApplicationMedia,
    ModerationStatus,
    User,
)

PASSWORD = "Asar8!River2"
MIB = 1024 * 1024

SPEC_MAX_DESCRIPTION = 1000
SPEC_MAX_PHOTOS = 3
SPEC_MAX_FILE = 10 * MIB

SIZE_9_9_MB = int(9.9 * MIB)
SIZE_10_0_MB = 10 * MIB
SIZE_10_1_MB = int(10.1 * MIB)

ALMATY = (43.238949, 76.889709)


# --------------------------------------------------------------------------- helpers

def make_user(app, email, **fields):
    with app.app_context():
        user = User(
            email=email,
            password=generate_password_hash(PASSWORD),
            first_name="Qa",
            city="Almaty",
            **fields,
        )
        db.session.add(user)
        db.session.commit()
        db.session.refresh(user)
        return user


def login(client, email):
    response = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200, response.get_json()
    return client


@pytest.fixture
def requester(app):
    user = make_user(app, "requester@example.com")
    client = login(app.test_client(), user.email)
    client.user = user
    return client


@pytest.fixture
def admin(app):
    user = make_user(app, "admin-o3@example.com", isAdmin=True, is_super_admin=True)
    return login(app.test_client(), user.email)


def photo(size, name="photo.jpg"):
    # JPEG magic bytes followed by padding up to the requested size.
    head = b"\xff\xd8\xff\xe0" if size >= 4 else b""
    return (io.BytesIO(head + b"\0" * (size - len(head))), name)


def form(*files, description="Нужна помощь продуктами", latitude=ALMATY[0],
         longitude=ALMATY[1], category="food", **extra):
    data = {
        "description": description,
        "latitude": str(latitude),
        "longitude": str(longitude),
        "category": category,
        "city": "Almaty",
        "expires_days": "7",
        **extra,
    }
    if files:
        data["media_files"] = list(files)
    return data


def create(client, data):
    return client.post("/api/applications", data=data, content_type="multipart/form-data")


def uploads(app):
    folder = app.config["UPLOAD_FOLDER"]
    return sorted(os.listdir(folder)) if os.path.isdir(folder) else []


def counts(app):
    with app.app_context():
        return Application.query.count(), ApplicationMedia.query.count()


def assert_nothing_saved(app):
    assert counts(app) == (0, 0)
    assert uploads(app) == []


# --------------------------------------------------------------------------- happy path

class TestHappyPath:
    def test_create_request_with_photo(self, app, requester):
        response = create(requester, form(photo(1024)))
        assert response.status_code == 200, response.get_json()
        app_id = response.get_json()["id"]

        with app.app_context():
            application = db.session.get(Application, app_id)
            assert application.moderation_status == ModerationStatus.PENDING
            assert application.user_id == requester.user.id
            assert application.latitude == ALMATY[0]
            assert application.longitude == ALMATY[1]
            media = ApplicationMedia.query.filter_by(application_id=app_id).all()
            assert len(media) == 1
            assert media[0].file_type == "image/jpeg"
            assert uploads(app) == [media[0].file_path]

    def test_detail_returns_coordinates_and_media(self, app, requester):
        app_id = create(requester, form(photo(1024))).get_json()["id"]
        detail = requester.get(f"/api/applications/{app_id}")
        assert detail.status_code == 200
        body = detail.get_json()
        assert body["status"] == "pending"
        assert (body["latitude"], body["longitude"]) == ALMATY
        assert len(body["media_files"]) == 1

    def test_uploaded_photo_is_served_to_owner(self, app, requester):
        app_id = create(requester, form(photo(2048))).get_json()["id"]
        path = requester.get(f"/api/applications/{app_id}").get_json()["media_files"][0]["file_path"]
        served = requester.get(f"/api/uploads/{path}")
        assert served.status_code == 200
        assert len(served.data) == 2048

    def test_approved_request_appears_on_public_map(self, app, requester, admin):
        app_id = create(requester, form(photo(1024))).get_json()["id"]
        approve = admin.post(f"/api/admin/applications/{app_id}/approve", json={})
        assert approve.status_code == 200, approve.get_json()

        points = app.test_client().get("/api/map/points").get_json()
        point = next(p for p in points if p["id"] == app_id)
        assert (point["latitude"], point["longitude"]) == ALMATY
        assert point["moderation_status"] == "approved"

    def test_json_request_without_photo(self, app, requester):
        response = requester.post("/api/applications", json={
            "description": "Нужна доставка", "latitude": ALMATY[0],
            "longitude": ALMATY[1], "category": "delivery", "city": "Almaty",
        })
        assert response.status_code == 200, response.get_json()
        assert counts(app) == (1, 0)


# --------------------------------------------------------------------------- edge cases

class TestEdgeCases:
    def test_description_exactly_1000_characters(self, app, requester):
        text = "а" * SPEC_MAX_DESCRIPTION
        response = create(requester, form(photo(1024), description=text))
        assert response.status_code == 200, response.get_json()
        with app.app_context():
            assert len(Application.query.one().description) == SPEC_MAX_DESCRIPTION

    def test_description_1000_characters_mixed_script_and_emoji(self, app, requester):
        text = ("Помощь help 🙏 " * 100)[:SPEC_MAX_DESCRIPTION]
        assert len(text) == SPEC_MAX_DESCRIPTION
        response = create(requester, form(photo(1024), description=text))
        assert response.status_code == 200, response.get_json()

    @pytest.mark.xfail(strict=True, reason="O3-BUG-01: backend allows 5000 characters, spec says 1000")
    def test_description_1001_characters_rejected(self, app, requester):
        response = create(requester, form(photo(1024), description="а" * (SPEC_MAX_DESCRIPTION + 1)))
        assert response.status_code == 400
        assert_nothing_saved(app)

    @pytest.mark.slow
    def test_three_photos_of_9_9_mb(self, app, requester):
        files = [photo(SIZE_9_9_MB, f"p{i}.jpg") for i in range(3)]
        response = create(requester, form(*files))
        assert response.status_code == 200, response.get_json()
        assert counts(app) == (1, 3)
        folder = app.config["UPLOAD_FOLDER"]
        assert [os.path.getsize(os.path.join(folder, f)) for f in uploads(app)] == [SIZE_9_9_MB] * 3

    @pytest.mark.xfail(strict=True, reason="O3-BUG-02: no limit on the number of photos, spec says 3")
    def test_fourth_photo_rejected(self, app, requester):
        files = [photo(1024, f"p{i}.jpg") for i in range(SPEC_MAX_PHOTOS + 1)]
        response = create(requester, form(*files))
        assert response.status_code == 400
        assert_nothing_saved(app)

    @pytest.mark.xfail(strict=True, reason="O3-BUG-03: same file name in one request overwrites the first file")
    def test_same_filename_twice_keeps_both_files(self, app, requester):
        response = create(requester, form(photo(100, "a.jpg"), photo(200, "a.jpg")))
        assert response.status_code == 200
        _, media = counts(app)
        # Both rows exist; the files must not overwrite each other on disk.
        assert media == 2
        assert len(uploads(app)) == 2


# --------------------------------------------------------------------------- boundary set

class TestUploadBoundaries:
    @pytest.mark.slow
    def test_file_exactly_10_0_mb_accepted(self, app, requester):
        response = create(requester, form(photo(SIZE_10_0_MB)))
        assert response.status_code == 200, response.get_json()
        assert counts(app) == (1, 1)

    @pytest.mark.slow
    @pytest.mark.xfail(strict=True, reason="O3-BUG-04: per-file limit is 50 MiB, spec says 10 MB")
    def test_file_10_1_mb_rejected(self, app, requester):
        response = create(requester, form(photo(SIZE_10_1_MB)))
        assert response.status_code == 400
        assert_nothing_saved(app)

    def test_empty_file_rejected(self, app, requester):
        response = create(requester, form(photo(0, "empty.jpg")))
        assert response.status_code == 400
        assert "Empty" in response.get_json()["error"]
        assert_nothing_saved(app)

    def test_exe_rejected(self, app, requester):
        response = create(requester, form((io.BytesIO(b"MZ\x90\x00" + b"\0" * 1020), "setup.exe")))
        assert response.status_code == 400
        assert "extension" in response.get_json()["error"]
        assert_nothing_saved(app)

    @pytest.mark.parametrize("name", ["setup.EXE", "photo.jpg.exe", "photo.exe.", "noext"])
    def test_exe_name_variants_rejected(self, app, requester, name):
        response = create(requester, form((io.BytesIO(b"MZ" + b"\0" * 100), name)))
        assert response.status_code == 400
        assert_nothing_saved(app)

    def test_valid_photo_plus_exe_rejects_whole_request(self, app, requester):
        response = create(requester, form(photo(1024), (io.BytesIO(b"MZ" + b"\0" * 100), "x.exe")))
        assert response.status_code == 400
        assert_nothing_saved(app)

    def test_valid_photo_plus_empty_file_rejects_whole_request(self, app, requester):
        response = create(requester, form(photo(1024), photo(0, "empty.png")))
        assert response.status_code == 400
        assert_nothing_saved(app)

    @pytest.mark.xfail(strict=True, reason="O3-BUG-05: content is not checked, an .exe renamed to .jpg is stored")
    def test_exe_renamed_to_jpg_rejected(self, app, requester):
        response = create(requester, form((io.BytesIO(b"MZ\x90\x00" + b"\0" * 1020), "photo.jpg")))
        assert response.status_code == 400
        assert_nothing_saved(app)

    def test_request_over_max_content_length_returns_413(self, app, requester):
        app.config["MAX_CONTENT_LENGTH"] = 1 * MIB
        response = create(requester, form(photo(2 * MIB)))
        assert response.status_code == 413
        assert_nothing_saved(app)


# --------------------------------------------------------------------------- error cases

class TestErrors:
    def test_anonymous_gets_401(self, app, client):
        response = create(client, form(photo(1024)))
        assert response.status_code == 401
        assert_nothing_saved(app)

    @pytest.mark.parametrize("latitude,longitude", [
        (90.0001, 76.0), (-90.0001, 76.0), (43.0, 180.0001), (43.0, -180.0001),
        ("abc", 76.0), (43.0, ""), ("nan", 76.0), ("inf", 76.0),
    ])
    def test_invalid_coordinates(self, app, requester, latitude, longitude):
        response = create(requester, form(photo(1024), latitude=latitude, longitude=longitude))
        assert response.status_code == 400
        assert_nothing_saved(app)

    def test_missing_coordinates(self, app, requester):
        data = form(photo(1024))
        del data["latitude"], data["longitude"]
        response = create(requester, data)
        assert response.status_code == 400
        assert response.get_json()["error"] == "Координаты обязательны"

    @pytest.mark.parametrize("description", ["", "   ", "<script>alert(1)</script>", "x onclick=alert(1)"])
    def test_invalid_description(self, app, requester, description):
        response = create(requester, form(photo(1024), description=description))
        assert response.status_code == 400
        assert_nothing_saved(app)

    def test_invalid_category(self, app, requester):
        response = create(requester, form(photo(1024), category="weapons"))
        assert response.status_code == 400
        assert_nothing_saved(app)

    def test_multipart_without_media(self, app, requester):
        response = create(requester, form())
        assert response.status_code == 400
        assert "медиафайл" in response.get_json()["error"]

    @pytest.mark.parametrize("days", ["0", "366", "abc"])
    def test_invalid_expiry(self, app, requester, days):
        response = create(requester, form(photo(1024), expires_days=days))
        assert response.status_code == 400
        assert_nothing_saved(app)

    def test_json_with_boolean_coordinates(self, app, requester):
        response = requester.post("/api/applications", json={
            "description": "x", "latitude": True, "longitude": False, "category": "food",
        })
        assert response.status_code == 400


# --------------------------------------------------------------------------- map markers / lat-lng

class TestMapCoordinates:
    def approved(self, app, requester, admin, latitude, longitude):
        app_id = create(requester, form(photo(64), latitude=latitude, longitude=longitude)).get_json()["id"]
        assert admin.post(f"/api/admin/applications/{app_id}/approve", json={}).status_code == 200
        return app_id

    def test_point_fields_and_types(self, app, requester, admin):
        app_id = self.approved(app, requester, admin, *ALMATY)
        point = next(p for p in app.test_client().get("/api/map/points").get_json() if p["id"] == app_id)
        assert {"id", "latitude", "longitude", "category", "is_sos", "moderation_status"} <= point.keys()
        # Frontend reads latitude/longitude; short names must not be expected.
        assert "lat" not in point and "lng" not in point
        assert isinstance(point["latitude"], float) and isinstance(point["longitude"], float)

    def test_latitude_and_longitude_not_swapped(self, app, requester, admin):
        # Almaty: latitude ~43 (N), longitude ~76 (E).
        app_id = self.approved(app, requester, admin, *ALMATY)
        point = next(p for p in app.test_client().get("/api/map/points").get_json() if p["id"] == app_id)
        assert 40 < point["latitude"] < 56
        assert 46 < point["longitude"] < 88

    def test_precision_preserved(self, app, requester, admin):
        app_id = self.approved(app, requester, admin, 51.1605227, 71.4703558)
        point = next(p for p in app.test_client().get("/api/map/points").get_json() if p["id"] == app_id)
        assert (point["latitude"], point["longitude"]) == (51.1605227, 71.4703558)

    @pytest.mark.parametrize("latitude,longitude", [(90, 180), (-90, -180), (0, 0)])
    def test_boundary_coordinates_accepted(self, app, requester, admin, latitude, longitude):
        app_id = self.approved(app, requester, admin, latitude, longitude)
        point = next(p for p in app.test_client().get("/api/map/points").get_json() if p["id"] == app_id)
        assert (point["latitude"], point["longitude"]) == (latitude, longitude)

    def test_pending_marker_visible_only_to_owner(self, app, requester):
        app_id = create(requester, form(photo(64))).get_json()["id"]
        own = next(p for p in requester.get("/api/map/points").get_json() if p["id"] == app_id)
        assert own["is_own"] is True and own["moderation_status"] == "pending"
        anonymous_ids = [p["id"] for p in app.test_client().get("/api/map/points").get_json()]
        assert app_id not in anonymous_ids

    def test_rejected_and_resolved_not_on_map(self, app, requester, admin):
        rejected = create(requester, form(photo(64))).get_json()["id"]
        resolved = self.approved(app, requester, admin, *ALMATY)
        admin.post(f"/api/admin/applications/{rejected}/reject", json={"reason": "spam"})
        with app.app_context():
            db.session.get(Application, resolved).is_resolved = True
            db.session.commit()
        ids = [p["id"] for p in app.test_client().get("/api/map/points").get_json()]
        assert rejected not in ids and resolved not in ids

    def test_map_and_list_and_detail_agree(self, app, requester, admin):
        app_id = self.approved(app, requester, admin, 42.3417, 69.5901)
        anon = app.test_client()
        point = next(p for p in anon.get("/api/map/points").get_json() if p["id"] == app_id)
        item = next(p for p in anon.get("/api/applications/list").get_json() if p["id"] == app_id)
        detail = requester.get(f"/api/applications/{app_id}").get_json()
        coords = {(x["latitude"], x["longitude"]) for x in (point, item, detail)}
        assert coords == {(42.3417, 69.5901)}

    def test_sos_marker_flag(self, app, requester, admin):
        response = requester.post("/api/sos", json={"latitude": ALMATY[0], "longitude": ALMATY[1]})
        assert response.status_code in (200, 201), response.get_json()
        points = requester.get("/api/map/points").get_json()
        assert any(p["is_sos"] and (p["latitude"], p["longitude"]) == ALMATY for p in points)
