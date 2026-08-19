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
import type { BlockData, BlockViewMode, MemberRole } from '../../types/block.types';
import {
  getDefaultTopdownBgUrl,
  getDefaultStreetBackdropUrl,
  preloadBlockAssets,
} from '../../services/assetResolver';
import type { IncidentMember } from '../gang/BailModal';
import { useMoraleEffects } from '../../hooks/useMoraleEffects';
import { useTutorialProgressStore } from '../../stores/tutorialProgressStore';
import { soundManager } from '../../utils/SoundManager';
import TopDownBlock from './TopDownBlock';
import StreetBlock from './StreetBlock';
import DriveByEngine from '../slide/BlockDriveByEngine';
import BailModal from '../gang/BailModal';
import DrugAssignmentPanel from './DrugAssignmentPanel';
import { PoliceRaidGame } from '../topdown/PoliceRaidGame';
import { vaultDeposit } from '../../utils/moneyRouter';
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
    topdownBgUrl: getDefaultTopdownBgUrl(),
    streetBackdropUrl: getDefaultStreetBackdropUrl(),
  };
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
  const { updateMoney, updatePlayer, player } = usePlayerStore();

  const [showDeployPanel, setShowDeployPanel] = useState(false);
  const [showDriveBy, setShowDriveBy] = useState(false);
  const [showRaid, setShowRaid] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [bailIncidents, setBailIncidents] = useState<IncidentMember[]>([]);
  const [showBailModal, setShowBailModal] = useState(false);
  const { checkMoraleOnDeploy } = useMoraleEffects();
  const { completeStep } = useTutorialProgressStore();

  const showToast = useCallback((msg: string, duration = 2500) => {
    setToast(msg);
    setTimeout(() => setToast(null), duration);
  }, []);

  // ── Warm block art (portraits, sprites, backdrops) ──
  useEffect(() => {
    preloadBlockAssets();
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

  // Income ticking is handled centrally by gameLoopEngine (App.tsx)
  // BlockModeView only reads pendingIncome and allows manual collection

  const block = selectedBlockId ? (blocks[selectedBlockId] as BlockData | undefined) : undefined;
  const activeEvent = selectedBlockId ? activeDriveBys[selectedBlockId] : undefined;

  const handleCollect = useCallback(async () => {
    if (!selectedBlockId || !block) return;
    try {
      const { blocksApi } = await import('../../services/api.service');
      const result = await blocksApi.collect(selectedBlockId);
      if (result.collected > 0) {
        updatePlayer({
          money: result.player.cash,
          heat: result.player.heat,
        });
        vaultDeposit(result.collected, 'block_income', `Collected $${result.collected}`, {
          blockId: selectedBlockId,
        });
        collectIncome(selectedBlockId);
        showToast(`Collected $${result.collected}!`);
        soundManager.play('cash_register');
        const reward = completeStep('first_income_collected');
        if (reward.cashReward > 0) updateMoney(reward.cashReward);
      } else {
        showToast('No income to collect yet.');
      }
    } catch {
      const amount = collectIncome(selectedBlockId);
      if (amount > 0) {
        vaultDeposit(amount, 'block_income', `Collected $${amount} from ${block.address}`, {
          blockId: selectedBlockId,
        });
        showToast(`Collected $${amount}`);
        soundManager.play('cash_register');
      } else {
        showToast('No income to collect yet.');
      }
    }
  }, [selectedBlockId, block, collectIncome, updateMoney, updatePlayer, player.bankBalance, showToast, completeStep]);

  const handleDeploy = useCallback(
    (memberId: string, memberName: string, role: string, level: number) => {
      if (!selectedBlockId) return;

      // Morale check before deployment
      const moraleResult = checkMoraleOnDeploy(selectedBlockId, memberId, memberName);
      if (!moraleResult.memberShowsUp) {
        showToast(moraleResult.warnings[0] ?? `${memberName} didn't show up.`, 3500);
        soundManager.play('morale_drop');
        return;
      }
      if (moraleResult.warnings.length > 0) {
        showToast(moraleResult.warnings[0], 3000);
        soundManager.play('morale_drop');
      }
      soundManager.play('ui_tap');

      setPlacementMode(true, {
        memberId,
        memberName,
        role: role as MemberRole,
        level,
      });
      setShowDeployPanel(false);
      showToast(`📍 Tap a zone to place ${memberName}`);
      // Tutorial: first member deployed (fires on first successful placement intent)
      completeStep('first_member_deployed');
    },
    [selectedBlockId, setPlacementMode, showToast, checkMoraleOnDeploy, completeStep]
  );

  const handleDriveByResolved = useCallback(
    (outcome: 'repelled' | 'successful' | 'fled' | undefined, casualties: string[]) => {
      setShowDriveBy(false);
      if (outcome === 'repelled') {
        showToast('✅ Drive-by repelled!', 3000);
      } else if (outcome === 'successful' && casualties.length > 0) {
        showToast(`⚠️ ${casualties.length} member(s) down!`, 3500);
        // Build bail incidents for wounded members
        const block = selectedBlockId ? blocks[selectedBlockId] : undefined;
        if (block) {
          const incidents: IncidentMember[] = casualties.map(memberId => {
            const placement = block.placements.find(p => p.memberId === memberId);
            return {
              memberId,
              memberName: placement?.memberName ?? 'Member',
              incidentType: 'injured' as const,
              cost: 2500 + Math.floor(Math.random() * 5000),
              blockId: block.id,
            };
          });
          setBailIncidents(incidents);
          setShowBailModal(true);
        }
      }
    },
    [showToast, selectedBlockId, blocks]
  );

  if (!block) {
    return (
      <div className="block-mode-view loading">
        <div className="bmv-spinner">Loading block...</div>
      </div>
    );
  }

  const viewMode: BlockViewMode = block.viewMode ?? 'topdown';
  // Auto-trigger raid when heat maxes out
  const isMaxHeat = (block.heat ?? 0) >= 5;

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
        <button
          className={`bmv-tab ${showRaid ? 'active danger' : ''} ${isMaxHeat ? 'pulse-danger' : ''}`}
          onClick={() => { setShowDriveBy(false); setShowRaid((v) => !v); }}
        >
          🚔 Raid{isMaxHeat ? ' !' : ''}
        </button>
        <button
          className={`bmv-tab ${!showDriveBy && viewMode === 'drugs' ? 'active' : ''}`}
          onClick={() => { setShowDriveBy(false); setBlockViewMode(block.id, 'drugs'); }}
        >
          💊 Drugs
        </button>
      </div>

      {/* Main view */}
      <div className="bmv-content">
        {showRaid ? (
          <PoliceRaidGame
            blockId={block.id}
            onResolved={(caught, cashSeized) => {
              setShowRaid(false);
              if (caught.length > 0) {
                showToast(`🚔 ${caught.length} member(s) jailed! $${cashSeized.toLocaleString()} seized.`, 4000);
              } else {
                showToast('✅ Everyone escaped the raid!', 3000);
              }
            }}
          />
        ) : showDriveBy ? (
          <DriveByEngine
            blockId={block.id}
            onResolved={handleDriveByResolved}
          />
        ) : viewMode === 'drugs' ? (
          <DrugAssignmentPanel block={block} />
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

      {/* Bail Modal — shown after drive-by casualties */}
      {showBailModal && bailIncidents.length > 0 && (
        <BailModal
          incidents={bailIncidents}
          onClose={() => {
            setShowBailModal(false);
            setBailIncidents([]);
          }}
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
