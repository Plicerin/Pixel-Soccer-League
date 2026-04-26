import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  computePatternRoleTarget,
  selectPattern,
  type TeamPatternState,
} from '../src/ai/patternEngine.ts';
import { computeFsmOffBallTarget } from '../src/ai/fsmPositioning.ts';

const constants = {
  fieldWidth: 65.6,
  fieldDepth: 43.7,
  goalMouthHalfWidth: 1.85,
  penaltyDepth: 9.6,
};

function makePlayer(
  name: string,
  team: 'A' | 'B',
  x: number,
  z: number,
  role: string,
) {
  return {
    name,
    team,
    role,
    displayRole: role,
    pos: new THREE.Vector3(x, 0.15, z),
    vel: new THREE.Vector3(),
    homePos: new THREE.Vector3(x, 0.15, z),
  };
}

test('pattern support target becomes level or ahead in attacking half', () => {
  const carrier = makePlayer('Carrier', 'A', 8, 9, 'RM');
  const support = makePlayer('Support Mid', 'A', 2, -2, 'CM');
  const pattern: TeamPatternState = {
    type: 'COUNTER_ATTACK',
    startedAt: 0,
    expiresAt: 5,
    side: 'A',
    roles: new Map([[support.name, 'SUPPORT']]),
    initiatorName: carrier.name,
    metadata: {},
  };

  const target = computePatternRoleTarget({
    player: support,
    role: 'SUPPORT',
    pattern,
    carrier,
    attackSign: 1,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
  });

  assert.ok(target);
  assert.ok(target.x > carrier.pos.x, 'support outlet should be ahead of carrier in attacking half');
  assert.ok(Math.abs(target.z) >= constants.fieldDepth * 0.13, 'support outlet should occupy opposite half-space');
});

test('FSM box crash keeps wide attackers wide enough for outlets', () => {
  const carrier = makePlayer('Carrier', 'A', 12, 10, 'RM');
  const sameSideWinger = makePlayer('Same Side', 'A', 4, 12, 'RM');
  const weakSideWinger = makePlayer('Weak Side', 'A', 4, -12, 'LM');
  const secondWaveMid = makePlayer('Second Wave', 'A', 1, -2, 'CM');

  const sameSideTarget = computeFsmOffBallTarget({
    player: sameSideWinger,
    carrier,
    teamPattern: null,
    attackSign: 1,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
    attackPhase: 'FINAL_THIRD',
    allPlayers: [carrier, sameSideWinger, weakSideWinger, secondWaveMid],
    ballPos: carrier.pos,
  }).clone();
  const weakSideTarget = computeFsmOffBallTarget({
    player: weakSideWinger,
    carrier,
    teamPattern: null,
    attackSign: 1,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
    attackPhase: 'FINAL_THIRD',
    allPlayers: [carrier, sameSideWinger, weakSideWinger, secondWaveMid],
    ballPos: carrier.pos,
  }).clone();
  const midTarget = computeFsmOffBallTarget({
    player: secondWaveMid,
    carrier,
    teamPattern: null,
    attackSign: 1,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
    attackPhase: 'FINAL_THIRD',
    allPlayers: [carrier, sameSideWinger, weakSideWinger, secondWaveMid],
    ballPos: carrier.pos,
  }).clone();

  assert.ok(sameSideTarget.z > constants.fieldDepth * 0.29, 'same-side winger should remain a wide relief option');
  assert.ok(weakSideTarget.z < -constants.fieldDepth * 0.17, 'weak-side winger should stretch the far-post lane');
  assert.ok(midTarget.x > carrier.pos.x, 'second-wave midfielder should arrive ahead of the carrier');
  assert.ok(midTarget.z < -constants.fieldDepth * 0.10, 'second-wave midfielder should occupy opposite half-space');
});

test('wing attacks stay active long enough for early delivery', () => {
  const carrier = makePlayer('Right Mid', 'A', 4, 9, 'RM');
  const striker = makePlayer('Striker', 'A', 10, 0, 'ST');
  const leftMid = makePlayer('Left Mid', 'A', 3, -11, 'LM');
  const centerMid = makePlayer('Center Mid', 'A', 2, 1, 'CM');

  const pattern = selectPattern({
    elapsedSeconds: 10,
    team: 'A',
    attackSign: 1,
    carrier,
    teammates: [carrier, striker, leftMid, centerMid],
    opponents: [],
    ball: carrier.pos,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    justRecoveredPossession: false,
    secondsSinceRecovery: 4,
    lastEndByType: {},
  });

  assert.equal(pattern?.type, 'WING_ATTACK_RIGHT');
  assert.ok(pattern.expiresAt - pattern.startedAt >= 8.5);
});
