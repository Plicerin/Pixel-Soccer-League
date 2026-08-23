import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const cli = path.join(root, 'scripts', 'psl.mjs');

function run(args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}

test('psl doctor emits stable JSON', () => {
  const result = run(['--json', 'doctor']);
  assert.equal(result.status, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.ok, true);
  assert.equal(typeof body.data.version, 'string');
  assert.ok(Array.isArray(body.data.checks));
});

test('psl kpi scoreboard reports rows without refreshing', () => {
  const result = run(['--json', 'kpi', 'scoreboard']);
  assert.equal(result.status, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.data.red));
  assert.ok(body.data.counts);
});

test('psl rejects unknown commands as machine-readable errors', () => {
  const result = run(['--json', 'unknown']);
  assert.equal(result.status, 1);
  const body = JSON.parse(result.stdout);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'USAGE');
});
