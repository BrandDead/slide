// ============================================================
// Territory Map - Block Management & Member Positioning
// Players position gang members on their block grid
// Position affects income, risk, and drive-by vulnerability
// Hood view uses Mapbox for real-world map integration
// ============================================================

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigationStore, usePlayerStore, useGangStore } from '../../stores/gameStore';
import { STREET_PROXIMITY_TABLE } from '../../types/slide.types';
import MapboxMap from './MapboxMap';
import BlockSearch from './BlockSearch';
import BlockOverlay, { type BlockData } from './BlockOverlay';
import BlockDetailPanel from './BlockDetailPanel';
import './TerritoryMap.css';

// ============ TYPES ============

interface BlockTile {
  x: number;
  y: number;
  type: 'street' | 'sidewalk' | 'alley' | 'building' | 'trap_house';
  occupant: PlacedMember | null;
  income: number;
  danger: number;
}

interface PlacedMember {
  id: string;
  name: string;
  role: 'dealer' | 'shooter' | 'enforcer' | 'lookout';
  level: number;
  loyalty: number;
  status: 'active' | 'injured' | 'jailed' | 'dead';
}

interface BlockStats {
  totalIncome: number;
  totalDanger: number;
  activeMembers: number;
  coverage: number;
}

type MapView = 'block' | 'hood' | 'roster';

// ============ CONSTANTS ============

const GRID_SIZE = 8;

const TILE_TYPES: Record<string, { emoji: string; color: string; label: string }> = {
  street: { emoji: '🛣️', color: 'rgba(80, 80, 80, 0.5)', label: 'Street' },
  sidewalk: { emoji: '🚶', color: 'rgba(100, 90, 60, 0.4)', label: 'Sidewalk' },
  alley: { emoji: '🌑', color: 'rgba(40, 40, 60, 0.4)', label: 'Alley' },
  building: { emoji: '🏢', color: 'rgba(30, 50, 80, 0.4)', label: 'Building' },
  trap_house: { emoji: '🏚️', color: 'rgba(80, 30, 30, 0.4)', label: 'Trap House' },
};

const ROLE_EMOJIS: Record<string, string> = {
  dealer: '💊',
  shooter: '🔫',
  enforcer: '💪',
  lookout: '👁️',
};

const ROLE_COLORS: Record<string, string> = {
  dealer: '#4ade80',
  shooter: '#ef4444',
  enforcer: '#f97316',
  lookout: '#60a5fa',
};

// ============ HELPERS ============

function createBlock(): BlockTile[][] {
  return Array.from({ length: GRID_SIZE }, (_, y) =>
    Array.from({ length: GRID_SIZE }, (_, x) => {
      let type: BlockTile['type'];
      if (y === 0 || y === 7) type = 'street';
      else if (y === 1 || y === 6) type = 'sidewalk';
      else if (y === 2 || y === 5) type = 'alley';
      else if (x === 3 && y === 3) type = 'trap_house';
      else type = 'building';

      const proximity = STREET_PROXIMITY_TABLE[Math.min(y, GRID_SIZE - 1 - y)] || STREET_PROXIMITY_TABLE[4];

      return {
        x,
        y,
        type,
        occupant: null,
        income: Math.round(proximity.incomeMultiplier * 100),
        danger: Math.round(proximity.hitChance * 100),
      };
    })
  );
}

function generateRoster(): PlacedMember[] {
  const names = ['Lil Mike', 'Big T', 'Slim', 'OG Kush', 'Baby D', 'Quick', 'Shadow', 'Blaze', 'Ice', 'Ghost', 'Reaper', 'Smoke'];
  const roles: PlacedMember['role'][] = ['dealer', 'dealer', 'dealer', 'shooter', 'shooter', 'enforcer', 'enforcer', 'lookout', 'lookout', 'dealer', 'shooter', 'lookout'];

  return names.map((name, i) => ({
    id: `member-${i}`,
    name,
    role: roles[i],
    level: Math.floor(Math.random() * 5) + 1,
    loyalty: 50 + Math.floor(Math.random() * 50),
    status: Math.random() > 0.15 ? 'active' : (Math.random() > 0.5 ? 'injured' : 'jailed'),
  }));
}

// ============ COMPONENT ============

const TerritoryMap: React.FC = () => {
  const { goBack } = useNavigationStore();
  const { player, updateMoney, updateHeat } = usePlayerStore();

  const [view, setView] = useState<MapView>('block');
  const [block, setBlock] = useState<BlockTile[][]>(createBlock);
  const [roster, setRoster] = useState<PlacedMember[]>(generateRoster);
  const [selectedMember, setSelectedMember] = useState<PlacedMember | null>(null);
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Mapbox state
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [selectedBlock, setSelectedBlock] = useState<BlockData | null>(null);
  const [claimedBlocks, setClaimedBlocks] = useState<BlockData[]>([
    // Demo blocks
    { id: 'home', address: 'Your Home Block', lat: 34.0522, lng: -118.2437, owner: 'player', income: 450, heat: 15, members: 4 },
    { id: 'opp1', address: 'Rival Block #1', lat: 34.0545, lng: -118.2410, owner: 'npc', income: 300, heat: 45, members: 6 },
    { id: 'opp2', address: 'Rival Block #2', lat: 34.0500, lng: -118.2460, owner: 'npc', income: 200, heat: 30, members: 3 },
    { id: 'neutral1', address: 'Unclaimed Lot', lat: 34.0530, lng: -118.2480, owner: 'unclaimed', income: 0, heat: 0, members: 0 },
  ]);

  // Calculate block stats
  const blockStats = useMemo<BlockStats>(() => {
    let totalIncome = 0;
    let totalDanger = 0;
    let activeMembers = 0;

    block.forEach(row => row.forEach(tile => {
      if (tile.occupant) {
        activeMembers++;
        if (tile.occupant.role === 'dealer') {
          totalIncome += tile.income * (1 + tile.occupant.level * 0.2);
        }
        totalDanger += tile.danger;
      }
    }));

    const coverage = Math.round((activeMembers / 12) * 100);
    return { totalIncome: Math.round(totalIncome), totalDanger: Math.round(totalDanger / Math.max(activeMembers, 1)), activeMembers, coverage };
  }, [block]);

  // Place member on tile
  const placeMember = useCallback((member: PlacedMember, x: number, y: number) => {
    if (member.status !== 'active') {
      setNotification(`${member.name} is ${member.status}!`);
      setTimeout(() => setNotification(null), 2000);
      return;
    }

    const tile = block[y][x];
    if (tile.type === 'street') {
      setNotification("Can't place directly on the street!");
      setTimeout(() => setNotification(null), 2000);
      return;
    }

    const newBlock = block.map(row => row.map(t => {
      if (t.occupant?.id === member.id) return { ...t, occupant: null };
      return { ...t };
    }));

    if (newBlock[y][x].occupant) {
      setNotification('Tile already occupied!');
      setTimeout(() => setNotification(null), 2000);
      return;
    }

    newBlock[y][x].occupant = member;
    setBlock(newBlock);
    setSelectedMember(null);
    setSelectedTile(null);

    const proximity = STREET_PROXIMITY_TABLE[Math.min(y, GRID_SIZE - 1 - y)] || STREET_PROXIMITY_TABLE[4];
    setNotification(`${ROLE_EMOJIS[member.role]} ${member.name} placed! Income: ${proximity.incomeMultiplier}x | Risk: ${Math.round(proximity.hitChance * 100)}%`);
    setTimeout(() => setNotification(null), 3000);
  }, [block]);

  // Remove member from tile
  const removeMember = useCallback((x: number, y: number) => {
    const newBlock = block.map(row => row.map(t => ({ ...t })));
    const removed = newBlock[y][x].occupant;
    if (removed) {
      newBlock[y][x].occupant = null;
      setBlock(newBlock);
      setNotification(`${removed.name} called back from the block`);
      setTimeout(() => setNotification(null), 2000);
    }
  }, [block]);

  // Collect income
  const collectIncome = useCallback(() => {
    if (blockStats.totalIncome > 0) {
      updateMoney(blockStats.totalIncome);
      updateHeat(Math.ceil(blockStats.totalDanger / 10));
      setNotification(`💰 Collected $${blockStats.totalIncome}! (+${Math.ceil(blockStats.totalDanger / 10)} heat)`);
      setTimeout(() => setNotification(null), 3000);
    }
  }, [blockStats, updateMoney, updateHeat]);

  // Handle tile click
  const handleTileClick = useCallback((x: number, y: number) => {
    const tile = block[y][x];

    if (selectedMember) {
      placeMember(selectedMember, x, y);
    } else if (tile.occupant) {
      setSelectedTile({ x, y });
    } else {
      setSelectedTile(selectedTile?.x === x && selectedTile?.y === y ? null : { x, y });
    }
  }, [block, selectedMember, selectedTile, placeMember]);

  // Mapbox handlers
  const handleMapLoad = useCallback((map: any) => {
    setMapInstance(map);
  }, []);

  const handleSearchResult = useCallback((result: any) => {
    if (mapInstance) {
      mapInstance.flyTo({ center: [result.lng, result.lat], zoom: 16, duration: 2000 });
    }
    // Add as unclaimed block
    const newBlock: BlockData = {
      id: `search-${Date.now()}`,
      address: result.address,
      lat: result.lat,
      lng: result.lng,
      owner: 'unclaimed',
      income: 0,
      heat: 0,
      members: 0,
    };
    setClaimedBlocks(prev => {
      if (prev.some(b => Math.abs(b.lat - result.lat) < 0.0001 && Math.abs(b.lng - result.lng) < 0.0001)) {
        return prev;
      }
      return [...prev, newBlock];
    });
    setSelectedBlock(newBlock);
  }, [mapInstance]);

  const handleBlockClick = useCallback((blockData: BlockData) => {
    setSelectedBlock(blockData);
  }, []);

  const handleClaimBlock = useCallback((blockData: BlockData) => {
    if ((player?.money || 0) < 2000) {
      setNotification('Not enough cash! Need $2,000 to claim.');
      setTimeout(() => setNotification(null), 2000);
      return;
    }
    updateMoney(-2000);
    updateHeat(5);
    setClaimedBlocks(prev =>
      prev.map(b => b.id === blockData.id ? { ...b, owner: 'player' as const, income: 100 + Math.floor(Math.random() * 200) } : b)
    );
    setSelectedBlock(null);
    setNotification(`🏴 Claimed ${blockData.address}! (-$2,000, +5 heat)`);
    setTimeout(() => setNotification(null), 3000);
  }, [player, updateMoney, updateHeat]);

  // ============ RENDER ============

  return (
    <div className="territory-map">
      {/* Header */}
      <div className="map-header">
        <motion.button className="back-button" onClick={goBack} whileTap={{ scale: 0.9 }}>← Back</motion.button>
        <div className="map-title">
          <span className="title-icon">🗺️</span>
          <span className="title-text">THE BLOCK</span>
        </div>
        <div className="map-money">💰 ${player?.money?.toLocaleString() || '0'}</div>
      </div>

      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            className="map-notification"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Tabs */}
      <div className="view-tabs">
        {[
          { id: 'block' as MapView, label: '🏘️ Block', desc: 'Position crew' },
          { id: 'hood' as MapView, label: '🗺️ Hood', desc: 'Territory' },
          { id: 'roster' as MapView, label: '👥 Roster', desc: 'Manage crew' },
        ].map(tab => (
          <motion.button
            key={tab.id}
            className={`view-tab ${view === tab.id ? 'active' : ''}`}
            onClick={() => setView(tab.id)}
            whileTap={{ scale: 0.95 }}
          >
            <span className="tab-label">{tab.label}</span>
            <span className="tab-desc">{tab.desc}</span>
          </motion.button>
        ))}
      </div>

      {/* Block Stats */}
      <div className="block-stats">
        <div className="stat-item">
          <span className="stat-value income">💰 ${blockStats.totalIncome}</span>
          <span className="stat-label">Income/hr</span>
        </div>
        <div className="stat-item">
          <span className="stat-value danger">⚠️ {blockStats.totalDanger}%</span>
          <span className="stat-label">Avg Risk</span>
        </div>
        <div className="stat-item">
          <span className="stat-value members">👥 {blockStats.activeMembers}</span>
          <span className="stat-label">On Block</span>
        </div>
        <div className="stat-item">
          <span className="stat-value coverage">📊 {blockStats.coverage}%</span>
          <span className="stat-label">Coverage</span>
        </div>
      </div>

      {/* Block View */}
      {view === 'block' && (
        <>
          {selectedMember && (
            <div className="placement-hint">
              Placing: {ROLE_EMOJIS[selectedMember.role]} {selectedMember.name} — Tap a tile
              <motion.button className="cancel-place" onClick={() => setSelectedMember(null)} whileTap={{ scale: 0.9 }}>✕</motion.button>
            </div>
          )}

          <div className="block-grid-container">
            <div className="block-grid">
              {block.map((row, y) =>
                row.map((tile, x) => {
                  const isSelected = selectedTile?.x === x && selectedTile?.y === y;
                  const tileInfo = TILE_TYPES[tile.type];

                  return (
                    <motion.div
                      key={`${x}-${y}`}
                      className={`block-tile ${tile.type} ${tile.occupant ? 'occupied' : ''} ${isSelected ? 'selected' : ''} ${selectedMember && tile.type !== 'street' && !tile.occupant ? 'placeable' : ''}`}
                      onClick={() => handleTileClick(x, y)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      style={{ background: tileInfo.color }}
                    >
                      {tile.occupant ? (
                        <div className="tile-occupant">
                          <span className="occupant-emoji">{ROLE_EMOJIS[tile.occupant.role]}</span>
                          <span className="occupant-level">Lv{tile.occupant.level}</span>
                        </div>
                      ) : (
                        <div className="tile-info">
                          <span className="tile-emoji">{tileInfo.emoji}</span>
                          <span className="tile-income">${tile.income}</span>
                        </div>
                      )}
                      {tile.danger >= 70 && <div className="danger-indicator" />}
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Legend */}
            <div className="grid-legend">
              <div className="legend-row">
                <span className="legend-label">← Safe (low $)</span>
                <div className="legend-gradient" />
                <span className="legend-label">Risky (high $) →</span>
              </div>
            </div>
          </div>

          {/* Tile detail */}
          {selectedTile && block[selectedTile.y][selectedTile.x].occupant && (
            <motion.div
              className="tile-detail"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {(() => {
                const tile = block[selectedTile.y][selectedTile.x];
                const member = tile.occupant!;
                return (
                  <>
                    <div className="detail-header">
                      <span className="detail-emoji">{ROLE_EMOJIS[member.role]}</span>
                      <div>
                        <h4>{member.name}</h4>
                        <span className="detail-role" style={{ color: ROLE_COLORS[member.role] }}>
                          {member.role.toUpperCase()} Lv.{member.level}
                        </span>
                      </div>
                    </div>
                    <div className="detail-stats">
                      <span>💰 Income: ${tile.income}/hr</span>
                      <span>⚠️ Risk: {tile.danger}%</span>
                      <span>❤️ Loyalty: {member.loyalty}%</span>
                    </div>
                    <div className="detail-actions">
                      <motion.button
                        className="action-btn recall"
                        onClick={() => removeMember(selectedTile.x, selectedTile.y)}
                        whileTap={{ scale: 0.95 }}
                      >
                        📞 Call Back
                      </motion.button>
                      <motion.button
                        className="action-btn move"
                        onClick={() => {
                          setSelectedMember(member);
                          removeMember(selectedTile.x, selectedTile.y);
                          setSelectedTile(null);
                        }}
                        whileTap={{ scale: 0.95 }}
                      >
                        🔄 Reposition
                      </motion.button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          )}

          {/* Collect button */}
          <motion.button
            className="collect-income-btn"
            onClick={collectIncome}
            whileTap={{ scale: 0.95 }}
            disabled={blockStats.totalIncome === 0}
          >
            💰 COLLECT ${blockStats.totalIncome}
          </motion.button>
        </>
      )}

      {/* Hood View - Mapbox Integration */}
      {view === 'hood' && (
        <div className="hood-view">
          <div className="hood-map-container">
            <MapboxMap onMapLoad={handleMapLoad} />
            <BlockSearch onResultSelect={handleSearchResult} />
            <BlockOverlay
              map={mapInstance}
              blocks={claimedBlocks}
              onBlockClick={handleBlockClick}
            />
            <BlockDetailPanel
              block={selectedBlock}
              onClose={() => setSelectedBlock(null)}
              onCollectIncome={(b) => {
                updateMoney(b.income || 0);
                setNotification(`💰 Collected $${b.income} from ${b.address}`);
                setTimeout(() => setNotification(null), 2000);
                setSelectedBlock(null);
              }}
              onDeployMember={() => {
                setView('roster');
                setSelectedBlock(null);
              }}
              onStartSlide={() => {
                setNotification('🚗 Starting slide... (navigate to SLIDE app)');
                setTimeout(() => setNotification(null), 2000);
                setSelectedBlock(null);
              }}
              onClaimBlock={handleClaimBlock}
            />
          </div>
          <div className="hood-legend">
            <span className="legend-item"><span className="dot home" /> Your Territory</span>
            <span className="legend-item"><span className="dot opp" /> Opposition</span>
            <span className="legend-item"><span className="dot neutral" /> Neutral</span>
          </div>
        </div>
      )}

      {/* Roster View */}
      {view === 'roster' && (
        <div className="roster-view">
          <div className="roster-filters">
            <span className="roster-count">{roster.filter(m => m.status === 'active').length} Active / {roster.length} Total</span>
          </div>
          <div className="roster-list">
            {roster.map(member => {
              const isOnBlock = block.some(row => row.some(t => t.occupant?.id === member.id));

              return (
                <motion.div
                  key={member.id}
                  className={`roster-card ${member.status} ${selectedMember?.id === member.id ? 'selected' : ''}`}
                  onClick={() => {
                    if (member.status === 'active') {
                      setSelectedMember(selectedMember?.id === member.id ? null : member);
                      setView('block');
                    }
                  }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="roster-avatar">
                    <span className="roster-emoji">{ROLE_EMOJIS[member.role]}</span>
                    <span className="roster-level">Lv{member.level}</span>
                  </div>
                  <div className="roster-info">
                    <h4 className="roster-name">{member.name}</h4>
                    <span className="roster-role" style={{ color: ROLE_COLORS[member.role] }}>
                      {member.role.toUpperCase()}
                    </span>
                  </div>
                  <div className="roster-meta">
                    <span className={`roster-status ${member.status}`}>
                      {member.status === 'active' ? (isOnBlock ? '📍 On Block' : '🏠 Available') :
                       member.status === 'injured' ? '🏥 Injured' :
                       member.status === 'jailed' ? '🔒 Jailed' : '💀 Dead'}
                    </span>
                    <span className="roster-loyalty">❤️ {member.loyalty}%</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TerritoryMap;
