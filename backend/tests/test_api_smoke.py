import os
from uuid import uuid4

os.environ["DATABASE_URL"] = "sqlite:///./test_gaba_cabs.db"

from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


def test_health_endpoint() -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_register_and_login_flow() -> None:
    email = f"test_{uuid4().hex[:10]}@example.com"
    password = "TestPass123!"

    register_resp = client.post("/api/auth/register", json={"email": email, "password": password})
    assert register_resp.status_code == 200
    reg_body = register_resp.json()
    assert "access_token" in reg_body
    assert reg_body.get("role") == "user"

    login_resp = client.post("/api/auth/login", json={"email": email, "password": password})
    assert login_resp.status_code == 200
    login_body = login_resp.json()
    assert "access_token" in login_body
    assert login_body.get("role") == "user"

