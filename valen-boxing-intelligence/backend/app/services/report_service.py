import uuid
import json
from pathlib import Path
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.report import Report
from app.models.boxer import Boxer
from app.models.training_session import TrainingSession
from app.models.observation import Observation
from app.models.analysis_job import AnalysisJob
from app.models.video import Video
from app.models.metric import Metric


class ReportGenerationError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


def _get_reports_dir() -> Path:
    p = Path(settings.REPORTS_DIR)
    p.mkdir(parents=True, exist_ok=True)
    return p


def _check_has_data(db: Session, boxer_id: str, sessions: list) -> bool:
    for session in sessions:
        if db.query(Observation).filter(Observation.session_id == session.id).count() > 0:
            return True
        video = db.query(Video).filter(Video.session_id == session.id).first()
        if video:
            job = db.query(AnalysisJob).filter(
                AnalysisJob.video_id == video.id,
                AnalysisJob.status == "completed",
            ).first()
            if job:
                return True
    if db.query(Observation).filter(Observation.boxer_id == boxer_id).count() > 0:
        return True
    return False


def generate_report(db: Session, boxer_id: str, session_ids: List[str], title: str = "Performance Report") -> Report:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib import colors

    boxer = db.query(Boxer).filter(Boxer.id == boxer_id).first()
    if not boxer:
        raise ReportGenerationError("BOXER_NOT_FOUND", "Boxer not found")

    sessions = []
    for sid in session_ids:
        session = db.query(TrainingSession).filter(
            TrainingSession.id == sid,
            TrainingSession.boxer_id == boxer_id,
        ).first()
        if not session:
            raise ReportGenerationError("SESSION_OWNERSHIP_ERROR", f"Session {sid} not found for this boxer")
        sessions.append(session)

    if not _check_has_data(db, boxer_id, sessions):
        raise ReportGenerationError(
            "REPORT_INSUFFICIENT_DATA",
            "No observations or completed analysis results found for the selected sessions.",
        )

    report_id = str(uuid.uuid4())
    reports_dir = _get_reports_dir()
    filename = f"{report_id}.pdf"
    file_path = reports_dir / filename

    try:
        doc = SimpleDocTemplate(str(file_path), pagesize=A4,
                                topMargin=40, bottomMargin=40, leftMargin=50, rightMargin=50)
        styles = getSampleStyleSheet()
        story = []

        story.append(Paragraph("VALEN BOXING INTELLIGENCE", styles["Title"]))
        story.append(Paragraph(f"Performance Report - {title}", styles["Heading2"]))
        story.append(Paragraph(f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", styles["Normal"]))
        story.append(Spacer(1, 16))

        story.append(Paragraph("Athlete", styles["Heading3"]))
        rows = [["Name", boxer.full_name], ["Athlete ID", boxer.permanent_id],
                ["Stance", boxer.stance], ["Experience", boxer.experience_level]]
        if boxer.primary_coach:
            rows.append(["Coach", boxer.primary_coach])
        t = Table(rows, colWidths=[110, 360])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#1c2128")),
            ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#60a5fa")),
            ("TEXTCOLOR", (1, 0), (1, -1), colors.black),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#30363d")),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
        ]))
        story.append(t)
        story.append(Spacer(1, 20))

        for session in sessions:
            story.append(Paragraph(
                f"Session: {session.session_date} ({session.session_type.replace('_', ' ').title()})",
                styles["Heading3"],
            ))

            observations = db.query(Observation).filter(
                Observation.session_id == session.id,
            ).order_by(Observation.timestamp_seconds).all()

            if not observations:
                video = db.query(Video).filter(Video.session_id == session.id).first()
                if video:
                    observations = db.query(Observation).filter(
                        Observation.video_id == video.id,
                    ).order_by(Observation.timestamp_seconds).all()

            if observations:
                story.append(Paragraph("Coach Observations (coach-entered)", styles["Heading4"]))
                obs_rows = [["Time (s)", "Category", "Severity", "Description"]]
                for obs in observations:
                    obs_rows.append([
                        str(round(obs.timestamp_seconds, 1)),
                        obs.category.replace("_", " ").title(),
                        obs.severity.upper(),
                        obs.description[:100],
                    ])
                ot = Table(obs_rows, colWidths=[55, 110, 60, 245])
                ot.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3b82f6")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#30363d")),
                ]))
                story.append(ot)
            else:
                story.append(Paragraph("No observations recorded for this session.", styles["Normal"]))

            video = db.query(Video).filter(Video.session_id == session.id).first()
            if video:
                job = db.query(AnalysisJob).filter(
                    AnalysisJob.video_id == video.id,
                    AnalysisJob.status == "completed",
                ).first()
                if job and job.result:
                    story.append(Spacer(1, 8))
                    story.append(Paragraph("Automated Metrics", styles["Heading4"]))
                    metrics = db.query(Metric).filter(Metric.result_id == job.result.id).all()
                    if metrics:
                        mrows = [["Metric", "Value", "Unit"]]
                        for m in metrics:
                            mrows.append([m.metric_key.replace("_", " ").title(), str(round(m.value, 3)), m.unit])
                        mt = Table(mrows, colWidths=[200, 100, 170])
                        mt.setStyle(TableStyle([
                            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1c2128")),
                            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                            ("FONTSIZE", (0, 0), (-1, -1), 8),
                            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#30363d")),
                        ]))
                        story.append(mt)

            story.append(Spacer(1, 16))

        story.append(Paragraph("Methodology", styles["Heading3"]))
        story.append(Paragraph(
            "This report contains only data recorded in Valen Boxing Intelligence. "
            "Observations are coach-entered. Metrics are derived from local video analysis. "
            "No external AI services were used. No synthetic data has been included.",
            styles["Normal"],
        ))
        doc.build(story)

    except ReportGenerationError:
        raise
    except Exception as e:
        file_path.unlink(missing_ok=True)
        raise ReportGenerationError("REPORT_GENERATION_FAILED", f"PDF generation failed: {e}")

    report = Report(
        id=report_id, boxer_id=boxer_id, storage_filename=filename,
        title=title, session_ids_json=json.dumps(session_ids),
    )
    db.add(report)
    try:
        db.commit()
        db.refresh(report)
    except Exception as e:
        file_path.unlink(missing_ok=True)
        raise ReportGenerationError("REPORT_GENERATION_FAILED", f"DB insert failed: {e}")

    return report


def get_report_path(db: Session, report_id: str) -> Optional[Path]:
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        return None
    path = _get_reports_dir() / report.storage_filename
    return path if path.exists() else None


def list_reports(db: Session, boxer_id: str) -> list:
    return db.query(Report).filter(Report.boxer_id == boxer_id).order_by(Report.generated_at.desc()).all()