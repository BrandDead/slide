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

// ─────────────────────────────────────────────────────────────
// Sprite coverage batch 2
//
// The bug these cover: every first-generation top-down sprite was named
// `character_{role}_{sex}_topdown_v001.png` with no state token, so
// `process.mjs::parseName` recorded `state: null`. The resolver only indexes
// assets that have BOTH a role and a state, so top-down art was reachable
// only through the last-resort byRole pass — and a downed or arrested member
// rendered standing upright in the raid and block scenes.
// ─────────────────────────────────────────────────────────────

describe('top-down view — state must be honoured', () => {
  it('indexes a top-down idle for every deployable role', () => {
    for (const role of ['dealer', 'shooter', 'enforcer', 'lookout', 'driver', 'recruit']) {
      const a = getWorldActor(role, 'idle', 'topdown');
      expect(a, role).not.toBeNull();
    }
  });

  it('never renders a downed member standing in the top-down view', () => {
    // This is the assertion that would have caught the original bug: before
    // the rename, resolvedState came back as 'idle' for every one of these.
    for (const role of ['dealer', 'shooter', 'enforcer', 'lookout']) {
      const a = getWorldActor(role, 'downed', 'topdown');
      expect(a, role).not.toBeNull();
      expect(['downed', 'dead', 'hit'], `${role} downed -> ${a!.resolvedState}`)
        .toContain(a!.resolvedState);
    }
  });

  it('renders arrested as restrained, not as a standing or downed pose', () => {
    for (const role of ['dealer', 'shooter', 'enforcer', 'lookout']) {
      const a = getWorldActor(role, 'arrested', 'topdown');
      expect(a, role).not.toBeNull();
      expect(a!.resolvedState, `${role} arrested -> ${a!.resolvedState}`).toBe('arrested');
    }
  });

  it('resolves top-down art from the top-down view, not a street sprite', () => {
    const a = getWorldActor('shooter', 'downed', 'topdown');
    expect(a!.url).toMatch(/\/topdown\//);
  });

  it('uses a centre pivot for top-down actors', () => {
    const a = getWorldActor('shooter', 'idle', 'topdown');
    expect(a!.pivot).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe('isolated roles must never borrow another role\'s art', () => {
  // A k9 wearing a hooded man's silhouette, or a police unit wearing a gang
  // shooter's, actively misinforms the player about what is on the tile. Both
  // roles declare a single-entry ROLE_CHAIN, which suppresses the cross-role
  // Pass 2 search.

  it('resolves k9 art that is actually k9 art', () => {
    for (const view of ['street', 'topdown', 'fullbody'] as const) {
      const a = getWorldActor('k9', 'idle', view);
      expect(a, `k9/${view}`).not.toBeNull();
      expect(a!.url, `k9/${view} -> ${a!.url}`).toMatch(/character_k9_/);
    }
  });

  it('never dresses a k9 in a human sprite for a state it lacks', () => {
    // k9 has no 'aim' or 'arrested' art. The resolver must degrade within the
    // k9 set or return null — never reach for a person.
    for (const state of ['aim', 'fire', 'arrested', 'seated'] as const) {
      const a = getWorldActor('k9', state, 'street');
      if (a) expect(a.url, `k9/${state} -> ${a.url}`).toMatch(/character_k9_/);
    }
  });

  it('keeps police art out of gang roles and gang art out of police', () => {
    const police = getWorldActor('police', 'idle', 'topdown');
    if (police) expect(police.url).toMatch(/character_police_/);

    for (const role of ['dealer', 'shooter', 'enforcer', 'lookout']) {
      for (const state of ['idle', 'downed', 'arrested'] as const) {
        const a = getWorldActor(role, state, 'topdown');
        expect(a!.url, `${role}/${state} leaked police art`).not.toMatch(/character_police_/);
      }
    }
  });

  it('reports k9 and police as known roles in the manifest', () => {
    const roles = manifestStats().roles;
    expect(roles).toContain('k9');
    expect(roles).toContain('police');
  });
});

describe('street coverage added in batch 2', () => {
  it('gives shooter and dealer a true idle rather than an aim pose', () => {
    for (const role of ['shooter', 'dealer']) {
      const a = getWorldActor(role, 'idle', 'street');
      expect(a!.resolvedState, `${role} idle -> ${a!.resolvedState}`).toBe('idle');
      expect(a!.isFallback, `${role} idle should now be exact`).toBe(false);
    }
  });

  it('gives lookout, driver and recruit their own street idle', () => {
    for (const role of ['lookout', 'driver', 'recruit']) {
      const a = getWorldActor(role, 'idle', 'street');
      expect(a!.isFallback, `${role} idle should now be exact`).toBe(false);
      expect(a!.url).toMatch(new RegExp(`character_${role}_`));
    }
  });

  it('gives recruit a fullbody roster pose of its own', () => {
    const a = getWorldActor('recruit', 'idle', 'fullbody');
    expect(a!.url).toMatch(/character_recruit_male_fullbody_front/);
  });

  it('resolves k9 alert as a distinct pose from k9 idle', () => {
    const idle = getWorldActor('k9', 'idle', 'street');
    const alert = getWorldActor('k9', 'alert', 'street');
    expect(alert!.resolvedState).toBe('alert');
    expect(alert!.url).not.toBe(idle!.url);
  });
});
