"""FastAPI app: /api routes, security middleware and the built frontend."""

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse

from app.config import get_settings
from app.routers import auth, categories, expenses, families, health, invitations, users

SECURITY_HEADERS = {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'",
}


def create_app() -> FastAPI:
    settings = get_settings()
    logging.basicConfig(level=settings.log_level)
    docs = settings.enable_api_docs
    app = FastAPI(
        title="Expense Sarathi",
        docs_url="/docs" if docs else None,
        redoc_url="/redoc" if docs else None,
        openapi_url="/openapi.json" if docs else None,
    )
    # The last middleware added runs first: headers wrap every response, including host rejections.
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)
    app.middleware("http")(add_security_headers)
    for module in (health, auth, users, families, invitations, categories, expenses):
        app.include_router(module.router)
    dist = Path(settings.frontend_dist_dir)
    if dist.is_dir():
        add_frontend_routes(app, dist)
    return app


async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.update(SECURITY_HEADERS)
    if request.url.path.startswith("/api"):
        response.headers["Cache-Control"] = "no-store"
    return response


def add_frontend_routes(app: FastAPI, dist: Path) -> None:
    """Serve built files, and index.html for every other non-API path (deep links)."""
    root = dist.resolve()

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str) -> FileResponse:
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404)
        file = (root / path).resolve()
        if file.is_file() and file.is_relative_to(root):
            return FileResponse(file)
        return FileResponse(root / "index.html")


app = create_app()
