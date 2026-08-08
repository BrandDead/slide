// ============================================================
// SLIDE / DEALT — Asset Manifest
// Maps logical asset IDs to file paths
// Sprint: block-mode-combat-assets
// ============================================================

// ─── Character Asset Type ────────────────────────────────────

export type CharacterRole =
  | 'dealer'
  | 'shooter'
  | 'driver'
  | 'enforcer'
  | 'lookout'
  | 'chemist'
  | 'runner'
  | 'boss'
  | 'civilian'
  | 'rival';

export type AssetRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface CharacterAsset {
  id: string;
  displayName: string;
  role: CharacterRole;
  portrait: string;
  fullbody: string;
  topdown: string;
  streetIdle: string;
  streetAim?: string;
  streetFire?: string;
  streetHit?: string;
  streetDowned?: string;
  rarity?: AssetRarity;
  tags: string[];
  scale: number;
  anchor: { x: number; y: number };
  hitbox: { width: number; height: number };
}

export interface VehicleAsset {
  id: string;
  displayName: string;
  vehicleClass: 'sedan' | 'coupe' | 'suv' | 'luxury_sedan' | 'van' | 'truck' | 'authority';
  topdown: string;
  streetSide: string;
  windowsDown?: string;
  occupiedDriver?: string;
  occupiedPassenger?: string;
  damageLight?: string;
  damageHeavy?: string;
  shadow?: string;
}

export interface WeaponAsset {
  id: string;
  displayName: string;
  category: 'compact' | 'long' | 'melee';
  icon: string;
}

export interface ProductAsset {
  id: string;
  displayName: string;
  tier: 1 | 2 | 3 | 4;
  rarity: AssetRarity;
  icon: string;
  marketCardArt?: string;
}

export interface EnvironmentAsset {
  id: string;
  displayName: string;
  topdownBg?: string;
  streetBackdropDay?: string;
  streetBackdropNight?: string;
}

// ─── Base paths ──────────────────────────────────────────────
const BASE = '/assets/generated';
const CHARS = `${BASE}/characters`;
const VEHS  = `${BASE}/vehicles`;
const WEAPS = `${BASE}/weapons`;
const PRODS = `${BASE}/products`;
const ENVS  = `${BASE}/environments`;

// ─── Characters ──────────────────────────────────────────────

export const characterAssets: Record<string, CharacterAsset> = {
  dealer_male_001: {
    id: 'dealer_male_001',
    displayName: 'Street Dealer',
    role: 'dealer',
    portrait:    `${CHARS}/portraits/character_dealer_male_blacktee_portrait_v001.png`,
    fullbody:    `${CHARS}/fullbody/character_dealer_male_blacktee_fullbody_front_v001.png`,
    topdown:     `${CHARS}/topdown/character_dealer_male_blacktee_topdown_v001.png`,
    streetIdle:  `${CHARS}/street/character_dealer_male_blacktee_street_idle_v001.png`,
    streetAim:   `${CHARS}/street/character_dealer_male_street_aim_v001.png`,
    streetHit:   `${CHARS}/street/character_dealer_male_street_hit_v001.png`,
    streetDowned: `${CHARS}/street/character_dealer_male_street_downed_v001.png`,
    rarity: 'common',
    tags: ['masked', 'cash', 'streetwear'],
    scale: 1,
    anchor: { x: 0.5, y: 1 },
    hitbox: { width: 72, height: 144 },
  },
  lookout_female_001: {
    id: 'lookout_female_001',
    displayName: 'Lookout',
    role: 'lookout',
    portrait:    `${CHARS}/portraits/character_lookout_female_portrait_v001.png`,
    fullbody:    `${CHARS}/fullbody/character_lookout_female_fullbody_front_v001.png`,
    topdown:     `${CHARS}/topdown/character_lookout_female_topdown_v001.png`,
    streetIdle:  `${CHARS}/street/character_lookout_female_street_idle_v001.png`,
    rarity: 'common',
    tags: ['masked', 'radio', 'streetwear'],
    scale: 1,
    anchor: { x: 0.5, y: 1 },
    hitbox: { width: 68, height: 138 },
  },
  driver_male_001: {
    id: 'driver_male_001',
    displayName: 'Driver',
    role: 'driver',
    portrait:    `${CHARS}/portraits/character_driver_male_portrait_v001.png`,
    fullbody:    `${CHARS}/fullbody/character_driver_male_fullbody_front_v001.png`,
    topdown:     `${CHARS}/topdown/character_driver_male_topdown_v001.png`,
    streetIdle:  `${CHARS}/street/character_driver_male_street_idle_v001.png`,
    rarity: 'uncommon',
    tags: ['cap', 'racing_jacket', 'keys'],
    scale: 1,
    anchor: { x: 0.5, y: 1 },
    hitbox: { width: 70, height: 140 },
  },
  enforcer_male_001: {
    id: 'enforcer_male_001',
    displayName: 'Enforcer',
    role: 'enforcer',
    portrait:    `${CHARS}/portraits/character_enforcer_male_portrait_v001.png`,
    fullbody:    `${CHARS}/fullbody/character_enforcer_male_fullbody_front_v001.png`,
    topdown:     `${CHARS}/topdown/character_enforcer_male_topdown_v001.png`,
    streetIdle:  `${CHARS}/street/character_enforcer_male_street_idle_v001.png`,
    rarity: 'uncommon',
    tags: ['tactical', 'vest', 'bat'],
    scale: 1.1,
    anchor: { x: 0.5, y: 1 },
    hitbox: { width: 80, height: 152 },
  },
  shooter_male_001: {
    id: 'shooter_male_001',
    displayName: 'Shooter',
    role: 'shooter',
    portrait:    `${CHARS}/portraits/character_shooter_male_portrait_v001.png`,
    fullbody:    `${CHARS}/fullbody/character_shooter_male_fullbody_front_v001.png`,
    topdown:     `${CHARS}/topdown/character_shooter_male_topdown_v001.png`,
    streetIdle:  `${CHARS}/street/character_shooter_male_street_idle_v001.png`,
    streetHit:   `${CHARS}/street/character_shooter_male_street_hit_v001.png`,
    streetDowned: `${CHARS}/street/character_shooter_male_street_downed_v001.png`,
    rarity: 'uncommon',
    tags: ['masked', 'streetwear', 'weapon'],
    scale: 1,
    anchor: { x: 0.5, y: 1 },
    hitbox: { width: 72, height: 144 },
  },
};

// ─── Vehicles ────────────────────────────────────────────────

export const vehicleAssets: Record<string, VehicleAsset> = {
  luxury_sedan_black_001: {
    id: 'luxury_sedan_black_001',
    displayName: 'Black Luxury Sedan',
    vehicleClass: 'luxury_sedan',
    topdown:         `${VEHS}/topdown/vehicle_luxury_sedan_black_topdown_v001.png`,
    streetSide:      `${VEHS}/street/vehicle_luxury_sedan_black_street_side_v001.png`,
    occupiedPassenger: `${VEHS}/overlays/vehicle_luxury_sedan_passenger_overlay_v001.png`,
    damageLight:     `${VEHS}/damage/vehicle_luxury_sedan_black_damage_light_v001.png`,
  },
};

// ─── Weapons ─────────────────────────────────────────────────

export const weaponAssets: Record<string, WeaponAsset> = {
  compact_prop_black_001: {
    id: 'compact_prop_black_001',
    displayName: 'Compact Prop',
    category: 'compact',
    icon: `${WEAPS}/weapon_compact_prop_black_icon_v001.png`,
  },
  long_prop_black_001: {
    id: 'long_prop_black_001',
    displayName: 'Long Prop',
    category: 'long',
    icon: `${WEAPS}/weapon_long_prop_black_icon_v001.png`,
  },
  // Batch 4 — drum-magazine long prop
  long_prop_drum_001: {
    id: 'long_prop_drum_001',
    displayName: 'Drum Prop',
    category: 'long',
    icon: `${WEAPS}/weapon_long_prop_black_icon_v001.png`,
  },
};

// ─── Products ────────────────────────────────────────────────

export const productAssets: Record<string, ProductAsset> = {
  product_common_001: {
    id: 'product_common_001',
    displayName: 'Common Pack',
    tier: 1,
    rarity: 'common',
    icon: `${PRODS}/product_pack_grey_common_icon_v001.png`,
  },
  product_uncommon_001: {
    id: 'product_uncommon_001',
    displayName: 'Green Pack',
    tier: 2,
    rarity: 'uncommon',
    icon: `${PRODS}/product_pack_green_uncommon_icon_v001.png`,
  },
  product_rare_001: {
    id: 'product_rare_001',
    displayName: 'Purple Pack',
    tier: 3,
    rarity: 'rare',
    icon: `${PRODS}/product_pack_purple_rare_icon_v001.png`,
  },
  product_legendary_001: {
    id: 'product_legendary_001',
    displayName: 'Gold Pack',
    tier: 4,
    rarity: 'legendary',
    icon: `${PRODS}/product_pack_gold_legendary_icon_v001.png`,
  },
};

// ─── Effects ─────────────────────────────────────────────────

export const effectAssets = {
  fx_combat_sheet: `${BASE}/effects/fx_combat_sprite_sheet_v001.png`,
};

// ─── Environments ────────────────────────────────────────────

export const environmentAssets: Record<string, EnvironmentAsset> = {
  block_stripplaza_miami_001: {
    id: 'block_stripplaza_miami_001',
    displayName: 'South Florida Strip Plaza',
    topdownBg:           `${ENVS}/topdown/block_stripplaza_topdown_v001.png`,
    streetBackdropDay:   `${ENVS}/street/block_stripplaza_day_street_v001.png`,
    streetBackdropNight: `${ENVS}/street/block_stripplaza_night_street_v001.png`,
  },
// Las Olas hero block. Processed WebP paths keep shipped runtime assets within budget.
  block_lasolas_miami_001: {
    id: 'block_lasolas_miami_001',
    displayName: 'Las Olas Boulevard',
    topdownBg:           `/assets/runtime/generated/environments/topdown/block_lasolas_topdown_v001.webp`,
    streetBackdropDay:   `/assets/runtime/generated/environments/street/block_lasolas_driveby_street_v001.webp`,
    streetBackdropNight: `/assets/runtime/generated/environments/street/block_lasolas_driveby_street_v001.webp`,
  },
};

// ─── UI Icons (generated set) ────────────────────────────────

export const uiIconPaths: Record<string, string> = {
  map:      '/assets/icons/icon_map.png',
  crew:     '/assets/icons/icon_crew.png',
  market:   '/assets/icons/icon_market.png',
  shoebox:  '/assets/icons/icon_shoebox.png',
  slide:    '/assets/icons/icon_slide.png',
  drive:    '/assets/icons/icon_drive.png',
  cook:     '/assets/icons/icon_cook.png',
  casino:   '/assets/icons/icon_casino.png',
  missions: '/assets/icons/icon_missions.png',
  settings: '/assets/icons/icon_settings.png',
  dealt:    '/assets/icons/icon_dealt.png',
  ops:      '/assets/icons/icon_ops.png',
};

// ─── Aggregated manifest ─────────────────────────────────────

export const assetManifest = {
  characters:   characterAssets,
  vehicles:     vehicleAssets,
  weapons:      weaponAssets,
  products:     productAssets,
  environments: environmentAssets,
  effects:      effectAssets,
  ui:           uiIconPaths,
} as const;

export default assetManifest;
