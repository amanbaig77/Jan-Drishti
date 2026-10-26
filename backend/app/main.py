from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.database import Base, engine

from app.models.user import User
from app.models.complaint import Complaint
from app.models.user_profile import UserProfile

# Social posts
from app.models.social_post import SocialPost

from app.api.complaints import router as complaints_router
from app.api.uploads import router as uploads_router
from app.api.contracts import router as contracts_router
from app.api.resend_webhook import router as resend_webhook_router
from app.api.location import router as location_router
from app.api.auth import router as auth_router

# Social posts
from app.api.social_posts import router as social_posts_router

from app.services.deadline_checker import check_expired_deadlines


# ============================================================
# DATABASE TABLES
# ============================================================

Base.metadata.create_all(
    bind=engine
)


# ============================================================
# DEADLINE SCHEDULER
# ============================================================

scheduler = BackgroundScheduler()

scheduler.add_job(
    check_expired_deadlines,
    "interval",
    minutes=5,
)

scheduler.start()


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="Jan-Drishti API",
    description=(
        "Civic complaint and public grievance "
        "management system"
    ),
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ROUTERS
# ============================================================

app.include_router(
    complaints_router
)

app.include_router(
    uploads_router
)

app.include_router(
    contracts_router
)

app.include_router(
    location_router
)

app.include_router(
    resend_webhook_router
)

app.include_router(
    auth_router
)

# Social posts
app.include_router(
    social_posts_router
)


# ============================================================
# STATIC FILES
# ============================================================

app.mount(
    "/uploads",
    StaticFiles(
        directory="uploads"
    ),
    name="uploads",
)


# ============================================================
# HEALTH
# ============================================================

@app.get("/")
def root():
    return {
        "message": (
            "Jan-Drishti API is running"
        ),
        "status": "success",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }