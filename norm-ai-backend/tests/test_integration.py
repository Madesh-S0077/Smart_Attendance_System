"""DB-backed integration tests. Skipped automatically when Postgres is unreachable.

Uses far-future dates and unique emails so the tests are re-runnable and do not
touch real attendance data. The admin slot window is widened to the whole day
for the duration of the module and restored afterwards.
"""
import random
import socket
import uuid
from datetime import date, timedelta
from urllib.parse import urlparse

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings


def _db_up() -> bool:
    u = urlparse(settings.DATABASE_URL.replace("+asyncpg", ""))
    try:
        with socket.create_connection((u.hostname, u.port or 5432), timeout=1):
            return True
    except OSError:
        return False


pytestmark = pytest.mark.skipif(not _db_up(), reason="Postgres not reachable")

ADMIN = {"email": "admin@rmkec.ac.in", "password": "AdminPassword123!"}


def _vec(i: int) -> list[float]:
    v = [0.0] * 512
    v[i] = 1.0
    return v


def _weekday(offset_seed: int) -> date:
    d = date(2040, 1, 2) + timedelta(days=offset_seed * 7 + random.randint(0, 3))
    assert d.weekday() < 6
    return d


@pytest.fixture(scope="module")
def client():
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def admin_h(client):
    r = client.post("/api/auth/login", json=ADMIN)
    if r.status_code != 200:
        pytest.skip("Admin not seeded (run python -m app.seed_admin)")
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}


@pytest.fixture(scope="module", autouse=True)
def wide_window(client, admin_h):
    client.put("/api/admin/slot-config", json={"start_time": "00:00", "end_time": "23:59"}, headers=admin_h)
    yield
    client.put("/api/admin/slot-config", json={"start_time": "08:30", "end_time": "10:00"}, headers=admin_h)


@pytest.fixture()
def student(client):
    email = f"it_{uuid.uuid4().hex[:10]}@rmkec.ac.in"
    r = client.post(
        "/api/auth/register/student",
        json={
            "email": email, "password": "Passw0rd!x", "name": "IT Student",
            "register_number": uuid.uuid4().hex[:12], "department": "CSE",
            "section": "A", "face_embedding": _vec(3),
        },
    )
    assert r.status_code == 201, r.text
    tok = client.post("/api/auth/login", json={"email": email, "password": "Passw0rd!x"}).json()["data"]["access_token"]
    return {"Authorization": f"Bearer {tok}"}


def _slot(client, admin_h, d: date):
    r = client.post("/api/timeslots/generate", json={"date": d.isoformat()}, headers=admin_h)
    assert r.status_code == 200, r.text
    return r.json()["data"]


def test_slot_uses_admin_config(client, admin_h):
    slot = _slot(client, admin_h, _weekday(random.randint(1, 400)))
    assert slot["start_time"].startswith("00:00")
    assert slot["end_time"].startswith("23:59")


def test_verify_success_then_duplicate_409(client, admin_h, student):
    d = _weekday(random.randint(500, 900))
    _slot(client, admin_h, d)
    body = {"face_embedding": _vec(3), "date": d.isoformat()}
    r1 = client.post("/api/attendance/verify", json=body, headers=student)
    assert r1.status_code == 200, r1.text
    assert r1.json()["data"]["similarity"] > 0.99
    r2 = client.post("/api/attendance/verify", json=body, headers=student)
    assert r2.status_code == 409


def test_wrong_face_rejected(client, admin_h, student):
    d = _weekday(random.randint(1000, 1400))
    _slot(client, admin_h, d)
    r = client.post("/api/attendance/verify", json={"face_embedding": _vec(7), "date": d.isoformat()}, headers=student)
    assert r.status_code == 401


def test_sunday_rejected(client, student):
    d = date(2040, 1, 1)
    assert d.weekday() == 6
    r = client.post("/api/attendance/verify", json={"face_embedding": _vec(3), "date": d.isoformat()}, headers=student)
    assert r.status_code == 400 and "Sunday" in r.json()["error"]


def test_holiday_rejected(client, admin_h, student):
    d = _weekday(random.randint(1500, 1900))
    client.post("/api/holidays/", json={"date": d.isoformat(), "reason": "test"}, headers=admin_h)
    try:
        r = client.post("/api/attendance/verify", json={"face_embedding": _vec(3), "date": d.isoformat()}, headers=student)
        assert r.status_code == 400 and "holiday" in r.json()["error"].lower()
    finally:
        client.delete(f"/api/holidays/{d.isoformat()}", headers=admin_h)


def test_outside_window_message_uses_slot_times(client, admin_h, student):
    client.put("/api/admin/slot-config", json={"start_time": "00:00", "end_time": "00:01"}, headers=admin_h)
    try:
        d = _weekday(random.randint(2000, 2400))
        _slot(client, admin_h, d)
        r = client.post("/api/attendance/verify", json={"face_embedding": _vec(3), "date": d.isoformat()}, headers=student)
        # Passes only if the real clock is outside 00:00-00:01.
        assert r.status_code == 400
        assert "12:00 AM – 12:01 AM" in r.json()["error"]
    finally:
        client.put("/api/admin/slot-config", json={"start_time": "00:00", "end_time": "23:59"}, headers=admin_h)
