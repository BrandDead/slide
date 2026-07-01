import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore, useGangStore } from '../../stores/gameStore';
import { useBlockStore } from '../../stores/blockStore';
import './AttackPlanner.css';

export const AttackPlanner: React.FC = () => {
  const { goBack, navigateTo } = useNavigationStore();
  const { members } = useGangStore();
  const { blocks: rawBlocks } = useBlockStore();
  const blocks = Object.values(rawBlocks ?? {}) as any[];
  
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [assignedRoles, setAssignedRoles] = useState<{ [role: string]: string }>({
    scout: '',
    enforcer: '',
    driver: ''
  });

  const availableMembers = members.filter(m => m.status === 'active');

  const handleLaunch = () => {
    if (!selectedTarget) return;
    // Launch into TopDownShooter with intel
    navigateTo('topdown');
  };

  return (
    <div className="attack-planner">
      <div className="ap-header">
        <motion.button className="back-btn" onClick={goBack} whileTap={{ scale: 0.9 }}>← Back</motion.button>
        <h1>⚔️ OPS PLANNER</h1>
      </div>
      
      <div className="ap-content">
        <div className="ap-section">
          <h3>1. Select Target Block</h3>
          <select value={selectedTarget} onChange={(e) => setSelectedTarget(e.target.value)} className="ap-select">
            <option value="">-- Select Enemy Block --</option>
            {blocks.filter((b: any) => b.owner !== 'player').map((b: any) => (
              <option key={b.id} value={b.id}>{b.address} (Heat: {b.heat})</option>
            ))}
            <option value="dummy-target">187th St & 5th Ave (Rival Territory)</option>
          </select>
        </div>

        <div className="ap-section">
          <h3>2. Assign Roles</h3>
          <div className="role-assignment">
            <div className="role-row">
              <label>Scout (Intel)</label>
              <select value={assignedRoles.scout} onChange={(e) => setAssignedRoles({...assignedRoles, scout: e.target.value})} className="ap-select">
                <option value="">-- Assign Member --</option>
                {availableMembers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
              </select>
            </div>
            <div className="role-row">
              <label>Enforcer (Heavy)</label>
              <select value={assignedRoles.enforcer} onChange={(e) => setAssignedRoles({...assignedRoles, enforcer: e.target.value})} className="ap-select">
                <option value="">-- Assign Member --</option>
                {availableMembers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
              </select>
            </div>
            <div className="role-row">
              <label>Driver (Getaway)</label>
              <select value={assignedRoles.driver} onChange={(e) => setAssignedRoles({...assignedRoles, driver: e.target.value})} className="ap-select">
                <option value="">-- Assign Member --</option>
                {availableMembers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="ap-section ap-intel">
          <h3>3. Intel Briefing</h3>
          {selectedTarget && assignedRoles.scout ? (
            <p className="intel-text text-green">Scout reports 3 hostiles. Moderate police presence.</p>
          ) : (
            <p className="intel-text text-red">Assign a scout to gather intel.</p>
          )}
        </div>

        <button 
          className={`launch-btn ${!selectedTarget ? 'disabled' : ''}`}
          onClick={handleLaunch}
          disabled={!selectedTarget}
        >
          LAUNCH ATTACK
        </button>
      </div>
    </div>
  );
};

export default AttackPlanner;
