from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


ALLOWED_DISTRICTS = [
    "Moradabad",
    "Bareilly",
    "Bijnor",
]


ALLOWED_REQUESTER_TYPES = [
    "Society / RWA",
    "School / College / Institution",
    "Private Organization",
    "Private Person",
    "Government / Public Institution",
]


ALLOWED_WORK_CATEGORIES = [
    "Road & Pavement",
    "Drainage / Sewerage",
    "Water Supply",
    "Waste Management",
    "Street Lighting",
    "Public Area Maintenance",
    "Other Civic Work",
]


class ContractCreate(BaseModel):

    # ---------------------------------------------
    # REQUESTER
    # ---------------------------------------------

    requester_name: str = Field(
        min_length=2,
        max_length=150
    )

    requester_type: str

    organization_name: str | None = None

    phone: str = Field(
        min_length=8,
        max_length=20
    )

    email: str

    # ---------------------------------------------
    # LOCATION
    # ---------------------------------------------

    state: str = "Uttar Pradesh"

    district: str

    area: str = Field(
        min_length=2,
        max_length=150
    )

    exact_location: str = Field(
        min_length=5
    )

    # ---------------------------------------------
    # WORK
    # ---------------------------------------------

    work_category: str

    work_title: str = Field(
        min_length=3,
        max_length=200
    )

    description: str = Field(
        min_length=10
    )

    expected_scope: str | None = None

    approximate_budget: str | None = None

    desired_timeline: str | None = None

    # ---------------------------------------------
    # EVIDENCE
    # ---------------------------------------------

    image_url: str | None = None

    video_url: str | None = None

    document_url: str | None = None


class ContractResponse(BaseModel):

    id: int

    requester_name: str

    requester_type: str

    organization_name: str | None = None

    phone: str

    email: str

    state: str

    district: str

    area: str

    exact_location: str

    work_category: str

    work_title: str

    description: str

    expected_scope: str | None = None

    approximate_budget: str | None = None

    desired_timeline: str | None = None

    image_url: str | None = None

    video_url: str | None = None

    document_url: str | None = None

    status: str

    assigned_partner: str | None = None

    estimated_cost: str | None = None

    proposed_timeline: str | None = None

    warranty_period: str | None = None

    admin_notes: str | None = None

    created_at: datetime | None = None

    updated_at: datetime | None = None

    model_config = ConfigDict(
        from_attributes=True
    )


class ContractAdminUpdate(BaseModel):
    action: str
    estimated_cost: str | None = None
    proposed_timeline: str | None = None
    warranty_period: str | None = None
    admin_notes: str | None = None