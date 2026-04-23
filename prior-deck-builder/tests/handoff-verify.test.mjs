import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('handoff verification script passes end to end', () => {
  const result = spawnSync(process.execPath, ['scripts/verify-handoff.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /handoff verification passed/);
});
