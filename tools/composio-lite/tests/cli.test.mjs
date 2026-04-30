import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import test from 'node:test';

const CLI = new URL('../src/cli.mjs', import.meta.url).pathname;

function run(args, env = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    env: { ...process.env, COMPOSIO_API_KEY: '', ...env },
    encoding: 'utf8',
  });
}

test('doctor reports missing auth without failing', () => {
  const result = run(['--json', 'doctor']);
  assert.equal(result.status, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.ok, true);
  assert.equal(body.data.auth.available, false);
  assert.equal(body.data.checks[0].name, 'auth');
});

test('unknown command returns machine-readable error', () => {
  const result = run(['--json', 'nope']);
  assert.equal(result.status, 1);
  const body = JSON.parse(result.stdout);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'USAGE');
});

test('read-only guard blocks write-looking tool names', () => {
  const result = run([
    '--json',
    'actions',
    'execute',
    '--user-id',
    'default',
    '--tool',
    'GMAIL_SEND_EMAIL',
    '--args-json',
    '{}',
  ], { COMPOSIO_API_KEY: 'test-key' });
  assert.equal(result.status, 1);
  const body = JSON.parse(result.stdout);
  assert.equal(body.error.code, 'UNSAFE_TOOL_NAME');
});

test('help lists primary command families', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /accounts list/);
  assert.match(result.stdout, /actions execute/);
  assert.match(result.stdout, /request get/);
});
