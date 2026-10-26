from app.core.config import STATE, DISTRICTS


AUTHORITY_MAPPING = {
    "road damage": {
        "department": "Public Works Department (PWD)",
        "authority_type": "PWD / Local Road Authority"
    },

    "garbage / waste": {
        "department": "Municipal / Nagar Palika",
        "authority_type": "Municipal Sanitation Department"
    },

    "street light": {
        "department": "Municipal / Nagar Palika",
        "authority_type": "Municipal Electrical Department"
    },

    "water supply": {
        "department": "Jal Nigam / Local Water Supply Authority",
        "authority_type": "Water Supply Department"
    },

    "drainage / sewerage": {
        "department": "Municipal / Nagar Palika",
        "authority_type": "Drainage / Sewerage Department"
    },

    "electricity": {
        "department": "Electricity Distribution Authority",
        "authority_type": "Electricity Department"
    },

    "public safety": {
        "department": "Police Department",
        "authority_type": "Local Police Authority"
    },

    "other": {
        "department": "District Administration",
        "authority_type": "District Authority"
    }
}


DISTRICT_AUTHORITY = {
    "moradabad": "Moradabad District Authority",
    "bareilly": "Bareilly District Authority",
    "bijnor": "Bijnor District Authority"
}


def get_authority(district: str, category: str):

    district_key = district.strip().lower()
    category_key = category.strip().lower()

    if district_key not in DISTRICT_AUTHORITY:
        return None

    mapping = AUTHORITY_MAPPING.get(category_key)

    if not mapping:
        return None

    return {
        "state": STATE,
        "district": district.strip(),
        "department": mapping["department"],
        "authority_type": mapping["authority_type"],
        "district_authority": DISTRICT_AUTHORITY[district_key]
    }