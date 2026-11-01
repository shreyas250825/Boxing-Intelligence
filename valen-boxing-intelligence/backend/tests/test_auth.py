import uuid

from fastapi.testclient import TestClient

from app.main import app


def test_auth_registration_and_login_flow():
    client = TestClient(app)
    email = f"alex+{uuid.uuid4().hex}@valenlabs.test"

    register = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Alex Coach",
            "email": email,
            "password": "StrongPassword123!",
            "role": "coach",
        },
    )

    assert register.status_code == 201, register.text
    payload = register.json()
    assert payload["data"]["email"] == email
    assert "token" in payload["data"]

    login = client.post(
        "/api/v1/auth/login",
        json={
            "email": email,
            "password": "StrongPassword123!",
        },
    )

    assert login.status_code == 200, login.text
    assert login.json()["data"]["user"]["email"] == email
    assert "token" in login.json()["data"]

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {login.json()['data']['token']}"},
    )

    assert me.status_code == 200, me.text
    assert me.json()["data"]["email"] == email
