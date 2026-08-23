import assert from 'node:assert/strict';
import test from 'node:test';
import { compactLiveDashboardPayload } from '../src/telemetry/liveDashboardPayload';
import { buildMatchResultPayload } from '../src/telemetry/matchPersistencePayload';

const rows = (count: number) => Array.from({ length: count }, (_, seq) => ({ seq }));

test('V36 full-time match persistence keeps full raw telemetry bundle', () => {
  const rawBundle = {
    teamA: { name: 'Austin FC', formation: '3-4-3', score: 0, shots: 15, shotsOnTarget: 0, saves: 0, headers: 2, possession: 50 },
    teamB: { name: 'Inter Miami', formation: '3-4-3', score: 1, shots: 8, shotsOnTarget: 1, saves: 0, headers: 1 },
    events: rows(900),
    passLog: rows(637),
    passDecisions: rows(637),
    ballFlightTelemetry: rows(637),
    headerAnimationEvents: [
      { team: 'A', playerId: 'A-9' },
      { team: 'A', playerId: 'A-10' },
      { team: 'B', playerId: 'B-4' },
    ],
  };
  const compact = compactLiveDashboardPayload({ type: 'tuning', bundle: rawBundle, live: null });

  assert.ok(compact.bundle.events.length < rawBundle.events.length);

  const payload = buildMatchResultPayload({
    bundle: rawBundle,
    snapshot: { sessionId: 'ft-test', elapsedInHalf: 300 },
    fallbackSessionId: 'unused',
    timestamp: 1,
  });
  const savedBundle = JSON.parse(payload.bundle_json);

  assert.equal(savedBundle.events.length, 900);
  assert.equal(savedBundle.passLog.length, 637);
  assert.equal(savedBundle.passDecisions.length, 637);
  assert.equal(savedBundle.ballFlightTelemetry.length, 637);
  assert.deepEqual([payload.score_a, payload.score_b], [0, 1]);
  assert.deepEqual([payload.headers_a, payload.headers_b], [2, 1]);
});

test('V154 full-time persistence falls back to model header totals without renderer audit rows', () => {
  const payload = buildMatchResultPayload({
    bundle: {
      teamA: { name: 'Germany', score: 2, shots: 12, shotsOnTarget: 5, saves: 3, headers: 4 },
      teamB: { name: 'Netherlands', score: 1, shots: 10, shotsOnTarget: 4, saves: 3, headers: 5 },
    },
    snapshot: { sessionId: 'headers-fallback', elapsedInHalf: 300 },
    fallbackSessionId: 'unused',
    timestamp: 2,
  });

  assert.deepEqual([payload.headers_a, payload.headers_b], [4, 5]);
});

test('V201 full-time persistence normalizes saved bundle team counters from terminal snapshot', () => {
  const payload = buildMatchResultPayload({
    bundle: {
      metadata: {
        runtimeHalfDuration: 300,
        matchClockScale: 9,
      },
      teamA: { name: 'Portugal', score: 1, shots: 9, shotsOnTarget: 3, saves: 1, passes: 111, passesCompleted: 88, corners: 2 },
      teamB: { name: 'Spain', score: 0, shots: 7, shotsOnTarget: 2, saves: 2, passes: 99, passesCompleted: 71, corners: 1 },
    },
    snapshot: {
      sessionId: 'ft-normalize',
      matchId: 'simple-portugal-spain',
      elapsedInHalf: 2700,
      timestamp: 123,
      runtimeHalfDuration: 300,
      matchClockScale: 9,
      seriesSpeedMul: 1,
      restartDelayGoal: 0.8,
      restartDelayHalf: 1.2,
      cpuVsCpu: true,
      interactiveHalftime: true,
      engineRuntimeToken: 'runtime-123',
      engineBootedAt: 456,
      scoreA: 2,
      scoreB: 0,
      shotsA: 21,
      shotsB: 14,
      shotsOnTargetA: 8,
      shotsOnTargetB: 4,
      savesA: 4,
      savesB: 2,
      passesA: 123,
      passesB: 97,
      passesCompletedA: 94,
      passesCompletedB: 76,
      cornersA: 2,
      cornersB: 4,
      possessionA: 50,
      possessionB: 50,
    },
    fallbackSessionId: 'unused',
    timestamp: 3,
  });

  const savedBundle = JSON.parse(payload.bundle_json);

  assert.deepEqual([payload.score_a, payload.score_b], [2, 0]);
  assert.deepEqual([payload.shots_a, payload.shots_b], [21, 14]);
  assert.deepEqual([payload.shots_on_target_a, payload.shots_on_target_b], [8, 4]);
  assert.equal(savedBundle.teamA.passes, 123);
  assert.equal(savedBundle.teamB.passes, 97);
  assert.equal(savedBundle.teamA.passesCompleted, 94);
  assert.equal(savedBundle.teamB.passesCompleted, 76);
  assert.equal(savedBundle.teamA.corners, 2);
  assert.equal(savedBundle.teamB.corners, 4);
  assert.equal(savedBundle.persistenceAudit.normalizedFromSnapshot, true);
  assert.equal(savedBundle.persistenceAudit.runtimeStamped, true);
  assert.equal(savedBundle.metadata.sessionId, 'ft-normalize');
  assert.equal(savedBundle.metadata.matchId, 'simple-portugal-spain');
  assert.equal(savedBundle.metadata.runtimeHalfDuration, 300);
  assert.equal(savedBundle.metadata.matchClockScale, 9);
  assert.equal(savedBundle.metadata.engineRuntimeToken, 'runtime-123');
  assert.equal(savedBundle.metadata.engineBootedAt, 456);
});
