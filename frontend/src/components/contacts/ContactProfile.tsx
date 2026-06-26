// ============================================================
// ContactProfile - Full Character Profile with Gifts & Loadout
// GTA-style character card: headshot, full body, gear, gifts,
// stats, history, connections, and death memorial
// ============================================================

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  usePlayerStore,
  useEconomyStore,
  useNotificationStore,
} from '../../stores/gameStore';
import './ContactProfile.css';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

interface MemberData {
  id: string;
  name: string;
  nickname?: string;
  role: string;
  status: string;
  level: number;
  xp: number;
  
  // Stats
  shooting: number;
  driving: number;
  dealing: number;
  loyalty: number;
  morale: number;
  heatResistance: number;
  stealth: number;
  health: number;
  maxHealth: number;
  armor: number;
  
  // Appearance
  appearance?: {
    gender: string;
    skinTone: string;
    hairStyle: string;
    hairColor: string;
    jewelry: string[];
    tattoos: string[];
    top: string;
    bottom: string;
    shoes: string;
    outerwear?: string;
    gangColorAccent: boolean;
  };
  
  // Images
  customAvatarUrl?: string;
  headshotUrl?: string;
  fullBodyUrl?: string;
  
  // Equipment
  weaponMods: string[];
  gear: string[];
  inventory: { id: string; type: string; name: string; quantity: number; value: number }[];
  
  // History
  kills: number;
  arrests: number;
  dealsCompleted: number;
  moneyEarned: number;
  
  // Death info
  deathCause?: string;
  killedBy?: string;
  
  // Connections
  connections?: { id: string; name: string; relationship: string; type: string; status: string }[];
  
  // Backstory
  backstory?: { origin: string; reason: string; struggles: string[]; personality: string[]; skills: string[]; quirks: string[]; dreams: string[]; fears: string[] };
}

type GiftCategory = 'clothing' | 'weapons' | 'armor' | 'accessories';

interface GiftItem {
  id: string;
  name: string;
  category: GiftCategory;
  icon: string;
  price: number;
  description: string;
  statBoost?: { stat: string; value: number };
}

interface ContactProfileProps {
  member: MemberData;
  onClose: () => void;
  onUpdateMember: (memberId: string, updates: Record<string, any>) => void;
}

// ═══════════════════════════════════════════════════════════
// GIFT CATALOG
// ═══════════════════════════════════════════════════════════

const GIFT_CATALOG: GiftItem[] = [
  // Clothing - Tops
  { id: 'gift-hoodie', name: 'Designer Hoodie', category: 'clothing', icon: '🧥', price: 200, description: 'Custom gang-color hoodie', statBoost: { stat: 'stealth', value: 3 } },
  { id: 'gift-jersey', name: 'Basketball Jersey', category: 'clothing', icon: '👕', price: 150, description: 'Fresh jersey, block style' },
  { id: 'gift-leather', name: 'Leather Jacket', category: 'clothing', icon: '🧥', price: 500, description: 'Premium leather, intimidation +5', statBoost: { stat: 'loyalty', value: 5 } },
  { id: 'gift-polo', name: 'Ralph Lauren Polo', category: 'clothing', icon: '👔', price: 300, description: 'Clean look for dealing' },
  
  // Clothing - Bottoms
  { id: 'gift-jeans', name: 'True Religion Jeans', category: 'clothing', icon: '👖', price: 350, description: 'Premium denim' },
  { id: 'gift-sweats', name: 'Nike Tech Fleece', category: 'clothing', icon: '👖', price: 250, description: 'Comfortable and mobile' },
  { id: 'gift-cargos', name: 'Cargo Pants', category: 'clothing', icon: '👖', price: 180, description: 'Extra pockets for product' },
  
  // Clothing - Shoes
  { id: 'gift-jordans', name: 'Jordan 4s', category: 'clothing', icon: '👟', price: 400, description: 'Fresh kicks, respect +3', statBoost: { stat: 'morale', value: 3 } },
  { id: 'gift-forces', name: 'Air Force 1s', category: 'clothing', icon: '👟', price: 200, description: 'Classic white forces' },
  { id: 'gift-timbs', name: 'Timberlands', category: 'clothing', icon: '🥾', price: 280, description: 'Heavy duty boots' },
  
  // Clothing - Outerwear
  { id: 'gift-puffer', name: 'North Face Puffer', category: 'clothing', icon: '🧥', price: 600, description: 'Stay warm on the block', statBoost: { stat: 'heatResistance', value: 5 } },
  { id: 'gift-trench', name: 'Trench Coat', category: 'clothing', icon: '🧥', price: 450, description: 'Conceal weapons better', statBoost: { stat: 'stealth', value: 5 } },
  
  // Weapons
  { id: 'gift-glock', name: 'Glock 19', category: 'weapons', icon: '🔫', price: 800, description: 'Reliable sidearm, +10 shooting', statBoost: { stat: 'shooting', value: 10 } },
  { id: 'gift-mac10', name: 'MAC-10', category: 'weapons', icon: '🔫', price: 1500, description: 'Spray and pray, +15 shooting', statBoost: { stat: 'shooting', value: 15 } },
  { id: 'gift-ak47', name: 'AK-47', category: 'weapons', icon: '🔫', price: 3000, description: 'Heavy firepower, +25 shooting', statBoost: { stat: 'shooting', value: 25 } },
  { id: 'gift-mossberg', name: 'Mossberg 500', category: 'weapons', icon: '🔫', price: 1200, description: 'Shotgun, devastating close range', statBoost: { stat: 'shooting', value: 20 } },
  { id: 'gift-knife', name: 'Switchblade', category: 'weapons', icon: '🔪', price: 100, description: 'Silent and deadly' },
  { id: 'gift-bat', name: 'Baseball Bat', category: 'weapons', icon: '🏏', price: 50, description: 'Blunt force' },
  
  // Armor
  { id: 'gift-vest-1', name: 'Light Vest', category: 'armor', icon: '🦺', price: 500, description: 'Basic protection, +10 armor' },
  { id: 'gift-vest-2', name: 'Kevlar Vest', category: 'armor', icon: '🛡️', price: 1500, description: 'Serious protection, +25 armor' },
  { id: 'gift-vest-3', name: 'Heavy Plate Carrier', category: 'armor', icon: '🛡️', price: 3500, description: 'Tank mode, +40 armor' },
  
  // Accessories
  { id: 'gift-chain', name: 'Gold Chain', category: 'accessories', icon: '📿', price: 1000, description: 'Respect on the block', statBoost: { stat: 'loyalty', value: 5 } },
  { id: 'gift-watch', name: 'Rolex Watch', category: 'accessories', icon: '⌚', price: 5000, description: 'Flex piece, morale +10', statBoost: { stat: 'morale', value: 10 } },
  { id: 'gift-shades', name: 'Designer Shades', category: 'accessories', icon: '🕶️', price: 300, description: 'Low profile look' },
  { id: 'gift-durag', name: 'Silk Durag', category: 'accessories', icon: '🧢', price: 50, description: 'Wave check' },
  { id: 'gift-bandana', name: 'Gang Bandana', category: 'accessories', icon: '🟥', price: 25, description: 'Rep the set', statBoost: { stat: 'loyalty', value: 2 } },
];

const RELATIONSHIP_ICONS: Record<string, string> = {
  family: '👨‍👩‍👦',
  friend: '🤝',
  romantic: '❤️',
  rival: '⚔️',
};

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

const ContactProfile: React.FC<ContactProfileProps> = ({ member, onClose, onUpdateMember }) => {
  const { player, updateMoney } = usePlayerStore();
  const { addNotification } = useNotificationStore();
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftCategory, setGiftCategory] = useState<GiftCategory>('clothing');
  
  const isDead = member.status === 'dead' || member.status === 'backdoored';
  const isJailed = member.status === 'jailed';
  
  const handleGift = useCallback((gift: GiftItem) => {
    if (player.money < gift.price) {
      addNotification({ type: 'warning', title: 'Not Enough Cash', message: `${gift.name} costs $${gift.price}. You have $${player.money.toLocaleString()}.`, priority: 'normal' });
      return;
    }
    
    updateMoney(-gift.price);
    
    const updates: Record<string, any> = {};
    
    // Apply stat boost
    if (gift.statBoost) {
      const currentVal = (member as any)[gift.statBoost.stat] || 0;
      updates[gift.statBoost.stat] = Math.min(100, currentVal + gift.statBoost.value);
    }
    
    // Add to inventory
    const currentInventory = member.inventory || [];
    updates.inventory = [...currentInventory, {
      id: `inv-${Date.now()}`,
      type: gift.category === 'weapons' ? 'weapon' : gift.category === 'armor' ? 'armor' : 'consumable',
      name: gift.name,
      quantity: 1,
      value: gift.price,
    }];
    
    // Update appearance if clothing
    if (gift.category === 'clothing' && member.appearance) {
      const app = { ...member.appearance };
      if (gift.name.includes('Hoodie') || gift.name.includes('Jersey') || gift.name.includes('Jacket') || gift.name.includes('Polo')) {
        app.top = gift.name;
      } else if (gift.name.includes('Jeans') || gift.name.includes('Fleece') || gift.name.includes('Cargo')) {
        app.bottom = gift.name;
      } else if (gift.name.includes('Jordan') || gift.name.includes('Force') || gift.name.includes('Timb')) {
        app.shoes = gift.name;
      } else if (gift.name.includes('Puffer') || gift.name.includes('Trench')) {
        app.outerwear = gift.name;
      }
      updates.appearance = app;
    }
    
    // Update armor if armor gift
    if (gift.category === 'armor') {
      const armorValues: Record<string, number> = { 'Light Vest': 10, 'Kevlar Vest': 25, 'Heavy Plate Carrier': 40 };
      updates.armor = armorValues[gift.name] || 10;
    }
    
    onUpdateMember(member.id, updates);
    
    addNotification({
      type: 'info',
      title: `Gift Given: ${gift.name}`,
      message: `${member.name} received ${gift.name}${gift.statBoost ? ` (+${gift.statBoost.value} ${gift.statBoost.stat})` : ''}`,
      priority: 'normal',
    });
    
    setShowGiftModal(false);
  }, [player.money, member, updateMoney, onUpdateMember, addNotification]);
  
  const filteredGifts = GIFT_CATALOG.filter(g => g.category === giftCategory);
  
  // Equipped items display
  const equippedWeapon = member.inventory?.find(i => i.type === 'weapon');
  const equippedArmor = member.inventory?.find(i => i.type === 'armor');
  const equippedClothing = member.inventory?.filter(i => i.type === 'consumable') || [];
  
  return (
    <div className="contact-profile">
      {/* Header */}
      <div className="profile-header">
        <button className="back-btn" onClick={onClose}>← Back</button>
        <span className="member-name-header">{member.name}</span>
        {!isDead && (
          <motion.button className="gift-btn" onClick={() => setShowGiftModal(true)} whileTap={{ scale: 0.95 }}>
            🎁 Gift
          </motion.button>
        )}
      </div>
      
      {/* Body */}
      <div className="profile-body">
        {/* Hero - Headshot + Full Body */}
        <div className="profile-hero">
          {member.customAvatarUrl && (
            <div className="profile-hero-bg" style={{ backgroundImage: `url(${member.customAvatarUrl})` }} />
          )}
          
          <div className="profile-hero-content">
            <div>
              <div className="headshot-frame">
                {member.headshotUrl || member.customAvatarUrl ? (
                  <img src={member.headshotUrl || member.customAvatarUrl} alt={member.name} />
                ) : (
                  <div className="headshot-placeholder">
                    {member.name.charAt(0)}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <div style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{member.name}</div>
                {member.nickname && <div style={{ color: '#888', fontSize: 11 }}>"{member.nickname}"</div>}
                <div style={{ color: '#ff4444', fontSize: 10, textTransform: 'uppercase' }}>{member.role} · LV{member.level}</div>
              </div>
            </div>
            
            <div className="fullbody-frame">
              {member.fullBodyUrl ? (
                <img src={member.fullBodyUrl} alt={`${member.name} full body`} />
              ) : (
                <div className="fullbody-placeholder">👤</div>
              )}
            </div>
          </div>
          
          {/* Status badge */}
          <div className={`profile-status-badge ${member.status}`}>
            {isDead ? '🕊️ R.I.P.' : isJailed ? '⛓️ LOCKED UP' : member.status === 'hospital' ? '🏥 HOSPITAL' : '✅ ACTIVE'}
          </div>
          
          {/* Death info */}
          {isDead && (
            <div className="death-overlay">
              <span className="dove-icon">🕊️</span>
              <span className="killed-by">
                {member.deathCause || 'Gone but not forgotten'}
                {member.killedBy && ` · Killed by ${member.killedBy}`}
              </span>
            </div>
          )}
        </div>
        
        {/* Core Stats */}
        <div className="profile-section">
          <h3>📊 Stats</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">🔫</div>
              <div className="stat-value">{member.shooting}</div>
              <div className="stat-label">Shooting</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">💊</div>
              <div className="stat-value">{member.dealing}</div>
              <div className="stat-label">Dealing</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🚗</div>
              <div className="stat-value">{member.driving}</div>
              <div className="stat-label">Driving</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">❤️</div>
              <div className="stat-value">{member.health}/{member.maxHealth}</div>
              <div className="stat-label">Health</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🛡️</div>
              <div className="stat-value">{member.armor}</div>
              <div className="stat-label">Armor</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🤫</div>
              <div className="stat-value">{member.stealth}</div>
              <div className="stat-label">Stealth</div>
            </div>
          </div>
          
          {/* Loyalty / Morale bars */}
          <div className="level-bar-container">
            <div className="level-bar-header">
              <span className="level-bar-label">Loyalty</span>
              <span className="level-bar-value">{member.loyalty}/100</span>
            </div>
            <div className="level-bar">
              <div className="level-bar-fill" style={{ width: `${member.loyalty}%`, background: member.loyalty > 60 ? '#44ff44' : member.loyalty > 30 ? '#ffaa00' : '#ff4444' }} />
            </div>
          </div>
          <div className="level-bar-container">
            <div className="level-bar-header">
              <span className="level-bar-label">Morale</span>
              <span className="level-bar-value">{member.morale}/100</span>
            </div>
            <div className="level-bar">
              <div className="level-bar-fill" style={{ width: `${member.morale}%`, background: member.morale > 60 ? '#44ff44' : member.morale > 30 ? '#ffaa00' : '#ff4444' }} />
            </div>
          </div>
          <div className="level-bar-container">
            <div className="level-bar-header">
              <span className="level-bar-label">XP to Next Level</span>
              <span className="level-bar-value">{member.xp || 0} / {member.level * 100}</span>
            </div>
            <div className="level-bar">
              <div className="level-bar-fill" style={{ width: `${((member.xp || 0) / (member.level * 100)) * 100}%` }} />
            </div>
          </div>
        </div>
        
        {/* Loadout */}
        <div className="profile-section">
          <h3>⚔️ Loadout</h3>
          <div className="loadout-grid">
            <div className={`loadout-slot ${equippedWeapon ? '' : 'empty'}`}>
              <div className="loadout-icon">{equippedWeapon ? '🔫' : '➕'}</div>
              <div className="loadout-info">
                <div className="loadout-name">{equippedWeapon?.name || 'No Weapon'}</div>
                <div className="loadout-detail">{equippedWeapon ? 'Equipped' : 'Gift a weapon'}</div>
              </div>
            </div>
            <div className={`loadout-slot ${equippedArmor ? '' : 'empty'}`}>
              <div className="loadout-icon">{equippedArmor ? '🛡️' : '➕'}</div>
              <div className="loadout-info">
                <div className="loadout-name">{equippedArmor?.name || 'No Armor'}</div>
                <div className="loadout-detail">{equippedArmor ? `+${member.armor} protection` : 'Gift armor'}</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Appearance / Clothing */}
        <div className="profile-section">
          <h3>👔 Appearance</h3>
          <div className="appearance-grid">
            <div className="appearance-item">
              <div className="item-icon">👕</div>
              <div className="item-name">{member.appearance?.top || 'Basic Tee'}</div>
              <div className="item-label">Top</div>
            </div>
            <div className="appearance-item">
              <div className="item-icon">👖</div>
              <div className="item-name">{member.appearance?.bottom || 'Jeans'}</div>
              <div className="item-label">Bottom</div>
            </div>
            <div className="appearance-item">
              <div className="item-icon">👟</div>
              <div className="item-name">{member.appearance?.shoes || 'Sneakers'}</div>
              <div className="item-label">Shoes</div>
            </div>
            {member.appearance?.outerwear && (
              <div className="appearance-item">
                <div className="item-icon">🧥</div>
                <div className="item-name">{member.appearance.outerwear}</div>
                <div className="item-label">Outerwear</div>
              </div>
            )}
            {(member.appearance?.jewelry || []).map((j, i) => (
              <div key={i} className="appearance-item">
                <div className="item-icon">💎</div>
                <div className="item-name">{j}</div>
                <div className="item-label">Jewelry</div>
              </div>
            ))}
          </div>
        </div>
        
        {/* History */}
        <div className="profile-section">
          <h3>📜 Record</h3>
          <div className="history-list">
            <div className="history-entry">
              <span className="history-label">Kills</span>
              <span className="history-value">{member.kills || 0}</span>
            </div>
            <div className="history-entry">
              <span className="history-label">Arrests</span>
              <span className="history-value">{member.arrests || 0}</span>
            </div>
            <div className="history-entry">
              <span className="history-label">Deals Completed</span>
              <span className="history-value">{member.dealsCompleted || 0}</span>
            </div>
            <div className="history-entry">
              <span className="history-label">Money Earned</span>
              <span className="history-value" style={{ color: '#44ff44' }}>${(member.moneyEarned || 0).toLocaleString()}</span>
            </div>
            <div className="history-entry">
              <span className="history-label">Heat Resistance</span>
              <span className="history-value">{member.heatResistance}</span>
            </div>
          </div>
        </div>
        
        {/* Connections */}
        {member.connections && member.connections.length > 0 && (
          <div className="profile-section">
            <h3>🤝 Connections</h3>
            <div className="connections-list">
              {member.connections.map(conn => (
                <div key={conn.id} className="connection-card">
                  <span className="connection-icon">{RELATIONSHIP_ICONS[conn.relationship] || '👤'}</span>
                  <div className="connection-info">
                    <div className="connection-name">{conn.name}</div>
                    <div className="connection-type">{conn.type} · {conn.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Backstory */}
        {member.backstory && (
          <div className="profile-section">
            <h3>📖 Backstory</h3>
            <div style={{ color: '#aaa', fontSize: 12, lineHeight: 1.6 }}>
              <p>{member.backstory.origin}</p>
              <p style={{ marginTop: 8 }}>{member.backstory.reason}</p>
              {member.backstory.struggles.length > 0 && (
                <p style={{ marginTop: 8, color: '#ff8888' }}>
                  Struggles: {member.backstory.struggles.join(', ')}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Gift Modal */}
      <AnimatePresence>
        {showGiftModal && (
          <motion.div
            className="gift-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowGiftModal(false)}
          >
            <motion.div
              className="gift-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h2>🎁 Gift to {member.name}</h2>
              <div className="gift-subtitle">
                Once given, items belong to them permanently. Balance: ${player.money.toLocaleString()}
              </div>
              
              <div className="gift-tabs">
                {(['clothing', 'weapons', 'armor', 'accessories'] as GiftCategory[]).map(cat => (
                  <button
                    key={cat}
                    className={`gift-tab ${giftCategory === cat ? 'active' : ''}`}
                    onClick={() => setGiftCategory(cat)}
                  >
                    {cat === 'clothing' ? '👔' : cat === 'weapons' ? '🔫' : cat === 'armor' ? '🛡️' : '💎'} {cat}
                  </button>
                ))}
              </div>
              
              <div className="gift-items">
                {filteredGifts.map(gift => (
                  <motion.div
                    key={gift.id}
                    className="gift-item"
                    onClick={() => handleGift(gift)}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="gift-item-icon">{gift.icon}</div>
                    <div className="gift-item-info">
                      <div className="gift-item-name">{gift.name}</div>
                      <div className="gift-item-desc">
                        {gift.description}
                        {gift.statBoost && <span style={{ color: '#44ff44' }}> (+{gift.statBoost.value} {gift.statBoost.stat})</span>}
                      </div>
                    </div>
                    <div className="gift-item-price">${gift.price}</div>
                  </motion.div>
                ))}
              </div>
              
              <button className="close-btn" onClick={() => setShowGiftModal(false)}>Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ContactProfile;
