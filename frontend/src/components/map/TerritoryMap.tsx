// ============================================================
// Territory Map — Block board + iPhone Maps-style hood recon
// ============================================================

import React, { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigationStore, usePlayerStore, useGangStore } from '../../stores/gameStore';
import { useBlockStore } from '../../stores/blockStore';
import { useShoeboxStore } from '../../stores/useShoeboxStore';
import { useTutorialProgressStore } from '../../stores/tutorialProgressStore';
import MapboxMap from './MapboxMap';
import BlockOverlay, { type BlockData as MapBlockData } from './BlockOverlay';
import BlockDetailPanel from './BlockDetailPanel';
import BlockModeView from './BlockModeView';
import AddressSearchBar, { type AddressResult } from './AddressSearchBar';
import MapsSearchField from './MapsSearchField';
import NearbyReconSheet from './NearbyReconSheet';
import MemberDropSheet from './MemberDropSheet';
import EmpireCommandBar from './EmpireCommandBar';
import TacticalHoodMap from './TacticalHoodMap';
import WarBriefingCard from './WarBriefingCard';
import { resolveBlockDNA } from '../../utils/blockDNAResolver';
import { buildStaticImageUrl } from '../../config/mapbox.config';
import { CLAIM_BLOCK_COST } from '../../config/gameEconomy';
import { isUsableMapboxToken, LAS_OLAS_CENTER } from '../../config/mapboxToken';
import { attackableNearby, buildNearbyRecon, rankThreats, recommendHit, type ReconBlock } from '../../utils/nearbyBlocks';
import { computeEmpirePnl } from '../../utils/shoeboxAnalytics';
import { vaultDeposit } from '../../utils/moneyRouter';
import { useCombatIntentStore } from '../../stores/combatIntentStore';
import type { BlockData, BlockZoneType, MemberRole } from '../../types/block.types';
import './TerritoryMap.css';
import './EmpireCommandBar.css';
import './MapsChrome.css';
import './TacticalHoodMap.css';
import './WarBriefingCard.css';

type MapView = 'block' | 'hood' | 'roster';

const ROLE_COLORS: Record<string, string> = {
  dealer: '#4ade80',
  shooter: '#ef4444',
  enforcer: '#f97316',
  lookout: '#60a5fa',
  driver: '#a78bfa',
  chemist: '#22d3ee',
  runner: '#fb7185',
  boss: '#fbbf24',
};

function firstOpenTile(block: BlockData): { x: number; y: number; zoneType: BlockZoneType } {
  for (let y = 0; y < block.grid.length; y++) {
    for (let x = 0; x < (block.grid[y]?.length ?? 0); x++) {
      const zone = block.grid[y][x];
      if (zone.passable && !zone.occupantId) {
        return { x, y, zoneType: zone.zoneType };
      }
    }
  }
  return { x: 2, y: 2, zoneType: 'sidewalk' };
}

function toOverlay(block: {
  id: string;
  address: string;
  lat: number;
  lng: number;
  owner: MapBlockData['owner'];
  income?: number;
  heat?: number;
  members?: number;
}): MapBlockData {
  return {
    id: block.id,
    address: block.address,
    lat: block.lat,
    lng: block.lng,
    owner: block.owner,
    income: block.income,
    heat: block.heat,
    members: block.members,
  };
}

const TerritoryMap: React.FC = () => {
  const { goBack, navigateTo } = useNavigationStore();
  const { player, updatePlayer } = usePlayerStore();
  const { members } = useGangStore();
  const { blocks, selectedBlockId, selectBlock, upsertBlock, placeMember, collectIncome } = useBlockStore();
  const vault = useShoeboxStore((s) => s.bankBalance);
  const ledger = useShoeboxStore((s) => s.ledger);

  const [view, setView] = useState<MapView>('hood');
  const { completeStep: completeTutorialStep } = useTutorialProgressStore();
  const [notification, setNotification] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [selectedMapBlock, setSelectedMapBlock] = useState<MapBlockData | null>(null);
  const [searchPins, setSearchPins] = useState<ReconBlock[]>([]);
  const [showBlockSearch, setShowBlockSearch] = useState(false);
  const [showRecon, setShowRecon] = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const liveMapbox = isUsableMapboxToken();

  const liveList = useMemo(() => Object.values(blocks), [blocks]);
  const origin = useMemo(() => {
    const home = liveList.find((b) => b.owner === 'player');
    return home ? { lat: home.lat, lng: home.lng } : { lat: LAS_OLAS_CENTER[1], lng: LAS_OLAS_CENTER[0] };
  }, [liveList]);

  const recon = useMemo(() => {
    const livePins: ReconBlock[] = liveList.map((b) => ({
      id: b.id,
      address: b.address,
      lat: b.lat,
      lng: b.lng,
      owner: b.owner,
      distanceMeters: 0,
      income: b.incomePerTick,
      heat: b.heat,
      members: b.members,
      gangName: b.ownerGangName,
      action: b.owner === 'player' ? 'hold' : b.owner === 'npc' ? 'attack' : 'claim',
    }));
    return buildNearbyRecon([...livePins, ...searchPins], origin);
  }, [liveList, searchPins, origin]);

  const overlayBlocks = useMemo(() => recon.map(toOverlay), [recon]);
  const attackable = useMemo(() => attackableNearby(recon), [recon]);
  const recommended = useMemo(() => recommendHit(recon), [recon]);
  const threats = useMemo(() => rankThreats(recon, 3), [recon]);
  const pnl = useMemo(
    () =>
      computeEmpirePnl({
        streetCash: player?.money ?? 0,
        vault,
        members,
        blocks: liveList,
        ledger,
      }),
    [player?.money, vault, members, liveList, ledger],
  );

  const notify = useCallback((msg: string, ms = 2500) => {
    setNotification(msg);
    window.setTimeout(() => setNotification(null), ms);
  }, []);

  const flyTo = useCallback(
    (lat: number, lng: number, zoom = 16) => {
      mapInstance?.flyTo?.({ center: [lng, lat], zoom, duration: 1400 });
    },
    [mapInstance],
  );

  const claimBlock = useCallback(async (
    _id: string,
    address: string,
    lat: number,
    lng: number,
  ) => {
    if ((player?.money || 0) + vault < CLAIM_BLOCK_COST) {
      notify(`Need $${CLAIM_BLOCK_COST.toLocaleString()} in vault + street cash to claim.`);
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
      setSelectedMapBlock(null);
      setShowBlockSearch(false);
      setShowRecon(false);
      setView('block');
      notify(`Claimed ${live.address} · -$${result.claimCost.toLocaleString()}`, 3500);
      completeTutorialStep('first_block_claimed');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Claim failed — is the backend running?';
      notify(message, 3500);
    }
  }, [player, vault, updatePlayer, upsertBlock, selectBlock, notify, completeTutorialStep]);

  const handleMapLoad = useCallback((map: any) => setMapInstance(map), []);

  const handleHoodSearchResult = useCallback((result: AddressResult) => {
    flyTo(result.lat, result.lng);
    const pin: ReconBlock = {
      id: `search-${result.placeId || Date.now()}`,
      address: result.address,
      lat: result.lat,
      lng: result.lng,
      owner: 'unclaimed',
      distanceMeters: 0,
      income: 0,
      heat: 0,
      members: 0,
      action: 'claim',
    };
    setSearchPins((prev) => {
      if (prev.some((b) => Math.abs(b.lat - result.lat) < 0.0001 && Math.abs(b.lng - result.lng) < 0.0001)) {
        return prev;
      }
      return [...prev, pin];
    });
    setSelectedMapBlock(toOverlay(pin));
  }, [flyTo]);

  const selectRecon = useCallback((block: ReconBlock) => {
    setSelectedMapBlock(toOverlay(block));
    flyTo(block.lat, block.lng, 17);
    if (block.owner === 'player') selectBlock(block.id);
  }, [flyTo, selectBlock]);

  const handleAttack = useCallback((block: ReconBlock | MapBlockData) => {
    selectBlock(block.id);
    setSelectedMapBlock(null);
    setShowRecon(false);
    useCombatIntentStore.getState().setPendingTarget({
      address: block.address,
      lat: block.lat,
      lng: block.lng,
      placeId: block.id,
      seedMode: 'geocoded',
    });
    navigateTo('driveby');
    notify(`Sliding on ${block.address}`);
  }, [navigateTo, selectBlock, notify]);

  const handleHold = useCallback((block: ReconBlock | MapBlockData) => {
    selectBlock(block.id);
    setSelectedMapBlock(toOverlay(block));
    setShowDrop(true);
    setShowRecon(false);
    flyTo(block.lat, block.lng, 17);
  }, [selectBlock, flyTo]);

  const dropMemberOnSelected = useCallback(
    (memberId: string, memberName: string, role: string, level: number) => {
      const targetId = selectedBlockId ?? liveList.find((b) => b.owner === 'player')?.id;
      const block = targetId ? blocks[targetId] : null;
      if (!block) {
        notify('Claim or select your strip first.');
        setView('block');
        return;
      }
      const tile = firstOpenTile(block);
      placeMember(block.id, {
        memberId,
        memberName,
        role: (role as MemberRole) || 'dealer',
        x: tile.x,
        y: tile.y,
        zoneType: tile.zoneType,
        incomePerTick: 0,
        exposureRisk: 40,
        level,
        health: 100,
      });
      selectBlock(block.id);
      setShowDrop(false);
      setView('block');
      notify(`${memberName} dropped on ${block.address}`);
    },
    [selectedBlockId, liveList, blocks, placeMember, selectBlock, notify],
  );

  const activeBlockId = selectedBlockId ?? liveList.find((b) => b.owner === 'player')?.id ?? 'home';
  const activeBlock = blocks[activeBlockId];
  const activeBlockAddress = activeBlock?.address ?? 'Your Home Block';
  const headerIncome = activeBlock?.pendingIncome ?? 0;
  const headerHeat = activeBlock?.heat ?? player?.heat ?? 0;
  const headerMorale = activeBlock?.morale ?? 80;

  return (
    <div className="territory-map">
      <div className="map-header">
        <motion.button className="back-button" onClick={goBack} whileTap={{ scale: 0.9 }} type="button">
          ‹ Maps
        </motion.button>
        <div className="map-title">
          <span className="title-text">THE BLOCK</span>
        </div>
        <div className="map-money">{`$${(player?.money ?? 0).toLocaleString()}`}</div>
      </div>

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

      <EmpireCommandBar
        pnl={pnl}
        attackableCount={attackable.length}
        onOpenNearby={() => {
          setView('hood');
          setShowRecon(true);
        }}
        onOpenDrop={() => {
          setShowDrop(true);
          if (view !== 'hood') setView('hood');
        }}
      />

      {view === 'hood' && (
        <WarBriefingCard
          pnl={pnl}
          recommended={recommended}
          threats={threats}
          onHit={handleAttack}
          onScout={() => setShowRecon(true)}
        />
      )}

      <div className="block-stats">
        <div className="stat-item">
          <span className="stat-value income">${headerIncome}</span>
          <span className="stat-label">Pending</span>
        </div>
        <div className="stat-item">
          <span className="stat-value danger">{headerHeat}</span>
          <span className="stat-label">Heat</span>
        </div>
        <div className="stat-item">
          <span className="stat-value members">{activeBlock?.members ?? 0}</span>
          <span className="stat-label">On Block</span>
        </div>
        <div className="stat-item">
          <span className="stat-value coverage" style={{ color: headerMorale < 40 ? '#ef4444' : '#4ade80' }}>
            {headerMorale}%
          </span>
          <span className="stat-label">Morale</span>
        </div>
      </div>

      <div className="view-tabs">
        {[
          { id: 'hood' as MapView, label: 'Maps', desc: 'Scout & hit' },
          { id: 'block' as MapView, label: 'Strip', desc: 'Place crew' },
          { id: 'roster' as MapView, label: 'Crew', desc: 'Who’s out' },
        ].map((tab) => (
          <motion.button
            key={tab.id}
            className={`view-tab ${view === tab.id ? 'active' : ''}`}
            onClick={() => setView(tab.id)}
            whileTap={{ scale: 0.95 }}
            type="button"
          >
            <span className="tab-label">{tab.label}</span>
            <span className="tab-desc">{tab.desc}</span>
          </motion.button>
        ))}
      </div>

      {view === 'block' && (
        <div className="block-view-wrapper">
          <div className="block-claim-bar">
            {showBlockSearch ? (
              <div style={{ padding: '0 12px 8px' }}>
                <AddressSearchBar
                  inline
                  placeholder="Enter address to claim a new strip…"
                  onResult={(result) => {
                    setShowBlockSearch(false);
                    void claimBlock(`claimed-${result.placeId || Date.now()}`, result.address, result.lat, result.lng);
                  }}
                />
                <button
                  className="block-claim-cancel"
                  onClick={() => setShowBlockSearch(false)}
                  style={{ marginTop: 6, fontSize: 12, color: '#666', background: 'none', border: 'none', cursor: 'pointer' }}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <motion.button
                className="block-claim-btn"
                onClick={() => setShowBlockSearch(true)}
                whileTap={{ scale: 0.96 }}
                type="button"
              >
                + Claim a new strip
              </motion.button>
            )}
          </div>
          <BlockModeView initialBlockId={activeBlockId} initialAddress={activeBlockAddress} />
        </div>
      )}

      {view === 'hood' && (
        <div className="hood-view maps-chrome">
          <div className="hood-map-container maps-stage">
            {liveMapbox ? (
              <MapboxMap
                onMapLoad={handleMapLoad}
                center={[origin.lng, origin.lat]}
                zoom={15}
              />
            ) : (
              <TacticalHoodMap
                center={[origin.lng, origin.lat]}
                zoom={15}
                blocks={recon}
                selectedId={selectedMapBlock?.id}
                onMapLoad={handleMapLoad}
                onBlockClick={(block) => setSelectedMapBlock(toOverlay(block))}
              />
            )}
            <MapsSearchField onFocus={() => setShowRecon(true)} />
            {liveMapbox && (
              <BlockOverlay
                map={mapInstance}
                blocks={overlayBlocks}
                onBlockClick={(blockData) => setSelectedMapBlock(blockData)}
              />
            )}
            {!showRecon && !showDrop && (
              <BlockDetailPanel
                block={selectedMapBlock}
                onClose={() => setSelectedMapBlock(null)}
                onCollectIncome={(b) => {
                  const live = blocks[b.id];
                  const amount = live ? collectIncome(b.id) : (b.income || 0);
                  if (amount > 0) {
                    vaultDeposit(amount, 'block_income', `Collected from ${b.address}`, { blockId: b.id });
                    notify(`Collected $${amount} from ${b.address}`);
                  } else {
                    notify('Nothing sitting on that strip yet.');
                  }
                  setSelectedMapBlock(null);
                }}
                onDeployMember={(b) => handleHold(b)}
                onStartSlide={(b) => handleAttack(b)}
                onClaimBlock={(b) => void claimBlock(b.id, b.address, b.lat, b.lng)}
                claimCost={CLAIM_BLOCK_COST}
              />
            )}
            <NearbyReconSheet
              open={showRecon}
              blocks={recon}
              onClose={() => setShowRecon(false)}
              onSelect={selectRecon}
              onAttack={handleAttack}
              onClaim={(b) => void claimBlock(b.id, b.address, b.lat, b.lng)}
              onHold={handleHold}
              onGeocode={handleHoodSearchResult}
            />
            <MemberDropSheet
              open={showDrop}
              onClose={() => setShowDrop(false)}
              onDrop={dropMemberOnSelected}
            />
          </div>
          <div className="hood-legend">
            <span className="legend-item"><span className="dot home" /> Yours</span>
            <span className="legend-item"><span className="dot opp" /> Attack</span>
            <span className="legend-item"><span className="dot neutral" /> Claim</span>
          </div>
        </div>
      )}

      {view === 'roster' && (
        <div className="roster-view">
          <div className="roster-filters">
            <span className="roster-count">
              {members.filter((m) => m.status === 'active').length} Active / {members.length} Total
            </span>
          </div>
          <div className="roster-list">
            {members.map((member) => {
              const isOnBlock = activeBlock?.placements.some((p) => p.memberId === member.id) ?? false;
              const role = member.role ?? 'dealer';
              return (
                <motion.div
                  key={member.id}
                  className={`roster-card ${member.status}`}
                  onClick={() => {
                    if (member.status === 'active') {
                      setShowDrop(true);
                      setView('hood');
                    }
                  }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="roster-avatar">
                    <span className="roster-emoji">{role.slice(0, 1).toUpperCase()}</span>
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
                        ? (isOnBlock ? 'On Block' : 'Available')
                        : member.status === 'injured' ? 'Injured'
                        : member.status === 'jailed' ? 'Jailed'
                        : 'Down'}
                    </span>
                    <span className="roster-loyalty">{member.loyalty ?? 100}% loyalty</span>
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
