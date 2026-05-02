import assert from 'node:assert/strict';
import test from 'node:test';
import { enforceCoachAuthorityMovement, enforceLiveMovementAuthority, selectCoachAuthorityAction } from '../src/ai/coachAuthority.ts';

test('coach authority stays idle before final-third or hold contract is breached', () => {
  assert.equal(selectCoachAuthorityAction({
    inAttackResolutionZone: true,
    holdSeconds: 1.1,
    finalThirdAge: 1.7,
    timeSinceTeamShot: 4,
    patternResolutionDue: false,
    hasPassTarget: true,
    canShoot: true,
    shotAngle: 0.2,
    distToGoal: 14,
  }), null);
});

test('coach authority forces a final-third pass when shot is not strong enough', () => {
  assert.deepEqual(selectCoachAuthorityAction({
    inAttackResolutionZone: true,
    holdSeconds: 2.4,
    finalThirdAge: 2.6,
    timeSinceTeamShot: 4,
    patternResolutionDue: false,
    hasPassTarget: true,
    canShoot: true,
    shotAngle: 0.76,
    distToGoal: 20,
  }), { action: 'pass', reason: 'final_third_clock' });
});

test('coach authority forces a shot when the carrier stalls near goal without a pass', () => {
  assert.deepEqual(selectCoachAuthorityAction({
    inAttackResolutionZone: true,
    holdSeconds: 6.1,
    finalThirdAge: 0.8,
    timeSinceTeamShot: 2,
    patternResolutionDue: false,
    hasPassTarget: false,
    canShoot: true,
    shotAngle: 0.7,
    distToGoal: 18,
  }), { action: 'shot', reason: 'carrier_stall' });
});

test('coach authority respects the team shot gap to avoid shot spam', () => {
  assert.equal(selectCoachAuthorityAction({
    inAttackResolutionZone: true,
    holdSeconds: 3.2,
    finalThirdAge: 3.1,
    timeSinceTeamShot: 0.4,
    patternResolutionDue: true,
    hasPassTarget: true,
    canShoot: true,
    shotAngle: 0.15,
    distToGoal: 10,
  }), null);
});

test('coach authority does not chain force actions before the new receiver settles', () => {
  assert.equal(selectCoachAuthorityAction({
    inAttackResolutionZone: true,
    holdSeconds: 0.4,
    finalThirdAge: 7.2,
    timeSinceTeamShot: 4,
    patternResolutionDue: true,
    hasPassTarget: true,
    canShoot: true,
    shotAngle: 0.2,
    distToGoal: 18,
  }), null);
});

test('coach authority prefers a pass over hopeful medium-range shots', () => {
  assert.deepEqual(selectCoachAuthorityAction({
    inAttackResolutionZone: true,
    holdSeconds: 2.8,
    finalThirdAge: 4.2,
    timeSinceTeamShot: 5,
    patternResolutionDue: true,
    hasPassTarget: true,
    canShoot: true,
    shotAngle: 0.52,
    distToGoal: 24,
  }), { action: 'pass', reason: 'pattern_contract' });
});

test('V21 coach authority blocks uncommanded player movement', () => {
  const result = enforceCoachAuthorityMovement({
    previous: { x: 0, z: 0 },
    attempted: { x: 4, z: 0 },
    command: null,
    dt: 1,
    fieldWidth: 100,
    fieldDepth: 60,
  });

  assert.deepEqual(result.position, { x: 0, z: 0 });
  assert.deepEqual(result.violations, ['missing_command']);
});

test('V21 coach authority caps impossible commanded speed', () => {
  const result = enforceCoachAuthorityMovement({
    previous: { x: 0, z: 0 },
    attempted: { x: 30, z: 0 },
    command: {
      target: { x: 40, z: 0 },
      owner: 'coach:test',
      maxSpeed: 5,
    },
    dt: 1,
    fieldWidth: 100,
    fieldDepth: 60,
    speedSlack: 1,
  });

  assert.equal(result.position.x, 5);
  assert.equal(result.position.z, 0);
  assert.deepEqual(result.violations, ['speed_cap']);
});

test('V21 coach authority redirects off-route movement toward coach target', () => {
  const result = enforceCoachAuthorityMovement({
    previous: { x: 0, z: 0 },
    attempted: { x: -3, z: 0 },
    command: {
      target: { x: 10, z: 0 },
      owner: 'coach:test',
      maxSpeed: 4,
    },
    dt: 1,
    fieldWidth: 100,
    fieldDepth: 60,
    speedSlack: 1,
  });

  assert.equal(result.position.x, 4);
  assert.equal(result.position.z, 0);
  assert.deepEqual(result.violations, ['off_route']);
});

test('V21 coach authority clamps out-of-bounds positions', () => {
  const result = enforceCoachAuthorityMovement({
    previous: { x: 48, z: 0 },
    attempted: { x: 80, z: 40 },
    command: {
      target: { x: 50, z: 0 },
      owner: 'coach:test',
      maxSpeed: 50,
    },
    dt: 1,
    fieldWidth: 100,
    fieldDepth: 60,
    speedSlack: 1,
  });

  assert.equal(result.position.x, 50);
  assert.equal(result.position.z, 30);
  assert.deepEqual(result.violations, ['field_bounds']);
});

test('V28 live movement authority caps untagged player teleports', () => {
  const result = enforceLiveMovementAuthority({
    previous: { x: 0, z: 0 },
    attempted: { x: 30, z: 40 },
    dt: 0.1,
    maxSpeed: 6,
    fieldWidth: 120,
    fieldDepth: 80,
    speedSlack: 1,
  });

  assert.equal(result.capped, true);
  assert.deepEqual(result.violations, ['live_speed_cap']);
  assert.ok(Math.hypot(result.position.x, result.position.z) <= 0.601);
  assert.ok(result.attemptedSpeed > 400);
  assert.equal(result.allowedSpeed, 6);
});

test('V28 live movement authority allows explicitly tagged restart teleports', () => {
  const result = enforceLiveMovementAuthority({
    previous: { x: -30, z: 0 },
    attempted: { x: 0, z: 0 },
    dt: 0.1,
    maxSpeed: 6,
    fieldWidth: 120,
    fieldDepth: 80,
    allowTeleport: true,
    speedSlack: 1,
  });

  assert.equal(result.capped, false);
  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.position, { x: 0, z: 0 });
});
