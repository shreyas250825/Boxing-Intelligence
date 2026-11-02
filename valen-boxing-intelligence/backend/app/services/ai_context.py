"""
AI Corner context engine.

Retrieves relevant, recent, permission-checked boxer data to include
in AI companion system prompts. Each context block is fetched only when
the companion actually needs it — no bulk dumps.
"""
from __future__ import annotations

import json
from datetime import date, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.models.boxer import Boxer
from app.models.development import (
    DevelopmentGoal,
    RecoveryCheckin,
    SkillAssessment,
    TrainingJournalEntry,
    CompetitionPlan,
)
from app.models.fight_camp import FightCamp
from app.models.metric import Metric
from app.models.nutrition import (
    FoodEntry,
    HydrationEntry,
    MealPlan,
    NutritionProfile,
    WeightRecord,
    SupplementLog,
)
from app.models.observation import Observation
from app.models.training_session import TrainingSession
from app.models.video import Video
from app.models.ai_corner import AIMemory, AIConversation, AIMessage

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _date_range(days_back: int) -> str:
    """ISO date string 'days_back' days ago."""
    return (date.today() - timedelta(days=days_back)).isoformat()


def _safe_json(value: str | None) -> Any:
    if not value:
        return None
    try:
        return json.loads(value)
    except Exception:
        return value


# ---------------------------------------------------------------------------
# Base boxer profile (always included)
# ---------------------------------------------------------------------------

def get_boxer_profile(boxer_id: str, db: Session) -> dict:
    boxer = db.query(Boxer).filter(Boxer.id == boxer_id).first()
    if not boxer:
        return {}
    return {
        "id": boxer.id,
        "name": boxer.full_name,
        "permanent_id": boxer.permanent_id,
        "date_of_birth": boxer.date_of_birth,
        "weight_class": boxer.weight_class,
        "stance": boxer.stance,
        "experience_level": boxer.experience_level,
        "primary_coach": boxer.primary_coach,
        "training_goals": boxer.training_goals,
        "status": boxer.status,
    }


# ---------------------------------------------------------------------------
# Training context
# ---------------------------------------------------------------------------

def get_recent_sessions(boxer_id: str, db: Session, days: int = 30) -> list[dict]:
    cutoff = _date_range(days)
    sessions = (
        db.query(TrainingSession)
        .filter(
            TrainingSession.boxer_id == boxer_id,
            TrainingSession.session_date >= cutoff,
        )
        .order_by(TrainingSession.session_date.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "date": s.session_date,
            "type": s.session_type,
            "rounds": s.rounds,
            "round_duration_seconds": s.round_duration_seconds,
            "objectives": s.objectives,
            "coach_notes": s.coach_notes,
        }
        for s in sessions
    ]


def get_journal_entries(boxer_id: str, db: Session, days: int = 14) -> list[dict]:
    cutoff = _date_range(days)
    entries = (
        db.query(TrainingJournalEntry)
        .filter(
            TrainingJournalEntry.boxer_id == boxer_id,
            TrainingJournalEntry.session_date >= cutoff,
        )
        .order_by(TrainingJournalEntry.session_date.desc())
        .limit(10)
        .all()
    )
    return [
        {
            "date": e.session_date,
            "type": e.session_type,
            "duration_minutes": e.duration_minutes,
            "focus": e.focus,
            "what_went_well": e.what_went_well,
            "needs_improvement": e.needs_improvement,
            "questions_for_coach": e.questions_for_coach,
            "notes": e.notes,
        }
        for e in entries
    ]


def get_development_goals(boxer_id: str, db: Session) -> list[dict]:
    goals = (
        db.query(DevelopmentGoal)
        .filter(DevelopmentGoal.boxer_id == boxer_id, DevelopmentGoal.status == "active")
        .order_by(DevelopmentGoal.is_primary.desc())
        .limit(10)
        .all()
    )
    return [
        {
            "title": g.title,
            "description": g.description,
            "start_date": g.start_date,
            "target_date": g.target_date,
            "success_criteria": g.success_criteria,
            "status": g.status,
            "completion_percent": g.completion_percent,
            "assigned_coach": g.assigned_coach,
        }
        for g in goals
    ]


def get_skill_assessments(boxer_id: str, db: Session) -> list[dict]:
    assessments = (
        db.query(SkillAssessment)
        .filter(SkillAssessment.boxer_id == boxer_id)
        .order_by(SkillAssessment.updated_at.desc())
        .limit(15)
        .all()
    )
    return [
        {
            "skill": a.skill_name,
            "current_level": a.current_level,
            "development_goal": a.development_goal,
            "coach_notes": a.coach_notes,
            "assigned_drill": a.assigned_drill,
            "coach_assessed": a.coach_assessed,
        }
        for a in assessments
    ]


# ---------------------------------------------------------------------------
# Nutrition context
# ---------------------------------------------------------------------------

def get_nutrition_profile(boxer_id: str, db: Session) -> dict | None:
    profile = (
        db.query(NutritionProfile)
        .filter(NutritionProfile.boxer_id == boxer_id)
        .first()
    )
    if not profile:
        return None
    return {
        "age": profile.age,
        "height_cm": profile.height_cm,
        "current_weight_kg": profile.current_weight_kg,
        "target_weight_kg": profile.target_weight_kg,
        "target_competition_weight": profile.target_competition_weight_category,
        "dietary_preferences": profile.dietary_preferences,
        "vegetarian": profile.vegetarian,
        "food_allergies": profile.food_allergies,
        "foods_to_avoid": profile.foods_to_avoid,
        "nutrition_goals": profile.nutrition_goals,
        "target_calories": profile.target_calories,
        "target_protein_g": profile.target_protein_g,
        "target_carbs_g": profile.target_carbs_g,
        "target_fat_g": profile.target_fat_g,
        "nutritionist_targets": profile.nutritionist_targets,
    }


def get_food_diary(boxer_id: str, db: Session, days: int = 7) -> list[dict]:
    cutoff = _date_range(days)
    entries = (
        db.query(FoodEntry)
        .filter(FoodEntry.boxer_id == boxer_id, FoodEntry.entry_date >= cutoff)
        .order_by(FoodEntry.entry_date.desc(), FoodEntry.meal_type)
        .limit(60)
        .all()
    )
    return [
        {
            "date": e.entry_date,
            "meal_type": e.meal_type,
            "food_name": e.food_name,
            "quantity": e.quantity,
            "calories": e.calories,
            "protein_g": e.protein_g,
            "carbs_g": e.carbs_g,
            "fat_g": e.fat_g,
            "fibre_g": e.fibre_g,
            "is_estimate": e.is_estimate,
        }
        for e in entries
    ]


def get_hydration_log(boxer_id: str, db: Session, days: int = 7) -> list[dict]:
    cutoff = _date_range(days)
    entries = (
        db.query(HydrationEntry)
        .filter(HydrationEntry.boxer_id == boxer_id, HydrationEntry.entry_date >= cutoff)
        .order_by(HydrationEntry.entry_date.desc())
        .limit(40)
        .all()
    )
    return [
        {"date": e.entry_date, "drink": e.drink_name, "amount_ml": e.amount_ml, "time": e.time_of_day}
        for e in entries
    ]


def get_weight_history(boxer_id: str, db: Session, days: int = 60) -> list[dict]:
    cutoff = _date_range(days)
    records = (
        db.query(WeightRecord)
        .filter(WeightRecord.boxer_id == boxer_id, WeightRecord.entry_date >= cutoff)
        .order_by(WeightRecord.entry_date.desc())
        .limit(20)
        .all()
    )
    return [
        {"date": r.entry_date, "weight_kg": r.weight_kg, "is_official": r.is_official}
        for r in records
    ]


# ---------------------------------------------------------------------------
# Recovery context
# ---------------------------------------------------------------------------

def get_recovery_checkins(boxer_id: str, db: Session, days: int = 14) -> list[dict]:
    cutoff = _date_range(days)
    checkins = (
        db.query(RecoveryCheckin)
        .filter(RecoveryCheckin.boxer_id == boxer_id, RecoveryCheckin.entry_date >= cutoff)
        .order_by(RecoveryCheckin.entry_date.desc())
        .limit(14)
        .all()
    )
    return [
        {
            "date": c.entry_date,
            "energy_level": c.energy_level,
            "sleep_hours": c.sleep_hours,
            "recovery_score": c.recovery_score,
            "soreness_notes": c.soreness_notes,
            "stress_level": c.stress_level,
            "readiness_rating": c.readiness_rating,
            "notes": c.notes,
        }
        for c in checkins
    ]


# ---------------------------------------------------------------------------
# Competition context
# ---------------------------------------------------------------------------

def get_competition_plans(boxer_id: str, db: Session) -> list[dict]:
    plans = (
        db.query(CompetitionPlan)
        .filter(
            CompetitionPlan.boxer_id == boxer_id,
            CompetitionPlan.status.in_(["planned", "confirmed"]),
        )
        .order_by(CompetitionPlan.competition_date)
        .limit(5)
        .all()
    )
    return [
        {
            "name": p.competition_name,
            "date": p.competition_date,
            "weight_category": p.weight_category,
            "status": p.status,
            "milestones": _safe_json(p.milestones),
        }
        for p in plans
    ]


def get_fight_camps(boxer_id: str, db: Session) -> list[dict]:
    camps = (
        db.query(FightCamp)
        .filter(FightCamp.boxer_id == boxer_id, FightCamp.status.in_(["planned", "active"]))
        .order_by(FightCamp.target_fight_date)
        .limit(3)
        .all()
    )
    return [
        {
            "name": c.name,
            "target_fight_date": c.target_fight_date,
            "start_date": c.start_date,
            "end_date": c.end_date,
            "status": c.status,
            "objectives": c.objectives,
        }
        for c in camps
    ]


# ---------------------------------------------------------------------------
# Video analysis context
# ---------------------------------------------------------------------------

def get_recent_video_observations(boxer_id: str, db: Session, days: int = 30) -> list[dict]:
    cutoff = _date_range(days)
    obs = (
        db.query(Observation)
        .filter(
            Observation.boxer_id == boxer_id,
        )
        .order_by(Observation.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "category": o.category,
            "description": o.description,
            "severity": o.severity,
            "coach_notes": o.coach_notes,
            "recommended_drill": o.recommended_drill,
            "review_status": o.review_status,
        }
        for o in obs
    ]


def get_recent_metrics(boxer_id: str, db: Session, days: int = 60) -> list[dict]:
    cutoff = _date_range(days)
    metrics = (
        db.query(Metric)
        .filter(
            Metric.boxer_id == boxer_id,
            Metric.recorded_at >= cutoff,
        )
        .order_by(Metric.recorded_at.desc())
        .limit(50)
        .all()
    )
    # Group by metric_key to show trends
    grouped: dict[str, list] = {}
    for m in metrics:
        grouped.setdefault(m.metric_key, []).append(
            {"value": m.value, "unit": m.unit, "date": str(m.recorded_at)[:10], "source": m.source}
        )
    return [{"metric": k, "values": v} for k, v in grouped.items()]


# ---------------------------------------------------------------------------
# AI Memory context
# ---------------------------------------------------------------------------

def get_companion_memories(boxer_id: str, companion_slug: str, db: Session) -> list[dict]:
    memories = (
        db.query(AIMemory)
        .filter(
            AIMemory.boxer_id == boxer_id,
            AIMemory.companion_slug == companion_slug,
            AIMemory.is_active == True,  # noqa: E712
        )
        .order_by(AIMemory.updated_at.desc())
        .limit(20)
        .all()
    )
    return [{"key": m.memory_key, "value": m.memory_value, "origin": m.origin} for m in memories]


def get_recent_conversation_history(
    boxer_id: str, companion_slug: str, db: Session, limit: int = 6
) -> list[dict]:
    """Return the last N user+assistant message pairs from the most recent conversation."""
    conv = (
        db.query(AIConversation)
        .filter(
            AIConversation.boxer_id == boxer_id,
            AIConversation.companion_slug == companion_slug,
            AIConversation.is_archived == False,  # noqa: E712
        )
        .order_by(AIConversation.updated_at.desc())
        .first()
    )
    if not conv:
        return []
    messages = (
        db.query(AIMessage)
        .filter(
            AIMessage.conversation_id == conv.id,
            AIMessage.role.in_(["user", "assistant"]),
        )
        .order_by(AIMessage.created_at.desc())
        .limit(limit)
        .all()
    )
    return [{"role": m.role, "content": m.content} for m in reversed(messages)]


# ---------------------------------------------------------------------------
# Context assembler per companion
# ---------------------------------------------------------------------------

# What each companion slug needs
_COMPANION_CONTEXT_MAP: dict[str, list[str]] = {
    "coach-valen": [
        "profile", "sessions", "journal", "goals", "skills", "observations", "competition", "fight_camps",
    ],
    "nutricoach": [
        "profile", "nutrition_profile", "food_diary", "hydration", "weight", "supplements",
    ],
    "recoverai": [
        "profile", "recovery", "sessions", "metrics",
    ],
    "corneriq": [
        "profile", "competition", "fight_camps", "skills", "sessions", "observations",
    ],
    "visionbox": [
        "profile", "observations", "metrics", "sessions",
    ],
    "mindcorner": [
        "profile", "goals", "journal", "recovery", "competition",
    ],
    "performancelab": [
        "profile", "metrics", "sessions", "skills", "recovery",
    ],
    "boxing-academy": [
        "profile",
    ],
    # Coach assistant has access to all
    "coach-assistant": [
        "profile", "sessions", "journal", "goals", "skills", "observations",
        "recovery", "metrics", "nutrition_profile", "food_diary", "competition", "fight_camps",
    ],
}


def build_context_for_companion(
    boxer_id: str,
    companion_slug: str,
    db: Session,
    extra_keys: list[str] | None = None,
) -> dict[str, Any]:
    """
    Assemble only the context keys the companion needs.
    Returns a dict with keys matching the context map.
    Also returns 'missing_data' list of items with no records.
    """
    needed_keys = set(_COMPANION_CONTEXT_MAP.get(companion_slug, ["profile"]))
    if extra_keys:
        needed_keys.update(extra_keys)

    ctx: dict[str, Any] = {}
    missing: list[str] = []

    if "profile" in needed_keys:
        ctx["boxer_profile"] = get_boxer_profile(boxer_id, db)

    if "sessions" in needed_keys:
        sessions = get_recent_sessions(boxer_id, db)
        ctx["recent_sessions"] = sessions
        if not sessions:
            missing.append("recent training sessions")

    if "journal" in needed_keys:
        journal = get_journal_entries(boxer_id, db)
        ctx["journal_entries"] = journal
        if not journal:
            missing.append("training journal entries (last 14 days)")

    if "goals" in needed_keys:
        goals = get_development_goals(boxer_id, db)
        ctx["development_goals"] = goals
        if not goals:
            missing.append("development goals")

    if "skills" in needed_keys:
        skills = get_skill_assessments(boxer_id, db)
        ctx["skill_assessments"] = skills
        if not skills:
            missing.append("skill assessments")

    if "recovery" in needed_keys:
        recovery = get_recovery_checkins(boxer_id, db)
        ctx["recovery_checkins"] = recovery
        if not recovery:
            missing.append("recovery check-ins (last 14 days)")

    if "nutrition_profile" in needed_keys:
        np = get_nutrition_profile(boxer_id, db)
        ctx["nutrition_profile"] = np
        if not np:
            missing.append("nutrition profile")

    if "food_diary" in needed_keys:
        diary = get_food_diary(boxer_id, db)
        ctx["food_diary"] = diary
        if not diary:
            missing.append("food diary (last 7 days)")

    if "hydration" in needed_keys:
        hydration = get_hydration_log(boxer_id, db)
        ctx["hydration_log"] = hydration
        if not hydration:
            missing.append("hydration log (last 7 days)")

    if "weight" in needed_keys:
        weight = get_weight_history(boxer_id, db)
        ctx["weight_history"] = weight
        if not weight:
            missing.append("weight records (last 60 days)")

    if "supplements" in needed_keys:
        supplements = db.query(SupplementLog).filter(SupplementLog.boxer_id == boxer_id).limit(10).all()
        ctx["supplements"] = [
            {"product": s.product_name, "dosage": s.dosage, "timing": s.timing, "notes": s.notes}
            for s in supplements
        ]

    if "observations" in needed_keys:
        obs = get_recent_video_observations(boxer_id, db)
        ctx["coach_observations"] = obs
        if not obs:
            missing.append("video observations / coach notes")

    if "metrics" in needed_keys:
        metrics = get_recent_metrics(boxer_id, db)
        ctx["performance_metrics"] = metrics
        if not metrics:
            missing.append("performance metrics")

    if "competition" in needed_keys:
        comp = get_competition_plans(boxer_id, db)
        ctx["competition_plans"] = comp
        if not comp:
            missing.append("competition plans")

    if "fight_camps" in needed_keys:
        camps = get_fight_camps(boxer_id, db)
        ctx["fight_camps"] = camps
        if not camps:
            missing.append("active fight camps")

    # Always add memories and recent conversation tail
    ctx["memories"] = get_companion_memories(boxer_id, companion_slug, db)
    ctx["recent_history"] = get_recent_conversation_history(boxer_id, companion_slug, db)

    ctx["missing_data"] = missing
    return ctx


def context_to_system_text(ctx: dict[str, Any]) -> str:
    """
    Serialise the context dict into a concise text block for the system message.
    """
    lines: list[str] = []

    if ctx.get("boxer_profile"):
        p = ctx["boxer_profile"]
        lines.append(f"## Athlete Profile")
        lines.append(f"Name: {p.get('name', 'Unknown')}")
        lines.append(f"DOB: {p.get('date_of_birth', 'Not provided')}")
        lines.append(f"Weight class: {p.get('weight_class', 'Not provided')}")
        lines.append(f"Stance: {p.get('stance', 'Unknown')}")
        lines.append(f"Experience: {p.get('experience_level', 'Unknown')}")
        lines.append(f"Coach: {p.get('primary_coach', 'Not assigned')}")
        if p.get("training_goals"):
            lines.append(f"Training goals: {p['training_goals']}")

    if ctx.get("recent_sessions"):
        lines.append(f"\n## Recent Training Sessions ({len(ctx['recent_sessions'])} sessions)")
        for s in ctx["recent_sessions"][:5]:
            lines.append(f"- {s['date']}: {s['type']}, {s.get('rounds', '?')} rounds")
            if s.get("objectives"):
                lines.append(f"  Objectives: {s['objectives']}")

    if ctx.get("journal_entries"):
        lines.append(f"\n## Training Journal (last {len(ctx['journal_entries'])} entries)")
        for j in ctx["journal_entries"][:3]:
            lines.append(f"- {j['date']}: {j.get('focus', 'General training')}")
            if j.get("what_went_well"):
                lines.append(f"  Went well: {j['what_went_well']}")
            if j.get("needs_improvement"):
                lines.append(f"  Needs work: {j['needs_improvement']}")

    if ctx.get("development_goals"):
        lines.append(f"\n## Active Development Goals")
        for g in ctx["development_goals"]:
            lines.append(f"- {g['title']} ({g['completion_percent']}% complete, target: {g.get('target_date', 'open')})")

    if ctx.get("skill_assessments"):
        lines.append(f"\n## Skill Assessments (coach-rated)")
        for s in ctx["skill_assessments"][:8]:
            level = s.get("current_level") or "not assessed"
            lines.append(f"- {s['skill']}: {level}")
            if s.get("coach_notes"):
                lines.append(f"  Coach: {s['coach_notes']}")

    if ctx.get("recovery_checkins"):
        lines.append(f"\n## Recent Recovery Check-ins ({len(ctx['recovery_checkins'])} records)")
        for r in ctx["recovery_checkins"][:5]:
            parts = [r["date"]]
            if r.get("energy_level") is not None:
                parts.append(f"energy {r['energy_level']}/10")
            if r.get("sleep_hours") is not None:
                parts.append(f"sleep {r['sleep_hours']}h")
            if r.get("recovery_score") is not None:
                parts.append(f"recovery {r['recovery_score']}/10")
            lines.append(f"- {', '.join(parts)}")
            if r.get("soreness_notes"):
                lines.append(f"  Soreness: {r['soreness_notes']}")

    if ctx.get("nutrition_profile"):
        np = ctx["nutrition_profile"]
        lines.append(f"\n## Nutrition Profile")
        if np.get("vegetarian"):
            lines.append("Diet: Vegetarian")
        if np.get("dietary_preferences"):
            lines.append(f"Preferences: {np['dietary_preferences']}")
        if np.get("food_allergies"):
            lines.append(f"Allergies: {np['food_allergies']}")
        if np.get("target_calories"):
            lines.append(f"Target calories: {np['target_calories']} kcal")
        if np.get("target_protein_g"):
            lines.append(f"Target protein: {np['target_protein_g']}g")
        if np.get("nutrition_goals"):
            lines.append(f"Nutrition goals: {np['nutrition_goals']}")

    if ctx.get("food_diary"):
        lines.append(f"\n## Food Diary (last 7 days, {len(ctx['food_diary'])} entries)")
        # Summarise by day
        by_day: dict[str, dict] = {}
        for e in ctx["food_diary"]:
            d = e["date"]
            if d not in by_day:
                by_day[d] = {"cals": 0, "protein": 0, "count": 0}
            by_day[d]["cals"] += e.get("calories", 0)
            by_day[d]["protein"] += e.get("protein_g", 0)
            by_day[d]["count"] += 1
        for day, vals in sorted(by_day.items(), reverse=True)[:5]:
            lines.append(f"- {day}: {vals['count']} entries, ~{vals['cals']:.0f} kcal, ~{vals['protein']:.0f}g protein")

    if ctx.get("hydration_log"):
        lines.append(f"\n## Hydration (last 7 days, {len(ctx['hydration_log'])} entries)")
        by_day_h: dict[str, int] = {}
        for h in ctx["hydration_log"]:
            by_day_h[h["date"]] = by_day_h.get(h["date"], 0) + h.get("amount_ml", 0)
        for day, ml in sorted(by_day_h.items(), reverse=True)[:5]:
            lines.append(f"- {day}: {ml} ml total")

    if ctx.get("weight_history"):
        lines.append(f"\n## Weight History (last 60 days)")
        for w in ctx["weight_history"][:5]:
            lines.append(f"- {w['date']}: {w['weight_kg']} kg{'  (official)' if w['is_official'] else ''}")

    if ctx.get("competition_plans"):
        lines.append(f"\n## Upcoming Competitions")
        for c in ctx["competition_plans"]:
            lines.append(f"- {c['name']} on {c['date']} ({c.get('weight_category', '?')})")

    if ctx.get("fight_camps"):
        lines.append(f"\n## Active / Planned Fight Camps")
        for c in ctx["fight_camps"]:
            lines.append(f"- {c['name']} → fight date {c['target_fight_date']} (status: {c['status']})")
            if c.get("objectives"):
                lines.append(f"  Objectives: {c['objectives']}")

    if ctx.get("coach_observations"):
        lines.append(f"\n## Recent Coach Observations / Video Notes")
        for o in ctx["coach_observations"][:6]:
            lines.append(f"- [{o['category']}] {o['description']}")
            if o.get("coach_notes"):
                lines.append(f"  Coach: {o['coach_notes']}")
            if o.get("recommended_drill"):
                lines.append(f"  Drill: {o['recommended_drill']}")

    if ctx.get("performance_metrics"):
        lines.append(f"\n## Performance Metrics")
        for m in ctx["performance_metrics"][:6]:
            recent = m["values"][0] if m["values"] else {}
            lines.append(f"- {m['metric']}: {recent.get('value', '?')} {recent.get('unit', '')} (latest: {recent.get('date', '?')})")

    if ctx.get("memories"):
        lines.append(f"\n## Remembered Information")
        for mem in ctx["memories"]:
            lines.append(f"- {mem['key']}: {mem['value']}")

    if ctx.get("missing_data"):
        lines.append(f"\n## Missing Data (not available to reference)")
        for m in ctx["missing_data"]:
            lines.append(f"- {m}")

    return "\n".join(lines)
