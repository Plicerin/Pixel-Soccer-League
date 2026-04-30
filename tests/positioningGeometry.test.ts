import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  computePatternRoleTarget,
  selectPattern,
  type TeamPatternState,
} from '../src/ai/patternEngine.ts';
import {
  computeFsmOffBallTarget,
  computeFsmOffBallTargetWithOwner,
} from '../src/ai/fsmPositioning.ts';

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

test('FSM danger marking assigns a goal-side defender to off-ball box runners', () => {
  const carrier = makePlayer('Wide Carrier', 'A', 20, 10, 'RM');
  const striker = makePlayer('Box Runner', 'A', 25, 0.8, 'ST');
  const presser = makePlayer('Ball Presser', 'B', 19, 9, 'DM');
  const marker = makePlayer('Center Back', 'B', 18, 0, 'CB');
  const cover = makePlayer('Fullback', 'B', 14, -8, 'LB');

  const result = computeFsmOffBallTargetWithOwner({
    player: marker,
    carrier,
    teamPattern: null,
    attackSign: -1,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
    attackPhase: 'FINAL_THIRD',
    allPlayers: [carrier, striker, presser, marker, cover],
    ballPos: carrier.pos,
  });

  assert.equal(result.owner, 'DANGER_MARK');
  assert.ok(result.target.x > striker.pos.x, 'marker should take the goal-side lane between runner and goal');
  assert.ok(result.target.distanceTo(striker.pos) < 3, 'marker should stay close enough to challenge the runner');

  const presserResult = computeFsmOffBallTargetWithOwner({
    player: presser,
    carrier,
    teamPattern: null,
    attackSign: -1,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
    attackPhase: 'FINAL_THIRD',
    allPlayers: [carrier, striker, presser, marker, cover],
    ballPos: carrier.pos,
  });

  assert.notEqual(presserResult.owner, 'DANGER_MARK', 'the ball presser should not be reassigned to off-ball marking');
});

test('FSM box cover sends non-pressing defenders into the shooting corridor', () => {
  const carrier = makePlayer('Central Carrier', 'A', 24, 0.7, 'CAM');
  const presser = makePlayer('Ball Presser', 'B', 23.5, 0.8, 'DM');
  const centerBack = makePlayer('Center Back', 'B', 16, -2, 'CB');
  const otherBack = makePlayer('Other Back', 'B', 15, 4, 'CB');
  const fullback = makePlayer('Fullback', 'B', 12, -12, 'LB');

  const result = computeFsmOffBallTargetWithOwner({
    player: centerBack,
    carrier,
    teamPattern: null,
    attackSign: -1,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
    attackPhase: 'FINAL_THIRD',
    allPlayers: [carrier, presser, centerBack, otherBack, fullback],
    ballPos: carrier.pos,
  });

  assert.equal(result.owner, 'BOX_COVER');
  assert.ok(result.target.x > carrier.pos.x, 'box cover should retreat goal-side of the ball');
  assert.ok(Math.abs(result.target.x - constants.fieldWidth / 2) <= constants.penaltyDepth, 'box cover should drop inside the penalty area');
  assert.ok(Math.abs(result.target.z) < constants.goalMouthHalfWidth * 2.5, 'box cover should protect the central shooting corridor');

  const presserResult = computeFsmOffBallTargetWithOwner({
    player: presser,
    carrier,
    teamPattern: null,
    attackSign: -1,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
    attackPhase: 'FINAL_THIRD',
    allPlayers: [carrier, presser, centerBack, otherBack, fullback],
    ballPos: carrier.pos,
  });

  assert.notEqual(presserResult.owner, 'BOX_COVER', 'the ball presser should stay out of box-cover assignment');
});

test('FSM box cover drops into the box before long central shots', () => {
  const carrier = makePlayer('Central Carrier', 'A', 11, 1.1, 'CAM');
  const presser = makePlayer('Ball Presser', 'B', 10.5, 1.2, 'DM');
  const centerBack = makePlayer('Center Back', 'B', 3, -2, 'CB');
  const otherBack = makePlayer('Other Back', 'B', 2, 4, 'CB');
  const fullback = makePlayer('Fullback', 'B', 0, -13, 'LB');
  const mid = makePlayer('Midfield Cover', 'B', 4, 8, 'CM');

  const result = computeFsmOffBallTargetWithOwner({
    player: centerBack,
    carrier,
    teamPattern: null,
    attackSign: -1,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
    attackPhase: 'FINAL_THIRD',
    allPlayers: [carrier, presser, centerBack, otherBack, fullback, mid],
    ballPos: carrier.pos,
  });

  assert.equal(result.owner, 'BOX_COVER');
  assert.ok(Math.abs(result.target.x - constants.fieldWidth / 2) <= constants.penaltyDepth, 'cover target should be counted as a box defender');
  assert.ok(Math.abs(result.target.z) <= constants.goalMouthHalfWidth * 2.5, 'cover target should be counted as a corridor defender');
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
