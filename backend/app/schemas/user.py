from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import InputModel


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    display_name: str
    month_start_day: int


class UserSettingsIn(InputModel):
    """Settings the user can change. Days 29 to 31 are excluded so every month has the day."""

    month_start_day: int = Field(ge=1, le=28)
