"""Add AI Corner tables

Revision ID: d9f3b1c7e842
Revises: c4f8a2b9d0e1
Create Date: 2026-11-02 10:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd9f3b1c7e842'
down_revision = 'c4f8a2b9d0e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # AI companion registry
    op.create_table(
        'ai_companions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('slug', sa.String(60), unique=True, nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('role', sa.String(80), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('personality', sa.Text(), nullable=True),
        sa.Column('capabilities_json', sa.Text(), nullable=True),
        sa.Column('min_role', sa.String(40), nullable=False, server_default='fighter'),
        sa.Column('icon', sa.String(60), nullable=True),
        sa.Column('color_accent', sa.String(30), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # Conversations
    op.create_table(
        'ai_conversations',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('boxer_id', sa.String(36), sa.ForeignKey('boxers.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('companion_slug', sa.String(60), sa.ForeignKey('ai_companions.slug', ondelete='RESTRICT'), nullable=False),
        sa.Column('title', sa.String(200), nullable=True),
        sa.Column('context_summary', sa.Text(), nullable=True),
        sa.Column('context_keys_json', sa.Text(), nullable=True),
        sa.Column('is_archived', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # Messages
    op.create_table(
        'ai_messages',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('conversation_id', sa.String(36), sa.ForeignKey('ai_conversations.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('content_type', sa.String(40), nullable=False, server_default='text'),
        sa.Column('prompt_tokens', sa.Integer(), nullable=True),
        sa.Column('completion_tokens', sa.Integer(), nullable=True),
        sa.Column('feedback', sa.String(20), nullable=True),
        sa.Column('is_saved', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # AI Memory
    op.create_table(
        'ai_memories',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('boxer_id', sa.String(36), sa.ForeignKey('boxers.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('companion_slug', sa.String(60), nullable=False),
        sa.Column('memory_key', sa.String(100), nullable=False),
        sa.Column('memory_value', sa.Text(), nullable=False),
        sa.Column('origin', sa.String(60), nullable=False, server_default='conversation'),
        sa.Column('origin_ref', sa.String(36), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # Collaboration sessions
    op.create_table(
        'ai_collaboration_sessions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('boxer_id', sa.String(36), sa.ForeignKey('boxers.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('trigger_question', sa.Text(), nullable=False),
        sa.Column('companions_json', sa.Text(), nullable=True),
        sa.Column('consolidated_report', sa.Text(), nullable=True),
        sa.Column('status', sa.String(30), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
    )

    # Agent findings
    op.create_table(
        'ai_agent_findings',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('session_id', sa.String(36), sa.ForeignKey('ai_collaboration_sessions.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('companion_slug', sa.String(60), nullable=False),
        sa.Column('finding', sa.Text(), nullable=False),
        sa.Column('missing_data', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # Action proposals
    op.create_table(
        'ai_action_proposals',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('boxer_id', sa.String(36), sa.ForeignKey('boxers.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('companion_slug', sa.String(60), nullable=False),
        sa.Column('conversation_id', sa.String(36), nullable=True),
        sa.Column('action_type', sa.String(80), nullable=False),
        sa.Column('action_payload_json', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('approved_by', sa.String(36), nullable=True),
        sa.Column('executed_at', sa.DateTime(), nullable=True),
        sa.Column('result_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # AI Goals
    op.create_table(
        'ai_goals',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('boxer_id', sa.String(36), sa.ForeignKey('boxers.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(60), nullable=False, server_default='general'),
        sa.Column('milestones_json', sa.Text(), nullable=True),
        sa.Column('target_date', sa.String(10), nullable=True),
        sa.Column('status', sa.String(30), nullable=False, server_default='active'),
        sa.Column('completion_percent', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # Daily briefings
    op.create_table(
        'ai_daily_briefings',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('boxer_id', sa.String(36), sa.ForeignKey('boxers.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('briefing_date', sa.String(10), nullable=False),
        sa.Column('briefing_json', sa.Text(), nullable=False),
        sa.Column('missing_data_json', sa.Text(), nullable=True),
        sa.Column('generated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # Weekly reviews
    op.create_table(
        'ai_weekly_reviews',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('boxer_id', sa.String(36), sa.ForeignKey('boxers.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('week_start', sa.String(10), nullable=False),
        sa.Column('week_end', sa.String(10), nullable=False),
        sa.Column('review_json', sa.Text(), nullable=False),
        sa.Column('missing_data_json', sa.Text(), nullable=True),
        sa.Column('generated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # AI Challenges
    op.create_table(
        'ai_challenges',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('boxer_id', sa.String(36), sa.ForeignKey('boxers.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('challenge_type', sa.String(40), nullable=False, server_default='daily'),
        sa.Column('category', sa.String(60), nullable=False, server_default='training'),
        sa.Column('criteria_json', sa.Text(), nullable=True),
        sa.Column('start_date', sa.String(10), nullable=False),
        sa.Column('end_date', sa.String(10), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # Learning lessons
    op.create_table(
        'learning_lessons',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('slug', sa.String(100), unique=True, nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('category', sa.String(80), nullable=False),
        sa.Column('difficulty', sa.String(20), nullable=False, server_default='beginner'),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('quiz_json', sa.Text(), nullable=True),
        sa.Column('estimated_minutes', sa.Integer(), nullable=False, server_default='5'),
        sa.Column('prerequisites_json', sa.Text(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_published', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # Learning progress
    op.create_table(
        'learning_progress',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('boxer_id', sa.String(36), sa.ForeignKey('boxers.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('lesson_id', sa.String(36), sa.ForeignKey('learning_lessons.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='not_started'),
        sa.Column('quiz_score', sa.Integer(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # Simulator sessions
    op.create_table(
        'simulator_sessions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('boxer_id', sa.String(36), sa.ForeignKey('boxers.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('scenario_slug', sa.String(100), nullable=False),
        sa.Column('scenario_title', sa.String(200), nullable=False),
        sa.Column('difficulty', sa.String(20), nullable=False, server_default='beginner'),
        sa.Column('steps_json', sa.Text(), nullable=False, server_default='[]'),
        sa.Column('total_score', sa.Integer(), nullable=True),
        sa.Column('max_score', sa.Integer(), nullable=True),
        sa.Column('completed', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # Saved combinations
    op.create_table(
        'saved_combinations',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('boxer_id', sa.String(36), sa.ForeignKey('boxers.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('title', sa.String(150), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('punches_json', sa.Text(), nullable=False),
        sa.Column('difficulty', sa.String(20), nullable=False, server_default='beginner'),
        sa.Column('category', sa.String(40), nullable=False, server_default='offensive'),
        sa.Column('is_coach_assigned', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('coach_notes', sa.Text(), nullable=True),
        sa.Column('video_reference', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # Voice transcripts
    op.create_table(
        'voice_transcripts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('boxer_id', sa.String(36), sa.ForeignKey('boxers.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('companion_slug', sa.String(60), nullable=False),
        sa.Column('conversation_id', sa.String(36), nullable=True),
        sa.Column('transcript', sa.Text(), nullable=False),
        sa.Column('language', sa.String(10), nullable=False, server_default='en'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('voice_transcripts')
    op.drop_table('saved_combinations')
    op.drop_table('simulator_sessions')
    op.drop_table('learning_progress')
    op.drop_table('learning_lessons')
    op.drop_table('ai_challenges')
    op.drop_table('ai_weekly_reviews')
    op.drop_table('ai_daily_briefings')
    op.drop_table('ai_goals')
    op.drop_table('ai_action_proposals')
    op.drop_table('ai_agent_findings')
    op.drop_table('ai_collaboration_sessions')
    op.drop_table('ai_memories')
    op.drop_table('ai_messages')
    op.drop_table('ai_conversations')
    op.drop_table('ai_companions')
