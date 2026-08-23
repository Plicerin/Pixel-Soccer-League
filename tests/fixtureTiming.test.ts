import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyFixtureClockProgress,
  computeFixtureTimeoutMs,
  computeWatchedFixtureSpeedMul,
  getFixtureElapsedSimSeconds,
} from '../src/fixtureTiming';

test('V37 watched fixture timeout budget exceeds expected visual runtime', () => {
  assert.equal(computeWatchedFixtureSpeedMul(300), 1);
  const timeoutMs = computeFixtureTimeoutMs({ halfSeconds: 300, speedMul: 1 });
  assert.ok(timeoutMs >= 420_000);
  assert.ok(timeoutMs > 300 * 2 * 1000);
});

test('V37 watched fixture classifies slow browser clock separately from match timeout', () => {
  assert.equal(
    classifyFixtureClockProgress({ wallElapsedMs: 420_000, simElapsedSeconds: 60.9, speedMul: 4 }),
    'clock_too_slow',
  );
  assert.equal(
    classifyFixtureClockProgress({ wallElapsedMs: 180_000, simElapsedSeconds: 500, speedMul: 4 }),
    null,
  );
  assert.equal(getFixtureElapsedSimSeconds({ half: 2, elapsedInHalf: 12 }, 300), 312);
  assert.equal(getFixtureElapsedSimSeconds({ half: 1, elapsedInHalf: 900, halfDuration: 2700, runtimeHalfDuration: 300, matchClockScale: 9 }, 300), 100);
});

test('V38 slow watched fixture clock is not terminal while it is still progressing', () => {
  const reason = classifyFixtureClockProgress({ wallElapsedMs: 420_000, simElapsedSeconds: 156.2, speedMul: 1 });
  assert.equal(reason, null);
});
