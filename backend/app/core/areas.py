DISTRICT_AREAS = {
    "Moradabad": [
        "Civil Lines",
        "Katghar",
        "Majhola",
        "Harthala",
        "Mughalpura",
        "Budh Bazar",
        "Ram Ganga Vihar",
        "Pakbara",
        "Kundarki",
        "Kanth",
    ],

    "Bareilly": [
        "Civil Lines",
        "Izzatnagar",
        "Rajendra Nagar",
        "Model Town",
        "DD Puram",
        "Satellite",
        "Prem Nagar",
        "Rampur Garden",
        "Baradari",
        "Subhash Nagar",
    ],

    "Bijnor": [
        "Bijnor City",
        "Najibabad",
        "Nagina",
        "Dhampur",
        "Chandpur",
        "Noorpur",
        "Nehtaur",
        "Kiratpur",
        "Seohara",
        "Sherkot",
    ],
}


def get_areas_by_district(district: str):
    if not district:
        return []

    return DISTRICT_AREAS.get(
        district.strip(),
        []
    )