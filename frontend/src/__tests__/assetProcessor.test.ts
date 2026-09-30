// @vitest-environment node
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

const run = promisify(execFile);
const temporary: string[] = [];
const oldId = 'characters.topdown.character_shooter_existing_topdown_idle_v001';
const sourceName = 'character_rival_nightfall_topdown_idle_v001.png';

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'slide-assets-'));
  temporary.push(root);
  const frontend = path.join(root, 'frontend');
  const script = path.join(frontend, 'scripts/assets/process.mjs');
  await fs.mkdir(path.dirname(script), { recursive: true });
  await fs.copyFile(path.resolve('scripts/assets/process.mjs'), script);
  await fs.symlink(path.resolve('node_modules'), path.join(frontend, 'node_modules'), 'dir');
  const runtime = path.join(frontend, 'public/assets/runtime/characters/topdown/character_shooter_existing_topdown_idle_v001.webp');
  const manifest = path.join(frontend, 'src/assets/runtimeManifest.json');
  const source = path.join(frontend, 'public/assets/characters/topdown', sourceName);
  const pixels = Buffer.alloc(8 * 8 * 4);
  pixels.set([180, 60, 40, 255], 4 * 27);
  const image = sharp(pixels, { raw: { width: 8, height: 8, channels: 4 } });
  const webp = await image.clone().webp().toBuffer();
  await fs.mkdir(path.dirname(runtime), { recursive: true });
  await fs.mkdir(path.dirname(manifest), { recursive: true });
  await fs.mkdir(path.dirname(source), { recursive: true });
  await fs.writeFile(runtime, webp);
  await image.png().toFile(source);
  const entry = {
    id: oldId, runtimePath: '/assets/runtime/characters/topdown/character_shooter_existing_topdown_idle_v001.webp',
    sourcePath: 'art-src/characters/topdown/character_shooter_existing_topdown_idle_v001.png',
    class: 'actor-topdown', role: 'shooter', state: 'idle', width: 8, height: 8,
    bytes: webp.length, hasAlpha: true, fringeRatio: 0, pivot: { x: 0.5, y: 0.5 }, alphaRepaired: false,
  };
  await fs.writeFile(manifest, JSON.stringify({ budgetMB: 20, totalBytes: webp.length, entries: [entry] }));
  return { root, frontend, script, runtime, manifest, source, entry };
}

afterEach(async () => {
  await Promise.all(temporary.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

describe('asset processor incremental imports', () => {
  it('retains registered actors when importing a new actor and on a repeated no-op write', async () => {
    const f = await fixture();
    const oldPixels = await fs.readFile(f.runtime);
    await run(process.execPath, [f.script, '--write']);
    const first = JSON.parse(await fs.readFile(f.manifest, 'utf8'));
    expect(first.entries).toContainEqual(f.entry);
    expect(first.entries).toHaveLength(2);
    expect(first.totalBytes).toBe(first.entries.reduce((sum: number, e: { bytes: number }) => sum + e.bytes, 0));
    expect(await fs.readFile(f.runtime)).toEqual(oldPixels);
    const firstManifest = await fs.readFile(f.manifest, 'utf8');
    await run(process.execPath, [f.script, '--write']);
    expect(await fs.readFile(f.manifest, 'utf8')).toBe(firstManifest);
  });

  it('replaces one matching registration without duplicating it or counting its old bytes', async () => {
    const f = await fixture();
    const replacement = path.join(path.dirname(f.source), 'character_shooter_existing_topdown_idle_v001.png');
    await fs.rename(f.source, replacement);
    const master = await fs.readFile(replacement);
    await run(process.execPath, [f.script, '--write']);
    const result = JSON.parse(await fs.readFile(f.manifest, 'utf8'));
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe(oldId);
    expect(result.totalBytes).toBe((await fs.stat(f.runtime)).size);
    expect(await fs.readFile(path.join(f.root, result.entries[0].sourcePath))).toEqual(master);
  });

  it('leaves source and manifest untouched during a dry run', async () => {
    const f = await fixture();
    const before = await fs.readFile(f.manifest);
    await run(process.execPath, [f.script]);
    expect(await fs.readFile(f.manifest)).toEqual(before);
    expect((await fs.stat(f.source)).size).toBeGreaterThan(0);
    await expect(fs.stat(path.join(f.root, 'art-src'))).rejects.toThrow();
  });

  it('shows every staged input in the dry-run plan, including small unrelated images beyond the largest ten', async () => {
    const f = await fixture();
    const names = Array.from({ length: 12 }, (_, index) => `unrelated-${index}.png`);
    const dir = path.join(f.frontend, 'public/assets/ui/icons');
    await fs.mkdir(dir, { recursive: true });
    for (const name of names) await fs.copyFile(f.source, path.join(dir, name));
    const { stdout } = await run(process.execPath, [f.script]);
    for (const name of names) expect(stdout).toContain(`ui/icons/${name} -> /assets/runtime/ui/icons/${name.replace('.png', '.webp')}`);
    expect(stdout).toContain('Retaining 1 registered runtime images');
  });

  it('refuses a missing registered runtime file before consuming staged sources', async () => {
    const f = await fixture();
    const before = await fs.readFile(f.manifest);
    await fs.unlink(f.runtime);
    await expect(run(process.execPath, [f.script, '--write'])).rejects.toThrow(/registered runtime/i);
    expect(await fs.readFile(f.manifest)).toEqual(before);
    expect((await fs.stat(f.source)).size).toBeGreaterThan(0);
  });

  it('counts retained runtime bytes and refuses an over-budget plan before any write', async () => {
    const f = await fixture();
    await fs.appendFile(f.runtime, Buffer.alloc(20 * 1048576));
    const before = await fs.readFile(f.manifest);
    await expect(run(process.execPath, [f.script, '--write'])).rejects.toThrow(/budget/i);
    expect(await fs.readFile(f.manifest)).toEqual(before);
    expect((await fs.stat(f.source)).size).toBeGreaterThan(0);
    await expect(fs.stat(path.join(f.root, 'art-src'))).rejects.toThrow();
  });

  it.each(['runtime/unregistered.bin', 'packages/blocks/test/scene.glb'])('includes shipped %s in the global budget', async relative => {
    const f = await fixture();
    const shipped = path.join(f.frontend, 'public/assets', relative);
    await fs.mkdir(path.dirname(shipped), { recursive: true });
    await fs.writeFile(shipped, Buffer.alloc(20 * 1048576));
    const before = await fs.readFile(f.manifest);
    await expect(run(process.execPath, [f.script, '--write'])).rejects.toThrow(/budget/i);
    expect(await fs.readFile(f.manifest)).toEqual(before);
    expect((await fs.stat(f.source)).size).toBeGreaterThan(0);
  });
});
