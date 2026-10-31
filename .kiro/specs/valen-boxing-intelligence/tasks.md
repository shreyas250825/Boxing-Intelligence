# Implementation Plan: Valen Boxing Intelligence

## Overview

This plan implements the full Valen Boxing Intelligence monorepo in incremental, wire-together steps. The backend is Python 3.11 / FastAPI / SQLAlchemy / SQLite (dev) with an optional MediaPipe pose pipeline. The frontend is React 18 / TypeScript / Vite / Tailwind CSS / Recharts. Each task builds directly on the previous one and ends with all code integrated — no orphaned modules.

---

## Tasks

- [x] 1. Monorepo scaffold and project configuration
  - Create the top-level `valen-boxing-intelligence/` monorepo with `frontend/` and `backend/` subdirectories matching the design directory layout
  - Add root `.gitignore` covering `.env`, `data/`, `reports/`, `*.db`, `venv/`, `node_modules/`, `__pycache__/`, `dist/`
  - Add `docs/README.md` with a brief project overview
  - Create `backend/.env.example` with keys: `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS`, `STORAGE_DIR`, `REPORTS_DIR`, `MAX_UPLOAD_BYTES`, `FRAME_INTERVAL_SECONDS`, `MAX_FRAMES`
  - Create `frontend/.env.example` with key: `VITE_API_BASE_URL`
  - _Requirements: 17.1, 17.2_

- [x] 2. Backend foundation — FastAPI app, config, and database layer
  - [x] 2.1 Set up `backend/app/core/config.py` using `pydantic-settings`; load all `.env` keys with sensible defaults; expose a `get_settings()` dependency
    - _Requirements: 17.2, 16.1, 16.2_
  - [x] 2.2 Set up `backend/app/core/database.py` with SQLAlchemy `create_engine` (SQLite WAL mode for `sqlite:///` URLs, PostgreSQL for `postgresql://`), `SessionLocal`, and `get_db` dependency
    - _Requirements: 15.5, 17.4, 17.5_
  - [x] 2.3 Create `backend/app/main.py`: instantiate the FastAPI app, register CORS middleware using `CORS_ORIGINS`, mount the `/api/v1` router, add `GET /health` endpoint returning `{ ffmpeg_available: bool }`
    - _Requirements: 12.5, 12.6, 16.1_
  - [ ]* 2.4 Write unit tests for config loading and health endpoint
    - Verify `get_settings()` reads env vars; verify `/health` returns `200` with `ffmpeg_available` key
    - _Requirements: 12.5, 17.2_

- [x] 3. Database models and Alembic migrations
  - [x] 3.1 Create all eight SQLAlchemy ORM models in `backend/app/models/`: `Boxer`, `FightCamp`, `TrainingSession`, `Video`, `AnalysisJob`, `AnalysisResult`, `Metric`, `Observation`, `Report` — matching the ER diagram in design.md exactly, including FK relationships and RESTRICT delete rules
    - _Requirements: 15.1, 15.2, 15.3_
  - [x] 3.2 Configure Alembic in `backend/`; generate the initial migration from the ORM models; add `init_db()` helper that runs migrations idempotently; confirm running it twice raises no errors
    - _Requirements: 15.4, 17.6, 17.7_
  - [ ]* 3.3 Write unit tests for `init_db()` idempotency and FK constraint enforcement
    - Call `init_db()` twice on an in-memory SQLite DB; attempt a referential integrity violation and assert the DB raises an error
    - _Requirements: 15.1, 15.4_

- [x] 4. Pydantic schemas
  - [x] 4.1 Create all Pydantic v2 request/response schemas in `backend/app/schemas/` for boxers, fight camps, training sessions, videos, analysis jobs, analysis results, metrics, observations, and reports — matching the schemas in design.md; add `model_config = ConfigDict(from_attributes=True)` to all response schemas
    - _Requirements: 14.1, 14.2_
  - [ ]* 4.2 Write property test for Pydantic schema round-trip (Property 26)
    - **Property 26: Round-trip consistency** — for any valid schema instance, `Model(**instance.model_dump())` equals the original
    - **Validates: Requirement 14.3**
  - [ ]* 4.3 Write property test for Pydantic schema rejection of invalid payloads (Property 27)
    - **Property 27: Invalid payload rejection** — for any schema with a missing required field or a constraint-violating value, construction raises `ValidationError`
    - **Validates: Requirement 14.4**

- [x] 5. Standard API response envelopes and error handling
  - [x] 5.1 Create `backend/app/core/responses.py` with helpers `success_response(data, meta=None)` and `error_response(code, message, details=None)`; create a global exception handler that catches unhandled exceptions and returns `500` with `code: INTERNAL_ERROR` and no stack trace
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  - [ ]* 5.2 Write property test for API success and error envelope shapes (Properties 23, 24, 25)
    - **Property 23: Single-item envelope** — `{ "data": {...}, "meta": null }`
    - **Property 24: Paginated list envelope** — `{ "data": [...], "meta": { "page", "page_size", "total", "total_pages" } }`
    - **Property 25: Error envelope** — `{ "error": { "code", "message", "details" } }` with no `traceback` key
    - **Validates: Requirements 12.1, 12.2, 12.3**

- [x] 6. Boxer service and router
  - [x] 6.1 Implement `backend/app/services/boxer_service.py` — `generate_permanent_id`, `check_duplicate` (case-insensitive, archived exempt), `create_boxer`, `get_boxer`, `list_boxers` (paginated + search), `update_boxer`, `archive_boxer` — matching the `BoxerService` interface in design.md
    - _Requirements: 1.1, 1.2, 1.3, 1.9, 1.11, 2.1, 2.3, 2.5, 2.8_
  - [ ]* 6.2 Write property test for permanent ID format and uniqueness (Property 1)
    - **Property 1: Permanent ID format and uniqueness** — every generated ID matches `^BX-\d{6}$`, is unique, and is numerically greater than all prior IDs
    - **Validates: Requirements 1.1, 1.2**
  - [ ]* 6.3 Write property test for case-insensitive duplicate detection (Property 2)
    - **Property 2: Duplicate detection is case-insensitive** — any casing variant of `full_name` with same DOB returns 409 containing the original `id`
    - **Validates: Requirement 1.3**
  - [ ]* 6.4 Write property test for archived boxer re-registration (Property 3)
    - **Property 3: Archived boxer does not block re-registration** — registering with same name+DOB as an archived boxer returns 201
    - **Validates: Requirement 1.10**
  - [ ]* 6.5 Write property test for schema field validation (Property 4)
    - **Property 4: Schema field validation rejects out-of-range and out-of-set values** — invalid `full_name` length, `stance`, or `experience_level` returns 422
    - **Validates: Requirements 1.5, 1.6, 1.7**
  - [x] 6.6 Implement `backend/app/api/v1/boxers.py` router — all five boxer routes (`GET /boxers`, `POST /boxers`, `GET /boxers/{id}`, `PUT /boxers/{id}`, `POST /boxers/{id}/archive`) using the response envelopes and error codes from design.md; register the router in `main.py`
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.2, 2.6, 2.7, 2.8, 2.9_
  - [ ]* 6.7 Write property test for paginated list size invariant (Property 5)
    - **Property 5: Paginated list size invariant** — `len(data) ≤ page_size` and `meta.total` equals true count for any `page`/`page_size`
    - **Validates: Requirements 2.5, 10.4**

- [x] 7. Fight camp service and router
  - [x] 7.1 Implement `backend/app/services/fight_camp_service.py` — `create_fight_camp` (date validation), `get_fight_camp`, `update_fight_camp`, `list_fight_camps` (descending `start_date`); enforce that linked sessions belong to the same boxer
    - _Requirements: 3.1, 3.3, 3.4, 3.5_
  - [ ]* 7.2 Write property test for fight camp session isolation (Property 6)
    - **Property 6: Fight camp session isolation** — linking a session whose `boxer_id` differs from the camp's `boxer_id` is rejected with 422
    - **Validates: Requirement 3.2**
  - [ ]* 7.3 Write property test for fight camp descending order (Property 7)
    - **Property 7: Fight camps returned in descending start_date order** — for any number of fight camps, list response is ordered by `start_date` descending
    - **Validates: Requirement 3.4**
  - [x] 7.4 Implement `backend/app/api/v1/fight_camps.py` router — all four fight camp routes; register the router in `main.py`
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6_

- [x] 8. Video service and upload router
  - [x] 8.1 Implement `backend/app/services/video_service.py` — `validate_file` (extension + MIME allowlist), `build_safe_path` (UUID + whitelisted extension, verify parent == `Storage_Dir`), `save_upload`, `get_video`, `delete_video` (remove DB record + file)
    - _Requirements: 4.1, 4.2, 4.3, 4.9, 4.10, 4.11, 5.1, 5.2, 5.3_
  - [ ]* 8.2 Write property test for video upload validation (Property 8)
    - **Property 8: Video upload validation rejects invalid extension or MIME type** — invalid extension or mismatched MIME returns 422 with `code: VIDEO_INVALID_TYPE` and no file written to `Storage_Dir`
    - **Validates: Requirements 4.1, 4.2**
  - [ ]* 8.3 Write property test for oversized upload rejection (Property 9)
    - **Property 9: Oversized uploads rejected before writing to disk** — upload exceeding `MAX_UPLOAD_BYTES` returns error and `Storage_Dir` contains no new file
    - **Validates: Requirement 4.4**
  - [ ]* 8.4 Write property test for safe path construction (Property 10)
    - **Property 10: Safe path construction — user input isolation and directory confinement** — `storage_filename` contains no substring of `original_filename`; `build_safe_path(...).parent == Storage_Dir`
    - **Validates: Requirements 5.1, 5.2**
  - [ ]* 8.5 Write property test for video deletion atomicity (Property 11)
    - **Property 11: Deleted video removes both DB record and file** — after `DELETE /api/v1/videos/{id}`, both DB record and file are absent
    - **Validates: Requirement 4.9**
  - [x] 8.6 Implement `backend/app/api/v1/videos.py` router — `POST /videos/upload`, `GET /videos/{id}`, `DELETE /videos/{id}`; enforce file-size limit before writing; register router in `main.py`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.9, 4.10, 4.11, 16.4, 16.5_

- [ ] 9. Analysis pipeline — frame extraction, pose, and metric computation
  - [-] 9.1 Implement `backend/app/analysis/metadata.py` — `extract_video_metadata` using FFmpeg subprocess when available, fallback to OpenCV; raise `MetadataExtractionError` if both fail; postconditions: all fields `> 0`
    - _Requirements: 6.6, 6.7_
  - [~] 9.2 Implement `backend/app/analysis/sampler.py` — `sample_frames` with configurable `interval_seconds` and `max_frames`; loop invariant: all collected frames are valid decoded numpy arrays; respect `max_frames` cap
    - _Requirements: 6.8_
  - [ ]* 9.3 Write property test for video metadata postconditions (Property 14)
    - **Property 14: Video metadata postconditions** — for any valid video file, all of `duration`, `width`, `height`, `fps`, `frame_count` are `> 0`
    - **Validates: Requirement 6.6**
  - [ ]* 9.4 Write property test for frame sampling count invariant (Property 15)
    - **Property 15: Frame sampling count invariant** — `len(result) ≤ max_frames` for any `interval_seconds > 0`, `max_frames > 0`, and valid video file
    - **Validates: Requirement 6.8**
  - [~] 9.5 Implement `backend/app/analysis/pose.py` — `is_mediapipe_available`, `run_pose_landmarker`; graceful fallback returning empty list when MediaPipe is not installed or model file missing; confidence threshold ≥ 0.5
    - _Requirements: 6.9, 6.10_
  - [~] 9.6 Implement `backend/app/analysis/metrics.py` — `compute_metrics` following the honesty rule: only insert metrics computable from real data; include `source` and non-empty `calculation_method` on every metric; pose-dependent metrics gated behind `len(pose_results) > 0`
    - _Requirements: 7.1, 7.2_
  - [ ]* 9.7 Write property test for metric honesty invariant (Property 16)
    - **Property 16: Metric honesty invariant** — every returned metric has `source ∈ {automated, coach_entered}` and non-empty `calculation_method`; no fabricated values
    - **Validates: Requirements 7.1, 7.2**
  - [~] 9.8 Implement `backend/app/analysis/pipeline.py` — `run_analysis_pipeline` orchestrating all stages (validate → metadata → sample → pose → metrics → persist); update job status (`queued → processing → completed | failed`) with `started_at` / `completed_at`; roll back on unhandled exception
    - _Requirements: 6.3, 6.4, 6.5, 6.11, 6.12_
  - [~] 9.9 Implement `backend/app/analysis/runner.py` — `start_analysis_job` spawning a daemon thread that creates its own DB session and calls `run_analysis_pipeline`
    - _Requirements: 6.1_

- [ ] 10. Analysis service and router
  - [~] 10.1 Implement `backend/app/services/analysis_service.py` — `enqueue_job` (check for existing queued/processing job), `get_job`, `cancel_job`, `get_result` — matching the `AnalysisService` interface in design.md
    - _Requirements: 6.1, 6.2, 6.4_
  - [ ]* 10.2 Write property test for analysis job enqueue idempotency (Property 12)
    - **Property 12: Analysis job enqueue idempotency** — calling `enqueue_job` for a video that already has a queued/processing job raises an error and creates no duplicate job record
    - **Validates: Requirement 6.2**
  - [ ]* 10.3 Write property test for terminal state immutability (Property 13)
    - **Property 13: Analysis job terminal state immutability** — any status-transition attempt on a job in `completed`, `failed`, or `cancelled` has no effect
    - **Validates: Requirement 6.4**
  - [~] 10.4 Implement `backend/app/api/v1/analysis.py` router — `POST /videos/{id}/analyse`, `GET /analysis-jobs/{id}`, `GET /analysis-results/{id}`, `DELETE /analysis-jobs/{id}` (cancel); register in `main.py`
    - _Requirements: 6.1, 6.2, 6.4_

- [ ] 11. Observations service and router
  - [~] 11.1 Implement `backend/app/services/observation_service.py` — `create_observation`, `update_observation`, `delete_observation`, `list_observations` (sorted by `timestamp_seconds` ascending)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  - [ ]* 11.2 Write property test for observation validation (Property 18)
    - **Property 18: Observation validation rejects invalid fields** — `timestamp_seconds < 0`, `description` outside `[5, 1000]`, invalid `category` or `severity` returns 422
    - **Validates: Requirements 9.1, 9.3, 9.4**
  - [~] 11.3 Implement `backend/app/api/v1/observations.py` router — `GET /videos/{id}/observations`, `POST /observations`, `PUT /observations/{id}`, `DELETE /observations/{id}`; register in `main.py`
    - _Requirements: 9.1, 9.5, 9.7_

- [ ] 12. Progress tracking and session history endpoints
  - [~] 12.1 Implement `backend/app/api/v1/progress.py` router — `GET /boxers/{id}/progress` (time-series metrics grouped by `metric_key`, with `start_date`/`end_date` filter) and `GET /boxers/{id}/sessions` (paginated, descending `session_date`); register in `main.py`
    - _Requirements: 10.1, 10.2, 10.5_
  - [ ]* 12.2 Write property test for session history ordering (Property 20)
    - **Property 20: Session history in descending session_date order** — for any boxer with any sessions, list is ordered by `session_date` descending
    - **Validates: Requirement 10.4**

- [ ] 13. Report service and router
  - [~] 13.1 Implement `backend/app/services/report_service.py` — `generate_report` (verify boxer + session ownership, check at least one data source, build PDF via ReportLab, persist file and DB record, roll back on failure), `get_report_path`, `list_reports` — following the honesty-only policy
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_
  - [ ]* 13.2 Write property test for report session ownership (Property 21)
    - **Property 21: Report session ownership** — a session belonging to a different boxer than `boxer_id` in the request causes 422 and no PDF is generated
    - **Validates: Requirement 11.1**
  - [ ]* 13.3 Write property test for report honesty invariant (Property 22)
    - **Property 22: Report honesty invariant** — every data item in the generated PDF corresponds to a DB record linked to the specified boxer; no synthetic data
    - **Validates: Requirements 11.3, 11.4**
  - [~] 13.4 Implement `backend/app/api/v1/reports.py` router — `POST /reports`, `GET /reports/{id}`, `GET /reports/{id}/download` (stream with `Content-Disposition: attachment`), `GET /boxers/{id}/reports`; register in `main.py`
    - _Requirements: 11.2, 11.7, 11.8, 11.9, 11.10, 11.11_

- [ ] 14. Backend integration tests and test fixtures
  - [~] 14.1 Create `backend/tests/fixtures/generate_test_video.py` — script that uses OpenCV to produce a minimal valid MP4 (10 frames, 320×240, 30 fps) in a temp directory; expose a `pytest` fixture `test_video_path`
    - _Requirements: 6.5, 6.6_
  - [ ]* 14.2 Write integration tests covering the full happy path: boxer registration → profile fetch → fight camp creation → video upload → analysis enqueue → job polling → result fetch → observation creation → report generation
    - Use the `test_video_path` fixture and a test SQLite DB
    - Assert all HTTP status codes, response envelope shapes, and DB record counts
    - _Requirements: 1.1, 4.3, 6.1, 9.5, 11.4_
  - [ ]* 14.3 Write integration tests for all major error paths: duplicate boxer (409), invalid upload type (422), oversized upload (413), enqueue with in-progress job (409), report with no data (422), missing report file (404)
    - _Requirements: 1.3, 4.2, 4.4, 6.2, 11.2, 11.9_

- [~] 15. Backend checkpoint — all tests pass
  - Ensure all pytest tests pass; confirm `/health` responds; ask the user if questions arise.

- [ ] 16. Frontend foundation — Vite project, Tailwind, routing, and Axios client
  - [ ] 16.1 Bootstrap the Vite + React + TypeScript project in `frontend/`; install and configure Tailwind CSS with a dark theme (primary backgrounds HSL L ≤ 20%, electric-blue accents); configure `vite.config.ts` with proxy to `http://localhost:8000`
    - _Requirements: 13.1_
  - [~] 16.2 Create `frontend/src/api/client.ts` — Axios instance that reads `VITE_API_BASE_URL` from env, sets `Content-Type: application/json`, and attaches a response interceptor that unwraps `data` from the success envelope and throws a typed `ApiError` for error envelopes
    - _Requirements: 13.5_
  - [~] 16.3 Create all TypeScript interfaces in `frontend/src/types/index.ts` — `Boxer`, `FightCamp`, `TrainingSession`, `Video`, `AnalysisJob`, `AnalysisResult`, `Metric`, `Observation`, `Report`, `PaginatedResponse<T>`, `ApiError` — matching the backend Pydantic schemas exactly
    - _Requirements: 13.5_
  - [~] 16.4 Set up React Router in `frontend/src/main.tsx` with routes for all 11 pages: `/` (Dashboard), `/boxers` (Boxer Directory), `/boxers/new` (Register Boxer), `/boxers/:id` (Athlete Profile), `/boxers/:id/fight-camps` (Fight Camp Management), `/boxers/:id/upload` (Video Upload), `/analysis/:jobId` (Video Analysis), `/videos/:id/annotations` (Session Annotations), `/boxers/:id/progress` (Progress Tracking), `/boxers/:id/reports` (Reports), `/settings` (Settings)
    - _Requirements: 13.4_

- [ ] 17. Frontend typed API helper modules
  - [~] 17.1 Create `frontend/src/api/boxers.ts` — typed helpers `registerBoxer`, `getBoxer`, `listBoxers`, `updateBoxer`, `archiveBoxer`
    - _Requirements: 13.5_
  - [~] 17.2 Create `frontend/src/api/fightCamps.ts` — typed helpers `createFightCamp`, `getFightCamp`, `updateFightCamp`, `listFightCamps`
    - _Requirements: 13.5_
  - [~] 17.3 Create `frontend/src/api/videos.ts` — typed helpers `uploadVideo` (XHR with `onProgress` callback), `getVideo`, `deleteVideo`
    - _Requirements: 4.6, 4.7, 4.8, 13.5_
  - [~] 17.4 Create `frontend/src/api/analysis.ts` — typed helpers `enqueueAnalysis`, `getAnalysisJob`, `getAnalysisResult`, `cancelAnalysisJob`
    - _Requirements: 13.5_
  - [~] 17.5 Create `frontend/src/api/observations.ts` — typed helpers `listObservations`, `createObservation`, `updateObservation`, `deleteObservation`
    - _Requirements: 13.5_
  - [~] 17.6 Create `frontend/src/api/progress.ts` and `frontend/src/api/reports.ts` — typed helpers `getProgress`, `getSessions`, `generateReport`, `downloadReport`, `listReports`
    - _Requirements: 13.5_

- [ ] 18. Shared UI components
  - [~] 18.1 Implement `frontend/src/components/BoxerCard.tsx` — displays `BoxerSummary` (permanent ID, name, weight class, stance, session count); `onClick` navigates to athlete profile; dark card with electric-blue hover border
    - _Requirements: 13.1, 13.2_
  - [~] 18.2 Implement `frontend/src/components/SkeletonLoader.tsx` — reusable skeleton block and skeleton card variants used during all data-fetching states; used by all pages
    - _Requirements: 13.2_
  - [~] 18.3 Implement `frontend/src/components/VideoUploadForm.tsx` — file picker with client-side extension validation, XHR upload with progress bar (using `onProgress`), disabled submit during upload, inline error display for backend validation errors
    - _Requirements: 4.6, 4.7, 4.8_
  - [~] 18.4 Implement `frontend/src/hooks/useAnalysisJob.ts` — polls `getAnalysisJob` at configurable interval; stops on terminal status; cleans up on unmount; retries on network error up to 3 times; stops after 60 attempts with timeout message
    - _Requirements: 8.1, 8.3, 8.5, 8.6, 8.7_
  - [ ]* 18.5 Write unit test for polling cleanup on unmount (Property 17)
    - **Property 17: Polling cleanup on unmount** — after `useAnalysisJob` unmounts at any polling lifecycle point, no further API calls are made
    - **Validates: Requirement 8.5**
  - [~] 18.6 Implement `frontend/src/components/AnalysisResultPanel.tsx` — uses `useAnalysisJob`; shows skeleton during polling; on completion fetches result and renders metrics labelled with `source`; shows `pose_available: false` banner; shows error card on failure
    - _Requirements: 7.3, 7.4, 8.2, 8.4_
  - [~] 18.7 Implement `frontend/src/components/ProgressChart.tsx` — Recharts `LineChart` with one series per `metric_key`; renders `comparabilityWarnings` beneath the chart when mixed session types or metric sources are present
    - _Requirements: 10.3, 10.4_
  - [~] 18.8 Implement `frontend/src/components/ObservationTimeline.tsx` — lists observations sorted by `timestamp_seconds` ascending; clicking an observation fires `onSeek`; clamped seek to video end when `timestamp_seconds` exceeds duration; empty state message when no observations; add/edit controls
    - _Requirements: 9.6, 9.7_
  - [ ]* 18.9 Write unit test for ObservationTimeline sort order (Property 19)
    - **Property 19: Observation timeline sorted by timestamp ascending** — for any set of observations, `ObservationTimeline` renders them in ascending `timestamp_seconds` order
    - **Validates: Requirement 9.6**

- [ ] 19. Application pages
  - [~] 19.1 Implement `frontend/src/pages/BoxerDirectory.tsx` — paginated, searchable list of `BoxerCard` components; skeleton loaders; empty state; search input debounced
    - _Requirements: 2.8, 13.2, 13.3_
  - [~] 19.2 Implement `frontend/src/pages/RegisterBoxer.tsx` — form with all required boxer fields; client-side validation; on 409 shows warning with link to existing profile; on success redirects to athlete profile
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 13.3_
  - [~] 19.3 Implement `frontend/src/pages/AthleteProfile.tsx` — displays full boxer record including permanent ID; edit mode for mutable fields; archive button; lists associated sessions and fight camps; 404 handling
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  - [~] 19.4 Implement `frontend/src/pages/FightCampManagement.tsx` — lists fight camps for a boxer in descending start-date order; form to create/edit a camp with date validation; 404 handling for boxer
    - _Requirements: 3.1, 3.4, 3.5, 3.6_
  - [~] 19.5 Implement `frontend/src/pages/VideoUpload.tsx` — wraps `VideoUploadForm`; links upload to a boxer and optionally a fight camp; on success shows "Analyse" button that calls `enqueueAnalysis` and navigates to `/analysis/:jobId`
    - _Requirements: 4.5, 4.6, 4.7, 4.8_
  - [~] 19.6 Implement `frontend/src/pages/VideoAnalysis.tsx` — renders `AnalysisResultPanel` for the given `jobId`; shows job metadata while polling; displays full metrics dashboard on completion
    - _Requirements: 7.3, 7.4, 8.1, 8.2, 8.3, 8.4_
  - [~] 19.7 Implement `frontend/src/pages/SessionAnnotations.tsx` — video player (HTML5 `<video>`) synced with `ObservationTimeline`; add/edit/delete observation forms; real-time seek integration
    - _Requirements: 9.1, 9.6, 9.7_
  - [~] 19.8 Implement `frontend/src/pages/ProgressTracking.tsx` — date range filter controls; renders `ProgressChart` for each metric key returned from `/progress`; comparability warnings; empty state
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  - [~] 19.9 Implement `frontend/src/pages/Reports.tsx` — session selector (only sessions with at least one observation or completed analysis result are selectable; "Generate Report" disabled otherwise with tooltip); lists previously generated reports with download links
    - _Requirements: 11.1, 11.7, 11.8, 11.10, 11.11_
  - [~] 19.10 Implement `frontend/src/pages/Dashboard.tsx` — summary cards (total boxers, recent sessions, pending observations); quick-action buttons; responsive grid layout
    - _Requirements: 13.1, 13.4_
  - [~] 19.11 Implement `frontend/src/pages/Settings.tsx` — displays `/health` data (FFmpeg availability); storage usage from `GET /api/v1/settings/storage`; GDPR full-deletion button (`DELETE /api/v1/boxers/{id}/data`) with confirmation dialog
    - _Requirements: 12.5, 6.7_

- [ ] 20. Deployment configuration
  - [~] 20.1 Create `backend/Dockerfile` — Python 3.11 slim base image, copy requirements, install dependencies, expose port 8000, run `uvicorn app.main:app`
    - _Requirements: 17.3_
  - [~] 20.2 Create `backend/render.yaml` — web service definition pointing to the Dockerfile, with environment variable references for `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS`
    - _Requirements: 17.3_

- [~] 21. Final checkpoint — full integration verified
  - Ensure all pytest backend tests pass, all Vitest frontend tests pass, and the health endpoint responds correctly; ask the user if any questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All property tests use `hypothesis` on the backend and `vitest` + `@testing-library/react` on the frontend
- Every task references specific requirements for full traceability
- Backend and frontend tasks are designed to be implemented in parallel after Task 16 completes
- The synthetic test video generator (Task 14.1) must be completed before integration tests
- MediaPipe is optional at runtime; all pipeline code must degrade gracefully without it

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "2.2"] },
    { "id": 1, "tasks": ["2.3", "3.1"] },
    { "id": 2, "tasks": ["2.4", "3.2", "4.1"] },
    { "id": 3, "tasks": ["3.3", "4.2", "4.3", "5.1"] },
    { "id": 4, "tasks": ["5.2", "6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3", "6.4", "6.5", "6.6"] },
    { "id": 6, "tasks": ["6.7", "7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3", "7.4"] },
    { "id": 8, "tasks": ["8.1"] },
    { "id": 9, "tasks": ["8.2", "8.3", "8.4", "8.5", "8.6"] },
    { "id": 10, "tasks": ["9.1", "9.2"] },
    { "id": 11, "tasks": ["9.3", "9.4", "9.5"] },
    { "id": 12, "tasks": ["9.6"] },
    { "id": 13, "tasks": ["9.7", "9.8"] },
    { "id": 14, "tasks": ["9.9", "10.1"] },
    { "id": 15, "tasks": ["10.2", "10.3", "10.4"] },
    { "id": 16, "tasks": ["11.1"] },
    { "id": 17, "tasks": ["11.2", "11.3"] },
    { "id": 18, "tasks": ["12.1"] },
    { "id": 19, "tasks": ["12.2", "13.1"] },
    { "id": 20, "tasks": ["13.2", "13.3", "13.4"] },
    { "id": 21, "tasks": ["14.1"] },
    { "id": 22, "tasks": ["14.2", "14.3"] },
    { "id": 23, "tasks": ["16.1"] },
    { "id": 24, "tasks": ["16.2", "16.3", "16.4"] },
    { "id": 25, "tasks": ["17.1", "17.2", "17.3", "17.4", "17.5", "17.6"] },
    { "id": 26, "tasks": ["18.1", "18.2"] },
    { "id": 27, "tasks": ["18.3", "18.4"] },
    { "id": 28, "tasks": ["18.5", "18.6", "18.7", "18.8"] },
    { "id": 29, "tasks": ["18.9", "19.1", "19.2"] },
    { "id": 30, "tasks": ["19.3", "19.4", "19.5"] },
    { "id": 31, "tasks": ["19.6", "19.7", "19.8"] },
    { "id": 32, "tasks": ["19.9", "19.10", "19.11"] },
    { "id": 33, "tasks": ["20.1", "20.2"] }
  ]
}
```
