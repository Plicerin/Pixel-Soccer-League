import assert from "node:assert/strict";
import test from "node:test";
import { BASE_RUN_SPEED, CENTER_CIRCLE_RADIUS, dist2, FIELD_D, FIELD_SCALE_PER_YARD, FIELD_W, GOAL_BOX_DEPTH, GOAL_BOX_HALF_Z, GOAL_FLOOR_DEPTH, GOAL_MOUTH_HALF_Z, isInPenaltyArea, LEFT_GOAL_X, PENALTY_HALF_Z, PLAYER_RADIUS, RIGHT_GOAL_X, RIGHT_PENALTY_X } from "../src/core/constants";
import { detectBallOut } from "../src/core/matchStateMachine";
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
  assert.ok(Array.isArray(bundle.playerPositioning));
  assert.equal(typeof bundle.fullLengthPossessionDiagnostics?.noSafeOutletPassFails, "number");
  assert.equal(typeof bundle.fullLengthPossessionDiagnostics?.speculativeInterceptionDistanceBands?.lt14, "number");
  assert.equal(typeof bundle.fullLengthPossessionDiagnostics?.speculativeInterceptionSeparationBands?.lt2_5, "number");
  assert.ok(Array.isArray(bundle.fullLengthPossessionDiagnostics?.samples));
  assert.equal(bundle.tuning.model, "simple-v1");
  const shapeRow = bundle.shapeA[0] as Record<string, unknown> | undefined;
  const positionRow = bundle.playerPositioning[0] as Record<string, unknown> | undefined;
  const passRow = bundle.passLog[0] as Record<string, unknown> | undefined;
  const carrierTrace = bundle.events.find((event) => event.type === "CARRIER_TRACE") as { detail?: Record<string, unknown> } | undefined;
  const zoneTrace = bundle.events.find((event) => event.type === "ATTACKER_ZONE_TRACE") as { detail?: Record<string, unknown> } | undefined;
  assert.ok(shapeRow && Number(shapeRow.width) > 0, "shape snapshots must preserve nonzero team width");
  assert.ok(positionRow && typeof positionRow.owner === "string", "player positioning rows must preserve owner labels");
  assert.ok(positionRow && Number(positionRow.targetAbsZ) >= 0, "player positioning rows must preserve target width data");
  assert.ok(passRow && Number((passRow.detail as Record<string, unknown>)?.x) === Number((passRow.detail as Record<string, unknown>)?.x), "pass rows must preserve carrier coordinates");
  assert.ok(carrierTrace && Number(carrierTrace.detail?.x) === Number(carrierTrace.detail?.x), "carrier traces must preserve x coordinates for trajectory analysis");
  assert.ok(carrierTrace && Number(carrierTrace.detail?.segmentId) >= 1, "carrier traces must preserve segment ids for possession trajectory grouping");
  assert.ok(zoneTrace && typeof zoneTrace.detail?.dangerMarkingZone === "boolean", "attacker zone traces must preserve marking-zone telemetry");
});

test("V206 simple model keeps one stable session id per match and stamps runtime provenance", () => {
  const model = new SimpleMatchModel();
  model.setRuntimeProvenance({ engineRuntimeToken: "runtime-123", engineBootedAt: 456 });
  const before = model.getMatchSnapshot();
  const beforeBundle = model.getTuningBundle();

  for (let i = 0; i < 120; i++) model.step(1 / 60);

  const during = model.getMatchSnapshot();
  const duringBundle = model.getTuningBundle();

  assert.equal(before.sessionId, during.sessionId);
  assert.equal(beforeBundle.metadata.sessionId, duringBundle.metadata.sessionId);
  assert.equal(during.engineRuntimeToken, "runtime-123");
  assert.equal(duringBundle.metadata.engineRuntimeToken, "runtime-123");

  model.resetMatch();

  const afterReset = model.getMatchSnapshot();
  const afterResetBundle = model.getTuningBundle();
  assert.notEqual(afterReset.sessionId, during.sessionId);
  assert.equal(afterResetBundle.metadata.sessionId, afterReset.sessionId);
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

test("V185 kickoff central band keeps adjacent support players spaced apart", () => {
  const model = new SimpleMatchModel();
  model.setTeamFormations("4-4-2", "4-4-2");
  model.startMatch();

  for (const team of ["A", "B"] as const) {
    const attackSign = team === "A" ? 1 : -1;
    const centralBand = model.getPlayers()
      .filter((player) =>
        player.team === team
        && player.id !== model.possession?.id
        && player.role !== "GK"
        && player.pos.x * attackSign >= -(CENTER_CIRCLE_RADIUS + 1.5)
        && Math.abs(player.pos.z) <= CENTER_CIRCLE_RADIUS + 3.5);
    for (let i = 0; i < centralBand.length; i++) {
      for (let j = i + 1; j < centralBand.length; j++) {
        const gap = dist2(centralBand[i].pos, centralBand[j].pos);
        assert.ok(gap >= 2.4, `${team} kickoff support players are too bunched: ${centralBand[i].name} vs ${centralBand[j].name} gap=${gap.toFixed(2)}`);
      }
    }
  }
});

test("V185 kickoff setup does not overlap same-team outfield players", () => {
  const model = new SimpleMatchModel();
  model.setTeamFormations("4-4-2", "4-4-2");
  model.startMatch();

  for (const team of ["A", "B"] as const) {
    const teamPlayers = model.getPlayers().filter((player) => player.team === team && player.role !== "GK" && player.id !== model.possession?.id);
    for (let i = 0; i < teamPlayers.length; i++) {
      for (let j = i + 1; j < teamPlayers.length; j++) {
        const gap = dist2(teamPlayers[i].pos, teamPlayers[j].pos);
        assert.ok(gap >= 2.2, `${team} kickoff players overlap visually: ${teamPlayers[i].name} vs ${teamPlayers[j].name} gap=${gap.toFixed(2)}`);
      }
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
  const kickoffAnchorFor = (player: ReturnType<typeof model.getPlayers>[number]) =>
    (model as unknown as {
      kickoffLegalPosition: (homePos: { x: number; z: number }, p: typeof player, isKicker: boolean) => { x: number; z: number };
    }).kickoffLegalPosition(player.homePos, player, false);
  const stagedLanePlayers = new Set(
    model.getPlayers()
      .filter((player) => {
        if (player.role === "GK" || player.id === model.possession?.id) return false;
        const kickoffAnchor = kickoffAnchorFor(player);
        return Math.abs(player.pos.z - kickoffAnchor.z) <= 1.2;
      })
      .map((player) => player.id),
  );
  for (let i = 0; i < 90; i++) {
    model.step(1 / 60);
    model.updateVisuals(1 / 60);
    for (const player of model.getPlayers()) {
      const attackSign = player.team === "A" ? 1 : -1;
      assert.ok(
        player.pos.x * attackSign <= 0.05,
        `${player.name} crossed midfield too early after kickoff at ${(i / 60).toFixed(2)}s`,
      );
      if (i < 20 && stagedLanePlayers.has(player.id)) {
        const kickoffAnchor = kickoffAnchorFor(player);
        assert.ok(
          Math.abs(player.targetPos.z - kickoffAnchor.z) <= 1.5,
          `${player.name} snapped off the kickoff lane too early at ${(i / 60).toFixed(2)}s: target z=${player.targetPos.z.toFixed(2)} anchor z=${kickoffAnchor.z.toFixed(2)}`,
        );
      }
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

test("V186 compressed matches keep visible post-reception hold time", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v186-visible-reception-hold");
  model.setHalfDurationSeconds(5 * 60);
  const hold = (model as unknown as { visibleReceptionHoldSeconds: () => number }).visibleReceptionHoldSeconds();
  assert.ok(hold >= 1.10 && hold <= 1.50, `compressed runtime hold collapsed to ${hold.toFixed(2)}s`);
});

test("V187 throw-in taker stages outside the touchline", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v187-throw-in-outside");
  const restart = {
    restartType: "throw_in",
    restartTeam: "A",
    spot: { x: 4, z: FIELD_D / 2 - 0.05 },
    takerId: "A-1",
  };
  model.startMatch();
  model.msm.state = { kind: "ball_out", restartType: "throw_in", restartTeam: "home" };
  (model as unknown as { restartContext: unknown }).restartContext = restart;
  (model as unknown as { moveRestartPlayers: (dt: number) => void }).moveRestartPlayers(1 / 60);
  const taker = model.getPlayers().find((player) => player.id === "A-1");
  assert.ok(taker, "throw-in taker must exist");
  assert.ok(Math.abs(taker.pos.z) > FIELD_D / 2, `throw-in taker stayed in bounds at z=${taker!.pos.z.toFixed(2)}`);
  const target = (model as unknown as { restartTakerTarget: (ctx: typeof restart) => { x: number; z: number } }).restartTakerTarget(restart);
  assert.ok(Math.abs(target.z) > FIELD_D / 2, `throw-in taker target stayed in bounds at z=${target.z.toFixed(2)}`);
});

test("V239 restart setup/release expose taker spot for corner and throw-in presentations", () => {
  const throwModel = new SimpleMatchModel();
  throwModel.setSeed("v239-throw-taker-spot");
  throwModel.startMatch();
  throwModel.msm.state = { kind: "ball_out", restartType: "throw_in", restartTeam: "home" };
  const throwRestart = {
    restartType: "throw_in" as const,
    restartTeam: "A" as const,
    spot: { x: 4, z: FIELD_D / 2 - 0.05 },
    takerId: "A-1",
    lastTouchTeam: "B" as const,
    lastTouchPlayerId: null,
    crossedLine: "top_touchline" as const,
  };
  (throwModel as unknown as { installBallOutRestart: (context: typeof throwRestart) => void }).installBallOutRestart(throwRestart);
  const throwSetup = throwModel.eventLog.filter((event) => event.action === "THROW_IN" && event.meta?.phase === "setup").at(-1);
  const throwTarget = (throwModel as unknown as { restartTakerTarget: (ctx: typeof throwRestart) => { x: number; z: number } }).restartTakerTarget(throwRestart);
  assert.deepEqual(throwSetup?.meta?.takerSpot, throwTarget, "throw-in setup must expose the model taker spot");
  for (let i = 0; i < 240 && (throwModel.msm.state as { kind: string }).kind === "ball_out"; i++) throwModel.step(1 / 60);
  const throwRelease = throwModel.eventLog.filter((event) => event.action === "THROW_IN" && event.meta?.phase === "release").at(-1);
  assert.deepEqual(throwRelease?.meta?.takerSpot, throwTarget, "throw-in release must keep the same taker spot");

  const cornerModel = new SimpleMatchModel();
  cornerModel.setSeed("v239-corner-taker-spot");
  cornerModel.startMatch();
  cornerModel.msm.state = { kind: "ball_out", restartType: "corner", restartTeam: "home" };
  const cornerRestart = {
    restartType: "corner" as const,
    restartTeam: "A" as const,
    spot: { x: RIGHT_GOAL_X + 1, z: FIELD_D / 2 + 1 },
    takerId: "A-1",
    lastTouchTeam: "B" as const,
    lastTouchPlayerId: null,
    crossedLine: "right_goal_line" as const,
  };
  (cornerModel as unknown as { installBallOutRestart: (context: typeof cornerRestart) => void }).installBallOutRestart(cornerRestart);
  const cornerSetup = cornerModel.eventLog.filter((event) => event.action === "CORNER" && event.meta?.phase === "setup").at(-1);
  const cornerTarget = (cornerModel as unknown as { restartTakerTarget: (ctx: typeof cornerRestart) => { x: number; z: number } }).restartTakerTarget(cornerRestart);
  assert.deepEqual(cornerSetup?.meta?.takerSpot, cornerTarget, "corner setup must expose the model taker spot");
  assert.ok(Math.abs(Number((cornerSetup?.meta?.takerSpot as { z?: number } | undefined)?.z)) > FIELD_D / 2, "corner taker spot must stay outside the touchline");
  for (let i = 0; i < 900 && (cornerModel.msm.state as { kind: string }).kind === "ball_out"; i++) cornerModel.step(1 / 60);
  const cornerRelease = cornerModel.eventLog.filter((event) => event.action === "CORNER" && event.meta?.phase === "release").at(-1);
  assert.deepEqual(cornerRelease?.meta?.takerSpot, cornerTarget, "corner release must keep the same taker spot");
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
  assert.ok(["goal_kick", "goal_kick_long"].includes((goalKick as any).lastKeeperKickTelemetry?.style), "goal-kick telemetry must identify the keeper distribution style");

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

  for (let i = 0; i < 900 && (corner.msm.state as { kind: string }).kind === "ball_out"; i++) {
    corner.step(1 / 60);
    corner.updateVisuals(1 / 60);
  }
  const releaseEvent = corner.eventLog.filter((event) => event.action === "CORNER" && event.meta?.phase === "release").at(-1);
  const cornerFlight = corner.getTuningBundle().ballFlightTelemetry.filter((flight) => flight.kind === "restart").at(-1);
  assert.equal(corner.msm.state.kind, "live_play");
  assert.equal(releaseEvent?.meta?.takerId, setupEvent?.meta?.takerId, "corner release must retain the setup taker so the renderer can animate the player, not just the ball");
  assert.equal(releaseEvent?.meta?.presentationKind, "corner_kick");
  assert.ok(Number(releaseEvent?.meta?.presentationSeconds) >= 1.2, "corner release presentation must keep the taker visible through the kick");
  assert.ok(["DRIVEN", "MEDIUM_ARC", "LOOPED"].includes(String(releaseEvent?.meta?.cornerDeliveryStyle)), "corner release must identify a visible delivery style");
  assert.ok(Number(releaseEvent?.meta?.arcHeight) >= 0.84, "corner releases must still use an elevated arc");
  assert.ok(Number(cornerFlight?.arc) >= 0.84, "corner restart flight must remain visibly lofted above ground-level play");
});

test("V150 corner restarts stage realistic box and cover formations before release", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v150-corner-formation");
  model.startMatch();
  model.msm.state = { kind: "ball_out", restartType: "corner", restartTeam: "home" };
  model.msm.restartTimer = 1.5;
  model.msm.clock.elapsedInHalf = 18;

  for (const player of model.getPlayers()) {
    player.pos = {
      x: player.team === "A" ? LEFT_GOAL_X + 6 + player.shirtNumber * 0.35 : -3 + player.shirtNumber * 0.22,
      y: 0,
      z: player.team === "A" ? -FIELD_D * 0.32 + player.shirtNumber * 0.4 : FIELD_D * 0.26 - player.shirtNumber * 0.35,
    };
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }
  model.ball.pos = { x: RIGHT_GOAL_X + 1, y: 0.18, z: FIELD_D / 2 + 1 };

  (model as unknown as {
    installBallOutRestart: (context: {
      restartType: "corner";
      restartTeam: "A";
      spot: { x: number; z: number };
      lastTouchTeam: "B";
      lastTouchPlayerId: string | null;
      crossedLine: "right_goal_line";
    }) => void;
  }).installBallOutRestart({
    restartType: "corner",
    restartTeam: "A",
    spot: { x: RIGHT_GOAL_X + 1, z: FIELD_D / 2 + 1 },
    lastTouchTeam: "B",
    lastTouchPlayerId: null,
    crossedLine: "right_goal_line",
  });

  const setup = model.eventLog.filter((event) => event.action === "CORNER" && event.meta?.phase === "setup").at(-1);
  assert.ok(setup?.meta?.takerId, "corner setup must assign a visible taker");

  for (let i = 0; i < 120; i++) {
    model.step(1 / 60);
    assert.equal((model.msm.state as { kind: string }).kind, "ball_out", "corner must not release before formation has time to stage");
  }

  for (let i = 0; i < 900 && (model.msm.state as { kind: string }).kind === "ball_out"; i++) {
    model.step(1 / 60);
    model.updateVisuals(1 / 60);
  }

  assert.equal(model.msm.state.kind, "live_play");
  const release = model.eventLog.filter((event) => event.action === "CORNER" && event.meta?.phase === "release").at(-1);
  const formation = release?.meta?.cornerFormation as {
    boxAttackers?: number;
    boxDefenders?: number;
    targetBoxAttackers?: number;
    targetBoxDefenders?: number;
    coverAttackers?: number;
    takerAtFlag?: boolean;
  } | undefined;
  assert.ok(formation, "corner release must report formation telemetry");
  assert.ok(Number(formation.boxAttackers) >= 5, `corner should have most attackers in the box, got ${formation?.boxAttackers}`);
  assert.ok(Number(formation.boxDefenders) >= 6, `corner should have most defenders in the box, got ${formation?.boxDefenders}`);
  assert.ok(Number(formation.coverAttackers) >= 1 && Number(formation.coverAttackers) <= 3, "corner should leave only limited attacking cover behind");
  assert.equal(formation.takerAtFlag, true, "corner taker must be staged at the flag before release");
  assert.equal(release?.meta?.takerId, setup?.meta?.takerId, "corner setup and release must keep the same taker");
});

test("V183 corner taker target stays outside the flag quadrant on both sides", () => {
  const model = new SimpleMatchModel();
  const api = model as unknown as {
    cornerTakerTarget: (context: {
      restartType: "corner";
      restartTeam: "A" | "B";
      spot: { x: number; z: number };
      lastTouchTeam: "A" | "B";
      lastTouchPlayerId: string | null;
      crossedLine: "left_goal_line" | "right_goal_line";
    }) => { x: number; z: number };
  };

  const topRight = api.cornerTakerTarget({
    restartType: "corner",
    restartTeam: "A",
    spot: { x: RIGHT_GOAL_X - 0.35, z: FIELD_D / 2 - 0.35 },
    lastTouchTeam: "B",
    lastTouchPlayerId: null,
    crossedLine: "right_goal_line",
  });
  assert.ok(topRight.x > RIGHT_GOAL_X, "right-side corners should stage the taker outside the goal line");
  assert.ok(topRight.z > FIELD_D / 2 - 0.35, "top-side corners should stage the taker outside the touchline");

  const bottomLeft = api.cornerTakerTarget({
    restartType: "corner",
    restartTeam: "B",
    spot: { x: LEFT_GOAL_X + 0.35, z: -FIELD_D / 2 + 0.35 },
    lastTouchTeam: "A",
    lastTouchPlayerId: null,
    crossedLine: "left_goal_line",
  });
  assert.ok(bottomLeft.x < LEFT_GOAL_X, "left-side corners should stage the taker outside the goal line");
  assert.ok(bottomLeft.z < -FIELD_D / 2 + 0.35, "bottom-side corners should stage the taker outside the touchline");
});

test("V142 goal-line OOB classification handles both attack directions", () => {
  const wideZ = GOAL_MOUTH_HALF_Z + 3;
  assert.deepEqual(detectBallOut(RIGHT_GOAL_X + 1, wideZ, "home", 1), { restartType: "goal_kick", restartTeam: "away" });
  assert.deepEqual(detectBallOut(RIGHT_GOAL_X + 1, wideZ, "away", 1), { restartType: "corner", restartTeam: "home" });
  assert.deepEqual(detectBallOut(LEFT_GOAL_X - 1, wideZ, "home", -1), { restartType: "goal_kick", restartTeam: "away" });
  assert.deepEqual(detectBallOut(LEFT_GOAL_X - 1, wideZ, "away", -1), { restartType: "corner", restartTeam: "home" });
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

test("V172 off-target miss flights cannot become shotless goal-mouth goals", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v172-miss-flight-no-goal-mouth-goal");
  model.setHalfDurationSeconds(900);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 475;
  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "W");
  assert.ok(attacker);
  attacker.pos = { x: RIGHT_GOAL_X - 9.4, y: 0, z: -10 };
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };
  model.possession = attacker;
  model.ball.pos = { x: attacker.pos.x, y: 0.18, z: attacker.pos.z };
  (model as unknown as { rememberTouch: (player: unknown) => void }).rememberTouch(attacker);
  (model as unknown as {
    startBallFlight: (kind: string, from: { x: number; z: number }, to: { x: number; z: number }, duration: number, arc: number) => void;
  }).startBallFlight("miss", { x: RIGHT_GOAL_X - 9.4, z: -10 }, { x: RIGHT_GOAL_X + 1.35, z: 1.2 }, 0.24, 0.38);

  for (let i = 0; i < 180 && (model.msm.state as { kind: string }).kind === "live_play"; i++) {
    model.step(1 / 60);
    model.updateVisuals(1 / 60);
  }

  const state = model.msm.state as { kind: string; restartType?: string; restartTeam?: string };
  assert.notEqual(state.kind, "goal_scored", "miss flight must not be promoted into a goal");
  assert.equal(state.kind, "ball_out");
  assert.equal(state.restartType, "goal_kick");
  assert.equal(state.restartTeam, "away");
  assert.equal(model.getMatchSnapshot().scoreA, 0);
  assert.equal(model.getTuningBundle().goalLog.length, 0);
  assert.equal(model.getTuningBundle().ballOutLog.at(-1)?.type, "goal_kick");
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

test("V148 goalkeeper goal kicks can be lofted long toward the middle third", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v148-long-goal-kick");
  model.startMatch();
  model.msm.state = { kind: "ball_out", restartType: "goal_kick", restartTeam: "away" };
  model.msm.clock.elapsedInHalf = 22;

  const keeper = model.getPlayers().find((player) => player.team === "B" && player.role === "GK");
  const target = model.getPlayers().find((player) => player.team === "B" && player.role === "ST");
  assert.ok(keeper);
  assert.ok(target);

  for (const player of model.getPlayers()) {
    if (player.team === "B") {
      player.pos = { x: RIGHT_GOAL_X - 8, y: 0, z: player.shirtNumber * 0.45 };
      player.targetPos = { x: player.pos.x, z: player.pos.z };
    } else {
      player.pos = { x: -6 - player.shirtNumber * 0.2, y: 0, z: -6 + player.shirtNumber * 0.65 };
      player.targetPos = { x: player.pos.x, z: player.pos.z };
    }
    player.vel = { x: 0, z: 0 };
  }
  target.pos = { x: 0, y: 0, z: 0.4 };
  target.targetPos = { x: target.pos.x, z: target.pos.z };
  keeper.pos = { x: RIGHT_GOAL_X - GOAL_BOX_DEPTH * 0.65, y: 0, z: 0 };
  keeper.targetPos = { x: keeper.pos.x, z: keeper.pos.z };
  model.ball.pos = { x: RIGHT_GOAL_X + 1, y: 0.18, z: 0 };
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0,
    range: (min, max) => (min + max) / 2,
  };

  (model as unknown as {
    installBallOutRestart: (context: {
      restartType: "goal_kick";
      restartTeam: "B";
      spot: { x: number; z: number };
      lastTouchTeam: "A";
      lastTouchPlayerId: string | null;
      crossedLine: "right_goal_line";
    }) => void;
    executeBallOutRestart: () => void;
  }).installBallOutRestart({
    restartType: "goal_kick",
    restartTeam: "B",
    spot: { x: RIGHT_GOAL_X + 1, z: 0 },
    lastTouchTeam: "A",
    lastTouchPlayerId: null,
    crossedLine: "right_goal_line",
  });
  (model as unknown as { executeBallOutRestart: () => void }).executeBallOutRestart();

  const release = model.eventLog.filter((event) => event.action === "GOAL_KICK" && event.meta?.phase === "release").at(-1);
  const flight = model.getTuningBundle().ballFlightTelemetry.filter((entry) => entry.kind === "restart").at(-1);
  const keeperTelemetry = (model as any).lastKeeperKickTelemetry as Record<string, unknown>;

  assert.equal(release?.meta?.goalKickStyle, "goal_kick_long");
  assert.equal(release?.meta?.receiverId, target.id);
  assert.equal(release?.meta?.aerial, true);
  assert.equal(release?.meta?.headerEligible, true);
  assert.equal(release?.meta?.targetMiddleThird, true);
  assert.ok(Number(release?.meta?.arcHeight) >= 1.0, "long goal kicks must be visibly lofted");
  assert.ok(Number(release?.meta?.distance) / FIELD_SCALE_PER_YARD >= 28, "long goal kicks must travel beyond a short outlet");
  assert.equal(flight?.sourceAction, "goal_kick_long");
  assert.equal(flight?.aerial, true);
  assert.equal(flight?.headerEligible, true);
  assert.ok(Number(flight?.distance) > 0, "goal-kick flight telemetry must expose a non-zero distance field");
  assert.equal(flight?.distance, flight?.distanceUnits);
  assert.ok(Number(flight?.arc) >= 1.0, "restart flight telemetry must preserve the lofted arc");
  assert.equal(keeperTelemetry.style, "goal_kick_long");
  assert.equal(keeperTelemetry.target, target.name);
  assert.equal(keeperTelemetry.targetMiddleThird, true);
  assert.equal(+model.ball.pos.x.toFixed(2), +(release?.meta?.spot as { x: number; z: number }).x.toFixed(2), "ball flight must launch from the stationary restart spot, not teleport to receiver");
});

test("V164 goalkeeper goal kicks force lofted midfield delivery when short outlets are marked", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v164-goal-kick-no-short-long");
  model.startMatch();
  model.msm.state = { kind: "ball_out", restartType: "goal_kick", restartTeam: "away" };
  model.msm.clock.elapsedInHalf = 18;

  const keeper = model.getPlayers().find((player) => player.team === "B" && player.role === "GK");
  const target = model.getPlayers().find((player) => player.team === "B" && player.role === "ST");
  assert.ok(keeper);
  assert.ok(target);

  const shortTeam = model.getPlayers().filter((player) => player.team === "B" && player.role !== "GK" && player.id !== target.id);
  const markers = model.getPlayers().filter((player) => player.team === "A");
  for (const [index, player] of shortTeam.entries()) {
    player.pos = { x: RIGHT_GOAL_X - 9.2 + index * 0.12, y: 0, z: -3 + index * 0.55 };
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
    const marker = markers[index % markers.length];
    marker.pos = { x: player.pos.x - 0.65, y: 0, z: player.pos.z + 0.2 };
    marker.targetPos = { x: marker.pos.x, z: marker.pos.z };
    marker.vel = { x: 0, z: 0 };
  }
  target.pos = { x: 0.4, y: 0, z: 0.3 };
  target.targetPos = { x: target.pos.x, z: target.pos.z };
  keeper.pos = { x: RIGHT_GOAL_X - GOAL_BOX_DEPTH * 0.65, y: 0, z: 0 };
  keeper.targetPos = { x: keeper.pos.x, z: keeper.pos.z };
  model.ball.pos = { x: RIGHT_GOAL_X + 1, y: 0.18, z: 0 };
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.99,
    range: (min, max) => (min + max) / 2,
  };

  (model as unknown as {
    installBallOutRestart: (context: {
      restartType: "goal_kick";
      restartTeam: "B";
      spot: { x: number; z: number };
      lastTouchTeam: "A";
      lastTouchPlayerId: string | null;
      crossedLine: "right_goal_line";
    }) => void;
    executeBallOutRestart: () => void;
  }).installBallOutRestart({
    restartType: "goal_kick",
    restartTeam: "B",
    spot: { x: RIGHT_GOAL_X + 1, z: 0 },
    lastTouchTeam: "A",
    lastTouchPlayerId: null,
    crossedLine: "right_goal_line",
  });
  (model as unknown as { executeBallOutRestart: () => void }).executeBallOutRestart();

  const release = model.eventLog.filter((event) => event.action === "GOAL_KICK" && event.meta?.phase === "release").at(-1);
  const flight = model.getTuningBundle().ballFlightTelemetry.filter((entry) => entry.kind === "restart").at(-1);
  const keeperTelemetry = (model as any).lastKeeperKickTelemetry as Record<string, unknown>;

  assert.equal(release?.meta?.goalKickStyle, "goal_kick_long");
  assert.equal(release?.meta?.forcedLong, true);
  assert.equal(release?.meta?.noSafeShort, true);
  assert.equal(release?.meta?.receiverId, target.id);
  assert.equal(release?.meta?.targetMiddleThird, true);
  assert.ok(Number(release?.meta?.arcHeight) >= 1.0, "forced long goal kick must be visibly elevated");
  assert.equal(flight?.sourceAction, "goal_kick_long");
  assert.equal(flight?.aerial, true);
  assert.equal(flight?.headerEligible, true);
  assert.ok(Number(flight?.distance) > 0, "forced long goal-kick telemetry must expose a non-zero distance field");
  assert.equal(flight?.distance, flight?.distanceUnits);
  assert.equal(keeperTelemetry.style, "goal_kick_long");
  assert.equal(keeperTelemetry.forcedLong, true);
  assert.equal(keeperTelemetry.noSafeShort, true);
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
  assert.ok(Number(flight?.distance) > 0, "drop-kick flight telemetry must expose a non-zero distance field");
  assert.equal(flight?.distance, flight?.distanceUnits);
  assert.equal((model as any).lastKeeperKickTelemetry?.style, "drop_kick");
});

test("V164 keeper possession uses a lofted midfield drop kick when short outlets are marked", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v164-drop-kick-no-short-long");
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 20;

  const keeper = model.getPlayers().find((player) => player.team === "A" && player.role === "GK");
  const target = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(keeper);
  assert.ok(target);

  const shortTeam = model.getPlayers().filter((player) => player.team === "A" && player.role !== "GK" && player.id !== target.id);
  const markers = model.getPlayers().filter((player) => player.team === "B");
  for (const [index, player] of shortTeam.entries()) {
    player.pos = { x: LEFT_GOAL_X + 8.4 + index * 0.12, y: 0, z: -3 + index * 0.55 };
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
    const marker = markers[index % markers.length];
    marker.pos = { x: player.pos.x + 0.65, y: 0, z: player.pos.z + 0.2 };
    marker.targetPos = { x: marker.pos.x, z: marker.pos.z };
    marker.vel = { x: 0, z: 0 };
  }
  keeper.pos = { x: LEFT_GOAL_X + 5, y: 0, z: 0 };
  keeper.targetPos = { x: keeper.pos.x, z: keeper.pos.z };
  target.pos = { x: -0.4, y: 0, z: 0.2 };
  target.targetPos = { x: target.pos.x, z: target.pos.z };
  model.possession = keeper;
  model.ball.pos = { x: keeper.pos.x, y: 0.18, z: keeper.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 0;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.99,
    range: (min, max) => (min + max) / 2,
  };

  model.step(1 / 30);

  const event = model.eventLog.filter((row) => row.action === "DROP_KICK").at(-1);
  const flight = model.getTuningBundle().ballFlightTelemetry.at(-1);
  const keeperTelemetry = (model as any).lastKeeperKickTelemetry as Record<string, unknown>;

  assert.equal(event?.meta?.dropKickStyle, "drop_kick_long");
  assert.equal(event?.meta?.forcedLong, true);
  assert.equal(event?.meta?.noSafeShort, true);
  assert.equal(event?.meta?.targetMiddleThird, true);
  assert.ok(Number(event?.meta?.arcHeight) >= 1.0, "forced long drop kick must be visibly elevated");
  assert.ok(Number(event?.meta?.distance) / FIELD_SCALE_PER_YARD >= 28, "forced long drop kick must travel to midfield");
  assert.equal(flight?.sourceAction, "drop_kick_long");
  assert.equal(flight?.aerial, true);
  assert.equal(flight?.headerEligible, true);
  assert.ok(Number(flight?.distance) > 0, "forced long drop-kick telemetry must expose a non-zero distance field");
  assert.equal(flight?.distance, flight?.distanceUnits);
  assert.equal(keeperTelemetry.style, "drop_kick_long");
  assert.equal(keeperTelemetry.forcedLong, true);
  assert.equal(keeperTelemetry.noSafeShort, true);
});

test("V125 keeper ball-in-hands possession forces opponents to back off", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v125-keeper-standoff");
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 18;

  const keeper = model.getPlayers().find((player) => player.team === "B" && player.role === "GK");
  const hound = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(keeper);
  assert.ok(hound);

  keeper.pos.x = RIGHT_GOAL_X - 2.2;
  keeper.pos.z = 0;
  keeper.targetPos = { x: keeper.pos.x, z: keeper.pos.z };
  keeper.vel = { x: 0, z: 0 };
  hound.pos.x = keeper.pos.x - 0.35;
  hound.pos.z = keeper.pos.z + 0.2;
  hound.targetPos = { x: hound.pos.x, z: hound.pos.z };
  hound.vel = { x: 0, z: 0 };
  model.possession = keeper;
  model.ball.pos = { x: keeper.pos.x, y: 0.18, z: keeper.pos.z };

  (model as unknown as { updateTargets: () => void }).updateTargets();
  const targetGapYards = dist2(hound.targetPos, keeper.pos) / FIELD_SCALE_PER_YARD;
  assert.ok(targetGapYards >= 5.9, `opponent target must be outside keeper standoff, got ${targetGapYards.toFixed(2)} yards`);

  const protectedPressure = (model as unknown as { pressureOn: (player: typeof keeper) => number }).pressureOn(keeper);
  assert.equal(protectedPressure, 0, "illegal keeper hounding must not penalize keeper distribution pressure");
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

  assert.ok(shortHalf.elapsed >= fullHalf.elapsed * 7.5, `short-half match clock did not compress enough: ${shortHalf.elapsed.toFixed(2)} vs ${fullHalf.elapsed.toFixed(2)}`);
  assert.ok(shortHalf.elapsed <= fullHalf.elapsed * 9.1, `short-half match clock over-compressed: ${shortHalf.elapsed.toFixed(2)} vs ${fullHalf.elapsed.toFixed(2)}`);
  assert.ok(
    fullHalf.elapsed >= 50 && fullHalf.elapsed <= 60,
    `full-half live clock should stay near real-time while dead-ball presentation stays frozen, got ${fullHalf.elapsed.toFixed(2)}`,
  );
  assert.ok(shortHalf.topInstantSpeed <= BASE_RUN_SPEED * 1.02, `short-half player speed was accelerated to ${shortHalf.topInstantSpeed.toFixed(2)}`);
  assert.ok(fullHalf.topInstantSpeed <= BASE_RUN_SPEED * 1.02, `full-half player speed was accelerated to ${fullHalf.topInstantSpeed.toFixed(2)}`);
  assert.ok(shortHalf.actions >= fullHalf.actions * 0.85, `short-half runtime should not collapse action density at normal gameplay speed, got ${shortHalf.actions} vs ${fullHalf.actions}`);
  assert.ok(shortHalf.actions <= fullHalf.actions * 1.35, `short-half runtime should not spike action density into compressed-speed gameplay, got ${shortHalf.actions} vs ${fullHalf.actions}`);
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
  assert.ok(Math.abs((end.elapsedInHalf - start.elapsedInHalf) - ((10 * 9) - (0.5 * 9))) < 0.3);
  assert.ok(topInstantSpeed <= BASE_RUN_SPEED * 1.02, `clock compression must not speed players to ${topInstantSpeed.toFixed(2)}`);
});

test("V53 simple model 5-minute halves preserve runtime-scaled held-ball action floor", () => {
  const rows = ["v53-production-a", "v53-production-b", "v53-production-c"].map((seed) => {
    const model = new SimpleMatchModel();
    model.setSeed(seed);
    model.setTeamNames("LAFC", "Austin FC");
    model.setTeamFormations("4-3-3", "4-2-3-1");
    model.setHalfDurationSeconds(5 * 60);
    model.startMatch();

    for (let i = 0; i < 20 * 60 * 60 && model.getMatchSnapshot().phase !== "FULL_TIME"; i++) {
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
  assert.ok(avg("passes") >= 100, `expected runtime-scaled pass floor in short runtime, got ${avg("passes").toFixed(1)}`);
  assert.ok(avg("shots") >= 2, `expected runtime-scaled shot floor in short runtime, got ${avg("shots").toFixed(1)}`);
  assert.ok(avg("sot") >= 1, `expected runtime-scaled SOT floor in short runtime, got ${avg("sot").toFixed(1)}`);
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
  const passLikeRestartActions = new Set(["goal_kick", "goal_kick_long", "free_kick", "throw_in"]);
  const passFlights = flights.filter((flight) => (
    flight.kind === "pass"
    || (flight.kind === "restart" && passLikeRestartActions.has(String(flight.sourceAction || "")))
  ));
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
    const previousStart = previous.elapsedWallSeconds ?? previous.elapsedInHalf;
    const currentStart = current.elapsedWallSeconds ?? current.elapsedInHalf;
    const previousEnd = previousStart + previous.durationSeconds;
    assert.ok(
      currentStart >= previousEnd - 0.04,
      `flight ${current.seq} started at ${currentStart}s before flight ${previous.seq} arrived at ${previousEnd.toFixed(2)}s`,
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

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "W");
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

test("V144 attacking support targets hold behind the offside line", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v144-offside-line-hold");
  model.setTeamNames("England", "France");
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 18;

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  const striker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(carrier);
  assert.ok(striker);

  carrier.pos.x = 6;
  carrier.pos.z = 0;
  striker.pos.x = 17;
  striker.pos.z = 0.5;
  striker.homePos.x = 15;
  striker.homePos.z = 0.5;
  model.possession = carrier;
  model.ball.pos.x = carrier.pos.x;
  model.ball.pos.z = carrier.pos.z;

  const defenders = model.getPlayers().filter((player) => player.team === "B");
  for (const [index, defender] of defenders.entries()) {
    defender.pos.x = defender.role === "GK" ? RIGHT_GOAL_X - 2 : 10 + (index % 3) * 0.15;
    defender.pos.z = -8 + index;
    defender.targetPos = { x: defender.pos.x, z: defender.pos.z };
  }

  (model as unknown as { updateTargets: () => void }).updateTargets();

  const attackSign = (model as unknown as { attackSign: (team: "A" | "B") => 1 | -1 }).attackSign("A");
  const secondLastDefenderX = defenders
    .map((player) => player.pos.x * attackSign)
    .sort((a, b) => b - a)[1];
  const ballX = model.ball.pos.x * attackSign;
  const offsideLine = Math.max(ballX, secondLastDefenderX);

  assert.ok(
    striker.targetPos.x * attackSign < offsideLine,
    `striker target ${striker.targetPos.x} must hold behind offside line ${offsideLine}`,
  );
  const offsideProbe = model as unknown as { offsideInfraction: (carrier: unknown, target: unknown, ball: { x: number; z: number }) => unknown };
  assert.equal(
    offsideProbe.offsideInfraction(carrier, { ...striker, pos: { x: striker.targetPos.x, y: striker.pos.y, z: striker.targetPos.z } }, { x: carrier.pos.x, z: carrier.pos.z }),
    null,
    "line-held support target must remain a legal pass option",
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

test("V140 pressure foul tuning suppresses penalty-box outliers without disabling fouls", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v140-pressure-foul-budget");
  model.setTeamNames("Ecuador", "Haiti");
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  (model as any).elapsedTotal = 900;

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const defender = model.getPlayers().find((player) => player.team === "B" && player.role !== "GK");
  assert.ok(carrier);
  assert.ok(defender);

  carrier.pos.x = RIGHT_PENALTY_X + 0.8;
  carrier.pos.z = 0;
  defender.pos.x = RIGHT_PENALTY_X + 0.9;
  defender.pos.z = 0;
  const penaltyChance = (model as any).pressureFoulChance(defender, carrier, 2.2);

  carrier.pos.x = 0;
  defender.pos.x = 0.7;
  const midfieldChance = (model as any).pressureFoulChance(defender, carrier, 2.2);
  const lowPressureChance = (model as any).pressureFoulChance(defender, carrier, 0.4);

  assert.equal(lowPressureChance, 0);
  assert.ok(penaltyChance > 0, "forced low RNG tests still need to produce penalty fouls");
  assert.ok(penaltyChance <= 0.006, "penalty-box pressure fouls must be rare enough to prevent multi-penalty outliers");
  assert.ok(midfieldChance > penaltyChance * 4, "normal foul telemetry remains active outside the penalty area");
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

test("V152 penalty save rolls require reachable keeper contact", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v152-penalty-save-reach");
  model.setTeamNames("Canada", "Uzbekistan");
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.14,
    range: (min: number, max: number) => (min + max) / 2,
  };
  const taker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const keeper = model.getPlayers().find((player) => player.team === "B" && player.role === "GK");
  assert.ok(taker);
  assert.ok(keeper);
  keeper.pos = { x: RIGHT_GOAL_X - 1.2, y: 0, z: 14 };
  keeper.targetPos = { x: keeper.pos.x, z: keeper.pos.z };
  const context = {
    restartType: "penalty",
    restartTeam: "A",
    spot: (model as any).penaltySpotForAttack(1),
    lastTouchTeam: "B",
    lastTouchPlayerId: "B-4",
    crossedLine: "infraction",
    takerId: taker.id,
    fouledPlayerId: taker.id,
  };

  assert.deepEqual((model as any).executePenaltyRestart(context, taker), { scoringTeam: "home" });
  const snapshot = model.getMatchSnapshot();
  const latestShot = model.getTuningBundle().shotDecisions.at(-1);
  assert.equal(snapshot.penaltiesSavedA, 0);
  assert.equal(snapshot.savesB, 0);
  assert.equal(snapshot.penaltiesScoredA, 1);
  assert.equal(latestShot?.saveRoll, true);
  assert.equal(latestShot?.keeperReachable, false);
  assert.equal(latestShot?.outcome, "goal");
  assert.equal(model.getTuningBundle().ballFlightTelemetry.at(-1)?.kind, "shot");
});

test("V159 penalty kick flights start from the penalty spot in both directions", () => {
  const verifyPenaltyFlight = (team: "A" | "B", attackSign: 1 | -1) => {
    const model = new SimpleMatchModel();
    model.setSeed(`v159-penalty-continuity-${team}`);
    model.setTeamNames("Canada", "Uzbekistan");
    model.startMatch();
    model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
    model.msm.clock.elapsedInHalf = 30;
    (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
      next: () => 0.98,
      range: (min: number, max: number) => (min + max) / 2,
    };

    const taker = model.getPlayers().find((player) => player.team === team && player.role === "ST");
    assert.ok(taker);
    const spot = (model as any).penaltySpotForAttack(attackSign);
    (model as any).startBallFlight("pass", { x: 0, z: FIELD_D / 2 - 3 }, { x: 1, z: FIELD_D / 2 - 6 }, 1, 0.25);
    model.ball.pos = { x: 0.5, y: 0.18, z: FIELD_D / 2 - 4.5 };

    const context = {
      restartType: "penalty",
      restartTeam: team,
      spot,
      lastTouchTeam: team === "A" ? "B" : "A",
      lastTouchPlayerId: team === "A" ? "B-4" : "A-4",
      crossedLine: "infraction",
      takerId: taker.id,
      fouledPlayerId: taker.id,
    };

    (model as any).executePenaltyRestart(context, taker);
    const flight = model.getTuningBundle().ballFlightTelemetry.at(-1);
    assert.equal(flight?.sourceAction, "penalty");
    assert.equal(flight?.kind, "shot");
    assert.ok(dist2(flight?.from as { x: number; z: number }, spot) < 0.001, `${team} penalty must launch from the penalty spot, not a stale ball flight`);
    assert.ok(dist2(model.ball.pos, spot) < 0.001, `${team} penalty ball must remain visible at the spot on launch`);

    (model as unknown as { updateBallFlight: (dt: number) => void }).updateBallFlight(Number(flight?.durationSeconds) / 2);
    const midFlight = { x: model.ball.pos.x, z: model.ball.pos.z };
    assert.ok(dist2(midFlight, spot) > 0.1, `${team} penalty must visibly leave the spot during flight`);
    assert.ok(dist2(midFlight, flight?.to as { x: number; z: number }) > 0.1, `${team} penalty must not teleport straight to the destination`);
  };

  verifyPenaltyFlight("A", 1);
  verifyPenaltyFlight("B", -1);
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

  flightModel.startBallFlight("pass", { x: 0, z: 0 }, { x: passDistance, z: 0 }, 1, 0.32);

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

test("V167 lofted passes preserve visible elevation while normal passes stay low", () => {
  const model = new SimpleMatchModel();
  const flightModel = model as any;
  const passDistance = 24 * FIELD_SCALE_PER_YARD;

  flightModel.startBallFlight("pass", { x: 0, z: 0 }, { x: passDistance, z: 0 }, 1, 0.82, undefined, {
    aerial: true,
    headerEligible: true,
    sourceAction: "lofted_pass",
    attackingTeam: "A",
  });

  const samples: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < 120 && flightModel.ballFlight; i++) {
    flightModel.updateBallFlight(1 / 60);
    samples.push({ ...model.ball.pos });
  }

  const flight = model.getTuningBundle().ballFlightTelemetry.at(-1);
  const peakY = Math.max(...samples.map((sample) => sample.y));
  assert.equal(flight?.sourceAction, "lofted_pass");
  assert.equal(flight?.aerial, true);
  assert.equal(flight?.headerEligible, true);
  assert.ok(Number(flight?.arc) >= 0.8, "lofted pass telemetry must preserve requested visible arc");
  assert.ok(peakY >= 0.95, `lofted pass peak was too low: ${peakY.toFixed(2)}`);
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

test("V182 missed pass reception stays loose instead of magnetizing to receiver", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v182-no-magnetic-reception");
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };

  const receiver = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  assert.ok(receiver);
  const from = { x: -8, z: 0 };
  const to = { x: 6, z: 0 };
  receiver.pos = { x: to.x, y: 0, z: to.z };
  receiver.targetPos = { x: to.x, z: to.z };

  (model as unknown as {
    startBallFlight: (
      kind: string,
      from: { x: number; z: number },
      to: { x: number; z: number },
      duration: number,
      arc: number,
      followPlayer?: typeof receiver,
      options?: Record<string, unknown>,
    ) => number;
  }).startBallFlight("pass", from, to, 0.7, 0.08, receiver, { receiverId: receiver.id, sourceAction: "pass", attackingTeam: "A" });

  receiver.pos = { x: to.x + 5, y: 0, z: to.z };
  receiver.targetPos = { x: receiver.pos.x, z: receiver.pos.z };
  for (let i = 0; i < 90 && (model as unknown as { ballFlight: unknown }).ballFlight; i++) {
    (model as unknown as { updateBallFlight: (dt: number) => void }).updateBallFlight(1 / 60);
  }

  const latest = model.getTuningBundle().ballFlightTelemetry.at(-1);
  assert.equal(model.possession, null);
  assert.equal(latest?.receptionOutcome, "loose");
  assert.ok(Number(latest?.receptionGap) > 4.5);
  assert.ok(dist2(model.ball.pos, to) < 0.01, "loose ball should remain at the flight landing point");
  assert.ok(dist2(model.ball.pos, receiver.pos) > 4.5, "ball must not snap to the receiver after a missed landing");
});

test("V182 loose ball claim requires physical proximity", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v182-loose-ball-no-long-snap");
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.possession = null;
  model.ball.pos = { x: 0, y: 0.18, z: 0 };
  for (const player of model.getPlayers()) {
    player.pos = { x: player.team === "A" ? -18 : 18, y: 0, z: player.shirtNumber };
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.step(1 / 60);

  assert.equal(model.possession, null);
  assert.ok(dist2(model.ball.pos, { x: 0, z: 0 }) < 0.01, "loose ball must not snap to the nearest distant player");
  assert.ok(model.getPlayers().some((player) => dist2(player.targetPos, { x: 0, z: 0 }) < 0.01), "nearest player should chase the loose ball instead");
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

test("V74 simple model full-length buildup possessions keep a visible base hold", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v74-ball-hold-time");
  model.setHalfDurationSeconds(45 * 60);
  model.startMatch();

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  assert.ok(carrier);
  model.possession = carrier;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.5,
    range: (min: number) => min,
  };

  const delay = (model as unknown as { nextActionDelay: () => number }).nextActionDelay();

  assert.ok(delay >= 3.8, `expected visible full-length buildup hold, got ${delay.toFixed(2)}`);
  assert.ok(delay <= 9.5, `full-length buildup hold should stay bounded, got ${delay.toFixed(2)}`);
});

test("V74 simple model holds the receiver after a completed pass visibly arrives", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v74-receiver-visible-hold");
  model.setHalfDurationSeconds(45 * 60);
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

test("V170 compressed matches shorten settle delays without speeding ball flights", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v170-compressed-settle");
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
  assert.ok(actionTimer >= Number(latestFlight?.durationSeconds) - 0.001);
  assert.ok(actionTimer >= Number(latestFlight?.durationSeconds) + 1.09);
  assert.ok(actionTimer <= Number(latestFlight?.durationSeconds) + 1.52);
  assert.ok(Number(latestFlight?.speedMps) >= 15 && Number(latestFlight?.speedMps) <= 31, "compressed production must not speed pass flights");
});

test("V191 compressed receptions keep the receiver near the control point during the visual settle beat", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v191-compressed-visual-settle");
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
  const receiverId = latestFlight?.followPlayerId;
  assert.ok(receiverId);
  const settleDuration = Number((model as unknown as { visibleReceptionHoldSeconds: () => number }).visibleReceptionHoldSeconds().toFixed(2));

  const frames = Math.ceil((Number(latestFlight?.durationSeconds) + 0.06) * 60);
  for (let i = 0; i < frames; i++) {
    model.step(1 / 60);
  }
  model.step(1 / 60);

  const receiver = model.getPlayers().find((player) => player.id === receiverId);
  assert.ok(receiver);
  const settleRemaining = (model as unknown as { visualReceptionSettleRemaining: number }).visualReceptionSettleRemaining;
  const settlePlayerId = (model as unknown as { visualReceptionPlayerId: string | null }).visualReceptionPlayerId;
  const targetGap = Math.hypot((receiver?.targetPos.x ?? 0) - (receiver?.pos.x ?? 0), (receiver?.targetPos.z ?? 0) - (receiver?.pos.z ?? 0));
  const ballGap = Math.hypot(model.ball.pos.x - (receiver?.pos.x ?? 0), model.ball.pos.z - (receiver?.pos.z ?? 0));

  assert.equal(settlePlayerId, receiverId);
  assert.ok(settleRemaining > 0 && settleRemaining <= settleDuration, `expected active visual settle window, got ${settleRemaining.toFixed(2)}s`);
  assert.ok(targetGap <= 0.5, `receiver target should stay near control point during settle, gap ${targetGap.toFixed(2)}`);
  assert.ok(ballGap <= 0.35, `ball should stay close to the receiver during settle, gap ${ballGap.toFixed(2)}`);
});

test("V221 completed receptions persist settle and realized hold telemetry", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v221-persisted-hold-telemetry");
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

  (model as unknown as { resolvePass: (carrier: typeof passer, pressure: number) => boolean }).resolvePass(passer, 0);
  const firstFlight = model.getTuningBundle().ballFlightTelemetry.at(-1);
  assert.ok(firstFlight?.followPlayerId);

  const receiveFrames = Math.ceil((Number(firstFlight?.durationSeconds) + 0.06) * 60);
  for (let i = 0; i < receiveFrames; i++) model.step(1 / 60);

  const receiver = model.getPlayers().find((player) => player.id === firstFlight?.followPlayerId);
  assert.ok(receiver);
  (model as unknown as { actionTimer: number }).actionTimer = 0;
  (model as unknown as { resolvePass: (carrier: typeof passer, pressure: number) => boolean }).resolvePass(receiver, 0);

  const persistedFlight = model.getTuningBundle().ballFlightTelemetry.find((flight) => flight.seq === firstFlight?.seq);
  assert.equal(persistedFlight?.receptionOutcome, "received");
  assert.equal(persistedFlight?.settleSeconds, 1.1);
  assert.equal(persistedFlight?.holdResolvedBy, "pass");
  assert.ok((persistedFlight?.realizedHoldSeconds ?? 0) >= 0);
  assert.ok((persistedFlight?.realizedHoldSeconds ?? 99) <= 0.5, `expected quick realized hold after immediate next action, got ${persistedFlight?.realizedHoldSeconds}`);
});

test("V222 compressed ordinary receptions keep a substantial buildup hold", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v222-compressed-readable-continuation");
  model.setHalfDurationSeconds(300);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };

  const cm = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  assert.ok(cm);
  cm.pos.x = -6;
  cm.pos.z = 0;
  cm.targetPos = { x: cm.pos.x, z: cm.pos.z };
  model.ball.pos = { x: cm.pos.x, y: 0.18, z: cm.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 1.35;

  const received = (model as unknown as {
    resolveBallFlightReception: (flight: Record<string, unknown>) => boolean;
  }).resolveBallFlightReception({
    kind: "pass",
    from: { x: cm.pos.x - 8, z: cm.pos.z + 1 },
    to: { x: cm.pos.x, z: cm.pos.z },
    followPlayerId: cm.id,
    aerial: false,
    headerEligible: false,
    sourceAction: "pass",
    settleSeconds: 1.1,
  });

  assert.equal(received, true);
  const actionTimer = (model as unknown as { actionTimer: number }).actionTimer;
  assert.ok(actionTimer >= 2.10, `ordinary compressed receptions should keep a substantial buildup hold, got ${actionTimer.toFixed(2)}`);
  assert.ok(actionTimer <= 2.20, `ordinary compressed receptions should stay inside the intended buildup band, got ${actionTimer.toFixed(2)}`);
});

test("V189 loose ball keeps rolling and decelerates smoothly after an unclaimed ground pass", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v189-loose-ball-roll");
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };

  for (const player of model.getPlayers()) {
    player.pos = { x: player.team === "A" ? LEFT_GOAL_X + 3 : RIGHT_GOAL_X - 3, y: 0, z: player.team === "A" ? -FIELD_D * 0.3 : FIELD_D * 0.3 };
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = null;
  model.ball.pos = { x: -6, y: 0.18, z: 0 };
  model.ball.vel = { x: 0, z: 0 };
  (model as unknown as {
    startBallFlight: (kind: string, from: { x: number; z: number }, to: { x: number; z: number }, duration: number, arc: number) => void;
  }).startBallFlight("pass", { x: -6, z: 0 }, { x: 2.5, z: 0.4 }, 0.42, 0.04);

  for (let i = 0; i < 240 && (model as unknown as { ballFlight: unknown }).ballFlight; i++) model.step(1 / 60);

  const startPos = { ...model.ball.pos };
  const startSpeed = Math.hypot(model.ball.vel.x, model.ball.vel.z);
  assert.ok(startSpeed > 0.05, `loose ball must retain ground-roll velocity after missed landing, got ${startSpeed.toFixed(3)}`);

  for (let i = 0; i < 30; i++) model.step(1 / 60);

  const moved = Math.hypot(model.ball.pos.x - startPos.x, model.ball.pos.z - startPos.z);
  const endSpeed = Math.hypot(model.ball.vel.x, model.ball.vel.z);
  assert.ok(moved > 0.02, `loose ball must keep moving after landing, got ${moved.toFixed(3)}`);
  assert.ok(endSpeed > 0, "loose ball must not snap to a dead stop immediately");
  assert.ok(endSpeed < startSpeed, `loose ball must decelerate under friction, start=${startSpeed.toFixed(3)} end=${endSpeed.toFixed(3)}`);
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
  const shotPositionSnapshots = bundle.events.filter((event) => event.type === "SHOT_POSITION_SNAPSHOT");

  assert.equal(snapshot.scoreA, 1);
  assert.equal(snapshot.phase, "GOAL_SCORED");
  assert.equal(snapshot.shotsA, 1);
  assert.equal(snapshot.shotsOnTargetA, 1);
  assert.equal(latestShot?.resolutionReason, "OPEN_NET_FINISH");
  assert.equal(latestShot?.forcedByGeometry, true);
  assert.equal(latestGoal?.resolutionReason, "OPEN_NET_FINISH");
  assert.equal(latestGoal?.shotBacked, true);
  assert.equal(typeof latestGoal?.defendersInBox, "number");
  assert.equal(typeof latestGoal?.attackersInBox, "number");
  assert.equal(typeof latestGoal?.defendersInCorridor, "number");
  assert.equal(typeof latestGoal?.keeperDistance, "number");
  assert.ok(shotPositionSnapshots.length >= 1);
  assert.equal(typeof shotPositionSnapshots.at(-1)?.detail.defendersInBox, "number");
  assert.ok(Array.isArray(shotPositionSnapshots.at(-1)?.detail.players));
  assert.equal(goalEvents.length, 1);
});

test("V143 simple model does not recycle backward from controlled goalmouth possession", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v143-goalmouth-no-back-pass");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const keeper = model.getPlayers().find((player) => player.team === "B" && player.role === "GK");
  assert.ok(attacker);
  assert.ok(keeper);

  attacker.pos.x = RIGHT_GOAL_X - 3.4;
  attacker.pos.z = GOAL_MOUTH_HALF_Z * 0.18;
  attacker.vel = { x: 0, z: 0 };
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };

  keeper.pos.x = RIGHT_GOAL_X - 0.8;
  keeper.pos.z = 0;
  keeper.vel = { x: 0, z: 0 };
  keeper.targetPos = { x: keeper.pos.x, z: keeper.pos.z };

  for (const player of model.getPlayers()) {
    if (player.id === attacker.id || player.id === keeper.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 8 : LEFT_GOAL_X + 14;
    player.pos.z = FIELD_D * 0.35;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = attacker;
  model.ball.pos = { x: attacker.pos.x, y: 0.18, z: attacker.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 0;
  (model as unknown as { teamA: { shots: number } }).teamA.shots = 1;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.99,
    range: (min: number) => min,
  };

  model.step(1 / 30);

  const snapshot = model.getMatchSnapshot();
  const bundle = model.getTuningBundle();
  const latestShot = bundle.shotDecisions.at(-1);
  const latestOpportunity = bundle.shotOpportunities.at(-1);
  const latestPass = bundle.passLog.at(-1);

  assert.equal(snapshot.shotsA, 2);
  assert.equal(snapshot.shotsOnTargetA, 1);
  assert.equal(latestShot?.resolutionReason, "GOALMOUTH_FINISH");
  assert.equal(latestOpportunity?.outcome, "goalmouth_finish");
  assert.notEqual(latestPass?.detail?.outcome, "complete");
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

test("V177 header-shot goals cannot be double-logged as goal-mouth crossings", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v177-header-shot-no-duplicate-crossing");
  model.setHalfDurationSeconds(30);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(attacker);
  const contact = { x: RIGHT_GOAL_X - 6.0, z: 0.15 };
  attacker.pos = { x: contact.x, y: 0, z: contact.z };
  attacker.targetPos = { x: contact.x, z: contact.z };
  attacker.vel = { x: 0, z: 0 };
  for (const defender of model.getPlayers().filter((player) => player.team === "B" && player.role !== "GK")) {
    defender.pos = { x: LEFT_GOAL_X + 10, y: 0, z: FIELD_D / 2 - 2 };
    defender.targetPos = { x: defender.pos.x, z: defender.pos.z };
  }
  const keeper = model.getPlayers().find((player) => player.team === "B" && player.role === "GK");
  assert.ok(keeper);
  keeper.pos = { x: RIGHT_GOAL_X - 8.0, y: 0, z: FIELD_D / 2 - 2 };
  keeper.targetPos = { x: keeper.pos.x, z: keeper.pos.z };
  model.ball.pos = { x: contact.x - 6, y: 1.1, z: contact.z };
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0,
    range: (min, max) => (min + max) / 2,
  };
  (model as unknown as { ballFlight: unknown }).ballFlight = {
    kind: "restart",
    from: { x: contact.x - 6, z: contact.z },
    to: contact,
    followPlayerId: attacker.id,
    aerial: true,
    headerEligible: true,
    sourceAction: "corner",
    attackingTeam: "A",
    elapsed: 0,
    duration: 0.01,
    arc: 1.05,
  };

  model.step(1 / 30);
  for (let i = 0; i < 120; i++) model.step(1 / 60);

  const snapshot = model.getMatchSnapshot();
  const goals = model.getTuningBundle().goalLog;
  assert.equal(snapshot.scoreA, 1);
  assert.equal(snapshot.scoreB, 0);
  assert.equal(goals.length, 1);
  assert.equal(goals[0]?.resolutionReason, "HEADER_SHOT");
  assert.equal(goals.some((goal) => goal.resolutionReason === "GOAL_MOUTH_CROSSING"), false);
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

test("V158 stale kickoff setup flag cannot snap a live or restart ball to center", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v158-stale-kickoff-flag-no-snap");
  model.startMatch();

  const liveBall = { x: RIGHT_GOAL_X - 7.5, y: 0.18, z: GOAL_MOUTH_HALF_Z + 1.1 };
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.ball.pos = { ...liveBall };
  (model as unknown as { kickoffSetupMoving: boolean }).kickoffSetupMoving = true;
  model.updateVisuals(1 / 60);

  assert.ok(dist2(model.ball.pos, liveBall) < 0.001, "stale kickoff flag must not pin a live-play ball to the center spot");

  const restartBall = { x: -RIGHT_GOAL_X + 0.8, y: 0.18, z: FIELD_D / 2 - 0.4 };
  model.msm.state = { kind: "ball_out", restartType: "throw_in", restartTeam: "home" };
  model.ball.pos = { ...restartBall };
  (model as unknown as { kickoffSetupMoving: boolean }).kickoffSetupMoving = true;
  model.updateVisuals(1 / 60);

  assert.ok(dist2(model.ball.pos, restartBall) < 0.001, "stale kickoff flag must not pin a ball-out restart ball to the center spot");
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
  model.setHalfDurationSeconds(45 * 60);
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
  assert.equal(latestShot?.resolutionReason, "STRIKER_PENALTY_AREA_FORCED_SHOT");
  assert.equal(latestShot?.shotSelectionType, "striker_penalty_area_forced_shot");
  assert.equal(latestOpportunity?.outcome, "striker_penalty_area_forced_shot");
  assert.equal(Number(latestOpportunity?.shootChance), 1);
});

test("V156 strikers shoot soon after entering the penalty area instead of walking it in", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v156-striker-box-shoot-soon");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;

  const striker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(striker);
  striker.pos.x = RIGHT_PENALTY_X + 1.2;
  striker.pos.z = 0.8;
  striker.vel = { x: 0, z: 0 };
  striker.targetPos = { x: striker.pos.x, z: striker.pos.z };

  for (const player of model.getPlayers()) {
    if (player.id === striker.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 9 : RIGHT_GOAL_X - 7;
    player.pos.z = player.role === "GK" ? 0 : FIELD_D * 0.35;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = striker;
  model.ball.pos = { x: striker.pos.x, y: 0.18, z: striker.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 5;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.99,
    range: (min, max) => (min + max) / 2,
  };

  let framesToShot = 0;
  for (; framesToShot < 30 && model.getMatchSnapshot().shotsA === 0; framesToShot++) model.step(1 / 30);

  const latestShot = model.getTuningBundle().shotDecisions.at(-1);
  const latestOpportunity = model.getTuningBundle().shotOpportunities.at(-1);
  assert.equal(model.getMatchSnapshot().shotsA, 1);
  assert.equal(latestShot?.resolutionReason, "STRIKER_PENALTY_AREA_FORCED_SHOT");
  assert.equal(latestOpportunity?.outcome, "striker_penalty_area_forced_shot");
  assert.ok(framesToShot <= 30, "striker must shoot within about one visual second of controlled box possession");
});

test("V163 strikers stop driving deeper once they enter the penalty area", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v163-striker-box-entry-no-walk-in");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;

  const striker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(striker);
  striker.pos.x = RIGHT_PENALTY_X + 0.25;
  striker.pos.z = 0.9;
  striker.vel = { x: 0, z: 0 };
  striker.targetPos = { x: striker.pos.x, z: striker.pos.z };
  const entryX = striker.pos.x;

  for (const player of model.getPlayers()) {
    if (player.id === striker.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 8 : RIGHT_GOAL_X - 8;
    player.pos.z = player.role === "GK" ? 0 : FIELD_D * 0.35;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = striker;
  model.ball.pos = { x: striker.pos.x, y: 0.18, z: striker.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 5;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.99,
    range: (min, max) => (min + max) / 2,
  };

  let framesToShot = 0;
  for (; framesToShot < 16 && model.getMatchSnapshot().shotsA === 0; framesToShot++) model.step(1 / 30);

  const bundle = model.getTuningBundle();
  const latestShot = bundle.shotDecisions.at(-1);
  const strikerBoxResolution = bundle.strikerBoxTelemetry
    .filter((row) => row.playerId === striker.id && row.outcome === "shot")
    .at(-1);

  assert.equal(model.getMatchSnapshot().shotsA, 1);
  assert.equal(latestShot?.resolutionReason, "STRIKER_PENALTY_AREA_FORCED_SHOT");
  assert.ok(framesToShot <= 16, "striker must shoot within about half a second of penalty-area entry");
  assert.ok(striker.pos.x <= entryX + 0.25, "striker must not keep carrying deeper toward the goalmouth while waiting to shoot");
  assert.ok(Number(strikerBoxResolution?.dwellSeconds) <= 0.4, "striker box dwell must stay below the visible walk-in threshold");
});

test("V163 strikers near the penalty area shoot when no forward outlet exists", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v163-striker-near-box-no-outlet-shot");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;

  const striker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(striker);
  striker.pos.x = RIGHT_PENALTY_X - 0.7;
  striker.pos.z = 0.5;
  striker.vel = { x: 0, z: 0 };
  striker.targetPos = { x: striker.pos.x, z: striker.pos.z };

  for (const player of model.getPlayers()) {
    if (player.id === striker.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 3 : RIGHT_GOAL_X - 9;
    player.pos.z = player.role === "GK" ? 0 : FIELD_D * 0.36;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = striker;
  model.ball.pos = { x: striker.pos.x, y: 0.18, z: striker.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 0;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.99,
    range: (min, max) => (min + max) / 2,
  };

  model.step(1 / 30);

  const bundle = model.getTuningBundle();
  const latestShot = bundle.shotDecisions.at(-1);
  const latestOpportunity = bundle.shotOpportunities.at(-1);
  const strikerDribble = bundle.events.find((row) => row.type === "DRIBBLE" && row.detail?.reason === "STRIKER_NEAR_BOX_NO_OUTLET");

  assert.equal(model.getMatchSnapshot().shotsA, 1);
  assert.equal(latestShot?.resolutionReason, "STRIKER_NEAR_BOX_NO_OUTLET_SHOT");
  assert.equal(latestOpportunity?.outcome, "striker_near_box_forced_shot");
  assert.equal(strikerDribble, undefined, "no-outlet near-box striker behavior must not fall back to dribbling at goal");
});

test("V178 high-load striker near-box no-outlet possessions use containment before another shot", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v178-near-box-high-load-containment");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;
  model.teamA.shots = 16;
  model.teamB.shots = 13;

  const striker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const defender = model.getPlayers().find((player) => player.team === "B" && player.role !== "GK");
  assert.ok(striker);
  assert.ok(defender);
  striker.pos.x = RIGHT_PENALTY_X - 0.7;
  striker.pos.z = 0.5;
  striker.vel = { x: 0, z: 0 };
  striker.targetPos = { x: striker.pos.x, z: striker.pos.z };
  defender.pos.x = striker.pos.x + 1.0;
  defender.pos.z = striker.pos.z + 0.25;
  defender.vel = { x: 0, z: 0 };
  defender.targetPos = { x: defender.pos.x, z: defender.pos.z };

  for (const player of model.getPlayers()) {
    if (player.id === striker.id || player.id === defender.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 3 : RIGHT_GOAL_X - 9;
    player.pos.z = player.role === "GK" ? 0 : FIELD_D * 0.36;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = striker;
  model.ball.pos = { x: striker.pos.x, y: 0.18, z: striker.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 0;
  const rolls = [0.99, 0.99, 0.99, 0.99, 0.01, 0.01];
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => rolls.shift() ?? 0.01,
    range: (min, max) => (min + max) / 2,
  };

  model.step(1 / 30);

  const bundle = model.getTuningBundle();
  const latestShot = bundle.shotDecisions.at(-1);
  const containment = bundle.events
    .filter((row) => row.detail?.reason === "STRIKER_BOX_BLOCK" || row.detail?.reason === "STRIKER_BOX_KEEPER_SMOTHER")
    .at(-1);

  assert.equal(model.getMatchSnapshot().shotsA, 16);
  assert.notEqual(latestShot?.resolutionReason, "STRIKER_NEAR_BOX_NO_OUTLET_SHOT");
  assert.ok(containment);
  assert.equal(containment.detail?.matchShotLoad, 29);
});

test("V165 outfield penalty-area carriers pass or shoot instead of carrying to the goal line", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v165-box-carrier-pass-or-shoot");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;

  const winger = model.getPlayers().find((player) => player.team === "A" && player.role === "W");
  const outlet = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  assert.ok(winger);
  assert.ok(outlet);
  winger.pos = { x: RIGHT_PENALTY_X + 1.2, y: 0, z: 3.6 };
  winger.targetPos = { x: winger.pos.x, z: winger.pos.z };
  winger.vel = { x: 0, z: 0 };
  const entryX = winger.pos.x;
  outlet.pos = { x: winger.pos.x - 2.4, y: 0, z: 0.6 };
  outlet.targetPos = { x: outlet.pos.x, z: outlet.pos.z };
  outlet.vel = { x: 0, z: 0 };

  for (const player of model.getPlayers()) {
    if (player.id === winger.id || player.id === outlet.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 9 : LEFT_GOAL_X + 14;
    player.pos.z = player.role === "GK" ? 0 : FIELD_D * 0.38;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = winger;
  model.ball.pos = { x: winger.pos.x, y: 0.18, z: winger.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 5;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.99,
    range: (min, max) => (min + max) / 2,
  };

  let framesToDecision = 0;
  for (; framesToDecision < 16; framesToDecision++) {
    model.step(1 / 30);
    const bundle = model.getTuningBundle();
    if (bundle.passDecisions.at(-1)?.passContextReason === "PENALTY_AREA_PASS_OR_SHOT") break;
    if (bundle.shotDecisions.at(-1)?.resolutionReason === "PENALTY_AREA_NO_OUTLET_SHOT") break;
    if (bundle.shotDecisions.at(-1)?.resolutionReason === "PENALTY_AREA_SHOT") break;
  }

  const bundle = model.getTuningBundle();
  const latestPass = bundle.passDecisions.at(-1);
  const latestShot = bundle.shotDecisions.at(-1);
  const resolvedByPass = latestPass?.passContextReason === "PENALTY_AREA_PASS_OR_SHOT";
  const resolvedByShot = latestShot?.resolutionReason === "PENALTY_AREA_NO_OUTLET_SHOT" || latestShot?.resolutionReason === "PENALTY_AREA_SHOT";

  assert.ok(resolvedByPass || resolvedByShot, "box carrier must resolve with a pass/cross or shot");
  assert.ok(framesToDecision <= 15, "box carrier must resolve before a visible goal-line carry develops");
  assert.ok(winger.targetPos.x <= entryX, "box carrier target must stop driving deeper toward the goal line");
  assert.ok(winger.pos.x <= entryX + 0.18, "box carrier must not keep carrying deeper while waiting for the decision");
  if (resolvedByPass) {
    assert.ok(Number(latestPass?.forwardProgress ?? -999) >= -0.001, `box pass resolution must not recycle backward, got ${String(latestPass?.forwardProgress)}`);
  }
});

test("V180 non-striker box-edge shots are damped without killing close central chances", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v180-non-striker-box-edge-shot-quality");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  const winger = model.getPlayers().find((player) => player.team === "A" && player.role === "W");
  assert.ok(winger);

  const shotChance = (carrier: typeof winger, pressure: number) => (model as unknown as {
    penaltyAreaShotChance: (carrier: typeof winger, distToGoal: number, pressure: number) => number;
  }).penaltyAreaShotChance(carrier, dist2(carrier.pos, { x: RIGHT_GOAL_X, z: 0 }), pressure);

  winger.pos = { x: RIGHT_GOAL_X - 7.0, y: 0, z: 0.6 };
  const closeCentralChance = shotChance(winger, 1.1);

  winger.pos = { x: RIGHT_GOAL_X - 8.4, y: 0, z: PENALTY_HALF_Z - 0.2 };
  const wideEdgeChance = shotChance(winger, 1.45);

  assert.ok(closeCentralChance > 0.55, `close central winger chance should remain viable, got ${closeCentralChance}`);
  assert.ok(wideEdgeChance < 0.16, `wide box-edge winger chance should be damped, got ${wideEdgeChance}`);
  assert.ok(wideEdgeChance < closeCentralChance * 0.30, "wide/edge non-striker looks must recycle far more often than clean central box looks");
});

test("V166 striker box tracking does not oscillate at the penalty-area boundary", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v166-striker-box-hysteresis");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;

  const striker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(striker);
  striker.pos = { x: RIGHT_PENALTY_X + 0.04, y: 0, z: 0.18 };
  striker.targetPos = { x: striker.pos.x, z: striker.pos.z };
  striker.vel = { x: 0, z: 0 };

  for (const player of model.getPlayers()) {
    if (player.id === striker.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 9 : RIGHT_GOAL_X - 9;
    player.pos.z = player.role === "GK" ? 0 : FIELD_D * 0.36;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = striker;
  model.ball.pos = { x: striker.pos.x, y: 0.18, z: striker.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 5;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.99,
    range: (min, max) => (min + max) / 2,
  };

  for (let frame = 0; frame < 14 && model.getMatchSnapshot().shotsA === 0; frame++) model.step(1 / 30);

  const boxRows = model.getTuningBundle().strikerBoxTelemetry.filter((row) => row.playerId === striker.id);
  const outcomes = boxRows.map((row) => row.outcome);
  assert.equal(outcomes.filter((outcome) => outcome === "entry").length, 1, "one controlled box possession should create one entry");
  assert.equal(outcomes.includes("left_box"), false, "marginal edge settling must not churn left_box rows before the decision");
  assert.ok(outcomes.includes("shot"), "box possession must still resolve as a shot-backed action");
});

test("V169 high shot-load striker box possessions can be blocked before counting as shots", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v169-striker-box-shot-load-containment");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;
  model.teamA.shots = 30;
  model.teamB.shots = 28;

  const striker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(striker);
  striker.pos.x = RIGHT_PENALTY_X + 2.4;
  striker.pos.z = 1.0;
  striker.vel = { x: 0, z: 0 };
  striker.targetPos = { x: striker.pos.x, z: striker.pos.z };

  for (const player of model.getPlayers()) {
    if (player.id === striker.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 9 : RIGHT_GOAL_X - 9;
    player.pos.z = player.role === "GK" ? 0 : FIELD_D * 0.36;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = striker;
  model.ball.pos = { x: striker.pos.x, y: 0.18, z: striker.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 5;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.5,
    range: (min, max) => (min + max) / 2,
  };

  for (let frame = 0; frame < 45 && model.possession?.id === striker.id; frame++) model.step(1 / 30);

  const bundle = model.getTuningBundle();
  const latestShot = bundle.shotDecisions.at(-1);
  const latestOpportunity = bundle.shotOpportunities.at(-1);
  const strikerBoxLoss = bundle.strikerBoxTelemetry
    .filter((row) => row.playerId === striker.id && ["defender_block", "keeper_smother"].includes(String(row.outcome)))
    .at(-1);
  const strikerPass = bundle.passDecisions.find((row) => row.passer === striker.name || row.carrier === striker.name);

  assert.equal(model.getMatchSnapshot().shotsA, 30);
  assert.notEqual(latestShot?.resolutionReason, "STRIKER_PENALTY_AREA_FORCED_SHOT");
  assert.notEqual(latestOpportunity?.outcome, "striker_penalty_area_forced_shot");
  assert.ok(strikerBoxLoss);
  assert.ok(Number(strikerBoxLoss?.dwellSeconds) <= 0.95, "high shot-load striker box possession must still resolve before visible lingering");
  assert.equal(strikerBoxLoss?.matchShotLoad, 58);
  assert.equal(strikerPass, undefined, "striker box possession must not fall back to a generic pass");
});

test("V178 repeated central striker box possessions enter containment before shot volume spikes", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v178-repeated-central-striker-box-containment");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;
  model.teamA.shots = 7;
  model.teamB.shots = 7;

  const striker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const defender = model.getPlayers().find((player) => player.team === "B" && player.role !== "GK");
  assert.ok(striker);
  assert.ok(defender);
  striker.pos.x = RIGHT_PENALTY_X + 1.1;
  striker.pos.z = 0.45;
  striker.vel = { x: 0, z: 0 };
  striker.targetPos = { x: striker.pos.x, z: striker.pos.z };
  defender.pos.x = striker.pos.x + 1.15;
  defender.pos.z = striker.pos.z + 0.2;
  defender.vel = { x: 0, z: 0 };
  defender.targetPos = { x: defender.pos.x, z: defender.pos.z };

  for (const player of model.getPlayers()) {
    if (player.id === striker.id || player.id === defender.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 9 : RIGHT_GOAL_X - 9;
    player.pos.z = player.role === "GK" ? 0 : FIELD_D * 0.36;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = striker;
  model.ball.pos = { x: striker.pos.x, y: 0.18, z: striker.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 5;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.01,
    range: (min, max) => (min + max) / 2,
  };

  for (let frame = 0; frame < 20 && model.possession?.id === striker.id; frame++) model.step(1 / 30);

  const bundle = model.getTuningBundle();
  const latestShot = bundle.shotDecisions.at(-1);
  const containment = bundle.events
    .filter((row) => row.detail?.reason === "STRIKER_BOX_BLOCK" || row.detail?.reason === "STRIKER_BOX_KEEPER_SMOTHER")
    .at(-1);

  assert.equal(model.getMatchSnapshot().shotsA, 7);
  assert.notEqual(latestShot?.resolutionReason, "STRIKER_PENALTY_AREA_FORCED_SHOT");
  assert.ok(containment);
  assert.equal(containment.detail?.matchShotLoad, 14);
});

test("V178 poor forced box shots are contained before inflating shot and goal-kick volume", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v178-poor-forced-shot-quality-containment");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;
  model.teamA.shots = 15;
  model.teamB.shots = 13;

  const winger = model.getPlayers().find((player) => player.team === "A" && player.role === "W");
  const defender = model.getPlayers().find((player) => player.team === "B" && player.role !== "GK");
  assert.ok(winger);
  assert.ok(defender);
  winger.pos = { x: RIGHT_PENALTY_X + 1.2, y: 0, z: PENALTY_HALF_Z - 0.35 };
  winger.targetPos = { x: winger.pos.x, z: winger.pos.z };
  winger.vel = { x: 0, z: 0 };
  defender.pos = { x: winger.pos.x + 1.0, y: 0, z: winger.pos.z - 0.25 };
  defender.targetPos = { x: defender.pos.x, z: defender.pos.z };
  defender.vel = { x: 0, z: 0 };

  for (const player of model.getPlayers()) {
    if (player.id === winger.id || player.id === defender.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 8 : RIGHT_GOAL_X - 8;
    player.pos.z = player.role === "GK" ? 0 : -FIELD_D * 0.36;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = winger;
  model.ball.pos = { x: winger.pos.x, y: 0.18, z: winger.pos.z };
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.01,
    range: (min, max) => (min + max) / 2,
  };

  const quality = (model as unknown as {
    forcedShotQualityDebt: (carrier: typeof winger, distToGoal: number, pressure: number) => { shouldContain: boolean; qualityDebt: number; reason: string };
  }).forcedShotQualityDebt(winger, dist2(winger.pos, { x: RIGHT_GOAL_X, z: 0 }), 1.4);
  const contained = (model as unknown as {
    resolvePenaltyAreaContainmentLoss: (
      carrier: typeof winger,
      distToGoal: number,
      pressure: number,
      options: { qualityDebt: number; qualityReason: string },
    ) => boolean;
  }).resolvePenaltyAreaContainmentLoss(winger, dist2(winger.pos, { x: RIGHT_GOAL_X, z: 0 }), 1.4, {
    qualityDebt: quality.qualityDebt,
    qualityReason: quality.reason,
  });

  assert.equal(quality.shouldContain, true);
  assert.equal(contained, true);
  assert.equal(model.getMatchSnapshot().shotsA, 15, "poor forced-shot containment must not count as a shot");
  assert.equal(model.possession?.team, "B");
  const containment = model.getTuningBundle().events
    .filter((row) => row.type === "TACKLE" && row.detail?.reason === "PENALTY_AREA_CONTAINMENT_BLOCK")
    .at(-1);
  assert.ok(containment);
  assert.ok(Number(containment.detail?.shotQualityDebt) >= 0.4);
});

test("V161 crowded striker box possessions resolve as physical losses, not passes", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v161-striker-box-physical-loss");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;
  model.teamA.shots = 24;
  model.teamB.shots = 22;

  const striker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const defender = model.getPlayers().find((player) => player.team === "B" && player.role !== "GK");
  assert.ok(striker);
  assert.ok(defender);
  striker.pos.x = RIGHT_PENALTY_X + 2.2;
  striker.pos.z = 0.6;
  striker.vel = { x: 0, z: 0 };
  striker.targetPos = { x: striker.pos.x, z: striker.pos.z };
  defender.pos.x = striker.pos.x + 1.2;
  defender.pos.z = striker.pos.z + 0.4;
  defender.vel = { x: 0, z: 0 };
  defender.targetPos = { x: defender.pos.x, z: defender.pos.z };

  for (const player of model.getPlayers()) {
    if (player.id === striker.id || player.id === defender.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 9 : RIGHT_GOAL_X - 10;
    player.pos.z = player.role === "GK" ? 0 : FIELD_D * 0.38;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = striker;
  model.ball.pos = { x: striker.pos.x, y: 0.18, z: striker.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 5;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.01,
    range: (min, max) => (min + max) / 2,
  };

  for (let frame = 0; frame < 45 && model.possession?.id === striker.id; frame++) model.step(1 / 30);

  const bundle = model.getTuningBundle();
  const strikerBoxLoss = bundle.strikerBoxTelemetry
    .filter((row) => row.playerId === striker.id && ["defender_block", "keeper_smother", "pressure_loss"].includes(String(row.outcome)))
    .at(-1);
  const strikerPass = bundle.passDecisions.find((row) => row.passer === striker.name || row.carrier === striker.name);

  assert.equal(model.getMatchSnapshot().shotsA, 24);
  assert.equal(model.possession?.team, "B");
  assert.ok(strikerBoxLoss);
  assert.ok(Number(strikerBoxLoss?.dwellSeconds) <= 0.95, "crowded striker box possession must resolve before lingering");
  assert.equal(strikerPass, undefined, "crowded striker box possession must not use a generic pass escape");
});

test("V149 strikers near the penalty area do not recycle backward when a forward play exists", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v149-striker-near-box-forward");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;

  const striker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const forwardOutlet = model.getPlayers().find((player) => player.team === "A" && player.role === "W");
  const backOutlet = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  assert.ok(striker);
  assert.ok(forwardOutlet);
  assert.ok(backOutlet);

  striker.pos = { x: RIGHT_PENALTY_X - 1.6, y: 0, z: 0 };
  striker.targetPos = { x: striker.pos.x, z: striker.pos.z };
  forwardOutlet.pos = { x: striker.pos.x + 3.2, y: 0, z: 2.2 };
  forwardOutlet.targetPos = { x: forwardOutlet.pos.x, z: forwardOutlet.pos.z };
  backOutlet.pos = { x: striker.pos.x - 4.0, y: 0, z: -0.3 };
  backOutlet.targetPos = { x: backOutlet.pos.x, z: backOutlet.pos.z };

  for (const player of model.getPlayers()) {
    if (player.id === striker.id || player.id === forwardOutlet.id || player.id === backOutlet.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 8 + player.shirtNumber * 0.1 : RIGHT_GOAL_X - 5 - player.shirtNumber * 0.08;
    player.pos.z = player.role === "GK" ? 0 : FIELD_D * 0.34;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = striker;
  model.ball.pos = { x: striker.pos.x, y: 0.18, z: striker.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 0;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.99,
    range: (min, max) => (min + max) / 2,
  };

  model.step(1 / 30);

  const bundle = model.getTuningBundle();
  const latestOpportunity = bundle.shotOpportunities.at(-1);
  const latestPassDecision = bundle.passDecisions.at(-1);

  assert.equal(latestOpportunity?.outcome, "striker_near_box_forward_creation");
  assert.equal(latestPassDecision?.passContextReason, "STRIKER_NEAR_BOX_FORWARD_CREATION");
  assert.equal(latestPassDecision?.passTargetName, forwardOutlet.name);
  assert.ok(Number(latestPassDecision?.passForwardProg) >= -2, "near-box striker pass must not be an obvious backward recycle");
  assert.notEqual(latestPassDecision?.passTargetName, backOutlet.name);
});

test("V192 strikers near the penalty area do not use a backward recycle as the only outlet", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v192-striker-near-box-no-backward-bailout");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;

  const striker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const backOutlet = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  assert.ok(striker);
  assert.ok(backOutlet);

  striker.pos = { x: RIGHT_PENALTY_X - 1.1, y: 0, z: 0.35 };
  striker.targetPos = { x: striker.pos.x, z: striker.pos.z };
  striker.vel = { x: 0, z: 0 };
  backOutlet.pos = { x: striker.pos.x - 4.6, y: 0, z: -0.25 };
  backOutlet.targetPos = { x: backOutlet.pos.x, z: backOutlet.pos.z };
  backOutlet.vel = { x: 0, z: 0 };

  for (const player of model.getPlayers()) {
    if (player.id === striker.id || player.id === backOutlet.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 4 : RIGHT_GOAL_X - 9;
    player.pos.z = player.role === "GK" ? 0 : FIELD_D * 0.36;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = striker;
  model.ball.pos = { x: striker.pos.x, y: 0.18, z: striker.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 0;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.99,
    range: (min, max) => (min + max) / 2,
  };

  model.step(1 / 30);

  const bundle = model.getTuningBundle();
  const latestPassDecision = bundle.passDecisions.at(-1);
  const latestShot = bundle.shotDecisions.at(-1);
  const latestOpportunity = bundle.shotOpportunities.at(-1);

  assert.notEqual(latestPassDecision?.passContextReason, "STRIKER_NEAR_BOX_FORWARD_CREATION", "near-box striker should not bail out with a backward recycle pass");
  assert.equal(latestShot?.resolutionReason, "STRIKER_NEAR_BOX_NO_OUTLET_SHOT");
  assert.equal(latestOpportunity?.outcome, "striker_near_box_forced_shot");
});

test("V194 live underproducing matches widen attacking support shape", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v194-attack-expansion-shape");
  model.setHalfDurationSeconds(45 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 18;
  model.teamA.shots = 6;
  model.teamB.shots = 4;

  const expansion = (model as unknown as { attackExpansionScale: () => number }).attackExpansionScale();
  assert.ok(expansion >= 1.16, `underproducing live matches should widen support shape, got ${expansion}`);
});

test("V195 early final-third carriers stay eligible for wider deliveries and chance shape", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v195-final-third-commit");
  model.setHalfDurationSeconds(45 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 18;
  model.teamA.shots = 5;
  model.teamB.shots = 5;

  const striker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(striker);
  striker.pos.x = RIGHT_PENALTY_X - 6.5;
  striker.pos.z = 0.6;
  const distToGoal = dist2(striker.pos, { x: RIGHT_GOAL_X, z: 0 });
  assert.equal((model as unknown as { isFinalThirdCarrier: (carrier: typeof striker, distToGoal: number) => boolean }).isFinalThirdCarrier(striker, distToGoal), true);
});

test("V188 wide final-third carriers prefer central deliveries over backward resets", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v188-wide-delivery");
  model.setHalfDurationSeconds(30);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 18;

  const winger = model.getPlayers().find((player) => player.team === "A" && player.role === "W");
  const striker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const backOutlet = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  assert.ok(winger);
  assert.ok(striker);
  assert.ok(backOutlet);

  winger.pos = { x: RIGHT_PENALTY_X - 4.2, y: 0, z: FIELD_D * 0.30 };
  winger.targetPos = { x: winger.pos.x, z: winger.pos.z };
  striker.pos = { x: RIGHT_PENALTY_X + 1.8, y: 0, z: 1.4 };
  striker.targetPos = { x: striker.pos.x, z: striker.pos.z };
  backOutlet.pos = { x: winger.pos.x - 7.0, y: 0, z: FIELD_D * 0.16 };
  backOutlet.targetPos = { x: backOutlet.pos.x, z: backOutlet.pos.z };

  for (const player of model.getPlayers()) {
    if (player.id === winger.id || player.id === striker.id || player.id === backOutlet.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 9 + player.shirtNumber * 0.1 : RIGHT_GOAL_X - 6 - player.shirtNumber * 0.08;
    player.pos.z = player.role === "GK" ? 0 : FIELD_D * 0.34;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = winger;
  model.ball.pos = { x: winger.pos.x, y: 0.18, z: winger.pos.z };
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.55,
    range: (min, max) => (min + max) / 2,
  };

  const passed = (model as unknown as { resolvePass: (carrier: typeof winger, pressure: number) => boolean }).resolvePass(winger, 0.25);
  const latestPassDecision = model.getTuningBundle().passDecisions.at(-1);
  const crossEvent = model.getTuningBundle().events.filter((event) => event.type === "PATTERN_CROSS_EXECUTED").at(-1);

  assert.equal(passed, true);
  assert.equal(latestPassDecision?.passTargetName, striker.name);
  assert.notEqual(latestPassDecision?.passTargetName, backOutlet.name);
  assert.equal(latestPassDecision?.realCross, true);
  assert.ok(Number(latestPassDecision?.passForwardProg) > 0, "wide delivery must move play forward");
  assert.equal(crossEvent?.detail?.target, striker.name);
  assert.equal(crossEvent?.detail?.playName, "WIDE_DELIVERY");
});

test("V198 underproducing half-space carriers still choose final-third deliveries", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v198-half-space-delivery");
  model.setHalfDurationSeconds(45 * 60);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 31 * 60;
  model.teamA.shots = 4;
  model.teamB.shots = 5;

  const winger = model.getPlayers().find((player) => player.team === "A" && player.role === "W");
  const striker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const outlet = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  assert.ok(winger);
  assert.ok(striker);
  assert.ok(outlet);

  winger.pos = { x: RIGHT_PENALTY_X - 8.2, y: 0, z: FIELD_D * 0.215 };
  winger.targetPos = { x: winger.pos.x, z: winger.pos.z };
  striker.pos = { x: RIGHT_PENALTY_X + 1.0, y: 0, z: 2.4 };
  striker.targetPos = { x: striker.pos.x, z: striker.pos.z };
  outlet.pos = { x: winger.pos.x - 6.2, y: 0, z: FIELD_D * 0.13 };
  outlet.targetPos = { x: outlet.pos.x, z: outlet.pos.z };

  for (const player of model.getPlayers()) {
    if (player.id === winger.id || player.id === striker.id || player.id === outlet.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 10 + player.shirtNumber * 0.1 : RIGHT_GOAL_X - 7 - player.shirtNumber * 0.08;
    player.pos.z = player.role === "GK" ? 0 : FIELD_D * 0.34;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = winger;
  model.ball.pos = { x: winger.pos.x, y: 0.18, z: winger.pos.z };
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.52,
    range: (min, max) => (min + max) / 2,
  };

  const passed = (model as unknown as { resolvePass: (carrier: typeof winger, pressure: number) => boolean }).resolvePass(winger, 0.22);
  const latestPassDecision = model.getTuningBundle().passDecisions.at(-1);
  const crossEvent = model.getTuningBundle().events.filter((event) => event.type === "PATTERN_CROSS_EXECUTED").at(-1);

  assert.equal(passed, true);
  assert.equal(latestPassDecision?.passTargetName, striker.name);
  assert.equal(latestPassDecision?.realCross, true);
  assert.equal(crossEvent?.detail?.target, striker.name);
});

test("V209 compressed-runtime half-space carriers still choose final-third deliveries", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v209-compressed-half-space-delivery");
  model.setHalfDurationSeconds(5 * 60);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 31 * 9;
  model.teamA.shots = 6;
  model.teamB.shots = 5;

  const winger = model.getPlayers().find((player) => player.team === "A" && player.role === "W");
  const striker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const outlet = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  assert.ok(winger);
  assert.ok(striker);
  assert.ok(outlet);

  winger.pos = { x: RIGHT_PENALTY_X - 9.6, y: 0, z: FIELD_D * 0.175 };
  winger.targetPos = { x: winger.pos.x, z: winger.pos.z };
  striker.pos = { x: RIGHT_PENALTY_X + 0.6, y: 0, z: 1.9 };
  striker.targetPos = { x: striker.pos.x, z: striker.pos.z };
  outlet.pos = { x: winger.pos.x - 6.8, y: 0, z: FIELD_D * 0.12 };
  outlet.targetPos = { x: outlet.pos.x, z: outlet.pos.z };

  for (const player of model.getPlayers()) {
    if (player.id === winger.id || player.id === striker.id || player.id === outlet.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 10 + player.shirtNumber * 0.1 : RIGHT_GOAL_X - 7 - player.shirtNumber * 0.08;
    player.pos.z = player.role === "GK" ? 0 : FIELD_D * 0.34;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = winger;
  model.ball.pos = { x: winger.pos.x, y: 0.18, z: winger.pos.z };
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.52,
    range: (min, max) => (min + max) / 2,
  };

  const passed = (model as unknown as { resolvePass: (carrier: typeof winger, pressure: number) => boolean }).resolvePass(winger, 0.22);
  const latestPassDecision = model.getTuningBundle().passDecisions.at(-1);
  const crossEvent = model.getTuningBundle().events.filter((event) => event.type === "PATTERN_CROSS_EXECUTED").at(-1);

  assert.equal(passed, true);
  assert.equal(latestPassDecision?.passTargetName, striker.name);
  assert.equal(latestPassDecision?.realCross, true);
  assert.equal(crossEvent?.detail?.target, striker.name);
});

test("V211 compressed wide delivery avoids winger-to-winger cross when central option exists", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v211-compressed-no-winger-cross");
  model.setHalfDurationSeconds(5 * 60);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 33 * 9;
  model.teamA.shots = 7;
  model.teamB.shots = 6;

  const winger = model.getPlayers().find((player) => player.team === "A" && player.role === "W");
  const oppositeWinger = model.getPlayers().filter((player) => player.team === "A" && player.role === "W").find((player) => player.id !== winger?.id);
  const striker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(winger);
  assert.ok(oppositeWinger);
  assert.ok(striker);

  winger.pos = { x: RIGHT_PENALTY_X - 8.4, y: 0, z: FIELD_D * 0.24 };
  winger.targetPos = { x: winger.pos.x, z: winger.pos.z };
  striker.pos = { x: RIGHT_PENALTY_X + 1.2, y: 0, z: 1.7 };
  striker.targetPos = { x: striker.pos.x, z: striker.pos.z };
  oppositeWinger.pos = { x: RIGHT_PENALTY_X + 0.8, y: 0, z: -PENALTY_HALF_Z + 1.2 };
  oppositeWinger.targetPos = { x: oppositeWinger.pos.x, z: oppositeWinger.pos.z };

  for (const player of model.getPlayers()) {
    if (player.id === winger.id || player.id === striker.id || player.id === oppositeWinger.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 10 + player.shirtNumber * 0.08 : RIGHT_GOAL_X - 8 - player.shirtNumber * 0.08;
    player.pos.z = player.role === "GK" ? 0 : FIELD_D * 0.34;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = winger;
  model.ball.pos = { x: winger.pos.x, y: 0.18, z: winger.pos.z };
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.52,
    range: (min, max) => (min + max) / 2,
  };

  const passed = (model as unknown as { resolvePass: (carrier: typeof winger, pressure: number) => boolean }).resolvePass(winger, 0.22);
  const latestPassDecision = model.getTuningBundle().passDecisions.at(-1);

  assert.equal(passed, true);
  assert.equal(latestPassDecision?.passTargetName, striker.name);
  assert.notEqual(latestPassDecision?.passTargetName, oppositeWinger.name);
  assert.equal(latestPassDecision?.realCross, true);
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

    for (let i = 0; i < 20_000; i++) {
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

test("V145 interactive halftime waits for input and snaps second-half kickoff", () => {
  const model = new SimpleMatchModel();
  model.setTeamNames("United States", "Mexico");
  model.setTeamFormations("4-3-3", "4-4-2");
  model.setSeed("v145-halftime-manual");
  model.setHalfDurationSeconds(5);
  model.setInteractiveHalftime(true);
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = model.msm.clock.halfDuration - 0.1;
  model.step(0.25);

  const halftime = model.getMatchSnapshot();
  assert.equal(halftime.phase, "HALFTIME");
  assert.equal(halftime.half, 1);
  const frozenClock = halftime.elapsedInHalf;
  const frozenPlayers = model.getPlayers().map((player) => ({ id: player.id, x: player.pos.x, z: player.pos.z }));

  for (let i = 0; i < 30; i++) model.step(0.25);
  const stillHalftime = model.getMatchSnapshot();
  assert.equal(stillHalftime.phase, "HALFTIME");
  assert.equal(stillHalftime.half, 1);
  assert.equal(stillHalftime.elapsedInHalf, frozenClock);
  for (const before of frozenPlayers) {
    const after = model.getPlayers().find((player) => player.id === before.id);
    assert.ok(after);
    assert.equal(+after.pos.x.toFixed(4), +before.x.toFixed(4));
    assert.equal(+after.pos.z.toFixed(4), +before.z.toFixed(4));
  }

  assert.equal(model.continueFromHalftime("manual"), true);
  const kickoff = model.getMatchSnapshot();
  assert.equal(kickoff.phase, "KICKOFF");
  assert.equal(kickoff.half, 2);
  assert.equal(kickoff.elapsedInHalf, 0);
  assert.equal(+model.ball.pos.x.toFixed(4), 0);
  assert.equal(+model.ball.pos.z.toFixed(4), 0);
  assert.ok(model.eventLog.some((event) => event.action === "HALFTIME_CONTINUE" && event.meta?.mode === "manual"));
});

test("V145 CPU-vs-CPU halftime respects pacing then auto-continues", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v145-halftime-cpu");
  model.setHalfDurationSeconds(5);
  model.setInteractiveHalftime(true);
  model.cpuVsCpu = true;
  model.startMatch();

  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = model.msm.clock.halfDuration - 0.1;
  model.step(0.25);
  assert.equal(model.getMatchSnapshot().phase, "HALFTIME");

  for (let i = 0; i < 12 && model.getMatchSnapshot().phase === "HALFTIME"; i++) model.step(0.25);

  const snapshot = model.getMatchSnapshot();
  assert.equal(snapshot.half, 2);
  assert.notEqual(snapshot.phase, "HALFTIME");
  assert.ok(model.phasePacingTelemetry.some((row) => row.reason === "halftime_break"));
  assert.ok(model.eventLog.some((event) => event.action === "HALFTIME_CONTINUE" && event.meta?.mode === "auto_cpu"));
});

test("V215 dead-ball watchdog releases stalled CPU kickoff and halftime states", () => {
  const kickoffModel = new SimpleMatchModel();
  kickoffModel.cpuVsCpu = true;
  kickoffModel.startMatch();
  kickoffModel["cpuPhasePauseRemaining"] = 999;
  kickoffModel["cpuPhasePauseKey"] = kickoffModel["cpuPhasePauseKeyForCurrentState"]();

  for (let i = 0; i < 40 && kickoffModel.getMatchSnapshot().phase === "KICKOFF"; i++) {
    kickoffModel.step(0.25);
  }

  const kickoffSnapshot = kickoffModel.getMatchSnapshot();
  assert.notEqual(kickoffSnapshot.phase, "KICKOFF", "watchdog must not allow a kickoff pause to stall forever");
  assert.ok(kickoffModel.eventLog.some((event) => event.action === "WATCHDOG" && String(event.detail).includes("kickoff")));

  const halftimeModel = new SimpleMatchModel();
  halftimeModel.cpuVsCpu = true;
  halftimeModel.setInteractiveHalftime(true);
  halftimeModel.startMatch();
  halftimeModel.msm.state = { kind: "halftime" };
  halftimeModel["cpuPhasePauseRemaining"] = 999;
  halftimeModel["cpuPhasePauseKey"] = halftimeModel["cpuPhasePauseKeyForCurrentState"]();

  for (let i = 0; i < 48 && halftimeModel.getMatchSnapshot().phase === "HALFTIME"; i++) {
    halftimeModel.step(0.25);
  }

  const halftimeSnapshot = halftimeModel.getMatchSnapshot();
  assert.notEqual(halftimeSnapshot.phase, "HALFTIME", "watchdog must auto-release a stalled CPU halftime");
  assert.equal(halftimeSnapshot.half, 2);
  assert.ok(halftimeModel.eventLog.some((event) => event.action === "WATCHDOG" && String(event.detail).includes("halftime")));
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

test("BUG-GK-001 keeper smother contact is tight and central saves are catches", () => {
  const model = new SimpleMatchModel();
  model.setSeed("bug-gk-001-catch");
  model.setHalfDurationSeconds(30);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 12;

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const keeper = model.getPlayers().find((player) => player.team === "B" && player.role === "GK");
  assert.ok(attacker);
  assert.ok(keeper);

  attacker.pos.x = RIGHT_GOAL_X - 4.8;
  attacker.pos.z = 0;
  attacker.vel = { x: 0, z: 0 };
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };
  keeper.pos.x = attacker.pos.x + 1.35;
  keeper.pos.z = attacker.pos.z;
  keeper.vel = { x: 0, z: 0 };
  keeper.targetPos = { x: keeper.pos.x, z: keeper.pos.z };
  assert.equal((model as unknown as { hasKeeperSmotherContact: (player: typeof attacker) => boolean }).hasKeeperSmotherContact(attacker), false);
  keeper.pos.x = attacker.pos.x + 0.95;
  assert.equal((model as unknown as { hasKeeperSmotherContact: (player: typeof attacker) => boolean }).hasKeeperSmotherContact(attacker), true);

  keeper.pos.x = RIGHT_GOAL_X - 1.8;
  keeper.pos.z = 0;
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
      context: { forceOnTarget: boolean; forceSave: boolean; reason: string },
    ) => null;
  }).resolveShot(attacker, dist2(attacker.pos, { x: RIGHT_GOAL_X, z: 0 }), 0, {
    forceOnTarget: true,
    forceSave: true,
    reason: "BUG_GK_001_CATCH",
  });

  const bundle = model.getTuningBundle();
  const saveEvent = model.eventLog.filter((event) => event.action === "SAVE").at(-1);
  const telemetrySave = bundle.events.filter((event) => event.type === "SAVE").at(-1);
  const saveFlight = bundle.ballFlightTelemetry.filter((flight) => flight.kind === "save").at(-1);

  assert.equal(saveEvent?.meta?.saveOutcome, "catch");
  assert.equal(telemetrySave?.detail.saveOutcome, "catch");
  assert.equal(saveFlight?.followPlayerName, keeper.name);
  assert.equal(model.possession?.id, keeper.id, "clean central catch must create keeper possession");
});

test("V151 unreachable goalkeeper cannot create a save or corner by stat check", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v151-unreachable-save");
  model.setHalfDurationSeconds(30);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const keeper = model.getPlayers().find((player) => player.team === "B" && player.role === "GK");
  assert.ok(attacker);
  assert.ok(keeper);

  attacker.pos = { x: RIGHT_GOAL_X - 12, y: 0, z: 0 };
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };
  keeper.pos = { x: RIGHT_GOAL_X - 1.8, y: 0, z: 14 };
  keeper.targetPos = { x: keeper.pos.x, z: keeper.pos.z };
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
      context: { forceOnTarget: boolean; reason: string },
    ) => null;
  }).resolveShot(attacker, dist2(attacker.pos, { x: RIGHT_GOAL_X, z: 0 }), 0, {
    forceOnTarget: true,
    reason: "V151_UNREACHABLE_KEEPER",
  });

  const latestSave = model.eventLog.filter((event) => event.action === "SAVE").at(-1);
  const latestGoal = model.eventLog.filter((event) => event.action === "GOAL").at(-1);
  const telemetryGoal = model.getTuningBundle().events.filter((event) => event.type === "GOAL").at(-1);
  const latestShot = model.getTuningBundle().shotDecisions.at(-1);
  assert.equal(latestSave, undefined);
  assert.equal(latestGoal?.action, "GOAL");
  assert.equal(telemetryGoal?.detail.resolutionReason, "V151_UNREACHABLE_KEEPER");
  assert.equal(latestShot?.keeperReachable, false);
});

test("V151 parry corners require reachable keeper contact telemetry", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v151-reachable-parry");
  model.setHalfDurationSeconds(30);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const keeper = model.getPlayers().find((player) => player.team === "B" && player.role === "GK");
  assert.ok(attacker);
  assert.ok(keeper);

  attacker.pos = { x: RIGHT_GOAL_X - 12, y: 0, z: 2.5 };
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };
  keeper.pos = { x: RIGHT_GOAL_X - 1.5, y: 0, z: 1.2 };
  keeper.targetPos = { x: keeper.pos.x, z: keeper.pos.z };
  model.possession = attacker;
  model.ball.pos = { x: attacker.pos.x, y: 0.18, z: attacker.pos.z };
  let roll = 0;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => (roll++ === 0 ? 0.99 : 0.01),
    range: (_min, max) => max,
  };

  (model as unknown as {
    resolveShot: (
      carrier: typeof attacker,
      distToGoal: number,
      pressure: number,
      context: { forceOnTarget: boolean; reason: string },
    ) => null;
  }).resolveShot(attacker, dist2(attacker.pos, { x: RIGHT_GOAL_X, z: 0 }), 0, {
    forceOnTarget: true,
    reason: "V151_REACHABLE_PARRY",
  });

  const saveEvent = model.eventLog.filter((event) => event.action === "SAVE").at(-1);
  const saveFlight = model.getTuningBundle().ballFlightTelemetry.filter((flight) => flight.kind === "save").at(-1);
  assert.equal(saveEvent?.meta?.saveOutcome, "parry_corner");
  assert.equal(saveEvent?.meta?.fieldResolved, true);
  assert.equal(saveEvent?.meta?.contactSource, "keeper_reachable_parry");
  assert.equal(saveEvent?.meta?.keeperReachable, true);
  assert.ok(Number(saveEvent?.meta?.keeperReachDistance) <= Number(saveEvent?.meta?.keeperMaxReach));
  assert.equal(saveFlight?.sourceAction, "keeper_parry_corner");
  assert.equal(saveFlight?.contactSource, "keeper_reachable_parry");
  assert.deepEqual(saveFlight?.contactPoint, saveEvent?.meta?.contactPoint);
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

test("V176 simple model damps early penalty-area conversion bursts", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v176-early-box-conversion-brake");
  model.setHalfDurationSeconds(45 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 14 * 60;
  model.teamA.score = 2;
  model.teamB.score = 1;
  model.msm.score.home = 2;
  model.msm.score.away = 1;

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const keeper = model.getPlayers().find((player) => player.team === "B" && player.role === "GK");
  assert.ok(attacker);
  assert.ok(keeper);
  attacker.pos = { x: RIGHT_GOAL_X - 9.0, y: 0, z: 0.4 };
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };
  attacker.vel = { x: 0, z: 0 };
  keeper.pos = { x: RIGHT_GOAL_X - 1.2, y: 0, z: 0.1 };
  keeper.targetPos = { x: keeper.pos.x, z: keeper.pos.z };
  keeper.vel = { x: 0, z: 0 };
  model.possession = attacker;
  model.ball.pos = { x: attacker.pos.x, y: 0.18, z: attacker.pos.z };
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.20,
    range: (min, max) => (min + max) / 2,
  };

  (model as unknown as {
    resolveShot: (
      carrier: typeof attacker,
      distToGoal: number,
      pressure: number,
      context: { forceOnTarget: boolean; reason: string },
    ) => unknown;
  }).resolveShot(attacker, dist2(attacker.pos, { x: RIGHT_GOAL_X, z: 0 }), 0, {
    forceOnTarget: true,
    reason: "PENALTY_AREA_SHOT",
  });

  const snapshot = model.getMatchSnapshot();
  const latestShot = model.getTuningBundle().shotDecisions.at(-1);
  assert.equal(snapshot.scoreA, 2);
  assert.equal(snapshot.scoreB, 1);
  assert.equal(latestShot?.resolutionReason, "PENALTY_AREA_SHOT");
  assert.ok(Number(latestShot?.earlyBurstGoalMultiplier) < 1);
  assert.ok(Number(latestShot?.goalChance) < 0.20);
});

test("V176 simple model damps extreme early shot-tempo conversion before goals pile up", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v176-early-shot-tempo-brake");
  model.setHalfDurationSeconds(45 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.elapsedInHalf = 4 * 60;
  model.teamA.shots = 4;
  model.teamB.shots = 3;
  model.teamA.shotsOnTarget = 2;
  model.teamB.shotsOnTarget = 1;

  const attacker = model.getPlayers().find((player) => player.team === "B" && player.role === "ST");
  const keeper = model.getPlayers().find((player) => player.team === "A" && player.role === "GK");
  assert.ok(attacker);
  assert.ok(keeper);
  attacker.pos = { x: LEFT_GOAL_X + 9.0, y: 0, z: 0.4 };
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };
  attacker.vel = { x: 0, z: 0 };
  keeper.pos = { x: LEFT_GOAL_X + 1.2, y: 0, z: 0.1 };
  keeper.targetPos = { x: keeper.pos.x, z: keeper.pos.z };
  keeper.vel = { x: 0, z: 0 };
  model.possession = attacker;
  model.ball.pos = { x: attacker.pos.x, y: 0.18, z: attacker.pos.z };
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.15,
    range: (min, max) => (min + max) / 2,
  };

  (model as unknown as {
    resolveShot: (
      carrier: typeof attacker,
      distToGoal: number,
      pressure: number,
      context: { forceOnTarget: boolean; goalChanceMultiplier: number; reason: string },
    ) => unknown;
  }).resolveShot(attacker, dist2(attacker.pos, { x: LEFT_GOAL_X, z: 0 }), 0, {
    forceOnTarget: true,
    goalChanceMultiplier: 0.52,
    reason: "STRIKER_PENALTY_AREA_FORCED_SHOT",
  });

  const snapshot = model.getMatchSnapshot();
  const latestShot = model.getTuningBundle().shotDecisions.at(-1);
  assert.equal(snapshot.scoreA + snapshot.scoreB, 0);
  assert.equal(latestShot?.resolutionReason, "STRIKER_PENALTY_AREA_FORCED_SHOT");
  assert.equal(Number(latestShot?.earlyBurstScoreMultiplier), 1);
  assert.ok(Number(latestShot?.earlyShotTempoMultiplier) < 1);
  assert.ok(Number(latestShot?.goalChance) < 0.15);
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

test("V196 aerial cross delivery can resolve as a counted header shot", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v196-header-shot-from-cross");
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.half = 1;

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(attacker);
  attacker.pos.x = RIGHT_GOAL_X - 9;
  attacker.pos.z = 0.4;
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
      followPlayer?: unknown,
      options?: Record<string, unknown>,
    ) => number;
    updateBallFlight: (dt: number) => void;
  }).startBallFlight("pass", { x: RIGHT_GOAL_X - 18, z: FIELD_D * 0.28 }, attacker.pos, 0.8, 0.9, undefined, {
    aerial: true,
    headerEligible: true,
    sourceAction: "cross",
    attackingTeam: "A",
    receiverId: attacker.id,
  });
  for (let i = 0; i < 120; i++) {
    (model as unknown as { updateBallFlight: (dt: number) => void }).updateBallFlight(1 / 60);
  }

  const bundle = model.getTuningBundle();
  assert.equal(bundle.shotDecisions.at(-1)?.resolutionReason, "HEADER_SHOT");
  assert.equal(bundle.shotDecisions.at(-1)?.sourceAction, "cross");
  assert.ok(model.eventLog.some((event) => event.action === "HEADER_SHOT"));
});

test("V238 compressed header shots damp goal conversion without removing the shot", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v238-compressed-header-goal-damp");
  model.setHalfDurationSeconds(5 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.half = 1;

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(attacker);
  attacker.pos.x = RIGHT_GOAL_X - 9;
  attacker.pos.z = 0.4;
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
      followPlayer?: unknown,
      options?: Record<string, unknown>,
    ) => number;
    updateBallFlight: (dt: number) => void;
  }).startBallFlight("pass", { x: RIGHT_GOAL_X - 18, z: FIELD_D * 0.28 }, attacker.pos, 0.8, 0.9, undefined, {
    aerial: true,
    headerEligible: true,
    sourceAction: "cross",
    attackingTeam: "A",
    receiverId: attacker.id,
  });
  for (let i = 0; i < 120; i++) {
    (model as unknown as { updateBallFlight: (dt: number) => void }).updateBallFlight(1 / 60);
  }

  const shot = model.getTuningBundle().shotDecisions.at(-1);
  const keeper = model.getPlayers().find((player) => player.team === "B" && player.role === "GK");
  assert.ok(keeper);
  const saveGeometry = (model as unknown as {
    keeperSaveGeometry: (
      keeper: any,
      shotOrigin: { x: number; z: number },
      shotTarget: { x: number; z: number },
      shotDistToGoalYards: number,
      pressure: number,
      shotStyle?: string,
    ) => { headerReachGrace?: number };
  }).keeperSaveGeometry(
    keeper,
    { x: attacker.pos.x, z: attacker.pos.z },
    { x: RIGHT_GOAL_X - 0.2, z: 0.1 },
    22.5,
    0.2,
    "HEADER",
  );
  assert.equal(shot?.resolutionReason, "HEADER_SHOT");
  assert.equal(shot?.sourceAction, "cross");
  assert.equal((shot as { compressedHeaderGoalMultiplier?: number } | undefined)?.compressedHeaderGoalMultiplier, 0.72);
  assert.ok((saveGeometry.headerReachGrace || 0) > 0);
  assert.ok(model.getTuningBundle().teamA.shots >= 1);
});

test("V213 compressed dangerous wide cross can resolve as a first-time shot", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v213-first-time-shot-from-cross");
  model.setHalfDurationSeconds(5 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.half = 1;

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "W");
  assert.ok(attacker);
  attacker.pos.x = RIGHT_GOAL_X - 7.8;
  attacker.pos.z = PENALTY_HALF_Z + 2.8;
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };
  for (const defender of model.getPlayers().filter((player) => player.team === "B" && player.role !== "GK")) {
    defender.pos.x = LEFT_GOAL_X + 12;
    defender.pos.z = FIELD_D * 0.32;
    defender.targetPos = { x: defender.pos.x, z: defender.pos.z };
  }
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0,
    range: (min, max) => (min + max) / 2,
  };

  const resolved = (model as unknown as {
    resolveDangerousDeliveryFirstTimeShotOnArrival: (flight: Record<string, unknown>) => boolean;
  }).resolveDangerousDeliveryFirstTimeShotOnArrival({
    kind: "pass",
    from: { x: RIGHT_GOAL_X - 15, z: FIELD_D * 0.25 },
    to: { x: attacker.pos.x, z: attacker.pos.z },
    followPlayerId: attacker.id,
    receiverId: attacker.id,
    aerial: true,
    headerEligible: true,
    sourceAction: "cross",
    attackingTeam: "A",
    arc: 0.72,
  });

  const bundle = model.getTuningBundle();
  assert.equal(resolved, true);
  assert.equal(bundle.shotDecisions.at(-1)?.resolutionReason, "DELIVERY_FIRST_TIME_SHOT");
  assert.equal(bundle.shotDecisions.at(-1)?.sourceAction, "cross");
  assert.ok(bundle.teamA.shots >= 1);
});

test("V197 dangerous cross receptions shorten the next action window", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v197-cross-reception-quick-window");
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };

  const striker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(striker);
  striker.pos.x = RIGHT_PENALTY_X + 1.4;
  striker.pos.z = 0.2;
  striker.targetPos = { x: striker.pos.x, z: striker.pos.z };
  model.ball.pos = { x: striker.pos.x, y: 0.18, z: striker.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 1.35;

  const received = (model as unknown as {
    resolveBallFlightReception: (flight: Record<string, unknown>) => boolean;
  }).resolveBallFlightReception({
    kind: "pass",
    from: { x: striker.pos.x - 6, z: striker.pos.z + 5 },
    to: { x: striker.pos.x, z: striker.pos.z },
    followPlayerId: striker.id,
    aerial: true,
    headerEligible: true,
    sourceAction: "cross",
    settleSeconds: 1.25,
  });

  assert.equal(received, true);
  const actionTimer = (model as unknown as { actionTimer: number }).actionTimer;
  assert.ok(actionTimer <= 0.42, `dangerous cross reception should force a quick decision window, got ${actionTimer.toFixed(2)}`);
});

test("V199 dangerous delivery continuation prefers a forward second action", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v199-delivery-continuation-forward");
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.half = 1;

  const winger = model.getPlayers().find((player) => player.team === "A" && player.role === "W");
  const striker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const outlet = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  assert.ok(winger);
  assert.ok(striker);
  assert.ok(outlet);

  winger.pos = { x: RIGHT_PENALTY_X - 5.2, y: 0, z: FIELD_D * 0.22 };
  winger.targetPos = { x: winger.pos.x, z: winger.pos.z };
  striker.pos = { x: RIGHT_PENALTY_X + 1.4, y: 0, z: 2.1 };
  striker.targetPos = { x: striker.pos.x, z: striker.pos.z };
  outlet.pos = { x: winger.pos.x - 5.5, y: 0, z: FIELD_D * 0.12 };
  outlet.targetPos = { x: outlet.pos.x, z: outlet.pos.z };

  for (const player of model.getPlayers()) {
    if (player.id === winger.id || player.id === striker.id || player.id === outlet.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 9 + player.shirtNumber * 0.08 : RIGHT_GOAL_X - 8 - player.shirtNumber * 0.08;
    player.pos.z = player.role === "GK" ? 0 : FIELD_D * 0.34;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = winger;
  model.ball.pos = { x: winger.pos.x, y: 0.18, z: winger.pos.z };
  (model as unknown as { actionTimer: number; visualReceptionSettleRemaining: number; visualReceptionPlayerId: string | null }).actionTimer = 0;

  const received = (model as unknown as {
    resolveBallFlightReception: (flight: Record<string, unknown>) => boolean;
  }).resolveBallFlightReception({
    kind: "pass",
    from: { x: winger.pos.x - 6, z: winger.pos.z + 4 },
    to: { x: winger.pos.x, z: winger.pos.z },
    followPlayerId: winger.id,
    aerial: true,
    headerEligible: true,
    sourceAction: "cross",
    settleSeconds: 1.1,
  });

  assert.equal(received, true);
  assert.equal((model as unknown as { deliveryContinuationPlayerId: string | null }).deliveryContinuationPlayerId, winger.id);
  assert.ok((model as unknown as { deliveryContinuationRemaining: number }).deliveryContinuationRemaining >= 1);
  assert.equal((model as unknown as {
    isDeliveryContinuationCarrier: (carrier: typeof winger, distToGoal: number) => boolean;
  }).isDeliveryContinuationCarrier(winger, dist2(winger.pos, { x: RIGHT_GOAL_X, z: 0 })), true);

  const passed = (model as unknown as {
    resolvePass: (carrier: typeof winger, pressure: number, options: { minProgress: number; preferForward: boolean; reason: string }) => boolean;
  }).resolvePass(winger, 0.22, { minProgress: 0, preferForward: true, reason: "DELIVERY_CONTINUATION" });
  const latestPassDecision = model.getTuningBundle().passDecisions.at(-1);
  assert.equal(passed, true);
  assert.equal(latestPassDecision?.passContextReason, "DELIVERY_CONTINUATION");
  assert.equal(latestPassDecision?.passTargetName, striker.name);
  assert.notEqual(latestPassDecision?.passTargetName, outlet.name);
});

test("V212 compressed dangerous delivery disruption still records a shot opportunity", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v212-delivery-disruption-opportunity");
  model.setHalfDurationSeconds(5 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };

  const striker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const defender = model.getPlayers().find((player) => player.team === "B" && player.role === "CB");
  assert.ok(striker);
  assert.ok(defender);

  striker.pos = { x: RIGHT_PENALTY_X + 1.0, y: 0, z: 1.1 };
  striker.targetPos = { x: striker.pos.x, z: striker.pos.z };
  striker.vel = { x: 0, z: 0 };
  defender.pos = { x: striker.pos.x + 0.6, y: 0, z: striker.pos.z + 0.2 };
  defender.targetPos = { x: defender.pos.x, z: defender.pos.z };
  defender.vel = { x: 0, z: 0 };

  for (const player of model.getPlayers()) {
    if (player.id === striker.id || player.id === defender.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 12 + player.shirtNumber * 0.08 : RIGHT_GOAL_X - 10 - player.shirtNumber * 0.08;
    player.pos.z = player.role === "GK" ? 0 : FIELD_D * 0.34;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
    player.vel = { x: 0, z: 0 };
  }

  model.possession = striker;
  model.ball.pos = { x: striker.pos.x, y: 0.18, z: striker.pos.z };
  (model as unknown as { deliveryContinuationPlayerId: string | null }).deliveryContinuationPlayerId = striker.id;
  (model as unknown as { deliveryContinuationRemaining: number }).deliveryContinuationRemaining = 1.1;
  let roll = 0;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => (roll++ === 0 ? 0.99 : 0),
    range: (min, max) => (min + max) / 2,
  };

  const disrupted = (model as unknown as {
    resolvePressureDuel: (carrier: typeof striker, pressure: number) => boolean;
  }).resolvePressureDuel(striker, 1.1);
  const latestOpportunity = model.getTuningBundle().shotOpportunities.at(-1);

  assert.equal(disrupted, true);
  assert.equal(latestOpportunity?.outcome, "delivery_disrupted");
  assert.equal(latestOpportunity?.reason, "DELIVERY_CONTINUATION_PRESSURE_DUEL");
});

test("V216 compressed dangerous header touch seeds a fast second-action window", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v216-dangerous-header-touch-follow");
  model.setHalfDurationSeconds(5 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };

  const striker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  assert.ok(striker);

  striker.pos = { x: RIGHT_PENALTY_X + 1.8, y: 0, z: 0.9 };
  striker.targetPos = { x: striker.pos.x, z: striker.pos.z };
  model.possession = striker;
  model.ball.pos = { x: striker.pos.x, y: 0.64, z: striker.pos.z };
  (model as unknown as { actionTimer: number }).actionTimer = 0.52;

  (model as unknown as {
    performHeaderTouch: (
      player: typeof striker,
      flight: Record<string, unknown>,
      contact: { x: number; z: number },
      contactGap: number,
    ) => void;
  }).performHeaderTouch(striker, {
    kind: "pass",
    from: { x: RIGHT_GOAL_X - 8, z: 6 },
    to: { x: striker.pos.x, z: striker.pos.z },
    followPlayerId: striker.id,
    receiverId: striker.id,
    aerial: true,
    headerEligible: true,
    sourceAction: "cross",
    attackingTeam: "A",
    elapsed: 0,
    duration: 0.85,
    arc: 0.82,
  }, { x: striker.pos.x, z: striker.pos.z }, 0.08);

  assert.equal((model as unknown as { deliveryContinuationPlayerId: string | null }).deliveryContinuationPlayerId, striker.id);
  assert.ok((model as unknown as { deliveryContinuationRemaining: number }).deliveryContinuationRemaining >= 1.25);
  assert.equal(Number(((model as unknown as { actionTimer: number }).actionTimer).toFixed(2)), 0.14);
});

test("V200 underproducing full-length possession shortens non-box action cadence", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v200-underproducing-cadence");
  model.setHalfDurationSeconds(45 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  (model as unknown as { elapsedTotal: number }).elapsedTotal = 13 * 60;

  const cm = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  assert.ok(cm);
  cm.pos = { x: 0, y: 0, z: 6 };
  cm.targetPos = { x: cm.pos.x, z: cm.pos.z };
  model.possession = cm;
  model.teamA.shots = 6;
  model.teamB.shots = 7;
  model.teamA.passes = 82;
  model.teamB.passes = 101;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.5,
    range: (min, max) => (min + max) / 2,
  };

  const underproducingDelay = (model as unknown as { nextActionDelay: () => number }).nextActionDelay();

  model.teamA.shots = 14;
  model.teamB.shots = 14;
  model.teamA.passes = 180;
  model.teamB.passes = 181;
  const healthyDelay = (model as unknown as { nextActionDelay: () => number }).nextActionDelay();

  assert.ok(underproducingDelay < healthyDelay, `underproducing cadence should be shorter, got ${underproducingDelay.toFixed(2)} vs ${healthyDelay.toFixed(2)}`);
});

test("V202 full-length outfield cadence resolves faster in advanced zones than in buildup", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v202-full-length-zone-cadence");
  model.setHalfDurationSeconds(45 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  (model as unknown as { elapsedTotal: number }).elapsedTotal = 18 * 60;
  model.teamA.shots = 6;
  model.teamB.shots = 7;
  model.teamA.passes = 96;
  model.teamB.passes = 101;

  const winger = model.getPlayers().find((player) => player.team === "A" && player.role === "W");
  assert.ok(winger);
  model.possession = winger;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.5,
    range: (min, max) => (min + max) / 2,
  };

  winger.pos = { x: -5, y: 0, z: 12 };
  winger.targetPos = { x: winger.pos.x, z: winger.pos.z };
  const buildupDelay = (model as unknown as { nextActionDelay: () => number }).nextActionDelay();

  winger.pos = { x: 11, y: 0, z: 11 };
  winger.targetPos = { x: winger.pos.x, z: winger.pos.z };
  const progressionDelay = (model as unknown as { nextActionDelay: () => number }).nextActionDelay();

  winger.pos = { x: 19, y: 0, z: 8 };
  winger.targetPos = { x: winger.pos.x, z: winger.pos.z };
  const chanceDelay = (model as unknown as { nextActionDelay: () => number }).nextActionDelay();

  assert.ok(progressionDelay < buildupDelay, `progression cadence should be quicker than buildup, got ${progressionDelay.toFixed(2)} vs ${buildupDelay.toFixed(2)}`);
  assert.ok(chanceDelay < progressionDelay, `chance cadence should be quicker than progression, got ${chanceDelay.toFixed(2)} vs ${progressionDelay.toFixed(2)}`);
});

test("V237 compressed outfield cadence stays normal-time and still resolves faster in advanced zones", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v237-compressed-cadence-by-zone");
  model.setHalfDurationSeconds(5 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  assert.ok(carrier);
  model.possession = carrier;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.5,
    range: (min, max) => (min + max) / 2,
  };

  carrier.pos = { x: -5, y: 0, z: 12 };
  carrier.targetPos = { x: carrier.pos.x, z: carrier.pos.z };
  const buildupDelay = (model as unknown as { nextActionDelay: () => number }).nextActionDelay();

  carrier.pos = { x: 11, y: 0, z: 11 };
  carrier.targetPos = { x: carrier.pos.x, z: carrier.pos.z };
  const progressionDelay = (model as unknown as { nextActionDelay: () => number }).nextActionDelay();

  carrier.pos = { x: 19, y: 0, z: 8 };
  carrier.targetPos = { x: carrier.pos.x, z: carrier.pos.z };
  const chanceDelay = (model as unknown as { nextActionDelay: () => number }).nextActionDelay();

  assert.ok(buildupDelay >= 5.5, `compressed buildup cadence should stay in normal-time seconds, got ${buildupDelay.toFixed(2)}`);
  assert.ok(buildupDelay > progressionDelay, `compressed buildup should resolve slower than progression, got ${buildupDelay.toFixed(2)} vs ${progressionDelay.toFixed(2)}`);
  assert.ok(progressionDelay > chanceDelay, `compressed progression should resolve slower than chance creation, got ${progressionDelay.toFixed(2)} vs ${chanceDelay.toFixed(2)}`);
});

test("V217 buildup carriers prefer a nearby continuation outlet over a speculative long target", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v217-buildup-link-target");
  model.setHalfDurationSeconds(5 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  const outlet = model.getPlayers().find((player) => player.team === "A" && player.role === "FB");
  const speculative = model.getPlayers().find((player) => player.team === "A" && player.role === "W");
  assert.ok(carrier);
  assert.ok(outlet);
  assert.ok(speculative);

  carrier.pos = { x: -7, y: 0, z: 0 };
  carrier.targetPos = { x: carrier.pos.x, z: carrier.pos.z };
  outlet.pos = { x: -2.5, y: 0, z: 4.2 };
  outlet.targetPos = { x: outlet.pos.x, z: outlet.pos.z };
  speculative.pos = { x: 10.5, y: 0, z: 12.4 };
  speculative.targetPos = { x: speculative.pos.x, z: speculative.pos.z };
  for (const player of model.getPlayers()) {
    if (player.id === carrier.id || player.id === outlet.id || player.id === speculative.id) continue;
    player.pos = { x: player.team === "A" ? LEFT_GOAL_X + 4 : RIGHT_GOAL_X - 4, y: 0, z: FIELD_D * 0.34 };
    player.targetPos = { x: player.pos.x, z: player.pos.z };
  }
  model.possession = carrier;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.5,
    range: (min, max) => (min + max) / 2,
  };

  const target = (model as unknown as {
    bestPassTarget: (carrier: any) => typeof outlet | null;
  }).bestPassTarget(carrier);

  assert.equal(target?.id, outlet.id);
});

test("V218 buildup/progression support shape steps a nearby outlet toward the carrier", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v218-buildup-support-shape");
  model.setHalfDurationSeconds(5 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  const target = model.getPlayers().find((player) => player.team === "A" && player.role === "FB");
  assert.ok(carrier);
  assert.ok(target);

  for (const player of model.getPlayers()) {
    if (player.id === carrier.id || player.id === target.id) continue;
    player.pos = { x: player.team === "A" ? LEFT_GOAL_X + 4 : RIGHT_GOAL_X - 4, y: 0, z: FIELD_D * 0.34 };
    player.targetPos = { x: player.pos.x, z: player.pos.z };
  }
  carrier.pos = { x: -6.5, y: 0, z: 0 };
  carrier.targetPos = { x: carrier.pos.x, z: carrier.pos.z };
  target.pos = { x: target.homePos.x, y: 0, z: target.homePos.z };
  target.targetPos = { x: target.homePos.x, z: target.homePos.z };
  model.possession = carrier;
  const homeGap = Math.hypot(target.homePos.x - carrier.pos.x, target.homePos.z - carrier.pos.z);
  (model as unknown as { updateTargets: () => void }).updateTargets();
  const targetGap = Math.hypot(target.targetPos.x - carrier.pos.x, target.targetPos.z - carrier.pos.z);

  assert.ok(targetGap < homeGap - 1.2, `support outlet should step toward buildup carrier, gap only moved from ${homeGap.toFixed(2)} to ${targetGap.toFixed(2)}`);
});

test("V223 full-length underproducing buildup carriers prefer a nearby continuation outlet", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v223-full-length-buildup-link-target");
  model.setHalfDurationSeconds(45 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  (model as unknown as { elapsedTotal: number }).elapsedTotal = 18 * 60;
  model.teamA.passes = 72;
  model.teamB.passes = 76;

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  const outlet = model.getPlayers().find((player) => player.team === "A" && player.role === "FB");
  const speculative = model.getPlayers().find((player) => player.team === "A" && player.role === "W");
  assert.ok(carrier);
  assert.ok(outlet);
  assert.ok(speculative);

  carrier.pos = { x: -8, y: 0, z: 0 };
  carrier.targetPos = { x: carrier.pos.x, z: carrier.pos.z };
  outlet.pos = { x: -3.6, y: 0, z: 4.0 };
  outlet.targetPos = { x: outlet.pos.x, z: outlet.pos.z };
  speculative.pos = { x: 11.5, y: 0, z: 12.8 };
  speculative.targetPos = { x: speculative.pos.x, z: speculative.pos.z };
  for (const player of model.getPlayers()) {
    if (player.id === carrier.id || player.id === outlet.id || player.id === speculative.id) continue;
    player.pos = { x: player.team === "A" ? LEFT_GOAL_X + 4 : RIGHT_GOAL_X - 4, y: 0, z: FIELD_D * 0.34 };
    player.targetPos = { x: player.pos.x, z: player.pos.z };
  }
  model.possession = carrier;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.5,
    range: (min, max) => (min + max) / 2,
  };

  const target = (model as unknown as {
    bestPassTarget: (carrier: any) => typeof outlet | null;
  }).bestPassTarget(carrier);

  assert.equal(target?.id, outlet.id);
});

test("V224 full-length underproducing buildup support steps a nearby outlet toward the carrier", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v224-full-length-buildup-support-shape");
  model.setHalfDurationSeconds(45 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  (model as unknown as { elapsedTotal: number }).elapsedTotal = 18 * 60;
  model.teamA.passes = 74;
  model.teamB.passes = 78;

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  const target = model.getPlayers().find((player) => player.team === "A" && player.role === "FB");
  assert.ok(carrier);
  assert.ok(target);

  for (const player of model.getPlayers()) {
    if (player.id === carrier.id || player.id === target.id) continue;
    player.pos = { x: player.team === "A" ? LEFT_GOAL_X + 4 : RIGHT_GOAL_X - 4, y: 0, z: FIELD_D * 0.34 };
    player.targetPos = { x: player.pos.x, z: player.pos.z };
  }
  carrier.pos = { x: -7.5, y: 0, z: 0 };
  carrier.targetPos = { x: carrier.pos.x, z: carrier.pos.z };
  target.pos = { x: target.homePos.x, y: 0, z: target.homePos.z };
  target.targetPos = { x: target.homePos.x, z: target.homePos.z };
  model.possession = carrier;
  const homeGap = Math.hypot(target.homePos.x - carrier.pos.x, target.homePos.z - carrier.pos.z);
  (model as unknown as { updateTargets: () => void }).updateTargets();
  const targetGap = Math.hypot(target.targetPos.x - carrier.pos.x, target.targetPos.z - carrier.pos.z);

  assert.ok(targetGap < homeGap - 0.8, `full-length support outlet should step toward buildup carrier, gap only moved from ${homeGap.toFixed(2)} to ${targetGap.toFixed(2)}`);
});

test("V236 full-length continuation support also activates when completed passes lag even if attempts are healthy", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v236-full-length-completion-lag-gate");
  model.setHalfDurationSeconds(45 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  (model as unknown as { elapsedTotal: number }).elapsedTotal = 18 * 60;
  model.teamA.passes = 190;
  model.teamB.passes = 192;
  model.teamA.passesCompleted = 140;
  model.teamB.passesCompleted = 142;

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  const outlet = model.getPlayers().find((player) => player.team === "A" && player.role === "FB");
  const speculative = model.getPlayers().find((player) => player.team === "A" && player.role === "W");
  assert.ok(carrier);
  assert.ok(outlet);
  assert.ok(speculative);

  carrier.pos = { x: -8, y: 0, z: 0 };
  carrier.targetPos = { x: carrier.pos.x, z: carrier.pos.z };
  outlet.pos = { x: -3.6, y: 0, z: 4.0 };
  outlet.targetPos = { x: outlet.pos.x, z: outlet.pos.z };
  speculative.pos = { x: 11.5, y: 0, z: 12.8 };
  speculative.targetPos = { x: speculative.pos.x, z: speculative.pos.z };
  for (const player of model.getPlayers()) {
    if (player.id === carrier.id || player.id === outlet.id || player.id === speculative.id) continue;
    player.pos = { x: player.team === "A" ? LEFT_GOAL_X + 4 : RIGHT_GOAL_X - 4, y: 0, z: FIELD_D * 0.34 };
    player.targetPos = { x: player.pos.x, z: player.pos.z };
  }
  model.possession = carrier;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.5,
    range: (min, max) => (min + max) / 2,
  };

  const target = (model as unknown as {
    bestPassTarget: (carrier: any) => typeof outlet | null;
  }).bestPassTarget(carrier);

  assert.equal(target?.id, outlet.id);
});

test("V225 full-length diagnostics count no-safe-outlet pass fails", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v225-full-length-no-safe-outlet");
  model.setHalfDurationSeconds(45 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  (model as unknown as { elapsedTotal: number }).elapsedTotal = 18 * 60;

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  assert.ok(carrier);
  carrier.pos = { x: -10, y: 0, z: 0 };
  carrier.targetPos = { x: carrier.pos.x, z: carrier.pos.z };
  model.possession = carrier;
  for (const player of model.getPlayers()) {
    if (player.id === carrier.id) continue;
    player.pos = { x: RIGHT_GOAL_X - 1.2, y: 0, z: player.team === "A" ? FIELD_D * 0.46 : -FIELD_D * 0.46 };
    player.targetPos = { x: player.pos.x, z: player.pos.z };
  }

  const passed = (model as unknown as { resolvePass: (carrier: any, pressure: number, options?: any) => boolean }).resolvePass(carrier, 0.55, { reason: "V225_TEST" });
  const diag = model.getTuningBundle().fullLengthPossessionDiagnostics;

  assert.equal(passed, false);
  assert.equal(diag.noSafeOutletPassFails, 1);
  assert.equal(diag.samples.at(-1)?.kind, "no_safe_outlet_pass_fail");
});

test("V226 full-length diagnostics count speculative pass interceptions", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v226-full-length-speculative-interception");
  model.setHalfDurationSeconds(45 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  (model as unknown as { elapsedTotal: number }).elapsedTotal = 18 * 60;

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  const target = model.getPlayers().find((player) => player.team === "A" && player.role === "W");
  const interceptor = model.getPlayers().find((player) => player.team === "B" && player.role === "CB");
  assert.ok(carrier);
  assert.ok(target);
  assert.ok(interceptor);
  carrier.pos = { x: -8, y: 0, z: 0 };
  carrier.targetPos = { x: carrier.pos.x, z: carrier.pos.z };
  target.pos = { x: 10.5, y: 0, z: 4.2 };
  target.targetPos = { x: target.pos.x, z: target.pos.z };
  interceptor.pos = { x: 10.2, y: 0, z: 4.0 };
  interceptor.targetPos = { x: interceptor.pos.x, z: interceptor.pos.z };
  for (const player of model.getPlayers()) {
    if (player.id === carrier.id || player.id === target.id || player.id === interceptor.id) continue;
    player.pos = { x: player.team === "A" ? LEFT_GOAL_X + 2 : RIGHT_GOAL_X - 2, y: 0, z: FIELD_D * 0.35 };
    player.targetPos = { x: player.pos.x, z: player.pos.z };
  }
  model.possession = carrier;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.99,
    range: (min, max) => (min + max) / 2,
  };

  const passed = (model as unknown as { resolvePass: (carrier: any, pressure: number, options?: any) => boolean }).resolvePass(carrier, 0.35, { reason: "V226_TEST", preferForward: true });
  const diag = model.getTuningBundle().fullLengthPossessionDiagnostics;

  assert.equal(passed, true);
  assert.equal(diag.speculativePassInterceptions, 1);
  assert.equal(diag.speculativeInterceptionDistanceBands.gte18, 1);
  assert.equal(diag.speculativeInterceptionSeparationBands.lt2_5, 1);
  assert.equal(diag.samples.at(-1)?.kind, "speculative_pass_interception");
  assert.equal(diag.samples.at(-1)?.distance, 18.97);
  assert.equal(diag.samples.at(-1)?.receiverSeparation, 0.36);
});

test("V230 full-length speculative interception diagnostics bucket medium-range safer gaps separately", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v230-full-length-interception-bands");
  model.setHalfDurationSeconds(45 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  (model as unknown as { elapsedTotal: number }).elapsedTotal = 18 * 60;

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  const target = model.getPlayers().find((player) => player.team === "A" && player.role === "FB");
  const interceptor = model.getPlayers().find((player) => player.team === "B" && player.role === "CB");
  assert.ok(carrier);
  assert.ok(target);
  assert.ok(interceptor);
  carrier.pos = { x: -8, y: 0, z: 0 };
  carrier.targetPos = { x: carrier.pos.x, z: carrier.pos.z };
  target.pos = { x: 8.4, y: 0, z: 3.6 };
  target.targetPos = { x: target.pos.x, z: target.pos.z };
  interceptor.pos = { x: 12.1, y: 0, z: 3.8 };
  interceptor.targetPos = { x: interceptor.pos.x, z: interceptor.pos.z };
  for (const player of model.getPlayers()) {
    if (player.id === carrier.id || player.id === target.id || player.id === interceptor.id) continue;
    player.pos = { x: player.team === "A" ? LEFT_GOAL_X + 2 : RIGHT_GOAL_X - 2, y: 0, z: FIELD_D * 0.35 };
    player.targetPos = { x: player.pos.x, z: player.pos.z };
  }
  model.possession = carrier;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.99,
    range: (min, max) => (min + max) / 2,
  };

  const passed = (model as unknown as { resolvePass: (carrier: any, pressure: number, options?: any) => boolean }).resolvePass(carrier, 0.35, { reason: "V230_TEST", preferForward: true });
  const diag = model.getTuningBundle().fullLengthPossessionDiagnostics;
  const sample = diag.samples.at(-1) as Record<string, unknown> | undefined;
  const sampleDistance = Number(sample?.distance || 0);
  const sampleSeparation = Number(sample?.receiverSeparation || 0);

  assert.equal(passed, true);
  assert.equal(diag.speculativePassInterceptions, 1);
  assert.ok(sampleDistance >= 14 && sampleDistance < 18, `expected medium speculative distance band, got ${sampleDistance}`);
  assert.ok(sampleSeparation >= 2.5 && sampleSeparation < 4.5, `expected mid separation band, got ${sampleSeparation}`);
  if (sampleDistance < 16) assert.equal(diag.speculativeInterceptionDistanceBands.y14_16, 1);
  else assert.equal(diag.speculativeInterceptionDistanceBands.y16_18, 1);
  if (sampleSeparation < 3.5) assert.equal(diag.speculativeInterceptionSeparationBands.y2_5_3_5, 1);
  else assert.equal(diag.speculativeInterceptionSeparationBands.y3_5_4_5, 1);
});

test("V227 full-length diagnostics count non-danger terminal shots", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v227-full-length-terminal-shot");
  model.setHalfDurationSeconds(45 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  (model as unknown as { elapsedTotal: number }).elapsedTotal = 18 * 60;

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  assert.ok(carrier);
  carrier.pos = { x: 14, y: 0, z: 0 };
  carrier.targetPos = { x: carrier.pos.x, z: carrier.pos.z };
  model.possession = carrier;

  (model as unknown as { resolveShot: (carrier: any, distToGoal: number, pressure: number, context?: any) => unknown }).resolveShot(
    carrier,
    dist2(carrier.pos, { x: RIGHT_GOAL_X, z: 0 }),
    0.45,
    { reason: "V227_TEST" },
  );

  const diag = model.getTuningBundle().fullLengthPossessionDiagnostics;
  assert.equal(diag.nonDangerTerminalShots, 1);
  assert.equal(diag.samples.at(-1)?.kind, "non_danger_terminal_shot");
});

test("V228 full-length underproducing buildup avoids long tightly-marked speculative targets", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v228-full-length-defender-aware-outlet");
  model.setHalfDurationSeconds(45 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  (model as unknown as { elapsedTotal: number }).elapsedTotal = 18 * 60;
  model.teamA.passes = 70;
  model.teamB.passes = 75;

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  const outlet = model.getPlayers().find((player) => player.team === "A" && player.role === "FB");
  const speculative = model.getPlayers().find((player) => player.team === "A" && player.role === "W");
  const marker = model.getPlayers().find((player) => player.team === "B" && player.role === "CB");
  assert.ok(carrier);
  assert.ok(outlet);
  assert.ok(speculative);
  assert.ok(marker);

  carrier.pos = { x: -8, y: 0, z: 0 };
  carrier.targetPos = { x: carrier.pos.x, z: carrier.pos.z };
  outlet.pos = { x: -3.8, y: 0, z: 4.1 };
  outlet.targetPos = { x: outlet.pos.x, z: outlet.pos.z };
  speculative.pos = { x: 10.5, y: 0, z: 4.3 };
  speculative.targetPos = { x: speculative.pos.x, z: speculative.pos.z };
  marker.pos = { x: 10.8, y: 0, z: 4.1 };
  marker.targetPos = { x: marker.pos.x, z: marker.pos.z };
  for (const player of model.getPlayers()) {
    if (player.id === carrier.id || player.id === outlet.id || player.id === speculative.id || player.id === marker.id) continue;
    player.pos = { x: player.team === "A" ? LEFT_GOAL_X + 3 : RIGHT_GOAL_X - 3, y: 0, z: FIELD_D * 0.34 };
    player.targetPos = { x: player.pos.x, z: player.pos.z };
  }
  model.possession = carrier;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.5,
    range: (min, max) => (min + max) / 2,
  };

  const target = (model as unknown as {
    bestPassTarget: (carrier: any) => typeof outlet | null;
  }).bestPassTarget(carrier);

  assert.equal(target?.id, outlet.id);
});

test("V229 full-length underproducing medium continuation passes get a completion edge", () => {
  const makeModel = () => {
    const model = new SimpleMatchModel();
    model.setHalfDurationSeconds(45 * 60);
    model.startMatch();
    model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
    const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
    const target = model.getPlayers().find((player) => player.team === "A" && player.role === "FB");
    const marker = model.getPlayers().find((player) => player.team === "B" && player.role !== "GK");
    assert.ok(carrier);
    assert.ok(target);
    assert.ok(marker);
    carrier.pos = { x: -8, y: 0, z: 0 };
    carrier.targetPos = { x: carrier.pos.x, z: carrier.pos.z };
    target.pos = { x: 5.2, y: 0, z: 3.7 };
    target.targetPos = { x: target.pos.x, z: target.pos.z };
    for (const player of model.getPlayers()) {
      if (player.id === carrier.id || player.id === target.id || player.id === marker.id) continue;
      player.pos = { x: player.team === "A" ? LEFT_GOAL_X + 3 : RIGHT_GOAL_X - 3, y: 0, z: FIELD_D * 0.34 };
      player.targetPos = { x: player.pos.x, z: player.pos.z };
    }
    marker.pos = { x: target.pos.x + 2.55, y: 0, z: target.pos.z + 0.1 };
    marker.targetPos = { x: marker.pos.x, z: marker.pos.z };
    model.possession = carrier;
    (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
      next: () => 0.5,
      range: (min, max) => (min + max) / 2,
    };
    return { model, carrier };
  };

  const underproducing = makeModel();
  (underproducing.model as unknown as { elapsedTotal: number }).elapsedTotal = 18 * 60;
  underproducing.model.teamA.passes = 70;
  underproducing.model.teamB.passes = 75;
  underproducing.model.teamA.passesCompleted = 50;
  underproducing.model.teamB.passesCompleted = 54;
  (underproducing.model as unknown as { resolvePass: (carrier: any, pressure: number, options?: any) => boolean }).resolvePass(underproducing.carrier, 0.35, { reason: "V229_UNDER" });
  const underChance = Number((underproducing.model.getTuningBundle().passDecisions.at(-1) as any)?.completionChance || 0);

  const healthy = makeModel();
  (healthy.model as unknown as { elapsedTotal: number }).elapsedTotal = 18 * 60;
  healthy.model.teamA.passes = 190;
  healthy.model.teamB.passes = 192;
  healthy.model.teamA.passesCompleted = 154;
  healthy.model.teamB.passesCompleted = 156;
  (healthy.model as unknown as { resolvePass: (carrier: any, pressure: number, options?: any) => boolean }).resolvePass(healthy.carrier, 0.35, { reason: "V229_HEALTHY" });
  const healthyChance = Number((healthy.model.getTuningBundle().passDecisions.at(-1) as any)?.completionChance || 0);

  assert.ok(underChance > healthyChance, `underproducing medium continuation pass should get a completion edge, got ${underChance.toFixed(2)} vs ${healthyChance.toFixed(2)}`);
});

test("V231 full-length safe 16-18u continuation passes get an extra completion edge", () => {
  const makeModel = () => {
    const model = new SimpleMatchModel();
    model.setHalfDurationSeconds(45 * 60);
    model.startMatch();
    model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
    const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
    const target = model.getPlayers().find((player) => player.team === "A" && player.role === "FB");
    const marker = model.getPlayers().find((player) => player.team === "B" && player.role !== "GK");
    assert.ok(carrier);
    assert.ok(target);
    assert.ok(marker);
    carrier.pos = { x: -8, y: 0, z: 0 };
    carrier.targetPos = { x: carrier.pos.x, z: carrier.pos.z };
    target.pos = { x: 8.8, y: 0, z: 3.4 };
    target.targetPos = { x: target.pos.x, z: target.pos.z };
    for (const player of model.getPlayers()) {
      if (player.id === carrier.id || player.id === target.id || player.id === marker.id) continue;
      player.pos = { x: player.team === "A" ? LEFT_GOAL_X + 3 : RIGHT_GOAL_X - 3, y: 0, z: FIELD_D * 0.34 };
      player.targetPos = { x: player.pos.x, z: player.pos.z };
    }
    marker.pos = { x: target.pos.x + 4.7, y: 0, z: target.pos.z + 0.1 };
    marker.targetPos = { x: marker.pos.x, z: marker.pos.z };
    model.possession = carrier;
    (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
      next: () => 0.5,
      range: (min, max) => (min + max) / 2,
    };
    return { model, carrier };
  };

  const underproducing = makeModel();
  (underproducing.model as unknown as { elapsedTotal: number }).elapsedTotal = 18 * 60;
  underproducing.model.teamA.passes = 70;
  underproducing.model.teamB.passes = 75;
  underproducing.model.teamA.passesCompleted = 50;
  underproducing.model.teamB.passesCompleted = 54;
  (underproducing.model as unknown as { resolvePass: (carrier: any, pressure: number, options?: any) => boolean }).resolvePass(underproducing.carrier, 0.35, { reason: "V231_UNDER" });
  const underChance = Number((underproducing.model.getTuningBundle().passDecisions.at(-1) as any)?.completionChanceExact || 0);

  const healthy = makeModel();
  (healthy.model as unknown as { elapsedTotal: number }).elapsedTotal = 18 * 60;
  healthy.model.teamA.passes = 190;
  healthy.model.teamB.passes = 192;
  healthy.model.teamA.passesCompleted = 154;
  healthy.model.teamB.passesCompleted = 156;
  (healthy.model as unknown as { resolvePass: (carrier: any, pressure: number, options?: any) => boolean }).resolvePass(healthy.carrier, 0.35, { reason: "V231_HEALTHY" });
  const healthyChance = Number((healthy.model.getTuningBundle().passDecisions.at(-1) as any)?.completionChanceExact || 0);

  assert.ok(underChance > healthyChance, `underproducing safe 16-18u continuation pass should get an extra edge, got ${underChance.toFixed(4)} vs ${healthyChance.toFixed(4)}`);
});

test("V233 full-length safe 16-18u continuation passes can clear the reach gate after a missed base roll", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v233-safe-medium-long-reach-gate");
  model.setHalfDurationSeconds(45 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  (model as unknown as { elapsedTotal: number }).elapsedTotal = 18 * 60;
  model.teamA.passes = 70;
  model.teamB.passes = 75;

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  const target = model.getPlayers().find((player) => player.team === "A" && player.role === "FB");
  const marker = model.getPlayers().find((player) => player.team === "B" && player.role !== "GK");
  assert.ok(carrier);
  assert.ok(target);
  assert.ok(marker);
  carrier.pos = { x: -8, y: 0, z: 0 };
  carrier.targetPos = { x: carrier.pos.x, z: carrier.pos.z };
  target.pos = { x: 8.8, y: 0, z: 3.4 };
  target.targetPos = { x: target.pos.x, z: target.pos.z };
  marker.pos = { x: target.pos.x + 4.7, y: 0, z: target.pos.z + 0.1 };
  marker.targetPos = { x: marker.pos.x, z: marker.pos.z };
  for (const player of model.getPlayers()) {
    if (player.id === carrier.id || player.id === target.id || player.id === marker.id) continue;
    player.pos = { x: player.team === "A" ? LEFT_GOAL_X + 3 : RIGHT_GOAL_X - 3, y: 0, z: FIELD_D * 0.34 };
    player.targetPos = { x: player.pos.x, z: player.pos.z };
  }
  model.possession = carrier;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.99,
    range: (min, max) => (min + max) / 2,
  };

  const passed = (model as unknown as { resolvePass: (carrier: any, pressure: number, options?: any) => boolean }).resolvePass(carrier, 0.35, { reason: "V233_TEST" });
  const latest = model.getTuningBundle().passDecisions.at(-1) as Record<string, unknown> | undefined;

  assert.equal(passed, true);
  assert.equal(model.possession?.id, target.id);
  assert.equal(latest?.completed, true);
  assert.equal(latest?.completionResolution, "reach_gate");
});

test("V235 full-length buildup carriers avoid speculative direct striker balls when a shorter continuation outlet exists", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v235-buildup-direct-striker-penalty");
  model.setHalfDurationSeconds(45 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  (model as unknown as { elapsedTotal: number }).elapsedTotal = 18 * 60;
  model.teamA.passes = 70;
  model.teamB.passes = 75;

  const carrier = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  const outlet = model.getPlayers().find((player) => player.team === "A" && player.role === "FB");
  const striker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const marker = model.getPlayers().find((player) => player.team === "B" && player.role === "CB");
  assert.ok(carrier);
  assert.ok(outlet);
  assert.ok(striker);
  assert.ok(marker);

  carrier.pos = { x: -8, y: 0, z: 0 };
  carrier.targetPos = { x: carrier.pos.x, z: carrier.pos.z };
  outlet.pos = { x: -2.8, y: 0, z: 4.2 };
  outlet.targetPos = { x: outlet.pos.x, z: outlet.pos.z };
  striker.pos = { x: 8.4, y: 0, z: 2.4 };
  striker.targetPos = { x: striker.pos.x, z: striker.pos.z };
  marker.pos = { x: striker.pos.x + 5.2, y: 0, z: striker.pos.z + 0.2 };
  marker.targetPos = { x: marker.pos.x, z: marker.pos.z };
  for (const player of model.getPlayers()) {
    if (player.id === carrier.id || player.id === outlet.id || player.id === striker.id || player.id === marker.id) continue;
    player.pos = { x: player.team === "A" ? LEFT_GOAL_X + 3 : RIGHT_GOAL_X - 8, y: 0, z: player.team === "A" ? FIELD_D * 0.34 : -FIELD_D * 0.4 };
    player.targetPos = { x: player.pos.x, z: player.pos.z };
  }
  model.possession = carrier;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.5,
    range: (min, max) => (min + max) / 2,
  };

  const target = (model as unknown as {
    bestPassTarget: (carrier: any) => typeof outlet | null;
  }).bestPassTarget(carrier);

  assert.equal(target?.id, outlet.id);
});

test("V205 defenders collapse toward a live danger carrier instead of staying passive", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v205-danger-collapse");
  model.setHalfDurationSeconds(45 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const defender = model.getPlayers().find((player) => player.team === "B" && player.role === "CB");
  assert.ok(attacker);
  assert.ok(defender);

  attacker.pos = { x: RIGHT_GOAL_X - 9, y: 0, z: 1.2 };
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };
  model.possession = attacker;
  model.ball.pos = { x: attacker.pos.x, y: 0.18, z: attacker.pos.z };

  defender.pos = { x: defender.homePos.x, y: 0, z: defender.homePos.z };
  defender.targetPos = { x: defender.homePos.x, z: defender.homePos.z };

  const homeGap = Math.hypot(defender.homePos.x - attacker.pos.x, defender.homePos.z - attacker.pos.z);
  (model as unknown as { updateTargets: () => void }).updateTargets();
  const targetGap = Math.hypot(defender.targetPos.x - attacker.pos.x, defender.targetPos.z - attacker.pos.z);

  assert.ok(targetGap < homeGap - 1.5, `defender should collapse toward danger carrier, gap only moved from ${homeGap.toFixed(2)} to ${targetGap.toFixed(2)}`);
});

test("V214 box-emergency defending pulls an extra center-back into the corridor", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v214-box-emergency-collapse");
  model.setHalfDurationSeconds(45 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const defenders = model.getPlayers().filter((player) => player.team === "B" && player.role === "CB");
  assert.ok(attacker);
  assert.ok(defenders.length >= 2);
  const supportCb = defenders[1];

  attacker.pos = { x: RIGHT_GOAL_X - 6.8, y: 0, z: 1.4 };
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };
  model.possession = attacker;
  model.ball.pos = { x: attacker.pos.x, y: 0.18, z: attacker.pos.z };

  supportCb.pos = { x: supportCb.homePos.x, y: 0, z: supportCb.homePos.z };
  supportCb.targetPos = { x: supportCb.homePos.x, z: supportCb.homePos.z };

  const homeGap = Math.hypot(supportCb.homePos.x - attacker.pos.x, supportCb.homePos.z - attacker.pos.z);
  (model as unknown as { updateTargets: () => void }).updateTargets();
  const targetGap = Math.hypot(supportCb.targetPos.x - attacker.pos.x, supportCb.targetPos.z - attacker.pos.z);

  assert.ok(targetGap < homeGap - 3.5, `support center-back should collapse sharply in box emergency, gap only moved from ${homeGap.toFixed(2)} to ${targetGap.toFixed(2)}`);
  assert.ok(Math.abs(supportCb.targetPos.z - attacker.pos.z) < Math.abs(supportCb.homePos.z - attacker.pos.z), "support center-back should narrow toward the shot corridor");
});

test("V219 near-box live danger pulls an extra midfielder into the box corridor", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v219-box-occupancy-collapse");
  model.setHalfDurationSeconds(5 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const midfielder = model.getPlayers().find((player) => player.team === "B" && player.role === "CM");
  assert.ok(attacker);
  assert.ok(midfielder);

  attacker.pos = { x: RIGHT_GOAL_X - 9.5, y: 0, z: 2.2 };
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };
  model.possession = attacker;
  model.ball.pos = { x: attacker.pos.x, y: 0.18, z: attacker.pos.z };

  midfielder.pos = { x: midfielder.homePos.x, y: 0, z: midfielder.homePos.z };
  midfielder.targetPos = { x: midfielder.homePos.x, z: midfielder.homePos.z };

  const homeGap = Math.hypot(midfielder.homePos.x - attacker.pos.x, midfielder.homePos.z - attacker.pos.z);
  (model as unknown as { updateTargets: () => void }).updateTargets();
  const targetGap = Math.hypot(midfielder.targetPos.x - attacker.pos.x, midfielder.targetPos.z - attacker.pos.z);

  assert.ok(targetGap < homeGap - 2.5, `support midfielder should collapse toward the box lane, gap only moved from ${homeGap.toFixed(2)} to ${targetGap.toFixed(2)}`);
  assert.ok(Math.abs(midfielder.targetPos.z - attacker.pos.z) < Math.abs(midfielder.homePos.z - attacker.pos.z), "support midfielder should narrow toward the shot corridor");
});

test("V220 near-box live danger pulls a second support defender into the corridor", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v220-second-box-body");
  model.setHalfDurationSeconds(5 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const fullback = model.getPlayers().find((player) => player.team === "B" && player.role === "FB");
  assert.ok(attacker);
  assert.ok(fullback);

  attacker.pos = { x: RIGHT_GOAL_X - 9.2, y: 0, z: -2.4 };
  attacker.targetPos = { x: attacker.pos.x, z: attacker.pos.z };
  model.possession = attacker;
  model.ball.pos = { x: attacker.pos.x, y: 0.18, z: attacker.pos.z };

  fullback.pos = { x: fullback.homePos.x, y: 0, z: fullback.homePos.z };
  fullback.targetPos = { x: fullback.homePos.x, z: fullback.homePos.z };

  const homeGap = Math.hypot(fullback.homePos.x - attacker.pos.x, fullback.homePos.z - attacker.pos.z);
  (model as unknown as { updateTargets: () => void }).updateTargets();
  const targetGap = Math.hypot(fullback.targetPos.x - attacker.pos.x, fullback.targetPos.z - attacker.pos.z);

  assert.ok(targetGap < homeGap - 2.0, `support fullback should also collapse toward the box lane, gap only moved from ${homeGap.toFixed(2)} to ${targetGap.toFixed(2)}`);
  assert.ok(Math.abs(fullback.targetPos.z - attacker.pos.z) < Math.abs(fullback.homePos.z - attacker.pos.z), "support fullback should narrow toward the shot corridor");
});

test("V181 repeated early corner headers are damped before a set-piece goal cluster", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v181-repeat-corner-header-damp");
  model.setHalfDurationSeconds(45 * 60);
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };
  model.msm.clock.half = 1;
  model.msm.clock.elapsedInHalf = 5 * 60;
  model.teamA.score = 2;
  model.msm.score.home = 2;
  model.goalLog.push({
    team: "A",
    playerName: "A ST 10",
    scorer: "A ST 10",
    shirtNumber: 10,
    role: "ST",
    matchMinute: 3,
    elapsedInHalf: 3 * 60,
    distToGoal: 4.3,
    distToGoalYards: 7.9,
    carrierDistToGoal: 4.3,
    carrierBallGap: 0,
    maxGoalDistanceYards: 46,
    invalidGoalGeometry: false,
    resolutionReason: "HEADER_SHOT",
    goalChance: 0.36,
    shotTarget: { x: RIGHT_GOAL_X, z: 0 },
    netTarget: { x: RIGHT_GOAL_X + GOAL_FLOOR_DEPTH * 0.75, z: 0 },
    shotBacked: true,
    sourceAction: "corner",
  });

  const attacker = model.getPlayers().find((player) => player.team === "A" && player.role === "ST");
  const keeper = model.getPlayers().find((player) => player.team === "B" && player.role === "GK");
  assert.ok(attacker);
  assert.ok(keeper);
  const contact = { x: RIGHT_GOAL_X - 4.3, z: 0 };
  attacker.pos = { x: contact.x, y: 0, z: contact.z };
  attacker.targetPos = { x: contact.x, z: contact.z };
  keeper.pos = { x: RIGHT_GOAL_X - 1.4, y: 0, z: 0 };
  keeper.targetPos = { x: keeper.pos.x, z: keeper.pos.z };
  for (const player of model.getPlayers()) {
    if (player.id === attacker.id || player.id === keeper.id) continue;
    player.pos = { x: player.team === "A" ? LEFT_GOAL_X + 8 : LEFT_GOAL_X + 12, y: 0, z: FIELD_D * 0.35 };
    player.targetPos = { x: player.pos.x, z: player.pos.z };
  }
  let roll = 0;
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => (roll++ === 0 ? 0 : 0.2),
    range: (min, max) => (min + max) / 2,
  };

  (model as unknown as {
    performHeaderShot: (
      player: typeof attacker,
      flight: Record<string, unknown>,
      contact: { x: number; z: number },
      contactGap: number,
    ) => void;
  }).performHeaderShot(attacker, {
    kind: "restart",
    from: { x: RIGHT_GOAL_X - 0.1, z: FIELD_D / 2 },
    to: contact,
    followPlayerId: attacker.id,
    aerial: true,
    headerEligible: true,
    sourceAction: "corner",
    attackingTeam: "A",
    elapsed: 0,
    duration: 0.8,
    arc: 1.05,
  }, contact, 0);

  const latestShot = model.getTuningBundle().shotDecisions.at(-1);
  assert.equal(model.getMatchSnapshot().scoreA, 2, "repeat early corner header should not add a third early goal on this roll");
  assert.equal(latestShot?.resolutionReason, "HEADER_SHOT");
  assert.equal(latestShot?.sourceAction, "corner");
  assert.ok(Number(latestShot?.setPieceHeaderGoalMultiplier) < 0.4);
  assert.ok(Number(latestShot?.goalChance) < 0.16);
});

test("V190 corner restarts expose varied elevated delivery profiles", () => {
  const seen = new Set<string>();
  const arcs: number[] = [];

  for (const [seed, roll] of [["v190-corner-driven", 0.1], ["v190-corner-medium", 0.3], ["v190-corner-looped", 0.9]] as const) {
    const model = new SimpleMatchModel();
    model.setSeed(seed);
    model.startMatch();
    model.msm.state = { kind: "ball_out", restartType: "corner", restartTeam: "home" };
    model.msm.restartTimer = 2.4;
    model.msm.clock.elapsedInHalf = 18;
    model.ball.pos = { x: RIGHT_GOAL_X + 1, y: 0.18, z: FIELD_D / 2 + 1 };
    (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
      next: () => roll,
      range: (min, max) => (min + max) / 2,
    };
    (model as unknown as {
      installBallOutRestart: (context: {
        restartType: "corner";
        restartTeam: "A";
        spot: { x: number; z: number };
        lastTouchTeam: "B";
        lastTouchPlayerId: string | null;
        crossedLine: "right_goal_line";
      }) => void;
    }).installBallOutRestart({
      restartType: "corner",
      restartTeam: "A",
      spot: { x: RIGHT_GOAL_X + 1, z: FIELD_D / 2 + 1 },
      lastTouchTeam: "B",
      lastTouchPlayerId: null,
      crossedLine: "right_goal_line",
    });
    for (let i = 0; i < 900 && (model.msm.state as { kind: string }).kind === "ball_out"; i++) {
      model.step(1 / 60);
      model.updateVisuals(1 / 60);
    }
    const release = model.eventLog.filter((event) => event.action === "CORNER" && event.meta?.phase === "release").at(-1);
    assert.ok(release, "corner release event must exist");
    seen.add(String(release?.meta?.cornerDeliveryStyle ?? ""));
    arcs.push(Number(release?.meta?.arcHeight));
  }

  assert.ok(seen.has("DRIVEN"), `corner variety missing DRIVEN delivery: ${Array.from(seen).join(",")}`);
  assert.ok(seen.has("MEDIUM_ARC"), `corner variety missing MEDIUM_ARC delivery: ${Array.from(seen).join(",")}`);
  assert.ok(seen.has("LOOPED"), `corner variety missing LOOPED delivery: ${Array.from(seen).join(",")}`);
  assert.ok(Math.min(...arcs) >= 0.84, `corner arcs must stay elevated, got min ${Math.min(...arcs).toFixed(2)}`);
  assert.ok(Math.max(...arcs) >= 1.3, `corner arcs must include high looping service, got max ${Math.max(...arcs).toFixed(2)}`);
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

test("V155 aerial headed touches count as visible headers even without a shot or clearance", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v155-header-touch");
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
    next: () => 0.99,
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
  assert.equal(bundle.teamA.headerShots, 0);
  assert.equal(bundle.teamA.headerClearances, 0);
  assert.equal(bundle.headerLog.at(-1)?.type, "touch");
  assert.ok(model.eventLog.some((event) => event.action === "HEADER_TOUCH"));
});

test("V155 long aerial restarts can create midfield headed touches", () => {
  const model = new SimpleMatchModel();
  model.setSeed("v155-midfield-header-touch");
  model.startMatch();
  model.msm.state = { kind: "live_play", half: 1, startTick: 0 };

  const receiver = model.getPlayers().find((player) => player.team === "A" && player.role === "CM");
  assert.ok(receiver);
  receiver.pos.x = 0;
  receiver.pos.z = 0;
  receiver.targetPos = { x: 0, z: 0 };
  for (const player of model.getPlayers()) {
    if (player.id === receiver.id) continue;
    player.pos.x = player.team === "A" ? LEFT_GOAL_X + 8 : RIGHT_GOAL_X - 8;
    player.pos.z = player.role === "GK" ? 0 : 12;
    player.targetPos = { x: player.pos.x, z: player.pos.z };
  }
  (model as unknown as { rng: { next: () => number; range: (min: number, max: number) => number } }).rng = {
    next: () => 0.01,
    range: (min, max) => (min + max) / 2,
  };

  (model as unknown as {
    startBallFlight: (
      kind: string,
      from: { x: number; z: number },
      to: { x: number; z: number },
      duration: number,
      arc: number,
      followPlayer?: typeof receiver,
      options?: Record<string, unknown>,
    ) => number;
    updateBallFlight: (dt: number) => void;
  }).startBallFlight("restart", { x: LEFT_GOAL_X + 2, z: 0 }, receiver.pos, 0.8, 0.9, receiver, {
    aerial: true,
    headerEligible: true,
    sourceAction: "goal_kick_long",
    attackingTeam: "A",
    receiverId: receiver.id,
  });
  for (let i = 0; i < 120; i++) {
    (model as unknown as { updateBallFlight: (dt: number) => void }).updateBallFlight(1 / 60);
  }

  const bundle = model.getTuningBundle();
  assert.equal(model.getMatchSnapshot().headersA, 1);
  assert.equal(bundle.teamA.headerShots, 0);
  assert.equal(bundle.teamA.headerClearances, 0);
  assert.equal(bundle.headerLog.at(-1)?.sourceAction, "goal_kick_long");
  assert.equal(bundle.headerLog.at(-1)?.type, "touch");
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
