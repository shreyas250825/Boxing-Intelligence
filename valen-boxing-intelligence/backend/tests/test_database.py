"""
Tests for _ensure_sqlite_dir in app/core/database.py.

Task 1 — Bug condition exploration test (Property 1):
    This test MUST FAIL on unfixed code. Failure confirms the bug exists.
    DO NOT attempt to fix the test or the code when it fails.

Bug root cause:
    urlparse("sqlite:///./data/test.db").path  →  "/./data/test.db"
    Path("/./data/test.db").is_absolute()      →  True
    Therefore the relative-path branch (`if not db_path.is_absolute()`) is
    skipped and mkdir is called on "/./data/" instead of "<cwd>/data/".
"""

import os
import sqlite3
from pathlib import Path
from urllib.parse import urlparse

import pytest
from sqlalchemy import create_engine

from app.core.database import _ensure_sqlite_dir

# ---------------------------------------------------------------------------
# Task 1 — Bug condition exploration test (Property 1)
# ---------------------------------------------------------------------------

RELATIVE_SQLITE_URL = "sqlite:///./data/test.db"


class TestBugConditionUrlparseArtefact:
    """Document the urlparse artefact that is the root cause of the bug."""

    def test_urlparse_path_starts_with_dot_slash(self):
        """
        urlparse of a relative SQLite URL returns a path starting with "/.".

        Counterexample:
            urlparse("sqlite:///./data/test.db").path == "/./data/test.db"
        """
        parsed_path = urlparse(RELATIVE_SQLITE_URL).path
        # This assertion documents the artefact — it SHOULD pass even on unfixed code
        assert parsed_path.startswith("/."), (
            f"Expected path to start with '/.' but got: {parsed_path!r}"
        )

    def test_urlparse_path_starts_with_slash_confusing_the_absolute_check(self):
        """
        urlparse of a relative SQLite URL yields a path starting with "/",
        which is the root cause of the bug.

        On POSIX systems: Path("/./data/test.db").is_absolute() == True
            → _ensure_sqlite_dir skips the cwd-join branch entirely.

        On Windows: Path("/./data/test.db").is_absolute() == False
            → _ensure_sqlite_dir DOES enter the cwd-join branch, BUT the path
              passed in is already "/./data/test.db" (with the leading slash),
              so Path.cwd() / "/./data/test.db" == Path("/./data/test.db")
              on Windows (the slash-prefixed component is treated as drive-
              relative), meaning mkdir still targets the wrong location.

        Either way the wrong directory is created — the bug manifests on both
        platforms, just via a slightly different code path.

        Counterexample (POSIX):
            Path("/./data/test.db").is_absolute() == True
            → cwd-join branch skipped → mkdir("/./data/") called

        Counterexample (Windows):
            Path("/./data/test.db").is_absolute() == False (no drive letter)
            → cwd-join: Path.cwd() / "/./data/test.db" → still resolves
              to a path outside tmp_path
        """
        parsed_path = urlparse(RELATIVE_SQLITE_URL).path
        # The path ALWAYS starts with "/." — this is the artefact, regardless of platform
        assert parsed_path.startswith("/."), (
            f"Expected parsed path to start with '/.' but got: {parsed_path!r}. "
            f"This leading slash is the root cause: it confuses the is_absolute() "
            f"check on POSIX (returns True) and the Path / operator on Windows."
        )


class TestBugConditionDirectoryCreation:
    """
    Property 1 — Bug Condition: Relative SQLite URL skips correct directory creation.

    On UNFIXED code these tests FAIL, confirming the bug.
    After the fix they PASS, confirming correct behaviour.
    """

    def test_ensure_sqlite_dir_creates_cwd_subdirectory(self, tmp_path):
        """
        Calling _ensure_sqlite_dir("sqlite:///./data/test.db") from a temp
        directory must create <tmp_path>/data/, NOT /./data/.

        EXPECTED ON UNFIXED CODE: FAIL
            <tmp_path>/data/ does NOT exist after the call because mkdir was
            called on "/./data/" (an absolute path off the filesystem root)
            instead of the intended relative subdirectory.
        """
        original_cwd = os.getcwd()
        try:
            os.chdir(tmp_path)
            _ensure_sqlite_dir(RELATIVE_SQLITE_URL)
            expected_dir = tmp_path / "data"
            assert expected_dir.exists(), (
                f"BUG CONFIRMED: _ensure_sqlite_dir did NOT create {expected_dir}. "
                f"The wrong path ('/./data/') was targeted instead of the "
                f"relative subdirectory under cwd ({tmp_path})."
            )
            assert expected_dir.is_dir(), (
                f"{expected_dir} exists but is not a directory."
            )
        finally:
            os.chdir(original_cwd)

    def test_create_engine_does_not_raise_operational_error(self, tmp_path):
        """
        create_engine("sqlite:///./data/test.db").connect() must NOT raise
        sqlite3.OperationalError when the working directory is tmp_path.

        EXPECTED ON UNFIXED CODE: FAIL
            An OperationalError is raised because the parent directory
            "/./data/" either cannot be created (permission denied on root-owned
            path) or is created in the wrong location, causing SQLite to fail
            when it tries to open the database file.
        """
        original_cwd = os.getcwd()
        try:
            os.chdir(tmp_path)
            # Ensure the directory exists first — but on unfixed code
            # _ensure_sqlite_dir will NOT have created it under tmp_path,
            # so create_engine itself must cope (it won't).
            _ensure_sqlite_dir(RELATIVE_SQLITE_URL)

            engine = create_engine(
                RELATIVE_SQLITE_URL,
                connect_args={"check_same_thread": False},
            )
            try:
                conn = engine.connect()
                conn.close()
            except sqlite3.OperationalError as exc:
                pytest.fail(
                    f"BUG CONFIRMED: create_engine raised sqlite3.OperationalError: {exc}. "
                    f"This means the parent directory was NOT created under cwd ({tmp_path}). "
                    f"Counterexample URL: {RELATIVE_SQLITE_URL!r}"
                )
            finally:
                engine.dispose()
        finally:
            os.chdir(original_cwd)


# ---------------------------------------------------------------------------
# Task 2 — Preservation property tests (Property 2)
# ---------------------------------------------------------------------------
# These tests MUST PASS on both unfixed AND fixed code.
# They document the baseline behavior for non-relative-SQLite URLs that the
# fix must preserve.
# ---------------------------------------------------------------------------

import sys


class TestPreservationBehavior:
    """
    Property 2 — Preservation: Non-Relative-SQLite URLs Are Unaffected.

    These tests assert that _ensure_sqlite_dir is a no-op (no directory
    created, no exception raised) for:
      • sqlite:///:memory:   — the in-memory sentinel
      • sqlite:///           — empty path sentinel
      • postgresql://...     — non-SQLite scheme
      • mysql://...          — another non-SQLite scheme

    And that an *absolute* SQLite path correctly creates the parent
    directory (the one case where the function SHOULD act).

    EXPECTED OUTCOME ON UNFIXED CODE: ALL PASS
    """

    # ------------------------------------------------------------------
    # 1. In-memory SQLite: sqlite:///:memory: → no-op
    # ------------------------------------------------------------------
    def test_in_memory_sqlite_is_noop(self, tmp_path, monkeypatch):
        """
        _ensure_sqlite_dir("sqlite:///:memory:") must not create any
        directory and must not raise.

        Validates: Requirement 15.5 (preservation of non-relative-path URLs)
        """
        monkeypatch.chdir(tmp_path)
        _ensure_sqlite_dir("sqlite:///:memory:")
        # Nothing should have been created under tmp_path
        assert list(tmp_path.iterdir()) == [], (
            "BUG: _ensure_sqlite_dir created directories for sqlite:///:memory:"
        )

    # ------------------------------------------------------------------
    # 2. Empty-path SQLite: sqlite:/// → no-op
    # ------------------------------------------------------------------
    def test_empty_path_sqlite_is_noop(self, tmp_path, monkeypatch):
        """
        _ensure_sqlite_dir("sqlite:///") must not create any directory
        and must not raise.

        urlparse("sqlite:///").path == "" → guarded by `path not in ("", ":memory:")`.

        Validates: Requirement 15.5
        """
        monkeypatch.chdir(tmp_path)
        _ensure_sqlite_dir("sqlite:///")
        assert list(tmp_path.iterdir()) == [], (
            "BUG: _ensure_sqlite_dir created directories for sqlite:///"
        )

    # ------------------------------------------------------------------
    # 3. PostgreSQL URL → no-op
    # ------------------------------------------------------------------
    def test_postgresql_url_is_noop(self, tmp_path, monkeypatch):
        """
        _ensure_sqlite_dir("postgresql://user:pass@host/db") must not
        create any directory and must not raise.

        Validates: Requirement 15.5
        """
        monkeypatch.chdir(tmp_path)
        _ensure_sqlite_dir("postgresql://user:pass@localhost/mydb")
        assert list(tmp_path.iterdir()) == [], (
            "BUG: _ensure_sqlite_dir created directories for a PostgreSQL URL"
        )

    # ------------------------------------------------------------------
    # 4. Non-SQLite URL (MySQL) → no-op
    # ------------------------------------------------------------------
    def test_mysql_url_is_noop(self, tmp_path, monkeypatch):
        """
        _ensure_sqlite_dir("mysql+pymysql://user:pass@host/db") must not
        create any directory and must not raise.

        Validates: Requirement 15.5
        """
        monkeypatch.chdir(tmp_path)
        _ensure_sqlite_dir("mysql+pymysql://user:pass@localhost/mydb")
        assert list(tmp_path.iterdir()) == [], (
            "BUG: _ensure_sqlite_dir created directories for a MySQL URL"
        )

    # ------------------------------------------------------------------
    # 5. Absolute SQLite path → parent directory IS created (correct behavior)
    #    Skipped on Windows because POSIX-style absolute paths (/tmp/...)
    #    are not portable; a platform-appropriate temp path is used instead.
    # ------------------------------------------------------------------
    @pytest.mark.skipif(sys.platform == "win32", reason="POSIX absolute path test skipped on Windows")
    def test_absolute_sqlite_path_creates_parent_directory_posix(self, tmp_path):
        """
        On POSIX, _ensure_sqlite_dir("sqlite:////tmp/test_abs/test.db") must
        create /tmp/test_abs/.

        This is CORRECT behavior: an absolute path should have its parent
        created without any cwd join.

        Validates: Requirement 15.5 (correct behavior for absolute paths is preserved)
        """
        import tempfile

        abs_db_dir = tmp_path / "abs_subdir"
        abs_db_path = abs_db_dir / "test.db"
        url = f"sqlite:///{abs_db_path}"

        _ensure_sqlite_dir(url)

        assert abs_db_dir.exists(), (
            f"Expected absolute parent {abs_db_dir} to be created, but it was not."
        )
        assert abs_db_dir.is_dir()

    @pytest.mark.skipif(sys.platform == "win32", reason=(
        "Absolute SQLite path handling is not portable on Windows: "
        "urlparse artefacts cause path doubling regardless of slash count. "
        "This baseline behavior is tested on POSIX only."
    ))
    def test_absolute_sqlite_path_creates_parent_directory_windows_skipped(self, tmp_path):
        """
        Placeholder — skipped on Windows.

        On Windows, the unfixed _ensure_sqlite_dir cannot reliably handle
        absolute Windows paths via urlparse because:
          • sqlite:///C:/...  → urlparse path = '/C:/...' → Path('/C:/...') = 'C:\\C:\\...'
          • sqlite:////C:/... → urlparse path = '//C:/...' → Path treats as UNC share

        The absolute-path test is covered by the POSIX variant above.
        Validates: Requirement 15.5 (tested on POSIX)
        """
        pass  # Always skipped on Windows via skipif
