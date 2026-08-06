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
// ============================================================

import { usePlayerStore, useGangStore } from '../stores/gameStore';
import { useBlockStore } from '../stores/blockStore';
import { useNavigationStore } from '../stores/gameStore';
import type { GangMember } from '../types/game.types';

/** True only when the build was started with VITE_DEMO_MODE=1 */
export const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === '1';

/** Seed all stores for the birthday demo path and navigate to MAP. */
export function seedDemoState(): void {
  if (!IS_DEMO_MODE) return;

  // ── Player ────────────────────────────────────────────────
  usePlayerStore.getState().updatePlayer({
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
      foundedAt: new Date().toISOString(),
    },
  });

  // ── Gang members ──────────────────────────────────────────
  const now = new Date().toISOString();
  const demoMembers: GangMember[] = [
    {
      id: 'demo-dealer-1',
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
      id: 'demo-shooter-1',
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
      id: 'demo-enforcer-1',
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

  const gangStore = useGangStore.getState();
  // Only seed if no members exist yet
  if (gangStore.members.length === 0) {
    demoMembers.forEach((m) => gangStore.addMember(m));
  }

  // ── Pre-claimed block ─────────────────────────────────────
  const blockStore = useBlockStore.getState();
  const grid = blockStore.generateDefaultGrid();

  // Pre-place the dealer at sidewalk position (col 2, row 2)
  grid[2][2].occupantId = 'demo-dealer-1';

  const demoBlock = {
    id: 'demo-block-las-olas',
    address: '1208 W Las Olas Blvd, Fort Lauderdale, FL',
    lat: 26.1224,
    lng: -80.1373,
    owner: 'player' as const,
    ownerGangName: 'The Demo Crew',
    grid,
    placements: [
      {
        memberId: 'demo-dealer-1',
        memberName: 'Lil Dre',
        role: 'dealer' as const,
        x: 2,
        y: 2,
        zoneType: 'sidewalk' as const,
        incomePerTick: 72,   // sidewalk base 60 × level-2 bonus
        exposureRisk: 50,
        level: 2,
        health: 100,
      },
    ],
    incomePerTick: 72,
    heat: 5,
    morale: 85,
    members: 1,
    viewMode: 'topdown' as const,
    pendingIncome: 0,
    topdownBgUrl: '/assets/runtime/generated/environments/topdown/block_stripplaza_topdown_v001.webp',
    streetBackdropUrl: '/assets/runtime/generated/environments/street/block_stripplaza_night_street_v001.webp',
  };

  blockStore.upsertBlock(demoBlock);
  blockStore.selectBlock(demoBlock.id);

  // ── Navigate to MAP so the player lands on the block ──────
  useNavigationStore.getState().navigateTo('map');
}
