import os
import html
import base64
import mimetypes

import resend
from pathlib import Path
from dotenv import load_dotenv


load_dotenv()

RESEND_API_KEY = os.getenv("RESEND_API_KEY")

if not RESEND_API_KEY:
    raise ValueError("RESEND_API_KEY is missing from .env")

resend.api_key = RESEND_API_KEY


def send_official_complaint_email(
    recipient_email: str,
    complaint_id: int,
    state: str,
    district: str,
    area: str,
    category: str,
    description: str,
    duration: str,
    affected_people: str,
    affected_groups: str,
    traffic_impact: str,
    immediate_danger: str,
    location_details: str,
    phone: str,
    citizen_email: str,
    severity: str,
    public_impact: str,
    official_report: str,
    image_url: str | None = None,
    video_url: str | None = None,
):
    subject = (
        f"Jan-Drishti Complaint #{complaint_id} "
        f"- {category} - {district}"
    )

    # Safely convert values for HTML email
    safe_state = html.escape(state or "Not provided")

    safe_district = html.escape(
        district or "Not provided"
    )

    safe_area = html.escape(
        area or "Not provided"
    )

    safe_category = html.escape(
        category or "Not provided"
    )

    safe_description = html.escape(
        description or "Not provided"
    )

    safe_duration = html.escape(
        duration or "Not provided"
    )

    safe_affected_people = html.escape(
        affected_people or "Not provided"
    )

    safe_affected_groups = html.escape(
        affected_groups or "Not provided"
    )

    safe_traffic_impact = html.escape(
        traffic_impact or "Not provided"
    )

    safe_immediate_danger = html.escape(
        immediate_danger or "Not provided"
    )

    safe_location = html.escape(
        location_details or "Not provided"
    )

    safe_phone = html.escape(
        phone or "Not provided"
    )

    safe_citizen_email = html.escape(
        citizen_email or "Not provided"
    )

    safe_severity = html.escape(
        severity or "Medium"
    )

    safe_public_impact = html.escape(
        public_impact or "Not provided"
    )

    safe_report = html.escape(
        official_report or "Not provided"
    )

    # ============================================================
    # EMAIL HTML
    # ============================================================

    email_html = f"""
    <html>

        <body
            style="
                margin:0;
                padding:0;
                background:#f4f6f8;
                font-family:Arial,Helvetica,sans-serif;
                color:#222;
            "
        >

            <div
                style="
                    max-width:700px;
                    margin:30px auto;
                    background:#ffffff;
                    border-radius:10px;
                    overflow:hidden;
                    border:1px solid #ddd;
                "
            >

                <!-- HEADER -->

                <div
                    style="
                        background:#111827;
                        color:white;
                        padding:25px;
                    "
                >

                    <h1
                        style="
                            margin:0;
                            font-size:25px;
                        "
                    >
                        JAN-DRISHTI
                    </h1>

                    <p
                        style="
                            margin:6px 0 0;
                            color:#d1d5db;
                            font-size:14px;
                        "
                    >
                        Civic Complaint &amp; Grievance Platform
                    </p>

                </div>


                <!-- TITLE -->

                <div style="padding:25px;">

                    <h2
                        style="
                            margin-top:0;
                            color:#111827;
                        "
                    >
                        Civic Complaint Report
                    </h2>

                    <p>
                        Respected Sir/Madam,
                    </p>

                    <p>
                        Jan-Drishti has received and verified
                        a civic complaint requiring attention
                        from the concerned authority.
                    </p>


                    <!-- COMPLAINT SUMMARY -->

                    <div
                        style="
                            background:#f9fafb;
                            border:1px solid #e5e7eb;
                            border-radius:8px;
                            padding:18px;
                            margin-top:20px;
                        "
                    >

                        <h3>
                            Complaint Summary
                        </h3>

                        <p>
                            <strong>Complaint ID:</strong>
                            #{complaint_id}
                        </p>

                        <p>
                            <strong>Status:</strong>
                            Verified
                        </p>

                        <p>
                            <strong>Severity:</strong>
                            {safe_severity}
                        </p>

                    </div>


                    <!-- LOCATION -->

                    <h3
                        style="
                            margin-top:28px;
                            border-bottom:1px solid #ddd;
                            padding-bottom:8px;
                        "
                    >
                        📍 Problem Location
                    </h3>

                    <table
                        style="
                            width:100%;
                            border-collapse:collapse;
                        "
                    >

                        <tr>
                            <td style="padding:7px 0;">
                                <strong>State</strong>
                            </td>

                            <td style="padding:7px 0;">
                                {safe_state}
                            </td>
                        </tr>

                        <tr>
                            <td style="padding:7px 0;">
                                <strong>District</strong>
                            </td>

                            <td style="padding:7px 0;">
                                {safe_district}
                            </td>
                        </tr>

                        <tr>
                            <td style="padding:7px 0;">
                                <strong>Area</strong>
                            </td>

                            <td style="padding:7px 0;">
                                {safe_area}
                            </td>
                        </tr>

                        <tr>
                            <td style="padding:7px 0;">
                                <strong>Exact Location Provided</strong>
                            </td>

                            <td style="padding:7px 0;">
                                {safe_location}
                            </td>
                        </tr>

                    </table>


                    <!-- COMPLAINT DETAILS -->

                    <h3
                        style="
                            margin-top:28px;
                            border-bottom:1px solid #ddd;
                            padding-bottom:8px;
                        "
                    >
                        📋 Complaint Details
                    </h3>

                    <table
                        style="
                            width:100%;
                            border-collapse:collapse;
                        "
                    >

                        <tr>
                            <td style="padding:7px 0;">
                                <strong>Category</strong>
                            </td>

                            <td style="padding:7px 0;">
                                {safe_category}
                            </td>
                        </tr>

                        <tr>
                            <td style="padding:7px 0;">
                                <strong>Duration</strong>
                            </td>

                            <td style="padding:7px 0;">
                                {safe_duration}
                            </td>
                        </tr>

                        <tr>
                            <td style="padding:7px 0;">
                                <strong>Affected People</strong>
                            </td>

                            <td style="padding:7px 0;">
                                {safe_affected_people}
                            </td>
                        </tr>

                        <tr>
                            <td style="padding:7px 0;">
                                <strong>Affected Groups</strong>
                            </td>

                            <td style="padding:7px 0;">
                                {safe_affected_groups}
                            </td>
                        </tr>

                        <tr>
                            <td style="padding:7px 0;">
                                <strong>Traffic Impact</strong>
                            </td>

                            <td style="padding:7px 0;">
                                {safe_traffic_impact}
                            </td>
                        </tr>

                        <tr>
                            <td style="padding:7px 0;">
                                <strong>Immediate Danger</strong>
                            </td>

                            <td style="padding:7px 0;">
                                {safe_immediate_danger}
                            </td>
                        </tr>

                    </table>


                    <!-- CITIZEN DESCRIPTION -->

                    <h4>
                        Citizen's Description
                    </h4>

                    <div
                        style="
                            background:#f9fafb;
                            padding:15px;
                            border-radius:7px;
                        "
                    >
                        {safe_description.replace(chr(10), "<br>")}
                    </div>


                    <!-- AI -->

                    <h3
                        style="
                            margin-top:28px;
                            border-bottom:1px solid #ddd;
                            padding-bottom:8px;
                        "
                    >
                        🤖 Jan-Drishti AI Assessment
                    </h3>

                    <p>
                        <strong>Severity:</strong>
                        {safe_severity}
                    </p>

                    <h4>
                        Public Impact
                    </h4>

                    <p>
                        {safe_public_impact.replace(
                            chr(10),
                            "<br>"
                        )}
                    </p>

                    <h4>
                        Official Complaint Report
                    </h4>

                    <div
                        style="
                            background:#f9fafb;
                            padding:15px;
                            border-radius:7px;
                        "
                    >
                        {safe_report.replace(
                            chr(10),
                            "<br>"
                        )}
                    </div>


                    <!-- EVIDENCE -->

                    <h3
                        style="
                            margin-top:28px;
                            border-bottom:1px solid #ddd;
                            padding-bottom:8px;
                        "
                    >
                        📎 Supporting Evidence
                    </h3>

                    <p>
                        Citizen-provided photo/video evidence
                        is attached to this email when available.
                    </p>


                    <!-- COMPLAINANT -->

                    <h3
                        style="
                            margin-top:28px;
                            border-bottom:1px solid #ddd;
                            padding-bottom:8px;
                        "
                    >
                        👤 Complainant Information
                    </h3>

                    <p>
                        <strong>Phone:</strong>
                        {safe_phone}
                    </p>

                    <p>
                        <strong>Email:</strong>
                        {safe_citizen_email}
                    </p>


                    <!-- ACTION -->

                    <div
                        style="
                            margin-top:25px;
                            padding:18px;
                            background:#f9fafb;
                            border-left:4px solid #111827;
                        "
                    >

                        <strong>
                            Requested Action
                        </strong>

                        <p>
                            Kindly review the complaint and
                            take appropriate action at the
                            concerned location.
                        </p>

                        <p>
                            Please provide an action update
                            or response to Jan-Drishti for
                            further communication with the citizen.
                        </p>

                    </div>


                    <!-- FOOTER -->

                    <p style="margin-top:30px;">
                        Regards,<br>
                        <strong>Jan-Drishti</strong><br>
                        Civic Grievance Platform
                    </p>

                </div>

            </div>

        </body>

    </html>
    """

    # ============================================================
    # BUILD ATTACHMENTS
    # ============================================================

    attachments = []

    def add_local_attachment(file_url: str | None):
        if not file_url:
            return

        file_path = Path(file_url)

        if not file_path.exists():
            print(f"Attachment file not found: {file_path}")
            return

        if not file_path.is_file():
            print(f"Attachment path is not a file: {file_path}")
            return

        try:
            file_bytes = file_path.read_bytes()

            encoded_content = base64.b64encode(
                file_bytes
            ).decode("utf-8")

            content_type, _ = mimetypes.guess_type(
                file_path.name
            )

            attachment = {
                "content": encoded_content,
                "filename": file_path.name,
            }

            if content_type:
                attachment["content_type"] = content_type

            attachments.append(attachment)

            print(
                f"Attachment prepared successfully: "
                f"{file_path.name}"
            )

        except Exception as e:
            print(
                f"Failed to prepare attachment "
                f"{file_path}: {e}"
            )

    # Add image
    add_local_attachment(image_url)

    # Add video
    if video_url:
        print(
             "Video evidence stored in Jan-Drishti "
             f"but not attached to email: {video_url}"
        )


    # ============================================================
    # RESEND EMAIL PARAMETERS
    # ============================================================

    # Each complaint gets its own Reply-To address.
    # When the official clicks "Reply", the email automatically
    # comes back to the correct complaint without requiring the
    # official to type the complaint ID manually.
    reply_to = f"complaint-{complaint_id}@faleujiidr.resend.app"

    params = {
        "from": os.getenv(
            "RESEND_FROM_EMAIL",
            "Jan-Drishti <noreply@top1squad.com>",
        ),
        "to": [recipient_email],
        "reply_to": [reply_to],
        "subject": subject,
        "html": email_html,
    }

    # Add attachments only when files actually exist
    if attachments:
        params["attachments"] = attachments


    # ============================================================
    # SEND EMAIL
    # ============================================================

    email = resend.Emails.send(params)

    return email



def send_escalation_reminder_email(
    recipient_email: str,
    complaint_id: int,
    district: str,
    area: str,
    category: str,
    response_deadline,
):
    """
    Send a reminder to the concerned authority
    before the complaint response deadline.
    """

    safe_district = html.escape(
        district or "Not provided"
    )

    safe_area = html.escape(
        area or "Not provided"
    )

    safe_category = html.escape(
        category or "Not provided"
    )

    if response_deadline:
        try:
            deadline_text = response_deadline.strftime(
                "%d %b %Y, %I:%M %p"
            )
        except Exception:
            deadline_text = str(response_deadline)
    else:
        deadline_text = "Not available"

    safe_deadline = html.escape(
        deadline_text
    )

    subject = (
        f"Jan-Drishti Reminder - "
        f"Complaint #{complaint_id} "
        f"Deadline Approaching"
    )

    email_html = f"""
    <html>
    <body
        style="
            margin:0;
            padding:0;
            background:#f4f6f8;
            font-family:Arial,Helvetica,sans-serif;
            color:#222;
        "
    >

        <div
            style="
                max-width:700px;
                margin:30px auto;
                background:#ffffff;
                border-radius:10px;
                border:1px solid #ddd;
                overflow:hidden;
            "
        >

            <div
                style="
                    background:#111827;
                    color:white;
                    padding:25px;
                "
            >
                <h1 style="margin:0;font-size:25px;">
                    JAN-DRISHTI
                </h1>

                <p
                    style="
                        margin:6px 0 0;
                        color:#d1d5db;
                        font-size:14px;
                    "
                >
                    Civic Complaint &amp; Grievance Platform
                </p>
            </div>

            <div style="padding:25px;">

                <h2 style="margin-top:0;">
                    Response Deadline Reminder
                </h2>

                <p>
                    Respected Sir/Madam,
                </p>

                <p>
                    This is a reminder regarding a civic complaint
                    previously forwarded to your department through
                    Jan-Drishti.
                </p>

                <div
                    style="
                        margin-top:20px;
                        padding:18px;
                        background:#f9fafb;
                        border:1px solid #e5e7eb;
                        border-radius:8px;
                    "
                >

                    <p>
                        <strong>Complaint ID:</strong>
                        #{complaint_id}
                    </p>

                    <p>
                        <strong>Category:</strong>
                        {safe_category}
                    </p>

                    <p>
                        <strong>District:</strong>
                        {safe_district}
                    </p>

                    <p>
                        <strong>Area:</strong>
                        {safe_area}
                    </p>

                    <p>
                        <strong>Response Deadline:</strong>
                        {safe_deadline}
                    </p>

                </div>

                <div
                    style="
                        margin-top:20px;
                        padding:18px;
                        background:#fff7ed;
                        border-left:4px solid #f59e0b;
                    "
                >
                    <strong>
                        Action Required
                    </strong>

                    <p style="margin-bottom:0;">
                        Please resolve this complaint or provide
                        an official response/update before the
                        response deadline.
                    </p>
                </div>

                <p style="margin-top:22px;line-height:1.6;">
                    This complaint has been marked by Jan-Drishti
                    Administration as eligible for escalation if
                    the response deadline is missed without a
                    resolution or official response.
                </p>

                <p style="margin-top:30px;">
                    Regards,<br>
                    <strong>Jan-Drishti</strong><br>
                    Civic Grievance Platform
                </p>

            </div>

        </div>

    </body>
    </html>
    """

    reply_to = (
        f"complaint-{complaint_id}"
        "@faleujiidr.resend.app"
    )

    params = {
        "from": os.getenv(
            "RESEND_FROM_EMAIL",
            "Jan-Drishti <noreply@top1squad.com>",
        ),
        "to": [recipient_email],
        "reply_to": [reply_to],
        "subject": subject,
        "html": email_html,
    }

    return resend.Emails.send(params)