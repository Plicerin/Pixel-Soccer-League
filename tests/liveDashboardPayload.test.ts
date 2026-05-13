import assert from 'node:assert/strict';
import test from 'node:test';
import { compactLiveDashboardPayload, LIVE_DASHBOARD_LIMITS } from '../src/telemetry/liveDashboardPayload';

function rows(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    seq: i,
    detail: {
      carrier: `carrier-${i}`,
      target: `target-${i}`,
      pressure: i % 5,
      notes: 'x'.repeat(80),
    },
  }));
}

test('V35 live dashboard payload is bounded and preserves latest rows', () => {
  const payload = compactLiveDashboardPayload({
    type: 'tuning',
    bundle: {
      teamA: { name: 'Atlanta United', passes: 500 },
      teamB: { name: 'Nashville SC', passes: 480 },
      events: rows(3000),
      passLog: rows(3000),
      ballFlightTelemetry: rows(3000),
      visualRealityEvents: rows(3000),
      shapeA: rows(3000),
      shapeB: rows(3000),
      playerPositioning: rows(3000),
      transitions: rows(3000),
      goalLog: rows(3000),
      shotDecisions: rows(3000),
      passDecisions: rows(3000),
    },
    live: {
      eventLog: rows(3000),
      shotDecisions: rows(3000),
      passDecisions: rows(3000),
    },
  });

  assert.equal(payload.bundle.teamA.name, 'Atlanta United');
  assert.equal(payload.bundle.events.length, LIVE_DASHBOARD_LIMITS.events);
  assert.equal(payload.bundle.passLog.length, LIVE_DASHBOARD_LIMITS.passLog);
  assert.equal(payload.bundle.ballFlightTelemetry.length, LIVE_DASHBOARD_LIMITS.ballFlightTelemetry);
  assert.equal(payload.bundle.visualRealityEvents.length, LIVE_DASHBOARD_LIMITS.visualRealityEvents);
  assert.equal(payload.bundle.shapeA.length, LIVE_DASHBOARD_LIMITS.shapeA);
  assert.equal(payload.bundle.shapeB.length, LIVE_DASHBOARD_LIMITS.shapeB);
  assert.equal(payload.bundle.playerPositioning.length, LIVE_DASHBOARD_LIMITS.playerPositioning);
  assert.equal(payload.bundle.transitions.length, LIVE_DASHBOARD_LIMITS.transitions);
  assert.equal(payload.bundle.goalLog.length, LIVE_DASHBOARD_LIMITS.goalLog);
  assert.equal(payload.bundle.shotDecisions.length, LIVE_DASHBOARD_LIMITS.shotDecisions);
  assert.equal(payload.bundle.passDecisions.length, LIVE_DASHBOARD_LIMITS.passDecisions);
  assert.equal(payload.live.eventLog.length, LIVE_DASHBOARD_LIMITS.liveEventLog);
  assert.equal(payload.live.shotDecisions.length, LIVE_DASHBOARD_LIMITS.liveShotDecisions);
  assert.equal(payload.live.passDecisions.length, LIVE_DASHBOARD_LIMITS.livePassDecisions);
  assert.equal(payload.bundle.events.at(-1)?.seq, 2999);
  assert.ok(JSON.stringify(payload).length < 250_000);
});
