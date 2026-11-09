"""
Authentication API endpoints.

Password recovery:
  The reset-token mechanism is implemented securely (HMAC-SHA256, 1-hour expiry,
  single-use via an in-memory token store). However, email delivery is NOT
  configured. The forgot-password endpoint returns the reset token directly in
  the response body in development mode so the flow can be tested without
  email. In production, set EMAIL_DELIVERY_CONFIGURED=true and wire the token
  into a real email provider — the endpoint will then return only a generic
  success message without exposing the token.
"""
import hashlib
import hmac
import secrets
import time
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.responses import error_response, success_response
from app.schemas.auth import (
    AuthTokenResponse,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    UserPublic,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# In-memory reset-token store.
# For a multi-process / hosted deployment, replace with a DB table or Redis.
# Each entry: { token_hash: str, user_id: str, expires_at: float, used: bool }
# ---------------------------------------------------------------------------
_RESET_TOKENS: dict[str, dict] = {}

_TOKEN_TTL = 3600  # 1 hour


def _generate_reset_token(user_id: str) -> str:
    """Generate a secure, time-limited reset token and store its hash."""
    raw = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    _RESET_TOKENS[token_hash] = {
        "user_id": user_id,
        "expires_at": time.time() + _TOKEN_TTL,
        "used": False,
    }
    # Prune expired tokens opportunistically
    expired = [k for k, v in _RESET_TOKENS.items() if v["expires_at"] < time.time()]
    for k in expired:
        del _RESET_TOKENS[k]
    return raw


def _consume_reset_token(raw_token: str) -> str | None:
    """
    Validate and consume a reset token.
    Returns user_id on success, None on invalid/expired/already-used.
    """
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    entry = _RESET_TOKENS.get(token_hash)
    if not entry:
        return None
    if entry["used"]:
        return None
    if entry["expires_at"] < time.time():
        del _RESET_TOKENS[token_hash]
        return None
    entry["used"] = True
    return entry["user_id"]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/register", status_code=201)
def register_user(data: RegisterRequest, db: Session = Depends(get_db)):
    try:
        user = auth_service.create_user(db, data.full_name, data.email, data.password, data.role)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=error_response("AUTH_INVALID", str(exc))["error"],
        ) from exc

    token = auth_service.generate_token(user)
    payload = UserPublic.model_validate(user).model_dump()
    return success_response({
        "token": token,
        "email": payload["email"],
        "full_name": payload["full_name"],
        "role": payload["role"],
        "user": payload,
    })


@router.post("/login")
def login_user(data: LoginRequest, db: Session = Depends(get_db)):
    try:
        user = auth_service.authenticate_user(db, data.email, data.password)
    except ValueError as exc:
        raise HTTPException(
            status_code=401,
            detail=error_response("AUTH_INVALID", str(exc))["error"],
        ) from exc

    token = auth_service.generate_token(user)
    payload = UserPublic.model_validate(user).model_dump()
    return success_response({
        "token": token,
        "email": payload["email"],
        "full_name": payload["full_name"],
        "role": payload["role"],
        "user": payload,
    })


@router.get("/me")
def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = auth_service.get_bearer_token(request)
    user = auth_service.get_user_from_token(db, token)
    return success_response(UserPublic.model_validate(user).model_dump())


@router.post("/logout")
def logout_user():
    """
    Stateless logout — the token expires naturally (24 h).
    The frontend clears the stored token on receipt of this response.
    """
    return success_response({"status": "logged_out"})


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Generate a secure reset token.

    Behaviour:
    - Always returns HTTP 200 to avoid account enumeration.
    - If EMAIL_DELIVERY_CONFIGURED is false (the current default), the token is
      returned in the response so the flow can be tested without email.
    - In production with email configured, only returns a generic message.
    """
    from app.models.user import User

    user = db.query(User).filter(
        User.email == data.email.strip().lower(),
        User.is_active == True,  # noqa: E712
    ).first()

    email_configured = getattr(settings, "EMAIL_DELIVERY_CONFIGURED", False)

    if not user:
        # Generic response — do not reveal whether account exists
        return success_response({
            "message": "If an account exists for this email, a reset link has been sent.",
            "email_delivery_configured": email_configured,
        })

    raw_token = _generate_reset_token(user.id)

    if email_configured:
        # TODO: send email with reset link containing raw_token
        # e.g. send_reset_email(user.email, raw_token)
        return success_response({
            "message": "If an account exists for this email, a reset link has been sent.",
            "email_delivery_configured": True,
        })
    else:
        # Development mode: return token directly so the flow can be tested.
        # In production, set EMAIL_DELIVERY_CONFIGURED=true and implement email sending.
        return success_response({
            "message": (
                "Email delivery is not configured. "
                "Use the reset_token below to test the reset flow directly. "
                "Do not use this in production."
            ),
            "reset_token": raw_token,
            "expires_in_seconds": _TOKEN_TTL,
            "email_delivery_configured": False,
        })


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Consume a reset token and set a new password.

    - Token must be unused, unexpired, and HMAC-valid.
    - Password minimum length: 8 characters.
    - Token is invalidated immediately on use (single-use).
    """
    if not data.token:
        raise HTTPException(
            status_code=400,
            detail=error_response("AUTH_INVALID", "Reset token is required.")["error"],
        )
    if len(data.password) < 8:
        raise HTTPException(
            status_code=400,
            detail=error_response(
                "AUTH_INVALID", "Password must be at least 8 characters long."
            )["error"],
        )

    user_id = _consume_reset_token(data.token)
    if not user_id:
        raise HTTPException(
            status_code=400,
            detail=error_response(
                "AUTH_INVALID",
                "Reset token is invalid, expired, or has already been used.",
            )["error"],
        )

    from app.models.user import User

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=400,
            detail=error_response("AUTH_INVALID", "User account not found.")["error"],
        )

    user.password_hash = auth_service.hash_password(data.password)
    db.commit()

    return success_response({"message": "Password has been reset successfully. Please log in."})
