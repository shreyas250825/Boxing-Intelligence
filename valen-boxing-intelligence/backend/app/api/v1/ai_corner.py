"""
AI Corner API — all companion chat, memory, goals, challenges,
daily briefings, weekly reviews, collaboration, learning centre,
simulator, combination studio, and Ask My Data endpoints.
"""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.ai_corner import (
    AIActionProposal,
    AIAgentFinding,
    AIChallenge,
    AICollaborationSession,
    AICompanion,
    AIConversation,
    AIDailyBriefing,
    AIGoal,
    AIMemory,
    AIMessage,
    AIWeeklyReview,
    LearningLesson,
    LearningProgress,
    SavedCombination,
    SimulatorSession,
    VoiceTranscript,
)
from app.models.boxer import Boxer
from app.models.development import (
    DevelopmentGoal,
    RecoveryCheckin,
    TrainingJournalEntry,
)
from app.models.nutrition import FoodEntry, HydrationEntry
from app.models.training_session import TrainingSession
from app.services.ai_companions import (
    COMPANION_DEFINITIONS,
    get_companion_definition,
    get_companion_system_prompt,
)
from app.services.ai_context import (
    build_context_for_companion,
    context_to_system_text,
    get_food_diary,
    get_recovery_checkins,
    get_recent_sessions,
    get_recent_metrics,
    get_weight_history,
    get_nutrition_profile,
    get_hydration_log,
    get_development_goals,
    get_skill_assessments,
    get_competition_plans,
    get_fight_camps,
    get_recent_video_observations,
    get_journal_entries,
)
from app.services.ai_service import chat_complete, chat_stream, chat_structured
from app.services.auth_service import get_bearer_token, get_user_from_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["ai-corner"])

# ---------------------------------------------------------------------------
# AI Health check
# ---------------------------------------------------------------------------

@router.get("/health")
def ai_health():
    """
    Check if Ollama is reachable and the configured model is installed.
    Used by the frontend to show/hide AI status indicators.
    """
    from app.services.ai_service import check_ollama_health
    return check_ollama_health()

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def _get_current_user(request_obj, db: Session):
    token = get_bearer_token(request_obj)
    return get_user_from_token(db, token)


def _require_boxer_access(boxer_id: str, db: Session):
    """Verify boxer exists and return it."""
    boxer = db.query(Boxer).filter(Boxer.id == boxer_id, Boxer.status == "active").first()
    if not boxer:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Boxer not found."}})
    return boxer


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    boxer_id: str
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_id: str | None = None
    stream: bool = False


class ChatResponse(BaseModel):
    conversation_id: str
    message_id: str
    content: str
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


class FeedbackRequest(BaseModel):
    feedback: str = Field(..., pattern="^(thumbs_up|thumbs_down)$")


class MemoryCreateRequest(BaseModel):
    boxer_id: str
    companion_slug: str
    memory_key: str = Field(..., min_length=1, max_length=100)
    memory_value: str = Field(..., min_length=1, max_length=2000)
    origin: str = "user_explicit"


class GoalCreateRequest(BaseModel):
    boxer_id: str
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    category: str = "general"
    target_date: str | None = None
    milestones: list[dict] | None = None


class GoalUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    completion_percent: int | None = None
    milestones: list[dict] | None = None


class ChallengeCreateRequest(BaseModel):
    boxer_id: str
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    challenge_type: str = "daily"
    category: str = "training"
    start_date: str
    end_date: str


class LearningProgressUpdate(BaseModel):
    status: str = Field(..., pattern="^(in_progress|completed)$")
    quiz_score: int | None = None


class CombinationCreateRequest(BaseModel):
    boxer_id: str
    title: str = Field(..., min_length=1, max_length=150)
    description: str | None = None
    punches: list[str] = Field(..., min_length=1)
    difficulty: str = "beginner"
    category: str = "offensive"
    coach_notes: str | None = None


class ActionProposalApprove(BaseModel):
    approved: bool


class CollaborationRequest(BaseModel):
    boxer_id: str
    question: str = Field(..., min_length=5, max_length=2000)
    companion_slugs: list[str] | None = None


class VoiceTranscriptSave(BaseModel):
    boxer_id: str
    companion_slug: str
    conversation_id: str | None = None
    transcript: str
    language: str = "en"


class AskMyDataRequest(BaseModel):
    boxer_id: str
    question: str = Field(..., min_length=5, max_length=1000)


# ---------------------------------------------------------------------------
# 1. Companion registry
# ---------------------------------------------------------------------------

@router.get("/companions")
def list_companions(db: Session = Depends(get_db)):
    """Return all active companion definitions (does not require auth)."""
    companions = (
        db.query(AICompanion)
        .filter(AICompanion.is_active == True)  # noqa: E712
        .order_by(AICompanion.display_order)
        .all()
    )
    result = []
    for c in companions:
        defn = get_companion_definition(c.slug) or {}
        result.append({
            "slug": c.slug,
            "name": c.name,
            "role": c.role,
            "description": c.description,
            "icon": c.icon,
            "color_accent": c.color_accent,
            "min_role": c.min_role,
            "capabilities": json.loads(c.capabilities_json) if c.capabilities_json else [],
            "quick_actions": defn.get("quick_actions", []),
            "suggested_prompts": defn.get("suggested_prompts", []),
        })
    return {"companions": result}


@router.get("/companions/{slug}")
def get_companion(slug: str, db: Session = Depends(get_db)):
    companion = db.query(AICompanion).filter(AICompanion.slug == slug).first()
    if not companion:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Companion not found."}})
    defn = get_companion_definition(slug) or {}
    return {
        "slug": companion.slug,
        "name": companion.name,
        "role": companion.role,
        "description": companion.description,
        "icon": companion.icon,
        "color_accent": companion.color_accent,
        "capabilities": json.loads(companion.capabilities_json) if companion.capabilities_json else [],
        "quick_actions": defn.get("quick_actions", []),
        "suggested_prompts": defn.get("suggested_prompts", []),
    }


# ---------------------------------------------------------------------------
# 2. Conversations
# ---------------------------------------------------------------------------

@router.get("/boxers/{boxer_id}/conversations")
def list_conversations(
    boxer_id: str,
    companion_slug: str | None = Query(None),
    db: Session = Depends(get_db),
):
    _require_boxer_access(boxer_id, db)
    q = db.query(AIConversation).filter(
        AIConversation.boxer_id == boxer_id,
        AIConversation.is_archived == False,  # noqa: E712
    )
    if companion_slug:
        q = q.filter(AIConversation.companion_slug == companion_slug)
    convs = q.order_by(AIConversation.updated_at.desc()).limit(50).all()
    return {
        "conversations": [
            {
                "id": c.id,
                "companion_slug": c.companion_slug,
                "title": c.title or "New conversation",
                "created_at": c.created_at.isoformat(),
                "updated_at": c.updated_at.isoformat(),
            }
            for c in convs
        ]
    }


@router.get("/conversations/{conversation_id}/messages")
def get_conversation_messages(conversation_id: str, db: Session = Depends(get_db)):
    conv = db.query(AIConversation).filter(AIConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Conversation not found."}})
    messages = (
        db.query(AIMessage)
        .filter(AIMessage.conversation_id == conversation_id)
        .order_by(AIMessage.created_at)
        .all()
    )
    return {
        "conversation": {
            "id": conv.id,
            "companion_slug": conv.companion_slug,
            "title": conv.title or "New conversation",
        },
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "content_type": m.content_type,
                "feedback": m.feedback,
                "is_saved": m.is_saved,
                "created_at": m.created_at.isoformat(),
                "prompt_tokens": m.prompt_tokens,
                "completion_tokens": m.completion_tokens,
            }
            for m in messages
        ],
    }


@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    conv = db.query(AIConversation).filter(AIConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Conversation not found."}})
    db.delete(conv)
    db.commit()
    return {"deleted": True}


@router.patch("/conversations/{conversation_id}")
def update_conversation(
    conversation_id: str,
    body: dict,
    db: Session = Depends(get_db),
):
    conv = db.query(AIConversation).filter(AIConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Conversation not found."}})
    if "title" in body:
        conv.title = str(body["title"])[:200]
    if "is_archived" in body:
        conv.is_archived = bool(body["is_archived"])
    db.commit()
    return {"id": conv.id, "title": conv.title}


@router.patch("/messages/{message_id}/feedback")
def update_message_feedback(
    message_id: str,
    body: FeedbackRequest,
    db: Session = Depends(get_db),
):
    msg = db.query(AIMessage).filter(AIMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Message not found."}})
    msg.feedback = body.feedback
    db.commit()
    return {"updated": True}


@router.patch("/messages/{message_id}/save")
def toggle_save_message(message_id: str, db: Session = Depends(get_db)):
    msg = db.query(AIMessage).filter(AIMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Message not found."}})
    msg.is_saved = not msg.is_saved
    db.commit()
    return {"is_saved": msg.is_saved}


# ---------------------------------------------------------------------------
# 3. Core chat endpoint
# ---------------------------------------------------------------------------

@router.post("/chat/{companion_slug}")
def chat_with_companion(
    companion_slug: str,
    body: ChatRequest,
    db: Session = Depends(get_db),
):
    """
    Send a message to a companion.
    Creates or continues a conversation, retrieves relevant athlete context,
    builds a specialised system prompt, calls the LLM, and persists everything.
    """
    _require_boxer_access(body.boxer_id, db)

    companion = db.query(AICompanion).filter(
        AICompanion.slug == companion_slug,
        AICompanion.is_active == True,  # noqa: E712
    ).first()
    if not companion:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Companion not found."}})

    # Get or create conversation
    if body.conversation_id:
        conv = db.query(AIConversation).filter(
            AIConversation.id == body.conversation_id,
            AIConversation.boxer_id == body.boxer_id,
        ).first()
        if not conv:
            raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Conversation not found."}})
    else:
        conv = AIConversation(
            boxer_id=body.boxer_id,
            companion_slug=companion_slug,
            title=body.message[:80] + ("…" if len(body.message) > 80 else ""),
        )
        db.add(conv)
        db.flush()

    # Build context
    ctx = build_context_for_companion(body.boxer_id, companion_slug, db)
    context_text = context_to_system_text(ctx)
    today = date.today().isoformat()
    system_prompt = get_companion_system_prompt(companion_slug, context_text, today)

    # Load conversation history (last 12 exchanges)
    history = (
        db.query(AIMessage)
        .filter(
            AIMessage.conversation_id == conv.id,
            AIMessage.role.in_(["user", "assistant"]),
        )
        .order_by(AIMessage.created_at.desc())
        .limit(12)
        .all()
    )
    history_messages = [{"role": m.role, "content": m.content} for m in reversed(history)]

    messages = (
        [{"role": "system", "content": system_prompt}]
        + history_messages
        + [{"role": "user", "content": body.message}]
    )

    # Persist the user message
    user_msg = AIMessage(
        conversation_id=conv.id,
        role="user",
        content=body.message,
        content_type="text",
    )
    db.add(user_msg)
    db.flush()

    # Call AI
    if body.stream:
        # Streaming path — persist after streaming completes
        def _stream_and_persist():
            full_response = ""
            try:
                for chunk in chat_stream(messages):
                    full_response += chunk
                    yield f"data: {json.dumps({'delta': chunk})}\n\n"
            finally:
                # Persist assistant message
                _persist_assistant_message(
                    db=db,
                    conv=conv,
                    content=full_response,
                    prompt_tokens=None,
                    completion_tokens=None,
                )
            yield "data: [DONE]\n\n"

        return StreamingResponse(_stream_and_persist(), media_type="text/event-stream")

    # Non-streaming path
    result = chat_complete(messages)
    ai_content = result["content"]

    asst_msg = AIMessage(
        conversation_id=conv.id,
        role="assistant",
        content=ai_content,
        content_type="text",
        prompt_tokens=result["prompt_tokens"],
        completion_tokens=result["completion_tokens"],
    )
    db.add(asst_msg)
    conv.updated_at = datetime.utcnow()
    db.commit()

    return ChatResponse(
        conversation_id=conv.id,
        message_id=asst_msg.id,
        content=ai_content,
        prompt_tokens=result["prompt_tokens"],
        completion_tokens=result["completion_tokens"],
    )


def _persist_assistant_message(db, conv, content, prompt_tokens, completion_tokens):
    msg = AIMessage(
        conversation_id=conv.id,
        role="assistant",
        content=content,
        content_type="text",
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
    )
    db.add(msg)
    conv.updated_at = datetime.utcnow()
    try:
        db.commit()
    except Exception:
        db.rollback()


# ---------------------------------------------------------------------------
# 4. AI Memory
# ---------------------------------------------------------------------------

@router.get("/boxers/{boxer_id}/memory")
def list_memories(
    boxer_id: str,
    companion_slug: str | None = Query(None),
    db: Session = Depends(get_db),
):
    _require_boxer_access(boxer_id, db)
    q = db.query(AIMemory).filter(
        AIMemory.boxer_id == boxer_id,
        AIMemory.is_active == True,  # noqa: E712
    )
    if companion_slug:
        q = q.filter(AIMemory.companion_slug == companion_slug)
    memories = q.order_by(AIMemory.updated_at.desc()).all()
    return {
        "memories": [
            {
                "id": m.id,
                "companion_slug": m.companion_slug,
                "memory_key": m.memory_key,
                "memory_value": m.memory_value,
                "origin": m.origin,
                "updated_at": m.updated_at.isoformat(),
            }
            for m in memories
        ]
    }


@router.post("/memory")
def create_memory(body: MemoryCreateRequest, db: Session = Depends(get_db)):
    _require_boxer_access(body.boxer_id, db)
    # Check for existing key for this companion
    existing = db.query(AIMemory).filter(
        AIMemory.boxer_id == body.boxer_id,
        AIMemory.companion_slug == body.companion_slug,
        AIMemory.memory_key == body.memory_key,
    ).first()
    if existing:
        existing.memory_value = body.memory_value
        existing.origin = body.origin
        existing.is_active = True
        db.commit()
        return {"id": existing.id, "updated": True}

    memory = AIMemory(
        boxer_id=body.boxer_id,
        companion_slug=body.companion_slug,
        memory_key=body.memory_key,
        memory_value=body.memory_value,
        origin=body.origin,
    )
    db.add(memory)
    db.commit()
    return {"id": memory.id, "created": True}


@router.delete("/memory/{memory_id}")
def delete_memory(memory_id: str, db: Session = Depends(get_db)):
    mem = db.query(AIMemory).filter(AIMemory.id == memory_id).first()
    if not mem:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Memory not found."}})
    mem.is_active = False
    db.commit()
    return {"deleted": True}


@router.patch("/memory/{memory_id}")
def update_memory(memory_id: str, body: dict, db: Session = Depends(get_db)):
    mem = db.query(AIMemory).filter(AIMemory.id == memory_id).first()
    if not mem:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Memory not found."}})
    if "memory_value" in body:
        mem.memory_value = str(body["memory_value"])[:2000]
    db.commit()
    return {"id": mem.id, "updated": True}


# ---------------------------------------------------------------------------
# 5. AI Goals
# ---------------------------------------------------------------------------

@router.get("/boxers/{boxer_id}/ai-goals")
def list_ai_goals(boxer_id: str, db: Session = Depends(get_db)):
    _require_boxer_access(boxer_id, db)
    goals = (
        db.query(AIGoal)
        .filter(AIGoal.boxer_id == boxer_id)
        .order_by(AIGoal.created_at.desc())
        .all()
    )
    return {
        "goals": [
            {
                "id": g.id,
                "title": g.title,
                "description": g.description,
                "category": g.category,
                "status": g.status,
                "completion_percent": g.completion_percent,
                "target_date": g.target_date,
                "milestones": json.loads(g.milestones_json) if g.milestones_json else [],
                "created_at": g.created_at.isoformat(),
            }
            for g in goals
        ]
    }


@router.post("/goals")
def create_ai_goal(body: GoalCreateRequest, db: Session = Depends(get_db)):
    _require_boxer_access(body.boxer_id, db)

    # Use AI to break goal into milestones if none provided
    milestones = body.milestones
    if not milestones:
        try:
            result = chat_structured(
                messages=[{
                    "role": "user",
                    "content": (
                        f"A boxer wants to achieve this goal: '{body.title}'. "
                        f"Description: {body.description or 'none'}. "
                        f"Target date: {body.target_date or 'open-ended'}. "
                        "Break this into 3-5 concrete, actionable milestones as a JSON array: "
                        '[{"title": "...", "target_date": "YYYY-MM-DD or null", "completed": false}]'
                    ),
                }],
                schema_description='[{"title": str, "target_date": str|null, "completed": false}]',
            )
            milestones = result.get("data", [])
        except Exception:
            milestones = []

    goal = AIGoal(
        boxer_id=body.boxer_id,
        title=body.title,
        description=body.description,
        category=body.category,
        target_date=body.target_date,
        milestones_json=json.dumps(milestones),
        status="active",
        completion_percent=0,
    )
    db.add(goal)
    db.commit()
    return {
        "id": goal.id,
        "title": goal.title,
        "milestones": milestones,
    }


@router.patch("/goals/{goal_id}")
def update_ai_goal(goal_id: str, body: GoalUpdateRequest, db: Session = Depends(get_db)):
    goal = db.query(AIGoal).filter(AIGoal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Goal not found."}})
    if body.title is not None:
        goal.title = body.title
    if body.description is not None:
        goal.description = body.description
    if body.status is not None:
        goal.status = body.status
    if body.completion_percent is not None:
        goal.completion_percent = max(0, min(100, body.completion_percent))
    if body.milestones is not None:
        goal.milestones_json = json.dumps(body.milestones)
    db.commit()
    return {"id": goal.id, "updated": True}


@router.delete("/goals/{goal_id}")
def delete_ai_goal(goal_id: str, db: Session = Depends(get_db)):
    goal = db.query(AIGoal).filter(AIGoal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Goal not found."}})
    db.delete(goal)
    db.commit()
    return {"deleted": True}


# ---------------------------------------------------------------------------
# 6. Daily Briefing
# ---------------------------------------------------------------------------

@router.get("/boxers/{boxer_id}/daily-briefing")
def get_daily_briefing(
    boxer_id: str,
    briefing_date: str | None = Query(None),
    db: Session = Depends(get_db),
):
    _require_boxer_access(boxer_id, db)
    today = briefing_date or date.today().isoformat()

    # Check for cached briefing from today
    cached = db.query(AIDailyBriefing).filter(
        AIDailyBriefing.boxer_id == boxer_id,
        AIDailyBriefing.briefing_date == today,
    ).first()
    if cached:
        return {
            "date": today,
            "briefing": json.loads(cached.briefing_json),
            "missing_data": json.loads(cached.missing_data_json) if cached.missing_data_json else [],
            "generated_at": cached.generated_at.isoformat(),
            "from_cache": True,
        }

    # Build briefing from actual records
    ctx = build_context_for_companion(boxer_id, "coach-valen", db, extra_keys=["nutrition_profile", "food_diary", "hydration", "recovery"])
    context_text = context_to_system_text(ctx)
    missing = ctx.get("missing_data", [])

    system = (
        "You are the Valen AI Corner briefing system. "
        "Generate a structured daily briefing using ONLY the athlete data provided. "
        "Do not invent missing data. "
        "If data is absent, clearly note it under 'missing_data'. "
        "Respond with valid JSON only."
    )
    user_prompt = (
        f"Today is {today}. "
        f"Generate a JSON daily briefing for the boxer with this structure:\n"
        '{"greeting": str, "training_today": str, '
        '"recovery_note": str|null, "nutrition_reminder": str|null, '
        '"hydration_status": str|null, "upcoming_competitions": [str], '
        '"recommended_activity": str, "development_challenge": str, '
        '"reminders": [str], "ai_insight": str}\n\n'
        f"Available data:\n{context_text}"
    )

    try:
        result = chat_structured(
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user_prompt}],
            schema_description='{"greeting":str,"training_today":str,"recovery_note":str|null,"nutrition_reminder":str|null,"hydration_status":str|null,"upcoming_competitions":[str],"recommended_activity":str,"development_challenge":str,"reminders":[str],"ai_insight":str}',
        )
        briefing_data = result["data"]
    except Exception as exc:
        logger.error("Daily briefing AI error: %s", exc)
        briefing_data = {
            "greeting": f"Good morning! Ready to train today?",
            "training_today": "No scheduled session data available.",
            "recovery_note": None,
            "nutrition_reminder": None,
            "hydration_status": None,
            "upcoming_competitions": [],
            "recommended_activity": "Review your training goals",
            "development_challenge": "Reflect on one technique you want to improve today",
            "reminders": [],
            "ai_insight": "Log your training, food and recovery to unlock personalised insights.",
        }

    # Cache it
    briefing_obj = AIDailyBriefing(
        boxer_id=boxer_id,
        briefing_date=today,
        briefing_json=json.dumps(briefing_data),
        missing_data_json=json.dumps(missing),
    )
    db.add(briefing_obj)
    try:
        db.commit()
    except Exception:
        db.rollback()

    return {
        "date": today,
        "briefing": briefing_data,
        "missing_data": missing,
        "generated_at": datetime.utcnow().isoformat(),
        "from_cache": False,
    }


# ---------------------------------------------------------------------------
# 7. Weekly Review
# ---------------------------------------------------------------------------

@router.get("/boxers/{boxer_id}/weekly-review")
def get_weekly_review(
    boxer_id: str,
    week_start: str | None = Query(None),
    db: Session = Depends(get_db),
):
    _require_boxer_access(boxer_id, db)

    if week_start:
        ws_date = date.fromisoformat(week_start)
    else:
        today = date.today()
        ws_date = today - timedelta(days=today.weekday())

    we_date = ws_date + timedelta(days=6)
    ws = ws_date.isoformat()
    we = we_date.isoformat()

    # Check cache
    cached = db.query(AIWeeklyReview).filter(
        AIWeeklyReview.boxer_id == boxer_id,
        AIWeeklyReview.week_start == ws,
    ).first()
    if cached:
        return {
            "week_start": ws,
            "week_end": we,
            "review": json.loads(cached.review_json),
            "missing_data": json.loads(cached.missing_data_json) if cached.missing_data_json else [],
            "generated_at": cached.generated_at.isoformat(),
            "from_cache": True,
        }

    # Pull week-specific data
    sessions = db.query(TrainingSession).filter(
        TrainingSession.boxer_id == boxer_id,
        TrainingSession.session_date >= ws,
        TrainingSession.session_date <= we,
    ).all()

    journal = db.query(TrainingJournalEntry).filter(
        TrainingJournalEntry.boxer_id == boxer_id,
        TrainingJournalEntry.session_date >= ws,
        TrainingJournalEntry.session_date <= we,
    ).all()

    food = db.query(FoodEntry).filter(
        FoodEntry.boxer_id == boxer_id,
        FoodEntry.entry_date >= ws,
        FoodEntry.entry_date <= we,
    ).all()

    hydration = db.query(HydrationEntry).filter(
        HydrationEntry.boxer_id == boxer_id,
        HydrationEntry.entry_date >= ws,
        HydrationEntry.entry_date <= we,
    ).all()

    recovery = db.query(RecoveryCheckin).filter(
        RecoveryCheckin.boxer_id == boxer_id,
        RecoveryCheckin.entry_date >= ws,
        RecoveryCheckin.entry_date <= we,
    ).all()

    missing = []
    if not sessions:
        missing.append("training sessions")
    if not journal:
        missing.append("journal entries")
    if not food:
        missing.append("food diary")
    if not hydration:
        missing.append("hydration log")
    if not recovery:
        missing.append("recovery check-ins")

    data_summary = (
        f"Week: {ws} to {we}\n"
        f"Sessions logged: {len(sessions)} ({', '.join(s.session_type for s in sessions) or 'none'})\n"
        f"Journal entries: {len(journal)}\n"
        f"Food diary entries: {len(food)} (total calories: {sum(e.calories for e in food):.0f} kcal)\n"
        f"Hydration entries: {len(hydration)} (total: {sum(e.amount_ml for e in hydration)} ml)\n"
        f"Recovery check-ins: {len(recovery)}\n"
    )
    if recovery:
        avg_sleep = sum(r.sleep_hours for r in recovery if r.sleep_hours) / max(1, sum(1 for r in recovery if r.sleep_hours))
        avg_energy = sum(r.energy_level for r in recovery if r.energy_level) / max(1, sum(1 for r in recovery if r.energy_level))
        data_summary += f"Average sleep: {avg_sleep:.1f}h\nAverage energy: {avg_energy:.1f}/10\n"
    if missing:
        data_summary += f"Missing data: {', '.join(missing)}\n"

    system = "You generate structured weekly boxing performance reviews using only actual logged data. Respond with valid JSON only."
    user_prompt = (
        f"Generate a weekly review for a boxer. Week: {ws} to {we}.\n"
        "JSON structure: "
        '{"summary":str,"completed_sessions":int,"missed_sessions":str,"training_volume":str,'
        '"nutrition_summary":str,"hydration_summary":str,"recovery_summary":str,'
        '"achievements":[str],"areas_for_attention":[str],"next_week_priorities":[str],'
        '"data_available":[str],"data_missing":[str]}\n\n'
        f"Data:\n{data_summary}"
    )

    try:
        result = chat_structured(
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user_prompt}],
            schema_description='{"summary":str,"completed_sessions":int,...}',
        )
        review_data = result["data"]
    except Exception as exc:
        logger.error("Weekly review AI error: %s", exc)
        review_data = {
            "summary": f"Weekly review for {ws} to {we}.",
            "completed_sessions": len(sessions),
            "missed_sessions": "Unable to determine without schedule",
            "training_volume": f"{len(sessions)} sessions logged",
            "nutrition_summary": f"{len(food)} food diary entries logged",
            "hydration_summary": f"{sum(e.amount_ml for e in hydration)} ml total",
            "recovery_summary": f"{len(recovery)} check-ins logged",
            "achievements": [],
            "areas_for_attention": [],
            "next_week_priorities": [],
            "data_available": [k for k in ["sessions", "journal", "food", "hydration", "recovery"] if k not in missing],
            "data_missing": missing,
        }

    review_obj = AIWeeklyReview(
        boxer_id=boxer_id,
        week_start=ws,
        week_end=we,
        review_json=json.dumps(review_data),
        missing_data_json=json.dumps(missing),
    )
    db.add(review_obj)
    try:
        db.commit()
    except Exception:
        db.rollback()

    return {
        "week_start": ws,
        "week_end": we,
        "review": review_data,
        "missing_data": missing,
        "generated_at": datetime.utcnow().isoformat(),
        "from_cache": False,
    }


# ---------------------------------------------------------------------------
# 8. AI Challenges
# ---------------------------------------------------------------------------

@router.get("/boxers/{boxer_id}/challenges")
def list_challenges(boxer_id: str, db: Session = Depends(get_db)):
    _require_boxer_access(boxer_id, db)
    challenges = (
        db.query(AIChallenge)
        .filter(AIChallenge.boxer_id == boxer_id)
        .order_by(AIChallenge.created_at.desc())
        .limit(30)
        .all()
    )
    return {
        "challenges": [
            {
                "id": c.id,
                "title": c.title,
                "description": c.description,
                "challenge_type": c.challenge_type,
                "category": c.category,
                "start_date": c.start_date,
                "end_date": c.end_date,
                "status": c.status,
                "completed_at": c.completed_at.isoformat() if c.completed_at else None,
            }
            for c in challenges
        ]
    }


@router.post("/challenges")
def create_challenge(body: ChallengeCreateRequest, db: Session = Depends(get_db)):
    _require_boxer_access(body.boxer_id, db)
    challenge = AIChallenge(
        boxer_id=body.boxer_id,
        title=body.title,
        description=body.description,
        challenge_type=body.challenge_type,
        category=body.category,
        start_date=body.start_date,
        end_date=body.end_date,
        status="pending",
    )
    db.add(challenge)
    db.commit()
    return {"id": challenge.id, "created": True}


@router.post("/boxers/{boxer_id}/generate-challenges")
def generate_challenges(boxer_id: str, db: Session = Depends(get_db)):
    """Use AI to generate personalised challenges from actual records."""
    _require_boxer_access(boxer_id, db)

    ctx = build_context_for_companion(boxer_id, "coach-valen", db)
    context_text = context_to_system_text(ctx)
    today = date.today().isoformat()
    week_end = (date.today() + timedelta(days=7)).isoformat()

    user_prompt = (
        f"Today is {today}. Generate 3 personalised boxing challenges for this athlete based ONLY on "
        "their available records. Each challenge should be achievable within one week. "
        "Format: JSON array of objects with keys: title, description, category (training|nutrition|recovery|learning|mindset), "
        f"challenge_type (daily|weekly), start_date ({today}), end_date ({week_end}).\n\n"
        f"Athlete context:\n{context_text}"
    )

    result = chat_structured(
        messages=[{"role": "user", "content": user_prompt}],
        schema_description='[{"title":str,"description":str,"category":str,"challenge_type":str,"start_date":str,"end_date":str}]',
    )

    created = []
    for c in result.get("data", [])[:5]:
        challenge = AIChallenge(
            boxer_id=boxer_id,
            title=str(c.get("title", "Challenge"))[:200],
            description=c.get("description"),
            challenge_type=c.get("challenge_type", "weekly"),
            category=c.get("category", "training"),
            start_date=c.get("start_date", today),
            end_date=c.get("end_date", week_end),
            status="pending",
        )
        db.add(challenge)
        db.flush()
        created.append({"id": challenge.id, "title": challenge.title})

    db.commit()
    return {"generated": len(created), "challenges": created}


@router.patch("/challenges/{challenge_id}")
def update_challenge_status(challenge_id: str, body: dict, db: Session = Depends(get_db)):
    challenge = db.query(AIChallenge).filter(AIChallenge.id == challenge_id).first()
    if not challenge:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Challenge not found."}})
    if "status" in body:
        challenge.status = body["status"]
        if body["status"] == "completed":
            challenge.completed_at = datetime.utcnow()
    db.commit()
    return {"updated": True}


# ---------------------------------------------------------------------------
# 9. Learning Centre
# ---------------------------------------------------------------------------

@router.get("/lessons")
def list_lessons(
    category: str | None = Query(None),
    difficulty: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(LearningLesson).filter(LearningLesson.is_published == True)  # noqa: E712
    if category:
        q = q.filter(LearningLesson.category == category)
    if difficulty:
        q = q.filter(LearningLesson.difficulty == difficulty)
    lessons = q.order_by(LearningLesson.display_order, LearningLesson.title).all()
    return {
        "lessons": [
            {
                "id": l.id,
                "slug": l.slug,
                "title": l.title,
                "category": l.category,
                "difficulty": l.difficulty,
                "estimated_minutes": l.estimated_minutes,
                "has_quiz": bool(l.quiz_json),
            }
            for l in lessons
        ]
    }


@router.get("/lessons/{lesson_id}")
def get_lesson(lesson_id: str, db: Session = Depends(get_db)):
    lesson = db.query(LearningLesson).filter(
        (LearningLesson.id == lesson_id) | (LearningLesson.slug == lesson_id)
    ).first()
    if not lesson:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Lesson not found."}})
    return {
        "id": lesson.id,
        "slug": lesson.slug,
        "title": lesson.title,
        "category": lesson.category,
        "difficulty": lesson.difficulty,
        "content": lesson.content,
        "quiz": json.loads(lesson.quiz_json) if lesson.quiz_json else None,
        "estimated_minutes": lesson.estimated_minutes,
    }


@router.get("/boxers/{boxer_id}/learning-progress")
def get_learning_progress(boxer_id: str, db: Session = Depends(get_db)):
    _require_boxer_access(boxer_id, db)
    progress = (
        db.query(LearningProgress)
        .filter(LearningProgress.boxer_id == boxer_id)
        .all()
    )
    return {
        "progress": [
            {
                "lesson_id": p.lesson_id,
                "status": p.status,
                "quiz_score": p.quiz_score,
                "completed_at": p.completed_at.isoformat() if p.completed_at else None,
            }
            for p in progress
        ]
    }


@router.post("/boxers/{boxer_id}/lessons/{lesson_id}/progress")
def update_lesson_progress(
    boxer_id: str,
    lesson_id: str,
    body: LearningProgressUpdate,
    db: Session = Depends(get_db),
):
    _require_boxer_access(boxer_id, db)
    lesson = db.query(LearningLesson).filter(LearningLesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Lesson not found."}})

    existing = db.query(LearningProgress).filter(
        LearningProgress.boxer_id == boxer_id,
        LearningProgress.lesson_id == lesson_id,
    ).first()

    if existing:
        existing.status = body.status
        if body.quiz_score is not None:
            existing.quiz_score = body.quiz_score
        if body.status == "completed":
            existing.completed_at = datetime.utcnow()
        db.commit()
        return {"updated": True}

    progress = LearningProgress(
        boxer_id=boxer_id,
        lesson_id=lesson_id,
        status=body.status,
        quiz_score=body.quiz_score,
        completed_at=datetime.utcnow() if body.status == "completed" else None,
    )
    db.add(progress)
    db.commit()
    return {"created": True}


# ---------------------------------------------------------------------------
# 10. Boxing Simulator
# ---------------------------------------------------------------------------

SIMULATOR_SCENARIOS = [
    {
        "slug": "constant-pressure",
        "title": "Opponent Applies Constant Pressure",
        "difficulty": "beginner",
        "description": "Your opponent keeps walking forward and throwing punches. You need to deal with their pressure.",
        "steps": [
            {
                "scenario_text": "Your opponent walks forward throwing jabs and looking to throw the cross. You are being backed toward the ropes. What is your best response?",
                "options": [
                    "Stand your ground and punch back harder",
                    "Use a jab and pivot to the side to reset position",
                    "Clinch every time they get close",
                    "Backpedal until the round ends",
                ],
                "correct_index": 1,
                "feedback": {
                    0: "Standing your ground with a pressure fighter means absorbing damage at close range where they are strongest. Risky.",
                    1: "Correct. A jab to disrupt their rhythm, combined with a pivot, resets your position and denies them the corner trap.",
                    2: "Clinching temporarily disrupts pressure but cannot be your main tool — repeated clinching loses you points.",
                    3: "Constant backpedalling concedes ring control and scores badly for aggression and ring generalship.",
                },
            },
            {
                "scenario_text": "You've managed to pivot away once. But the opponent readjusts and comes forward again. How do you change their rhythm?",
                "options": [
                    "Double jab to the body then head",
                    "Throw a big right hand and hope to hurt them",
                    "Move backward in a straight line",
                    "Wait for them to stop",
                ],
                "correct_index": 0,
                "feedback": {
                    0: "Correct. A body jab changes levels, disrupts their forward momentum, and forces the guard lower — opening the head.",
                    1: "Throwing a big power punch while being pressured is risky — you may walk into a counter if your feet aren't set.",
                    2: "Straight-line backward movement is predictable and puts you against the ropes again quickly.",
                    3: "Waiting passively for them to stop gives them full control of the pace.",
                },
            },
        ],
    },
    {
        "slug": "longer-reach",
        "title": "Opponent Has a Longer Reach",
        "difficulty": "beginner",
        "description": "Your opponent's jab is keeping you at range. You need to get inside effectively.",
        "steps": [
            {
                "scenario_text": "Your opponent is taller with a longer reach. Their jab keeps you at distance. What is your first tactical adjustment?",
                "options": [
                    "Move your head and slip under/around the jab to get inside",
                    "Try to match their jab with your own from long range",
                    "Move backward to create more space",
                    "Wait for them to throw first, then counter",
                ],
                "correct_index": 0,
                "feedback": {
                    0: "Correct. Slipping the jab and moving inside negates reach advantage — the longer arms become a liability at close range.",
                    1: "Trading jabs with a longer-armed fighter means losing the range battle. You need a different approach.",
                    2: "More space means more of their range. This concedes the entire fight to their long jab.",
                    3: "Waiting passively from long range still keeps you in their jab range without changing anything.",
                },
            },
        ],
    },
    {
        "slug": "behind-on-points",
        "title": "You Are Behind on Points",
        "difficulty": "intermediate",
        "description": "It's round 8 of 10. You believe you are behind on the scorecards. What changes do you make?",
        "steps": [
            {
                "scenario_text": "You're in round 8, behind on points, with 2 rounds remaining. What is the right mindset?",
                "options": [
                    "Abandon all defence and go for the knockout",
                    "Stay disciplined, increase volume and aggression while maintaining your guard",
                    "Accept the decision loss and protect yourself",
                    "Slow down and pace yourself for round 10",
                ],
                "correct_index": 1,
                "feedback": {
                    0: "All-out abandon often results in eating big shots. Being aggressive and careless is not the same as effective aggression.",
                    1: "Correct. Increased volume of clean, accurate punching with your guard up is how you win late rounds on the scorecards.",
                    2: "Accepting a loss without trying to turn it around is not the right competitive mindset.",
                    3: "Slowing down when behind on points makes the deficit worse — you need to win these rounds convincingly.",
                },
            },
        ],
    },
]


@router.get("/simulator/scenarios")
def list_simulator_scenarios():
    return {
        "scenarios": [
            {
                "slug": s["slug"],
                "title": s["title"],
                "difficulty": s["difficulty"],
                "description": s["description"],
                "total_steps": len(s["steps"]),
            }
            for s in SIMULATOR_SCENARIOS
        ]
    }


@router.get("/simulator/scenarios/{slug}")
def get_simulator_scenario(slug: str):
    scenario = next((s for s in SIMULATOR_SCENARIOS if s["slug"] == slug), None)
    if not scenario:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Scenario not found."}})
    return {
        "slug": scenario["slug"],
        "title": scenario["title"],
        "difficulty": scenario["difficulty"],
        "description": scenario["description"],
        "steps": [
            {
                "step_index": i,
                "scenario_text": step["scenario_text"],
                "options": step["options"],
            }
            for i, step in enumerate(scenario["steps"])
        ],
    }


class SimulatorAnswerRequest(BaseModel):
    boxer_id: str
    scenario_slug: str
    step_index: int
    chosen_option_index: int


@router.post("/simulator/answer")
def submit_simulator_answer(body: SimulatorAnswerRequest, db: Session = Depends(get_db)):
    _require_boxer_access(body.boxer_id, db)
    scenario = next((s for s in SIMULATOR_SCENARIOS if s["slug"] == body.scenario_slug), None)
    if not scenario:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Scenario not found."}})
    if body.step_index >= len(scenario["steps"]):
        raise HTTPException(status_code=400, detail={"error": {"code": "INVALID", "message": "Step index out of range."}})

    step = scenario["steps"][body.step_index]
    correct = body.chosen_option_index == step["correct_index"]
    feedback = step["feedback"].get(body.chosen_option_index, "No specific feedback for this choice.")
    is_last_step = body.step_index == len(scenario["steps"]) - 1

    return {
        "correct": correct,
        "correct_index": step["correct_index"],
        "feedback": feedback,
        "is_last_step": is_last_step,
        "educational_note": (
            "This is an educational simulation. Tactical decisions in real boxing depend on your "
            "physical conditioning, your coach's guidance, and the specific situation."
        ),
    }


# ---------------------------------------------------------------------------
# 11. Combination Studio
# ---------------------------------------------------------------------------

@router.get("/boxers/{boxer_id}/combinations")
def list_combinations(boxer_id: str, db: Session = Depends(get_db)):
    _require_boxer_access(boxer_id, db)
    combos = (
        db.query(SavedCombination)
        .filter(SavedCombination.boxer_id == boxer_id)
        .order_by(SavedCombination.created_at.desc())
        .all()
    )
    return {
        "combinations": [
            {
                "id": c.id,
                "title": c.title,
                "description": c.description,
                "punches": json.loads(c.punches_json),
                "difficulty": c.difficulty,
                "category": c.category,
                "is_coach_assigned": c.is_coach_assigned,
                "coach_notes": c.coach_notes,
            }
            for c in combos
        ]
    }


@router.post("/combinations")
def create_combination(body: CombinationCreateRequest, db: Session = Depends(get_db)):
    _require_boxer_access(body.boxer_id, db)
    combo = SavedCombination(
        boxer_id=body.boxer_id,
        title=body.title,
        description=body.description,
        punches_json=json.dumps(body.punches),
        difficulty=body.difficulty,
        category=body.category,
        is_coach_assigned=False,
        coach_notes=body.coach_notes,
    )
    db.add(combo)
    db.commit()
    return {"id": combo.id, "created": True}


@router.delete("/combinations/{combo_id}")
def delete_combination(combo_id: str, db: Session = Depends(get_db)):
    combo = db.query(SavedCombination).filter(SavedCombination.id == combo_id).first()
    if not combo:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Combination not found."}})
    db.delete(combo)
    db.commit()
    return {"deleted": True}


@router.post("/boxers/{boxer_id}/generate-combinations")
def generate_combinations(boxer_id: str, db: Session = Depends(get_db)):
    """Use AI to generate combinations tailored to the boxer's style."""
    _require_boxer_access(boxer_id, db)
    ctx = build_context_for_companion(boxer_id, "coach-valen", db)
    context_text = context_to_system_text(ctx)

    user_prompt = (
        "Generate 3 boxing combinations appropriate for this boxer based on their profile. "
        "Use standard punch notation: jab, cross, lead_hook, rear_hook, lead_uppercut, rear_uppercut, body_jab, body_cross. "
        "Format: JSON array: "
        '[{"title":str,"description":str,"punches":[str],"difficulty":"beginner|intermediate|advanced","category":"offensive|defensive|counter"}]\n\n'
        f"Boxer context:\n{context_text}"
    )

    result = chat_structured(
        messages=[{"role": "user", "content": user_prompt}],
        schema_description='[{"title":str,"description":str,"punches":[str],"difficulty":str,"category":str}]',
    )

    created = []
    for c in result.get("data", [])[:5]:
        combo = SavedCombination(
            boxer_id=boxer_id,
            title=str(c.get("title", "Combination"))[:150],
            description=c.get("description"),
            punches_json=json.dumps(c.get("punches", [])),
            difficulty=c.get("difficulty", "beginner"),
            category=c.get("category", "offensive"),
            is_coach_assigned=False,
        )
        db.add(combo)
        db.flush()
        created.append({"id": combo.id, "title": combo.title})

    db.commit()
    return {"generated": len(created), "combinations": created}


# ---------------------------------------------------------------------------
# 12. AI-to-AI Collaboration
# ---------------------------------------------------------------------------

COLLABORATION_COMPANION_MAP = {
    "fight preparation": ["coach-valen", "performancelab", "recoverai", "nutricoach", "corneriq"],
    "weight management": ["nutricoach", "recoverai", "performancelab"],
    "technique": ["coach-valen", "visionbox"],
    "recovery": ["recoverai", "performancelab", "coach-valen"],
    "competition": ["corneriq", "coach-valen", "nutricoach", "mindcorner"],
    "general": ["coach-valen", "nutricoach", "recoverai"],
}


@router.post("/collaborate")
def start_collaboration(body: CollaborationRequest, db: Session = Depends(get_db)):
    """
    Orchestrate multiple companions to answer a complex question.
    Each companion only receives the data relevant to it.
    """
    _require_boxer_access(body.boxer_id, db)

    # Determine which companions to invoke
    slugs = body.companion_slugs
    if not slugs:
        q_lower = body.question.lower()
        if any(w in q_lower for w in ["fight", "competition", "camp"]):
            slugs = COLLABORATION_COMPANION_MAP["fight preparation"]
        elif any(w in q_lower for w in ["weight", "diet", "food", "nutrition"]):
            slugs = COLLABORATION_COMPANION_MAP["weight management"]
        elif any(w in q_lower for w in ["technique", "punch", "combination", "footwork"]):
            slugs = COLLABORATION_COMPANION_MAP["technique"]
        elif any(w in q_lower for w in ["recovery", "sleep", "fatigue", "tired"]):
            slugs = COLLABORATION_COMPANION_MAP["recovery"]
        else:
            slugs = COLLABORATION_COMPANION_MAP["general"]

    session = AICollaborationSession(
        boxer_id=body.boxer_id,
        trigger_question=body.question,
        companions_json=json.dumps(slugs),
        status="running",
    )
    db.add(session)
    db.flush()
    session_id = session.id

    today = date.today().isoformat()
    findings = []

    for slug in slugs[:5]:  # max 5 companions per collaboration
        companion = db.query(AICompanion).filter(AICompanion.slug == slug).first()
        if not companion:
            continue

        ctx = build_context_for_companion(body.boxer_id, slug, db)
        context_text = context_to_system_text(ctx)
        system_prompt = get_companion_system_prompt(slug, context_text, today)

        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"As part of a coordinated AI Corner analysis, answer this specific question from your area of expertise:\n\n"
                    f"'{body.question}'\n\n"
                    "Provide a concise, structured response (max 300 words). "
                    "Focus only on your specialisation. Note any relevant missing data. "
                    "Do not repeat information from other companions."
                ),
            },
        ]

        try:
            result = chat_complete(messages, max_tokens=500)
            finding_text = result["content"]
            missing_data = "; ".join(ctx.get("missing_data", []))
            status = "completed"
        except Exception as exc:
            finding_text = f"[{companion.name} could not provide analysis: {exc}]"
            missing_data = None
            status = "failed"

        finding = AIAgentFinding(
            session_id=session_id,
            companion_slug=slug,
            finding=finding_text,
            missing_data=missing_data or None,
            status=status,
        )
        db.add(finding)
        db.flush()
        findings.append({
            "companion_slug": slug,
            "companion_name": companion.name,
            "finding": finding_text,
            "missing_data": missing_data,
            "status": status,
        })

    # Consolidate findings
    if findings:
        consolidation_prompt = (
            f"You are the Valen AI Corner Intelligence Coordinator.\n"
            f"Multiple specialist AI companions have analysed this question: '{body.question}'\n\n"
            "Their individual findings:\n\n"
            + "\n\n".join(
                f"**{f['companion_name']}**:\n{f['finding']}"
                for f in findings
                if f["status"] == "completed"
            )
            + "\n\nCreate a consolidated response that:\n"
            "1. Synthesises the key recommendations\n"
            "2. Highlights any contradictions between recommendations\n"
            "3. Lists items requiring professional (coach/nutritionist) approval\n"
            "4. Notes any data gaps that limited the analysis\n"
            "5. Provides 3-5 clear action priorities"
        )
        try:
            consolidation = chat_complete(
                [{"role": "user", "content": consolidation_prompt}],
                max_tokens=800,
            )
            consolidated = consolidation["content"]
        except Exception:
            consolidated = "Consolidated report could not be generated. See individual findings above."
    else:
        consolidated = "No companion findings were available for this question."

    session.consolidated_report = consolidated
    session.status = "completed"
    session.completed_at = datetime.utcnow()
    db.commit()

    return {
        "session_id": session_id,
        "question": body.question,
        "companions_involved": [f["companion_name"] for f in findings],
        "findings": findings,
        "consolidated_report": consolidated,
    }


@router.get("/collaboration/{session_id}")
def get_collaboration_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(AICollaborationSession).filter(AICollaborationSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Session not found."}})
    findings = db.query(AIAgentFinding).filter(AIAgentFinding.session_id == session_id).all()
    return {
        "session_id": session.id,
        "question": session.trigger_question,
        "status": session.status,
        "companions_json": json.loads(session.companions_json) if session.companions_json else [],
        "consolidated_report": session.consolidated_report,
        "findings": [
            {
                "companion_slug": f.companion_slug,
                "finding": f.finding,
                "missing_data": f.missing_data,
                "status": f.status,
            }
            for f in findings
        ],
        "created_at": session.created_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# 13. Ask My Data
# ---------------------------------------------------------------------------

@router.post("/ask-my-data")
def ask_my_data(body: AskMyDataRequest, db: Session = Depends(get_db)):
    """
    Natural-language analytics over the boxer's actual database records.
    Only answers questions that can be grounded in real data.
    """
    _require_boxer_access(body.boxer_id, db)

    # Gather comprehensive data context
    today = date.today().isoformat()
    sessions = get_recent_sessions(body.boxer_id, db, days=90)
    food = get_food_diary(body.boxer_id, db, days=28)
    hydration = get_hydration_log(body.boxer_id, db, days=28)
    recovery = get_recovery_checkins(body.boxer_id, db, days=28)
    weight = get_weight_history(body.boxer_id, db, days=90)
    metrics = get_recent_metrics(body.boxer_id, db, days=90)
    goals = get_development_goals(body.boxer_id, db)
    observations = get_recent_video_observations(body.boxer_id, db, days=90)

    data_summary = (
        f"AVAILABLE DATA (query date: {today}):\n"
        f"Training sessions (last 90 days): {len(sessions)}\n"
        f"Food diary entries (last 28 days): {len(food)}\n"
        f"Hydration entries (last 28 days): {len(hydration)}\n"
        f"Recovery check-ins (last 28 days): {len(recovery)}\n"
        f"Weight records (last 90 days): {len(weight)}\n"
        f"Performance metric groups: {len(metrics)}\n"
        f"Active goals: {len(goals)}\n"
        f"Video observations: {len(observations)}\n\n"
    )

    # Add actual data where available
    if sessions:
        data_summary += "Sessions:\n" + "\n".join(
            f"  {s['date']}: {s['type']}, {s.get('rounds', '?')} rounds" for s in sessions[:20]
        ) + "\n"
    if recovery:
        data_summary += "Recovery check-ins:\n" + "\n".join(
            f"  {r['date']}: energy {r.get('energy_level')}, sleep {r.get('sleep_hours')}h, readiness {r.get('readiness_rating')}"
            for r in recovery[:14]
        ) + "\n"
    if weight:
        data_summary += "Weight records:\n" + "\n".join(
            f"  {w['date']}: {w['weight_kg']} kg" for w in weight[:10]
        ) + "\n"
    if food:
        # Summarise by day
        by_day: dict[str, float] = {}
        for e in food:
            by_day[e["date"]] = by_day.get(e["date"], 0) + e.get("calories", 0)
        data_summary += "Caloric intake by day:\n" + "\n".join(
            f"  {d}: {c:.0f} kcal" for d, c in sorted(by_day.items(), reverse=True)[:10]
        ) + "\n"
    if metrics:
        data_summary += "Performance metrics:\n" + "\n".join(
            f"  {m['metric']}: latest {m['values'][0].get('value')} {m['values'][0].get('unit')} on {m['values'][0].get('date')}"
            for m in metrics[:8] if m.get("values")
        ) + "\n"

    system = (
        "You are the Valen Ask My Data analytics assistant. "
        "Answer the boxer's question using ONLY the actual data provided. "
        "Include: relevant dates, actual values, comparison periods, missing data notices, and data sources. "
        "Do not invent statistics. If the data is insufficient, say so clearly."
    )

    result = chat_complete(
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": f"Question: {body.question}\n\n{data_summary}"},
        ],
        max_tokens=800,
    )

    return {
        "question": body.question,
        "answer": result["content"],
        "data_sources": {
            "sessions": len(sessions),
            "food_entries": len(food),
            "recovery_checkins": len(recovery),
            "weight_records": len(weight),
            "metrics": len(metrics),
            "observations": len(observations),
        },
        "query_date": today,
    }


# ---------------------------------------------------------------------------
# 14. Voice Transcripts
# ---------------------------------------------------------------------------

@router.post("/voice-transcripts")
def save_voice_transcript(body: VoiceTranscriptSave, db: Session = Depends(get_db)):
    _require_boxer_access(body.boxer_id, db)
    transcript = VoiceTranscript(
        boxer_id=body.boxer_id,
        companion_slug=body.companion_slug,
        conversation_id=body.conversation_id,
        transcript=body.transcript,
        language=body.language,
    )
    db.add(transcript)
    db.commit()
    return {"id": transcript.id, "saved": True}


@router.get("/boxers/{boxer_id}/voice-transcripts")
def list_voice_transcripts(boxer_id: str, db: Session = Depends(get_db)):
    _require_boxer_access(boxer_id, db)
    transcripts = (
        db.query(VoiceTranscript)
        .filter(VoiceTranscript.boxer_id == boxer_id)
        .order_by(VoiceTranscript.created_at.desc())
        .limit(20)
        .all()
    )
    return {
        "transcripts": [
            {
                "id": t.id,
                "companion_slug": t.companion_slug,
                "language": t.language,
                "transcript": t.transcript[:200] + "…" if len(t.transcript) > 200 else t.transcript,
                "created_at": t.created_at.isoformat(),
            }
            for t in transcripts
        ]
    }


# ---------------------------------------------------------------------------
# 15. Action Proposals
# ---------------------------------------------------------------------------

@router.get("/boxers/{boxer_id}/action-proposals")
def list_action_proposals(boxer_id: str, db: Session = Depends(get_db)):
    _require_boxer_access(boxer_id, db)
    proposals = (
        db.query(AIActionProposal)
        .filter(
            AIActionProposal.boxer_id == boxer_id,
            AIActionProposal.status == "pending",
        )
        .order_by(AIActionProposal.created_at.desc())
        .limit(20)
        .all()
    )
    return {
        "proposals": [
            {
                "id": p.id,
                "companion_slug": p.companion_slug,
                "action_type": p.action_type,
                "description": p.description,
                "status": p.status,
                "created_at": p.created_at.isoformat(),
            }
            for p in proposals
        ]
    }


@router.post("/action-proposals/{proposal_id}/approve")
def approve_action_proposal(
    proposal_id: str,
    body: ActionProposalApprove,
    db: Session = Depends(get_db),
):
    proposal = db.query(AIActionProposal).filter(AIActionProposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Proposal not found."}})

    proposal.status = "approved" if body.approved else "rejected"
    db.commit()
    return {"id": proposal.id, "status": proposal.status}


# ---------------------------------------------------------------------------
# 16. AI Corner Home Dashboard
# ---------------------------------------------------------------------------

@router.get("/boxers/{boxer_id}/corner-home")
def get_corner_home(boxer_id: str, db: Session = Depends(get_db)):
    """
    Aggregate data for the AI Corner homepage:
    - Daily briefing summary
    - Recent conversations per companion
    - Active goals
    - Active challenges
    - Learning progress summary
    - Pending action proposals
    """
    _require_boxer_access(boxer_id, db)
    today = date.today().isoformat()

    # Recent conversations
    recent_convs = (
        db.query(AIConversation)
        .filter(AIConversation.boxer_id == boxer_id, AIConversation.is_archived == False)  # noqa
        .order_by(AIConversation.updated_at.desc())
        .limit(5)
        .all()
    )

    # Active goals
    active_goals = (
        db.query(AIGoal)
        .filter(AIGoal.boxer_id == boxer_id, AIGoal.status == "active")
        .order_by(AIGoal.created_at.desc())
        .limit(5)
        .all()
    )

    # Active challenges
    active_challenges = (
        db.query(AIChallenge)
        .filter(
            AIChallenge.boxer_id == boxer_id,
            AIChallenge.status.in_(["pending", "in_progress"]),
            AIChallenge.end_date >= today,
        )
        .order_by(AIChallenge.end_date)
        .limit(5)
        .all()
    )

    # Learning progress
    total_lessons = db.query(LearningLesson).filter(LearningLesson.is_published == True).count()  # noqa
    completed_lessons = (
        db.query(LearningProgress)
        .filter(
            LearningProgress.boxer_id == boxer_id,
            LearningProgress.status == "completed",
        )
        .count()
    )

    # Pending proposals
    pending_proposals = (
        db.query(AIActionProposal)
        .filter(AIActionProposal.boxer_id == boxer_id, AIActionProposal.status == "pending")
        .count()
    )

    # Companions list
    companions = (
        db.query(AICompanion)
        .filter(AICompanion.is_active == True)  # noqa
        .order_by(AICompanion.display_order)
        .all()
    )

    return {
        "boxer_id": boxer_id,
        "today": today,
        "companions": [
            {"slug": c.slug, "name": c.name, "role": c.role, "icon": c.icon, "color_accent": c.color_accent}
            for c in companions
        ],
        "recent_conversations": [
            {
                "id": c.id,
                "companion_slug": c.companion_slug,
                "title": c.title or "New conversation",
                "updated_at": c.updated_at.isoformat(),
            }
            for c in recent_convs
        ],
        "active_goals": [
            {"id": g.id, "title": g.title, "completion_percent": g.completion_percent, "category": g.category}
            for g in active_goals
        ],
        "active_challenges": [
            {"id": c.id, "title": c.title, "category": c.category, "end_date": c.end_date}
            for c in active_challenges
        ],
        "learning_progress": {
            "total_lessons": total_lessons,
            "completed_lessons": completed_lessons,
        },
        "pending_action_proposals": pending_proposals,
    }
