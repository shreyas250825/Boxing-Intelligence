# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Relative SQLite URL Skips Correct Directory Creation
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to the concrete failing case — any `sqlite:///./data/<name>.db` URL — to ensure reproducibility
  - In a temporary working directory, call `_ensure_sqlite_dir("sqlite:///./data/test.db")` and assert that `<cwd>/data/` was created (not `/./data/` nor any path outside cwd)
  - Also assert that `create_engine("sqlite:///./data/test.db").connect()` does NOT raise `sqlite3.OperationalError` when run from the temp directory
  - Additionally, document the `urlparse` artefact: assert `urlparse("sqlite:///./data/test.db").path` starts with `"/."` and that `Path(urlparse("sqlite:///./data/test.db").path).is_absolute()` is `True` (confirms root cause)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS — `<cwd>/data/` does not exist; the wrong path (`/./data/`) is targeted or a permission error is raised, confirming the `is_absolute()` artefact
  - Document the counterexample found (e.g., `_ensure_sqlite_dir("sqlite:///./data/test.db")` leaves `<cwd>/data/` uncreated)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 2.1_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Relative-SQLite URLs Are Unaffected
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code: `_ensure_sqlite_dir("sqlite:///:memory:")` is a no-op (no directory created)
  - Observe on UNFIXED code: `_ensure_sqlite_dir("sqlite:////tmp/test.db")` creates `/tmp/` (absolute path, correct)
  - Observe on UNFIXED code: `_ensure_sqlite_dir("postgresql://user:pass@host/db")` is a no-op
  - Write property-based tests asserting these observations hold for the full input class:
    - For all `sqlite:///:memory:` and empty-path URLs: no directory is created
    - For all absolute SQLite URLs of form `sqlite:////abs/path/file.db`: the absolute parent directory is created correctly
    - For all non-sqlite scheme URLs: `_ensure_sqlite_dir` is a no-op
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS — confirms baseline behavior to preserve
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Fix `_ensure_sqlite_dir` for relative SQLite paths

  - [~] 3.1 Implement the fix in `valen-boxing-intelligence/backend/app/core/database.py`
    - Strip the leading `/` from `urlparse(url).path` using `.lstrip("/")`
    - Use `stripped.startswith(".")` to detect a relative-path URL (the `///./` artefact) instead of `Path.is_absolute()`
    - If relative: resolve as `Path.cwd() / stripped`
    - If not relative (and non-empty, non-`:memory:`): restore the leading `/` and resolve as `Path("/" + stripped)`
    - Remove the now-redundant `if not db_path.is_absolute()` branch
    - Keep the existing `:memory:` and empty-path early-return guard unchanged
    - _Bug_Condition: `isBugCondition(url)` where `urlparse(url).scheme == "sqlite"` AND `urlparse(url).path` starts with `"/."`  AND `Path(urlparse(url).path).is_absolute() == True`_
    - _Expected_Behavior: `_ensure_sqlite_dir(url)` resolves path against `Path.cwd()`, calls `mkdir(parents=True, exist_ok=True)` on correct parent, and `create_engine(url)` succeeds without `OperationalError`_
    - _Preservation: all non-relative-SQLite URLs (in-memory, absolute, PostgreSQL) produce identical side-effects as before_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

  - [~] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Relative SQLite URL Creates Correct Data Directory
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the relative-path resolution is correct
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES — `<cwd>/data/` exists and `create_engine` does not raise
    - _Requirements: 2.1, 2.2_

  - [~] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Relative-SQLite URLs Are Unaffected
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS — in-memory, absolute, and PostgreSQL URLs all behave identically to before
    - Confirm no regressions across all URL variants

- [~] 4. Write full unit test suite for `_ensure_sqlite_dir`
  - Cover all four URL variants as standalone unit tests (complement to the PBT tasks above):
    1. Relative SQLite URL (`sqlite:///./data/valen_boxing.db`) in a temp directory → correct subdirectory is created under cwd
    2. In-memory SQLite (`sqlite:///:memory:`) → no directory is created, no exception raised
    3. Absolute SQLite path (`sqlite:////tmp/test_valen.db`) → absolute parent directory is created
    4. PostgreSQL URL (`postgresql://user:pass@host/db`) → no directory is created, no exception raised
  - Place tests in `valen-boxing-intelligence/backend/tests/test_database.py` (create file if it does not exist)
  - Use `tmp_path` pytest fixture and `monkeypatch` / `os.chdir` to isolate working directory per test
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

- [~] 5. Update `Readme.md` with production deployment section
  - Add a **Production Deployment on Render** section after the existing local development instructions
  - Explain that `DATABASE_URL` **must** be set to a PostgreSQL connection string; the default `sqlite:///./data/valen_boxing.db` is for local development only and data is lost on redeploy in Docker
  - Show where to set the env var (Render dashboard → Environment → `DATABASE_URL`)
  - Note that Render's Docker filesystem is ephemeral — SQLite data will be wiped on each redeploy
  - Reference `STORAGE_DIR` and `REPORTS_DIR` and explain they should point to a persistent disk path (e.g. `/var/data/videos`)
  - Add an **Environment Variables Reference** table covering: `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS`, `STORAGE_DIR`, `REPORTS_DIR`, `OPENAI_API_KEY`, `AI_MODEL`
  - _Requirements: 4.1_

- [~] 6. Checkpoint — Ensure all tests pass
  - Run the full test suite: `pytest valen-boxing-intelligence/backend/tests/ -v`
  - Confirm bug condition exploration test (Property 1) passes after the fix
  - Confirm preservation tests (Property 2) pass with no regressions
  - Confirm all four unit tests in `test_database.py` pass
  - Ensure no existing tests were broken by the change
  - Ask the user if any questions or ambiguities arise
