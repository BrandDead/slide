import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { RouteLoadBoundary, LazyRoute, createRetryableLazy } from './RouteLoadBoundary';

function Boom(): React.ReactElement {
  throw new Error('WebGL unavailable');
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('RouteLoadBoundary', () => {
  it('shows recovery UI and keeps the fallback board when a heavy surface fails', () => {
    render(
      <RouteLoadBoundary
        label="Encounter"
        fallback={<div data-testid="legal-board">8×8 legal board</div>}
      >
        <Boom />
      </RouteLoadBoundary>,
    );

    expect(screen.getByRole('alert').textContent).toMatch(/encounter could not load/i);
    expect(screen.getByTestId('legal-board')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry encounter/i })).toBeInTheDocument();
  });

  it('retries and remounts children after a synchronous render failure', () => {
    let shouldThrow = true;
    function Flaky(): React.ReactElement {
      if (shouldThrow) throw new Error('chunk failed');
      return <div>Ready</div>;
    }

    render(
      <RouteLoadBoundary label="MAP">
        <Flaky />
      </RouteLoadBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /retry map/i }));
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('retries a rejected React.lazy import with a fresh loader attempt', async () => {
    let attempts = 0;
    const LazySurface = createRetryableLazy(() => {
      attempts += 1;
      if (attempts === 1) {
        return Promise.reject(new Error('Failed to fetch dynamically imported module'));
      }
      return Promise.resolve({ default: () => <div>Lazy ready</div> });
    });

    render(
      <LazyRoute label="MAP">
        <LazySurface />
      </LazyRoute>,
    );

    expect(screen.getByTestId('route-loading')).toBeInTheDocument();
    await flushMicrotasks();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/failed to fetch dynamically imported module/i)).toBeInTheDocument();
    expect(attempts).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: /retry map/i }));
    await flushMicrotasks();

    expect(await screen.findByText('Lazy ready')).toBeInTheDocument();
    expect(attempts).toBe(2);
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('shows a loading status while a lazy route suspends', async () => {
    let resolveImport: (value: { default: React.FC }) => void = () => undefined;
    const delayed = new Promise<{ default: React.FC }>((resolve) => {
      resolveImport = resolve;
    });
    const LazySurface = createRetryableLazy(() => delayed);

    render(
      <LazyRoute label="Strip">
        <LazySurface />
      </LazyRoute>,
    );

    expect(screen.getByTestId('route-loading')).toBeInTheDocument();
    expect(screen.getByText(/loading strip/i)).toBeInTheDocument();

    await act(async () => {
      resolveImport({ default: () => <div>Strip ready</div> });
      await delayed;
      await Promise.resolve();
    });

    expect(await screen.findByText('Strip ready')).toBeInTheDocument();
  });
});
