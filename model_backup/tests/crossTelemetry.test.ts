import test from 'node:test';
import assert from 'node:assert/strict';

import { isActualCrossDelivery } from '../src/ai/crossTelemetry.ts';

const base = {
  attackSign: 1 as const,
  fieldWidth: 65.6,
  penaltyDepth: 8.8,
  penaltyHalfZ: 11.0,
  goalMouthWidth: 4.37,
};

test('cross telemetry counts wide deliveries into central scoring zones', () => {
  assert.equal(isActualCrossDelivery({
    ...base,
    passer: { x: 15, z: 14 },
    target: { x: 25, z: 2 },
  }), true);
});

test('cross telemetry rejects central passes and backward resets', () => {
  assert.equal(isActualCrossDelivery({
    ...base,
    passer: { x: 15, z: 3 },
    target: { x: 25, z: 1 },
  }), false);

  assert.equal(isActualCrossDelivery({
    ...base,
    passer: { x: 16, z: 14 },
    target: { x: -10, z: 2 },
  }), false);
});

test('cross telemetry rejects wide-to-wide deliveries outside the scoring lane', () => {
  assert.equal(isActualCrossDelivery({
    ...base,
    passer: { x: 15, z: 14 },
    target: { x: 23, z: 13 },
  }), false);
});
