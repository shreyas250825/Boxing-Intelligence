import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.responses import error_response, success_response
from app.models.boxer import Boxer
from app.models.nutrition import (
    FoodEntry,
    HydrationEntry,
    MealPlan,
    NutritionProfile,
    SupplementLog,
    WeightRecord,
)

router = APIRouter(prefix="/nutrition", tags=["nutrition"])

FOOD_DATABASE = [
    {"name": "Rice", "serving_size": "1 cup cooked", "calories": 205, "protein_g": 4.3, "carbs_g": 45, "fat_g": 0.4, "fibre_g": 0.6, "is_estimate": True},
    {"name": "Roti", "serving_size": "1 medium", "calories": 150, "protein_g": 4, "carbs_g": 27, "fat_g": 3.5, "fibre_g": 2.5, "is_estimate": True},
    {"name": "Idli", "serving_size": "2 pieces", "calories": 130, "protein_g": 4, "carbs_g": 23, "fat_g": 1.5, "fibre_g": 1.5, "is_estimate": True},
    {"name": "Dosa", "serving_size": "1 medium", "calories": 180, "protein_g": 5, "carbs_g": 30, "fat_g": 4, "fibre_g": 2.8, "is_estimate": True},
    {"name": "Paneer", "serving_size": "100 g", "calories": 265, "protein_g": 18, "carbs_g": 6, "fat_g": 20, "fibre_g": 0, "is_estimate": True},
    {"name": "Dal", "serving_size": "1 cup cooked", "calories": 230, "protein_g": 17, "carbs_g": 38, "fat_g": 1, "fibre_g": 11, "is_estimate": True},
    {"name": "Eggs", "serving_size": "2 large", "calories": 140, "protein_g": 12, "carbs_g": 1, "fat_g": 10, "fibre_g": 0, "is_estimate": True},
    {"name": "Chicken breast", "serving_size": "100 g cooked", "calories": 165, "protein_g": 31, "carbs_g": 0, "fat_g": 3.6, "fibre_g": 0, "is_estimate": True},
    {"name": "Fish", "serving_size": "100 g cooked", "calories": 200, "protein_g": 22, "carbs_g": 0, "fat_g": 12, "fibre_g": 0, "is_estimate": True},
    {"name": "Curd", "serving_size": "1 cup", "calories": 150, "protein_g": 10, "carbs_g": 7, "fat_g": 8, "fibre_g": 0, "is_estimate": True},
    {"name": "Milk", "serving_size": "1 cup", "calories": 150, "protein_g": 8, "carbs_g": 12, "fat_g": 8, "fibre_g": 0, "is_estimate": True},
    {"name": "Banana", "serving_size": "1 medium", "calories": 105, "protein_g": 1.3, "carbs_g": 27, "fat_g": 0.3, "fibre_g": 3.1, "is_estimate": True},
    {"name": "Apple", "serving_size": "1 medium", "calories": 95, "protein_g": 0.5, "carbs_g": 25, "fat_g": 0.3, "fibre_g": 4.4, "is_estimate": True},
    {"name": "Spinach", "serving_size": "1 cup cooked", "calories": 41, "protein_g": 5, "carbs_g": 7, "fat_g": 0.5, "fibre_g": 4.3, "is_estimate": True},
    {"name": "Mixed vegetables", "serving_size": "1 cup", "calories": 80, "protein_g": 3, "carbs_g": 15, "fat_g": 0.5, "fibre_g": 4, "is_estimate": True},
]


def _boxer_or_404(db: Session, boxer_id: str) -> Boxer:
    boxer = db.query(Boxer).filter(Boxer.id == boxer_id).first()
    if not boxer:
        raise HTTPException(status_code=404, detail=error_response("BOXER_NOT_FOUND", "Boxer not found")["error"])
    return boxer


def _profile_payload(profile: NutritionProfile | None) -> dict | None:
    if not profile:
        return None
    return {column.name: getattr(profile, column.name) for column in profile.__table__.columns}


def _entry_payload(entry: Any) -> dict:
    return {column.name: getattr(entry, column.name) for column in entry.__table__.columns}


@router.get("/food-database")
def list_food_database(q: str | None = Query(None)):
    query = (q or "").strip().lower()
    items = FOOD_DATABASE
    if query:
        items = [item for item in items if query in item["name"].lower()]
    return success_response(items)


@router.get("/boxers/{boxer_id}/profile")
def get_profile(boxer_id: str, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)
    profile = db.query(NutritionProfile).filter(NutritionProfile.boxer_id == boxer_id).first()
    return success_response(_profile_payload(profile))


@router.post("/boxers/{boxer_id}/profile", status_code=201)
def upsert_profile(boxer_id: str, data: dict, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)
    profile = db.query(NutritionProfile).filter(NutritionProfile.boxer_id == boxer_id).first()
    payload = dict(data)
    if profile is None:
        profile = NutritionProfile(boxer_id=boxer_id, **payload)
        db.add(profile)
    else:
        for key, value in payload.items():
            setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return success_response(_profile_payload(profile))


@router.get("/boxers/{boxer_id}/food-diary")
def list_diary(boxer_id: str, entry_date: str | None = None, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)
    query = db.query(FoodEntry).filter(FoodEntry.boxer_id == boxer_id)
    if entry_date:
        query = query.filter(FoodEntry.entry_date == entry_date)
    entries = query.order_by(FoodEntry.entry_date.desc(), FoodEntry.meal_time.asc()).all()
    return success_response([_entry_payload(entry) for entry in entries])


@router.post("/boxers/{boxer_id}/food-diary", status_code=201)
def add_food_entry(boxer_id: str, data: dict, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)
    entry = FoodEntry(boxer_id=boxer_id, **data)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return success_response(_entry_payload(entry))


@router.get("/boxers/{boxer_id}/meal-plans")
def list_meal_plans(boxer_id: str, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)
    plans = db.query(MealPlan).filter(MealPlan.boxer_id == boxer_id).order_by(MealPlan.plan_date.desc()).all()
    return success_response([_entry_payload(plan) for plan in plans])


@router.post("/boxers/{boxer_id}/meal-plans", status_code=201)
def add_meal_plan(boxer_id: str, data: dict, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)
    plan = MealPlan(boxer_id=boxer_id, **data)
    if "foods_json" in data and isinstance(data["foods_json"], list):
        plan.foods_json = json.dumps(data["foods_json"])
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return success_response(_entry_payload(plan))


@router.get("/boxers/{boxer_id}/hydration")
def list_hydration(boxer_id: str, entry_date: str | None = None, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)
    query = db.query(HydrationEntry).filter(HydrationEntry.boxer_id == boxer_id)
    if entry_date:
        query = query.filter(HydrationEntry.entry_date == entry_date)
    entries = query.order_by(HydrationEntry.entry_date.desc(), HydrationEntry.time_of_day.asc()).all()
    return success_response([_entry_payload(entry) for entry in entries])


@router.post("/boxers/{boxer_id}/hydration", status_code=201)
def add_hydration(boxer_id: str, data: dict, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)
    entry = HydrationEntry(boxer_id=boxer_id, **data)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return success_response(_entry_payload(entry))


@router.get("/boxers/{boxer_id}/weights")
def list_weights(boxer_id: str, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)
    entries = db.query(WeightRecord).filter(WeightRecord.boxer_id == boxer_id).order_by(WeightRecord.entry_date.desc()).all()
    return success_response([_entry_payload(entry) for entry in entries])


@router.post("/boxers/{boxer_id}/weights", status_code=201)
def add_weight(boxer_id: str, data: dict, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)
    entry = WeightRecord(boxer_id=boxer_id, **data)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return success_response(_entry_payload(entry))


@router.get("/boxers/{boxer_id}/supplements")
def list_supplements(boxer_id: str, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)
    entries = db.query(SupplementLog).filter(SupplementLog.boxer_id == boxer_id).order_by(SupplementLog.created_at.desc()).all()
    return success_response([_entry_payload(entry) for entry in entries])


@router.post("/boxers/{boxer_id}/supplements", status_code=201)
def add_supplement(boxer_id: str, data: dict, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)
    entry = SupplementLog(boxer_id=boxer_id, **data)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return success_response(_entry_payload(entry))


@router.get("/boxers/{boxer_id}/summary")
def nutrition_summary(boxer_id: str, entry_date: str | None = None, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)
    today = entry_date or __import__("datetime").datetime.utcnow().strftime("%Y-%m-%d")

    profile = db.query(NutritionProfile).filter(NutritionProfile.boxer_id == boxer_id).first()
    food_entries = db.query(FoodEntry).filter(FoodEntry.boxer_id == boxer_id, FoodEntry.entry_date == today).all()
    hydration_entries = db.query(HydrationEntry).filter(HydrationEntry.boxer_id == boxer_id, HydrationEntry.entry_date == today).all()
    weights = db.query(WeightRecord).filter(WeightRecord.boxer_id == boxer_id).order_by(WeightRecord.entry_date.desc()).all()

    calories = sum(item.calories for item in food_entries)
    protein = sum(item.protein_g for item in food_entries)
    carbs = sum(item.carbs_g for item in food_entries)
    fat = sum(item.fat_g for item in food_entries)
    fibre = sum(item.fibre_g for item in food_entries)
    hydration_total_ml = sum(item.amount_ml for item in hydration_entries)

    targets = {
        "calories": profile.target_calories if profile else 0,
        "protein_g": profile.target_protein_g if profile else 0,
        "carbs_g": profile.target_carbs_g if profile else 0,
        "fat_g": profile.target_fat_g if profile else 0,
        "fibre_g": profile.target_fibre_g if profile else 0,
    }

    return success_response({
        "profile": _profile_payload(profile),
        "date": today,
        "totals": {
            "calories": round(calories, 1),
            "protein_g": round(protein, 1),
            "carbs_g": round(carbs, 1),
            "fat_g": round(fat, 1),
            "fibre_g": round(fibre, 1),
            "hydration_ml": hydration_total_ml,
        },
        "targets": targets,
        "remaining": {
            "calories": max((targets["calories"] or 0) - calories, 0),
            "protein_g": max((targets["protein_g"] or 0) - protein, 0),
            "carbs_g": max((targets["carbs_g"] or 0) - carbs, 0),
            "fat_g": max((targets["fat_g"] or 0) - fat, 0),
            "fibre_g": max((targets["fibre_g"] or 0) - fibre, 0),
        },
        "meal_breakdown": {meal: round(sum(item.calories for item in food_entries if item.meal_type == meal), 1) for meal in ["breakfast", "mid_morning_snack", "lunch", "pre_training", "post_training", "evening_snack", "dinner", "other"]},
        "weight_history": [_entry_payload(weight) for weight in weights[:10]],
        "food_entries": [_entry_payload(item) for item in food_entries],
        "hydration_entries": [_entry_payload(item) for item in hydration_entries],
    })
