import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  computeStructuredCarrierTarget,
  computeStructuredAttackTarget,
  getStructuredAttackRole,
  selectStructuredAttack,
  shouldStructuredCarrierDeliver,
  structuredAttackKey,
} from '../src/ai/structuredAttack.ts';

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
