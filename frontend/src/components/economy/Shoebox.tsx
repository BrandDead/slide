// ============================================================
// Shoebox — Cash App-style gang vault
// Street cash vs vault, role P&L, weekly block costs, activity
// ============================================================
import React, { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Boxes,
  ChevronRight,
  Shield,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import { useNavigationStore, usePlayerStore, useGangStore } from '../../stores/gameStore';
import { useBlockStore } from '../../stores/blockStore';
import { useShoeboxStore } from '../../stores/useShoeboxStore';
import { soundManager } from '../../utils/SoundManager';
import {
  computeEmpirePnl,
  formatCash,
  formatSignedCash,
} from '../../utils/shoeboxAnalytics';
import { pullStreetCash, stashStreetCash, vaultDeposit } from '../../utils/moneyRouter';
import LaunderMoneyModal from './LaunderMoneyModal';
import './Shoebox.css';

function formatPayday(iso: string | null): string {
  if (!iso) return 'Not scheduled';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'Due now';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

type ModalMode = 'deposit' | 'withdraw' | null;
type LedgerFilter = 'all' | 'in' | 'out';

const Shoebox: React.FC = () => {
  const { goBack, navigateTo } = useNavigationStore();
  const { player } = usePlayerStore();
  const { members } = useGangStore();
  const blocksMap = useBlockStore((s) => s.blocks);
  const collectIncome = useBlockStore((s) => s.collectIncome);
  const vault = useShoeboxStore((s) => s.bankBalance);
  const ledger = useShoeboxStore((s) => s.ledger);
  const nextPayrollDueAt = useShoeboxStore((s) => s.nextPayrollDueAt);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [showLaunderModal, setShowLaunderModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('all');
  const [toast, setToast] = useState<string | null>(null);

  const blocks = useMemo(() => Object.values(blocksMap), [blocksMap]);
  const pnl = useMemo(
    () =>
      computeEmpirePnl({
        streetCash: player.money ?? 0,
        vault,
        members,
        blocks,
        ledger,
        nextPayrollDueAt,
      }),
    [player.money, vault, members, blocks, ledger, nextPayrollDueAt],
  );

  const cashtag = `$${(player.gangProfile?.tag || player.gangName || 'CREW')
    .replace(/\s+/g, '')
    .slice(0, 12)
    .toUpperCase()}`;

  const maxForMode = modalMode === 'deposit' ? pnl.streetCash : vault;
  const filteredLedger = useMemo(() => {
    if (ledgerFilter === 'in') return ledger.filter((e) => e.amount > 0);
    if (ledgerFilter === 'out') return ledger.filter((e) => e.amount < 0);
    return ledger;
  }, [ledger, ledgerFilter]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const setQuickAmount = useCallback(
    (pct: number) => {
      setAmount(String(Math.floor(maxForMode * pct)));
      setError('');
    },
    [maxForMode],
  );

  const handleCollect = useCallback(() => {
    let total = 0;
    for (const block of blocks) {
      if (block.owner !== 'player' || block.pendingIncome <= 0) continue;
      total += collectIncome(block.id);
    }
    if (total <= 0) {
      flash('Nothing sitting on the blocks yet.');
      return;
    }
    vaultDeposit(total, 'block_income', `Collected ${formatCash(total)} off the blocks`);
    soundManager.play('cash_register');
    flash(`Collected ${formatCash(total)}`);
  }, [blocks, collectIncome, flash]);

  const handleConfirm = useCallback(() => {
    const val = parseInt(amount, 10);
    if (Number.isNaN(val) || val <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (val > maxForMode) {
      setError(modalMode === 'deposit' ? 'Not enough street cash' : 'Vault is short');
      return;
    }

    const ok = modalMode === 'deposit' ? stashStreetCash(val) : pullStreetCash(val);
    if (!ok) {
      setError('Transfer failed');
      return;
    }

    soundManager.play('cash_register');
    setSuccessMsg(`${modalMode === 'deposit' ? 'Stashed' : 'Pulled'} ${formatCash(val)}`);
    setAmount('');
    setError('');
    window.setTimeout(() => {
      setSuccessMsg('');
      setModalMode(null);
    }, 1000);
  }, [amount, maxForMode, modalMode]);

  return (
    <div className="shoebox-app">
      <header className="sb-top">
        <button type="button" className="sb-back" onClick={goBack} aria-label="Back">
          ‹
        </button>
        <div className="sb-top-title">Shoebox</div>
        <button
          type="button"
          className="sb-pay-crew"
          onClick={() => navigateTo('gang_hq')}
        >
          Pay
        </button>
      </header>

      <section className="sb-hero">
        <div className="sb-cashtag">{cashtag}</div>
        <div className="sb-balance" data-testid="shoebox-vault-balance">
          {formatCash(vault)}
        </div>
        <div className="sb-hero-sub">In the vault · safe from raids</div>
        <div className={`sb-week-net ${pnl.weeklyNet >= 0 ? 'up' : 'down'}`}>
          {formatSignedCash(pnl.weeklyNet)} / week after payroll
        </div>
      </section>

      <div className="sb-actions" role="group" aria-label="Vault actions">
        <button
          type="button"
          className="sb-action"
          onClick={() => {
            setModalMode('deposit');
            setAmount('');
            setError('');
          }}
        >
          <span className="sb-action-icon"><ArrowDownLeft size={22} /></span>
          <span>Stash</span>
        </button>
        <button
          type="button"
          className="sb-action"
          onClick={() => {
            setModalMode('withdraw');
            setAmount('');
            setError('');
          }}
        >
          <span className="sb-action-icon"><ArrowUpRight size={22} /></span>
          <span>Pull</span>
        </button>
        <button type="button" className="sb-action" onClick={handleCollect}>
          <span className="sb-action-icon collect"><Banknote size={22} /></span>
          <span>Collect</span>
        </button>
        <button type="button" className="sb-action" onClick={() => setShowLaunderModal(true)}>
          <span className="sb-action-icon"><Wallet size={22} /></span>
          <span>Clean</span>
        </button>
      </div>

      <div className="sb-split">
        <div className="sb-split-card">
          <span className="sb-split-label">Street cash</span>
          <span className="sb-split-value risk">{formatCash(pnl.streetCash)}</span>
          <span className="sb-split-hint">Raidable</span>
        </div>
        <div className="sb-split-card">
          <span className="sb-split-label">Sitting on blocks</span>
          <span className="sb-split-value pending">{formatCash(pnl.pendingCollect)}</span>
          <span className="sb-split-hint">Tap Collect</span>
        </div>
      </div>

      <section className="sb-card sb-payroll-card">
        <div className="sb-card-head">
          <h2>This week’s books</h2>
          <span className={vault >= pnl.weeklyWages ? 'ok' : 'warn'}>
            {vault >= pnl.weeklyWages ? 'Covered' : 'Short'}
          </span>
        </div>
        <div className="sb-books-row">
          <div>
            <div className="sb-books-label">Coming in</div>
            <div className="sb-books-val up">{formatCash(pnl.weeklyIncome)}</div>
          </div>
          <div>
            <div className="sb-books-label">Crew payroll</div>
            <div className="sb-books-val down">{formatCash(pnl.weeklyWages)}</div>
          </div>
          <div>
            <div className="sb-books-label">Payday</div>
            <div className="sb-books-val">{formatPayday(nextPayrollDueAt)}</div>
          </div>
        </div>
      </section>

      <section className="sb-card">
        <div className="sb-card-head">
          <h2>Who’s making money</h2>
        </div>
        <div className="sb-role-grid">
          {pnl.roleCards.length === 0 && (
            <p className="sb-empty">Recruit dealers and drop them on a block to start printing.</p>
          )}
          {pnl.roleCards.map((role) => (
            <div key={role.role} className="sb-role-card" data-testid={`role-pnl-${role.role}`}>
              <div className="sb-role-top">
                <span className="sb-role-name">{role.label}</span>
                <span className="sb-role-count">{role.memberCount}</span>
              </div>
              <div className={`sb-role-net ${role.weeklyNet >= 0 ? 'up' : 'down'}`}>
                {formatSignedCash(role.weeklyNet)}
              </div>
              <div className="sb-role-meta">
                <span>Earn {formatCash(role.weeklyIncome)}</span>
                <span>Cost {formatCash(role.weeklyWage)}</span>
              </div>
              <p className="sb-role-note">{role.note}</p>
            </div>
          ))}
        </div>
        <div className="sb-role-legend">
          <span><Boxes size={14} /> Dealers {formatCash(pnl.dealerWeekly)}/wk</span>
          <span><Shield size={14} /> Enforcers {formatCash(pnl.enforcerWeekly)}/wk</span>
          <span>Shooters cost {formatCash(pnl.shooterWeeklyWage)}/wk</span>
        </div>
      </section>

      <section className="sb-card">
        <div className="sb-card-head">
          <h2>Weekly block cost</h2>
        </div>
        {pnl.blocks.length === 0 && (
          <p className="sb-empty">No claimed strips yet. Open MAP and drop your crew.</p>
        )}
        <ul className="sb-block-list">
          {pnl.blocks.map((block) => (
            <li key={block.blockId} className="sb-block-row" data-testid={`block-cost-${block.blockId}`}>
              <div className="sb-block-main">
                <div className="sb-block-addr">{block.address}</div>
                <div className="sb-block-sub">
                  {block.memberCount} on strip · heat {block.heat}
                  {block.pendingIncome > 0 ? ` · ${formatCash(block.pendingIncome)} waiting` : ''}
                </div>
              </div>
              <div className="sb-block-nums">
                <div className={`sb-block-net ${block.netWeekly >= 0 ? 'up' : 'down'}`}>
                  {formatSignedCash(block.netWeekly)}
                </div>
                <div className="sb-block-cost">costs {formatCash(block.weeklyCost)}/wk</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="sb-card">
        <div className="sb-card-head">
          <h2>What we’re spending</h2>
        </div>
        {pnl.spending.length === 0 ? (
          <p className="sb-empty">No vault spends yet. Payroll, market, and bail land here.</p>
        ) : (
          <ul className="sb-spend-list">
            {pnl.spending.map((cat) => {
              const max = pnl.spending[0]?.amount || 1;
              return (
                <li key={cat.key} className="sb-spend-row">
                  <div className="sb-spend-label">
                    <ShoppingBag size={14} />
                    {cat.label}
                  </div>
                  <div className="sb-spend-bar-wrap">
                    <div className="sb-spend-bar" style={{ width: `${Math.max(8, (cat.amount / max) * 100)}%` }} />
                  </div>
                  <div className="sb-spend-amt">{formatCash(cat.amount)}</div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="sb-card sb-activity">
        <div className="sb-card-head">
          <h2>Activity</h2>
          <div className="sb-filters">
            {(['all', 'in', 'out'] as LedgerFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                className={ledgerFilter === f ? 'on' : ''}
                onClick={() => setLedgerFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'in' ? 'In' : 'Out'}
              </button>
            ))}
          </div>
        </div>
        {filteredLedger.length === 0 ? (
          <p className="sb-empty">No movement yet. Collect a block or stash street cash.</p>
        ) : (
          <ul className="sb-tx-list">
            {filteredLedger.slice(0, 40).map((tx) => (
              <li key={tx.id} className="sb-tx">
                <div className={`sb-tx-dot ${tx.amount >= 0 ? 'in' : 'out'}`} />
                <div className="sb-tx-body">
                  <div className="sb-tx-desc">{tx.description}</div>
                  <div className="sb-tx-time">
                    {new Date(tx.timestamp).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' · '}
                    {tx.type.replace(/_/g, ' ')}
                  </div>
                </div>
                <div className={`sb-tx-amt ${tx.amount >= 0 ? 'up' : 'down'}`}>
                  {formatSignedCash(tx.amount)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button type="button" className="sb-crush" onClick={() => navigateTo('cocaine_crush')}>
        Play Crush <ChevronRight size={16} />
      </button>

      {showLaunderModal && <LaunderMoneyModal onClose={() => setShowLaunderModal(false)} />}

      <AnimatePresence>
        {toast && (
          <motion.div className="sb-toast" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalMode && (
          <motion.div className="sb-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              className="sb-modal"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="sb-modal-title"
            >
              <h3 id="sb-modal-title">
                {modalMode === 'deposit' ? 'Stash street cash' : 'Pull to the street'}
              </h3>
              <p className="sb-modal-avail">Available {formatCash(maxForMode)}</p>
              {successMsg ? (
                <div className="sb-success">{successMsg}</div>
              ) : (
                <>
                  <div className="sb-amount">
                    <span>$</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        setError('');
                      }}
                      placeholder="0"
                      min={0}
                      max={maxForMode}
                    />
                  </div>
                  <div className="sb-quick">
                    <button type="button" onClick={() => setQuickAmount(0.25)}>25%</button>
                    <button type="button" onClick={() => setQuickAmount(0.5)}>50%</button>
                    <button type="button" onClick={() => setQuickAmount(0.75)}>75%</button>
                    <button type="button" onClick={() => setQuickAmount(1)}>Max</button>
                  </div>
                  {error && <div className="sb-error">{error}</div>}
                  <button type="button" className="sb-confirm" onClick={handleConfirm}>
                    {modalMode === 'deposit' ? 'Stash in vault' : 'Pull to street'}
                  </button>
                </>
              )}
              <button type="button" className="sb-cancel" onClick={() => setModalMode(null)}>
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Shoebox;
