# SQLite Path Resolution Crash Fix — Bugfix Design

## Overview

On startup inside a Docker container on Render, the application raises
`sqlite3.OperationalError: unable to open database file` before any request is
served. The crash happens because `_ensure_sqlite_dir()` in
`valen-boxing-intelligence/backend/app/core/database.py` never creates the
parent directory for the SQLite file.

`urlparse("sqlite:///./data/valen_boxing.db").path` returns
`"/./data/valen_boxing.db"`. The leading `/` makes `Path.is_absolute()` return
`True`, so the relative-path resolution branch is silently skipped and
`mkdir()` is called on `/./data/` — a path that either cannot be created or
lands in the wrong place inside the container. SQLite therefore cannot open the
file and the process exits.

The fix is a single-function change: strip the leading `/` produced by
`urlparse` and re-derive whether the original URL was relative (contained
`///./` or `////./`) before deciding whether to join with `Path.cwd()`. No
other production behaviour changes.

Two supporting artefacts are also reviewed:

- **Dockerfile** — already pre-creates `/app/data/videos` and
  `/app/data/reports`, which is correct. A `RUN mkdir -p /app/data` line
  should also be confirmed as sufficient for SQLite; it is.
- **Readme.md** — currently contains only local run commands. A production
  deployment section is needed so operators know to set `DATABASE_URL` to a
  PostgreSQL connection string when deploying to Render.

---

## Glossary

- **Bug_Condition (C)**: The condition that triggers the crash — a SQLite
  `DATABASE_URL` that uses a relative path prefix (`sqlite:///./…`) is used as
  the engine URL, causing `_ensure_sqlite_dir()` to skip directory creation.
- **Property (P)**: The desired outcome when the bug condition holds — the data
  directory is created and the application starts without error.
- **Preservation**: All SQLite URL variants (absolute, in-memory) and
  PostgreSQL URLs that already worked correctly must continue to work after
  the fix.
- **`_ensure_sqlite_dir(url)`**: The function in
  `valen-boxing-intelligence/backend/app/core/database.py` responsible for
  creating the parent directory of a SQLite database file before the engine
  connects to it.
- **`urlparse` path artefact**: `urlparse` collapses the `///./` authority
  separator and relative segment into a single string starting with `/`,
  making the result look like an absolute path even when the original URL
  referenced a relative file.

---

## Bug Details

### Bug Condition

The bug manifests when `_ensure_sqlite_dir()` receives a SQLite URL whose
file path is expressed relative to the working directory (e.g.
`sqlite:///./data/valen_boxing.db`). `urlparse` returns a `path` component
that starts with `/`, so the absolute-path guard evaluates to `True` and
`mkdir()` is called on the wrong location.

**Formal Specification:**

```
FUNCTION isBugCondition(url)
  INPUT:  url of type str
  OUTPUT: boolean

  parsed  := urlparse(url)
  raw_path := parsed.path          -- e.g. "/./data/valen_boxing.db"

  RETURN parsed.scheme = "sqlite"
         AND raw_path NOT IN ("", ":memory:")
         AND raw_path starts with "/."   -- relative segment after urlparse artefact
         AND Path(raw_path).is_absolute() = TRUE  -- is_absolute() incorrectly returns True
END FUNCTION
```

### Examples

| URL | `urlparse().path` | `is_absolute()` | Directory created? |
|---|---|---|---|
| `sqlite:///./data/valen_boxing.db` | `/./data/valen_boxing.db` | **True** (bug) | ❌ wrong path |
| `sqlite:////tmp/test.db` | `/tmp/test.db` | True (correct) | ✅ `/tmp/` |
| `sqlite:///./data/valen_boxing.db` after fix | `/./data/valen_boxing.db` | — | ✅ `<cwd>/data/` |
| `sqlite:///:memory:` | `:memory:` | — skipped | ✅ no-op |
| `postgresql://…` | — skipped | — | ✅ no-op |

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**

- Local development with the default `sqlite:///./data/valen_boxing.db` URL
  must continue to create `./data/` relative to the working directory and
  start successfully (Requirement 3.1).
- An in-memory SQLite URL (`sqlite:///:memory:`) must continue to skip
  directory creation entirely (Requirement 3.2).
- An absolute SQLite path (e.g. `sqlite:////tmp/test.db`) must continue to
  create the specified absolute directory (Requirement 3.3).
- A PostgreSQL `DATABASE_URL` must continue to bypass all SQLite-specific
  logic (Requirement 3.4).
- All existing CRUD operations in a local SQLite environment must continue to
  behave identically (Requirement 3.5).

**Scope:**

Any URL that does NOT satisfy `isBugCondition` (i.e. all non-relative-SQLite
URLs and URLs that were already working) must be completely unaffected by this
fix.

---

## Hypothesized Root Cause

1. **`urlparse` path artefact**: `urlparse("sqlite:///./data/valen_boxing.db")`
   interprets the third `/` as the start of the path component and returns
   `/./data/valen_boxing.db`. Python's `Path("/./data/…").is_absolute()`
   returns `True` because the string starts with `/`, even though the original
   intent was a path relative to the working directory.

2. **No path normalisation before the `is_absolute()` check**: The code passes
   the raw `urlparse` output directly to `Path()` without stripping the leading
   `/` or consulting the original URL string to determine intent.

3. **`mkdir()` called on wrong target**: When the absolute branch is taken with
   the artefact path `/./data/`, the OS either refuses to create it (permission
   denied) or creates it at the container root rather than under `/app`,
   leaving the actual working-directory location uncreated.

4. **Silent failure path**: `_ensure_sqlite_dir` does not raise when the
   directory creation lands in the wrong place; the crash only surfaces later
   when SQLAlchemy tries to open the file.

---

## Correctness Properties

Property 1: Bug Condition — Relative SQLite URL Creates the Correct Data Directory

_For any_ URL where `isBugCondition(url)` returns `True` (i.e. a SQLite URL
with a `///./` relative-path prefix), the fixed `_ensure_sqlite_dir` function
SHALL resolve the path against `Path.cwd()`, call `mkdir(parents=True,
exist_ok=True)` on the correct parent directory, and allow `create_engine` to
succeed without raising `sqlite3.OperationalError`.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation — Non-Relative-SQLite URLs Are Unaffected

_For any_ URL where `isBugCondition(url)` returns `False` (absolute SQLite
paths, in-memory SQLite, PostgreSQL, or any other scheme), the fixed
`_ensure_sqlite_dir` function SHALL produce exactly the same observable
side-effects as the original function, preserving all existing directory
creation and engine-initialisation behaviour.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

---

## Fix Implementation

### Changes Required

#### File: `valen-boxing-intelligence/backend/app/core/database.py`

**Function:** `_ensure_sqlite_dir`

**Specific Changes:**

1. **Detect relative-URL intent from the raw URL string** (not from the
   `urlparse` artefact): Check whether the original URL begins with
   `sqlite:///./` or `sqlite:////./` to determine if the path should be
   resolved relative to `Path.cwd()`.

2. **Strip the leading `/` from `urlparse().path`** before constructing a
   `Path` object, then apply the relative/absolute decision:
   - If the URL had a `///./` prefix → the true path is `Path.cwd() / stripped`
     (where `stripped` is the `urlparse` path with its leading `/` removed).
   - Otherwise → the true path is `Path(stripped)` (already absolute on disk).

3. **Keep the `:memory:` and empty-path guard** in place; the logic for those
   cases is correct and must not change.

4. **Remove the now-unnecessary `if not db_path.is_absolute()` branch** — the
   relative/absolute split is resolved in step 1 before a `Path` is
   constructed.

**Proposed implementation:**

```python
def _ensure_sqlite_dir(url: str) -> None:
    """Create the parent directory for a SQLite file before the engine opens it."""
    parsed = urlparse(url)
    if parsed.scheme != "sqlite":
        return
    raw_path = parsed.path  # e.g. "/./data/valen_boxing.db" or "/tmp/test.db"
    if raw_path in ("", ":memory:"):
        return

    # urlparse always prepends "/" to the path component for sqlite:// URLs.
    # Strip it to recover the original file path string.
    stripped = raw_path.lstrip("/")  # e.g. "./data/valen_boxing.db" or "tmp/test.db"

    # A relative URL (sqlite:///./...) becomes "./..." after stripping.
    # An absolute URL (sqlite:////tmp/...) becomes "tmp/..." — re-add the leading "/".
    if stripped.startswith("."):
        db_path = Path.cwd() / stripped
    else:
        db_path = Path("/" + stripped)

    db_path.parent.mkdir(parents=True, exist_ok=True)
```

#### File: `valen-boxing-intelligence/backend/Dockerfile`

**Assessment:** The Dockerfile already contains:

```dockerfile
RUN mkdir -p /app/data/videos /app/data/reports
```

This pre-creates `/app/data` (and its subdirectories) at image build time,
which means even if `_ensure_sqlite_dir` were still broken, the directory
would exist. This is a good defence-in-depth measure. **No change required.**

However, the `render.yaml` sets `STORAGE_DIR=/var/data/videos` and
`REPORTS_DIR=/var/data/reports`, which are outside `/app/data`. For a
production Render deployment with PostgreSQL this is fine (files land on the
persistent disk). For local-SQLite container testing the Dockerfile directories
are sufficient. **No Dockerfile change needed**, but the documentation change
below should clarify the distinction.

#### File: `Readme.md`

**Specific Changes:** Replace the current stub content with a proper README
that includes:

1. **Local development** section — the existing two commands, formatted as
   code blocks.
2. **Production deployment on Render** section explaining:
   - `DATABASE_URL` **must** be set to a PostgreSQL connection string; the
     default SQLite path is for local development only.
   - Where to set the env var in `render.yaml` / Render dashboard.
   - A note that Render's Docker filesystem is ephemeral, so SQLite data is
     lost on redeploy.
   - Reference to `STORAGE_DIR` and `REPORTS_DIR` for the persistent disk.
3. **Environment variables reference** table covering the key settings.

---

## Testing Strategy

### Validation Approach

Testing follows a two-phase approach: first run exploratory tests against the
**unfixed** code to surface the failure and confirm the root cause, then run
fix-checking and preservation tests against the **fixed** code.

---

### Exploratory Bug Condition Checking

**Goal:** Demonstrate the crash on unfixed code and confirm the `urlparse`
artefact is the sole root cause.

**Test Plan:** Call `_ensure_sqlite_dir` directly with a relative SQLite URL
and assert that:
(a) the path passed to `mkdir` is the correct cwd-relative path, and
(b) `create_engine` with the same URL succeeds (no `OperationalError`).

Run against the **unfixed** function to observe that the assertion fails.

**Test Cases:**

1. **Relative URL directory creation** — call
   `_ensure_sqlite_dir("sqlite:///./data/test.db")` and assert that
   `<cwd>/data/` exists afterwards. (Fails on unfixed code — wrong dir
   created or permission error.)
2. **Engine initialisation with relative URL** — create a SQLAlchemy engine
   with the relative URL inside a temp directory and assert no exception is
   raised. (Fails on unfixed code.)
3. **urlparse artefact inspection** — assert that
   `urlparse("sqlite:///./data/test.db").path` starts with `"/."`  and that
   `Path(urlparse("sqlite:///./data/test.db").path).is_absolute()` is `True`,
   confirming the artefact. (Documents the root cause.)
4. **Edge case — no trailing path** — call with `"sqlite:///./data/"` and
   verify behaviour.

**Expected Counterexamples:**

- `<cwd>/data/` does not exist after calling `_ensure_sqlite_dir` with the
  relative URL on unfixed code.
- `create_engine(…).connect()` raises `OperationalError` on unfixed code when
  the container working directory is not writable at `/./data/`.

---

### Fix Checking

**Goal:** Verify that for all inputs where `isBugCondition(url)` is `True`,
the fixed function creates the correct directory.

**Pseudocode:**

```
FOR ALL url WHERE isBugCondition(url) DO
  expected_dir := Path.cwd() / url_relative_segment(url).parent
  _ensure_sqlite_dir_fixed(url)
  ASSERT expected_dir.exists()
END FOR
```

---

### Preservation Checking

**Goal:** Verify that for all inputs where `isBugCondition(url)` is `False`,
the fixed function produces the same side-effects as the original.

**Pseudocode:**

```
FOR ALL url WHERE NOT isBugCondition(url) DO
  side_effects_original := capture(_ensure_sqlite_dir_original(url))
  side_effects_fixed    := capture(_ensure_sqlite_dir_fixed(url))
  ASSERT side_effects_original = side_effects_fixed
END FOR
```

**Testing Approach:** Property-based testing is well-suited here because
the input space (valid URL strings) is large and the correctness criterion
(side-effects are identical) is straightforward to assert programmatically.

**Test Cases:**

1. **Absolute SQLite path preservation** — `sqlite:////tmp/test.db` must still
   create `/tmp/`.
2. **In-memory SQLite preservation** — `sqlite:///:memory:` must still be a
   no-op.
3. **PostgreSQL URL preservation** — `postgresql://user:pass@host/db` must
   still be a no-op.
4. **Property-based: random relative paths** — generate random subdirectory
   names, construct `sqlite:///./…` URLs, and assert the cwd-relative
   directory is created by the fixed function.
5. **Property-based: random absolute paths** — generate random absolute-style
   URLs and assert the fixed function behaves identically to the original.

---

### Unit Tests

- Test `_ensure_sqlite_dir` with a relative SQLite URL in a temporary
  working directory and assert the correct subdirectory is created.
- Test with `sqlite:///:memory:` and assert no directory is created.
- Test with an absolute path URL and assert the absolute directory is created.
- Test with a PostgreSQL URL and assert no directory is created.
- Test the `urlparse` artefact directly (documents the root cause in code).

### Property-Based Tests

- Generate random relative directory paths under a tmp root; assert the fixed
  function always creates them correctly.
- Generate random non-relative SQLite and non-SQLite URLs; assert the fixed
  function's side-effects match the original's for all of them (preservation
  property).

### Integration Tests

- Start the full application (via `TestClient` or a subprocess) with a
  relative SQLite `DATABASE_URL` pointing into a fresh temp directory and
  assert the `/health` endpoint returns 200.
- Start the full application with `sqlite:///:memory:` and assert successful
  startup.
- Verify all existing API tests continue to pass without modification after
  the fix.
