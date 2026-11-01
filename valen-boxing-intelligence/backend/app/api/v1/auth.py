from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.responses import error_response, success_response
from app.schemas.auth import AuthTokenResponse, ForgotPasswordRequest, LoginRequest, RegisterRequest, ResetPasswordRequest, UserPublic
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201)
def register_user(data: RegisterRequest, db: Session = Depends(get_db)):
    try:
        user = auth_service.create_user(db, data.full_name, data.email, data.password, data.role)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=error_response("AUTH_INVALID", str(exc))['error']) from exc

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
        raise HTTPException(status_code=401, detail=error_response("AUTH_INVALID", str(exc))['error']) from exc

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
    return success_response({"status": "logged_out"})


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest):
    return success_response({
        "message": "If an account exists for this email, a reset link has been sent.",
        "email": data.email,
    })


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest):
    if not data.token:
        raise HTTPException(status_code=400, detail=error_response("AUTH_INVALID", "Reset token is required.")['error'])
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail=error_response("AUTH_INVALID", "Password must be at least 8 characters long.")['error'])
    return success_response({"message": "Password reset request accepted."})
