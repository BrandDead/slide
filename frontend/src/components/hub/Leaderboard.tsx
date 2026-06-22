// ============================================================
// Leaderboard — Global rankings by income, blocks, heat
// Fetches from Supabase get_leaderboard() RPC.
// Falls back to local block store data when offline.
// Sprint: mobile-leaderboard-onboarding-batch4
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigationStore, usePlayerStore } from '../../stores/gameStore';
import { useBlockStore } from '../../stores/blockStore';
import './Leaderboard.css';

// ─── Types ───────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  owner_id: string;
  username: string | null;
  gang_name: string | null;
  total_blocks: number;
  total_income: number;
  max_heat: number;
  avg_morale: number;
}

type SortKey = 'total_income' | 'total_blocks' | 'max_heat';

// ─── Helpers ─────────────────────────────────────────────────

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

function heatColor(heat: number): string {
  if (heat >= 80) return '#ef4444';
  if (heat >= 50) return '#f97316';
  if (heat >= 25) return '#facc15';
  return '#4ade80';
}

function moraleColor(morale: number): string {
  if (morale >= 75) return '#4ade80';
  if (morale >= 50) return '#facc15';
  if (morale >= 30) return '#f97316';
  return '#ef4444';
}

// ─── Component ───────────────────────────────────────────────

const Leaderboard: React.FC = () => {
  const { goBack } = useNavigationStore();
  const { player } = usePlayerStore();
  const { blocks } = useBlockStore();

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('total_income');
  const [playerRank, setPlayerRank] = useState<number | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Dynamic import to avoid crashing when Supabase is not configured
      const { supabase } = await import('../../services/supabase');
      const { data, error: rpcError } = await (supabase as any).rpc('get_leaderboard', { limit_count: 50 });

      if (rpcError) throw rpcError;

      const rows: LeaderboardEntry[] = (data ?? []).map((row: any) => ({
        rank:          Number(row.rank),
        owner_id:      row.owner_id,
        username:      row.username ?? 'Unknown',
        gang_name:     row.gang_name ?? 'No Gang',
        total_blocks:  Number(row.total_blocks),
        total_income:  Number(row.total_income),
        max_heat:      Number(row.max_heat),
        avg_morale:    Number(row.avg_morale),
      }));

      setEntries(rows);

      // Find current player's rank
      const myEntry = rows.find(r => r.owner_id === player?.id);
      setPlayerRank(myEntry?.rank ?? null);
    } catch {
      // Fallback: build leaderboard from local block store
      const playerBlocks = Object.values(blocks).filter(b => b.owner === 'player');
      if (playerBlocks.length > 0) {
        const localEntry: LeaderboardEntry = {
          rank:         1,
          owner_id:     player?.id ?? 'local',
          username:     player?.username ?? 'You',
          gang_name:    player?.gangName ?? 'Your Gang',
          total_blocks: playerBlocks.length,
          total_income: playerBlocks.reduce((s, b) => s + b.incomePerTick, 0),
          max_heat:     Math.max(...playerBlocks.map(b => b.heat * 20)),
          avg_morale:   Math.round(playerBlocks.reduce((s, b) => s + (b.morale ?? 80), 0) / playerBlocks.length),
        };
        setEntries([localEntry]);
        setPlayerRank(1);
      } else {
        setError('Connect to the internet to load the global leaderboard.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [player, blocks]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const sorted = [...entries].sort((a, b) => {
    if (sortKey === 'total_income') return b.total_income - a.total_income;
    if (sortKey === 'total_blocks') return b.total_blocks - a.total_blocks;
    return b.max_heat - a.max_heat;
  });

  return (
    <div className="leaderboard-screen">
      {/* Header */}
      <div className="lb-header">
        <motion.button className="lb-back" onClick={goBack} whileTap={{ scale: 0.9 }}>
          ← Back
        </motion.button>
        <div className="lb-title">
          <span className="lb-title-icon">🏆</span>
          <span className="lb-title-text">LEADERBOARD</span>
        </div>
        <motion.button className="lb-refresh" onClick={fetchLeaderboard} whileTap={{ scale: 0.9 }}>
          🔄
        </motion.button>
      </div>

      {/* Player rank banner */}
      {playerRank !== null && (
        <div className="lb-player-rank">
          <span className="lb-pr-label">Your Rank</span>
          <span className="lb-pr-rank">#{playerRank}</span>
          <span className="lb-pr-gang">{player?.gangName ?? 'Your Gang'}</span>
        </div>
      )}

      {/* Sort tabs */}
      <div className="lb-sort-tabs">
        {[
          { key: 'total_income' as SortKey, label: '💰 Income' },
          { key: 'total_blocks' as SortKey, label: '🏘️ Blocks' },
          { key: 'max_heat'     as SortKey, label: '🔥 Heat' },
        ].map(tab => (
          <button
            key={tab.key}
            className={`lb-sort-tab ${sortKey === tab.key ? 'active' : ''}`}
            onClick={() => setSortKey(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="lb-content">
        {isLoading && (
          <div className="lb-loading">
            <div className="lb-spinner" />
            <span>Loading rankings...</span>
          </div>
        )}

        {error && !isLoading && (
          <div className="lb-error">
            <span>⚠️ {error}</span>
            <button onClick={fetchLeaderboard}>Retry</button>
          </div>
        )}

        {!isLoading && !error && sorted.length === 0 && (
          <div className="lb-empty">
            <span className="lb-empty-icon">🏜️</span>
            <span>No empires yet. Be the first to claim a block.</span>
          </div>
        )}

        <AnimatePresence>
          {!isLoading && sorted.map((entry, i) => {
            const isMe = entry.owner_id === player?.id;
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;

            return (
              <motion.div
                key={entry.owner_id}
                className={`lb-row ${isMe ? 'is-me' : ''}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                {/* Rank */}
                <div className="lb-rank">
                  {medal ?? <span className="lb-rank-num">#{entry.rank}</span>}
                </div>

                {/* Gang info */}
                <div className="lb-gang-info">
                  <span className="lb-gang-name">{entry.gang_name ?? 'Unknown'}</span>
                  <span className="lb-username">@{entry.username ?? 'unknown'}</span>
                </div>

                {/* Stats */}
                <div className="lb-stats">
                  <span className="lb-stat income">{formatMoney(entry.total_income)}</span>
                  <span className="lb-stat blocks">{entry.total_blocks} blk</span>
                  <span className="lb-stat heat" style={{ color: heatColor(entry.max_heat) }}>
                    🔥{entry.max_heat}
                  </span>
                  <span className="lb-stat morale" style={{ color: moraleColor(entry.avg_morale) }}>
                    ❤️{Math.round(entry.avg_morale)}%
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Leaderboard;
