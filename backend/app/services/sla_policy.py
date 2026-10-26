# ============================================================
# JAN-DRISHTI
# SLA POLICY
# ============================================================

# Fixed/known monitoring periods.
# Only use a number where Jan-Drishti has a defined basis
# for using that period.

SLA_POLICY = {
    "Road Damage": 7,
    "Garbage / Waste": 10,
    "Stray Animal": 10,
    "Illegal Construction": 15,
}


def get_sla_days(category: str) -> int | None:
    """
    Return the configured SLA days for a complaint category.

    Returns:
        int  -> Jan-Drishti has a configured monitoring period
        None -> no fixed period configured
    """

    if not category:
        return None

    category = category.strip()

    return SLA_POLICY.get(category)