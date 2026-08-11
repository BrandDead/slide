// ============================================================
// MemberCreation — Sprint 16 (P1)
// Built from the member-creation mockup (v2 iteration):
//   • left rail  — STARTER ATTRIBUTES (heart, loyalty, speed,
//                  nerve, potential) with reroll
//   • right rail — CHOOSE YOUR ROLE (dealer, shooter, enforcer,
//                  recruit, k9) in role neon
//   • ribbon     — "ONLY RECRUITS CAN PROMOTE → DEALER / SHOOTER"
//   • footer     — CHOOSE YOUR NAME + crown CREATE
// Presentational + local state; parent owns persistence via
// onCreate. Fullbody preview reuses the shipped sprite set.
// ============================================================

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Crown, Dices, Heart, HandHeart, Zap, Brain, TrendingUp,
  CircleDollarSign, Target, Shield, UserPlus, Dog,
} from 'lucide-react';
import './MemberCreation.css';

// ─── Types ───────────────────────────────────────────────────
export type CreatableRole = 'dealer' | 'shooter' | 'enforcer' | 'recruit' | 'k9';

export interface StarterAttributes {
  heart: number;      // 1–4 segments
  loyalty: number;
  speed: number;
  nerve: number;
  potential: number;
}

export interface MemberCreationResult {
  name: string;
  role: CreatableRole;
  attributes: StarterAttributes;
}

interface MemberCreationProps {
  onCreate: (result: MemberCreationResult) => void;
  onClose: () => void;
}

// ─── Config ──────────────────────────────────────────────────
const SPRITES = '/assets/runtime/generated/characters/fullbody';

const ROLES: { id: CreatableRole; label: string; accent: string; Icon: React.ComponentType<any>; sprite: string }[] = [
  { id: 'dealer',   label: 'DEALER',   accent: '#3fe86a', Icon: CircleDollarSign, sprite: `${SPRITES}/character_dealer_male_blacktee_fullbody_front_v001.webp` },
  { id: 'shooter',  label: 'SHOOTER',  accent: '#ff2d2d', Icon: Target,           sprite: `${SPRITES}/character_shooter_male_fullbody_front_v001.webp` },
  { id: 'enforcer', label: 'ENFORCER', accent: '#a855f7', Icon: Shield,           sprite: `${SPRITES}/character_enforcer_male_fullbody_front_v001.webp` },
  { id: 'recruit',  label: 'RECRUIT',  accent: '#22d3ee', Icon: UserPlus,         sprite: `${SPRITES}/character_recruit_male_fullbody_front_v001.webp` },
  { id: 'k9',       label: 'K9',       accent: '#f5a623', Icon: Dog,              sprite: `${SPRITES}/character_k9_fullbody_front_v001.webp` },
];

const ATTRS: { key: keyof StarterAttributes; label: string; Icon: React.ComponentType<any> }[] = [
  { key: 'heart',     label: 'HEART',     Icon: Heart },
  { key: 'loyalty',   label: 'LOYALTY',   Icon: HandHeart },
  { key: 'speed',     label: 'SPEED',     Icon: Zap },
  { key: 'nerve',     label: 'NERVE',     Icon: Brain },
  { key: 'potential', label: 'POTENTIAL', Icon: TrendingUp },
];

const MAX_SEG = 4;
const NAME_MAX = 16;

function rollAttributes(): StarterAttributes {
  const roll = () => 1 + Math.floor(Math.random() * MAX_SEG); // 1–4
  return { heart: roll(), loyalty: roll(), speed: roll(), nerve: roll(), potential: roll() };
}

/** Map 1–4 starter segments onto the 0–100 stat scale gang systems use. */
export function segmentsToStat(segments: number): number {
  return 35 + Math.max(1, Math.min(MAX_SEG, segments)) * 13; // 48 / 61 / 74 / 87
}

// ─── Component ───────────────────────────────────────────────
export default function MemberCreation({ onCreate, onClose }: MemberCreationProps) {
  const [role, setRole] = useState<CreatableRole>('recruit'); // mockup default
  const [name, setName] = useState('');
  const [attrs, setAttrs] = useState<StarterAttributes>(() => rollAttributes());
  // Track the failed source rather than a shared boolean so a late error from a
  // previously selected role cannot hide the current role's preview.
  const [failedSprite, setFailedSprite] = useState<string | null>(null);

  const active = useMemo(() => ROLES.find((r) => r.id === role)!, [role]);
  const canCreate = name.trim().length >= 2;

  const create = () => {
    if (!canCreate) return;
    onCreate({ name: name.trim(), role, attributes: attrs });
  };

  return (
    <motion.div
      className="mc-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ ['--mc-accent' as any]: active.accent }}
    >
      {/* Header */}
      <div className="mc-header">
        <button type="button" className="mc-back" onClick={onClose} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div className="mc-crest" aria-hidden>☠</div>
        <div className="mc-header-spacer" />
      </div>

      <div className="mc-stage">
        {/* Left rail — starter attributes */}
        <aside className="mc-rail mc-rail-left" aria-label="Starter attributes">
          <div className="mc-rail-title">◆ STARTER ATTRIBUTES ◆</div>
          {ATTRS.map(({ key, label, Icon }) => (
            <div key={key} className="mc-attr">
              <Icon size={14} className="mc-attr-icon" aria-hidden />
              <span className="mc-attr-label">{label}</span>
              <span className="mc-attr-segs" role="img" aria-label={`${label} ${attrs[key]} of ${MAX_SEG}`}>
                {Array.from({ length: MAX_SEG }).map((_, i) => (
                  <i key={i} className={`mc-seg${i < attrs[key] ? ' mc-seg-on' : ''}`} />
                ))}
              </span>
            </div>
          ))}
          <button type="button" className="mc-reroll" onClick={() => setAttrs(rollAttributes())}>
            <Dices size={14} aria-hidden /> REROLL
          </button>
          <div className="mc-graffiti" aria-hidden>LOYALTY B4 MONEY</div>
        </aside>

        {/* Center — fullbody preview */}
        <div className="mc-preview">
          {failedSprite !== active.sprite ? (
            <img
              key={active.sprite}
              className="mc-sprite"
              src={active.sprite}
              alt={`${active.label} preview`}
              onError={() => setFailedSprite(active.sprite)}
            />
          ) : (
            <div className="mc-sprite-fallback" aria-hidden>
              <active.Icon size={72} />
            </div>
          )}
          <div className="mc-preview-glow" aria-hidden />
        </div>

        {/* Right rail — role select */}
        <aside className="mc-rail mc-rail-right" aria-label="Choose your role">
          <div className="mc-rail-title">◆ CHOOSE YOUR ROLE ◆</div>
          {ROLES.map(({ id, label, accent, Icon }) => (
            <button
              key={id}
              type="button"
              className={`mc-role${role === id ? ' mc-role-active' : ''}`}
              style={{ ['--mc-role' as any]: accent }}
              onClick={() => setRole(id)}
              aria-pressed={role === id}
            >
              {role === id && <span className="mc-role-caret" aria-hidden>▶</span>}
              <span className="mc-role-hex"><Icon size={18} aria-hidden /></span>
              <span className="mc-role-label">{label}</span>
            </button>
          ))}
        </aside>
      </div>

      {/* Recruit promotion ribbon — straight off the mockup */}
      {role === 'recruit' && (
        <div className="mc-promote" role="note">
          <span className="mc-promote-title">ONLY RECRUITS CAN PROMOTE</span>
          <span className="mc-promote-path">
            <b style={{ color: '#22d3ee' }}>RECRUIT</b>
            <i aria-hidden>→</i>
            <b style={{ color: '#3fe86a' }}>DEALER</b>
            <span className="mc-promote-or">or</span>
            <b style={{ color: '#ff2d2d' }}>SHOOTER</b>
          </span>
        </div>
      )}

      {/* Footer — name + create */}
      <div className="mc-footer">
        <div className="mc-name-title">◆ CHOOSE YOUR NAME ◆</div>
        <input
          className="mc-name-input"
          value={name}
          maxLength={NAME_MAX}
          placeholder="ENTER NAME..."
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
          aria-label="Member name"
        />
        <button type="button" className="mc-create" onClick={create} disabled={!canCreate}>
          <Crown size={16} aria-hidden /> CREATE
        </button>
      </div>
    </motion.div>
  );
}
