// ============================================================
// Market - Underworld Shop
// Browse and buy weapons, armor, vehicles, consumables, tools
// ============================================================
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigationStore, usePlayerStore, useEconomyStore } from '../../stores/gameStore';
import './Market.css';

// ── Item Catalog (from DB seed data) ──
interface CatalogItem {
  id: string;
  name: string;
  category: 'weapon' | 'armor' | 'vehicle' | 'consumable' | 'tool';
  damage: number;
  defense: number;
  basePrice: number;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  icon: string;
}

const ITEM_CATALOG: CatalogItem[] = [
  { id: 'pistol-9mm', name: '9mm Pistol', category: 'weapon', damage: 15, defense: 0, basePrice: 500, description: 'Basic handgun. Reliable and concealable.', rarity: 'common', icon: '🔫' },
  { id: 'revolver-38', name: '.38 Revolver', category: 'weapon', damage: 20, defense: 0, basePrice: 750, description: 'Six-shooter. Never jams.', rarity: 'common', icon: '🔫' },
  { id: 'mac-10', name: 'MAC-10', category: 'weapon', damage: 25, defense: 0, basePrice: 1500, description: 'Compact SMG. Spray and pray.', rarity: 'uncommon', icon: '🔫' },
  { id: 'ak47', name: 'AK-47', category: 'weapon', damage: 35, defense: 0, basePrice: 2500, description: 'Assault rifle. The peoples weapon.', rarity: 'uncommon', icon: '🔫' },
  { id: 'shotgun', name: 'Pump Shotgun', category: 'weapon', damage: 40, defense: 0, basePrice: 1800, description: 'Close-range devastation.', rarity: 'uncommon', icon: '🔫' },
  { id: 'sniper-rifle', name: 'Sniper Rifle', category: 'weapon', damage: 60, defense: 0, basePrice: 5000, description: 'Long-range precision.', rarity: 'rare', icon: '🎯' },
  { id: 'draco', name: 'Draco', category: 'weapon', damage: 45, defense: 0, basePrice: 4000, description: 'Mini AK. Big damage, small package.', rarity: 'rare', icon: '🔫' },
  { id: 'bulletproof-vest', name: 'Bulletproof Vest', category: 'armor', damage: 0, defense: 10, basePrice: 800, description: 'Basic body armor.', rarity: 'common', icon: '🦺' },
  { id: 'tactical-armor', name: 'Tactical Armor', category: 'armor', damage: 0, defense: 25, basePrice: 3000, description: 'Military-grade protection.', rarity: 'rare', icon: '🛡️' },
  { id: 'kevlar-helmet', name: 'Kevlar Helmet', category: 'armor', damage: 0, defense: 8, basePrice: 600, description: 'Head protection from stray shots.', rarity: 'common', icon: '⛑️' },
  { id: 'medkit', name: 'Medical Kit', category: 'consumable', damage: 0, defense: 0, basePrice: 200, description: 'Restores 50 HP.', rarity: 'common', icon: '🩹' },
  { id: 'adrenaline', name: 'Adrenaline Shot', category: 'consumable', damage: 0, defense: 0, basePrice: 400, description: 'Temporary speed boost in combat.', rarity: 'uncommon', icon: '💉' },
  { id: 'burner-phone', name: 'Burner Phone', category: 'consumable', damage: 0, defense: 0, basePrice: 100, description: 'Reduces heat by 10 points.', rarity: 'common', icon: '📱' },
  { id: 'lockpick', name: 'Lockpick Set', category: 'tool', damage: 0, defense: 0, basePrice: 150, description: 'Bypass security.', rarity: 'common', icon: '🔑' },
  { id: 'night-vision', name: 'Night Vision Goggles', category: 'tool', damage: 0, defense: 0, basePrice: 1200, description: '+20% accuracy at night.', rarity: 'uncommon', icon: '🥽' },
  { id: 'scanner', name: 'Police Scanner', category: 'tool', damage: 0, defense: 0, basePrice: 800, description: 'Early warning for raids.', rarity: 'uncommon', icon: '📻' },
  { id: 'sedan', name: 'Sedan', category: 'vehicle', damage: 0, defense: 0, basePrice: 5000, description: 'Basic getaway car.', rarity: 'common', icon: '🚗' },
  { id: 'suv', name: 'Armored SUV', category: 'vehicle', damage: 0, defense: 15, basePrice: 15000, description: 'Bulletproof windows. Seats 5.', rarity: 'rare', icon: '🚙' },
  { id: 'sports-car', name: 'Sports Car', category: 'vehicle', damage: 0, defense: 0, basePrice: 25000, description: 'Fast and flashy.', rarity: 'rare', icon: '🏎️' },
  { id: 'motorcycle', name: 'Motorcycle', category: 'vehicle', damage: 0, defense: 0, basePrice: 3000, description: 'Quick escape through traffic.', rarity: 'common', icon: '🏍️' },
];

const CATEGORIES = ['weapon', 'armor', 'consumable', 'tool', 'vehicle'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  weapon: '🔫 Weapons',
  armor: '🛡️ Armor',
  consumable: '💊 Consumables',
  tool: '🔧 Tools',
  vehicle: '🚗 Vehicles',
};

const RARITY_COLORS: Record<string, string> = {
  common: '#aaa',
  uncommon: '#00cc6a',
  rare: '#007aff',
  legendary: '#ffd700',
};

const formatMoney = (n: number) => `$${n.toLocaleString()}`;

const Market: React.FC = () => {
  const { goBack } = useNavigationStore();
  const { player, updateMoney } = usePlayerStore();
  const { inventory, addInventoryItem, addTransaction } = useEconomyStore();

  const [activeCategory, setActiveCategory] = useState<string>('weapon');
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [purchaseResult, setPurchaseResult] = useState<string>('');
  const [showInventory, setShowInventory] = useState(false);

  const filteredItems = useMemo(
    () => ITEM_CATALOG.filter((i) => i.category === activeCategory),
    [activeCategory]
  );

  const handlePurchase = () => {
    if (!selectedItem) return;
    const total = selectedItem.basePrice * quantity;
    if (player.money < total) {
      setPurchaseResult('NOT ENOUGH CASH');
      setTimeout(() => setPurchaseResult(''), 1500);
      return;
    }

    updateMoney(-total);
    addInventoryItem({
      id: Date.now().toString(),
      type: selectedItem.category as any,
      itemId: selectedItem.id,
      quantity,
    });
    addTransaction({
      id: Date.now().toString(),
      type: 'purchase',
      userId: player.id,
      amount: -total,
      details: { description: `Bought ${quantity}x ${selectedItem.name}` },
      createdAt: new Date().toISOString(),
    } as any);

    setPurchaseResult(`COPPED ${quantity}x ${selectedItem.name}`);
    setTimeout(() => {
      setPurchaseResult('');
      setSelectedItem(null);
      setQuantity(1);
    }, 1500);
  };

  const getOwnedCount = (itemId: string) => {
    const inv = inventory.find((i) => i.itemId === itemId);
    return inv ? inv.quantity : 0;
  };

  return (
    <div className="market-container">
      {/* Header */}
      <div className="market-header">
        <motion.button className="back-btn" onClick={goBack} whileTap={{ scale: 0.9 }}>
          ← Back
        </motion.button>
        <h1>🏪 MARKET</h1>
        <motion.button
          className="inv-toggle-btn"
          onClick={() => setShowInventory(!showInventory)}
          whileTap={{ scale: 0.9 }}
        >
          {showInventory ? '🛒 Shop' : '🎒 Inv'}
        </motion.button>
      </div>

      {/* Cash Display */}
      <div className="market-cash">
        Cash: <span className="cash-value">{formatMoney(player.money)}</span>
      </div>

      {showInventory ? (
        /* ── Inventory View ── */
        <div className="inventory-view">
          <h2>Your Inventory</h2>
          {inventory.length === 0 ? (
            <div className="empty-inv">No items yet. Hit the market.</div>
          ) : (
            <div className="inv-grid">
              {inventory.map((inv) => {
                const cat = ITEM_CATALOG.find((c) => c.id === inv.itemId);
                return (
                  <div key={inv.id} className="inv-item">
                    <span className="inv-icon">{cat?.icon || '📦'}</span>
                    <span className="inv-name">{cat?.name || inv.itemId}</span>
                    <span className="inv-qty">x{inv.quantity}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── Shop View ── */
        <>
          {/* Category Tabs */}
          <div className="category-tabs">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`cat-tab ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Item Grid */}
          <div className="item-grid">
            {filteredItems.map((item) => {
              const owned = getOwnedCount(item.id);
              return (
                <motion.div
                  key={item.id}
                  className="item-card"
                  onClick={() => { setSelectedItem(item); setQuantity(1); setPurchaseResult(''); }}
                  whileTap={{ scale: 0.97 }}
                  style={{ borderColor: RARITY_COLORS[item.rarity] + '40' }}
                >
                  <div className="item-top">
                    <span className="item-icon">{item.icon}</span>
                    {owned > 0 && <span className="owned-badge">x{owned}</span>}
                  </div>
                  <div className="item-name">{item.name}</div>
                  <div className="item-rarity" style={{ color: RARITY_COLORS[item.rarity] }}>
                    {item.rarity.toUpperCase()}
                  </div>
                  <div className="item-stats">
                    {item.damage > 0 && <span className="stat-dmg">⚔️ {item.damage}</span>}
                    {item.defense > 0 && <span className="stat-def">🛡️ {item.defense}</span>}
                  </div>
                  <div className="item-price">{formatMoney(item.basePrice)}</div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {/* Purchase Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setSelectedItem(null); setPurchaseResult(''); }}
          >
            <motion.div
              className="modal-content purchase-modal"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-item-icon">{selectedItem.icon}</div>
              <h3>{selectedItem.name}</h3>
              <p className="modal-desc">{selectedItem.description}</p>
              <div className="modal-stats-row">
                {selectedItem.damage > 0 && <span>⚔️ DMG: {selectedItem.damage}</span>}
                {selectedItem.defense > 0 && <span>🛡️ DEF: {selectedItem.defense}</span>}
                <span style={{ color: RARITY_COLORS[selectedItem.rarity] }}>
                  {selectedItem.rarity.toUpperCase()}
                </span>
              </div>

              {purchaseResult ? (
                <div className={`purchase-result ${purchaseResult.includes('NOT') ? 'fail' : 'success'}`}>
                  {purchaseResult}
                </div>
              ) : (
                <>
                  <div className="qty-selector">
                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button>
                    <span className="qty-display">{quantity}</span>
                    <button onClick={() => setQuantity(quantity + 1)}>+</button>
                  </div>
                  <div className="total-price">
                    Total: <span>{formatMoney(selectedItem.basePrice * quantity)}</span>
                  </div>
                  <motion.button
                    className="buy-btn"
                    onClick={handlePurchase}
                    whileTap={{ scale: 0.95 }}
                  >
                    BUY NOW
                  </motion.button>
                </>
              )}
              <button className="cancel-btn" onClick={() => { setSelectedItem(null); setPurchaseResult(''); }}>
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Market;
