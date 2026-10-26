from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
)
from sqlalchemy.sql import func

from app.core.database import Base


class ContractRequest(Base):

    __tablename__ = "contract_requests"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # --------------------------------------------------
    # REQUESTER DETAILS
    # --------------------------------------------------

    requester_name = Column(
        String(150),
        nullable=False
    )

    requester_type = Column(
        String(100),
        nullable=False
    )

    organization_name = Column(
        String(200),
        nullable=True
    )

    phone = Column(
        String(20),
        nullable=False
    )

    email = Column(
        String(200),
        nullable=False
    )

    # --------------------------------------------------
    # LOCATION
    # --------------------------------------------------

    state = Column(
        String(100),
        nullable=False,
        default="Uttar Pradesh"
    )

    district = Column(
        String(100),
        nullable=False
    )

    area = Column(
        String(150),
        nullable=False
    )

    exact_location = Column(
        Text,
        nullable=False
    )

    # --------------------------------------------------
    # WORK DETAILS
    # --------------------------------------------------

    work_category = Column(
        String(150),
        nullable=False
    )

    work_title = Column(
        String(200),
        nullable=False
    )

    description = Column(
        Text,
        nullable=False
    )

    expected_scope = Column(
        Text,
        nullable=True
    )

    approximate_budget = Column(
        String(100),
        nullable=True
    )

    desired_timeline = Column(
        String(100),
        nullable=True
    )

    # --------------------------------------------------
    # SUPPORTING EVIDENCE
    # --------------------------------------------------

    image_url = Column(
        Text,
        nullable=True
    )

    video_url = Column(
        Text,
        nullable=True
    )

    document_url = Column(
        Text,
        nullable=True
    )

    # --------------------------------------------------
    # JAN-DRISHTI PROCESS
    # --------------------------------------------------

    status = Column(
        String(100),
        nullable=False,
        default="Submitted"
    )

    assigned_partner = Column(
        String(200),
        nullable=True
    )

    estimated_cost = Column(
        String(100),
        nullable=True
    )

    proposed_timeline = Column(
        String(100),
        nullable=True
    )

    warranty_period = Column(
        String(100),
        nullable=True
    )

    admin_notes = Column(
        Text,
        nullable=True
    )

    # --------------------------------------------------
    # TIMESTAMPS
    # --------------------------------------------------

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )