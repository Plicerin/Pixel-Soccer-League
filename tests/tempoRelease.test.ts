import test from 'node:test';
import assert from 'node:assert/strict';

import { chooseTempoReleaseTarget, type TempoReleaseTarget } from '../src/ai/tempoRelease.ts';

function target(role: TempoReleaseTarget['role'], overrides: Partial<TempoReleaseTarget> = {}): TempoReleaseTarget {
  return {
    role,
    finishLane: true,
    laneAcceptable: true,
    laneBlocked: false,
    passDist: 10,
    maxPassDist: 12,
    oppSpace: 2.0,
    forwardProg: 1.0,
    score: 2.0,
    ...overrides,
  };
}

const readyContext = {
  secondsSinceIntentStart: 2.4,
  structuredTouchCount: 1,
  coachWaitCapHit: false,
  carrierWideEnough: true,
  carrierAdvancedEnough: true,
};

test('tempo release chooses central finish actions over post targets', () => {
  const decision = chooseTempoReleaseTarget([
    target('NEAR_POST', { score: 20, oppSpace: 5 }),
    target('FAR_POST', { score: 20, oppSpace: 5 }),
    target('CUTBACK', { score: 2.5 }),
    target('SECOND_WAVE', { score: 2.2 }),
  ], readyContext);

  assert.equal(decision.ready, true);
  assert.ok(decision.target);
  assert.match(decision.target.role, /CUTBACK|SECOND_WAVE/);
  assert.equal(decision.reason, 'tempo_age');
});

test('tempo release reports no central finish instead of falling back to post lanes', () => {
  const decision = chooseTempoReleaseTarget([
    target('NEAR_POST', { score: 20, oppSpace: 5 }),
    target('FAR_POST', { score: 20, oppSpace: 5 }),
    target('CUTBACK', { finishLane: false }),
    target('SECOND_WAVE', { laneBlocked: true }),
  ], readyContext);

  assert.equal(decision.ready, true);
  assert.equal(decision.target, null);
  assert.equal(decision.reason, 'no_central_finish');
});

test('tempo release does not fire before age, setup, or coach wait cap', () => {
  const decision = chooseTempoReleaseTarget([
    target('CUTBACK'),
    target('SECOND_WAVE'),
  ], {
    ...readyContext,
    secondsSinceIntentStart: 1.2,
    structuredTouchCount: 1,
    coachWaitCapHit: false,
  });

  assert.equal(decision.ready, false);
  assert.equal(decision.target, null);
  assert.equal(decision.reason, 'not_ready');
});

