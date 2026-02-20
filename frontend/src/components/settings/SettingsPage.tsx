// ============================================================
// Settings - Game Settings & Gang Identity Management
// ============================================================
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useNavigationStore,
  usePlayerStore,
  useGangStore,
  useEconomyStore,
  useDealtStore,
} from '../../stores/gameStore';
import './Settings.css';

const SettingsPage: React.FC = () => {
  const { goBack } = useNavigationStore();
  const { player, updatePlayer, logout } = usePlayerStore();
  const gangStore = useGangStore();

  const [gangName, setGangName] = useState(player.gangName);
  const [gangColor, setGangColor] = useState(player.gangColor);
  const [showResetModal, setShowResetModal] = useState(false);
  const [saved, setSaved] = useState(false);

  const [settings, setSettings] = useState({
    sound: player.settings?.sound ?? true,
    notifications: player.settings?.notifications ?? true,
    haptics: player.settings?.haptics ?? true,
    autoSave: player.settings?.autoSave ?? true,
    darkMode: player.settings?.darkMode ?? true,
  });

  const handleSaveGang = () => {
    updatePlayer({ gangName, gangColor });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleToggle = (key: keyof typeof settings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    updatePlayer({ settings: newSettings });
  };

  const handleReset = () => {
    logout();
    const storeKeys = [
      'dealt-slide-player',
      'dealt-slide-dealt',
      'dealt-slide-gang',
      'dealt-slide-territory',
      'dealt-slide-economy',
      'dealt-slide-notifications',
      'dealt-slide-selfies',
    ];
    storeKeys.forEach((key) => localStorage.removeItem(key));
    setShowResetModal(false);
    window.location.reload();
  };

  const activeMembers = gangStore.members?.filter((m: any) => m.status === 'active')?.length || 0;
  const totalMembers = gangStore.members?.length || 0;

  return (
    <div className="settings-container">
      {/* Header */}
      <div className="settings-header">
        <motion.button className="back-btn" onClick={goBack} whileTap={{ scale: 0.9 }}>
          \u2190 Back
        </motion.button>
        <h1>\u2699\uFE0F SETTINGS</h1>
        <div style={{ width: 60 }} />
      </div>

      {/* Gang Identity */}
      <div className="settings-section">
        <h2>Gang Identity</h2>
        <div className="setting-row">
          <label>Gang Name</label>
          <input
            type="text"
            className="gang-name-input"
            value={gangName}
            onChange={(e) => setGangName(e.target.value)}
            maxLength={20}
          />
        </div>
        <div className="setting-row">
          <label>Gang Color</label>
          <div className="color-picker-row">
            <input
              type="color"
              className="color-picker"
              value={gangColor}
              onChange={(e) => setGangColor(e.target.value)}
            />
            <div className="color-preview" style={{ background: gangColor }}>
              {gangName}
            </div>
          </div>
        </div>
        <div className="preset-colors">
          {['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777'].map((c) => (
            <button
              key={c}
              className={`preset-color ${gangColor === c ? 'active' : ''}`}
              style={{ background: c }}
              onClick={() => setGangColor(c)}
            />
          ))}
        </div>
        <motion.button
          className="save-gang-btn"
          onClick={handleSaveGang}
          whileTap={{ scale: 0.95 }}
        >
          {saved ? '\u2705 Saved!' : 'Save Changes'}
        </motion.button>
      </div>

      {/* Game Settings */}
      <div className="settings-section">
        <h2>Game Settings</h2>
        {Object.entries(settings).map(([key, value]) => {
          const labels: Record<string, string> = {
            sound: '\uD83D\uDD0A Sound Effects',
            notifications: '\uD83D\uDD14 Notifications',
            haptics: '\uD83D\uDCF3 Haptic Feedback',
            autoSave: '\uD83D\uDCBE Auto Save',
            darkMode: '\uD83C\uDF19 Dark Mode',
          };
          return (
            <div key={key} className="toggle-row">
              <span className="toggle-label">{labels[key] || key}</span>
              <button
                className={`toggle-switch ${value ? 'on' : 'off'}`}
                onClick={() => handleToggle(key as keyof typeof settings)}
              >
                <div className="toggle-thumb" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Player Stats */}
      <div className="settings-section">
        <h2>Player Stats</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-val">{player.level}</div>
            <div className="stat-lbl">Level</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">${player.money.toLocaleString()}</div>
            <div className="stat-lbl">Cash</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">${player.bankBalance.toLocaleString()}</div>
            <div className="stat-lbl">Bank</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{player.heat}</div>
            <div className="stat-lbl">Heat</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{player.reputation}</div>
            <div className="stat-lbl">Rep</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{activeMembers}/{totalMembers}</div>
            <div className="stat-lbl">Crew</div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="settings-section danger-zone">
        <h2>Danger Zone</h2>
        <p className="danger-desc">This will permanently erase all game progress.</p>
        <motion.button
          className="reset-btn"
          onClick={() => setShowResetModal(true)}
          whileTap={{ scale: 0.95 }}
        >
          \uD83D\uDDD1\uFE0F Reset All Game Data
        </motion.button>
      </div>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowResetModal(false)}
          >
            <motion.div
              className="modal-content reset-modal"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="reset-icon">\u26A0\uFE0F</div>
              <h3>Reset Game Data?</h3>
              <p>This will delete ALL your progress including:</p>
              <ul>
                <li>Cash & bank balance</li>
                <li>Gang members & contacts</li>
                <li>Territory & blocks</li>
                <li>Inventory & drugs</li>
                <li>Combat history</li>
              </ul>
              <p className="reset-warning">This action cannot be undone.</p>
              <motion.button
                className="confirm-reset-btn"
                onClick={handleReset}
                whileTap={{ scale: 0.95 }}
              >
                Yes, Reset Everything
              </motion.button>
              <button className="cancel-btn" onClick={() => setShowResetModal(false)}>
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SettingsPage;
