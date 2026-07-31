// ============================================================
// MemberProgressPanel.tsx
// Shows a member's full progression state:
//   - XP progress bar with level and next-level preview
//   - Kills / Deals / Money earned counters
//   - Equipped drug (from useDrugInventory)
//   - Unlocked abilities at milestone levels
//   - Heat contribution warning for high-level members
// Sprint 11: member progression wiring
// ============================================================

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Zap, Target, ShoppingBag, DollarSign, Flame, Lock, Unlock } from 'lucide-react';
import { xpForLevel, totalXpForLevel, XP_CONFIG, ABILITY_MILESTONES } from '../../utils/memberProgression';
import { useDrugInventory } from '../../stores/useDrugInventory';
import type { GangMember } from '../../types/game.types';

// ─── Types ───────────────────────────────────────────────────

interface MemberProgressPanelProps {
  member: GangMember;
  compact?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────

function xpPercent(member: GangMember): number {
  const level = member.level ?? 1;
  const xp = member.experience ?? 0;
  const levelStart = totalXpForLevel(level);
  const levelEnd = totalXpForLevel(level + 1);
  if (levelEnd <= levelStart) return 100;
  return Math.min(100, Math.round(((xp - levelStart) / (levelEnd - levelStart)) * 100));
}

function xpInLevel(member: GangMember): { current: number; needed: number } {
  const level = member.level ?? 1;
  const xp = member.experience ?? 0;
  const levelStart = totalXpForLevel(level);
  const needed = xpForLevel(level);
  return { current: Math.max(0, xp - levelStart), needed };
}

function heatContribution(level: number): number {
  if (level < XP_CONFIG.HEAT_THRESHOLD_LEVEL) return 0;
  return Math.round((level - XP_CONFIG.HEAT_THRESHOLD_LEVEL + 1) * 2);
}

// ─── XP Bar ──────────────────────────────────────────────────

const XPBar: React.FC<{ member: GangMember }> = ({ member }) => {
  const pct = xpPercent(member);
  const { current, needed } = xpInLevel(member);
  const level = member.level ?? 1;

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-white/60 font-mono">
          LV <span className="text-neon-cyan font-bold">{level}</span>
        </span>
        <span className="text-xs text-white/40 font-mono">
          {current} / {needed} XP
        </span>
        <span className="text-xs text-white/40 font-mono">
          LV {level + 1}
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-purple"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
};

// ─── Stat Counter ────────────────────────────────────────────

const StatCounter: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color?: string;
}> = ({ icon, label, value, color = '#60a5fa' }) => (
  <div className="flex flex-col items-center gap-0.5 min-w-[56px]">
    <div style={{ color }} className="w-4 h-4">{icon}</div>
    <span className="text-sm font-bold text-white font-mono">{value}</span>
    <span className="text-[10px] text-white/40 uppercase tracking-wide">{label}</span>
  </div>
);

// ─── Ability Milestone Row ────────────────────────────────────

const AbilityRow: React.FC<{ level: number; ability: string; memberLevel: number; role: string }> = ({
  level,
  ability,
  memberLevel,
}) => {
  const unlocked = memberLevel >= level;
  return (
    <div
      className={`flex items-center gap-2 py-1 px-2 rounded text-xs ${
        unlocked ? 'bg-neon-green/10 text-neon-green' : 'bg-white/5 text-white/30'
      }`}
    >
      {unlocked ? (
        <Unlock className="w-3 h-3 flex-shrink-0" />
      ) : (
        <Lock className="w-3 h-3 flex-shrink-0" />
      )}
      <span className="flex-1">{ability}</span>
      <span className="font-mono text-[10px] opacity-60">LV{level}</span>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────

export const MemberProgressPanel: React.FC<MemberProgressPanelProps> = ({ member, compact = false }) => {
  const { getDealerDrug } = useDrugInventory();
  const equippedDrug = useMemo(() => getDealerDrug(member.id), [getDealerDrug, member.id]);
  const level = member.level ?? 1;
  const role = member.role ?? 'shooter';
  const heat = heatContribution(level);

  // Get role-specific milestones
  const milestones = useMemo(() => {
    const roleKey = role === 'dealer' ? 'dealer' : 'shooter';
    return (ABILITY_MILESTONES[roleKey] ?? []).slice(0, compact ? 3 : 6);
  }, [role, compact]);

  const moneyFormatted = useMemo(() => {
    const n = member.moneyEarned ?? 0;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
  }, [member.moneyEarned]);

  return (
    <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-3">
      {/* XP Progress */}
      <XPBar member={member} />

      {/* Stat counters */}
      <div className="flex justify-around border-t border-white/10 pt-3">
        <StatCounter
          icon={<Target className="w-4 h-4" />}
          label="Kills"
          value={member.kills ?? 0}
          color="#ef4444"
        />
        <StatCounter
          icon={<ShoppingBag className="w-4 h-4" />}
          label="Deals"
          value={member.dealsCompleted ?? 0}
          color="#4ade80"
        />
        <StatCounter
          icon={<DollarSign className="w-4 h-4" />}
          label="Earned"
          value={moneyFormatted}
          color="#facc15"
        />
        <StatCounter
          icon={<Zap className="w-4 h-4" />}
          label="Arrests"
          value={member.arrests ?? 0}
          color="#f97316"
        />
      </div>

      {/* Equipped drug */}
      {equippedDrug && (
        <div className="flex items-center gap-2 bg-neon-green/10 border border-neon-green/20 rounded-lg px-3 py-2">
          <span className="text-lg">💊</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-neon-green truncate">{equippedDrug.name}</div>
            <div className="text-[10px] text-white/40">
              Quality {equippedDrug.quality}% · Qty {equippedDrug.quantity}
            </div>
          </div>
          <div
            className="text-[10px] font-mono px-2 py-0.5 rounded-full"
            style={{
              background: equippedDrug.tier === 'legendary' ? '#7c3aed33' : equippedDrug.tier === 'exotic' ? '#0f3460' : '#16213e',
              color: equippedDrug.tier === 'legendary' ? '#a78bfa' : equippedDrug.tier === 'exotic' ? '#60a5fa' : '#4ade80',
            }}
          >
            {equippedDrug.tier?.toUpperCase()}
          </div>
        </div>
      )}

      {!equippedDrug && (
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/30">
          <span className="text-lg opacity-40">💊</span>
          <span className="text-xs">No drug assigned — assign from Block → Drugs tab</span>
        </div>
      )}

      {/* Heat warning for high-level members */}
      {heat > 0 && (
        <div className="flex items-center gap-2 bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2">
          <Flame className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-300">
            High profile — adds +{heat} heat/hr to the block
          </span>
        </div>
      )}

      {/* Ability milestones */}
      {!compact && milestones.length > 0 && (
        <div className="border-t border-white/10 pt-3">
          <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Abilities</div>
          <div className="space-y-1">
            {milestones.map((m) => (
              <AbilityRow
                key={m.level}
                level={m.level}
                ability={m.ability}
                memberLevel={level}
                role={role}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberProgressPanel;
