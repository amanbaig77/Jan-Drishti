# ============================================================
# JAN-DRISHTI
# SOCIAL MEDIA SERVICE
# ============================================================


def _shorten(value, max_length):
    if not value:
        return ""

    value = str(value).strip()

    if len(value) <= max_length:
        return value

    return value[: max_length - 3].rstrip() + "..."


def generate_social_post(complaint):
    """
    Generate a short fact-based X post
    for an expired complaint.
    """

    district = _shorten(
        complaint.district or "Unknown District",
        25,
    )

    area = _shorten(
        complaint.area or "Unknown Area",
        25,
    )

    category = _shorten(
        complaint.category or "Civic Issue",
        30,
    )

    authority = _shorten(
        complaint.authority or "Concerned Authority",
        45,
    )

    post = (
        f"Jan-Drishti Complaint #{complaint.id}\n\n"
        f"{category} reported in {area}, {district}.\n\n"
        f"Authority: {authority}\n\n"
        f"Response deadline passed with no recorded official "
        f"response or resolution.\n\n"
        f"#JanDrishti"
    )

    if len(post) > 280:
        post = (
            f"Jan-Drishti Complaint #{complaint.id}: "
            f"{category} in {area}, {district}. "
            f"Response deadline passed with no recorded "
            f"official response/resolution. "
            f"#JanDrishti"
        )

    return post[:280].strip()


def is_social_escalation_eligible(complaint):
    """
    Check whether a complaint is eligible
    for automatic X escalation.
    """

    # Admin must explicitly enable X escalation.
    if not getattr(
        complaint,
        "x_escalation_enabled",
        False,
    ):
        return False

    # Deadline must be crossed.
    if complaint.deadline_crossed != "Yes":
        return False

    # Must not already have been posted.
    if complaint.social_escalated == "Yes":
        return False

    # Any authority response stops automatic escalation.
    if complaint.authority_response:
        return False

    if complaint.response_date:
        return False

    # Resolved complaints must never be escalated.
    if complaint.status == "Resolved":
        return False

    if complaint.resolution_status:
        if (
            complaint.resolution_status
            .strip()
            .lower()
            == "resolved"
        ):
            return False

    # Evidence must exist.
    if not complaint.image_url:
        return False

    if not complaint.video_url:
        return False

    return True