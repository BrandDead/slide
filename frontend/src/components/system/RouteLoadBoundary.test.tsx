import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RouteLoadBoundary, LazyRoute } from './RouteLoadBoundary';

function Boom(): React.ReactElement {
  throw new Error('WebGL unavailable');
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

  it('retries and remounts children after a failure', () => {
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

  it('shows a loading status while a lazy route suspends', async () => {
    let resolveImport: (value: { default: React.FC }) => void = () => undefined;
    const delayed = new Promise<{ default: React.FC }>((resolve) => {
      resolveImport = resolve;
    });
    const LazySurface = React.lazy(() => delayed);

    render(
      <LazyRoute label="Strip">
        <LazySurface />
      </LazyRoute>,
    );

    expect(screen.getByTestId('route-loading')).toBeInTheDocument();
    expect(screen.getByText(/loading strip/i)).toBeInTheDocument();

    resolveImport({ default: () => <div>Strip ready</div> });
    expect(await screen.findByText('Strip ready')).toBeInTheDocument();
  });
});
