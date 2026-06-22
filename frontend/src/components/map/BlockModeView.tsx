// ============================================================
// BlockModeView — Unified block management view
// Integrates TopDownBlock + StreetBlock + DriveByEngine
// Wires into TerritoryMap as the 'block' tab
// Sprint: block-mode-combat-assets
// ============================================================

import React, { useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBlockStore } from '../../stores/blockStore';
import { usePlayerStore, useGangStore } from '../../stores/gameStore';
import {
  useDrugInventory,
  blockZoneToDrugZone,
  type BlockDealer,
} from '../../stores/useDrugInventory';
import type { BlockData, BlockViewMode } from '../../types/block.types';
import TopDownBlock from './TopDownBlock';
import StreetBlock from './StreetBlock';
import BlockDriveByEngine from '../slide/BlockDriveByEngine';
import DrugAssignmentPanel from '../block/DrugAssignmentPanel';
import './BlockModeView.css';

// ─── Seed helper ─────────────────────────────────────────────
function buildDefaultBlock(id: string, address: string): BlockData {
  const { generateDefaultGrid } = useBlockStore.getState();
  return {
    id,
    address,
    lat: 25.7617,
    lng: -80.1918,
    owner: 'player',
    grid: generateDefaultGrid(),
    placements: [],
    incomePerTick: 0,
    heat: 1,
    morale: 80,
    members: 0,
    viewMode: 'topdown',
    pendingIncome: 0,
  };
}

// ─── Dealer helper ─────────────────────────────────────────────
function blockToDealers(block: BlockData): BlockDealer[] {
  return block.placements
    .filter((p) => p.role === 'dealer')
    .map((p) => ({
      id: p.memberId,
      name: p.memberName,
      gridX: p.x,
      gridY: p.y,
      zone: blockZoneToDrugZone(p.zoneType),
      baseIncome: p.incomePerTick,
      baseHeat: Math.max(1, Math.round(p.exposureRisk / 25)),
    }));
}

// ─── Member deploy panel ──────────────────────────────────────
interface DeployPanelProps {
  onDeploy: (memberId: string, memberName: string, role: string, level: number) => void;
  onClose: () => void;
}

const DeployPanel: React.FC<DeployPanelProps> = ({ onDeploy, onClose }) => {
  const { members } = useGangStore();
  const { blocks, selectedBlockId } = useBlockStore();
  const block = selectedBlockId ? blocks[selectedBlockId] : null;
  const deployedIds = new Set(block?.placements.map((p) => p.memberId) ?? []);

  const available = members.filter(
    (m) => m.status === 'active' && !deployedIds.has(m.id)
  );

  return (
    <motion.div
      className="deploy-panel"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
    >
      <div className="dp-header">
        <h3>Deploy Member</h3>
        <button className="dp-close" onClick={onClose}>✕</button>
      </div>
      <p className="dp-hint">Select a member then tap a zone on the grid.</p>
      <div className="dp-list">
        {available.length === 0 && (
          <div className="dp-empty">No available members. Check CREW app.</div>
        )}
        {available.map((m) => (
          <motion.button
            key={m.id}
            className="dp-member-btn"
            onClick={() => onDeploy(m.id, m.name, m.role ?? 'dealer', m.level ?? 1)}
            whileTap={{ scale: 0.97 }}
          >
            <span className="dp-role">{(m.role ?? 'dealer').toUpperCase()}</span>
            <span className="dp-name">{m.name}</span>
            <span className="dp-level">Lv{m.level ?? 1}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────
interface BlockModeViewProps {
  /** Pre-selected block address (from hood view search) */
  initialAddress?: string;
  initialBlockId?: string;
}

const BlockModeView: React.FC<BlockModeViewProps> = ({
  initialAddress,
  initialBlockId,
}) => {
  const {
    blocks,
    selectedBlockId,
    activeDriveBys,
    selectBlock,
    upsertBlock,
    setBlockViewMode,
    collectIncome,
    setPlacementMode,
  } = useBlockStore();
  const { updateMoney } = usePlayerStore();

  const [showDeployPanel, setShowDeployPanel] = useState(false);
  const [showLoadout, setShowLoadout] = useState(false);
  const [showDriveBy, setShowDriveBy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string, duration = 2500) => {
    setToast(msg);
    setTimeout(() => setToast(null), duration);
  }, []);

  // ── Seed a default block if none exists ──
  useEffect(() => {
    const targetId = initialBlockId ?? 'home-block';
    if (!blocks[targetId]) {
      const address = initialAddress ?? 'Your Home Block';
      upsertBlock(buildDefaultBlock(targetId, address));
    }
    selectBlock(targetId);
  }, [initialBlockId, initialAddress, blocks, upsertBlock, selectBlock]);

  // ── Income tick every 30 seconds (drug-adjusted) ──
  useEffect(() => {
    const interval = setInterval(() => {
      const { consumeAssignedDrugs, getTotalIncome } = useDrugInventory.getState();
      const consumeResult = consumeAssignedDrugs(1);

      if (consumeResult.depleted.length > 0) {
        showToast(`⚠️ ${consumeResult.depleted.length} drug supply depleted`);
      }

      const blockId = useBlockStore.getState().selectedBlockId;
      if (!blockId) return;

      const currentBlock = useBlockStore.getState().blocks[blockId] as BlockData | undefined;
      if (!currentBlock || currentBlock.owner !== 'player') return;

      const dealers = blockToDealers(currentBlock);
      const tickIncome = Math.round(getTotalIncome(dealers));

      if (tickIncome > 0) {
        useBlockStore.setState((state) => {
          const b = state.blocks[blockId];
          if (!b) return state;
          return {
            blocks: {
              ...state.blocks,
              [blockId]: {
                ...b,
                pendingIncome: b.pendingIncome + tickIncome,
              },
            },
          };
        });
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [showToast]);

  const block = selectedBlockId ? (blocks[selectedBlockId] as BlockData | undefined) : undefined;
  const activeEvent = selectedBlockId ? activeDriveBys[selectedBlockId] : undefined;

  const handleCollect = useCallback(() => {
    if (!selectedBlockId || !block) return;
    const amount = collectIncome(selectedBlockId);
    if (amount > 0) {
      updateMoney(amount);
      showToast(`💰 Collected $${amount}!`);
    } else {
      showToast('No income to collect yet.');
    }
  }, [selectedBlockId, block, collectIncome, updateMoney, showToast]);

  const handleDeploy = useCallback(
    (memberId: string, memberName: string, role: string, level: number) => {
      if (!selectedBlockId) return;
      setPlacementMode(true, memberId);
      setShowDeployPanel(false);
      showToast(`📍 Tap a zone to place ${memberName}`);
      // Store member metadata for placement
      // The actual placement happens in TopDownBlock when user taps a zone
      // We need to update the pending placement with correct member data
      // This is done via a store update after zone selection
      useBlockStore.setState((state) => {
        const b = state.blocks[selectedBlockId];
        if (!b) return state;
        // Store pending member data in a temp field
        return {
          ...state,
          _pendingMemberData: { memberId, memberName, role, level },
        } as any;
      });
    },
    [selectedBlockId, setPlacementMode, showToast]
  );

  const handleDriveByResolved = useCallback(
    (outcome: 'repelled' | 'successful' | 'fled' | undefined, casualties: string[]) => {
      setShowDriveBy(false);
      if (outcome === 'repelled') {
        showToast('✅ Drive-by repelled!', 3000);
      } else if (outcome === 'successful') {
        showToast(`⚠️ ${casualties.length} member(s) down!`, 3500);
      }
    },
    [showToast]
  );

  if (!block) {
    return (
      <div className="block-mode-view loading">
        <div className="bmv-spinner">Loading block...</div>
      </div>
    );
  }

  const viewMode: BlockViewMode = block.viewMode ?? 'topdown';

  return (
    <div className="block-mode-view">
      {/* Top bar */}
      <div className="bmv-topbar">
        <div className="bmv-address">{block.address}</div>
        <div className="bmv-quick-stats">
          <span className="bmv-stat income">💰 ${block.pendingIncome}</span>
          <span className="bmv-stat heat">🔥 {block.heat}/5</span>
          <span className="bmv-stat morale">❤️ {block.morale}%</span>
        </div>
      </div>

      {/* View mode toggle */}
      <div className="bmv-view-tabs">
        <button
          className={`bmv-tab ${viewMode === 'topdown' ? 'active' : ''}`}
          onClick={() => setBlockViewMode(block.id, 'topdown')}
        >
          🗺️ Top-Down
        </button>
        <button
          className={`bmv-tab ${viewMode === 'street' ? 'active' : ''}`}
          onClick={() => setBlockViewMode(block.id, 'street')}
        >
          🏙️ Street
        </button>
        <button
          className={`bmv-tab ${showDriveBy ? 'active danger' : ''}`}
          onClick={() => setShowDriveBy((v) => !v)}
        >
          🚗 Drive-By
        </button>
      </div>

      {/* Main view */}
      <div className="bmv-content">
        {showDriveBy ? (
          <BlockDriveByEngine
            blockId={block.id}
            onResolved={handleDriveByResolved}
          />
        ) : viewMode === 'topdown' ? (
          <TopDownBlock block={block} />
        ) : (
          <StreetBlock
            block={block}
            activeDriveBy={activeEvent}
          />
        )}
      </div>

      {/* Action bar */}
      <div className="bmv-action-bar">
        <motion.button
          className="bmv-btn deploy"
          onClick={() => setShowDeployPanel(true)}
          whileTap={{ scale: 0.95 }}
        >
          👥 Deploy
        </motion.button>
        <motion.button
          className="bmv-btn collect"
          onClick={handleCollect}
          disabled={block.pendingIncome === 0}
          whileTap={{ scale: 0.95 }}
        >
          💰 Collect ${block.pendingIncome}
        </motion.button>
        <motion.button
          className="bmv-btn loadout"
          onClick={() => setShowLoadout(true)}
          whileTap={{ scale: 0.95 }}
        >
          💊 Loadout
        </motion.button>
        <motion.button
          className="bmv-btn slide"
          onClick={() => setShowDriveBy(true)}
          whileTap={{ scale: 0.95 }}
        >
          🚗 Slide
        </motion.button>
      </div>

      {/* Deploy panel */}
      <AnimatePresence>
        {showDeployPanel && (
          <DeployPanel
            onDeploy={handleDeploy}
            onClose={() => setShowDeployPanel(false)}
          />
        )}
      </AnimatePresence>

      {/* Drug loadout panel */}
      {showLoadout && (
        <DrugAssignmentPanel
          dealers={blockToDealers(block)}
          onClose={() => setShowLoadout(false)}
        />
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className="bmv-toast"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BlockModeView;
