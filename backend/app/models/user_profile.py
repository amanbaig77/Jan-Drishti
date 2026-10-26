from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.core.database import Base


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        unique=True,
        nullable=False,
        index=True,
    )

    # Citizen / Helping Community
    account_type = Column(
        String(30),
        nullable=False,
    )

    # NGO / Company / CSR / Individual
    # NULL for Citizen
    helper_type = Column(
        String(30),
        nullable=True,
    )

    # Used mainly for NGO / Company
    organization_name = Column(
        String(150),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )