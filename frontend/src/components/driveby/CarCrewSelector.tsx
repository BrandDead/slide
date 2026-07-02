// ============================================================
// CarCrewSelector - Pick gang members for each car seat
// Driver: dealer/enforcer/lookout (drives only, no shooting)
// Passengers: shooters (can fire weapons)
// Shows top-down car view with clickable seats
// ============================================================

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGangStore } from '../../stores/gameStore';
import { generatePlaceholderAvatar } from '../../services/ai/artPipeline';
import './CarCrewSelector.css';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface CarSeat {
  position: 'driver' | 'passenger' | 'back_left' | 'back_right';
  label: string;
  allowedRoles: string[];
  memberId: string | null;
}

export interface CarCrew {
  seats: CarSeat[];
  targetBlock: string | null;
}

interface CarCrewSelectorProps {
  onConfirm: (crew: CarCrew) => void;
  onCancel: () => void;
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

const CarCrewSelector: React.FC<CarCrewSelectorProps> = ({ onConfirm, onCancel }) => {
  const { members } = useGangStore();
  
  const [seats, setSeats] = useState<CarSeat[]>([
    { position: 'driver', label: 'Driver', allowedRoles: ['dealer', 'enforcer', 'lookout'], memberId: null },
    { position: 'passenger', label: 'Passenger (Shooter)', allowedRoles: ['shooter'], memberId: null },
    { position: 'back_left', label: 'Back Left (Shooter)', allowedRoles: ['shooter'], memberId: null },
    { position: 'back_right', label: 'Back Right (Shooter)', allowedRoles: ['shooter'], memberId: null },
  ]);
  
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [targetBlock, setTargetBlock] = useState('');
  
  // Available members (not already assigned to a seat, not jailed/dead/hospital)
  const assignedIds = useMemo(() => new Set(seats.map(s => s.memberId).filter(Boolean)), [seats]);
  
  const availableMembers = useMemo(() => {
    return members.filter(m => 
      m.status === 'active' && 
      !assignedIds.has(m.id)
    );
  }, [members, assignedIds]);
  
  const getEligibleMembers = (seat: CarSeat) => {
    return availableMembers.filter(m => seat.allowedRoles.includes(m.role ?? 'soldier'));
  };
  
  const assignMember = (seatPosition: string, memberId: string) => {
    setSeats(prev => prev.map(s => 
      s.position === seatPosition ? { ...s, memberId } : s
    ));
    setSelectedSeat(null);
  };
  
  const removeMember = (seatPosition: string) => {
    setSeats(prev => prev.map(s => 
      s.position === seatPosition ? { ...s, memberId: null } : s
    ));
  };
  
  const getMemberById = (id: string) => members.find(m => m.id === id);
  
  const canLaunch = seats[0].memberId !== null && seats.some(s => s.position !== 'driver' && s.memberId !== null);
  
  return (
    <div className="car-crew-selector">
      <div className="ccs-header">
        <button className="ccs-back" onClick={onCancel}>← Back</button>
        <span className="ccs-title">🚗 LOAD UP THE CAR</span>
      </div>
      
      {/* Top-Down Car View */}
      <div className="car-topdown">
        <div className="car-body">
          <div className="car-hood" />
          <div className="car-cabin">
            {seats.map(seat => {
              const member = seat.memberId ? getMemberById(seat.memberId) : null;
              return (
                <motion.div
                  key={seat.position}
                  className={`car-seat seat-${seat.position} ${selectedSeat === seat.position ? 'selected' : ''} ${member ? 'occupied' : 'empty'}`}
                  onClick={() => {
                    if (member) {
                      removeMember(seat.position);
                    } else {
                      setSelectedSeat(seat.position === selectedSeat ? null : seat.position);
                    }
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  {member ? (
                    <div className="seat-member">
                      <img 
                        src={member.avatarUrl || generatePlaceholderAvatar(member.name)} 
                        alt={member.name}
                        className="seat-avatar"
                      />
                      <span className="seat-name">{member.name.split(' ')[0]}</span>
                      <span className="seat-role">{member.role}</span>
                    </div>
                  ) : (
                    <div className="seat-empty">
                      <span className="seat-plus">+</span>
                      <span className="seat-label">{seat.label}</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
          <div className="car-trunk" />
        </div>
        
        {/* Seat role legend */}
        <div className="seat-legend">
          <span className="legend-item">🚗 Driver: Dealer/Enforcer/Lookout (drives only)</span>
          <span className="legend-item">🔫 Passengers: Shooters only</span>
        </div>
      </div>
      
      {/* Member Picker (when a seat is selected) */}
      <AnimatePresence>
        {selectedSeat && (
          <motion.div
            className="member-picker"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div className="picker-header">
              <span>Pick member for: {seats.find(s => s.position === selectedSeat)?.label}</span>
              <button onClick={() => setSelectedSeat(null)}>✕</button>
            </div>
            <div className="picker-list">
              {getEligibleMembers(seats.find(s => s.position === selectedSeat)!).length === 0 ? (
                <div className="picker-empty">
                  No eligible members available. Need: {seats.find(s => s.position === selectedSeat)?.allowedRoles.join(', ')}
                </div>
              ) : (
                getEligibleMembers(seats.find(s => s.position === selectedSeat)!).map(member => (
                  <motion.div
                    key={member.id}
                    className="picker-member"
                    onClick={() => assignMember(selectedSeat, member.id)}
                    whileTap={{ scale: 0.98 }}
                  >
                    <img 
                      src={member.avatarUrl || generatePlaceholderAvatar(member.name)} 
                      alt={member.name}
                      className="picker-avatar"
                    />
                    <div className="picker-info">
                      <span className="picker-name">{member.name}</span>
                      <span className="picker-role">{member.role} • LV{member.level}</span>
                    </div>
                    <div className="picker-stats">
                      <span>🎯 {(member.stats as any)?.shooting ?? member.stats?.strength ?? 50}</span>
                      <span>❤️ {member.health || 100}</span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Target Block Selection */}
      <div className="target-block-section">
        <label className="target-label">Target Block Address:</label>
        <input
          type="text"
          className="target-input"
          value={targetBlock}
          onChange={e => setTargetBlock(e.target.value)}
          placeholder="e.g. 63rd & King Drive"
        />
      </div>
      
      {/* Launch Button */}
      <div className="launch-section">
        <motion.button
          className={`launch-btn ${canLaunch ? 'ready' : 'disabled'}`}
          onClick={() => canLaunch && onConfirm({ seats, targetBlock: targetBlock || null })}
          disabled={!canLaunch}
          whileTap={canLaunch ? { scale: 0.95 } : {}}
        >
          {canLaunch ? '🚗💨 SLIDE ON THEY BLOCK' : 'Need driver + at least 1 shooter'}
        </motion.button>
      </div>
    </div>
  );
};

export default CarCrewSelector;
