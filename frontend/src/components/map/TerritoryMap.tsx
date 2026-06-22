// ============================================================
// Territory Map - Block Management & Member Positioning
// Block view now powered by BlockModeView (TopDownBlock +
// StreetBlock + DriveByEngine). Hood view uses Mapbox.
// Sprint: morale-heat-photo-batch2
// ============================================================

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigationStore, usePlayerStore, useGangStore } from '../../stores/gameStore';
import { useBlockStore } from '../../stores/blockStore';
import { useTutorialProgressStore } from '../../stores/tutorialProgressStore';
import MapboxMap from './MapboxMap';
import BlockSearch from './BlockSearch';
import BlockOverlay, { type BlockData as MapBlockData } from './BlockOverlay';
import BlockDetailPanel from './BlockDetailPanel';
import BlockModeView from './BlockModeView';
import './TerritoryMap.css';

// ─── Types ───────────────────────────────────────────────────
type MapView = 'block' | 'hood' | 'roster';

const ROLE_EMOJIS: Record<string, string> = {
  dealer:   '💊',
  shooter:  '🔫',
  enforcer: '💪',
  lookout:  '👁️',
  driver:   '🚗',
  chemist:  '⚗️',
  runner:   '🏃',
  boss:     '👑',
};

const ROLE_COLORS: Record<string, string> = {
  dealer:   '#4ade80',
  shooter:  '#ef4444',
  enforcer: '#f97316',
  lookout:  '#60a5fa',
  driver:   '#a78bfa',
  chemist:  '#22d3ee',
  runner:   '#fb7185',
  boss:     '#fbbf24',
};

// ─── Component ───────────────────────────────────────────────
const TerritoryMap: React.FC = () => {
  const { goBack } = useNavigationStore();
  const { player, updateMoney, updateHeat } = usePlayerStore();
  const { members } = useGangStore();
  const { blocks, selectedBlockId, selectBlock, upsertBlock } = useBlockStore();

  const [view, setView] = useState<MapView>('block');
  const { completeStep: completeTutorialStep } = useTutorialProgressStore();
  const [notification, setNotification] = useState<string | null>(null);

  // Mapbox / hood state
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [selectedMapBlock, setSelectedMapBlock] = useState<MapBlockData | null>(null);
  const [claimedBlocks, setClaimedBlocks] = useState<MapBlockData[]>([
    { id: 'home', address: 'Your Home Block', lat: 25.7617, lng: -80.1918, owner: 'player', income: 450, heat: 15, members: 4 },
    { id: 'opp1', address: 'Rival Block #1',  lat: 25.7640, lng: -80.1895, owner: 'npc',    income: 300, heat: 45, members: 6 },
    { id: 'opp2', address: 'Rival Block #2',  lat: 25.7595, lng: -80.1940, owner: 'npc',    income: 200, heat: 30, members: 3 },
    { id: 'neutral1', address: 'Unclaimed Lot', lat: 25.7630, lng: -80.1960, owner: 'unclaimed', income: 0, heat: 0, members: 0 },
  ]);

  const notify = useCallback((msg: string, ms = 2500) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), ms);
  }, []);

  // ── Hood view handlers ──
  const handleMapLoad = useCallback((map: any) => setMapInstance(map), []);

  const handleSearchResult = useCallback((result: any) => {
    if (mapInstance) {
      mapInstance.flyTo({ center: [result.lng, result.lat], zoom: 16, duration: 2000 });
    }
    const newBlock: MapBlockData = {
      id: `search-${Date.now()}`,
      address: result.address,
      lat: result.lat,
      lng: result.lng,
      owner: 'unclaimed',
      income: 0, heat: 0, members: 0,
    };
    setClaimedBlocks(prev => {
      if (prev.some(b => Math.abs(b.lat - result.lat) < 0.0001 && Math.abs(b.lng - result.lng) < 0.0001)) return prev;
      return [...prev, newBlock];
    });
    setSelectedMapBlock(newBlock);
  }, [mapInstance]);

  const handleBlockClick = useCallback((blockData: MapBlockData) => {
    setSelectedMapBlock(blockData);
  }, []);

  const handleClaimBlock = useCallback((blockData: MapBlockData) => {
    if ((player?.money || 0) < 2000) {
      notify('Not enough cash! Need $2,000 to claim.');
      return;
    }
    updateMoney(-2000);
    updateHeat(5);
    setClaimedBlocks(prev =>
      prev.map(b => b.id === blockData.id
        ? { ...b, owner: 'player' as const, income: 100 + Math.floor(Math.random() * 200) }
        : b
      )
    );
    // Seed a block store entry for the newly claimed block
    const { generateDefaultGrid } = useBlockStore.getState();
    upsertBlock({
      id: blockData.id,
      address: blockData.address,
      lat: blockData.lat,
      lng: blockData.lng,
      owner: 'player',
      grid: generateDefaultGrid(),
      placements: [],
      incomePerTick: 0,
      heat: 5,
      morale: 80,
      members: 0,
      viewMode: 'topdown',
      pendingIncome: 0,
    });
    selectBlock(blockData.id);
    setSelectedMapBlock(null);
    notify(`🏴 Claimed ${blockData.address}! (-$2,000, +5 heat)`, 3000);
    // Tutorial: first block claimed
    completeTutorialStep('first_block_claimed');
  }, [player, updateMoney, updateHeat, upsertBlock, selectBlock, notify]);

  // ── Derive active block ID for BlockModeView ──
  const activeBlockId = selectedBlockId ?? 'home';
  const activeBlockAddress = blocks[activeBlockId]?.address ?? claimedBlocks.find(b => b.id === activeBlockId)?.address ?? 'Your Home Block';

  // ── Stats for header (from block store) ──
  const activeBlock = blocks[activeBlockId];
  const headerIncome = activeBlock?.pendingIncome ?? 0;
  const headerHeat   = activeBlock?.heat ?? player?.heat ?? 0;
  const headerMorale = activeBlock?.morale ?? 80;

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

      {/* Live block status bar */}
      <div className="block-stats">
        <div className="stat-item">
          <span className="stat-value income">💰 ${headerIncome}</span>
          <span className="stat-label">Pending</span>
        </div>
        <div className="stat-item">
          <span className="stat-value danger">🔥 {headerHeat}/5</span>
          <span className="stat-label">Heat</span>
        </div>
        <div className="stat-item">
          <span className="stat-value members">👥 {activeBlock?.members ?? 0}</span>
          <span className="stat-label">On Block</span>
        </div>
        <div className="stat-item">
          <span className="stat-value coverage" style={{ color: headerMorale < 40 ? '#ef4444' : '#4ade80' }}>
            ❤️ {headerMorale}%
          </span>
          <span className="stat-label">Morale</span>
        </div>
      </div>

      {/* View Tabs */}
      <div className="view-tabs">
        {[
          { id: 'block' as MapView, label: '🏘️ Block', desc: 'Position crew' },
          { id: 'hood'  as MapView, label: '🗺️ Hood',  desc: 'Territory' },
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

      {/* ── Block View — powered by BlockModeView ── */}
      {view === 'block' && (
        <BlockModeView
          initialBlockId={activeBlockId}
          initialAddress={activeBlockAddress}
        />
      )}

      {/* ── Hood View — Mapbox ── */}
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
              block={selectedMapBlock}
              onClose={() => setSelectedMapBlock(null)}
              onCollectIncome={(b) => {
                updateMoney(b.income || 0);
                notify(`💰 Collected $${b.income} from ${b.address}`);
                setSelectedMapBlock(null);
              }}
              onDeployMember={(b) => {
                // Switch to block view for the selected block
                selectBlock(b.id);
                setView('block');
                setSelectedMapBlock(null);
              }}
              onStartSlide={(b) => {
                selectBlock(b.id);
                setView('block');
                setSelectedMapBlock(null);
                notify('🚗 Navigate to Drive-By tab to slide');
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

      {/* ── Roster View ── */}
      {view === 'roster' && (
        <div className="roster-view">
          <div className="roster-filters">
            <span className="roster-count">
              {members.filter(m => m.status === 'active').length} Active / {members.length} Total
            </span>
          </div>
          <div className="roster-list">
            {members.map(member => {
              const isOnBlock = activeBlock?.placements.some(p => p.memberId === member.id) ?? false;
              const role = member.role ?? 'dealer';
              return (
                <motion.div
                  key={member.id}
                  className={`roster-card ${member.status}`}
                  onClick={() => {
                    if (member.status === 'active') {
                      setView('block');
                    }
                  }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="roster-avatar">
                    <span className="roster-emoji">{ROLE_EMOJIS[role] ?? '👤'}</span>
                    <span className="roster-level">Lv{member.level ?? 1}</span>
                  </div>
                  <div className="roster-info">
                    <h4 className="roster-name">{member.name}</h4>
                    <span className="roster-role" style={{ color: ROLE_COLORS[role] ?? '#fff' }}>
                      {role.toUpperCase()}
                    </span>
                  </div>
                  <div className="roster-meta">
                    <span className={`roster-status ${member.status}`}>
                      {member.status === 'active'
                        ? (isOnBlock ? '📍 On Block' : '🏠 Available')
                        : member.status === 'injured' ? '🏥 Injured'
                        : member.status === 'jailed'  ? '🔒 Jailed'
                        : '💀 Dead'}
                    </span>
                    <span className="roster-loyalty">❤️ {member.loyalty ?? 100}%</span>
                  </div>
                </motion.div>
              );
            })}
            {members.length === 0 && (
              <div className="roster-empty">No crew yet. Visit the CREW app to recruit.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TerritoryMap;
