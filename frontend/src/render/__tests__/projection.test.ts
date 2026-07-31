// ============================================================
// Projection + grid contract tests  (#77 acceptance criteria)
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  GRID, GRID_COLS, GRID_ROWS, PLACEMENT_ZONES,
  canPlace, canEarnAt, isInBounds, snapToCell, clampToGrid,
  cellKey, gridDistance, isNearSide, zoneForRow, forEachCell,
} from '../../config/gridConfig';
import {
  project, unproject, getProjectionTable, clearProjectionCache,
  effectAnchor, DEFAULT_PROFILE, makeProfile,
  type SceneViewport,
} from '../projection';

const VIEW: SceneViewport = { width: 1280, height: 720 };
const MOBILE: SceneViewport = { width: 390, height: 844 };

beforeEach(() => clearProjectionCache());

// ─── Grid contract ───────────────────────────────────────────

describe('canonical grid contract', () => {
  it('is 8×8', () => {
    expect(GRID_COLS).toBe(8);
    expect(GRID_ROWS).toBe(8);
    expect(GRID.cols * GRID.rows).toBe(64);
  });

  it('defines exactly one zone per row, indexed by row', () => {
    expect(PLACEMENT_ZONES).toHaveLength(GRID_ROWS);
    PLACEMENT_ZONES.forEach((z, i) => expect(z.row).toBe(i));
  });

  it('street is the attack lane and every other row is a block row', () => {
    expect(GRID.attackLaneRows).toEqual([0]);
    expect(GRID.blockRows).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(zoneForRow(0).zoneType).toBe('street');
  });

  it('exposure falls and cover rises monotonically with depth', () => {
    for (let r = 1; r < GRID_ROWS; r++) {
      expect(PLACEMENT_ZONES[r].exposureRisk).toBeLessThan(PLACEMENT_ZONES[r - 1].exposureRisk);
      expect(PLACEMENT_ZONES[r].coverBonus).toBeGreaterThan(PLACEMENT_ZONES[r - 1].coverBonus);
    }
  });

  it('street pays the most and rooftop pays the least', () => {
    expect(zoneForRow(0).incomeMultiplier).toBe(2.0);
    expect(zoneForRow(7).incomeMultiplier).toBe(0.5);
  });

  it('visits all 64 cells exactly once', () => {
    const seen = new Set<string>();
    forEachCell((c) => seen.add(cellKey(c)));
    expect(seen.size).toBe(64);
  });
});

describe('coordinate validation', () => {
  it('accepts in-bounds and rejects out-of-bounds', () => {
    expect(isInBounds({ col: 0, row: 0 })).toBe(true);
    expect(isInBounds({ col: 7, row: 7 })).toBe(true);
    expect(isInBounds({ col: 8, row: 0 })).toBe(false);
    expect(isInBounds({ col: -1, row: 0 })).toBe(false);
    expect(isInBounds({ col: 0, row: 8 })).toBe(false);
    expect(isInBounds({ col: NaN, row: 0 })).toBe(false);
  });

  it('clamps and snaps', () => {
    expect(clampToGrid({ col: 99, row: -5 })).toEqual({ col: 7, row: 0 });
    expect(snapToCell({ col: 3.6, row: 2.4 })).toEqual({ col: 4, row: 2 });
  });
});

describe('placement legality', () => {
  it('allows a dealer on the sidewalk', () => {
    expect(canPlace({ col: 3, row: 2 }, 'dealer').legal).toBe(true);
  });

  it('rejects a dealer on the rooftop but allows a shooter', () => {
    expect(canPlace({ col: 3, row: 7 }, 'dealer').legal).toBe(false);
    expect(canPlace({ col: 3, row: 7 }, 'shooter').legal).toBe(true);
    expect(canPlace({ col: 3, row: 7 }, 'lookout').legal).toBe(true);
  });

  it('rejects an occupied cell', () => {
    const occupied = new Set([cellKey({ col: 3, row: 2 })]);
    expect(canPlace({ col: 3, row: 2 }, 'dealer', occupied).legal).toBe(false);
  });

  it('rejects off-block placement with a reason', () => {
    const r = canPlace({ col: 12, row: 2 }, 'dealer');
    expect(r.legal).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it('marks the rooftop as non-earning', () => {
    expect(canEarnAt({ col: 0, row: 2 })).toBe(true);
    expect(canEarnAt({ col: 0, row: 7 })).toBe(false);
  });

  it('treats street and curb as near-side for drive-by damage', () => {
    expect(isNearSide({ col: 4, row: 0 })).toBe(true);
    expect(isNearSide({ col: 4, row: 1 })).toBe(true);
    expect(isNearSide({ col: 4, row: 5 })).toBe(false);
  });

  it('uses Chebyshev distance so diagonals cost the same', () => {
    expect(gridDistance({ col: 0, row: 0 }, { col: 3, row: 3 })).toBe(3);
    expect(gridDistance({ col: 0, row: 0 }, { col: 3, row: 0 })).toBe(3);
  });
});

// ─── Projection ──────────────────────────────────────────────

describe('known grid → scene projections', () => {
  it('places row 0 at scale exactly 1.0 on the ground line', () => {
    const p = project({ col: 3.5, row: 0 }, VIEW);
    expect(p.scale).toBeCloseTo(1.0, 10);
    expect(p.y).toBeCloseTo(VIEW.height * DEFAULT_PROFILE.groundYRatio, 10);
  });

  it('centres the block on the middle of the grid, not on a column', () => {
    // 8 columns → the centre line falls between col 3 and col 4.
    const p = project({ col: 3.5, row: 0 }, VIEW);
    expect(p.x).toBeCloseTo(VIEW.width * 0.5, 10);
  });

  it('mirrors columns symmetrically about the centre', () => {
    const left = project({ col: 0, row: 0 }, VIEW);
    const right = project({ col: 7, row: 0 }, VIEW);
    expect(left.x + right.x).toBeCloseTo(VIEW.width, 6);
  });

  it('matches the closed-form perspective divide at every row', () => {
    for (let row = 0; row < GRID_ROWS; row++) {
      const expected = DEFAULT_PROFILE.zNear / (DEFAULT_PROFILE.zNear + row * DEFAULT_PROFILE.rowDepth);
      expect(project({ col: 0, row }, VIEW).scale).toBeCloseTo(expected, 12);
    }
  });

  it('keeps the far row large enough to read (scale ≈ 0.45 at row 7)', () => {
    const far = project({ col: 3, row: 7 }, VIEW);
    expect(far.scale).toBeGreaterThan(0.40);
    expect(far.scale).toBeLessThan(0.52);
  });
});

describe('actor feet stay on the ground plane', () => {
  it('never places a contact point above the horizon', () => {
    const horizonY = VIEW.height * DEFAULT_PROFILE.horizonYRatio;
    forEachCell((c) => {
      expect(project(c, VIEW).y).toBeGreaterThan(horizonY);
    });
  });

  it('moves the contact point monotonically upward with depth', () => {
    let prev = Infinity;
    for (let row = 0; row < GRID_ROWS; row++) {
      const y = project({ col: 4, row }, VIEW).y;
      expect(y).toBeLessThan(prev);
      prev = y;
    }
  });

  it('anchors the shadow at the contact point, not the sprite centre', () => {
    const p = project({ col: 4, row: 3 }, VIEW);
    expect(Math.abs(p.shadow.cy - p.y)).toBeLessThan(p.actorHeight * 0.12);
  });
});

describe('depth scaling is consistent', () => {
  it('shrinks actors monotonically with depth', () => {
    let prev = Infinity;
    for (let row = 0; row < GRID_ROWS; row++) {
      const h = project({ col: 4, row }, VIEW).actorHeight;
      expect(h).toBeLessThan(prev);
      prev = h;
    }
  });

  it('scales actor height and cell width by the same factor', () => {
    const near = project({ col: 4, row: 0 }, VIEW);
    const far = project({ col: 4, row: 6 }, VIEW);
    expect(far.actorHeight / near.actorHeight).toBeCloseTo(far.cellWidth / near.cellWidth, 10);
  });

  it('converges columns toward the centre as depth increases', () => {
    const nearSpan = Math.abs(project({ col: 7, row: 0 }, VIEW).x - project({ col: 0, row: 0 }, VIEW).x);
    const farSpan = Math.abs(project({ col: 7, row: 7 }, VIEW).x - project({ col: 0, row: 7 }, VIEW).x);
    expect(farSpan).toBeLessThan(nearSpan);
  });
});

describe('draw order', () => {
  it('sorts far rows before near rows', () => {
    const table = getProjectionTable(VIEW);
    const ordered = table.drawOrder([
      { col: 1, row: 0 }, { col: 1, row: 7 }, { col: 1, row: 3 },
    ]);
    expect(ordered.map((o) => o.row)).toEqual([7, 3, 0]);
  });

  it('breaks ties by column so same-row actors stack stably', () => {
    const table = getProjectionTable(VIEW);
    const ordered = table.drawOrder([{ col: 5, row: 2 }, { col: 1, row: 2 }]);
    expect(ordered.map((o) => o.col)).toEqual([1, 5]);
  });
});

// ─── Round-trip (targeting) ──────────────────────────────────

describe('screen → grid → screen round-trips', () => {
  it('recovers every cell centre exactly', () => {
    forEachCell((c) => {
      const p = project(c, VIEW);
      const back = unproject(p.x, p.y, VIEW);
      expect(back.col).toBeCloseTo(c.col, 6);
      expect(back.row).toBeCloseTo(c.row, 6);
    });
  });

  it('snaps a tap near a cell centre to that cell', () => {
    const target = { col: 5, row: 3 };
    const p = project(target, VIEW);
    // 8 px off-centre — a sloppy thumb.
    expect(snapToCell(unproject(p.x + 8, p.y - 8, VIEW))).toEqual(target);
  });

  it('round-trips identically on a mobile viewport', () => {
    forEachCell((c) => {
      const p = project(c, MOBILE);
      const back = unproject(p.x, p.y, MOBILE);
      expect(back.col).toBeCloseTo(c.col, 6);
      expect(back.row).toBeCloseTo(c.row, 6);
    });
  });
});

describe('resize does not corrupt gameplay coordinates', () => {
  it('keeps grid coordinates identical across viewport sizes', () => {
    const sizes: SceneViewport[] = [
      { width: 1920, height: 1080 },
      { width: 1280, height: 720 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ];
    const cell = { col: 6, row: 4 };
    for (const view of sizes) {
      const p = project(cell, view);
      const back = unproject(p.x, p.y, view);
      expect(snapToCell(back)).toEqual(cell);
    }
  });

  it('produces scale independent of viewport size', () => {
    const a = project({ col: 2, row: 5 }, { width: 1920, height: 1080 });
    const b = project({ col: 2, row: 5 }, { width: 390, height: 844 });
    expect(a.scale).toBeCloseTo(b.scale, 12);
  });

  it('keeps positions proportional to viewport dimensions', () => {
    const a = project({ col: 2, row: 5 }, { width: 1280, height: 720 });
    const b = project({ col: 2, row: 5 }, { width: 2560, height: 1440 });
    expect(b.x).toBeCloseTo(a.x * 2, 6);
    expect(b.y).toBeCloseTo(a.y * 2, 6);
  });
});

// ─── Cross-renderer agreement ────────────────────────────────

describe('one coordinate projects identically for every renderer', () => {
  it('gives the cached table the same answer as a direct call', () => {
    const table = getProjectionTable(VIEW);
    forEachCell((c) => {
      const direct = project(c, VIEW);
      const cached = table.at(c);
      expect(cached.x).toBeCloseTo(direct.x, 12);
      expect(cached.y).toBeCloseTo(direct.y, 12);
      expect(cached.scale).toBeCloseTo(direct.scale, 12);
    });
  });

  it('returns the same table instance for the same viewport', () => {
    expect(getProjectionTable(VIEW)).toBe(getProjectionTable(VIEW));
  });

  it('rebuilds when the profile changes', () => {
    const a = getProjectionTable(VIEW);
    const b = getProjectionTable(VIEW, makeProfile({ rowDepth: 0.9 }));
    expect(a).not.toBe(b);
    expect(b.at({ col: 0, row: 7 }).scale).toBeLessThan(a.at({ col: 0, row: 7 }).scale);
  });

  it('aligns a ground marker with the actor standing on it', () => {
    // Selection ring and actor must share the contact point exactly.
    const p = project({ col: 3, row: 4 }, VIEW);
    expect(effectAnchor(p, 'feet')).toEqual({ x: p.x, y: p.y, scale: p.scale });
  });

  it('anchors damage effects to the actor body, above the feet', () => {
    const p = project({ col: 3, row: 4 }, VIEW);
    const torso = effectAnchor(p, 'torso');
    const head = effectAnchor(p, 'head');
    expect(torso.x).toBe(p.x);
    expect(torso.y).toBeLessThan(p.y);
    expect(head.y).toBeLessThan(torso.y);
    expect(head.y).toBeGreaterThan(p.y - p.actorHeight);
  });
});
