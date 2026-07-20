import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CanvasStreetRenderer from '../slide/CanvasStreetRenderer';
import type { BlockPlacement, DriveByEvent, DriveByShot } from '../../types/block.types';

const placements: BlockPlacement[] = [
  {
    memberId: 'dealer-curb',
    memberName: 'Ace',
    role: 'dealer',
    x: 1,
    y: 6,
    zoneType: 'curb',
    incomePerTick: 82,
    exposureRisk: 86,
    level: 4,
    health: 100,
  },
  {
    memberId: 'shooter-storefront',
    memberName: 'Nova',
    role: 'shooter',
    x: 4,
    y: 4,
    zoneType: 'storefront',
    incomePerTick: 0,
    exposureRisk: 38,
    level: 7,
    health: 100,
  },
  {
    memberId: 'lookout-roof',
    memberName: 'Eyes',
    role: 'lookout',
    x: 6,
    y: 2,
    zoneType: 'rooftop',
    incomePerTick: 0,
    exposureRisk: 16,
    level: 5,
    health: 100,
  },
  {
    memberId: 'enforcer-alley',
    memberName: 'Brick',
    role: 'enforcer',
    x: 7,
    y: 5,
    zoneType: 'alley',
    incomePerTick: 0,
    exposureRisk: 24,
    level: 6,
    health: 100,
  },
];

function createDriveBy(): DriveByEvent {
  return {
    id: `graphics-lab-${Date.now()}`,
    blockId: '1208-las-olas',
    attackerGangId: 'qa-opposition',
    attackerGangName: 'Las Olas Opposition',
    vehicleType: 'sedan',
    phase: 'active',
    shots: [
      {
        shooterId: 'qa-opposition-1',
        targetX: 1,
        targetY: 6,
        hit: true,
        damage: 26,
        timestamp: 650,
      },
      {
        shooterId: 'qa-opposition-2',
        targetX: 5,
        targetY: 5,
        hit: false,
        damage: 0,
        timestamp: 1350,
      },
    ],
    defenderShots: [],
    casualties: [],
    startedAt: Date.now(),
  };
}

export default function ShooterGraphicsLab() {
  const [viewport, setViewport] = useState(() => ({
    width: Math.max(360, window.innerWidth),
    height: Math.max(520, window.innerHeight),
  }));
  const [driveBy, setDriveBy] = useState<DriveByEvent>(() => createDriveBy());

  useEffect(() => {
    const onResize = () => setViewport({
      width: Math.max(360, window.innerWidth),
      height: Math.max(520, window.innerHeight),
    });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const sceneHeight = Math.max(420, viewport.height - 76);
  const shotCount = useMemo(
    () => driveBy.shots.length + driveBy.defenderShots.length,
    [driveBy],
  );

  const handleDefendShot = useCallback((x: number, y: number) => {
    const shot: DriveByShot = {
      shooterId: 'qa-player',
      targetX: x,
      targetY: y,
      hit: true,
      damage: 18,
      timestamp: performance.now(),
    };
    setDriveBy((current) => ({
      ...current,
      defenderShots: [...current.defenderShots, shot],
    }));
  }, []);

  return (
    <main style={{ minHeight: '100vh', background: '#070a12', color: '#f5f0e6' }}>
      <header
        style={{
          height: 76,
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          background: 'linear-gradient(180deg, #151b29, #0a0e17)',
          borderBottom: '1px solid #343b4b',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div>
          <strong style={{ letterSpacing: 1.5 }}>SHOOTER GRAPHICS LAB</strong>
          <div style={{ marginTop: 4, color: '#a9b1c1', fontSize: 12 }}>
            1208 Las Olas · click the car or scene to fire · {shotCount} shots processed
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDriveBy(createDriveBy())}
          style={{
            padding: '10px 14px',
            color: '#f7e6be',
            background: '#722f37',
            border: '1px solid #c77b65',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          RESET DRIVE-BY
        </button>
      </header>
      <CanvasStreetRenderer
        placements={placements}
        activeDriveBy={driveBy}
        width={viewport.width}
        height={sceneHeight}
        onDefendShot={handleDefendShot}
      />
    </main>
  );
}
