# Requirements Document

## Introduction

Valen Boxing Intelligence is a video-based boxing performance analysis and athlete progress-tracking platform developed by Valen Labs. The system enables individual boxers and boxing gyms to register athletes, upload boxing footage, analyse training sessions, maintain permanent athlete records, compare progress across sessions, and generate professional PDF reports — all powered by a fully local video processing pipeline with no paid external AI APIs.

The platform is a monorepo with a React/TypeScript/Vite frontend and a Python/FastAPI backend. All metrics are derived exclusively from data the system can actually compute. The platform clearly labels unavailable metrics as unavailable and never fabricates results.

---

## Glossary

- **System**: The Valen Boxing Intelligence platform as a whole (frontend + backend).
- **Frontend**: The React/TypeScript/Vite web application served on port 5173.
- **Backend**: The Python/FastAPI application served on port 8000.
- **Boxer_Service**: The backend service responsible for athlete management, ID generation, and duplicate detection.
- **Video_Service**: The backend service responsible for safe file handling, storage, and video record management.
- **Analysis_Pipeline**: The background worker that runs frame extraction, pose estimation, and metric computation on a video file.
- **Analysis_Service**: The backend service that orchestrates analysis job lifecycle and background dispatch.
- **Report_Service**: The backend service that builds and stores PDF reports using ReportLab.
- **Observation_Service**: The backend service that manages timestamped coach observations.
- **PDF_Report**: A ReportLab-generated PDF file containing athlete data, metrics, and coach observations.
- **Permanent_ID**: A unique, immutable athlete identifier in the format `BX-XXXXXX` (e.g., `BX-000042`).
- **Fight_Camp**: A structured training block associated with one boxer, bounded by a start date and an optional target fight date.
- **Training_Session**: A discrete training event associated with one boxer, optionally linked to a Fight_Camp.
- **Analysis_Job**: A record representing a queued or in-progress video analysis task, with status lifecycle `queued → processing → completed | failed | cancelled`.
- **Analysis_Result**: The outcome record of a completed Analysis_Job, containing video metadata and computed metrics.
- **Metric**: A single measured or coach-entered data point associated with an Analysis_Result or Training_Session.
- **Observation**: A timestamped coach annotation attached to a specific video, categorised by technique area.
- **Pose_Landmarker**: The optional MediaPipe Pose Landmarker model used for skeleton-based metric computation.
- **Storage_Dir**: The configured server-side directory where all uploaded video files are stored.
- **Safe_Path**: A file path constructed exclusively from a UUID and a whitelisted extension, never from user-supplied filename input.
- **CORS_Origins**: The set of allowed browser origins for cross-origin requests, sourced from the `CORS_ORIGINS` environment variable.
- **Pretty_Printer**: The serialisation layer that converts Pydantic model instances to JSON using `model_config = ConfigDict(from_attributes=True)`.

---

## Requirements

### Requirement 1: Boxer Registration

**User Story:** As a coach or gym administrator, I want to register a new boxer with their personal details, so that I can build a permanent athlete record that persists across all sessions and analysis runs.

#### Acceptance Criteria

1. WHEN a registration request is received containing all required fields (`full_name`, `date_of_birth`, `stance`, `experience_level`, and `weight_class`), THE Boxer_Service SHALL create a new boxer record and assign a unique Permanent_ID in the format `BX-XXXXXX`.
2. THE Boxer_Service SHALL generate Permanent_IDs sequentially, zero-padded to six digits, within a database-level transaction that prevents duplicate assignment under concurrent requests.
3. WHEN a registration request matches an existing non-archived boxer by case-insensitive full name and date of birth, THE Backend SHALL return a `409 Conflict` response containing the `existing_boxer_id`.
4. WHEN a `409 Conflict` is returned for a duplicate registration, THE Frontend SHALL display a warning message with a navigable link to the existing boxer profile.
5. IF a registration request is received where `full_name` is fewer than 2 or more than 150 characters, THEN THE Backend SHALL reject the request with a `422 Unprocessable Entity` response indicating the invalid field.
6. IF a registration request is received where `stance` is not one of `orthodox`, `southpaw`, or `switch`, THEN THE Backend SHALL reject the request with a `422 Unprocessable Entity` response indicating the invalid field.
7. IF a registration request is received where `experience_level` is not one of `amateur`, `semi-pro`, or `professional`, THEN THE Backend SHALL reject the request with a `422 Unprocessable Entity` response indicating the invalid field.
8. IF a registration request is received where `date_of_birth` is not a valid calendar date or results in an age outside the range of 10 to 80 years, THEN THE Backend SHALL reject the request with a `422 Unprocessable Entity` response indicating the invalid field.
9. WHEN a boxer is successfully registered, THE Backend SHALL return a `201 Created` response containing the boxer's `id` and `permanent_id`.
10. WHEN a boxer is successfully registered, THE Frontend SHALL redirect the user to the new athlete profile page.
11. WHEN an archive request is received for an existing non-archived boxer, THE Boxer_Service SHALL set the boxer's status to archived and return a success response; an archived boxer SHALL NOT be matched in duplicate detection checks.

---

### Requirement 2: Boxer Profile and Management

**User Story:** As a coach, I want to view and update a boxer's profile, so that I can keep athlete information accurate over time.

#### Acceptance Criteria

1. WHEN a valid boxer ID is requested, THE Backend SHALL return the full boxer record including `permanent_id`, `full_name`, `date_of_birth`, `weight_class`, `stance`, `experience_level`, `primary_coach`, `training_goals`, `notes`, `status`, `created_at`, and `updated_at`.
2. IF a boxer ID does not exist in the database, THEN THE Backend SHALL return `404 Not Found`.
3. WHEN an update request is received for an existing boxer, THE Boxer_Service SHALL apply changes to mutable fields only (`full_name`, `date_of_birth`, `weight_class`, `stance`, `experience_level`, `primary_coach`, `training_goals`, `notes`); `permanent_id` and `created_at` SHALL NOT be modified.
4. IF an update request contains invalid field values, THEN THE Backend SHALL return `422 Unprocessable Entity` and the boxer record SHALL remain unchanged.
5. WHEN an archive request is received for an existing boxer, THE Boxer_Service SHALL set the boxer's `status` to `archived` without deleting the record or its associated data.
6. IF an archive request is received for a boxer ID that does not exist, THEN THE Backend SHALL return `404 Not Found`.
7. THE Frontend SHALL display the boxer's Permanent_ID on the athlete profile page.
8. THE Backend SHALL support paginated, searchable listing of boxers via `GET /api/v1/boxers` with `page` (default 1) and `page_size` (1–100, default 20) query parameters; the `search` query parameter SHALL filter by `full_name` and `permanent_id` (case-insensitive substring match).
9. IF `page` or `page_size` are outside their valid ranges, THEN THE Backend SHALL return `422 Unprocessable Entity`.

---

### Requirement 3: Fight Camp Management

**User Story:** As a coach, I want to create and manage fight camps for a boxer, so that I can organise training blocks around upcoming bouts and track objectives within each camp.

#### Acceptance Criteria

1. WHEN a fight camp creation request is received with a valid `boxer_id`, `name`, and `start_date`, THE Backend SHALL create a new Fight_Camp record linked to that boxer and return a `201 Created` response; IF `end_date` is provided and is earlier than `start_date`, THE Backend SHALL return `422 Unprocessable Entity`.
2. IF a fight camp creation request references a `boxer_id` that does not exist, THEN THE Backend SHALL return `404 Not Found`.
3. THE Backend SHALL enforce that a Training_Session can only be linked to a Fight_Camp belonging to the same boxer; linking a session to a camp of a different boxer SHALL be rejected with a `422` error.
4. WHEN a fight camp update request is received for an existing camp, THE Backend SHALL apply changes to mutable fields (`name`, `target_fight_date`, `start_date`, `end_date`, `status`, `objectives`, `coach_notes`) and return the updated record; IF `end_date` is updated to be earlier than `start_date`, THE Backend SHALL return `422 Unprocessable Entity`.
5. IF a fight camp update request references a camp ID that does not exist, THEN THE Backend SHALL return `404 Not Found`.
6. THE Backend SHALL return all fight camps for a given boxer via `GET /api/v1/boxers/{id}/fight-camps`, ordered by `start_date` descending; IF the boxer does not exist, THE Backend SHALL return `404 Not Found`.

---

### Requirement 4: Video Upload

**User Story:** As a coach, I want to upload boxing session footage, so that the system can analyse it and store it alongside the athlete's record.

#### Acceptance Criteria

1. WHEN a video upload request is received, THE Video_Service SHALL validate that the file extension is one of `.mp4`, `.mov`, `.avi`, or `.mkv` and that the MIME type is consistent with the declared extension.
2. IF a video file's extension or MIME type is invalid, THEN THE Backend SHALL return a `422 Unprocessable Entity` response with `code: VIDEO_INVALID_TYPE` and the list of accepted types.
3. WHEN a video file passes validation, THE Video_Service SHALL generate a UUID-based `storage_filename`, write the file to the `Storage_Dir`, and insert a video record with `status=uploaded`.
4. THE Video_Service SHALL enforce a configurable maximum file size between 1 MB and 10 GB (default 2 GB); IF the upload exceeds this limit, THEN THE Backend SHALL return `413 Request Entity Too Large` with `code: VIDEO_FILE_TOO_LARGE` before writing any data to disk.
5. WHEN a video is successfully uploaded, THE Backend SHALL return a `201 Created` response with `video_id`, `session_id`, `status`, `original_filename_safe`, `file_size_bytes`, and `uploaded_at`.
6. WHILE an upload is in progress, THE Frontend SHALL display upload progress as a percentage using `XMLHttpRequest` progress events.
7. WHEN a user selects a file for upload, THE Frontend SHALL validate the file extension client-side; IF the extension is not in the accepted list, THE Frontend SHALL display an inline error and SHALL NOT initiate the upload request.
8. WHILE an upload is in progress, THE Frontend SHALL disable the submit button.
9. WHEN a video is deleted via `DELETE /api/v1/videos/{id}`, THE Video_Service SHALL remove both the database record and the file from `Storage_Dir`.
10. IF a storage write fails during upload, THEN THE Video_Service SHALL delete any partially written file, roll back the video database record, and THE Backend SHALL return `500 Internal Server Error` with `code: VIDEO_STORAGE_FAILURE`.
11. IF the video file is absent from disk at deletion time, THEN THE Video_Service SHALL still remove the database record and return a success response.

---

### Requirement 5: Safe Video File Storage

**User Story:** As a system operator, I want all uploaded video files to be stored using server-generated filenames, so that user-supplied filenames cannot cause path traversal or injection vulnerabilities.

#### Acceptance Criteria

1. THE Video_Service SHALL construct every stored file path from a `uuid4()` value and a whitelisted extension only; user-supplied filenames SHALL NOT appear in any filesystem path.
2. THE Video_Service SHALL verify that the `parent` of the constructed Safe_Path equals `Storage_Dir`, ensuring no subdirectory traversal.
3. THE System SHALL preserve the original filename in a `original_filename_safe` field in the database for display purposes only, never for file system operations.
4. THE Backend SHALL use parameterised SQLAlchemy ORM queries for all database operations; raw SQL string interpolation is not permitted.

---

### Requirement 6: Video Analysis Pipeline

**User Story:** As a coach, I want to trigger automated analysis of an uploaded video, so that I can obtain objective performance metrics without manual frame-by-frame review.

#### Acceptance Criteria

1. WHEN an analysis request is received for a video with `status=uploaded`, THE Analysis_Service SHALL create an Analysis_Job with `status=queued` and enqueue it for background processing.
2. IF an analysis request is received for a video that already has an Analysis_Job in `queued` or `processing` state, THEN THE Analysis_Service SHALL return `409 Conflict` with `code: ANALYSIS_JOB_IN_PROGRESS`.
3. WHEN the Analysis_Pipeline begins processing a job, THE Analysis_Pipeline SHALL update the job to `status=processing` and record `started_at` before reading the video file.
4. WHEN a job reaches `completed`, `failed`, or `cancelled`, THE Analysis_Pipeline SHALL set `completed_at` to the current timestamp; a job in a terminal state SHALL NOT transition to any other state.
5. WHEN the video file cannot be opened by OpenCV, THE Analysis_Pipeline SHALL set the job to `status=failed` with `error_message`: "Video file could not be opened. The file may be corrupt or in an unsupported codec."
6. THE Analysis_Pipeline SHALL extract video metadata including `duration_seconds`, `width_px`, `height_px`, `fps`, and `total_frames` using FFmpeg if available.
7. IF FFmpeg is not available, THEN THE Analysis_Pipeline SHALL fall back to OpenCV for metadata extraction and SHALL log a `WARNING` level notice; THE Backend health endpoint SHALL reflect `ffmpeg_available: false`.
8. THE Analysis_Pipeline SHALL sample frames at a configurable interval between 0.1 and 10.0 seconds (default 0.5 seconds) up to a configurable maximum between 1 and 2000 frames (default 500 frames).
9. WHILE MediaPipe Pose Landmarker is available and a job is processing, THE Analysis_Pipeline SHALL run pose estimation on each sampled frame and record each frame as pose-detected when at least 1 landmark is returned with confidence ≥ 0.5.
10. IF MediaPipe is not installed or the model file is missing, THEN THE Analysis_Pipeline SHALL complete the job with `pose_available: false` and SHALL omit pose-dependent metrics from results.
11. WHEN analysis completes successfully, THE Analysis_Pipeline SHALL insert an Analysis_Result record and all computed Metric records, then set the job to `status=completed`.
12. IF an unhandled exception occurs during analysis, THEN THE Analysis_Pipeline SHALL roll back the current transaction, set the job to `status=failed` with `error_message` containing the exception class name and a human-readable description not including a raw stack trace, and set `completed_at`.

---

### Requirement 7: Metric Honesty

**User Story:** As a boxer or coach, I want all displayed metrics to reflect only what was actually computed or entered, so that I can trust the data and make informed training decisions.

#### Acceptance Criteria

1. THE Analysis_Pipeline SHALL only insert Metric records for values that were directly computed from video data or explicitly entered by a coach; fabricated or estimated values SHALL NOT be stored.
2. THE System SHALL label each Metric with `source` set to either `automated` or `coach_entered`, and a non-empty `calculation_method` describing how the value was derived.
3. WHEN a metric cannot be computed due to missing prerequisites (e.g., MediaPipe unavailable), THE Frontend SHALL display the metric as "Unavailable" with an explanatory label rather than omitting it silently.
4. THE Frontend SHALL display a banner notification when `pose_available` is `false`, informing the user that pose analysis is unavailable and that installing MediaPipe will enable advanced metrics.

---

### Requirement 8: Analysis Job Status Polling

**User Story:** As a coach, I want to see real-time progress of an analysis job, so that I know when results are ready without having to manually refresh.

#### Acceptance Criteria

1. WHEN an analysis job is enqueued, THE Frontend SHALL begin polling `GET /api/v1/analysis-jobs/{id}` at a configurable interval between 1 and 30 seconds (default 2 seconds).
2. WHEN the polling response returns `status=completed`, THE Frontend SHALL fetch the full Analysis_Result from `GET /api/v1/analysis-results/{result_id}` and display the results dashboard.
3. WHEN the polling response returns `status=failed` or `status=cancelled`, THE Frontend SHALL stop polling and display an error card with the job's `error_message`.
4. WHILE polling is in progress, THE Frontend SHALL display skeleton loaders in the same layout region as the expected analysis result content.
5. WHEN the component is unmounted, THE Frontend SHALL cancel the polling loop to prevent memory leaks.
6. IF the polling request fails with a network error, THE Frontend SHALL retry up to 3 times before stopping and displaying a connectivity error.
7. IF polling reaches 60 attempts without a terminal status, THE Frontend SHALL stop polling and display a timeout message with a manual refresh option.

---

### Requirement 9: Coach Observations

**User Story:** As a coach, I want to add timestamped observations to a video, so that I can annotate specific moments with technique feedback and recommended drills.

#### Acceptance Criteria

1. WHEN an observation creation request is received, THE Backend SHALL validate that `timestamp_seconds` is greater than or equal to 0, `description` is between 5 and 1000 characters, and `category` is one of the defined observation categories; IF any field is invalid, THE Backend SHALL return `400 Bad Request` with a field-level error message.
2. THE Backend SHALL accept observations with `category` values from the set: `guard_position`, `stance_and_balance`, `footwork`, `punch_execution`, `return_to_guard`, `defensive_movement`, `timing_and_distance`, `conditioning_related`, `other`.
3. THE Backend SHALL accept observations with `severity` values from the set: `low`, `medium`, `high`, defaulting to `medium` if not specified.
4. THE Backend SHALL accept observations with `review_status` values from the set: `pending`, `reviewed`, `resolved`, defaulting to `pending` if not specified; `coach_notes` and `recommended_drill` are optional and default to `null`.
5. WHEN an observation is created or updated, THE Backend SHALL return the full observation record including `id`, `video_id`, `boxer_id`, `session_id`, `timestamp_seconds`, `category`, `description`, `severity`, `coach_notes`, `recommended_drill`, `review_status`, `created_at`, and `updated_at`.
6. THE Frontend SHALL list all observations for a video via the `ObservationTimeline` component, sorted by `timestamp_seconds` ascending; IF no observations exist, THE Frontend SHALL display an empty state message.
7. WHEN a user clicks an observation in the timeline, THE Frontend SHALL seek the associated video player to that observation's `timestamp_seconds`; IF `timestamp_seconds` exceeds the video duration, THE Frontend SHALL seek to the end of the video.

---

### Requirement 10: Progress Tracking

**User Story:** As a coach or boxer, I want to view metric trends across multiple training sessions, so that I can measure improvement over time.

#### Acceptance Criteria

1. THE Backend SHALL expose `GET /api/v1/boxers/{id}/progress` returning a time-series of metric values grouped by `metric_key`, each data point including `session_date`, `value`, `session_type`, and `source_note`; IF no metrics exist for the boxer, THE Backend SHALL return an empty `data` array.
2. THE Backend SHALL accept optional `start_date` and `end_date` query parameters to filter the progress time-series; IF provided, only data points within the inclusive date range SHALL be returned.
3. THE Frontend SHALL render metric trends using the `ProgressChart` component (Recharts line chart), with one series per metric key.
4. WHEN metrics from sessions of mixed session types (e.g., sparring and shadowboxing) or mixed metric sources (automated and coach_entered) are displayed together, THE Frontend SHALL render `comparabilityWarnings` beneath the chart explaining the potential incompatibility.
5. THE Backend SHALL expose `GET /api/v1/boxers/{id}/sessions` returning a paginated session history for a boxer, ordered by `session_date` descending, with `page_size` defaulting to 20 and a maximum of 100.

---

### Requirement 11: PDF Report Generation

**User Story:** As a coach, I want to generate a downloadable PDF report for a boxer covering selected sessions, so that I can share professional performance summaries with athletes and management.

#### Acceptance Criteria

1. WHEN a report generation request is received, THE Report_Service SHALL verify that the specified `boxer_id` exists and that all `session_ids` in the request belong to that boxer.
2. WHEN a report is requested and all specified sessions have zero observations and zero Analysis_Results with `status = "completed"`, THE Backend SHALL return `422 Unprocessable Entity` with `code: REPORT_INSUFFICIENT_DATA`.
3. WHEN the request is valid, THE Report_Service SHALL compile boxer details, session data, metrics, and observations from the database and generate a PDF document containing only that data.
4. WHEN the PDF is successfully generated, THE Report_Service SHALL persist the PDF file and insert a Report record linking the file to the `boxer_id` and `session_ids`.
5. IF PDF file persistence or Report record insertion fails, THEN THE Report_Service SHALL delete any partially written file, roll back the Report record, and THE Backend SHALL return `500 Internal Server Error` with `code: REPORT_GENERATION_FAILED`.
6. THE Report_Service SHALL only include data present in the database in the generated PDF; no section SHALL be populated with synthetic or inferred data.
7. WHEN a report is successfully generated, THE Backend SHALL return `{ report_id, filename }`.
8. WHEN a download is requested via `GET /api/v1/reports/{id}/download`, THE Backend SHALL stream the PDF file with `Content-Disposition: attachment`.
9. IF a download is requested for a `report_id` whose associated file is not found on disk, THEN THE Backend SHALL return `404 Not Found` with `code: REPORT_FILE_NOT_FOUND`.
10. THE Frontend SHALL disable the "Generate Report" button when no sessions with at least one observation or one Analysis_Result with `status = "completed"` are selected, displaying a tooltip indicating that at least one session with recorded data must be selected.
11. WHEN `GET /api/v1/boxers/{id}/reports` is requested, THE Backend SHALL return a list of all Report records associated with that `boxer_id`; IF no reports exist, THE Backend SHALL return an empty list.

---

### Requirement 12: API Structure and Response Envelopes

**User Story:** As a frontend developer, I want consistent API response shapes across all endpoints, so that I can handle success and error cases uniformly in the client.

#### Acceptance Criteria

1. THE Backend SHALL wrap all successful single-item responses in a `{ "data": { ... }, "meta": null }` envelope.
2. THE Backend SHALL wrap all successful paginated list responses in a `{ "data": [...], "meta": { "page", "page_size", "total", "total_pages" } }` envelope.
3. THE Backend SHALL wrap all error responses in a `{ "error": { "code", "message", "details" } }` envelope; stack traces SHALL NOT appear in production error responses.
4. IF an unhandled server error occurs in production, THE Backend SHALL return a `500 Internal Server Error` with `code: INTERNAL_ERROR` and `message: "An unexpected error occurred"`, without including a stack trace in the response body.
5. THE Backend SHALL expose a `GET /health` endpoint that returns system status including `ffmpeg_available`.
6. THE Backend SHALL scope all API routes under the `/api/v1/` prefix.

---

### Requirement 13: Frontend Architecture and UI

**User Story:** As a developer and end user, I want a responsive, accessible, dark-themed UI with consistent components, so that the platform is professional and easy to navigate.

#### Acceptance Criteria

1. THE Frontend SHALL implement a professional dark-themed UI with electric-blue accents using Tailwind CSS such that all primary background surfaces have a measured lightness (HSL L) of 20% or below and all interactive focus indicators meet WCAG 2.1 AA contrast ratio of at least 3:1.
2. THE Frontend SHALL display skeleton loaders for all data-fetching states before content is available.
3. THE Frontend SHALL present all API error messages inline within the relevant form or panel, not as page-level alerts.
4. THE Frontend SHALL use React Router for client-side navigation between pages (boxer directory, athlete profile, upload, analysis results, progress, reports).
5. THE Frontend SHALL expose typed API helper functions via an Axios client in `src/api/` that match the backend Pydantic response schemas.

---

### Requirement 14: Pydantic Schema Serialisation

**User Story:** As a backend developer, I want all API request and response schemas to be defined as Pydantic models, so that data validation and serialisation are consistent and type-safe.

#### Acceptance Criteria

1. THE Backend SHALL define all request bodies and response shapes as Pydantic v2 `BaseModel` subclasses.
2. THE Pretty_Printer SHALL serialise all Pydantic model instances to JSON using `model_config = ConfigDict(from_attributes=True)` when mapping from SQLAlchemy ORM objects.
3. FOR ALL valid Pydantic model instances, serialising then deserialising SHALL produce an equivalent object (round-trip property).
4. THE Backend SHALL reject requests where required fields are missing or where field values violate declared constraints (type, length, literal set), returning `422 Unprocessable Entity`.

---

### Requirement 15: Database Integrity

**User Story:** As a system operator, I want the database schema to enforce referential integrity and data constraints, so that corrupt or orphaned records cannot accumulate.

#### Acceptance Criteria

1. THE System SHALL enforce that every `Training_Session` record has a `boxer_id` that references an existing `BOXERS` record; deletion of a `BOXERS` record SHALL be restricted (RESTRICT) if any `Training_Session` records reference it.
2. THE System SHALL enforce that every `Video` record has a `boxer_id` that references an existing `BOXERS` record; deletion of a `BOXERS` record SHALL be restricted (RESTRICT) if any `Video` records reference it.
3. THE System SHALL enforce that at most one boxer record with `archived_at` equal to `null` exists for any given `(LOWER(TRIM(full_name)), date_of_birth)` pair.
4. WHEN the database is initialised via `init_db()`, THE System SHALL apply all schema migrations idempotently; running `init_db()` twice SHALL NOT result in duplicate tables or errors.
5. THE System SHALL use SQLite in WAL mode for local development to allow concurrent reads during analysis writes.

---

### Requirement 16: Security

**User Story:** As a security-conscious operator, I want the backend to enforce upload validation, safe path construction, and SQL injection prevention by default, so that the attack surface remains minimal.

#### Acceptance Criteria

1. THE Backend SHALL enforce CORS by allowing only origins listed in the `CORS_ORIGINS` environment variable; in development this defaults to `http://localhost:5173`.
2. THE Backend SHALL store `SECRET_KEY` and `DATABASE_URL` exclusively in environment variables; these values SHALL NOT appear in source code or committed configuration files.
3. THE Backend SHALL never use raw SQL string interpolation; all database queries SHALL use SQLAlchemy ORM parameterised bindings.
4. THE Backend SHALL validate both file extension and MIME type on every video upload, using the allowlist: extensions `.mp4`, `.mov`, `.avi`, `.mkv` mapped to MIME types `video/mp4`, `video/quicktime`, `video/x-msvideo`, `video/x-matroska` respectively; IF MIME type and extension are inconsistent, THE Backend SHALL return `415 Unsupported Media Type`.
5. THE Backend SHALL enforce the configured maximum file size before writing any bytes of the upload to disk.

---

### Requirement 17: Deployment Configuration

**User Story:** As a developer, I want the project to have a clear deployment path for both frontend and backend, so that it can be promoted from local development to production without architectural changes.

#### Acceptance Criteria

1. THE Frontend SHALL be configurable via a `.env.example` file with the backend API base URL, enabling deployment to Vercel by setting the environment variable.
2. THE Backend SHALL be configurable via a `.env.example` file with `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS`, `STORAGE_DIR`, and `REPORTS_DIR`.
3. THE Backend SHALL include a `Dockerfile` and a `render.yaml` for deployment to Render.
4. IF the `DATABASE_URL` environment variable begins with `postgresql://` or `postgresql+asyncpg://`, THEN THE Backend SHALL connect using PostgreSQL.
5. IF the `DATABASE_URL` environment variable begins with `sqlite:///`, THEN THE Backend SHALL connect using SQLite.
6. THE Backend SHALL use Alembic for schema migrations to support upgrading the production database without data loss.
7. THE Backend's Alembic migration scripts SHALL NOT include any `DROP TABLE`, `DROP COLUMN`, or `TRUNCATE` operations on tables that contain production data; all schema changes SHALL be additive or performed via safe rename-and-copy patterns.
