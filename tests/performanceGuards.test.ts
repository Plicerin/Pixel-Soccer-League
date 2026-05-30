import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('telemetry status routes avoid full hot-log parsing', () => {
  const config = readFileSync('vite.config.ts', 'utf-8');
  const statusRoute = config.slice(
    config.indexOf("server.middlewares.use('/__telemetry/mirror-status'"),
    config.indexOf("server.middlewares.use('/__telemetry/shot-events'"),
  );
  const recoverRoute = config.slice(
    config.indexOf("server.middlewares.use('/__telemetry/recover-latest'"),
    config.indexOf('/** SQLite-backed tuning relay'),
  );

  assert.ok(statusRoute.includes('readLatestNdjsonLine(batchFilePath)'));
  assert.ok(recoverRoute.includes('readLatestNdjsonLine(batchFilePath)'));
  assert.equal(statusRoute.includes('readNdjsonFile(batchFilePath)'), false);
  assert.equal(recoverRoute.includes('readNdjsonFile(batchFilePath)'), false);
});

test('initial React shell does not statically import heavy game/debug modules', () => {
  const shell = readFileSync('src/components/RetroFootball.tsx', 'utf-8');
  assert.equal(shell.includes("import { initGame } from '../gameEngine'"), false);
  assert.equal(shell.includes("import FrameViewer from './FrameViewer'"), false);
  assert.equal(shell.includes("import AnimationInspector from './AnimationInspector'"), false);
  assert.equal(shell.includes("import MatchHistoryDashboard from './MatchHistoryDashboard'"), false);
  assert.equal(shell.includes("import LiveTelemetry from './LiveTelemetry'"), false);
  assert.ok(shell.includes("await import('../gameEngine')"));
  assert.ok(shell.includes("if (!gameRef.current)"));
  assert.ok(shell.includes("React.lazy(() => import('./FrameViewer'))"));
});

test('BUG-RUNTIME-001 dev and preview wrappers do not leave stale helper servers', () => {
  for (const file of ['scripts/dev.mjs', 'scripts/preview.mjs']) {
    const source = readFileSync(file, 'utf-8');
    assert.match(source, /import net from 'node:net';/, `${file} must probe ports before spawning helper servers`);
    assert.match(source, /const children = new Set\(\);/, `${file} must track child processes for coordinated shutdown`);
    assert.match(source, /function shutdown\(exitCode = 0\)/, `${file} must expose a shared shutdown path`);
    assert.match(source, /for \(const child of children\) child\.kill\('SIGTERM'\);/, `${file} must kill managed children on shutdown`);
    assert.match(source, /const criticalRestartLimit = Number/, `${file} must bound critical game-server restart attempts`);
    assert.match(source, /function scheduleCriticalRestart/, `${file} must restart an unexpectedly exited critical game server`);
    assert.match(source, /spawnManaged\(label, command, args, \{ \.\.\.options, restartCount: nextCount \}\)/, `${file} must respawn the game server child after an unexpected exit`);
    assert.match(source, /exceeded restart limit/, `${file} must shut down only after bounded restart attempts are exhausted`);
    assert.match(source, /isPortListening\(wsPort\)/, `${file} must check for an existing WebSocket helper before spawning a duplicate`);
    assert.match(source, /WebSocket server already running on port \$\{wsPort\}; reusing it\./, `${file} must reuse an existing WebSocket helper instead of crashing on EADDRINUSE`);
    assert.match(source, /critical: true/, `${file} must mark the game server child as critical`);
  }
});
