from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    name = Column(
        String(100),
        nullable=False,
    )

    # Public Jan-Drishti identity.
    #
    # Kept nullable temporarily because existing accounts
    # were created before username support was added.
    # All NEW registrations require a username through
    # the registration schema.
    username = Column(
        String(50),
        unique=True,
        nullable=True,
        index=True,
    )

    email = Column(
        String(150),
        unique=True,
        nullable=False,
        index=True,
    )

    phone = Column(
        String(15),
        unique=True,
        nullable=False,
    )

    password_hash = Column(
        String(255),
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )