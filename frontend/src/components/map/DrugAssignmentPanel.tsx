/**
 * DrugAssignmentPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Lets the player assign crafted drugs from their Alchemy stash to specific
 * dealers on the current block.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────────────────────┐
 *   │  💊 STASH                                                           │
 *   │  [Crack Rock ★★★ | Qty: 12 | Purity 82%]  [Meth Ice | Qty: 5 ...]  │
 *   ├─────────────────────────────────────────────────────────────────────┤
 *   │  DEPLOYED DEALERS                                                   │
 *   │  [🔫 Lil Jay — STREET]  [Assign ▼]  → Crack Rock (82%)            │
 *   │  [💊 D-Block — MID]     [Assign ▼]  → None                        │
 *   │  [💊 Reese — ALLEY]     ⛔ No drugs in alley                       │
 *   └─────────────────────────────────────────────────────────────────────┘
 *
 * Rules:
 *  - Only STREET and MID zone dealers can be assigned drugs (anti-turtle)
 *  - ALLEY dealers are shown but locked out with an explanation
 *  - Assigning a drug does NOT consume it immediately; consumption happens
 *    in the game loop tick via consumeAssignedDrugs()
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useDrugInventory,
  blockZoneToDrugZone,
  canZoneAssignDrugs,
  type CraftedDrug,
} from '../../stores/useDrugInventory';
import type { BlockData, BlockPlacement } from '../../types/block.types';
import './DrugAssignmentPanel.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DrugAssignmentPanelProps {
  block: BlockData;
}

interface DealerRow {
  placement: BlockPlacement;
  assignedDrug: CraftedDrug | null;
  canAssign: boolean;
  zoneLabel: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTierStars(tier: string): string {
  switch (tier) {
    case 'base':    return '★☆☆☆';
    case 'mid':     return '★★☆☆';
    case 'high':    return '★★★☆';
    case 'super':   return '★★★★';
    default:        return '★☆☆☆';
  }
}

function getTierColor(tier: string): string {
  switch (tier) {
    case 'base':    return '#6b7280';
    case 'mid':     return '#3b82f6';
    case 'high':    return '#8b5cf6';
    case 'super':   return '#f59e0b';
    default:        return '#6b7280';
  }
}

function getOdRiskLabel(drug: CraftedDrug): { label: string; color: string } {
  const isHighOd = drug.effects?.includes('high_od');
  if (isHighOd) return { label: '⚠️ HIGH OD', color: '#ef4444' };
  if (drug.quality > 85) return { label: '🔥 PREMIUM', color: '#f59e0b' };
  if (drug.quality > 65) return { label: '✅ CLEAN', color: '#22c55e' };
  return { label: '⚠️ CUT', color: '#f97316' };
}

function getRoleIcon(role: string): string {
  switch (role) {
    case 'dealer':   return '💊';
    case 'shooter':  return '🔫';
    case 'enforcer': return '🛡️';
    default:         return '👤';
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

const DrugAssignmentPanel: React.FC<DrugAssignmentPanelProps> = ({ block }) => {
  const drugStore = useDrugInventory();
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const stash = useMemo(() => drugStore.getInventoryList(), [drugStore.inventory]);

  const dealers: DealerRow[] = useMemo(() => {
    return block.placements.map((p) => {
      const drugZone = blockZoneToDrugZone(p.zoneType);
      const canAssign = canZoneAssignDrugs(drugZone);
      const zoneLabel = drugZone === 'street' ? 'STREET' : drugZone === 'mid' ? 'MID' : 'ALLEY';
      return {
        placement: p,
        assignedDrug: drugStore.getDealerDrug(p.memberId),
        canAssign,
        zoneLabel,
      };
    });
  }, [block.placements, drugStore.assignments]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2500);
  };

  const handleAssign = (dealerId: string, zoneType: string, drugId: string) => {
    const drugZone = blockZoneToDrugZone(zoneType as any);
    const success = drugStore.assignDrug(dealerId, drugZone, drugId);
    if (success) {
      const drug = stash.find((d) => d.id === drugId);
      showNotification(`✅ Assigned ${drug?.name ?? 'drug'} to dealer`);
    } else {
      showNotification('❌ Cannot assign — check zone or stash quantity');
    }
    setSelectedDealerId(null);
  };

  const handleUnassign = (dealerId: string) => {
    drugStore.unassignDrug(dealerId);
    showNotification('🚫 Drug unassigned');
    setSelectedDealerId(null);
  };

  if (block.placements.length === 0) {
    return (
      <div className="dap-empty">
        <span className="dap-empty-icon">👥</span>
        <p>No members deployed on this block.</p>
        <p className="dap-empty-hint">Deploy dealers first, then assign drugs.</p>
      </div>
    );
  }

  return (
    <div className="drug-assignment-panel">
      {/* ── Stash header ── */}
      <div className="dap-stash-header">
        <span className="dap-section-title">💊 STASH</span>
        <span className="dap-stash-count">{stash.length} drug{stash.length !== 1 ? 's' : ''}</span>
      </div>

      {stash.length === 0 ? (
        <div className="dap-no-stash">
          <p>Your stash is empty.</p>
          <p className="dap-hint">Cook drugs in the <strong>Alchemy Lab</strong> first.</p>
        </div>
      ) : (
        <div className="dap-stash-scroll">
          {stash.map((drug) => {
            const odInfo = getOdRiskLabel(drug);
            return (
              <div key={drug.id} className="dap-stash-card" style={{ borderColor: getTierColor(drug.tier) }}>
                <div className="dap-drug-name">{drug.name}</div>
                <div className="dap-drug-meta">
                  <span style={{ color: getTierColor(drug.tier) }}>{getTierStars(drug.tier)}</span>
                  <span className="dap-drug-purity">{drug.quality}% pure</span>
                  <span className="dap-drug-qty">×{drug.quantity}</span>
                </div>
                <div className="dap-drug-risk" style={{ color: odInfo.color }}>{odInfo.label}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Dealers ── */}
      <div className="dap-section-title" style={{ marginTop: 12 }}>DEPLOYED DEALERS</div>
      <div className="dap-dealers-list">
        {dealers.map(({ placement, assignedDrug, canAssign, zoneLabel }) => (
          <div
            key={placement.memberId}
            className={`dap-dealer-row ${!canAssign ? 'locked' : ''}`}
          >
            <div className="dap-dealer-info">
              <span className="dap-dealer-icon">{getRoleIcon(placement.role)}</span>
              <div className="dap-dealer-details">
                <span className="dap-dealer-name">{placement.memberName}</span>
                <span className={`dap-zone-badge zone-${zoneLabel.toLowerCase()}`}>{zoneLabel}</span>
              </div>
            </div>

            <div className="dap-dealer-assignment">
              {!canAssign ? (
                <span className="dap-locked-msg">⛔ No drugs in alley</span>
              ) : assignedDrug ? (
                <div className="dap-assigned-drug">
                  <span className="dap-assigned-name" style={{ color: getTierColor(assignedDrug.tier) }}>
                    {assignedDrug.name}
                  </span>
                  <span className="dap-assigned-purity">{assignedDrug.quality}%</span>
                  <button
                    className="dap-unassign-btn"
                    onClick={() => handleUnassign(placement.memberId)}
                    title="Remove drug assignment"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  className="dap-assign-btn"
                  onClick={() =>
                    setSelectedDealerId(
                      selectedDealerId === placement.memberId ? null : placement.memberId
                    )
                  }
                  disabled={stash.length === 0}
                >
                  + Assign Drug
                </button>
              )}
            </div>

            {/* Drug picker dropdown */}
            <AnimatePresence>
              {selectedDealerId === placement.memberId && (
                <motion.div
                  className="dap-drug-picker"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {stash.map((drug) => (
                    <button
                      key={drug.id}
                      className="dap-drug-option"
                      onClick={() => handleAssign(placement.memberId, placement.zoneType, drug.id)}
                    >
                      <span style={{ color: getTierColor(drug.tier) }}>{drug.name}</span>
                      <span className="dap-option-meta">
                        {drug.quality}% · ×{drug.quantity}
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Toast notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            className="dap-toast"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {notification}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DrugAssignmentPanel;
