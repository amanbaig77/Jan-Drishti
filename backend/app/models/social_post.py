from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)

from sqlalchemy.sql import func

from app.core.database import Base


# ============================================================
# SOCIAL POST
# ============================================================

class SocialPost(Base):

    __tablename__ = "social_posts"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    text = Column(
        Text,
        nullable=False,
    )

    image_url = Column(
        String(500),
        nullable=True,
    )

    video_url = Column(
        String(500),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


# ============================================================
# SOCIAL POST LIKE
# One user can like a post only once.
# ============================================================

class SocialPostLike(Base):

    __tablename__ = "social_post_likes"

    __table_args__ = (
        UniqueConstraint(
            "post_id",
            "user_id",
            name="uq_social_post_like_user",
        ),
    )

    id = Column(
        Integer,
        primary_key=True,
    )

    post_id = Column(
        Integer,
        ForeignKey(
            "social_posts.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


# ============================================================
# SOCIAL POST COMMENT
# ============================================================

class SocialPostComment(Base):

    __tablename__ = "social_post_comments"

    id = Column(
        Integer,
        primary_key=True,
    )

    post_id = Column(
        Integer,
        ForeignKey(
            "social_posts.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    text = Column(
        Text,
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


# ============================================================
# SOCIAL POST VIEW
#
# One authenticated user = one unique view per post.
# One guest browser = one unique view per post.
# ============================================================

class SocialPostView(Base):

    __tablename__ = "social_post_views"

    __table_args__ = (
        UniqueConstraint(
            "post_id",
            "viewer_key",
            name="uq_social_post_viewer",
        ),
    )

    id = Column(
        Integer,
        primary_key=True,
    )

    post_id = Column(
        Integer,
        ForeignKey(
            "social_posts.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    viewer_key = Column(
        String(128),
        nullable=False,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )