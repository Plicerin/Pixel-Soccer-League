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

test('computeSimpleCarrierHoldTarget pushes the carrier forward and narrows the lane', () => {
  const carrier = makePlayer('Carrier', 'A', 0, 6, 'CM');

  const target = computeSimpleCarrierHoldTarget(carrier, 1, constants);

  assert.ok(target.x > carrier.pos.x);
  assert.ok(Math.abs(target.z) < Math.abs(carrier.pos.z));
});
