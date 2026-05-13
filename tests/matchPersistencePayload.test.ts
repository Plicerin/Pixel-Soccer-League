import assert from 'node:assert/strict';
import test from 'node:test';
import { compactLiveDashboardPayload } from '../src/telemetry/liveDashboardPayload';
import { buildMatchResultPayload } from '../src/telemetry/matchPersistencePayload';

const rows = (count: number) => Array.from({ length: count }, (_, seq) => ({ seq }));

test('V36 full-time match persistence keeps full raw telemetry bundle', () => {
  const rawBundle = {
    teamA: { name: 'Austin FC', formation: '3-4-3', score: 0, shots: 15, shotsOnTarget: 0, saves: 0, possession: 50 },
    teamB: { name: 'Inter Miami', formation: '3-4-3', score: 1, shots: 8, shotsOnTarget: 1, saves: 0 },
    events: rows(900),
    passLog: rows(637),
    passDecisions: rows(637),
    ballFlightTelemetry: rows(637),
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
});
