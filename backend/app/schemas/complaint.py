from datetime import datetime

from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    AliasChoices,
)


# ============================================================
# CREATE COMPLAINT
# ============================================================

class ComplaintCreate(BaseModel):

    state: str = "Uttar Pradesh"

    district: str

    area: str

    latitude: float | None = None
    longitude: float | None = None

    category: str

    description: str = Field(
        min_length=10
    )

    duration: str | None = None

    affected_people: str | None = None

    affected_groups: str | None = None

    traffic_impact: str | None = None

    immediate_danger: str | None = None

    # Public API name = exact_location
    # Database column = location_details

    exact_location: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "exact_location",
            "location_details",
        ),
    )

    # Contact details are resolved from the authenticated user.

    # Photo and video are compulsory
    image_url: str

    video_url: str


# ============================================================
# ADMIN REVIEW
# ============================================================

class ComplaintReview(BaseModel):

    action: str

    # Admin decides whether this complaint should become
    # eligible for public X escalation if its SLA deadline
    # is crossed without a response/resolution.
    #
    # Default False keeps all existing frontend/API calls
    # backwards compatible.

    x_escalation_enabled: bool = False


# ============================================================
# COMPLAINT RESPONSE
# ============================================================

class ComplaintResponse(BaseModel):

    id: int

    state: str

    district: str

    area: str | None = None

    latitude: float | None = None
    longitude: float | None = None

    created_at: datetime | None = None

    category: str

    description: str

    duration: str | None = None

    affected_people: str | None = None

    affected_groups: str | None = None

    traffic_impact: str | None = None

    immediate_danger: str | None = None

    # Public API name = exact_location
    # Database column = location_details

    exact_location: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "exact_location",
            "location_details",
        ),
    )

    # Never expose private contact information in public complaint responses.

    image_url: str | None = None

    video_url: str | None = None


    # ========================================================
    # AI INFORMATION
    # ========================================================

    ai_category: str | None = None

    ai_severity: str | None = None

    ai_summary: str | None = None

    ai_public_impact: str | None = None

    ai_official_report: str | None = None

    ai_evidence_relevant: bool | None = None

    ai_evidence_confidence: float | None = None


    # ========================================================
    # AUTHORITY
    # ========================================================

    authority: str | None = None

    authority_email: str | None = None


    # ========================================================
    # X ESCALATION CONTROL
    # ========================================================

    x_escalation_enabled: bool = False

    escalation_reminder_sent: bool = False

    escalation_reminder_sent_at: datetime | None = None


    # ========================================================
    # SLA / DEADLINE
    # ========================================================

    sla_days: int | None = None

    authority_notified_at: datetime | None = None

    response_deadline: datetime | None = None

    deadline_crossed: str | None = None


    # ========================================================
    # SOCIAL ESCALATION RESULT
    # ========================================================

    social_escalated: str | None = None

    social_platform: str | None = None

    social_post_id: str | None = None

    social_post_url: str | None = None

    social_escalated_at: datetime | None = None


    # ========================================================
    # AUTHORITY RESPONSE
    # ========================================================

    authority_response: str | None = None

    action_taken: str | None = None

    response_date: datetime | None = None

    resolution_status: str | None = None

    resolution_evidence: str | None = None


    # ========================================================
    # CURRENT STATUS
    # ========================================================

    status: str


    # SQLAlchemy model → Pydantic response

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )