from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_openapi_lists_attendance_routes():
    paths = client.get("/openapi.json").json()["paths"]
    assert any("attendance" in p for p in paths)


def test_protected_endpoint_requires_auth():
    r = client.post("/api/attendance/verify", json={})
    assert r.status_code in (401, 403, 422)
