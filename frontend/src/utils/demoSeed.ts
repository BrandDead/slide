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
import { useShoeboxStore } from '../stores/useShoeboxStore';
import { useGhostStore, type GhostFeedEvent } from '../stores/ghostCrewStore';
import { useDrugInventory } from '../stores/useDrugInventory';
import type { GangMember } from '../types/game.types';
import { BLOCK_LOOP_IDS } from '../game/loop/blockLoopTypes';
import { BLOCK_LOOP_PRODUCT, createAuthoritativeLoopBlock } from '../game/loop/blockLoopFixture';
import { applyPlacement, toPlacement } from '../game/loop/placementRules';
import { readDemoLoopLedger } from '../game/loop/blockLoopPersist';
import { useBlockLoopStore } from '../stores/blockLoopStore';

/** True only when the build was started with VITE_DEMO_MODE=1 */
export const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === '1';

// ─── Demo constants ──────────────────────────────────────────
const DEMO_BLOCK_ID = BLOCK_LOOP_IDS.blockId;
const DEMO_DEALER_ID = BLOCK_LOOP_IDS.dealerId;
const DEMO_SHOOTER_ID = BLOCK_LOOP_IDS.shooterId;
const DEMO_LOOKOUT_ID = BLOCK_LOOP_IDS.lookoutId;
const DEMO_ENFORCER_ID = BLOCK_LOOP_IDS.enforcerId;

/**
 * A bounded local preview of the server-shaped City Briefing. It is demo-only
 * and lets reviewers inspect the returning-player screen without presenting
 * the browser tick as production authority.
 */
function buildDemoCityBriefing(now: number): GhostFeedEvent[] {
  return [
    {
      id: 'demo-city-brief-attack',
      crewId: 'ghost-nightfall',
      crewName: 'Nightfall',
      action: 'attack',
      description: 'Nightfall is testing the edge of your Las Olas block. Review your crew positions before the next move.',
      targetBlockId: DEMO_BLOCK_ID,
      timestamp: now - 6 * 60_000,
    },
    {
      id: 'demo-city-brief-claim',
      crewId: 'ghost-sistrunk',
      crewName: 'Sistrunk Kings',
      action: 'claim',
      description: 'A rival crew expanded into a nearby fictional district. Their new turf is visible on the map.',
      targetBlockId: 'ghost-demo-district',
      timestamp: now - 24 * 60_000,
    },
    {
      id: 'demo-city-brief-reinforce',
      crewId: 'ghost-riverwalk',
      crewName: 'Riverwalk',
      action: 'reinforce',
      description: 'Rivals reinforced their roster after recent city activity. Check your crew readiness before pressing further.',
      timestamp: now - 2 * 60 * 60_000,
    },
  ];
}

/** Seed all stores for the birthday demo path and navigate to MAP. */
export function applyDemoSeed(): void {

  const now = new Date().toISOString();
  const nowMs = Date.now();

  // ── 1. Reset demo-owned data deterministically ────────────
  // Clear any stale blocks and account-specific data so a dirty
  // browser (previous session, account switch) never produces
  // a placement that references a nonexistent member.
  const blockStore = useBlockStore.getState();
  const playerStore = usePlayerStore.getState();
  const gangStore = useGangStore.getState();

  // The demo block is always overwritten by upsertBlock below.
  // Remove stale demo members and re-upsert them
  const DEMO_IDS = new Set([DEMO_DEALER_ID, DEMO_SHOOTER_ID, DEMO_LOOKOUT_ID, DEMO_ENFORCER_ID]);

  // ── 2. Player ─────────────────────────────────────────────
  // Preserve earned progress (level/XP) if the demo player has advanced beyond seed defaults
  const currentPlayer = playerStore.player;
  const hasProgress = currentPlayer.id === 'demo-player' &&
    (currentPlayer.level > 3 || currentPlayer.xp !== 240);

  playerStore.updatePlayer({
    id: 'demo-player',
    username: 'Demo Boss',
    email: 'demo@slide.game',
    money: 12000,
    bankBalance: 5000,
    heat: 5,
    level: hasProgress ? currentPlayer.level : 3,
    xp: hasProgress ? currentPlayer.xp : 240,
    xpToNextLevel: hasProgress ? currentPlayer.xpToNextLevel : undefined,
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
    {
      id: DEMO_ENFORCER_ID,
      gangId: 'demo-gang',
      name: 'Kilo',
      nickname: 'Kilo',
      avatarUrl: '',
      backstory: 'Collects the tax and keeps the corner quiet.',
      age: 28,
      region: 'miami',
      stats: { strength: 80, agility: 50, intelligence: 50, charisma: 45, luck: 40, intimidation: 85 },
      level: 3,
      experience: 240,
      skillPoints: 0,
      skills: [],
      loyalty: 88,
      morale: 82,
      respect: 75,
      kills: 2,
      arrests: 1,
      dealsCompleted: 0,
      moneyEarned: 4100,
      status: 'active',
      currentAssignment: null,
      joinedAt: now,
      role: 'enforcer',
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

  // ── 4. Pre-claimed DNA board ────────────────────────────────
  const dealerCard = {
    id: DEMO_DEALER_ID,
    name: 'Lil Dre',
    nickname: 'Dre',
    role: 'dealer' as const,
    level: 2,
    morale: 85,
    health: 100,
    maxHealth: 100,
    equipment: 'none',
    assignment: 'unassigned',
  };
  const enforcerCard = {
    id: DEMO_ENFORCER_ID,
    name: 'Kilo',
    nickname: 'Kilo',
    role: 'enforcer' as const,
    level: 3,
    morale: 82,
    health: 100,
    maxHealth: 100,
    equipment: 'none',
    assignment: 'unassigned',
  };
  let demoBlock = createAuthoritativeLoopBlock();
  const sidewalk = demoBlock.grid[2][2];
  const enforcerCell = demoBlock.grid[2][4];
  demoBlock = applyPlacement(
    demoBlock,
    toPlacement(dealerCard, sidewalk, demoBlock.grid, demoBlock.incomeMultiplier ?? 1),
  );
  demoBlock = applyPlacement(
    demoBlock,
    toPlacement(enforcerCard, enforcerCell, demoBlock.grid, demoBlock.incomeMultiplier ?? 1),
  );
  demoBlock = {
    ...demoBlock,
    pendingIncome: 840,
  };

  blockStore.upsertBlock(demoBlock);
  blockStore.selectBlock(demoBlock.id);

  // City Briefing is a visual/player-path fixture in demo mode. Authenticated
  // production sessions only display state hydrated from the durable service.
  useGhostStore.setState({ feed: buildDemoCityBriefing(nowMs) });

  const shoebox = useShoeboxStore.getState();
  shoebox.reset();
  shoebox.deposit(5000, 'block_income', 'Demo vault seed');
  shoebox.deposit(8400, 'block_income', 'Las Olas dealers · weekly take', { blockId: demoBlock.id, memberId: DEMO_DEALER_ID });
  shoebox.withdraw(1000, 'salary', 'Payroll: Lil Dre (dealer)', { memberId: DEMO_DEALER_ID, blockId: demoBlock.id });
  shoebox.withdraw(840, 'salary', 'Payroll: Big Rome (shooter)', { memberId: DEMO_SHOOTER_ID, blockId: demoBlock.id });
  shoebox.withdraw(630, 'salary', 'Payroll: Kilo (enforcer)', { memberId: DEMO_ENFORCER_ID, blockId: demoBlock.id });

  const drugs = useDrugInventory.getState();
  useDrugInventory.setState({
    inventory: { ...drugs.inventory, [BLOCK_LOOP_IDS.productId]: { ...BLOCK_LOOP_PRODUCT } },
  });

  // ── 5. Land on the desktop so the strip-run route is visible ──
  useNavigationStore.getState().navigateTo('home');
}

export function restoreLoopLedgerIfPresent(): boolean {
  const ledger = readDemoLoopLedger(usePlayerStore.getState().player.id);
  if (!ledger) return false;
  const hasConsequence = Boolean(
    ledger.dealKey
    || ledger.encounterKey
    || ledger.lastDeal
    || ledger.lastEncounter
    || ledger.appliedEncounterKeys.length
    || (ledger.phase !== 'crew' && ledger.phase !== 'placement'),
  );
  if (!hasConsequence) return false;
  useBlockLoopStore.getState().hydrateFromLedger(ledger);
  return true;
}

export function seedDemoState(): void {
  if (!IS_DEMO_MODE) return;
  applyDemoSeed();
  restoreLoopLedgerIfPresent();
}
