import type { GangMember } from '../../types/game.types';
import type { CarCrew } from './CarCrewSelector';

/** A driver can be shooter-trained, but never fires from the vehicle. */
export function availablePassengerShooters(crew: CarCrew | null | undefined, members: GangMember[]): GangMember[] {
  if (!crew) return [];
  const driverId = crew.seats.find(seat => seat.position === 'driver')?.memberId;
  const driver = members.find(member => member.id === driverId);
  if (!driver || driver.status !== 'active' ||
      !['dealer', 'recruit', 'shooter', 'driver'].includes(driver.role ?? '')) return [];
  const seen = new Set<string>([driverId!]);
  const shooters: GangMember[] = [];
  for (const seat of crew.seats) {
    if (!['passenger', 'back_left', 'back_right'].includes(seat.position) ||
        !seat.memberId || seen.has(seat.memberId)) continue;
    seen.add(seat.memberId);
    const member = members.find(candidate => candidate.id === seat.memberId);
    if (member?.status === 'active' && member.role === 'shooter') shooters.push(member);
  }
  return shooters;
}
