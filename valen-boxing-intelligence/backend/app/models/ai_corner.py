"""
AI Corner database models.

These tables persist all AI companion conversations, memories, collaboration
sessions, learning progress, challenges, goals, and action proposals.

Every table is boxer-scoped. Cross-boxer access is blocked at the service layer.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


# ---------------------------------------------------------------------------
# Companion registry
# ---------------------------------------------------------------------------

class AICompanion(Base):
    """Static / seeded table of the eight companion definitions."""

    __tablename__ = "ai_companions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    slug: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    personality: Mapped[str | None] = mapped_column(Text, nullable=True)
    # JSON array of capability strings
    capabilities_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Minimum role required to access: fighter, coach, gym_admin, platform_admin
    min_role: Mapped[str] = mapped_column(String(40), nullable=False, default="fighter")
    icon: Mapped[str | None] = mapped_column(String(60), nullable=True)
    color_accent: Mapped[str | None] = mapped_column(String(30), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    conversations = relationship("AIConversation", back_populates="companion", passive_deletes=True)


# ---------------------------------------------------------------------------
# Conversations and messages
# ---------------------------------------------------------------------------

class AIConversation(Base):
    __tablename__ = "ai_conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("boxers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    companion_slug: Mapped[str] = mapped_column(
        String(60), ForeignKey("ai_companions.slug", ondelete="RESTRICT"), nullable=False
    )
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Metadata summary used to rebuild partial context
    context_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Serialised list of active context keys fetched for this conversation
    context_keys_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    companion = relationship("AICompanion", back_populates="conversations")
    messages = relationship(
        "AIMessage", back_populates="conversation", passive_deletes=True, order_by="AIMessage.created_at"
    )
    boxer = relationship("Boxer", back_populates="ai_conversations")


class AIMessage(Base):
    __tablename__ = "ai_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # user | assistant | system
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Structured content type hint for the frontend renderer
    content_type: Mapped[str] = mapped_column(String(40), nullable=False, default="text")
    # Token counts for usage logging
    prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # User feedback: thumbs_up | thumbs_down | null
    feedback: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_saved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    conversation = relationship("AIConversation", back_populates="messages")


# ---------------------------------------------------------------------------
# AI Memory
# ---------------------------------------------------------------------------

class AIMemory(Base):
    """Persistent, athlete-scoped memory for a specific companion."""

    __tablename__ = "ai_memories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("boxers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    companion_slug: Mapped[str] = mapped_column(String(60), nullable=False)
    memory_key: Mapped[str] = mapped_column(String(100), nullable=False)
    memory_value: Mapped[str] = mapped_column(Text, nullable=False)
    # Origin: conversation_id, coach_note, user_explicit, system_derived
    origin: Mapped[str] = mapped_column(String(60), nullable=False, default="conversation")
    # Reference ID (conversation_id or message_id)
    origin_ref: Mapped[str | None] = mapped_column(String(36), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    boxer = relationship("Boxer", back_populates="ai_memories")


# ---------------------------------------------------------------------------
# AI Collaboration (multi-agent orchestration)
# ---------------------------------------------------------------------------

class AICollaborationSession(Base):
    """An orchestrated multi-agent request."""

    __tablename__ = "ai_collaboration_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("boxers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    trigger_question: Mapped[str] = mapped_column(Text, nullable=False)
    # Serialised list of companion slugs involved
    companions_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    consolidated_report: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    boxer = relationship("Boxer", back_populates="ai_collaboration_sessions")
    findings = relationship(
        "AIAgentFinding", back_populates="collaboration_session", passive_deletes=True
    )


class AIAgentFinding(Base):
    """Individual agent contribution within a collaboration session."""

    __tablename__ = "ai_agent_findings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ai_collaboration_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    companion_slug: Mapped[str] = mapped_column(String(60), nullable=False)
    finding: Mapped[str] = mapped_column(Text, nullable=False)
    # Any data missing that limited analysis
    missing_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    collaboration_session = relationship("AICollaborationSession", back_populates="findings")


# ---------------------------------------------------------------------------
# Action proposals (AI cannot silently change records)
# ---------------------------------------------------------------------------

class AIActionProposal(Base):
    """An AI-generated action that requires user confirmation before execution."""

    __tablename__ = "ai_action_proposals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("boxers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    companion_slug: Mapped[str] = mapped_column(String(60), nullable=False)
    conversation_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    action_type: Mapped[str] = mapped_column(String(80), nullable=False)
    action_payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    # pending | approved | rejected | executed | failed
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    approved_by: Mapped[str | None] = mapped_column(String(36), nullable=True)  # user_id
    executed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    result_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    boxer = relationship("Boxer", back_populates="ai_action_proposals")


# ---------------------------------------------------------------------------
# AI Goals
# ---------------------------------------------------------------------------

class AIGoal(Base):
    """A boxer-set goal managed by the AI Goal Manager."""

    __tablename__ = "ai_goals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("boxers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(60), nullable=False, default="general")
    # Serialised list of milestone objects {title, target_date, completed}
    milestones_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
    completion_percent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    boxer = relationship("Boxer", back_populates="ai_goals")


# ---------------------------------------------------------------------------
# AI Daily Briefing cache
# ---------------------------------------------------------------------------

class AIDailyBriefing(Base):
    """Cached daily briefing generated from actual boxer records."""

    __tablename__ = "ai_daily_briefings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("boxers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    briefing_date: Mapped[str] = mapped_column(String(10), nullable=False)
    briefing_json: Mapped[str] = mapped_column(Text, nullable=False)
    missing_data_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    boxer = relationship("Boxer", back_populates="ai_daily_briefings")


# ---------------------------------------------------------------------------
# AI Weekly Review
# ---------------------------------------------------------------------------

class AIWeeklyReview(Base):
    """Generated weekly review for a boxer."""

    __tablename__ = "ai_weekly_reviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("boxers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    week_start: Mapped[str] = mapped_column(String(10), nullable=False)
    week_end: Mapped[str] = mapped_column(String(10), nullable=False)
    review_json: Mapped[str] = mapped_column(Text, nullable=False)
    missing_data_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    boxer = relationship("Boxer", back_populates="ai_weekly_reviews")


# ---------------------------------------------------------------------------
# AI Challenges
# ---------------------------------------------------------------------------

class AIChallenge(Base):
    """A personalised challenge assigned to a boxer."""

    __tablename__ = "ai_challenges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("boxers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    challenge_type: Mapped[str] = mapped_column(String(40), nullable=False, default="daily")
    category: Mapped[str] = mapped_column(String(60), nullable=False, default="training")
    # Serialised completion criteria
    criteria_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[str] = mapped_column(String(10), nullable=False)
    end_date: Mapped[str] = mapped_column(String(10), nullable=False)
    # pending | in_progress | completed | failed | expired
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    boxer = relationship("Boxer", back_populates="ai_challenges")


# ---------------------------------------------------------------------------
# Learning Centre
# ---------------------------------------------------------------------------

class LearningLesson(Base):
    """A boxing knowledge lesson in the Learning Centre."""

    __tablename__ = "learning_lessons"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False, default="beginner")
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Serialised quiz questions [{question, options, correct_index, explanation}]
    quiz_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimated_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    prerequisites_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    progress_records = relationship("LearningProgress", back_populates="lesson", passive_deletes=True)


class LearningProgress(Base):
    """Per-boxer lesson progress tracking."""

    __tablename__ = "learning_progress"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("boxers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lesson_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("learning_lessons.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="not_started")
    quiz_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    boxer = relationship("Boxer", back_populates="learning_progress_records")
    lesson = relationship("LearningLesson", back_populates="progress_records")


# ---------------------------------------------------------------------------
# Boxing Simulator sessions
# ---------------------------------------------------------------------------

class SimulatorSession(Base):
    """A completed boxing scenario simulation session."""

    __tablename__ = "simulator_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("boxers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scenario_slug: Mapped[str] = mapped_column(String(100), nullable=False)
    scenario_title: Mapped[str] = mapped_column(String(200), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False, default="beginner")
    # Serialised list of decision steps {scenario_text, chosen_option, feedback, score}
    steps_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    total_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    boxer = relationship("Boxer", back_populates="simulator_sessions")


# ---------------------------------------------------------------------------
# Combination Studio
# ---------------------------------------------------------------------------

class SavedCombination(Base):
    """A saved punch combination (personal or coach-assigned)."""

    __tablename__ = "saved_combinations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("boxers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Serialised list of punch codes e.g. ["jab", "cross", "left_hook"]
    punches_json: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False, default="beginner")
    category: Mapped[str] = mapped_column(String(40), nullable=False, default="offensive")
    is_coach_assigned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    coach_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    boxer = relationship("Boxer", back_populates="saved_combinations")


# ---------------------------------------------------------------------------
# Voice transcripts
# ---------------------------------------------------------------------------

class VoiceTranscript(Base):
    """Saved voice session transcript."""

    __tablename__ = "voice_transcripts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("boxers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    companion_slug: Mapped[str] = mapped_column(String(60), nullable=False)
    conversation_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    transcript: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="en")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    boxer = relationship("Boxer", back_populates="voice_transcripts")
