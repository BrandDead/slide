/**
 * WeeklyUpdateApp.tsx
 * ---------------------------------------------------------------------------
 * A "Citizen-app"-style news feed for the SLIDE / DEALT in-game phone.
 * Lists recent drive-by events across the city with severity indicators,
 * generated headlines, and tap-to-watch CCTV replay footage.
 *
 * This is designed to sit inside the game's iOS shell (a phone frame).
 * It fills its container and scrolls internally.
 * ---------------------------------------------------------------------------
 */

import { useState, useMemo, useCallback } from 'react';
import SecurityCamRenderer, {
  type DriveByEvent,
} from './SecurityCamRenderer';

// ── Props ─────────────────────────────────────────────────────────────────

export interface WeeklyUpdateAppProps {
  /** The list of resolved drive-by events to display. */
  events: DriveByEvent[];
  /** Optional className for the root container. */
  className?: string;
}

// ── Severity ──────────────────────────────────────────────────────────────

type Severity = 'critical' | 'high' | 'moderate' | 'low';

interface SeverityConfig {
  label: string;
  dotClass: string;
  badgeClass: string;
  borderClass: string;
  icon: string;
}

const SEVERITY_CONFIG: Record<Severity, SeverityConfig> = {
  critical: {
    label: 'CRITICAL',
    dotClass: 'bg-red-500',
    badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',
    borderClass: 'border-l-red-500',
    icon: '🔴',
  },
  high: {
    label: 'HIGH',
    dotClass: 'bg-orange-500',
    badgeClass: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    borderClass: 'border-l-orange-500',
    icon: '🟠',
  },
  moderate: {
    label: 'MODERATE',
    dotClass: 'bg-yellow-500',
    badgeClass: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    borderClass: 'border-l-yellow-500',
    icon: '🟡',
  },
  low: {
    label: 'LOW',
    dotClass: 'bg-gray-500',
    badgeClass: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
    borderClass: 'border-l-gray-600',
    icon: '⚪',
  },
};

function getSeverity(event: DriveByEvent): Severity {
  if (event.casualties.length >= 3) return 'critical';
  if (event.casualties.length > 0) return 'high';
  if (event.shots.length + event.defenderShots.length > 8) return 'moderate';
  return 'low';
}

// ── Headline generation ─────────────────────────────────────────────────────

function blockIdToLocation(blockId: string): string {
  return blockId
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function generateHeadline(event: DriveByEvent): string {
  const location = blockIdToLocation(event.blockId);
  const totalShots = event.shots.length + event.defenderShots.length;

  if (event.casualties.length >= 3) {
    return `MASS SHOOTING — ${location}`;
  }
  if (event.casualties.length > 0 && event.outcome === 'successful') {
    return `FATAL DRIVE-BY ON ${location}`;
  }
  if (event.casualties.length > 0) {
    return `CASUALTIES REPORTED NEAR ${location}`;
  }
  if (event.outcome === 'repelled' && event.defenderShots.length > 0) {
    return `GUNFIRE EXCHANGED AT ${location}`;
  }
  if (event.outcome === 'fled') {
    return `SHOTS FIRED — SUSPECTS FLED ${location}`;
  }
  if (totalShots > 10) {
    return `HEAVY GUNFIRE AT ${location}`;
  }
  return `SHOTS FIRED AT ${location}`;
}

function generateSubheadline(event: DriveByEvent): string {
  const parts: string[] = [];
  const totalShots = event.shots.length + event.defenderShots.length;
  parts.push(`${totalShots} rounds fired`);

  if (event.casualties.length > 0) {
    const word = event.casualties.length === 1 ? 'casualty' : 'casualties';
    parts.push(`${event.casualties.length} confirmed ${word}`);
  }

  if (event.defenderShots.length > 0) {
    parts.push('return fire reported');
  }

  return parts.join(' • ');
}

function generateDetails(event: DriveByEvent): { label: string; value: string }[] {
  const details: { label: string; value: string }[] = [];

  details.push({ label: 'Gang', value: event.attackerGangName });
  details.push({ label: 'Vehicle', value: event.vehicleType.toUpperCase() });

  const outcomeLabels: Record<DriveByEvent['outcome'], string> = {
    successful: 'Target Hit',
    repelled: 'Repelled',
    fled: 'Suspects Fled',
  };
  details.push({ label: 'Outcome', value: outcomeLabels[event.outcome] });

  if (event.casualties.length > 0) {
    details.push({ label: 'Casualties', value: String(event.casualties.length) });
  }

  return details;
}

// ── Time formatting ────────────────────────────────────────────────────────

function timeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = Math.max(0, now - timestamp);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  if (seconds > 10) return `${seconds}s ago`;
  return 'Just now';
}

function formatEventTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// ── Camera info generation ─────────────────────────────────────────────────

function getCameraInfo(blockId: string): { id: string; location: string } {
  let hash = 0;
  for (let i = 0; i < blockId.length; i++) {
    hash = ((hash << 5) - hash + blockId.charCodeAt(i)) | 0;
  }
  const num = String(Math.abs(hash % 98) + 1).padStart(2, '0');
  return {
    id: `CAM-${num}`,
    location: blockIdToLocation(blockId).toUpperCase(),
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: Severity }) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wider ${config.badgeClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
      {config.label}
    </span>
  );
}

function EventCard({
  event,
  onClick,
}: {
  event: DriveByEvent;
  onClick: () => void;
}) {
  const severity = getSeverity(event);
  const config = SEVERITY_CONFIG[severity];
  const headline = generateHeadline(event);
  const subheadline = generateSubheadline(event);
  const details = generateDetails(event);
  const camInfo = getCameraInfo(event.blockId);

  return (
    <button
      onClick={onClick}
      className={`group w-full overflow-hidden rounded-xl border border-l-4 ${config.borderClass} border-y-white/5 border-r-white/5 bg-zinc-900/80 p-4 text-left transition-colors hover:bg-zinc-800/80 active:bg-zinc-800`}
    >
      {/* Header row */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <SeverityBadge severity={severity} />
          <span className="text-[11px] font-medium text-zinc-500">
            {timeAgo(event.resolvedAt)}
          </span>
        </div>
        <span className="text-[11px] font-mono text-zinc-600">
          {formatEventTime(event.startedAt)}
        </span>
      </div>

      {/* Headline */}
      <h3 className="mb-1 text-sm font-bold leading-snug text-zinc-100">
        {headline}
      </h3>

      {/* Subheadline */}
      <p className="mb-3 text-xs leading-relaxed text-zinc-400">
        {subheadline}
      </p>

      {/* Detail grid */}
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
        {details.map((d) => (
          <div key={d.label} className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-zinc-600">
              {d.label}
            </span>
            <span className="text-[11px] font-medium text-zinc-300">
              {d.value}
            </span>
          </div>
        ))}
      </div>

      {/* Footer: camera info + watch button */}
      <div className="flex items-center justify-between border-t border-white/5 pt-2.5">
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <svg
            className="h-3 w-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <rect x="2" y="6" width="14" height="12" rx="1" />
            <path d="M16 10l6-3v10l-6-3" />
          </svg>
          <span className="font-mono">{camInfo.id}</span>
          <span className="text-zinc-700">•</span>
          <span>{camInfo.location}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-medium text-sky-400 transition-colors group-hover:text-sky-300">
          <span>Watch</span>
          <svg
            className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </div>
      </div>
    </button>
  );
}

function SecurityCamModal({
  event,
  onClose,
}: {
  event: DriveByEvent;
  onClose: () => void;
}) {
  const camInfo = getCameraInfo(event.blockId);

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col bg-black">
      {/* Close button (top-right, above canvas) */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
        aria-label="Close replay"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path d="M6 6l12 12M6 18L18 6" />
        </svg>
      </button>

      {/* Event info banner (top-left, above canvas) */}
      <div className="absolute left-4 top-4 z-10 max-w-[60%] rounded-lg bg-black/60 px-4 py-2 backdrop-blur-sm">
        <p className="text-xs font-bold text-white">
          {generateHeadline(event)}
        </p>
        <p className="mt-0.5 text-[10px] text-zinc-400">
          {generateSubheadline(event)}
        </p>
      </div>

      {/* The CCTV renderer fills the screen */}
      <SecurityCamRenderer
        event={event}
        cameraId={camInfo.id}
        cameraLocation={camInfo.location}
        loop={false}
        onComplete={onClose}
      />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function WeeklyUpdateApp({
  events,
  className,
}: WeeklyUpdateAppProps) {
  const [selectedEvent, setSelectedEvent] = useState<DriveByEvent | null>(null);

  // Sort events by resolvedAt descending (most recent first)
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => b.resolvedAt - a.resolvedAt);
  }, [events]);

  // Aggregate stats for the header
  const stats = useMemo(() => {
    const totalShots = events.reduce(
      (sum, e) => sum + e.shots.length + e.defenderShots.length,
      0,
    );
    const totalCasualties = events.reduce(
      (sum, e) => sum + e.casualties.length,
      0,
    );
    const criticalCount = events.filter(
      (e) => getSeverity(e) === 'critical',
    ).length;

    return { totalShots, totalCasualties, criticalCount, eventCount: events.length };
  }, [events]);

  const handleCloseModal = useCallback(() => setSelectedEvent(null), []);

  return (
    <div
      className={`flex h-full flex-col bg-zinc-950 text-white ${className ?? ''}`}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}

      <div className="shrink-0 border-b border-white/5 bg-zinc-900/50 px-4 pb-3 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/15">
              <svg
                className="h-4 w-4 text-red-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-zinc-100">
                CityWatch
              </h1>
              <p className="text-[10px] text-zinc-500">Weekly Local Update</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="text-[10px] font-bold tracking-wider text-red-400">
              LIVE
            </span>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-2">
          <StatChip label="Events" value={stats.eventCount} color="text-sky-400" />
          <StatChip label="Shots" value={stats.totalShots} color="text-orange-400" />
          <StatChip
            label="Casualties"
            value={stats.totalCasualties}
            color="text-red-400"
          />
          <StatChip
            label="Critical"
            value={stats.criticalCount}
            color="text-red-500"
          />
        </div>
      </div>

      {/* ── Event list (scrollable) ─────────────────────────────────────────── */}

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {sortedEvents.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800/50">
              <svg
                className="h-8 w-8 text-zinc-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12h8" />
              </svg>
            </div>
            <p className="text-sm font-medium text-zinc-400">No incidents reported</p>
            <p className="mt-1 text-xs text-zinc-600">
              The streets have been quiet... for now.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onClick={() => setSelectedEvent(event)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── CCTV replay modal ─────────────────────────────────────────────── */}

      {selectedEvent && (
        <SecurityCamModal
          event={selectedEvent}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

// ── StatChip helper component ──────────────────────────────────────────────

function StatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-zinc-800/40 px-2 py-1.5 text-center">
      <div className={`text-base font-extrabold leading-none ${color}`}>
        {value}
      </div>
      <div className="mt-0.5 text-[9px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
    </div>
  );
}
