import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StartupErrorBoundary from './StartupErrorBoundary';

function ThrowError({ message }: { message: string }): never {
  throw new Error(message);
}

describe('StartupErrorBoundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('explains missing Supabase configuration instead of leaving a blank application frame', () => {
    render(
      <StartupErrorBoundary>
        <ThrowError message="Missing Supabase environment variables. Check your .env file." />
      </StartupErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /system configuration required/i })).toBeInTheDocument();
    expect(screen.getByText(/missing a required service configuration/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry startup/i })).toBeInTheDocument();
  });

  it('shows a neutral recovery state for unexpected bootstrap failures', () => {
    render(
      <StartupErrorBoundary>
        <ThrowError message="Unexpected lazy module failure" />
      </StartupErrorBoundary>
    );

    expect(screen.getByRole('heading', { name: /system unavailable/i })).toBeInTheDocument();
    expect(screen.getByText(/could not finish starting/i)).toBeInTheDocument();
  });
});
