import assert from 'node:assert/strict';
import test from 'node:test';
import {
  selectMetricaMotionFrame,
  selectMetricaMotionTarget,
  worldPointToSourceNormalized,
} from '../src/ai/metricaMotionLibrary.ts';
import type { RealDataReplayAsset } from '../src/ai/realDataReplay.ts';

const asset: RealDataReplayAsset = {
  source: 'test',
  mode: 'position-ball-replay',
  sampleEverySeconds: 0.2,
  pitch: { lengthMeters: 105, widthMeters: 68 },
  playerIds: { A: ['11', '1'], B: ['25', '15'] },
  frames: [
    {
      period: 1,
      t: 1,
      A: [[0.2, 0.5], [0.4, 0.3]],
      B: [[0.8, 0.5], [0.6, 0.7]],
      ball: [0.42, 0.52],
    },
    {
      period: 1,
      t: 2,
      A: [[0.8, 0.5], [0.62, 0.25]],
      B: [[0.2, 0.5], [0.38, 0.75]],
      ball: [0.78, 0.51],
    },
  ],
};

test('Metrica motion maps local world points into source-pitch normalized space', () => {
  const normalized = worldPointToSourceNormalized(
    { x: 0, z: 0 },
    65.6,
    asset.pitch,
    { lengthMeters: 120 * 0.9144, widthMeters: 80 * 0.9144 },
  );
  assert.deepEqual(normalized, [0.5, 0.5]);
});

test('Metrica motion selects a real frame matching current attacking ball progress', () => {
  const match = selectMetricaMotionFrame(asset, {
    ball: { x: -5, z: 0 },
    attackSign: 1,
    fieldWidth: 65.6,
    fieldDepth: 43.733,
    sourcePitch: asset.pitch,
    targetPitch: { lengthMeters: 120 * 0.9144, widthMeters: 80 * 0.9144 },
    stride: 1,
  });
  assert.ok(match);
  assert.equal(match.sourceTeam, 'A');
  assert.equal(match.sourceAttackSign, 1);
  assert.equal(match.frameIndex, 0);
});

test('Metrica motion returns role-indexed ghost targets from the selected frame', () => {
  const match = { frameIndex: 0, sourceTeam: 'A' as const, sourceAttackSign: 1 as const, score: 0, confidence: 1 };
  const target = selectMetricaMotionTarget(asset, match, 1, {
    fieldWidth: 65.6,
    sourcePitch: asset.pitch,
    targetPitch: { lengthMeters: 120 * 0.9144, widthMeters: 80 * 0.9144 },
  });
  assert.ok(target);
  assert.equal(target.sourcePlayerIndex, 1);
  assert.ok(target.x < 0);
  assert.ok(target.z < 0);
});
