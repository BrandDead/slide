/**
 * DrugAssignmentPanel.tsx
 * ---------------------------------------------------------------------------
 * A bottom-sheet UI that lets players assign crafted drugs (from AlchemyLab)
 * to dealers placed on the block (from BlockModeView).
 *
 * This is the primary interface for the drug-to-dealer pipeline:
 *   1. Player opens panel from BlockModeView ("Loadout" button)
 *   2. Panel shows all dealers on the block + drug inventory
 *   3. Player taps a dealer → selects a drug from inventory
 *   4. Store updates assignment → BlockModeView income/heat recalculated
 *   5. Drugs are consumed per-tick — player must keep crafting to maintain
 *
 * Zone restriction:
 *   Dealers in the 'alley' zone cannot be assigned drugs. The UI shows
 *   a "Move to Street or Mid" message for alley dealers. This is the
 *   anti-turtle mechanic: the drug income multiplier is gated behind
 *   street/mid placement.
 * ---------------------------------------------------------------------------
 */

import { useState, useMemo, useCallback } from 'react';
import {
  useDrugInventory,
  getTierConfig,
  canZoneAssignDrugs,
  type BlockDealer,
  type DrugTier,
  type CraftedDrug,
} from '../../stores/useDrugInventory';

// ── Props ──────────────────────────────────────────────────────────────────

export interface DrugAssignmentPanelProps {
  /** Dealers currently placed on the block (from BlockModeView state). */
  dealers: BlockDealer[];
  /** Called when the player closes the panel. */
  onClose: () => void;
  /** Optional className override. */
  className?: string;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function TierBadge({ tier, small }: { tier: DrugTier; small?: boolean }) {
  const cfg = getTierConfig(tier);
  return (
    <span
      className={`inline-flex items-center rounded border font-bold tracking-wide ${
        cfg.badgeClass
      } ${small ? 'px-1 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}`}
    >
      {cfg.label}
    </span>
  );
}

function ZoneTag({ zone }: { zone: BlockDealer['zone'] }) {
  const styles: Record<BlockDealer['zone'], string> = {
    street: 'bg-red-500/15 text-red-400 border-red-500/30',
    mid: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    alley: 'bg-zinc-600/20 text-zinc-500 border-zinc-600/30',
  };
  const labels: Record<BlockDealer['zone'], string> = {
    street: 'STREET',
    mid: 'MID',
    alley: 'ALLEY',
  };
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${styles[zone]}`}>
      {labels[zone]}
    </span>
  );
}

function StatRow({
  label,
  value,
  color,
  prefix,
}: {
  label: string;
  value: string | number;
  color: string;
  prefix?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</span>
      <span className={`text-xs font-bold ${color}`}>
        {prefix}{value}
      </span>
    </div>
  );
}

function SupplyBar({ quantity, max = 50 }: { quantity: number; max?: number }) {
  const pct = Math.min(100, (quantity / max) * 100);
  const color =
    pct < 15 ? 'bg-red-500' :
    pct < 35 ? 'bg-orange-500' :
    'bg-emerald-500';

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-700/50">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Dealer card ────────────────────────────────────────────────────────────

function DealerCard({
  dealer,
  isSelected,
  onSelect,
}: {
  dealer: BlockDealer;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const getDealerStats = useDrugInventory((s) => s.getDealerStats);
  const stats = getDealerStats(dealer.id, dealer.baseIncome, dealer.baseHeat);
  const canAssign = canZoneAssignDrugs(dealer.zone);

  const incomeDelta = stats.income - dealer.baseIncome;
  const heatDelta = stats.heat - dealer.baseHeat;

  return (
    <button
      onClick={onSelect}
      disabled={!canAssign}
      className={`w-full rounded-xl border p-3 text-left transition-colors ${
        isSelected
          ? 'border-sky-500/50 bg-sky-500/10'
          : 'border-white/5 bg-zinc-900/60 hover:bg-zinc-800/60'
      } ${!canAssign ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-zinc-100">{dealer.name}</span>
          <ZoneTag zone={dealer.zone} />
        </div>
        {stats.drugTier && <TierBadge tier={stats.drugTier} small />}
      </div>

      {/* Drug name or status */}
      {stats.drugName ? (
        <div className="mb-2">
          <p className="text-xs text-zinc-300">
            Pushing: <span className="font-medium text-zinc-100">{stats.drugName}</span>
          </p>
          {stats.ticksRemaining !== null && (
            <p className="mt-0.5 text-[10px] text-zinc-500">
              Supply: {Math.ceil(stats.supplyRemaining ?? 0)} units (~{stats.ticksRemaining} ticks)
            </p>
          )}
        </div>
      ) : canAssign ? (
        <p className="mb-2 text-xs italic text-zinc-600">No drug assigned</p>
      ) : (
        <p className="mb-2 text-xs italic text-zinc-600">
          Alley dealers can't be assigned drugs — move to Street or Mid
        </p>
      )}

      {/* Stats */}
      <div className="space-y-1">
        <StatRow
          label="Income"
          value={`$${Math.round(stats.income)}/tick`}
          color={incomeDelta > 0 ? 'text-emerald-400' : 'text-zinc-400'}
          prefix={incomeDelta > 0 ? '↑ ' : ''}
        />
        <StatRow
          label="Heat"
          value={`+${Math.round(stats.heat)}/tick`}
          color={heatDelta > 0 ? 'text-red-400' : 'text-zinc-400'}
          prefix={heatDelta > 0 ? '↑ ' : ''}
        />
      </div>

      {/* Supply bar */}
      {stats.drugName && stats.supplyRemaining !== null && (
        <div className="mt-2">
          <SupplyBar quantity={stats.supplyRemaining} />
        </div>
      )}
    </button>
  );
}

// ── Drug selection card ────────────────────────────────────────────────────

function DrugSelectCard({
  drug,
  assignedDealerCount,
  onSelect,
}: {
  drug: CraftedDrug;
  assignedDealerCount: number;
  onSelect: () => void;
}) {
  const cfg = getTierConfig(drug.tier);
  const isLowSupply = drug.quantity < 5;

  return (
    <button
      onClick={onSelect}
      className="w-full rounded-xl border border-white/5 bg-zinc-900/60 p-3 text-left transition-colors hover:border-white/10 hover:bg-zinc-800/60"
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TierBadge tier={drug.tier} small />
          <span className="text-sm font-bold text-zinc-100">{drug.name}</span>
        </div>
        {assignedDealerCount > 0 && (
          <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold text-sky-400">
            {assignedDealerCount} DEALER{assignedDealerCount > 1 ? 'S' : ''}
          </span>
        )}
      </div>

      {/* Quality */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">Quality</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-700/50">
          <div
            className={`h-full rounded-full ${cfg.colorClass.replace('text-', 'bg-')}`}
            style={{ width: `${drug.quality}%` }}
          />
        </div>
        <span className={`text-xs font-bold ${cfg.colorClass}`}>{drug.quality}</span>
      </div>

      {/* Modifiers */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-zinc-800/40 px-2 py-1">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500">Income</div>
          <div className="text-sm font-bold text-emerald-400">×{cfg.incomeMultiplier}</div>
        </div>
        <div className="rounded-lg bg-zinc-800/40 px-2 py-1">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500">Heat</div>
          <div className="text-sm font-bold text-red-400">×{cfg.heatMultiplier}</div>
        </div>
      </div>

      {/* Supply */}
      <div className="mt-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">Supply</span>
          <span className={`text-xs font-bold ${isLowSupply ? 'text-red-400' : 'text-zinc-300'}`}>
            {Math.ceil(drug.quantity)} units
          </span>
        </div>
        <SupplyBar quantity={drug.quantity} />
        {isLowSupply && (
          <p className="mt-1 text-[10px] text-red-400">
            ⚠ Low supply — craft more in AlchemyLab
          </p>
        )}
      </div>

      {/* Effects tags */}
      {drug.effects.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {drug.effects.map((effect, i) => (
            <span
              key={i}
              className="rounded bg-zinc-700/30 px-1.5 py-0.5 text-[9px] text-zinc-400"
            >
              {effect}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

// ── Empty states ───────────────────────────────────────────────────────────

function NoDrugsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-zinc-900/30 p-8 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800/50">
        <svg className="h-7 w-7 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M9 3v6m6-6v6M5 9h14l-1 12H6L5 9z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-zinc-400">No drugs in inventory</p>
      <p className="mt-1 text-xs text-zinc-600">
        Craft drugs in the AlchemyLab to assign them to your dealers
      </p>
    </div>
  );
}

function NoDealersEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-zinc-900/30 p-8 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800/50">
        <svg className="h-7 w-7 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="8" r="3" />
          <path d="M3 20c0-3 2.5-5 6-5s6 2 6 5M14 20c0-2 1-3 3-3s4 1 4 3" />
        </svg>
      </div>
      <p className="text-sm font-medium text-zinc-400">No dealers on the block</p>
      <p className="mt-1 text-xs text-zinc-600">
        Place dealers on the block grid first, then assign drugs
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function DrugAssignmentPanel({
  dealers,
  onClose,
  className,
}: DrugAssignmentPanelProps) {
  // ── Store ──────────────────────────────────────────────────────────────────

  const inventory = useDrugInventory((s) => s.inventory);
  const assignments = useDrugInventory((s) => s.assignments);
  const assignDrug = useDrugInventory((s) => s.assignDrug);
  const unassignDrug = useDrugInventory((s) => s.unassignDrug);
  const getInventoryList = useDrugInventory((s) => s.getInventoryList);
  const getAssignedDealerIds = useDrugInventory((s) => s.getAssignedDealerIds);
  const getTotalIncome = useDrugInventory((s) => s.getTotalIncome);
  const getTotalHeat = useDrugInventory((s) => s.getTotalHeat);

  // ── Local state ────────────────────────────────────────────────────────────

  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const selectedDealer = useMemo(
    () => dealers.find((d) => d.id === selectedDealerId) ?? null,
    [dealers, selectedDealerId],
  );

  const drugList = useMemo(() => getInventoryList(), [inventory, getInventoryList]);

  // ── Aggregate stats ───────────────────────────────────────────────────────

  const totalIncome = useMemo(() => getTotalIncome(dealers), [dealers, inventory, assignments, getTotalIncome]);
  const totalHeat = useMemo(() => getTotalHeat(dealers), [dealers, inventory, assignments, getTotalHeat]);
  const baseTotalIncome = useMemo(
    () => dealers.reduce((sum, d) => sum + d.baseIncome, 0),
    [dealers],
  );
  const baseTotalHeat = useMemo(
    () => dealers.reduce((sum, d) => sum + d.baseHeat, 0),
    [dealers],
  );
  const incomeBoost = totalIncome - baseTotalIncome;
  const heatBoost = totalHeat - baseTotalHeat;

  const assignedCount = Object.keys(assignments).length;
  const assignableDealers = dealers.filter((d) => canZoneAssignDrugs(d.zone));

  // ── Handlers ──────────────────────────────────────────────────────────────

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  const handleSelectDrug = useCallback(
    (drugId: string) => {
      if (!selectedDealer) return;
      const success = assignDrug(selectedDealer.id, selectedDealer.zone, drugId);
      if (success) {
        const drug = inventory[drugId];
        showToast(`Assigned ${drug?.name ?? 'drug'} to ${selectedDealer.name}`);
        setSelectedDealerId(null); // return to dealer list
      } else {
        showToast('Failed to assign — check supply and zone');
      }
    },
    [selectedDealer, assignDrug, inventory, showToast],
  );

  const handleUnassign = useCallback(
    (dealerId: string) => {
      unassignDrug(dealerId);
      const dealer = dealers.find((d) => d.id === dealerId);
      showToast(`Unassigned drug from ${dealer?.name ?? 'dealer'}`);
    },
    [unassignDrug, dealers, showToast],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={`fixed inset-0 z-[9000] flex flex-col justify-end bg-black/60 backdrop-blur-sm ${className ?? ''}`}
      onClick={onClose}
    >
      {/* Bottom sheet */}
      <div
        className="max-h-[85vh] overflow-hidden rounded-t-3xl border-t border-white/10 bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-zinc-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-zinc-100">Drug Loadout</h2>
            <p className="text-[11px] text-zinc-500">
              Assign crafted drugs to dealers to boost income
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        {/* Aggregate stats bar */}
        <div className="mx-5 mb-3 grid grid-cols-4 gap-2">
          <div className="rounded-lg bg-zinc-900/60 px-2 py-1.5 text-center">
            <div className="text-sm font-extrabold text-sky-400">{assignedCount}</div>
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">Assigned</div>
          </div>
          <div className="rounded-lg bg-zinc-900/60 px-2 py-1.5 text-center">
            <div className="text-sm font-extrabold text-emerald-400">
              ${Math.round(totalIncome)}
            </div>
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">Income/tick</div>
          </div>
          <div className="rounded-lg bg-zinc-900/60 px-2 py-1.5 text-center">
            <div className={`text-sm font-extrabold ${heatBoost > 0 ? 'text-red-400' : 'text-zinc-400'}`}>
              +{Math.round(totalHeat)}
            </div>
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">Heat/tick</div>
          </div>
          <div className="rounded-lg bg-zinc-900/60 px-2 py-1.5 text-center">
            <div className={`text-sm font-extrabold ${incomeBoost > 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>
              +${Math.round(incomeBoost)}
            </div>
            <div className="text-[9px] uppercase tracking-wide text-zinc-500">Boost</div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="max-h-[55vh] overflow-y-auto px-5 pb-6">
          {dealers.length === 0 ? (
            <NoDealersEmptyState />
          ) : selectedDealer ? (
            /* ── Drug selection view ── */
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <button
                    onClick={() => setSelectedDealerId(null)}
                    className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
                  >
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M19 12H5M11 18l-6-6 6-6" />
                    </svg>
                    Back to dealers
                  </button>
                  <h3 className="mt-1 text-sm font-bold text-zinc-100">
                    Assign drug to {selectedDealer.name}
                  </h3>
                </div>
                {assignments[selectedDealer.id] && (
                  <button
                    onClick={() => handleUnassign(selectedDealer.id)}
                    className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
                  >
                    Unassign
                  </button>
                )}
              </div>

              {drugList.length === 0 ? (
                <NoDrugsEmptyState />
              ) : (
                <div className="space-y-2.5">
                  {drugList.map((drug) => {
                    const assignedIds = getAssignedDealerIds(drug.id);
                    return (
                      <DrugSelectCard
                        key={drug.id}
                        drug={drug}
                        assignedDealerCount={assignedIds.length}
                        onSelect={() => handleSelectDrug(drug.id)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ── Dealer list view ── */
            <div>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-100">Block Dealers</h3>
                <span className="text-xs text-zinc-500">
                  ({assignableDealers.length} assignable)
                </span>
              </div>

              {drugList.length === 0 && assignableDealers.length > 0 && (
                <div className="mb-3">
                  <NoDrugsEmptyState />
                </div>
              )}

              <div className="space-y-2.5">
                {dealers.map((dealer) => (
                  <DealerCard
                    key={dealer.id}
                    dealer={dealer}
                    isSelected={false}
                    onSelect={() => {
                      if (canZoneAssignDrugs(dealer.zone)) {
                        setSelectedDealerId(dealer.id);
                      } else {
                        showToast('Alley dealers cannot be assigned drugs');
                      }
                    }}
                  />
                ))}
              </div>

              {/* Zone legend */}
              <div className="mt-4 rounded-xl border border-white/5 bg-zinc-900/40 p-3">
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                  Zone Rules
                </h4>
                <div className="space-y-1.5 text-[11px] text-zinc-400">
                  <div className="flex items-center gap-2">
                    <ZoneTag zone="street" />
                    <span>Highest base income · Drug assignment ✓ · Drive-by risk ✗</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ZoneTag zone="mid" />
                    <span>Medium income · Drug assignment ✓ · Moderate risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ZoneTag zone="alley" />
                    <span>Lowest income · Drug assignment ✗ · Safest from drive-bys</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-zinc-800 px-4 py-2 text-xs font-medium text-white shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
