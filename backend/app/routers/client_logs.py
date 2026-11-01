"""Browser errors forwarded to the server log. Public, so errors on the login page arrive too."""

import logging

from fastapi import APIRouter, Request, status

from app.schemas.client_log import ClientLogsIn

router = APIRouter(prefix="/api", tags=["client-logs"])

# WARNING, not ERROR: anyone can post here, so these must not trigger the server error alarm.
logger = logging.getLogger("client")


@router.post("/client-logs", status_code=status.HTTP_204_NO_CONTENT)
def client_logs(body: ClientLogsIn, request: Request) -> None:
    user_agent = request.headers.get("User-Agent", "")[:300]
    for entry in body.entries:
        logger.warning("client error", extra={
            "client_message": entry.message, "stack": entry.stack, "url": entry.url,
            "api_request_id": entry.request_id, "user_agent": user_agent,
        })
