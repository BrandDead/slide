// ============================================================
// RouteLoadBoundary — loading + failure recovery for lazy routes
// Keeps the player on a usable surface when a heavy chunk fails.
// ============================================================

import React, { Suspense } from 'react';

type RouteLoadBoundaryProps = {
  children: React.ReactNode;
  /** Short label for the surface being loaded (player-facing). */
  label: string;
  /** Optional playable fallback when the heavy surface cannot mount. */
  fallback?: React.ReactNode;
  /** Test-only signal; not shown on the player path. */
  testId?: string;
};

type RouteLoadBoundaryState = {
  error: Error | null;
};

function RouteLoading({ label, testId }: { label: string; testId?: string }) {
  return (
    <div className="loading-screen" role="status" aria-live="polite" data-testid={testId ?? 'route-loading'}>
      <div className="loading-content">
        <div className="loading-spinner" />
        <div className="loading-text">LOADING {label.toUpperCase()}…</div>
      </div>
    </div>
  );
}

/**
 * Catches lazy-import and render failures for a single route/surface.
 * Prefer this over a blank Suspense frame so recovery stays visible.
 */
export class RouteLoadBoundary extends React.Component<
  RouteLoadBoundaryProps,
  RouteLoadBoundaryState
> {
  state: RouteLoadBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RouteLoadBoundaryState {
    return { error };
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    const { children, label, fallback, testId } = this.props;
    const { error } = this.state;

    if (error) {
      return (
        <div
          className="route-load-error"
          role="alert"
          aria-live="assertive"
          data-testid={testId ? `${testId}-error` : 'route-load-error'}
        >
          <p>
            <strong>{label} could not load.</strong>
            {' '}
            The 8×8 board and command desk stay available.
          </p>
          <p className="route-load-error__detail">{error.message}</p>
          <div className="route-load-error__actions">
            <button type="button" onClick={this.retry}>
              Retry {label}
            </button>
          </div>
          {fallback}
        </div>
      );
    }

    return children;
  }
}

/** Suspense + error boundary for a lazy route or heavy surface. */
export const LazyRoute: React.FC<RouteLoadBoundaryProps> = ({
  children,
  label,
  fallback,
  testId,
}) => (
  <RouteLoadBoundary label={label} fallback={fallback} testId={testId}>
    <Suspense fallback={<RouteLoading label={label} testId={testId} />}>
      {children}
    </Suspense>
  </RouteLoadBoundary>
);

export { RouteLoading };
export default RouteLoadBoundary;
