from fastapi import APIRouter, Request, HTTPException
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.complaint import Complaint
from app.services.citizen_notification import send_citizen_notification

import os
import re
import html
import requests
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

RESEND_API_KEY = os.getenv("RESEND_API_KEY")


def extract_complaint_id_from_reply_address(received_for: list[str]) -> int | None:
    """
    Primary matching method.

    Every official complaint email gets a unique Reply-To address:
        complaint-18@faleujiidr.resend.app

    When the official simply clicks Reply, the response comes back to
    that address, so the complaint can be identified without asking
    the official to type the complaint ID.
    """

    for value in received_for or []:
        address = extract_email_address(value)

        match = re.match(
            r"^complaint-(\d+)@faleujiidr\.resend\.app$",
            address,
            re.IGNORECASE,
        )

        if match:
            return int(match.group(1))

    return None


def extract_complaint_id(subject: str, text: str) -> int | None:
    """
    Safety fallback.

    If the Reply-To address is unavailable, try:
    - Subject: Re: Jan-Drishti Complaint #18
    - Body: Complaint ID: 18
    """

    combined_text = f"{subject}\n{text}"

    patterns = [
        r"complaint\s*(?:id|#)\s*[:#-]?\s*(\d+)",
        r"complaint\s*#\s*(\d+)",
        r"jan[-\s]?drishti\s*complaint\s*#?\s*(\d+)",
    ]

    for pattern in patterns:
        match = re.search(pattern, combined_text, re.IGNORECASE)

        if match:
            return int(match.group(1))

    return None


def clean_email_text(text: str) -> str:
    """
    Remove common quoted-reply sections so we primarily save
    the official's new response.
    """

    if not text:
        return ""

    text = html.unescape(text)

    separators = [
        "\nOn ",
        "\n-----Original Message-----",
        "\nFrom:",
        "\n> ",
    ]

    for separator in separators:
        if separator in text:
            text = text.split(separator, 1)[0]

    return text.strip()


def extract_email_address(value: str) -> str:
    """
    Converts:
        PWD Civil Lines <authority@example.com>
    into:
        authority@example.com
    """

    match = re.search(r"<([^>]+)>", value or "")

    if match:
        return match.group(1).strip().lower()

    return (value or "").strip().lower()


def extract_official_response_fields(text: str) -> tuple[str | None, str | None, str]:
    """
    Read the simple structured format used in official replies.

    Expected format:

        STATUS: RESOLVED
        Action Taken:
        Road repair has been completed.

        Response:
        The issue has been addressed.

    STATUS is optional for safety. If it is missing or unknown, the
    complaint is treated as "Response Received" rather than Resolved.
    """

    if not text:
        return None, None, ""

    normalized = text.strip()

    status_match = re.search(
        r"(?im)^\s*status\s*:\s*(resolved|in\s*progress|received)\s*$",
        normalized,
    )

    status_value = None

    if status_match:
        raw_status = status_match.group(1).strip().upper()

        if raw_status == "RESOLVED":
            status_value = "Resolved"
        elif raw_status in {"IN PROGRESS", "INPROGRESS"}:
            status_value = "In Progress"
        elif raw_status == "RECEIVED":
            status_value = "Received"

    action_taken = None

    action_match = re.search(
        r"(?is)^\s*action\s*taken\s*:\s*(.*?)(?=^\s*(?:response|status)\s*:|\Z)",
        normalized,
    )

    if action_match:
        action_taken = action_match.group(1).strip() or None

    response_text = normalized

    response_match = re.search(
        r"(?is)^\s*response\s*:\s*(.*?)(?=\Z)",
        normalized,
    )

    if response_match:
        response_text = response_match.group(1).strip() or normalized

    return status_value, action_taken, response_text


def retrieve_received_email(email_id: str) -> dict:
    """
    Retrieve the actual inbound email from Resend.
    """

    if not RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY is missing.")

    response = requests.get(
        f"https://api.resend.com/emails/receiving/{email_id}",
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
        },
        timeout=20,
    )

    if response.status_code != 200:
        raise RuntimeError(
            f"Resend email retrieval failed: "
            f"{response.status_code} {response.text}"
        )

    return response.json()


@router.post("/resend")
async def resend_webhook(request: Request):
    """
    Receives Resend email.received webhook.
    """

    payload = await request.json()

    print("\n========== RESEND WEBHOOK ==========")
    print(payload)
    print("====================================\n")

    if payload.get("type") != "email.received":
        return {
            "status": "ignored",
            "event_type": payload.get("type"),
        }

    data = payload.get("data", {})

    email_id = data.get("email_id")
    sender = data.get("from", "")
    subject = data.get("subject", "")
    received_for = data.get("received_for") or data.get("to") or []

    if not email_id:
        raise HTTPException(
            status_code=400,
            detail="Missing email_id in Resend webhook.",
        )

    try:
        received_email = retrieve_received_email(email_id)
    except Exception as exc:
        print(f"Failed to retrieve inbound email: {exc}")

        raise HTTPException(
            status_code=500,
            detail="Could not retrieve received email from Resend.",
        )

    sender_email = extract_email_address(
        received_email.get("from") or sender
    )

    email_text = received_email.get("text") or ""

    if not email_text:
        email_html = received_email.get("html") or ""

        email_text = re.sub(
            r"<[^>]+>",
            " ",
            email_html,
        )

    email_text = clean_email_text(email_text)

    # PRIMARY MATCH:
    # The official normally clicks Reply. The Reply-To address itself
    # contains the complaint ID, so the official does not need to type it.
    complaint_id = extract_complaint_id_from_reply_address(
        received_for
    )

    # SAFETY FALLBACK:
    # If the receiving address is unavailable, try the subject/body.
    if not complaint_id:
        complaint_id = extract_complaint_id(
            subject,
            email_text,
        )

    if not complaint_id:
        print("No complaint ID could be identified from the incoming email.")

        return {
            "status": "ignored",
            "reason": "Complaint could not be identified safely.",
            "email_id": email_id,
        }

    db: Session = SessionLocal()

    try:
        complaint = (
            db.query(Complaint)
            .filter(Complaint.id == complaint_id)
            .first()
        )

        if not complaint:
            return {
                "status": "ignored",
                "reason": "Complaint not found.",
                "complaint_id": complaint_id,
            }

        # ---------------------------------------------------------
        # SECURITY CHECK
        # Only accept replies from the authority assigned
        # to this complaint.
        # ---------------------------------------------------------

        authority_email = (
            complaint.authority_email or ""
        ).strip().lower()

        if authority_email:
            if sender_email != authority_email:
                print(
                    f"Rejected email for complaint #{complaint_id}: "
                    f"{sender_email} != {authority_email}"
                )

                return {
                    "status": "rejected",
                    "reason": "Sender is not the assigned authority.",
                    "complaint_id": complaint_id,
                }

        # ---------------------------------------------------------
        # SAVE OFFICIAL RESPONSE
        # ---------------------------------------------------------

        if not email_text:
            return {
                "status": "ignored",
                "reason": "Email contains no readable response.",
                "complaint_id": complaint_id,
            }

        # ---------------------------------------------------------
        # READ STRUCTURED STATUS FROM OFFICIAL REPLY
        # ---------------------------------------------------------

        official_status, parsed_action_taken, parsed_response = (
            extract_official_response_fields(email_text)
        )

        complaint.authority_response = parsed_response or email_text

        if parsed_action_taken:
            complaint.action_taken = parsed_action_taken
        elif not complaint.action_taken:
            complaint.action_taken = "Official response received."

        complaint.response_date = __import__(
            "datetime"
        ).datetime.now(
            __import__("datetime").timezone.utc
        )

        # Only an explicit STATUS: RESOLVED can close the complaint.
        # Anything else remains in the response stage.
        if official_status == "Resolved":
            complaint.status = "Resolved"
            complaint.resolution_status = "Resolved"
            notification_status = "Resolved"

        elif official_status == "In Progress":
            complaint.status = "Response Received"
            complaint.resolution_status = "In Progress"
            notification_status = "Response Received"

        elif official_status == "Received":
            complaint.status = "Response Received"
            complaint.resolution_status = "In Progress"
            notification_status = "Response Received"

        else:
            # Missing/unknown status is never treated as resolved.
            complaint.status = "Response Received"
            if not complaint.resolution_status:
                complaint.resolution_status = "In Progress"
            notification_status = "Response Received"

        db.commit()
        db.refresh(complaint)

        # ---------------------------------------------------------
        # NOTIFY CITIZEN
        # ---------------------------------------------------------

        try:
            send_citizen_notification(
                recipient_email=complaint.email,
                complaint_id=complaint.id,
                status=notification_status,
                district=complaint.district,
                area=complaint.area,
                category=complaint.category,
                authority_response=complaint.authority_response,
                action_taken=complaint.action_taken,
                resolution_status=complaint.resolution_status,
            )

            print(
                f"Citizen notification sent for complaint "
                f"#{complaint.id}"
            )

        except Exception as notification_error:
            print(
                "Citizen notification failed:",
                notification_error,
            )

        return {
            "status": "success",
            "message": "Official response received and complaint updated.",
            "complaint_id": complaint.id,
            "new_status": complaint.status,
            "resolution_status": complaint.resolution_status,
        }

    finally:
        db.close()