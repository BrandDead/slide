import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/components/hub/Leaderboard.tsx'), 'utf8');

describe('Leaderboard browser boundary', () => {
  it('does not call the service-role-only leaderboard RPC from the browser', () => {
    expect(source).not.toMatch(/\.rpc\(\s*['"]get_leaderboard['"]/);
  });
});
