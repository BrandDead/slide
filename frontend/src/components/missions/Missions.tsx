// ============================================================
// Missions / Ops - Procedurally generated missions
// ============================================================
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigationStore, usePlayerStore, useEconomyStore } from '../../stores/gameStore';
import { generateMissions, Mission } from '../../utils/missionGenerator';
import './Missions.css';

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#00cc6a',
  medium: '#ffd700',
  hard: '#ff6600',
  suicide: '#ff0033',
};

const TYPE_ICONS: Record<string, string> = {
  attack: '⚔️',
  defend: '🛡️',
  delivery: '📦',
  supply_run: '⚗️',
  hit: '🎯',
  recruit: '👥',
};

const formatMoney = (n: number) => `$${n.toLocaleString()}`;

const Missions: React.FC = () => {
  const { goBack } = useNavigationStore();
  const { player, updateMoney, addXP, updatePlayer } = usePlayerStore();
  const { addTransaction } = useEconomyStore();

  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [missionResult, setMissionResult] = useState<'success' | 'fail' | null>(null);
  const [timer, setTimer] = useState(0);

  // Generate missions on mount
  useEffect(() => {
    if (missions.length === 0) {
      setMissions(generateMissions(5));
    }
  }, []);

  // Timer for active mission
  useEffect(() => {
    if (!activeMission || activeMission.timeLimit === 0) return;
    setTimer(activeMission.timeLimit);
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleMissionComplete(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeMission]);

  const handleStartMission = (mission: Mission) => {
    setActiveMission(mission);
    setSelectedMission(null);
    setMissions((prev) => prev.map((m) =>
      m.id === mission.id ? { ...m, status: 'active' as const } : m
    ));
  };

  const handleMissionComplete = (success: boolean) => {
    if (!activeMission) return;

    setMissionResult(success ? 'success' : 'fail');

    if (success) {
      updateMoney(activeMission.rewards.money);
      addXP(activeMission.rewards.xp);
      updatePlayer({ reputation: player.reputation + activeMission.rewards.reputation });
      addTransaction({
        id: Date.now().toString(),
        type: 'deal_income',
        userId: player.id,
        amount: activeMission.rewards.money,
        details: { description: `Mission completed: ${activeMission.title}` },
        createdAt: new Date().toISOString(),
      } as any);
    }

    setMissions((prev) => prev.map((m) =>
      m.id === activeMission.id
        ? { ...m, status: success ? 'completed' as const : 'failed' as const }
        : m
    ));

    setTimeout(() => {
      setActiveMission(null);
      setMissionResult(null);
    }, 2500);
  };

  const handleRefresh = () => {
    setMissions(generateMissions(5));
  };

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="missions-container">
      {/* Header */}
      <div className="missions-header">
        <motion.button className="back-btn" onClick={goBack} whileTap={{ scale: 0.9 }}>
          ← Back
        </motion.button>
        <h1>📋 OPS</h1>
        <motion.button className="refresh-btn" onClick={handleRefresh} whileTap={{ scale: 0.9 }}>
          🔄
        </motion.button>
      </div>

      {/* Active Mission Banner */}
      {activeMission && !missionResult && (
        <div className="active-mission-banner">
          <div className="active-info">
            <span className="active-icon">{TYPE_ICONS[activeMission.type]}</span>
            <div>
              <div className="active-title">{activeMission.title}</div>
              <div className="active-obj">{activeMission.objective}</div>
            </div>
          </div>
          {activeMission.timeLimit > 0 && (
            <div className={`active-timer ${timer < 60 ? 'urgent' : ''}`}>
              {formatTimer(timer)}
            </div>
          )}
          <div className="active-actions">
            <motion.button
              className="complete-btn"
              onClick={() => handleMissionComplete(true)}
              whileTap={{ scale: 0.95 }}
            >
              ✅ Complete
            </motion.button>
            <motion.button
              className="abort-btn"
              onClick={() => handleMissionComplete(false)}
              whileTap={{ scale: 0.95 }}
            >
              ❌ Abort
            </motion.button>
          </div>
        </div>
      )}

      {/* Mission Result */}
      <AnimatePresence>
        {missionResult && (
          <motion.div
            className={`mission-result-overlay ${missionResult}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <div className="result-icon">{missionResult === 'success' ? '🏆' : '💀'}</div>
            <div className="result-text">
              {missionResult === 'success' ? 'MISSION COMPLETE' : 'MISSION FAILED'}
            </div>
            {missionResult === 'success' && activeMission && (
              <div className="result-rewards">
                <span>+{formatMoney(activeMission.rewards.money)}</span>
                <span>+{activeMission.rewards.xp} XP</span>
                <span>+{activeMission.rewards.reputation} REP</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mission List */}
      <div className="mission-list">
        {missions.map((mission) => (
          <motion.div
            key={mission.id}
            className={`mission-card ${mission.status}`}
            onClick={() => mission.status === 'available' && setSelectedMission(mission)}
            whileTap={mission.status === 'available' ? { scale: 0.98 } : {}}
          >
            <div className="mission-card-left">
              <span className="mission-type-icon">{TYPE_ICONS[mission.type]}</span>
            </div>
            <div className="mission-card-center">
              <div className="mission-title">{mission.title}</div>
              <div className="mission-desc">{mission.description}</div>
              <div className="mission-rewards-row">
                <span className="reward-money">{formatMoney(mission.rewards.money)}</span>
                <span className="reward-xp">{mission.rewards.xp} XP</span>
                <span className="reward-rep">+{mission.rewards.reputation} REP</span>
              </div>
            </div>
            <div className="mission-card-right">
              <span
                className="difficulty-badge"
                style={{ color: DIFFICULTY_COLORS[mission.difficulty], borderColor: DIFFICULTY_COLORS[mission.difficulty] + '60' }}
              >
                {mission.difficulty.toUpperCase()}
              </span>
              {mission.status === 'completed' && <span className="status-badge completed">✅</span>}
              {mission.status === 'failed' && <span className="status-badge failed">❌</span>}
              {mission.status === 'active' && <span className="status-badge active">🔥</span>}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Mission Detail Modal */}
      <AnimatePresence>
        {selectedMission && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedMission(null)}
          >
            <motion.div
              className="modal-content mission-modal"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-mission-icon">{TYPE_ICONS[selectedMission.type]}</div>
              <h3>{selectedMission.title}</h3>
              <span
                className="modal-difficulty"
                style={{ color: DIFFICULTY_COLORS[selectedMission.difficulty] }}
              >
                {selectedMission.difficulty.toUpperCase()}
              </span>
              <p className="modal-mission-desc">{selectedMission.description}</p>
              <div className="modal-objective">
                <strong>Objective:</strong> {selectedMission.objective}
              </div>
              {selectedMission.timeLimit > 0 && (
                <div className="modal-time-limit">
                  ⏱️ Time Limit: {Math.floor(selectedMission.timeLimit / 60)}:{(selectedMission.timeLimit % 60).toString().padStart(2, '0')}
                </div>
              )}
              <div className="modal-rewards">
                <div className="modal-reward">
                  <span className="reward-label">💵 Cash</span>
                  <span className="reward-val money">{formatMoney(selectedMission.rewards.money)}</span>
                </div>
                <div className="modal-reward">
                  <span className="reward-label">⭐ XP</span>
                  <span className="reward-val xp">{selectedMission.rewards.xp}</span>
                </div>
                <div className="modal-reward">
                  <span className="reward-label">👑 Rep</span>
                  <span className="reward-val rep">+{selectedMission.rewards.reputation}</span>
                </div>
              </div>
              <motion.button
                className="start-mission-btn"
                onClick={() => handleStartMission(selectedMission)}
                whileTap={{ scale: 0.95 }}
                disabled={!!activeMission}
              >
                {activeMission ? 'MISSION IN PROGRESS' : 'START MISSION'}
              </motion.button>
              <button className="cancel-btn" onClick={() => setSelectedMission(null)}>Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Missions;
