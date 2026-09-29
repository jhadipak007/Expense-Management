"""Report routes: spending summaries for the dashboard."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import CurrentUser, DbSession, get_current_user
from app.schemas.report import ReportFilter, ReportSummaryOut
from app.services import report_service
from app.services.family_access import FamilyNotFound

router = APIRouter(prefix="/api/reports", tags=["reports"],
                   dependencies=[Depends(get_current_user)])


@router.get("/summary")
def get_summary(query: Annotated[ReportFilter, Query()], user: CurrentUser,
                db: DbSession) -> ReportSummaryOut:
    """Personal totals, or one family's totals if `family_id` is a family the user belongs to."""
    try:
        return report_service.summarize(db, user.id, query)
    except FamilyNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Family not found")
