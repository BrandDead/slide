/**
 * DEALT/SLIDE - NPC Gang Panel
 * Shows nearby NPC gangs, their threat level, and recent actions.
 * Displayed as a sidebar on the Territory Map.
 */

import React, { useState, useEffect } from 'react';
import './NPCPanel.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface NPCMember {
  id: string;
  name: string;
  role: 'shooter' | 'dealer' | 'enforcer';
  level: number;
  alive: boolean;
}

interface NPCGang {
  id: string;
  name: string;
  faction: string;
  difficulty: number;
  aggression: number;
  wealth: number;
  territory_count: number;
  members: NPCMember[];
  active: boolean;
  lastAction?: string;
  lastActionTime?: string;
}

interface NPCPanelProps {
  visible: boolean;
  onClose: () => void;
}

// ─── Mock NPC Data (until backend is connected) ──────────────────────────────

const MOCK_NPC_GANGS: NPCGang[] = [
  {
    id: 'npc-1',
    name: 'The Scorpions',
    faction: 'eastside',
    difficulty: 2,
    aggression: 65,
    wealth: 40,
    territory_count: 3,
    active: true,
    lastAction: 'Patrolling their blocks',
    lastActionTime: new Date(Date.now() - 600000).toISOString(),
    members: [
      { id: 'nm-1', name: 'Big Mike', role: 'shooter', level: 3, alive: true },
      { id: 'nm-2', name: 'Lil D', role: 'dealer', level: 2, alive: true },
      { id: 'nm-3', name: 'Crazy Jay', role: 'enforcer', level: 4, alive: true },
      { id: 'nm-4', name: 'Young Ace', role: 'shooter', level: 1, alive: true },
      { id: 'nm-5', name: 'Slim Ghost', role: 'dealer', level: 2, alive: false },
    ],
  },
  {
    id: 'npc-2',
    name: 'Dead End Boys',
    faction: 'westside',
    difficulty: 3,
    aggression: 80,
    wealth: 55,
    territory_count: 5,
    active: true,
    lastAction: 'Expanding territory',
    lastActionTime: new Date(Date.now() - 1800000).toISOString(),
    members: [
      { id: 'nm-6', name: 'OG Reaper', role: 'enforcer', level: 5, alive: true },
      { id: 'nm-7', name: 'Mad Tee', role: 'shooter', level: 4, alive: true },
      { id: 'nm-8', name: 'Quick Shadow', role: 'shooter', level: 3, alive: true },
      { id: 'nm-9', name: 'Fat King', role: 'dealer', level: 3, alive: true },
      { id: 'nm-10', name: 'Baby Blade', role: 'dealer', level: 2, alive: true },
      { id: 'nm-11', name: 'Dirty Smoke', role: 'shooter', level: 4, alive: true },
      { id: 'nm-12', name: 'Wild Ice', role: 'enforcer', level: 3, alive: true },
    ],
  },
  {
    id: 'npc-3',
    name: 'Block Burners',
    faction: 'southside',
    difficulty: 1,
    aggression: 35,
    wealth: 25,
    territory_count: 1,
    active: true,
    lastAction: 'Defending their block',
    lastActionTime: new Date(Date.now() - 3600000).toISOString(),
    members: [
      { id: 'nm-13', name: 'Tiny Rock', role: 'shooter', level: 1, alive: true },
      { id: 'nm-14', name: 'Slick Stone', role: 'dealer', level: 1, alive: true },
      { id: 'nm-15', name: 'Smooth Duke', role: 'shooter', level: 2, alive: true },
    ],
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

const NPCPanel: React.FC<NPCPanelProps> = ({ visible, onClose }) => {
  const [gangs, setGangs] = useState<NPCGang[]>(MOCK_NPC_GANGS);
  const [expandedGang, setExpandedGang] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'hostile' | 'neutral'>('all');

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
      case 'shooter': return '🔫';
      case 'dealer': return '💊';
      case 'enforcer': return '🛡️';
      default: return '👤';
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
        <button className="npc-close-btn" onClick={onClose}>✕</button>
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

          return (
            <div
              key={gang.id}
              className={`npc-gang-card ${isExpanded ? 'expanded' : ''}`}
              onClick={() => setExpandedGang(isExpanded ? null : gang.id)}
            >
              <div className="npc-gang-header">
                <div className="npc-gang-name-row">
                  <span className="npc-gang-name">{gang.name}</span>
                  <span
                    className="npc-threat-badge"
                    style={{ backgroundColor: getThreatColor(gang.aggression) }}
                  >
                    {getThreatLabel(gang.aggression)}
                  </span>
                </div>
                <div className="npc-gang-meta">
                  <span className="npc-difficulty">{getDifficultyStars(gang.difficulty)}</span>
                  <span className="npc-faction">{gang.faction}</span>
                </div>
              </div>

              <div className="npc-gang-stats">
                <div className="npc-stat">
                  <span className="npc-stat-label">Members</span>
                  <span className="npc-stat-value">{aliveCount}/{gang.members.length}</span>
                </div>
                <div className="npc-stat">
                  <span className="npc-stat-label">Blocks</span>
                  <span className="npc-stat-value">{gang.territory_count}</span>
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
              </div>

              {gang.lastAction && (
                <div className="npc-last-action">
                  <span className="npc-action-text">{gang.lastAction}</span>
                  <span className="npc-action-time">{getTimeAgo(gang.lastActionTime)}</span>
                </div>
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
                        <span className="npc-member-icon">{getRoleIcon(member.role)}</span>
                        <span className="npc-member-name">{member.name}</span>
                        <span className="npc-member-level">Lv.{member.level}</span>
                        <span className="npc-member-status">
                          {member.alive ? '✅' : '💀'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="npc-gang-actions">
                    <button className="npc-action-btn attack">
                      🎯 Attack
                    </button>
                    <button className="npc-action-btn scout">
                      🔍 Scout
                    </button>
                    <button className="npc-action-btn negotiate">
                      🤝 Negotiate
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredGangs.length === 0 && (
        <div className="npc-empty">
          No gangs match this filter.
        </div>
      )}
    </div>
  );
};

export default NPCPanel;
