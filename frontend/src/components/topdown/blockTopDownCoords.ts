// ============================================================
// blockTopDownCoords.ts — pure coordinate helpers for the
// Phaser top-down block scene.  No Phaser import — fully
// testable in Node/vitest without a canvas.
// ============================================================

export const GRID_COLS = 8;
export const GRID_ROWS = 8;

/** Canvas dimensions for the top-down scene */
export const TD_CANVAS_W = 480;
export const TD_CANVAS_H = 480;

/** Pixel size of each grid cell */
export const CELL_W = TD_CANVAS_W / GRID_COLS;  // 60
export const CELL_H = TD_CANVAS_H / GRID_ROWS;  // 60

/** Zone tint colours (ARGB hex for Phaser tintFill) */
export const ZONE_TINT: Record<string, number> = {
  street:     0x1a1a2e,
  curb:       0x16213e,
  sidewalk:   0x0f3460,
  storefront: 0x1b4332,
  alley:      0x212529,
  parking:    0x343a40,
  rooftop:    0x4a1942,
  building:   0x080808,
};

/** Zone tint alpha (0-1) — keeps the satellite image visible */
export const ZONE_ALPHA: Record<string, number> = {
  street:     0.30,
  curb:       0.32,
  sidewalk:   0.32,
  storefront: 0.34,
  alley:      0.42,
  parking:    0.34,
  rooftop:    0.38,
  building:   0.62,
};

/** Role accent colours (0xRRGGBB) */
export const ROLE_TINT: Record<string, number> = {
  dealer:   0x4ade80,
  shooter:  0xef4444,
  enforcer: 0xf97316,
  lookout:  0xfacc15,
  driver:   0x60a5fa,
  chemist:  0xa78bfa,
  runner:   0xfb7185,
  boss:     0xfbbf24,
};

/** Map a role to the topdown sprite filename (without extension) */
export const ROLE_TO_SPRITE: Record<string, string> = {
  dealer:   'character_dealer_male_blacktee_topdown_v001',
  shooter:  'character_shooter_male_topdown_v001',
  enforcer: 'character_enforcer_male_topdown_v001',
  lookout:  'character_lookout_female_topdown_v001',
  driver:   'character_driver_male_topdown_v001',
  // fallbacks for roles without a dedicated sprite
  chemist:  'character_dealer_male_blacktee_topdown_v001',
  runner:   'character_lookout_female_topdown_v001',
  boss:     'character_enforcer_male_topdown_v001',
};

/** Sprite asset path prefix (served from /public) */
export const SPRITE_BASE = '/assets/runtime/generated/characters/topdown/';

/** Return the full URL for a role's topdown sprite */
export function spriteUrlForRole(role: string): string {
  const name = ROLE_TO_SPRITE[role] ?? ROLE_TO_SPRITE.dealer;
  return `${SPRITE_BASE}${name}.webp`;
}

/** Convert grid col/row → canvas pixel centre */
export function cellToPixel(col: number, row: number): { x: number; y: number } {
  return {
    x: col * CELL_W + CELL_W / 2,
    y: row * CELL_H + CELL_H / 2,
  };
}

/** Convert canvas pixel → grid col/row (clamped to grid bounds) */
export function pixelToCell(px: number, py: number): { col: number; row: number } {
  return {
    col: Math.max(0, Math.min(GRID_COLS - 1, Math.floor(px / CELL_W))),
    row: Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(py / CELL_H))),
  };
}

/** Return the top-left pixel of a cell */
export function cellOrigin(col: number, row: number): { x: number; y: number } {
  return { x: col * CELL_W, y: row * CELL_H };
}

/**
 * Sprite scale so a character fits neatly inside one cell with a small margin.
 * Assumes source sprites are 256×256 px.
 */
export const SPRITE_SOURCE_SIZE = 256;
export const SPRITE_SCALE = (CELL_W * 0.72) / SPRITE_SOURCE_SIZE;

/** Health bar dimensions (relative to cell) */
export const HP_BAR_W = CELL_W * 0.7;
export const HP_BAR_H = 4;
export const HP_BAR_OFFSET_Y = CELL_H * 0.42; // above sprite centre

/** Indicator dot radius */
export const INDICATOR_R = 4;
