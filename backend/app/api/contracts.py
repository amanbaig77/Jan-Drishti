from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.contract import ContractRequest

from app.schemas.contract import (
    ContractCreate,
    ContractResponse,
    ContractAdminUpdate,
    ALLOWED_DISTRICTS,
    ALLOWED_REQUESTER_TYPES,
    ALLOWED_WORK_CATEGORIES,
)


router = APIRouter(
    prefix="/contracts",
    tags=["Jan-Drishti Contract"]
)


# ============================================================
# CONTRACT CONFIG
# ============================================================

@router.get("/config")
def get_contract_config():

    return {
        "state": "Uttar Pradesh",

        "districts": ALLOWED_DISTRICTS,

        "requester_types": ALLOWED_REQUESTER_TYPES,

        "work_categories": ALLOWED_WORK_CATEGORIES,

        "service_promises": {
            "work_start": (
                "Work coordination starts within 24 hours "
                "after contract approval, where applicable."
            ),

            "execution": (
                "Work is performed through suitable "
                "verified execution partners."
            ),

            "warranty": (
                "Contract-specific warranty / workmanship "
                "period may apply depending on the work."
            )
        }
    }


# ============================================================
# CREATE CONTRACT REQUEST
# ============================================================

@router.post(
    "/",
    response_model=ContractResponse
)
def create_contract_request(
    contract_data: ContractCreate,
    db: Session = Depends(get_db)
):

    if contract_data.district not in ALLOWED_DISTRICTS:

        raise HTTPException(
            status_code=400,
            detail=(
                "Jan-Drishti Contract is currently "
                "available only in Moradabad, "
                "Bareilly and Bijnor."
            )
        )

    if (
        contract_data.requester_type
        not in ALLOWED_REQUESTER_TYPES
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid requester type."
        )

    if (
        contract_data.work_category
        not in ALLOWED_WORK_CATEGORIES
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid work category."
        )

    contract = ContractRequest(

        requester_name=contract_data.requester_name,

        requester_type=contract_data.requester_type,

        organization_name=contract_data.organization_name,

        phone=contract_data.phone,

        email=contract_data.email,

        state="Uttar Pradesh",

        district=contract_data.district,

        area=contract_data.area,

        exact_location=contract_data.exact_location,

        work_category=contract_data.work_category,

        work_title=contract_data.work_title,

        description=contract_data.description,

        expected_scope=contract_data.expected_scope,

        approximate_budget=contract_data.approximate_budget,

        desired_timeline=contract_data.desired_timeline,

        image_url=contract_data.image_url,

        video_url=contract_data.video_url,

        document_url=contract_data.document_url,

        status="Submitted"
    )

    db.add(contract)

    db.commit()

    db.refresh(contract)

    return contract


# ============================================================
# GET ALL CONTRACT REQUESTS
# ============================================================

@router.get(
    "/",
    response_model=list[ContractResponse]
)
def get_contract_requests(
    db: Session = Depends(get_db)
):

    contracts = (
        db.query(ContractRequest)
        .order_by(
            ContractRequest.id.desc()
        )
        .all()
    )

    return contracts


# ============================================================
# GET SINGLE CONTRACT
# ============================================================

@router.get(
    "/{contract_id}",
    response_model=ContractResponse
)
def get_contract_request(
    contract_id: int,
    db: Session = Depends(get_db)
):

    contract = (
        db.query(ContractRequest)
        .filter(
            ContractRequest.id == contract_id
        )
        .first()
    )

    if not contract:

        raise HTTPException(
            status_code=404,
            detail="Contract request not found."
        )

    return contract


# ============================================================
# ADMIN CONTRACT REVIEW
# ============================================================

@router.patch(
    "/{contract_id}/review",
    response_model=ContractResponse
)
def review_contract_request(
    contract_id: int,
    review_data: ContractAdminUpdate,
    db: Session = Depends(get_db)
):

    contract = (
        db.query(ContractRequest)
        .filter(
            ContractRequest.id == contract_id
        )
        .first()
    )

    if not contract:

        raise HTTPException(
            status_code=404,
            detail="Contract request not found."
        )

    allowed_actions = [
        "Under Review",
        "Technical Assessment",
        "Proposal",
        "Approved",
        "Rejected",
    ]

    if review_data.action not in allowed_actions:

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid action. Allowed actions: "
                + ", ".join(allowed_actions)
            )
        )

    # --------------------------------------------------------
    # Update status
    # --------------------------------------------------------

    contract.status = review_data.action

    # --------------------------------------------------------
    # Update proposal / assessment information
    # --------------------------------------------------------

    if review_data.estimated_cost is not None:
        contract.estimated_cost = review_data.estimated_cost

    if review_data.proposed_timeline is not None:
        contract.proposed_timeline = review_data.proposed_timeline

    if review_data.warranty_period is not None:
        contract.warranty_period = review_data.warranty_period

    if review_data.admin_notes is not None:
        contract.admin_notes = review_data.admin_notes

    db.commit()

    db.refresh(contract)

    return contract