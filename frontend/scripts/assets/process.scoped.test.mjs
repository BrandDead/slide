import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = path.join(frontend, 'public/assets/generated/environments/street/block_scoped_pipeline_test_v001.png');
const manifest = path.join(frontend, 'src/assets/runtimeManifest.json');
const runtime = path.join(frontend, 'public/assets/runtime/generated/environments/street/block_scoped_pipeline_test_v001.webp');
const rel = 'generated/environments/street/block_scoped_pipeline_test_v001.png';
function run(...args) {
  return spawnSync(process.execPath, ['scripts/assets/process.mjs', ...args], {
    cwd: frontend, encoding: 'utf8', timeout: 120000,
  });
}

test('exact-source dry run ignores unrelated legacy art and retains the registered manifest without writes', async () => {
  await fs.mkdir(path.dirname(source), { recursive: true });
  const before = await fs.readFile(manifest);
  try {
    await sharp({ create: { width: 48, height: 32, channels: 3, background: '#23374a' } }).png().toFile(source);
    const result = run(`--only=${rel}`);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /1 source images/);
    assert.match(result.stdout, /Retaining \d+ registered runtime images/);
    assert.match(result.stdout, /block_scoped_pipeline_test_v001/);
    assert.doesNotMatch(result.stdout, /icons\/apps\/market\/hover\.png ->/);
    assert.deepEqual(await fs.readFile(manifest), before);
    await assert.rejects(fs.stat(runtime), { code: 'ENOENT' });
    assert.ok((await fs.stat(source)).isFile());
  } finally { await fs.rm(source, { force: true }); }
});

test('refuses traversal and runtime paths rather than expanding scope', () => {
  for (const invalid of ['../outside.png', '/tmp/outside.png', 'runtime/private.png', 'generated/../../icons/apps/market/hover.png']) {
    const result = run(`--only=${invalid}`);
    assert.notEqual(result.status, 0, `unsafe source ${invalid} must fail`);
    assert.match(result.stderr, /Invalid --only source/);
  }
});
