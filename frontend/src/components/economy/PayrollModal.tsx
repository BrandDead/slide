// ═══════════════════════════════════════════════════════════════════════════
// DEALT/SLIDE — Payroll Modal ("Who Eats This Week")
// Pillar 1: Shoebox can't cover payroll → the player chooses who gets paid.
// Skipped members take morale + loyalty hits; the sheet shows the damage
// before you sign it. Consecutive unpaid weeks stack loyalty penalties.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import { useSalarySystem } from '../../hooks/useSalarySystem';
import { UNPAID_MORALE_HIT } from '../../config/wages';
import type { PayrollLine } from '../../types/economy.types';

// Role display metadata — maps to the game's neon color system
const ROLE_META: Record<string, { label: string; color: string }> = {
  dealer:   { label: 'DEALER',   color: '#00ff88' },
  shooter:  { label: 'SHOOTER',  color: '#ff003c' },
  enforcer: { label: 'ENFORCER', color: '#cc44ff' },
  driver:   { label: 'DRIVER',   color: '#4488ff' },
  lookout:  { label: 'LOOKOUT',  color: '#00ccff' },
  chemist:  { label: 'CHEMIST',  color: '#ffcc00' },
  runner:   { label: 'RUNNER',   color: '#ff8800' },
  cook:     { label: 'COOK',     color: '#ffcc00' },
  soldier:  { label: 'SOLDIER',  color: '#ff003c' },
  boss:     { label: 'BOSS',     color: '#ff003c' },
};

const fmt = (n: number) =>
  `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const PayrollModal: React.FC = () => {
  const {
    bankBalance,
    payrollDue,
    payrollLines,
    totalDue,
    selectedTotal,
    selectionAffordable,
    togglePay,
    confirmPayroll,
  } = useSalarySystem();

  const [confirming, setConfirming] = useState(false);

  const skipped = useMemo(
    () => payrollLines.filter((l: PayrollLine) => !l.willPay),
    [payrollLines]
  );
  const shortfall = totalDue - bankBalance;

  // Group lines: deployed blocks first (they're earning), bench last
  const grouped = useMemo(() => {
    const byBlock = new Map<string, PayrollLine[]>();
    for (const line of payrollLines) {
      const key = line.blockAddress ?? 'HQ · Not deployed';
      byBlock.set(key, [...(byBlock.get(key) ?? []), line]);
    }
    return [...byBlock.entries()];
  }, [payrollLines]);

  if (!payrollDue) return null;

  const handleConfirm = () => {
    if (!selectionAffordable) return;
    if (skipped.length > 0 && !confirming) {
      setConfirming(true); // one-tap safety: show fallout warning before signing off
      return;
    }
    confirmPayroll();
    setConfirming(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          background: '#0a0a0a',
          border: '1px solid rgba(255,0,60,0.3)',
          boxShadow: '0 0 60px rgba(255,0,60,0.12)',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: '1.5rem 1.5rem 1rem',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: '#fff',
                  textTransform: 'uppercase',
                }}
              >
                PAYDAY
              </h2>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  color: '#ff003c',
                }}
              >
                Shoebox is short. Pick who eats this week.
              </p>
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>SHOEBOX</div>
              <div style={{ fontSize: '1.25rem', color: '#00ff88', fontWeight: 700 }}>
                {fmt(bankBalance)}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#ff003c', marginTop: '2px' }}>
                OWED {fmt(totalDue)} · SHORT {fmt(shortfall)}
              </div>
            </div>
          </div>
        </div>

        {/* ── Roster grouped by block ── */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {grouped.map(([blockLabel, lines]) => (
            <div key={blockLabel}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0 0.5rem 0.5rem',
                }}
              >
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontFamily: 'monospace',
                    color: 'rgba(255,255,255,0.4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  {blockLabel}
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontFamily: 'monospace',
                    color: 'rgba(255,255,255,0.4)',
                  }}
                >
                  {fmt(lines.reduce((s, l) => s + l.wage, 0))}/wk
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {lines.map((line: PayrollLine) => {
                  const meta = ROLE_META[line.role?.toLowerCase() ?? ''] ?? {
                    label: String(line.role ?? 'MEMBER').toUpperCase(),
                    color: '#888',
                  };
                  const projectedMorale = line.willPay
                    ? line.morale
                    : Math.max(0, line.morale - UNPAID_MORALE_HIT);

                  return (
                    <button
                      key={line.memberId}
                      onClick={() => {
                        setConfirming(false);
                        togglePay(line.memberId);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem',
                        borderRadius: '12px',
                        border: line.willPay
                          ? '1px solid rgba(255,255,255,0.1)'
                          : '1px solid rgba(255,0,60,0.4)',
                        background: line.willPay
                          ? 'rgba(255,255,255,0.03)'
                          : 'rgba(255,0,60,0.05)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                        opacity: line.willPay ? 1 : 0.85,
                      }}
                    >
                      {/* Pay toggle checkbox */}
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '6px',
                          border: line.willPay
                            ? '1px solid #00ff88'
                            : '1px solid rgba(255,0,60,0.6)',
                          background: line.willPay
                            ? 'rgba(0,255,136,0.15)'
                            : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          color: line.willPay ? '#00ff88' : '#ff003c',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {line.willPay ? '✓' : '✕'}
                      </div>

                      {/* Identity */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span
                            style={{
                              color: '#fff',
                              fontWeight: 600,
                              fontSize: '0.9rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {line.nickname || line.memberName}
                          </span>
                          <span
                            style={{
                              padding: '1px 6px',
                              borderRadius: '4px',
                              border: `1px solid ${meta.color}44`,
                              fontSize: '0.65rem',
                              fontFamily: 'monospace',
                              color: meta.color,
                              flexShrink: 0,
                            }}
                          >
                            {meta.label} · L{line.level}
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            gap: '0.75rem',
                            marginTop: '4px',
                            fontSize: '0.7rem',
                            fontFamily: 'monospace',
                          }}
                        >
                          <span
                            style={{
                              color:
                                projectedMorale < line.morale
                                  ? '#ff003c'
                                  : 'rgba(255,255,255,0.4)',
                            }}
                          >
                            MORALE {line.morale}
                            {!line.willPay && ` → ${projectedMorale}`}
                          </span>
                          <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                            LOYALTY {line.loyalty}
                          </span>
                          {line.consecutiveUnpaidWeeks > 0 && (
                            <span style={{ color: '#ff003c' }}>
                              UNPAID ×{line.consecutiveUnpaidWeeks}wk
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Wage */}
                      <div
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          flexShrink: 0,
                          color: line.willPay ? '#00ff88' : 'rgba(255,255,255,0.25)',
                          textDecoration: line.willPay ? 'none' : 'line-through',
                        }}
                      >
                        {fmt(line.wage)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(0,0,0,0.4)',
          }}
        >
          {confirming && skipped.length > 0 && (
            <div
              style={{
                marginBottom: '0.75rem',
                padding: '0.75rem',
                borderRadius: '8px',
                background: 'rgba(255,0,60,0.08)',
                border: '1px solid rgba(255,0,60,0.4)',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                color: '#ff003c',
                lineHeight: 1.5,
              }}
            >
              {skipped.length} member{skipped.length > 1 ? 's' : ''} won't get paid.
              They take −{UNPAID_MORALE_HIT} morale each and the whole gang's average
              drops. Members skipped 2+ weeks straight may walk — or flip on you.
              Tap again to sign off.
            </div>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>PAYING </span>
              <span style={{ color: selectionAffordable ? '#00ff88' : '#ff003c', fontWeight: 700 }}>
                {fmt(selectedTotal)}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                {' '}/ {fmt(bankBalance)} available
              </span>
            </div>
            <button
              onClick={handleConfirm}
              disabled={!selectionAffordable}
              style={{
                padding: '0.625rem 1.5rem',
                borderRadius: '10px',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.875rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: selectionAffordable ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease',
                background: !selectionAffordable
                  ? 'rgba(255,255,255,0.08)'
                  : confirming
                  ? '#ff003c'
                  : '#00ff88',
                color: !selectionAffordable
                  ? 'rgba(255,255,255,0.3)'
                  : '#000',
              }}
            >
              {!selectionAffordable
                ? 'STILL SHORT'
                : confirming
                ? 'SIGN OFF'
                : 'RUN PAYROLL'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayrollModal;
