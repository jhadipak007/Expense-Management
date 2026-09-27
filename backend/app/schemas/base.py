from pydantic import BaseModel, ConfigDict


class InputModel(BaseModel):
    """Base for request bodies: unknown fields are rejected, strings are stripped."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
