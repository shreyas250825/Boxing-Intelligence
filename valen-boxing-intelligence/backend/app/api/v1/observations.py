from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.responses import success_response, error_response
from app.schemas.observation import ObservationCreate, ObservationUpdate, ObservationResponse
from app.services import observation_service
from app.services.observation_service import ObservationNotFoundError

router = APIRouter(tags=["observations"])


@router.get("/videos/{video_id}/observations")
def list_observations(video_id: str, db: Session = Depends(get_db)):
    observations = observation_service.list_observations(db, video_id)
    return success_response([ObservationResponse.model_validate(o).model_dump() for o in observations])


@router.post("/observations", status_code=201)
def create_observation(data: ObservationCreate, db: Session = Depends(get_db)):
    obs = observation_service.create_observation(db, data)
    return success_response(ObservationResponse.model_validate(obs).model_dump())


@router.put("/observations/{obs_id}")
def update_observation(obs_id: str, data: ObservationUpdate, db: Session = Depends(get_db)):
    try:
        obs = observation_service.update_observation(db, obs_id, data)
        return success_response(ObservationResponse.model_validate(obs).model_dump())
    except ObservationNotFoundError:
        raise HTTPException(status_code=404, detail=error_response("OBSERVATION_NOT_FOUND", "Observation not found")["error"])


@router.delete("/observations/{obs_id}", status_code=204)
def delete_observation(obs_id: str, db: Session = Depends(get_db)):
    try:
        observation_service.delete_observation(db, obs_id)
    except ObservationNotFoundError:
        raise HTTPException(status_code=404, detail=error_response("OBSERVATION_NOT_FOUND", "Observation not found")["error"])
