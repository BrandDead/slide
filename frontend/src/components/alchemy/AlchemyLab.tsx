// ============================================================
// COOK LAB - Little Alchemy-Style Drug Crafting
// Players drag elements into the mixing area to discover recipes
// ============================================================

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigationStore, usePlayerStore } from '../../stores/gameStore';
import { ALL_RECIPES, findMatchingRecipe, attemptCraft, getRecipeHint } from '../../utils/alchemyEngine';
import type { BaseElement, CraftedDrug, AlchemyRecipe, CraftingResult } from '../../types/alchemy.types';
import './AlchemyLab.css';

// ============ ELEMENT DATA ============

interface ElementInfo {
  id: string;
  name: string;
  emoji: string;
  category: 'plant' | 'chemical' | 'tool' | 'drug';
  tier: number;
  description: string;
}

const BASE_ELEMENTS: ElementInfo[] = [
  // Plants
  { id: 'cannabis_plant', name: 'Cannabis', emoji: '🌿', category: 'plant', tier: 0, description: 'Raw cannabis plant' },
  { id: 'coca_leaf', name: 'Coca Leaf', emoji: '🍃', category: 'plant', tier: 0, description: 'South American coca leaves' },
  { id: 'poppy', name: 'Poppy', emoji: '🌺', category: 'plant', tier: 0, description: 'Opium poppy flowers' },
  { id: 'psilocybin_mushroom', name: 'Shroom', emoji: '🍄', category: 'plant', tier: 0, description: 'Psilocybin mushrooms' },
  { id: 'ergot_fungus', name: 'Ergot', emoji: '🦠', category: 'plant', tier: 0, description: 'Ergot fungus for LSD' },
  // Chemicals
  { id: 'baking_soda', name: 'Baking Soda', emoji: '🧂', category: 'chemical', tier: 0, description: 'Sodium bicarbonate' },
  { id: 'acetone', name: 'Acetone', emoji: '🧪', category: 'chemical', tier: 0, description: 'Industrial solvent' },
  { id: 'pseudoephedrine', name: 'Pseudo', emoji: '💊', category: 'chemical', tier: 0, description: 'Cold medicine precursor' },
  { id: 'lithium', name: 'Lithium', emoji: '⚡', category: 'chemical', tier: 0, description: 'Battery lithium strips' },
  { id: 'iodine', name: 'Iodine', emoji: '🟤', category: 'chemical', tier: 0, description: 'Tincture of iodine' },
  { id: 'red_phosphorus', name: 'Red Phos', emoji: '🔴', category: 'chemical', tier: 0, description: 'Match head phosphorus' },
  { id: 'ether', name: 'Ether', emoji: '💨', category: 'chemical', tier: 0, description: 'Diethyl ether' },
  { id: 'ammonia', name: 'Ammonia', emoji: '☁️', category: 'chemical', tier: 0, description: 'Ammonium hydroxide' },
  { id: 'lye', name: 'Lye', emoji: '⚗️', category: 'chemical', tier: 0, description: 'Sodium hydroxide' },
  { id: 'codeine_syrup', name: 'Codeine', emoji: '🍇', category: 'chemical', tier: 0, description: 'Prescription codeine syrup' },
  { id: 'mdma_precursor', name: 'MDMA Pre', emoji: '🔬', category: 'chemical', tier: 0, description: 'MDMA precursor chemical' },
  // Tools
  { id: 'heat', name: 'Heat', emoji: '🔥', category: 'tool', tier: 0, description: 'Apply heat to the mix' },
  { id: 'water', name: 'Water', emoji: '💧', category: 'tool', tier: 0, description: 'Distilled water' },
  { id: 'sprite', name: 'Sprite', emoji: '🥤', category: 'tool', tier: 0, description: 'Lemon-lime soda' },
  { id: 'jolly_rancher', name: 'Jolly R.', emoji: '🍬', category: 'tool', tier: 0, description: 'Jolly Rancher candy' },
];

const DRUG_ELEMENTS: ElementInfo[] = [
  { id: 'weed', name: 'Weed', emoji: '🌿', category: 'drug', tier: 1, description: 'Street cannabis' },
  { id: 'shrooms', name: 'Shrooms', emoji: '🍄', category: 'drug', tier: 1, description: 'Magic mushrooms' },
  { id: 'lean', name: 'Lean', emoji: '🟣', category: 'drug', tier: 1, description: 'Purple drank' },
  { id: 'coke', name: 'Cocaine', emoji: '❄️', category: 'drug', tier: 2, description: 'Powder cocaine' },
  { id: 'hash', name: 'Hash', emoji: '🟫', category: 'drug', tier: 2, description: 'Cannabis resin' },
  { id: 'pills', name: 'Pills', emoji: '💊', category: 'drug', tier: 2, description: 'Street pills' },
  { id: 'heroin', name: 'Heroin', emoji: '💉', category: 'drug', tier: 2, description: 'Processed opium' },
  { id: 'molly', name: 'Molly', emoji: '💎', category: 'drug', tier: 2, description: 'MDMA' },
  { id: 'crack', name: 'Crack', emoji: '🪨', category: 'drug', tier: 3, description: 'Freebase cocaine' },
  { id: 'meth', name: 'Meth', emoji: '🧊', category: 'drug', tier: 3, description: 'Methamphetamine' },
  { id: 'lsd', name: 'LSD', emoji: '🌈', category: 'drug', tier: 3, description: 'Acid tabs' },
  { id: 'double_cup', name: 'Dbl Cup', emoji: '🥤', category: 'drug', tier: 3, description: 'Extra-strength lean' },
  { id: 'edibles', name: 'Edibles', emoji: '🍪', category: 'drug', tier: 3, description: 'Cannabis edibles' },
  { id: 'crystal_meth', name: 'Crystal', emoji: '💠', category: 'drug', tier: 4, description: '99% pure meth' },
  { id: 'black_tar', name: 'Black Tar', emoji: '⬛', category: 'drug', tier: 4, description: 'Black tar heroin' },
  { id: 'blue_sky', name: 'Blue Sky', emoji: '🔵', category: 'drug', tier: 5, description: 'Legendary meth' },
  { id: 'china_white', name: 'China White', emoji: '⚪', category: 'drug', tier: 5, description: 'Deadliest heroin' },
  { id: 'pure_mdma', name: 'Pure MDMA', emoji: '💜', category: 'drug', tier: 5, description: 'Lab-grade MDMA' },
];

const TIER_COLORS: Record<number, string> = {
  0: '#888',
  1: '#4ade80',
  2: '#60a5fa',
  3: '#c084fc',
  4: '#f97316',
  5: '#ef4444',
};

const TIER_LABELS: Record<number, string> = {
  0: 'Base',
  1: 'Basic',
  2: 'Processed',
  3: 'Advanced',
  4: 'Super',
  5: 'Legendary',
};

// ============ COMPONENT ============

const AlchemyLab: React.FC = () => {
  const { goBack } = useNavigationStore();
  const { player, updateMoney, updateHeat, addXP } = usePlayerStore();

  // State
  const [discoveredRecipeIds, setDiscoveredRecipeIds] = useState<Set<string>>(
    new Set(ALL_RECIPES.filter(r => r.discovered).map(r => r.id))
  );
  const [unlockedDrugs, setUnlockedDrugs] = useState<Set<string>>(
    new Set(['weed', 'shrooms', 'lean'])
  );
  const [mixingArea, setMixingArea] = useState<{ element: string; amount: number }[]>([]);
  const [craftResult, setCraftResult] = useState<CraftingResult | null>(null);
  const [craftFailed, setCraftFailed] = useState(false);
  const [isCrafting, setIsCrafting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('plant');
  const [inventory, setInventory] = useState<Map<string, number>>(() => {
    const inv = new Map<string, number>();
    // Start with some base elements
    BASE_ELEMENTS.forEach(e => inv.set(e.id, 5));
    return inv;
  });
  const [showRecipeBook, setShowRecipeBook] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Get available elements for the current category
  const availableElements = useMemo(() => {
    if (selectedCategory === 'drug') {
      return DRUG_ELEMENTS.filter(e => unlockedDrugs.has(e.id));
    }
    return BASE_ELEMENTS.filter(e => e.category === selectedCategory);
  }, [selectedCategory, unlockedDrugs]);

  // Add element to mixing area
  const addToMix = useCallback((elementId: string) => {
    const currentAmount = inventory.get(elementId) ?? 0;
    if (currentAmount <= 0) {
      setNotification('Out of stock!');
      setTimeout(() => setNotification(null), 2000);
      return;
    }

    setMixingArea(prev => {
      const existing = prev.find(e => e.element === elementId);
      if (existing) {
        return prev.map(e => e.element === elementId ? { ...e, amount: e.amount + 1 } : e);
      }
      return [...prev, { element: elementId, amount: 1 }];
    });

    setInventory(prev => {
      const next = new Map(prev);
      next.set(elementId, (next.get(elementId) ?? 0) - 1);
      return next;
    });
  }, [inventory]);

  // Remove element from mixing area
  const removeFromMix = useCallback((elementId: string) => {
    const mixItem = mixingArea.find(e => e.element === elementId);
    if (!mixItem) return;

    if (mixItem.amount > 1) {
      setMixingArea(prev => prev.map(e => e.element === elementId ? { ...e, amount: e.amount - 1 } : e));
    } else {
      setMixingArea(prev => prev.filter(e => e.element !== elementId));
    }

    setInventory(prev => {
      const next = new Map(prev);
      next.set(elementId, (next.get(elementId) ?? 0) + 1);
      return next;
    });
  }, [mixingArea]);

  // Clear mixing area
  const clearMix = useCallback(() => {
    mixingArea.forEach(item => {
      setInventory(prev => {
        const next = new Map(prev);
        next.set(item.element, (next.get(item.element) ?? 0) + item.amount);
        return next;
      });
    });
    setMixingArea([]);
    setCraftResult(null);
    setCraftFailed(false);
  }, [mixingArea]);

  // Attempt to craft
  const tryCraft = useCallback(() => {
    if (mixingArea.length === 0 || isCrafting) return;

    setIsCrafting(true);
    setCraftResult(null);
    setCraftFailed(false);

    // Simulate crafting time
    setTimeout(() => {
      const recipe = findMatchingRecipe(mixingArea);

      if (!recipe) {
        setCraftFailed(true);
        setNotification('No recipe found! Ingredients wasted.');
        setMixingArea([]);
        setIsCrafting(false);
        setTimeout(() => setNotification(null), 3000);
        return;
      }

      // Discover recipe if new
      if (!discoveredRecipeIds.has(recipe.id)) {
        setDiscoveredRecipeIds(prev => new Set([...prev, recipe.id]));
        setNotification(`🔓 NEW RECIPE DISCOVERED: ${recipe.name}!`);
        addXP(100);
        setTimeout(() => setNotification(null), 4000);
      }

      // Attempt the craft
      const result = attemptCraft(recipe, 0);

      if (result) {
        setCraftResult(result);
        setUnlockedDrugs(prev => new Set([...prev, result.drug]));

        // Add crafted drug to inventory
        setInventory(prev => {
          const next = new Map(prev);
          next.set(result.drug, (next.get(result.drug) ?? 0) + result.quantity);
          return next;
        });

        // Apply heat
        updateHeat(recipe.heatGenerated);
        addXP(recipe.resultTier * 25);
      } else {
        setCraftFailed(true);
        setNotification('💥 Craft FAILED! Ingredients lost.');
        setTimeout(() => setNotification(null), 3000);
      }

      setMixingArea([]);
      setIsCrafting(false);
    }, 1500);
  }, [mixingArea, isCrafting, discoveredRecipeIds, addXP, updateHeat]);

  // Get element info by ID
  const getElementInfo = (id: string): ElementInfo | undefined => {
    return [...BASE_ELEMENTS, ...DRUG_ELEMENTS].find(e => e.id === id);
  };

  // Recipe book
  const discoveredRecipes = ALL_RECIPES.filter(r => discoveredRecipeIds.has(r.id));

  // ============ RENDER ============

  return (
    <div className="alchemy-lab">
      {/* Header */}
      <div className="alchemy-header">
        <motion.button className="back-button" onClick={goBack} whileTap={{ scale: 0.9 }}>← Back</motion.button>
        <div className="alchemy-title">
          <span className="title-icon">⚗️</span>
          <span className="title-text">COOK LAB</span>
        </div>
        <motion.button
          className="recipe-book-btn"
          onClick={() => setShowRecipeBook(!showRecipeBook)}
          whileTap={{ scale: 0.9 }}
        >
          📖 {discoveredRecipeIds.size}/{ALL_RECIPES.length}
        </motion.button>
      </div>

      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            className="alchemy-notification"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mixing Area */}
      <div className="mixing-area">
        <h3 className="section-title">🧫 MIXING TABLE</h3>
        <div className="mix-slots">
          {mixingArea.length === 0 ? (
            <div className="mix-empty">Tap elements below to add them</div>
          ) : (
            mixingArea.map(item => {
              const info = getElementInfo(item.element);
              return (
                <motion.div
                  key={item.element}
                  className="mix-item"
                  onClick={() => removeFromMix(item.element)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.9 }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                >
                  <span className="mix-emoji">{info?.emoji || '?'}</span>
                  <span className="mix-name">{info?.name || item.element}</span>
                  {item.amount > 1 && <span className="mix-amount">x{item.amount}</span>}
                </motion.div>
              );
            })
          )}
        </div>

        <div className="mix-actions">
          <motion.button
            className="clear-btn"
            onClick={clearMix}
            whileTap={{ scale: 0.95 }}
            disabled={mixingArea.length === 0}
          >
            🗑️ Clear
          </motion.button>
          <motion.button
            className={`cook-btn ${isCrafting ? 'cooking' : ''}`}
            onClick={tryCraft}
            whileTap={{ scale: 0.95 }}
            disabled={mixingArea.length === 0 || isCrafting}
          >
            {isCrafting ? '🔥 COOKING...' : '🧪 COOK'}
          </motion.button>
        </div>
      </div>

      {/* Craft Result */}
      <AnimatePresence>
        {craftResult && (
          <motion.div
            className="craft-result success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <div className="result-header">
              <span className="result-emoji">{getElementInfo(craftResult.drug)?.emoji || '💊'}</span>
              <div>
                <h4>{getElementInfo(craftResult.drug)?.name || craftResult.drug}</h4>
                <span className="result-tier" style={{ color: TIER_COLORS[craftResult.tier] }}>
                  {TIER_LABELS[craftResult.tier]} (Tier {craftResult.tier})
                </span>
              </div>
            </div>
            <div className="result-stats">
              <div className="stat">
                <span className="stat-label">Purity</span>
                <div className="stat-bar">
                  <div className="stat-fill purity" style={{ width: `${craftResult.purity}%` }} />
                </div>
                <span className="stat-value">{craftResult.purity}%</span>
              </div>
              <div className="stat">
                <span className="stat-label">Potency</span>
                <div className="stat-bar">
                  <div className="stat-fill potency" style={{ width: `${craftResult.potency}%` }} />
                </div>
                <span className="stat-value">{craftResult.potency}%</span>
              </div>
              {craftResult.odRisk > 0 && (
                <div className="stat">
                  <span className="stat-label">OD Risk</span>
                  <div className="stat-bar">
                    <div className="stat-fill danger" style={{ width: `${craftResult.odRisk}%` }} />
                  </div>
                  <span className="stat-value">{craftResult.odRisk}%</span>
                </div>
              )}
            </div>
            <div className="result-price">
              💰 Price: ${Math.round(craftResult.priceMultiplier * 100)}/unit
              {craftResult.isSuperDrug && <span className="super-badge">⚠️ SUPER DRUG</span>}
            </div>
          </motion.div>
        )}
        {craftFailed && !craftResult && (
          <motion.div
            className="craft-result failed"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <span className="fail-icon">💥</span>
            <h4>CRAFT FAILED</h4>
            <p>Ingredients wasted. Try again.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category Tabs */}
      <div className="category-tabs">
        {[
          { id: 'plant', label: '🌿 Plants', count: BASE_ELEMENTS.filter(e => e.category === 'plant').length },
          { id: 'chemical', label: '🧪 Chems', count: BASE_ELEMENTS.filter(e => e.category === 'chemical').length },
          { id: 'tool', label: '🔧 Tools', count: BASE_ELEMENTS.filter(e => e.category === 'tool').length },
          { id: 'drug', label: '💊 Drugs', count: [...unlockedDrugs].length },
        ].map(cat => (
          <motion.button
            key={cat.id}
            className={`cat-tab ${selectedCategory === cat.id ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat.id)}
            whileTap={{ scale: 0.95 }}
          >
            {cat.label}
            <span className="cat-count">{cat.count}</span>
          </motion.button>
        ))}
      </div>

      {/* Element Grid */}
      <div className="element-grid">
        {availableElements.map(element => {
          const count = inventory.get(element.id) ?? 0;
          return (
            <motion.div
              key={element.id}
              className={`element-card ${count <= 0 ? 'empty' : ''}`}
              onClick={() => count > 0 && addToMix(element.id)}
              whileHover={count > 0 ? { scale: 1.05 } : {}}
              whileTap={count > 0 ? { scale: 0.9 } : {}}
            >
              <span className="element-emoji">{element.emoji}</span>
              <span className="element-name">{element.name}</span>
              <span className="element-count" style={{ color: TIER_COLORS[element.tier] }}>
                {count > 0 ? `x${count}` : 'Empty'}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Recipe Book Overlay */}
      <AnimatePresence>
        {showRecipeBook && (
          <motion.div
            className="recipe-book-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="recipe-book"
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
            >
              <div className="recipe-book-header">
                <h3>📖 Recipe Book</h3>
                <motion.button onClick={() => setShowRecipeBook(false)} whileTap={{ scale: 0.9 }}>✕</motion.button>
              </div>
              <div className="recipe-list">
                {ALL_RECIPES.map(recipe => {
                  const isDiscovered = discoveredRecipeIds.has(recipe.id);
                  return (
                    <div key={recipe.id} className={`recipe-item ${isDiscovered ? 'discovered' : 'locked'}`}>
                      <div className="recipe-info">
                        <span className="recipe-emoji">
                          {isDiscovered ? (getElementInfo(recipe.result)?.emoji || '?') : '❓'}
                        </span>
                        <div>
                          <h4>{isDiscovered ? recipe.name : '???'}</h4>
                          <span className="recipe-tier" style={{ color: TIER_COLORS[recipe.resultTier] }}>
                            Tier {recipe.resultTier} — {TIER_LABELS[recipe.resultTier]}
                          </span>
                        </div>
                      </div>
                      {isDiscovered && (
                        <div className="recipe-ingredients">
                          {recipe.ingredients.map((ing, i) => (
                            <span key={i} className="recipe-ing">
                              {getElementInfo(ing.element as string)?.emoji || '?'} x{ing.amount}
                            </span>
                          ))}
                        </div>
                      )}
                      {!isDiscovered && (
                        <div className="recipe-hint">{getRecipeHint(recipe)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AlchemyLab;
