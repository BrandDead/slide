import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AgeGate, {
  AGE_GATE_STORAGE_KEY,
  DEMO_EVALUATION_COPY,
  hasAgeAffirmation,
  initialAgeAffirmed,
  saveAgeAffirmation,
} from './AgeGate';

describe('age affirmation storage', () => {
  it('recognizes only the explicit confirmed value', () => {
    expect(hasAgeAffirmation({ getItem: () => 'confirmed' })).toBe(true);
    expect(hasAgeAffirmation({ getItem: () => null })).toBe(false);
    expect(hasAgeAffirmation({ getItem: () => 'true' })).toBe(false);
  });

  it('fails closed when storage cannot be read', () => {
    expect(hasAgeAffirmation({
      getItem: () => {
        throw new Error('storage disabled');
      },
    })).toBe(false);
  });

  it('writes the versioned key and explicit confirmation value', () => {
    const setItem = vi.fn();
    saveAgeAffirmation({ setItem });
    expect(setItem).toHaveBeenCalledWith(AGE_GATE_STORAGE_KEY, 'confirmed');
  });

  it('keeps the 18+ gate active for demo evaluation builds until local acknowledgement', () => {
    expect(initialAgeAffirmed({ getItem: () => null })).toBe(false);
    expect(initialAgeAffirmed({ getItem: () => 'confirmed' })).toBe(true);
  });
});

describe('AgeGate demo evaluation chrome', () => {
  it('shows the mature-content gate and evaluation banner without skipping 18+', () => {
    const onConfirm = vi.fn();
    render(<AgeGate evaluationBuild onConfirm={onConfirm} />);
    expect(screen.getByTestId('demo-evaluation-banner')).toHaveTextContent(DEMO_EVALUATION_COPY.kicker);
    expect(screen.getByRole('button', { name: /i am 18\+ — continue/i })).toBeInTheDocument();
    expect(screen.getByText(/stored only on this device/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /i am 18\+ — continue/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
