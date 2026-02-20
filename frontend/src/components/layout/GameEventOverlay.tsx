// ============================================================
// GameEventOverlay.tsx - Full-screen overlay for raids and events
// ============================================================

import React, { useState, useEffect } from 'react';
import type { GameEvent, RaidEvent } from '../../utils/gameLoopEngine';
import './GameEventOverlay.css';

interface GameEventOverlayProps {
  activeRaid: RaidEvent | null;
  lastEvent: GameEvent | null;
  onDismissRaid: () => void;
  onPayBail: (memberId: string) => void;
  onLeaveMember: (memberId: string) => void;
}

const GameEventOverlay: React.FC<GameEventOverlayProps> = ({
  activeRaid,
  lastEvent,
  onDismissRaid,
  onPayBail,
  onLeaveMember,
}) => {
  const [showEventToast, setShowEventToast] = useState(false);
  const [currentToast, setCurrentToast] = useState<GameEvent | null>(null);

  // Show toast for non-raid events
  useEffect(() => {
    if (lastEvent && lastEvent.type !== 'raid') {
      setCurrentToast(lastEvent);
      setShowEventToast(true);
      const timer = setTimeout(() => {
        setShowEventToast(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [lastEvent]);

  return (
    <>
      {/* RAID OVERLAY */}
      {activeRaid && (
        <div className="raid-overlay">
          <div className="raid-overlay-bg" />
          <div className="raid-content">
            <div className={`raid-header raid-${activeRaid.data.result.severity}`}>
              <div className="raid-siren">🚨</div>
              <h1 className="raid-title">
                {activeRaid.data.result.severity.toUpperCase()} RAID
              </h1>
              <div className="raid-siren">🚨</div>
            </div>

            <div className="raid-details">
              <div className="raid-stat-row">
                <div className="raid-stat">
                  <span className="raid-stat-label">💊 Drugs Seized</span>
                  <span className="raid-stat-value">{activeRaid.data.result.confiscatedDrugs}</span>
                </div>
                <div className="raid-stat">
                  <span className="raid-stat-label">🔫 Weapons Seized</span>
                  <span className="raid-stat-value">{activeRaid.data.result.confiscatedWeapons}</span>
                </div>
                <div className="raid-stat">
                  <span className="raid-stat-label">💰 Cash Seized</span>
                  <span className="raid-stat-value">${activeRaid.data.result.confiscatedMoney.toLocaleString()}</span>
                </div>
              </div>

              {activeRaid.data.bailCosts.length > 0 && (
                <div className="raid-arrests">
                  <h3 className="raid-arrests-title">⛓️ Arrested Members</h3>
                  {activeRaid.data.bailCosts.map((bail) => (
                    <div key={bail.memberId} className="bail-card">
                      <div className="bail-info">
                        <span className="bail-name">{bail.memberName}</span>
                        <span className="bail-amount">Bail: ${bail.amount.toLocaleString()}</span>
                      </div>
                      <div className="bail-actions">
                        <button
                          className="bail-btn bail-pay"
                          onClick={() => onPayBail(bail.memberId)}
                        >
                          💰 Pay Bail
                        </button>
                        <button
                          className="bail-btn bail-leave"
                          onClick={() => onLeaveMember(bail.memberId)}
                        >
                          🚶 Leave
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="raid-heat-reduction">
                Heat reduced by {activeRaid.data.result.heatReduction} after raid
              </div>
            </div>

            <button className="raid-dismiss-btn" onClick={onDismissRaid}>
              {activeRaid.data.bailCosts.length === 0 ? 'Continue' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* EVENT TOAST */}
      {showEventToast && currentToast && (
        <div
          className={`event-toast event-toast-${currentToast.severity}`}
          onClick={() => setShowEventToast(false)}
        >
          <div className="event-toast-title">{currentToast.title}</div>
          <div className="event-toast-message">{currentToast.message}</div>
        </div>
      )}
    </>
  );
};

export default GameEventOverlay;
