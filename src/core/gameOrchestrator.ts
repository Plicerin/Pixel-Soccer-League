import type {
  Vec2,
  Vec3,
  TeamSide,
  PlayerRole,
  PlayerIntent,
  PlayerBelief,
  BallBelief,
  MatchBelief,
  TacticalBlackboard,
  BallCommand,
  BallState,
  IntentName,
} from "./types";
import {
  FIELD_W,
  FIELD_D,
  LEFT_GOAL_X,
  RIGHT_GOAL_X,
  GOAL_MOUTH_HALF_Z,
  GOAL_HEIGHT,
  GAME_SPEED_SCALE,
  BASE_RUN_SPEED,
  SPRINT_MULTIPLIER,
  dist2,
  isInFieldOfPlay,
  isInPenaltyArea,
  clamp,
} from "./constants";
import {
  MatchStateMachine,
  MatchClock,
  createMatchStateMachine,
  advanceMatchState,
  BallOutEvent,
  GoalEvent,
} from "./matchStateMachine";
import {
  RawPlayerState,
  RawBallState,
  buildPlayerBelief,
  buildBallBelief,
  buildMatchBelief,
  computeBallZone,
  inferPhaseOfPlay,
  computePossessionTeam,
  findCarrier,
  findPlayerById,
  teammates,
  opponents,
  nearestOpponent,
} from "./beliefState";
import {
  BallPhysicsState,
  PlayerContactInfo,
  createBallPhysicsState,
  executeBallCommand,
  updateBallPhysics,
  computePassSpeed,
  computeShotSpeed,
  computeArcHeight,
  isBallInGoalMouth,
} from "./ballPhysics";
import {
  MotionResult,
  intentTarget,
  intentUrgency,
  intentSpeedMultiplier,
  applyMotionWithCollision,
} from "./motionLayer";
import {
  createBlackboard,
  markPossessionChange,
  advanceTransitionAge,
  isAttackingPhase,
  isDefendingPhase,
} from "./blackboard";
import {
  TeamTacticalState,
  TeamTacticalConfig,
  createTeamTacticalState,
  createDefaultTacticalConfig,
  updateTeamTacticalService,
} from "../ai/teamTacticalService";
import {
  PlayerControllerState,
  createPlayerControllerState,
  buildOutfielderBT,
  tickPlayerController,
} from "../ai/playerController";
import {
  computeKickoffReceiverSpot,
  isKickoffPassSafe,
} from "../ai/restartAndDefenseRules";
import {
  buildGKBehaviorTree,
  tickGKController,
  createGKControllerState,
} from "../ai/goalkeeperController";

export type OrchestratorPlayer = {
  id: string;
  team: TeamSide;
  role: PlayerRole;
  pos: Vec2;
  vel: Vec2;
  prevPos: Vec2;
  facingRad: number;
  stamina01: number;
  hasBall: boolean;
  isGK: boolean;
  ratings: PlayerBelief["ratings"];
  speed: number;
  acceleration: number;
};

export type OrchestratorConfig = {
  homeAttackSign: 1 | -1;
  halfDuration: number;
  teamServiceHz: number;
  playerControllerHz: number;
  homeConfig?: Partial<TeamTacticalConfig>;
  awayConfig?: Partial<TeamTacticalConfig>;
};

export type OrchestratorEvent =
  | { kind: "goal"; team: TeamSide }
  | { kind: "ball_out"; restartType: "throw_in" | "goal_kick" | "corner" | "free_kick"; restartTeam: TeamSide }
  | { kind: "possession_change"; newTeam: TeamSide }
  | { kind: "pass"; fromId: string; toId: string; type: string }
  | { kind: "shot"; playerId: string; style: string; onTarget: boolean }
  | { kind: "tackle"; winnerId: string; loserId: string }
  | { kind: "clearance"; playerId: string }
  | { kind: "save"; keeperId: string }
  | { kind: "interception"; playerId: string }
  | { kind: "offside"; team: TeamSide };

export type TickResult = {
  players: Array<{
    id: string;
    pos: Vec2;
    vel: Vec2;
    facingRad: number;
    hasBall: boolean;
    intent: IntentName | null;
  }>;
  ball: {
    pos: Vec3;
    vel: Vec3;
    state: BallState;
    ownerPlayerId: string | null;
    ownerTeam: TeamSide | null;
  };
  matchState: MatchStateMachine["state"];
  clock: MatchClock;
  score: { home: number; away: number };
  events: OrchestratorEvent[];
  blackboards: { home: TacticalBlackboard; away: TacticalBlackboard };
};

export type GameOrchestrator = {
  tick(dt: number, elapsed: number): TickResult;
  reset(): void;
  setAttackSigns(home: 1 | -1): void;
  setHalfDuration(seconds: number): void;
  getMatchState(): MatchStateMachine;
  getBallState(): BallPhysicsState;
  getPlayers(): OrchestratorPlayer[];
  getPlayerControllers(): Map<string, PlayerControllerState>;
  getTeamTactical(team: TeamSide): TeamTacticalState;
  injectBallCommand(cmd: BallCommand): void;
  setPlayerPosition(playerId: string, pos: Vec2): void;
  giveBallToPlayer(playerId: string): void;
  protectRestartReceive(input: {
    receiverId: string;
    receiverTarget: Vec2;
    holdSeconds?: number;
    kickerId?: string;
    kickerTarget?: Vec2;
  }): void;
  forceMatchState(state: MatchStateMachine["state"]): void;
  resetMotionLog(): void;
};

export function createGameOrchestrator(
  initialPlayers: OrchestratorPlayer[],
  config: OrchestratorConfig,
): GameOrchestrator {
  let players = initialPlayers.map(p => ({ ...p, prevPos: { ...p.pos } }));
  let ball = createBallPhysicsState();
  let msm = createMatchStateMachine(config.halfDuration);
  let homeAttackSign: 1 | -1 = config.homeAttackSign;
  let awayAttackSign: 1 | -1 = (homeAttackSign * -1) as -1 | 1;
  let elapsed = 0;

  let homeTactical = createTeamTacticalState("home", config.homeConfig);
  let awayTactical = createTeamTacticalState("away", config.awayConfig);

  const outfieldBT = buildOutfielderBT();

  const playerControllers = new Map<string, PlayerControllerState>();
  for (const p of players) {
    if (p.isGK) {
      playerControllers.set(p.id, createGKControllerState(p.id));
    } else {
      playerControllers.set(p.id, createPlayerControllerState(p.id, config.playerControllerHz));
    }
  }

  let pendingBallCommand: BallCommand | null = null;
  let lastPossessionTeam: TeamSide | null = null;
  let _firstMotionLogged = false;
  let kickoffProtectionUntil = 0;
  let kickoffProtectionTargets = new Map<string, Vec2>();

  const kickoffRolePriority: Record<PlayerRole, number> = {
    GK: 99,
    CB_L: 8,
    CB_R: 8,
    LB: 7,
    RB: 7,
    DM: 6,
    CM_L: 4,
    CM_R: 4,
    AM: 2,
    LW: 5,
    RW: 5,
    ST: 1,
  };

  function buildRawPlayers(team: TeamSide): RawPlayerState[] {
    return players
      .filter(p => p.team === team)
      .map(p => ({
        id: p.id,
        team: p.team,
        role: p.role,
        x: p.pos.x,
        z: p.pos.z,
        prevX: p.prevPos.x,
        prevZ: p.prevPos.z,
        facingRad: p.facingRad,
        stamina01: p.stamina01,
        hasBall: p.hasBall,
        isGK: p.isGK,
        ratings: p.ratings,
      }));
  }

  function buildRawBall(): RawBallState {
    return {
      x: ball.pos.x,
      z: ball.pos.z,
      y: ball.pos.y,
      prevX: ball.pos.x - ball.vel.x * 0.016,
      prevZ: ball.pos.z - ball.vel.z * 0.016,
      velY: ball.vel.y,
      ownerPlayerId: ball.ownerPlayerId,
      ownerTeam: ball.ownerTeam,
      state: ball.state === "attached" ? "loose" : ball.state,
    };
  }

  function buildBelief(): MatchBelief {
    const matchMinute = (msm.clock.elapsedInHalf / msm.clock.halfDuration) * 45;
    const scoreDiff = msm.score.home - msm.score.away;
    return buildMatchBelief(
      buildRawPlayers("home"),
      buildRawPlayers("away"),
      buildRawBall(),
      0.016,
      matchMinute,
      scoreDiff,
      homeAttackSign,
    );
  }

  function tickPlayerAI(
    p: OrchestratorPlayer,
    belief: MatchBelief,
    blackboard: TacticalBlackboard,
  ): PlayerIntent | null {
    const playerBelief = belief.homePlayers.find(bp => bp.id === p.id)
      ?? belief.awayPlayers.find(bp => bp.id === p.id);
    if (!playerBelief) return null;

    const ctrl = playerControllers.get(p.id);
    if (!ctrl) return null;

    if (p.isGK) {
      const gkCtrl = ctrl as PlayerControllerState;
      const result = tickGKController(gkCtrl, playerBelief, belief, blackboard, 0.016);
      if (result) {
        playerControllers.set(p.id, result.newState);
        return result.intent;
      }
      return null;
    }

    const outCtrl = ctrl as PlayerControllerState;
    const result = tickPlayerController(outCtrl, playerBelief, belief, blackboard, outfieldBT, 0.016);
    if (result) {
      playerControllers.set(p.id, result.newState);
      return result.intent;
    }
    return null;
  }

  function intentToBallCommand(
    intent: PlayerIntent,
    player: OrchestratorPlayer,
  ): BallCommand | null {
    switch (intent.name) {
      case "pass": {
        const target = players.find(p => p.id === intent.targetPlayerId);
        if (!target) return null;
        const speed = computePassSpeed(dist2(player.pos, target.pos), intent.type);
        return {
          kind: "pass",
          from: player.pos,
          to: intent.targetPoint,
          speed,
          type: intent.type,
          intendedReceiverId: target.id,
          intendedTeam: player.team,
        };
      }
      case "shoot": {
        const speed = computeShotSpeed(player.ratings.shooting);
        const goalCenter: Vec2 = player.team === "home"
          ? { x: RIGHT_GOAL_X, z: 0 }
          : { x: LEFT_GOAL_X, z: 0 };
        const target = intent.target.x !== 0 || intent.target.z !== 0 ? intent.target : goalCenter;
        const d = dist2(player.pos, target);
        const arc = computeArcHeight(d, "shot");
        return {
          kind: "shot",
          from: player.pos,
          target,
          speed,
          style: intent.style,
          arcHeight: arc,
        };
      }
      case "carry":
        return { kind: "dribble", attachedToPlayerId: player.id, offset: { x: 0.3, z: 0 } };
      case "clear": {
        const speed = BASE_RUN_SPEED * GAME_SPEED_SCALE * 2.5;
        return { kind: "clear", from: player.pos, direction: intent.direction, speed };
      }
      case "goalkeeper_distribute": {
        const target = players.find(p => p.id === intent.targetPlayerId);
        if (!target) return null;
        if (intent.type === "throw") {
          const speed = computePassSpeed(dist2(player.pos, target.pos), "short");
          return {
            kind: "pass",
            from: player.pos,
            to: intent.targetPoint,
            speed,
            type: "short",
            intendedReceiverId: target.id,
            intendedTeam: player.team,
          };
        }
        const speed = computePassSpeed(dist2(player.pos, target.pos), "long");
        const d = dist2(player.pos, target.pos);
        const arc = computeArcHeight(d, "long");
        return {
          kind: "launch",
          from: player.pos,
          to: intent.targetPoint,
          speed,
          arcHeight: arc,
          intendedReceiverId: target.id,
          intendedTeam: player.team,
        };
      }
      default:
        return null;
    }
  }

  function detectGoal(): GoalEvent | null {
    const result = isBallInGoalMouth(ball.pos.x, ball.pos.z, ball.pos.y);
    if (!result) return null;
    const scoringSide: TeamSide = result.team;
    return { scoringTeam: scoringSide };
  }

  function detectBallOut(): BallOutEvent | null {
    if (ball.state === "attached") return null;
    if (isInFieldOfPlay({ x: ball.pos.x, z: ball.pos.z })) return null;

    const pos: Vec2 = { x: ball.pos.x, z: ball.pos.z };

    const homeDefendingLeft = homeAttackSign > 0;

    if (pos.x > RIGHT_GOAL_X || pos.x < LEFT_GOAL_X) {
      if (Math.abs(pos.z) < GOAL_MOUTH_HALF_Z) return null;
    }

    const lastTouchPlayer = ball.lastHeldById
      ? players.find(p => p.id === ball.lastHeldById)
      : null;
    const lastTeam = ball.ownerTeam ?? lastTouchPlayer?.team ?? ball.intendedTeam;
    const ballX = pos.x;

    if (ballX > FIELD_W / 2) {
      const attackingTeam: TeamSide = homeDefendingLeft ? "home" : "away";
      const defendingTeam: TeamSide = attackingTeam === "home" ? "away" : "home";
      if (lastTeam === attackingTeam) {
        return { restartType: "goal_kick", restartTeam: defendingTeam };
      } else if (lastTeam === defendingTeam) {
        return { restartType: "corner", restartTeam: attackingTeam };
      }
      return { restartType: "goal_kick", restartTeam: defendingTeam };
    }

    if (ballX < -FIELD_W / 2) {
      const attackingTeam: TeamSide = homeDefendingLeft ? "away" : "home";
      const defendingTeam: TeamSide = attackingTeam === "home" ? "away" : "home";
      if (lastTeam === attackingTeam) {
        return { restartType: "goal_kick", restartTeam: defendingTeam };
      } else if (lastTeam === defendingTeam) {
        return { restartType: "corner", restartTeam: attackingTeam };
      }
      return { restartType: "goal_kick", restartTeam: defendingTeam };
    }

    if (pos.z > FIELD_D / 2 || pos.z < -FIELD_D / 2) {
      const restartTeam = lastTeam === "home" ? "away" : lastTeam === "away" ? "home" : "home";
      return { restartType: "throw_in", restartTeam };
    }

    return null;
  }

  function giveBallToPlayerInternal(playerId: string): void {
    const p = players.find(pl => pl.id === playerId);
    if (!p) return;
    for (const pl of players) pl.hasBall = false;
    p.hasBall = true;
    ball.state = "attached";
    ball.ownerPlayerId = playerId;
    ball.ownerTeam = p.team;
    ball.pos = { x: p.pos.x, y: 0.15, z: p.pos.z };
    ball.vel = { x: 0, y: 0, z: 0 };
  }

  function pickKickoffKicker(team: TeamSide): OrchestratorPlayer | null {
    const center = { x: 0, z: 0 };
    const candidates = players
      .filter(p => p.team === team && !p.isGK)
      .sort((a, b) => {
        const roleDelta = kickoffRolePriority[a.role] - kickoffRolePriority[b.role];
        if (roleDelta !== 0) return roleDelta;
        return dist2(a.pos, center) - dist2(b.pos, center);
      });
    return candidates[0] ?? null;
  }

  function pickKickoffReceiver(team: TeamSide, kickerId: string): OrchestratorPlayer | null {
    const center = { x: 0, z: 0 };
    const candidates = players
      .filter(p => p.team === team && !p.isGK && p.id !== kickerId)
      .sort((a, b) => {
        const roleDelta = kickoffRolePriority[a.role] - kickoffRolePriority[b.role];
        if (roleDelta !== 0) return roleDelta;
        return dist2(a.pos, center) - dist2(b.pos, center);
      });
    return candidates[0] ?? null;
  }

  function executeSafeKickoffRestart(team: TeamSide): void {
    const kicker = pickKickoffKicker(team);
    if (!kicker) return;
    kickoffProtectionUntil = 0;
    kickoffProtectionTargets.clear();
    const attackDirection = team === "home" ? homeAttackSign : awayAttackSign;
    const center = { x: 0, z: 0 };
    const receiver = pickKickoffReceiver(team, kicker.id);

    kicker.pos = { x: 0, z: 0 };
    kicker.prevPos = { ...kicker.pos };
    kicker.vel = { x: 0, z: 0 };

    let stagedTarget: Vec2 = { x: attackDirection * 3.2, z: 3.4 };
    if (receiver) {
      stagedTarget = computeKickoffReceiverSpot({
        center,
        attackDirection,
        receiver: receiver.pos,
        fieldDepth: FIELD_D,
      });
      if (!isKickoffPassSafe({ center, target: stagedTarget, attackDirection, maxDistance: 8.0 })) {
        stagedTarget = { x: attackDirection * 3.2, z: receiver.pos.z >= 0 ? 3.4 : -3.4 };
      }
      receiver.pos = { ...stagedTarget };
      receiver.prevPos = { ...receiver.pos };
      receiver.vel = { x: 0, z: 0 };
    }

    giveBallToPlayerInternal(kicker.id);
    kickoffProtectionTargets = new Map<string, Vec2>([[kicker.id, { ...center }]]);

    if (!receiver) return;

    kickoffProtectionTargets.set(receiver.id, { ...stagedTarget });
    kickoffProtectionUntil = elapsed + 0.7;
    const kickoffDist = dist2(center, stagedTarget);
    const passSpeed = clamp(kickoffDist * 2.2 + 2.5, 6.5, 9.5);
    executeBallCommand(ball, {
      kind: "pass",
      from: center,
      to: stagedTarget,
      speed: passSpeed,
      type: "layoff",
      intendedReceiverId: receiver.id,
      intendedTeam: team,
    }, elapsed);
    kicker.hasBall = false;
    ball.ownerPlayerId = null;
    ball.ownerTeam = null;
  }

  function tick(dt: number, now: number): TickResult {
    const events: OrchestratorEvent[] = [];

  if (msm.state.kind === "full_time") {
    return buildResult(events);
  }

  if (msm.state.kind === "pre_match" || msm.state.kind === "kickoff") {
    const kickoffTeam = msm.state.kind === "kickoff" ? msm.state.team : "home";
    msm = advanceMatchState(msm, dt, null, null);
    if (msm.state.kind === "kickoff") {
      msm = advanceMatchState(msm, dt, null, null);
    }
    if (msm.state.kind === "live_play") {
      executeSafeKickoffRestart(kickoffTeam);
    }
    return buildResult(events);
  }

  if (msm.state.kind === "ball_out" || msm.state.kind === "goal_scored" || msm.state.kind === "halftime") {
    const prevKind = msm.state.kind;
    const restartTeam = prevKind === "ball_out" ? msm.state.restartTeam
      : prevKind === "goal_scored" ? (msm.state.scoringTeam === "home" ? "away" : "home" as TeamSide)
      : "away";
    msm = advanceMatchState(msm, dt, null, null);
    if (msm.state.kind === "live_play") {
      if (prevKind === "goal_scored" || prevKind === "halftime") {
        executeSafeKickoffRestart(restartTeam);
      } else if (ball.state === "dead" || !ball.ownerPlayerId) {
        const restartPlayer = players.find(p => p.team === restartTeam && !p.isGK)
          ?? players.find(p => p.team === restartTeam);
        if (restartPlayer) giveBallToPlayerInternal(restartPlayer.id);
      }
    }
    return buildResult(events);
  }

    elapsed += dt;

    for (const p of players) {
      p.prevPos = { ...p.pos };
    }

    const prevBallOwnerTeam = ball.ownerTeam;

    if (pendingBallCommand) {
      executeBallCommand(ball, pendingBallCommand, elapsed);
      pendingBallCommand = null;
    }

    const belief = buildBelief();

    const homePossession = belief.ball.ownerTeam === "home";
    const awayPossession = belief.ball.ownerTeam === "away";
    const possessionTeam = belief.ball.ownerTeam;
    const isSetPiece = false;

    homeTactical = updateTeamTacticalService(homeTactical, belief, "home", dt, isSetPiece);
    awayTactical = updateTeamTacticalService(awayTactical, belief, "away", dt, isSetPiece);

    const intents = new Map<string, PlayerIntent>();

    for (const p of players) {
      const blackboard = p.team === "home" ? homeTactical.blackboard : awayTactical.blackboard;
      let intent = tickPlayerAI(p, belief, blackboard);
      if (elapsed <= kickoffProtectionUntil) {
        const protectedTarget = kickoffProtectionTargets.get(p.id);
        if (protectedTarget) {
          intent = {
            name: "hold_position",
            target: { ...protectedTarget },
          };
        }
      }
      if (intent) {
        intents.set(p.id, intent);
      }
    }

    const motionPlayers = players.map(p => ({
      id: p.id,
      pos: { ...p.pos },
      vel: { ...p.vel },
      facingRad: p.facingRad,
      speed: p.speed,
      acceleration: p.acceleration,
    }));
    const motionResults = applyMotionWithCollision(motionPlayers, intents, dt);

    if (elapsed < 0.5 || (elapsed > 5 && elapsed < 5.05)) {
      const sample = players[0];
      console.log(`[ORCH tick t=${elapsed.toFixed(2)}] intents=${intents.size}/22` +
        ` ball.state=${ball.state} ball.owner=${ball.ownerPlayerId}` +
        ` msm=${msm.state.kind}` +
        ` sample=${sample?.id} pos=(${sample?.pos.x.toFixed(1)},${sample?.pos.z.toFixed(1)})` +
        ` hasBall=${sample?.hasBall}` +
        ` intent=${intents.get(sample?.id ?? "")?.name ?? "-"}`);
      const carrier = players.find(p => p.hasBall);
      if (carrier) {
        console.log(`  carrier=${carrier.id} pos=(${carrier.pos.x.toFixed(1)},${carrier.pos.z.toFixed(1)})`);
      } else {
        console.log(`  NO CARRIER`);
      }
      let intentCounts: Record<string, number> = {};
      for (const [, intent] of intents) {
        intentCounts[intent.name] = (intentCounts[intent.name] || 0) + 1;
      }
      console.log(`  intent distribution:`, intentCounts);
    }

  for (const [id, result] of motionResults) {
    const p = players.find(pl => pl.id === id);
    if (p) {
      p.pos = result.newPos;
      p.vel = result.newVel;
      p.facingRad = result.newFacing;
    }
  }
  if (!_firstMotionLogged) {
    _firstMotionLogged = true;
    const moved = players.filter(p => p.vel.x !== 0 || p.vel.z !== 0).length;
    const sample = players[0];
    console.log(`[ORCH FIRST MOTION] ${moved}/22 moved. sample=(${sample.pos.x.toFixed(1)},${sample.pos.z.toFixed(1)}) vel=(${sample.vel.x.toFixed(1)},${sample.vel.z.toFixed(1)}) intents=${intents.size} ball=${ball.state} owner=${ball.ownerPlayerId}`);
  }

    for (const p of players) {
      const homeTeamStartX = -FIELD_W / 2 + 2;
      const awayTeamStartX = FIELD_W / 2 - 2;
      const boundary = p.team === "home" ? homeTeamStartX : awayTeamStartX;

      if (p.pos.x < -FIELD_W / 2 - 2) p.pos.x = -FIELD_W / 2 - 2;
      if (p.pos.x > FIELD_W / 2 + 2) p.pos.x = FIELD_W / 2 + 2;
      if (p.pos.z < -FIELD_D / 2 - 2) p.pos.z = -FIELD_D / 2 - 2;
      if (p.pos.z > FIELD_D / 2 + 2) p.pos.z = FIELD_D / 2 + 2;
    }

    const ballCommandFromIntent = findBallCommandFromIntents(intents);
    if (ballCommandFromIntent && ball.state === "attached") {
      executeBallCommand(ball, ballCommandFromIntent.cmd, elapsed);
      const carrier = players.find(p => p.hasBall);
      if (carrier && ballCommandFromIntent.cmd.kind !== "dribble") {
        carrier.hasBall = false;
        ball.ownerPlayerId = null;
        ball.ownerTeam = null;
      }

      if (ballCommandFromIntent.cmd.kind === "pass") {
        const targetPlayer = players.find(p => p.id === ballCommandFromIntent.playerId);
        if (targetPlayer) {
          events.push({
            kind: "pass",
            fromId: carrier?.id ?? "",
            toId: targetPlayer.id,
            type: ballCommandFromIntent.passType ?? "short",
          });
        }
      } else if (ballCommandFromIntent.cmd.kind === "shot") {
        events.push({
          kind: "shot",
          playerId: ballCommandFromIntent.playerId,
          style: "laces_drive",
          onTarget: true,
        });
      } else if (ballCommandFromIntent.cmd.kind === "clear") {
        events.push({
          kind: "clearance",
          playerId: ballCommandFromIntent.playerId,
        });
      }
    }

    const ballContactInfos: PlayerContactInfo[] = players.map(p => ({
      id: p.id,
      team: p.team,
      pos: { ...p.pos },
      vel: { ...p.vel },
      facingRad: p.facingRad,
      isGK: p.isGK,
      isInOwnBox: isInPenaltyArea(
        p.pos,
        p.team === "home" ? homeAttackSign > 0 : awayAttackSign > 0,
      ),
      speed: p.speed,
      dribbling: p.ratings.dribbling,
    }));

    const prevBallState = ball.state;
    const prevBallOwner = ball.ownerPlayerId;
    ball = updateBallPhysics(ball, ballContactInfos, elapsed, dt);

    if (ball.state === "attached" && ball.ownerPlayerId) {
      if (kickoffProtectionTargets.size > 0 && elapsed <= kickoffProtectionUntil) {
        kickoffProtectionTargets.delete(ball.ownerPlayerId);
        if (kickoffProtectionTargets.size === 0 || ball.ownerPlayerId === ball.intendedReceiverId) {
          kickoffProtectionTargets.clear();
          kickoffProtectionUntil = 0;
        }
      }
      for (const p of players) {
        if (p.id === ball.ownerPlayerId) {
          p.hasBall = true;
        } else {
          p.hasBall = false;
        }
      }

      if (prevBallOwner !== ball.ownerPlayerId && ball.ownerTeam) {
        const newTeam = ball.ownerTeam;
        const oldTeam = newTeam === "home" ? "away" : "home";
        if (lastPossessionTeam !== newTeam) {
          events.push({ kind: "possession_change", newTeam });
          lastPossessionTeam = newTeam;
        }
      }
    }

    if (ball.state === "attached" && prevBallState !== "attached" && ball.ownerPlayerId) {
      const wasShot = ball.isShot;
      if (wasShot) {
        const keeper = players.find(p => p.id === ball.ownerPlayerId && p.isGK);
        if (keeper) {
          events.push({ kind: "save", keeperId: keeper.id });
        }
      }
    }

    const goalEvent = detectGoal();
    const ballOutEvent = goalEvent ? null : detectBallOut();

    if (goalEvent) {
      events.push({ kind: "goal", team: goalEvent.scoringTeam });
    }
    if (ballOutEvent) {
      events.push({ kind: "ball_out", restartType: ballOutEvent.restartType, restartTeam: ballOutEvent.restartTeam });
    }

    msm = advanceMatchState(msm, dt, ballOutEvent, goalEvent);

    if (elapsed > kickoffProtectionUntil && kickoffProtectionTargets.size > 0) {
      kickoffProtectionTargets.clear();
      kickoffProtectionUntil = 0;
    }

    for (const p of players) {
      p.stamina01 = clamp(
        p.stamina01 - dt * 0.001 * (p.hasBall ? 1.5 : 1.0),
        0.1,
        1.0,
      );
    }

    return buildResult(events);
  }

  function findBallCommandFromIntents(
    intents: Map<string, PlayerIntent>,
  ): { cmd: BallCommand; playerId: string; passType?: string } | null {
    for (const [playerId, intent] of intents) {
      const p = players.find(pl => pl.id === playerId);
      if (!p || !p.hasBall) continue;

      const cmd = intentToBallCommand(intent, p);
      if (cmd) {
        const passType = intent.name === "pass" ? intent.type : undefined;
        return { cmd, playerId, passType };
      }
    }
    return null;
  }

  function buildResult(events: OrchestratorEvent[]): TickResult {
    return {
      players: players.map(p => ({
        id: p.id,
        pos: { ...p.pos },
        vel: { ...p.vel },
        facingRad: p.facingRad,
        hasBall: p.hasBall,
        intent: (playerControllers.get(p.id) as any)?.lastIntent ?? null,
      })),
      ball: {
        pos: { ...ball.pos },
        vel: { ...ball.vel },
        state: ball.state,
        ownerPlayerId: ball.ownerPlayerId,
        ownerTeam: ball.ownerTeam,
      },
      matchState: msm.state,
      clock: { ...msm.clock },
      score: { ...msm.score },
      events,
      blackboards: {
        home: { ...homeTactical.blackboard },
        away: { ...awayTactical.blackboard },
      },
    };
  }

  function reset(): void {
    msm = createMatchStateMachine(config.halfDuration);
    ball = createBallPhysicsState();
    elapsed = 0;
    lastPossessionTeam = null;
    homeTactical = createTeamTacticalState("home", config.homeConfig);
    awayTactical = createTeamTacticalState("away", config.awayConfig);
    for (const p of players) {
      p.hasBall = false;
      p.stamina01 = 1.0;
      if (p.isGK) {
        playerControllers.set(p.id, createGKControllerState(p.id));
      } else {
        playerControllers.set(p.id, createPlayerControllerState(p.id, config.playerControllerHz));
      }
    }
  }

  return {
    tick,
    reset,
    setAttackSigns(home: 1 | -1) {
      homeAttackSign = home;
      awayAttackSign = (home * -1) as -1 | 1;
    },
    setHalfDuration(seconds: number) {
      config.halfDuration = seconds;
      msm.clock.halfDuration = seconds;
    },
    getMatchState() { return msm; },
    getBallState() { return ball; },
    getPlayers() { return players; },
    getPlayerControllers() { return new Map(playerControllers); },
    getTeamTactical(team: TeamSide) { return team === "home" ? homeTactical : awayTactical; },
    injectBallCommand(cmd: BallCommand) { pendingBallCommand = cmd; },
    setPlayerPosition(playerId: string, pos: Vec2) {
      const p = players.find(pl => pl.id === playerId);
      if (p) p.pos = { ...pos };
    },
    giveBallToPlayer(playerId: string) {
      giveBallToPlayerInternal(playerId);
    },
    protectRestartReceive(input: {
      receiverId: string;
      receiverTarget: Vec2;
      holdSeconds?: number;
      kickerId?: string;
      kickerTarget?: Vec2;
    }) {
      kickoffProtectionUntil = Math.max(kickoffProtectionUntil, elapsed + (input.holdSeconds ?? 0.9));
      kickoffProtectionTargets.set(input.receiverId, { ...input.receiverTarget });
      if (input.kickerId && input.kickerTarget) {
        kickoffProtectionTargets.set(input.kickerId, { ...input.kickerTarget });
      }
    },
    forceMatchState(state: MatchStateMachine["state"]) {
      msm.state = state;
    },
    resetMotionLog() {
      _firstMotionLogged = false;
    },
  };
}
