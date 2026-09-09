/**
 * Drift guard for the generated Block DNA catalog artifact.
 *
 * The authoritative Flask claim path resolves DNA from
 * backend/python/data/block_dna_catalog.json. That file is generated from this
 * TypeScript catalog, so if the two ever disagree the server would stamp a
 * different tactical identity onto a block than the client would compute.
 *
 * Fix a failure by regenerating, never by editing the JSON:
 *   npm run export:block-dna
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildCatalogExport, buildParityFixture } from '../blockDNAExport';

const repoRoot = resolve(__dirname, '../../../..');
const CATALOG_PATH = resolve(repoRoot, 'backend/python/data/block_dna_catalog.json');
const PARITY_PATH = resolve(repoRoot, 'backend/python/tests/fixtures/dna_resolver_parity.json');

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf-8'));
const REGENERATE = 'Run `npm run export:block-dna` and commit the result.';

describe('generated block DNA catalog artifact', () => {
  it('matches the TypeScript catalog exactly', () => {
    expect(readJson(CATALOG_PATH), REGENERATE).toEqual(buildCatalogExport());
  });

  it('matches the TypeScript resolver parity fixture exactly', () => {
    expect(readJson(PARITY_PATH), REGENERATE).toEqual(buildParityFixture());
  });

  it('exports the frozen version pools the backend relies on', () => {
    const exported = buildCatalogExport();
    expect(exported.versions.v1).toHaveLength(25);
    expect(exported.versions.v2).toHaveLength(exported.cards.length);
    expect(new Set(exported.versions.v2)).toEqual(
      new Set(exported.cards.map((card) => card.id)),
    );
    for (const id of exported.versions.v1) {
      expect(exported.versions.v2).toContain(id);
    }
  });

  it('exports every field a snapshot needs to rebuild a block', () => {
    for (const card of buildCatalogExport().cards) {
      expect(typeof card.lat).toBe('number');
      expect(typeof card.lng).toBe('number');
      expect(Array.isArray(card.tags)).toBe(true);
      expect(typeof card.incomeMultiplier).toBe('number');
      expect(typeof card.heatDecayMultiplier).toBe('number');
      expect(typeof card.globalCoverBonus).toBe('number');
      expect(typeof card.startingMorale).toBe('number');
      expect(typeof card.maxMembers).toBe('number');
      expect(typeof card.startingHeat).toBe('number');
      expect(typeof card.hotBlock).toBe('boolean');
    }
  });

  it('exports keyword rules as JS/Python-portable pattern strings', () => {
    const rules = buildCatalogExport().keywordRules;
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule.preferredTags.length).toBeGreaterThan(0);
      for (const pattern of rule.patterns) {
        expect(typeof pattern).toBe('string');
        // Named groups, lookbehind and inline flags do not port cleanly.
        expect(pattern).not.toMatch(/\(\?[<P=!]/);
        expect(() => new RegExp(pattern, 'i')).not.toThrow();
      }
    }
  });
});
