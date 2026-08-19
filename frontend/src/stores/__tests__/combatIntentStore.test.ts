import { beforeEach, describe, expect, it } from 'vitest';
import { useCombatIntentStore } from '../../stores/combatIntentStore';

describe('combatIntentStore', () => {
  beforeEach(() => {
    useCombatIntentStore.getState().reset();
  });

  it('hands a Maps pin to drive-by and consumes it', () => {
    useCombatIntentStore.getState().setPendingTarget({
      address: 'Sistrunk Blvd',
      lat: 26.13,
      lng: -80.14,
      seedMode: 'geocoded',
    });
    const once = useCombatIntentStore.getState().consumePendingTarget();
    expect(once?.address).toBe('Sistrunk Blvd');
    expect(useCombatIntentStore.getState().pendingTarget).toBeNull();
  });
});
