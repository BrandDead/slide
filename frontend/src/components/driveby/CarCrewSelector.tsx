// Crew preparation for the passenger-only drive-by; the driver never fires from the car.
import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGangStore } from '../../stores/gameStore';
import { useCombatIntentStore } from '../../stores/combatIntentStore';
import type { GangMember } from '../../types/game.types';
import { getPortrait } from '../../render/worldActorResolver';
import { getCarLoadoutBackdropUrl } from '../../services/assetResolver';
import AddressSearchBar, { type AddressResult } from '../map/AddressSearchBar';
import { normalizeAddressText, type DriveByTarget } from '../../utils/driveByTarget';
import './CarCrewSelector.css';

export interface CarSeat {
  position: 'driver' | 'passenger' | 'back_left' | 'back_right';
  label: string;
  allowedRoles: string[];
  memberId: string | null;
}
export interface CarCrew {
  seats: CarSeat[];
  targetBlock: DriveByTarget | null;
}
interface Props { onConfirm: (crew: CarCrew) => void; onCancel: () => void }

const DRIVER_ROLES = ['dealer', 'recruit', 'shooter', 'driver'];
const SHOOTER_ROLES = ['shooter'];
const INITIAL_SEATS: CarSeat[] = [
  { position: 'driver', label: 'Driver', allowedRoles: DRIVER_ROLES, memberId: null },
  { position: 'passenger', label: 'Passenger (Shooter)', allowedRoles: SHOOTER_ROLES, memberId: null },
  { position: 'back_left', label: 'Back Left (Shooter)', allowedRoles: SHOOTER_ROLES, memberId: null },
  { position: 'back_right', label: 'Back Right (Shooter)', allowedRoles: SHOOTER_ROLES, memberId: null },
];
function eligible(seat: CarSeat, member: GangMember | undefined): boolean {
  return Boolean(member?.status === 'active' && seat.allowedRoles.includes(member.role ?? ''));
}
function ready(seats: CarSeat[], members: GangMember[]): boolean {
  const occupied = seats.filter(s => s.memberId);
  if (new Set(occupied.map(s => s.memberId)).size !== occupied.length) return false;
  if (!occupied.every(s => eligible(s, members.find(m => m.id === s.memberId)))) return false;
  return Boolean(seats.find(s => s.position === 'driver')?.memberId && occupied.some(s => s.position !== 'driver'));
}
const storedPortrait = (member: GangMember) => member.customAvatarUrl || member.portraitUrl || member.avatarUrl;
function MemberPortrait({ member, className, onFallback }: { member: GangMember; className: string; onFallback?: () => void }) {
  const identity = storedPortrait(member);
  const roleArt = getPortrait(member.role ?? 'recruit');
  const [url, setUrl] = useState<string | null>(identity || roleArt);
  useEffect(() => setUrl(identity || roleArt), [identity, roleArt]);
  if (!url) return <span className={`${className} portrait-unavailable`} aria-label="Portrait unavailable">{member.name.slice(0, 1)}</span>;
  return <img className={className} src={url}
    alt={identity && url === identity ? `${member.name} portrait` : `${member.role ?? 'Crew'} role portrait (not member likeness)`}
    onError={() => {
      if (url !== roleArt && roleArt) { onFallback?.(); setUrl(roleArt); }
      else setUrl(null);
    }} />;
}

const CarCrewSelector: React.FC<Props> = ({ onConfirm, onCancel }) => {
  const members = useGangStore(s => s.members);
  const pendingTarget = useCombatIntentStore(s => s.pendingTarget);
  const [seats, setSeats] = useState<CarSeat[]>(() => INITIAL_SEATS.map(s => ({ ...s })));
  const [selectedSeat, setSelectedSeat] = useState<CarSeat['position'] | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [failedPortraits, setFailedPortraits] = useState<Set<string>>(() => new Set());
  const [target, setTarget] = useState<DriveByTarget | null>(pendingTarget);
  const [targetText, setTargetText] = useState('');
  useEffect(() => { if (pendingTarget) setTarget(pendingTarget); }, [pendingTarget]);

  const assigned = useMemo(() => new Set(seats.map(s => s.memberId).filter(Boolean)), [seats]);
  const selected = seats.find(s => s.position === selectedSeat);
  const choices = selected ? members.filter(m => !assigned.has(m.id) && eligible(selected, m)) : [];
  const focused = members.find(m => m.id === focusedId);
  const canLaunch = ready(seats, members);
  const count = seats.filter(s => s.memberId && eligible(s, members.find(m => m.id === s.memberId))).length;
  const portraitKey = (member: GangMember) => `${member.id}:${storedPortrait(member)}`;
  const showsRoleArt = (member: GangMember) => !storedPortrait(member) || failedPortraits.has(portraitKey(member));
  const markPortraitFallback = (member: GangMember) => setFailedPortraits(prev => new Set(prev).add(portraitKey(member)));

  function assignMember(position: CarSeat['position'], id: string) {
    const seat = seats.find(s => s.position === position);
    if (!seat || !eligible(seat, useGangStore.getState().members.find(m => m.id === id)) ||
        seats.some(s => s.memberId === id)) return;
    setSeats(prev => prev.map(s => s.position === position ? { ...s, memberId: id } : s));
    setFocusedId(id);
    setSelectedSeat(null);
  }
  function launch() {
    // Validate again against current store to avoid a stale, invalid seat at click time.
    if (!ready(seats, useGangStore.getState().members)) return;
    const typed = targetText.trim();
    const finalTarget: DriveByTarget | null = target ??
      (typed ? { address: normalizeAddressText(typed), seedMode: 'text-seed' } : null);
    onConfirm({ seats, targetBlock: finalTarget });
    useCombatIntentStore.getState().reset();
  }

  return <div className="car-crew-selector">
    <header className="ccs-header">
      <button type="button" className="ccs-back" onClick={onCancel}>← Back</button>
      <div className="ccs-heading"><span className="ccs-kicker">SLIDE / MISSION PREP</span><h1 className="ccs-title">LOAD UP THE CAR</h1></div>
      <span className="ccs-count" aria-label={`${count} of 4 seats assigned`}>{count}<span>/04</span></span>
    </header>
    <main className="ccs-grid">
      <div className="ccs-left">
        <section className="car-topdown" aria-label="Crew seating plan">
          <picture className="ccs-scene" aria-hidden="true">
            <source media="(max-width: 699px)" srcSet={getCarLoadoutBackdropUrl('mobile')} />
            <img src={getCarLoadoutBackdropUrl('desktop')} alt="" decoding="async" />
          </picture>
          <div className="ccs-scene-vignette" aria-hidden="true" />
          <span className="ccs-plate-label">VEHICLE / FOUR SEATS</span>
          <div className="car-body"><div className="car-cabin">
            {seats.map(seat => {
              const member = seat.memberId ? members.find(m => m.id === seat.memberId) : undefined;
              const invalid = Boolean(seat.memberId && !eligible(seat, member));
              return <motion.button type="button" key={seat.position}
                className={`car-seat seat-${seat.position} ${selectedSeat === seat.position ? 'selected' : ''} ${member ? 'occupied' : 'empty'} ${invalid ? 'unavailable' : ''}`}
                aria-label={member ? `Remove ${member.name} from ${seat.label}` : `Assign ${seat.label}`}
                aria-pressed={selectedSeat === seat.position}
                onClick={() => member ? (setSeats(prev => prev.map(s => s.position === seat.position ? { ...s, memberId: null } : s)), setFocusedId(null)) : setSelectedSeat(selectedSeat === seat.position ? null : seat.position)}
                whileTap={{ scale: 0.97 }}>
                {member ? <span className="seat-member">
                  <MemberPortrait key={portraitKey(member)} member={member} className="seat-avatar" onFallback={() => markPortraitFallback(member)} />
                  <span className="seat-name">{member.nickname || member.name}</span>
                  <span className="seat-role">{invalid ? 'UNAVAILABLE' : seat.position === 'driver' ? 'DRIVING' : 'SHOOTER'}</span>
                </span> : <span className="seat-empty"><span className="seat-plus" aria-hidden="true">+</span><span className="seat-label">{seat.label}</span></span>}
              </motion.button>;
            })}
          </div></div>
          <span className="ccs-plate-foot">DRIVER DOES NOT FIRE FROM THE CAR</span>
        </section>
        <div className="seat-legend" aria-label="Seat rules">
          <span className="legend-item"><strong>01 DRIVER</strong> Dealer / recruit / shooter / driver — drives only</span>
          <span className="legend-item"><strong>02–04 PASSENGERS</strong> Shooters only — fire from the car</span>
        </div>
        <AnimatePresence>{selected && <motion.section className="member-picker" aria-label={`Choose ${selected.label}`}
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
          <div className="picker-header"><span>ASSIGN / {selected.label.toUpperCase()}</span>
            <button type="button" aria-label="Close member picker" onClick={() => setSelectedSeat(null)}>×</button></div>
          <div className="picker-list">{choices.length === 0 ? <div className="picker-empty">No available {selected.position === 'driver' ? 'driver' : 'shooters'}. Recruit or free a member in CREW.</div> :
            choices.map(member => <motion.button type="button" key={member.id} className="picker-member"
              onClick={() => assignMember(selected.position, member.id)} whileTap={{ scale: 0.98 }}>
              <MemberPortrait key={portraitKey(member)} member={member} className="picker-avatar" onFallback={() => markPortraitFallback(member)} />
              <span className="picker-info"><span className="picker-name">{member.name}</span>
                <span className="picker-role">{(member.role ?? 'recruit').toUpperCase()} · LV {member.level}</span>
                {showsRoleArt(member) && <span className="picker-art-note">Role portrait — not member likeness</span>}
              </span><span className="picker-stats">HP {member.health ?? '—'}</span>
            </motion.button>)}</div>
        </motion.section>}</AnimatePresence>
      </div>
      <div className="ccs-right">
        <section className="ccs-manifest" aria-label="Member status and carried items">
          <div className="ccs-panel-heading"><span>CREW / LOADOUT</span><span>01–04</span></div>
          {focused ? <><div className="ccs-member-title"><strong>{focused.name}</strong><span>{focused.role ?? 'recruit'} · LV {focused.level}</span></div>
            <div className="ccs-stat-grid">
              <div><small>HEALTH</small><strong>{focused.health === undefined ? 'Not recorded' :
                focused.maxHealth === undefined ? `${focused.health} · max not recorded` : `${focused.health} / ${focused.maxHealth}`}</strong></div>
              <div><small>MORALE</small><strong>{focused.morale}/100</strong></div>
              <div><small>LOYALTY</small><strong>{focused.loyalty}/100</strong></div>
              <div><small>AGILITY</small><strong>{focused.stats.agility}/100</strong></div>
            </div>
            <div className="ccs-cargo"><small>CARRIED ITEMS</small>
              {focused.inventory === undefined ? <p>Carried items not recorded</p> :
                focused.inventory.some(item => item.quantity > 0) ?
                  <ul>{focused.inventory.filter(item => item.quantity > 0).map(item =>
                    <li key={item.itemId}><span>{item.name || item.itemId}</span><strong>×{item.quantity}</strong></li>)}</ul>
                  : <p>No items carried</p>}
            </div>
            {showsRoleArt(focused) && <p className="ccs-portrait-note">Role portrait — not member likeness</p>}
          </> : <p className="ccs-empty-note">Assign a member to inspect their condition and actual carried gear.</p>}
        </section>
        <section className="target-block-section">
          <label className="target-label">{pendingTarget ? 'Target locked from Maps' : 'Target block'}</label>
          <AddressSearchBar inline placeholder="Search a target address…" onResult={(r: AddressResult) => {
            setTarget({ address: r.address, lat: r.lat, lng: r.lng, placeId: r.placeId, seedMode: 'geocoded' });
            setTargetText('');
          }} />
          {target && <div className="target-chip"><span className="target-chip-label">{target.address}</span>
            <button type="button" className="target-chip-clear" onClick={() => setTarget(null)} aria-label="Clear target">×</button></div>}
          {!target && <div className="target-offline"><label htmlFor="car-offline-target" className="target-label target-label-sub">Offline fallback (no geocoder — scene seeded from text only):</label>
            <input id="car-offline-target" type="text" className="target-input" value={targetText}
              onChange={e => setTargetText(e.target.value)} placeholder="e.g. 63rd & King Drive" /></div>}
        </section>
        <div className="launch-section"><motion.button type="button" className={`launch-btn ${canLaunch ? 'ready' : 'disabled'}`}
          onClick={launch} disabled={!canLaunch} whileTap={canLaunch ? { scale: 0.98 } : {}}>
          {canLaunch ? 'SLIDE ON THEY BLOCK' : 'Need driver + at least 1 shooter'}
        </motion.button><p className="ccs-footnote">Driver controls the car. Only seated passenger shooters can fire during a drive-by.</p></div>
      </div>
    </main>
  </div>;
};
export default CarCrewSelector;
