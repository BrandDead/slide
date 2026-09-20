#!/usr/bin/env python3
"""Offline contracts for the additive staging saved-game security hardening.

These tests intentionally inspect the source-controlled migration. Remote staging
application and live role smoke tests remain a separate reviewed operator step.
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path

SUPABASE_ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = SUPABASE_ROOT / "world-proof-manifest.json"
MIGRATION_NAME = "007_staging_saved_game_security_hardening.sql"
MIGRATION_PATH = SUPABASE_ROOT / "migrations" / MIGRATION_NAME


class StagingSecurityHardeningContracts(unittest.TestCase):
    def setUp(self) -> None:
        self.assertTrue(
            MIGRATION_PATH.is_file(),
            "The additive staging security hardening migration must exist.",
        )
        self.sql = MIGRATION_PATH.read_text(encoding="utf-8")
        self.manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

    def test_manifest_materializes_the_additive_hardening_migration(self) -> None:
        entries = self.manifest["canonical_migrations"]
        entry = next((item for item in entries if item["source"].endswith(MIGRATION_NAME)), None)

        self.assertIsNotNone(entry)
        self.assertEqual(entry["target"], "20260905000500_staging_saved_game_security_hardening.sql")
        self.assertEqual(entries[-1]["source"], f"migrations/{MIGRATION_NAME}")

    def test_audit_critical_public_tables_are_not_client_accessible(self) -> None:
        for table in (
            "block_backgrounds",
            "block_grid_anchors",
            "world_ticks",
            "payment_events",
        ):
            self.assertIn(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;", self.sql)
            self.assertIn(
                f"REVOKE ALL ON TABLE public.{table} FROM anon, authenticated;",
                self.sql,
            )

        self.assertIn("`public.spatial_ref_sys` is PostGIS extension-owned.", self.sql)
        self.assertNotIn("ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;", self.sql)

        for table in (
            "block_backgrounds",
            "block_grid_anchors",
            "world_ticks",
            "payment_events",
        ):
            self.assertIn(
                f'CREATE POLICY "Service role manages {table}"',
                self.sql,
            )

    def test_private_player_state_has_authenticated_owner_reads_only(self) -> None:
        for table in (
            "profiles",
            "blocks",
            "gang_members",
            "block_placements",
            "player_inventory",
            "encounter_results",
            "entitlements",
        ):
            self.assertIn(f"REVOKE ALL ON TABLE public.{table} FROM anon, authenticated;", self.sql)
            self.assertIn(f"GRANT SELECT ON TABLE public.{table} TO authenticated;", self.sql)

        self.assertIn("TO authenticated", self.sql)
        self.assertIn("(select auth.uid())", self.sql)
        self.assertNotIn("TO PUBLIC", self.sql.upper())

    def test_hardening_does_not_restore_legacy_direct_browser_writes(self) -> None:
        for table in (
            "profiles",
            "blocks",
            "gang_members",
            "block_placements",
            "player_inventory",
            "claimed_block_dna",
            "encounter_results",
            "entitlements",
        ):
            self.assertNotIn(
                f"GRANT INSERT ON TABLE public.{table} TO authenticated;",
                self.sql,
            )
            self.assertNotIn(
                f"GRANT UPDATE ON TABLE public.{table} TO authenticated;",
                self.sql,
            )
            self.assertNotIn(
                f"GRANT DELETE ON TABLE public.{table} TO authenticated;",
                self.sql,
            )

    def test_legacy_public_policies_are_replaced_with_explicit_roles(self) -> None:
        for policy, table in (
            ("Profiles are viewable by everyone", "profiles"),
            ("Blocks are publicly viewable", "blocks"),
            ("Block placements viewable by all", "block_placements"),
            ("Ghost crews are publicly viewable", "ghost_crews"),
            ("Block DNA is publicly viewable", "claimed_block_dna"),
        ):
            self.assertIn(f'DROP POLICY IF EXISTS "{policy}" ON public.{table};', self.sql)

        self.assertIn("CREATE POLICY \"Authenticated users read own profiles\"", self.sql)
        self.assertIn("CREATE POLICY \"Authenticated users read territory\"", self.sql)
        self.assertIn("CREATE POLICY \"Authenticated users read owned block placements\"", self.sql)
        self.assertIn("CREATE POLICY \"Authenticated users read encounter receipts\"", self.sql)

    def test_security_definer_helpers_have_fixed_paths_and_narrow_execute_grants(self) -> None:
        self.assertIn("ALTER FUNCTION public.update_updated_at_column() SET search_path = pg_catalog, public;", self.sql)
        self.assertIn("ALTER FUNCTION public.handle_new_user() SET search_path = pg_catalog, public;", self.sql)
        self.assertNotIn(
            "REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;",
            self.sql,
        )
        self.assertIn("CREATE OR REPLACE FUNCTION public.get_economy_summary(user_id UUID)", self.sql)
        self.assertIn("IF (select auth.uid()) IS DISTINCT FROM user_id", self.sql)
        self.assertIn("COALESCE(auth.role(), '') <> 'service_role'", self.sql)
        self.assertIn("REVOKE ALL ON FUNCTION public.get_economy_summary(UUID) FROM PUBLIC, anon;", self.sql)
        self.assertIn("GRANT EXECUTE ON FUNCTION public.get_economy_summary(UUID) TO authenticated, service_role;", self.sql)
        self.assertIn("REVOKE ALL ON FUNCTION public.get_leaderboard(INT) FROM PUBLIC, anon, authenticated;", self.sql)
        self.assertIn("GRANT EXECUTE ON FUNCTION public.get_leaderboard(INT) TO service_role;", self.sql)

    def test_entitlement_tables_use_the_canonical_repository_names(self) -> None:
        self.assertIn("public.billing_products", self.sql)
        self.assertIn("public.entitlements", self.sql)
        self.assertNotIn("paid_entitlement_products", self.sql)
        self.assertNotIn("player_entitlements", self.sql)


if __name__ == "__main__":
    unittest.main()
