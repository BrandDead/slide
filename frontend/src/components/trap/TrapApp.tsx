// ============================================================
// TrapApp — Stash & Inventory Manager
// Sprint: trap-app-icon-deemoji
//
// The Trap is the player's off-block stash. Everything earned,
// bought, crafted, or stolen lives here until it's given to a
// member. Once given, it belongs to that member permanently —
// the only way to recover it is to backdoor them.
//
// Item categories:
//   weapons  — guns, melee, accessories
//   armor    — vests, helmets
//   vehicles — cars, trucks
//   drug     — product (from alchemy or market)
//   tool     — lockpicks, scanners, etc.
//   consumable — medkits, burner phones
//
// Backdoor mechanic:
//   Player can "back-door" a member — remove them from the gang,
//   reclaim all their items, drop morale, and zero their heat
//   contribution. The member's contact card is marked backdoored.
// ============================================================

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useNavigationStore,
  useGangStore,
  useEconomyStore,
  useNotificationStore,
} from '../../stores/gameStore';
import type { InventoryItem } from '../../types/game.types';
import './TrapApp.css';

// ─── Category labels ─────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  all:        'ALL',
  weapon:     'WEAPONS',
  armor:      'ARMOR',
  vehicle:    'VEHICLES',
  drug:       'PRODUCT',
  tool:       'TOOLS',
  consumable: 'CONSUMABLES',
};

const CATEGORY_ORDER = ['all', 'weapon', 'armor', 'vehicle', 'drug', 'tool', 'consumable'] as const;

// ─── Helpers ─────────────────────────────────────────────────

function itemDisplayName(item: InventoryItem): string {
  return item.name ?? item.itemId ?? 'Unknown Item';
}

function itemSubtitle(item: InventoryItem): string {
  const parts: string[] = [];
  if (item.type === 'drug') {
    if (item.quality != null) parts.push(`${item.quality}% pure`);
    if (item.tier != null) parts.push(`T${item.tier}`);
    if (item.odRisk != null && item.odRisk > 60) parts.push('HIGH OD RISK');
  }
  if (item.type === 'weapon') {
    if (item.damage != null) parts.push(`DMG ${item.damage}`);
    if (item.accuracy != null) parts.push(`ACC ${item.accuracy}%`);
  }
  if (item.type === 'armor') {
    if (item.defense != null) parts.push(`DEF ${item.defense}`);
  }
  return parts.join(' · ');
}

function itemValueLabel(item: InventoryItem): string {
  if (item.value == null) return '';
  const total = item.value * item.quantity;
  if (total >= 1000) return `$${(total / 1000).toFixed(1)}K`;
  return `$${total.toLocaleString()}`;
}

// ─── Component ───────────────────────────────────────────────

const TrapApp: React.FC = () => {
  const { goBack } = useNavigationStore();
  const { members, backdoorMember, updateMember } = useGangStore();
  const { inventory, transferItemToMember } = useEconomyStore();
  const { addNotification } = useNotificationStore();

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [giftTarget, setGiftTarget] = useState<string | null>(null);
  const [giftQty, setGiftQty] = useState(1);
  const [showBackdoorConfirm, setShowBackdoorConfirm] = useState<string | null>(null);
  const [showMemberStash, setShowMemberStash] = useState<string | null>(null);

  // ── Filtered inventory ─────────────────────────────────────

  const displayItems = useMemo(() => {
    const base = inventory.filter((i) => i.quantity > 0);
    if (activeCategory === 'all') return base;
    return base.filter((i) => i.type === activeCategory);
  }, [inventory, activeCategory]);

  const totalValue = useMemo(
    () => inventory.reduce((sum, i) => sum + (i.value ?? 0) * i.quantity, 0),
    [inventory],
  );

  // ── Active members (can receive gifts) ────────────────────

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === 'active' || (m.status as any) === 'deployed'),
    [members],
  );

  // ── Gift item to member ────────────────────────────────────

  const handleGift = () => {
    if (!selectedItem || !giftTarget || giftQty < 1) return;
    if (giftQty > selectedItem.quantity) {
      addNotification({
        type: 'warning',
        title: 'Not Enough Stock',
        message: `You only have ${selectedItem.quantity} of that item.`,
        priority: 'normal',
        timestamp: Date.now(),
      });
      return;
    }
    transferItemToMember(selectedItem.itemId, giftTarget, giftQty);
    const member = members.find((m) => m.id === giftTarget);
    addNotification({
      type: 'success',
      title: 'Item Given',
      message: `${itemDisplayName(selectedItem)} x${giftQty} given to ${member?.name ?? 'member'}. It belongs to them now.`,
      priority: 'normal',
      timestamp: Date.now(),
    });
    setSelectedItem(null);
    setGiftTarget(null);
    setGiftQty(1);
  };

  // ── Backdoor member ────────────────────────────────────────

  const handleBackdoor = (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;

    // Reclaim all items from the member back into stash
    const memberItems = member.inventory ?? [];
    for (const item of memberItems) {
      // Re-add to player stash via direct store call
      useEconomyStore.getState().addInventoryItem({
        ...item,
        quantity: item.quantity,
        acquiredAt: new Date().toISOString(),
      });
    }

    // Clear member inventory then backdoor
    updateMember(memberId, { inventory: [] });
    backdoorMember(memberId, 'Backdoored by player');

    addNotification({
      type: 'danger',
      title: 'Member Backdoored',
      message: `${member.name} has been removed. ${memberItems.length} item(s) returned to the trap. Gang morale will drop.`,
      priority: 'high',
      timestamp: Date.now(),
    });

    setShowBackdoorConfirm(null);
    setShowMemberStash(null);
  };

  // ── Render ─────────────────────────────────────────────────

  const selectedMemberStash = showMemberStash
    ? members.find((m) => m.id === showMemberStash)
    : null;

  return (
    <div className="trap-app">
      {/* Header */}
      <div className="trap-header">
        <button className="trap-back" onClick={goBack}>BACK</button>
        <div className="trap-title-block">
          <h1 className="trap-title">THE TRAP</h1>
          <span className="trap-value">{totalValue >= 1000 ? `$${(totalValue / 1000).toFixed(1)}K` : `$${totalValue.toLocaleString()}`} in stash</span>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="trap-tabs">
        {CATEGORY_ORDER.map((cat) => (
          <button
            key={cat}
            className={`trap-tab ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Main layout: inventory + member roster */}
      <div className="trap-body">

        {/* Inventory Grid */}
        <div className="trap-inventory">
          <h2 className="trap-section-title">STASH</h2>
          {displayItems.length === 0 ? (
            <div className="trap-empty">
              <p>Nothing here.</p>
              <p className="trap-empty-hint">Buy from the Market, cook in the Lab, or complete missions to fill the trap.</p>
            </div>
          ) : (
            <div className="trap-item-list">
              {displayItems.map((item) => (
                <motion.div
                  key={item.itemId}
                  className={`trap-item ${selectedItem?.itemId === item.itemId ? 'selected' : ''}`}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setSelectedItem(selectedItem?.itemId === item.itemId ? null : item);
                    setGiftTarget(null);
                    setGiftQty(1);
                  }}
                >
                  <div className="trap-item-icon">
                    <span className="trap-item-type-badge">{item.type.toUpperCase().slice(0, 3)}</span>
                  </div>
                  <div className="trap-item-info">
                    <span className="trap-item-name">{itemDisplayName(item)}</span>
                    {itemSubtitle(item) && (
                      <span className="trap-item-sub">{itemSubtitle(item)}</span>
                    )}
                  </div>
                  <div className="trap-item-meta">
                    <span className="trap-item-qty">x{item.quantity}</span>
                    {itemValueLabel(item) && (
                      <span className="trap-item-value">{itemValueLabel(item)}</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Member Roster */}
        <div className="trap-members">
          <h2 className="trap-section-title">CREW</h2>
          <div className="trap-member-list">
            {activeMembers.map((m) => {
              const heldCount = (m.inventory ?? []).reduce((s, i) => s + i.quantity, 0);
              return (
                <motion.div
                  key={m.id}
                  className={`trap-member-card ${giftTarget === m.id ? 'targeted' : ''}`}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    if (selectedItem) {
                      setGiftTarget(giftTarget === m.id ? null : m.id);
                    } else {
                      setShowMemberStash(showMemberStash === m.id ? null : m.id);
                    }
                  }}
                >
                  <div className="trap-member-avatar">
                    {m.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="trap-member-info">
                    <span className="trap-member-name">{m.name}</span>
                    <span className="trap-member-role">{m.role?.toUpperCase() ?? 'MEMBER'}</span>
                  </div>
                  <div className="trap-member-held">
                    {heldCount > 0 && (
                      <span className="trap-member-items">{heldCount} items</span>
                    )}
                    <span className="trap-member-level">LV{m.level ?? 1}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Gift Panel — appears when item + member selected */}
      <AnimatePresence>
        {selectedItem && giftTarget && (
          <motion.div
            className="trap-gift-panel"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
          >
            <div className="trap-gift-info">
              <span className="trap-gift-item">{itemDisplayName(selectedItem)}</span>
              <span className="trap-gift-arrow">to</span>
              <span className="trap-gift-member">
                {members.find((m) => m.id === giftTarget)?.name ?? 'Member'}
              </span>
            </div>
            <div className="trap-gift-warning">
              Once given, this item belongs to them. Backdoor to recover.
            </div>
            <div className="trap-gift-controls">
              <button
                className="trap-qty-btn"
                onClick={() => setGiftQty((q) => Math.max(1, q - 1))}
              >
                -
              </button>
              <span className="trap-qty-val">{giftQty}</span>
              <button
                className="trap-qty-btn"
                onClick={() => setGiftQty((q) => Math.min(selectedItem.quantity, q + 1))}
              >
                +
              </button>
              <button className="trap-gift-btn" onClick={handleGift}>
                GIVE
              </button>
              <button className="trap-cancel-btn" onClick={() => { setSelectedItem(null); setGiftTarget(null); }}>
                CANCEL
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Member Stash Viewer */}
      <AnimatePresence>
        {showMemberStash && selectedMemberStash && (
          <motion.div
            className="trap-member-stash-panel"
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 60 }}
          >
            <div className="trap-ms-header">
              <span className="trap-ms-name">{selectedMemberStash.name}</span>
              <button className="trap-ms-close" onClick={() => setShowMemberStash(null)}>X</button>
            </div>
            <div className="trap-ms-items">
              {(selectedMemberStash.inventory ?? []).length === 0 ? (
                <p className="trap-ms-empty">Carrying nothing.</p>
              ) : (
                (selectedMemberStash.inventory ?? []).map((item, idx) => (
                  <div key={idx} className="trap-ms-item">
                    <span className="trap-ms-item-name">{itemDisplayName(item)}</span>
                    <span className="trap-ms-item-qty">x{item.quantity}</span>
                  </div>
                ))
              )}
            </div>
            <button
              className="trap-backdoor-btn"
              onClick={() => setShowBackdoorConfirm(selectedMemberStash.id)}
            >
              BACK DOOR {selectedMemberStash.name.toUpperCase()}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdoor Confirm Modal */}
      <AnimatePresence>
        {showBackdoorConfirm && (
          <motion.div
            className="trap-backdoor-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="trap-backdoor-modal"
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.85 }}
            >
              <h2 className="trap-bd-title">BACK DOOR?</h2>
              <p className="trap-bd-body">
                {members.find((m) => m.id === showBackdoorConfirm)?.name} will be removed from the gang.
                All their items return to the trap. Gang morale will drop. This cannot be undone.
              </p>
              <div className="trap-bd-actions">
                <button
                  className="trap-bd-confirm"
                  onClick={() => handleBackdoor(showBackdoorConfirm)}
                >
                  DO IT
                </button>
                <button
                  className="trap-bd-cancel"
                  onClick={() => setShowBackdoorConfirm(null)}
                >
                  CANCEL
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TrapApp;
