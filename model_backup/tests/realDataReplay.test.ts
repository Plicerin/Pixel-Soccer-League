import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveReplayFacingFromVelocity,
  findReplayFrameIndex,
  interpolateReplayFrame,
  interpolateReplayPoint,
  normalizedMetricaPointToWorld,
} from '../src/ai/realDataReplay.ts';

test('real-data replay maps normalized Metrica coordinates to field coordinates', () => {
  assert.deepEqual(normalizedMetricaPointToWorld([0.5, 0.5], 120, 80), { x: 0, z: 0 });
  assert.deepEqual(normalizedMetricaPointToWorld([0, 1], 120, 80), { x: -60, z: 40 });
  assert.equal(normalizedMetricaPointToWorld(null, 120, 80), null);
});

test('V24 real-data replay uses recorded pitch size instead of stretching to the full local field', () => {
  const sourcePitch = { lengthMeters: 105, widthMeters: 68 };
  const targetPitch = { lengthMeters: 120 * 0.9144, widthMeters: 80 * 0.9144 };
  const fieldWidth = 65.6;
  const fieldDepth = 80 * (fieldWidth / 120);

  const leftEdge = normalizedMetricaPointToWorld([0, 0.5], fieldWidth, fieldDepth, sourcePitch, targetPitch);
  const topEdge = normalizedMetricaPointToWorld([0.5, 0], fieldWidth, fieldDepth, sourcePitch, targetPitch);

  assert.ok(leftEdge);
  assert.ok(topEdge);
  assert.ok(leftEdge.x > -fieldWidth / 2, 'recorded pitch should be centered inside the larger local field');
  assert.ok(topEdge.z > -fieldDepth / 2, 'recorded pitch width should not be stretched to local touchline');
  assert.equal(leftEdge.z, 0);
  assert.equal(topEdge.x, 0);
});

test('real-data replay finds the latest frame at or before period time', () => {
  const frames = [
    { period: 1, t: 0.2, A: [], B: [] },
    { period: 1, t: 0.4, A: [], B: [] },
    { period: 2, t: 0.2, A: [], B: [] },
  ];
  assert.equal(findReplayFrameIndex(frames, 1, 0.1), 0);
  assert.equal(findReplayFrameIndex(frames, 1, 0.39), 0);
  assert.equal(findReplayFrameIndex(frames, 1, 0.4), 1);
  assert.equal(findReplayFrameIndex(frames, 2, 0.25), 2);
});

test('V25 real-data replay derives side/front/back facing from movement', () => {
  assert.deepEqual(deriveReplayFacingFromVelocity(2, 0.4, { mode: 'back', dir: -1 }), {
    mode: 'side',
    dir: 1,
    moving: true,
  });
  assert.deepEqual(deriveReplayFacingFromVelocity(-2, 0.1, { mode: 'front', dir: 1 }), {
    mode: 'side',
    dir: -1,
    moving: true,
  });
  assert.deepEqual(deriveReplayFacingFromVelocity(0.1, 2.2, { mode: 'side', dir: -1 }), {
    mode: 'front',
    dir: -1,
    moving: true,
  });
  assert.deepEqual(deriveReplayFacingFromVelocity(0.1, -2.2, { mode: 'side', dir: 1 }), {
    mode: 'back',
    dir: 1,
    moving: true,
  });
  assert.deepEqual(deriveReplayFacingFromVelocity(0.01, 0.01, { mode: 'front', dir: -1 }), {
    mode: 'front',
    dir: -1,
    moving: false,
  });
});

test('V26 real-data replay interpolates players and tracked ball between samples', () => {
  assert.deepEqual(interpolateReplayPoint([0, 0.2], [1, 0.6], 0.25), [0.25, 0.3]);
  const frame = interpolateReplayFrame(
    { period: 1, t: 10, A: [[0, 0]], B: [[1, 1]], ball: [0.2, 0.4] },
    { period: 1, t: 10.2, A: [[0.2, 0.4]], B: [[0.8, 0.6]], ball: [0.4, 0.8] },
    0.5,
  );
  assert.deepEqual(frame, {
    period: 1,
    t: 10.1,
    A: [[0.1, 0.2]],
    B: [[0.9, 0.8]],
    ball: [0.3, 0.6],
  });
});
