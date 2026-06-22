// ============================================================
// StreetBlock — 2.5D street-level block view
// Shows members positioned on a street backdrop
// Handles drive-by incoming events visually
// Sprint: block-mode-combat-assets
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  BlockData,
  BlockPlacement,
  DriveByEvent,
  DriveByShot,
} from '../../types/block.types';
import { useBlockStore } from '../../stores/blockStore';
import { GameSprite, getMemberFrame } from '../common/GameSprite';
import './StreetBlock.css';

// ─── Zone lane positions (% from top of backdrop) ────────────
const ZONE_Y_POSITIONS: Record<string, number> = {
  street:     88,
  curb:       78,
  sidewalk:   65,
  storefront: 48,
  alley:      32,
  parking:    55,
  rooftop:    15,
};

const ZONE_X_STEP = 100 / 9; // 8 columns → 9 divisions

function placementToScreenPos(p: BlockPlacement) {
  const x = ZONE_X_STEP * (p.x + 1); // 1-indexed
  const y = ZONE_Y_POSITIONS[p.zoneType] ?? 60;
  return { x, y };
}

// ─── Role display ─────────────────────────────────────────────
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

// ─── Drive-by car ─────────────────────────────────────────────
interface DriveByCarProps {
  event: DriveByEvent;
  onShoot: (targetX: number, targetY: number) => void;
}

const DriveBycar: React.FC<DriveByCarProps> = ({ event, onShoot: _onShoot }) => {
  const isActive = event.phase === 'active';
  const isIncoming = event.phase === 'incoming';
  const isRetreating = event.phase === 'retreating';

  return (
    <motion.div
      className={`driveby-car phase-${event.phase}`}
      initial={{ x: '-120%' }}
      animate={
        isIncoming
          ? { x: '10%' }
          : isActive
          ? { x: '10%' }
          : isRetreating
          ? { x: '120%' }
          : { x: '-120%' }
      }
      transition={{
        duration: isIncoming ? 1.5 : isRetreating ? 1.2 : 0,
        ease: 'easeInOut',
      }}
    >
      {/* Car body */}
      <div className="car-body">
        {event.vehicleType === 'sedan' ? '🚗' : event.vehicleType === 'suv' ? '🚙' : '🚐'}
      </div>
      {/* Gang name tag */}
      {isActive && (
        <div className="car-gang-tag">{event.attackerGangName}</div>
      )}
      {/* Muzzle flash */}
      <AnimatePresence>
        {isActive && event.shots.length > 0 && (
          <motion.div
            className="muzzle-flash"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Member sprite on street ──────────────────────────────────
interface StreetMemberProps {
  placement: BlockPlacement;
  isSelected: boolean;
  isUnderFire: boolean;
  onClick: () => void;
}

const StreetMember: React.FC<StreetMemberProps> = ({
  placement,
  isSelected,
  isUnderFire,
  onClick,
}) => {
  const pos = placementToScreenPos(placement);
  const roleColor = ROLE_COLORS[placement.role] ?? '#fff';
  const isDead = placement.health <= 0;

  return (
    <motion.div
      className={[
        'street-member',
        isSelected ? 'selected' : '',
        isUnderFire ? 'under-fire' : '',
        isDead ? 'dead' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        borderColor: roleColor,
      }}
      onClick={onClick}
      animate={
        isUnderFire && !isDead
          ? { x: [0, -4, 4, -4, 0] }
          : isDead
          ? { rotate: 90, opacity: 0.4 }
          : {}
      }
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.15 }}
    >
      <GameSprite
        sheet="gang_members"
        frame={getMemberFrame(placement.role)}
        size={32}
        fallback={isDead ? '💀' : placement.role === 'dealer' ? '💊' : '👤'}
      />
      <span className="sm-name">{placement.memberName.split(' ')[0]}</span>
      {placement.health < 100 && (
        <div
          className="sm-health-bar"
          style={{
            width: `${placement.health}%`,
            background: placement.health > 50 ? '#4ade80' : placement.health > 25 ? '#facc15' : '#ef4444',
          }}
        />
      )}
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────
interface StreetBlockProps {
  block: BlockData;
  activeDriveBy?: DriveByEvent;
  onMemberClick?: (placement: BlockPlacement) => void;
  onDefend?: (shot: DriveByShot) => void;
}

const StreetBlock: React.FC<StreetBlockProps> = ({
  block,
  activeDriveBy,
  onMemberClick,
  onDefend,
}) => {
  const { setBlockViewMode, recordShot } = useBlockStore();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [shotEffects, setShotEffects] = useState<{ id: string; x: number; y: number }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-clear shot effects
  useEffect(() => {
    if (shotEffects.length === 0) return;
    const t = setTimeout(() => setShotEffects([]), 600);
    return () => clearTimeout(t);
  }, [shotEffects]);

  // Animate incoming shots at active members
  useEffect(() => {
    if (!activeDriveBy || activeDriveBy.phase !== 'active') return;
    const shooters = block.placements.filter((p) =>
      ['curb', 'sidewalk', 'street'].includes(p.zoneType)
    );
    if (shooters.length === 0) return;

    const interval = setInterval(() => {
      const target = shooters[Math.floor(Math.random() * shooters.length)];
      const pos = placementToScreenPos(target);
      setShotEffects((prev) => [
        ...prev,
        { id: `${Date.now()}`, x: pos.x, y: pos.y },
      ]);
    }, 800);

    return () => clearInterval(interval);
  }, [activeDriveBy, block.placements]);

  const handleMemberClick = useCallback(
    (placement: BlockPlacement) => {
      setSelectedMemberId((prev) => (prev === placement.memberId ? null : placement.memberId));
      onMemberClick?.(placement);
    },
    [onMemberClick]
  );

  const handleDefendClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!activeDriveBy || activeDriveBy.phase !== 'active') return;
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      const shot: DriveByShot = {
        shooterId: 'player',
        targetX: x,
        targetY: y,
        hit: Math.random() > 0.4, // 60% hit chance base
        damage: Math.floor(Math.random() * 30) + 10,
        timestamp: Date.now(),
      };
      recordShot(block.id, shot, true);
      onDefend?.(shot);
      setShotEffects((prev) => [...prev, { id: `def-${Date.now()}`, x, y }]);
    },
    [activeDriveBy, block.id, recordShot, onDefend]
  );

  const isUnderFire = (memberId: string) =>
    activeDriveBy?.phase === 'active' &&
    activeDriveBy.casualties.includes(memberId);

  return (
    <div className="street-block" ref={containerRef} onClick={handleDefendClick}>
      {/* Backdrop */}
      <div
        className="street-backdrop"
        style={
          block.streetBackdropUrl
            ? { backgroundImage: `url(${block.streetBackdropUrl})` }
            : undefined
        }
      >
        {/* Fallback gradient backdrop */}
        {!block.streetBackdropUrl && (
          <div className="street-backdrop-fallback">
            <div className="sb-sky" />
            <div className="sb-buildings" />
            <div className="sb-storefront" />
            <div className="sb-sidewalk" />
            <div className="sb-curb" />
            <div className="sb-street" />
          </div>
        )}

        {/* Zone labels */}
        <div className="street-zone-labels">
          {Object.entries(ZONE_Y_POSITIONS).map(([zone, y]) => (
            <span
              key={zone}
              className="sz-label"
              style={{ top: `${y}%` }}
            >
              {zone.toUpperCase()}
            </span>
          ))}
        </div>

        {/* Members */}
        {block.placements.map((p) => (
          <StreetMember
            key={p.memberId}
            placement={p}
            isSelected={selectedMemberId === p.memberId}
            isUnderFire={isUnderFire(p.memberId)}
            onClick={() => handleMemberClick(p)}
          />
        ))}

        {/* Drive-by car */}
        <AnimatePresence>
          {activeDriveBy && activeDriveBy.phase !== 'idle' && activeDriveBy.phase !== 'resolved' && (
            <DriveBycar
              event={activeDriveBy}
              onShoot={(tx, ty) => {
                const shot: DriveByShot = {
                  shooterId: activeDriveBy.attackerGangId,
                  targetX: tx,
                  targetY: ty,
                  hit: Math.random() > 0.5,
                  damage: Math.floor(Math.random() * 40) + 15,
                  timestamp: Date.now(),
                };
                recordShot(block.id, shot, false);
              }}
            />
          )}
        </AnimatePresence>

        {/* Shot effects */}
        <AnimatePresence>
          {shotEffects.map((fx) => (
            <motion.div
              key={fx.id}
              className="shot-fx"
              style={{ left: `${fx.x}%`, top: `${fx.y}%` }}
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            />
          ))}
        </AnimatePresence>

        {/* Drive-by active overlay */}
        <AnimatePresence>
          {activeDriveBy?.phase === 'active' && (
            <motion.div
              className="driveby-active-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <span>🚗 SLIDE IN PROGRESS — TAP TO RETURN FIRE</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="street-controls">
        <button
          className="sc-btn topdown"
          onClick={(e) => {
            e.stopPropagation();
            setBlockViewMode(block.id, 'topdown');
          }}
        >
          🗺️ Top-Down
        </button>
        <div className="sc-info">
          <span>{block.address}</span>
          <span className="sc-heat">🔥 {block.heat}/5</span>
          <span className="sc-members">👥 {block.placements.length}</span>
        </div>
      </div>

      {/* Selected member info */}
      <AnimatePresence>
        {selectedMemberId && (() => {
          const p = block.placements.find((pl) => pl.memberId === selectedMemberId);
          if (!p) return null;
          return (
            <motion.div
              className="street-member-info"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="smi-name" style={{ color: ROLE_COLORS[p.role] }}>
                {p.memberName} — {p.role.toUpperCase()}
              </span>
              <span className="smi-zone">{p.zoneType.toUpperCase()} zone</span>
              <span className="smi-income">💰 ${p.incomePerTick}/tick</span>
              <span className="smi-risk">🎯 {p.exposureRisk}% exposure</span>
              <span className="smi-hp">❤️ {p.health}%</span>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};

export default StreetBlock;
