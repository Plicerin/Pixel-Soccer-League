import test from 'node:test';
import assert from 'node:assert/strict';

import { distancePointToSegmentXZ, segmentCrossesReceiverRadius } from '../src/ai/passResolution.ts';

test('rolling pass resolution catches ball paths that cross receiver radius between frames', () => {
  const receiver = { x: 5, z: 0.2 };
  const prevBall = { x: 3.8, z: 0 };
  const nextBall = { x: 6.2, z: 0 };

  assert.equal(Math.round(distancePointToSegmentXZ(receiver, prevBall, nextBall) * 10) / 10, 0.2);
  assert.equal(segmentCrossesReceiverRadius(receiver, prevBall, nextBall, 0.95), true);
});

test('rolling pass resolution rejects paths that miss the receiver lane', () => {
  const receiver = { x: 5, z: 1.4 };
  const prevBall = { x: 3.8, z: 0 };
  const nextBall = { x: 6.2, z: 0 };

  assert.equal(segmentCrossesReceiverRadius(receiver, prevBall, nextBall, 0.95), false);
});
