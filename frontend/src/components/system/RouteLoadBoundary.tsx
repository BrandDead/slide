// ============================================================
// RouteLoadBoundary — loading + failure recovery for lazy routes
// Keeps the player on a usable surface when a heavy chunk fails.
//
// Retry must recreate React.lazy() factories: a rejected lazy
// import promise is cached by React, so clearing error state alone
// immediately rethrows the same rejection.
// ============================================================

import React, { Suspense, useContext } from 'react';

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
  /** Bumped on Retry so lazy factories and children remount fresh. */
  attempt: number;
};

/** Attempt counter for createRetryableLazy — fresh React.lazy per retry. */
export const RetryAttemptContext = React.createContext(0);

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

type ImportFactory<T extends React.ComponentType<any>> = () => Promise<{ default: T }>;

type LazyLoadCache<T> = {
  wake: Promise<void>;
  Comp: T | null;
  error: Error | null;
};

/**
 * Like React.lazy, but each RouteLoadBoundary retry starts a fresh import.
 *
 * React caches rejected `React.lazy()` thenables, so a Retry that only clears
 * error state rethrows the same rejection. This helper:
 * 1. keys the in-flight load to RetryAttemptContext (bumped on Retry)
 * 2. stores load state in a module map (survives Suspense remounts)
 * 3. converts import failures into a render-time throw the boundary catches
 * 4. uses an always-fulfilling wake thenable so Suspense does not hang on reject
 */
export function createRetryableLazy<T extends React.ComponentType<any>>(
  factory: ImportFactory<T>,
): React.ComponentType<React.ComponentPropsWithoutRef<T>> {
  const loads = new Map<number, LazyLoadCache<T>>();

  function RetryableLazy(props: React.ComponentPropsWithoutRef<T>) {
    const attempt = useContext(RetryAttemptContext);

    let cache = loads.get(attempt);
    if (!cache) {
      const entry: LazyLoadCache<T> = {
        Comp: null,
        error: null,
        wake: Promise.resolve(),
      };
      entry.wake = new Promise<void>((resolve) => {
        queueMicrotask(() => {
          factory().then(
            (mod) => {
              entry.Comp = mod.default;
              resolve();
            },
            (cause) => {
              entry.error =
                cause instanceof Error ? cause : new Error(String(cause ?? 'Import failed'));
              resolve();
            },
          );
        });
      });
      loads.set(attempt, entry);
      cache = entry;
    }

    if (cache.error) throw cache.error;
    if (!cache.Comp) throw cache.wake;
    return React.createElement(cache.Comp, props);
  }
  RetryableLazy.displayName = 'RetryableLazy';
  return RetryableLazy;
}

/**
 * Catches lazy-import and render failures for a single route/surface.
 * Prefer this over a blank Suspense frame so recovery stays visible.
 */
export class RouteLoadBoundary extends React.Component<
  RouteLoadBoundaryProps,
  RouteLoadBoundaryState
> {
  state: RouteLoadBoundaryState = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<RouteLoadBoundaryState> {
    return { error };
  }

  private retry = () => {
    this.setState((prev) => ({ error: null, attempt: prev.attempt + 1 }));
  };

  render() {
    const { children, label, fallback, testId } = this.props;
    const { error, attempt } = this.state;

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

    return (
      <RetryAttemptContext.Provider value={attempt}>
        <React.Fragment key={attempt}>{children}</React.Fragment>
      </RetryAttemptContext.Provider>
    );
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
