// ============================================================
// RoleContactCard — Sprint 16 (P1 + P2)
// Built from the contact-card mockup set: neon ring portrait,
// grunge name, role chip, LEVEL hex, two segmented stat bars,
// SEND TO BLOCK / CALL BACK actions. One data-driven template
// covers every role (Dealer, Shooter, Enforcer, Lookout, K9,
// Recruit) via ROLE_CARD_THEMES — new roles are one entry.
// ============================================================

import React from 'react';
import { motion } from 'framer-motion';
import { Crown, Phone, LayoutGrid, X } from 'lucide-react';
import './RoleContactCard.css';

// ─── Role themes (mockup color language) ─────────────────────
export interface RoleCardTheme {
  /** Neon accent — ring, chip, bars. */
  accent: string;
  /** Softer glow tint for shadows. */
  glow: string;
  /** Display label for the role chip. */
  label: string;
  /** Primary/secondary stat bar labels + which member field feeds them. */
  primary: { label: string; statKey: StatKey };
  secondary: { label: string; statKey: StatKey };
}

type StatKey =
  | 'shooting' | 'driving' | 'dealing' | 'loyalty'
  | 'morale' | 'heatResistance' | 'stealth';

// NOTE: statKey mappings are provisional — they surface the closest
// existing GangMember fields until role-specific stats (hustle, talk
// game, bite force, …) land in the progression system.
export const ROLE_CARD_THEMES: Record<string, RoleCardTheme> = {
  dealer: {
    accent: '#3fe86a', glow: 'rgba(63, 232, 106, 0.45)', label: 'DEALER',
    primary: { label: 'DEALING', statKey: 'dealing' },
    secondary: { label: 'SMOOTH TALK', statKey: 'morale' },
  },
  shooter: {
    accent: '#ff2d2d', glow: 'rgba(255, 45, 45, 0.45)', label: 'SHOOTER',
    primary: { label: 'SHOOTING', statKey: 'shooting' },
    secondary: { label: 'FEARLESS', statKey: 'heatResistance' },
  },
  enforcer: {
    accent: '#a855f7', glow: 'rgba(168, 85, 247, 0.45)', label: 'ENFORCER',
    primary: { label: 'STRENGTH', statKey: 'shooting' },
    secondary: { label: 'INTIMIDATION', statKey: 'heatResistance' },
  },
  lookout: {
    accent: '#2f9bff', glow: 'rgba(47, 155, 255, 0.45)', label: 'LOOKOUT',
    primary: { label: 'STEALTH', statKey: 'stealth' },
    secondary: { label: 'AWARENESS', statKey: 'driving' },
  },
  k9: {
    accent: '#f5a623', glow: 'rgba(245, 166, 35, 0.45)', label: 'K9',
    primary: { label: 'TRACKING', statKey: 'stealth' },
    secondary: { label: 'INTIMIDATION', statKey: 'heatResistance' },
  },
  recruit: {
    accent: '#22d3ee', glow: 'rgba(34, 211, 238, 0.45)', label: 'RECRUIT',
    primary: { label: 'LOYALTY', statKey: 'loyalty' },
    secondary: { label: 'HEART', statKey: 'morale' },
  },
};

const DEFAULT_THEME: RoleCardTheme = {
  accent: '#ff4d6d', glow: 'rgba(255, 77, 109, 0.45)', label: 'SOLDIER',
  primary: { label: 'PRIMARY', statKey: 'shooting' },
  secondary: { label: 'SECONDARY', statKey: 'loyalty' },
};

export function getRoleCardTheme(role?: string): RoleCardTheme {
  return ROLE_CARD_THEMES[(role ?? '').toLowerCase()] ?? DEFAULT_THEME;
}

/** Pull the two themed stat values (0–100) off a member-like record. */
export function getRoleCardStats(
  member: Partial<Record<StatKey, number>> | null | undefined,
  role?: string,
): { label: string; value: number }[] {
  const theme = getRoleCardTheme(role);
  const read = (k: StatKey) => Math.max(0, Math.min(100, Number(member?.[k] ?? 50)));
  return [
    { label: theme.primary.label, value: read(theme.primary.statKey) },
    { label: theme.secondary.label, value: read(theme.secondary.statKey) },
  ];
}

// ─── Segmented stat bar (8 segments, mockup style) ───────────
const SEGMENTS = 8;

function StatBar({ label, value, accent }: { label: string; value: number; accent: string }) {
  const filled = Math.round((value / 100) * SEGMENTS);
  return (
    <div className="rcc-stat-row">
      <span className="rcc-stat-label">{label}</span>
      <div className="rcc-stat-bar" role="img" aria-label={`${label} ${value} of 100`}>
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <span
            key={i}
            className={`rcc-seg${i < filled ? ' rcc-seg-on' : ''}`}
            style={i < filled ? { background: accent, boxShadow: `0 0 6px ${accent}` } : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────
export interface RoleContactCardProps {
  name: string;
  role?: string;
  level?: number;
  avatarUrl?: string;
  /** First two entries render as the primary/secondary bars. */
  stats: { label: string; value: number }[];
  /** Small status chip under the name (e.g. morale text). */
  statusNote?: string;
  onOpen?: () => void;
  onSendToBlock?: () => void;
  onCallBack?: () => void;
  /** Optional destructive action, kept from the legacy card. */
  onBackdoor?: () => void;
}

export default function RoleContactCard({
  name, role, level = 1, avatarUrl, stats, statusNote,
  onOpen, onSendToBlock, onCallBack, onBackdoor,
}: RoleContactCardProps) {
  const theme = getRoleCardTheme(role);

  return (
    <motion.div
      className="rcc-card"
      style={{ ['--rcc-accent' as any]: theme.accent, ['--rcc-glow' as any]: theme.glow }}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.985 }}
      layout
    >
      <Crown className="rcc-crown" size={18} aria-hidden />
      {onBackdoor && (
        <button
          type="button"
          className="rcc-backdoor"
          aria-label={`Cut ties with ${name}`}
          onClick={(e) => { e.stopPropagation(); onBackdoor(); }}
        >
          <X size={14} />
        </button>
      )}

      {/* Tap target for opening the full profile */}
      <button type="button" className="rcc-body" onClick={onOpen} aria-label={`Open ${name}'s profile`}>
        <div className="rcc-ring">
          {avatarUrl ? (
            <img className="rcc-avatar" src={avatarUrl} alt="" loading="lazy" />
          ) : (
            <div className="rcc-avatar rcc-avatar-fallback" aria-hidden>
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div className="rcc-name">
          <span className="rcc-star" aria-hidden>★</span>
          <span className="rcc-name-text">{name}</span>
          <span className="rcc-star" aria-hidden>★</span>
        </div>

        <div className="rcc-role-chip">{theme.label}</div>

        <div className="rcc-level">
          <span className="rcc-level-num">{String(level).padStart(2, '0')}</span>
          <span className="rcc-level-word">LEVEL</span>
        </div>

        {statusNote && <div className="rcc-status-note">{statusNote}</div>}

        <div className="rcc-stats">
          {stats.slice(0, 2).map((s) => (
            <StatBar key={s.label} label={s.label} value={s.value} accent={theme.accent} />
          ))}
        </div>
      </button>

      <div className="rcc-actions">
        <button
          type="button"
          className="rcc-btn rcc-btn-block"
          onClick={(e) => { e.stopPropagation(); onSendToBlock?.(); }}
        >
          <LayoutGrid size={14} aria-hidden /> SEND TO BLOCK
        </button>
        <button
          type="button"
          className="rcc-btn rcc-btn-call"
          onClick={(e) => { e.stopPropagation(); onCallBack?.(); }}
        >
          <Phone size={14} aria-hidden /> CALL BACK
        </button>
      </div>
    </motion.div>
  );
}
