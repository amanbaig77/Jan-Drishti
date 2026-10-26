from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
)

from sqlalchemy.orm import Session

from app.core.database import get_db

from app.models.social_post import SocialPost
from app.models.user import User

from app.schemas.social_post import (
    SocialPostCreate,
    SocialPostResponse,
)

from app.api.auth import get_session_user


router = APIRouter(
    prefix="/social-posts",
    tags=["Social Posts"],
)


# ============================================================
# CURRENT USER REQUIRED
# ============================================================

def require_current_user(
    request: Request,
    db: Session = Depends(get_db),
):

    user = get_session_user(
        request,
        db,
    )

    if user is None:
        raise HTTPException(
            status_code=401,
            detail=(
                "Please log in to create a post."
            ),
        )

    return user


# ============================================================
# BUILD PUBLIC RESPONSE
# ============================================================

def build_post_response(
    post: SocialPost,
    user: User | None,
):

    return SocialPostResponse(
        id=post.id,
        user_id=post.user_id,

        username=(
            user.username
            if user
            else None
        ),

        name=(
            user.name
            if user
            else None
        ),

        text=post.text,

        image_url=post.image_url,

        video_url=post.video_url,

        created_at=post.created_at,
    )


# ============================================================
# CREATE SOCIAL POST
# ============================================================

@router.post(
    "/",
    response_model=SocialPostResponse,
    status_code=201,
)
def create_social_post(
    post_data: SocialPostCreate,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        require_current_user
    ),
):

    post = SocialPost(
        user_id=current_user.id,

        text=post_data.text,

        image_url=post_data.image_url,

        video_url=post_data.video_url,
    )

    db.add(post)

    db.commit()

    db.refresh(post)

    return build_post_response(
        post,
        current_user,
    )


# ============================================================
# GET ALL SOCIAL POSTS
# ============================================================

@router.get(
    "/",
    response_model=list[SocialPostResponse],
)
def get_social_posts(
    db: Session = Depends(get_db),
):

    rows = (
        db.query(
            SocialPost,
            User,
        )
        .join(
            User,
            SocialPost.user_id
            == User.id,
        )
        .order_by(
            SocialPost.id.desc()
        )
        .all()
    )

    return [
        build_post_response(
            post,
            user,
        )
        for post, user in rows
    ]