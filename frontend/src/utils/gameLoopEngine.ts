// ============================================================
// gameLoopEngine.ts - Central game tick system
// Runs every 30 seconds, processes heat decay, raids, income,
// member heat contribution, morale checks, and random events
// Sprint 9: live drug inventory wiring, morale consequences enforced
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  calculateDecayedHeat,
  rollForRaid,
  executeRaid,
  createInitialHeatState,
  type HeatState,
  type RaidResult,
  HEAT_CONFIG,
} from './heatSystem';
import {
  getMemberHeatContribution,
  addXp,
  xpForLevel,
  XP_CONFIG,
  type MemberLevel,
} from './memberProgression';
import { calculateTotalIncome, estimateIncomePerMinute, type ODEvent } from './incomeEngine';
import { calculateBlockEnforcerContributions } from './enforcerEngine';
import {
  calculateMorale,
  getMoraleConsequences,
  rollMoraleConsequences,
  getMoraleDescription,
  type MoraleFactors,
} from './moraleSystem';
import {
  overdueMembers,
  updateHeldSince,
  applyAbandonmentPenalty,
  RECOVERY_CONFIG,
} from './bailHospitalSystem';
import { selectRaidTarget, suppressesBackgroundRaid } from './raidTrigger';
import { useNavigationStore } from '../stores/gameStore';
import {
  usePlayerStore,
  useGangStore,
  useTerritoryStore,
  useEconomyStore,
  useNotificationStore,
} from '../stores/gameStore';
import { useBlockStore } from '../stores/blockStore';
import { useDrugInventory } from '../stores/useDrugInventory';

// ============ DRUG-AWARE INCOME HELPERS ============
/**
 * Build the dealer list for calculateTotalIncome, reading live drug
 * assignments from useDrugInventory so purity and OD-risk are real.
 */
function buildBlockDealers(
  blocks: ReturnType<typeof useTerritoryStore.getState>['blocks'],
  members: ReturnType<typeof useGangStore.getState>['members'],
) {
  const drugStore = useDrugInventory.getState();
  return blocks.map((block) => ({
    blockId: block.id,
    blockName: (block as any).name || `Block ${block.id}`,
    dealers: block.units
      .filter((u) => (u as any).role === 'dealer' || u.type === 'dealer')
      .map((u) => {
        const member = members.find((m) => m.id === u.gangMemberId);
        const pos = u.position as any;
        const dealerId = u.gangMemberId ?? '';
        const equippedDrug = drugStore.getDealerDrug(dealerId);
        return {
          memberId: dealerId,
          memberName: (u as any).memberName || member?.name || 'Unknown',
          row: pos ? (pos.row ?? pos.y ?? 4) : 4,
          dealingStat: (member?.stats as any)?.dealing ?? 50,
          // Live drug quality drives income and OD risk
          drugPurity: equippedDrug?.quality ?? 40,
          drugOdRisk: equippedDrug
            ? (equippedDrug.effects?.includes('high_od') ? 65 : 15)
            : 10,
          drugName: equippedDrug?.name ?? 'Product',
        };
      }),
  }));
}

// ============ GAME EVENT TYPES ============

export type GameEventType =
  | 'raid'
  | 'income'
  | 'od'
  | 'morale_warning'
  | 'random_event'
  | 'member_heat'
  | 'heat_decay';

export interface GameEvent {
  id: string;
  type: GameEventType;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'danger' | 'critical';
  timestamp: number;
  data?: any;
}

export interface RaidEvent extends GameEvent {
  type: 'raid';
  data: {
    result: RaidResult;
    bailCosts: Array<{ memberId: string; memberName: string; amount: number }>;
  };
}

// ============ RANDOM EVENTS ============

interface RandomEventTemplate {
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'danger';
  effect: (stores: GameStores) => void;
}

interface GameStores {
  player: ReturnType<typeof usePlayerStore.getState>;
  gang: ReturnType<typeof useGangStore.getState>;
  territory: ReturnType<typeof useTerritoryStore.getState>;
  economy: ReturnType<typeof useEconomyStore.getState>;
  notifications: ReturnType<typeof useNotificationStore.getState>;
}

const RANDOM_EVENTS: RandomEventTemplate[] = [
  {
    title: '👮 Police Patrol',
    message: 'Cops are cruising the block. Heat +5.',
    severity: 'warning',
    effect: (s) => s.player.updateHeat(5),
  },
  {
    title: '🔫 Rival Gang Spotted',
    message: 'Opps were seen scoping your block. Stay alert.',
    severity: 'warning',
    effect: () => {},
  },
  {
    title: '💰 Big Spender',
    message: 'A high roller came through. +$500 bonus.',
    severity: 'info',
    effect: (s) => s.player.updateMoney(500),
  },
  {
    title: '📰 News Coverage',
    message: 'Local news ran a story about drug activity. Heat +10.',
    severity: 'danger',
    effect: (s) => s.player.updateHeat(10),
  },
  {
    title: '🤝 Community Support',
    message: 'Locals appreciate you keeping things quiet. Heat -5.',
    severity: 'info',
    effect: (s) => s.player.updateHeat(-5),
  },
  {
    title: '🚗 Drive-by Warning',
    message: 'Someone shot up a nearby block. Your crew is on edge.',
    severity: 'warning',
    effect: () => {},
  },
  {
    title: '💊 Product Shortage',
    message: 'Supply chain disrupted. Prices going up on the street.',
    severity: 'info',
    effect: () => {},
  },
  {
    title: '🎉 Block Party',
    message: 'Neighborhood block party provides cover. Heat -3.',
    severity: 'info',
    effect: (s) => s.player.updateHeat(-3),
  },
  {
    title: '🐀 Snitch Alert',
    message: "Word on the street is someone's talking. Heat +15.",
    severity: 'danger',
    effect: (s) => s.player.updateHeat(15),
  },
  {
    title: '💵 Protection Money',
    message: 'Local businesses paid their weekly dues. +$300.',
    severity: 'info',
    effect: (s) => s.player.updateMoney(300),
  },
];

// ============ GAME LOOP CONFIG ============

export const LOOP_CONFIG = {
  TICK_INTERVAL_MS: 30_000,       // 30 seconds per tick
  MORALE_CHECK_INTERVAL: 5,       // Every 5 ticks
  RANDOM_EVENT_CHANCE: 0.05,      // 5% per tick
  HEAT_DECAY_DIVISOR: 120,        // Decay fraction per tick (2pts/hr ÷ 120 ticks/hr)
} as const;

// ============ GAME LOOP HOOK ============

export interface GameLoopState {
  isRunning: boolean;
  tickCount: number;
  lastEvent: GameEvent | null;
  activeRaid: RaidEvent | null;
  incomePerMinute: number;
  gangMorale: number;
  heatState: HeatState;
  start: () => void;
  stop: () => void;
  dismissRaid: () => void;
  payBail: (memberId: string) => void;
  leaveMember: (memberId: string) => void;
}

export function useGameLoop(): GameLoopState {
  const [isRunning, setIsRunning] = useState(false);
  const [tickCount, setTickCount] = useState(0);
  const [lastEvent, setLastEvent] = useState<GameEvent | null>(null);
  const [activeRaid, setActiveRaid] = useState<RaidEvent | null>(null);
  const [incomePerMinute, setIncomePerMinute] = useState(0);
  const [gangMorale, setGangMorale] = useState(75);
  const [heatState, setHeatState] = useState<HeatState>(createInitialHeatState());

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef(0);
  /**
   * memberId -> tick they went down. Held in a ref, not state: it feeds
   * the next tick's penalty calculation and must never itself trigger a
   * re-render mid-loop.
   */
  const heldSinceRef = useRef<Record<string, number>>({});

  /** blockId -> tick of its last interactive raid, for cooldown. */
  const lastRaidTickRef = useRef<Record<string, number>>({});

  const getStores = useCallback((): GameStores => ({
    player: usePlayerStore.getState(),
    gang: useGangStore.getState(),
    territory: useTerritoryStore.getState(),
    economy: useEconomyStore.getState(),
    notifications: useNotificationStore.getState(),
  }), []);

  const createEvent = useCallback((
    type: GameEventType,
    title: string,
    message: string,
    severity: 'info' | 'warning' | 'danger' | 'critical',
    data?: any,
  ): GameEvent => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    message,
    severity,
    timestamp: Date.now(),
    data,
  }), []);

  const processTick = useCallback(() => {
    const stores = getStores();
    const { player } = stores.player;
    const members = stores.gang.getActiveMembers();
    const blocks = stores.territory.blocks;

    tickRef.current += 1;
    setTickCount(tickRef.current);

    // 1. HEAT DECAY
    const currentHeatState: HeatState = {
      ...heatState,
      level: player.heat,
    };
    const decayedHeat = calculateDecayedHeat(currentHeatState);
    if (decayedHeat < player.heat) {
      const diff = player.heat - decayedHeat;
      stores.player.updateHeat(-diff);
    }

    // 2. MEMBER HEAT CONTRIBUTION
    let memberHeatTotal = 0;
    for (const block of blocks) {
      for (const unit of block.units) {
        const member = members.find((m) => m.id === unit.memberId);
        if (member) {
          const contribution = getMemberHeatContribution(member.level);
          memberHeatTotal += contribution;
        }
      }
    }
    if (memberHeatTotal > 0) {
      // Scale to per-tick amount (heat per hour → per tick)
      const heatPerTick = memberHeatTotal / (3600000 / LOOP_CONFIG.TICK_INTERVAL_MS);
      if (heatPerTick >= 0.1) {
        stores.player.updateHeat(Math.ceil(heatPerTick));
      }
    }

    // 3. PASSIVE INCOME — uses live drug assignments from useDrugInventory
    const blockDealers = buildBlockDealers(blocks, members);

    // Consume drugs proportional to active dealers (1 tick of supply)
    const activeDealerCount = blockDealers.reduce((n, b) => n + b.dealers.length, 0);
    if (activeDealerCount > 0) {
      useDrugInventory.getState().consumeAssignedDrugs(1);
    }

    const incomeResult = calculateTotalIncome(blockDealers);

    // Also tick the block store so BlockModeView pendingIncome stays in sync
    useBlockStore.getState().tickIncome();

    if (incomeResult.totalIncome > 0) {
      // Route ALL passive income to the Shoebox (bankBalance)
      const currentBank = usePlayerStore.getState().player.bankBalance ?? 0;
      stores.player.updatePlayer({ bankBalance: currentBank + incomeResult.totalIncome });
      stores.economy.addTransaction({
        id: Date.now().toString(),
        type: 'income',
        amount: incomeResult.totalIncome,
        description: `Block income: $${incomeResult.totalIncome}`,
        category: 'block_income',
        timestamp: new Date().toISOString(),
      } as any);
    }

    setIncomePerMinute(estimateIncomePerMinute(incomeResult.totalIncome));

    // 3c. DEALER XP AWARDS — every tick, active dealers earn XP for working the block
    for (const blockData of blockDealers) {
      for (const dealer of blockData.dealers) {
        const member = members.find((m) => m.id === dealer.memberId);
        if (!member) continue;
        const currentLevel: MemberLevel = {
          level: member.level ?? 1,
          xp: member.experience ?? 0,
          xpToNext: xpForLevel(member.level ?? 1),
          totalXp: member.experience ?? 0,
        };
        const { level: newLevel, levelUps } = addXp(
          currentLevel,
          XP_CONFIG.XP_PER_DEAL,
          'dealer',
        );
        stores.gang.updateMember(member.id, {
          level: newLevel.level,
          experience: newLevel.totalXp,
        });
        for (const lu of levelUps) {
          stores.notifications.addNotification({
            type: 'info',
            title: `⬆️ ${member.name} leveled up!`,
            message: `${member.name} reached Level ${lu.newLevel}.${
              lu.unlockedAbility ? ` Unlocked: ${lu.unlockedAbility}` : ''
            }`,
            priority: 'normal',
            timestamp: Date.now(),
          });
        }
      }
    }

    // 3b. ENFORCER PATROL INCOME + HEAT REDUCTION
    const blockEnforcers = blocks.map((block) => ({
      blockId: block.id,
      enforcers: block.units
        .filter((u) => (u as any).role === 'enforcer')
        .map((u) => {
          const member = members.find((m) => m.id === u.gangMemberId);
          const pos = u.position as any;
          return {
            memberId: u.gangMemberId ?? '',
            memberName: (u as any).memberName || member?.name || 'Enforcer',
            level: member?.level ?? 1,
            row: pos ? (pos.row ?? pos.y ?? 4) : 4,
          };
        }),
    }));
    for (const blockData of blockEnforcers) {
      if (blockData.enforcers.length === 0) continue;
      const enforcerResult = calculateBlockEnforcerContributions(blockData.enforcers);
      if (enforcerResult.totalPatrolIncome > 0) {
        const currentBank = usePlayerStore.getState().player.bankBalance ?? 0;
        stores.player.updatePlayer({ bankBalance: currentBank + enforcerResult.totalPatrolIncome });
      }
      if (enforcerResult.totalHeatReduction > 0) {
        stores.player.updateHeat(-enforcerResult.totalHeatReduction);
      }
    }

    // 4. OD EVENTS
    for (const od of incomeResult.allOdEvents) {
      stores.player.updateHeat(od.heatSpike);
      const odEvent = createEvent(
        'od',
        '💀 Customer OD',
        `A customer OD'd on ${od.drugName} from ${od.memberName}'s spot. Heat +${od.heatSpike}.`,
        'danger',
      );
      setLastEvent(odEvent);
      stores.notifications.addNotification({
        type: 'danger',
        title: odEvent.title,
        message: odEvent.message,
        priority: 'high',
        timestamp: Date.now(),
      });
    }

    // 5. RAID CHECK
    const updatedHeat = usePlayerStore.getState().player.heat;
    const raidHeatState: HeatState = {
      ...currentHeatState,
      level: updatedHeat,
    };

    // ── Interactive raid (Sprint 14-B) ──
    // A block at max heat hands control to PoliceRaidGame instead of
    // resolving in the background, and suppresses the dice roll below so
    // the same crew cannot be jailed twice for one tick.
    const blockStore = useBlockStore.getState();
    const raidTarget = selectRaidTarget(
      blockStore.blocks,
      lastRaidTickRef.current,
      tickRef.current,
    );

    if (raidTarget) {
      lastRaidTickRef.current[raidTarget.blockId] = tickRef.current;
      blockStore.selectBlock(raidTarget.blockId);

      const raidWarning = createEvent(
        'raid',
        '🚨 RAID IN PROGRESS',
        'Heat maxed out. Police are hitting the block — get your people out.',
        'critical',
      );
      setLastEvent(raidWarning);
      stores.notifications.addNotification({
        type: 'danger',
        title: raidWarning.title,
        message: raidWarning.message,
        priority: 'critical',
        timestamp: Date.now(),
      });

      useNavigationStore.getState().navigateTo('raid');
    }

    if (!suppressesBackgroundRaid(raidTarget) && rollForRaid(raidHeatState)) {
      const memberIds = members.map((m) => m.id);
      const drugCount = stores.economy.inventory
        .filter((i) => i.type === 'drug')
        .reduce((sum, i) => sum + i.quantity, 0);
      const weaponCount = stores.economy.inventory
        .filter((i) => i.type === 'weapon')
        .reduce((sum, i) => sum + i.quantity, 0);

      const raidResult = executeRaid(
        updatedHeat,
        memberIds,
        drugCount,
        weaponCount,
        usePlayerStore.getState().player.money,
      );

      // Apply raid consequences
      if (raidResult.confiscatedMoney > 0) {
        stores.player.updateMoney(-raidResult.confiscatedMoney);
      }
      if (raidResult.confiscatedDrugs > 0) {
        const drugs = stores.economy.inventory.filter((i) => i.type === 'drug');
        let remaining = raidResult.confiscatedDrugs;
        for (const drug of drugs) {
          if (remaining <= 0) break;
          const toRemove = Math.min(drug.quantity, remaining);
          stores.economy.removeInventoryItem(drug.itemId, toRemove);
          remaining -= toRemove;
        }
        // Also confiscate from the drug inventory store
        const drugInv = useDrugInventory.getState();
        const drugList = drugInv.getInventoryList();
        let drugRemaining = raidResult.confiscatedDrugs;
        for (const d of drugList) {
          if (drugRemaining <= 0) break;
          // If the raid takes all of this drug, remove it entirely
          if (d.quantity <= drugRemaining) {
            drugInv.removeDrug(d.id);
            drugRemaining -= d.quantity;
          } else {
            // Partial confiscation: reduce quantity via consumeAssignedDrugs proxy
            // (removeDrug only does full removal; partial handled by consuming ticks)
            drugInv.removeDrug(d.id);
            // Re-add with reduced quantity
            drugInv.addDrug({
              id: d.id,
              name: d.name,
              tier: d.tier,
              quality: d.quality,
              quantity: d.quantity - drugRemaining,
              craftedAt: d.craftedAt,
              effects: d.effects,
            });
            drugRemaining = 0;
          }
        }
      }

      // Jail arrested members
      for (const memberId of raidResult.arrestedMembers) {
        stores.gang.jailMember(memberId);
      }

      // Reduce heat after raid
      stores.player.updateHeat(-raidResult.heatReduction);

      // Build bail costs array
      const bailCosts: Array<{ memberId: string; memberName: string; amount: number }> = [];
      raidResult.bailCosts.forEach((amount, memberId) => {
        const member = members.find((m) => m.id === memberId);
        bailCosts.push({
          memberId,
          memberName: member?.name || 'Unknown',
          amount,
        });
      });

      // Create raid event
      const raidEvent: RaidEvent = {
        id: `raid-${Date.now()}`,
        type: 'raid',
        title: `🚨 ${raidResult.severity.toUpperCase()} RAID 🚨`,
        message: `Police raided your block! ${raidResult.arrestedMembers.length} arrested, $${raidResult.confiscatedMoney} seized.`,
        severity: 'critical',
        timestamp: Date.now(),
        data: { result: raidResult, bailCosts },
      };

      setActiveRaid(raidEvent);
      setLastEvent(raidEvent);

      // Update heat state
      setHeatState((prev) => ({
        ...prev,
        lastRaidTime: Date.now(),
        level: usePlayerStore.getState().player.heat,
      }));

      stores.notifications.addNotification({
        type: 'danger',
        title: raidEvent.title,
        message: raidEvent.message,
        priority: 'critical',
        timestamp: Date.now(),
      });
    }

    // 6. MORALE CHECK (every 5 ticks) — enforces real consequences
    if (tickRef.current % LOOP_CONFIG.MORALE_CHECK_INTERVAL === 0) {
      const gangSize = members.length;
      if (gangSize > 0) {
        const jailedMembers = stores.gang.members.filter((m) => m.status === 'jailed');
        const woundedMembers = stores.gang.members.filter((m) => m.status === 'hospital');

        const factors: MoraleFactors = {
          baseMorale: 60,
          payOnTime: true,
          memberBailedOut: jailedMembers.length === 0,
          hospitalBillPaid: woundedMembers.length === 0,
          recentWins: 0,
          recentLosses: 0,
          memberDeaths: 0,
          gangSize,
          playerReputation: player.reputation,
        };

        let morale = calculateMorale(factors);

        // ── Abandonment penalty (Sprint 14-B) ──
        // Members left jailed or injured past the grace period cost the
        // crew morale every check, compounding until they are recovered.
        heldSinceRef.current = updateHeldSince(
          stores.gang.members,
          heldSinceRef.current,
          tickRef.current,
        );
        const abandoned = overdueMembers(
          stores.gang.members,
          heldSinceRef.current,
          tickRef.current,
        );
        if (abandoned.length > 0) {
          morale = applyAbandonmentPenalty(morale, abandoned.length);
          stores.notifications.addNotification({
            type: 'warning',
            title: 'Crew Left Behind',
            message: `${abandoned.length} ${abandoned.length === 1 ? 'member has' : 'members have'} been down more than ${RECOVERY_CONFIG.ABANDON_GRACE_TICKS} ticks. Morale is slipping — bail them out from the CREW app.`,
            priority: 'high',
            timestamp: Date.now(),
          });
        }

        setGangMorale(morale);

        const moraleDesc = getMoraleDescription(morale);
        if (moraleDesc.warning) {
          const moraleEvent = createEvent(
            'morale_warning',
            `⚠️ Morale: ${moraleDesc.label}`,
            moraleDesc.warning,
            morale < 15 ? 'critical' : 'warning',
          );
          setLastEvent(moraleEvent);
          stores.notifications.addNotification({
            type: morale < 15 ? 'danger' : 'warning',
            title: moraleEvent.title,
            message: moraleEvent.message,
            priority: morale < 15 ? 'critical' : 'high',
            timestamp: Date.now(),
          });
        }

        // ── Enforce morale consequences on each active member ──
        const activeMembers = stores.gang.getActiveMembers();
        for (const member of activeMembers) {
          const memberMorale = member.morale ?? morale;
          const consequences = getMoraleConsequences(memberMorale, member.id);
          const triggered = rollMoraleConsequences(consequences);

          for (const c of triggered) {
            switch (c.type) {
              case 'no_show': {
                // Member is deployed on a block — remove them silently
                const blockStore = useBlockStore.getState();
                for (const blockId of Object.keys(blockStore.blocks)) {
                  const block = blockStore.blocks[blockId];
                  if (block?.placements.some((p) => p.memberId === member.id)) {
                    blockStore.removeMemberFromBlock(blockId, member.id);
                  }
                }
                stores.notifications.addNotification({
                  type: 'warning',
                  title: `👻 No-Show: ${member.name}`,
                  message: `${member.name} didn't show up for their shift. Morale is too low.`,
                  priority: 'high',
                  timestamp: Date.now(),
                });
                break;
              }
              case 'desertion': {
                stores.gang.backdoorMember(member.id, 'Deserted due to low morale');
                stores.notifications.addNotification({
                  type: 'danger',
                  title: `🏃 Deserted: ${member.name}`,
                  message: `${member.name} left the crew. They couldn't take the pressure anymore.`,
                  priority: 'critical',
                  timestamp: Date.now(),
                });
                break;
              }
              case 'betrayal': {
                // Betrayal: member tips off police — big heat spike
                stores.player.updateHeat(20);
                stores.gang.backdoorMember(member.id, 'Betrayed the crew');
                stores.notifications.addNotification({
                  type: 'danger',
                  title: `🐀 Betrayal: ${member.name}`,
                  message: `${member.name} snitched! Heat +20. They're gone.`,
                  priority: 'critical',
                  timestamp: Date.now(),
                });
                break;
              }
              case 'friendly_fire': {
                // Friendly fire: wound a random other member
                const target = activeMembers.find((m) => m.id !== member.id);
                if (target) {
                  const newHp = Math.max(0, (target.health ?? 100) - 30);
                  stores.gang.updateMember(target.id, {
                    health: newHp,
                    status: newHp <= 0 ? 'hospital' : 'active',
                  });
                  stores.notifications.addNotification({
                    type: 'danger',
                    title: `🔫 Friendly Fire!`,
                    message: `${member.name} shot ${target.name} in a rage. ${target.name} is ${newHp <= 0 ? 'in the hospital' : 'wounded'}.`,
                    priority: 'critical',
                    timestamp: Date.now(),
                  });
                }
                break;
              }
              case 'mutiny': {
                // Mutiny: all members take a morale hit and one random member deserts
                for (const m of activeMembers) {
                  stores.gang.updateMember(m.id, {
                    morale: Math.max(0, (m.morale ?? 50) - 15),
                  });
                }
                const victim = activeMembers[Math.floor(Math.random() * activeMembers.length)];
                if (victim) {
                  stores.gang.backdoorMember(victim.id, 'Mutiny');
                }
                stores.notifications.addNotification({
                  type: 'danger',
                  title: '💀 MUTINY',
                  message: 'The crew is turning on each other. Someone left and everyone is shaken.',
                  priority: 'critical',
                  timestamp: Date.now(),
                });
                break;
              }
            }
          }
        }
      }
    }

    // 7. RANDOM EVENTS (5% chance per tick)
    if (Math.random() < LOOP_CONFIG.RANDOM_EVENT_CHANCE) {
      const template = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
      template.effect(stores);

      const randomEvent = createEvent(
        'random_event',
        template.title,
        template.message,
        template.severity,
      );
      setLastEvent(randomEvent);

      stores.notifications.addNotification({
        type: template.severity === 'danger' ? 'danger' : template.severity === 'warning' ? 'warning' : 'info',
        title: template.title,
        message: template.message,
        priority: template.severity === 'danger' ? 'high' : 'normal',
        timestamp: Date.now(),
      });
    }

    // Update heat state for next tick
    setHeatState((prev) => ({
      ...prev,
      level: usePlayerStore.getState().player.heat,
      lastDecayTime: Date.now(),
    }));
  }, [getStores, createEvent, heatState]);

  const start = useCallback(() => {
    if (intervalRef.current) return;
    setIsRunning(true);
    intervalRef.current = setInterval(processTick, LOOP_CONFIG.TICK_INTERVAL_MS);
  }, [processTick]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const dismissRaid = useCallback(() => {
    setActiveRaid(null);
  }, []);

  const payBail = useCallback((memberId: string) => {
    if (!activeRaid) return;
    const bail = activeRaid.data.bailCosts.find((b) => b.memberId === memberId);
    if (!bail) return;

    const playerStore = usePlayerStore.getState();
    if (playerStore.player.money < bail.amount) return;

    playerStore.updateMoney(-bail.amount);
    useGangStore.getState().releaseMember(memberId);

    // Remove from bail costs
    setActiveRaid((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        data: {
          ...prev.data,
          bailCosts: prev.data.bailCosts.filter((b) => b.memberId !== memberId),
          result: {
            ...prev.data.result,
            arrestedMembers: prev.data.result.arrestedMembers.filter((id) => id !== memberId),
          },
        },
      };
    });
  }, [activeRaid]);

  const leaveMember = useCallback((memberId: string) => {
    if (!activeRaid) return;
    const bail = activeRaid.data.bailCosts.find((b) => b.memberId === memberId);
    if (!bail) return;

    // Apply morale penalty
    const gangStore = useGangStore.getState();
    const currentMembers = gangStore.getActiveMembers();
    // Morale drop for everyone
    for (const member of currentMembers) {
      const currentMorale = member.morale ?? 50;
      gangStore.updateMember(member.id, {
        morale: Math.max(0, currentMorale - 10),
      });
    }

    // Remove from bail costs
    setActiveRaid((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        data: {
          ...prev.data,
          bailCosts: prev.data.bailCosts.filter((b) => b.memberId !== memberId),
        },
      };
    });

    useNotificationStore.getState().addNotification({
      type: 'warning',
      title: '😤 Crew Upset',
      message: `You left ${bail.memberName} locked up. Morale dropped for everyone.`,
      priority: 'high',
    });
  }, [activeRaid]);

  // Auto-start on mount
  useEffect(() => {
    start();
    return () => stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isRunning,
    tickCount,
    lastEvent,
    activeRaid,
    incomePerMinute,
    gangMorale,
    heatState,
    start,
    stop,
    dismissRaid,
    payBail,
    leaveMember,
  };
}
