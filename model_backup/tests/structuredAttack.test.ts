import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  computeStructuredCarrierTarget,
  computeStructuredAttackTarget,
  computeStructuredDeliveryTarget,
  getStructuredAttackRole,
  selectStructuredAttack,
  shouldStructuredCarrierDeliver,
  structuredAttackKey,
} from '../src/ai/structuredAttack.ts';
import {
  computePatternRoleTarget,
  getPatternRole,
  isPatternStillValid,
  selectPattern,
} from '../src/ai/patternEngine.ts';

const constants = {
  fieldWidth: 65.6,
  fieldDepth: 43.7,
  goalMouthHalfWidth: 1.85,
  penaltyDepth: 9.6,
};

function makePlayer(name: string, team: 'A' | 'B', x: number, z: number, role: string) {
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

test('structured wing attack assigns readable soccer slots', () => {
  const carrier = makePlayer('RM Carrier', 'A', 7, 10, 'RM');
  const striker = makePlayer('Striker', 'A', 8, 0, 'ST');
  const farWinger = makePlayer('Left Mid', 'A', 4, -12, 'LM');
  const cutback = makePlayer('Ten', 'A', 5, 1, 'CAM');
  const secondWave = makePlayer('Eight', 'A', 2, -2, 'CM');

  const state = selectStructuredAttack({
    team: 'A',
    attackSign: 1,
    carrier,
    teammates: [carrier, striker, farWinger, cutback, secondWave],
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
  });

  assert.ok(state);
  assert.equal(state.type, 'WING_RIGHT');
  assert.equal(getStructuredAttackRole(state, carrier), 'CARRIER');
  assert.equal(getStructuredAttackRole(state, striker), 'NEAR_POST');
  assert.equal(getStructuredAttackRole(state, farWinger), 'FAR_POST');
  assert.equal(getStructuredAttackRole(state, cutback), 'CUTBACK');
  assert.equal(getStructuredAttackRole(state, secondWave), 'SECOND_WAVE');
});

test('central structured carrier uses home side hint without falsy z fallback', () => {
  const carrier = makePlayer('Central Right Home', 'A', 7, 0, 'RM');
  carrier.homePos.z = -10;
  const striker = makePlayer('Striker', 'A', 8, 0, 'ST');
  const rightWinger = makePlayer('Right Mid', 'A', 4, 12, 'RM');
  const cutback = makePlayer('Ten', 'A', 5, 1, 'CAM');

  const state = selectStructuredAttack({
    team: 'A',
    attackSign: 1,
    carrier,
    teammates: [carrier, striker, rightWinger, cutback],
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
  });

  assert.ok(state);
  assert.equal(state.carrierSide, -1);
  assert.equal(state.type, 'WING_LEFT');
  assert.equal(getStructuredAttackRole(state, rightWinger), 'FAR_POST');
});

test('structured wing attack creates wide far-post and second-wave lanes', () => {
  const carrier = makePlayer('RM Carrier', 'A', 9, 10, 'RM');
  const farWinger = makePlayer('Left Mid', 'A', 4, -12, 'LM');
  const cutback = makePlayer('Ten', 'A', 5, 1, 'CAM');
  const secondWave = makePlayer('Eight', 'A', 2, -2, 'CM');
  const state = selectStructuredAttack({
    team: 'A',
    attackSign: 1,
    carrier,
    teammates: [carrier, farWinger, cutback, secondWave],
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
  });

  assert.ok(state);
  const farTarget = computeStructuredAttackTarget({
    player: farWinger,
    carrier,
    state,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
  });
  const secondWaveTarget = computeStructuredAttackTarget({
    player: secondWave,
    carrier,
    state,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
  });

  assert.ok(farTarget);
  assert.ok(secondWaveTarget);
  assert.ok(farTarget.z < -constants.fieldDepth * 0.17);
  assert.ok(secondWaveTarget.z < -constants.fieldDepth * 0.12);
  assert.ok(secondWaveTarget.x > carrier.pos.x);
});

test('structured carrier delivery opens before byline', () => {
  const carrier = makePlayer('RM Carrier', 'A', 6, 9, 'RM');
  const striker = makePlayer('Striker', 'A', 8, 0, 'ST');
  const state = selectStructuredAttack({
    team: 'A',
    attackSign: 1,
    carrier,
    teammates: [carrier, striker],
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
  });

  assert.equal(
    shouldStructuredCarrierDeliver({
      state,
      carrier,
      fieldWidth: constants.fieldWidth,
      fieldDepth: constants.fieldDepth,
      penaltyDepth: constants.penaltyDepth,
    }),
    true,
  );
});

test('structured delivery target leads runners into finish lanes before they fully arrive', () => {
  const carrier = makePlayer('RM Carrier', 'A', 15, 11, 'RM');
  const striker = makePlayer('Striker', 'A', 17, 1.5, 'ST');
  const cutback = makePlayer('Ten', 'A', 12, 4.5, 'CAM');
  const secondWave = makePlayer('Eight', 'A', 10, -3.5, 'CM');
  const state = selectStructuredAttack({
    team: 'A',
    attackSign: 1,
    carrier,
    teammates: [carrier, striker, cutback, secondWave],
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
  });

  assert.ok(state);
  const nearPostTarget = computeStructuredDeliveryTarget({
    player: striker,
    carrier,
    state,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
  });
  const cutbackTarget = computeStructuredDeliveryTarget({
    player: cutback,
    carrier,
    state,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
  });

  assert.ok(nearPostTarget);
  assert.ok(cutbackTarget);
  assert.ok(nearPostTarget.x > striker.pos.x);
  assert.ok(Math.abs(nearPostTarget.z) < Math.abs(carrier.pos.z));
  assert.ok(cutbackTarget.x > cutback.pos.x);
  assert.ok(Math.abs(cutbackTarget.z) < Math.abs(carrier.pos.z));
});

test('structured carrier target preserves wide lane before delivery', () => {
  const carrier = makePlayer('RM Carrier', 'A', -2, 7, 'RM');
  const striker = makePlayer('Striker', 'A', 8, 0, 'ST');
  const state = selectStructuredAttack({
    team: 'A',
    attackSign: 1,
    carrier,
    teammates: [carrier, striker],
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
  });

  assert.ok(state);
  const target = computeStructuredCarrierTarget({
    carrier,
    state,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
  });

  assert.ok(target.x > carrier.pos.x);
  assert.ok(target.z > constants.fieldDepth * 0.33);
  assert.equal(structuredAttackKey(state), 'A:WING_RIGHT:RM Carrier:1');
});

test('structured wing attack keeps same-side outlet near the carrier', () => {
  const carrier = makePlayer('RM Carrier', 'A', 9, 11, 'RM');
  const striker = makePlayer('Striker', 'A', 11, 0, 'ST');
  const farWinger = makePlayer('Left Mid', 'A', 4, -12, 'LM');
  const cutback = makePlayer('Ten', 'A', 5, 1, 'CAM');
  const secondWave = makePlayer('Eight', 'A', 2, -2, 'CM');
  const outlet = makePlayer('Right Back', 'A', 3, 13, 'RB');
  const state = selectStructuredAttack({
    team: 'A',
    attackSign: 1,
    carrier,
    teammates: [carrier, striker, farWinger, cutback, secondWave, outlet],
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
  });

  assert.ok(state);
  assert.equal(getStructuredAttackRole(state, outlet), 'WIDE_OUTLET');

  const outletTarget = computeStructuredAttackTarget({
    player: outlet,
    carrier,
    state,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
  });

  assert.ok(outletTarget);
  const supportDistance = carrier.pos.x - outletTarget.x;
  assert.ok(supportDistance > constants.fieldDepth * 0.10);
  assert.ok(supportDistance < constants.fieldDepth * 0.20);
  assert.ok(outletTarget.z > constants.fieldDepth * 0.32);
});

test('structured wing attack preserves real-data weak-side width', () => {
  const carrier = makePlayer('RM Carrier', 'A', 9, 10, 'RM');
  const striker = makePlayer('Striker', 'A', 11, 0, 'ST');
  const farWinger = makePlayer('Left Mid', 'A', 4, -9, 'LM');
  const cutback = makePlayer('Ten', 'A', 5, 1, 'CAM');
  const secondWave = makePlayer('Eight', 'A', 2, -2, 'CM');
  const state = selectStructuredAttack({
    team: 'A',
    attackSign: 1,
    carrier,
    teammates: [carrier, striker, farWinger, cutback, secondWave],
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
  });

  assert.ok(state);
  const farTarget = computeStructuredAttackTarget({
    player: farWinger,
    carrier,
    state,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
  });

  assert.ok(farTarget);
  assert.ok(farTarget.z < -constants.fieldDepth * 0.32);
});

test('pattern engine selects a central give-and-go set play', () => {
  const carrier = makePlayer('Ten', 'A', 6, 0.6, 'CAM');
  const striker = makePlayer('Nine', 'A', 10, 0.2, 'ST');
  const runner = makePlayer('Right Mid', 'A', 8, 9, 'RM');
  const support = makePlayer('Eight', 'A', 3, -2, 'CM');
  const defenders = [
    makePlayer('Def 1', 'B', 14, 0, 'CB'),
    makePlayer('Def 2', 'B', 15, -3, 'CB'),
    makePlayer('Def 3', 'B', 11, 4, 'DM'),
  ];

  const state = selectPattern({
    elapsedSeconds: 25,
    team: 'A',
    attackSign: 1,
    carrier,
    teammates: [carrier, striker, runner, support],
    opponents: defenders,
    ball: carrier.pos,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    justRecoveredPossession: false,
    secondsSinceRecovery: 8,
    lastEndByType: {},
  });

  assert.ok(state);
  assert.equal(state.type, 'CENTRAL_COMBO');
  assert.equal(state.metadata.playName, 'GIVE_AND_GO');
  assert.equal(getPatternRole(state, carrier), 'CARRIER');
  assert.equal(getPatternRole(state, striker), 'WALL');
});

test('central combo sends wall player close and original carrier into return channel', () => {
  const carrier = makePlayer('Ten', 'A', 6, 0.6, 'CAM');
  const striker = makePlayer('Nine', 'A', 10, 0.2, 'ST');
  const runner = makePlayer('Right Mid', 'A', 8, 9, 'RM');
  const defenders = [makePlayer('Def 1', 'B', 14, 0, 'CB')];
  const state = selectPattern({
    elapsedSeconds: 25,
    team: 'A',
    attackSign: 1,
    carrier,
    teammates: [carrier, striker, runner],
    opponents: defenders,
    ball: carrier.pos,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    justRecoveredPossession: false,
    secondsSinceRecovery: 8,
    lastEndByType: {},
  });

  assert.ok(state);
  const wallTarget = computePatternRoleTarget({
    player: striker,
    role: 'WALL',
    pattern: state,
    carrier,
    attackSign: 1,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
  });
  const carrierReturnTarget = computePatternRoleTarget({
    player: carrier,
    role: 'CARRIER',
    pattern: state,
    carrier: striker,
    attackSign: 1,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
  });

  assert.ok(wallTarget);
  assert.ok(carrierReturnTarget);
  assert.ok(wallTarget.x > carrier.pos.x);
  assert.ok(carrierReturnTarget.x > striker.pos.x);
  assert.ok(Math.abs(carrierReturnTarget.z) > constants.goalMouthHalfWidth * 2);
});

test('central combo gives a striker a nearby midfielder wall option', () => {
  const carrier = makePlayer('Nine', 'A', 9, 0.8, 'ST');
  const wall = makePlayer('Ten', 'A', 4, 1.4, 'CAM');
  const runner = makePlayer('Right Mid', 'A', 10, 8, 'RM');
  const support = makePlayer('Eight', 'A', 2, -2, 'CM');
  const defenders = [
    makePlayer('Def 1', 'B', 13, 0, 'CB'),
    makePlayer('Def 2', 'B', 14, -3, 'CB'),
  ];

  const state = selectPattern({
    elapsedSeconds: 31,
    team: 'A',
    attackSign: 1,
    carrier,
    teammates: [carrier, wall, runner, support],
    opponents: defenders,
    ball: carrier.pos,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    justRecoveredPossession: false,
    secondsSinceRecovery: 10,
    lastEndByType: {},
  });

  assert.ok(state);
  assert.equal(state.type, 'CENTRAL_COMBO');
  assert.equal(getPatternRole(state, carrier), 'CARRIER');
  assert.equal(getPatternRole(state, wall), 'WALL');
});

test('pattern engine accepts plain Vec2 positions from orchestrator', () => {
  const carrier = { name: 'Carrier', team: 'A', role: 'CM', displayRole: 'CM', pos: { x: 0, z: 0 }, homePos: { x: 0, z: 0 } };
  const wall = { name: 'Wall', team: 'A', role: 'CAM', displayRole: 'CAM', pos: { x: 6, z: 1 }, homePos: { x: 6, z: 1 } };
  const runner = { name: 'Runner', team: 'A', role: 'ST', displayRole: 'ST', pos: { x: 9, z: -2 }, homePos: { x: 9, z: -2 } };
  const opponent = { name: 'Opponent', team: 'B', role: 'CB', displayRole: 'CB', pos: { x: 18, z: 8 }, homePos: { x: 18, z: 8 } };

  const state = selectPattern({
    elapsedSeconds: 10,
    team: 'A',
    attackSign: 1,
    carrier,
    teammates: [carrier, wall, runner],
    opponents: [opponent],
    ball: new THREE.Vector3(0, 0.15, 0),
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    justRecoveredPossession: false,
    secondsSinceRecovery: 10,
    lastEndByType: {},
  });

  assert.ok(state);
  assert.notEqual(getPatternRole(state, carrier), 'NONE');
  assert.notEqual(getPatternRole(state, wall), 'NONE');
});

test('pattern outlet target defaults missing home side deliberately for center carrier', () => {
  const carrier = { name: 'Carrier', team: 'A', role: 'CM', displayRole: 'CM', pos: { x: 0, z: 0 } };
  const outlet = { name: 'Outlet', team: 'A', role: 'RB', displayRole: 'RB', pos: { x: -3, z: 0 } };
  const pattern = {
    type: 'PATIENT_BUILDUP',
    startedAt: 0,
    expiresAt: 6,
    side: 'A',
    roles: new Map([[outlet.name, 'OUTLET']]),
    initiatorName: carrier.name,
    metadata: {},
  };

  const target = computePatternRoleTarget({
    player: outlet,
    role: 'OUTLET',
    pattern,
    carrier,
    attackSign: 1,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    penaltyDepth: constants.penaltyDepth,
    goalMouthHalfWidth: constants.goalMouthHalfWidth,
  });

  assert.ok(target);
  assert.equal(target.z, 8);
});

test('central combo survives its commitment window before lateral invalidation', () => {
  const carrier = makePlayer('Ten', 'A', 6, 0.6, 'CAM');
  const striker = makePlayer('Nine', 'A', 10, 0.2, 'ST');
  const runner = makePlayer('Right Mid', 'A', 8, 9, 'RM');
  const defenders = [makePlayer('Def 1', 'B', 14, 0, 'CB')];
  const state = selectPattern({
    elapsedSeconds: 25,
    team: 'A',
    attackSign: 1,
    carrier,
    teammates: [carrier, striker, runner],
    opponents: defenders,
    ball: carrier.pos,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    justRecoveredPossession: false,
    secondsSinceRecovery: 8,
    lastEndByType: {},
  });

  assert.ok(state);
  assert.equal(state.type, 'CENTRAL_COMBO');
  carrier.pos.z = constants.fieldDepth * 0.5;

  assert.equal(isPatternStillValid(state, {
    elapsedSeconds: 27.5,
    team: 'A',
    attackSign: 1,
    carrier,
    teammates: [carrier, striker, runner],
    opponents: defenders,
    ball: carrier.pos,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    justRecoveredPossession: false,
    secondsSinceRecovery: 10.5,
    lastEndByType: {},
  }), true);

  assert.equal(isPatternStillValid(state, {
    elapsedSeconds: 29,
    team: 'A',
    attackSign: 1,
    carrier,
    teammates: [carrier, striker, runner],
    opponents: defenders,
    ball: carrier.pos,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    justRecoveredPossession: false,
    secondsSinceRecovery: 12,
    lastEndByType: {},
  }), false);
});

test('wing attack survives brief opposite-lane drift during commitment window', () => {
  const carrier = makePlayer('RM Carrier', 'A', 7, 10, 'RM');
  const striker = makePlayer('Striker', 'A', 8, 0, 'ST');
  const farWinger = makePlayer('Left Mid', 'A', 4, -12, 'LM');
  const cutback = makePlayer('Ten', 'A', 5, 1, 'CAM');
  const state = selectPattern({
    elapsedSeconds: 12,
    team: 'A',
    attackSign: 1,
    carrier,
    teammates: [carrier, striker, farWinger, cutback],
    opponents: [makePlayer('Def 1', 'B', 12, 0, 'CB')],
    ball: carrier.pos,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    justRecoveredPossession: false,
    secondsSinceRecovery: 5,
    lastEndByType: { CENTRAL_COMBO: 11.7 },
  });

  assert.ok(state);
  assert.equal(state.type, 'WING_ATTACK_RIGHT');
  carrier.pos.z = -12;

  assert.equal(isPatternStillValid(state, {
    elapsedSeconds: 14,
    team: 'A',
    attackSign: 1,
    carrier,
    teammates: [carrier, striker, farWinger, cutback],
    opponents: [],
    ball: carrier.pos,
    fieldWidth: constants.fieldWidth,
    fieldDepth: constants.fieldDepth,
    justRecoveredPossession: false,
    secondsSinceRecovery: 7,
    lastEndByType: {},
  }), true);
});
