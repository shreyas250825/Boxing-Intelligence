import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.boxer import Boxer
from app.schemas.boxer import BoxerCreate, BoxerUpdate


class DuplicateBoxerError(Exception):
    def __init__(self, existing_id: str):
        self.existing_id = existing_id
        super().__init__(f"Boxer already exists: {existing_id}")


class BoxerNotFoundError(Exception):
    pass


def generate_permanent_id(db: Session) -> str:
    """Generate next sequential BX-XXXXXX ID within a transaction."""
    last = db.query(func.max(Boxer.permanent_id)).scalar()
    if last is None:
        next_num = 1
    else:
        try:
            next_num = int(last[3:]) + 1
        except (ValueError, IndexError):
            next_num = 1
    return f"BX-{next_num:06d}"


def check_duplicate(db: Session, full_name: str, date_of_birth: Optional[str]) -> Optional[Boxer]:
    """Return existing non-archived boxer matching name+DOB (case-insensitive), or None."""
    normalised = full_name.strip().lower()
    query = db.query(Boxer).filter(
        func.lower(func.trim(Boxer.full_name)) == normalised,
        Boxer.archived_at.is_(None),
    )
    if date_of_birth:
        query = query.filter(Boxer.date_of_birth == date_of_birth)
    return query.first()


def create_boxer(db: Session, data: BoxerCreate) -> Boxer:
    """Create a new boxer. Raises DuplicateBoxerError if non-archived duplicate exists."""
    existing = check_duplicate(db, data.full_name, data.date_of_birth)
    if existing:
        raise DuplicateBoxerError(existing.id)

    permanent_id = generate_permanent_id(db)
    boxer = Boxer(
        id=str(uuid.uuid4()),
        permanent_id=permanent_id,
        full_name=data.full_name,
        date_of_birth=data.date_of_birth,
        weight_class=data.weight_class,
        stance=data.stance,
        experience_level=data.experience_level,
        primary_coach=data.primary_coach,
        training_goals=data.training_goals,
        notes=data.notes,
        status="active",
    )
    db.add(boxer)
    db.commit()
    db.refresh(boxer)
    return boxer


def get_boxer(db: Session, boxer_id: str) -> Optional[Boxer]:
    return db.query(Boxer).filter(Boxer.id == boxer_id).first()


def list_boxers(
    db: Session,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Boxer], int]:
    """Returns (boxers, total_count)."""
    query = db.query(Boxer)
    if search:
        term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(Boxer.full_name).like(term),
                func.lower(Boxer.permanent_id).like(term),
            )
        )
    total = query.count()
    offset = (page - 1) * page_size
    boxers = query.order_by(Boxer.created_at.desc()).offset(offset).limit(page_size).all()
    return boxers, total


def update_boxer(db: Session, boxer_id: str, data: BoxerUpdate) -> Boxer:
    boxer = get_boxer(db, boxer_id)
    if not boxer:
        raise BoxerNotFoundError(boxer_id)
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(boxer, field, value)
    boxer.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(boxer)
    return boxer


def archive_boxer(db: Session, boxer_id: str) -> Boxer:
    boxer = get_boxer(db, boxer_id)
    if not boxer:
        raise BoxerNotFoundError(boxer_id)
    boxer.status = "archived"
    boxer.archived_at = datetime.utcnow()
    boxer.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(boxer)
    return boxer
