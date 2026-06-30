// ============================================================
// npcRetaliationEngine.ts — NPC gang retaliation system
// When the player attacks an NPC block, the NPC schedules
// a counter-attack after a difficulty-based delay.
// ============================================================
import { useEffect, useRef, useCallback } from 'react';
import { usePlayerStore, useGangStore, useNotificationStore } from '../stores/gameStore';
import type { GangMember } from '../types/game.types';

// ─── Types ───────────────────────────────────────────────────
export interface NPCGangRef {
  id: string;
  name: string;
  aggression: number; // 0-100
  difficulty: number; // 1-5
}

export interface RetaliationEvent {
  id: string;
  npcGang: NPCGangRef;
  targetBlockId: string;
  scheduledAt: number;   // timestamp when it fires
  memberCount: number;   // how many NPC shooters are sent
  status: 'pending' | 'executed' | 'cancelled';
}

export interface RetaliationResult {
  npcGangName: string;
  playerCasualties: string[];   // member IDs
  npcCasualties: number;
  blockTaken: boolean;
  heatGenerated: number;
}

// ─── Constants ───────────────────────────────────────────────
const BASE_DELAY_MINUTES = 5; // Level 1 NPC waits 5 × (5 - difficulty) minutes

// ─── Core Functions ──────────────────────────────────────────

/**
 * Create a retaliation event. Higher difficulty = shorter delay.
 */
export function scheduleRetaliation(
  npcGang: NPCGangRef,
  targetBlockId: string
): RetaliationEvent {
  const delayMinutes = BASE_DELAY_MINUTES * (5 - npcGang.difficulty + 1);
  const delayMs = delayMinutes * 60 * 1000;
  const memberCount = Math.ceil((npcGang.aggression / 100) * 5); // 1-5 members

  return {
    id: `retaliation-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    npcGang,
    targetBlockId,
    scheduledAt: Date.now() + delayMs,
    memberCount,
    status: 'pending',
  };
}

/**
 * Simulate the retaliation combat.
 * Higher difficulty NPC vs higher-level player members.
 */
export function executeRetaliation(
  event: RetaliationEvent,
  playerMembers: GangMember[]
): RetaliationResult {
  const shooters = playerMembers.filter(
    (m) => m.status === 'active' && (m.role === 'shooter' || m.role === 'enforcer')
  );

  const npcStrength = event.npcGang.difficulty * 20 + event.memberCount * 10;
  const playerStrength = shooters.reduce((sum, m) => {
    const shootingStat = (m as any).stats?.strength ?? 40;
    return sum + (m.level ?? 1) * 10 + shootingStat;
  }, 0);

  const playerWins = playerStrength > npcStrength * (0.5 + Math.random() * 0.5);

  const playerCasualties: string[] = [];
  if (!playerWins && shooters.length > 0) {
    // Injure 1-2 player members
    const injureCount = Math.min(shooters.length, Math.ceil(Math.random() * 2));
    for (let i = 0; i < injureCount; i++) {
      playerCasualties.push(shooters[i].id);
    }
  }

  const npcCasualties = playerWins
    ? event.memberCount
    : Math.floor(event.memberCount * 0.3);

  return {
    npcGangName: event.npcGang.name,
    playerCasualties,
    npcCasualties,
    blockTaken: !playerWins && shooters.length === 0,
    heatGenerated: 10 + event.npcGang.difficulty * 5,
  };
}

// ─── React Hook ──────────────────────────────────────────────

/**
 * Hook that manages pending retaliation events and fires them when due.
 */
export function useNPCRetaliation() {
  const { updateHeat } = usePlayerStore();
  const { members, updateMember } = useGangStore();
  const { addNotification } = useNotificationStore();
  const pendingEvents = useRef<RetaliationEvent[]>([]);
  const checkInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const queueRetaliation = useCallback((npcGang: NPCGangRef, targetBlockId: string) => {
    const event = scheduleRetaliation(npcGang, targetBlockId);
    pendingEvents.current.push(event);
    addNotification({
      id: `retaliation-warn-${event.id}`,
      type: 'warning',
      title: `${npcGang.name} is planning retaliation`,
      message: `Expect a counter-attack in ~${Math.ceil((event.scheduledAt - Date.now()) / 60000)} minutes.`,
      timestamp: Date.now(),
      read: false,
    } as any);
  }, [addNotification]);

  const checkPendingEvents = useCallback(() => {
    const now = Date.now();
    const due = pendingEvents.current.filter(
      (e) => e.status === 'pending' && e.scheduledAt <= now
    );

    for (const event of due) {
      event.status = 'executed';
      const result = executeRetaliation(event, members);

      // Apply casualties
      for (const memberId of result.playerCasualties) {
        updateMember(memberId, { status: 'injured', health: 20 } as any);
      }

      // Apply heat
      updateHeat(result.heatGenerated);

      // Notify player
      const casualtyText = result.playerCasualties.length > 0
        ? ` ${result.playerCasualties.length} member(s) injured.`
        : ' No casualties.';

      addNotification({
        id: `retaliation-result-${event.id}`,
        type: result.blockTaken ? 'danger' : 'warning',
        title: `${event.npcGang.name} retaliated!`,
        message: `${result.npcCasualties} NPC(s) down.${casualtyText} +${result.heatGenerated} heat.`,
        timestamp: now,
        read: false,
      } as any);
    }

    // Clean up executed events
    pendingEvents.current = pendingEvents.current.filter((e) => e.status === 'pending');
  }, [members, updateMember, updateHeat, addNotification]);

  useEffect(() => {
    checkInterval.current = setInterval(checkPendingEvents, 10_000); // Check every 10s
    return () => {
      if (checkInterval.current) clearInterval(checkInterval.current);
    };
  }, [checkPendingEvents]);

  return { queueRetaliation };
}
