// ============================================================
// MarketMembers — the MEMBERS tab of the underworld marketplace
// Sprint 15-B
//
// Members sold here come pre-leveled, which is the whole pitch: you
// pay a premium to skip the grind. The listing states the catch
// honestly — a legend shooter draws police like a magnet, a certified
// dealer might have a habit. The interesting decision is whether the
// ceiling is worth the tax, so the baggage line is never hidden and
// the heat multiplier is always shown.
// ============================================================

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  usePlayerStore,
  useGangStore,
  useEconomyStore,
  useNotificationStore,
} from '../../stores/gameStore';
import {
  generateMemberBoard,
  hireableToMemberPayload,
  TIER_BANDS,
  ROLE_PROFILES,
  RELATION_LABELS,
} from '../../utils/marketMembersCatalog';
import type { HireableMember, HireableRole, HireableTier } from '../../types/game.types';
import { soundManager } from '../../utils/SoundManager';
import './MarketMembers.css';

const formatMoney = (n: number): string => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
};

const TIER_COLORS: Record<HireableTier, string> = {
  street: '#8b9199',
  seasoned: '#4ade80',
  certified: '#60a5fa',
  legend: '#f59e0b',
};

type RoleFilter = 'all' | HireableRole;

const ROLE_FILTERS: RoleFilter[] = [
  'all', 'shooter', 'dealer', 'enforcer', 'driver', 'lookout', 'recruit', 'k9',
];

const FILTER_LABELS: Record<RoleFilter, string> = {
  all: 'ALL',
  shooter: 'SHOOTERS',
  dealer: 'DEALERS',
  enforcer: 'ENFORCERS',
  driver: 'DRIVERS',
  lookout: 'LOOKOUTS',
  recruit: 'RECRUITS',
  k9: 'K9',
};

/** A refresh costs money — you can't reroll the board for free. */
const REFRESH_COST = 250;

const MarketMembers: React.FC = () => {
  const { player, updateMoney } = usePlayerStore();
  const { members, addMember, maxMembers } = useGangStore();
  const { addTransaction } = useEconomyStore();
  const { addNotification } = useNotificationStore();

  // Seed is stable across renders so a listing survives the buy flow.
  const [boardSeed, setBoardSeed] = useState(() => `board_${Date.now()}`);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [selected, setSelected] = useState<HireableMember | null>(null);
  const [result, setResult] = useState<string>('');
  const [hiredIds, setHiredIds] = useState<Set<string>>(new Set());

  const board = useMemo(() => generateMemberBoard(boardSeed, 14), [boardSeed]);

  const visible = useMemo(
    () =>
      board.filter(
        (h) => !hiredIds.has(h.id) && (roleFilter === 'all' || h.role === roleFilter),
      ),
    [board, roleFilter, hiredIds],
  );

  const handleRefresh = useCallback(() => {
    if (player.money < REFRESH_COST) {
      setResult('NOT ENOUGH FOR A REFRESH');
      setTimeout(() => setResult(''), 1600);
      return;
    }
    updateMoney(-REFRESH_COST);
    setBoardSeed(`board_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    setHiredIds(new Set());
    soundManager.play('ui_tap');
  }, [player.money, updateMoney]);

  const handleHire = useCallback(() => {
    if (!selected) return;

    if (player.money < selected.price) {
      setResult('NOT ENOUGH CASH');
      setTimeout(() => setResult(''), 1600);
      return;
    }

    // Roster cap keeps the weekly payroll from becoming unmanageable.
    const activeCount = members.filter((m) => m.status === 'active').length;
    if (activeCount >= maxMembers) {
      setResult('ROSTER FULL — BACKDOOR SOMEBODY FIRST');
      setTimeout(() => setResult(''), 2200);
      return;
    }

    updateMoney(-selected.price);
    addMember(hireableToMemberPayload(selected, player.id) as never);

    addTransaction({
      id: `tx_hire_${Date.now()}`,
      type: 'purchase',
      userId: player.id,
      amount: -selected.price,
      details: {
        description: `Bought ${selected.name} "${selected.nickname}" — level ${selected.level} ${ROLE_PROFILES[selected.role].label.toLowerCase()}`,
      },
      createdAt: new Date().toISOString(),
    } as never);

    addNotification({
      type: selected.baggage ? 'warning' : 'success',
      title: 'NEW HIRE',
      message: selected.baggage
        ? `${selected.nickname} is on the payroll. Heads up: ${selected.baggage}`
        : `${selected.nickname} is on the payroll at ${formatMoney(selected.salary)}/week.`,
      timestamp: Date.now(),
    } as never);

    soundManager.play('cash_register');
    setHiredIds((prev) => new Set(prev).add(selected.id));
    setResult(`SIGNED ${selected.nickname.toUpperCase()}`);
    setTimeout(() => {
      setResult('');
      setSelected(null);
    }, 1600);
  }, [selected, player, members, updateMoney, addMember, addTransaction, addNotification]);

  return (
    <div className="mm-root">
      {/* Pitch strip — explains why these cost more than recruiting. */}
      <div className="mm-pitch">
        <span className="mm-pitch-label">UNDERWORLD HIRES</span>
        <span className="mm-pitch-copy">
          Already leveled. You are paying to skip the grind — read the warnings.
        </span>
      </div>

      {/* Role filter */}
      <div className="mm-filters">
        {ROLE_FILTERS.map((f) => (
          <button
            key={f}
            className={`mm-filter ${roleFilter === f ? 'active' : ''}`}
            onClick={() => setRoleFilter(f)}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="mm-board-bar">
        <span className="mm-count">{visible.length} available</span>
        <button className="mm-refresh" onClick={handleRefresh}>
          REFRESH BOARD · {formatMoney(REFRESH_COST)}
        </button>
      </div>

      {result && !selected && (
        <div className={`mm-toast ${result.includes('NOT') || result.includes('FULL') ? 'fail' : 'ok'}`}>
          {result}
        </div>
      )}

      {/* Listings */}
      <div className="mm-grid">
        {visible.length === 0 ? (
          <div className="mm-empty">
            Nobody in this category right now. Refresh the board or check back.
          </div>
        ) : (
          visible.map((h) => {
            const affordable = player.money >= h.price;
            return (
              <motion.div
                key={h.id}
                className={`mm-card ${affordable ? '' : 'unaffordable'}`}
                style={{ borderColor: `${TIER_COLORS[h.tier]}55` }}
                onClick={() => { setSelected(h); setResult(''); }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="mm-card-top">
                  <span className="mm-tier" style={{ color: TIER_COLORS[h.tier] }}>
                    {TIER_BANDS[h.tier].label}
                  </span>
                  <span className="mm-level">LVL {h.level}</span>
                </div>

                <div className="mm-name">{h.name}</div>
                <div className="mm-nick">&ldquo;{h.nickname}&rdquo;</div>
                <div className="mm-role">{ROLE_PROFILES[h.role].label}</div>

                <div className="mm-hook">{h.originStory.hook}</div>

                <div className="mm-statline">
                  <span>SHT {h.stats.shooting}</span>
                  <span>DLR {h.stats.dealing}</span>
                  <span>NRV {h.stats.nerve}</span>
                  <span>STL {h.stats.stealth}</span>
                </div>

                {h.baggage && <div className="mm-baggage-flag">CARRIES BAGGAGE</div>}

                <div className="mm-card-bottom">
                  <span className="mm-price">{formatMoney(h.price)}</span>
                  <span className="mm-salary">{formatMoney(h.salary)}/wk</span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Detail / hire modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="mm-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setSelected(null); setResult(''); }}
          >
            <motion.div
              className="mm-modal"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mm-modal-head">
                <span className="mm-tier" style={{ color: TIER_COLORS[selected.tier] }}>
                  {TIER_BANDS[selected.tier].label} · LVL {selected.level}
                </span>
                <h3>{selected.name}</h3>
                <div className="mm-modal-nick">
                  &ldquo;{selected.nickname}&rdquo; · {ROLE_PROFILES[selected.role].label}
                </div>
              </div>

              <p className="mm-role-desc">{ROLE_PROFILES[selected.role].description}</p>

              <div className="mm-section">
                <div className="mm-section-label">ORIGIN</div>
                <p className="mm-story">{selected.originStory.body}</p>
              </div>

              <div className="mm-section">
                <div className="mm-section-label">STATS</div>
                <div className="mm-stat-bars">
                  {([
                    ['SHOOTING', selected.stats.shooting],
                    ['DEALING', selected.stats.dealing],
                    ['NERVE', selected.stats.nerve],
                    ['STEALTH', selected.stats.stealth],
                  ] as const).map(([label, val]) => (
                    <div key={label} className="mm-stat-row">
                      <span className="mm-stat-label">{label}</span>
                      <div className="mm-stat-track">
                        <div
                          className="mm-stat-fill"
                          style={{ width: `${val}%`, background: TIER_COLORS[selected.tier] }}
                        />
                      </div>
                      <span className="mm-stat-val">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mm-section">
                <div className="mm-section-label">TERMS</div>
                <div className="mm-terms">
                  <div className="mm-term">
                    <span>Loyalty on arrival</span>
                    <span className="mm-term-val">{selected.startingLoyalty}/100</span>
                  </div>
                  <div className="mm-term">
                    <span>Heat multiplier</span>
                    <span
                      className="mm-term-val"
                      style={{ color: selected.heatFactor > 1.4 ? '#ef4444' : undefined }}
                    >
                      {selected.heatFactor.toFixed(2)}x
                    </span>
                  </div>
                  <div className="mm-term">
                    <span>Weekly</span>
                    <span className="mm-term-val">{formatMoney(selected.salary)}</span>
                  </div>
                </div>
              </div>

              {selected.specialPeople.length > 0 && (
                <div className="mm-section">
                  <div className="mm-section-label">PEOPLE THEY CARE ABOUT</div>
                  <p className="mm-people-warn">
                    Opps can post bounties on these two. How you respond changes this
                    member&rsquo;s loyalty.
                  </p>
                  {selected.specialPeople.map((p) => (
                    <div key={p.id} className="mm-person">
                      <span className="mm-person-name">{p.name}</span>
                      <span className="mm-person-rel">{RELATION_LABELS[p.relation]}</span>
                      <span className="mm-person-hood">{p.neighborhood}</span>
                    </div>
                  ))}
                </div>
              )}

              {selected.baggage && (
                <div className="mm-warning">
                  <span className="mm-warning-label">THE CATCH</span>
                  <span className="mm-warning-copy">{selected.baggage}</span>
                </div>
              )}

              {result ? (
                <div className={`mm-modal-result ${result.includes('NOT') || result.includes('FULL') ? 'fail' : 'ok'}`}>
                  {result}
                </div>
              ) : (
                <button className="mm-hire-btn" onClick={handleHire}>
                  SIGN FOR {formatMoney(selected.price)}
                </button>
              )}

              <button
                className="mm-close"
                onClick={() => { setSelected(null); setResult(''); }}
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MarketMembers;
