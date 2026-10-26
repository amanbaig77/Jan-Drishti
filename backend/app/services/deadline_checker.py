from datetime import datetime, timezone, timedelta

from app.core.database import SessionLocal
from app.models.complaint import Complaint

from app.services.social_media_service import (
    generate_social_post,
    is_social_escalation_eligible,
)

from app.services.social_directory import (
    find_social_official,
)

from app.services.email_service import (
    send_escalation_reminder_email,
)

from app.services.x_service import (
    post_to_x,
)


# ============================================================
# BUILD SAFE X POST WITH OFFICIAL TAGS
# ============================================================

def _build_tagged_x_post(
    base_post: str,
    official: dict,
) -> str:

    handles = []

    primary_handle = (
        official.get("handle") or ""
    ).strip()

    higher_handle = (
        official.get(
            "higher_authority_handle"
        )
        or ""
    ).strip()


    # --------------------------------------------------------
    # Primary official
    # --------------------------------------------------------

    if (
        primary_handle
        and primary_handle.startswith("@")
        and not primary_handle.upper().startswith(
            "@VERIFY_"
        )
    ):
        handles.append(
            primary_handle
        )


    # --------------------------------------------------------
    # Higher authority
    # --------------------------------------------------------

    if (
        higher_handle
        and higher_handle.startswith("@")
        and not higher_handle.upper().startswith(
            "@VERIFY_"
        )
        and higher_handle not in handles
    ):
        handles.append(
            higher_handle
        )


    tag_text = " ".join(handles)


    if not tag_text:
        return base_post[:280]


    # Leave room for two line breaks and handles.
    max_base_length = (
        280
        - len(tag_text)
        - 2
    )


    if max_base_length < 1:
        return tag_text[:280]


    trimmed_post = (
        base_post[:max_base_length]
        .rstrip()
    )


    return (
        f"{trimmed_post}\n\n{tag_text}"
    )[:280]


# ============================================================
# DEADLINE + REMINDER + AUTO X ESCALATION CHECKER
# ============================================================

def check_expired_deadlines():
    """
    Jan-Drishti automatic escalation engine.

    Runs from APScheduler.

    1. Sends one reminder during the final 3 days.
    2. Marks expired complaint deadlines.
    3. Checks X escalation eligibility.
    4. Finds configured official X accounts.
    5. Automatically publishes eligible complaints.
    6. Stores the X post ID and URL.
    """

    db = SessionLocal()

    try:

        now = datetime.now(
            timezone.utc
        )


        # ====================================================
        # PART 1
        # AUTOMATIC 3-DAY REMINDER
        # ====================================================

        reminder_window_end = (
            now + timedelta(days=3)
        )


        reminder_complaints = (
            db.query(Complaint)
            .filter(
                Complaint.x_escalation_enabled.is_(True),

                Complaint.response_deadline.isnot(None),

                Complaint.response_deadline > now,

                Complaint.response_deadline
                <= reminder_window_end,

                Complaint.escalation_reminder_sent.is_(False),

                Complaint.authority_response.is_(None),

                Complaint.response_date.is_(None),
            )
            .all()
        )


        for complaint in reminder_complaints:

            # Do not remind resolved complaints.
            if (
                complaint.status == "Resolved"
                or (
                    complaint.resolution_status
                    and
                    complaint.resolution_status
                    .strip()
                    .lower()
                    == "resolved"
                )
            ):
                continue


            if not complaint.authority_email:

                print(
                    f"[REMINDER] Complaint "
                    f"#{complaint.id}: "
                    f"no authority email."
                )

                continue


            try:

                send_escalation_reminder_email(
                    recipient_email=
                        complaint.authority_email,

                    complaint_id=
                        complaint.id,

                    district=
                        complaint.district,

                    area=
                        complaint.area or "",

                    category=
                        complaint.category,

                    response_deadline=
                        complaint.response_deadline,
                )


                complaint.escalation_reminder_sent = True

                complaint.escalation_reminder_sent_at = now


                db.commit()


                print(
                    f"[REMINDER] Sent automatically "
                    f"for Complaint #{complaint.id}"
                )


            except Exception as exc:

                db.rollback()

                print(
                    f"[REMINDER] Failed for Complaint "
                    f"#{complaint.id}: {exc}"
                )


        # ====================================================
        # PART 2
        # FIND EXPIRED COMPLAINTS
        # ====================================================

        expired_complaints = (
            db.query(Complaint)
            .filter(
                Complaint.response_deadline.isnot(None),

                Complaint.response_deadline <= now,

                Complaint.social_escalated == "No",
            )
            .all()
        )


        for complaint in expired_complaints:

            # ------------------------------------------------
            # Mark deadline crossed
            # ------------------------------------------------

            if complaint.deadline_crossed != "Yes":

                complaint.deadline_crossed = "Yes"

                db.commit()

                print(
                    f"[SLA] Deadline crossed for "
                    f"Complaint #{complaint.id}"
                )


            # ------------------------------------------------
            # Check eligibility
            # ------------------------------------------------

            if not is_social_escalation_eligible(
                complaint
            ):

                print(
                    f"[X] Complaint #{complaint.id} "
                    f"is NOT eligible for escalation."
                )

                continue


            # ------------------------------------------------
            # Find configured X official
            # ------------------------------------------------

            department = (
                complaint.authority
                or ""
            )


            official = find_social_official(
                district=
                    complaint.district,

                department=
                    department,

                category=
                    complaint.category,

                platform="X",
            )


            if not official:

                print(
                    f"[X] No verified social "
                    f"directory mapping for "
                    f"Complaint #{complaint.id}"
                )

                continue


            # ------------------------------------------------
            # Generate safe public post
            # ------------------------------------------------

            base_post = (
                generate_social_post(
                    complaint
                )
            )


            final_post = (
                _build_tagged_x_post(
                    base_post,
                    official,
                )
            )


            print(
                f"[X] Complaint #{complaint.id} "
                f"is eligible for automatic posting."
            )


            print(
                f"[X] Primary authority: "
                f"{official.get('official_name')}"
            )


            print(
                f"[X] Primary handle: "
                f"{official.get('handle')}"
            )


            print(
                f"[X] Higher authority: "
                f"{official.get('higher_authority_handle')}"
            )


            print(
                f"[X] Generated post "
                f"({len(final_post)} chars):"
            )


            print(
                final_post
            )


            # ------------------------------------------------
            # ACTUAL X API POST
            # ------------------------------------------------

            try:

                result = post_to_x(
                    final_post
                )


                complaint.social_platform = "X"

                complaint.social_post_id = (
                    result["post_id"]
                )

                complaint.social_post_url = (
                    result["post_url"]
                )

                complaint.social_escalated_at = (
                    datetime.now(
                        timezone.utc
                    )
                )

                complaint.social_escalated = "Yes"


                db.commit()


                print(
                    f"[X] SUCCESS - Complaint "
                    f"#{complaint.id} posted."
                )


                print(
                    f"[X] Post URL: "
                    f"{complaint.social_post_url}"
                )


            except Exception as exc:

                db.rollback()

                print(
                    f"[X] FAILED - Complaint "
                    f"#{complaint.id}: {exc}"
                )


        # ====================================================
        # CHECKER SUMMARY
        # ====================================================

        print(
            f"[SLA] Checked at "
            f"{now.isoformat()} | "
            f"Reminders due: "
            f"{len(reminder_complaints)} | "
            f"Expired complaints: "
            f"{len(expired_complaints)}"
        )


    except Exception as exc:

        db.rollback()

        print(
            f"[SLA] Deadline checker error: "
            f"{exc}"
        )


    finally:

        db.close()