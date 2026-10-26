from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    field_validator,
)


class SocialPostCreate(BaseModel):

    text: str

    image_url: str | None = None

    video_url: str | None = None


    @field_validator("text")
    @classmethod
    def validate_text(cls, value):

        value = value.strip()

        if not value:
            raise ValueError(
                "Post text cannot be empty."
            )

        if len(value) > 2000:
            raise ValueError(
                "Post must be 2000 characters or fewer."
            )

        return value


    @field_validator(
        "image_url",
        "video_url",
    )
    @classmethod
    def clean_optional_url(
        cls,
        value,
    ):

        if value is None:
            return None

        value = value.strip()

        return value or None


class SocialPostResponse(BaseModel):

    id: int

    user_id: int

    username: str | None = None

    name: str | None = None

    text: str

    image_url: str | None = None

    video_url: str | None = None

    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )