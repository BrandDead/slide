// ============================================================
// demoSeed.ts — Birthday demo path seeder
//
// When VITE_DEMO_MODE=1 is set at build time, this module
// bypasses Supabase auth and seeds the Zustand stores with a
// pre-claimed block, a starter gang, and a placed dealer so
// the full claim → place → earn → combat loop is immediately
// playable without credentials.
//
// SECURITY: This module is tree-shaken in production builds
// (import.meta.env.VITE_DEMO_MODE is replaced at build time;
// dead-code elimination removes the body when it is falsy).
//
// P0 fixes applied (GPT audit, 2026-08-06):
//   1. Seed is now deterministic: stores are explicitly reset
//      before seeding so dirty browser storage (stale roster,
//      stale blocks, account-switch leftovers) never produces
//      a placement that references a nonexistent member.
//   2. incomePerTick corrected to 67 (= round(60 × 1.12))
//      to match calcPlacementIncome(dealer, sidewalk, level 2).
//   3. All three demo members are upserted by ID rather than
//      only added when the roster is empty.
// ============================================================

import { usePlayerStore, useGangStore } from '../stores/gameStore';
import { useBlockStore } from '../stores/blockStore';
import { useNavigationStore } from '../stores/gameStore';
import type { GangMember } from '../types/game.types';

/** True only when the build was started with VITE_DEMO_MODE=1 */
export const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === '1';

// ─── Demo constants ──────────────────────────────────────────
const DEMO_BLOCK_ID = 'demo-block-las-olas';
const DEMO_DEALER_ID = 'demo-dealer-1';
const DEMO_SHOOTER_ID = 'demo-shooter-1';
const DEMO_LOOKOUT_ID = 'demo-lookout-1';

// sidewalk (incomeModifier=60) × level-2 bonus (1.12) = round(67.2) = 67
const DEALER_INCOME_PER_TICK = 67;

/** Seed all stores for the birthday demo path and navigate to MAP. */
export function seedDemoState(): void {
  if (!IS_DEMO_MODE) return;

  const now = new Date().toISOString();

  // ── 1. Reset demo-owned data deterministically ────────────
  // Clear any stale blocks and account-specific data so a dirty
  // browser (previous session, account switch) never produces
  // a placement that references a nonexistent member.
  const blockStore = useBlockStore.getState();
  const playerStore = usePlayerStore.getState();
  const gangStore = useGangStore.getState();

  // The demo block is always overwritten by upsertBlock below.
  // Remove stale demo members and re-upsert them
  const DEMO_IDS = new Set([DEMO_DEALER_ID, DEMO_SHOOTER_ID, DEMO_LOOKOUT_ID]);

  // ── 2. Player ─────────────────────────────────────────────
  playerStore.updatePlayer({
    id: 'demo-player',
    username: 'Demo Boss',
    email: 'demo@slide.game',
    money: 12000,
    bankBalance: 5000,
    heat: 5,
    level: 3,
    xp: 240,
    gangName: 'The Demo Crew',
    gangColor: '#dc2626',
    gangProfile: {
      name: 'The Demo Crew',
      tag: 'DEMO',
      style: 'street',
      primaryColor: '#dc2626',
      secondaryColor: '#4ade80',
      logoUrl: undefined,
      motto: 'Show and prove.',
      graffitiOptions: [],
      foundedAt: now,
    },
  });

  // ── 3. Gang members (upsert by ID) ────────────────────────
  const demoMembers: GangMember[] = [
    {
      id: DEMO_DEALER_ID,
      gangId: 'demo-gang',
      name: 'Lil Dre',
      nickname: 'Dre',
      avatarUrl: '',
      backstory: 'Corner boy turned earner.',
      age: 22,
      region: 'miami',
      stats: { strength: 40, agility: 60, intelligence: 55, charisma: 70, luck: 45, intimidation: 30 },
      level: 2,
      experience: 120,
      skillPoints: 0,
      skills: [],
      loyalty: 80,
      morale: 85,
      respect: 50,
      kills: 0,
      arrests: 1,
      dealsCompleted: 34,
      moneyEarned: 8400,
      status: 'active',
      currentAssignment: null,
      joinedAt: now,
      role: 'dealer',
      health: 100,
      maxHealth: 100,
    },
    {
      id: DEMO_SHOOTER_ID,
      gangId: 'demo-gang',
      name: 'Big Rome',
      nickname: 'Rome',
      avatarUrl: '',
      backstory: 'Enforcer with a rep.',
      age: 26,
      region: 'miami',
      stats: { strength: 75, agility: 55, intelligence: 45, charisma: 40, luck: 35, intimidation: 70 },
      level: 3,
      experience: 280,
      skillPoints: 1,
      skills: [],
      loyalty: 90,
      morale: 80,
      respect: 70,
      kills: 4,
      arrests: 0,
      dealsCompleted: 5,
      moneyEarned: 2100,
      status: 'active',
      currentAssignment: null,
      joinedAt: now,
      role: 'shooter',
      health: 100,
      maxHealth: 100,
    },
    {
      id: DEMO_LOOKOUT_ID,
      gangId: 'demo-gang',
      name: 'Tasha',
      nickname: 'T',
      avatarUrl: '',
      backstory: 'Lookout who never misses.',
      age: 21,
      region: 'miami',
      stats: { strength: 50, agility: 70, intelligence: 65, charisma: 55, luck: 60, intimidation: 40 },
      level: 2,
      experience: 160,
      skillPoints: 0,
      skills: [],
      loyalty: 75,
      morale: 90,
      respect: 45,
      kills: 1,
      arrests: 0,
      dealsCompleted: 12,
      moneyEarned: 3200,
      status: 'active',
      currentAssignment: null,
      joinedAt: now,
      role: 'lookout',
      health: 100,
      maxHealth: 100,
    },
  ];

  // Rebuild the roster: remove any stale demo members then add fresh ones.
  // We use the store's own removeMember/addMember actions so middleware
  // (devtools, persist) stays consistent.
  DEMO_IDS.forEach((id) => {
    if (gangStore.members.some((m) => m.id === id)) {
      gangStore.removeMember(id);
    }
  });
  demoMembers.forEach((m) => gangStore.addMember(m));

  // ── 4. Pre-claimed block ──────────────────────────────────
  const grid = blockStore.generateDefaultGrid();

  // Pre-place the dealer at sidewalk position (col 2, row 2)
  grid[2][2].occupantId = DEMO_DEALER_ID;

  const demoBlock = {
    id: DEMO_BLOCK_ID,
    address: '1208 W Las Olas Blvd, Fort Lauderdale, FL',
    lat: 26.1224,
    lng: -80.1373,
    owner: 'player' as const,
    ownerGangName: 'The Demo Crew',
    grid,
    placements: [
      {
        memberId: DEMO_DEALER_ID,
        memberName: 'Lil Dre',
        role: 'dealer' as const,
        x: 2,
        y: 2,
        zoneType: 'sidewalk' as const,
        // round(60 × (1 + (2-1) × 0.12)) = round(60 × 1.12) = round(67.2) = 67
        incomePerTick: DEALER_INCOME_PER_TICK,
        exposureRisk: 50,
        level: 2,
        health: 100,
      },
    ],
    incomePerTick: DEALER_INCOME_PER_TICK,
    heat: 5,
    morale: 85,
    members: 1,
    viewMode: 'topdown' as const,
    pendingIncome: 0,
    topdownBgUrl: '/assets/runtime/generated/environments/topdown/block_lasolas_topdown_v001.webp',
    streetBackdropUrl: '/assets/runtime/generated/environments/street/block_lasolas_driveby_street_v001.webp',
  };

  blockStore.upsertBlock(demoBlock);
  blockStore.selectBlock(demoBlock.id);

  // ── 5. Navigate to MAP so the player lands on the block ───
  useNavigationStore.getState().navigateTo('map');
}
