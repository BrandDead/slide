// frontend/src/utils/dualGrid.ts

export const MACRO_SIZE = 8 as const;
export const MICRO_SIZE = 16 as const;

export type Layer = "macro" | "micro";

export type MacroCoord = { x: number; y: number };
export type MicroCoord = { i: number; j: number };

export type MacroCell = {
  coord: MacroCoord;
  revealed: boolean;
  hit: boolean;
  occupantId?: string;     // shooter/dealer/etc
  occupantHp?: number;     // optional for multi-HP infantry
};

export type MicroCell = {
  coord: MicroCoord;
  revealed: boolean;
  hit: boolean;
  vehicleId?: string;
  vehiclePart?: VehiclePart; // hood/seat/trunk/etc
  partHp?: number;
};

export type VehiclePart =
  | "hood"
  | "driver_seat"
  | "passenger_seat"
  | "rear_left"
  | "rear_right"
  | "trunk";

export type Vehicle = {
  id: string;
  origin: MicroCoord;      // top-left micro coord of footprint
  facing: "N" | "S" | "E" | "W";
  // seats: driver can't shoot, others can
  seats: {
    driver: { alive: boolean };
    passenger: { alive: boolean };
    rearLeft: { alive: boolean };
    rearRight: { alive: boolean };
  };
  hpByPart: Record<VehiclePart, number>;
};

export function inBoundsMacro({ x, y }: MacroCoord) {
  return x >= 0 && x < MACRO_SIZE && y >= 0 && y < MACRO_SIZE;
}

export function inBoundsMicro({ i, j }: MicroCoord) {
  return i >= 0 && i < MICRO_SIZE && j >= 0 && j < MICRO_SIZE;
}

export function macroToMicroRegion({ x, y }: MacroCoord): MicroCoord[] {
  return [
    { i: x * 2,     j: y * 2 },
    { i: x * 2 + 1, j: y * 2 },
    { i: x * 2,     j: y * 2 + 1 },
    { i: x * 2 + 1, j: y * 2 + 1 },
  ];
}

export function microToMacro({ i, j }: MicroCoord): MacroCoord {
  return { x: Math.floor(i / 2), y: Math.floor(j / 2) };
}

/**
 * Vehicle footprint template (2x4 in micro tiles), BEFORE rotation:
 * Row 0: hood hood
 * Row 1: driver passenger
 * Row 2: rear_left rear_right
 * Row 3: trunk trunk
 */
export const VEHICLE_TEMPLATE_2x4: VehiclePart[][] = [
  ["hood", "hood"],
  ["driver_seat", "passenger_seat"],
  ["rear_left", "rear_right"],
  ["trunk", "trunk"],
];

export function rotatedTemplate(
  tpl: VehiclePart[][],
  facing: Vehicle["facing"]
): { w: number; h: number; at: (dx: number, dy: number) => VehiclePart } {
  const h = tpl.length;
  const w = tpl[0].length;

  // Normalize rotations by mapping (dx,dy) -> original tpl[y][x]
  if (facing === "N") {
    return { w, h, at: (dx, dy) => tpl[dy][dx] };
  }
  if (facing === "S") {
    return { w, h, at: (dx, dy) => tpl[h - 1 - dy][w - 1 - dx] };
  }
  if (facing === "E") {
    // rotate clockwise: newW = h, newH = w
    return {
      w: h,
      h: w,
      at: (dx, dy) => tpl[h - 1 - dx][dy],
    };
  }
  // facing === "W"
  return {
    w: h,
    h: w,
    at: (dx, dy) => tpl[dx][w - 1 - dy],
  };
}

export function vehicleFootprint(vehicle: Vehicle): { cell: MicroCoord; part: VehiclePart }[] {
  const rot = rotatedTemplate(VEHICLE_TEMPLATE_2x4, vehicle.facing);
  const out: { cell: MicroCoord; part: VehiclePart }[] = [];

  for (let dy = 0; dy < rot.h; dy++) {
    for (let dx = 0; dx < rot.w; dx++) {
      const part = rot.at(dx, dy);
      out.push({
        cell: { i: vehicle.origin.i + dx, j: vehicle.origin.j + dy },
        part,
      });
    }
  }
  return out;
}

export function canPlaceVehicle(vehicle: Vehicle, microGrid: MicroCell[][]): boolean {
  const fp = vehicleFootprint(vehicle);
  for (const { cell } of fp) {
    if (!inBoundsMicro(cell)) return false;
    const c = microGrid[cell.j][cell.i];
    if (c.vehicleId) return false; // collision
  }
  return true;
}

export function stampVehicle(vehicle: Vehicle, microGrid: MicroCell[][]) {
  const fp = vehicleFootprint(vehicle);
  for (const { cell, part } of fp) {
    const c = microGrid[cell.j][cell.i];
    c.vehicleId = vehicle.id;
    c.vehiclePart = part;
    c.partHp = vehicle.hpByPart[part];
  }
}
