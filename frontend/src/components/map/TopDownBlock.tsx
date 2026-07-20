// ============================================================
// TopDownBlock — 8×8 tactical grid for member placement
// Zones: street / curb / sidewalk / storefront / alley
// Sprint: block-mode-combat-assets
// ============================================================

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BlockData, BlockZone, BlockPlacement, BlockZoneType } from '../../types/block.types';
import { useBlockStore } from '../../stores/blockStore';
import { getPortraitUrl, getDefaultTopdownBgUrl } from '../../services/assetResolver';
import './TopDownBlock.css';

// ─── Zone styling ────────────────────────────────────────────
// Cells are translucent tints over the block's top-down art so the
// place reads through the tactical grid.

const ZONE_COLORS: Record<BlockZoneType, string> = {
  street:     'rgba(26, 26, 46, 0.30)',
  curb:       'rgba(22, 33, 62, 0.32)',
  sidewalk:   'rgba(15, 52, 96, 0.32)',
  storefront: 'rgba(27, 67, 50, 0.34)',
  alley:      'rgba(33, 37, 41, 0.42)',
  parking:    'rgba(52, 58, 64, 0.34)',
  rooftop:    'rgba(74, 25, 66, 0.38)',
  building:   'rgba(8, 8, 10, 0.62)',
};

const ZONE_LEGEND_COLORS: Record<BlockZoneType, string> = {
  street:     '#1a1a2e',
  curb:       '#16213e',
  sidewalk:   '#0f3460',
  storefront: '#1b4332',
  alley:      '#212529',
  parking:    '#343a40',
  rooftop:    '#4a1942',
  building:   '#111111',
};

const ZONE_LABELS: Record<BlockZoneType, string> = {
  street:     'STREET',
  curb:       'CURB',
  sidewalk:   'WALK',
  storefront: 'FRONT',
  alley:      'ALLEY',
  parking:    'PARK',
  rooftop:    'ROOF',
  building:   '—',
};

const ROLE_COLORS: Record<string, string> = {
  dealer:   '#4ade80',
  shooter:  '#ef4444',
  enforcer: '#f97316',
  lookout:  '#facc15',
  driver:   '#60a5fa',
  chemist:  '#a78bfa',
  runner:   '#fb7185',
  boss:     '#fbbf24',
};

// ─── Sub-components ──────────────────────────────────────────

interface ZoneCellProps {
  zone: BlockZone;
  placement?: BlockPlacement;
  isSelected: boolean;
  isPendingTarget: boolean;
  onClick: (zone: BlockZone) => void;
}

const ZoneCell: React.FC<ZoneCellProps> = ({
  zone,
  placement,
  isSelected,
  isPendingTarget,
  onClick,
}) => {
  const roleColor = placement ? ROLE_COLORS[placement.role] ?? '#fff' : undefined;

  return (
    <motion.div
      className={[
        'td-cell',
        `zone-${zone.zoneType}`,
        isSelected ? 'selected' : '',
        isPendingTarget && zone.passable && !zone.occupantId ? 'drop-target' : '',
        !zone.passable ? 'impassable' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ backgroundColor: ZONE_COLORS[zone.zoneType] }}
      onClick={() => zone.passable && onClick(zone)}
      whileHover={zone.passable ? { scale: 1.05, zIndex: 10 } : {}}
      whileTap={zone.passable ? { scale: 0.97 } : {}}
    >
      {placement && (
        <motion.div
          className="td-member-token"
          style={{ borderColor: roleColor }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
        >
          <img
            className="td-member-portrait"
            src={placement.portraitUrl ?? getPortraitUrl(placement.role)}
            alt={placement.memberName}
            draggable={false}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <span className="td-member-level" style={{ color: roleColor }}>
            {placement.level}
          </span>
          {placement.health < 50 && (
            <span className="td-member-hp" style={{ color: placement.health < 25 ? '#ef4444' : '#facc15' }}>
              {placement.health}%
            </span>
          )}
        </motion.div>
      )}
      {!placement && zone.passable && (
        <span className="td-zone-label">{ZONE_LABELS[zone.zoneType]}</span>
      )}
    </motion.div>
  );
};

// ─── Main Component ──────────────────────────────────────────

interface TopDownBlockProps {
  block: BlockData;
  onMemberClick?: (placement: BlockPlacement) => void;
  onZoneClick?: (zone: BlockZone) => void;
  readOnly?: boolean;
}

const TopDownBlock: React.FC<TopDownBlockProps> = ({
  block,
  onMemberClick,
  onZoneClick,
  readOnly = false,
}) => {
  const {
    placeMember,
    moveMember,
    removeMemberFromBlock,
    isPlacementMode,
    pendingPlacementMemberId,
    pendingPlacementMember,
    setPlacementMode,
    setBlockViewMode,
  } = useBlockStore();

  const [selectedZone, setSelectedZone] = useState<BlockZone | null>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);

  const getPlacementAt = useCallback(
    (x: number, y: number) => block.placements.find((p) => p.x === x && p.y === y),
    [block.placements]
  );

  const handleZoneClick = useCallback(
    (zone: BlockZone) => {
      if (readOnly) return;

      const existing = getPlacementAt(zone.x, zone.y);

      // If we have a member pending placement
      if (isPlacementMode && pendingPlacementMemberId) {
        if (!zone.occupantId) {
          // Place the member with the identity captured at deploy time
          const role = pendingPlacementMember?.role ?? 'dealer';
          placeMember(block.id, {
            memberId: pendingPlacementMemberId,
            memberName: pendingPlacementMember?.memberName ?? 'Member',
            role,
            x: zone.x,
            y: zone.y,
            zoneType: zone.zoneType,
            incomePerTick: 0,
            exposureRisk: zone.exposureRisk,
            level: pendingPlacementMember?.level ?? 1,
            health: 100,
            portraitUrl: getPortraitUrl(role),
          });
          setPlacementMode(false);
          setTooltip(`Placed on ${ZONE_LABELS[zone.zoneType]}`);
          setTimeout(() => setTooltip(null), 1500);
        }
        return;
      }

      // If clicking an occupied zone
      if (existing) {
        setSelectedZone(zone);
        onMemberClick?.(existing);
        return;
      }

      // If a zone is already selected and we click an empty zone → move
      if (selectedZone) {
        const selectedPlacement = getPlacementAt(selectedZone.x, selectedZone.y);
        if (selectedPlacement) {
          moveMember(block.id, selectedPlacement.memberId, zone.x, zone.y);
          setSelectedZone(null);
          return;
        }
      }

      setSelectedZone(zone);
      onZoneClick?.(zone);
    },
    [
      readOnly,
      isPlacementMode,
      pendingPlacementMemberId,
      pendingPlacementMember,
      selectedZone,
      block.id,
      getPlacementAt,
      placeMember,
      moveMember,
      setPlacementMode,
      onMemberClick,
      onZoneClick,
    ]
  );

  // ── Income / risk legend ──
  const totalIncome = block.placements.reduce((s, p) => s + p.incomePerTick, 0);
  const avgExposure =
    block.placements.length > 0
      ? Math.round(block.placements.reduce((s, p) => s + p.exposureRisk, 0) / block.placements.length)
      : 0;

  return (
    <div className="topdown-block">
      {/* Header */}
      <div className="td-header">
        <div className="td-address">{block.address}</div>
        <div className="td-stats">
          <span className="td-stat income">💰 ${totalIncome}/tick</span>
          <span className="td-stat exposure">🎯 {avgExposure}% risk</span>
          <span className="td-stat heat">🔥 Heat {block.heat}/5</span>
        </div>
        <button
          className="td-view-toggle"
          onClick={() => setBlockViewMode(block.id, 'street')}
          title="Switch to street view"
        >
          🏙️ Street View
        </button>
      </div>

      {/* Grid over the block's top-down art */}
      <div
        className="td-grid has-bg"
        style={{
          backgroundImage: `url(${block.topdownBgUrl ?? getDefaultTopdownBgUrl()})`,
        }}
      >
        {block.grid.map((row, y) =>
          row.map((zone, x) => {
            const placement = getPlacementAt(x, y);
            const isSelected =
              selectedZone?.x === x && selectedZone?.y === y;
            const isPendingTarget = isPlacementMode && !!pendingPlacementMemberId;
            return (
              <ZoneCell
                key={`${x}-${y}`}
                zone={zone}
                placement={placement}
                isSelected={isSelected}
                isPendingTarget={isPendingTarget}
                onClick={handleZoneClick}
              />
            );
          })
        )}
      </div>

      {/* Zone legend */}
      <div className="td-legend">
        {(['street', 'curb', 'sidewalk', 'storefront', 'alley'] as BlockZoneType[]).map((zt) => (
          <span key={zt} className="td-legend-item">
            <span
              className="td-legend-dot"
              style={{ backgroundColor: ZONE_LEGEND_COLORS[zt] }}
            />
            {ZONE_LABELS[zt]}
          </span>
        ))}
      </div>

      {/* Selected zone info */}
      <AnimatePresence>
        {selectedZone && (
          <motion.div
            className="td-zone-info"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            {(() => {
              const p = getPlacementAt(selectedZone.x, selectedZone.y);
              if (p) {
                return (
                  <>
                    <div className="td-info-name" style={{ color: ROLE_COLORS[p.role] }}>
                      {p.memberName} — {p.role.toUpperCase()} Lv{p.level}
                    </div>
                    <div className="td-info-stats">
                      <span>💰 ${p.incomePerTick}/tick</span>
                      <span>🎯 {p.exposureRisk}% risk</span>
                      <span>❤️ {p.health}%</span>
                    </div>
                    <div className="td-info-actions">
                      <button
                        className="td-action-btn"
                        onClick={() => {
                          removeMemberFromBlock(block.id, p.memberId);
                          setSelectedZone(null);
                        }}
                      >
                        📞 Call Back
                      </button>
                      <button
                        className="td-action-btn"
                        onClick={() => {
                          setSelectedZone(zone => zone?.x === selectedZone.x ? null : zone);
                        }}
                      >
                        🔄 Reposition
                      </button>
                    </div>
                  </>
                );
              }
              return (
                <div className="td-info-empty">
                  {ZONE_LABELS[selectedZone.zoneType]} — {selectedZone.zoneType === 'street' ? 'Drive-by lane' : `Income ×${selectedZone.incomeModifier}% / Risk ${selectedZone.exposureRisk}%`}
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Placement mode banner */}
      <AnimatePresence>
        {isPlacementMode && (
          <motion.div
            className="td-placement-banner"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <span>📍 Tap a zone to place member</span>
            <button onClick={() => setPlacementMode(false)}>Cancel</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            className="td-toast"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {tooltip}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TopDownBlock;
