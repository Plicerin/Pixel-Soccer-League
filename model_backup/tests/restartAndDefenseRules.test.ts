import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeKickoffReceiverSpot,
  isKickoffPassSafe,
  spaceCoachGoalMouthDefensiveTarget,
} from '../src/ai/restartAndDefenseRules.ts';

test('V19 kickoff receiver is staged in a short forward lateral lane', () => {
  const center = { x: 0, z: 0 };
  const target = computeKickoffReceiverSpot({
    center,
    attackDirection: 1,
    receiver: { x: -18, z: -11 },
    fieldDepth: 70,
  });

  assert.ok(target.x > center.x);
  assert.ok(Math.abs(target.z) >= 3);
  assert.equal(isKickoffPassSafe({ center, target, attackDirection: 1 }), true);
});

test('V20 coach defensive cover cannot collapse into the goalmouth', () => {
  const target = spaceCoachGoalMouthDefensiveTarget({
    rawTarget: { x: 58, z: 0.4 },
    role: 'COVER_NEAR_POST',
    ownGoalX: 60,
    teamAttackDirection: -1,
    playerHomeZ: 0,
    playerZ: 0,
    shirtNumber: 4,
    goalMouthWidth: 7.32,
    penaltyHalfZ: 20.16,
  });

  assert.ok(Math.abs(target.x - 60) >= 7.5);
  assert.ok(Math.abs(target.z) >= 7.32);
});

test('V20 coach cutback cover holds a second line instead of joining keeper crowd', () => {
  const target = spaceCoachGoalMouthDefensiveTarget({
    rawTarget: { x: -59, z: -1 },
    role: 'COVER_CUTBACK',
    ownGoalX: -60,
    teamAttackDirection: 1,
    playerHomeZ: 9,
    playerZ: 5,
    shirtNumber: 6,
    goalMouthWidth: 7.32,
    penaltyHalfZ: 20.16,
  });

  assert.ok(target.x > -48);
  assert.ok(target.z > 12);
});
