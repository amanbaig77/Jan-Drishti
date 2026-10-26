import re
from typing import Literal

from pydantic import BaseModel, field_validator, model_validator


class RegisterRequest(BaseModel):

    name: str

    username: str

    email: str

    phone: str

    password: str

    account_type: Literal[
        "Citizen",
        "Helping Community",
    ]

    helper_type: Literal[
        "NGO",
        "Company / CSR",
        "Individual",
    ] | None = None

    organization_name: str | None = None


    @field_validator("name")
    @classmethod
    def validate_name(cls, value):
        value = value.strip()

        if len(value) < 2:
            raise ValueError(
                "Please enter your name."
            )

        return value


    @field_validator("username")
    @classmethod
    def validate_username(cls, value):
        value = value.strip().lower()

        # User may type @aman_civic.
        # We store only aman_civic in the database.
        if value.startswith("@"):
            value = value[1:]

        if len(value) < 3:
            raise ValueError(
                "Username must be at least 3 characters."
            )

        if len(value) > 30:
            raise ValueError(
                "Username must be 30 characters or fewer."
            )

        if not re.fullmatch(
            r"[a-z0-9._]+",
            value,
        ):
            raise ValueError(
                "Username can only contain letters, numbers, "
                "underscores, and dots."
            )

        if value.startswith(".") or value.endswith("."):
            raise ValueError(
                "Username cannot start or end with a dot."
            )

        if ".." in value:
            raise ValueError(
                "Username cannot contain consecutive dots."
            )

        return value


    @field_validator("email")
    @classmethod
    def validate_email(cls, value):
        value = value.strip().lower()

        if "@" not in value or "." not in value:
            raise ValueError(
                "Please enter a valid email address."
            )

        return value


    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value):
        value = value.strip()

        digits = "".join(
            character
            for character in value
            if character.isdigit()
        )

        if len(digits) < 10:
            raise ValueError(
                "Please enter a valid phone number."
            )

        return digits


    @field_validator("password")
    @classmethod
    def validate_password(cls, value):
        if len(value) < 6:
            raise ValueError(
                "Password must be at least 6 characters."
            )

        return value


    @model_validator(mode="after")
    def validate_account_type(self):

        if (
            self.account_type
            == "Helping Community"
            and not self.helper_type
        ):
            raise ValueError(
                "Please select NGO, Company / CSR, or Individual."
            )


        if (
            self.account_type
            == "Citizen"
        ):
            self.helper_type = None
            self.organization_name = None


        if (
            self.helper_type
            in [
                "NGO",
                "Company / CSR",
            ]
            and not (
                self.organization_name
                and self.organization_name.strip()
            )
        ):
            raise ValueError(
                "Organization name is required."
            )


        if self.organization_name:
            self.organization_name = (
                self.organization_name.strip()
            )


        return self


class RegisterResponse(BaseModel):

    user_id: int

    name: str

    username: str

    email: str

    phone: str

    account_type: str

    helper_type: str | None = None

    organization_name: str | None = None

    message: str