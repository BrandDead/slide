import { MacroCell, MacroCoord, macroToMicroRegion, MicroCell, Vehicle } from "./dualGrid";
import { MacroPattern, patternTargets } from "./attackPatterns";

export type DriveBySeat = "passenger" | "rearLeft" | "rearRight";

export type DriveByShot = {
  seat: DriveBySeat;
  target: MacroCoord;
  pattern: MacroPattern; // upgraded weapons choose patterns
};

export function availableShooterSeats(vehicle: Vehicle): DriveBySeat[] {
  const seats: DriveBySeat[] = [];
  if (vehicle.seats.passenger.alive) seats.push("passenger");
  if (vehicle.seats.rearLeft.alive) seats.push("rearLeft");
  if (vehicle.seats.rearRight.alive) seats.push("rearRight");
  return seats;
}

/**
 * Attacker turn:
 * - For each alive passenger seat, player picks ONE macro target.
 * - Apply pattern expansion per shot (single or AoE).
 * - Resolve hits on macro cells (infantry + traps).
 */
export function resolveDriveByTurn(
  macroGrid: MacroCell[][],
  shots: DriveByShot[],
  rng: () => number
) {
  const results: { seat: string; hit: boolean; affected: MacroCoord[] }[] = [];

  for (const shot of shots) {
    const affected = patternTargets(shot.target, shot.pattern);
    let anyHit = false;

    for (const t of affected) {
      const cell = macroGrid[t.y][t.x];
      cell.revealed = true;
      cell.hit = true;

      // Basic hit logic: if occupant exists, damage it
      if (cell.occupantId) {
        anyHit = true;
        const dmg = 1; // tune later via weapon stats
        cell.occupantHp = Math.max(0, (cell.occupantHp ?? 1) - dmg);
        if (cell.occupantHp === 0) {
          cell.occupantId = undefined;
        }
      }
    }

    results.push({ seat: shot.seat, hit: anyHit, affected });
  }

  return results;
}

/**
 * Defender turn:
 * - Defenders pick MICRO tiles on the car footprint for precision.
 * - Resolve part damage.
 */
export function resolveDefenseRetaliation(
  microGrid: MicroCell[][],
  vehicle: Vehicle,
  microShots: { targetI: number; targetJ: number }[]
) {
  const out: { hit: boolean; part?: string }[] = [];

  for (const s of microShots) {
    const cell = microGrid[s.targetJ][s.targetI];
    cell.revealed = true;
    cell.hit = true;

    if (cell.vehicleId === vehicle.id && cell.vehiclePart) {
      const part = cell.vehiclePart;
      vehicle.hpByPart[part] = Math.max(0, vehicle.hpByPart[part] - 1);
      cell.partHp = vehicle.hpByPart[part];

      // Seat KO logic (if a seat part is destroyed, that shooter dies)
      if (vehicle.hpByPart[part] === 0) {
        if (part === "passenger_seat") vehicle.seats.passenger.alive = false;
        if (part === "rear_left") vehicle.seats.rearLeft.alive = false;
        if (part === "rear_right") vehicle.seats.rearRight.alive = false;
      }

      out.push({ hit: true, part });
    } else {
      out.push({ hit: false });
    }
  }

  return out;
}
