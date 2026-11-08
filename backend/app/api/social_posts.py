import hashlib

from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
)

from pydantic import (
    BaseModel,
    Field,
)

from sqlalchemy import func

from sqlalchemy.exc import IntegrityError

from sqlalchemy.orm import Session

from app.core.database import get_db

from app.models.social_post import (
    SocialPost,
    SocialPostLike,
    SocialPostComment,
    SocialPostView,
)

from app.models.user import User

from app.schemas.social_post import SocialPostCreate

from app.api.auth import get_session_user


router = APIRouter(
    prefix="/social-posts",
    tags=["Social Posts"],
)


# ============================================================
# COMMENT INPUT
# ============================================================

class CommentCreate(BaseModel):

    text: str = Field(
        min_length=1,
        max_length=1000,
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
            detail="Please log in to continue.",
        )

    return user


# ============================================================
# OPTIONAL CURRENT USER
# ============================================================

def optional_current_user(
    request: Request,
    db: Session,
) -> Optional[User]:

    return get_session_user(
        request,
        db,
    )


# ============================================================
# GET POST
# ============================================================

def get_post_or_404(
    db: Session,
    post_id: int,
):

    post = (
        db.query(SocialPost)
        .filter(
            SocialPost.id == post_id
        )
        .first()
    )

    if post is None:

        raise HTTPException(
            status_code=404,
            detail="Post not found.",
        )

    return post


# ============================================================
# BUILD COMMENT RESPONSE
# ============================================================

def build_comment_response(
    comment: SocialPostComment,
    user: User | None,
):

    return {
        "id": comment.id,
        "post_id": comment.post_id,
        "user_id": comment.user_id,

        "username": (
            user.username
            if user
            else None
        ),

        "name": (
            user.name
            if user
            else None
        ),

        "text": comment.text,

        "created_at":
            comment.created_at,
    }


# ============================================================
# BUILD PUBLIC POST RESPONSE
# ============================================================

def build_post_response(
    db: Session,
    post: SocialPost,
    user: User | None,
    current_user: User | None = None,
):

    # --------------------------------------------------------
    # LIKE COUNT
    # --------------------------------------------------------

    like_count = (
        db.query(
            func.count(
                SocialPostLike.id
            )
        )
        .filter(
            SocialPostLike.post_id
            == post.id
        )
        .scalar()
        or 0
    )


    # --------------------------------------------------------
    # VIEW COUNT
    # --------------------------------------------------------

    view_count = (
        db.query(
            func.count(
                SocialPostView.id
            )
        )
        .filter(
            SocialPostView.post_id
            == post.id
        )
        .scalar()
        or 0
    )


    # --------------------------------------------------------
    # COMMENTS
    # --------------------------------------------------------

    comment_rows = (
        db.query(
            SocialPostComment,
            User,
        )
        .join(
            User,
            SocialPostComment.user_id
            == User.id,
        )
        .filter(
            SocialPostComment.post_id
            == post.id
        )
        .order_by(
            SocialPostComment.id.asc()
        )
        .all()
    )


    # --------------------------------------------------------
    # DID CURRENT USER LIKE?
    # --------------------------------------------------------

    liked_by_me = False

    if current_user:

        liked_by_me = (
            db.query(
                SocialPostLike.id
            )
            .filter(
                SocialPostLike.post_id
                == post.id,

                SocialPostLike.user_id
                == current_user.id,
            )
            .first()
            is not None
        )


    # --------------------------------------------------------
    # PUBLIC RESPONSE
    # --------------------------------------------------------

    return {

        "id":
            post.id,

        "user_id":
            post.user_id,

        "username":
            user.username
            if user
            else None,

        "name":
            user.name
            if user
            else None,

        "text":
            post.text,

        "image_url":
            post.image_url,

        "video_url":
            post.video_url,

        "created_at":
            post.created_at,

        "like_count":
            int(like_count),

        "comment_count":
            len(comment_rows),

        "view_count":
            int(view_count),

        "liked_by_me":
            liked_by_me,

        "comments": [
            build_comment_response(
                comment,
                author,
            )
            for comment, author
            in comment_rows
        ],
    }


# ============================================================
# CREATE SOCIAL POST
# ============================================================

@router.post(
    "/",
    status_code=201,
)
def create_social_post(
    post_data: SocialPostCreate,
    request: Request,

    db: Session = Depends(
        get_db
    ),

    current_user: User = Depends(
        require_current_user
    ),
):

    post = SocialPost(

        user_id=
            current_user.id,

        text=
            post_data.text,

        image_url=
            post_data.image_url,

        video_url=
            post_data.video_url,
    )

    db.add(post)

    db.commit()

    db.refresh(post)

    return build_post_response(
        db,
        post,
        current_user,
        current_user,
    )


# ============================================================
# GET ALL SOCIAL POSTS
# ============================================================

@router.get("/")
def get_social_posts(
    request: Request,
    db: Session = Depends(get_db),
):

    current_user = (
        optional_current_user(
            request,
            db,
        )
    )

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
            db,
            post,
            user,
            current_user,
        )

        for post, user
        in rows
    ]


# ============================================================
# LIKE / UNLIKE POST
# ============================================================

@router.post(
    "/{post_id}/like"
)
def toggle_social_post_like(

    post_id: int,

    db: Session = Depends(
        get_db
    ),

    current_user: User = Depends(
        require_current_user
    ),
):

    get_post_or_404(
        db,
        post_id,
    )


    existing = (
        db.query(
            SocialPostLike
        )
        .filter(
            SocialPostLike.post_id
            == post_id,

            SocialPostLike.user_id
            == current_user.id,
        )
        .first()
    )


    # --------------------------------------------------------
    # UNLIKE
    # --------------------------------------------------------

    if existing:

        db.delete(existing)

        liked = False


    # --------------------------------------------------------
    # LIKE
    # --------------------------------------------------------

    else:

        db.add(
            SocialPostLike(
                post_id=post_id,
                user_id=current_user.id,
            )
        )

        liked = True


    try:

        db.commit()

    except IntegrityError:

        db.rollback()

        liked = True


    like_count = (
        db.query(
            func.count(
                SocialPostLike.id
            )
        )
        .filter(
            SocialPostLike.post_id
            == post_id
        )
        .scalar()
        or 0
    )


    return {

        "post_id":
            post_id,

        "liked":
            liked,

        "like_count":
            int(like_count),
    }


# ============================================================
# CREATE COMMENT
# ============================================================

@router.post(
    "/{post_id}/comments",
    status_code=201,
)
def create_social_post_comment(

    post_id: int,

    payload: CommentCreate,

    db: Session = Depends(
        get_db
    ),

    current_user: User = Depends(
        require_current_user
    ),
):

    get_post_or_404(
        db,
        post_id,
    )


    text = (
        payload.text
        .strip()
    )


    if not text:

        raise HTTPException(
            status_code=400,
            detail=(
                "Comment cannot be empty."
            ),
        )


    comment = SocialPostComment(

        post_id=
            post_id,

        user_id=
            current_user.id,

        text=
            text,
    )


    db.add(comment)

    db.commit()

    db.refresh(comment)


    count = (
        db.query(
            func.count(
                SocialPostComment.id
            )
        )
        .filter(
            SocialPostComment.post_id
            == post_id
        )
        .scalar()
        or 0
    )


    return {

        "comment":
            build_comment_response(
                comment,
                current_user,
            ),

        "comment_count":
            int(count),
    }


# ============================================================
# RECORD UNIQUE POST VIEW
# ============================================================

@router.post(
    "/{post_id}/view"
)
def record_social_post_view(

    post_id: int,

    request: Request,

    db: Session = Depends(
        get_db
    ),
):

    get_post_or_404(
        db,
        post_id,
    )


    current_user = (
        optional_current_user(
            request,
            db,
        )
    )


    raw_viewer = (
        request.headers
        .get(
            "X-Jan-Drishti-Viewer",
            "",
        )
        .strip()
    )


    # --------------------------------------------------------
    # LOGGED-IN VIEWER
    # --------------------------------------------------------

    if current_user:

        viewer_key = (
            f"user:{current_user.id}"
        )


    # --------------------------------------------------------
    # GUEST VIEWER
    # --------------------------------------------------------

    elif raw_viewer:

        hashed_viewer = (
            hashlib.sha256(
                raw_viewer.encode(
                    "utf-8"
                )
            )
            .hexdigest()
        )

        viewer_key = (
            "guest:"
            + hashed_viewer
        )


    # --------------------------------------------------------
    # NO STABLE VIEWER
    #
    # Return count without generating fake repeated views.
    # --------------------------------------------------------

    else:

        count = (
            db.query(
                func.count(
                    SocialPostView.id
                )
            )
            .filter(
                SocialPostView.post_id
                == post_id
            )
            .scalar()
            or 0
        )

        return {

            "post_id":
                post_id,

            "view_count":
                int(count),
        }


    # --------------------------------------------------------
    # HAS THIS USER/BROWSER ALREADY VIEWED THIS POST?
    # --------------------------------------------------------

    existing = (
        db.query(
            SocialPostView.id
        )
        .filter(
            SocialPostView.post_id
            == post_id,

            SocialPostView.viewer_key
            == viewer_key,
        )
        .first()
    )


    # --------------------------------------------------------
    # NEW UNIQUE VIEW
    # --------------------------------------------------------

    if existing is None:

        db.add(
            SocialPostView(

                post_id=
                    post_id,

                viewer_key=
                    viewer_key,

                user_id=(
                    current_user.id
                    if current_user
                    else None
                ),
            )
        )


        try:

            db.commit()

        except IntegrityError:

            db.rollback()


    # --------------------------------------------------------
    # CURRENT PUBLIC VIEW COUNT
    # --------------------------------------------------------

    count = (
        db.query(
            func.count(
                SocialPostView.id
            )
        )
        .filter(
            SocialPostView.post_id
            == post_id
        )
        .scalar()
        or 0
    )


    return {

        "post_id":
            post_id,

        "view_count":
            int(count),
    }