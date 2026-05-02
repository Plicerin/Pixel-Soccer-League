import test from 'node:test';
import assert from 'node:assert/strict';

import {
  chooseTelemetryCoachCounterActionRole,
  chooseTelemetryOpponentCoachAdjustment,
  createTelemetryCoachPlanFromRealMovement,
  createTelemetryOpponentCoachThreatMemory,
  isTelemetryCoachExperimentEnabled,
  recordTelemetryOpponentCoachThreat,
  shouldTelemetryCoachSuppressStrikerShot,
} from '../src/ai/telemetryCoach.ts';
import {
  createRoboflowSportsTrackingFrame,
  deriveRoboflowSportsCoachControl,
} from '../src/ai/roboflowSportsTracking.ts';
import {
  deriveMetricaEventCoachControl,
  METRICA_SAMPLE_EVENT_PROFILE,
} from '../src/ai/metricaEventModel.ts';

test('telemetry coach plan encodes real-movement attacking constraints', () => {
  const plan = createTelemetryCoachPlanFromRealMovement();

  assert.equal(plan.source, 'roboflow_sports_realtime_tracking_profile');
  assert.equal(plan.deliveryPriority[0], 'CUTBACK');
  assert.equal(plan.deliveryPriority[1], 'SECOND_WAVE');
  assert.equal(plan.suppressions.undefinedDeliveries, true);
  assert.equal(plan.suppressions.longCentralStrikerShots, true);
  assert.ok(plan.attackingPrinciples.targetWidth.finalThird > 35);
  assert.ok(plan.attackingPrinciples.minBoxAttackersBeforeDelivery >= 2);
  assert.equal(plan.positionalTracking.source, 'roboflow/sports');
  assert.equal(plan.positionalTracking.mode, 'RADAR');
  assert.equal(plan.positionalTracking.pitch.lengthMeters, 120);
  assert.equal(plan.positionalTracking.pitch.widthMeters, 70);
  assert.deepEqual(plan.positionalTracking.frameInputs, [
    'player_detection',
    'player_tracking',
    'team_classification',
    'pitch_keypoints',
    'ball_detection',
  ]);
  assert.equal(plan.eventModel.source, 'metrica-sports/sample-data');
  assert.equal(plan.eventModel.pitch.lengthMeters, 105);
  assert.equal(plan.eventModel.pitch.widthMeters, 68);
  assert.equal(plan.eventModel.perGame.shots, 24);
  assert.equal(plan.eventModel.perGame.shotsPerTeam, 12);
  assert.equal(plan.eventModel.perGame.passesPerShot, 36.73);
  assert.equal(plan.eventModel.shots.onTarget, 21);
});

test('roboflow sports tracking frame converts live pitch positions into coach metrics', () => {
  const frame = createRoboflowSportsTrackingFrame({
    attackingTeam: 'A',
    attackingDirection: 1,
    frameTimeSeconds: 12.4,
    ball: { id: 'ball', x: 35, z: 12 },
    entities: [
      { id: 'a-carrier', team: 'A', className: 'player', x: 35, z: 12, hasBall: true },
      { id: 'a-cutback', team: 'A', className: 'player', x: 42, z: 3 },
      { id: 'a-second', team: 'A', className: 'player', x: 37, z: -6 },
      { id: 'a-wide', team: 'A', className: 'player', x: 34, z: 29 },
      { id: 'b-pressure', team: 'B', className: 'player', x: 36, z: 13 },
      { id: 'b-lane-1', team: 'B', className: 'player', x: 43, z: 1 },
      { id: 'b-lane-2', team: 'B', className: 'player', x: 45, z: -3 },
    ],
  });

  assert.equal(frame.source, 'roboflow_sports_radar_tracking');
  assert.equal(frame.carrier?.id, 'a-carrier');
  assert.equal(frame.metrics.phase, 'finalThird');
  assert.equal(frame.metrics.pressureCount, 1);
  assert.equal(frame.metrics.cutbackAvailable, true);
  assert.equal(frame.metrics.secondWaveAvailable, true);
  assert.equal(frame.metrics.wideOutletAvailable, true);
  assert.equal(frame.metrics.shotLaneCrowded, true);
});

test('roboflow sports tracking raises release and pass urgency from live pressure and lanes', () => {
  const plan = createTelemetryCoachPlanFromRealMovement();
  const frame = createRoboflowSportsTrackingFrame({
    attackingTeam: 'A',
    attackingDirection: 1,
    frameTimeSeconds: 8,
    ball: { id: 'ball', x: 36, z: 10 },
    entities: [
      { id: 'a-carrier', team: 'A', className: 'player', x: 36, z: 10, hasBall: true },
      { id: 'a-cutback', team: 'A', className: 'player', x: 43, z: 2 },
      { id: 'a-runner', team: 'A', className: 'player', x: 49, z: 0 },
      { id: 'b-pressure-1', team: 'B', className: 'player', x: 37, z: 11 },
      { id: 'b-pressure-2', team: 'B', className: 'player', x: 38, z: 8 },
    ],
  });
  const control = deriveRoboflowSportsCoachControl(frame, plan.positionalTracking.learnedControl);

  assert.ok(control.releaseUrgency > plan.positionalTracking.learnedControl.releaseUrgency);
  assert.ok(control.passRiskTolerance > plan.positionalTracking.learnedControl.passRiskTolerance);
  assert.ok(control.supportUrgency > plan.positionalTracking.learnedControl.supportUrgency);
});

test('metrica event model raises shot release when pass rhythm is below sample shot volume', () => {
  const plan = createTelemetryCoachPlanFromRealMovement();
  const adjustment = deriveMetricaEventCoachControl({
    matchProgress: 0.5,
    teamShots: 2,
    teamPasses: 120,
    teamCorners: 0,
  }, plan.positionalTracking.learnedControl, METRICA_SAMPLE_EVENT_PROFILE);

  assert.equal(adjustment.metrics.targetShotsPerTeam, 12);
  assert.ok(adjustment.metrics.shotDeficit > 3);
  assert.ok(adjustment.metrics.passesPerShot > adjustment.metrics.targetPassesPerShot);
  assert.ok(adjustment.control.releaseUrgency > plan.positionalTracking.learnedControl.releaseUrgency);
  assert.ok(adjustment.control.shotUrgency > plan.positionalTracking.learnedControl.shotUrgency);
});

test('telemetry coach experiment is only enabled by explicit query', () => {
  assert.equal(isTelemetryCoachExperimentEnabled('?telemetryCoach=1'), true);
  assert.equal(isTelemetryCoachExperimentEnabled('?coach=telemetry'), true);
  assert.equal(isTelemetryCoachExperimentEnabled('?telemetryCoach=0'), false);
  assert.equal(isTelemetryCoachExperimentEnabled(''), false);
});

test('telemetry coach suppresses low-value long striker shots but keeps premium chances', () => {
  assert.equal(shouldTelemetryCoachSuppressStrikerShot({
    role: 'ST',
    distToGoal: 19.2,
    inTapInZone: false,
    faceToFaceWithKeeper: false,
    keeperProximityShotForce: false,
    shotLaneBlocked: true,
    closePressure: 1,
  }), true);

  assert.equal(shouldTelemetryCoachSuppressStrikerShot({
    role: 'ST',
    distToGoal: 8.4,
    inTapInZone: false,
    faceToFaceWithKeeper: true,
    keeperProximityShotForce: false,
    shotLaneBlocked: true,
    closePressure: 2,
  }), false);
});

test('opponent coach adapts after repeated telemetry final actions', () => {
  let memory = createTelemetryOpponentCoachThreatMemory();
  assert.deepEqual(chooseTelemetryOpponentCoachAdjustment(memory), {
    primaryThreat: 'BALANCED',
    confidence: 0,
    overCoverRoles: [],
    pressCarrier: false,
  });

  memory = recordTelemetryOpponentCoachThreat(memory, 'NEAR_POST');
  memory = recordTelemetryOpponentCoachThreat(memory, 'NEAR_POST');
  memory = recordTelemetryOpponentCoachThreat(memory, 'CUTBACK');

  const adjustment = chooseTelemetryOpponentCoachAdjustment(memory);
  assert.equal(adjustment.primaryThreat, 'NEAR_POST');
  assert.equal(adjustment.confidence > 0.6, true);
  assert.deepEqual(adjustment.overCoverRoles, ['NEAR_POST', 'CUTBACK']);
  assert.equal(adjustment.pressCarrier, false);
});

test('attacking coach counters opponent over-cover by selecting an uncovered planned action', () => {
  const counterRole = chooseTelemetryCoachCounterActionRole({
    deliveryPriority: ['CUTBACK', 'SECOND_WAVE', 'NEAR_POST', 'FAR_POST'],
    availableRoles: ['CUTBACK', 'SECOND_WAVE', 'NEAR_POST'],
    opponentAdjustment: {
      primaryThreat: 'CUTBACK',
      confidence: 0.67,
      overCoverRoles: ['CUTBACK', 'SECOND_WAVE'],
      pressCarrier: true,
    },
  });

  assert.equal(counterRole, 'NEAR_POST');
});
