import base64
import hashlib
import os
import hmac
import time
import secrets
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import or_
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.user_profile import UserProfile
from app.schemas.auth import RegisterRequest, RegisterResponse


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


# ============================================================
# PASSWORD HASHING
# ============================================================

def hash_password(password: str) -> str:
    """
    Simple secure password hashing for the hackathon MVP.

    We never store the original password.
    """

    iterations = 310000

    salt = os.urandom(16)

    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
    )

    encoded_salt = base64.b64encode(
        salt
    ).decode("utf-8")

    encoded_hash = base64.b64encode(
        password_hash
    ).decode("utf-8")


    return (
        f"pbkdf2_sha256"
        f"${iterations}"
        f"${encoded_salt}"
        f"${encoded_hash}"
    )


# ============================================================
# REGISTER
# ============================================================

@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=201,
)
def register_user(
    data: RegisterRequest,
    db: Session = Depends(get_db),
):

    username = data.username.strip().lower()

    email = data.email.strip().lower()

    phone = data.phone.strip()


    # --------------------------------------------------------
    # DUPLICATE ACCOUNT CHECK
    # --------------------------------------------------------

    existing_user = (
        db.query(User)
        .filter(
            or_(
                User.username == username,
                User.email == email,
                User.phone == phone,
            )
        )
        .first()
    )


    if existing_user:

        if (
            existing_user.username
            == username
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "This username is already taken. "
                    "Please choose another username."
                ),
            )

        if (
            existing_user.email
            == email
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "An account with this email "
                    "already exists."
                ),
            )

        raise HTTPException(
            status_code=409,
            detail=(
                "An account with this phone number "
                "already exists."
            ),
        )


    try:

        # ----------------------------------------------------
        # CREATE BASIC USER
        # ----------------------------------------------------

        user = User(
            name=data.name.strip(),
            username=username,
            email=email,
            phone=phone,
            password_hash=hash_password(
                data.password
            ),
        )


        db.add(user)

        # Gives us user.id without committing yet
        db.flush()


        # ----------------------------------------------------
        # CREATE PROFILE
        # ----------------------------------------------------

        profile = UserProfile(
            user_id=user.id,
            account_type=data.account_type,
            helper_type=data.helper_type,
            organization_name=(
                data.organization_name
                if data.organization_name
                else None
            ),
        )


        db.add(profile)

        db.commit()

        db.refresh(user)
        db.refresh(profile)


    except Exception as error:

        db.rollback()

        print(
            "Registration error:",
            error,
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to create account.",
        )


    # --------------------------------------------------------
    # SAFE RESPONSE
    # Password/password_hash is NEVER returned
    # --------------------------------------------------------

    return RegisterResponse(
        user_id=user.id,
        name=user.name,
        username=user.username,
        email=user.email,
        phone=user.phone,
        account_type=profile.account_type,
        helper_type=profile.helper_type,
        organization_name=profile.organization_name,
        message="Account created successfully.",
    )


# ============================================================
# AUTHENTICATION: signed HTTP-only cookie
# ============================================================
# Set JAN_DRISHTI_SESSION_SECRET to a long random secret in your
# backend environment. Keep the same value across server restarts.

SESSION_SECRET = os.environ.get(
    "JAN_DRISHTI_SESSION_SECRET",
    ""
)

COOKIE_NAME = "jan_drishti_session"

SESSION_LIFETIME = 60 * 60 * 24 * 7  # 7 days

COOKIE_SECURE = os.environ.get(
    "JAN_DRISHTI_COOKIE_SECURE",
    "false"
).lower() == "true"


class LoginRequest(BaseModel):
    email: str
    password: str


def verify_password(
    password: str,
    stored_hash: str,
) -> bool:

    try:
        algorithm, iterations, salt, expected = (
            stored_hash.split("$", 3)
        )

        if algorithm != "pbkdf2_sha256":
            return False

        count = int(iterations)

        if not 100000 <= count <= 1000000:
            return False

        actual = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            base64.b64decode(
                salt,
                validate=True,
            ),
            count,
        )

        return hmac.compare_digest(
            actual,
            base64.b64decode(
                expected,
                validate=True,
            ),
        )

    except (
        ValueError,
        TypeError,
        base64.binascii.Error,
    ):
        return False


def require_secret():

    if len(SESSION_SECRET) < 32:
        raise HTTPException(
            status_code=503,
            detail=(
                "Server session secret "
                "is not configured."
            ),
        )

    return SESSION_SECRET.encode("utf-8")


def sign_session(user_id: int) -> str:

    expires = (
        int(time.time())
        + SESSION_LIFETIME
    )

    payload = f"{user_id}:{expires}"

    signature = hmac.new(
        require_secret(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()

    return (
        f"{payload}:"
        f"{signature}"
    )


def get_session_user(
    request: Request,
    db: Session,
):

    token = request.cookies.get(
        COOKIE_NAME,
        "",
    )

    try:
        user_id, expiry, signature = (
            token.split(":", 2)
        )

        if (
            not user_id.isdecimal()
            or not expiry.isdecimal()
        ):
            return None

        if int(expiry) < time.time():
            return None

        payload = (
            f"{user_id}:"
            f"{expiry}"
        )

        expected = hmac.new(
            require_secret(),
            payload.encode(),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(
            signature,
            expected,
        ):
            return None

        return (
            db.query(User)
            .filter(
                User.id == int(user_id)
            )
            .first()
        )

    except (
        ValueError,
        TypeError,
    ):
        return None


def public_user(
    user: User,
    db: Session,
):

    profile = (
        db.query(UserProfile)
        .filter(
            UserProfile.user_id
            == user.id
        )
        .first()
    )

    return {
        "user_id": user.id,
        "name": user.name,
        "username": user.username,
        "email": user.email,
        "account_type": (
            profile.account_type
            if profile
            else "Citizen"
        ),
        "helper_type": (
            profile.helper_type
            if profile
            else None
        ),
        "organization_name": (
            profile.organization_name
            if profile
            else None
        ),
    }


# ============================================================
# LOGIN
# ============================================================

@router.post("/login")
def login_user(
    data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):

    require_secret()

    email = data.email.strip().lower()

    user = (
        db.query(User)
        .filter(
            User.email == email
        )
        .first()
    )

    if (
        not user
        or not verify_password(
            data.password,
            user.password_hash,
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password.",
        )

    response.set_cookie(
        key=COOKIE_NAME,
        value=sign_session(user.id),
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=SESSION_LIFETIME,
        path="/",
    )

    return {
        "success": True,
        "authenticated": True,
        "user": public_user(
            user,
            db,
        ),
    }


# ============================================================
# CURRENT USER
# ============================================================

@router.get("/me")
def current_user(
    request: Request,
    db: Session = Depends(get_db),
):

    user = get_session_user(
        request,
        db,
    )

    if not user:
        return {
            "success": True,
            "authenticated": False,
            "user": None,
        }

    return {
        "success": True,
        "authenticated": True,
        "user": public_user(
            user,
            db,
        ),
    }


# ============================================================
# LOGOUT
# ============================================================

@router.post("/logout")
def logout_user(
    response: Response,
):

    response.delete_cookie(
        COOKIE_NAME,
        path="/",
        samesite="lax",
        secure=COOKIE_SECURE,
        httponly=True,
    )

    return {
        "success": True,
        "authenticated": False,
    }