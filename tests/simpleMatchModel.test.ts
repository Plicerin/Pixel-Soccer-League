import assert from "node:assert/strict";
import test from "node:test";
import { BASE_RUN_SPEED, CENTER_CIRCLE_RADIUS, dist2, FIELD_D, FIELD_SCALE_PER_YARD, FIELD_W, GOAL_BOX_DEPTH, GOAL_BOX_HALF_Z, GOAL_FLOOR_DEPTH, GOAL_MOUTH_HALF_Z, isInPenaltyArea, LEFT_GOAL_X, PLAYER_RADIUS, RIGHT_GOAL_X, RIGHT_PENALTY_X } from "../src/core/constants";
import { SimpleMatchModel } from "../src/core/simpleMatchModel";

test("simple model builds two complete elevens", () => {
  const model = new SimpleMatchModel();
  model.setTeamNames("Inter Miami", "LA Galaxy");
  model.setTeamFormations("4-3-3", "4-4-2");

  const players = model.getPlayers();
  assert.equal(players.length, 22);
  assert.equal(players.filter((p) => p.team === "A").length, 11);
  assert.equal(players.filter((p) => p.team === "B").length, 11);
  assert.equal(players.filter((p) => p.role === "GK").length, 2);
  assert.equal(new Set(players.map((p) => p.id)).size, 22);
});

test("simple model uses 1982 World Cup final player names for easter egg teams", () => {
  const model = new SimpleMatchModel();
  model.setTeamNames("Italy 1982", "West Germany 1982");
  model.setTeamFormations("3-4-3", "3-4-3");

  const italy = model.getPlayers().filter((player) => player.team === "A").map((player) => player.name);
  const westGermany = model.getPlayers().filter((player) => player.team === "B").map((player) => player.name);

  assert.deepEqual(italy, [
    "Dino Zoff",
    "Gaetano Scirea",
    "Giuseppe Bergomi",
    "Claudio Gentile",
    "Fulvio Collovati",
    "Antonio Cabrini",
    "Gabriele Oriali",
    "Marco Tardelli",
    "Bruno Conti",
    "Francesco Graziani",
    "Paolo Rossi",
  ]);
  assert.deepEqual(westGermany, [
    "Harald Schumacher",
    "Uli Stielike",
    "Manfred Kaltz",
    "Karlheinz Förster",
    "Bernd Förster",
    "Hans-Peter Briegel",
    "Wolfgang Dremmler",
    "Paul Breitner",
    "Karl-Heinz Rummenigge",
    "Pierre Littbarski",
    "Klaus Fischer",
  ]);
});

test("simple model reaches full time for short matches", () => {
  const model = new SimpleMatchModel();
  model.setHalfDurationSeconds(5);
  model.startMatch();

  for (let i = 0; i < 3000 && model.getMatchSnapshot().phase !== "FULL_TIME"; i++) {
    model.step(1 / 30);
  }

  const snapshot = model.getMatchSnapshot();
  assert.equal(snapshot.phase, "FULL_TIME");
  assert.equal(snapshot.half, 2);
});

test("simple model emits stable telemetry shapes", () => {
  const model = new SimpleMatchModel();
  model.setHalfDurationSeconds(8);
  model.startMatch();

  for (let i = 0; i < 900 && model.getMatchSnapshot().phase !== "FULL_TIME"; i++) {
    model.step(1 / 30);
  }

  const snapshot = model.getMatchSnapshot();
  const live = model.getLiveTelemetry();
  const bundle = model.getTuningBundle();

  assert.equal(typeof snapshot.scoreA, "number");
  assert.equal(typeof snapshot.passesA, "number");
  assert.equal(typeof live.teamA.possession, "number");
  assert.ok(Array.isArray(live.eventLog));
  assert.ok(Array.isArray(bundle.events));
  assert.ok(Array.isArray(bundle.passLog));
  assert.ok(Array.isArray(bundle.ballFlightTelemetry));
  assert.ok(Array.isArray(bundle.visualRealityEvents));
  assert.ok(Array.isArray(bundle.shotDecisions));
  assert.ok(Array.isArray(bundle.shotOpportunities));
  assert.ok(Array.isArray(bundle.passDecisions));
  assert.equal(bundle.tuning.model, "simple-v1");
});

test("V62 simple model role stats satisfy dashboard role behavior fields", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v62-role-dashboard-fields");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  for (let i = 0; i < 1800 && model.getMatchSnapshot().phase !== "FULL_TIME"; i++) {
    model.step(1 / 60);
    model.updateVisuals(1 / 60);
  }

  const bundle = model.getTuningBundle();
  const role = Object.values(bundle.teamA.roleStats)[0] as Record<string, unknown>;
  for (const key of ["touches", "possFrames", "passAtt", "passComp", "shotsOnTarget", "tackles", "interceptions", "clearances", "recoveries", "turnovers", "fouls", "fouled"]) {
    assert.notEqual(role[key], undefined, `role stat ${key} must not be undefined`);
  }
});

test("V55 simple model uses legal center kickoff positioning before the ball is live", () => {
  const model = new SimpleMatchModel();
  model.setTeamNames("Inter Miami", "LA Galaxy");
  model.startMatch();

  const snapshot = model.getMatchSnapshot();
  assert.equal(snapshot.phase, "KICKOFF");
  assert.equal(model.ball.pos.x, 0);
  assert.equal(model.ball.pos.z, 0);
  assert.ok(model.possession, "kickoff should identify the single kicker");
  assert.equal(model.possession.pos.x, 0, "kickoff kicker must stand on the center spot");
  assert.equal(model.possession.pos.z, 0, "kickoff kicker must stand on the center spot");
  assert.equal(model.possession.targetPos.x, 0, "kickoff kicker target must be the center spot");
  assert.equal(model.possession.targetPos.z, 0, "kickoff kicker target must be the center spot");

  for (const player of model.getPlayers()) {
    const attackSign = player.team === "A" ? 1 : -1;
    assert.ok(player.pos.x * attackSign <= 0.001, `${player.name} must start in own half`);
    if (player.id !== model.possession?.id) {
      assert.ok(
        Math.hypot(player.pos.x, player.pos.z) >= CENTER_CIRCLE_RADIUS,
        `${player.name} must stay outside the center circle before kickoff`,
      );
    }
  }
});

test("V100 explicit new match start resets stale live clock and kickoff positions", () => {
  const model = new SimpleMatchModel();
  model.setTeamNames("Canada", "Switzerland");
  model.startMatch();

  for (let i = 0; i < 360 && model.getMatchSnapshot().phase !== "LIVE"; i++) {
    model.step(1 / 60);
  }
  for (let i = 0; i < 180; i++) model.step(1 / 60);
  model.getPlayers()[0].pos.x = 32;
  model.getPlayers()[1].pos.z = 19;

  model.startMatch();

  const snapshot = model.getMatchSnapshot();
  assert.equal(snapshot.phase, "KICKOFF");
  assert.equal(snapshot.half, 1);
  assert.equal(snapshot.elapsedInHalf, 0);
  assert.equal(model.ball.pos.x, 0);
  assert.equal(model.ball.pos.z, 0);
  assert.ok(model.possession, "fresh kickoff must identify the single kicker");
  assert.equal(model.possession.pos.x, 0, "fresh kickoff kicker must reset to the center spot");
  assert.equal(model.possession.pos.z, 0, "fresh kickoff kicker must reset to the center spot");
  assert.equal(model.possession.targetPos.x, 0, "fresh kickoff kicker target must reset to the center spot");
  assert.equal(model.possession.targetPos.z, 0, "fresh kickoff kicker target must reset to the center spot");

  for (const player of model.getPlayers()) {
    const attackSign = player.team === "A" ? 1 : -1;
    assert.ok(player.pos.x * attackSign <= 0.001, `${player.name} must reset to own half on new match start`);
    if (player.id !== model.possession?.id) {
      assert.ok(
        Math.hypot(player.pos.x, player.pos.z) >= CENTER_CIRCLE_RADIUS,
        `${player.name} must reset outside the center circle on new match start`,
      );
    }
  }
});

test("V55 simple model starts live play with a visible kickoff pass to another player", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v54-kickoff-pass");
  model.startMatch();
  const kickerId = model.possession?.id;

  for (let i = 0; i < 60 && model.getMatchSnapshot().phase === "KICKOFF"; i++) {
    model.step(1 / 30);
    model.updateVisuals(1 / 30);
  }

  const snapshot = model.getMatchSnapshot();
  assert.equal(snapshot.phase, "FIRST_HALF");
  assert.ok(model.possession, "live kickoff should transfer possession to the receiver");
  assert.notEqual(model.possession?.id, kickerId, "kicker must not double-touch the kickoff");
  const kickoffFlight = model.ballFlightTelemetry.find((flight) => flight.kind === "pass" && flight.from.x === 0 && flight.from.z === 0);
  assert.ok(kickoffFlight, "kickoff should create a visible pass flight from the center spot");
  assert.ok(kickoffFlight.distanceUnits > CENTER_CIRCLE_RADIUS * 0.7, "kickoff pass must clearly move the ball");
  assert.equal(model.passLog.some((event) => event.detail.restart === "kickoff"), true);
  const kickoffEvents = model.eventLog.filter((event) => event.action === "KICKOFF");
  assert.equal(kickoffEvents.filter((event) => event.meta?.phase === "setup").length, 1, "kickoff setup should emit exactly one whistle-eligible event");
  assert.equal(kickoffEvents.filter((event) => event.meta?.phase === "release").length, 1, "kickoff release should be tagged separately from the whistle");
});

test("V134 CPU-vs-CPU kickoff uses real-time phase pacing despite clock compression", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v134-cpu-phase-pacing");
  model.setHalfDurationSeconds(5 * 60);
  model.cpuVsCpu = true;
  model.startMatch();

  for (let i = 0; i < 60; i++) model.step(1 / 60);

  let snapshot = model.getMatchSnapshot();
  assert.equal(snapshot.phase, "KICKOFF", "CPU kickoff should pause long enough to be seen instead of leaving on accelerated clock time");
  assert.equal(snapshot.elapsedInHalf, 0, "CPU phase pacing should not spend match clock while holding the presentation beat");

  for (let i = 0; i < 90 && model.getMatchSnapshot().phase === "KICKOFF"; i++) model.step(1 / 60);

  snapshot = model.getMatchSnapshot();
  assert.equal(snapshot.phase, "FIRST_HALF");
  const pacing = model.getTuningBundle().phasePacingTelemetry.at(-1) as Record<string, unknown> | undefined;
  assert.equal(pacing?.phase, "KICKOFF");
  assert.equal(pacing?.reason, "kickoff_setup_ready");
  assert.ok(Number(pacing?.durationSeconds) >= 1 && Number(pacing?.durationSeconds) <= 2, "CPU pacing hold should stay in the requested one-to-two second range");
});

test("V101 away kickoff receiver is staged in the kicking team's own half", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v101-away-kickoff-receiver-own-half");
  model.startMatch();
  model.msm.state = { kind: "kickoff", team: "away" };
  model.msm.clock.half = 1;
  model.msm.clock.elapsedInHalf = 0;
  (model as unknown as { installKickoffSetup: (team: "A" | "B") => void }).installKickoffSetup("B");

  for (let i = 0; i < 90 && model.getMatchSnapshot().phase === "KICKOFF"; i++) {
    model.step(1 / 30);
    model.updateVisuals(1 / 30);
  }

  const snapshot = model.getMatchSnapshot();
  assert.equal(snapshot.phase, "FIRST_HALF");
  const kickoffFlight = model.ballFlightTelemetry.find((flight) => flight.kind === "pass" && flight.from.x === 0 && flight.from.z === 0);
  assert.ok(kickoffFlight, "away kickoff should create a visible receiver pass from the center spot");
  assert.ok(kickoffFlight.receiverId, "kickoff flight should identify the receiver");
  const receiver = model.getPlayers().find((player) => player.id === kickoffFlight.receiverId);
  assert.ok(receiver, "kickoff receiver must be a real visible player");
  assert.equal(receiver.team, "B");
  assert.ok(kickoffFlight.to.x >= 0.1, `away kickoff receiver target must stay in own half, got x=${kickoffFlight.to.x.toFixed(2)}`);
  assert.ok(receiver.pos.x >= 0.1, `away kickoff receiver must remain in own half, got x=${receiver.pos.x.toFixed(2)}`);
  assert.equal(model.passLog.some((event) => event.detail.restart === "kickoff"), true);
});

test("V63 restart kickoff setup moves players back instead of teleporting them", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v63-no-restart-teleport");
  model.startMatch();

  for (let i = 0; i < 180 && model.getMatchSnapshot().phase !== "FIRST_HALF"; i++) {
    model.step(1 / 60);
  }

  model.msm.state = { kind: "kickoff", team: "away" };
  model.msm.clock.elapsedInHalf = 20;

  for (const [index, player] of model.getPlayers().entries()) {
    player.pos.x = RIGHT_GOAL_X - 2 - (index % 4);
    player.pos.z = -FIELD_D / 2 + 3 + index;
    player.vel = { x: 0, z: 0 };
    player.targetPos = { x: player.pos.x, z: player.pos.z };
  }

  const before = new Map(model.getPlayers().map((player) => [player.id, { x: player.pos.x, z: player.pos.z }]));
  (model as unknown as { installKickoffSetup: (team: "A" | "B") => void }).installKickoffSetup("B");

  for (const player of model.getPlayers()) {
    const previous = before.get(player.id);
    assert.ok(previous);
    assert.ok(dist2(player.pos, previous) < 0.001, `${player.name} teleported during restart setup`);
    const attackSign = player.team === "A" ? 1 : -1;
    assert.ok(player.targetPos.x * attackSign <= 0.001, `${player.name} target must be in own half`);
    if (player.id !== model.possession?.id) {
      assert.ok(Math.hypot(player.targetPos.x, player.targetPos.z) >= CENTER_CIRCLE_RADIUS, `${player.name} target must clear the center circle`);
    }
  }

  model.step(1 / 60);
  for (const player of model.getPlayers()) {
    const previous = before.get(player.id);
    assert.ok(previous);
    const moved = dist2(player.pos, previous);
    assert.ok(moved <= BASE_RUN_SPEED * (1 / 60) * 1.02, `${player.name} moved too fast during kickoff setup: ${moved.toFixed(3)}`);
  }

  for (let i = 0; i < 60 * 45 && model.getMatchSnapshot().phase === "KICKOFF"; i++) {
    model.step(1 / 60);
    model.updateVisuals(1 / 60);
  }

  assert.equal(model.getMatchSnapshot().phase, "FIRST_HALF");
  assert.equal(model.getTuningBundle().visualRealityEvents.some((event) => event.type === "PLAYER_TELEPORT"), false);
  assert.equal(model.passLog.some((event) => event.detail.restart === "kickoff"), true);
});

test("V64 kickoff release does not pop runners across the halfway line", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v64-kickoff-midfield-hold");
  model.startMatch();

  for (let i = 0; i < 120 && model.getMatchSnapshot().phase === "KICKOFF"; i++) {
    model.step(1 / 60);
    model.updateVisuals(1 / 60);
  }

  assert.equal(model.getMatchSnapshot().phase, "FIRST_HALF");
  for (let i = 0; i < 90; i++) {
    model.step(1 / 60);
    model.updateVisuals(1 / 60);
    for (const player of model.getPlayers()) {
      const attackSign = player.team === "A" ? 1 : -1;
      assert.ok(
        player.pos.x * attackSign <= 0.05,
        `${player.name} crossed midfield too early after kickoff at ${(i / 60).toFixed(2)}s`,
      );
    }
  }
});

test("V65 active team setting sync cannot rebuild and snap live players after kickoff", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v65-no-live-roster-rebuild");
  model.setTeamNames("Portland Timbers", "LA Galaxy");
  model.setTeamFormations("3-4-3", "3-4-3");
  model.startMatch();

  for (let i = 0; i < 60; i++) {
    model.step(1 / 60);
    model.updateVisuals(1 / 60);
  }

  assert.equal(model.getMatchSnapshot().phase, "FIRST_HALF");
  const before = new Map(model.getPlayers().map((player) => [player.id, { x: player.pos.x, z: player.pos.z }]));
  model.setTeamFormations("3-4-3", "3-4-3");
  model.setTeamNames("Portland Timbers", "LA Galaxy");

  for (const player of model.getPlayers()) {
    const previous = before.get(player.id);
    assert.ok(previous);
    assert.ok(dist2(player.pos, previous) < 0.001, `${player.name} moved during active team setting sync`);
    const attackSign = player.team === "A" ? 1 : -1;
    assert.ok(player.pos.x * attackSign <= 0.05, `${player.name} was rebuilt across midfield after kickoff`);
  }
});

test("V66 ball over touchline creates throw-in restart with visible flight", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v66-throw-in");
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;
  const passer = model.getPlayers().find((player) => player.team === "A" && player.role !== "GK");
  assert.ok(passer);
  model.possession = passer;
  (model as unknown as { rememberTouch: (player: unknown) => void }).rememberTouch(passer);
  model.ball.pos = { x: 0, y: 0.18, z: FIELD_D / 2 - 0.6 };
  (model as unknown as { startBallFlight: (kind: string, from: { x: number; z: number }, to: { x: number; z: number }, duration: number, arc: number) => void })
    .startBallFlight("pass", { x: 0, z: FIELD_D / 2 - 0.6 }, { x: 4, z: FIELD_D / 2 + 1.6 }, 0.1, 0.04);

  for (let i = 0; i < 60 && (model.msm.state as { kind: string }).kind !== "ball_out"; i++) model.step(1 / 60);
  const throwState = model.msm.state as { kind: string; restartType?: string; restartTeam?: string };
  assert.equal(throwState.kind, "ball_out");
  assert.equal(throwState.restartType, "throw_in");
  assert.equal(throwState.restartTeam, "away");
  assert.equal(model.getMatchSnapshot().throwInsB, 1);
  assert.equal(model.getTuningBundle().ballOutLog.at(-1)?.type, "throw_in");
  const setupEvent = model.eventLog.filter((event) => event.action === "THROW_IN").at(-1);
  assert.equal(setupEvent?.meta?.phase, "setup");
  assert.equal(setupEvent?.meta?.restartType, "throw_in");
  assert.ok(typeof setupEvent?.meta?.takerId === "string", "throw-in setup must identify the taker for renderer presentation");

  for (let i = 0; i < 180 && (model.msm.state as { kind: string }).kind === "ball_out"; i++) {
    model.step(1 / 60);
    model.updateVisuals(1 / 60);
  }
  assert.equal(model.msm.state.kind, "live_play");
  const releaseEvent = model.eventLog.filter((event) => event.action === "THROW_IN" && event.meta?.phase === "release").at(-1);
  const restartFlight = model.getTuningBundle().ballFlightTelemetry.filter((flight) => flight.kind === "restart").at(-1);
  assert.equal(releaseEvent?.meta?.restartType, "throw_in");
  assert.equal(releaseEvent?.meta?.arcHeight, 0.85);
  assert.ok(Number(restartFlight?.arc) >= 0.8, "throw-in restart flight must be visibly lofted");
});

test("V66 goal-line OOB classifies goal kick and corner by last touch", () => {
  const run = (lastTouchTeam: "A" | "B") => {
    const model = new SimpleMatchModel();
    model.startMatch();
    model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
    model.msm.clock.elapsedInHalf = 12;
    const player = model.getPlayers().find((p) => p.team === lastTouchTeam && p.role !== "GK");
    assert.ok(player);
    model.possession = player;
    (model as unknown as { rememberTouch: (player: unknown) => void }).rememberTouch(player);
    model.ball.pos = { x: RIGHT_GOAL_X - 0.7, y: 0.18, z: GOAL_MOUTH_HALF_Z + 3 };
    (model as unknown as { startBallFlight: (kind: string, from: { x: number; z: number }, to: { x: number; z: number }, duration: number, arc: number) => void })
      .startBallFlight("pass", { x: RIGHT_GOAL_X - 0.7, z: GOAL_MOUTH_HALF_Z + 3 }, { x: RIGHT_GOAL_X + 1.4, z: GOAL_MOUTH_HALF_Z + 4 }, 0.1, 0.04);
    for (let i = 0; i < 60 && (model.msm.state as { kind: string }).kind !== "ball_out"; i++) model.step(1 / 60);
    return model;
  };

  const goalKick = run("A");
  const goalKickState = goalKick.msm.state as { kind: string; restartType?: string; restartTeam?: string };
  assert.equal(goalKickState.kind, "ball_out");
  assert.equal(goalKickState.restartType, "goal_kick");
  assert.equal(goalKickState.restartTeam, "away");
  assert.equal(goalKick.getTuningBundle().teamB.goalKicks, 1);
  const goalKickSetup = goalKick.eventLog.filter((event) => event.action === "GOAL_KICK" && event.meta?.phase === "setup").at(-1);
  assert.equal(goalKickSetup?.meta?.restartType, "goal_kick");
  const goalKickTaker = goalKick.getPlayers().find((player) => player.id === goalKickSetup?.meta?.takerId);
  assert.equal(goalKickTaker?.role, "GK", "goal-kick setup must identify the goalkeeper as taker for renderer presentation");

  for (let i = 0; i < 180 && (goalKick.msm.state as { kind: string }).kind === "ball_out"; i++) {
    goalKick.step(1 / 60);
    goalKick.updateVisuals(1 / 60);
  }
  const goalKickRelease = goalKick.eventLog.filter((event) => event.action === "GOAL_KICK" && event.meta?.phase === "release").at(-1);
  assert.equal(goalKick.msm.state.kind, "live_play");
  assert.equal(goalKickRelease?.meta?.takerId, goalKickTaker?.id, "goal-kick release must still be credited to the goalkeeper");
  assert.equal(goalKick.getMatchSnapshot().gkDistributionsB, 1, "goal kicks must count as goalkeeper distributions");
  assert.equal(goalKick.getMatchSnapshot().gkDistCompletedB, 1, "completed goal kicks must count as completed goalkeeper distributions");
  assert.equal((goalKick as any).lastKeeperKickTelemetry?.style, "goal_kick");

  const corner = run("B");
  const cornerState = corner.msm.state as { kind: string; restartType?: string; restartTeam?: string };
  assert.equal(cornerState.kind, "ball_out");
  assert.equal(cornerState.restartType, "corner");
  assert.equal(cornerState.restartTeam, "home");
  assert.equal(corner.getMatchSnapshot().cornersA, 1);
  const setupEvent = corner.eventLog.filter((event) => event.action === "CORNER" && event.meta?.phase === "setup").at(-1);
  assert.equal(setupEvent?.meta?.restartType, "corner");
  assert.ok(typeof setupEvent?.meta?.takerId === "string", "corner setup must identify the taker for renderer presentation");
  assert.equal(setupEvent?.meta?.presentationKind, "corner_kick");
  assert.ok(Number(setupEvent?.meta?.presentationSeconds) >= 2.0, "corner setup presentation must be long enough to show the taker at the flag");

  for (let i = 0; i < 180 && (corner.msm.state as { kind: string }).kind === "ball_out"; i++) {
    corner.step(1 / 60);
    corner.updateVisuals(1 / 60);
  }
  const releaseEvent = corner.eventLog.filter((event) => event.action === "CORNER" && event.meta?.phase === "release").at(-1);
  const cornerFlight = corner.getTuningBundle().ballFlightTelemetry.filter((flight) => flight.kind === "restart").at(-1);
  assert.equal(corner.msm.state.kind, "live_play");
  assert.equal(releaseEvent?.meta?.takerId, setupEvent?.meta?.takerId, "corner release must retain the setup taker so the renderer can animate the player, not just the ball");
  assert.equal(releaseEvent?.meta?.presentationKind, "corner_kick");
  assert.ok(Number(releaseEvent?.meta?.presentationSeconds) >= 1.2, "corner release presentation must keep the taker visible through the kick");
  assert.equal(releaseEvent?.meta?.arcHeight, 0.7);
  assert.ok(Number(cornerFlight?.arc) >= 0.65, "corner restart flight must be visibly lofted");
});

test("V137 goal-mouth crossing resolves as goal or own goal before corner classification", () => {
  const run = (lastTouchTeam: "A" | "B") => {
    const model = new SimpleMatchModel();
    model.startMatch();
    model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
    model.msm.clock.elapsedInHalf = 24;
    const player = model.getPlayers().find((p) => p.team === lastTouchTeam && p.role !== "GK");
    assert.ok(player);
    model.possession = player;
    (model as unknown as { rememberTouch: (player: unknown) => void }).rememberTouch(player);
    model.ball.pos = { x: RIGHT_GOAL_X - 0.8, y: 0.18, z: 0.12 };
    (model as unknown as { startBallFlight: (kind: string, from: { x: number; z: number }, to: { x: number; z: number }, duration: number, arc: number) => void })
      .startBallFlight("pass", { x: RIGHT_GOAL_X - 0.8, z: 0.12 }, { x: RIGHT_GOAL_X + 1.3, z: 0.10 }, 0.1, 0.04);
    for (let i = 0; i < 90 && (model.msm.state as { kind: string }).kind !== "goal_scored"; i++) model.step(1 / 60);
    return model;
  };

  const attackingTouch = run("A");
  assert.equal(attackingTouch.msm.state.kind, "goal_scored");
  assert.equal(attackingTouch.getMatchSnapshot().scoreA, 1);
  assert.equal(attackingTouch.getMatchSnapshot().cornersA, 0);
  assert.equal(attackingTouch.getMatchSnapshot().cornersB, 0);
  assert.equal(attackingTouch.getMatchSnapshot().goalKicksA, 0);
  assert.equal(attackingTouch.getMatchSnapshot().goalKicksB, 0);
  const attackingGoal = attackingTouch.getTuningBundle().goalLog.at(-1) as Record<string, unknown> | undefined;
  assert.equal(attackingGoal?.resolutionReason, "GOAL_MOUTH_CROSSING");
  assert.equal(attackingGoal?.ownGoal, false);
  assert.equal(attackingGoal?.fieldResolved, true);
  assert.equal(attackingTouch.getTuningBundle().ballOutLog.length, 0);

  const defendingTouch = run("B");
  assert.equal(defendingTouch.msm.state.kind, "goal_scored");
  assert.equal(defendingTouch.getMatchSnapshot().scoreA, 1);
  assert.equal(defendingTouch.getMatchSnapshot().cornersA, 0);
  assert.equal(defendingTouch.getMatchSnapshot().cornersB, 0);
  assert.equal(defendingTouch.getMatchSnapshot().goalKicksA, 0);
  assert.equal(defendingTouch.getMatchSnapshot().goalKicksB, 0);
  const ownGoal = defendingTouch.getTuningBundle().goalLog.at(-1) as Record<string, unknown> | undefined;
  assert.equal(ownGoal?.resolutionReason, "GOAL_MOUTH_CROSSING");
  assert.equal(ownGoal?.ownGoal, true);
  assert.equal(ownGoal?.fieldResolved, true);
  assert.equal(defendingTouch.getTuningBundle().ballOutLog.length, 0);
});

test("V80 off-target attacking shots create goalkeeper goal-kick restarts", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v80-shot-miss-goal-kick");
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 18;
  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(attacker);
  attacker.pos = { x: RIGHT_GOAL_X - 12, y: 0, z: 0 };
  attacker.targetPos = { ...attacker.pos };
  model.possession = attacker;
  model.ball.pos = { x: attacker.pos.x, y: 0.18, z: attacker.pos.z };
  (model as unknown as { rememberTouch: (player: unknown) => void }).rememberTouch(attacker);
  const rngValues = [0.99, 0.0, 0.5];
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => rngValues.shift() ?? 0.5,
    range: (min) => min,
  };

  (model as unknown as {
    resolveShot: (carrier: unknown, distToGoal: number, pressure: number, context?: { reason: string }) => unknown;
  }).resolveShot(attacker, dist2(attacker.pos, { x: RIGHT_GOAL_X, z: 0 }), 0, { reason: "V80_FORCED_MISS" });

  let sawBallBehindGoalLineBeforeRestart = false;
  for (let i = 0; i < 300 && (model.msm.state as { kind: string }).kind !== "ball_out"; i++) {
    model.step(1 / 60);
    model.updateVisuals(1 / 60);
    if ((model.msm.state as { kind: string }).kind === "live_play" && model.ball.pos.x > RIGHT_GOAL_X + 0.5) {
      sawBallBehindGoalLineBeforeRestart = true;
    }
  }

  const state = model.msm.state as { kind: string; restartType?: string; restartTeam?: string };
  assert.equal(sawBallBehindGoalLineBeforeRestart, true, "missed shots must visibly travel behind the goal line before restart setup");
  assert.equal(state.kind, "ball_out");
  assert.equal(state.restartType, "goal_kick");
  assert.equal(state.restartTeam, "away");
  assert.equal(model.getMatchSnapshot().goalKicksB, 1);
  const missFlight = model.getTuningBundle().ballFlightTelemetry.filter((flight) => flight.kind === "miss").at(-1);
  assert.ok(Number(missFlight?.to?.x) > RIGHT_GOAL_X + 0.5, "miss flight telemetry must keep the visible behind-goal target");
  const setup = model.eventLog.filter((event) => event.action === "GOAL_KICK" && event.meta?.phase === "setup").at(-1);
  const taker = model.getPlayers().find((player) => player.id === setup?.meta?.takerId);
  assert.equal(taker?.role, "GK");
});

test("V82 goal kicks use Law 16 setup constraints", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v82-law16-goal-kick");
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 20;
  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const intruder = model.getPlayers().find((player) => player.team === "A" && player.id !== attacker?.id);
  assert.ok(attacker);
  assert.ok(intruder);
  attacker.pos = { x: RIGHT_GOAL_X - 10, y: 0, z: 0 };
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };
  model.possession = attacker;
  model.ball.pos = { x: attacker.pos.x, y: 0.18, z: attacker.pos.z };
  (model as unknown as { rememberTouch: (player: unknown) => void }).rememberTouch(attacker);
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.99,
    range: (min) => min,
  };

  (model as unknown as {
    resolveShot: (carrier: unknown, distToGoal: number, pressure: number, context?: { reason: string }) => unknown;
  }).resolveShot(attacker, dist2(attacker.pos, { x: RIGHT_GOAL_X, z: 0 }), 0, { reason: "V82_FORCED_MISS" });

  for (let i = 0; i < 300 && (model.msm.state as { kind: string }).kind !== "ball_out"; i++) model.step(1 / 60);
  const setup = model.eventLog.filter((event) => event.action === "GOAL_KICK" && event.meta?.phase === "setup").at(-1);
  assert.equal(setup?.meta?.restartType, "goal_kick");
  const spot = setup?.meta?.spot as { x: number; z: number } | undefined;
  assert.ok(spot);
  assert.ok(spot.x <= RIGHT_GOAL_X && spot.x >= RIGHT_GOAL_X - GOAL_BOX_DEPTH, "goal kick must be taken inside the goal area");
  assert.ok(Math.abs(spot.z) <= GOAL_BOX_HALF_Z, "goal kick spot must be inside the goal-area width");

  intruder.pos = { x: RIGHT_GOAL_X - 1.2, y: 0, z: 0 };
  intruder.targetPos = { x: intruder.pos.x, z: intruder.pos.z };
  for (let i = 0; i < 95; i++) model.step(1 / 60);
  assert.equal((model.msm.state as { kind: string }).kind, "ball_out", "goal kick must wait while opponents are still inside the penalty area");

  let intruderClearAtRelease = false;
  for (let i = 0; i < 420 && (model.msm.state as { kind: string }).kind === "ball_out"; i++) {
    model.step(1 / 60);
    if ((model.msm.state as { kind: string }).kind === "live_play") {
      intruderClearAtRelease = !isInPenaltyArea(intruder.pos, false);
    }
  }
  assert.equal(intruderClearAtRelease, true, "opponent must leave the penalty area before goal kick release");
  const release = model.eventLog.filter((event) => event.action === "GOAL_KICK" && event.meta?.phase === "release").at(-1);
  assert.equal(release?.meta?.offsideExempt, true, "goal-kick release must mark direct receiver as offside-exempt");
});

test("keeper held possession releases as a visible drop kick distribution", () => {
  const model = new SimpleMatchModel();
  model.setSeed("keeper-drop-kick");
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 15;

  const keeper = model.getPlayers().find((player) => player.team === "A" && player.role === "GK");
  const target = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(keeper);
  assert.ok(target);
  for (const player of model.getPlayers()) {
    player.pos.x = player.team === "A" ? -18 + player.shirtNumber : 12 + player.shirtNumber * 0.2;
    player.pos.z = player.team === "A" ? player.shirtNumber * 0.4 : -player.shirtNumber * 0.5;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }
  keeper.pos.x = LEFT_GOAL_X + 5;
  keeper.pos.z = 0;
  keeper.targetPos = { x: keeper.pos.x, z: keeper.pos.z };
  target.pos.x = 10;
  target.pos.z = 0;
  target.targetPos = { x: target.pos.x, z: target.pos.z };
  model.possession = keeper;
  model.ball.pos = { x: keeper.pos.x, y: 0.18, z: keeper.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 0;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0,
    range: (min, max) => (min + max) / 2,
  };

  model.step(1 / 30);

  const snapshot = model.getMatchSnapshot();
  const bundle = model.getTuningBundle();
  const dropKickEvent = model.eventLog.filter((event) => event.action === "DROP_KICK").at(-1);
  const flight = bundle.ballFlightTelemetry.at(-1);

  assert.equal(snapshot.gkDistributionsA, 1);
  assert.equal(snapshot.gkDistCompletedA, 1);
  assert.equal(dropKickEvent?.meta?.restartType, "drop_kick");
  assert.equal(dropKickEvent?.meta?.takerId, keeper.id);
  assert.equal(flight?.kind, "pass");
  assert.equal(flight?.sourceAction, "drop_kick");
  assert.equal(flight?.passerId, keeper.id);
  assert.equal((model as any).lastKeeperKickTelemetry?.style, "drop_kick");
});

test("simple model animates visible ball movement between model outcomes", () => {
  const model = new SimpleMatchModel();
  model.setSeed("ball-flight-test");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  let sawBallInFlight = false;
  for (let i = 0; i < 4000 && model.getMatchSnapshot().phase !== "FULL_TIME"; i++) {
    const before = { ...model.ball.pos };
    model.step(1 / 30);
    model.updateVisuals(1 / 30);
    const after = model.ball.pos;
    const carrier = model.getSelectedPlayerStats();
    const ballMoved = Math.hypot(after.x - before.x, after.z - before.z) > 0.05;
    const awayFromCarrier = carrier
      ? Math.hypot(after.x - carrier.pos.x, after.z - carrier.pos.z) > 0.5 || after.y > 0.35
      : after.y > 0.35;
    if (ballMoved && awayFromCarrier) {
      sawBallInFlight = true;
      break;
    }
  }

  assert.equal(sawBallInFlight, true);
});

test("V45 simple model keeps 5-minute halves at 100 percent movement speed while compressing production", () => {
  const sample = (halfSeconds: number) => {
    const model = new SimpleMatchModel();
    model.setSeed("v45-half-length-speed");
    model.setTeamNames("Charlotte FC", "Sporting Kansas City");
    model.setTeamFormations("4-3-3", "4-4-2");
    model.setHalfDurationSeconds(halfSeconds);
    model.setSeriesSpeedMul(1);
    model.startMatch();

    const initialPositions = new Map(model.getPlayers().map((player) => [
      player.id,
      { x: player.pos.x, z: player.pos.z },
    ]));

    for (let i = 0; i < 60 * 60; i++) {
      model.step(1 / 60);
    }

    const topInstantSpeed = Math.max(...model.getPlayers().map((player) => Math.hypot(player.vel.x, player.vel.z)));
    const topDistance = Math.max(...model.getPlayers().map((player) => {
      const initial = initialPositions.get(player.id);
      assert.ok(initial);
      return Math.hypot(player.pos.x - initial.x, player.pos.z - initial.z);
    }));
    const snapshot = model.getMatchSnapshot();
    return {
      elapsed: snapshot.elapsedInHalf,
      actions: snapshot.passesA + snapshot.passesB + snapshot.shotsA + snapshot.shotsB,
      topInstantSpeed,
      topDistance,
    };
  };

  const shortHalf = sample(5 * 60);
  const fullHalf = sample(45 * 60);

  assert.ok(Math.abs(shortHalf.elapsed - 60 * 9) <= 0.2);
  assert.ok(Math.abs(fullHalf.elapsed - 60) <= 1 / 60 + 0.001);
  assert.ok(shortHalf.topInstantSpeed <= BASE_RUN_SPEED * 1.02, `short-half player speed was accelerated to ${shortHalf.topInstantSpeed.toFixed(2)}`);
  assert.ok(fullHalf.topInstantSpeed <= BASE_RUN_SPEED * 1.02, `full-half player speed was accelerated to ${fullHalf.topInstantSpeed.toFixed(2)}`);
  assert.ok(shortHalf.actions >= fullHalf.actions * 1.8, `expected compressed-runtime action production under visible hold, got ${shortHalf.actions} vs ${fullHalf.actions}`);
});

test("V45 selected half length accelerates only the match clock", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v45-clock-only-compression");
  model.setHalfDurationSeconds(5 * 60);
  model.setSeriesSpeedMul(1);
  model.startMatch();

  const start = model.getMatchSnapshot();
  for (let i = 0; i < 10 * 60; i++) model.step(1 / 60);
  const end = model.getMatchSnapshot();
  const topInstantSpeed = Math.max(...model.getPlayers().map((player) => Math.hypot(player.vel.x, player.vel.z)));

  assert.equal(end.halfDuration, 45 * 60);
  assert.equal(end.runtimeHalfDuration, 5 * 60);
  assert.equal(end.matchClockScale, 9);
  assert.ok(Math.abs((end.elapsedInHalf - start.elapsedInHalf) - 90) < 0.2);
  assert.ok(topInstantSpeed <= BASE_RUN_SPEED * 1.02, `clock compression must not speed players to ${topInstantSpeed.toFixed(2)}`);
});

test("V53 simple model 5-minute halves preserve held-ball action floor", () => {
  const rows = ["v53-production-a", "v53-production-b", "v53-production-c"].map((seed) => {
    const model = new SimpleMatchModel();
    model.setSeed(seed);
    model.setTeamNames("LAFC", "Austin FC");
    model.setTeamFormations("4-3-3", "4-2-3-1");
    model.setHalfDurationSeconds(5 * 60);
    model.startMatch();

    for (let i = 0; i < 12 * 60 * 60 && model.getMatchSnapshot().phase !== "FULL_TIME"; i++) {
      model.step(1 / 60);
      model.updateVisuals(1 / 60);
    }

    const snapshot = model.getMatchSnapshot();
    assert.equal(snapshot.phase, "FULL_TIME");
    assert.deepEqual(model.getTuningBundle().visualRealityEvents, []);
    return {
      passes: snapshot.passesA + snapshot.passesB,
      shots: snapshot.shotsA + snapshot.shotsB,
      sot: snapshot.shotsOnTargetA + snapshot.shotsOnTargetB,
    };
  });

  const avg = (key: "passes" | "shots" | "sot") => rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
  assert.ok(avg("passes") >= 140, `expected held-ball pass volume floor, got ${avg("passes").toFixed(1)}`);
  assert.ok(avg("shots") >= 8, `expected held-ball shot volume floor, got ${avg("shots").toFixed(1)}`);
  assert.ok(avg("sot") >= 4, `expected held-ball SOT volume floor, got ${avg("sot").toFixed(1)}`);
});

test("V56 simple model reports realistic rendered ball speed bands", () => {
  const model = new SimpleMatchModel();
  model.setSeed("ball-speed-telemetry");
  model.setHalfDurationSeconds(45 * 60);
  model.startMatch();

  for (let i = 0; i < 9000 && model.getMatchSnapshot().phase !== "FULL_TIME"; i++) {
    model.step(1 / 30);
  }

  const flights = model.getTuningBundle().ballFlightTelemetry;
  const passFlights = flights.filter((flight) => flight.kind === "pass");
  const shortMediumPasses = passFlights.filter((flight) => flight.distanceYards <= 40);
  const longPasses = passFlights.filter((flight) => flight.distanceYards > 40);
  const shotFlights = flights.filter((flight) => flight.kind === "shot" || flight.kind === "save" || flight.kind === "miss");
  assert.ok(passFlights.length >= 20, `expected pass-flight samples, got ${passFlights.length}`);
  assert.ok(shortMediumPasses.length >= 5, `expected short/medium pass samples, got ${shortMediumPasses.length}`);
  assert.ok(shotFlights.length >= 1, "expected shot-flight samples");
  const avgShortMediumPassMps = shortMediumPasses.reduce((sum, flight) => sum + flight.speedMps, 0) / shortMediumPasses.length;
  assert.ok(avgShortMediumPassMps >= 15 && avgShortMediumPassMps <= 21, `short/medium pass avg ${avgShortMediumPassMps.toFixed(1)} m/s`);
  assert.ok(longPasses.every((flight) => flight.speedMps >= 24 && flight.speedMps <= 32), "driven long balls must stay in 25-31 m/s band");
  assert.ok(shotFlights.every((flight) => flight.speedMps >= 30 && flight.speedMps <= 39), "shot flights must stay in 31-38 m/s band");
});

test("V57 simple model does not launch a new ball action before the visible flight arrives", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v57-no-invisible-kicks");
  model.setTeamNames("LAFC", "Austin FC");
  model.setHalfDurationSeconds(90);
  model.startMatch();

  for (let i = 0; i < 60 * 90 && model.getMatchSnapshot().phase !== "FULL_TIME"; i++) {
    model.step(1 / 60);
    model.updateVisuals(1 / 60);
  }

  const flights = model.getTuningBundle().ballFlightTelemetry;
  assert.ok(flights.length >= 10, `expected enough ball flights to audit, got ${flights.length}`);
  for (let i = 1; i < flights.length; i++) {
    const previous = flights[i - 1];
    const current = flights[i];
    const previousEnd = previous.elapsedInHalf + previous.durationSeconds;
    assert.ok(
      current.elapsedInHalf >= previousEnd - 0.04,
      `flight ${current.seq} started at ${current.elapsedInHalf}s before flight ${previous.seq} arrived at ${previousEnd.toFixed(2)}s`,
    );
  }
});

test("V59 simple model flags receiver involvement from an offside position", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v59-offside");
  model.setTeamNames("LAFC", "Austin FC");
  model.startMatch();
  for (let i = 0; i < 60 && model.getMatchSnapshot().phase === "KICKOFF"; i++) {
    model.step(1 / 30);
    model.updateVisuals(1 / 30);
  }

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  const receiver = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(carrier);
  assert.ok(receiver);
  for (const player of model.getPlayers()) {
    if (player.team === "A") {
      player.pos.x = player === carrier || player === receiver ? player.pos.x : -55;
      player.pos.z = player.shirtNumber;
    } else {
      player.pos.x = player.role === "GK" ? 28 : 5;
      player.pos.z = player.shirtNumber * 0.2;
    }
  }
  carrier.pos.x = 0;
  carrier.pos.z = 0;
  receiver.pos.x = 18;
  receiver.pos.z = 0;
  model.possession = carrier;
  model.ball.pos.x = carrier.pos.x;
  model.ball.pos.z = carrier.pos.z;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0,
    range: (min: number, max: number) => (min + max) / 2,
  };
  const ballBeforeOffside = { x: model.ball.pos.x, z: model.ball.pos.z };
  const passesBefore = model.getMatchSnapshot().passesA;
  const flightsBefore = model.getTuningBundle().ballFlightTelemetry.length;

  (model as any).resolvePass(carrier, 0);

  const snapshot = model.getMatchSnapshot();
  const bundle = model.getTuningBundle();
  const state = model.msm.state as { kind: string; restartType?: string; restartTeam?: string };
  assert.equal(snapshot.offsidesA, 1);
  assert.equal(snapshot.passesA, passesBefore);
  assert.equal(state.kind, "ball_out");
  assert.equal(state.restartType, "free_kick");
  assert.equal(state.restartTeam, "away");
  assert.equal((model as any).pendingBallOutEvent?.restartType, "free_kick");
  assert.equal((model as any).pendingBallOutEvent?.restartTeam, "away");
  assert.equal((model as any).pendingBallOutContext?.restartTeam, "B");
  assert.ok(
    (model as any).offsideTargetSelectionLockedUntil >= (model as any).elapsedTotal + 20,
    "offside target selection should remain locked long enough to prevent rapid repeat calls",
  );
  assert.ok(dist2(model.ball.pos, ballBeforeOffside) < 0.001, "pre-pass offside restart must not teleport the ball to the offside runner");
  assert.ok(dist2((model as any).pendingBallOutContext?.spot, ballBeforeOffside) < 0.001, "offside free-kick spot should remain at the ball-at-touch origin");
  assert.equal(model.eventLog.some((event) => event.action === "FREE_KICK" && event.meta?.phase === "setup"), true);
  assert.equal(bundle.events.some((event: any) => event.type === "OFFSIDE" && event.team === "A"), true);
  assert.equal(bundle.ballFlightTelemetry.length, flightsBefore);

  const onsideOutlet = model.getPlayers().find((player) => player.team === "A" && player.role === "W");
  assert.ok(onsideOutlet);
  carrier.pos.x = 0;
  carrier.pos.z = 0;
  receiver.pos.x = 18;
  receiver.pos.z = 0;
  onsideOutlet.pos.x = 4;
  onsideOutlet.pos.z = 2;
  for (const player of model.getPlayers().filter((player) => player.team === "B")) {
    player.pos.x = player.role === "GK" ? 28 : 5;
    player.pos.z = player.shirtNumber * 0.2;
  }
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.possession = carrier;
  (model as any).ballFlight = null;
  model.ball.pos.x = carrier.pos.x;
  model.ball.pos.z = carrier.pos.z;

  (model as any).resolvePass(carrier, 0);

  assert.equal(model.getMatchSnapshot().offsidesA, 1, "AI must not call a second offside in rapid succession after the first whistle");
});

test("V59 simple model ignores marginal offside-looking positions", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v59-offside-margin");
  model.setTeamNames("LAFC", "Austin FC");
  model.startMatch();

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  const receiver = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(carrier);
  assert.ok(receiver);

  carrier.pos.x = 0;
  carrier.pos.z = 0;
  receiver.pos.x = 5.7;
  receiver.pos.z = 0;
  for (const player of model.getPlayers().filter((player) => player.team === "B")) {
    player.pos.x = player.role === "GK" ? 28 : 5;
    player.pos.z = player.shirtNumber * 0.2;
  }

  assert.equal(
    (model as any).offsideInfraction(carrier, receiver, { x: carrier.pos.x, z: carrier.pos.z }),
    null,
    "sub-yard visual/model jitter near the offside line must not create phantom offside calls",
  );
});

test("V91 normal pass target selection can surface offside telemetry", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v91-normal-offside-selection");
  model.setTeamNames("Canada", "Uzbekistan");
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0,
    range: (min: number, max: number) => (min + max) / 2,
  };

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  const receiver = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(carrier);
  assert.ok(receiver);
  for (const player of model.getPlayers()) {
    if (player.team === "A") {
      player.pos.x = player === carrier || player === receiver ? player.pos.x : -55;
      player.pos.z = player.shirtNumber;
    } else {
      player.pos.x = player.role === "GK" ? 28 : 5;
      player.pos.z = player.shirtNumber * 0.2;
    }
  }
  carrier.pos.x = 0;
  carrier.pos.z = 0;
  receiver.pos.x = 18;
  receiver.pos.z = 0;
  model.possession = carrier;
  model.ball.pos.x = carrier.pos.x;
  model.ball.pos.z = carrier.pos.z;

  assert.equal((model as any).bestPassTarget(carrier)?.id, receiver.id);
  (model as any).resolvePass(carrier, 0);

  const snapshot = model.getMatchSnapshot();
  const live = model.getLiveTelemetry();
  const bundle = model.getTuningBundle();
  assert.equal(snapshot.offsidesA, 1);
  assert.equal(live.teamA.offsides, 1);
  assert.equal(bundle.teamA.offsides, 1);
  assert.equal(model.msm.state.kind, "ball_out");
  assert.equal((model.msm.state as { kind: string; restartType?: string }).restartType, "free_kick");
  assert.equal((model as any).pendingBallOutEvent?.restartType, "free_kick");
  assert.equal((model as any).pendingBallOutContext?.restartTeam, "B");
  assert.equal(bundle.events.some((event: any) => event.type === "OFFSIDE" && event.team === "A"), true);
});

test("V91 tackle and foul counters populate dashboard team and role telemetry", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v91-defensive-counters");
  model.setTeamNames("Canada", "Uzbekistan");
  model.startMatch();

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  const defender = model.getPlayers().find((player) => player.team === "B" && player.role !== "GK");
  assert.ok(carrier);
  assert.ok(defender);

  (model as any).recordTackle(defender, carrier, 2.2, "TEST_TACKLE");
  (model as any).recordFoul(defender, carrier, 2.2, "TEST_FOUL");

  const snapshot = model.getMatchSnapshot();
  const live = model.getLiveTelemetry();
  const bundle = model.getTuningBundle();
  const defenderRole = bundle.teamB.roleStats[defender.label] as Record<string, unknown>;
  const carrierRole = bundle.teamA.roleStats[carrier.label] as Record<string, unknown>;

  assert.equal(snapshot.tacklesWonB, 1);
  assert.equal(snapshot.foulsB, 1);
  assert.equal(live.teamB.tackles, 1);
  assert.equal(live.teamB.fouls, 1);
  assert.equal(bundle.teamB.tackles, 1);
  assert.equal(bundle.teamB.fouls, 1);
  assert.equal(defenderRole.tackles, 1);
  assert.equal(defenderRole.fouls, 1);
  assert.equal(carrierRole.fouled, 1);
  assert.equal(bundle.events.some((event: any) => event.type === "TACKLE" && event.team === "B"), true);
  assert.equal(bundle.events.some((event: any) => event.type === "FOUL" && event.team === "B"), true);
});

test("V92 fouls stop live play and restart with a free kick for the fouled team", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v92-foul-free-kick");
  model.setTeamNames("Canada", "Uzbekistan");
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;
  (model as unknown as { actionTimer: number }).actionTimer = 0;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0,
    range: (min: number) => min,
  };

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  const defender = model.getPlayers().find((player) => player.team === "B" && player.role !== "GK");
  assert.ok(carrier);
  assert.ok(defender);
  for (const player of model.getPlayers()) {
    player.pos.x = player.team === "A" ? -20 : 20;
    player.pos.z = player.shirtNumber;
    player.targetPos = { ...player.pos };
    player.vel = { x: 0, z: 0 };
  }
  carrier.pos.x = 0;
  carrier.pos.z = 0;
  carrier.targetPos = { ...carrier.pos };
  defender.pos.x = 0.8;
  defender.pos.z = 0;
  defender.targetPos = { ...defender.pos };
  model.possession = carrier;
  model.ball.pos = { x: carrier.pos.x, y: 0.18, z: carrier.pos.z };

  model.step(1 / 30);

  const state = model.msm.state as { kind: string; restartType?: string; restartTeam?: string };
  const snapshot = model.getMatchSnapshot();
  assert.equal(state.kind, "ball_out");
  assert.equal(state.restartType, "free_kick");
  assert.equal(state.restartTeam, "home");
  assert.equal(snapshot.foulsB, 1);
  assert.equal(snapshot.freeKicksA, 1);
  assert.equal(model.eventLog.some((event) => event.action === "FOUL"), true);
  assert.equal(model.eventLog.some((event) => event.action === "FREE_KICK" && event.meta?.phase === "setup"), true);

  for (let i = 0; i < 180 && (model.msm.state as { kind: string }).kind === "ball_out"; i++) {
    model.step(1 / 30);
  }

  const flight = model.getTuningBundle().ballFlightTelemetry.at(-1);
  assert.equal(model.msm.state.kind, "live_play");
  assert.equal(flight?.kind, "restart");
  assert.equal(flight?.sourceAction, "free_kick");
  assert.equal(model.eventLog.some((event) => event.action === "FREE_KICK" && event.meta?.phase === "release"), true);
});

test("penalty-area defensive fouls award a penalty instead of a free kick", () => {
  const model = new SimpleMatchModel();
  model.setSeed("penalty-area-foul");
  model.setTeamNames("Canada", "Uzbekistan");
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 24;
  (model as unknown as { actionTimer: number }).actionTimer = 0;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0,
    range: (min: number) => min,
  };

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const defender = model.getPlayers().find((player) => player.team === "B" && player.role !== "GK");
  assert.ok(carrier);
  assert.ok(defender);
  for (const player of model.getPlayers()) {
    player.pos.x = player.team === "A" ? -20 : 20;
    player.pos.z = player.shirtNumber;
    player.targetPos = { ...player.pos };
    player.vel = { x: 0, z: 0 };
  }
  carrier.pos.x = RIGHT_PENALTY_X + 0.7;
  carrier.pos.z = 0;
  carrier.targetPos = { ...carrier.pos };
  defender.pos.x = RIGHT_PENALTY_X + 0.9;
  defender.pos.z = 0;
  defender.targetPos = { ...defender.pos };
  model.possession = carrier;
  model.ball.pos = { x: carrier.pos.x, y: 0.18, z: carrier.pos.z };

  model.step(1 / 30);

  const state = model.msm.state as { kind: string; restartType?: string; restartTeam?: string };
  const snapshot = model.getMatchSnapshot();
  const live = model.getLiveTelemetry();
  const bundle = model.getTuningBundle();
  assert.equal(state.kind, "ball_out");
  assert.equal(state.restartType, "penalty");
  assert.equal(state.restartTeam, "home");
  assert.equal(snapshot.foulsB, 1);
  assert.equal(snapshot.penaltiesAwardedA, 1);
  assert.equal(snapshot.freeKicksA, 0);
  assert.equal(live.teamA.penaltiesAwarded, 1);
  assert.equal(bundle.teamA.penaltiesAwarded, 1);
  assert.equal(model.eventLog.some((event) => event.action === "PENALTY" && event.meta?.phase === "setup"), true);
});

test("penalty restart release records shot-backed penalty goals", () => {
  const model = new SimpleMatchModel();
  model.setSeed("penalty-release-goal");
  model.setTeamNames("Canada", "Uzbekistan");
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 30;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.98,
    range: (min: number, max: number) => (min + max) / 2,
  };

  const taker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(taker);
  const spot = (model as any).penaltySpotForAttack(1);
  const context = {
    restartType: "penalty",
    restartTeam: "A",
    spot,
    lastTouchTeam: "B",
    lastTouchPlayerId: "B-4",
    crossedLine: "infraction",
    takerId: taker.id,
    fouledPlayerId: taker.id,
  };

  const goalEvent = (model as any).executePenaltyRestart(context, taker);
  const snapshot = model.getMatchSnapshot();
  const bundle = model.getTuningBundle();
  assert.deepEqual(goalEvent, { scoringTeam: "home" });
  assert.equal(snapshot.shotsA, 1);
  assert.equal(snapshot.shotsOnTargetA, 1);
  assert.equal(snapshot.penaltiesScoredA, 1);
  assert.equal(bundle.teamA.penaltiesTaken, 1);
  assert.equal(bundle.teamA.penaltiesScored, 1);
  assert.equal(bundle.events.some((event: any) => event.type === "GOAL" && event.detail.resolutionReason === "PENALTY_KICK"), true);
  assert.equal(bundle.ballFlightTelemetry.at(-1)?.kind, "shot");
  assert.equal(bundle.ballFlightTelemetry.at(-1)?.sourceAction, "penalty");
});

test("penalty restart release records saved and missed outcomes", () => {
  const saved = new SimpleMatchModel();
  saved.setSeed("penalty-release-save");
  saved.setTeamNames("Canada", "Uzbekistan");
  saved.startMatch();
  saved.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  (saved as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.14,
    range: (min: number, max: number) => (min + max) / 2,
  };
  const savedTaker = saved.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(savedTaker);
  const savedContext = {
    restartType: "penalty",
    restartTeam: "A",
    spot: (saved as any).penaltySpotForAttack(1),
    lastTouchTeam: "B",
    lastTouchPlayerId: "B-4",
    crossedLine: "infraction",
    takerId: savedTaker.id,
    fouledPlayerId: savedTaker.id,
  };
  assert.equal((saved as any).executePenaltyRestart(savedContext, savedTaker), null);
  assert.equal(saved.getMatchSnapshot().penaltiesSavedA, 1);
  assert.equal(saved.getMatchSnapshot().savesB, 1);
  assert.equal(saved.getTuningBundle().ballFlightTelemetry.at(-1)?.kind, "save");

  const missed = new SimpleMatchModel();
  missed.setSeed("penalty-release-miss");
  missed.setTeamNames("Canada", "Uzbekistan");
  missed.startMatch();
  missed.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  (missed as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.01,
    range: (min: number, max: number) => (min + max) / 2,
  };
  const missedTaker = missed.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(missedTaker);
  const missedContext = {
    restartType: "penalty",
    restartTeam: "A",
    spot: (missed as any).penaltySpotForAttack(1),
    lastTouchTeam: "B",
    lastTouchPlayerId: "B-4",
    crossedLine: "infraction",
    takerId: missedTaker.id,
    fouledPlayerId: missedTaker.id,
  };
  assert.equal((missed as any).executePenaltyRestart(missedContext, missedTaker), null);
  assert.equal(missed.getMatchSnapshot().penaltiesMissedA, 1);
  assert.equal(missed.getMatchSnapshot().shotsOnTargetA, 0);
  assert.equal(missed.getTuningBundle().ballFlightTelemetry.at(-1)?.kind, "miss");
});

test("V60 simple model caps two-player pass exchanges at two consecutive completed passes", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v60-no-ping-pong");
  model.setTeamNames("LAFC", "Austin FC");

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  const bounce = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const alternate = model.getPlayers().find((player) => player.team === "A" && player.role === "W");
  assert.ok(carrier);
  assert.ok(bounce);
  assert.ok(alternate);

  for (const player of model.getPlayers()) {
    if (player.team === "A") {
      player.pos.x = -31;
      player.pos.z = 30 + player.shirtNumber;
    } else {
      player.pos.x = player.role === "GK" ? 31 : 24;
      player.pos.z = player.shirtNumber * 0.2;
    }
  }
  carrier.pos.x = 0;
  carrier.pos.z = 0;
  bounce.pos.x = 8;
  bounce.pos.z = 0;
  alternate.pos.x = 4;
  alternate.pos.z = 17;

  const targetBeforeLoop = (model as any).bestPassTarget(carrier);
  assert.equal(targetBeforeLoop?.id, bounce.id);

  (model as any).rememberCompletedPass(carrier, bounce);
  (model as any).rememberCompletedPass(bounce, carrier);

  const targetAfterLoop = (model as any).bestPassTarget(carrier);
  assert.equal(targetAfterLoop?.id, alternate.id);
  assert.equal(model.lastPassLoopTelemetry?.["blockedTarget"], bounce.name);
});

test("V61 simple model renders normal passes as low, constant-speed ball flights", () => {
  const model = new SimpleMatchModel();
  const flightModel = model as any;
  const passDistance = 20 * FIELD_SCALE_PER_YARD;

  flightModel.startBallFlight("pass", { x: 0, z: 0 }, { x: passDistance, z: 0 }, 1, 0.75);

  const samples: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < 120 && flightModel.ballFlight; i++) {
    flightModel.updateBallFlight(1 / 60);
    samples.push({ ...model.ball.pos });
  }

  assert.ok(samples.length > 10, "expected enough pass-flight samples");
  const peakY = Math.max(...samples.map((sample) => sample.y));
  assert.ok(peakY <= 0.31, `20-yard pass peak was too high: ${peakY.toFixed(2)}`);
  assert.ok(Math.min(...samples.map((sample) => sample.y)) >= 0.18, "pass should not dip below ground height");

  const deltas = samples.slice(1, -1).map((sample, index) => Math.hypot(sample.x - samples[index].x, sample.z - samples[index].z));
  const maxDelta = Math.max(...deltas);
  const minDelta = Math.min(...deltas);
  assert.ok(maxDelta / minDelta < 1.08, `pass horizontal speed changed too much: ${minDelta.toFixed(3)}-${maxDelta.toFixed(3)}`);
});

test("V71 simple model dribbled ball chases carrier instead of snapping magnetically", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v71-controlled-ball-not-magnetic");
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;
  (model as unknown as { kickoffSetupMoving: boolean }).kickoffSetupMoving = false;
  (model as unknown as { actionTimer: number }).actionTimer = 999;

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  assert.ok(carrier);
  carrier.pos.x = -6;
  carrier.pos.z = 0;
  carrier.vel = { x: 0, z: 0 };
  carrier.targetPos = { x: carrier.pos.x, z: carrier.pos.z };
  model.possession = carrier;
  model.ball.pos = { x: carrier.pos.x, y: 0.18, z: carrier.pos.z };

  const gaps: number[] = [];
  for (let i = 0; i < 40; i++) {
    model.step(1 / 60);
    gaps.push(dist2(model.ball.pos, carrier.pos));
  }

  const settledGap = gaps.at(-1) ?? 0;
  assert.ok(settledGap > 0.30, `controlled ball looked glued to carrier, gap ${settledGap.toFixed(2)}`);
  assert.ok(Math.max(...gaps) <= 1.9, `controlled ball exceeded possession leash: ${Math.max(...gaps).toFixed(2)}`);
  assert.equal(model.getTuningBundle().visualRealityEvents.filter((event) => event.type === "BALL_CARRIER_GAP").length, 0);
});

test("V73 simple model pass flight stays straight after the ball is kicked", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v73-straight-pass-flight");
  model.startMatch();

  const receiver = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  assert.ok(receiver);

  const from = { x: -8, z: -6 };
  const to = { x: 8, z: 4 };
  (model as unknown as {
    startBallFlight: (
      kind: string,
      from: { x: number; z: number },
      to: { x: number; z: number },
      duration: number,
      arc: number,
      followPlayer?: typeof receiver,
    ) => number;
  }).startBallFlight("pass", from, to, 1.1, 0.08, receiver);

  const samples: { x: number; z: number }[] = [];
  for (let i = 0; i < 20; i++) {
    receiver.pos.x += 0.20;
    receiver.pos.z -= 0.10;
    (model as unknown as { updateBallFlight: (dt: number) => void }).updateBallFlight(1 / 30);
    samples.push({ x: model.ball.pos.x, z: model.ball.pos.z });
  }

  const line = { x: to.x - from.x, z: to.z - from.z };
  const length = Math.hypot(line.x, line.z);
  const maxCrossTrack = Math.max(...samples.map((sample) => Math.abs((sample.x - from.x) * line.z - (sample.z - from.z) * line.x) / length));
  const latest = model.getTuningBundle().ballFlightTelemetry.at(-1);

  assert.ok(maxCrossTrack < 0.001, `pass path curved ${maxCrossTrack.toFixed(4)} units off its original line`);
  assert.deepEqual(latest?.to, to);
});

test("V74 simple model holds controlled possession 50 percent longer than base cadence", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v74-ball-hold-time");
  model.setHalfDurationSeconds(45 * 60);
  model.startMatch();

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  assert.ok(carrier);
  model.possession = carrier;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.5,
    range: () => 0,
  };

  const tempo = (model as unknown as { team: (team: "A" | "B") => { tuning: { tempo: number } } }).team("A").tuning.tempo;
  const baseDelay = Math.min(7.2, Math.max(3.10, 5.25 - tempo * 1.4));
  const delay = (model as unknown as { nextActionDelay: () => number }).nextActionDelay();

  assert.equal(+delay.toFixed(4), +(baseDelay * 1.5).toFixed(4));
});

test("V74 simple model holds the receiver after a completed pass visibly arrives", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v74-receiver-visible-hold");
  model.setHalfDurationSeconds(300);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };

  const passer = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  assert.ok(passer);
  model.possession = passer;
  model.ball.pos = { x: passer.pos.x, y: 0.18, z: passer.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 0;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0,
    range: (min: number) => min,
  };

  (model as unknown as { resolvePass: (carrier: typeof passer, pressure: number) => void }).resolvePass(passer, 0);

  const latestFlight = model.getTuningBundle().ballFlightTelemetry.at(-1);
  const actionTimer = (model as unknown as { actionTimer: number }).actionTimer;

  assert.equal(latestFlight?.kind, "pass");
  assert.ok(actionTimer >= Number(latestFlight?.durationSeconds) + 1.48);
});

test("simple model visual reality audit stays clean in short matches", () => {
  const model = new SimpleMatchModel();
  model.setSeed("visual-reality-clean");
  model.setHalfDurationSeconds(20);
  model.startMatch();

  for (let i = 0; i < 6000 && model.getMatchSnapshot().phase !== "FULL_TIME"; i++) {
    model.step(1 / 30);
    model.updateVisuals(1 / 30);
  }

  assert.deepEqual(model.getTuningBundle().visualRealityEvents, []);
});

test("simple model normal-speed player movement stays within user-approved speed bounds", () => {
  const model = new SimpleMatchModel();
  model.setSeed("normal-speed-player-measurement");
  model.setTeamNames("LA Galaxy", "LAFC");
  model.setTeamFormations("3-4-3", "3-4-3");
  model.setHalfDurationSeconds(45 * 60);
  model.setSeriesSpeedMul(1);
  model.startMatch();

  for (let i = 0; i < 1000 && model.getMatchSnapshot().phase !== "FIRST_HALF"; i++) {
    model.step(1 / 60);
  }

  const start = model.getMatchSnapshot();
  const initialPositions = new Map(model.getPlayers().map((player) => [
    player.id,
    { x: player.pos.x, z: player.pos.z },
  ]));

  const instantSamples: number[] = [];
  for (let i = 0; i < 600; i++) {
    model.step(1 / 60);
    for (const player of model.getPlayers()) {
      instantSamples.push(Math.hypot(player.vel.x, player.vel.z));
    }
  }

  const end = model.getMatchSnapshot();
  const metersPerUnit = 0.9144 / FIELD_SCALE_PER_YARD;
  const measurements = model.getPlayers().map((player) => {
    const initial = initialPositions.get(player.id);
    assert.ok(initial);
    const distanceUnits = Math.hypot(player.pos.x - initial.x, player.pos.z - initial.z);
    const speedUnits = Math.hypot(player.vel.x, player.vel.z);
    return {
      avgMps: distanceUnits / 10 * metersPerUnit,
      instMps: speedUnits * metersPerUnit,
    };
  });

  const topAverageMps = Math.max(...measurements.map((measurement) => measurement.avgMps));
  const topInstantMps = Math.max(...measurements.map((measurement) => measurement.instMps));
  const sortedInstantMps = instantSamples.map((speedUnits) => speedUnits * metersPerUnit).sort((a, b) => a - b);
  const p90InstantMps = sortedInstantMps[Math.floor((sortedInstantMps.length - 1) * 0.9)] || 0;

  assert.ok(Math.abs(end.elapsedInHalf - start.elapsedInHalf - 10) < 0.001);
  assert.ok(topAverageMps <= 5.1, `top 10s average speed ${topAverageMps.toFixed(2)} m/s`);
  assert.ok(topInstantMps <= 7.8, `top instant speed ${topInstantMps.toFixed(2)} m/s`);
  assert.ok(p90InstantMps >= 5.3, `live player movement below approved band, p90 instant speed ${p90InstantMps.toFixed(2)} m/s`);
});

test("V41 simple model keeps live player positions inside the field", () => {
  const model = new SimpleMatchModel();
  model.setSeed("field-boundary-regression");
  model.setHalfDurationSeconds(45 * 60);
  model.setSeriesSpeedMul(1);
  model.startMatch();

  for (let i = 0; i < 60 * 120; i++) {
    model.step(1 / 60);
    for (const player of model.getPlayers()) {
      assert.ok(
        player.pos.x >= LEFT_GOAL_X && player.pos.x <= RIGHT_GOAL_X,
        `${player.name} x escaped field at ${player.pos.x.toFixed(2)}`,
      );
      assert.ok(
        player.pos.z >= -FIELD_D / 2 && player.pos.z <= FIELD_D / 2,
        `${player.name} z escaped field at ${player.pos.z.toFixed(2)}`,
      );
    }
  }
});

test("V84 simple model separates overlapping player models after movement", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v84-player-collision");
  model.startMatch();

  const players = model.getPlayers();
  const first = players.find((player) => player.team === "A" && player.role === "CM");
  const second = players.find((player) => player.team === "B" && player.role === "CM");
  assert.ok(first);
  assert.ok(second);

  first.pos = { x: 0, y: 0, z: 0 };
  second.pos = { x: 0, y: 0, z: 0 };
  first.targetPos = { x: 0, z: 0 };
  second.targetPos = { x: 0, z: 0 };
  first.vel = { x: 0, z: 0 };
  second.vel = { x: 0, z: 0 };

  let parked = 0;
  for (const player of players) {
    if (player.id === first.id || player.id === second.id) continue;
    player.pos = {
      x: LEFT_GOAL_X + 6 + (parked % 5) * 5,
      y: 0,
      z: -FIELD_D / 2 + 5 + Math.floor(parked / 5) * 6,
    };
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
    parked += 1;
  }

  (model as unknown as { movePlayers: (dt: number) => void }).movePlayers(1 / 60);

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const gap = dist2(players[i].pos, players[j].pos);
      assert.ok(
        gap >= PLAYER_RADIUS * 2 - 0.001,
        `${players[i].name} and ${players[j].name} overlap at ${gap.toFixed(3)}`,
      );
    }
  }
});

test("simple model records shot opportunities before tuning KPI claims", () => {
  const model = new SimpleMatchModel();
  model.setSeed("shot-opportunity-telemetry");
  model.setHalfDurationSeconds(20);
  model.startMatch();

  for (let i = 0; i < 6000 && model.getMatchSnapshot().phase !== "FULL_TIME"; i++) {
    model.step(1 / 30);
  }

  const opportunities = model.getTuningBundle().shotOpportunities;
  assert.ok(opportunities.length > 0);
  assert.ok(opportunities.every((row) => typeof row.outcome === "string"));
  assert.ok(opportunities.some((row) => row.outcome === "shot" || row.outcome === "pass"));
});

test("V42 simple model converts beaten-keeper goalmouth control into shot-backed goal", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v42-open-net-finish");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const keeper = model.getPlayers().find((player) => player.team === "B" && player.role === "GK");
  assert.ok(attacker);
  assert.ok(keeper);

  attacker.pos.x = RIGHT_GOAL_X - 1.0;
  attacker.pos.z = GOAL_MOUTH_HALF_Z * 0.15;
  attacker.vel = { x: 0, z: 0 };
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };

  keeper.pos.x = RIGHT_GOAL_X - 8.6;
  keeper.pos.z = FIELD_D / 2 - 2;
  keeper.vel = { x: 0, z: 0 };
  keeper.targetPos = { x: keeper.pos.x, z: keeper.pos.z };

  for (const player of model.getPlayers()) {
    if (player.id === attacker.id || player.id === keeper.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 8 : LEFT_GOAL_X + 14;
    player.pos.z = player.role === "GK" ? 0 : FIELD_D * 0.35;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = attacker;
  model.ball.pos = { x: attacker.pos.x, y: 0.18, z: attacker.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 0;

  model.step(1 / 30);

  const snapshot = model.getMatchSnapshot();
  const bundle = model.getTuningBundle();
  const latestShot = bundle.shotDecisions.at(-1);
  const latestGoal = bundle.goalLog.at(-1);
  const goalEvents = bundle.events.filter((event) => event.type === "GOAL");

  assert.equal(snapshot.scoreA, 1);
  assert.equal(snapshot.phase, "GOAL_SCORED");
  assert.equal(snapshot.shotsA, 1);
  assert.equal(snapshot.shotsOnTargetA, 1);
  assert.equal(latestShot?.resolutionReason, "OPEN_NET_FINISH");
  assert.equal(latestShot?.forcedByGeometry, true);
  assert.equal(latestGoal?.resolutionReason, "OPEN_NET_FINISH");
  assert.equal(latestGoal?.shotBacked, true);
  assert.equal(goalEvents.length, 1);
});

test("V85 scored goals send the ball into the back of the net before kickoff setup", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v85-back-net-goal-flight");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const keeper = model.getPlayers().find((player) => player.team === "B" && player.role === "GK");
  assert.ok(attacker);
  assert.ok(keeper);

  attacker.pos = { x: RIGHT_GOAL_X - 2.0, y: 0, z: GOAL_MOUTH_HALF_Z * 0.12 };
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };
  attacker.vel = { x: 0, z: 0 };
  keeper.pos = { x: RIGHT_GOAL_X - 8.0, y: 0, z: FIELD_D / 2 - 2 };
  keeper.targetPos = { x: keeper.pos.x, z: keeper.pos.z };
  keeper.vel = { x: 0, z: 0 };
  model.possession = attacker;
  model.ball.pos = { x: attacker.pos.x, y: 0.18, z: attacker.pos.z };

  (model as unknown as {
    resolveShot: (
      carrier: typeof attacker,
      distToGoal: number,
      pressure: number,
      context: { forceOnTarget: boolean; forceGoal: boolean; reason: string },
    ) => unknown;
  }).resolveShot(attacker, dist2(attacker.pos, { x: RIGHT_GOAL_X, z: 0 }), 0, {
    forceOnTarget: true,
    forceGoal: true,
    reason: "V85_FORCED_GOAL",
  });

  const bundle = model.getTuningBundle();
  const goalFlight = bundle.ballFlightTelemetry.filter((flight) => flight.kind === "shot").at(-1);
  const goalLiveEvent = model.eventLog.filter((event) => event.action === "GOAL").at(-1);
  const netTarget = goalLiveEvent?.meta?.netTarget as { x?: number; z?: number } | undefined;

  assert.ok(Number(goalFlight?.to.x) > RIGHT_GOAL_X + GOAL_FLOOR_DEPTH * 0.5, "goal flight target must be behind the goal line");
  assert.ok(Number(netTarget?.x) > RIGHT_GOAL_X + GOAL_FLOOR_DEPTH * 0.5, "goal event must expose the back-net target");
  assert.ok(Math.abs(Number(goalFlight?.to.z)) < GOAL_MOUTH_HALF_Z, "goal flight target must stay inside the posts");

  model.msm.state = { kind: "goal_scored", scoringTeam: "home", restartAfter: 2.0 };
  model.msm.restartTimer = 0.2;
  for (let i = 0; i < 75; i++) model.step(1 / 60);

  const snapshot = model.getMatchSnapshot();
  assert.equal(snapshot.phase, "GOAL_SCORED", "kickoff setup must wait while the ball settles in the net");
  assert.ok(model.ball.pos.x > RIGHT_GOAL_X + GOAL_FLOOR_DEPTH * 0.5, "visible ball must reach the back of the net");
});

test("V97 post-goal restart does not expose kickoff until setup is ready", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v97-post-goal-kickoff-ready");
  model.setTeamNames("Canada", "Mexico");
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const keeper = model.getPlayers().find((player) => player.team === "B" && player.role === "GK");
  assert.ok(attacker);
  assert.ok(keeper);

  attacker.pos = { x: RIGHT_GOAL_X - 2.0, y: 0, z: GOAL_MOUTH_HALF_Z * 0.12 };
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };
  attacker.vel = { x: 0, z: 0 };
  keeper.pos = { x: RIGHT_GOAL_X - 8.0, y: 0, z: FIELD_D / 2 - 2 };
  keeper.targetPos = { x: keeper.pos.x, z: keeper.pos.z };
  keeper.vel = { x: 0, z: 0 };
  model.possession = attacker;
  model.ball.pos = { x: attacker.pos.x, y: 0.18, z: attacker.pos.z };

  const goalEvent = (model as unknown as {
    resolveShot: (
      carrier: typeof attacker,
      distToGoal: number,
      pressure: number,
      context: { forceOnTarget: boolean; forceGoal: boolean; reason: string },
    ) => { scoringTeam: "home" | "away" } | null;
  }).resolveShot(attacker, dist2(attacker.pos, { x: RIGHT_GOAL_X, z: 0 }), 0, {
    forceOnTarget: true,
    forceGoal: true,
    reason: "V97_FORCED_GOAL",
  });
  assert.ok(goalEvent);
  model.msm.score[goalEvent.scoringTeam] += 1;
  model.msm.state = { kind: "goal_scored", scoringTeam: goalEvent.scoringTeam, restartAfter: 2.0 };
  model.msm.restartTimer = 2.0;

  let sawMovingGoalSetup = false;
  let kickoffFrames = 0;
  let restarted = false;
  for (let i = 0; i < 60 * 18; i++) {
    model.step(1 / 60);
    const snapshot = model.getMatchSnapshot();
    if (snapshot.phase === "GOAL_SCORED" && (model as unknown as { kickoffSetupMoving: boolean }).kickoffSetupMoving) {
      sawMovingGoalSetup = true;
    }
    if (snapshot.phase === "KICKOFF") {
      kickoffFrames += 1;
      assert.equal((model as unknown as { kickoffSetupMoving: boolean }).kickoffSetupMoving, false, "KICKOFF phase must not start while setup players are still moving");
    }
    if (snapshot.phase === "FIRST_HALF") {
      restarted = true;
      break;
    }
  }

  assert.equal(sawMovingGoalSetup, true, "post-goal player reset should happen during goal-scored restart delay");
  assert.equal(restarted, true, "post-goal restart must return to live play within a bounded window");
  assert.ok(kickoffFrames <= 45, `kickoff window should be short once setup is ready, got ${kickoffFrames} frames`);
});

test("V129 post-goal reset movement uses a temporary 1.3x speed multiplier", () => {
  const measureSetupStep = (speedMultiplier: number) => {
    const model = new SimpleMatchModel();
    model.setSeed(`v129-post-goal-reset-${speedMultiplier}`);
    model.startMatch();
    model.msm.clock.elapsedInHalf = 12;
    (model as unknown as { elapsedTotal: number }).elapsedTotal = 12;
    const players = model.getPlayers();
    players.forEach((player, index) => {
      player.pos = {
        x: RIGHT_GOAL_X - 1.5 - (index % 4) * 1.2,
        y: 0,
        z: -FIELD_D / 2 + 2 + (index % 11) * 2.0,
      };
      player.targetPos = { x: player.pos.x, z: player.pos.z };
      player.vel = { x: 0, z: 0 };
    });
    (model as unknown as { installKickoffSetup: (team: "A" | "B") => void }).installKickoffSetup("B");
    for (const player of players) {
      const dx = player.targetPos.x - player.pos.x;
      const dz = player.targetPos.z - player.pos.z;
      const len = Math.hypot(dx, dz) || 1;
      player.vel = { x: (dx / len) * BASE_RUN_SPEED * 5, z: (dz / len) * BASE_RUN_SPEED * 5 };
    }
    const before = new Map(players.map((player) => [player.id, { x: player.pos.x, z: player.pos.z }]));
    (model as unknown as { movePlayers: (dt: number, speedMultiplier?: number) => void }).movePlayers(1 / 60, speedMultiplier);
    return Math.max(...players.map((player) => {
      const start = before.get(player.id);
      assert.ok(start);
      return dist2(player.pos, start);
    }));
  };

  const normalStep = measureSetupStep(1);
  const boostedStep = measureSetupStep(1.3);
  assert.ok(boostedStep > normalStep * 1.25, `post-goal reset should move materially faster, normal=${normalStep.toFixed(4)} boosted=${boostedStep.toFixed(4)}`);
  assert.ok(boostedStep <= normalStep * 1.32, `post-goal reset should stay near 1.3x, normal=${normalStep.toFixed(4)} boosted=${boostedStep.toFixed(4)}`);
});

test("V43 simple model final stats cannot show goals with zero shots", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v43-final-stat-integrity");
  model.setTeamNames("LA Galaxy", "LAFC");
  model.startMatch();

  model.msm.state = { kind: "full_time" };
  model.msm.score.home = 2;
  model.msm.score.away = 1;
  model.teamA.shots = 0;
  model.teamA.shotsOnTarget = 0;
  model.teamB.shots = 0;
  model.teamB.shotsOnTarget = 0;
  model.goalLog.push(
    { team: "A", playerName: "A", shotBacked: true },
    { team: "A", playerName: "B", shotBacked: true },
    { team: "B", playerName: "C", shotBacked: true },
  );

  const snapshot = model.getMatchSnapshot();
  const bundle = model.getTuningBundle();

  assert.equal(snapshot.scoreA, 2);
  assert.equal(snapshot.scoreB, 1);
  assert.ok(snapshot.shotsA >= snapshot.scoreA, `home shots ${snapshot.shotsA} below goals ${snapshot.scoreA}`);
  assert.ok(snapshot.shotsB >= snapshot.scoreB, `away shots ${snapshot.shotsB} below goals ${snapshot.scoreB}`);
  assert.ok(snapshot.shotsOnTargetA >= snapshot.scoreA, `home SOT ${snapshot.shotsOnTargetA} below goals ${snapshot.scoreA}`);
  assert.ok(snapshot.shotsOnTargetB >= snapshot.scoreB, `away SOT ${snapshot.shotsOnTargetB} below goals ${snapshot.scoreB}`);
  assert.ok(bundle.teamA.shots >= bundle.teamA.score);
  assert.ok(bundle.teamB.shots >= bundle.teamB.score);
  assert.ok(bundle.teamA.shotsOnTarget >= bundle.teamA.score);
  assert.ok(bundle.teamB.shotsOnTarget >= bundle.teamB.score);
});

test("V67 simple model cannot score phantom long-distance defender goals", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v67-no-phantom-defender-goal");
  model.setTeamNames("Minnesota United", "Columbus Crew");
  model.startMatch();

  const defender = model.getPlayers().find((player) => player.team === "A" && player.role === "CB");
  assert.ok(defender);
  defender.pos.x = LEFT_GOAL_X + 12;
  defender.pos.z = 10;
  defender.targetPos = { x: defender.pos.x, z: defender.pos.z };
  defender.vel = { x: 0, z: 0 };
  model.possession = defender;
  model.ball.pos = { x: defender.pos.x, y: 0.18, z: defender.pos.z };

  const distToGoal = dist2(defender.pos, { x: RIGHT_GOAL_X, z: 0 });
  const result = (model as unknown as {
    resolveShot: (
      carrier: typeof defender,
      distToGoal: number,
      pressure: number,
      context: Record<string, unknown>,
    ) => unknown;
  }).resolveShot(defender, distToGoal, 0, {
    forceOnTarget: true,
    minGoalChance: 1,
    reason: "REGRESSION_PHANTOM_LONG_GOAL",
  });

  const snapshot = model.getMatchSnapshot();
  const bundle = model.getTuningBundle();
  const latestShot = bundle.shotDecisions.at(-1);

  assert.equal(result, null);
  assert.equal(snapshot.scoreA, 0);
  assert.equal(bundle.goalLog.length, 0);
  assert.equal(snapshot.shotsA, 1);
  assert.equal(snapshot.shotsOnTargetA, 1);
  assert.equal(latestShot?.invalidGoalGeometry, true);
  assert.ok((latestShot?.distToGoalYards as number) > (latestShot?.maxGoalDistanceYards as number));
});

test("V72 simple model shots originate from the visible controlled ball", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v72-visible-shot-origin");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(attacker);
  attacker.pos.x = RIGHT_GOAL_X - 12;
  attacker.pos.z = 0.4;
  attacker.vel = { x: 0, z: 0 };
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };

  const visibleBall = { x: attacker.pos.x - 1.3, z: attacker.pos.z + 0.35 };
  model.possession = attacker;
  model.ball.pos = { x: visibleBall.x, y: 0.18, z: visibleBall.z };
  const carrierDistToGoal = dist2(attacker.pos, { x: RIGHT_GOAL_X, z: 0 });
  const visibleBallDistToGoal = dist2(visibleBall, { x: RIGHT_GOAL_X, z: 0 });

  (model as unknown as {
    resolveShot: (
      carrier: typeof attacker,
      distToGoal: number,
      pressure: number,
      context: { forceOnTarget: boolean; forceSave: boolean; reason: string },
    ) => unknown;
  }).resolveShot(attacker, carrierDistToGoal, 0, {
    forceOnTarget: true,
    forceSave: true,
    reason: "V72_VISIBLE_SHOT_ORIGIN",
  });

  const bundle = model.getTuningBundle();
  const latestFlight = bundle.ballFlightTelemetry.at(-1);
  const latestShot = bundle.shotDecisions.at(-1);

  assert.equal(latestFlight?.kind, "save");
  assert.deepEqual(latestFlight?.from, visibleBall);
  assert.ok(Math.abs(Number(latestShot?.distToGoal) - visibleBallDistToGoal) < 0.01);
  assert.ok(Math.abs(Number(latestShot?.carrierDistToGoal) - carrierDistToGoal) < 0.01);
  assert.ok(Number(latestShot?.carrierBallGap) > 1);
});

test("V72 simple model gives intercepted carriers a visible settle before the next action", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v72-post-interception-settle");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;

  const passer = model.getPlayers().find((player) => player.team === "A" && player.role === "CB");
  assert.ok(passer);
  model.possession = passer;
  model.ball.pos = { x: passer.pos.x, y: 0.18, z: passer.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 0;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.99,
    range: (min: number) => min,
  };

  (model as unknown as { resolvePass: (carrier: typeof passer, pressure: number) => void }).resolvePass(passer, 2.0);

  const latestFlight = model.getTuningBundle().ballFlightTelemetry.at(-1);
  const actionTimer = (model as unknown as { actionTimer: number }).actionTimer;

  assert.equal(latestFlight?.kind, "interception");
  assert.ok(actionTimer >= Number(latestFlight?.durationSeconds) + 1.48);
  assert.ok(actionTimer <= Number(latestFlight?.durationSeconds) + 3.02);
});

test("V47 simple model cannot leave a first goalmouth smother as a zero-shot match", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v47-goalmouth-smothered-shot");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 18;

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const keeper = model.getPlayers().find((player) => player.team === "B" && player.role === "GK");
  assert.ok(attacker);
  assert.ok(keeper);

  attacker.pos.x = RIGHT_GOAL_X - 1.1;
  attacker.pos.z = 0.05;
  attacker.vel = { x: 0, z: 0 };
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };

  keeper.pos.x = RIGHT_GOAL_X - 1.05;
  keeper.pos.z = 0.02;
  keeper.vel = { x: 0, z: 0 };
  keeper.targetPos = { x: keeper.pos.x, z: keeper.pos.z };

  for (const player of model.getPlayers()) {
    if (player.id === attacker.id || player.id === keeper.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 12 : LEFT_GOAL_X + 18;
    player.pos.z = player.role === "GK" ? 0 : FIELD_D * 0.35;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = attacker;
  model.ball.pos = { x: attacker.pos.x, y: 0.18, z: attacker.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 0;

  model.step(1 / 30);

  const snapshot = model.getMatchSnapshot();
  const bundle = model.getTuningBundle();
  const latestShot = bundle.shotDecisions.at(-1);
  const latestOpportunity = bundle.shotOpportunities.at(-1);

  assert.equal(snapshot.shotsA, 1);
  assert.equal(snapshot.shotsOnTargetA, 1);
  assert.equal(snapshot.savesB, 1);
  assert.equal(latestShot?.resolutionReason, "KEEPER_SMOTHERED_SHOT");
  assert.equal(latestOpportunity?.outcome, "smothered_shot");
});

test("V49 simple model cannot expire full time with zero shots while an outfield carrier has the ball", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v49-final-whistle-shot-floor");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 2, startTick: 0 };
  model.msm.clock.half = 2;
  model.msm.clock.elapsedInHalf = model.msm.clock.halfDuration - (1 / 120);
  model.teamA.shots = 0;
  model.teamB.shots = 0;
  model.teamA.shotsOnTarget = 0;
  model.teamB.shotsOnTarget = 0;

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(attacker);
  attacker.pos.x = LEFT_GOAL_X + ((30 / 120) * FIELD_W);
  attacker.pos.z = 0.2;
  attacker.vel = { x: 0, z: 0 };
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };

  model.possession = attacker;
  model.ball.pos = { x: attacker.pos.x, y: 0.18, z: attacker.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 4;

  model.step(1 / 60);

  const snapshot = model.getMatchSnapshot();
  const bundle = model.getTuningBundle();
  const latestShot = bundle.shotDecisions.at(-1);
  const latestOpportunity = bundle.shotOpportunities.at(-1);

  assert.equal(snapshot.phase, "FULL_TIME");
  assert.ok(snapshot.shotsA + snapshot.shotsB > 0, "full time cannot retain zero shots");
  assert.equal(latestShot?.resolutionReason, "NO_SHOT_FINAL_WHISTLE");
  assert.equal(latestOpportunity?.outcome, "minimum_shot_floor");
});

test("V49 simple model cannot expire full time with zero shots during a held pass flight", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v49-final-whistle-held-flight-shot-floor");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 2, startTick: 0 };
  model.msm.clock.half = 2;
  model.msm.clock.elapsedInHalf = model.msm.clock.halfDuration - (1 / 120);
  model.teamA.shots = 0;
  model.teamB.shots = 0;
  model.teamA.shotsOnTarget = 0;
  model.teamB.shotsOnTarget = 0;

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  assert.ok(attacker);
  attacker.pos.x = LEFT_GOAL_X + 7;
  attacker.pos.z = 0.2;
  attacker.vel = { x: 0, z: 0 };
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };

  model.possession = attacker;
  (model as unknown as {
    startBallFlight: (
      kind: string,
      from: { x: number; z: number },
      to: { x: number; z: number },
      duration: number,
      arc: number,
      followPlayer?: typeof attacker,
    ) => number;
  }).startBallFlight("pass", { x: attacker.pos.x - 8, z: attacker.pos.z }, attacker.pos, 1.2, 0.08, attacker);

  model.step(1 / 60);

  const snapshot = model.getMatchSnapshot();
  const latestShot = model.getTuningBundle().shotDecisions.at(-1);

  assert.equal(snapshot.phase, "FULL_TIME");
  assert.ok(snapshot.shotsA + snapshot.shotsB > 0, "full time cannot retain zero shots during a held pass flight");
  assert.equal(latestShot?.resolutionReason, "NO_SHOT_FINAL_WHISTLE");
});

test("V49 simple model full-time fallback creates a shot if the final carrier is a keeper", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v49-full-time-keeper-fallback-shot-floor");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 2, startTick: 0 };
  model.msm.clock.half = 2;
  model.msm.clock.elapsedInHalf = model.msm.clock.halfDuration - (1 / 120);
  model.teamA.shots = 0;
  model.teamB.shots = 0;
  model.teamA.shotsOnTarget = 0;
  model.teamB.shotsOnTarget = 0;

  const keeper = model.getPlayers().find((player) => player.team === "A" && player.role === "GK");
  assert.ok(keeper);
  model.possession = keeper;
  model.ball.pos = { x: keeper.pos.x, y: 0.18, z: keeper.pos.z };

  model.step(1 / 60);

  const snapshot = model.getMatchSnapshot();
  const latestShot = model.getTuningBundle().shotDecisions.at(-1);

  assert.equal(snapshot.phase, "FULL_TIME");
  assert.ok(snapshot.shotsA + snapshot.shotsB > 0, "full-time keeper possession cannot leave zero shots");
  assert.equal(latestShot?.resolutionReason, "NO_SHOT_FULL_TIME_FALLBACK");
  assert.notEqual(latestShot?.role, "GK");
});

test("V50 simple model creates normal visible distance shots before walking into the goalmouth", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v50-distance-shot-window");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(attacker);
  attacker.pos.x = RIGHT_GOAL_X - ((27 / 120) * FIELD_W);
  attacker.pos.z = 0.2;
  attacker.vel = { x: 0, z: 0 };
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };

  model.possession = attacker;
  model.ball.pos = { x: attacker.pos.x, y: 0.18, z: attacker.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 0;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0,
    range: (min: number) => min,
  };

  model.step(1 / 30);

  const snapshot = model.getMatchSnapshot();
  const bundle = model.getTuningBundle();
  const latestShot = bundle.shotDecisions.at(-1);
  const latestOpportunity = bundle.shotOpportunities.at(-1);

  assert.equal(snapshot.shotsA, 1);
  assert.equal(latestShot?.resolutionReason, "DISTANCE_SHOT_WINDOW");
  assert.equal(latestShot?.shotSelectionType, "distance_shot");
  assert.equal(latestOpportunity?.outcome, "distance_shot");
  assert.ok(Number(latestShot?.distToGoalYards) >= 20);
});

test("V77 simple model heavily prefers shots for penalty-area carriers", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v77-penalty-area-shot-preference");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(attacker);
  attacker.pos.x = RIGHT_GOAL_X - 7.0;
  attacker.pos.z = GOAL_MOUTH_HALF_Z * 1.8;
  attacker.vel = { x: 0, z: 0 };
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };

  for (const player of model.getPlayers()) {
    if (player.id === attacker.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 10 : LEFT_GOAL_X + 16;
    player.pos.z = player.role === "GK" ? 0 : FIELD_D * 0.35;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = attacker;
  model.ball.pos = { x: attacker.pos.x, y: 0.18, z: attacker.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 0;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.7,
    range: (min: number) => min,
  };

  model.step(1 / 30);

  const snapshot = model.getMatchSnapshot();
  const bundle = model.getTuningBundle();
  const latestShot = bundle.shotDecisions.at(-1);
  const latestOpportunity = bundle.shotOpportunities.at(-1);

  assert.equal(snapshot.shotsA, 1);
  assert.equal(latestShot?.resolutionReason, "PENALTY_AREA_SHOT");
  assert.equal(latestShot?.shotSelectionType, "penalty_area_shot");
  assert.equal(latestOpportunity?.outcome, "penalty_area_shot");
  assert.ok(Number(latestOpportunity?.shootChance) >= 0.85);
});

test("V86 simple model suppresses unrealistic long-range shots", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v86-long-shot-suppression");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  assert.ok(carrier);
  carrier.pos.x = LEFT_GOAL_X + ((55 / 120) * FIELD_W);
  carrier.pos.z = 0;
  carrier.vel = { x: 0, z: 0 };
  carrier.targetPos = { x: carrier.pos.x, z: carrier.pos.z };

  for (const player of model.getPlayers()) {
    if (player.id === carrier.id) continue;
    player.pos.x = player.team === "A" ? carrier.pos.x + 5 : RIGHT_GOAL_X - 14;
    player.pos.z = player.team === "A" ? player.shirtNumber * 0.8 : player.shirtNumber * 0.3;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = carrier;
  model.ball.pos = { x: carrier.pos.x, y: 0.18, z: carrier.pos.z };
  const beforeShots = model.getMatchSnapshot().shotsA + model.getMatchSnapshot().shotsB;

  (model as unknown as {
    resolveShot: (player: NonNullable<typeof carrier>, distToGoal: number, pressure: number, context?: { reason: string }) => unknown;
  }).resolveShot(carrier, dist2(carrier.pos, { x: RIGHT_GOAL_X, z: 0 }), 0, { reason: "V86_FORCED_LONG_ATTEMPT" });

  const afterShots = model.getMatchSnapshot().shotsA + model.getMatchSnapshot().shotsB;
  const latestOpportunity = model.getTuningBundle().shotOpportunities.at(-1);

  assert.equal(afterShots, beforeShots, "suppressed long-range attempts must not count as shots");
  assert.equal(latestOpportunity?.outcome, "range_recycled");
  assert.equal(latestOpportunity?.reason, "LONG_SHOT_SUPPRESSED");
});

test("V87 halftime kickoff setup cannot stall on current player positions", () => {
  for (const seed of ["shot-distance-v86-5-confirm:0", "player-speed-v88-5g:0"]) {
    const model = new SimpleMatchModel();
    model.setTeamNames("Inter Miami", "LA Galaxy");
    model.setTeamFormations("4-4-2", "4-2-3-1");
    model.setSeed(seed);
    model.setHalfDurationSeconds(45 * 60);
    model.setRestartDelays(0, 0);
    model.startMatch();

    for (let i = 0; i < 12_000; i++) {
      model.step(0.25);
      const snapshot = model.getMatchSnapshot();
      if (snapshot.half === 2 && snapshot.phase === "KICKOFF") break;
    }

    const halftimeKickoff = model.getMatchSnapshot();
    assert.equal(halftimeKickoff.half, 2, seed);
    assert.equal(halftimeKickoff.phase, "KICKOFF", seed);

    for (let i = 0; i < 720 && model.getMatchSnapshot().phase === "KICKOFF"; i++) {
      model.step(0.25);
    }

    const snapshot = model.getMatchSnapshot();
    assert.notEqual(snapshot.phase, "KICKOFF", `${seed} halftime kickoff stalled at ${snapshot.elapsedInHalf.toFixed(1)}s`);
  }
});

test("V51 keeper smothers before a shot are not reported as save ball flights", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v51-smother-flight-kind");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const keeper = model.getPlayers().find((player) => player.team === "B" && player.role === "GK");
  assert.ok(attacker);
  assert.ok(keeper);

  attacker.pos.x = RIGHT_GOAL_X - 2.0;
  attacker.pos.z = GOAL_MOUTH_HALF_Z * 1.8;
  attacker.vel = { x: 0, z: 0 };
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };

  keeper.pos.x = RIGHT_GOAL_X - 1.8;
  keeper.pos.z = attacker.pos.z;
  keeper.vel = { x: 0, z: 0 };
  keeper.targetPos = { x: keeper.pos.x, z: keeper.pos.z };

  for (const player of model.getPlayers()) {
    if (player.id === attacker.id || player.id === keeper.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 12 : LEFT_GOAL_X + 18;
    player.pos.z = player.role === "GK" ? 0 : FIELD_D * 0.35;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = attacker;
  model.ball.pos = { x: attacker.pos.x, y: 0.18, z: attacker.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 0;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0,
    range: (min: number) => min,
  };

  model.step(1 / 30);

  const snapshot = model.getMatchSnapshot();
  const bundle = model.getTuningBundle();
  const latestOpportunity = bundle.shotOpportunities.at(-1);
  const latestFlight = bundle.ballFlightTelemetry.at(-1);

  assert.equal(snapshot.shotsA + snapshot.shotsB, 0);
  assert.ok(latestOpportunity?.outcome === "keeper_recovery" || latestOpportunity?.outcome === "smother");
  assert.equal(latestFlight?.kind, "interception");
  assert.equal(bundle.ballFlightTelemetry.filter((flight) => flight.kind === "save").length, 0);
});

test("V68 keeper saves expose dive direction telemetry for renderer animation", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v68-keeper-dive-save");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const keeper = model.getPlayers().find((player) => player.team === "B" && player.role === "GK");
  assert.ok(attacker);
  assert.ok(keeper);

  attacker.pos.x = RIGHT_GOAL_X - 14;
  attacker.pos.z = 3.2;
  attacker.vel = { x: 0, z: 0 };
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };
  keeper.pos.x = RIGHT_GOAL_X - 1.8;
  keeper.pos.z = 0;
  keeper.vel = { x: 0, z: 0 };
  keeper.targetPos = { x: keeper.pos.x, z: keeper.pos.z };

  model.possession = attacker;
  model.ball.pos = { x: attacker.pos.x, y: 0.18, z: attacker.pos.z };
  const distToGoal = dist2(attacker.pos, { x: RIGHT_GOAL_X, z: 0 });

  (model as unknown as {
    resolveShot: (
      carrier: typeof attacker,
      distToGoal: number,
      pressure: number,
      context: { forceOnTarget: boolean; forceSave: boolean; reason: string },
    ) => null;
  }).resolveShot(attacker, distToGoal, 0, {
    forceOnTarget: true,
    forceSave: true,
    reason: "V68_KEEPER_DIVE_SAVE",
  });

  const bundle = model.getTuningBundle();
  const saveEvent = model.eventLog.filter((event) => event.action === "SAVE").at(-1);
  const telemetrySave = bundle.events.filter((event) => event.type === "SAVE").at(-1);
  const saveFlight = bundle.ballFlightTelemetry.filter((flight) => flight.kind === "save").at(-1);
  const diveDirection = saveEvent?.meta?.diveDirection;

  assert.ok(["left", "right", "up", "down"].includes(String(diveDirection)));
  assert.equal(telemetrySave?.detail.diveDirection, diveDirection);
  assert.deepEqual(telemetrySave?.detail.shotTarget, saveEvent?.meta?.shotTarget);
  assert.equal(saveFlight?.followPlayerName, keeper.name);
});

test("V44 simple model prevents early open-net scoring bursts", () => {
  const model = new SimpleMatchModel();
  model.setSeed("burst:Charlotte FC:Sporting Kansas City");
  model.setTeamNames("Charlotte FC", "Sporting Kansas City");
  model.setTeamFormations("4-3-3", "4-4-2");
  model.setHalfDurationSeconds(45 * 60);
  model.setSeriesSpeedMul(1);
  model.startMatch();

  for (let i = 0; i < 180 * 60 && model.getMatchSnapshot().phase !== "FULL_TIME"; i++) {
    model.step(1 / 60);
  }

  const snapshot = model.getMatchSnapshot();
  const bundle = model.getTuningBundle();
  const goals = snapshot.scoreA + snapshot.scoreB;
  const openNetFinishes = bundle.shotOpportunities.filter((row) => row.outcome === "open_net_finish").length;

  assert.ok(goals <= 3, `expected <=3 goals in first 180s, got ${snapshot.scoreA}-${snapshot.scoreB}`);
  assert.ok(openNetFinishes <= 2, `expected <=2 early open-net finishes, got ${openNetFinishes}`);
});

test("woodwork shots emit donk-ready live telemetry without counting as goals", () => {
  const model = new SimpleMatchModel();
  model.setSeed("woodwork-donk");
  model.setHalfDurationSeconds(30);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(attacker);
  attacker.pos.x = RIGHT_GOAL_X - 14;
  attacker.pos.z = 0.4;
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };
  attacker.vel = { x: 0, z: 0 };
  model.possession = attacker;
  model.ball.pos = { x: attacker.pos.x, y: 0.18, z: attacker.pos.z };
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.99,
    range: (min, max) => (min + max) / 2,
  };

  (model as unknown as {
    resolveShot: (
      carrier: typeof attacker,
      distToGoal: number,
      pressure: number,
      context: { forceWoodwork: boolean; forceWoodworkPart: "crossbar"; reason: string },
    ) => unknown;
  }).resolveShot(attacker, dist2(attacker.pos, { x: RIGHT_GOAL_X, z: 0 }), 0, {
    forceWoodwork: true,
    forceWoodworkPart: "crossbar",
    reason: "FORCED_WOODWORK_TEST",
  });

  const snapshot = model.getMatchSnapshot();
  const bundle = model.getTuningBundle();
  const woodworkEvent = model.eventLog.find((event) => event.action === "WOODWORK");
  const woodworkTelemetry = bundle.events.find((event) => event.type === "WOODWORK");
  const missFlight = bundle.ballFlightTelemetry.at(-1);

  assert.equal(snapshot.scoreA + snapshot.scoreB, 0);
  assert.equal(snapshot.shotsA, 1);
  assert.equal(snapshot.shotsOnTargetA, 0);
  assert.ok(woodworkEvent);
  assert.equal(woodworkEvent?.meta?.framePart, "crossbar");
  assert.equal(woodworkTelemetry?.detail.resolutionReason, "FORCED_WOODWORK_TEST");
  assert.equal(missFlight?.kind, "miss");
  assert.ok(Math.abs(Number(missFlight?.to.z)) > GOAL_MOUTH_HALF_Z, "woodwork miss target must not cross inside the goal mouth");
});

test("V90 aerial corner delivery can resolve as a counted header shot", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v90-header-shot");
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.half = 1;

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(attacker);
  attacker.pos.x = RIGHT_GOAL_X - 8;
  attacker.pos.z = 0;
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };
  for (const defender of model.getPlayers().filter((player) => player.team === "B" && player.role !== "GK")) {
    defender.pos.x = LEFT_GOAL_X + 12;
    defender.pos.z = 12;
    defender.targetPos = { x: defender.pos.x, z: defender.pos.z };
  }
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0,
    range: (min, max) => (min + max) / 2,
  };

  (model as unknown as {
    startBallFlight: (
      kind: string,
      from: { x: number; z: number },
      to: { x: number; z: number },
      duration: number,
      arc: number,
      followPlayer?: typeof attacker,
      options?: Record<string, unknown>,
    ) => number;
    updateBallFlight: (dt: number) => void;
  }).startBallFlight("restart", { x: RIGHT_GOAL_X - 0.1, z: FIELD_D / 2 }, attacker.pos, 0.8, 0.7, attacker, {
    aerial: true,
    headerEligible: true,
    sourceAction: "corner",
    attackingTeam: "A",
    receiverId: attacker.id,
  });
  for (let i = 0; i < 120; i++) {
    (model as unknown as { updateBallFlight: (dt: number) => void }).updateBallFlight(1 / 60);
  }

  const snapshot = model.getMatchSnapshot();
  const bundle = model.getTuningBundle();
  assert.equal(snapshot.headersA, 1);
  assert.equal(bundle.teamA.headerShots, 1);
  assert.equal(bundle.headerLog.at(-1)?.type, "shot");
  assert.equal(bundle.shotDecisions.at(-1)?.style, "HEADER");
  assert.equal(bundle.shotDecisions.at(-1)?.resolutionReason, "HEADER_SHOT");
  assert.ok(model.eventLog.some((event) => event.action === "HEADER_SHOT"));
});

test("V90 aerial defensive arrival can resolve as a counted header clearance", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v90-header-clearance");
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.half = 1;

  const defender = model.getPlayers().find((player) => player.team === "A" && player.role === "CB");
  assert.ok(defender);
  defender.pos.x = LEFT_GOAL_X + 8;
  defender.pos.z = 0;
  defender.targetPos = { x: defender.pos.x, z: defender.pos.z };
  for (const attacker of model.getPlayers().filter((player) => player.team === "B" && player.role !== "GK")) {
    attacker.pos.x = RIGHT_GOAL_X - 12;
    attacker.pos.z = 12;
    attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };
  }
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0,
    range: (min, max) => (min + max) / 2,
  };

  (model as unknown as {
    startBallFlight: (
      kind: string,
      from: { x: number; z: number },
      to: { x: number; z: number },
      duration: number,
      arc: number,
      followPlayer?: unknown,
      options?: Record<string, unknown>,
    ) => number;
    updateBallFlight: (dt: number) => void;
  }).startBallFlight("restart", { x: LEFT_GOAL_X + 20, z: FIELD_D / 2 }, defender.pos, 0.8, 0.7, undefined, {
    aerial: true,
    headerEligible: true,
    sourceAction: "corner",
    attackingTeam: "B",
  });
  for (let i = 0; i < 120; i++) {
    (model as unknown as { updateBallFlight: (dt: number) => void }).updateBallFlight(1 / 60);
  }

  const snapshot = model.getMatchSnapshot();
  const bundle = model.getTuningBundle();
  assert.equal(snapshot.headersA, 1);
  assert.equal(snapshot.clearancesA, 1);
  assert.equal(bundle.teamA.headerClearances, 1);
  assert.equal(bundle.headerLog.at(-1)?.type, "clearance");
  assert.ok(model.eventLog.some((event) => event.action === "HEADER_CLEARANCE"));
});

test("V90 ground passes do not create header telemetry", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v90-ground-pass-no-header");
  model.startMatch();
  const receiver = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  assert.ok(receiver);

  (model as unknown as {
    startBallFlight: (
      kind: string,
      from: { x: number; z: number },
      to: { x: number; z: number },
      duration: number,
      arc: number,
      followPlayer?: typeof receiver,
    ) => number;
    updateBallFlight: (dt: number) => void;
  }).startBallFlight("pass", { x: receiver.pos.x - 4, z: receiver.pos.z }, receiver.pos, 0.7, 0.04, receiver);
  for (let i = 0; i < 90; i++) {
    (model as unknown as { updateBallFlight: (dt: number) => void }).updateBallFlight(1 / 60);
  }

  const snapshot = model.getMatchSnapshot();
  assert.equal(snapshot.headersA + snapshot.headersB, 0);
  assert.equal(model.getTuningBundle().headerLog.length, 0);
});
