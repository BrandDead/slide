/**
 * Serialisable projection of the Block DNA catalog, shared by the export
 * script and the drift test so both describe the artifact the same way.
 *
 * Nothing in the running game imports this — it exists so the authoritative
 * Flask claim path can resolve DNA from the same card data the client uses,
 * without a second hand-maintained copy drifting out of sync.
 */

import {
  BLOCK_DNA_LIBRARY,
  CURRENT_RESOLVER_CATALOG_VERSION,
  RESOLVER_CATALOG_V1_IDS,
  type BlockDNA,
} from './blockDNA';
import { KEYWORD_RULE_SOURCE, resolveBlockDNA } from '../utils/blockDNAResolver';

/** Bumped whenever the shape of the exported artifact changes. */
export const CATALOG_EXPORT_SCHEMA = 1;

function exportCard(dna: BlockDNA) {
  return {
    id: dna.id,
    lat: dna.lat,
    lng: dna.lng,
    tags: [...dna.tags],
    zoneOverrides: dna.zoneOverrides
      ? Object.fromEntries(
          Object.entries(dna.zoneOverrides).map(([row, zone]) => [String(row), zone]),
        )
      : {},
    incomeMultiplier: dna.incomeMultiplier,
    heatDecayMultiplier: dna.heatDecayMultiplier,
    globalCoverBonus: dna.globalCoverBonus,
    startingMorale: dna.startingMorale,
    maxMembers: dna.maxMembers,
    hotBlock: dna.hotBlock,
    startingHeat: dna.startingHeat,
  };
}

export function buildCatalogExport() {
  return {
    schema: CATALOG_EXPORT_SCHEMA,
    currentVersion: CURRENT_RESOLVER_CATALOG_VERSION,
    versions: {
      v1: [...RESOLVER_CATALOG_V1_IDS],
      v2: BLOCK_DNA_LIBRARY.map((dna) => dna.id),
    },
    keywordRules: KEYWORD_RULE_SOURCE,
    cards: BLOCK_DNA_LIBRARY.map(exportCard),
  };
}

/**
 * Locations the Python resolver must reproduce exactly. Deterministic sweep —
 * regenerating this file on an unchanged catalog must produce identical bytes.
 */
export function buildParityFixture() {
  const words = [
    'Boulevard', 'Court', 'Lane', 'Way', 'Yard', 'Shore', 'Plaza', 'Lot',
    'Terrace', 'Road', 'Avenue', 'Alley', 'Beach', 'Mall', 'Garage', 'Tower',
    'Main Street', 'Commons', 'Dock', 'Penthouse',
  ];
  let s = 987654321;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);

  const cases: unknown[] = [];
  for (let i = 0; i < 400; i++) {
    const lat = Number((25 + rnd() * 24).toFixed(6));
    const lng = Number((-125 + rnd() * 55).toFixed(6));
    const address = `${100 + i} Sample ${words[Math.floor(rnd() * words.length)]}, City, ST`;
    for (const version of ['v1', 'v2'] as const) {
      const r = resolveBlockDNA(lat, lng, address, version);
      cases.push({
        lat,
        lng,
        address,
        catalogVersion: version,
        expected: {
          dnaId: r.dna.id,
          zoneLayout: r.zoneLayout,
          incomeMultiplier: r.incomeMultiplier,
          heatDecayMultiplier: r.dna.heatDecayMultiplier,
          globalCoverBonus: r.dna.globalCoverBonus,
          startingMorale: r.startingMorale,
          maxMembers: r.maxMembers,
          startingHeat: r.startingHeat,
          hotBlock: r.dna.hotBlock,
        },
      });
    }
  }
  return { schema: CATALOG_EXPORT_SCHEMA, cases };
}
