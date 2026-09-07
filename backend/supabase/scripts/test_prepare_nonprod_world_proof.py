#!/usr/bin/env python3
"""Offline regression tests for the disposable authoritative-world proof workdir."""

from __future__ import annotations

import copy
import importlib.util
import tempfile
import unittest
from pathlib import Path

SCRIPT_PATH = Path(__file__).with_name("prepare_nonprod_world_proof.py")
SPEC = importlib.util.spec_from_file_location("world_proof_bootstrap", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class WorldProofBootstrapTests(unittest.TestCase):
    def test_manifest_has_no_validation_errors(self) -> None:
        manifest = MODULE.load_manifest()
        self.assertEqual(MODULE.validate(manifest), [])

    def test_missing_source_is_reported_without_crashing(self) -> None:
        manifest = copy.deepcopy(MODULE.load_manifest())
        manifest["canonical_migrations"][0]["source"] = "migrations/does_not_exist.sql"

        errors = MODULE.validate(manifest)

        self.assertTrue(any("Missing canonical migration" in error for error in errors))
        self.assertTrue(any("required base table" in error for error in errors))

    def test_materialization_is_deterministic_and_excludes_legacy_sql(self) -> None:
        manifest = MODULE.load_manifest()
        expected_targets = [entry["target"] for entry in manifest["canonical_migrations"]]

        with tempfile.TemporaryDirectory() as temporary_directory:
            workspace = Path(temporary_directory) / "proof"
            MODULE.materialize(manifest, workspace)
            migrations = sorted(
                path.name
                for path in (workspace / "supabase" / "migrations").glob("*.sql")
            )

            self.assertEqual(migrations, sorted(expected_targets))
            self.assertFalse(any("mvp_tables" in name for name in migrations))
            self.assertFalse(any("combat_tables" in name for name in migrations))
            self.assertIn(
                "Do not link it to production.",
                (workspace / "README.md").read_text(encoding="utf-8"),
            )

    def test_materialization_rejects_nonempty_workspace(self) -> None:
        manifest = MODULE.load_manifest()

        with tempfile.TemporaryDirectory() as temporary_directory:
            workspace = Path(temporary_directory) / "proof"
            workspace.mkdir()
            (workspace / "unexpected.txt").write_text("not empty", encoding="utf-8")

            with self.assertRaisesRegex(RuntimeError, "Workspace must be empty"):
                MODULE.materialize(manifest, workspace)


if __name__ == "__main__":
    unittest.main()
