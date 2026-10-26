import os

from dotenv import load_dotenv

from app.core.database import SessionLocal
from app.models.complaint import Complaint
from app.services.email_service import send_official_complaint_email


load_dotenv()


db = SessionLocal()

try:
    complaint = (
        db.query(Complaint)
        .filter(Complaint.id == 8)
        .first()
    )

    if not complaint:
        print("Complaint #8 not found.")
        exit()

    recipient_email = os.getenv("GMAIL_SENDER_EMAIL")

    if not recipient_email:
        print("GMAIL_SENDER_EMAIL is missing from .env")
        exit()

    send_official_complaint_email(
        recipient_email=recipient_email,
        complaint_id=complaint.id,
        district=complaint.district,
        category=complaint.category,
        severity=complaint.ai_severity,
        official_report=complaint.ai_official_report,
    )

    print("EMAIL SENT SUCCESSFULLY")
    print(f"Sent to: {recipient_email}")
    print(f"Complaint ID: #{complaint.id}")

finally:
    db.close()