from fastapi import APIRouter, HTTPException
import httpx
import asyncio

from app.core.areas import DISTRICT_AREAS


router = APIRouter(
    prefix="/location",
    tags=["Location"],
)


NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"

HEADERS = {
    "User-Agent": "Jan-Drishti/1.0",
    "Accept-Language": "en",
}


def clean(value):
    if not value:
        return None

    value = str(value).strip()

    if not value:
        return None

    return value


def normalize(value):
    if not value:
        return ""

    return (
        str(value)
        .strip()
        .lower()
        .replace("-", " ")
        .replace("_", " ")
    )


def find_supported_area(district, address, display_name):
    """
    Find a Jan-Drishti-supported area from the real
    reverse-geocoded location.

    We NEVER invent an area.

    Example:
        Moradabad + Harthala
        -> Harthala if Harthala is in DISTRICT_AREAS["Moradabad"]
    """

    if not district:
        return None

    supported_areas = DISTRICT_AREAS.get(district, [])

    if not supported_areas:
        return None

    # Everything returned by the geocoder that may contain
    # a locality name.
    candidates = []

    for key in [
        "neighbourhood",
        "suburb",
        "village",
        "town",
        "city_district",
        "municipality",
        "township",
        "quarter",
        "locality",
    ]:
        value = clean(address.get(key))

        if value:
            candidates.append(value)

    # Also check the complete display name.
    if display_name:
        candidates.append(display_name)

    # Exact supported-area match first.
    for supported_area in supported_areas:
        supported_normalized = normalize(supported_area)

        for candidate in candidates:
            candidate_normalized = normalize(candidate)

            if candidate_normalized == supported_normalized:
                return supported_area

    # If the area is contained inside a larger geocoder string.
    for supported_area in supported_areas:
        supported_normalized = normalize(supported_area)

        for candidate in candidates:
            candidate_normalized = normalize(candidate)

            if supported_normalized and supported_normalized in candidate_normalized:
                return supported_area

    return None


def get_detected_locality(address):
    """
    Return the most useful locality supplied by the geocoder.

    This is NOT automatically considered a Jan-Drishti
    supported area.
    """

    for key in [
        "neighbourhood",
        "suburb",
        "village",
        "town",
        "city_district",
        "municipality",
        "township",
        "quarter",
        "locality",
        "city",
    ]:
        value = clean(address.get(key))

        if value:
            return value

    return None


def get_district(address):
    """
    Extract the actual district.
    """

    return (
        clean(address.get("state_district"))
        or clean(address.get("district"))
        or clean(address.get("county"))
        or clean(address.get("city_district"))
    )


def get_exact_location(data, address, supported_area, detected_locality):
    """
    Build a human-readable location.

    Priority:

    1. Named POI / landmark
    2. House + road
    3. Road + locality
    4. Locality
    5. Display name

    We do NOT call a district-only result an exact location.
    """

    name = clean(data.get("name"))
    road = clean(address.get("road"))
    house_number = clean(address.get("house_number"))

    # ---------------------------------------------------------
    # 1. Named place / landmark
    # ---------------------------------------------------------

    if name:
        parts = [name]

        if road and road.lower() != name.lower():
            parts.append(road)

        if supported_area and supported_area.lower() not in [
            p.lower() for p in parts
        ]:
            parts.append(supported_area)

        elif detected_locality and detected_locality.lower() not in [
            p.lower() for p in parts
        ]:
            parts.append(detected_locality)

        return ", ".join(parts)

    # ---------------------------------------------------------
    # 2. House + road
    # ---------------------------------------------------------

    if house_number and road:
        parts = [
            f"{house_number}, {road}"
        ]

        if supported_area:
            parts.append(supported_area)
        elif detected_locality:
            parts.append(detected_locality)

        return ", ".join(parts)

    # ---------------------------------------------------------
    # 3. Road + area
    # ---------------------------------------------------------

    if road:
        parts = [road]

        if supported_area:
            parts.append(supported_area)
        elif detected_locality:
            parts.append(detected_locality)

        return ", ".join(parts)

    # ---------------------------------------------------------
    # 4. Locality
    # ---------------------------------------------------------

    if supported_area:
        return supported_area

    if detected_locality:
        return detected_locality

    # ---------------------------------------------------------
    # 5. Do not use district as "exact location"
    # ---------------------------------------------------------

    return ""


async def reverse_request(
    client,
    latitude,
    longitude,
    zoom,
):
    """
    One Nominatim reverse request.

    zoom:
        18 = building / street / POI
        14 = neighbourhood
        13 = village / suburb
    """

    params = {
        "lat": latitude,
        "lon": longitude,
        "format": "jsonv2",
        "addressdetails": 1,
        "namedetails": 1,
        "zoom": zoom,
        "layer": "address,poi",
    }

    response = await client.get(
        NOMINATIM_URL,
        params=params,
        headers=HEADERS,
    )

    response.raise_for_status()

    return response.json()


@router.get("/reverse")
async def reverse_geocode(
    latitude: float,
    longitude: float,
):
    """
    Convert GPS coordinates into a Jan-Drishti location.

    Output contains:

    - GPS coordinates
    - district
    - detected locality
    - supported Jan-Drishti area
    - exact readable location
    - routing area
    - support status
    """

    try:
        async with httpx.AsyncClient(
            timeout=12.0
        ) as client:

            # -------------------------------------------------
            # FIRST:
            # Get detailed street / POI / building information.
            # -------------------------------------------------

            detailed = await reverse_request(
                client,
                latitude,
                longitude,
                18,
            )

            detailed_address = detailed.get(
                "address",
                {},
            )

            district = get_district(
                detailed_address
            )

            detected_locality = get_detected_locality(
                detailed_address
            )

            supported_area = find_supported_area(
                district,
                detailed_address,
                detailed.get("display_name"),
            )

            # -------------------------------------------------
            # SECOND:
            # Only if we could not identify a supported area,
            # ask Nominatim for neighbourhood-level information.
            #
            # This is important because zoom 18 can sometimes
            # return the city but not the neighbourhood.
            # -------------------------------------------------

            area_data = None

            if not supported_area:
                # Respect the public Nominatim server's
                # request-rate expectations.
                await asyncio.sleep(1.1)

                area_data = await reverse_request(
                    client,
                    latitude,
                    longitude,
                    14,
                )

                area_address = area_data.get(
                    "address",
                    {},
                )

                # Use the more useful district if available.
                district = (
                    get_district(area_address)
                    or district
                )

                # Try again using the neighbourhood-level data.
                supported_area = find_supported_area(
                    district,
                    area_address,
                    area_data.get("display_name"),
                )

                if not detected_locality:
                    detected_locality = get_detected_locality(
                        area_address
                    )

            # -------------------------------------------------
            # EXACT LOCATION
            # -------------------------------------------------

            exact_location = get_exact_location(
                detailed,
                detailed_address,
                supported_area,
                detected_locality,
            )

            # If detailed result had no useful road/POI,
            # try the area-level result.
            if not exact_location and area_data:
                exact_location = get_exact_location(
                    area_data,
                    area_data.get("address", {}),
                    supported_area,
                    detected_locality,
                )

            # -------------------------------------------------
            # JAN-DRISHTI ROUTING
            # -------------------------------------------------

            supported = bool(
                district
                and supported_area
                and supported_area
                in DISTRICT_AREAS.get(district, [])
            )

            # -------------------------------------------------
            # FINAL RESPONSE
            # -------------------------------------------------

            return {
                "latitude": latitude,
                "longitude": longitude,

                # Full address returned by Nominatim
                "display_name": detailed.get(
                    "display_name"
                ),

                # Administrative district
                "district": district,

                # What the map thinks the locality is.
                # This can exist even when Jan-Drishti
                # doesn't support it.
                "detected_locality": detected_locality,

                # ONLY a Jan-Drishti-supported area.
                "area": supported_area,

                # Human-readable street / landmark / locality.
                "exact_location": exact_location,

                # Area actually used for complaint routing.
                "routing_area": (
                    supported_area
                    if supported
                    else None
                ),

                # Whether Jan-Drishti can automatically
                # route this complaint.
                "supported": supported,

                "location_source": "nominatim",
            }

    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to determine location "
                "from GPS coordinates."
            ),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unexpected error while "
                "processing location."
            ),
        ) from exc