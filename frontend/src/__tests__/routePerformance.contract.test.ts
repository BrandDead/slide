/**
 * Source contracts for closed-beta route performance.
 * Guarantees heavy engines stay behind React.lazy / dynamic import
 * so the initial demo shell does not evaluate them.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('route performance contracts', () => {
  it('keeps TerritoryMap (MapLibre / Strip stack) behind React.lazy in App', () => {
    const app = read('App.tsx');
    expect(app).toMatch(/React\.lazy\(\(\)\s*=>\s*import\('\.\/components\/map\/TerritoryMap'\)\)/);
    expect(app).not.toMatch(/import TerritoryMap from '\.\/components\/map\/TerritoryMap'/);
  });

  it('keeps BlockLoopDesk behind React.lazy and preserves #147 tutorial clearance', () => {
    const app = read('App.tsx');
    expect(app).toMatch(/React\.lazy\(\(\)\s*=>\s*import\('\.\/components\/layout\/BlockLoopDesk'\)\)/);
    expect(app).toMatch(/TutorialOverlay\s+hidden=\{currentApp === 'block_loop'\}/);
  });

  it('does not eagerly import Phaser engines from the Block Loop desk', () => {
    const desk = read('components/layout/BlockLoopDesk.tsx');
    expect(desk).toMatch(/lazy\(\(\)\s*=>\s*import\('\.\.\/encounter\/UnifiedEncounter'\)\)/);
    expect(desk).not.toMatch(/import UnifiedEncounter from '\.\.\/encounter\/UnifiedEncounter'/);
  });

  it('does not eagerly import Phaser from BlockModeView (MAP Strip)', () => {
    const view = read('components/map/BlockModeView.tsx');
    expect(view).toMatch(/lazy\(\(\)\s*=>\s*import\('\.\.\/encounter\/UnifiedEncounter'\)\)/);
    expect(view).not.toMatch(/import UnifiedEncounter from '\.\.\/encounter\/UnifiedEncounter'/);
  });

  it('splits MapLibre into an intentional vendor chunk and leaves Mapbox out of optimizeDeps', () => {
    const vite = readFileSync(resolve(root, '../vite.config.ts'), 'utf8');
    expect(vite).toMatch(/maplibre-gl/);
    expect(vite).toMatch(/vendor-maplibre|route-map/);
    expect(vite).not.toMatch(/optimizeDeps:\s*\{[^}]*include:\s*\[[^\]]*mapbox-gl/s);
  });
});
