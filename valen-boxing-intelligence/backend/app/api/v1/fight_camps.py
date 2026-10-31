from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.responses import success_response, error_response
from app.schemas.fight_camp import FightCampCreate, FightCampUpdate, FightCampResponse
from app.services import fight_camp_service
from app.services.fight_camp_service import FightCampNotFoundError, BoxerNotFoundError

router = APIRouter(tags=["fight_camps"])


@router.get("/boxers/{boxer_id}/fight-camps")
def list_fight_camps(boxer_id: str, db: Session = Depends(get_db)):
    from app.models.boxer import Boxer
    boxer = db.query(Boxer).filter(Boxer.id == boxer_id).first()
    if not boxer:
        raise HTTPException(
            status_code=404,
            detail=error_response("BOXER_NOT_FOUND", "Boxer not found")["error"],
        )
    camps = fight_camp_service.list_fight_camps(db, boxer_id)
    return success_response([FightCampResponse.model_validate(c).model_dump() for c in camps])


@router.post("/fight-camps", status_code=201)
def create_fight_camp(data: FightCampCreate, db: Session = Depends(get_db)):
    try:
        camp = fight_camp_service.create_fight_camp(db, data)
        return success_response(FightCampResponse.model_validate(camp).model_dump())
    except BoxerNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=error_response("BOXER_NOT_FOUND", "Boxer not found")["error"],
        )


@router.get("/fight-camps/{camp_id}")
def get_fight_camp(camp_id: str, db: Session = Depends(get_db)):
    camp = fight_camp_service.get_fight_camp(db, camp_id)
    if not camp:
        raise HTTPException(
            status_code=404,
            detail=error_response("FIGHT_CAMP_NOT_FOUND", "Fight camp not found")["error"],
        )
    return success_response(FightCampResponse.model_validate(camp).model_dump())


@router.put("/fight-camps/{camp_id}")
def update_fight_camp(camp_id: str, data: FightCampUpdate, db: Session = Depends(get_db)):
    try:
        camp = fight_camp_service.update_fight_camp(db, camp_id, data)
        return success_response(FightCampResponse.model_validate(camp).model_dump())
    except FightCampNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=error_response("FIGHT_CAMP_NOT_FOUND", "Fight camp not found")["error"],
        )


@router.delete("/fight-camps/{camp_id}", status_code=204)
def delete_fight_camp(camp_id: str, db: Session = Depends(get_db)):
    """Delete a fight camp. Sessions linked to it will have their fight_camp_id set to NULL."""
    from app.models.training_session import TrainingSession
    camp = fight_camp_service.get_fight_camp(db, camp_id)
    if not camp:
        raise HTTPException(status_code=404, detail=error_response("FIGHT_CAMP_NOT_FOUND", "Fight camp not found")["error"])
    # Nullify session references before deleting
    db.query(TrainingSession).filter(TrainingSession.fight_camp_id == camp_id).update({"fight_camp_id": None})
    db.delete(camp)
    db.commit()