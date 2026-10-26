from datetime import datetime, timezone, timedelta
import os
import hmac
import re

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, Header
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db
from app.core.config import (
    STATE,
    DISTRICTS,
    COMPLAINT_CATEGORIES,
)

from app.models.complaint import Complaint
from app.models.user import User
from fastapi import Request
from app.api.auth import get_session_user

from app.schemas.complaint import (
    ComplaintCreate,
    ComplaintReview,
    ComplaintResponse,
)

from app.services.authority import get_authority
from app.services.authority_contacts import find_authority
from app.services.complaint_ai import analyze_complaint
from app.services.email_service import (
    send_official_complaint_email,
    send_escalation_reminder_email,
)
from app.services.citizen_notification import send_citizen_notification
from app.services.sla_policy import get_sla_days
from app.core.areas import get_areas_by_district
from app.services.x_service import post_to_x


def require_admin_review_key(x_admin_key: str | None = Header(default=None)):
    """Require an admin-only secret for verification (never embed it in frontend source)."""
    configured = os.getenv("JAN_DRISHTI_ADMIN_REVIEW_KEY", "")
    if len(configured) < 24:
        raise HTTPException(status_code=503, detail="Configure JAN_DRISHTI_ADMIN_REVIEW_KEY on backend.")
    if not x_admin_key or not hmac.compare_digest(x_admin_key, configured):
        raise HTTPException(status_code=403, detail="Invalid admin review key.")


def public_x_message(complaint):
    """A minimal verified summary; never publish phone, email, or exact address."""
    category = str(complaint.category or "Civic issue").strip()[:55]
    area = str(complaint.area or "").strip()[:45]
    district = str(complaint.district or "").strip()[:45]
    place = ", ".join(part for part in (area, district) if part)
    # Avoid publishing the original free-text complaint which may contain private details.
    message = f"Verified civic complaint #{complaint.id} | {category} | {place}. Jan Drishti has forwarded this issue for official review. #JanDrishti #CivicIssues"
    return message[:280]


def require_current_user(
    request: Request,
    db: Session = Depends(get_db),
):
    user = get_session_user(request, db)

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Please log in to submit a complaint."
        )

    return user


router = APIRouter(
    prefix="/complaints",
    tags=["Complaints"]
)


def _ensure_consent_table(db: Session):
    """Create the lightweight consent table without changing the existing Complaint model."""
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS complaint_consent (
            complaint_id INTEGER PRIMARY KEY,
            consent_given BOOLEAN NOT NULL DEFAULT FALSE,
            consented_at TIMESTAMP NULL
        )
    """))
    db.commit()


def _save_complaint_consent(db: Session, complaint_id: int, consent_given: bool):
    _ensure_consent_table(db)
    db.execute(
        text("DELETE FROM complaint_consent WHERE complaint_id = :complaint_id"),
        {"complaint_id": complaint_id},
    )
    db.execute(
        text("""
            INSERT INTO complaint_consent
                (complaint_id, consent_given, consented_at)
            VALUES
                (:complaint_id, :consent_given, :consented_at)
        """),
        {
            "complaint_id": complaint_id,
            "consent_given": consent_given,
            "consented_at": datetime.now(timezone.utc) if consent_given else None,
        },
    )
    db.commit()


def _get_complaint_consent(db: Session, complaint_id: int) -> bool:
    _ensure_consent_table(db)
    row = db.execute(
        text("SELECT consent_given FROM complaint_consent WHERE complaint_id = :complaint_id"),
        {"complaint_id": complaint_id},
    ).first()
    return bool(row[0]) if row else False


def _send_authority_notification_now(complaint, background_tasks, db: Session) -> bool:
    """Send an already-created complaint directly when citizen consent is present."""

    recipient_email = complaint.authority_email

    if not recipient_email:
        return False

    # Preserve the existing AI/SLA/email workflow used by admin verification.
    try:
        ai_result = analyze_complaint(complaint)
        complaint.ai_summary = ai_result.get("summary")
        complaint.ai_severity = ai_result.get("severity")
        complaint.ai_public_impact = ai_result.get("public_impact")
        complaint.ai_official_report = ai_result.get("official_report")
    except Exception as exc:
        print(f"Direct-routing AI analysis skipped for Complaint #{complaint.id}: {exc}")

    sla_days = get_sla_days(complaint.category)
    authority_notified_at = datetime.now(timezone.utc)

    complaint.sla_days = sla_days
    complaint.authority_notified_at = authority_notified_at
    complaint.response_deadline = (
        authority_notified_at + timedelta(days=sla_days)
        if sla_days is not None
        else None
    )
    complaint.deadline_crossed = "No"
    complaint.social_escalated = "No"
    complaint.status = "Official Notified"

    db.commit()
    db.refresh(complaint)

    background_tasks.add_task(
        send_complaint_email_background,
        recipient_email,
        complaint.id,
        complaint.state,
        complaint.district,
        complaint.area or "",
        complaint.category,
        complaint.description,
        complaint.duration or "",
        complaint.affected_people or "",
        complaint.affected_groups or "",
        complaint.traffic_impact or "",
        complaint.immediate_danger or "",
        complaint.location_details or "",
        complaint.phone,
        complaint.email,
        complaint.ai_severity or "Medium",
        complaint.ai_public_impact or "",
        complaint.ai_official_report or "",
        complaint.image_url,
        complaint.video_url,
    )

    background_tasks.add_task(
        send_citizen_notification,
        complaint.email,
        complaint.id,
        "Official Notified",
        complaint.district,
        complaint.area or "",
        complaint.category,
    )

    return True


# ============================================================
# GET ALL COMPLAINTS
# ============================================================

@router.get(
    "/",
    response_model=list[ComplaintResponse]
)
def get_complaints(
    db: Session = Depends(get_db)
):
    complaints = (
        db.query(Complaint)
        .order_by(Complaint.id.desc())
        .all()
    )

    return complaints


# ============================================================
# GET DISTRICTS
# ============================================================

@router.get("/districts")
def get_districts():

    return {
        "state": STATE,
        "districts": DISTRICTS
    }

# ============================================================
# GET AREAS BY DISTRICT
# ============================================================

@router.get("/areas")
def get_complaint_areas(
    district: str
):
    areas = get_areas_by_district(district)

    if not areas:
        raise HTTPException(
            status_code=404,
            detail="Areas not found for selected district"
        )

    return {
        "district": district,
        "areas": areas
    }

# ============================================================
# GET CATEGORIES
# ============================================================

@router.get("/categories")
def get_categories():

    return {
        "categories": COMPLAINT_CATEGORIES
    }


# ============================================================
# GET AUTHORITY
# ============================================================

@router.get("/authority")
def get_complaint_authority(
    district: str,
    category: str
):

    authority = get_authority(
        district=district,
        category=category
    )

    if not authority:
        raise HTTPException(
            status_code=404,
            detail="Authority mapping not found"
        )

    return authority


# ============================================================
# GET COMPLAINT CONSENT
# ============================================================

@router.get("/{complaint_id}/consent")
def get_complaint_consent(
    complaint_id: int,
    db: Session = Depends(get_db)
):
    complaint = (
        db.query(Complaint)
        .filter(Complaint.id == complaint_id)
        .first()
    )

    if not complaint:
        raise HTTPException(
            status_code=404,
            detail="Complaint not found"
        )

    return {
        "complaint_id": complaint_id,
        "consent_given": _get_complaint_consent(db, complaint_id),
    }


# ============================================================
# GET SINGLE COMPLAINT
# ============================================================

@router.get(
    "/{complaint_id}",
    response_model=ComplaintResponse
)
def get_complaint(
    complaint_id: int,
    db: Session = Depends(get_db)
):

    complaint = (
        db.query(Complaint)
        .filter(Complaint.id == complaint_id)
        .first()
    )

    if not complaint:
        raise HTTPException(
            status_code=404,
            detail="Complaint not found"
        )

    return complaint


# ============================================================
# CREATE COMPLAINT
# ============================================================

@router.post(
    "/",
    response_model=ComplaintResponse
)
def create_complaint(
    complaint_data: ComplaintCreate,
    background_tasks: BackgroundTasks,
    direct_authorization: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user),
):

    # --------------------------------------------------------
    # Find general authority based on district + category
    # --------------------------------------------------------

    authority_data = get_authority(
        district=complaint_data.district,
        category=complaint_data.category
    )

    # --------------------------------------------------------
    # Find exact demo authority using:
    # District + Area + Category
    # --------------------------------------------------------

    authority_contact = find_authority(
        district=complaint_data.district,
        area=complaint_data.area,
        category=complaint_data.category
    )

    # --------------------------------------------------------
    # Create complaint
    # --------------------------------------------------------

    complaint = Complaint(
        user_id=current_user.id,

        state=complaint_data.state,
        district=complaint_data.district,
        area=complaint_data.area,

        category=complaint_data.category,
        description=complaint_data.description,

        duration=complaint_data.duration,
        affected_people=complaint_data.affected_people,
        affected_groups=complaint_data.affected_groups,
        traffic_impact=complaint_data.traffic_impact,
        immediate_danger=complaint_data.immediate_danger,
        location_details=complaint_data.exact_location,
        latitude=complaint_data.latitude,
        longitude=complaint_data.longitude,

        phone=current_user.phone,
        email=current_user.email,

        image_url=complaint_data.image_url,
        video_url=complaint_data.video_url,

        status="Submitted"
    )

    # --------------------------------------------------------
    # Save authority information
    # --------------------------------------------------------

    if authority_contact:

        complaint.authority = (
            authority_contact["authority_name"]
        )

        complaint.authority_email = (
            authority_contact["email"]
        )

    elif authority_data:

        complaint.authority = (
            authority_data["department"]
        )

        complaint.authority_email = None

    # --------------------------------------------------------
    # Save to database
    # --------------------------------------------------------

    db.add(complaint)

    db.commit()

    db.refresh(complaint)

    # --------------------------------------------------------
    # Save citizen responsibility / sharing consent
    # --------------------------------------------------------

    _save_complaint_consent(
        db,
        complaint.id,
        bool(direct_authorization),
    )

    # --------------------------------------------------------
    # Direct official routing when citizen explicitly agrees
    # --------------------------------------------------------

    if direct_authorization:
        routed = _send_authority_notification_now(
            complaint,
            background_tasks,
            db,
        )

        if routed:
            return complaint

    # No direct authorization (or no mapped official email):
    # keep the existing Admin Review workflow.
    background_tasks.add_task(
        send_citizen_notification,
        complaint.email,
        complaint.id,
        "Submitted",
        complaint.district,
        complaint.area or "",
        complaint.category,
    )

    return complaint


# ============================================================
# UPDATE STATUS
# ============================================================

@router.patch(
    "/{complaint_id}/status"
)
def update_status(
    complaint_id: int,
    status: str,
    db: Session = Depends(get_db)
):

    complaint = (
        db.query(Complaint)
        .filter(Complaint.id == complaint_id)
        .first()
    )

    if not complaint:

        raise HTTPException(
            status_code=404,
            detail="Complaint not found"
        )

    complaint.status = status

    db.commit()

    db.refresh(complaint)

    return {
        "status": "success",
        "complaint_id": complaint.id,
        "new_status": complaint.status
    }


# ============================================================
# EMAIL BACKGROUND TASK
# ============================================================

def send_complaint_email_background(
    recipient_email: str,
    complaint_id: int,

    state: str,
    district: str,
    area: str,
    category: str,
    description: str,

    duration: str,
    affected_people: str,
    affected_groups: str,
    traffic_impact: str,
    immediate_danger: str,
    location_details: str,

    phone: str,
    citizen_email: str,

    severity: str,
    public_impact: str,
    official_report: str,

    image_url: str | None,
    video_url: str | None,
):

    try:

        send_official_complaint_email(

            recipient_email=recipient_email,

            complaint_id=complaint_id,

            state=state,
            district=district,
            area=area,
            category=category,
            description=description,

            duration=duration,
            affected_people=affected_people,
            affected_groups=affected_groups,
            traffic_impact=traffic_impact,
            immediate_danger=immediate_danger,
            location_details=location_details,

            phone=phone,
            citizen_email=citizen_email,

            severity=severity,
            public_impact=public_impact,
            official_report=official_report,
            image_url=image_url,
            video_url=video_url

        )

        print(
            f"Official notification email sent "
            f"for Complaint #{complaint_id}"
        )

    except Exception as e:

        print(
            f"Failed to send email "
            f"for Complaint #{complaint_id}: {e}"
        )


# ============================================================
# REVIEW COMPLAINT
# ============================================================

@router.post(
    "/{complaint_id}/review"
)
def review_complaint(
    complaint_id: int,
    review_data: ComplaintReview,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _admin: None = Depends(require_admin_review_key),
):

    complaint = (
        db.query(Complaint)
        .filter(Complaint.id == complaint_id)
        .first()
    )

    if not complaint:

        raise HTTPException(
            status_code=404,
            detail="Complaint not found"
        )

    action = review_data.action.strip().lower()

    # ========================================================
    # REJECT
    # ========================================================

    if action == "reject":

        if complaint.social_post_id:
            raise HTTPException(status_code=409, detail="Already posted to X; review the public post before changing status.")
        complaint.status = "Rejected"

        db.commit()

        background_tasks.add_task(
            send_citizen_notification,
            complaint.email,
            complaint.id,
            "Rejected",
            complaint.district,
            complaint.area or "",
            complaint.category,
        )

        db.refresh(complaint)

        return {
            "status": "success",
            "complaint_id": complaint.id,
            "action": "reject",
            "new_status": complaint.status
        }

    # ========================================================
    # VERIFY
    # ========================================================

    if action == "verify":

        # A directly authorized complaint has already been sent.
        # Do not send a duplicate official notification if an admin
        # opens/reviews it afterward.
        if complaint.status == "Official Notified":
            db.refresh(complaint)
            return {
                "status": "success",
                "complaint_id": complaint.id,
                "action": "verify",
                "new_status": complaint.status,
                "already_notified": True,
            }

        try:

            # ------------------------------------------------
            # STEP 1: Generate Groq AI report
            # ------------------------------------------------

            ai_result = analyze_complaint(
                complaint
            )

            complaint.ai_summary = (
                ai_result["summary"]
            )

            complaint.ai_severity = (
                ai_result["severity"]
            )

            complaint.ai_public_impact = (
                ai_result["public_impact"]
            )

            complaint.ai_official_report = (
                ai_result["official_report"]
            )

            # ------------------------------------------------
            # STEP 2: Confirm exact authority routing
            # ------------------------------------------------

            demo_authority = find_authority(
                district=complaint.district,
                area=complaint.area or "",
                category=complaint.category
            )

            if demo_authority:

                complaint.authority = (
                    demo_authority["authority_name"]
                )

                complaint.authority_email = (
                    demo_authority["email"]
                )

            # ------------------------------------------------
            # STEP 3: Decide email recipient
            # ------------------------------------------------

            recipient_email = (
                complaint.authority_email
            )

            # IMPORTANT:
            # There is NO fallback email anymore.
            #
            # If District + Area + Category does not have
            # an authority email mapping, stop verification
            # and do not send an official email.

            if not recipient_email:

                raise HTTPException(
                    status_code=400,
                    detail=(
                        "No authority email mapping found for "
                        f"{complaint.district} + "
                        f"{complaint.area or 'Unknown Area'} + "
                        f"{complaint.category}. "
                        "Complaint email was not sent."
                    )
                )

            # ------------------------------------------------
            # STEP 4: Calculate SLA and response deadline
            # ------------------------------------------------

            # SLA starts when Jan-Drishti notifies the authority.
            # Only categories with a configured SLA get a deadline.

            sla_days = get_sla_days(
                complaint.category
            )

            authority_notified_at = (
                datetime.now(timezone.utc)
            )

            complaint.sla_days = sla_days

            complaint.authority_notified_at = (
                authority_notified_at
            )

            complaint.response_deadline = (
                authority_notified_at + timedelta(days=sla_days)
                if sla_days is not None
                else None
            )

            complaint.deadline_crossed = "No"
            complaint.social_escalated = "No"

            # ------------------------------------------------
            # Admin-controlled X escalation
            # ------------------------------------------------

            complaint.x_escalation_enabled = (
            review_data.x_escalation_enabled
            )

            complaint.escalation_reminder_sent = False
            complaint.escalation_reminder_sent_at = None

            # ------------------------------------------------
            # STEP 5: Save AI report + SLA information
            # ------------------------------------------------

            complaint.status = "Verified"

            db.commit()

            db.refresh(complaint)

            # ------------------------------------------------
            # STEP 6: Automatically send official email
            # ------------------------------------------------

            background_tasks.add_task(

                send_complaint_email_background,

                recipient_email,

                complaint.id,

                complaint.state,
                complaint.district,
                complaint.area or "",
                complaint.category,
                complaint.description,

                complaint.duration or "",
                complaint.affected_people or "",
                complaint.affected_groups or "",
                complaint.traffic_impact or "",
                complaint.immediate_danger or "",
                complaint.location_details or "",

                complaint.phone,
                complaint.email,

                complaint.ai_severity or "Medium",
                complaint.ai_public_impact or "",
                complaint.ai_official_report or "",

                complaint.image_url,
                complaint.video_url
            )

            # ------------------------------------------------
            # STEP 7: Mark notification as scheduled
            # ------------------------------------------------

            complaint.status = (
                "Official Notified"
            )

            db.commit()

            # Tell the citizen that the complaint was verified
            # and forwarded to the concerned authority.

            background_tasks.add_task(
                send_citizen_notification,
                complaint.email,
                complaint.id,
                "Official Notified",
                complaint.district,
                complaint.area or "",
                complaint.category,
                authority_name=complaint.authority,
                authority_email=recipient_email,
                sla_days=complaint.sla_days,
                authority_notified_at=complaint.authority_notified_at,
                response_deadline=complaint.response_deadline,
            )

            db.refresh(complaint)

            # Publish immediately on admin verification when X checkbox was selected.
            # Never claim publication on failure; verification and email stay intact.
            x_publication = {"status": "not_requested", "post_url": None}
            if review_data.x_escalation_enabled:
                if complaint.social_post_id:
                    x_publication = {"status": "already_published", "post_url": complaint.social_post_url}
                else:
                    try:
                        published = post_to_x(public_x_message(complaint))
                        complaint.social_post_id = published["post_id"]
                        complaint.social_post_url = published["post_url"]
                        complaint.social_platform = "X"
                        complaint.social_escalated = "Yes"
                        complaint.social_escalated_at = datetime.now(timezone.utc)
                        db.commit()
                        db.refresh(complaint)
                        x_publication = {"status": "published", "post_url": complaint.social_post_url}
                    except Exception as x_exc:
                        db.rollback()
                        # Don't leak API keys or credentials to the browser.
                        print(f"X publication failed for complaint #{complaint.id}: {type(x_exc).__name__}: {x_exc}")
                        x_publication = {"status": "failed", "post_url": None}

            return {
                "id": complaint.id,
                "x_publication": x_publication,
                "social_post_url": complaint.social_post_url,
                "social_escalated": complaint.social_escalated,

                "status": "success",

                "complaint_id": complaint.id,

                "action": "verify",

                "new_status": complaint.status,

                "ai_analysis": {

                    "summary":
                        complaint.ai_summary,

                    "severity":
                        complaint.ai_severity,

                    "public_impact":
                        complaint.ai_public_impact,

                    "official_report":
                        complaint.ai_official_report
                },

                "authority": {

                    "name":
                        complaint.authority,

                    "email":
                        recipient_email
                },

                "notification": {

                    "scheduled": True,

                    "recipient":
                        recipient_email
                },

                "sla": {

                    "sla_days":
                        complaint.sla_days,

                    "authority_notified_at":
                        complaint.authority_notified_at,

                    "response_deadline":
                        complaint.response_deadline,

                    "deadline_crossed":
                        complaint.deadline_crossed
                }
            }

        # ----------------------------------------------------
        # IMPORTANT:
        # Let our intentional HTTPException pass through.
        # Otherwise the generic Exception handler below would
        # convert the 400 into a 500.
        # ----------------------------------------------------

        except HTTPException:

            db.rollback()

            raise

        except Exception as e:

            db.rollback()

            raise HTTPException(

                status_code=500,

                detail=(
                    f"Complaint verification failed: {str(e)}"
                )
            )

    # ========================================================
    # INVALID ACTION
    # ========================================================

    raise HTTPException(

        status_code=400,

        detail=(
            "Invalid action. "
            "Use 'verify' or 'reject'."
        )
    )


# ============================================================
# AUTHORITY RESPONSE
# ============================================================

@router.post(
    "/{complaint_id}/response"
)
def add_authority_response(
    complaint_id: int,
    authority_response: str,
    action_taken: str,
    resolution_status: str,
    resolution_evidence: str | None = None,
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
):

    complaint = (
        db.query(Complaint)
        .filter(Complaint.id == complaint_id)
        .first()
    )

    if not complaint:

        raise HTTPException(
            status_code=404,
            detail="Complaint not found"
        )

    if not authority_response.strip():

        raise HTTPException(
            status_code=400,
            detail="Authority response cannot be empty."
        )

    if not action_taken.strip():

        raise HTTPException(
            status_code=400,
            detail="Action taken cannot be empty."
        )

    allowed_statuses = {
        "In Progress",
        "Resolved",
        "Partially Resolved",
        "Rejected",
    }

    if resolution_status not in allowed_statuses:

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid resolution status. Use: "
                "In Progress, Resolved, Partially Resolved, or Rejected."
            )
        )

    complaint.authority_response = (
        authority_response.strip()
    )

    complaint.action_taken = (
        action_taken.strip()
    )

    complaint.response_date = (
        datetime.now(timezone.utc)
    )

    complaint.resolution_status = (
        resolution_status
    )

    complaint.resolution_evidence = (
        resolution_evidence.strip()
        if resolution_evidence
        else None
    )

    if resolution_status == "Resolved":

        complaint.status = "Resolved"

        notification_status = "Resolved"

    else:

        complaint.status = "Response Received"

        notification_status = "Response Received"

    db.commit()

    db.refresh(complaint)

    if background_tasks is not None:

        background_tasks.add_task(
            send_citizen_notification,
            complaint.email,
            complaint.id,
            notification_status,
            complaint.district,
            complaint.area or "",
            complaint.category,
            complaint.authority_response,
            complaint.action_taken,
            complaint.resolution_status,
        )

    return {

        "status": "success",

        "complaint_id": complaint.id,

        "new_status": complaint.status,

        "resolution_status":
            complaint.resolution_status,

        "response_date":
            complaint.response_date,
    }


# ============================================================
# MANUAL ESCALATION REMINDER CHECK
# ============================================================

@router.post(
    "/{complaint_id}/escalation-reminder"
)
def send_complaint_escalation_reminder(
    complaint_id: int,
    force: bool = False,
    db: Session = Depends(get_db),
):
    complaint = (
        db.query(Complaint)
        .filter(
            Complaint.id == complaint_id
        )
        .first()
    )

    if not complaint:
        raise HTTPException(
            status_code=404,
            detail="Complaint not found",
        )

    # --------------------------------------------------------
    # X escalation must have been enabled by Admin.
    # --------------------------------------------------------

    if not complaint.x_escalation_enabled:
        raise HTTPException(
            status_code=400,
            detail=(
                "X escalation is not enabled "
                "for this complaint."
            ),
        )

    # --------------------------------------------------------
    # Do not remind resolved complaints.
    # --------------------------------------------------------

    if (
        complaint.status == "Resolved"
        or complaint.resolution_status == "Resolved"
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Complaint is already resolved."
            ),
        )

    # --------------------------------------------------------
    # If authority already responded, reminder is unnecessary.
    # --------------------------------------------------------

    if (
        complaint.authority_response
        or complaint.response_date
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Authority response has already "
                "been received."
            ),
        )

    # --------------------------------------------------------
    # Need authority email.
    # --------------------------------------------------------

    if not complaint.authority_email:
        raise HTTPException(
            status_code=400,
            detail=(
                "No authority email is assigned "
                "to this complaint."
            ),
        )

    # --------------------------------------------------------
    # Need SLA deadline.
    # --------------------------------------------------------

    if not complaint.response_deadline:
        raise HTTPException(
            status_code=400,
            detail=(
                "This complaint does not have "
                "a response deadline."
            ),
        )

    # --------------------------------------------------------
    # Only one reminder.
    # --------------------------------------------------------

    if complaint.escalation_reminder_sent:
        raise HTTPException(
            status_code=400,
            detail=(
                "Escalation reminder has already "
                "been sent."
            ),
        )

    now = datetime.now(
        timezone.utc
    )

    reminder_time = (
        complaint.response_deadline
        - timedelta(days=3)
    )

    # --------------------------------------------------------
    # Normal mode:
    # reminder is available only during the final 3 days.
    #
    # force=true is ONLY for our development test.
    # --------------------------------------------------------

    if (
        not force
        and now < reminder_time
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Reminder is not due yet. "
                f"It becomes due on {reminder_time}."
            ),
        )

    # Do not send after deadline.
    if (
        not force
        and now >= complaint.response_deadline
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "The response deadline has already passed."
            ),
        )

    try:

        send_escalation_reminder_email(
            recipient_email=
                complaint.authority_email,

            complaint_id=
                complaint.id,

            district=
                complaint.district,

            area=
                complaint.area or "",

            category=
                complaint.category,

            response_deadline=
                complaint.response_deadline,
        )

        complaint.escalation_reminder_sent = True

        complaint.escalation_reminder_sent_at = (
            now
        )

        db.commit()

        db.refresh(
            complaint
        )

        return {
            "status": "success",

            "complaint_id":
                complaint.id,

            "recipient":
                complaint.authority_email,

            "reminder_sent":
                complaint.escalation_reminder_sent,

            "reminder_sent_at":
                complaint.escalation_reminder_sent_at,

            "response_deadline":
                complaint.response_deadline,
        }

    except HTTPException:
        raise

    except Exception as exc:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to send escalation "
                f"reminder: {str(exc)}"
            ),
        )


# ============================================================
# MANUAL CITIZEN NOTIFICATION RESEND
# ============================================================

@router.post("/{complaint_id}/resend-citizen-notification")
def resend_citizen_notification(
    complaint_id: int,
    db: Session = Depends(get_db),
):
    complaint = (
        db.query(Complaint)
        .filter(Complaint.id == complaint_id)
        .first()
    )

    if not complaint:
        raise HTTPException(
            status_code=404,
            detail="Complaint not found",
        )

    if complaint.status != "Official Notified":
        raise HTTPException(
            status_code=400,
            detail=(
                "Citizen verification notification can only "
                "be resent for an Official Notified complaint."
            ),
        )

    result = send_citizen_notification(
        recipient_email=complaint.email,
        complaint_id=complaint.id,
        status="Official Notified",
        district=complaint.district,
        area=complaint.area or "",
        category=complaint.category,
        authority_name=complaint.authority,
        authority_email=complaint.authority_email,
        sla_days=complaint.sla_days,
        authority_notified_at=complaint.authority_notified_at,
        response_deadline=complaint.response_deadline,
    )

    if (
        isinstance(result, dict)
        and result.get("status") == "failed"
    ):
        raise HTTPException(
            status_code=502,
            detail=(
                "Citizen email could not be sent: "
                f"{result.get('error', 'Unknown email error')}"
            ),
        )

    return {
        "status": "success",
        "complaint_id": complaint.id,
        "recipient": complaint.email,
        "message": (
            "Citizen verification notification sent successfully."
        ),
    }