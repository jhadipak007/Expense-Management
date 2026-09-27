"""Public auth routes: login, refresh and logout. No access token required."""

from typing import Annotated

from fastapi import APIRouter, Cookie, HTTPException, Response, status
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.deps import DbSession
from app.schemas.auth import LoginIn, TokenOut
from app.security import create_access_token
from app.services import auth_service

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
