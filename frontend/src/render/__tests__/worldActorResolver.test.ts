import { describe, it, expect, beforeEach } from 'vitest';
import {
  getWorldActor, getPortrait, manifestStats, resetWarnings,
} from '../worldActorResolver';

beforeEach(() => resetWarnings());

describe('world actor resolution', () => {
  it('has a populated manifest', () => {
    const s = manifestStats();
    expect(s.total).toBeGreaterThan(0);
    expect(s.indexed).toBeGreaterThan(0);
  });

  it('never returns a portrait as a world actor', () => {
    for (const role of ['dealer', 'shooter', 'enforcer', 'lookout', 'driver']) {
      const a = getWorldActor(role, 'idle', 'street');
      if (a) expect(a.url).not.toMatch(/\/portraits\//);
    }
  });

  it('resolves a world actor for every core role', () => {
    for (const role of ['dealer', 'shooter', 'enforcer', 'lookout', 'driver']) {
      expect(getWorldActor(role, 'idle', 'street')).not.toBeNull();
    }
  });

  it('always returns a foot-contact pivot for street actors', () => {
    const a = getWorldActor('dealer', 'idle', 'street');
    expect(a).not.toBeNull();
    expect(a!.pivot.y).toBe(1.0);
    expect(a!.pivot.x).toBe(0.5);
  });

  it('falls back deterministically — same input, same output', () => {
    const a = getWorldActor('recruit', 'reload', 'street');
    const b = getWorldActor('recruit', 'reload', 'street');
    expect(a).toEqual(b);
  });

  it('marks fallbacks so callers can degrade UI honestly', () => {
    const exact = getWorldActor('dealer', 'aim', 'street');
    expect(exact?.isFallback).toBe(false);
    const fell = getWorldActor('chemist', 'reload', 'street');
    expect(fell?.isFallback).toBe(true);
  });

  it('never returns null for a known role, in any state', () => {
    const states = ['idle','walk','aim','fire','reload','hit','wounded','downed','dead','arrested','seated','driving','alert'] as const;
    for (const role of ['dealer','shooter','enforcer','lookout','driver','recruit','boss']) {
      for (const s of states) {
        expect(getWorldActor(role, s, 'street'), `${role}/${s}`).not.toBeNull();
      }
    }
  });

  it('prefers aim over idle when fire art is missing', () => {
    const fire = getWorldActor('dealer', 'fire', 'street');
    expect(['fire', 'aim']).toContain(fire!.resolvedState);
  });

  it('exposes portraits only through getPortrait', () => {
    const p = getPortrait('dealer');
    expect(p).toMatch(/\/portraits\//);
  });

  it('reports zero actor sprites still missing alpha', () => {
    expect(manifestStats().missingAlpha).toEqual([]);
  });
});

describe('fallback correctness — state beats role', () => {
  it('never renders a downed member as a standing pose', () => {
    for (const role of ['dealer','shooter','enforcer','lookout','driver','recruit','boss']) {
      const a = getWorldActor(role, 'downed', 'street');
      expect(a, role).not.toBeNull();
      expect(['downed','dead','hit'], `${role} downed -> ${a!.resolvedState}`)
        .toContain(a!.resolvedState);
    }
  });

  it('never renders a hit member as idle', () => {
    for (const role of ['dealer','shooter','enforcer','lookout','driver']) {
      const a = getWorldActor(role, 'hit', 'street');
      expect(['hit','wounded','downed'], `${role} hit -> ${a!.resolvedState}`)
        .toContain(a!.resolvedState);
    }
  });
});
