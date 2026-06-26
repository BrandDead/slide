// ============================================================
// GangManagement — Gang HQ screen
// Shows all gang members in a grid with stats, morale, and
// quick actions. Redirects to Contacts for full member details.
// ============================================================
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigationStore, useGangStore, usePlayerStore } from '../../stores/gameStore';
import { MemberGrid } from './GangMemberCard';
import type { GangMember } from '../../types/game.types';

type TabType = 'active' | 'jailed' | 'dead';

const GangManagement: React.FC = () => {
  const { goBack, navigateTo } = useNavigationStore();
  const { members, addMember } = useGangStore();
  const { player } = usePlayerStore();
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [showRecruit, setShowRecruit] = useState(false);

  const activeMembers = members.filter(m => m.status === 'active');
  const jailedMembers = members.filter(m => m.status === 'jailed');
  const deadMembers   = members.filter(m => m.status === 'dead' || m.status === 'backdoored');

  const currentList: GangMember[] =
    activeTab === 'active' ? activeMembers :
    activeTab === 'jailed' ? jailedMembers :
    deadMembers;

  const handleSelectMember = useCallback(() => {
    navigateTo('contacts');
  }, [navigateTo]);

  const handleQuickRecruit = useCallback(() => {
    const cost = 500;
    if (player.money < cost) return;
    const roles = ['shooter', 'dealer', 'enforcer', 'lookout', 'runner'] as const;
    const role = roles[Math.floor(Math.random() * roles.length)];
    const names = ['Marcus', 'Dre', 'Lil T', 'Big K', 'Slim', 'Ghost', 'Ace', 'Reaper', 'Blaze', 'Ice'];
    const name = names[Math.floor(Math.random() * names.length)];
    addMember({
      id: `m-${Date.now()}`,
      name,
      nickname: '',
      role,
      status: 'active',
      level: 1,
      xp: 0,
      morale: 75,
      stats: { strength: 40, agility: 40, intelligence: 30, charisma: 30 },
      skills: [],
      equipment: [],
      salary: 100,
      loyalty: 60,
      backstory: { origin: 'Street recruit', reason: 'Needed work' },
      connections: [],
      heatResistance: 20,
      stealth: 20,
      health: 100,
      maxHealth: 100,
      armor: 0,
    } as any);
    setShowRecruit(false);
  }, [addMember, player.money]);

  return (
    <div className="gang-management">
      <div className="gm-header">
        <motion.button className="back-btn" onClick={goBack} whileTap={{ scale: 0.9 }}>← Back</motion.button>
        <h1>🔫 GANG HQ</h1>
        <motion.button className="contacts-btn" onClick={() => navigateTo('contacts')} whileTap={{ scale: 0.9 }}>Full Roster →</motion.button>
      </div>
      <div className="gm-stats">
        <div className="gm-stat"><span className="gm-stat-label">Active</span><span className="gm-stat-value green">{activeMembers.length}</span></div>
        <div className="gm-stat"><span className="gm-stat-label">Jailed</span><span className="gm-stat-value orange">{jailedMembers.length}</span></div>
        <div className="gm-stat"><span className="gm-stat-label">Fallen</span><span className="gm-stat-value red">{deadMembers.length}</span></div>
        <div className="gm-stat"><span className="gm-stat-label">Cash</span><span className="gm-stat-value gold">${player.money.toLocaleString()}</span></div>
      </div>
      <div className="gm-tabs">
        {(['active', 'jailed', 'dead'] as TabType[]).map(tab => (
          <motion.button key={tab} className={`gm-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)} whileTap={{ scale: 0.95 }}>
            {tab === 'active' ? `Active (${activeMembers.length})` : tab === 'jailed' ? `Jailed (${jailedMembers.length})` : `Fallen (${deadMembers.length})`}
          </motion.button>
        ))}
      </div>
      <div className="gm-grid-container">
        {currentList.length === 0 ? (
          <div className="gm-empty">
            <span className="gm-empty-icon">{activeTab === 'active' ? '👥' : activeTab === 'jailed' ? '🔒' : '🪦'}</span>
            <p>{activeTab === 'active' ? 'No active members. Recruit from CONTACTS.' : activeTab === 'jailed' ? 'No one locked up. Stay low.' : 'No fallen soldiers. Keep it that way.'}</p>
          </div>
        ) : (
          <MemberGrid members={currentList} onSelect={handleSelectMember} variant="compact" />
        )}
      </div>
      {activeTab === 'active' && (
        <div className="gm-actions">
          <motion.button className="gm-recruit-btn" onClick={() => setShowRecruit(true)} whileTap={{ scale: 0.95 }}>+ Quick Recruit ($500)</motion.button>
          <motion.button className="gm-contacts-btn" onClick={() => navigateTo('contacts')} whileTap={{ scale: 0.95 }}>👥 Full Contacts</motion.button>
        </div>
      )}
      <AnimatePresence>
        {showRecruit && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRecruit(false)}>
            <motion.div className="modal-content" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} style={{ padding: '24px', maxWidth: '320px', textAlign: 'center' }}>
              <h3 style={{ color: '#4ade80', marginBottom: '12px' }}>Quick Recruit</h3>
              <p style={{ color: '#ccc', marginBottom: '20px', fontSize: '14px' }}>Hire a random street soldier for <strong style={{ color: '#fbbf24' }}>$500</strong>. Use CONTACTS for full control.</p>
              {player.money < 500 ? (
                <p style={{ color: '#ef4444', fontSize: '13px' }}>Not enough cash.</p>
              ) : (
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <motion.button onClick={handleQuickRecruit} whileTap={{ scale: 0.95 }} style={{ background: '#4ade80', color: '#000', padding: '10px 20px', borderRadius: '8px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>Recruit</motion.button>
                  <motion.button onClick={() => setShowRecruit(false)} whileTap={{ scale: 0.95 }} style={{ background: '#333', color: '#fff', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Cancel</motion.button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`.gang-management{display:flex;flex-direction:column;height:100%;background:#0a0a0f;color:#fff;overflow:hidden}.gm-header{display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid rgba(255,255,255,0.08)}.gm-header h1{font-size:20px;font-weight:900;letter-spacing:2px;color:#4ade80}.back-btn,.contacts-btn{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:#fff;padding:8px 14px;border-radius:8px;font-size:13px;cursor:pointer}.gm-stats{display:flex;gap:8px;padding:12px 16px;background:rgba(255,255,255,0.03)}.gm-stat{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px}.gm-stat-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px}.gm-stat-value{font-size:18px;font-weight:900;font-family:monospace}.gm-stat-value.green{color:#4ade80}.gm-stat-value.orange{color:#f97316}.gm-stat-value.red{color:#ef4444}.gm-stat-value.gold{color:#fbbf24}.gm-tabs{display:flex;padding:8px 16px;gap:8px}.gm-tab{flex:1;padding:8px;border-radius:8px;font-size:12px;font-weight:700;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#888;cursor:pointer;text-transform:uppercase;letter-spacing:0.5px}.gm-tab.active{background:rgba(74,222,128,0.15);border-color:rgba(74,222,128,0.4);color:#4ade80}.gm-grid-container{flex:1;overflow-y:auto;padding:16px}.gm-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;gap:12px;color:#555}.gm-empty-icon{font-size:48px}.gm-empty p{font-size:14px;text-align:center}.gm-actions{display:flex;gap:8px;padding:12px 16px;border-top:1px solid rgba(255,255,255,0.08)}.gm-recruit-btn{flex:1;padding:12px;background:rgba(74,222,128,0.15);border:1px solid rgba(74,222,128,0.3);color:#4ade80;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer}.gm-contacts-btn{flex:1;padding:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#fff;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer}`}</style>
    </div>
  );
};

export { GangManagement };
export default GangManagement;
