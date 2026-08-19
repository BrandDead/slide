import { describe, expect, it } from 'vitest';
import { PhaserReadyGate } from '../phaserSceneReady';
import { isUsableMapboxToken } from '../../config/mapboxToken';

describe('PhaserReadyGate', () => {
  it('fires queued callbacks once the scene marks ready', () => {
    const gate = new PhaserReadyGate();
    const order: string[] = [];
    gate.whenReady(() => order.push('a'));
    expect(gate.isReady).toBe(false);
    gate.markReady();
    gate.whenReady(() => order.push('b'));
    expect(order).toEqual(['a', 'b']);
    expect(gate.isReady).toBe(true);
  });
});

describe('isUsableMapboxToken', () => {
  it('rejects dummy and short tokens that black the GL canvas', () => {
    expect(isUsableMapboxToken('')).toBe(false);
    expect(isUsableMapboxToken('pk.dummy')).toBe(false);
    expect(isUsableMapboxToken('pk.placeholder_token_value_here')).toBe(false);
  });

  it('accepts a plausible Mapbox public token', () => {
    expect(isUsableMapboxToken('pk.eyJ1IjoidGVzdCIsImEiOiJjbG9uZ3Rva2VuMTIzNDU2Nzg5MCJ9.abc')).toBe(true);
  });
});
