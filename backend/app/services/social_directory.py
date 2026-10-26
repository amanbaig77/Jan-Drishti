# ============================================================
# JAN-DRISHTI
# OFFICIAL SOCIAL MEDIA DIRECTORY
# ============================================================


OFFICIAL_SOCIAL_DIRECTORY = [

    # ========================================================
    # MORADABAD
    # ========================================================

    # --------------------------------------------------------
    # GARBAGE / WASTE - MAJHOLA
    # --------------------------------------------------------

    {
        "district": "Moradabad",

        "department": (
            "Moradabad Municipal / Local Civic Authority "
            "- Majhola - DEMO"
        ),

        "category": "Garbage / Waste",

        "platform": "X",

        "official_name": (
            "Moradabad Municipal Authority"
        ),

        "handle": "@nagarnigammbd",

        "higher_authority_name": (
            "District Magistrate, Moradabad"
        ),

        "higher_authority_handle": (
            "@DMMoradabad"
        ),

        "verified_source": (
            "moradabad.nic.in"
        ),

        "active": True,
    },


    # --------------------------------------------------------
    # ROAD DAMAGE - HARTHALA
    # --------------------------------------------------------

    {
        "district": "Moradabad",

        "department": (
            "Moradabad Municipal / Local Civic Authority "
            "- Harthala - DEMO"
        ),

        "category": "Road Damage",

        "platform": "X",

        "official_name": (
            "Nagar Nigam Moradabad"
        ),

        "handle": "@nagarnigammbd",

        "higher_authority_name": (
            "District Magistrate, Moradabad"
        ),

        "higher_authority_handle": (
            "@DMMoradabad"
        ),

        "verified_source": (
            "Jan-Drishti demo mapping; "
            "verify category ownership before production"
        ),

        "active": True,
    },


    # --------------------------------------------------------
    # ILLEGAL CONSTRUCTION
    # --------------------------------------------------------

    {
        "district": "Moradabad",

        "department": (
            "Moradabad Development Authority"
        ),

        "category": "Illegal Construction",

        "platform": "X",

        "official_name": (
            "Moradabad Development Authority"
        ),

        "handle": "@mdambup",

        "higher_authority_name": (
            "District Magistrate, Moradabad"
        ),

        "higher_authority_handle": (
            "@DMMoradabad"
        ),

        "verified_source": (
            "Moradabad Development Authority / "
            "official district sources"
        ),

        "active": True,
    },


    # ========================================================
    # BIJNOR
    # ========================================================

    {
        "district": "Bijnor",

        "department": (
            "District Administration"
        ),

        "category": "Public Safety",

        "platform": "X",

        "official_name": (
            "District Administration, Bijnor"
        ),

        "handle": "@VERIFY_BIJNOR_HANDLE",

        "higher_authority_name": (
            "CDO Bijnor"
        ),

        "higher_authority_handle": (
            "@CdoBijnor"
        ),

        "verified_source": (
            "bijnor.nic.in"
        ),

        "active": True,
    },
]


# ============================================================
# FIND SOCIAL OFFICIAL
# ============================================================

def find_social_official(
    district: str,
    department: str,
    category: str,
    platform: str = "X",
):
    """
    Find the configured social-media authority for a complaint.

    Match:
    District
    + Department
    + Category
    + Platform
    """

    if not district:
        return None

    if not department:
        return None

    if not category:
        return None

    if not platform:
        return None


    normalized_district = (
        district.strip().lower()
    )

    normalized_department = (
        department.strip().lower()
    )

    normalized_category = (
        category.strip().lower()
    )

    normalized_platform = (
        platform.strip().lower()
    )


    for official in OFFICIAL_SOCIAL_DIRECTORY:

        if not official.get("active", False):
            continue


        handle = (
            official.get("handle", "").strip()
        )


        # Never use empty or placeholder handles.
        if (
            not handle
            or handle.upper().startswith("@VERIFY_")
        ):
            continue


        official_district = (
            official
            .get("district", "")
            .strip()
            .lower()
        )

        official_department = (
            official
            .get("department", "")
            .strip()
            .lower()
        )

        official_category = (
            official
            .get("category", "")
            .strip()
            .lower()
        )

        official_platform = (
            official
            .get("platform", "")
            .strip()
            .lower()
        )


        if (
            official_district == normalized_district
            and official_department == normalized_department
            and official_category == normalized_category
            and official_platform == normalized_platform
        ):
            return official


    return None