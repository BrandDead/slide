import { describe, expect, it, vi } from 'vitest';
import {
  AGE_GATE_STORAGE_KEY,
  hasAgeAffirmation,
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
});
