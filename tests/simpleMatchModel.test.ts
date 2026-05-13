import assert from "node:assert/strict";
import test from "node:test";
import { BASE_RUN_SPEED, CENTER_CIRCLE_RADIUS, dist2, FIELD_D, FIELD_SCALE_PER_YARD, FIELD_W, GOAL_MOUTH_HALF_Z, LEFT_GOAL_X, RIGHT_GOAL_X, UNITS_PER_YARD } from "../src/core/constants";
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

  const corner = run("B");
  const cornerState = corner.msm.state as { kind: string; restartType?: string; restartTeam?: string };
  assert.equal(cornerState.kind, "ball_out");
  assert.equal(cornerState.restartType, "corner");
  assert.equal(cornerState.restartTeam, "home");
  assert.equal(corner.getMatchSnapshot().cornersA, 1);
  const setupEvent = corner.eventLog.filter((event) => event.action === "CORNER" && event.meta?.phase === "setup").at(-1);
  assert.equal(setupEvent?.meta?.restartType, "corner");
  assert.ok(typeof setupEvent?.meta?.takerId === "string", "corner setup must identify the taker for renderer presentation");

  for (let i = 0; i < 180 && (corner.msm.state as { kind: string }).kind === "ball_out"; i++) {
    corner.step(1 / 60);
    corner.updateVisuals(1 / 60);
  }
  const releaseEvent = corner.eventLog.filter((event) => event.action === "CORNER" && event.meta?.phase === "release").at(-1);
  const cornerFlight = corner.getTuningBundle().ballFlightTelemetry.filter((flight) => flight.kind === "restart").at(-1);
  assert.equal(corner.msm.state.kind, "live_play");
  assert.equal(releaseEvent?.meta?.arcHeight, 0.7);
  assert.ok(Number(cornerFlight?.arc) >= 0.65, "corner restart flight must be visibly lofted");
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

    for (let i = 0; i < 90 * 60 && model.getMatchSnapshot().elapsedInHalf < 60; i++) {
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

  assert.ok(Math.abs(shortHalf.elapsed - 60) <= 1 / 60 + 0.001);
  assert.ok(Math.abs(fullHalf.elapsed - 60) <= 1 / 60 + 0.001);
  assert.ok(shortHalf.topInstantSpeed <= BASE_RUN_SPEED * 1.02, `short-half player speed was accelerated to ${shortHalf.topInstantSpeed.toFixed(2)}`);
  assert.ok(fullHalf.topInstantSpeed <= BASE_RUN_SPEED * 1.02, `full-half player speed was accelerated to ${fullHalf.topInstantSpeed.toFixed(2)}`);
  assert.ok(shortHalf.actions > fullHalf.actions * 3, `expected compressed-runtime action production, got ${shortHalf.actions} vs ${fullHalf.actions}`);
});

test("V53 simple model 5-minute halves produce aggregate full-match action volume", () => {
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
  assert.ok(avg("passes") >= 450, `expected aggregate full-match pass volume, got ${avg("passes").toFixed(1)}`);
  assert.ok(avg("shots") >= 20, `expected aggregate full-match shot volume, got ${avg("shots").toFixed(1)}`);
  assert.ok(avg("sot") >= 7, `expected aggregate full-match SOT volume, got ${avg("sot").toFixed(1)}`);
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
  const passesBefore = model.getMatchSnapshot().passesA;
  const flightsBefore = model.getTuningBundle().ballFlightTelemetry.length;

  (model as any).resolvePass(carrier, 0);

  const snapshot = model.getMatchSnapshot();
  const bundle = model.getTuningBundle();
  assert.equal(snapshot.offsidesA, 1);
  assert.equal(snapshot.passesA, passesBefore);
  assert.equal(model.possession?.team, "B");
  assert.equal(bundle.events.some((event: any) => event.type === "OFFSIDE" && event.team === "A"), true);
  assert.equal(bundle.ballFlightTelemetry.length, flightsBefore);
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

test("simple model pass flight follows the moving receiver", () => {
  const model = new SimpleMatchModel();
  model.setSeed("moving-receiver-flight");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  let sawTrackedPass = false;
  for (let i = 0; i < 5000 && model.getMatchSnapshot().phase !== "FULL_TIME"; i++) {
    model.step(1 / 30);
    model.updateVisuals(1 / 30);
    const latest = model.getTuningBundle().ballFlightTelemetry.at(-1);
    if (!latest || latest.kind !== "pass" || !latest.followPlayerId) continue;

    const receiver = model.getPlayers().find((player) => player.id === latest.followPlayerId);
    if (!receiver) continue;

    const frames = Math.ceil(latest.durationSeconds * 30) + 4;
    for (let j = 0; j < frames; j++) {
      receiver.pos.x += 0.08;
      receiver.pos.z += 0.03;
      model.step(1 / 30);
      model.updateVisuals(1 / 30);
    }

    const gap = Math.hypot(model.ball.pos.x - receiver.pos.x, model.ball.pos.z - receiver.pos.z);
    assert.ok(gap < 1.6, `expected ball to arrive near moving receiver, gap ${gap.toFixed(2)}`);
    sawTrackedPass = true;
    break;
  }

  assert.equal(sawTrackedPass, true);
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

test("simple model normal-speed player movement stays within measured sprint bounds", () => {
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

  for (let i = 0; i < 600; i++) {
    model.step(1 / 60);
  }

  const end = model.getMatchSnapshot();
  const metersPerUnit = 0.9144 / UNITS_PER_YARD;
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

  assert.ok(Math.abs(end.elapsedInHalf - start.elapsedInHalf - 10) < 0.001);
  assert.ok(topAverageMps <= 5.1, `top 10s average speed ${topAverageMps.toFixed(2)} m/s`);
  assert.ok(topInstantMps <= 7.8, `top instant speed ${topInstantMps.toFixed(2)} m/s`);
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
