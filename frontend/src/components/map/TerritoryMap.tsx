// ============================================================
// Territory Map - Block Management & Member Positioning
// Sprint: address-block-pipeline
//
// Changes:
//   - AddressSearchBar replaces BlockSearch in Hood view
//   - AddressSearchBar also shown in Block view (claim new strip)
//   - resolveBlockDNA applied on claim → correct zone layout
//   - useBlockSatellite fetches real satellite image on claim
//   - Fort Lauderdale (Broward County) fully supported
// ============================================================

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigationStore, usePlayerStore, useGangStore } from '../../stores/gameStore';
import { useBlockStore } from '../../stores/blockStore';
import { useTutorialProgressStore } from '../../stores/tutorialProgressStore';
import MapboxMap from './MapboxMap';
import BlockOverlay, { type BlockData as MapBlockData } from './BlockOverlay';
import BlockDetailPanel from './BlockDetailPanel';
import BlockModeView from './BlockModeView';
import AddressSearchBar, { type AddressResult } from './AddressSearchBar';
import { resolveBlockDNA } from '../../utils/blockDNAResolver';
import { buildStaticImageUrl } from '../../config/mapbox.config';
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
  const { player, updatePlayer } = usePlayerStore();
  const { members } = useGangStore();
  const { blocks, selectedBlockId, selectBlock, upsertBlock } = useBlockStore();

  const [view, setView] = useState<MapView>('block');
  const { completeStep: completeTutorialStep } = useTutorialProgressStore();
  const [notification, setNotification] = useState<string | null>(null);

  // Mapbox / hood state
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [selectedMapBlock, setSelectedMapBlock] = useState<MapBlockData | null>(null);
  const [claimedBlocks, setClaimedBlocks] = useState<MapBlockData[]>([
    { id: 'home',     address: 'Your Home Block', lat: 25.7617, lng: -80.1918, owner: 'player',    income: 450, heat: 15, members: 4 },
    { id: 'opp1',     address: 'Rival Block #1',  lat: 25.7640, lng: -80.1895, owner: 'npc',       income: 300, heat: 45, members: 6 },
    { id: 'opp2',     address: 'Rival Block #2',  lat: 25.7595, lng: -80.1940, owner: 'npc',       income: 200, heat: 30, members: 3 },
    { id: 'neutral1', address: 'Unclaimed Lot',   lat: 25.7630, lng: -80.1960, owner: 'unclaimed', income: 0,   heat: 0,  members: 0 },
  ]);

  // Block-view address search state
  const [showBlockSearch, setShowBlockSearch] = useState(false);
  const [pendingClaim, setPendingClaim] = useState<AddressResult | null>(null);

  const notify = useCallback((msg: string, ms = 2500) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), ms);
  }, []);

  // ── Shared claim logic (Gate 0B Flask authority + local DNA/satellite) ──
  const claimBlock = useCallback(async (
    _id: string,
    address: string,
    lat: number,
    lng: number,
  ) => {
    const { CLAIM_BLOCK_COST } = await import('../../config/gameEconomy');
    if ((player?.money || 0) < CLAIM_BLOCK_COST) {
      notify(`Not enough cash! Need $${CLAIM_BLOCK_COST.toLocaleString()} to claim.`);
      return;
    }

    try {
      const { blocksApi } = await import('../../services/api.service');
      const { apiBlockToBlockData } = await import('../../utils/blockMappers');
      const result = await blocksApi.claim({
        address,
        coordinates: { lat, lng },
        city: 'miami',
        gangName: player?.gangName || 'Crew',
      });

      updatePlayer({
        money: result.player.cash,
        heat: result.player.heat,
      });

      const live = apiBlockToBlockData(result.block as Record<string, unknown>);
      const resolved = resolveBlockDNA(lat, lng, address);
      const satelliteUrl = buildStaticImageUrl({
        coordinates: { lat, lng },
        zoom: 18,
        width: 512,
        height: 512,
        style: 'satellite-streets-v12',
        highRes: true,
      });

      upsertBlock({
        ...live,
        heat: live.heat || resolved.startingHeat,
        morale: resolved.startingMorale,
        topdownBgUrl: satelliteUrl,
      });
      selectBlock(live.id);

      setClaimedBlocks((prev) => {
        const without = prev.filter(
          (b) => b.id !== _id && b.id !== live.id && b.address !== address,
        );
        return [
          ...without,
          {
            id: live.id,
            address: live.address,
            lat: live.lat,
            lng: live.lng,
            owner: 'player' as const,
            income: Math.round(100 * resolved.incomeMultiplier),
            heat: live.heat || resolved.startingHeat,
            members: live.members,
          },
        ];
      });

      setSelectedMapBlock(null);
      setPendingClaim(null);
      setShowBlockSearch(false);
      setView('block');
      notify(
        `🏴 Claimed ${live.address}! (${resolved.dna.name} · -$${result.claimCost.toLocaleString()})`,
        3500,
      );
      completeTutorialStep('first_block_claimed');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Claim failed — is the backend running?';
      notify(message, 3500);
    }
  }, [player, updatePlayer, upsertBlock, selectBlock, notify, completeTutorialStep]);

  // ── Hood view handlers ──────────────────────────────────────
  const handleMapLoad = useCallback((map: any) => setMapInstance(map), []);

  const handleHoodSearchResult = useCallback((result: AddressResult) => {
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
    void claimBlock(blockData.id, blockData.address, blockData.lat, blockData.lng);
  }, [claimBlock]);

  // ── Block-view address search ───────────────────────────────
  const handleBlockSearchResult = useCallback((result: AddressResult) => {
    const id = `claimed-${result.placeId || Date.now()}`;
    setPendingClaim(result);
    setShowBlockSearch(false);
    void claimBlock(id, result.address, result.lat, result.lng);
  }, [claimBlock]);

  // ── Derive active block ID for BlockModeView ──
  const activeBlockId = selectedBlockId ?? 'home';
  const activeBlockAddress = blocks[activeBlockId]?.address
    ?? claimedBlocks.find(b => b.id === activeBlockId)?.address
    ?? 'Your Home Block';

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
          { id: 'block'  as MapView, label: '🏘️ Block',  desc: 'Position crew' },
          { id: 'hood'   as MapView, label: '🗺️ Hood',   desc: 'Territory' },
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
        <div className="block-view-wrapper">
          {/* Claim a new strip — inline address search */}
          <div className="block-claim-bar">
            {showBlockSearch ? (
              <div style={{ padding: '0 12px 8px' }}>
                <AddressSearchBar
                  inline
                  placeholder="Enter address to claim a new strip…"
                  onResult={handleBlockSearchResult}
                />
                <button
                  className="block-claim-cancel"
                  onClick={() => setShowBlockSearch(false)}
                  style={{ marginTop: 6, fontSize: 12, color: '#666', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <motion.button
                className="block-claim-btn"
                onClick={() => setShowBlockSearch(true)}
                whileTap={{ scale: 0.96 }}
                style={{
                  padding: '8px 16px',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px dashed #ef4444',
                  borderRadius: 8,
                  color: '#ef4444',
                  fontSize: 13,
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  margin: '0 12px 8px',
                  width: 'calc(100% - 24px)',
                }}
              >
                📍 + Claim a new strip (enter address)
              </motion.button>
            )}
          </div>

          <BlockModeView
            initialBlockId={activeBlockId}
            initialAddress={activeBlockAddress}
          />
        </div>
      )}

      {/* ── Hood View — Mapbox + AddressSearchBar ── */}
      {view === 'hood' && (
        <div className="hood-view">
          <div className="hood-map-container">
            <MapboxMap onMapLoad={handleMapLoad} />
            {/* AddressSearchBar replaces old BlockSearch */}
            <AddressSearchBar
              placeholder="Search address to scout or claim…"
              onResult={handleHoodSearchResult}
            />
            <BlockOverlay
              map={mapInstance}
              blocks={claimedBlocks}
              onBlockClick={handleBlockClick}
            />
            <BlockDetailPanel
              block={selectedMapBlock}
              onClose={() => setSelectedMapBlock(null)}
              onCollectIncome={(b) => {
                updatePlayer({ money: (player?.money || 0) + (b.income || 0) });
                notify(`💰 Collected $${b.income} from ${b.address}`);
                setSelectedMapBlock(null);
              }}
              onDeployMember={(b) => {
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
                    if (member.status === 'active') setView('block');
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
