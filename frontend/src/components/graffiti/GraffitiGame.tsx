// ============================================================
// DEALT/SLIDE — Graffiti/Vandalism Mini-Game (Enhanced)
// Full encounter system with K9s, weapons, member leveling,
// custom messages, graffiti preview, and newsletter integration.
// ============================================================

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePlayerStore, useGangStore, useNavigationStore, useNotificationStore } from '../../stores/gameStore';
import { GRAFFITI_STYLES, getStyleConfig, calculateSprayTime, generateGraffiti, generateAllGraffitiOptions } from '../../utils/graffitiEngine';
import type { GraffitiStyleType, GraffitiOption, GraffitiMember, GangProfile } from '../../types/game.types';
import './GraffitiGame.css';

// ─── Types ───
type GamePhase = 'select-target' | 'assign-crew' | 'choose-art' | 'preview-placement' | 'spraying' | 'encounter' | 'results';

interface TargetBlock {
  id: string;
  name: string;
  owner: string;
  defenseLevel: number;
  distance: number;
  activeGraffiti: ActiveTag[];
  defenders: BlockDefender[];
}

interface ActiveTag {
  gangName: string;
  style: GraffitiStyleType;
  placedAt: string;
  fadeLevel: number;
}

interface BlockDefender {
  type: 'recruit' | 'enforcer' | 'shooter' | 'k9';
  name: string;
  weapon?: string;
  level: number;
}

interface AssignedMember {
  memberId: string;
  name: string;
  originalRole: string;
  assignedRole: 'painter' | 'shooter';
  level: number;
  weapon?: string;
  status: 'ready' | 'spraying' | 'fighting' | 'wounded' | 'dead' | 'arrested' | 'escaped';
}

interface EncounterEvent {
  type: 'k9-attack' | 'fistfight' | 'armed-fight' | 'shooter-encounter' | 'cops' | 'resident';
  title: string;
  message: string;
  defenderInvolved?: BlockDefender;
  autoResolve: boolean;
  options: EncounterOption[];
}

interface EncounterOption {
  label: string;
  action: string;
  risk: number;
  description: string;
}

interface MissionResult {
  success: boolean;
  artQuality: number;
  xpEarned: number;
  moraleChange: number;
  heatGained: number;
  moneyEarned: number;
  casualties: { memberId: string; name: string; outcome: string }[];
  levelUps: { memberId: string; name: string; from: string; to: string }[];
  graffitiPlaced?: GraffitiOption;
  newsletterEntry: string;
}

interface PlacementSpot {
  id: string;
  label: string;
  type: 'wall' | 'building' | 'sidewalk' | 'fence' | 'overpass';
  visibility: number; // 1-5
  risk: number; // 1-5
}

// ─── Mock Data ───
const PLACEMENT_SPOTS: PlacementSpot[] = [
  { id: 'p1', label: 'Main Wall (Street-facing)', type: 'wall', visibility: 5, risk: 5 },
  { id: 'p2', label: 'Side Building', type: 'building', visibility: 3, risk: 3 },
  { id: 'p3', label: 'Back Alley Fence', type: 'fence', visibility: 2, risk: 1 },
  { id: 'p4', label: 'Overpass Column', type: 'overpass', visibility: 4, risk: 2 },
  { id: 'p5', label: 'Sidewalk (Ground)', type: 'sidewalk', visibility: 3, risk: 4 },
];

const MOCK_TARGETS: TargetBlock[] = [
  {
    id: 'b1', name: '4th & Main', owner: 'Eastside Demons', defenseLevel: 2, distance: 3,
    activeGraffiti: [],
    defenders: [
      { type: 'recruit', name: 'Lil D', level: 2 },
    ],
  },
  {
    id: 'b2', name: 'MLK & Broadway', owner: 'Northside Crew', defenseLevel: 4, distance: 5,
    activeGraffiti: [{ gangName: 'Rollin 60s', style: 'throwup', placedAt: new Date(Date.now() - 48 * 3600000).toISOString(), fadeLevel: 33 }],
    defenders: [
      { type: 'enforcer', name: 'Big Mike', weapon: 'bat', level: 4 },
      { type: 'k9', name: 'Rex', level: 3 },
    ],
  },
  {
    id: 'b3', name: 'Compton Ave', owner: 'Westside Bloods', defenseLevel: 1, distance: 2,
    activeGraffiti: [],
    defenders: [],
  },
  {
    id: 'b4', name: '108th & Figueroa', owner: 'Southside Kings', defenseLevel: 3, distance: 4,
    activeGraffiti: [{ gangName: 'Eastside Demons', style: 'piece', placedAt: new Date(Date.now() - 12 * 3600000).toISOString(), fadeLevel: 83 }],
    defenders: [
      { type: 'enforcer', name: 'Razor', weapon: 'blade', level: 5 },
      { type: 'recruit', name: 'Shorty', level: 1 },
    ],
  },
  {
    id: 'b5', name: 'Crenshaw & Slauson', owner: 'Rollin 60s', defenseLevel: 5, distance: 7,
    activeGraffiti: [],
    defenders: [
      { type: 'shooter', name: 'Ghost', weapon: '9mm', level: 6 },
      { type: 'enforcer', name: 'Tank', weapon: 'brass-knuckles', level: 5 },
      { type: 'k9', name: 'Cerberus', level: 4 },
    ],
  },
];

// ─── Weapon Damage Table ───
const WEAPON_POWER: Record<string, number> = {
  'fists': 10,
  'brass-knuckles': 20,
  'bat': 25,
  'blade': 30,
  'razor-blade': 28,
  'stun-gun': 35,
  'bear-mace': 32,
  '9mm': 60,
  'shotgun': 75,
  'ak': 85,
};

// ─── Encounter Resolution ───
function resolveDefenderEncounter(
  attacker: AssignedMember,
  defender: BlockDefender,
  hasShooterBackup: boolean
): { attackerOutcome: string; defenderOutcome: string; description: string } {
  const attackerPower = WEAPON_POWER[attacker.weapon || 'fists'] + attacker.level * 5;
  const defenderPower = WEAPON_POWER[defender.weapon || 'fists'] + defender.level * 5;

  if (defender.type === 'k9') {
    // K9s chase and bite — can be shot by shooters
    if (hasShooterBackup) {
      return { attackerOutcome: 'safe', defenderOutcome: 'dead', description: `Your shooter took out ${defender.name} the K9 before it reached the painters.` };
    }
    const roll = Math.random() * 100;
    if (roll < 40) {
      return { attackerOutcome: 'wounded', defenderOutcome: 'chased-off', description: `${defender.name} bit ${attacker.name} before being chased off! ${attacker.name} is wounded.` };
    }
    return { attackerOutcome: 'safe', defenderOutcome: 'chased-off', description: `${defender.name} barked and chased but ${attacker.name} dodged the K9.` };
  }

  if (defender.type === 'shooter') {
    // Shooters are lethal — only counter is your own shooters
    if (hasShooterBackup) {
      const roll = Math.random() * 100;
      if (roll < 60) {
        return { attackerOutcome: 'safe', defenderOutcome: 'dead', description: `Shootout! Your shooter dropped ${defender.name} before they could fire.` };
      }
      return { attackerOutcome: 'dead', defenderOutcome: 'wounded', description: `Shootout! ${defender.name} got ${attacker.name} first. Your shooter wounded ${defender.name} but it's too late.` };
    }
    return { attackerOutcome: 'dead', defenderOutcome: 'safe', description: `${defender.name} pulled up and shot ${attacker.name}. No shooter backup — fatal.` };
  }

  // Recruit or Enforcer — fistfight / armed fight
  const roll = Math.random() * (attackerPower + defenderPower);
  if (roll < attackerPower) {
    return { attackerOutcome: 'safe', defenderOutcome: 'wounded', description: `${attacker.name} beat ${defender.name} in the fight! ${defender.weapon ? `Their ${defender.weapon} wasn't enough.` : 'Fists flew.'}` };
  }
  if (roll < attackerPower + defenderPower * 0.5) {
    return { attackerOutcome: 'wounded', defenderOutcome: 'wounded', description: `Both ${attacker.name} and ${defender.name} took hits. Bloody draw.` };
  }
  return { attackerOutcome: 'wounded', defenderOutcome: 'safe', description: `${defender.name} got the better of ${attacker.name}. ${defender.weapon ? `That ${defender.weapon} did damage.` : ''}` };
}

// ─── Level Up Logic ───
function checkLevelUp(member: AssignedMember, xpGained: number): { leveled: boolean; newRole: string } | null {
  const totalXP = xpGained + member.level * 20;
  // Recruit → Enforcer at 50 XP
  if (member.originalRole === 'recruit' && totalXP >= 50) {
    return { leveled: true, newRole: 'enforcer' };
  }
  // Enforcer → Low-grade Shooter or Dealer at 120 XP
  if (member.originalRole === 'enforcer' && totalXP >= 120) {
    return { leveled: true, newRole: member.assignedRole === 'shooter' ? 'shooter' : 'dealer' };
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function GraffitiGame() {
  const { player } = usePlayerStore();
  const { members } = useGangStore();
  const { goBack } = useNavigationStore();
  const addNotification = useNotificationStore?.()?.addNotification;

  const gangProfile = player.gangProfile;
  const primaryColor = gangProfile?.primaryColor || player.gangColor || '#ff4444';
  const secondaryColor = gangProfile?.secondaryColor || '#ffffff';
  const gangName = gangProfile?.name || player.gangName || 'My Gang';

  // ─── State ───
  const [phase, setPhase] = useState<GamePhase>('select-target');
  const [selectedTarget, setSelectedTarget] = useState<TargetBlock | null>(null);
  const [assignedCrew, setAssignedCrew] = useState<AssignedMember[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<GraffitiStyleType>('tag');
  const [customMessage, setCustomMessage] = useState('');
  const [useCustomMessage, setUseCustomMessage] = useState(false);
  const [selectedPlacement, setSelectedPlacement] = useState<PlacementSpot | null>(null);
  const [graffitiPreview, setGraffitiPreview] = useState<string>('');

  // Spraying state
  const [sprayProgress, setSprayProgress] = useState(0);
  const [sprayActive, setSprayActive] = useState(false);
  const [timingZone, setTimingZone] = useState(50);
  const [timingDirection, setTimingDirection] = useState(1);
  const [timingHits, setTimingHits] = useState(0);
  const [timingTotal, setTimingTotal] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const sprayTimerRef = useRef<ReturnType<typeof setInterval>>();

  // Encounter state
  const [encounterQueue, setEncounterQueue] = useState<EncounterEvent[]>([]);
  const [currentEncounter, setCurrentEncounter] = useState<EncounterEvent | null>(null);
  const [encounterLog, setEncounterLog] = useState<string[]>([]);

  // Results
  const [results, setResults] = useState<MissionResult | null>(null);

  // ─── Derived ───
  const painters = assignedCrew.filter(c => c.assignedRole === 'painter');
  const shooters = assignedCrew.filter(c => c.assignedRole === 'shooter');
  const alivePainters = painters.filter(c => c.status === 'ready' || c.status === 'spraying');
  const aliveShooters = shooters.filter(c => c.status === 'ready');

  const availableMembers = useMemo(() => {
    return members.filter(m =>
      m.status !== 'dead' &&
      m.status !== 'arrested' &&
      m.status !== 'jailed' &&
      !assignedCrew.some(c => c.memberId === m.id)
    );
  }, [members, assignedCrew]);

  const artText = useCustomMessage && customMessage.trim() ? customMessage.trim() : gangName;

  // ─── Generate preview when style/text changes ───
  useEffect(() => {
    const svg = generateGraffiti(artText, selectedStyle, primaryColor, secondaryColor);
    setGraffitiPreview(svg);
  }, [artText, selectedStyle, primaryColor, secondaryColor]);

  // ─── Timing mini-game animation ───
  useEffect(() => {
    if (phase === 'spraying' && sprayActive) {
      timerRef.current = setInterval(() => {
        setTimingZone(prev => {
          let next = prev + timingDirection * 2.5;
          if (next >= 100 || next <= 0) {
            setTimingDirection(d => -d);
            next = Math.max(0, Math.min(100, next));
          }
          return next;
        });
      }, 30);
      return () => clearInterval(timerRef.current);
    }
  }, [phase, sprayActive, timingDirection]);

  // ─── Spray progress timer ───
  useEffect(() => {
    if (phase === 'spraying' && sprayActive) {
      const config = getStyleConfig(selectedStyle);
      const totalTime = calculateSprayTime(config.timeSeconds, alivePainters.length) * 1000;
      const tickMs = 100;
      const increment = 100 / (totalTime / tickMs);

      sprayTimerRef.current = setInterval(() => {
        setSprayProgress(prev => {
          const next = prev + increment;
          if (next >= 100) {
            clearInterval(sprayTimerRef.current);
            setSprayActive(false);
            checkForEncounters();
            return 100;
          }
          // Random mid-spray encounter chance based on defense level
          if (selectedTarget && next > 30 && next < 80 && Math.random() < 0.003 * selectedTarget.defenseLevel) {
            triggerMidSprayEncounter();
          }
          return next;
        });
      }, tickMs);
      return () => clearInterval(sprayTimerRef.current);
    }
  }, [phase, sprayActive, selectedStyle, alivePainters.length, selectedTarget]);

  // ─── Crew Management ───
  const assignMember = (memberId: string, role: 'painter' | 'shooter') => {
    if (assignedCrew.length >= 8) return;
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const weapon = (member as any).equippedWeapon || (member.role === 'enforcer' ? 'brass-knuckles' : undefined);

    setAssignedCrew(prev => [...prev, {
      memberId,
      name: member.name,
      originalRole: member.role,
      assignedRole: role,
      level: (member as any).shooting || (member as any).dealing || 1,
      weapon,
      status: 'ready',
    }]);
  };

  const removeMember = (memberId: string) => {
    setAssignedCrew(prev => prev.filter(c => c.memberId !== memberId));
  };

  // ─── Timing Tap ───
  const handleTimingTap = () => {
    if (!sprayActive) return;
    setTimingTotal(t => t + 1);
    if (timingZone >= 35 && timingZone <= 65) {
      setTimingHits(h => h + 1);
    }
  };

  // ─── Start Spraying ───
  const startSpraying = () => {
    setSprayActive(true);
    setSprayProgress(0);
    setTimingHits(0);
    setTimingTotal(0);
    setAssignedCrew(prev => prev.map(c => ({
      ...c,
      status: c.assignedRole === 'painter' ? 'spraying' as const : 'ready' as const,
    })));
  };

  // ─── Encounter System ───
  const triggerMidSprayEncounter = () => {
    // Pause spray for a random encounter
    clearInterval(sprayTimerRef.current);
    setSprayActive(false);

    const copEncounter: EncounterEvent = {
      type: 'cops',
      title: 'POLICE!',
      message: 'Patrol car spotted! Sirens in the distance...',
      autoResolve: false,
      options: [
        { label: 'Hide & Wait', action: 'hide', risk: 15, description: 'Duck behind cover until they pass' },
        { label: 'Keep Spraying', action: 'continue', risk: 50, description: 'Risky — might get caught' },
        { label: 'Scatter & Regroup', action: 'scatter', risk: 5, description: 'Safe but wastes time' },
      ],
    };
    setCurrentEncounter(copEncounter);
    setPhase('encounter');
  };

  const checkForEncounters = () => {
    if (!selectedTarget || selectedTarget.defenders.length === 0) {
      finishMission(true);
      return;
    }

    // Build encounter queue from block defenders
    const encounters: EncounterEvent[] = selectedTarget.defenders.map(def => {
      if (def.type === 'k9') {
        return {
          type: 'k9-attack' as const,
          title: 'K9 ATTACK!',
          message: `${def.name} the guard dog is charging at your painters!`,
          defenderInvolved: def,
          autoResolve: aliveShooters.length > 0,
          options: aliveShooters.length > 0
            ? [{ label: 'Shooter handles it', action: 'shoot', risk: 5, description: `Your shooter takes aim at ${def.name}` }]
            : [
                { label: 'Distract with food', action: 'distract', risk: 20, description: 'Throw some food to lure the dog away' },
                { label: 'Fight the dog', action: 'fight', risk: 40, description: 'Kick and punch — risky' },
                { label: 'Run!', action: 'abort', risk: 0, description: 'Abandon the mission' },
              ],
        };
      }
      if (def.type === 'shooter') {
        return {
          type: 'shooter-encounter' as const,
          title: 'SHOOTER!',
          message: `${def.name} pulled up with a ${def.weapon || 'gun'}! This is life or death!`,
          defenderInvolved: def,
          autoResolve: false,
          options: aliveShooters.length > 0
            ? [
                { label: 'Return fire!', action: 'shootout', risk: 35, description: 'Your shooters engage — heat will spike' },
                { label: 'Scatter!', action: 'scatter', risk: 20, description: 'Everyone runs — some might not make it' },
              ]
            : [
                { label: 'Surrender', action: 'surrender', risk: 10, description: 'Hands up — might get robbed or worse' },
                { label: 'Run!', action: 'abort', risk: 30, description: 'Sprint for the car — they might shoot' },
              ],
        };
      }
      // Recruit or Enforcer — fistfight / armed fight
      const fightType = def.weapon ? 'armed-fight' : 'fistfight';
      return {
        type: fightType as 'armed-fight' | 'fistfight',
        title: def.weapon ? 'ARMED FIGHT!' : 'FISTFIGHT!',
        message: `${def.name} (${def.type}) ${def.weapon ? `pulled out a ${def.weapon} and` : ''} is coming at your crew!`,
        defenderInvolved: def,
        autoResolve: false,
        options: [
          { label: 'Fight back', action: 'fight', risk: def.weapon ? 40 : 25, description: `Your crew engages ${def.name}` },
          { label: 'Send shooter', action: 'shoot', risk: 10, description: aliveShooters.length > 0 ? `Shooter handles ${def.name} — raises heat` : 'No shooters available!' },
          { label: 'Fall back', action: 'abort', risk: 5, description: 'Retreat — mission incomplete' },
        ],
      };
    });

    if (encounters.length > 0) {
      setEncounterQueue(encounters.slice(1));
      setCurrentEncounter(encounters[0]);
      setPhase('encounter');
    } else {
      finishMission(true);
    }
  };

  const handleEncounterChoice = (action: string, risk: number) => {
    if (!currentEncounter) return;

    let logEntry = '';
    const casualties: { memberId: string; name: string; outcome: string }[] = [];

    if (action === 'abort') {
      setEncounterLog(prev => [...prev, 'Mission aborted — crew retreated.']);
      finishMission(false);
      return;
    }

    if (action === 'scatter') {
      // Some members might get caught
      assignedCrew.forEach(c => {
        if (c.status === 'dead' || c.status === 'arrested') return;
        if (Math.random() < risk / 100) {
          casualties.push({ memberId: c.memberId, name: c.name, outcome: 'arrested' });
          c.status = 'arrested';
        }
      });
      logEntry = casualties.length > 0
        ? `Scattered! ${casualties.map(c => c.name).join(', ')} got caught.`
        : 'Everyone scattered safely.';
      setEncounterLog(prev => [...prev, logEntry]);
      // If cops, mission is over
      if (currentEncounter.type === 'cops') {
        finishMission(sprayProgress >= 80, casualties);
        return;
      }
    }

    if (action === 'hide') {
      const caught = Math.random() < risk / 100;
      logEntry = caught ? 'Hiding failed — cops spotted your crew!' : 'Cops passed by. Resuming spray...';
      setEncounterLog(prev => [...prev, logEntry]);
      if (caught) {
        assignedCrew.forEach(c => {
          if (c.status !== 'dead') {
            casualties.push({ memberId: c.memberId, name: c.name, outcome: 'arrested' });
            c.status = 'arrested';
          }
        });
        finishMission(false, casualties);
        return;
      }
      // Resume spraying
      setPhase('spraying');
      setSprayActive(true);
      return;
    }

    if (action === 'continue') {
      const caught = Math.random() < risk / 100;
      if (caught) {
        logEntry = 'Cops caught your crew red-handed!';
        assignedCrew.forEach(c => {
          if (c.status !== 'dead') {
            casualties.push({ memberId: c.memberId, name: c.name, outcome: 'arrested' });
          }
        });
        setEncounterLog(prev => [...prev, logEntry]);
        finishMission(false, casualties);
        return;
      }
      logEntry = 'Cops drove past — kept spraying like nothing happened.';
      setEncounterLog(prev => [...prev, logEntry]);
      setPhase('spraying');
      setSprayActive(true);
      return;
    }

    // Combat encounters
    if ((action === 'fight' || action === 'shoot' || action === 'shootout') && currentEncounter.defenderInvolved) {
      const defender = currentEncounter.defenderInvolved;
      const fighter = action === 'shoot' || action === 'shootout'
        ? aliveShooters[0] || alivePainters[0]
        : alivePainters[0] || aliveShooters[0];

      if (fighter) {
        const hasShooter = action === 'shoot' || action === 'shootout' || aliveShooters.length > 0;
        const result = resolveDefenderEncounter(fighter, defender, hasShooter);

        if (result.attackerOutcome === 'dead') {
          casualties.push({ memberId: fighter.memberId, name: fighter.name, outcome: 'dead' });
          setAssignedCrew(prev => prev.map(c => c.memberId === fighter.memberId ? { ...c, status: 'dead' as const } : c));
        } else if (result.attackerOutcome === 'wounded') {
          setAssignedCrew(prev => prev.map(c => c.memberId === fighter.memberId ? { ...c, status: 'wounded' as const } : c));
        }

        logEntry = result.description;
        if (action === 'shoot' || action === 'shootout') {
          logEntry += ' 🔥 Heat +5 (gunshots heard)';
        }
      } else {
        logEntry = 'No one left to fight!';
      }
    }

    if (action === 'distract') {
      const success = Math.random() > risk / 100;
      logEntry = success
        ? `Threw some food — ${currentEncounter.defenderInvolved?.name || 'the dog'} went for it!`
        : `${currentEncounter.defenderInvolved?.name || 'The dog'} ignored the food and bit your painter!`;
      if (!success && alivePainters[0]) {
        setAssignedCrew(prev => prev.map(c => c.memberId === alivePainters[0].memberId ? { ...c, status: 'wounded' as const } : c));
      }
    }

    if (action === 'surrender') {
      logEntry = 'Your crew surrendered. They took your paint and money.';
      assignedCrew.forEach(c => {
        if (c.status !== 'dead') {
          casualties.push({ memberId: c.memberId, name: c.name, outcome: 'arrested' });
        }
      });
      setEncounterLog(prev => [...prev, logEntry]);
      finishMission(false, casualties);
      return;
    }

    setEncounterLog(prev => [...prev, logEntry]);

    // Next encounter or finish
    if (encounterQueue.length > 0) {
      setCurrentEncounter(encounterQueue[0]);
      setEncounterQueue(prev => prev.slice(1));
    } else {
      // Check if we have painters left
      const remainingPainters = assignedCrew.filter(c => c.assignedRole === 'painter' && (c.status === 'ready' || c.status === 'spraying' || c.status === 'wounded'));
      if (remainingPainters.length > 0 && sprayProgress >= 90) {
        finishMission(true, casualties);
      } else if (remainingPainters.length > 0) {
        finishMission(false, casualties);
      } else {
        finishMission(false, casualties);
      }
    }
  };

  // ─── Finish Mission ───
  const finishMission = (success: boolean, extraCasualties: { memberId: string; name: string; outcome: string }[] = []) => {
    clearInterval(timerRef.current);
    clearInterval(sprayTimerRef.current);

    const config = getStyleConfig(selectedStyle);
    const accuracy = timingTotal > 0 ? Math.round((timingHits / timingTotal) * 100) : 50;
    const qualityMultiplier = accuracy / 100;

    const xpBase = success ? config.xpReward : Math.round(config.xpReward * 0.1);
    const xpEarned = Math.round(xpBase * qualityMultiplier);
    const moraleChange = success ? config.moraleBoost : -10;
    const heatGained = success ? Math.ceil(config.timeSeconds / 20) : 1;
    const moneyEarned = success ? Math.round(config.xpReward * 2 * qualityMultiplier) : 0;

    // Gather all casualties
    const allCasualties = [
      ...extraCasualties,
      ...assignedCrew.filter(c => c.status === 'dead').map(c => ({ memberId: c.memberId, name: c.name, outcome: 'dead' })),
      ...assignedCrew.filter(c => c.status === 'arrested').map(c => ({ memberId: c.memberId, name: c.name, outcome: 'arrested' })),
      ...assignedCrew.filter(c => c.status === 'wounded').map(c => ({ memberId: c.memberId, name: c.name, outcome: 'wounded' })),
    ];
    // Deduplicate
    const uniqueCasualties = allCasualties.filter((c, i, arr) => arr.findIndex(x => x.memberId === c.memberId) === i);

    // Check level ups for surviving painters
    const levelUps: { memberId: string; name: string; from: string; to: string }[] = [];
    if (success) {
      assignedCrew.forEach(c => {
        if (c.status === 'dead' || c.status === 'arrested') return;
        const lu = checkLevelUp(c, xpEarned);
        if (lu?.leveled) {
          levelUps.push({ memberId: c.memberId, name: c.name, from: c.originalRole, to: lu.newRole });
        }
      });
    }

    // Build graffiti option for placement
    const graffitiPlaced = success ? {
      id: `graffiti-${Date.now()}`,
      style: selectedStyle,
      text: artText,
      svgData: graffitiPreview,
      createdAt: new Date().toISOString(),
    } : undefined;

    // Newsletter entry
    const newsletterEntry = success
      ? `🎨 ${gangName} tagged ${selectedTarget?.name || 'unknown block'} with a ${config.name} style piece. Quality: ${accuracy}%. The art will be visible for 3 days.`
      : `💀 ${gangName} attempted to tag ${selectedTarget?.name || 'unknown block'} but the mission failed. ${uniqueCasualties.length > 0 ? `${uniqueCasualties.length} casualties reported.` : 'No casualties.'}`;

    // Apply game state changes
    if (success) {
      usePlayerStore.getState().updateMoney(moneyEarned);
    }
    // Add heat
    const shootingHeat = encounterLog.filter(l => l.includes('Heat')).length * 5;
    usePlayerStore.getState().updateHeat?.(heatGained + shootingHeat);

    // Notification
    if (addNotification) {
      addNotification({
        type: success ? 'success' : 'danger',
        title: success ? 'Tag Complete!' : 'Mission Failed',
        message: newsletterEntry,
      });
    }

    setResults({
      success,
      artQuality: accuracy,
      xpEarned,
      moraleChange,
      heatGained: heatGained + shootingHeat,
      moneyEarned,
      casualties: uniqueCasualties,
      levelUps,
      graffitiPlaced,
      newsletterEntry,
    });
    setPhase('results');
  };

  // ─── Reset ───
  const resetGame = () => {
    setPhase('select-target');
    setSelectedTarget(null);
    setAssignedCrew([]);
    setSelectedStyle('tag');
    setCustomMessage('');
    setUseCustomMessage(false);
    setSelectedPlacement(null);
    setGraffitiPreview('');
    setSprayProgress(0);
    setSprayActive(false);
    setTimingHits(0);
    setTimingTotal(0);
    setEncounterQueue([]);
    setCurrentEncounter(null);
    setEncounterLog([]);
    setResults(null);
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="graffiti-game">
      {/* Header */}
      <div className="graffiti-header">
        <button className="graffiti-back" onClick={() => goBack()}>← Back</button>
        <h1>VANDALIZE</h1>
        <span className="graffiti-phase-label">{phase.replace(/-/g, ' ').toUpperCase()}</span>
      </div>

      {/* ─── PHASE: Select Target ─── */}
      {phase === 'select-target' && (
        <div className="graffiti-phase">
          <h2>Choose a Target Block</h2>
          <p className="phase-desc">Pick an opp's block to tag. Higher defense = more risk, more respect.</p>

          <div className="target-list">
            {MOCK_TARGETS.map(t => (
              <button
                key={t.id}
                className={`target-card ${selectedTarget?.id === t.id ? 'selected' : ''}`}
                onClick={() => setSelectedTarget(t)}
              >
                <div className="target-info">
                  <span className="target-name">{t.name}</span>
                  <span className="target-owner">{t.owner}</span>
                </div>
                <div className="target-stats">
                  <span className="target-defense">
                    {'🛡️'.repeat(t.defenseLevel)}{'⬜'.repeat(5 - t.defenseLevel)}
                  </span>
                  <span className="target-distance">{t.distance} blocks</span>
                </div>
                <div className="target-defenders">
                  {t.defenders.length === 0 && <span className="no-defenders">Unguarded</span>}
                  {t.defenders.map((d, i) => (
                    <span key={i} className={`defender-badge ${d.type}`}>
                      {d.type === 'k9' ? '🐕' : d.type === 'shooter' ? '🔫' : d.type === 'enforcer' ? '👊' : '👤'}
                      {d.name}
                      {d.weapon && <span className="defender-weapon">({d.weapon})</span>}
                    </span>
                  ))}
                </div>
                {t.activeGraffiti.length > 0 && (
                  <div className="target-tags">
                    {t.activeGraffiti.map((g, i) => (
                      <span key={i} className="existing-tag" style={{ opacity: g.fadeLevel / 100 }}>
                        🎨 {g.gangName} ({g.style}) — {g.fadeLevel}% visible
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>

          <button
            className="phase-next-btn"
            disabled={!selectedTarget}
            onClick={() => setPhase('assign-crew')}
          >
            Select Target →
          </button>
        </div>
      )}

      {/* ─── PHASE: Assign Crew ─── */}
      {phase === 'assign-crew' && (
        <div className="graffiti-phase">
          <h2>Assign Your Crew</h2>
          <p className="phase-desc">
            Painters spray the tag ({painters.length} = {painters.length > 1 ? `1/${painters.length} time` : 'normal time'}).
            Shooters protect them from defenders. Max 8 members.
          </p>

          <div className="crew-summary">
            <div className="crew-stat"><span className="crew-icon">🎨</span><span>{painters.length} Painters</span></div>
            <div className="crew-stat"><span className="crew-icon">🔫</span><span>{shooters.length} Shooters</span></div>
            <div className="crew-stat"><span className="crew-icon">👥</span><span>{assignedCrew.length}/8 Total</span></div>
            {selectedTarget && (
              <div className="crew-stat threat">
                <span className="crew-icon">⚠️</span>
                <span>{selectedTarget.defenders.length} Defenders</span>
              </div>
            )}
          </div>

          {/* Assigned crew */}
          {assignedCrew.length > 0 && (
            <div className="assigned-crew">
              <h3>Assigned</h3>
              <div className="assigned-list">
                {assignedCrew.map(c => (
                  <div key={c.memberId} className={`assigned-member ${c.assignedRole}`}>
                    <span className="assigned-role">{c.assignedRole === 'painter' ? '🎨' : '🔫'}</span>
                    <div className="assigned-info">
                      <span className="assigned-name">{c.name}</span>
                      <span className="assigned-detail">Lv.{c.level} {c.originalRole}{c.weapon ? ` (${c.weapon})` : ''}</span>
                    </div>
                    <button className="remove-btn" onClick={() => removeMember(c.memberId)}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available members */}
          <div className="available-members">
            <h3>Available ({availableMembers.length})</h3>
            {availableMembers.length === 0 ? (
              <p className="no-members">No available members. Recruit more in Contacts.</p>
            ) : (
              <div className="member-list">
                {availableMembers.slice(0, 12).map(m => (
                  <div key={m.id} className="member-row">
                    <span className="member-name">{m.name}</span>
                    <span className="member-role-badge">{m.role}</span>
                    <div className="assign-btns">
                      {m.role !== 'shooter' && (
                        <button className="assign-painter" onClick={() => assignMember(m.id, 'painter')} disabled={assignedCrew.length >= 8}>
                          🎨 Paint
                        </button>
                      )}
                      <button className="assign-shooter" onClick={() => assignMember(m.id, 'shooter')} disabled={assignedCrew.length >= 8}>
                        🔫 Guard
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="phase-nav">
            <button className="phase-back-btn" onClick={() => setPhase('select-target')}>← Back</button>
            <button className="phase-next-btn" disabled={painters.length === 0} onClick={() => setPhase('choose-art')}>
              Choose Art →
            </button>
          </div>
        </div>
      )}

      {/* ─── PHASE: Choose Art ─── */}
      {phase === 'choose-art' && (
        <div className="graffiti-phase">
          <h2>Choose Your Art</h2>
          <p className="phase-desc">Pick a graffiti style and optionally write a custom message.</p>

          {/* Custom message toggle */}
          <div className="custom-message-section">
            <label className="custom-toggle">
              <input type="checkbox" checked={useCustomMessage} onChange={e => setUseCustomMessage(e.target.checked)} />
              <span>Custom Message (instead of gang name)</span>
            </label>
            {useCustomMessage && (
              <input
                type="text"
                className="custom-message-input"
                placeholder="Type your message (max 20 chars)..."
                value={customMessage}
                onChange={e => setCustomMessage(e.target.value.substring(0, 20))}
                maxLength={20}
              />
            )}
          </div>

          {/* Graffiti preview */}
          <div className="graffiti-preview-box">
            <h3>Preview</h3>
            <div
              className="graffiti-preview-svg"
              dangerouslySetInnerHTML={{ __html: graffitiPreview }}
              style={{ background: '#333', borderRadius: 8, padding: 12 }}
            />
            <span className="preview-text">"{artText}" — {getStyleConfig(selectedStyle).name} style</span>
          </div>

          {/* Style selector */}
          <div className="style-options">
            {GRAFFITI_STYLES.map(s => {
              const sprayTime = calculateSprayTime(s.timeSeconds, painters.length);
              return (
                <button
                  key={s.type}
                  className={`style-option ${selectedStyle === s.type ? 'selected' : ''}`}
                  onClick={() => setSelectedStyle(s.type)}
                >
                  <div className="style-opt-header">
                    <span className="style-opt-name">{s.name}</span>
                    <span className={`style-opt-complexity ${s.complexity}`}>{s.complexity}</span>
                  </div>
                  <p className="style-opt-desc">{s.description}</p>
                  <div className="style-opt-stats">
                    <span>⏱ {sprayTime}s</span>
                    <span>⭐ +{s.xpReward} XP</span>
                    <span>💪 +{s.moraleBoost} Morale</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="phase-nav">
            <button className="phase-back-btn" onClick={() => setPhase('assign-crew')}>← Back</button>
            <button className="phase-next-btn" onClick={() => setPhase('preview-placement')}>
              Choose Placement →
            </button>
          </div>
        </div>
      )}

      {/* ─── PHASE: Preview Placement ─── */}
      {phase === 'preview-placement' && (
        <div className="graffiti-phase">
          <h2>Choose Placement</h2>
          <p className="phase-desc">Where on {selectedTarget?.name} should the crew spray? Higher visibility = more respect but more risk.</p>

          <div className="placement-grid">
            {PLACEMENT_SPOTS.map(spot => (
              <button
                key={spot.id}
                className={`placement-card ${selectedPlacement?.id === spot.id ? 'selected' : ''}`}
                onClick={() => setSelectedPlacement(spot)}
              >
                <div className="placement-header">
                  <span className="placement-icon">
                    {spot.type === 'wall' ? '🧱' : spot.type === 'building' ? '🏢' : spot.type === 'fence' ? '🚧' : spot.type === 'overpass' ? '🌉' : '🛤️'}
                  </span>
                  <span className="placement-label">{spot.label}</span>
                </div>
                <div className="placement-stats">
                  <span className="placement-vis">👁️ {'⬛'.repeat(spot.visibility)}{'⬜'.repeat(5 - spot.visibility)}</span>
                  <span className="placement-risk">⚠️ {'🔴'.repeat(spot.risk)}{'⬜'.repeat(5 - spot.risk)}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Preview on selected spot */}
          {selectedPlacement && (
            <div className="placement-preview">
              <div className="placement-scene" style={{ background: '#2a2a2a' }}>
                <div className="placement-surface" style={{
                  background: selectedPlacement.type === 'wall' ? '#5a4a3a' : selectedPlacement.type === 'building' ? '#4a4a5a' : '#3a4a3a',
                }}>
                  <div className="placement-graffiti" dangerouslySetInnerHTML={{ __html: graffitiPreview }} />
                </div>
              </div>
            </div>
          )}

          <div className="phase-nav">
            <button className="phase-back-btn" onClick={() => setPhase('choose-art')}>← Back</button>
            <button
              className="phase-next-btn"
              disabled={!selectedPlacement}
              onClick={() => { setPhase('spraying'); startSpraying(); }}
            >
              Start Mission →
            </button>
          </div>
        </div>
      )}

      {/* ─── PHASE: Spraying (Timing Mini-Game) ─── */}
      {phase === 'spraying' && (
        <div className="graffiti-phase spraying-phase">
          <h2>SPRAYING...</h2>
          <p className="phase-desc">Tap when the marker is in the green zone for better quality!</p>

          <div className="spray-target-info">
            <span>📍 {selectedTarget?.name}</span>
            <span>🎨 {getStyleConfig(selectedStyle).name}</span>
            <span>👥 {alivePainters.length} painters</span>
          </div>

          {/* Progress bar */}
          <div className="spray-progress-container">
            <div className="spray-progress-bar">
              <div className="spray-progress-fill" style={{ width: `${sprayProgress}%`, background: primaryColor }} />
            </div>
            <span className="spray-percent">{Math.round(sprayProgress)}%</span>
          </div>

          {/* Timing mini-game */}
          <div className="timing-game" onClick={handleTimingTap}>
            <div className="timing-track">
              <div className="timing-sweet-spot" />
              <div className="timing-indicator" style={{ left: `${timingZone}%`, background: primaryColor }} />
            </div>
            <div className="timing-label">TAP TO SPRAY</div>
          </div>

          {/* Graffiti forming */}
          <div className="spray-forming">
            <div
              className="spray-forming-svg"
              style={{ opacity: sprayProgress / 100, filter: `blur(${Math.max(0, 5 - sprayProgress / 20)}px)` }}
              dangerouslySetInnerHTML={{ __html: graffitiPreview }}
            />
          </div>

          <div className="spray-accuracy">
            <span>Accuracy: {timingTotal > 0 ? Math.round((timingHits / timingTotal) * 100) : 0}%</span>
            <span>Hits: {timingHits}/{timingTotal}</span>
          </div>
        </div>
      )}

      {/* ─── PHASE: Encounter ─── */}
      {phase === 'encounter' && currentEncounter && (
        <div className="graffiti-phase encounter-phase">
          <div className="encounter-alert">
            <span className="encounter-icon">
              {currentEncounter.type === 'k9-attack' ? '🐕' :
               currentEncounter.type === 'shooter-encounter' ? '🔫' :
               currentEncounter.type === 'cops' ? '🚔' :
               currentEncounter.type === 'armed-fight' ? '🔪' : '👊'}
            </span>
            <h2>{currentEncounter.title}</h2>
            <p className="encounter-message">{currentEncounter.message}</p>
          </div>

          {/* Encounter log */}
          {encounterLog.length > 0 && (
            <div className="encounter-log">
              {encounterLog.map((entry, i) => (
                <p key={i} className="log-entry">{entry}</p>
              ))}
            </div>
          )}

          {/* Crew status during encounter */}
          <div className="encounter-crew-status">
            {assignedCrew.map(c => (
              <span key={c.memberId} className={`crew-status-badge ${c.status}`}>
                {c.status === 'dead' ? '💀' : c.status === 'wounded' ? '🩹' : c.status === 'arrested' ? '🔒' : c.assignedRole === 'painter' ? '🎨' : '🔫'}
                {c.name}
              </span>
            ))}
          </div>

          <div className="encounter-options">
            {currentEncounter.options.map((opt, i) => (
              <button
                key={i}
                className={`encounter-btn risk-${opt.risk > 40 ? 'high' : opt.risk > 15 ? 'medium' : 'low'}`}
                onClick={() => handleEncounterChoice(opt.action, opt.risk)}
                disabled={opt.action === 'shoot' && aliveShooters.length === 0 && currentEncounter.type !== 'k9-attack'}
              >
                <span className="encounter-btn-label">{opt.label}</span>
                <span className="encounter-btn-desc">{opt.description}</span>
                <span className="encounter-btn-risk">Risk: {opt.risk}%</span>
              </button>
            ))}
          </div>

          {encounterQueue.length > 0 && (
            <p className="encounters-remaining">⚠️ {encounterQueue.length} more encounter{encounterQueue.length > 1 ? 's' : ''} ahead</p>
          )}
        </div>
      )}

      {/* ─── PHASE: Results ─── */}
      {phase === 'results' && results && (
        <div className="graffiti-phase results-phase">
          <div className={`results-banner ${results.success ? 'success' : 'fail'}`}>
            <span className="results-icon">{results.success ? '🎉' : '💀'}</span>
            <h2>{results.success ? 'TAG COMPLETE!' : 'MISSION FAILED'}</h2>
            {results.success && (
              <p className="results-subtitle">Art quality: {results.artQuality}% — visible for 3 days</p>
            )}
          </div>

          {/* Show the graffiti if successful */}
          {results.success && results.graffitiPlaced && (
            <div className="results-art-display">
              <div
                className="results-art-svg"
                dangerouslySetInnerHTML={{ __html: results.graffitiPlaced.svgData }}
                style={{ background: '#333', borderRadius: 8, padding: 12 }}
              />
              <span className="results-art-label">
                "{results.graffitiPlaced.text}" on {selectedTarget?.name} — {getStyleConfig(selectedStyle).name}
              </span>
            </div>
          )}

          <div className="results-stats">
            <div className="result-row"><span>XP Earned</span><span className="result-value positive">+{results.xpEarned}</span></div>
            <div className="result-row"><span>Money</span><span className={`result-value ${results.moneyEarned > 0 ? 'positive' : ''}`}>{results.moneyEarned > 0 ? '+' : ''}${results.moneyEarned}</span></div>
            <div className="result-row"><span>Morale</span><span className={`result-value ${results.moraleChange >= 0 ? 'positive' : 'negative'}`}>{results.moraleChange >= 0 ? '+' : ''}{results.moraleChange}</span></div>
            <div className="result-row"><span>Heat</span><span className="result-value negative">+{results.heatGained}</span></div>
          </div>

          {/* Level ups */}
          {results.levelUps.length > 0 && (
            <div className="results-levelups">
              <h3>🎖️ LEVEL UPS!</h3>
              {results.levelUps.map((lu, i) => (
                <div key={i} className="levelup-entry">
                  <span className="levelup-name">{lu.name}</span>
                  <span className="levelup-arrow">{lu.from} → {lu.to}</span>
                </div>
              ))}
            </div>
          )}

          {/* Casualties */}
          {results.casualties.length > 0 && (
            <div className="results-casualties">
              <h3>Casualties</h3>
              {results.casualties.map((c, i) => (
                <div key={i} className={`casualty-entry ${c.outcome}`}>
                  <span>{c.outcome === 'dead' ? '💀' : c.outcome === 'arrested' ? '🔒' : '🩹'}</span>
                  <span>{c.name}</span>
                  <span className="casualty-outcome">{c.outcome}</span>
                </div>
              ))}
            </div>
          )}

          {/* Encounter log */}
          {encounterLog.length > 0 && (
            <div className="results-encounter-log">
              <h3>Mission Log</h3>
              {encounterLog.map((entry, i) => (
                <p key={i} className="log-entry">{entry}</p>
              ))}
            </div>
          )}

          {/* Newsletter preview */}
          <div className="results-newsletter">
            <h3>📰 Weekly Newsletter Preview</h3>
            <p className="newsletter-entry">{results.newsletterEntry}</p>
          </div>

          <div className="results-actions">
            <button className="phase-next-btn" onClick={resetGame}>New Mission</button>
            <button className="phase-back-btn" onClick={() => goBack()}>Back to Home</button>
          </div>
        </div>
      )}
    </div>
  );
}
