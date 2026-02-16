# REAL-TIME MULTIPLAYER COMPLETION - DEALT/SLIDE
## Continuation of gpt-oss:120b-cloud output

The AI froze while generating. Here's the completion based on the partial output:

---

## 6. useNotifications.ts hook (COMPLETION)

```typescript
// src/hooks/useNotifications.ts
import { useState, useEffect, useCallback } from 'react';
import realtimeService, { Notification } from '../services/realtimeService';
import { supabase } from '../services/supabase';

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  refetch: () => Promise<void>;
}

export const useNotifications = (userId: string): UseNotificationsReturn => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = realtimeService.subscribeToNotifications((payload) => {
      if (payload.new.user_id === userId) {
        setNotifications(prev => [payload.new, ...prev]);
      }
    });

    return () => unsubscribe();
  }, [userId]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    await realtimeService.markNotificationAsRead(id);
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = async () => {
    await realtimeService.markAllNotificationsAsRead(userId);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const dismissNotification = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ is_dismissed: true })
      .eq('id', id);
    
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = async () => {
    await supabase
      .from('notifications')
      .update({ is_dismissed: true })
      .eq('user_id', userId);
    
    setNotifications([]);
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAll,
    refetch: fetchNotifications,
  };
};
```

---

## 7. NotificationCenter.tsx (Full Component)

```typescript
// src/components/realtime/NotificationCenter.tsx
import React, { useState } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { Notification } from '../../services/realtimeService';
import { motion, AnimatePresence } from 'framer-motion';

interface NotificationCenterProps {
  userId: string;
  onNotificationClick?: (notification: Notification) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  userId,
  onNotificationClick
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    dismissNotification
  } = useNotifications(userId);

  const getNotificationIcon = (type: string) => {
    const icons: Record<string, string> = {
      'attack_incoming': '⚔️',
      'attack_result': '🏆',
      'block_income': '💰',
      'member_event': '👤',
      'mission_complete': '🎯',
      'level_up': '⬆️',
      'territory': '🏰',
      'combat': '💥',
      'system': '⚙️',
      'message': '💬',
    };
    return icons[type] || '🔔';
  };

  const getNotificationColor = (type: string) => {
    const colors: Record<string, string> = {
      'attack_incoming': '#FF4444',
      'attack_result': '#00FF88',
      'block_income': '#FFD700',
      'member_event': '#00D4FF',
      'mission_complete': '#00FF88',
      'level_up': '#FF00FF',
      'territory': '#00D4FF',
      'combat': '#FF4444',
    };
    return colors[type] || '#888888';
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    onNotificationClick?.(notification);
  };

  return (
    <div className="notification-center">
      {/* Bell Button */}
      <button
        className="notification-bell"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="bell-icon">🔔</span>
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="notification-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              className="notification-dropdown"
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              {/* Header */}
              <div className="notification-header">
                <h3>Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    className="mark-all-read"
                    onClick={markAllAsRead}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* List */}
              <div className="notification-list">
                {isLoading ? (
                  <div className="notification-loading">
                    <div className="spinner" />
                    <span>Loading...</span>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="notification-empty">
                    <span className="empty-icon">📭</span>
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      className={`notification-item ${!notification.read ? 'unread' : ''}`}
                      onClick={() => handleNotificationClick(notification)}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                    >
                      <div
                        className="notification-icon"
                        style={{ backgroundColor: `${getNotificationColor(notification.type)}20` }}
                      >
                        <span>{getNotificationIcon(notification.type)}</span>
                      </div>
                      <div className="notification-content">
                        <div className="notification-title">
                          {notification.title}
                          {!notification.read && <span className="unread-dot" />}
                        </div>
                        <div className="notification-message">
                          {notification.message}
                        </div>
                        <div className="notification-time">
                          {formatTime(notification.created_at)}
                        </div>
                      </div>
                      <button
                        className="notification-dismiss"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissNotification(notification.id);
                        }}
                      >
                        ×
                      </button>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="notification-footer">
                  <button onClick={() => {/* Navigate to all notifications */}}>
                    View all notifications
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style jsx>{`
        .notification-center {
          position: relative;
        }

        .notification-bell {
          position: relative;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 12px;
          padding: 10px 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .notification-bell:hover {
          background: rgba(255, 255, 255, 0.15);
          transform: scale(1.05);
        }

        .bell-icon {
          font-size: 20px;
        }

        .notification-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: linear-gradient(135deg, #FF4444, #FF0066);
          color: white;
          font-size: 11px;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 10px;
          min-width: 18px;
          text-align: center;
          box-shadow: 0 2px 8px rgba(255, 68, 68, 0.4);
        }

        .notification-backdrop {
          position: fixed;
          inset: 0;
          z-index: 40;
        }

        .notification-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 380px;
          max-height: 500px;
          background: rgba(26, 26, 26, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          overflow: hidden;
          z-index: 50;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .notification-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .notification-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: white;
        }

        .mark-all-read {
          background: none;
          border: none;
          color: #00D4FF;
          font-size: 13px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: background 0.2s;
        }

        .mark-all-read:hover {
          background: rgba(0, 212, 255, 0.1);
        }

        .notification-list {
          max-height: 380px;
          overflow-y: auto;
        }

        .notification-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 20px;
          cursor: pointer;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          transition: background 0.2s;
        }

        .notification-item.unread {
          background: rgba(0, 212, 255, 0.05);
        }

        .notification-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }

        .notification-content {
          flex: 1;
          min-width: 0;
        }

        .notification-title {
          font-size: 14px;
          font-weight: 600;
          color: white;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .unread-dot {
          width: 8px;
          height: 8px;
          background: #00D4FF;
          border-radius: 50%;
          box-shadow: 0 0 8px #00D4FF;
        }

        .notification-message {
          font-size: 13px;
          color: #888;
          margin-top: 4px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .notification-time {
          font-size: 11px;
          color: #666;
          margin-top: 6px;
        }

        .notification-dismiss {
          background: none;
          border: none;
          color: #666;
          font-size: 18px;
          cursor: pointer;
          padding: 4px;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .notification-item:hover .notification-dismiss {
          opacity: 1;
        }

        .notification-dismiss:hover {
          color: #FF4444;
        }

        .notification-loading,
        .notification-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          color: #888;
        }

        .empty-icon {
          font-size: 40px;
          margin-bottom: 12px;
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-top-color: #00D4FF;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 12px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .notification-footer {
          padding: 12px 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          text-align: center;
        }

        .notification-footer button {
          background: none;
          border: none;
          color: #00D4FF;
          font-size: 13px;
          cursor: pointer;
        }

        .notification-footer button:hover {
          text-decoration: underline;
        }

        /* Scrollbar */
        .notification-list::-webkit-scrollbar {
          width: 6px;
        }

        .notification-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .notification-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
};

export default NotificationCenter;
```

---

## 8. ActivityIndicator Component

```typescript
// src/components/realtime/ActivityIndicator.tsx
import React from 'react';
import { PlayerPresence } from '../../services/realtimeService';

interface ActivityIndicatorProps {
  activity: PlayerPresence['activity'];
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const ActivityIndicator: React.FC<ActivityIndicatorProps> = ({
  activity,
  showLabel = false,
  size = 'md'
}) => {
  const config = {
    dealing: { icon: '💊', color: '#00FF88', label: 'Dealing' },
    combat: { icon: '⚔️', color: '#FF4444', label: 'In Combat' },
    crafting: { icon: '⚗️', color: '#00D4FF', label: 'Crafting' },
    idle: { icon: '💤', color: '#888888', label: 'Idle' },
  };

  const { icon, color, label } = config[activity] || config.idle;

  const sizes = {
    sm: { indicator: 8, icon: 12, text: 10 },
    md: { indicator: 12, icon: 16, text: 12 },
    lg: { indicator: 16, icon: 20, text: 14 },
  };

  const s = sizes[size];

  return (
    <div className="activity-indicator">
      <div 
        className="status-dot"
        style={{ 
          width: s.indicator, 
          height: s.indicator,
          backgroundColor: color,
          boxShadow: `0 0 ${s.indicator}px ${color}`,
        }}
      />
      {showLabel && (
        <span 
          className="activity-label"
          style={{ fontSize: s.text, color }}
        >
          <span style={{ fontSize: s.icon }}>{icon}</span> {label}
        </span>
      )}

      <style jsx>{`
        .activity-indicator {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .status-dot {
          border-radius: 50%;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.9); }
        }

        .activity-label {
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

export default ActivityIndicator;
```

---

## 9. CombatAlert Component

```typescript
// src/components/realtime/CombatAlert.tsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CombatAlertProps {
  attackerName: string;
  blockName: string;
  onRespond: () => void;
  onDismiss: () => void;
  timeLimit?: number; // seconds to respond
}

const CombatAlert: React.FC<CombatAlertProps> = ({
  attackerName,
  blockName,
  onRespond,
  onDismiss,
  timeLimit = 60
}) => {
  const [timeLeft, setTimeLeft] = useState(timeLimit);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          onDismiss();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onDismiss]);

  return (
    <motion.div
      className="combat-alert"
      initial={{ opacity: 0, scale: 0.8, y: -50 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -50 }}
    >
      <div className="alert-glow" />
      
      <div className="alert-content">
        <div className="alert-icon">⚔️</div>
        
        <div className="alert-text">
          <h3>INCOMING ATTACK!</h3>
          <p>
            <strong>{attackerName}</strong> is attacking your block
            <br />
            <span className="block-name">{blockName}</span>
          </p>
        </div>

        <div className="alert-timer">
          <svg viewBox="0 0 36 36" className="timer-svg">
            <path
              className="timer-bg"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="timer-progress"
              strokeDasharray={`${(timeLeft / timeLimit) * 100}, 100`}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span className="timer-text">{timeLeft}s</span>
        </div>
      </div>

      <div className="alert-actions">
        <button className="btn-respond" onClick={onRespond}>
          🛡️ DEFEND
        </button>
        <button className="btn-dismiss" onClick={onDismiss}>
          Ignore
        </button>
      </div>

      <style jsx>{`
        .combat-alert {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          width: 90%;
          max-width: 400px;
          background: linear-gradient(135deg, rgba(40, 0, 0, 0.95), rgba(60, 0, 0, 0.95));
          border: 2px solid #FF4444;
          border-radius: 16px;
          padding: 20px;
          z-index: 9999;
          box-shadow: 0 0 40px rgba(255, 68, 68, 0.4);
          overflow: hidden;
        }

        .alert-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, rgba(255, 68, 68, 0.2), transparent 70%);
          animation: pulseGlow 1s ease-in-out infinite;
        }

        @keyframes pulseGlow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .alert-content {
          display: flex;
          align-items: center;
          gap: 16px;
          position: relative;
          z-index: 1;
        }

        .alert-icon {
          font-size: 40px;
          animation: shake 0.5s ease-in-out infinite;
        }

        @keyframes shake {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }

        .alert-text {
          flex: 1;
        }

        .alert-text h3 {
          margin: 0;
          color: #FF4444;
          font-size: 18px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 2px;
        }

        .alert-text p {
          margin: 8px 0 0;
          color: white;
          font-size: 14px;
        }

        .block-name {
          color: #FFD700;
          font-weight: 600;
        }

        .alert-timer {
          position: relative;
          width: 50px;
          height: 50px;
        }

        .timer-svg {
          width: 100%;
          height: 100%;
          transform: rotate(-90deg);
        }

        .timer-bg {
          fill: none;
          stroke: rgba(255, 255, 255, 0.1);
          stroke-width: 3;
        }

        .timer-progress {
          fill: none;
          stroke: #FF4444;
          stroke-width: 3;
          stroke-linecap: round;
          transition: stroke-dasharray 1s linear;
        }

        .timer-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-size: 14px;
          font-weight: bold;
        }

        .alert-actions {
          display: flex;
          gap: 12px;
          margin-top: 16px;
          position: relative;
          z-index: 1;
        }

        .btn-respond {
          flex: 1;
          background: linear-gradient(135deg, #FF4444, #FF0066);
          border: none;
          color: white;
          padding: 14px;
          border-radius: 10px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .btn-respond:hover {
          transform: scale(1.02);
          box-shadow: 0 0 20px rgba(255, 68, 68, 0.5);
        }

        .btn-dismiss {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #888;
          padding: 14px 20px;
          border-radius: 10px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-dismiss:hover {
          background: rgba(255, 255, 255, 0.15);
          color: white;
        }
      `}</style>
    </motion.div>
  );
};

export default CombatAlert;
```

---

## INTEGRATION EXAMPLE

```typescript
// src/App.tsx - Integration example
import React from 'react';
import { usePresence } from './hooks/usePresence';
import { useRealtime } from './hooks/useRealtime';
import NotificationCenter from './components/realtime/NotificationCenter';
import OnlinePlayersIndicator from './components/realtime/OnlinePlayersIndicator';
import NotificationToast from './components/realtime/NotificationToast';
import CombatAlert from './components/realtime/CombatAlert';

const App: React.FC = () => {
  const userId = 'current-user-id'; // From auth
  const username = 'Player1';
  const position = { x: 0, y: 0 };
  const [currentActivity, setCurrentActivity] = useState<'idle' | 'dealing' | 'combat' | 'crafting'>('idle');
  const [showCombatAlert, setShowCombatAlert] = useState(false);
  const [attackData, setAttackData] = useState<any>(null);

  // Initialize presence
  const { onlinePlayers, allPlayers, isLoading: presenceLoading } = usePresence(
    userId,
    username,
    position,
    currentActivity
  );

  // Initialize realtime subscriptions
  const {
    blocks,
    notifications,
    unreadCount,
    combatEvents,
    markAsRead,
    markAllAsRead
  } = useRealtime(userId);

  // Handle combat events
  useEffect(() => {
    const incomingAttack = combatEvents.find(
      e => e.type === 'attack' && e.defender_id === userId && e.status === 'started'
    );
    
    if (incomingAttack) {
      setAttackData(incomingAttack);
      setShowCombatAlert(true);
    }
  }, [combatEvents, userId]);

  return (
    <div className="app">
      {/* Header with online players and notifications */}
      <header className="app-header">
        <OnlinePlayersIndicator 
          players={onlinePlayers} 
          currentPlayerId={userId} 
        />
        <NotificationCenter 
          userId={userId}
          onNotificationClick={(n) => {
            // Handle notification click - navigate to relevant screen
            console.log('Notification clicked:', n);
          }}
        />
      </header>

      {/* Toast notifications */}
      <NotificationToast 
        userId={userId}
        onNotificationClick={(n) => {
          // Handle toast click
          console.log('Toast clicked:', n);
        }}
      />

      {/* Combat alert */}
      <AnimatePresence>
        {showCombatAlert && attackData && (
          <CombatAlert
            attackerName={attackData.attacker_name}
            blockName={attackData.block_name}
            onRespond={() => {
              setShowCombatAlert(false);
              // Navigate to combat screen
              setCurrentActivity('combat');
            }}
            onDismiss={() => setShowCombatAlert(false)}
            timeLimit={60}
          />
        )}
      </AnimatePresence>

      {/* Main content */}
      <main>
        {/* Your game content */}
      </main>
    </div>
  );
};

export default App;
```

---

This completes the real-time multiplayer system. All components are ready to use.
