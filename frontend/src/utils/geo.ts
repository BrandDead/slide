/** Earth radius in meters (mean). */
const EARTH_M = 6_371_000;

export function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in meters. */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Offset a lat/lng by north/east meters (local tangent plane). */
export function offsetLatLng(
  lat: number,
  lng: number,
  northMeters: number,
  eastMeters: number,
): { lat: number; lng: number } {
  const dLat = northMeters / 111_320;
  const dLng = eastMeters / (111_320 * Math.cos(toRadians(lat)) || 1);
  return { lat: lat + dLat, lng: lng + dLng };
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km`;
}

export function formatWalkingMins(meters: number): string {
  const mins = Math.max(1, Math.round(meters / 80)); // ~5 km/h
  return `${mins} min`;
}
