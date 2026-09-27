"""Public auth routes: register, login, refresh and logout. No access token required."""

from typing import Annotated

from fastapi import APIRouter, Cookie, HTTPException, Response, status
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.deps import DbSession
from app.schemas.auth import LoginIn, RegisterIn, RegistrationOut, TokenOut, VerifyRegistrationIn
from app.security import create_access_token
from app.services import auth_service, registration_service

router = APIRouter(prefix="/api/auth", tags=["auth"])

REFRESH_COOKIE = "refresh_token"
COOKIE_PATH = "/api/auth"
RefreshCookie = Annotated[str | None, Cookie(alias=REFRESH_COOKIE)]


def set_refresh_cookie(response: Response, raw: str) -> None:
    settings = get_settings()
    response.set_cookie(
        REFRESH_COOKIE,
        raw,
        max_age=settings.refresh_token_idle_minutes * 60,
        path=COOKIE_PATH,
        secure=settings.cookie_secure,
        httponly=True,
        samesite="strict",
    )


def clear_refresh_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        REFRESH_COOKIE, path=COOKIE_PATH, secure=settings.cookie_secure,
        httponly=True, samesite="strict",
    )


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, db: DbSession) -> RegistrationOut:
    """Start a sign-up; the account is created only by `/register/verify`."""
    try:
        registration_id = registration_service.start_registration(
            db, body.display_name, body.email, body.password)
    except registration_service.EmailAlreadyRegistered:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    return RegistrationOut(registration_id=registration_id)


@router.post("/register/verify")
def verify_registration(body: VerifyRegistrationIn, db: DbSession, response: Response) -> TokenOut:
    """Check the OTP, create the user and log them in."""
    try:
        user = registration_service.verify_registration(db, body.registration_id, body.code)
    except registration_service.IncorrectCode:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Incorrect code, please try again")
    except registration_service.RegistrationNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sign-up expired, please start again")
    except registration_service.EmailAlreadyRegistered:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    set_refresh_cookie(response, auth_service.issue_refresh_token(db, user.id))
    return TokenOut(access_token=create_access_token(user.id))


@router.post("/login")
def login(body: LoginIn, db: DbSession, response: Response) -> TokenOut:
    user = auth_service.authenticate_user(db, body.email, body.password)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    set_refresh_cookie(response, auth_service.issue_refresh_token(db, user.id))
    return TokenOut(access_token=create_access_token(user.id))


@router.post("/refresh", response_model=TokenOut)
def refresh(db: DbSession, token: RefreshCookie = None) -> JSONResponse:
    """Rotate the refresh cookie; on failure return 401 and clear the cookie."""
    try:
        user, new_token = auth_service.rotate_refresh_token(db, token or "")
    except auth_service.InvalidRefreshToken:
        response = JSONResponse({"detail": "Session expired"}, status.HTTP_401_UNAUTHORIZED)
        clear_refresh_cookie(response)
        return response
    response = JSONResponse(TokenOut(access_token=create_access_token(user.id)).model_dump())
    set_refresh_cookie(response, new_token)
    return response


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(db: DbSession, response: Response, token: RefreshCookie = None) -> None:
    if token is not None:
        auth_service.revoke_refresh_token(db, token)
    clear_refresh_cookie(response)
