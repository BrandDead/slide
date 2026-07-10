// ============================================================
// vehicleEngine.ts — Vehicle seat rules, drive-by logic,
// and on-foot attack transitions for DEALT/SLIDE
//
// VEHICLE RULES:
//   - Any role can be assigned as a driver.
//   - While driving, the driver CANNOT shoot.
//   - The center back seat passenger CANNOT shoot from the car.
//   - Car seat limits are enforced (4-door = 5 people max).
//   - Players can exit the car to attack on foot.
//   - Recruits can steal cars and sell them or use them for attacks.
// ============================================================

import {
  VEHICLE_SEAT_CONFIGS,
  ROLE_CAN_SHOOT_RANGED,
  type VehicleType,
  type VehicleSeatConfig,
  type MemberRole,
} from '../config/roleMechanics';

// ─── SEAT TYPES ──────────────────────────────────────────────

export type SeatPosition =
  | 'driver'
  | 'front_passenger'
  | 'back_left'
  | 'back_center'   // cannot shoot from car
  | 'back_right'
  | 'third_row_left'
  | 'third_row_right';

export interface VehicleSeat {
  position: SeatPosition;
  memberId: string | null;
  canShootFromCar: boolean;
  isDriver: boolean;
}

export interface Vehicle {
  id: string;
  type: VehicleType;
  name: string;
  seats: VehicleSeat[];
  stolenBy?: string;   // recruit member ID who stole it
  condition: number;   // 0-100 (affects speed and escape chance)
}

// ─── VEHICLE DEFINITIONS ─────────────────────────────────────

export const VEHICLE_TEMPLATES: Record<VehicleType, {
  name: string;
  seats: Array<{ position: SeatPosition; canShootFromCar: boolean; isDriver: boolean }>;
  baseCondition: number;
  escapeBonus: number;
  description: string;
}> = {
  '4door': {
    name: '4-Door Sedan',
    seats: [
      { position: 'driver',           canShootFromCar: false, isDriver: true  },
      { position: 'front_passenger',  canShootFromCar: true,  isDriver: false },
      { position: 'back_left',        canShootFromCar: true,  isDriver: false },
      { position: 'back_center',      canShootFromCar: false, isDriver: false },  // center — cannot shoot
      { position: 'back_right',       canShootFromCar: true,  isDriver: false },
    ],
    baseCondition: 70,
    escapeBonus: 10,
    description: '5 people. 3 can shoot. Center back cannot shoot.',
  },
  '2door': {
    name: '2-Door Coupe',
    seats: [
      { position: 'driver',           canShootFromCar: false, isDriver: true  },
      { position: 'front_passenger',  canShootFromCar: true,  isDriver: false },
    ],
    baseCondition: 80,
    escapeBonus: 20,
    description: '2 people. 1 can shoot. Fast getaway.',
  },
  'suv': {
    name: 'SUV',
    seats: [
      { position: 'driver',           canShootFromCar: false, isDriver: true  },
      { position: 'front_passenger',  canShootFromCar: true,  isDriver: false },
      { position: 'back_left',        canShootFromCar: true,  isDriver: false },
      { position: 'back_right',       canShootFromCar: true,  isDriver: false },
      { position: 'third_row_left',   canShootFromCar: true,  isDriver: false },
      { position: 'third_row_right',  canShootFromCar: true,  isDriver: false },
    ],
    baseCondition: 75,
    escapeBonus: 5,
    description: '6 people. 5 can shoot. Best for large crews.',
  },
  'van': {
    name: 'Cargo Van',
    seats: [
      { position: 'driver',           canShootFromCar: false, isDriver: true  },
      { position: 'front_passenger',  canShootFromCar: true,  isDriver: false },
      { position: 'back_left',        canShootFromCar: true,  isDriver: false },
      { position: 'back_center',      canShootFromCar: true,  isDriver: false },
      { position: 'back_right',       canShootFromCar: true,  isDriver: false },
      { position: 'third_row_left',   canShootFromCar: true,  isDriver: false },
      { position: 'third_row_right',  canShootFromCar: true,  isDriver: false },
    ],
    baseCondition: 60,
    escapeBonus: 0,
    description: '7 people. 6 can shoot. Slow but carries the whole crew.',
  },
  'motorcycle': {
    name: 'Motorcycle',
    seats: [
      { position: 'driver',           canShootFromCar: false, isDriver: true  },
      { position: 'back_left',        canShootFromCar: true,  isDriver: false },
    ],
    baseCondition: 90,
    escapeBonus: 35,
    description: '2 people. Passenger can shoot. Fastest escape.',
  },
};

// ─── VEHICLE FACTORY ─────────────────────────────────────────

/**
 * Create a new vehicle instance from a template.
 */
export function createVehicle(type: VehicleType, stolenBy?: string): Vehicle {
  const template = VEHICLE_TEMPLATES[type];
  return {
    id: `vehicle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    name: template.name,
    seats: template.seats.map((s) => ({ ...s, memberId: null })),
    stolenBy,
    condition: template.baseCondition,
  };
}

// ─── SEAT ASSIGNMENT ─────────────────────────────────────────

export interface SeatAssignmentResult {
  success: boolean;
  reason?: string;
}

/**
 * Assign a member to a seat in a vehicle.
 * Validates seat availability and role rules.
 */
export function assignMemberToSeat(
  vehicle: Vehicle,
  memberId: string,
  memberRole: MemberRole,
  seatPosition: SeatPosition,
): SeatAssignmentResult {
  const seat = vehicle.seats.find((s) => s.position === seatPosition);

  if (!seat) {
    return { success: false, reason: `No ${seatPosition} seat in this vehicle.` };
  }

  if (seat.memberId !== null) {
    return { success: false, reason: `${seatPosition} seat is already taken.` };
  }

  // Chemists cannot be deployed in vehicles
  if (memberRole === 'chemist') {
    return { success: false, reason: 'Chemists stay in the lab. They cannot ride in vehicles.' };
  }

  return { success: true };
}

/**
 * Check if a member in a given seat can shoot from the car.
 * Drivers can never shoot while driving.
 */
export function canShootFromSeat(
  vehicle: Vehicle,
  seatPosition: SeatPosition,
  memberRole: MemberRole,
): boolean {
  const seat = vehicle.seats.find((s) => s.position === seatPosition);
  if (!seat) return false;

  // Driver can never shoot
  if (seat.isDriver) return false;

  // Center back seat cannot shoot
  if (!seat.canShootFromCar) return false;

  // Role must be able to shoot ranged
  return ROLE_CAN_SHOOT_RANGED[memberRole] ?? false;
}

/**
 * Get the list of members who can shoot from a given vehicle.
 */
export function getShootersInVehicle(
  vehicle: Vehicle,
  memberRoles: Record<string, MemberRole>,
): string[] {
  return vehicle.seats
    .filter((seat) => {
      if (!seat.memberId) return false;
      return canShootFromSeat(vehicle, seat.position, memberRoles[seat.memberId] ?? 'recruit');
    })
    .map((seat) => seat.memberId!);
}

// ─── ON-FOOT TRANSITION ──────────────────────────────────────

export interface OnFootTransition {
  memberId: string;
  role: MemberRole;
  canShootOnFoot: boolean;
  canFightMeleeOnFoot: boolean;
}

/**
 * When a member exits the vehicle, determine their on-foot capabilities.
 * On foot, all normal role rules apply.
 */
export function getMemberOnFootCapabilities(
  memberId: string,
  role: MemberRole,
): OnFootTransition {
  return {
    memberId,
    role,
    canShootOnFoot: ROLE_CAN_SHOOT_RANGED[role] ?? false,
    canFightMeleeOnFoot: role === 'enforcer' || role === 'recruit' || role === 'boss' || role === 'lookout' || role === 'runner',
  };
}

// ─── VEHICLE DAMAGE ──────────────────────────────────────────

export interface VehicleDamageResult {
  newCondition: number;
  destroyed: boolean;
  tiresBlown: boolean;
  glassShattered: boolean;
  engineDamaged: boolean;
}

/**
 * Apply damage to a vehicle and calculate effects.
 * Tire hits cause swerving (accuracy penalty for shooters).
 * Engine hits reduce escape chance.
 */
export function applyVehicleDamage(
  vehicle: Vehicle,
  damage: number,
  hitLocation: 'body' | 'tires' | 'engine' | 'glass',
): VehicleDamageResult {
  const newCondition = Math.max(0, vehicle.condition - damage);
  const destroyed = newCondition <= 0;

  return {
    newCondition,
    destroyed,
    tiresBlown: hitLocation === 'tires' && damage >= 20,
    glassShattered: hitLocation === 'glass',
    engineDamaged: hitLocation === 'engine' && damage >= 30,
  };
}

/**
 * Calculate escape probability based on vehicle condition and driver level.
 */
export function calculateEscapeProbability(
  vehicle: Vehicle,
  driverLevel: number,
): number {
  const template = VEHICLE_TEMPLATES[vehicle.type];
  const conditionFactor = vehicle.condition / 100;
  const driverBonus = Math.min(30, driverLevel * 2);
  const base = 40 + template.escapeBonus + driverBonus;
  return Math.min(95, Math.round(base * conditionFactor));
}
