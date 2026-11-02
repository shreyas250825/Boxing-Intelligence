# Bugfix Requirements Document

## Introduction

The application crashes on startup when deployed to a Docker container on Render. The error is a `sqlite3.OperationalError: unable to open database file`, raised during `init_db()` → `Base.metadata.create_all()` at uvicorn startup.

The root cause is a path-parsing bug in `_ensure_sqlite_dir()` in `database.py`. When `urlparse` parses a SQLite URL with the `///./` prefix (e.g. `sqlite:///./data/valen_boxing.db`), it returns a `path` of `/./data/valen_boxing.db` — a string that starts with `/`, so `Path(...).is_absolute()` returns `True`. The relative-path resolution branch is never taken, and the code attempts to create `/./data/` inside the container, which either fails silently or is not writable. The actual data directory is therefore never created, and SQLite cannot open the file.

A secondary concern is that Render's filesystem is ephemeral: even with the directory bug fixed, data written to the local SQLite file is lost on each redeploy. Setting `DATABASE_URL` to a PostgreSQL connection string is the recommended production approach and already supported by the codebase; this must be documented clearly.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the application starts in a Docker container with the default `DATABASE_URL` of `sqlite:///./data/valen_boxing.db` THEN `_ensure_sqlite_dir()` parses the URL path as `/./data/valen_boxing.db`, treats it as an absolute path, and attempts to create `/./data/` — a directory that does not exist and is not writable in the container, so the data directory is never created.

1.2 WHEN the data directory does not exist at engine initialisation time THEN `Base.metadata.create_all(bind=engine)` raises `sqlite3.OperationalError: unable to open database file`, crashing the uvicorn process on startup.

1.3 WHEN `DATABASE_URL` is left at its default relative SQLite value on Render THEN no documentation or startup warning guides the operator toward setting a PostgreSQL `DATABASE_URL`, so the misconfiguration is not surfaced until the crash occurs.

---

### Expected Behavior (Correct)

2.1 WHEN the application starts in a Docker container with a relative SQLite `DATABASE_URL` (of the form `sqlite:///./…`) THEN `_ensure_sqlite_dir()` SHALL correctly resolve the relative path against the working directory, identify the true parent directory (`/app/data` or equivalent), and create it with `mkdir(parents=True, exist_ok=True)` before the engine is initialised.

2.2 WHEN the data directory is successfully created before engine initialisation THEN `Base.metadata.create_all(bind=engine)` SHALL complete without error and the application SHALL start normally.

2.3 WHEN `DATABASE_URL` is set to a PostgreSQL connection string in Render's environment variables THEN `_ensure_sqlite_dir()` SHALL be skipped entirely and the application SHALL connect to PostgreSQL without attempting any local directory creation.

2.4 WHEN the README or deployment documentation is consulted THEN it SHALL clearly state that `DATABASE_URL` must be set to a PostgreSQL connection string for production deployments on Render, and that the default SQLite path is suitable for local development only.

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the application starts locally with the default relative SQLite `DATABASE_URL` THEN the system SHALL CONTINUE TO create the `./data/` directory relative to the working directory and start successfully, as it did before the container deployment.

3.2 WHEN the application starts with an in-memory SQLite URL (`sqlite:///:memory:`) THEN the system SHALL CONTINUE TO skip directory creation and initialise the database in memory.

3.3 WHEN the application starts with an absolute SQLite path (e.g. `sqlite:////tmp/test.db`) THEN the system SHALL CONTINUE TO create the specified absolute directory and start successfully.

3.4 WHEN the application starts with a PostgreSQL `DATABASE_URL` THEN the system SHALL CONTINUE TO connect to PostgreSQL without any SQLite-specific logic being executed.

3.5 WHEN the application performs all existing database operations (create, read, update, delete) against SQLite in a local environment THEN the system SHALL CONTINUE TO behave identically to its behaviour before this fix.
