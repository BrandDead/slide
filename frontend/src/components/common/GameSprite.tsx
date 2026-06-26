import React from 'react';

/**
 * GameSprite — Renders pixel art sprites from sprite sheets.
 * Replaces emoji-based rendering with actual game art.
 * 
 * Usage:
 *   <GameSprite sheet="gang_members" frame={0} size={48} />
 *   <GameSprite sheet="drugs" frame={2} size={32} />
 *   <GameSprite icon="slide" size={60} />
 */

// Sprite sheet definitions: each sheet has a URL, frame dimensions, and frame count
const SPRITE_SHEETS: Record<string, { url: string; cols: number; rows: number; frameW: number; frameH: number }> = {
  gang_members: { url: '/assets/sprites/gang_members.png', cols: 4, rows: 1, frameW: 688, frameH: 1536 },
  drugs:        { url: '/assets/sprites/drugs.png',        cols: 4, rows: 2, frameW: 688, frameH: 768 },
  weapons:      { url: '/assets/sprites/weapons.png',      cols: 6, rows: 1, frameW: 459, frameH: 1536 },
  terrain:      { url: '/assets/sprites/terrain.png',      cols: 4, rows: 2, frameW: 688, frameH: 768 },
};

// ─── Generated character asset paths (Sprint: block-mode-combat-assets) ───
export const GENERATED_CHAR_PORTRAITS: Record<string, string> = {
  dealer_male_001:    '/assets/generated/characters/portraits/character_dealer_male_blacktee_portrait_v001.png',
  enforcer_male_001:  '/assets/generated/characters/portraits/character_enforcer_male_portrait_v001.png',
  lookout_female_001: '/assets/generated/characters/portraits/character_lookout_female_portrait_v001.png',
  driver_male_001:    '/assets/generated/characters/portraits/character_driver_male_portrait_v001.png',
};

export const GENERATED_CHAR_FULLBODY: Record<string, string> = {
  dealer_male_001:    '/assets/generated/characters/fullbody/character_dealer_male_blacktee_fullbody_front_v001.png',
  enforcer_male_001:  '/assets/generated/characters/fullbody/character_enforcer_male_fullbody_front_v001.png',
  lookout_female_001: '/assets/generated/characters/fullbody/character_lookout_female_fullbody_front_v001.png',
  driver_male_001:    '/assets/generated/characters/fullbody/character_driver_male_fullbody_front_v001.png',
};

export const GENERATED_CHAR_TOPDOWN: Record<string, string> = {
  dealer_male_001:   '/assets/generated/characters/topdown/character_dealer_male_blacktee_topdown_v001.png',
  enforcer_male_001: '/assets/generated/characters/topdown/character_enforcer_male_topdown_v001.png',
};

export const GENERATED_VEHICLE_TOPDOWN: Record<string, string> = {
  luxury_sedan_black: '/assets/generated/vehicles/topdown/vehicle_luxury_sedan_black_topdown_v001.png',
};

export const GENERATED_VEHICLE_STREET: Record<string, string> = {
  luxury_sedan_black: '/assets/generated/vehicles/street/vehicle_luxury_sedan_black_street_side_v001.png',
};

export const GENERATED_ENVIRONMENTS: Record<string, string> = {
  block_stripplaza_topdown:      '/assets/generated/environments/topdown/block_stripplaza_topdown_v001.png',
  block_stripplaza_street_day:   '/assets/generated/environments/street/block_stripplaza_day_street_v001.png',
  block_stripplaza_street_night: '/assets/generated/environments/street/block_stripplaza_night_street_v001.png',
};

// ─── Batch 2 additions (Sprint: morale-heat-photo-batch2) ───
export const GENERATED_CHAR_STREET: Record<string, string> = {
  dealer_male_aim:       '/assets/generated/characters/street/character_dealer_male_street_aim_v001.png',
  dealer_male_hit:       '/assets/generated/characters/street/character_dealer_male_street_hit_v001.png',
  dealer_male_downed:    '/assets/generated/characters/street/character_dealer_male_street_downed_v001.png',
  // Batch 4
  shooter_male_hit:      '/assets/generated/characters/street/character_shooter_male_street_hit_v001.png',
  shooter_male_downed:   '/assets/generated/characters/street/character_shooter_male_street_downed_v001.png',
  enforcer_male_idle:    '/assets/generated/characters/street/character_enforcer_male_street_idle_v001.png',
};

export const GENERATED_VEHICLE_OVERLAYS: Record<string, string> = {
  luxury_sedan_passenger: '/assets/generated/vehicles/overlays/vehicle_luxury_sedan_passenger_overlay_v001.png',
};

export const GENERATED_VEHICLE_DAMAGE: Record<string, string> = {
  luxury_sedan_damage_light: '/assets/generated/vehicles/damage/vehicle_luxury_sedan_black_damage_light_v001.png',
};

export const GENERATED_EFFECTS: Record<string, string> = {
  fx_combat_sheet: '/assets/generated/effects/fx_combat_sprite_sheet_v001.png',
};

// ─── UI overlays (Sprint: sfx-fps-ollama-assets) ───
export const GENERATED_UI_OVERLAYS: Record<string, string> = {
  fps_hud:          '/assets/generated/ui/fps_hud_elements_v001.png',
  security_cam:     '/assets/generated/ui/security_cam_overlay_v001.png',
  bullet_cam:       '/assets/generated/ui/bullet_cam_ui_v001.png',
  icon_news:        '/assets/generated/ui/icons/icon_news_v001.png',
};

// App icon definitions
const APP_ICONS: Record<string, string> = {
  slide:          '/assets/icons/icon_slide_new.png',
  cook:           '/assets/icons/icon_cook_new.png',
  map:            '/assets/icons/icon_map_new.png',
  crew:           '/assets/icons/icon_crew_new.png',
  dealt:          '/assets/icons/icon_dealt_new.png',
  ops:            '/assets/icons/icon_ops_new.png',
  shoebox:        '/assets/icons/icon_shoebox_new.png',
  market:         '/assets/icons/icon_market_new.png',
  casino:         '/assets/icons/icon_casino_new.png',
  settings:       '/assets/icons/icon_settings_new.png',
  driveby:        '/assets/icons/icon_driveby_new.png',
  graffiti:       '/assets/icons/icon_graffiti_new.png',
  news:           '/assets/generated/ui/icons/icon_news_v001.png',
  leaderboard:    '/assets/icons/icon_slide_new.png', // fallback until dedicated icon
  cocaine_crush:  '/assets/icons/icon_casino_new.png', // fallback until dedicated icon
};

// Role-to-frame mapping for gang members
export const MEMBER_FRAMES: Record<string, number> = {
  dealer:   0,
  shooter:  1,
  enforcer: 2,
  lookout:  3,
};

// Drug-to-frame mapping
export const DRUG_FRAMES: Record<string, number> = {
  cannabis:  0,
  cocaine:   1,
  meth:      2,
  pills:     3,
  heroin:    4,
  weed:      5,
  crack:     6,
  syringe:   7,
};

// Weapon-to-frame mapping
export const WEAPON_FRAMES: Record<string, number> = {
  pistol:        0,
  ak47:          1,
  shotgun:       2,
  bat:           3,
  knife:         4,
  brass_knuckles: 5,
};

// Terrain-to-frame mapping
export const TERRAIN_FRAMES: Record<string, number> = {
  street:      0,
  sidewalk:    1,
  alley:       2,
  building:    3,
  building2:   4,
  trap_house:  5,
  park:        6,
  parking_lot: 7,
};

interface GameSpriteProps {
  /** Which sprite sheet to use */
  sheet?: keyof typeof SPRITE_SHEETS;
  /** Frame index within the sheet */
  frame?: number;
  /** App icon name (alternative to sheet+frame) */
  icon?: keyof typeof APP_ICONS;
  /** Display size in pixels */
  size?: number;
  /** Optional CSS class */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
  /** Alt text for accessibility */
  alt?: string;
  /** Fallback emoji if sprite fails to load */
  fallback?: string;
}

export const GameSprite: React.FC<GameSpriteProps> = ({
  sheet,
  frame = 0,
  icon,
  size = 48,
  className = '',
  style = {},
  alt = '',
  fallback,
}) => {
  const [error, setError] = React.useState(false);

  // If icon mode, render a simple img
  if (icon) {
    const iconUrl = APP_ICONS[icon];
    if (!iconUrl || error) {
      return fallback ? <span style={{ fontSize: size * 0.6, ...style }}>{fallback}</span> : null;
    }
    return (
      <img
        src={iconUrl}
        alt={alt || icon}
        width={size}
        height={size}
        className={`game-sprite game-icon ${className}`}
        style={{ borderRadius: size * 0.22, objectFit: 'cover', imageRendering: 'auto', ...style }}
        onError={() => setError(true)}
        loading="lazy"
      />
    );
  }

  // Sprite sheet mode
  if (!sheet || !SPRITE_SHEETS[sheet] || error) {
    return fallback ? <span style={{ fontSize: size * 0.6, ...style }}>{fallback}</span> : null;
  }

  const def = SPRITE_SHEETS[sheet];
  const col = frame % def.cols;
  const row = Math.floor(frame / def.cols);

  // Calculate background position as percentages
  const bgPosX = def.cols > 1 ? (col / (def.cols - 1)) * 100 : 0;
  const bgPosY = def.rows > 1 ? (row / (def.rows - 1)) * 100 : 0;

  return (
    <div
      className={`game-sprite ${className}`}
      role="img"
      aria-label={alt}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${def.url})`,
        backgroundSize: `${def.cols * 100}% ${def.rows * 100}%`,
        backgroundPosition: `${bgPosX}% ${bgPosY}%`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        flexShrink: 0,
        ...style,
      }}
    />
  );
};

/**
 * Helper: Get the correct frame index for a member role
 */
export function getMemberFrame(role: string): number {
  return MEMBER_FRAMES[role.toLowerCase()] ?? 0;
}

/**
 * Helper: Get the correct frame index for a drug name
 */
export function getDrugFrame(drugName: string): number {
  const key = drugName.toLowerCase().replace(/\s+/g, '_');
  return DRUG_FRAMES[key] ?? 0;
}

/**
 * Helper: Get the correct frame index for a weapon name
 */
export function getWeaponFrame(weaponName: string): number {
  const key = weaponName.toLowerCase().replace(/\s+/g, '_');
  return WEAPON_FRAMES[key] ?? 0;
}

/**
 * Helper: Get the correct frame index for a terrain type
 */
export function getTerrainFrame(terrainType: string): number {
  const key = terrainType.toLowerCase().replace(/\s+/g, '_');
  return TERRAIN_FRAMES[key] ?? 0;
}

export default GameSprite;
