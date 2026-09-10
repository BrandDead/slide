/**
 * Export the Block DNA catalog (and a cross-language parity fixture) for the
 * authoritative Flask claim path.
 *
 * The TypeScript catalog in src/config/blockDNA.ts is the single source of
 * truth. The backend must resolve DNA itself — it cannot trust a
 * client-supplied dnaId — so it reads this generated JSON instead of keeping a
 * second hand-maintained copy of the card data.
 *
 * Run:  npm run export:block-dna
 * Drift is enforced by src/config/__tests__/blockDNACatalogExport.test.ts and
 * by the Python parity test, so this file must be re-run whenever the catalog,
 * the frozen version pools, or the resolver's keyword rules change.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalogExport, buildParityFixture } from '../src/config/blockDNAExport';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

const targets: [string, unknown, number | undefined][] = [
  // Human-inspectable: reviewers should be able to read the card data.
  [resolve(repoRoot, 'backend/python/data/block_dna_catalog.json'), buildCatalogExport(), 2],
  // Machine-only golden: kept compact so it stays reviewable as a diff.
  [resolve(repoRoot, 'backend/python/tests/fixtures/dna_resolver_parity.json'), buildParityFixture(), undefined],
];

for (const [path, payload, indent] of targets) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, indent)}\n`);
  console.log(`wrote ${path}`);
}
