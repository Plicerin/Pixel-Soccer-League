import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  chooseSimplePassTarget,
  chooseSimpleShotStyle,
  computeSimpleCarrierHoldTarget,
  getSimplePassTargetPoint,
  getSimpleShotTargetPoint,
} from '../src/ai/simpleOffenseModel.ts';
import { evaluateShotDecision } from '../src/ai/aiShotModel.ts';

const constants = {
  fieldWidth: 65.6,
  fieldDepth: 43.7,
  goalMouthWidth: 3.7,
  goalMouthHeight: 2.4,
  penaltyDepth: 9.6,
};

function makePlayer(
  name: string,
  team: 'A' | 'B',
  x: number,
  z: number,
  role: string,
  vx: number = 0,
  vz: number = 0,
) {
  return {
    name,
    team,
    role,
    displayRole: role,
    pos: new THREE.Vector3(x, 0.15, z),
    vel: new THREE.Vector3(vx, 0, vz),
    homePos: new THREE.Vector3(x, 0.15, z),
    stats: {},
  };
}

test('chooseSimplePassTarget prefers an open onside forward option over blocked or offside targets', () => {
  const carrier = makePlayer('Carrier', 'A', 0, 0, 'CM');
  const openMid = makePlayer('Open Mid', 'A', 6, 1.2, 'CM');
  const blockedWing = makePlayer('Blocked Wing', 'A', 8, 8, 'RM');
  const offsideStriker = makePlayer('Offside Striker', 'A', 14, 0.2, 'ST');
  const defenders = [
    makePlayer('Def 1', 'B', 9, -0.2, 'CB'),
    makePlayer('Def 2', 'B', 8.2, 0.5, 'CB'),
    makePlayer('Def 3', 'B', 5.8, 5.8, 'RB'),
    makePlayer('Def 4', 'B', 7.2, 7.6, 'CM'),
    makePlayer('Def 5', 'B', 8.4, 8.1, 'CM'),
  ];

  const target = chooseSimplePassTarget(
    carrier,
    [openMid, blockedWing, offsideStriker],
    [carrier, openMid, blockedWing, offsideStriker, ...defenders],
    'A',
    1,
  );

  assert.equal(target?.name, 'Open Mid');
});

test('chooseSimplePassTarget will recycle backward to a safe outlet under heavy pressure', () => {
  const carrier = makePlayer('Carrier', 'A', 10, 0, 'CM');
  const pressedForward = makePlayer('Pressed Forward', 'A', 15, 0.5, 'ST');
  const safeDm = makePlayer('Safety Valve', 'A', 6, -2, 'DM');
  const defenders = [
    makePlayer('Press 1', 'B', 10.5, 0.2, 'CB'),
    makePlayer('Press 2', 'B', 10.3, -0.6, 'CM'),
    makePlayer('Press 3', 'B', 10.8, 1.0, 'CM'),
    makePlayer('Marker 1', 'B', 14.8, 0.3, 'CB'),
    makePlayer('Marker 2', 'B', 15.4, -0.5, 'CB'),
  ];

  const target = chooseSimplePassTarget(
    carrier,
    [pressedForward, safeDm],
    [carrier, pressedForward, safeDm, ...defenders],
    'A',
    1,
  );

  assert.equal(target?.name, 'Safety Valve');
});

test('chooseSimplePassTarget avoids huge backward resets from forwards when they are not under real pressure', () => {
  const striker = makePlayer('Striker', 'A', 0, 0, 'ST');
  const centerBack = makePlayer('Center Back', 'A', -18, -4, 'CB');
  const nearbyMid = makePlayer('Nearby Mid', 'A', -2, 1, 'CM');
  const defenders = [
    makePlayer('Def 1', 'B', 8, 0, 'CB'),
    makePlayer('Def 2', 'B', 9, 2, 'CB'),
  ];

  const target = chooseSimplePassTarget(
    striker,
    [centerBack, nearbyMid],
    [striker, centerBack, nearbyMid, ...defenders],
    'A',
    1,
  );

  assert.notEqual(target?.name, 'Center Back');
});

test('chooseSimplePassTarget fallback rejects directly blocked lanes', () => {
  const carrier = makePlayer('Carrier', 'A', 0, 0, 'ST');
  const blockedOutlet = makePlayer('Blocked Outlet', 'A', 9, 0, 'CM');
  const openOutlet = makePlayer('Open Outlet', 'A', 5, 5, 'RM');
  const defenders = [
    makePlayer('Lane Blocker', 'B', 4.5, 0.1, 'CB'),
    makePlayer('Marker', 'B', 8.8, 0.4, 'DM'),
    makePlayer('Wide Def', 'B', 6, 8, 'LB'),
  ];

  const target = chooseSimplePassTarget(
    carrier,
    [blockedOutlet, openOutlet],
    [carrier, blockedOutlet, openOutlet, ...defenders],
    'A',
    1,
  );

  assert.equal(target?.name, 'Open Outlet');
});

test('chooseSimplePassTarget prefers a second pass outlet when the central box is crowded', () => {
  const carrier = makePlayer('Ten', 'A', 17, 1.2, 'CAM');
  const striker = makePlayer('Marked Striker', 'A', 24, 0.6, 'ST');
  const secondWave = makePlayer('Second Wave', 'A', 12, -4.2, 'CM');
  const winger = makePlayer('Wide Outlet', 'A', 18, 10, 'RM');
  const defenders = [
    makePlayer('Center Back 1', 'B', 25, 0.2, 'CB'),
    makePlayer('Center Back 2', 'B', 23, -1.6, 'CB'),
    makePlayer('Holding Mid', 'B', 21, 2.4, 'DM'),
    makePlayer('Fullback', 'B', 19, 9.8, 'LB'),
  ];

  const target = chooseSimplePassTarget(
    carrier,
    [striker, secondWave, winger],
    [carrier, striker, secondWave, winger, ...defenders],
    'A',
    1,
  );

  assert.equal(target?.name, 'Second Wave');
});

test('evaluateShotDecision asks for one more pass when the shot lane is crowded', () => {
  const carrier = makePlayer('Crowded Carrier', 'A', 20, 0.8, 'CAM');
  const passTarget = makePlayer('Open Outlet', 'A', 23, -4, 'CM');
  const result = evaluateShotDecision({
    carrier,
    distToGoal: 12.8,
    closePressure: 1,
    inShootingLane: true,
    inTapInZone: false,
    insidePenaltyArea: false,
    passTarget,
    hasForwardPassOption: true,
    hasGoalSupport: true,
    roleProfile: { shootBias: 0.7 },
    shotSkill: 0.75,
    dribbleSkill: 0.6,
    passChance: 0.62,
    activeAIStyle: {},
    team: 'A',
    gameState: { shotsA: 12, shotsOnTargetA: 2, shotsB: 0, shotsOnTargetB: 0 },
    crowdedShotLane: true,
    shotCorridorDefenders: 3,
    shotBoxDefenders: 4,
  });

  assert.equal(result.shouldShoot, false);
  assert.ok(result.shootChance < 0.28);
});

test('V104 evaluateShotDecision penalizes wide angles against the real goal line', () => {
  const baseContext = {
    distToGoal: 14,
    closePressure: 0,
    inShootingLane: false,
    inTapInZone: false,
    insidePenaltyArea: false,
    passTarget: null,
    hasForwardPassOption: false,
    hasGoalSupport: false,
    roleProfile: { shootBias: 0.5 },
    shotSkill: 0.5,
    dribbleSkill: 0.5,
    passChance: null,
    activeAIStyle: {},
    team: 'A' as const,
    gameState: { shotsA: 12, shotsOnTargetA: 4, shotsB: 0, shotsOnTargetB: 0 },
  };
  const central = evaluateShotDecision({
    ...baseContext,
    carrier: makePlayer('Central Shooter', 'A', 20, 0, 'ST'),
  });
  const wide = evaluateShotDecision({
    ...baseContext,
    carrier: makePlayer('Wide Shooter', 'A', 20, 10, 'ST'),
  });

  assert.ok(wide.shootChance <= central.shootChance - 0.09);
});

test('getSimplePassTargetPoint leads a moving receiver into space', () => {
  const passer = makePlayer('Passer', 'A', 0, 0, 'CM');
  const runner = makePlayer('Runner', 'A', 10, 2, 'ST', 3.5, 0);

  const targetPoint = getSimplePassTargetPoint(passer, runner, 'SHORT', constants);

  assert.ok(targetPoint.x > runner.pos.x);
  assert.equal(targetPoint.y, 0.15);
});

test('chooseSimpleShotStyle picks chips and curled shots in the expected situations', () => {
  const centralStriker = makePlayer('Striker', 'A', 18, 0.1, 'ST');
  const wideRunner = makePlayer('Wide Runner', 'A', 20, 3.4, 'RM');

  const chipped = chooseSimpleShotStyle(centralStriker, 1, 16, true, false, { keeperOffLine: true });
  const curled = chooseSimpleShotStyle(wideRunner, 1, 18, false, false, {});

  assert.equal(chipped, 'CHIP');
  assert.equal(curled, 'CURLED');
});

test('getSimpleShotTargetPoint aims away from the keeper toward the far post', () => {
  const shooter = makePlayer('Shooter', 'A', 18, 1.2, 'ST');

  const targetPoint = getSimpleShotTargetPoint(
    shooter,
    constants.fieldWidth / 2,
    'PLACED',
    14,
    constants,
    1.0,
  );

  assert.ok(targetPoint.z < 0);
  assert.ok(targetPoint.y >= 0.7);
});

test('getSimpleShotTargetPoint sends forced central long-range drives off frame more often', () => {
  const shooter = makePlayer('Long Range', 'A', 8, 0.2, 'CM');
  const originalRandom = Math.random;
  const rolls = [0.5, 0.5, 0.5, 0.9];
  let idx = 0;
  Math.random = () => rolls[idx++] ?? 0.5;
  try {
    const targetPoint = getSimpleShotTargetPoint(
      shooter,
      constants.fieldWidth / 2,
      'LACES_DRIVE',
      24,
      constants,
      null,
      undefined,
      undefined,
      { shotSelectionType: 'forced_shot', forceShotNow: true, closePressure: 0, shotAngle: 0.03 },
    );

    assert.ok(Math.abs(targetPoint.z) > constants.goalMouthWidth * 0.5);
  } finally {
    Math.random = originalRandom;
  }
});

test('getSimpleShotTargetPoint pushes selected pressured long-range drives off frame', () => {
  const shooter = makePlayer('Pressed Range', 'A', 6, 0.1, 'CM');
  const originalRandom = Math.random;
  const rolls = [0.5, 0.5, 0.5, 0.44];
  let idx = 0;
  Math.random = () => rolls[idx++] ?? 0.5;
  try {
    const targetPoint = getSimpleShotTargetPoint(
      shooter,
      constants.fieldWidth / 2,
      'LACES_DRIVE',
      26,
      constants,
      null,
      undefined,
      undefined,
      { shotSelectionType: 'selected_shot', forceShotNow: false, closePressure: 3, shotAngle: 0.04 },
    );

    assert.ok(
      Math.abs(targetPoint.z) > constants.goalMouthWidth * 0.5 || targetPoint.y > constants.goalMouthHeight,
    );
  } finally {
    Math.random = originalRandom;
  }
});

test('getSimpleShotTargetPoint keeps selected close shots in frame', () => {
  const shooter = makePlayer('Close Finisher', 'A', 24, 0.6, 'ST');
  const originalRandom = Math.random;
  const rolls = [0.5, 0.5, 0.5, 0.99];
  let idx = 0;
  Math.random = () => rolls[idx++] ?? 0.5;
  try {
    const targetPoint = getSimpleShotTargetPoint(
      shooter,
      constants.fieldWidth / 2,
      'PLACED',
      9,
      constants,
      0.8,
      undefined,
      undefined,
      { shotSelectionType: 'selected_shot', forceShotNow: false, closePressure: 1, shotAngle: 0.08 },
    );

    assert.ok(Math.abs(targetPoint.z) <= constants.goalMouthWidth * 0.5);
    assert.ok(targetPoint.y <= constants.goalMouthHeight);
  } finally {
    Math.random = originalRandom;
  }
});

test('computeSimpleCarrierHoldTarget pushes the carrier forward and narrows the lane', () => {
  const carrier = makePlayer('Carrier', 'A', 0, 6, 'CM');

  const target = computeSimpleCarrierHoldTarget(carrier, 1, constants);

  assert.ok(target.x > carrier.pos.x);
  assert.ok(Math.abs(target.z) < Math.abs(carrier.pos.z));
});
