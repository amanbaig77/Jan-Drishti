from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
import shutil
import uuid


router = APIRouter(
    prefix="/uploads",
    tags=["Uploads"]
)


BASE_DIR = Path("uploads")
IMAGE_DIR = BASE_DIR / "images"
VIDEO_DIR = BASE_DIR / "videos"

IMAGE_DIR.mkdir(parents=True, exist_ok=True)
VIDEO_DIR.mkdir(parents=True, exist_ok=True)


ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp"
}

ALLOWED_VIDEO_TYPES = {
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/webm"
}


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...)
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG and WEBP images are allowed."
        )

    extension = Path(file.filename).suffix.lower()
    filename = f"{uuid.uuid4()}{extension}"

    file_path = IMAGE_DIR / filename

    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "status": "success",
        "filename": filename,
        "file_type": "image",
        "path": str(file_path)
    }


@router.post("/video")
async def upload_video(
    file: UploadFile = File(...)
):
    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only MP4, MPEG, MOV and WEBM videos are allowed."
        )

    extension = Path(file.filename).suffix.lower()
    filename = f"{uuid.uuid4()}{extension}"

    file_path = VIDEO_DIR / filename

    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "status": "success",
        "filename": filename,
        "file_type": "video",
        "path": str(file_path)
    }