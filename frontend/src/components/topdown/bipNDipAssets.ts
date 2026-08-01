// ============================================================
// SLIDE — Bip N Dip vehicle art lookup
// frontend/src/components/topdown/bipNDipAssets.ts
//
// Only one car body ships today (the black luxury sedan, street side
// view). Every tier therefore resolves to it. Keeping the mapping in a
// named function rather than inlining the path means adding a junk
// body later is a one-line change here, not a component edit.
// ============================================================

import type { CarTier } from '../../utils/bipNDipEngine';

const SEDAN_STREET =
  '/assets/generated/vehicles/street/vehicle_luxury_sedan_black_street_side_v001.png';

const TIER_SPRITE: Record<CarTier, string> = {
  junk: SEDAN_STREET,
  standard: SEDAN_STREET,
  luxury: SEDAN_STREET,
  exotic: SEDAN_STREET,
};

export function resolveVehicleSprite(tier: CarTier): string {
  return TIER_SPRITE[tier] ?? SEDAN_STREET;
}
