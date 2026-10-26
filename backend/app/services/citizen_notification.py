import os
import html

import resend
from dotenv import load_dotenv


load_dotenv()

RESEND_API_KEY = os.getenv("RESEND_API_KEY")

if not RESEND_API_KEY:
    raise ValueError(
        "RESEND_API_KEY is missing from .env"
    )

resend.api_key = RESEND_API_KEY


# Must be an allowed sender address
# for your verified Resend domain.
SENDER_EMAIL = os.getenv(
    "RESEND_FROM_EMAIL",
    "Jan-Drishti <noreply@top1squad.com>",
)


def send_citizen_notification(
    recipient_email: str,
    complaint_id: int,
    status: str,
    district: str,
    area: str,
    category: str,
    authority_response: str | None = None,
    action_taken: str | None = None,
    resolution_status: str | None = None,
    authority_name: str | None = None,
    authority_email: str | None = None,
    sla_days: int | None = None,
    authority_notified_at=None,
    response_deadline=None,
):
    """
    Send a Jan-Drishti status update to the citizen.

    Email failures are handled safely so a temporary
    Resend/network problem does not crash the background task.
    """

    titles = {
        "Submitted":
            "Complaint Submitted Successfully",

        "Rejected":
            "Complaint Update",

        "Official Notified":
            "Complaint Verified and Sent to Official",

        "Response Received":
            "Official Response Received",

        "Resolved":
            "Complaint Resolved",
    }

    messages = {
        "Submitted": (
            "Your complaint has been successfully "
            "submitted to Jan-Drishti."
        ),

        "Rejected": (
            "Your complaint was reviewed and could "
            "not be accepted at this time."
        ),

        "Official Notified": (
            "Your complaint has been verified and "
            "successfully forwarded to the concerned "
            "authority."
        ),

        "Response Received": (
            "The concerned authority has responded "
            "to your complaint."
        ),

        "Resolved": (
            "Your complaint has been marked as resolved."
        ),
    }

    title = titles.get(
        status,
        "Complaint Status Update",
    )

    message = messages.get(
        status,
        "Your complaint status has been updated.",
    )

    safe_category = html.escape(
        category or "Not provided"
    )

    safe_district = html.escape(
        district or "Not provided"
    )

    safe_area = html.escape(
        area or "Not provided"
    )

    safe_message = html.escape(
        message
    )

    # ========================================================
    # AUTHORITY / SLA INFORMATION
    # ========================================================

    authority_block = ""

    if status == "Official Notified":

        safe_authority = html.escape(
            authority_name or "Concerned Authority"
        )

        safe_authority_email = html.escape(
            authority_email or "Not available"
        )

        forwarded_text = "Not available"

        if authority_notified_at:
            try:
                forwarded_text = (
                    authority_notified_at.strftime(
                        "%d %B %Y, %I:%M %p"
                    )
                )
            except (AttributeError, ValueError):
                forwarded_text = html.escape(
                    str(authority_notified_at)
                )

        deadline_text = (
            "Applicable response period"
        )

        if response_deadline:
            try:
                deadline_text = (
                    response_deadline.strftime(
                        "%d %B %Y, %I:%M %p"
                    )
                )
            except (AttributeError, ValueError):
                deadline_text = html.escape(
                    str(response_deadline)
                )

        sla_text = (
            f"{sla_days} day(s)"
            if sla_days is not None
            else "Applicable response period"
        )

        authority_block = f"""
        <div
            style="
                margin-top:16px;
                padding:16px;
                background:#f9fafb;
                border:1px solid #e5e7eb;
                border-radius:8px;
            "
        >

            <p style="margin-top:0;">
                <strong>
                    Department / Authority:
                </strong>
                {safe_authority}
            </p>

            <p>
                <strong>
                    Official Email:
                </strong>
                {safe_authority_email}
            </p>

            <p>
                <strong>
                    Forwarded On:
                </strong>
                {forwarded_text}
            </p>

            <p>
                <strong>
                    Response Period:
                </strong>
                {html.escape(sla_text)}
            </p>

            <p style="margin-bottom:0;">
                <strong>
                    Expected Response By:
                </strong>
                {deadline_text}
            </p>

        </div>


        <div
            style="
                margin-top:16px;
                padding:16px;
                background:#fff7ed;
                border:1px solid #fed7aa;
                border-radius:8px;
            "
        >

            <strong>
                Escalation Information
            </strong>

            <p
                style="
                    margin-bottom:0;
                    line-height:1.6;
                "
            >
                If no response or appropriate action
                is received within the applicable
                response period, your complaint may
                be considered for escalation through
                the Jan-Drishti escalation process.

                Please keep your Complaint ID for
                future reference.
            </p>

        </div>
        """

    # ========================================================
    # AUTHORITY RESPONSE INFORMATION
    # ========================================================

    response_block = ""

    if authority_response:

        safe_response = html.escape(
            authority_response
        ).replace(
            "\n",
            "<br>",
        )

        response_block += f"""
        <div
            style="
                margin-top:20px;
                padding:16px;
                background:#f9fafb;
                border:1px solid #e5e7eb;
                border-radius:8px;
            "
        >

            <strong>
                Official Response
            </strong>

            <p style="margin-bottom:0;">
                {safe_response}
            </p>

        </div>
        """

    if action_taken:

        safe_action = html.escape(
            action_taken
        ).replace(
            "\n",
            "<br>",
        )

        response_block += f"""
        <div
            style="
                margin-top:12px;
                padding:16px;
                background:#f9fafb;
                border:1px solid #e5e7eb;
                border-radius:8px;
            "
        >

            <strong>
                Action Taken
            </strong>

            <p style="margin-bottom:0;">
                {safe_action}
            </p>

        </div>
        """

    if resolution_status:

        safe_resolution = html.escape(
            resolution_status
        )

        response_block += f"""
        <p style="margin-top:18px;">
            <strong>
                Resolution Status:
            </strong>
            {safe_resolution}
        </p>
        """

    # ========================================================
    # SUBJECT
    # ========================================================

    subject = (
        f"Jan-Drishti Complaint "
        f"#{complaint_id} - {title}"
    )

    # ========================================================
    # EMAIL HTML
    # ========================================================

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
                max-width:620px;
                margin:30px auto;
                background:#fff;
                border:1px solid #ddd;
                border-radius:10px;
                overflow:hidden;
            "
        >

          <div
            style="
                background:#111827;
                color:#fff;
                padding:24px;
            "
          >

            <h1
                style="
                    margin:0;
                    font-size:24px;
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
                Civic Grievance Platform
            </p>

          </div>


          <div style="padding:25px;">

            <h2 style="margin-top:0;">
                {html.escape(title)}
            </h2>

            <p>
                {safe_message}
            </p>


            <div
                style="
                    margin-top:20px;
                    padding:16px;
                    background:#f9fafb;
                    border:1px solid #e5e7eb;
                    border-radius:8px;
                "
            >

              <p>
                <strong>
                    Complaint ID:
                </strong>
                #{complaint_id}
              </p>

              <p>
                <strong>
                    Category:
                </strong>
                {safe_category}
              </p>

              <p>
                <strong>
                    District:
                </strong>
                {safe_district}
              </p>

              <p style="margin-bottom:0;">
                <strong>
                    Area:
                </strong>
                {safe_area}
              </p>

            </div>


            {authority_block}


            {response_block}


            <p style="margin-top:25px;">
                Use your Complaint ID on Jan-Drishti
                to track the latest status.
            </p>


            <p style="margin-top:28px;">
                Regards,
                <br>

                <strong>
                    Jan-Drishti
                </strong>

                <br>

                Civic Grievance Platform
            </p>

          </div>

        </div>

      </body>

    </html>
    """

    # ========================================================
    # RESEND PARAMETERS
    # ========================================================

    params = {
        "from": SENDER_EMAIL,

        "to": [
            recipient_email
        ],

        "subject": subject,

        "html": email_html,
    }

    # ========================================================
    # SEND EMAIL SAFELY
    # ========================================================

    try:

        result = resend.Emails.send(
            params
        )

        print(
            f"Citizen notification sent successfully "
            f"for Complaint #{complaint_id} "
            f"({status}) to {recipient_email}"
        )

        return result

    except Exception as exc:

        # Important:
        # Do not raise the exception here because this function
        # runs as a FastAPI background task.
        #
        # A temporary Resend/network timeout should not produce
        # an unhandled background-task traceback or affect the
        # complaint's saved workflow state.

        print(
            f"Citizen notification FAILED "
            f"for Complaint #{complaint_id} "
            f"({status}) to {recipient_email}: "
            f"{exc}"
        )

        return {
            "status": "failed",
            "complaint_id": complaint_id,
            "notification_status": status,
            "recipient": recipient_email,
            "error": str(exc),
        }