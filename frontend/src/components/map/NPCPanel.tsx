/**
 * DEALT/SLIDE - NPC Gang Panel
 * Shows nearby NPC gangs, their threat level, and recent actions.
 * Displayed as a sidebar on the Territory Map.
 * Now connected to live Zustand npcStore.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  useNPCStore,
  selectNPCGangList,
  selectThreateningGangs,
  type NPCGang,
  type NPCMember,
} from '../../stores/npcStore';
import { useNotificationStore } from '../../stores/gameStore';
import './NPCPanel.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface NPCPanelProps {
  visible: boolean;
  onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

const NPCPanel: React.FC<NPCPanelProps> = ({ visible, onClose }) => {
  const gangs = useNPCStore(selectNPCGangList);
  const threateningGangs = useNPCStore(selectThreateningGangs);
  const setThreatening = useNPCStore((state) => state.setThreatening);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const [expandedGang, setExpandedGang] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'hostile' | 'neutral'>('all');

  const threateningIds = new Set(threateningGangs.map((g) => g.id));

  const getThreatColor = (aggression: number): string => {
    if (aggression >= 70) return '#ef4444';
    if (aggression >= 40) return '#f59e0b';
    return '#22c55e';
  };

  const getThreatLabel = (aggression: number): string => {
    if (aggression >= 70) return 'HOSTILE';
    if (aggression >= 40) return 'CAUTIOUS';
    return 'NEUTRAL';
  };

  const getDifficultyStars = (difficulty: number): string => {
    return '★'.repeat(difficulty) + '☆'.repeat(5 - difficulty);
  };

  const getRoleIcon = (role: string): string => {
    switch (role) {
      case 'shooter':
        return '🔫';
      case 'dealer':
        return '💊';
      case 'enforcer':
        return '🛡️';
      default:
        return '👤';
    }
  };

  const getTimeAgo = (isoString?: string): string => {
    if (!isoString) return 'Unknown';
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const handleRetaliate = (gang: NPCGang, e: React.MouseEvent) => {
    e.stopPropagation();
    setThreatening(gang.id, false);
    addNotification({
      type: 'info',
      title: '✊ Threat Neutralized',
      message: `You stood up to ${gang.name}. Threat neutralized.`,
      priority: 'normal',
      timestamp: Date.now(),
    });
  };

  const filteredGangs = gangs.filter((g) => {
    if (filter === 'hostile') return g.aggression >= 70;
    if (filter === 'neutral') return g.aggression < 40;
    return true;
  });

  if (!visible) return null;

  return (
    <div className="npc-panel">
      <div className="npc-panel-header">
        <h3>RIVAL GANGS</h3>
        <button className="npc-close-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="npc-filter-bar">
        {(['all', 'hostile', 'neutral'] as const).map((f) => (
          <button
            key={f}
            className={`npc-filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? '🏴 All' : f === 'hostile' ? '🔴 Hostile' : '🟢 Neutral'}
          </button>
        ))}
      </div>

      <div className="npc-gang-list">
        {filteredGangs.map((gang) => {
          const aliveCount = gang.members.filter((m) => m.alive).length;
          const isExpanded = expandedGang === gang.id;
          const isThreatening = threateningIds.has(gang.id);

          return (
            <motion.div
              key={gang.id}
              className={`npc-gang-card ${isExpanded ? 'expanded' : ''}`}
              onClick={() => setExpandedGang(isExpanded ? null : gang.id)}
              style={
                isThreatening
                  ? { border: '2px solid #ef4444', boxShadow: '0 0 12px #ef4444' }
                  : undefined
              }
              animate={
                isThreatening
                  ? {
                      boxShadow: [
                        '0 0 8px #ef4444',
                        '0 0 18px #ef4444',
                        '0 0 8px #ef4444',
                      ],
                    }
                  : {}
              }
              transition={
                isThreatening
                  ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
                  : undefined
              }
            >
              <div className="npc-gang-header">
                <div className="npc-gang-name-row">
                  <span className="npc-gang-name">{gang.name}</span>
                  {isThreatening && (
                    <span
                      className="npc-threat-badge"
                      style={{
                        backgroundColor: '#dc2626',
                        marginRight: 6,
                        fontWeight: 'bold',
                      }}
                    >
                      THREAT
                    </span>
                  )}
                  <span
                    className="npc-threat-badge"
                    style={{ backgroundColor: getThreatColor(gang.aggression) }}
                  >
                    {getThreatLabel(gang.aggression)}
                  </span>
                </div>
                <div className="npc-gang-meta">
                  <span className="npc-difficulty">
                    {getDifficultyStars(gang.difficulty)}
                  </span>
                  <span className="npc-faction">{gang.faction}</span>
                </div>
              </div>

              <div className="npc-gang-stats">
                <div className="npc-stat">
                  <span className="npc-stat-label">Members</span>
                  <span className="npc-stat-value">
                    {aliveCount}/{gang.members.length}
                  </span>
                </div>
                <div className="npc-stat">
                  <span className="npc-stat-label">Blocks</span>
                  <span className="npc-stat-value">{gang.territoryCount}</span>
                </div>
                <div className="npc-stat">
                  <span className="npc-stat-label">Aggression</span>
                  <div className="npc-stat-bar">
                    <div
                      className="npc-stat-fill"
                      style={{
                        width: `${gang.aggression}%`,
                        backgroundColor: getThreatColor(gang.aggression),
                      }}
                    />
                  </div>
                </div>
                <div className="npc-stat">
                  <span className="npc-stat-label">Wealth</span>
                  <div className="npc-stat-bar">
                    <div
                      className="npc-stat-fill"
                      style={{
                        width: `${gang.wealth}%`,
                        backgroundColor: '#fbbf24',
                      }}
                    />
                  </div>
                </div>
              </div>

              {gang.lastAction && (
                <div className="npc-last-action">
                  <span className="npc-action-text">{gang.lastAction}</span>
                  <span className="npc-action-time">
                    {getTimeAgo(gang.lastTickAt)}
                  </span>
                </div>
              )}

              {isThreatening && (
                <button
                  className="npc-action-btn attack"
                  style={{ marginTop: 8, width: '100%' }}
                  onClick={(e) => handleRetaliate(gang, e)}
                >
                  ⚔️ Retaliate
                </button>
              )}

              {isExpanded && (
                <div className="npc-gang-details">
                  <div className="npc-members-header">KNOWN MEMBERS</div>
                  <div className="npc-members-list">
                    {gang.members.map((member) => (
                      <div
                        key={member.id}
                        className={`npc-member-row ${!member.alive ? 'dead' : ''}`}
                      >
                        <span className="npc-member-icon">
                          {getRoleIcon(member.role)}
                        </span>
                        <span className="npc-member-name">{member.name}</span>
                        <span className="npc-member-level">Lv.{member.level}</span>
                        <span className="npc-member-status">
                          {member.alive ? '✅' : '💀'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="npc-gang-actions">
                    <button className="npc-action-btn attack">🎯 Attack</button>
                    <button className="npc-action-btn scout">🔍 Scout</button>
                    <button className="npc-action-btn negotiate">
                      🤝 Negotiate
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {filteredGangs.length === 0 && (
        <div className="npc-empty">No gangs match this filter.</div>
      )}
    </div>
  );
};

export default NPCPanel;
