// ============================================================
// SLIDE — Bail & Hospital panel  (Sprint 14-B, Task 2)
// frontend/src/components/contacts/BailHospitalPanel.tsx
//
// The persistent recovery screen. BailModal handles the moment right
// after an incident; this handles every moment after that, so a member
// dismissed at the modal is not stranded for the rest of the run.
// ============================================================

import React, { useCallback, useMemo } from 'react';
import {
  usePlayerStore,
  useGangStore,
  useNotificationStore,
} from '../../stores/gameStore';
import {
  quoteRecovery,
  needsRecovery,
  RECOVERY_CONFIG,
  type RecoveryQuote,
} from '../../utils/bailHospitalSystem';
import './BailHospitalPanel.css';

interface BailHospitalPanelProps {
  /** memberId -> ticks down, when the caller is tracking it. */
  ticksHeld?: Record<string, number>;
}

export const BailHospitalPanel: React.FC<BailHospitalPanelProps> = ({ ticksHeld = {} }) => {
  const player = usePlayerStore((s) => s.player);
  const updateMoney = usePlayerStore((s) => s.updateMoney);
  const members = useGangStore((s) => s.members);
  const releaseMember = useGangStore((s) => s.releaseMember);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const quotes = useMemo(
    () =>
      members
        .filter(needsRecovery)
        .map((m) => quoteRecovery(m, player.money, ticksHeld[m.id] ?? 0))
        .filter((q): q is RecoveryQuote => q !== null),
    [members, player.money, ticksHeld],
  );

  const totalOwed = quotes.reduce((sum, q) => sum + q.cost, 0);

  const handleRecover = useCallback(
    (quote: RecoveryQuote) => {
      if (player.money < quote.cost) {
        addNotification({
          type: 'warning',
          title: 'Not Enough Cash',
          message: `${quote.kind === 'bail' ? 'Bail' : 'The hospital'} wants $${quote.cost.toLocaleString()}. You have $${player.money.toLocaleString()}.`,
          priority: 'normal',
        });
        return;
      }

      updateMoney(-quote.cost);
      // releaseMember restores 'active' on both the member and the
      // contact record, which is what the deploy screens read.
      releaseMember(quote.memberId);

      addNotification({
        type: 'success',
        title: quote.kind === 'bail' ? 'Bailed Out' : 'Discharged',
        message:
          quote.kind === 'bail'
            ? `${quote.memberName} walked. Paid $${quote.cost.toLocaleString()}.`
            : `${quote.memberName} is patched up and back on rotation. Paid $${quote.cost.toLocaleString()}.`,
        priority: 'normal',
      });
    },
    [player.money, updateMoney, releaseMember, addNotification],
  );

  if (quotes.length === 0) {
    return (
      <div className="bhp-empty">
        <span className="bhp-empty-icon">✅</span>
        <p>Everybody's on the street.</p>
        <p className="bhp-sub">No bail or hospital bills outstanding.</p>
      </div>
    );
  }

  return (
    <div className="bhp-root">
      <div className="bhp-summary">
        <div>
          <span className="bhp-summary-label">Owed</span>
          <span className="bhp-summary-value">${totalOwed.toLocaleString()}</span>
        </div>
        <div>
          <span className="bhp-summary-label">On hand</span>
          <span className={`bhp-summary-value ${player.money < totalOwed ? 'short' : ''}`}>
            ${player.money.toLocaleString()}
          </span>
        </div>
      </div>

      <p className="bhp-warning">
        Anyone down more than {RECOVERY_CONFIG.ABANDON_GRACE_TICKS} ticks costs the crew{' '}
        {RECOVERY_CONFIG.ABANDON_MORALE_PENALTY_PCT}% morale every check.
      </p>

      <ul className="bhp-list">
        {quotes.map((quote) => (
          <li
            key={quote.memberId}
            className={`bhp-row ${quote.costingMorale ? 'bleeding' : ''}`}
          >
            <span className={`bhp-icon ${quote.kind}`}>
              {quote.kind === 'bail' ? '⛓️' : '🏥'}
            </span>

            <div className="bhp-info">
              <span className="bhp-name">{quote.memberName}</span>
              <span className="bhp-status">
                {quote.kind === 'bail' ? 'Locked up' : 'Laid up'}
                {quote.ticksHeld > 0 && ` · ${quote.ticksHeld} ticks`}
                {quote.costingMorale && ' · BLEEDING MORALE'}
              </span>
            </div>

            <button
              className={`bhp-pay ${quote.affordable ? '' : 'disabled'}`}
              onClick={() => handleRecover(quote)}
              disabled={!quote.affordable}
            >
              ${quote.cost.toLocaleString()}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default BailHospitalPanel;
