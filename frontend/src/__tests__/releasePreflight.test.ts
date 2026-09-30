// @vitest-environment node
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const run = promisify(execFile);
const temporary: string[] = [];

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'slide-preflight-'));
  temporary.push(root);
  const bin = path.join(root, 'fake-bin');
  const backend = path.join(root, 'backend/python');
  await fs.mkdir(bin, { recursive: true });
  await fs.mkdir(path.join(root, 'frontend'), { recursive: true });
  await fs.mkdir(path.join(backend, 'venv/bin'), { recursive: true });
  await fs.writeFile(path.join(root, 'frontend/package.json'), '{}');
  await fs.writeFile(path.join(backend, 'app.py'), '# baseline\n');
  for (const name of ['npm', 'npx']) await fs.writeFile(path.join(bin, name), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  await fs.writeFile(path.join(backend, 'venv/bin/python'), '#!/bin/sh\nprintf "%s\\n" "$*" > "$TASK_PREFLIGHT_MARKER"\n', { mode: 0o755 });
  const script = path.join(root, 'preflight.sh');
  await fs.copyFile(path.resolve('../.agents/skills/slide-release-safety/scripts/preflight.sh'), script);
  const git = (...args: string[]) => run('git', args, { cwd: root });
  await git('init', '-q');
  await git('config', 'user.name', 'Preflight regression');
  await git('config', 'user.email', 'preflight@example.invalid');
  await git('add', '.');
  await git('commit', '-qm', 'fixture baseline');
  const marker = path.join(root, 'pytest-ran');
  const preflight = () => run('bash', [script], { cwd: root, env: { ...process.env, BASE_REF: 'HEAD', PATH: `${bin}:${process.env.PATH}`, TASK_PREFLIGHT_MARKER: marker } });
  return { root, backend, marker, git, preflight };
}

afterEach(async () => {
  await Promise.all(temporary.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

describe('release preflight working-tree backend detection', () => {
  it.each(['staged', 'unstaged', 'untracked'] as const)('runs backend tests for %s Python changes', async mode => {
    const f = await fixture();
    await fs.writeFile(path.join(f.backend, mode === 'untracked' ? 'new_route.py' : 'app.py'), '# changed\n');
    if (mode === 'staged') await f.git('add', 'backend/python/app.py');
    await f.preflight();
    expect(await fs.readFile(f.marker, 'utf8')).toBe('-m pytest tests -q\n');
  });

  it('skips backend tests when neither the branch nor working tree touches Python', async () => {
    const f = await fixture();
    await f.preflight();
    await expect(fs.stat(f.marker)).rejects.toThrow();
  });
});
