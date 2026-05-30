import test from 'node:test';
import assert from 'node:assert/strict';

import { buildOutfielderBT, createPlayerControllerState, tickPlayerController, type PlayerControllerState } from '../src/ai/playerController.ts';
import { evaluateCarryOption, evaluateDefensiveCoverPosition, evaluatePassOptions, evaluatePressTarget, evaluateShotOptions, evaluateSupportPosition, shouldIntercept } from '../src/ai/intentEvaluators.ts';
import { createBallPhysicsState, executeBallCommand, updateBallPhysics } from '../src/core/ballPhysics.ts';
import { createBlackboard } from '../src/core/blackboard.ts';
import { createGameOrchestrator } from '../src/core/gameOrchestrator.ts';
import { createGameEngineBridge, enableOrchestrator, mapLegacyRoleToOrchestratorRole, syncBallToOrchestrator, tickBridge } from '../src/core/gameEngineBridge.ts';
import { FIELD_D, FIELD_W, GOAL_MOUTH_HALF_Z } from '../src/core/constants.ts';
import type { MatchBelief, PlayerBelief, PlayerIntent } from '../src/core/types.ts';

function makeRatings() {
  return {
    pace: 80,
    shooting: 70,
    passing: 75,
    dribbling: 78,
    defending: 55,
    physical: 72,
    acceleration: 79,
    agility: 74,
    stamina: 80,
    strength: 70,
    finishing: 68,
    shortPassing: 76,
    longPassing: 70,
    defensiveAwareness: 55,
    standingTackle: 50,
    reactions: 72,
    gkDiving: 10,
    gkHandling: 10,
    gkKicking: 10,
    gkReflexes: 10,
    gkPositioning: 10,
  };
}

function makePlayer(overrides: Partial<PlayerBelief> = {}): PlayerBelief {
  return {
    id: 'p1',
    team: 'home',
    role: 'CM_L',
    pos: { x: -4, z: 2 },
    vel: { x: 0, z: 0 },
    facingRad: 0,
    stamina01: 1,
    hasBall: false,
    isGK: false,
    speed: 6,
    acceleration: 12,
    currentIntent: null,
    ratings: makeRatings(),
    ...overrides,
  };
}

function makeBelief(player: PlayerBelief): MatchBelief {
  return {
    tick: 1,
    homePlayers: [player],
    awayPlayers: [],
    ball: {
      pos: { x: 0, z: 0 },
      vel: { x: 0, z: 0 },
      height: 0,
      ownerPlayerId: player.hasBall ? player.id : null,
      ownerTeam: player.hasBall ? player.team : null,
      state: player.hasBall ? 'attached' : 'dead',
    },
    homeAttackSign: 1,
    awayAttackSign: -1,
    matchMinute: 1,
    scoreDiff: 0,
  };
}

function makeOrchestratorPlayer(id: string, team: 'home' | 'away', role: PlayerBelief['role'], x: number, z: number) {
  return {
    id,
    team,
    role,
    displayRole: role,
    displayName: id,
    pos: { x, z },
    homePos: { x, z },
    prevPos: { x, z },
    vel: { x: 0, z: 0 },
    facingRad: 0,
    stamina01: 1,
    hasBall: false,
    isGK: role === 'GK',
    ratings: makeRatings(),
    speed: 6,
    acceleration: 12,
  };
}

test('new architecture player controller stores the full last intent object', () => {
  const player = makePlayer();
  const belief = makeBelief(player);
  const blackboard = createBlackboard('home');
  blackboard.roleSlots = [
    {
      playerId: player.id,
      role: player.role,
      targetPos: { x: 10, z: -3 },
      priority: 1,
      confidence: 1,
    },
  ];

  const result = tickPlayerController(
    createPlayerControllerState(player.id, 8),
    player,
    belief,
    blackboard,
    buildOutfielderBT(),
    0.2,
  );

  assert.ok(result);
  assert.equal(result.intent.name, 'move_to');
  assert.deepEqual(result.newState.lastIntentObj, result.intent);
});

test('new architecture player controller reuses the last actionable intent between ticks', () => {
  const player = makePlayer();
  const belief = makeBelief(player);
  const blackboard = createBlackboard('home');
  const lastIntent: PlayerIntent = {
    name: 'move_to',
    target: { x: 12, z: 5 },
    urgency: 0.7,
  };
  const state: PlayerControllerState = {
    ...createPlayerControllerState(player.id, 8),
    lastIntent: lastIntent.name,
    lastIntentObj: lastIntent,
    timeSinceTick: 0.02,
  };

  const result = tickPlayerController(
    state,
    player,
    belief,
    blackboard,
    buildOutfielderBT(),
    0.016,
  );

  assert.ok(result);
  assert.deepEqual(result.intent, lastIntent);
  assert.notEqual(result.intent.name, 'hold_position');
});

test('attached orchestrator ball is not overwritten by kickoff-era legacy ball state', () => {
  const bridge = createGameEngineBridge([
    {
      id: '9',
      team: 'A',
      role: 'ST',
      pos: { x: -1.2, z: -4.9 },
      isGK: false,
      ratings: makeRatings(),
    },
  ]);
  enableOrchestrator(bridge, 'home');

  const orchBall = bridge.orchestrator.getBallState();
  const before = { ...orchBall.pos };

  syncBallToOrchestrator(bridge, {
    pos: { x: 0, y: 0.15, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    isFlying: false,
    isRolling: false,
    heldBy: null,
  });

  assert.equal(orchBall.state, 'attached');
  assert.equal(orchBall.ownerPlayerId, '9');
  assert.deepEqual(orchBall.pos, before);
});

test('kickoff-era bridge sync preserves intended receiver metadata for orchestrator collection', () => {
  const bridge = createGameEngineBridge([
    {
      id: '9',
      team: 'A',
      role: 'ST',
      pos: { x: 0, z: 0 },
      isGK: false,
      ratings: makeRatings(),
    },
    {
      id: '10',
      team: 'A',
      role: 'AM',
      pos: { x: 3.2, z: 3.4 },
      isGK: false,
      ratings: makeRatings(),
    },
  ]);
  enableOrchestrator(bridge, 'home');

  syncBallToOrchestrator(bridge, {
    pos: { x: 0.22, y: 0.15, z: 0.22 },
    vel: { x: 7.1, y: 0, z: 5.4 },
    isFlying: false,
    isRolling: true,
    heldBy: null,
    lastHeldBy: { id: '9' },
    intendedReceiver: { id: '10' },
    intendedTeam: 'A',
    intendedUntil: 2.0,
  });

  const orchBall = bridge.orchestrator.getBallState();
  assert.equal(orchBall.state, 'loose');
  assert.equal(orchBall.lastHeldById, '9');
  assert.equal(orchBall.intendedReceiverId, '10');
  assert.equal(orchBall.intendedTeam, 'home');
  assert.equal(orchBall.intendedUntil, 2.0);
});

test('kickoff-era bridge handoff keeps the staged receiver available to collect the rolling pass', () => {
  const bridge = createGameEngineBridge([
    {
      id: '9',
      team: 'A',
      role: 'ST',
      pos: { x: 0, z: 0 },
      isGK: false,
      ratings: makeRatings(),
    },
    {
      id: '10',
      team: 'A',
      role: 'AM',
      pos: { x: 3.2, z: 3.4 },
      isGK: false,
      ratings: makeRatings(),
    },
    {
      id: '20',
      team: 'B',
      role: 'CB_L',
      pos: { x: 10, z: 0 },
      isGK: false,
      ratings: makeRatings(),
    },
  ]);
  enableOrchestrator(bridge, 'home');

  syncBallToOrchestrator(bridge, {
    pos: { x: 0.22, y: 0.15, z: 0.22 },
    vel: { x: 7.1, y: 0, z: 5.4 },
    isFlying: false,
    isRolling: true,
    heldBy: null,
    lastHeldBy: { id: '9', pos: { x: 0, z: 0 } },
    intendedReceiver: { id: '10', pos: { x: 3.2, z: 3.4 } },
    intendedTeam: 'A',
    intendedUntil: 2.0,
  });

  let result = tickBridge(bridge, 0.05, 0.05);
  for (let i = 0; i < 20 && result?.ball.ownerPlayerId !== '10'; i++) {
    result = tickBridge(bridge, 0.05, 0.1 + i * 0.05);
  }

  assert.ok(result);
  assert.equal(result.ball.ownerPlayerId, '10');
  assert.equal(result.ball.ownerTeam, 'home');
});

test('legacy bridge sync cannot overwrite orchestrator ball once ORCH_V2 has ticked live', () => {
  const bridge = createGameEngineBridge([
    {
      id: '9',
      team: 'A',
      role: 'ST',
      pos: { x: 0, z: 0 },
      isGK: false,
      ratings: makeRatings(),
    },
    {
      id: '10',
      team: 'A',
      role: 'AM',
      pos: { x: 3.2, z: 3.4 },
      isGK: false,
      ratings: makeRatings(),
    },
  ]);
  enableOrchestrator(bridge, 'home');

  syncBallToOrchestrator(bridge, {
    pos: { x: 0.22, y: 0.15, z: 0.22 },
    vel: { x: 7.1, y: 0, z: 5.4 },
    isFlying: false,
    isRolling: true,
    heldBy: null,
    lastHeldBy: { id: '9', pos: { x: 0, z: 0 } },
    intendedReceiver: { id: '10', pos: { x: 3.2, z: 3.4 } },
    intendedTeam: 'A',
    intendedUntil: 2.0,
  });

  const firstTick = tickBridge(bridge, 0.05, 0.05);
  assert.ok(firstTick);
  const before = {
    state: bridge.orchestrator.getBallState().state,
    pos: { ...bridge.orchestrator.getBallState().pos },
    vel: { ...bridge.orchestrator.getBallState().vel },
  };

  syncBallToOrchestrator(bridge, {
    pos: { x: 25, y: 0.15, z: 25 },
    vel: { x: 0, y: 0, z: 0 },
    isFlying: false,
    isRolling: false,
    heldBy: null,
  });

  assert.equal(bridge.orchestrator.getBallState().state, before.state);
  assert.deepEqual(bridge.orchestrator.getBallState().pos, before.pos);
  assert.deepEqual(bridge.orchestrator.getBallState().vel, before.vel);
});

test('bridge homeAttackSign keeps keepers on their own defensive sides', () => {
  const bridge = createGameEngineBridge([
    {
      id: 'home-gk',
      team: 'A',
      role: 'GK',
      pos: { x: -28, z: 0 },
      isGK: true,
      ratings: makeRatings(),
    },
    {
      id: 'away-gk',
      team: 'B',
      role: 'GK',
      pos: { x: 28, z: 0 },
      isGK: true,
      ratings: makeRatings(),
    },
  ], {
    homeAttackSign: 1,
  });

  enableOrchestrator(bridge, 'home');
  const result = tickBridge(bridge, 0.25, 0.25);

  assert.ok(result);
  const homeGk = result.players.find((p) => p.id === 'home-gk');
  const awayGk = result.players.find((p) => p.id === 'away-gk');

  assert.ok(homeGk);
  assert.ok(awayGk);
  assert.ok(homeGk.pos.x < 0, 'home keeper should stay on the left defensive side when home attacks right');
  assert.ok(awayGk.pos.x > 0, 'away keeper should stay on the right defensive side when home attacks right');
});

test('bridge maps legacy roles into explicit orchestrator roles', () => {
  assert.equal(mapLegacyRoleToOrchestratorRole('CB', { x: -12, z: -6 }, false), 'CB_L');
  assert.equal(mapLegacyRoleToOrchestratorRole('CB', { x: -12, z: 6 }, false), 'CB_R');
  assert.equal(mapLegacyRoleToOrchestratorRole('CM', { x: 0, z: -4 }, false), 'CM_L');
  assert.equal(mapLegacyRoleToOrchestratorRole('CM', { x: 0, z: 4 }, false), 'CM_R');
  assert.equal(mapLegacyRoleToOrchestratorRole('LM', { x: 0, z: 9 }, false), 'LW');
  assert.equal(mapLegacyRoleToOrchestratorRole('RM', { x: 0, z: -9 }, false), 'RW');
});

test('bridge rejects unmapped legacy roles instead of silently bleeding them into ORCH_V2', () => {
  assert.throws(
    () => mapLegacyRoleToOrchestratorRole('SWEEPER', { x: 0, z: 0 }, false),
    /Unsupported legacy role/,
  );
});

test('pass commands preserve intended receiver metadata for collection windows', () => {
  const ball = createBallPhysicsState();

  executeBallCommand(ball, {
    kind: 'pass',
    from: { x: 0, z: 0 },
    to: { x: 10, z: 0 },
    speed: 8,
    type: 'short',
    intendedReceiverId: 'receiver-9',
    intendedTeam: 'home',
  }, 12);

  assert.equal(ball.state, 'in_flight');
  assert.equal(ball.intendedReceiverId, 'receiver-9');
  assert.equal(ball.intendedTeam, 'home');
  assert.ok(ball.intendedUntil > 12);
});

test('nearest player chases a slow loose ball instead of holding shape', () => {
  const chaser = makePlayer({
    id: 'chaser',
    pos: { x: 1.2, z: 0.4 },
  });
  const support = makePlayer({
    id: 'support',
    pos: { x: 7, z: 0 },
  });
  const opponent = makePlayer({
    id: 'opp',
    team: 'away',
    pos: { x: 5, z: 0 },
  });

  const belief: MatchBelief = {
    tick: 1,
    homePlayers: [chaser, support],
    awayPlayers: [opponent],
    ball: {
      pos: { x: 0, z: 0 },
      vel: { x: 0.2, z: 0 },
      height: 0,
      ownerPlayerId: null,
      ownerTeam: null,
      state: 'loose',
    },
    homeAttackSign: 1,
    awayAttackSign: -1,
    matchMinute: 1,
    scoreDiff: 0,
  };

  const intercept = shouldIntercept(chaser, belief);
  const supportIntercept = shouldIntercept(support, belief);

  assert.ok(intercept);
  assert.deepEqual(intercept.point, { x: 0, z: 0 });
  assert.equal(supportIntercept, null);
});

test('stationary pass receivers are targeted at their current position', () => {
  const carrier = makePlayer({
    id: 'carrier',
    hasBall: true,
    pos: { x: 0, z: 0 },
  });
  const receiver = makePlayer({
    id: 'receiver',
    pos: { x: 8, z: 2 },
    vel: { x: 0, z: 0 },
  });
  const belief: MatchBelief = {
    tick: 1,
    homePlayers: [carrier, receiver],
    awayPlayers: [makePlayer({ id: 'opp', team: 'away', pos: { x: 4, z: -1 } })],
    ball: {
      pos: { x: 0, z: 0 },
      vel: { x: 0, z: 0 },
      height: 0,
      ownerPlayerId: carrier.id,
      ownerTeam: carrier.team,
      state: 'attached',
    },
    homeAttackSign: 1,
    awayAttackSign: -1,
    matchMinute: 1,
    scoreDiff: 0,
  };

  const options = evaluatePassOptions(carrier, belief, createBlackboard('home'));
  const option = options.find((o) => o.targetPlayerId === receiver.id);

  assert.ok(option);
  assert.deepEqual(option.targetPoint, receiver.pos);
});

test('new architecture finish intent produces viable shot options in the final third', () => {
  const striker = makePlayer({
    id: 'striker',
    role: 'ST',
    hasBall: true,
    pos: { x: 17, z: 1.2 },
  });
  const belief: MatchBelief = {
    tick: 1,
    homePlayers: [striker],
    awayPlayers: [
      makePlayer({ id: 'cb', team: 'away', pos: { x: 21, z: 0.8 } }),
      makePlayer({ id: 'dm', team: 'away', pos: { x: 20, z: -2.2 } }),
    ],
    ball: {
      pos: { x: striker.pos.x, z: striker.pos.z },
      vel: { x: 0, z: 0 },
      height: 0,
      ownerPlayerId: striker.id,
      ownerTeam: striker.team,
      state: 'attached',
    },
    homeAttackSign: 1,
    awayAttackSign: -1,
    matchMinute: 72,
    scoreDiff: 0,
  };
  const blackboard = createBlackboard('home');
  blackboard.phase = 'final_third';
  blackboard.intent = { kind: 'finish', shotQuality: 0.7 };

  const shots = evaluateShotOptions(striker, belief, blackboard);

  assert.ok(shots.length > 0);
  assert.ok(shots[0].quality >= 0.16);
});

test('new architecture carrier policy shoots instead of endlessly recycling in finish phase', () => {
  const striker = makePlayer({
    id: 'striker',
    role: 'ST',
    hasBall: true,
    pos: { x: 18, z: 0.6 },
  });
  const teammate = makePlayer({
    id: 'wing',
    role: 'RW',
    pos: { x: 20, z: 8.5 },
  });
  const belief: MatchBelief = {
    tick: 1,
    homePlayers: [striker, teammate],
    awayPlayers: [
      makePlayer({ id: 'cb', team: 'away', pos: { x: 22.5, z: 0.2 } }),
      makePlayer({ id: 'lb', team: 'away', pos: { x: 19.5, z: 5.8 } }),
    ],
    ball: {
      pos: { x: striker.pos.x, z: striker.pos.z },
      vel: { x: 0, z: 0 },
      height: 0,
      ownerPlayerId: striker.id,
      ownerTeam: striker.team,
      state: 'attached',
    },
    homeAttackSign: 1,
    awayAttackSign: -1,
    matchMinute: 77,
    scoreDiff: 0,
  };
  const blackboard = createBlackboard('home');
  blackboard.phase = 'final_third';
  blackboard.intent = { kind: 'finish', shotQuality: 0.74 };
  blackboard.roleSlots = [
    { playerId: striker.id, role: striker.role, targetPos: striker.pos, priority: 1, confidence: 1 },
    { playerId: teammate.id, role: teammate.role, targetPos: teammate.pos, priority: 1, confidence: 1 },
  ];

  const result = tickPlayerController(
    createPlayerControllerState(striker.id, 8),
    striker,
    belief,
    blackboard,
    buildOutfielderBT(),
    0.2,
  );

  assert.ok(result);
  assert.equal(result.intent.name, 'shoot');
});

test('new architecture center backs do not take speculative final-third shots', () => {
  const cb = makePlayer({
    id: 'cb-carrier',
    role: 'CB_L',
    hasBall: true,
    pos: { x: 17, z: 1.4 },
  });
  const striker = makePlayer({
    id: 'striker',
    role: 'ST',
    pos: { x: 20, z: 3.8 },
  });
  const belief: MatchBelief = {
    tick: 1,
    homePlayers: [cb, striker],
    awayPlayers: [
      makePlayer({ id: 'away-cb', team: 'away', pos: { x: 23.5, z: 0.3 } }),
      makePlayer({ id: 'away-dm', team: 'away', pos: { x: 21.5, z: 2.4 } }),
    ],
    ball: {
      pos: { x: cb.pos.x, z: cb.pos.z },
      vel: { x: 0, z: 0 },
      height: 0,
      ownerPlayerId: cb.id,
      ownerTeam: cb.team,
      state: 'attached',
    },
    homeAttackSign: 1,
    awayAttackSign: -1,
    matchMinute: 69,
    scoreDiff: 0,
  };
  const blackboard = createBlackboard('home');
  blackboard.phase = 'final_third';
  blackboard.intent = { kind: 'attack', pattern: 'central_through', carrierId: cb.id };
  blackboard.roleSlots = [
    { playerId: cb.id, role: cb.role, targetPos: cb.pos, priority: 1, confidence: 1 },
    { playerId: striker.id, role: striker.role, targetPos: striker.pos, priority: 1, confidence: 1 },
  ];

  const result = tickPlayerController(
    createPlayerControllerState(cb.id, 8),
    cb,
    belief,
    blackboard,
    buildOutfielderBT(),
    0.2,
  );

  assert.ok(result);
  assert.notEqual(result.intent.name, 'shoot');
});

test('new architecture carry option drives goalward in the final third', () => {
  const carrier = makePlayer({
    id: 'carrier',
    role: 'RW',
    hasBall: true,
    pos: { x: 14, z: 10 },
  });
  const belief: MatchBelief = {
    tick: 1,
    homePlayers: [carrier],
    awayPlayers: [makePlayer({ id: 'fullback', team: 'away', pos: { x: 16, z: 9.5 } })],
    ball: {
      pos: { x: carrier.pos.x, z: carrier.pos.z },
      vel: { x: 0, z: 0 },
      height: 0,
      ownerPlayerId: carrier.id,
      ownerTeam: carrier.team,
      state: 'attached',
    },
    homeAttackSign: 1,
    awayAttackSign: -1,
    matchMinute: 64,
    scoreDiff: 0,
  };
  const blackboard = createBlackboard('home');
  blackboard.phase = 'final_third';
  blackboard.intent = { kind: 'attack', pattern: 'wing_cutback', carrierId: carrier.id };

  const carry = evaluateCarryOption(carrier, belief, blackboard);

  assert.ok(carry.target.x > carrier.pos.x);
  assert.ok(Math.abs(carry.target.z) < Math.abs(carrier.pos.z));
});

test('new architecture progression intent carries instead of taking a harmless recycle pass', () => {
  const carrier = makePlayer({
    id: 'carrier',
    role: 'CM_L',
    hasBall: true,
    pos: { x: 6, z: 1 },
  });
  const outlet = makePlayer({
    id: 'outlet',
    role: 'LW',
    pos: { x: 9, z: 2 },
  });
  const belief: MatchBelief = {
    tick: 1,
    homePlayers: [carrier, outlet],
    awayPlayers: [
      makePlayer({ id: 'cb', team: 'away', pos: { x: 14, z: 0.5 } }),
    ],
    ball: {
      pos: { x: carrier.pos.x, z: carrier.pos.z },
      vel: { x: 0, z: 0 },
      height: 0,
      ownerPlayerId: carrier.id,
      ownerTeam: carrier.team,
      state: 'attached',
    },
    homeAttackSign: 1,
    awayAttackSign: -1,
    matchMinute: 32,
    scoreDiff: 0,
  };
  const blackboard = createBlackboard('home');
  blackboard.phase = 'progression';
  blackboard.intent = { kind: 'progress', side: 'center' };
  blackboard.roleSlots = [
    { playerId: carrier.id, role: carrier.role, targetPos: carrier.pos, priority: 1, confidence: 1 },
    { playerId: outlet.id, role: outlet.role, targetPos: outlet.pos, priority: 1, confidence: 1 },
  ];

  const result = tickPlayerController(
    createPlayerControllerState(carrier.id, 8),
    carrier,
    belief,
    blackboard,
    buildOutfielderBT(),
    0.2,
  );

  assert.ok(result);
  assert.equal(result.intent.name, 'carry');
  assert.ok(result.intent.target.x > carrier.pos.x);
});

test('new architecture breaks repeated settled-possession recycle into a carry', () => {
  const carrier = makePlayer({
    id: 'carrier',
    role: 'CM_L',
    hasBall: true,
    pos: { x: 2, z: 0.5 },
  });
  const outlet = makePlayer({
    id: 'outlet',
    role: 'CM_R',
    pos: { x: 4.5, z: 1.2 },
  });
  const belief: MatchBelief = {
    tick: 1,
    homePlayers: [carrier, outlet],
    awayPlayers: [
      makePlayer({ id: 'cb', team: 'away', pos: { x: 13, z: 0 } }),
    ],
    ball: {
      pos: { x: carrier.pos.x, z: carrier.pos.z },
      vel: { x: 0, z: 0 },
      height: 0,
      ownerPlayerId: carrier.id,
      ownerTeam: carrier.team,
      state: 'attached',
    },
    homeAttackSign: 1,
    awayAttackSign: -1,
    matchMinute: 24,
    scoreDiff: 0,
  };
  const blackboard = createBlackboard('home');
  blackboard.phase = 'build_up';
  blackboard.intent = { kind: 'possess', widthPreference: 0.5 };
  blackboard.roleSlots = [
    { playerId: carrier.id, role: carrier.role, targetPos: carrier.pos, priority: 1, confidence: 1 },
    { playerId: outlet.id, role: outlet.role, targetPos: outlet.pos, priority: 1, confidence: 1 },
  ];

  const state = createPlayerControllerState(carrier.id, 8);
  state.lastTick = 12;
  state.recentIntents = [
    { name: 'pass', tick: 12 },
    { name: 'pass', tick: 11 },
    { name: 'pass', tick: 10 },
  ];
  state.lastIntent = 'pass';
  state.lastIntentObj = {
    name: 'pass',
    targetPlayerId: outlet.id,
    type: 'short',
    weight: 1,
    targetPoint: outlet.pos,
  };

  const result = tickPlayerController(
    state,
    carrier,
    belief,
    blackboard,
    buildOutfielderBT(),
    0.2,
  );

  assert.ok(result);
  assert.equal(result.intent.name, 'carry');
  assert.ok(result.intent.target.x > carrier.pos.x);
});

test('new architecture kickoff opens each half with a protected short pass to a staged teammate', () => {
  const orchestrator = createGameOrchestrator([
    makeOrchestratorPlayer('home-st', 'home', 'ST', -2, 0),
    makeOrchestratorPlayer('home-am', 'home', 'AM', -6, 2),
    makeOrchestratorPlayer('home-cm', 'home', 'CM_L', -8, -3),
    makeOrchestratorPlayer('away-st', 'away', 'ST', 2, 0),
    makeOrchestratorPlayer('away-cb', 'away', 'CB_L', 10, 0),
  ], {
    homeAttackSign: 1,
    halfDuration: 60,
    teamServiceHz: 4,
    playerControllerHz: 8,
  });

  const result = orchestrator.tick(0.6, 0.6);

  assert.equal(result.matchState.kind, 'live_play');
  assert.equal(result.ball.state, 'in_flight');
  assert.equal(result.ball.ownerPlayerId, null);
  assert.equal(orchestrator.getBallState().intendedReceiverId, 'home-am');
  assert.ok(result.ball.vel.x > 0);
  const receiver = result.players.find((p) => p.id === 'home-am');
  assert.ok(receiver);
  assert.ok(receiver.pos.x > 0);

  let settled = result;
  for (let i = 0; i < 20; i++) {
    settled = orchestrator.tick(0.05, 0.65 + i * 0.05);
    if (settled.ball.ownerPlayerId === 'home-am') break;
  }

  assert.equal(settled.ball.ownerPlayerId, 'home-am');
  assert.equal(settled.ball.ownerTeam, 'home');
  assert.ok(settled.ball.pos.x > 0);
});

test('new architecture post-goal restart uses the same protected kickoff pass', () => {
  const orchestrator = createGameOrchestrator([
    makeOrchestratorPlayer('home-st', 'home', 'ST', -2, 0),
    makeOrchestratorPlayer('home-am', 'home', 'AM', -6, 2),
    makeOrchestratorPlayer('away-st', 'away', 'ST', 2, 0),
    makeOrchestratorPlayer('away-am', 'away', 'AM', 6, -2),
    makeOrchestratorPlayer('away-cm', 'away', 'CM_L', 8, 3),
  ], {
    homeAttackSign: 1,
    halfDuration: 60,
    teamServiceHz: 4,
    playerControllerHz: 8,
  });

  orchestrator.forceMatchState({ kind: 'goal_scored', scoringTeam: 'home', restartAfter: 2.0 });
  orchestrator.tick(0.1, 0.1);
  const result = orchestrator.tick(0.6, 0.7);

  assert.equal(result.matchState.kind, 'live_play');
  assert.equal(result.ball.state, 'in_flight');
  assert.equal(result.ball.ownerPlayerId, null);
  assert.equal(orchestrator.getBallState().intendedReceiverId, 'away-am');
  assert.ok(result.ball.vel.x < 0);

  let settled = result;
  for (let i = 0; i < 20; i++) {
    settled = orchestrator.tick(0.05, 0.75 + i * 0.05);
    if (settled.ball.ownerPlayerId === 'away-am') break;
  }

  assert.equal(settled.ball.ownerPlayerId, 'away-am');
  assert.equal(settled.ball.ownerTeam, 'away');
  assert.ok(settled.ball.pos.x < 0);
});

test('new architecture post-goal restart stays correct when the restart team attacks left to right', () => {
  const orchestrator = createGameOrchestrator([
    makeOrchestratorPlayer('home-st', 'home', 'ST', 2, 0),
    makeOrchestratorPlayer('home-am', 'home', 'AM', 6, 2),
    makeOrchestratorPlayer('away-st', 'away', 'ST', -2, 0),
    makeOrchestratorPlayer('away-am', 'away', 'AM', -6, -2),
    makeOrchestratorPlayer('away-cm', 'away', 'CM_L', -8, 3),
  ], {
    homeAttackSign: -1,
    halfDuration: 60,
    teamServiceHz: 4,
    playerControllerHz: 8,
  });

  orchestrator.forceMatchState({ kind: 'goal_scored', scoringTeam: 'home', restartAfter: 2.0 });
  orchestrator.tick(0.1, 0.1);
  const result = orchestrator.tick(0.6, 0.7);

  assert.equal(result.matchState.kind, 'live_play');
  assert.equal(result.ball.state, 'in_flight');
  assert.equal(result.ball.ownerPlayerId, null);
  assert.equal(orchestrator.getBallState().intendedReceiverId, 'away-am');
  assert.ok(result.ball.vel.x > 0);

  let settled = result;
  for (let i = 0; i < 20; i++) {
    settled = orchestrator.tick(0.05, 0.75 + i * 0.05);
    if (settled.ball.ownerPlayerId === 'away-am') break;
  }

  assert.equal(settled.ball.ownerPlayerId, 'away-am');
  assert.equal(settled.ball.ownerTeam, 'away');
  assert.ok(settled.ball.pos.x > 0);
});

test('new architecture wide carriers prefer a real delivery into the box', () => {
  const winger = makePlayer({
    id: 'winger',
    role: 'RW',
    hasBall: true,
    pos: { x: 18, z: 12 },
  });
  const striker = makePlayer({
    id: 'striker',
    role: 'ST',
    pos: { x: 20, z: 1.5 },
  });
  const belief: MatchBelief = {
    tick: 1,
    homePlayers: [winger, striker],
    awayPlayers: [
      makePlayer({ id: 'cb', team: 'away', pos: { x: 22, z: 3 } }),
      makePlayer({ id: 'fb', team: 'away', pos: { x: 19, z: 10 } }),
    ],
    ball: {
      pos: { x: winger.pos.x, z: winger.pos.z },
      vel: { x: 0, z: 0 },
      height: 0,
      ownerPlayerId: winger.id,
      ownerTeam: winger.team,
      state: 'attached',
    },
    homeAttackSign: 1,
    awayAttackSign: -1,
    matchMinute: 70,
    scoreDiff: 0,
  };
  const blackboard = createBlackboard('home');
  blackboard.phase = 'final_third';
  blackboard.intent = { kind: 'attack', pattern: 'wing_cutback', carrierId: winger.id };
  blackboard.roleSlots = [
    { playerId: winger.id, role: winger.role, targetPos: winger.pos, priority: 1, confidence: 1 },
    { playerId: striker.id, role: striker.role, targetPos: striker.pos, priority: 1, confidence: 1 },
  ];

  const result = tickPlayerController(
    createPlayerControllerState(winger.id, 8),
    winger,
    belief,
    blackboard,
    buildOutfielderBT(),
    0.2,
  );

  assert.ok(result);
  assert.equal(result.intent.name, 'pass');
  assert.ok(result.intent.type === 'cross' || result.intent.type === 'cutback');
  assert.ok(Math.abs(result.intent.targetPoint.z) < Math.abs(striker.pos.z));
});

test('new architecture wide possession prefers central progression over wide recycle', () => {
  const carrier = makePlayer({
    id: 'carrier',
    role: 'RW',
    hasBall: true,
    pos: { x: 11, z: 10.5 },
  });
  const striker = makePlayer({
    id: 'striker',
    role: 'ST',
    pos: { x: 18, z: 1.2 },
  });
  const fullbackOutlet = makePlayer({
    id: 'fullback',
    role: 'RB',
    pos: { x: 13, z: 12.2 },
  });
  const belief: MatchBelief = {
    tick: 1,
    homePlayers: [carrier, striker, fullbackOutlet],
    awayPlayers: [
      makePlayer({ id: 'away-cb', team: 'away', pos: { x: 21, z: 0.8 } }),
      makePlayer({ id: 'away-fb', team: 'away', pos: { x: 15, z: 9.5 } }),
    ],
    ball: {
      pos: { x: carrier.pos.x, z: carrier.pos.z },
      vel: { x: 0, z: 0 },
      height: 0,
      ownerPlayerId: carrier.id,
      ownerTeam: carrier.team,
      state: 'attached',
    },
    homeAttackSign: 1,
    awayAttackSign: -1,
    matchMinute: 58,
    scoreDiff: 0,
  };
  const blackboard = createBlackboard('home');
  blackboard.phase = 'progression';
  blackboard.intent = { kind: 'possess', widthPreference: 0.7 };
  blackboard.roleSlots = [
    { playerId: carrier.id, role: carrier.role, targetPos: carrier.pos, priority: 1, confidence: 1 },
    { playerId: striker.id, role: striker.role, targetPos: striker.pos, priority: 1, confidence: 1 },
    { playerId: fullbackOutlet.id, role: fullbackOutlet.role, targetPos: fullbackOutlet.pos, priority: 1, confidence: 1 },
  ];

  const options = evaluatePassOptions(carrier, belief, blackboard);

  assert.ok(options.length >= 2);
  assert.equal(options[0]?.targetPlayerId, striker.id);
  assert.ok(options[0].quality > options[1].quality);
});

test('new architecture wing attacks pull runners into the box while keeping weak-side width', () => {
  const winger = makePlayer({
    id: 'winger',
    role: 'RW',
    hasBall: true,
    pos: { x: 18, z: 12 },
  });
  const striker = makePlayer({
    id: 'striker',
    role: 'ST',
    pos: { x: 13, z: 0.5 },
  });
  const am = makePlayer({
    id: 'am',
    role: 'AM',
    pos: { x: 11, z: 0.2 },
  });
  const weakSide = makePlayer({
    id: 'weak-side',
    role: 'LW',
    pos: { x: 12, z: -7 },
  });
  const belief: MatchBelief = {
    tick: 1,
    homePlayers: [winger, striker, am, weakSide],
    awayPlayers: [
      makePlayer({ id: 'cb', team: 'away', pos: { x: 22, z: 1.5 } }),
      makePlayer({ id: 'fb', team: 'away', pos: { x: 20, z: 8 } }),
    ],
    ball: {
      pos: { x: winger.pos.x, z: winger.pos.z },
      vel: { x: 0, z: 0 },
      height: 0,
      ownerPlayerId: winger.id,
      ownerTeam: winger.team,
      state: 'attached',
    },
    homeAttackSign: 1,
    awayAttackSign: -1,
    matchMinute: 73,
    scoreDiff: 0,
  };
  const blackboard = createBlackboard('home');
  blackboard.phase = 'final_third';
  blackboard.intent = { kind: 'attack', pattern: 'wing_cutback', carrierId: winger.id };
  blackboard.roleSlots = [
    { playerId: winger.id, role: winger.role, targetPos: winger.pos, priority: 1, confidence: 1 },
    { playerId: striker.id, role: striker.role, targetPos: { x: 14, z: 0 }, priority: 1, confidence: 1 },
    { playerId: am.id, role: am.role, targetPos: { x: 12, z: 0 }, priority: 1, confidence: 1 },
    { playerId: weakSide.id, role: weakSide.role, targetPos: { x: 13, z: -8 }, priority: 1, confidence: 1 },
  ];

  const strikerTarget = evaluateSupportPosition(striker, belief, blackboard);
  const amTarget = evaluateSupportPosition(am, belief, blackboard);
  const weakSideTarget = evaluateSupportPosition(weakSide, belief, blackboard);

  assert.ok(strikerTarget.x > striker.pos.x);
  assert.ok(Math.abs(strikerTarget.z) > 1 && Math.abs(strikerTarget.z) < 4.5);
  assert.ok(amTarget.x > am.pos.x);
  assert.ok(Math.abs(amTarget.z) < Math.abs(winger.pos.z));
  assert.ok(weakSideTarget.x > weakSide.pos.x);
  assert.ok(weakSideTarget.z < -4.5);
});

test('new architecture carry keeps its lane instead of flipping sides without pressure', () => {
  const carrier = makePlayer({
    id: 'carrier',
    role: 'RW',
    hasBall: true,
    pos: { x: 15, z: 9 },
  });
  const belief: MatchBelief = {
    tick: 1,
    homePlayers: [carrier],
    awayPlayers: [makePlayer({ id: 'cb', team: 'away', pos: { x: 18, z: 10 } })],
    ball: {
      pos: { x: carrier.pos.x, z: carrier.pos.z },
      vel: { x: 0, z: 0 },
      height: 0,
      ownerPlayerId: carrier.id,
      ownerTeam: carrier.team,
      state: 'attached',
    },
    homeAttackSign: 1,
    awayAttackSign: -1,
    matchMinute: 61,
    scoreDiff: 0,
  };
  const blackboard = createBlackboard('home');
  blackboard.phase = 'final_third';
  blackboard.intent = { kind: 'attack', pattern: 'wing_cutback', carrierId: carrier.id };

  const carry = evaluateCarryOption(carrier, belief, blackboard, { x: 20, z: 12 });

  assert.ok(carry.target.z > carrier.pos.z);
});

test('new architecture deep defenders keep box shape when a teammate is already pressing', () => {
  const cb = makePlayer({
    id: 'cb',
    role: 'CB_L',
    team: 'home',
    pos: { x: -22, z: -2 },
  });
  const dm = makePlayer({
    id: 'dm',
    role: 'DM',
    team: 'home',
    pos: { x: -18, z: 0.5 },
  });
  const carrier = makePlayer({
    id: 'away-carrier',
    role: 'ST',
    team: 'away',
    hasBall: true,
    pos: { x: -18, z: 1 },
  });
  const belief: MatchBelief = {
    tick: 1,
    homePlayers: [cb, dm],
    awayPlayers: [carrier],
    ball: {
      pos: { x: carrier.pos.x, z: carrier.pos.z },
      vel: { x: 0, z: 0 },
      height: 0,
      ownerPlayerId: carrier.id,
      ownerTeam: carrier.team,
      state: 'attached',
    },
    homeAttackSign: 1,
    awayAttackSign: -1,
    matchMinute: 66,
    scoreDiff: 0,
  };
  const blackboard = createBlackboard('home');
  blackboard.phase = 'defensive_block';
  blackboard.intent = { kind: 'defend', pressureLevel: 0.6 };
  blackboard.roleSlots = [
    { playerId: cb.id, role: cb.role, targetPos: cb.pos, priority: 1, confidence: 1 },
    { playerId: dm.id, role: dm.role, targetPos: dm.pos, priority: 1, confidence: 1 },
  ];

  const pressTarget = evaluatePressTarget(cb, belief, blackboard);
  const result = tickPlayerController(
    createPlayerControllerState(cb.id, 8),
    cb,
    belief,
    blackboard,
    buildOutfielderBT(),
    0.2,
  );

  assert.equal(pressTarget, null);
  assert.ok(result);
  assert.equal(result.intent.name, 'cover');
});

test('new architecture deep defenders clear under pressure near their own goal', () => {
  const cb = makePlayer({
    id: 'cb',
    role: 'CB_L',
    team: 'home',
    hasBall: true,
    pos: { x: -28, z: 1.4 },
  });
  const awayPress = makePlayer({
    id: 'away-press',
    role: 'ST',
    team: 'away',
    pos: { x: -27.2, z: 1.2 },
  });
  const belief: MatchBelief = {
    tick: 1,
    homePlayers: [cb],
    awayPlayers: [awayPress],
    ball: {
      pos: { x: cb.pos.x, z: cb.pos.z },
      vel: { x: 0, z: 0 },
      height: 0,
      ownerPlayerId: cb.id,
      ownerTeam: cb.team,
      state: 'attached',
    },
    homeAttackSign: 1,
    awayAttackSign: -1,
    matchMinute: 66,
    scoreDiff: 0,
  };
  const blackboard = createBlackboard('home');
  blackboard.phase = 'defensive_block';
  blackboard.intent = { kind: 'defend', pressureLevel: 0.7 };
  blackboard.roleSlots = [
    { playerId: cb.id, role: cb.role, targetPos: cb.pos, priority: 1, confidence: 1 },
  ];

  const result = tickPlayerController(
    createPlayerControllerState(cb.id, 8),
    cb,
    belief,
    blackboard,
    buildOutfielderBT(),
    0.2,
  );

  assert.ok(result);
  assert.equal(result.intent.name, 'clear');
  assert.ok(result.intent.direction.x > 0);
});

test('new architecture assigns deep defenders to goal-corridor cover when the carrier enters danger space', () => {
  const cb = makePlayer({
    id: 'cb',
    role: 'CB_R',
    team: 'home',
    pos: { x: -25, z: 4.5 },
  });
  const dm = makePlayer({
    id: 'dm',
    role: 'DM',
    team: 'home',
    pos: { x: -27, z: -1.5 },
  });
  const lb = makePlayer({
    id: 'lb',
    role: 'LB',
    team: 'home',
    pos: { x: -18.5, z: 2.1 },
  });
  const carrier = makePlayer({
    id: 'away-carrier',
    role: 'ST',
    team: 'away',
    hasBall: true,
    pos: { x: -17, z: 2.5 },
  });
  const belief: MatchBelief = {
    tick: 1,
    homePlayers: [cb, dm, lb],
    awayPlayers: [carrier],
    ball: {
      pos: { x: carrier.pos.x, z: carrier.pos.z },
      vel: { x: 0, z: 0 },
      height: 0,
      ownerPlayerId: carrier.id,
      ownerTeam: carrier.team,
      state: 'attached',
    },
    homeAttackSign: 1,
    awayAttackSign: -1,
    matchMinute: 71,
    scoreDiff: 0,
  };
  const blackboard = createBlackboard('home');
  blackboard.phase = 'defensive_block';
  blackboard.intent = { kind: 'defend', pressureLevel: 0.6 };

  const cbCover = evaluateDefensiveCoverPosition(cb, belief, blackboard);
  const dmCover = evaluateDefensiveCoverPosition(dm, belief, blackboard);
  assert.ok(cbCover);
  assert.equal(cbCover.role, 'near_post');
  assert.ok(cbCover.target.x > -FIELD_W / 2);
  assert.ok(cbCover.target.z > 0);
  assert.ok(dmCover);
  assert.equal(dmCover.role, 'cutback_lane');
  assert.ok(Math.abs(dmCover.target.z) < Math.abs(carrier.pos.z));
  assert.ok(dmCover.target.x > -FIELD_W / 2);
});

test('new architecture starts deep box cover before a central long shot reaches the late danger band', () => {
  const cb = makePlayer({
    id: 'cb',
    role: 'CB_L',
    team: 'home',
    pos: { x: -10, z: 2.5 },
  });
  const dm = makePlayer({
    id: 'dm',
    role: 'DM',
    team: 'home',
    pos: { x: -6, z: -0.5 },
  });
  const carrier = makePlayer({
    id: 'away-carrier',
    role: 'ST',
    team: 'away',
    hasBall: true,
    pos: { x: 14, z: 1.4 },
  });
  const belief: MatchBelief = {
    tick: 1,
    homePlayers: [cb, dm],
    awayPlayers: [carrier],
    ball: {
      pos: { x: carrier.pos.x, z: carrier.pos.z },
      vel: { x: 0, z: 0 },
      height: 0,
      ownerPlayerId: carrier.id,
      ownerTeam: carrier.team,
      state: 'attached',
    },
    homeAttackSign: 1,
    awayAttackSign: -1,
    matchMinute: 47,
    scoreDiff: 0,
  };
  const blackboard = createBlackboard('home');
  blackboard.phase = 'defensive_block';
  blackboard.intent = { kind: 'defend', pressureLevel: 0.5 };

  const cbCover = evaluateDefensiveCoverPosition(cb, belief, blackboard);
  const dmCover = evaluateDefensiveCoverPosition(dm, belief, blackboard);
  const cbPress = evaluatePressTarget(cb, belief, blackboard);

  assert.ok(cbCover);
  assert.equal(cbCover.role, 'near_post');
  assert.ok(cbCover.target.x < cb.pos.x);
  assert.ok(dmCover);
  assert.equal(dmCover.role, 'cutback_lane');
  assert.ok(dmCover.target.x < dm.pos.x);
  assert.equal(cbPress, null);
});

test('new architecture defender shot blocks preserve defender last touch for corner classification', () => {
  const ball = createBallPhysicsState();
  executeBallCommand(ball, {
    kind: 'shot',
    from: { x: 18, z: 1 },
    target: { x: 32, z: 0 },
    speed: 18,
    style: 'laces_drive',
    arcHeight: 0.2,
  }, 10);
  ball.lastHeldById = 'shooter';
  ball.lastHeldAtTime = 10;
  ball.pos = { x: 28.6, y: 0.35, z: 1.4 };
  ball.vel = { x: 14, y: 0.2, z: 0.3 };

  const next = updateBallPhysics(ball, [
    {
      id: 'defender',
      team: 'away',
      pos: { x: 29.1, z: 1.5 },
      vel: { x: 0, z: 0 },
      facingRad: 0,
      isGK: false,
      isInOwnBox: true,
      speed: 6,
      dribbling: 60,
    },
  ], 10.05, 0.016);

  assert.equal(next.lastHeldById, 'defender');
  assert.equal(next.isShot, false);
  assert.ok(next.vel.x > 0);
  assert.ok(Math.abs(next.vel.z) > 1);
});

test('new architecture near-miss defenders do not auto-block shots outside the lane', () => {
  const ball = createBallPhysicsState();
  executeBallCommand(ball, {
    kind: 'shot',
    from: { x: 18, z: 0.4 },
    target: { x: 32, z: 0 },
    speed: 18,
    style: 'laces_drive',
    arcHeight: 0.2,
  }, 10);
  ball.lastHeldById = 'shooter';
  ball.lastHeldAtTime = 10;
  ball.pos = { x: 28.6, y: 0.42, z: 0.2 };
  ball.vel = { x: 14, y: 0.18, z: -0.2 };

  const next = updateBallPhysics(ball, [
    {
      id: 'defender',
      team: 'away',
      pos: { x: 29.0, z: 1.15 },
      vel: { x: 0, z: 0 },
      facingRad: 0,
      isGK: false,
      isInOwnBox: true,
      speed: 6,
      dribbling: 60,
    },
  ], 10.05, 0.016);

  assert.equal(next.lastHeldById, 'shooter');
  assert.equal(next.isShot, true);
});

test('V29 new architecture restart classification uses last touch instead of intended team for goal kicks', () => {
  const orchestrator = createGameOrchestrator([
    makeOrchestratorPlayer('home-st', 'home', 'ST', 0, 0),
    makeOrchestratorPlayer('away-cb', 'away', 'CB_L', 10, 0),
  ], {
    homeAttackSign: 1,
    halfDuration: 60,
    teamServiceHz: 4,
    playerControllerHz: 8,
  });

  orchestrator.forceMatchState({ kind: 'live_play', half: 1, startTick: 0 });
  const ball = orchestrator.getBallState();
  ball.state = 'dead';
  ball.pos = { x: FIELD_W / 2 + 0.8, y: 0.15, z: GOAL_MOUTH_HALF_Z + 1.5 };
  ball.vel = { x: 0, y: 0, z: 0 };
  ball.ownerPlayerId = null;
  ball.ownerTeam = null;
  ball.lastHeldById = 'home-st';
  ball.intendedTeam = 'away';

  const result = orchestrator.tick(0.016, 0.016);
  const restart = result.events.find((event) => event.kind === 'ball_out');

  assert.ok(restart);
  assert.equal(restart.restartType, 'goal_kick');
  assert.equal(restart.restartTeam, 'away');
});

test('new architecture restart classification still awards corners after a defender touch', () => {
  const orchestrator = createGameOrchestrator([
    makeOrchestratorPlayer('home-st', 'home', 'ST', 0, 0),
    makeOrchestratorPlayer('away-cb', 'away', 'CB_L', 10, 0),
  ], {
    homeAttackSign: 1,
    halfDuration: 60,
    teamServiceHz: 4,
    playerControllerHz: 8,
  });

  orchestrator.forceMatchState({ kind: 'live_play', half: 1, startTick: 0 });
  const ball = orchestrator.getBallState();
  ball.state = 'dead';
  ball.pos = { x: FIELD_W / 2 + 0.8, y: 0.15, z: GOAL_MOUTH_HALF_Z + 1.5 };
  ball.vel = { x: 0, y: 0, z: 0 };
  ball.ownerPlayerId = null;
  ball.ownerTeam = null;
  ball.lastHeldById = 'away-cb';
  ball.intendedTeam = 'home';

  const result = orchestrator.tick(0.016, 0.016);
  const restart = result.events.find((event) => event.kind === 'ball_out');

  assert.ok(restart);
  assert.equal(restart.restartType, 'corner');
  assert.equal(restart.restartTeam, 'home');
});

test('new architecture live balls crossing the touchline stay out for restart classification', () => {
  const orchestrator = createGameOrchestrator([
    makeOrchestratorPlayer('home-st', 'home', 'ST', 0, 0),
    makeOrchestratorPlayer('away-cb', 'away', 'CB_L', 10, 0),
  ], {
    homeAttackSign: 1,
    halfDuration: 60,
    teamServiceHz: 4,
    playerControllerHz: 8,
  });

  orchestrator.forceMatchState({ kind: 'live_play', half: 1, startTick: 0 });
  const ball = orchestrator.getBallState();
  ball.state = 'loose';
  ball.pos = { x: 0, y: 0.15, z: FIELD_D / 2 - 0.2 };
  ball.vel = { x: 0.4, y: 0, z: 8 };
  ball.ownerPlayerId = null;
  ball.ownerTeam = null;
  ball.lastHeldById = 'home-st';

  const result = orchestrator.tick(0.1, 0.1);
  const restart = result.events.find((event) => event.kind === 'ball_out');

  assert.ok(restart);
  assert.equal(restart.restartType, 'throw_in');
  assert.equal(restart.restartTeam, 'away');
  assert.ok(result.ball.pos.z > FIELD_D / 2);
});

test('new architecture emits interceptions when opponents collect an intended pass', () => {
  const orchestrator = createGameOrchestrator([
    makeOrchestratorPlayer('home-st', 'home', 'ST', 0, 0),
    makeOrchestratorPlayer('home-am', 'home', 'AM', 6, 0),
    makeOrchestratorPlayer('away-cb', 'away', 'CB_L', 3.1, 0.1),
  ], {
    homeAttackSign: 1,
    halfDuration: 60,
    teamServiceHz: 4,
    playerControllerHz: 8,
  });

  orchestrator.forceMatchState({ kind: 'live_play', half: 1, startTick: 0 });
  const ball = orchestrator.getBallState();
  ball.state = 'in_flight';
  ball.pos = { x: 3, y: 0.15, z: 0 };
  ball.vel = { x: 2, y: 0, z: 0.1 };
  ball.ownerPlayerId = null;
  ball.ownerTeam = null;
  ball.lastHeldById = 'home-st';
  ball.lastHeldAtTime = 0;
  ball.intendedReceiverId = 'home-am';
  ball.intendedTeam = 'home';
  ball.intendedUntil = 1.0;

  const result = orchestrator.tick(0.016, 0.016);
  const interception = result.events.find((event) => event.kind === 'interception');

  assert.ok(interception);
  assert.equal(interception.playerId, 'away-cb');
});

test('new architecture emits pass completion when a teammate collects an intended pass', () => {
  const orchestrator = createGameOrchestrator([
    makeOrchestratorPlayer('home-st', 'home', 'ST', 0, 0),
    makeOrchestratorPlayer('home-am', 'home', 'AM', 3.1, 0.1),
    makeOrchestratorPlayer('away-cb', 'away', 'CB_L', 8, 4),
  ], {
    homeAttackSign: 1,
    halfDuration: 60,
    teamServiceHz: 4,
    playerControllerHz: 8,
  });

  orchestrator.forceMatchState({ kind: 'live_play', half: 1, startTick: 0 });
  const ball = orchestrator.getBallState();
  ball.state = 'in_flight';
  ball.pos = { x: 3, y: 0.15, z: 0 };
  ball.vel = { x: 2, y: 0, z: 0.1 };
  ball.ownerPlayerId = null;
  ball.ownerTeam = null;
  ball.lastHeldById = 'home-st';
  ball.lastHeldAtTime = 0;
  ball.intendedReceiverId = 'home-am';
  ball.intendedTeam = 'home';
  ball.intendedUntil = 1.0;

  const result = orchestrator.tick(0.016, 0.016);
  const passComplete = result.events.find((event) => event.kind === 'pass_complete');

  assert.ok(passComplete);
  assert.equal(passComplete.passerId, 'home-st');
  assert.equal(passComplete.receiverId, 'home-am');
});

test('moving intended receivers keep a realistic collection window on led passes', () => {
  const ball = createBallPhysicsState();
  executeBallCommand(ball, {
    kind: 'pass',
    from: { x: 0, z: 0 },
    to: { x: 5.2, z: 0.3 },
    speed: 10,
    type: 'short',
    intendedReceiverId: 'home-am',
    intendedTeam: 'home',
  }, 0);

  const players: Array<Parameters<typeof updateBallPhysics>[1][number]> = [
    {
      id: 'home-am',
      team: 'home',
      pos: { x: 4.2, z: 0.1 },
      vel: { x: 2.4, z: 0.2 },
      facingRad: 0,
      isGK: false,
      isInOwnBox: false,
      speed: 6,
      dribbling: 78,
    },
    {
      id: 'away-cb',
      team: 'away',
      pos: { x: 5.4, z: 1.4 },
      vel: { x: 0, z: 0 },
      facingRad: 0,
      isGK: false,
      isInOwnBox: false,
      speed: 6,
      dribbling: 55,
    },
  ];

  let updated = ball;
  for (let i = 1; i <= 4; i++) {
    updated = updateBallPhysics(updated, players, i * 0.12, 0.12);
  }

  assert.equal(updated.ownerPlayerId, 'home-am');
  assert.equal(updated.ownerTeam, 'home');
  assert.equal(updated.state, 'attached');
});

test('new architecture emits saves when a keeper gathers a live shot', () => {
  const orchestrator = createGameOrchestrator([
    makeOrchestratorPlayer('home-gk', 'home', 'GK', -FIELD_W / 2 + 2, 0),
    makeOrchestratorPlayer('away-st', 'away', 'ST', -FIELD_W / 2 + 3.2, 0.1),
  ], {
    homeAttackSign: 1,
    halfDuration: 60,
    teamServiceHz: 4,
    playerControllerHz: 8,
  });

  orchestrator.forceMatchState({ kind: 'live_play', half: 1, startTick: 0 });
  const ball = orchestrator.getBallState();
  ball.state = 'in_flight';
  ball.pos = { x: -FIELD_W / 2 + 2.2, y: 0.2, z: 0 };
  ball.vel = { x: -1.2, y: 0, z: 0.05 };
  ball.ownerPlayerId = null;
  ball.ownerTeam = null;
  ball.lastHeldById = 'away-st';
  ball.lastHeldAtTime = 0;
  ball.isShot = true;

  const result = orchestrator.tick(0.016, 0.016);
  const saves = result.events.filter((event) => event.kind === 'save');
  const save = saves[0];

  assert.equal(saves.length, 1, 'clean keeper claim must emit exactly one save event');
  assert.ok(save);
  assert.equal(save.keeperId, 'home-gk');

  const nextResult = orchestrator.tick(0.016, 0.032);
  assert.equal(
    nextResult.events.filter((event) => event.kind === 'save').length,
    0,
    'shot-clear bookkeeping after a keeper claim must not emit a second save',
  );
});

test('new architecture emits tackles when a defender strips the carrier', () => {
  const orchestrator = createGameOrchestrator([
    makeOrchestratorPlayer('home-st', 'home', 'ST', -10, 0),
    makeOrchestratorPlayer('away-cb', 'away', 'CB_L', -9.2, 0.1),
  ], {
    homeAttackSign: 1,
    halfDuration: 60,
    teamServiceHz: 4,
    playerControllerHz: 8,
  });

  orchestrator.forceMatchState({ kind: 'live_play', half: 1, startTick: 0 });
  const orchPlayers = orchestrator.getPlayers();
  const homeCarrier = orchPlayers.find((player) => player.id === 'home-st');
  const awayDefender = orchPlayers.find((player) => player.id === 'away-cb');
  assert.ok(homeCarrier);
  assert.ok(awayDefender);
  homeCarrier.hasBall = true;
  homeCarrier.vel = { x: 0.1, z: 0 };
  homeCarrier.ratings.dribbling = 40;
  homeCarrier.ratings.reactions = 40;
  awayDefender.vel = { x: -4.8, z: 0 };
  awayDefender.ratings.defending = 95;
  awayDefender.ratings.standingTackle = 95;
  awayDefender.ratings.strength = 92;
  awayDefender.ratings.reactions = 88;

  const ball = orchestrator.getBallState();
  ball.state = 'attached';
  ball.ownerPlayerId = 'home-st';
  ball.ownerTeam = 'home';
  ball.lastHeldById = 'home-st';
  ball.lastHeldAtTime = 0;

  const result = orchestrator.tick(0.016, 0.016);
  const tackle = result.events.find((event) => event.kind === 'tackle');

  assert.ok(tackle);
  assert.equal(tackle.winnerId, 'away-cb');
  assert.equal(tackle.loserId, 'home-st');
  assert.equal(result.ball.ownerPlayerId, 'away-cb');
});
