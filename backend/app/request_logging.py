"""Request ID and one access log line per request."""

import logging
import re
import uuid
from time import perf_counter

from fastapi import Request

from app.logging_config import request_id_var

logger = logging.getLogger("app.access")

VALID_REQUEST_ID = re.compile(r"[A-Za-z0-9-]{1,64}")
QUIET_PATHS = {"/api/health"}  # polled every few seconds by the container health check


async def log_requests(request: Request, call_next):
    """Reuse a valid incoming X-Request-ID or make one, log the request, echo the ID back."""
    incoming = request.headers.get("X-Request-ID", "")
    request_id = incoming if VALID_REQUEST_ID.fullmatch(incoming) else uuid.uuid4().hex
    request_id_var.set(request_id)
    start = perf_counter()
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
    finally:
        if request.url.path not in QUIET_PATHS:
            log_access(request, status, round((perf_counter() - start) * 1000))
    response.headers["X-Request-ID"] = request_id
    return response


def log_access(request: Request, status: int, duration_ms: int) -> None:
    method, path = request.method, request.url.path
    logger.info(
        "%s %s %s %sms", method, path, status, duration_ms,
        extra={"method": method, "path": path, "status": status, "duration_ms": duration_ms,
               "user_id": getattr(request.state, "user_id", None)},
    )
