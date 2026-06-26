// ============================================================
// OSShell - iOS-Style Desktop Interface for DEALT/SLIDE
// Live Dashboard: Heat meter, Morale indicator, Income ticker
// ============================================================

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useNavigationStore,
  usePlayerStore,
  useGangStore,
  useNotificationStore,
} from '../../stores/gameStore';
import { getRaidProbability } from '../../utils/heatSystem';
import { getMoraleDescription } from '../../utils/moraleSystem';
import { GameSprite } from '../common/GameSprite';
import '../common/GameSprite.css';
import './OSShell.css';

interface AppIcon {
  id: string;
  label: string;
  icon: string;
  spriteIcon?: string; // GameSprite icon key
  colorClass: string;
  available: boolean;
  badge?: number | string;
  description: string;
}

interface OSShellProps {
  gangMorale?: number;
  incomePerMinute?: number;
}

const formatMoney = (amount: number): string => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toLocaleString()}`;
};

const OSShell: React.FC<OSShellProps> = ({ gangMorale = 75, incomePerMinute = 0 }) => {
  const { navigateTo } = useNavigationStore();
  const { player } = usePlayerStore();
  const { members } = useGangStore();
  const { getUnreadCount, notifications, markAllAsRead } = useNotificationStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHeatDetail, setShowHeatDetail] = useState(false);
  const [showMoraleDetail, setShowMoraleDetail] = useState(false);

  // Calculate alert badges
  const jailedCount = members.filter((m) => m.status === 'jailed').length;
  const hospitalCount = members.filter((m) => m.status === 'hospital').length;
  const crewAlerts = jailedCount + hospitalCount;

  const raidProb = useMemo(() => getRaidProbability(player.heat), [player.heat]);
  const moraleDesc = useMemo(() => getMoraleDescription(gangMorale), [gangMorale]);

  const appIcons: AppIcon[] = [
    {
      id: 'map',
      label: 'MAP',
      icon: '📍',
      spriteIcon: 'map',
      colorClass: 'app-green',
      available: true,
      description: 'Territory Control',
    },
    {
      id: 'dealt_v2',
      label: 'DEALT',
      icon: '💊',
      spriteIcon: 'dealt',
      colorClass: 'app-purple',
      available: true,
      badge: '🔥',
      description: 'Drug Dealing',
    },
    {
      id: 'slide',
      label: 'SLIDE',
      icon: '🎯',
      spriteIcon: 'slide',
      colorClass: 'app-red',
      available: true,
      description: 'Grid Combat',
    },
    {
      id: 'driveby',
      label: 'DRIVE',
      icon: '🚗',
      spriteIcon: 'driveby',
      colorClass: 'app-orange',
      available: true,
      description: 'Drive-By Shooter',
    },
    {
      id: 'alchemy',
      label: 'COOK',
      icon: '⚗️',
      spriteIcon: 'cook',
      colorClass: 'app-cyan',
      available: true,
      description: 'Drug Crafting',
    },
    {
      id: 'contacts',
      label: 'CREW',
      icon: '👥',
      spriteIcon: 'crew',
      colorClass: 'app-blue',
      available: true,
      badge: crewAlerts > 0 ? crewAlerts : undefined,
      description: 'Gang Management',
    },
    {
      id: 'shoebox',
      label: 'SHOEBOX',
      icon: '💰',
      spriteIcon: 'shoebox',
      colorClass: 'app-gold',
      available: true,
      description: 'Banking & Money',
    },
    {
      id: 'market',
      label: 'MARKET',
      icon: '🏪',
      spriteIcon: 'market',
      colorClass: 'app-teal',
      available: true,
      description: 'Underworld Market',
    },
    {
      id: 'missions',
      label: 'OPS',
      icon: '📋',
      spriteIcon: 'ops',
      colorClass: 'app-brown',
      available: true,
      description: 'Missions & Ops',
    },
    {
      id: 'casino',
      label: 'CASINO',
      icon: '🎰',
      spriteIcon: 'casino',
      colorClass: 'app-pink',
      available: true,
      description: 'Gambling Games',
    },
    {
      id: 'topdown',
      label: 'ATTACK',
      icon: '🔫',
      colorClass: 'app-red',
      available: true,
      description: 'Block Attack',
    },
    {
      id: 'graffiti',
      label: 'VANDALIZE',
      icon: '🎨',
      spriteIcon: 'graffiti',
      colorClass: 'app-orange',
      available: true,
      description: 'Tag Opp Blocks',
    },
    {
      id: 'leaderboard',
      label: 'RANKINGS',
      icon: '🏆',
      colorClass: 'app-gold',
      available: true,
      description: 'Global Leaderboard',
    },
    {
      id: 'news',
      label: 'LOCAL NEWS',
      icon: '📰',
      colorClass: 'app-red',
      available: true,
      description: 'Weekly Update',
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
      spriteIcon: 'settings',
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
    if (heat >= 85) return '#ff0000';
    if (heat >= 65) return '#ff4400';
    if (heat >= 40) return '#ff8800';
    if (heat >= 20) return '#ffcc00';
    return '#00ff88';
  };

  const getHeatBarClass = (heat: number): string => {
    if (heat >= 85) return 'heat-bar-critical';
    if (heat >= 65) return 'heat-bar-high';
    if (heat >= 40) return 'heat-bar-medium';
    return 'heat-bar-low';
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

      {/* Live Stats Dashboard */}
      <div className="stats-dashboard">
        {/* Cash + Income */}
        <div className="stat-card stat-cash">
          <div className="stat-value money">{formatMoney(player.money)}</div>
          <div className="stat-label">Cash</div>
          {incomePerMinute > 0 && (
            <div className="income-ticker">+${incomePerMinute}/min</div>
          )}
        </div>

        {/* Heat Meter */}
        <div
          className="stat-card stat-heat"
          onClick={() => setShowHeatDetail(!showHeatDetail)}
        >
          <div
            className="stat-value heat"
            style={{ color: getHeatColor(player.heat) }}
          >
            {player.heat}%
          </div>
          <div className="stat-label">Heat</div>
          <div className={`heat-bar ${getHeatBarClass(player.heat)}`}>
            <div
              className="heat-bar-fill"
              style={{ width: `${player.heat}%` }}
            />
          </div>
          {raidProb > 0 && (
            <div className="raid-probability">
              🚨 {Math.round(raidProb * 100)}% raid
            </div>
          )}
        </div>

        {/* Morale */}
        <div
          className="stat-card stat-morale"
          onClick={() => setShowMoraleDetail(!showMoraleDetail)}
        >
          <div className="stat-value" style={{ color: moraleDesc.color }}>
            {gangMorale}
          </div>
          <div className="stat-label">Morale</div>
          <div className="morale-label" style={{ color: moraleDesc.color }}>
            {moraleDesc.label}
          </div>
        </div>

        {/* Level */}
        <div className="stat-card stat-level">
          <div className="stat-value level">LV{player.level}</div>
          <div className="stat-label">Level</div>
        </div>
      </div>

      {/* Heat Detail Popup */}
      <AnimatePresence>
        {showHeatDetail && (
          <motion.div
            className="detail-popup heat-detail"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="detail-row">
              <span>Current Heat</span>
              <span style={{ color: getHeatColor(player.heat) }}>{player.heat}/100</span>
            </div>
            <div className="detail-row">
              <span>Raid Probability</span>
              <span>{Math.round(raidProb * 100)}%</span>
            </div>
            <div className="detail-row">
              <span>Decay Rate</span>
              <span>-2/hour</span>
            </div>
            <div className="detail-row">
              <span>Raid Severity</span>
              <span>
                {player.heat < 40 ? 'None' : player.heat < 65 ? 'Minor' : player.heat < 85 ? 'Major' : 'Federal'}
              </span>
            </div>
            <button className="detail-close" onClick={() => setShowHeatDetail(false)}>Close</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Morale Detail Popup */}
      <AnimatePresence>
        {showMoraleDetail && (
          <motion.div
            className="detail-popup morale-detail"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="detail-row">
              <span>Gang Morale</span>
              <span style={{ color: moraleDesc.color }}>{gangMorale}/100</span>
            </div>
            <div className="detail-row">
              <span>Status</span>
              <span style={{ color: moraleDesc.color }}>{moraleDesc.label}</span>
            </div>
            {moraleDesc.warning && (
              <div className="detail-warning">{moraleDesc.warning}</div>
            )}
            <div className="detail-row">
              <span>Jailed Members</span>
              <span>{jailedCount}</span>
            </div>
            <div className="detail-row">
              <span>Wounded Members</span>
              <span>{hospitalCount}</span>
            </div>
            <button className="detail-close" onClick={() => setShowMoraleDetail(false)}>Close</button>
          </motion.div>
        )}
      </AnimatePresence>

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
              {app.spriteIcon ? (
                <GameSprite icon={app.spriteIcon as any} size={52} fallback={app.icon} />
              ) : (
                <span className="icon-emoji">{app.icon}</span>
              )}
              {!app.available && <div className="lock-overlay">🔒</div>}
              {app.badge && (
                <div className={`app-badge ${typeof app.badge === 'number' ? 'app-badge-number' : ''}`}>
                  {app.badge}
                </div>
              )}
            </div>
            <span className="icon-label">{app.label}</span>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions Dock */}
      <div className="dock">
        <motion.div className="dock-item" whileTap={{ scale: 0.9 }} onClick={() => navigateTo('dealt_v2')}>
          💊
        </motion.div>
        <motion.div className="dock-item" whileTap={{ scale: 0.9 }} onClick={() => navigateTo('slide')}>
          🎯
        </motion.div>
        <motion.div className="dock-item" whileTap={{ scale: 0.9 }} onClick={() => navigateTo('contacts')}>
          👥
        </motion.div>
        <motion.div className="dock-item" whileTap={{ scale: 0.9 }} onClick={() => navigateTo('shoebox')}>
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
              <div className="notification-actions">
                {notifications.length > 0 && (
                  <button className="mark-read-btn" onClick={() => markAllAsRead()}>
                    Mark All Read
                  </button>
                )}
                <button onClick={() => setShowNotifications(false)}>✕</button>
              </div>
            </div>
            <div className="notification-list">
              {notifications.length === 0 ? (
                <p className="no-notifications">No notifications</p>
              ) : (
                notifications.slice(0, 20).map((n) => (
                  <div
                    key={n.id}
                    className={`notification-item ${n.read ? 'read' : 'unread'} notif-${n.type}`}
                  >
                    <div className="notif-title">{n.title}</div>
                    <div className="notif-message">{n.message}</div>
                    <div className="notif-time">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OSShell;
