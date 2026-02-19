// ============================================================
// OSShell - iOS-Style Desktop Interface for DEALT/SLIDE
// ============================================================

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigationStore, usePlayerStore, useNotificationStore } from '../../stores/gameStore';
import './OSShell.css';

interface AppIcon {
  id: string;
  label: string;
  icon: string;
  colorClass: string;
  available: boolean;
  badge?: number | string;
  description: string;
}

const formatMoney = (amount: number): string => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toLocaleString()}`;
};

const OSShell: React.FC = () => {
  const { navigateTo } = useNavigationStore();
  const { player } = usePlayerStore();
  const { getUnreadCount } = useNotificationStore();
  const [showNotifications, setShowNotifications] = useState(false);

  const appIcons: AppIcon[] = [
    {
      id: 'map',
      label: 'MAP',
      icon: '📍',
      colorClass: 'app-green',
      available: true,
      description: 'Territory Control',
    },
    {
      id: 'dealt',
      label: 'DEALT',
      icon: '💊',
      colorClass: 'app-purple',
      available: true,
      badge: '🔥',
      description: 'Drug Dealing',
    },
    {
      id: 'slide',
      label: 'SLIDE',
      icon: '🎯',
      colorClass: 'app-red',
      available: true,
      description: 'Grid Combat',
    },
    {
      id: 'driveby',
      label: 'DRIVE',
      icon: '🚗',
      colorClass: 'app-orange',
      available: true,
      description: 'Drive-By Shooter',
    },
    {
      id: 'alchemy',
      label: 'COOK',
      icon: '⚗️',
      colorClass: 'app-cyan',
      available: true,
      description: 'Drug Crafting',
    },
    {
      id: 'contacts',
      label: 'CREW',
      icon: '👥',
      colorClass: 'app-blue',
      available: true,
      description: 'Gang Management',
    },
    {
      id: 'shoebox',
      label: 'SHOEBOX',
      icon: '💰',
      colorClass: 'app-gold',
      available: true,
      description: 'Banking & Money',
    },
    {
      id: 'market',
      label: 'MARKET',
      icon: '🏪',
      colorClass: 'app-teal',
      available: true,
      description: 'Underworld Market',
    },
    {
      id: 'missions',
      label: 'OPS',
      icon: '📋',
      colorClass: 'app-brown',
      available: true,
      description: 'Missions & Ops',
    },
    {
      id: 'casino',
      label: 'CASINO',
      icon: '🎰',
      colorClass: 'app-pink',
      available: true,
      description: 'Gambling Games',
    },
    {
      id: 'phone',
      label: 'PHONE',
      icon: '📱',
      colorClass: 'app-gray',
      available: false,
      description: 'Coming Soon',
    },
    {
      id: 'settings',
      label: 'SETTINGS',
      icon: '⚙️',
      colorClass: 'app-dark',
      available: true,
      description: 'Game Settings',
    },
  ];

  const handleAppClick = (app: AppIcon) => {
    if (app.available) {
      navigateTo(app.id);
    }
  };

  const getHeatColor = (heat: number): string => {
    if (heat >= 80) return '#ff0000';
    if (heat >= 60) return '#ff4400';
    if (heat >= 40) return '#ff8800';
    if (heat >= 20) return '#ffcc00';
    return '#00ff00';
  };

  return (
    <div className="os-shell">
      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-left">
          <span className="time">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="status-center">
          <span className="gang-name">{player.gangName}</span>
        </div>
        <div className="status-right">
          <motion.div
            className="notification-icon"
            onClick={() => setShowNotifications(!showNotifications)}
            whileTap={{ scale: 0.9 }}
          >
            🔔
            {getUnreadCount() > 0 && (
              <span className="notification-badge">{getUnreadCount()}</span>
            )}
          </motion.div>
        </div>
      </div>

      {/* Header */}
      <div className="home-header">
        <motion.h1
          className="home-title"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          DEALT/SLIDE
        </motion.h1>
        <p className="home-subtitle">STREET EMPIRE</p>
      </div>

      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat">
          <div className="stat-value money">{formatMoney(player.money)}</div>
          <div className="stat-label">Cash</div>
        </div>
        <div className="stat">
          <div
            className="stat-value heat"
            style={{ color: getHeatColor(player.heat) }}
          >
            {player.heat}%
          </div>
          <div className="stat-label">Heat</div>
        </div>
        <div className="stat">
          <div className="stat-value rep">{player.reputation}</div>
          <div className="stat-label">Rep</div>
        </div>
        <div className="stat">
          <div className="stat-value level">LV{player.level}</div>
          <div className="stat-label">Level</div>
        </div>
      </div>

      {/* XP Progress Bar */}
      <div className="xp-bar-container">
        <div
          className="xp-bar-fill"
          style={{ width: `${(player.xp / player.xpToNextLevel) * 100}%` }}
        />
        <span className="xp-text">
          {player.xp} / {player.xpToNextLevel} XP
        </span>
      </div>

      {/* App Grid */}
      <div className="app-grid">
        {appIcons.map((app, index) => (
          <motion.div
            key={app.id}
            className={`app-icon ${!app.available ? 'locked' : ''}`}
            onClick={() => handleAppClick(app)}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: index * 0.05,
              type: 'spring',
              stiffness: 260,
              damping: 20,
            }}
            whileHover={app.available ? { scale: 1.1 } : {}}
            whileTap={app.available ? { scale: 0.9 } : {}}
          >
            <div className={`icon-container ${app.colorClass}`}>
              <span className="icon-emoji">{app.icon}</span>
              {!app.available && <div className="lock-overlay">🔒</div>}
              {app.badge && <div className="app-badge">{app.badge}</div>}
            </div>
            <span className="icon-label">{app.label}</span>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions Dock */}
      <div className="dock">
        <motion.div
          className="dock-item"
          whileTap={{ scale: 0.9 }}
          onClick={() => navigateTo('dealt')}
        >
          💊
        </motion.div>
        <motion.div
          className="dock-item"
          whileTap={{ scale: 0.9 }}
          onClick={() => navigateTo('slide')}
        >
          🎯
        </motion.div>
        <motion.div
          className="dock-item"
          whileTap={{ scale: 0.9 }}
          onClick={() => navigateTo('contacts')}
        >
          👥
        </motion.div>
        <motion.div
          className="dock-item"
          whileTap={{ scale: 0.9 }}
          onClick={() => navigateTo('shoebox')}
        >
          💰
        </motion.div>
      </div>

      {/* Notification Panel */}
      <AnimatePresence>
        {showNotifications && (
          <motion.div
            className="notification-panel"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="notification-header">
              <h3>Notifications</h3>
              <button onClick={() => setShowNotifications(false)}>✕</button>
            </div>
            <div className="notification-list">
              <p className="no-notifications">No new notifications</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OSShell;
