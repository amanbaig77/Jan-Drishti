from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Boolean,
)

from sqlalchemy.sql import func

from app.core.database import Base


class Complaint(Base):

    __tablename__ = "complaints"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_id = Column(
        Integer,
        nullable=False,
        index=True,
    )

    state = Column(
        String(100),
        nullable=False,
    )

    district = Column(
        String(100),
        nullable=False,
    )

    area = Column(
        String(100),
        nullable=True,
    )

    category = Column(
        String(100),
        nullable=False,
    )

    description = Column(
        Text,
        nullable=False,
    )

    # ============================================================
    # STRUCTURED COMPLAINT INFORMATION
    # ============================================================

    duration = Column(
        String(100),
        nullable=True,
    )

    affected_people = Column(
        String(100),
        nullable=True,
    )

    affected_groups = Column(
        String(200),
        nullable=True,
    )

    traffic_impact = Column(
        String(100),
        nullable=True,
    )

    immediate_danger = Column(
        String(20),
        nullable=True,
    )

    location_details = Column(
        String(255),
        nullable=True,
    )

    # ============================================================
    # GPS LOCATION
    # ============================================================

    latitude = Column(
        String(50),
        nullable=True,
    )

    longitude = Column(
        String(50),
        nullable=True,
    )

    # ============================================================
    # CITIZEN INFORMATION
    # ============================================================

    phone = Column(
        String(15),
        nullable=False,
    )

    email = Column(
        String(150),
        nullable=False,
    )

    # ============================================================
    # SUPPORTING EVIDENCE
    # ============================================================

    image_url = Column(
        String(500),
        nullable=True,
    )

    video_url = Column(
        String(500),
        nullable=True,
    )

    # ============================================================
    # GENAI-GENERATED INFORMATION
    # ============================================================

    ai_category = Column(
        String(100),
        nullable=True,
    )

    ai_severity = Column(
        String(50),
        nullable=True,
    )

    ai_summary = Column(
        Text,
        nullable=True,
    )

    ai_public_impact = Column(
        Text,
        nullable=True,
    )

    ai_official_report = Column(
        Text,
        nullable=True,
    )

    # ============================================================
    # OPTIONAL EVIDENCE ANALYSIS
    # ============================================================

    ai_evidence_relevant = Column(
        String(20),
        nullable=True,
    )

    ai_evidence_confidence = Column(
        String(20),
        nullable=True,
    )

    # ============================================================
    # AUTHORITY INFORMATION
    # ============================================================

    authority = Column(
        String(200),
        nullable=True,
    )

    authority_email = Column(
        String(200),
        nullable=True,
    )

    # ============================================================
    # SLA / ESCALATION INFORMATION
    # ============================================================

    # Number of days allowed for the applicable response timeline
    sla_days = Column(
        Integer,
        nullable=True,
    )

    # Exact date/time when the complaint was officially
    # notified to the concerned authority
    authority_notified_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Calculated deadline for the authority response
    response_deadline = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Whether the response deadline has crossed
    # Possible values: Yes / No
    deadline_crossed = Column(
        String(20),
        nullable=False,
        default="No",
    )

    # ============================================================
    # X ESCALATION CONTROL
    # ============================================================

    # Admin decides whether this complaint should be eligible
    # for public X escalation if its deadline is crossed.
    x_escalation_enabled = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    # Whether the pre-deadline escalation reminder
    # has already been sent.
    escalation_reminder_sent = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    # Exact time when that reminder was sent.
    escalation_reminder_sent_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    # ============================================================
    # SOCIAL MEDIA ESCALATION
    # ============================================================

    # Whether this complaint has already been escalated
    # Possible values: Yes / No
    social_escalated = Column(
        String(20),
        nullable=False,
        default="No",
    )

    # Platform used for escalation
    # Example: X / Instagram
    social_platform = Column(
        String(50),
        nullable=True,
    )

    # ID returned by the social-media platform
    social_post_id = Column(
        String(200),
        nullable=True,
    )

    # Public URL of the social-media post
    social_post_url = Column(
        String(500),
        nullable=True,
    )

    # Date/time when social escalation happened
    social_escalated_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    # ============================================================
    # AUTHORITY RESPONSE / RESOLUTION
    # ============================================================

    authority_response = Column(
        Text,
        nullable=True,
    )

    action_taken = Column(
        Text,
        nullable=True,
    )

    response_date = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    resolution_status = Column(
        String(50),
        nullable=True,
    )

    resolution_evidence = Column(
        String(500),
        nullable=True,
    )

    # ============================================================
    # ADMIN + COMPLAINT WORKFLOW
    # ============================================================

    status = Column(
        String(50),
        nullable=False,
        default="Submitted",
    )

    # ============================================================
    # TIMESTAMP
    # ============================================================

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )