import assert from 'node:assert/strict';
import test from 'node:test';

import {
  makeDirectorSnapshot,
  shouldHoldWideDeliveryForDirector,
} from '../src/ai/possessionDirector.ts';

test('director holds a wide delivery briefly when box runners are missing', () => {
  const decision = shouldHoldWideDeliveryForDirector({
    boxAttackers: 1,
    secondsSinceIntentStart: 0.6,
  });

  assert.equal(decision.hold, true);
  assert.equal(decision.reason, 'waiting_for_box_runners');
});

test('director releases delivery when the box is occupied', () => {
  const decision = shouldHoldWideDeliveryForDirector({
    boxAttackers: 2,
    secondsSinceIntentStart: 0.2,
  });

  assert.equal(decision.hold, false);
  assert.equal(decision.reason, 'box_ready');
});

test('director snapshot exposes Metrica-derived targets for live telemetry', () => {
  const snapshot = makeDirectorSnapshot({
    team: 'A',
    intent: 'WING_OVERLOAD',
    phase: 'progression',
    currentBoxAttackers: 1,
    action: 'carry',
    reason: 'waiting_for_box_runners',
  });

  assert.equal(snapshot.active, true);
  assert.equal(snapshot.targetWidth, 48.5);
  assert.equal(snapshot.supportDistance.median, 8.35);
  assert.equal(snapshot.minBoxAttackersBeforeCross, 2);
  assert.equal(snapshot.dangerousMarkDistance.warning, 6.12);
});
