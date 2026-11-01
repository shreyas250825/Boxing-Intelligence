import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User

ALLOWED_ROLES = {"coach", "fighter", "gym_admin", "platform_admin"}


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16).encode("utf-8")
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000)
    return f"pbkdf2_sha256${salt.decode('utf-8')}${derived.hex()}" 


def verify_password(password: str, password_hash: str) -> bool:
    try:
        _, salt_hex, digest_hex = password_hash.split("$")
        derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_hex.encode("utf-8"), 200_000)
        return hmac.compare_digest(derived.hex(), digest_hex)
    except ValueError:
        return False


def generate_token(user: User) -> str:
    payload = {
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "exp": int(time.time()) + 86400,
    }
    payload_json = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode("utf-8")).decode("utf-8").rstrip("=")
    signature = hmac.new(settings.SECRET_KEY.encode("utf-8"), payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload_b64}.{signature}"


def verify_token(token: str) -> dict[str, Any]:
    if not token or "." not in token:
        raise HTTPException(status_code=401, detail={"error": {"code": "INVALID_TOKEN", "message": "Authentication token is missing or invalid."}})

    payload_b64, signature = token.split(".", 1)
    expected = hmac.new(settings.SECRET_KEY.encode("utf-8"), payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail={"error": {"code": "INVALID_TOKEN", "message": "Authentication token is invalid."}})

    try:
        padded = payload_b64 + "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=401, detail={"error": {"code": "INVALID_TOKEN", "message": "Authentication token is malformed."}}) from exc

    if int(payload.get("exp", 0)) < time.time():
        raise HTTPException(status_code=401, detail={"error": {"code": "TOKEN_EXPIRED", "message": "Authentication token has expired."}})

    return payload


def get_user_from_token(db: Session, token: str) -> User:
    payload = verify_token(token)
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=401, detail={"error": {"code": "USER_NOT_FOUND", "message": "Authenticated user no longer exists."}})
    if not user.is_active:
        raise HTTPException(status_code=401, detail={"error": {"code": "USER_DISABLED", "message": "This account is disabled."}})
    return user


def get_bearer_token(request: Request) -> str:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail={"error": {"code": "MISSING_TOKEN", "message": "Authorization header is required."}})
    return header.split(" ", 1)[1].strip()


def create_user(db: Session, full_name: str, email: str, password: str, role: str = "coach") -> User:
    email = email.strip().lower()
    if len(password) < 8:
        raise ValueError("Password must contain at least 8 characters.")
    if role not in ALLOWED_ROLES:
        raise ValueError("Role is not supported.")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise ValueError("A user with this email already exists.")

    user = User(
        full_name=full_name.strip(),
        email=email,
        password_hash=hash_password(password),
        role=role,
        is_active=True,
        email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User:
    email = email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise ValueError("Invalid email or password.")
    if not verify_password(password, user.password_hash):
        raise ValueError("Invalid email or password.")
    if not user.is_active:
        raise ValueError("This account is disabled.")
    return user
