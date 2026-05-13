import {
  BASE_RUN_SPEED,
  CENTER_CIRCLE_RADIUS,
  FIELD_D,
  FIELD_SCALE_PER_YARD,
  FIELD_W,
  GOAL_MOUTH_HALF_Z,
  LEFT_GOAL_X,
  PLAYER_ACCELERATION,
  RIGHT_GOAL_X,
  SIMULATION_DT,
  clamp,
  dist2,
  normalize2,
} from "./constants";
import {
  advanceMatchState,
  createMatchStateMachine,
  detectBallOut,
  getMatchMinute,
  type BallOutEvent,
  type GoalEvent,
  type MatchStateMachine,
} from "./matchStateMachine";
import type { TeamSide, Vec2 } from "./types";
import {
  clampToPlayable,
  getFormationSlots,
  goalCenterForAttack,
  orientSlot,
  type SimpleFormationName,
  type SimpleRole,
  type SimpleTeamCode,
} from "./simpleFormations";
import {
  defaultPlayerName,
  getRoleRatings,
  getTeamTuning,
  type SimplePlayerRatings,
  type SimpleTeamTuning,
} from "./simpleRatings";

export type SimplePlayerStats = {
  passes: number;
  passesCompleted: number;
  shots: number;
  shotsOnTarget: number;
  goals: number;
  saves: number;
  tackles: number;
  interceptions: number;
  distance: number;
  possessionSeconds: number;
  touches: number;
};

export type SimplePlayer = {
  id: string;
  name: string;
  team: SimpleTeamCode;
  side: TeamSide;
  role: SimpleRole;
  label: string;
  shirtNumber: number;
  pos: { x: number; y: number; z: number };
  vel: Vec2;
  homePos: Vec2;
  targetPos: Vec2;
  ratings: SimplePlayerRatings;
  stats: SimplePlayerStats;
};

type TeamStats = {
  name: string;
  formation: SimpleFormationName;
  tuning: SimpleTeamTuning;
  score: number;
  shots: number;
  shotsOnTarget: number;
  saves: number;
  passes: number;
  passesCompleted: number;
  tacklesWon: number;
  clearances: number;
  fouls: number;
  offsides: number;
  corners: number;
  throwIns: number;
  goalKicks: number;
  gkDistributions: number;
  gkDistCompleted: number;
  possessionSeconds: number;
};

type SimpleEvent = {
  type: string;
  team?: SimpleTeamCode;
  role?: string;
  minute?: number;
  t?: number;
  time: number;
  detail: Record<string, unknown>;
};

type LiveEvent = {
  time: number;
  team: SimpleTeamCode | "";
  action: string;
  detail: string;
  meta?: Record<string, unknown>;
};

type KeeperDiveDirection = "left" | "right" | "up" | "down";

type BallState = {
  pos: { x: number; y: number; z: number };
  vel: Vec2;
};

export type SimpleMatchSnapshot = ReturnType<SimpleMatchModel["getMatchSnapshot"]>;

type BallFlightKind = "pass" | "interception" | "shot" | "save" | "miss" | "restart";

type BallFlightState = {
  kind: BallFlightKind;
  from: Vec2;
  to: Vec2;
  followPlayerId?: string;
  elapsed: number;
  duration: number;
  arc: number;
};

type ShotResolutionContext = {
  reason?: string;
  forceOnTarget?: boolean;
  forceGoal?: boolean;
  forceSave?: boolean;
  minGoalChance?: number;
  style?: string;
  details?: Record<string, unknown>;
};

type CompletedPassMemory = {
  team: SimpleTeamCode;
  fromId: string;
  toId: string;
  pairKey: string;
  streak: number;
};

type BallOutRestartContext = {
  restartType: BallOutEvent["restartType"];
  restartTeam: SimpleTeamCode;
  spot: Vec2;
  lastTouchTeam: SimpleTeamCode | null;
  lastTouchPlayerId: string | null;
  crossedLine: "left_goal_line" | "right_goal_line" | "top_touchline" | "bottom_touchline";
  takerId?: string;
};

export type BallFlightTelemetry = {
  seq: number;
  kind: BallFlightKind;
  minute: number;
  half: number;
  elapsedInHalf: number;
  distanceUnits: number;
  distanceYards: number;
  durationSeconds: number;
  speedUnitsPerSecond: number;
  speedYardsPerSecond: number;
  speedMps: number;
  speedMph: number;
  arc: number;
  from: Vec2;
  to: Vec2;
  followPlayerId?: string;
  followPlayerName?: string;
};

export type VisualRealityEvent = {
  type: "EMPTY_FLIGHT_LANDING" | "MISSING_FLIGHT_TARGET" | "BALL_CARRIER_GAP" | "PLAYER_TELEPORT";
  kind?: BallFlightKind;
  minute: number;
  half: number;
  elapsedInHalf: number;
  gapUnits?: number;
  ball: Vec2;
  playerId?: string;
  playerName?: string;
  nearestPlayerName?: string;
  nearestPlayerGap?: number;
};

const DEFAULT_TEAM_A = "Inter Miami";
const DEFAULT_TEAM_B = "LA Galaxy";
const KICKOFF_OWN_HALF_BUFFER = 2.4;
const KICKOFF_SHAPE_RELEASE_SECONDS = 18;
const KICKOFF_SHAPE_HOLD_SECONDS = 2.4;

function createStats(): SimplePlayerStats {
  return {
    passes: 0,
    passesCompleted: 0,
    shots: 0,
    shotsOnTarget: 0,
    goals: 0,
    saves: 0,
    tackles: 0,
    interceptions: 0,
    distance: 0,
    possessionSeconds: 0,
    touches: 0,
  };
}

function makeTeamStats(name: string, formation: SimpleFormationName): TeamStats {
  return {
    name,
    formation,
    tuning: getTeamTuning(name),
    score: 0,
    shots: 0,
    shotsOnTarget: 0,
    saves: 0,
    passes: 0,
    passesCompleted: 0,
    tacklesWon: 0,
    clearances: 0,
    fouls: 0,
    offsides: 0,
    corners: 0,
    throwIns: 0,
    goalKicks: 0,
    gkDistributions: 0,
    gkDistCompleted: 0,
    possessionSeconds: 0,
  };
}

function teamSide(team: SimpleTeamCode): TeamSide {
  return team === "A" ? "home" : "away";
}

function codeFromSide(side: TeamSide): SimpleTeamCode {
  return side === "home" ? "A" : "B";
}

function otherTeam(team: SimpleTeamCode): SimpleTeamCode {
  return team === "A" ? "B" : "A";
}

function phaseName(msm: MatchStateMachine) {
  switch (msm.state.kind) {
    case "pre_match": return "PRE_MATCH";
    case "kickoff": return "KICKOFF";
    case "live_play": return msm.clock.half === 1 ? "FIRST_HALF" : "SECOND_HALF";
    case "ball_out": return "BALL_OUT";
    case "goal_scored": return "GOAL_SCORED";
    case "halftime": return "HALFTIME";
    case "full_time": return "FULL_TIME";
    default: return "STOPPED";
  }
}

function seededHash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function lerpNumber(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

class Rng {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed || 1;
  }

  next() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  range(min: number, max: number) {
    return min + (max - min) * this.next();
  }
}

export class SimpleMatchModel {
  readonly players: SimplePlayer[] = [];
  readonly eventLog: LiveEvent[] = [];
  readonly events: SimpleEvent[] = [];
  readonly passLog: SimpleEvent[] = [];
  readonly shotDecisions: Record<string, unknown>[] = [];
  readonly shotOpportunities: Record<string, unknown>[] = [];
  readonly passDecisions: Record<string, unknown>[] = [];
  readonly shapeA: Record<string, unknown>[] = [];
  readonly shapeB: Record<string, unknown>[] = [];
  readonly goalLog: Record<string, unknown>[] = [];
  readonly ballOutLog: Record<string, unknown>[] = [];
  readonly ballFlightTelemetry: BallFlightTelemetry[] = [];
  readonly visualRealityEvents: VisualRealityEvent[] = [];

  msm: MatchStateMachine = createMatchStateMachine();
  ball: BallState = { pos: { x: 0, y: 0.18, z: 0 }, vel: { x: 0, z: 0 } };
  possession: SimplePlayer | null = null;
  teamA = makeTeamStats(DEFAULT_TEAM_A, "4-3-3");
  teamB = makeTeamStats(DEFAULT_TEAM_B, "4-4-2");
  cpuVsCpu = false;
  seriesSpeedMul = 1;
  restartDelayGoal = 2.0;
  restartDelayHalf = 3.0;
  weather = "SUNNY";
  lighting = "NOON";
  aiStyle = "BALANCED";
  cameraMode = "BROADCAST";
  lastShotTelemetry: Record<string, unknown> | null = null;
  lastKeeperKickTelemetry: Record<string, unknown> | null = null;
  lastPassLoopTelemetry: Record<string, unknown> | null = null;
  private rng = new Rng(1);
  private actionTimer = 0;
  private elapsedTotal = 0;
  private eventSeq = 0;
  private shotSeq = 0;
  private keeperSeq = 0;
  private passLoopSeq = 0;
  private ballFlightSeq = 0;
  private lastStateKind = "pre_match";
  private shapeTimer = 0;
  private seedSalt = "";
  private ballFlight: BallFlightState | null = null;
  private lastCompletedPass: CompletedPassMemory | null = null;
  private dribblePhase = 0;
  private kickoffTeam: SimpleTeamCode | null = null;
  private kickoffKickerId: string | null = null;
  private kickoffShapeReleaseRemaining = 0;
  private kickoffSetupMoving = false;
  private lastTouchTeam: SimpleTeamCode | null = null;
  private lastTouchPlayerId: string | null = null;
  private lastBallPos: Vec2 = { x: 0, z: 0 };
  private pendingBallOutEvent: BallOutEvent | null = null;
  private pendingBallOutContext: BallOutRestartContext | null = null;
  private restartContext: BallOutRestartContext | null = null;

  constructor() {
    this.rebuildTeams();
  }

  setTeamNames(a: string, b: string) {
    if (!this.canRebuildRosters()) {
      this.teamA.name = a || this.teamA.name;
      this.teamB.name = b || this.teamB.name;
      return;
    }
    this.teamA = makeTeamStats(a || DEFAULT_TEAM_A, this.teamA.formation);
    this.teamB = makeTeamStats(b || DEFAULT_TEAM_B, this.teamB.formation);
    this.reseed();
    this.rebuildTeams();
  }

  setTeamFormations(a: string, b: string) {
    const formationA = (["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "3-4-3"].includes(a) ? a : "4-4-2") as SimpleFormationName;
    const formationB = (["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "3-4-3"].includes(b) ? b : "4-4-2") as SimpleFormationName;
    if (!this.canRebuildRosters()) return;
    this.teamA.formation = formationA;
    this.teamB.formation = formationB;
    this.rebuildTeams();
  }

  private canRebuildRosters() {
    return this.msm.state.kind === "pre_match" || this.msm.state.kind === "full_time";
  }

  setHalfDurationSeconds(seconds: number) {
    const duration = Math.max(5, Number(seconds) || 150);
    this.msm.clock.halfDuration = duration;
  }

  setSeriesSpeedMul(value: number) {
    this.seriesSpeedMul = Math.max(0.1, Math.min(80, Number(value) || 1));
  }

  setRestartDelays(goalDelay: number, halfDelay: number) {
    this.restartDelayGoal = Math.max(0, Number(goalDelay) || 0);
    this.restartDelayHalf = Math.max(0, Number(halfDelay) || 0);
  }

  setSeed(seed: string | number) {
    this.seedSalt = String(seed || "");
    this.reseed();
  }

  resetMatch() {
    const halfDuration = this.msm.clock.halfDuration;
    this.msm = createMatchStateMachine(halfDuration);
    this.teamA = makeTeamStats(this.teamA.name, this.teamA.formation);
    this.teamB = makeTeamStats(this.teamB.name, this.teamB.formation);
    this.ball = { pos: { x: 0, y: 0.18, z: 0 }, vel: { x: 0, z: 0 } };
    this.ballFlight = null;
    this.possession = null;
    this.actionTimer = 0;
    this.elapsedTotal = 0;
    this.eventSeq = 0;
    this.shotSeq = 0;
    this.keeperSeq = 0;
    this.passLoopSeq = 0;
    this.ballFlightSeq = 0;
    this.lastCompletedPass = null;
    this.dribblePhase = 0;
    this.kickoffTeam = null;
    this.kickoffKickerId = null;
    this.kickoffShapeReleaseRemaining = 0;
    this.kickoffSetupMoving = false;
    this.lastTouchTeam = null;
    this.lastTouchPlayerId = null;
    this.lastBallPos = { x: 0, z: 0 };
    this.pendingBallOutEvent = null;
    this.pendingBallOutContext = null;
    this.restartContext = null;
    this.lastShotTelemetry = null;
    this.lastKeeperKickTelemetry = null;
    this.lastPassLoopTelemetry = null;
    this.eventLog.length = 0;
    this.events.length = 0;
    this.passLog.length = 0;
    this.shotDecisions.length = 0;
    this.shotOpportunities.length = 0;
    this.passDecisions.length = 0;
    this.ballOutLog.length = 0;
    this.shapeA.length = 0;
    this.shapeB.length = 0;
    this.goalLog.length = 0;
    this.ballFlightTelemetry.length = 0;
    this.visualRealityEvents.length = 0;
    this.reseed();
    this.rebuildTeams();
  }

  startMatch() {
    if (this.msm.state.kind === "full_time") this.resetMatch();
    if (this.msm.state.kind === "pre_match") {
      this.msm = advanceMatchState(this.msm, 0, null, null);
      this.installKickoffSetup(this.msm.state.kind === "kickoff" ? codeFromSide(this.msm.state.team) : "A");
      this.addLiveEvent("", "KICKOFF", `${this.teamA.name} vs ${this.teamB.name}`);
    }
  }

  step(rawDt: number) {
    const scaledDt = Math.min(0.25, Math.max(0, rawDt)) * this.seriesSpeedMul;
    if (scaledDt <= 0) return;
    let remaining = scaledDt;
    while (remaining > 0) {
      const dt = Math.min(SIMULATION_DT, remaining);
      this.stepFixed(dt);
      remaining -= dt;
    }
  }

  getPlayers() {
    return this.players;
  }

  getMatchSnapshot() {
    const poss = this.possession?.team || "A";
    const possession = this.possessionPct();
    const effectiveA = this.effectiveTeamStats("A");
    const effectiveB = this.effectiveTeamStats("B");
    return {
      timestamp: Date.now(),
      scoreA: this.msm.score.home,
      scoreB: this.msm.score.away,
      shotsA: effectiveA.shots,
      shotsB: effectiveB.shots,
      shotsOnTargetA: effectiveA.shotsOnTarget,
      shotsOnTargetB: effectiveB.shotsOnTarget,
      savesA: this.teamA.saves,
      savesB: this.teamB.saves,
      headersA: 0,
      headersB: 0,
      passesA: this.teamA.passes,
      passesB: this.teamB.passes,
      passesCompletedA: this.teamA.passesCompleted,
      passesCompletedB: this.teamB.passesCompleted,
      foulsA: 0,
      foulsB: 0,
      offsidesA: this.teamA.offsides,
      offsidesB: this.teamB.offsides,
      cornersA: this.teamA.corners,
      cornersB: this.teamB.corners,
      throwInsA: this.teamA.throwIns,
      throwInsB: this.teamB.throwIns,
      goalKicksA: this.teamA.goalKicks,
      goalKicksB: this.teamB.goalKicks,
      tacklesWonA: this.teamA.tacklesWon,
      tacklesWonB: this.teamB.tacklesWon,
      clearancesA: 0,
      clearancesB: 0,
      possessionA: possession.A,
      possessionB: possession.B,
      gkDistributionsA: this.teamA.gkDistributions,
      gkDistributionsB: this.teamB.gkDistributions,
      gkDistCompletedA: this.teamA.gkDistCompleted,
      gkDistCompletedB: this.teamB.gkDistCompleted,
      offensiveTeam: poss,
      isLive: this.msm.state.kind === "live_play",
      weather: this.weather,
      lighting: this.lighting,
      aiStyle: this.aiStyle,
      cameraMode: this.cameraMode,
      phase: phaseName(this.msm),
      half: this.msm.clock.half,
      elapsedInHalf: this.msm.clock.elapsedInHalf,
      halfDuration: this.msm.clock.halfDuration,
      teamAName: this.teamA.name,
      teamBName: this.teamB.name,
      teamAFormation: this.teamA.formation,
      teamBFormation: this.teamB.formation,
      lastShotTelemetry: this.lastShotTelemetry,
      lastKeeperKickTelemetry: this.lastKeeperKickTelemetry,
      lastPassLoopTelemetry: this.lastPassLoopTelemetry,
      goalLog: this.goalLog,
    };
  }

  getLiveTelemetry() {
    const possession = this.possessionPct();
    const carrier = this.possession
      ? {
          name: this.possession.name,
          team: this.possession.team,
          role: this.possession.role,
          pos: { x: this.possession.pos.x, z: this.possession.pos.z },
        }
      : null;
    return {
      teamA: this.liveTeamStats("A", possession.A),
      teamB: this.liveTeamStats("B", possession.B),
      carrier,
      phase: phaseName(this.msm),
      half: this.msm.clock.half,
      elapsedInHalf: this.msm.clock.elapsedInHalf,
      halfDuration: this.msm.clock.halfDuration,
      isLive: this.msm.state.kind === "live_play",
      score: { a: this.msm.score.home, b: this.msm.score.away },
      eventLog: this.eventLog.slice(-80),
      shotDecisions: this.shotDecisions.slice(-80),
      shotOpportunities: this.shotOpportunities.slice(-80),
      passDecisions: this.passDecisions.slice(-80),
      possessionDirector: {
        active: this.msm.state.kind === "live_play",
        team: this.possession?.team || "",
        intent: this.possession ? "advance_or_combine" : "restart",
        reason: "simple_model_v1",
        targetWidth: Math.round(FIELD_D * 0.65),
        supportDistance: { min: 5, median: 11, max: 22 },
        crossDelaySeconds: { min: 0, median: 0, max: 0 },
        minBoxAttackersBeforeCross: 0,
        currentBoxAttackers: this.countAttackersNearGoal(this.possession?.team || "A"),
        dangerousMarkDistance: { median: 2.8, warning: 2.0 },
        action: this.possession ? "playing" : "waiting",
      },
    };
  }

  getTuningBundle() {
    return {
      matchId: `simple-${this.teamA.name}-${this.teamB.name}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
      teamA: this.bundleTeam("A"),
      teamB: this.bundleTeam("B"),
      events: this.events.slice(-2000),
      passLog: this.passLog.slice(-2000),
      ballFlightTelemetry: this.ballFlightTelemetry.slice(-2000),
      visualRealityEvents: this.visualRealityEvents.slice(-1000),
      shapeA: this.shapeA.slice(-600),
      shapeB: this.shapeB.slice(-600),
      playerPositioning: [...this.shapeA.slice(-300), ...this.shapeB.slice(-300)],
      transitions: this.events.filter((event) => event.type === "TURNOVER" || event.type === "GOAL").slice(-200),
      goalLog: this.goalLog,
      shotDecisions: this.shotDecisions.slice(-1000),
      shotOpportunities: this.shotOpportunities.slice(-1000),
      passDecisions: this.passDecisions.slice(-1000),
      ballOutLog: this.ballOutLog.slice(-1000),
      possessionDirector: this.getLiveTelemetry().possessionDirector,
      tuning: {
        model: "simple-v1",
        disabledRules: ["fouls"],
      },
      telemetry: {
        disabledMetrics: ["fouls"],
      },
      metadata: {
        model: "simple-v1",
        sessionId: `simple-${Date.now()}`,
        halfDuration: this.msm.clock.halfDuration,
        generatedAt: Date.now(),
      },
    };
  }

  getSelectedPlayerStats() {
    return this.possession || this.players.find((p) => p.team === "A") || null;
  }

  getSelectedDefensePlayerStats() {
    if (!this.possession) return this.players.find((p) => p.team === "B") || null;
    return this.nearestOpponent(this.possession, otherTeam(this.possession.team));
  }

  private stepFixed(dt: number) {
    const prevKind = this.msm.state.kind;
    let goalEvent: GoalEvent | null = null;
    this.pendingBallOutEvent = null;
    this.pendingBallOutContext = null;
    const halfLimit = this.msm.clock.halfDuration + this.msm.clock.stoppageTime;
    if (this.msm.state.kind === "live_play" && this.msm.clock.elapsedInHalf < halfLimit) {
      if (this.shouldForceFinalNoShotAttempt(dt)) {
        goalEvent = this.forceNoShotAttempt("NO_SHOT_FINAL_WHISTLE");
      } else {
        goalEvent = this.playLiveTick(dt);
      }
    }

    if (this.msm.state.kind === "kickoff" && this.kickoffSetupMoving && !this.isKickoffSetupReady()) {
      this.msm.clock.elapsedInHalf += dt;
      this.elapsedTotal += dt;
      this.kickoffShapeReleaseRemaining = Math.max(0, this.kickoffShapeReleaseRemaining - dt);
      this.movePlayers(dt);
      this.ball.pos.x = 0;
      this.ball.pos.y = this.ballGroundY();
      this.ball.pos.z = 0;
      this.ball.vel = { x: 0, z: 0 };
      this.lastStateKind = this.msm.state.kind;
      return;
    }

    const ballOutEvent = goalEvent ? null : this.pendingBallOutEvent;
    const ballOutContext = goalEvent ? null : this.pendingBallOutContext;
    this.msm = advanceMatchState(this.msm, dt, ballOutEvent, goalEvent);
    this.elapsedTotal += dt;
    this.kickoffShapeReleaseRemaining = Math.max(0, this.kickoffShapeReleaseRemaining - dt);

    if (this.msm.state.kind === "ball_out") {
      if (prevKind !== "ball_out") this.installBallOutRestart(ballOutContext);
      this.moveRestartPlayers(dt);
    } else if (this.msm.state.kind === "goal_scored") {
      this.msm.restartTimer = Math.min(this.msm.restartTimer, this.restartDelayGoal);
      if (prevKind !== "goal_scored") {
        const scoringTeam = (this.msm.state as { kind: "goal_scored"; scoringTeam: TeamSide }).scoringTeam;
        const restartTeam: SimpleTeamCode = scoringTeam === "home" ? "B" : "A";
        this.installKickoffSetup(restartTeam);
      }
      if (this.kickoffSetupMoving) {
        this.movePlayers(dt);
        this.ball.pos.x = 0;
        this.ball.pos.y = this.ballGroundY();
        this.ball.pos.z = 0;
        this.ball.vel = { x: 0, z: 0 };
      }
    } else if (this.msm.state.kind === "halftime") {
      this.msm.restartTimer = Math.min(this.msm.restartTimer, this.restartDelayHalf);
      if (this.kickoffSetupMoving) {
        this.movePlayers(dt);
        this.ball.pos.x = 0;
        this.ball.pos.y = this.ballGroundY();
        this.ball.pos.z = 0;
        this.ball.vel = { x: 0, z: 0 };
      }
    }

    if (this.msm.state.kind === "kickoff" && prevKind !== "kickoff") {
      const kickoffState = this.msm.state as { kind: "kickoff"; team: TeamSide };
      this.installKickoffSetup(codeFromSide(kickoffState.team));
    }
    if (this.msm.state.kind === "live_play" && prevKind === "kickoff") {
      this.executeKickoff();
      this.addLiveEvent(this.possession?.team || "", "LIVE", "play restarted");
    }
    if (this.msm.state.kind === "live_play" && prevKind === "ball_out") {
      this.executeBallOutRestart();
    }
    if (this.msm.state.kind === "halftime" && prevKind !== "halftime") {
      this.addLiveEvent("", "HALF", "halftime");
    }
    if (this.msm.state.kind === "full_time" && prevKind !== "full_time") {
      this.addLiveEvent("", "FULL", `${this.teamA.name} ${this.msm.score.home}-${this.msm.score.away} ${this.teamB.name}`);
    }
    this.lastStateKind = this.msm.state.kind;
  }

  private playLiveTick(dt: number): GoalEvent | null {
    if (!this.possession) this.claimLooseBallPossession("A");
    if (this.possession) {
      this.rememberTouch(this.possession);
      this.team(this.possession.team).possessionSeconds += dt;
      this.possession.stats.possessionSeconds += dt;
      if (!this.ballFlight) {
        this.lastBallPos = { x: this.ball.pos.x, z: this.ball.pos.z };
        this.ball.pos.x = this.possession.pos.x;
        this.ball.pos.y = 0.18;
        this.ball.pos.z = this.possession.pos.z;
      }
    }
    this.updateTargets();
    this.movePlayers(dt);
    this.shapeTimer += dt;
    if (this.shapeTimer >= 1) {
      this.shapeTimer = 0;
      this.sampleShape();
    }
    if (this.ballFlight) {
      this.actionTimer = Math.max(0, this.actionTimer - dt);
      this.updateBallFlight(dt);
      this.detectAndStageBallOut();
      return null;
    }

    const carrier = this.possession;
    if (!carrier) return null;
    const pressure = this.pressureOn(carrier);
    const attackSign = this.attackSign(carrier.team);
    const goal = goalCenterForAttack(attackSign);
    const distToGoal = dist2(carrier.pos, goal);
    const forwardX = (goal.x - carrier.pos.x) * attackSign;

    const urgentGoalmouth = distToGoal < 4.6 && carrier.role !== "GK";
    const noShotPressure = this.shouldApplyNoShotPressure(carrier, distToGoal, forwardX);
    if (urgentGoalmouth) this.actionTimer = Math.min(this.actionTimer, 1.35);
    if (noShotPressure) this.actionTimer = Math.min(this.actionTimer, 0.35);

    this.actionTimer -= dt;
    if (this.actionTimer > 0) return null;
    this.actionTimer = this.nextActionDelay();

    if (urgentGoalmouth) {
      const keeper = this.players.find((p) => p.team === otherTeam(carrier.team) && p.role === "GK");
      const keeperDist = keeper ? dist2(carrier.pos, keeper.pos) : 99;
      const noShotsYet = this.teamA.shots + this.teamB.shots === 0;
      const centralSmother = Math.abs(carrier.pos.z) <= GOAL_MOUTH_HALF_Z * 0.95 && distToGoal < 3.3 && keeperDist < 1.35;
      if (keeper && noShotsYet && centralSmother) {
        this.recordShotOpportunity(carrier, distToGoal, pressure, 1, "smothered_shot", {
          urgentGoalmouth,
          keeperDist,
          reason: "NO_SHOT_GOALMOUTH_SMOOTHER",
        });
        return this.resolveShot(carrier, distToGoal, pressure, {
          reason: "KEEPER_SMOTHERED_SHOT",
          forceOnTarget: true,
          forceSave: true,
          style: "toe_poke",
          details: {
            urgentGoalmouth,
            keeperDist,
            noShotsYet,
          },
        });
      }
      if (keeper && distToGoal < 2.8 && keeperDist < 5.2 && this.goalLineRecoveryChance(carrier, keeper, pressure) > this.rng.next()) {
        const recoveryChance = this.goalLineRecoveryChance(carrier, keeper, pressure);
        this.recordShotOpportunity(carrier, distToGoal, pressure, recoveryChance, "keeper_recovery", {
          urgentGoalmouth,
          keeperDist,
          recoveryChance,
        });
        this.possession = keeper;
        this.team(keeper.team).tacklesWon += 1;
        keeper.stats.tackles += 1;
        this.startBallFlight("interception", { x: carrier.pos.x, z: carrier.pos.z }, keeper.pos, this.flightDuration(0.38), 0.35, keeper);
        this.addLiveEvent(keeper.team, "SMOTHER", `${keeper.label} recovered`);
        this.recordEvent("KEEPER_SMOTHER", keeper.team, keeper, {
          carrier: carrier.name,
          distToGoal,
          pressure,
          keeperDist,
          recoveryChance,
          reason: "GOAL_LINE_RECOVERY",
        });
        return null;
      }
      const fidelity = this.goalmouthFidelity(carrier, keeper, distToGoal);
      if (fidelity.openNet) {
        this.recordShotOpportunity(carrier, distToGoal, pressure, 1, "open_net_finish", {
          urgentGoalmouth,
          ...fidelity.telemetry,
        });
        return this.resolveShot(carrier, distToGoal, pressure, {
          reason: "OPEN_NET_FINISH",
          forceOnTarget: true,
          forceGoal: true,
          minGoalChance: 1,
          style: "tap_in",
          details: {
            urgentGoalmouth,
            ...fidelity.telemetry,
          },
        });
      }
      if (pressure > 1.35 || keeperDist < 4.8) {
        const smotherChance = clamp(0.24 + pressure * 0.095 + Math.max(0, 5 - keeperDist) * 0.09, 0.26, 0.68);
        if (this.rng.next() < smotherChance && keeper) {
          this.recordShotOpportunity(carrier, distToGoal, pressure, 0, "smother", {
            urgentGoalmouth,
            keeperDist,
            smotherChance,
          });
          this.possession = keeper;
          this.team(keeper.team).tacklesWon += 1;
          keeper.stats.tackles += 1;
          this.startBallFlight("interception", { x: carrier.pos.x, z: carrier.pos.z }, keeper.pos, this.flightDuration(0.38), 0.35, keeper);
          this.addLiveEvent(keeper.team, "SMOTHER", `${keeper.label} smothered`);
          this.recordEvent("KEEPER_SMOTHER", keeper.team, keeper, {
            carrier: carrier.name,
            distToGoal,
            pressure,
            keeperDist,
          });
          return null;
        }
      }
      if (noShotsYet && distToGoal < 4.6) {
        this.recordShotOpportunity(carrier, distToGoal, pressure, 1, "goalmouth_forced_shot", {
          urgentGoalmouth,
          keeperDist,
          reason: "NO_SHOT_GOALMOUTH",
        });
        return this.resolveShot(carrier, distToGoal, pressure, {
          reason: "NO_SHOT_GOALMOUTH",
          forceOnTarget: true,
          style: "toe_poke",
          details: {
            urgentGoalmouth,
            keeperDist,
            noShotsYet,
          },
        });
      }
      const finishChance = clamp((0.12 + Math.max(0, 4.6 - distToGoal) * 0.030 + pressure * 0.010) * this.shotSelectionScale(), 0.07, 0.22);
      if (this.rng.next() < finishChance) {
        this.recordShotOpportunity(carrier, distToGoal, pressure, finishChance, "shot", { urgentGoalmouth });
        return this.resolveShot(carrier, distToGoal, pressure);
      }
      if (this.rng.next() < 0.78) {
        this.recordShotOpportunity(carrier, distToGoal, pressure, finishChance, "pass", { urgentGoalmouth });
        this.resolvePass(carrier, pressure + 0.5);
        return null;
      }
      this.recordShotOpportunity(carrier, distToGoal, pressure, finishChance, "tackle_check", { urgentGoalmouth });
      return this.resolveTackleChance(carrier, pressure + 0.55);
    }

    if (noShotPressure) {
      this.recordShotOpportunity(carrier, distToGoal, pressure, 1, "minimum_shot_floor", {
        forwardX,
        reason: "NO_SHOT_LATE_PRESSURE",
      });
      return this.resolveShot(carrier, distToGoal, pressure, {
        reason: "NO_SHOT_LATE_PRESSURE",
        style: distToGoal < 14 ? "driven" : "desperation",
        details: {
          forwardX,
          noShotPressure: true,
        },
      });
    }

    this.recordEvent("CARRIER_TRACE", carrier.team, carrier, {
      carrier: carrier.name,
      role: carrier.role,
      distToGoal,
      pressure,
      speed: Math.sqrt(carrier.vel.x * carrier.vel.x + carrier.vel.z * carrier.vel.z),
      phase: this.zoneForDist(distToGoal),
    });

    const distanceShotChance = this.distanceShotChance(carrier, distToGoal, pressure, forwardX);
    const distanceShotRoll = this.rng.next();
    if (distanceShotChance > distanceShotRoll) {
      this.recordShotOpportunity(carrier, distToGoal, pressure, distanceShotChance, "distance_shot", {
        roll: distanceShotRoll,
        forwardX,
        reason: "DISTANCE_SHOT_WINDOW",
      });
      return this.resolveShot(carrier, distToGoal, pressure, {
        reason: "DISTANCE_SHOT_WINDOW",
        style: pressure > 1.0 ? "first_time" : "driven",
        details: {
          distanceShot: true,
          shotSelectionType: "distance_shot",
          forwardX,
        },
      });
    }

    const shootUrge = this.shootUrge(carrier, distToGoal, pressure);
    const shootRoll = this.rng.next();
    if (shootUrge > shootRoll) {
      this.recordShotOpportunity(carrier, distToGoal, pressure, shootUrge, "shot", {
        roll: shootRoll,
        forwardX,
      });
      return this.resolveShot(carrier, distToGoal, pressure);
    }

    const shouldPass = pressure > 0.8 || forwardX < 10 || this.rng.next() < 0.98;
    if (shouldPass) {
      this.recordShotOpportunity(carrier, distToGoal, pressure, shootUrge, "pass", {
        roll: shootRoll,
        forwardX,
      });
      this.resolvePass(carrier, pressure);
      return null;
    }

    this.recordShotOpportunity(carrier, distToGoal, pressure, shootUrge, "tackle_check", {
      roll: shootRoll,
      forwardX,
    });
    return this.resolveTackleChance(carrier, pressure);
  }

  updateVisuals(dt: number) {
    if (this.msm.state.kind === "kickoff" || this.kickoffSetupMoving) {
      this.ball.pos.x = 0;
      this.ball.pos.y = 0.18;
      this.ball.pos.z = 0;
      return;
    }
    if (this.ballFlight) return;
    if (this.possession) {
      this.dribblePhase += dt * 9;
      const goal = goalCenterForAttack(this.attackSign(this.possession.team));
      const forward = normalize2({ x: goal.x - this.possession.pos.x, z: goal.z - this.possession.pos.z });
      const lateral = { x: -forward.z, z: forward.x };
      const touch = Math.sin(this.dribblePhase);
      const lead = 0.92 + Math.max(0, touch) * 0.38;
      const side = Math.sin(this.dribblePhase * 0.5 + this.possession.shirtNumber) * 0.28;
      this.ball.pos.x = this.possession.pos.x + forward.x * lead + lateral.x * side;
      this.ball.pos.y = 0.14 + Math.max(0, touch) * 0.12;
      this.ball.pos.z = this.possession.pos.z + forward.z * lead + lateral.z * side;
      this.auditCarrierBallGap(this.possession);
    }
  }

  private updateBallFlight(dt: number) {
    const flight = this.ballFlight;
    if (!flight) return;
    const prev = { x: this.ball.pos.x, z: this.ball.pos.z };
    this.lastBallPos = prev;
    flight.elapsed += Math.max(0, dt);
    if (flight.followPlayerId) {
      const receiver = this.players.find((player) => player.id === flight.followPlayerId);
      if (receiver) flight.to = { x: receiver.pos.x, z: receiver.pos.z };
    }
    const t = clamp(flight.elapsed / Math.max(0.001, flight.duration), 0, 1);
    this.ball.pos.x = flight.from.x + (flight.to.x - flight.from.x) * t;
    this.ball.pos.z = flight.from.z + (flight.to.z - flight.from.z) * t;
    this.ball.pos.y = this.ballGroundY() + Math.sin(Math.PI * t) * flight.arc;
    this.ball.vel = {
      x: dt > 0 ? (this.ball.pos.x - prev.x) / dt : 0,
      z: dt > 0 ? (this.ball.pos.z - prev.z) / dt : 0,
    };
    if (t >= 1) {
      this.ball.pos.x = flight.to.x;
      this.ball.pos.y = this.ballGroundY();
      this.ball.pos.z = flight.to.z;
      this.ball.vel = { x: 0, z: 0 };
      this.auditFlightLanding(flight);
      this.ballFlight = null;
      return;
    }
  }

  private updateTargets() {
    for (const player of this.players) {
      const attackSign = this.attackSign(player.team);
      const ball = { x: this.ball.pos.x, z: this.ball.pos.z };
      let target = { ...player.homePos };
      if (this.possession?.id === player.id) {
        const goal = goalCenterForAttack(attackSign);
        const dir = normalize2({ x: goal.x - player.pos.x, z: goal.z - player.pos.z });
        const lane = Math.sin(this.elapsedTotal * 0.8 + player.shirtNumber) * 1.8;
        const expansion = this.attackExpansionScale();
        target = { x: player.pos.x + dir.x * 8 * expansion, z: player.pos.z + dir.z * 5 * Math.min(expansion, 1.6) + lane };
      } else if (this.possession?.team === player.team) {
        const push = player.role === "ST" || player.role === "W" || player.role === "AM" ? 7 : 3;
        const expansion = this.attackExpansionScale();
        target = {
          x: player.homePos.x + attackSign * clamp(ball.x * 0.18 + push * expansion, -8, 16),
          z: player.homePos.z * 0.85 + ball.z * 0.18,
        };
      } else if (this.possession && player.team !== this.possession.team) {
        const nearest = this.nearestOpponent(this.possession, player.team);
        if (nearest?.id === player.id) {
          target = { x: ball.x - attackSign * 0.8, z: ball.z };
        } else {
          target = {
            x: player.homePos.x + attackSign * clamp(ball.x * 0.12, -5, 5),
            z: player.homePos.z * 0.75 + ball.z * 0.25,
          };
        }
      }
      if (player.role === "GK") {
        const ownGoalX = attackSign > 0 ? LEFT_GOAL_X + 2.4 : RIGHT_GOAL_X - 2.4;
        target = { x: ownGoalX, z: clamp(ball.z * 0.25, -4, 4) };
        if (this.possession && this.possession.team !== player.team) {
          const ownGoal = goalCenterForAttack((-attackSign) as 1 | -1);
          const dangerDist = dist2(this.possession.pos, ownGoal);
          const centralDanger = Math.abs(this.possession.pos.z) <= GOAL_MOUTH_HALF_Z * 1.9;
          if (dangerDist < 9 && centralDanger) {
            const dir = normalize2({ x: this.possession.pos.x - ownGoal.x, z: this.possession.pos.z - ownGoal.z });
            const stepOut = clamp(dangerDist * 0.42, 0.45, 2.1);
            target = {
              x: ownGoal.x + dir.x * stepOut,
              z: clamp(this.possession.pos.z * 0.82, -GOAL_MOUTH_HALF_Z * 0.95, GOAL_MOUTH_HALF_Z * 0.95),
            };
          }
        }
      }
      if (this.kickoffShapeReleaseRemaining > 0 && player.role !== "GK") {
        const releaseAge = KICKOFF_SHAPE_RELEASE_SECONDS - this.kickoffShapeReleaseRemaining;
        const releaseProgress = clamp(
          (releaseAge - KICKOFF_SHAPE_HOLD_SECONDS) / Math.max(0.001, KICKOFF_SHAPE_RELEASE_SECONDS - KICKOFF_SHAPE_HOLD_SECONDS),
          0,
          1,
        );
        const maxAdvancedX = -KICKOFF_OWN_HALF_BUFFER
          + Math.max(0, player.homePos.x * attackSign + KICKOFF_OWN_HALF_BUFFER) * releaseProgress;
        if (target.x * attackSign > maxAdvancedX) {
          target.x = maxAdvancedX * attackSign;
        }
      }
      player.targetPos = clampToPlayable(target);
    }
  }

  private movePlayers(dt: number) {
    for (const player of this.players) {
      const target = player.targetPos;
      const dx = target.x - player.pos.x;
      const dz = target.z - player.pos.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      const maxSpeed = BASE_RUN_SPEED * (0.42 + player.ratings.pace * 0.58);
      const oldX = player.pos.x;
      const oldZ = player.pos.z;
      if (len > 0.001) {
        const dirX = dx / len;
        const dirZ = dz / len;
        const currentSpeedTowardTarget = Math.max(0, player.vel.x * dirX + player.vel.z * dirZ);
        const speed = Math.min(maxSpeed, currentSpeedTowardTarget + PLAYER_ACCELERATION * dt);
        const step = Math.min(len, speed * dt);
        if (step >= len) {
          player.pos.x = target.x;
          player.pos.z = target.z;
        } else if (speed > 0.001) {
          player.pos.x += dirX * step;
          player.pos.z += dirZ * step;
        }
        const clamped = clampToPlayable(player.pos);
        player.pos.x = clamped.x;
        player.pos.z = clamped.z;
      } else {
        player.vel = { x: 0, z: 0 };
        continue;
      }
      player.vel = { x: (player.pos.x - oldX) / dt, z: (player.pos.z - oldZ) / dt };
      player.stats.distance += Math.sqrt((player.pos.x - oldX) ** 2 + (player.pos.z - oldZ) ** 2);
    }
  }

  private resolvePass(carrier: SimplePlayer, pressure: number) {
    const target = this.bestPassTarget(carrier);
    if (!target) return;
    this.rememberTouch(carrier);
    const origin = { x: carrier.pos.x, z: carrier.pos.z };
    const distance = dist2(carrier.pos, target.pos);
    const progress = (target.pos.x - carrier.pos.x) * this.attackSign(carrier.team);
    const separation = this.nearestDefenderDistance(target, otherTeam(carrier.team));
    const offside = this.offsideInfraction(carrier, target, origin);
    if (offside) {
      this.resolveOffside(carrier, target, offside);
      return;
    }
    const completionChance = clamp(
      0.820
        + (carrier.ratings.passing - 0.6) * 0.20
        - distance * 0.012
        - pressure * 0.075
        + separation * 0.018
        - Math.max(0, progress) * 0.003,
      0.34,
      0.88,
    );
    const complete = this.rng.next() < completionChance;
    const stats = this.team(carrier.team);
    stats.passes += 1;
    carrier.stats.passes += 1;
    carrier.stats.touches += 1;
    const decision = {
      team: carrier.team,
      passer: carrier.name,
      carrier: carrier.name,
      passerRole: carrier.role,
      role: carrier.role,
      passTarget: target.name,
      passTargetName: target.name,
      targetRole: target.role,
      distance: +distance.toFixed(2),
      passForwardProg: +progress.toFixed(2),
      bestTargetForwardProg: +progress.toFixed(2),
      closePressure: +pressure.toFixed(2),
      completionChance: +completionChance.toFixed(2),
      shouldPass: true,
      passStyle: progress > 3 ? "FORWARD" : progress < -2 ? "BACK" : "LATERAL",
      carrierZone: this.zoneForDist(dist2(carrier.pos, goalCenterForAttack(this.attackSign(carrier.team)))),
      completed: complete,
    };
    this.passDecisions.push(decision);

    if (complete) {
      stats.passesCompleted += 1;
      carrier.stats.passesCompleted += 1;
      target.stats.touches += 1;
      this.possession = target;
      this.rememberTouch(target);
      this.startBallFlight("pass", origin, target.pos, this.flightDuration(clamp(distance / 24, 0.65, 1.25)), 0.75, target);
      this.rememberCompletedPass(carrier, target);
      this.addLiveEvent(carrier.team, "PASS", `${carrier.label} to ${target.label}`);
      const event = this.recordEvent("PASS", carrier.team, carrier, {
        ...decision,
        target: target.name,
        outcome: "complete",
        progress,
      });
      this.passLog.push(event);
      if (carrier.role === "GK") {
        stats.gkDistributions += 1;
        stats.gkDistCompleted += 1;
        this.lastKeeperKickTelemetry = {
          seq: ++this.keeperSeq,
          team: carrier.team,
          keeper: carrier.name,
          style: distance > 16 ? "kick" : "throw",
          completed: true,
          distance,
        };
      }
      return;
    }

    const touchlineMissChance = clamp(0.015 + distance * 0.0015 + Math.abs(target.pos.z) / FIELD_D * 0.04, 0.015, 0.06);
    if (this.rng.next() < touchlineMissChance) {
      const side = target.pos.z >= 0 ? 1 : -1;
      const outTarget = {
        x: clamp(target.pos.x + this.rng.range(-4.5, 4.5), LEFT_GOAL_X + 1.2, RIGHT_GOAL_X - 1.2),
        z: side * (FIELD_D / 2 + this.rng.range(0.9, 2.2)),
      };
      this.possession = null;
      this.lastCompletedPass = null;
      this.startBallFlight("pass", origin, outTarget, this.flightDuration(clamp(distance / 24, 0.65, 1.25)), 0.35);
      this.addLiveEvent(otherTeam(carrier.team), "THROW", `${carrier.label} pass ran out`);
      const event = this.recordEvent("TURNOVER", otherTeam(carrier.team), carrier, {
        passer: carrier.name,
        intendedTarget: target.name,
        outcome: "out_of_play",
        restartType: "throw_in",
        completionChance,
      });
      this.passLog.push(event);
      return;
    }

    const interceptor = this.nearestOpponent(target, otherTeam(carrier.team)) || target;
    this.possession = interceptor.team !== carrier.team ? interceptor : this.nearestTeamPlayer(otherTeam(carrier.team), target.pos);
    this.lastCompletedPass = null;
    if (this.possession) {
      this.rememberTouch(this.possession);
      this.team(this.possession.team).tacklesWon += 1;
      this.possession.stats.interceptions += 1;
      this.possession.stats.touches += 1;
      this.startBallFlight("interception", origin, this.possession.pos, this.flightDuration(clamp(distance / 24, 0.65, 1.3)), 0.65, this.possession);
    }
    this.addLiveEvent(otherTeam(carrier.team), "TURNOVER", `${target.label} pass cut out`);
    const event = this.recordEvent("TURNOVER", otherTeam(carrier.team), this.possession || carrier, {
      passer: carrier.name,
      intendedTarget: target.name,
      outcome: "interception",
      completionChance,
    });
    this.passLog.push(event);
  }

  private offsideInfraction(carrier: SimplePlayer, target: SimplePlayer, ballAtTouch: Vec2) {
    if (target.team !== carrier.team || target.role === "GK") return null;
    const attackSign = this.attackSign(carrier.team);
    const targetX = target.pos.x * attackSign;
    const ballX = ballAtTouch.x * attackSign;
    if (targetX <= 0) return null;
    if (targetX <= ballX + 0.05) return null;

    const defenders = this.players
      .filter((player) => player.team === otherTeam(carrier.team))
      .map((player) => player.pos.x * attackSign)
      .sort((a, b) => b - a);
    const secondLastDefenderX = defenders[1] ?? defenders[0] ?? Infinity;
    const offsideLine = Math.max(ballX, secondLastDefenderX);
    if (targetX <= offsideLine + 0.05) return null;
    return {
      attackSign,
      targetX,
      ballX,
      secondLastDefenderX,
      offsideLine,
      margin: targetX - offsideLine,
    };
  }

  private resolveOffside(carrier: SimplePlayer, target: SimplePlayer, offside: NonNullable<ReturnType<SimpleMatchModel["offsideInfraction"]>>) {
    const defendingTeam = otherTeam(carrier.team);
    const restartTaker = this.nearestTeamPlayer(defendingTeam, target.pos) || this.players.find((player) => player.team === defendingTeam) || null;
    this.team(carrier.team).offsides += 1;
    this.possession = restartTaker;
    this.lastCompletedPass = null;
    this.ballFlight = null;
    if (restartTaker) {
      this.ball.pos.x = restartTaker.pos.x;
      this.ball.pos.y = 0.18;
      this.ball.pos.z = restartTaker.pos.z;
    }
    this.actionTimer = Math.max(0.25, this.nextActionDelay() * 0.5);
    this.addLiveEvent(carrier.team, "OFFSIDE", `${target.label} flagged`);
    const event = this.recordEvent("OFFSIDE", carrier.team, target, {
      passer: carrier.name,
      receiver: target.name,
      receiverRole: target.role,
      targetX: +offside.targetX.toFixed(2),
      ballX: +offside.ballX.toFixed(2),
      secondLastDefenderX: +offside.secondLastDefenderX.toFixed(2),
      offsideLine: +offside.offsideLine.toFixed(2),
      margin: +offside.margin.toFixed(2),
      restartTeam: defendingTeam,
      restartTaker: restartTaker?.name || null,
    });
    this.passLog.push(event);
  }

  private resolveShot(
    carrier: SimplePlayer,
    distToGoal: number,
    pressure: number,
    context: ShotResolutionContext = {},
  ): GoalEvent | null {
    const teamStats = this.team(carrier.team);
    const defendingTeam = otherTeam(carrier.team);
    this.rememberTouch(carrier);
    const keeper = this.players.find((p) => p.team === defendingTeam && p.role === "GK");
    const anglePenalty = Math.min(1, Math.abs(carrier.pos.z) / (FIELD_D * 0.42));
    const onTargetChance = clamp(0.64 - distToGoal * 0.010 - anglePenalty * 0.16 - pressure * 0.045 + carrier.ratings.shooting * 0.17, 0.15, 0.84);
    const onTarget = context.forceOnTarget || this.rng.next() < onTargetChance;
    teamStats.shots += 1;
    carrier.stats.shots += 1;
    carrier.stats.touches += 1;
    const style = context.style || (distToGoal < 10 ? "placed" : pressure > 1.4 ? "first_time" : "driven");
    const decision = {
      seq: ++this.shotSeq,
      decisionType: "SIMPLE_V1",
      team: carrier.team,
      shooter: carrier.name,
      role: carrier.role,
      style,
      shouldShoot: true,
      distToGoal: +distToGoal.toFixed(2),
      distToGoalYards: +((distToGoal / FIELD_W) * 120).toFixed(1),
      closePressure: +pressure.toFixed(2),
      anglePenalty: +anglePenalty.toFixed(2),
      onTargetChance: +onTargetChance.toFixed(2),
      elapsedInHalf: this.msm.clock.elapsedInHalf,
      resolutionReason: context.reason || "NORMAL_SHOT",
      forcedByGeometry: !!context.forceGoal,
      ...context.details,
    };
    this.shotDecisions.push(decision);
    this.lastShotTelemetry = decision;
    const shotOrigin = { x: carrier.pos.x, z: carrier.pos.z };
    const shotTarget = this.shotTarget(carrier.team, onTarget, anglePenalty);

    this.recordEvent("SHOT", carrier.team, carrier, {
      ...decision,
      onTarget,
    });
    this.addLiveEvent(carrier.team, "SHOT", `${carrier.label} ${style}`);

    if (!onTarget) {
      this.startBallFlight("miss", shotOrigin, shotTarget, this.flightDuration(clamp(distToGoal / 34, 0.8, 1.45)), 1.4);
      this.possession = null;
      return null;
    }

    teamStats.shotsOnTarget += 1;
    carrier.stats.shotsOnTarget += 1;
    this.recordEvent("SHOT_ON_TARGET", carrier.team, carrier, decision);
    const keeperQuality = keeper?.ratings.keeper ?? 0.62;
    const distToGoalYards = (distToGoal / FIELD_W) * 120;
    const maxGoalDistanceYards = this.maxGoalDistanceYards(carrier.role, context);
    const invalidGoalGeometry = distToGoalYards > maxGoalDistanceYards;
    Object.assign(decision, {
      maxGoalDistanceYards,
      invalidGoalGeometry,
    });
    const baseGoalChance = invalidGoalGeometry
      ? 0
      : clamp(0.55 - keeperQuality * 0.23 - distToGoal * 0.0040 - anglePenalty * 0.10 - pressure * 0.026 + carrier.ratings.shooting * 0.17, 0.05, 0.58);
    const forcedGoal = !!context.forceGoal && !invalidGoalGeometry;
    const goalChance = forcedGoal ? 1 : Math.max(baseGoalChance, invalidGoalGeometry ? 0 : context.minGoalChance ?? 0);
    const goal = context.forceSave || invalidGoalGeometry ? false : forcedGoal || this.rng.next() < goalChance;
    if (!goal) {
      const defending = this.team(defendingTeam);
      defending.saves += 1;
      if (keeper) keeper.stats.saves += 1;
      const saveTarget = keeper?.pos || shotTarget;
      const diveDirection = this.keeperDiveDirection(keeper, shotTarget);
      const keeperStart = keeper ? { x: +keeper.pos.x.toFixed(2), z: +keeper.pos.z.toFixed(2) } : null;
      const saveMeta = {
        diveDirection,
        keeperStart,
        shotOrigin: { x: +shotOrigin.x.toFixed(2), z: +shotOrigin.z.toFixed(2) },
        shotTarget: { x: +shotTarget.x.toFixed(2), z: +shotTarget.z.toFixed(2) },
        saveTarget: { x: +saveTarget.x.toFixed(2), z: +saveTarget.z.toFixed(2) },
      };
      this.recordEvent("SAVE", defendingTeam, keeper || carrier, {
        shooter: carrier.name,
        keeper: keeper?.name || "Keeper",
        goalChance,
        resolutionReason: context.reason || "NORMAL_SHOT",
        ...saveMeta,
      });
      this.addLiveEvent(defendingTeam, "SAVE", keeper ? keeper.label : "GK", saveMeta);
      if (dist2(shotOrigin, saveTarget) / FIELD_SCALE_PER_YARD >= 3) {
        this.startBallFlight("save", shotOrigin, saveTarget, this.flightDuration(clamp(distToGoal / 34, 0.75, 1.35)), 1.1, keeper || undefined);
      } else {
        this.ball.pos.x = saveTarget.x;
        this.ball.pos.y = 0.18;
        this.ball.pos.z = saveTarget.z;
      }
      this.installKeeperPossession(defendingTeam);
      return null;
    }

    teamStats.score += 1;
    carrier.stats.goals += 1;
    const goalRow = {
      team: carrier.team,
      playerName: carrier.name,
      scorer: carrier.name,
      shirtNumber: carrier.shirtNumber,
      role: carrier.role,
      matchMinute: getMatchMinute(this.msm),
      elapsedInHalf: this.msm.clock.elapsedInHalf,
      distToGoal,
      distToGoalYards: +distToGoalYards.toFixed(1),
      maxGoalDistanceYards,
      invalidGoalGeometry,
      resolutionReason: context.reason || "NORMAL_SHOT",
      goalChance,
      shotBacked: true,
      ...context.details,
    };
    this.goalLog.push(goalRow);
    this.recordEvent("GOAL", carrier.team, carrier, goalRow);
    this.addLiveEvent(carrier.team, "GOAL", `${carrier.name} ${goalRow.matchMinute}'`);
    this.startBallFlight("shot", shotOrigin, shotTarget, this.flightDuration(clamp(distToGoal / 34, 0.75, 1.4)), 1.0);
    this.possession = null;
    return { scoringTeam: teamSide(carrier.team) };
  }

  private resolveTackleChance(carrier: SimplePlayer, pressure: number): GoalEvent | null {
    if (pressure < 1.2) return null;
    const chance = clamp((pressure - 1.1) * 0.08, 0, 0.18);
    if (this.rng.next() > chance) return null;
    const tackler = this.nearestOpponent(carrier, otherTeam(carrier.team));
    if (!tackler) return null;
    this.possession = tackler;
    this.rememberTouch(tackler);
    this.team(tackler.team).tacklesWon += 1;
    tackler.stats.tackles += 1;
    this.addLiveEvent(tackler.team, "TACKLE", `${tackler.label} won it`);
    this.recordEvent("TURNOVER", tackler.team, tackler, {
      carrier: carrier.name,
      outcome: "tackle",
      pressure,
    });
    return null;
  }

  private totalShots() {
    return this.teamA.shots + this.teamB.shots;
  }

  private shouldApplyNoShotPressure(carrier: SimplePlayer, distToGoal: number, forwardX: number) {
    if (this.totalShots() > 0) return false;
    if (this.msm.state.kind !== "live_play" || this.msm.clock.half !== 2) return false;
    if (carrier.role === "GK") return false;
    const halfDuration = Math.max(1, this.msm.clock.halfDuration);
    const progress = this.msm.clock.elapsedInHalf / halfDuration;
    if (progress < 0.40) return false;
    const desperate = progress >= 0.82;
    const maxDistanceYards = desperate ? 38 : 32;
    const maxDistance = (maxDistanceYards / 120) * FIELD_W;
    const minForward = desperate ? -8 : 0;
    return distToGoal <= maxDistance && forwardX >= minForward;
  }

  private shouldForceFinalNoShotAttempt(dt: number) {
    if (this.totalShots() > 0) return false;
    if (this.msm.state.kind !== "live_play" || this.msm.clock.half !== 2) return false;
    if (!this.possession || this.possession.role === "GK" || this.ballFlight) return false;
    const halfLimit = this.msm.clock.halfDuration + this.msm.clock.stoppageTime;
    return this.msm.clock.elapsedInHalf + dt >= halfLimit;
  }

  private forceNoShotAttempt(reason: string): GoalEvent | null {
    const carrier = this.possession;
    if (!carrier || carrier.role === "GK") return null;
    const goal = goalCenterForAttack(this.attackSign(carrier.team));
    const distToGoal = dist2(carrier.pos, goal);
    if (((distToGoal / FIELD_W) * 120) > 42) return null;
    const pressure = this.pressureOn(carrier);
    this.recordShotOpportunity(carrier, distToGoal, pressure, 1, "minimum_shot_floor", {
      reason,
      forcedAtClockEnd: reason === "NO_SHOT_FINAL_WHISTLE",
    });
    return this.resolveShot(carrier, distToGoal, pressure, {
      reason,
      style: distToGoal < 14 ? "driven" : "desperation",
      details: {
        forcedAtClockEnd: reason === "NO_SHOT_FINAL_WHISTLE",
      },
    });
  }

  private rebuildTeams() {
    this.players.length = 0;
    this.lastCompletedPass = null;
    this.addTeam("A", this.teamA);
    this.addTeam("B", this.teamB);
    this.installKickoffPossession("A");
  }

  private addTeam(team: SimpleTeamCode, stats: TeamStats) {
    const attackSign = this.attackSignForHalf(team, this.msm.clock.half);
    getFormationSlots(stats.formation).forEach((slot, index) => {
      const homePos = orientSlot(slot, attackSign);
      this.players.push({
        id: `${team}-${index}`,
        name: defaultPlayerName(stats.name, slot.role, slot.label, index),
        team,
        side: teamSide(team),
        role: slot.role,
        label: slot.label,
        shirtNumber: index + 1,
        pos: { x: homePos.x, y: 0.15, z: homePos.z },
        vel: { x: 0, z: 0 },
        homePos,
        targetPos: { ...homePos },
        ratings: getRoleRatings(slot.role, stats.name, index),
        stats: createStats(),
      });
    });
  }

  private installKickoffPossession(team: SimpleTeamCode) {
    const attackSign = this.attackSign(team);
    for (const player of this.players) {
      const slot = getFormationSlots(this.team(player.team).formation)[Number(player.id.split("-")[1]) || 0];
      const homePos = orientSlot(slot, this.attackSign(player.team));
      player.homePos = homePos;
      player.pos.x = homePos.x;
      player.pos.z = homePos.z;
      player.targetPos = { ...homePos };
    }
    const starter =
      this.players.find((p) => p.team === team && p.role === "ST")
      || this.players.find((p) => p.team === team && p.role === "CM")
      || this.players.find((p) => p.team === team);
    if (starter) {
      starter.pos.x = -0.8 * attackSign;
      starter.pos.z = 0;
      this.possession = starter;
      this.ballFlight = null;
      this.ball.pos.x = starter.pos.x;
      this.ball.pos.y = 0.18;
      this.ball.pos.z = starter.pos.z;
    }
  }

  private installKickoffSetup(team: SimpleTeamCode) {
    this.kickoffTeam = team;
    this.ballFlight = null;
    this.ball.pos.x = 0;
    this.ball.pos.y = this.ballGroundY();
    this.ball.pos.z = 0;
    this.ball.vel = { x: 0, z: 0 };
    const snapPlayers = this.shouldSnapKickoffSetup();
    this.kickoffSetupMoving = !snapPlayers;

    const attackSign = this.attackSign(team);
    const starter =
      this.players.find((p) => p.team === team && p.role === "ST")
      || this.players.find((p) => p.team === team && p.role === "CM")
      || this.players.find((p) => p.team === team);
    this.kickoffKickerId = starter?.id || null;

    for (const player of this.players) {
      const slot = getFormationSlots(this.team(player.team).formation)[Number(player.id.split("-")[1]) || 0];
      const homePos = orientSlot(slot, this.attackSign(player.team));
      player.homePos = homePos;
      const kickoffSeed = snapPlayers ? homePos : { x: player.pos.x, z: player.pos.z };
      const kickoffPos = this.kickoffLegalPosition(kickoffSeed, player, player.id === this.kickoffKickerId);
      player.targetPos = { ...kickoffPos };
      if (snapPlayers) {
        player.pos.x = kickoffPos.x;
        player.pos.z = kickoffPos.z;
        player.vel = { x: 0, z: 0 };
      }
    }

    if (starter) {
      const starterPos = { x: -0.65 * attackSign, z: 0 };
      starter.targetPos = starterPos;
      if (snapPlayers) {
        starter.pos.x = starterPos.x;
        starter.pos.z = starterPos.z;
        starter.vel = { x: 0, z: 0 };
      }
      this.possession = starter;
    } else {
      this.possession = null;
    }
  }

  private shouldSnapKickoffSetup() {
    return this.elapsedTotal <= SIMULATION_DT
      && this.msm.clock.half === 1
      && this.msm.clock.elapsedInHalf <= SIMULATION_DT
      && this.events.length === 0;
  }

  private isKickoffSetupReady() {
    if (!this.kickoffSetupMoving) return true;
    const ready = this.players.every((player) => {
      const tolerance = player.id === this.kickoffKickerId ? 0.42 : 0.75;
      return dist2(player.pos, player.targetPos) <= tolerance;
    });
    if (ready) this.kickoffSetupMoving = false;
    return ready;
  }

  private kickoffLegalPosition(homePos: Vec2, player: SimplePlayer, isKicker: boolean): Vec2 {
    const attackSign = this.attackSign(player.team);
    const ownHalfBuffer = KICKOFF_OWN_HALF_BUFFER;
    if (isKicker) return { x: -0.65 * attackSign, z: 0 };

    let x = homePos.x;
    let z = homePos.z;
    if (x * attackSign > -ownHalfBuffer) {
      x = -ownHalfBuffer * attackSign;
    }

    const centerClearance = CENTER_CIRCLE_RADIUS + 0.35;
    if (Math.hypot(x, z) < centerClearance) {
      const zSign = z < 0 ? -1 : 1;
      const safeZ = Math.abs(z) < 0.4 ? zSign * centerClearance : z;
      z = clamp(safeZ, -FIELD_D / 2 + 1, FIELD_D / 2 - 1);
      if (Math.hypot(x, z) < centerClearance) {
        x = -attackSign * Math.sqrt(Math.max(0, centerClearance ** 2 - z ** 2));
        x -= attackSign * 0.35;
      }
    }

    return clampToPlayable({ x, z });
  }

  private executeKickoff() {
    const team = this.kickoffTeam || this.possession?.team || "A";
    const kicker = this.players.find((p) => p.id === this.kickoffKickerId)
      || this.players.find((p) => p.team === team && p.role === "ST")
      || this.players.find((p) => p.team === team);
    if (!kicker) return;

    const receiver = this.kickoffReceiver(team, kicker.id);
    if (!receiver) {
      this.possession = kicker;
      this.kickoffTeam = null;
      this.kickoffKickerId = null;
      this.kickoffSetupMoving = false;
      return;
    }

    const origin = { x: 0, z: 0 };
    const distance = dist2(origin, receiver.pos);
    const progress = (receiver.pos.x - origin.x) * this.attackSign(team);
    const stats = this.team(team);
    stats.passes += 1;
    stats.passesCompleted += 1;
    kicker.stats.passes += 1;
    kicker.stats.passesCompleted += 1;
    this.possession = receiver;
    this.startBallFlight("pass", origin, receiver.pos, this.flightDuration(clamp(distance / 24, 0.55, 0.9)), 0.45, receiver);
    this.addLiveEvent(team, "KICKOFF", `${kicker.label} to ${receiver.label}`);
    const decision = {
      team,
      passer: kicker.name,
      carrier: kicker.name,
      passerRole: kicker.role,
      role: kicker.role,
      passTarget: receiver.name,
      passTargetName: receiver.name,
      targetRole: receiver.role,
      distance: +distance.toFixed(2),
      passForwardProg: +progress.toFixed(2),
      bestTargetForwardProg: +progress.toFixed(2),
      closePressure: 0,
      completionChance: 1,
      shouldPass: true,
      passStyle: progress > 3 ? "FORWARD" : progress < -2 ? "BACK" : "LATERAL",
      carrierZone: "KICKOFF",
      completed: true,
      restart: "kickoff",
    };
    this.passDecisions.push(decision);
    kicker.stats.touches += 1;
    receiver.stats.touches += 1;
    this.passLog.push(this.recordEvent("PASS", team, kicker, {
      ...decision,
      target: receiver.name,
      outcome: "complete",
      progress,
    }));
    this.rememberCompletedPass(kicker, receiver);
    this.actionTimer = 0.45;
    this.kickoffShapeReleaseRemaining = KICKOFF_SHAPE_RELEASE_SECONDS;
    this.kickoffTeam = null;
    this.kickoffKickerId = null;
    this.kickoffSetupMoving = false;
  }

  private claimLooseBallPossession(fallbackTeam: SimpleTeamCode) {
    const ball = { x: this.ball.pos.x, z: this.ball.pos.z };
    const claimant = this.nearestPlayerTo(ball)?.player
      || this.players.find((p) => p.team === fallbackTeam && p.role !== "GK")
      || this.players.find((p) => p.team === fallbackTeam)
      || null;
    this.possession = claimant;
    if (claimant && !this.ballFlight) {
      this.ball.pos.x = claimant.pos.x;
      this.ball.pos.y = this.ballGroundY();
      this.ball.pos.z = claimant.pos.z;
      this.ball.vel = { x: 0, z: 0 };
    }
  }

  private kickoffReceiver(team: SimpleTeamCode, kickerId: string) {
    const attackSign = this.attackSign(team);
    const candidates = this.players
      .filter((player) => player.team === team && player.id !== kickerId && player.role !== "GK")
      .filter((player) => player.pos.x * attackSign < -0.1)
      .sort((a, b) => {
        const roleScore = (player: SimplePlayer) => player.role === "CM" || player.role === "DM" ? 0 : player.role === "CB" || player.role === "FB" ? 1 : 2;
        return roleScore(a) - roleScore(b) || Math.abs(a.pos.z) - Math.abs(b.pos.z);
      });
    return candidates[0] || null;
  }

  private rememberTouch(player: SimplePlayer | null | undefined) {
    if (!player) return;
    this.lastTouchTeam = player.team;
    this.lastTouchPlayerId = player.id;
  }

  private detectAndStageBallOut() {
    if (this.pendingBallOutEvent || this.msm.state.kind !== "live_play") return;
    const current = { x: this.ball.pos.x, z: this.ball.pos.z };
    const detected = detectBallOut(current.x, current.z, this.lastTouchTeam ? teamSide(this.lastTouchTeam) : null, this.attackSign("A"));
    if (!detected) return;
    const context = this.buildBallOutContext(detected, this.lastBallPos, current);
    if (!context) return;
    this.truncateActiveFlightAtOutOfPlay(context.spot);
    this.pendingBallOutEvent = detected;
    this.pendingBallOutContext = context;
    this.ballOutLog.push({
      type: detected.restartType,
      team: context.restartTeam,
      spot: { ...context.spot },
      lastTouchTeam: context.lastTouchTeam,
      lastTouchPlayerId: context.lastTouchPlayerId,
      crossedLine: context.crossedLine,
      elapsedInHalf: +this.msm.clock.elapsedInHalf.toFixed(2),
      half: this.msm.clock.half,
    });
    if (this.ballOutLog.length > 1000) this.ballOutLog.shift();
  }

  private buildBallOutContext(event: BallOutEvent, from: Vec2, to: Vec2): BallOutRestartContext | null {
    const halfZ = FIELD_D / 2;
    let crossedLine: BallOutRestartContext["crossedLine"];
    let spot = { x: to.x, z: to.z };
    if (to.z > halfZ || to.z < -halfZ) {
      const lineZ = to.z > 0 ? halfZ : -halfZ;
      const t = Math.abs(to.z - from.z) > 0.001 ? clamp((lineZ - from.z) / (to.z - from.z), 0, 1) : 1;
      spot = { x: clamp(from.x + (to.x - from.x) * t, LEFT_GOAL_X + 0.8, RIGHT_GOAL_X - 0.8), z: lineZ };
      crossedLine = to.z > 0 ? "top_touchline" : "bottom_touchline";
    } else if (to.x > RIGHT_GOAL_X || to.x < LEFT_GOAL_X) {
      const lineX = to.x > 0 ? RIGHT_GOAL_X : LEFT_GOAL_X;
      const t = Math.abs(to.x - from.x) > 0.001 ? clamp((lineX - from.x) / (to.x - from.x), 0, 1) : 1;
      spot = { x: lineX, z: clamp(from.z + (to.z - from.z) * t, -halfZ + 0.8, halfZ - 0.8) };
      crossedLine = to.x > 0 ? "right_goal_line" : "left_goal_line";
    } else {
      return null;
    }
    return {
      restartType: event.restartType,
      restartTeam: codeFromSide(event.restartTeam),
      spot,
      lastTouchTeam: this.lastTouchTeam,
      lastTouchPlayerId: this.lastTouchPlayerId,
      crossedLine,
    };
  }

  private truncateActiveFlightAtOutOfPlay(spot: Vec2) {
    if (!this.ballFlight) return;
    const latest = this.ballFlightTelemetry.at(-1);
    if (!latest || latest.seq !== this.ballFlightSeq) return;
    const durationSeconds = Math.max(SIMULATION_DT, this.ballFlight.elapsed);
    const distanceUnits = dist2(this.ballFlight.from, spot);
    const distanceYards = distanceUnits / FIELD_SCALE_PER_YARD;
    const speedUnitsPerSecond = distanceUnits / durationSeconds;
    const speedYardsPerSecond = distanceYards / durationSeconds;
    latest.to = { ...spot };
    latest.distanceUnits = +distanceUnits.toFixed(2);
    latest.distanceYards = +distanceYards.toFixed(1);
    latest.durationSeconds = +durationSeconds.toFixed(2);
    latest.speedUnitsPerSecond = +speedUnitsPerSecond.toFixed(2);
    latest.speedYardsPerSecond = +speedYardsPerSecond.toFixed(1);
    latest.speedMps = +(speedYardsPerSecond * 0.9144).toFixed(1);
    latest.speedMph = +(speedYardsPerSecond * 0.9144 * 2.236936).toFixed(1);
  }

  private installBallOutRestart(context: BallOutRestartContext | null) {
    const state = this.msm.state.kind === "ball_out" ? this.msm.state : null;
    if (!state) return;
    const fallback: BallOutRestartContext = {
      restartType: state.restartType,
      restartTeam: codeFromSide(state.restartTeam),
      spot: { x: clamp(this.ball.pos.x, LEFT_GOAL_X, RIGHT_GOAL_X), z: clamp(this.ball.pos.z, -FIELD_D / 2, FIELD_D / 2) },
      lastTouchTeam: this.lastTouchTeam,
      lastTouchPlayerId: this.lastTouchPlayerId,
      crossedLine: Math.abs(this.ball.pos.z) >= FIELD_D / 2 ? "top_touchline" : this.ball.pos.x > 0 ? "right_goal_line" : "left_goal_line",
    };
    const restart = context || fallback;
    restart.spot = this.restartSpot(restart);
    const taker = this.restartTaker(restart);
    restart.takerId = taker?.id;
    this.restartContext = restart;
    this.ballFlight = null;
    this.possession = taker || null;
    this.ball.pos = { x: restart.spot.x, y: this.ballGroundY(), z: restart.spot.z };
    this.ball.vel = { x: 0, z: 0 };
    if (taker) {
      taker.targetPos = this.restartTakerTarget(restart);
    }
    const stats = this.team(restart.restartTeam);
    if (restart.restartType === "corner") stats.corners += 1;
    if (restart.restartType === "throw_in") stats.throwIns += 1;
    if (restart.restartType === "goal_kick") stats.goalKicks += 1;
    const setupMeta = {
      phase: "setup",
      restartType: restart.restartType,
      takerId: taker?.id || null,
      takerName: taker?.name || null,
      spot: { ...restart.spot },
      lastTouchTeam: restart.lastTouchTeam,
      crossedLine: restart.crossedLine,
    };
    this.addLiveEvent(restart.restartTeam, this.restartAction(restart.restartType), this.restartAction(restart.restartType).toLowerCase().replace("_", " "), setupMeta);
    this.recordEvent(this.restartAction(restart.restartType), restart.restartTeam, taker, {
      ...setupMeta,
      lastTouchPlayerId: restart.lastTouchPlayerId,
    });
  }

  private restartSpot(restart: BallOutRestartContext): Vec2 {
    if (restart.restartType === "corner") {
      return { x: restart.spot.x > 0 ? RIGHT_GOAL_X - 0.35 : LEFT_GOAL_X + 0.35, z: restart.spot.z >= 0 ? FIELD_D / 2 - 0.35 : -FIELD_D / 2 + 0.35 };
    }
    if (restart.restartType === "goal_kick") {
      const attackSign = this.attackSign(restart.restartTeam);
      const ownGoalX = attackSign > 0 ? LEFT_GOAL_X + 5.2 : RIGHT_GOAL_X - 5.2;
      return { x: ownGoalX, z: clamp(restart.spot.z * 0.12, -GOAL_MOUTH_HALF_Z, GOAL_MOUTH_HALF_Z) };
    }
    return { x: clamp(restart.spot.x, LEFT_GOAL_X + 0.8, RIGHT_GOAL_X - 0.8), z: restart.spot.z >= 0 ? FIELD_D / 2 - 0.25 : -FIELD_D / 2 + 0.25 };
  }

  private restartTaker(restart: BallOutRestartContext) {
    if (restart.restartType === "goal_kick") {
      return this.players.find((player) => player.team === restart.restartTeam && player.role === "GK") || null;
    }
    return this.nearestTeamPlayer(restart.restartTeam, restart.spot)
      || this.players.find((player) => player.team === restart.restartTeam && player.role !== "GK")
      || null;
  }

  private restartTakerTarget(restart: BallOutRestartContext): Vec2 {
    const inwardZ = restart.spot.z > 0 ? -0.9 : restart.spot.z < 0 ? 0.9 : 0;
    const inwardX = restart.spot.x > RIGHT_GOAL_X - 1 ? -0.9 : restart.spot.x < LEFT_GOAL_X + 1 ? 0.9 : 0;
    return clampToPlayable({ x: restart.spot.x + inwardX, z: restart.spot.z + inwardZ });
  }

  private moveRestartPlayers(dt: number) {
    const restart = this.restartContext;
    if (!restart) return;
    const taker = restart.takerId ? this.players.find((player) => player.id === restart.takerId) : null;
    if (taker) taker.targetPos = this.restartTakerTarget(restart);
    this.movePlayers(dt);
    this.ball.pos = { x: restart.spot.x, y: this.ballGroundY(), z: restart.spot.z };
    this.ball.vel = { x: 0, z: 0 };
  }

  private executeBallOutRestart() {
    const restart = this.restartContext;
    if (!restart) return;
    const taker = restart.takerId ? this.players.find((player) => player.id === restart.takerId) : null;
    const receiver = this.restartReceiver(restart, taker?.id);
    if (!receiver) {
      this.restartContext = null;
      return;
    }
    this.possession = receiver;
    this.rememberTouch(receiver);
    const distance = dist2(restart.spot, receiver.pos);
    const arcHeight = restart.restartType === "throw_in" ? 0.85 : restart.restartType === "corner" ? 0.7 : 0.22;
    this.startBallFlight("restart", restart.spot, receiver.pos, this.flightDuration(clamp(distance / 24, 0.7, 1.45)), arcHeight, receiver);
    const releaseMeta = {
      phase: "release",
      restartType: restart.restartType,
      takerId: taker?.id || null,
      takerName: taker?.name || null,
      receiverId: receiver.id,
      receiverName: receiver.name,
      spot: { ...restart.spot },
      targetPoint: { x: +receiver.pos.x.toFixed(2), z: +receiver.pos.z.toFixed(2) },
      distance: +distance.toFixed(2),
      arcHeight,
    };
    this.addLiveEvent(restart.restartTeam, this.restartAction(restart.restartType), `${taker?.label || "Restart"} to ${receiver.label}`, releaseMeta);
    this.passLog.push(this.recordEvent(this.restartAction(restart.restartType), restart.restartTeam, taker || receiver, {
      ...releaseMeta,
      target: receiver.name,
      outcome: "complete",
    }));
    this.actionTimer = Math.max(0.35, this.nextActionDelay() * 0.5);
    this.restartContext = null;
  }

  private restartReceiver(restart: BallOutRestartContext, takerId?: string) {
    const attackSign = this.attackSign(restart.restartTeam);
    const candidates = this.players
      .filter((player) => player.team === restart.restartTeam && player.id !== takerId && player.role !== "GK")
      .sort((a, b) => {
        if (restart.restartType === "corner") {
          const goal = goalCenterForAttack(attackSign);
          return dist2(a.pos, goal) - dist2(b.pos, goal);
        }
        return dist2(a.pos, restart.spot) - dist2(b.pos, restart.spot);
      });
    return candidates[0] || null;
  }

  private restartAction(type: BallOutEvent["restartType"]) {
    if (type === "throw_in") return "THROW_IN";
    if (type === "goal_kick") return "GOAL_KICK";
    if (type === "corner") return "CORNER";
    return "FREE_KICK";
  }

  private installKeeperPossession(team: SimpleTeamCode) {
    const keeper = this.players.find((p) => p.team === team && p.role === "GK");
    if (!keeper) return;
    this.possession = keeper;
    this.rememberTouch(keeper);
    this.addLiveEvent(team, "GK", "keeper possession");
  }

  private startBallFlight(kind: BallFlightKind, from: Vec2, to: Vec2, duration: number, arc: number, followPlayer?: SimplePlayer) {
    const start = this.ballFlight ? { x: this.ball.pos.x, z: this.ball.pos.z } : { ...from };
    const target = { x: to.x, z: to.z };
    const distanceUnits = dist2(start, target);
    const distanceYards = distanceUnits / FIELD_SCALE_PER_YARD;
    const targetSpeedMps = this.ballFlightTargetSpeedMps(kind, distanceYards);
    const speedDuration = (distanceYards * 0.9144) / targetSpeedMps;
    const minDuration = kind === "shot" || kind === "save" || kind === "miss" ? 0.12 : 0.28;
    const readabilityDuration = kind === "shot" || kind === "save" || kind === "miss" ? 0 : duration * 0.45;
    const maxDuration = kind === "shot" || kind === "save" || kind === "miss" ? 3.2 : 2.4;
    const safeDuration = clamp(Math.max(0.001, speedDuration, readabilityDuration), minDuration, maxDuration);
    const speedUnitsPerSecond = distanceUnits / safeDuration;
    const speedYardsPerSecond = distanceYards / safeDuration;
    const flightArc = this.ballFlightArc(kind, distanceYards, arc);
    this.ballFlight = {
      kind,
      from: start,
      to: target,
      followPlayerId: followPlayer?.id,
      elapsed: 0,
      duration: safeDuration,
      arc: flightArc,
    };
    this.ballFlightTelemetry.push({
      seq: ++this.ballFlightSeq,
      kind,
      minute: getMatchMinute(this.msm),
      half: this.msm.clock.half,
      elapsedInHalf: +this.msm.clock.elapsedInHalf.toFixed(2),
      distanceUnits: +distanceUnits.toFixed(2),
      distanceYards: +distanceYards.toFixed(1),
      durationSeconds: +safeDuration.toFixed(2),
      speedUnitsPerSecond: +speedUnitsPerSecond.toFixed(2),
      speedYardsPerSecond: +speedYardsPerSecond.toFixed(1),
      speedMps: +(speedYardsPerSecond * 0.9144).toFixed(1),
      speedMph: +(speedYardsPerSecond * 0.9144 * 2.236936).toFixed(1),
      from: { ...start },
      to: { ...target },
      followPlayerId: followPlayer?.id,
      followPlayerName: followPlayer?.name,
      arc: +flightArc.toFixed(3),
    });
    if (this.ballFlightTelemetry.length > 2400) this.ballFlightTelemetry.shift();
    this.ball.pos.x = start.x;
    this.ball.pos.y = this.ballGroundY();
    this.ball.pos.z = start.z;
    this.ball.vel = distanceUnits > 0.001
      ? { x: ((target.x - start.x) / distanceUnits) * speedUnitsPerSecond, z: ((target.z - start.z) / distanceUnits) * speedUnitsPerSecond }
      : { x: 0, z: 0 };
  }

  private ballGroundY() {
    return 0.18;
  }

  private ballFlightArc(kind: BallFlightKind, distanceYards: number, requestedArc: number) {
    if (kind === "pass" || kind === "restart") {
      if (kind === "restart" && requestedArc > 0.5) return Math.min(requestedArc, 1.05);
      if (distanceYards <= 12) return 0.035;
      if (distanceYards <= 28) return lerpNumber(0.045, 0.11, clamp((distanceYards - 12) / 16, 0, 1));
      if (distanceYards <= 42) return lerpNumber(0.12, 0.24, clamp((distanceYards - 28) / 14, 0, 1));
      return Math.min(requestedArc, lerpNumber(0.28, 0.46, clamp((distanceYards - 42) / 24, 0, 1)));
    }
    if (kind === "interception") return Math.min(requestedArc, 0.10);
    if (kind === "save") return Math.min(requestedArc, 0.22);
    if (kind === "shot") return Math.min(requestedArc, 0.30);
    if (kind === "miss") return Math.min(requestedArc, 0.38);
    return Math.min(requestedArc, 0.18);
  }

  private nextActionDelay() {
    const tempo = this.team(this.possession?.team || "A").tuning.tempo;
    const baseDelay = clamp(5.7 - tempo * 1.4 + this.rng.range(-0.9, 1.4), 3.35, 7.4);
    return clamp(baseDelay / this.productionCompression(), 0.03, 8.5);
  }

  private productionCompression() {
    const halfDuration = Math.max(1, this.msm.clock.halfDuration);
    return clamp(1 + 8.00 * (2700 / halfDuration - 1), 1, 64);
  }

  private flightDuration(baseDuration: number) {
    return clamp(baseDuration, 0.55, 1.35);
  }

  private ballFlightTargetSpeedMps(kind: BallFlightKind, distanceYards: number) {
    if (kind === "shot" || kind === "save" || kind === "miss") {
      return lerpNumber(31, 38, clamp((distanceYards - 10) / 28, 0, 1));
    }
    if (kind === "pass" || kind === "interception" || kind === "restart") {
      if (distanceYards <= 40) return lerpNumber(20.4, 21.2, clamp(distanceYards / 40, 0, 1));
      return lerpNumber(25, 31, clamp((distanceYards - 40) / 25, 0, 1));
    }
    return 22;
  }

  private auditCarrierBallGap(carrier: SimplePlayer) {
    const ball = { x: this.ball.pos.x, z: this.ball.pos.z };
    const gap = dist2(ball, carrier.pos);
    if (gap <= 2.0) return;
    this.recordVisualRealityEvent({
      type: "BALL_CARRIER_GAP",
      gapUnits: +gap.toFixed(2),
      ball,
      playerId: carrier.id,
      playerName: carrier.name,
    });
  }

  private auditFlightLanding(flight: BallFlightState) {
    if (flight.kind !== "pass" && flight.kind !== "interception" && flight.kind !== "save") return;
    const ball = { x: this.ball.pos.x, z: this.ball.pos.z };
    const nearest = this.nearestPlayerTo(ball);
    if (!flight.followPlayerId) {
      this.recordVisualRealityEvent({
        type: "MISSING_FLIGHT_TARGET",
        kind: flight.kind,
        ball,
        nearestPlayerName: nearest?.player.name,
        nearestPlayerGap: nearest ? +nearest.gap.toFixed(2) : undefined,
      });
      return;
    }
    const player = this.players.find((p) => p.id === flight.followPlayerId);
    if (!player) {
      this.recordVisualRealityEvent({
        type: "MISSING_FLIGHT_TARGET",
        kind: flight.kind,
        ball,
        playerId: flight.followPlayerId,
        nearestPlayerName: nearest?.player.name,
        nearestPlayerGap: nearest ? +nearest.gap.toFixed(2) : undefined,
      });
      return;
    }
    const gap = dist2(ball, player.pos);
    if (gap <= 1.6) return;
    this.recordVisualRealityEvent({
      type: "EMPTY_FLIGHT_LANDING",
      kind: flight.kind,
      gapUnits: +gap.toFixed(2),
      ball,
      playerId: player.id,
      playerName: player.name,
      nearestPlayerName: nearest?.player.name,
      nearestPlayerGap: nearest ? +nearest.gap.toFixed(2) : undefined,
    });
  }

  private recordVisualRealityEvent(event: Omit<VisualRealityEvent, "minute" | "half" | "elapsedInHalf">) {
    this.visualRealityEvents.push({
      minute: getMatchMinute(this.msm),
      half: this.msm.clock.half,
      elapsedInHalf: +this.msm.clock.elapsedInHalf.toFixed(2),
      ...event,
    });
    if (this.visualRealityEvents.length > 1000) this.visualRealityEvents.shift();
  }

  private nearestPlayerTo(pos: Vec2) {
    let best: { player: SimplePlayer; gap: number } | null = null;
    for (const player of this.players) {
      const gap = dist2(pos, player.pos);
      if (!best || gap < best.gap) best = { player, gap };
    }
    return best;
  }

  private attackExpansionScale() {
    return 1;
  }

  private shotTarget(team: SimpleTeamCode, onTarget: boolean, anglePenalty: number): Vec2 {
    const goal = goalCenterForAttack(this.attackSign(team));
    if (onTarget) {
      return { x: goal.x, z: this.rng.range(-GOAL_MOUTH_HALF_Z * 0.75, GOAL_MOUTH_HALF_Z * 0.75) };
    }
    const missSide = this.rng.next() < 0.5 ? -1 : 1;
    const missZ = missSide * (GOAL_MOUTH_HALF_Z + this.rng.range(0.8, 4.2 + anglePenalty * 2));
    return { x: goal.x + this.attackSign(team) * this.rng.range(-0.7, 1.4), z: missZ };
  }

  private keeperDiveDirection(keeper: SimplePlayer | undefined, shotTarget: Vec2): KeeperDiveDirection {
    if (!keeper) return "down";
    const lateral = shotTarget.z - keeper.pos.z;
    if (Math.abs(lateral) > 0.45) return lateral < 0 ? "left" : "right";
    const goalward = Math.abs(shotTarget.x - keeper.pos.x);
    return goalward > 1.2 ? "up" : "down";
  }

  private bestPassTarget(carrier: SimplePlayer) {
    const attackSign = this.attackSign(carrier.team);
    const own = this.players.filter((p) => p.team === carrier.team && p.id !== carrier.id && p.role !== "GK");
    const choose = (maxDistance: number, allowOffsideTarget = false) => {
      let best: SimplePlayer | null = null;
      let bestScore = -Infinity;
      for (const target of own) {
        const d = dist2(carrier.pos, target.pos);
        if (d < 2 || d > maxDistance) continue;
        if (this.wouldExceedPassPairLoop(carrier, target)) continue;
        if (!allowOffsideTarget && this.offsideInfraction(carrier, target, carrier.pos)) continue;
        const progress = (target.pos.x - carrier.pos.x) * attackSign;
        const separation = this.nearestDefenderDistance(target, otherTeam(carrier.team));
        const roleBonus = target.role === "ST" || target.role === "W" || target.role === "AM" ? 1.6 : 0;
        const progressWeight = progress >= 0 ? 0.45 : 0.18;
        const backPenalty = progress < -2 ? Math.abs(progress) * 0.75 : 0;
        const score = separation * 1.2 + progress * progressWeight - d * 0.45 + roleBonus - backPenalty + this.rng.range(-0.5, 0.5);
        if (score > bestScore) {
          bestScore = score;
          best = target;
        }
      }
      return best;
    };
    return choose(12.5) || choose(16.5) || choose(24) || choose(32) || choose(42) || choose(32, true) || choose(42, true);
  }

  private completedPassPairKey(a: SimplePlayer, b: SimplePlayer) {
    return [a.id, b.id].sort().join("|");
  }

  private rememberCompletedPass(from: SimplePlayer, to: SimplePlayer) {
    const pairKey = this.completedPassPairKey(from, to);
    const previous = this.lastCompletedPass;
    const streak = previous?.team === from.team && previous.pairKey === pairKey ? previous.streak + 1 : 1;
    this.lastCompletedPass = {
      team: from.team,
      fromId: from.id,
      toId: to.id,
      pairKey,
      streak,
    };
  }

  private wouldExceedPassPairLoop(carrier: SimplePlayer, target: SimplePlayer) {
    const previous = this.lastCompletedPass;
    if (!previous || previous.team !== carrier.team || previous.streak < 2) return false;
    if (previous.pairKey !== this.completedPassPairKey(carrier, target)) return false;
    this.lastPassLoopTelemetry = {
      seq: ++this.passLoopSeq,
      team: carrier.team,
      carrier: carrier.name,
      blockedTarget: target.name,
      pairKey: previous.pairKey,
      streak: previous.streak,
      reason: "MAX_TWO_PLAYER_EXCHANGE",
    };
    return true;
  }

  private shootUrge(carrier: SimplePlayer, distToGoal: number, pressure: number) {
    if (carrier.role === "GK" || carrier.role === "CB" || carrier.role === "FB") return 0.004;
    const role = carrier.role === "ST" ? 0.012 : carrier.role === "W" || carrier.role === "AM" ? 0.008 : 0.004;
    const distance = distToGoal < 8 ? 0.090 : distToGoal < 14 ? 0.058 : distToGoal < 22 ? 0.028 : distToGoal < 29 ? 0.008 : 0.001;
    const centrality = clamp(1 - Math.abs(carrier.pos.z) / (FIELD_D * 0.42), 0, 1);
    const pressureBoost = Math.min(0.008, pressure * 0.0020);
    const attackBoost = (this.team(carrier.team).tuning.attack - 0.5) * 0.007;
    const centralBoost = centrality * 0.012;
    return clamp((role + distance + pressureBoost + attackBoost + centralBoost) * this.shotSelectionScale(), 0.001, 0.12);
  }

  private distanceShotChance(carrier: SimplePlayer, distToGoal: number, pressure: number, forwardX: number) {
    if (!["ST", "W", "AM", "CM"].includes(carrier.role)) return 0;
    if (forwardX < 8) return 0;
    const distYards = (distToGoal / FIELD_W) * 120;
    if (distYards < 20 || distYards > 36) return 0;
    const centrality = clamp(1 - Math.abs(carrier.pos.z) / (FIELD_D * 0.38), 0, 1);
    if (centrality < 0.22) return 0;
    const roleBase = carrier.role === "ST" ? 0.045 : carrier.role === "AM" ? 0.040 : carrier.role === "W" ? 0.030 : 0.020;
    const sweetSpot = clamp(1 - Math.abs(distYards - 27) / 11, 0, 1);
    const centralBoost = centrality * 0.020;
    const attackBoost = (this.team(carrier.team).tuning.attack - 0.5) * 0.012;
    const pressureBoost = clamp(pressure * 0.012, 0, 0.020);
    return clamp((roleBase + sweetSpot * 0.025 + centralBoost + attackBoost + pressureBoost) * this.shotSelectionScale(), 0, 0.08);
  }

  private shotSelectionScale() {
    return 2.50;
  }

  private maxGoalDistanceYards(role: SimpleRole, context: ShotResolutionContext) {
    if (context.forceGoal || context.reason === "OPEN_NET_FINISH") return 24;
    if (role === "GK") return 0;
    if (role === "CB" || role === "FB") return 34;
    if (role === "DM" || role === "CM") return 42;
    return 46;
  }

  private goalmouthFidelity(carrier: SimplePlayer, keeper: SimplePlayer | undefined, distToGoal: number) {
    const attackSign = this.attackSign(carrier.team);
    const goal = goalCenterForAttack(attackSign);
    const carrierDepth = (goal.x - carrier.pos.x) * attackSign;
    const keeperDepth = keeper ? (goal.x - keeper.pos.x) * attackSign : Infinity;
    const keeperLaneGap = keeper ? Math.abs(keeper.pos.z - carrier.pos.z) : Infinity;
    const centralGoalmouth = Math.abs(carrier.pos.z) <= GOAL_MOUTH_HALF_Z * 0.78 && carrierDepth >= -0.15 && carrierDepth <= 1.45;
    const keeperGoalSide = !!keeper && keeperDepth >= -0.5 && keeperDepth <= carrierDepth + 1.7;
    const keeperInLane = !!keeper && keeperLaneGap <= Math.max(1.65, GOAL_MOUTH_HALF_Z * 0.82);
    const keeperBetweenBallAndGoal = keeperGoalSide && keeperInLane;
    const keeperClearlyBehind = !!keeper && keeperDepth > carrierDepth + 2.1;
    const keeperClearlyWide = !!keeper && keeperLaneGap > GOAL_MOUTH_HALF_Z * 1.35;
    const keeperBeaten = !keeper || (!keeperBetweenBallAndGoal && (keeperClearlyBehind || keeperClearlyWide));
    return {
      openNet: centralGoalmouth && distToGoal < 4.6 && keeperBeaten,
      telemetry: {
        centralGoalmouth,
        carrierDepth: +carrierDepth.toFixed(2),
        keeperDepth: Number.isFinite(keeperDepth) ? +keeperDepth.toFixed(2) : null,
        keeperLaneGap: Number.isFinite(keeperLaneGap) ? +keeperLaneGap.toFixed(2) : null,
        keeperBetweenBallAndGoal,
        keeperClearlyBehind,
        keeperClearlyWide,
        keeperBeaten,
      },
    };
  }

  private goalLineRecoveryChance(carrier: SimplePlayer, keeper: SimplePlayer, pressure: number) {
    const attackSign = this.attackSign(carrier.team);
    const goal = goalCenterForAttack(attackSign);
    const carrierDepth = (goal.x - carrier.pos.x) * attackSign;
    const keeperDepth = (goal.x - keeper.pos.x) * attackSign;
    const keeperLaneGap = Math.abs(keeper.pos.z - carrier.pos.z);
    const depthDeficit = Math.max(0, keeperDepth - carrierDepth);
    return clamp(
      0.40
        + keeper.ratings.keeper * 0.30
        + Math.max(0, 2.4 - depthDeficit) * 0.09
        + Math.max(0, 1.8 - keeperLaneGap) * 0.08
        + pressure * 0.04,
      0.45,
      0.88,
    );
  }

  private recordShotOpportunity(
    carrier: SimplePlayer,
    distToGoal: number,
    pressure: number,
    shootChance: number,
    outcome: string,
    extra: Record<string, unknown> = {},
  ) {
    const row = {
      seq: this.shotOpportunities.length + 1,
      team: carrier.team,
      carrier: carrier.name,
      role: carrier.role,
      distToGoal: +distToGoal.toFixed(2),
      pressure: +pressure.toFixed(2),
      shootChance: +shootChance.toFixed(3),
      outcome,
      zone: this.zoneForDist(distToGoal),
      elapsedInHalf: +this.msm.clock.elapsedInHalf.toFixed(2),
      half: this.msm.clock.half,
      ...extra,
    };
    this.shotOpportunities.push(row);
    if (this.shotOpportunities.length > 5000) this.shotOpportunities.splice(0, this.shotOpportunities.length - 5000);
  }

  private pressureOn(player: SimplePlayer) {
    const opponents = this.players.filter((p) => p.team !== player.team);
    let pressure = 0;
    for (const opponent of opponents) {
      const d = dist2(player.pos, opponent.pos);
      if (d < 5.5) pressure += (5.5 - d) / 5.5 * (0.65 + opponent.ratings.defense);
    }
    return pressure;
  }

  private nearestOpponent(player: SimplePlayer, team: SimpleTeamCode) {
    return this.nearestTeamPlayer(team, player.pos);
  }

  private nearestTeamPlayer(team: SimpleTeamCode, pos: Vec2) {
    let best: SimplePlayer | null = null;
    let bestD = Infinity;
    for (const player of this.players) {
      if (player.team !== team) continue;
      const d = dist2(player.pos, pos);
      if (d < bestD) {
        bestD = d;
        best = player;
      }
    }
    return best;
  }

  private nearestDefenderDistance(player: SimplePlayer, defendingTeam: SimpleTeamCode) {
    const nearest = this.nearestTeamPlayer(defendingTeam, player.pos);
    return nearest ? dist2(player.pos, nearest.pos) : 20;
  }

  private sampleShape() {
    for (const team of ["A", "B"] as SimpleTeamCode[]) {
      const attackSign = this.attackSign(team);
      const rows = this.players.filter((p) => p.team === team).map((p) => ({
        type: "POSITION_OWNER_SAMPLE",
        team,
        role: p.role,
        player: p.name,
        x: +p.pos.x.toFixed(2),
        z: +p.pos.z.toFixed(2),
        forwardX: +(p.pos.x * attackSign).toFixed(2),
        absZ: +Math.abs(p.pos.z).toFixed(2),
        t: +this.msm.clock.elapsedInHalf.toFixed(2),
        half: this.msm.clock.half,
      }));
      const target = team === "A" ? this.shapeA : this.shapeB;
      target.push(...rows);
      for (const row of rows) this.recordEvent("POSITION_OWNER_SAMPLE", team, this.players.find((p) => p.name === row.player), row);
    }
  }

  private recordEvent(type: string, team: SimpleTeamCode, player: SimplePlayer | null | undefined, detail: Record<string, unknown>) {
    const event: SimpleEvent = {
      type,
      team,
      role: player?.role,
      minute: getMatchMinute(this.msm),
      t: +this.msm.clock.elapsedInHalf.toFixed(2),
      time: Date.now(),
      detail: { seq: ++this.eventSeq, ...detail },
    };
    this.events.push(event);
    if (this.events.length > 5000) this.events.splice(0, this.events.length - 5000);
    return event;
  }

  private addLiveEvent(team: SimpleTeamCode | "", action: string, detail: string, meta?: Record<string, unknown>) {
    this.eventLog.push({ time: Date.now(), team, action, detail, ...(meta ? { meta } : {}) });
    if (this.eventLog.length > 120) this.eventLog.shift();
  }

  private liveTeamStats(team: SimpleTeamCode, possession: number) {
    const stats = this.team(team);
    const effective = this.effectiveTeamStats(team);
    return {
      name: stats.name,
      passes: stats.passes,
      passesCompleted: stats.passesCompleted,
      shots: effective.shots,
      shotsOnTarget: effective.shotsOnTarget,
      saves: stats.saves,
      tackles: stats.tacklesWon,
      clearances: 0,
      fouls: 0,
      offsides: stats.offsides,
      corners: stats.corners,
      throwIns: stats.throwIns,
      goalKicks: stats.goalKicks,
      gkDistributions: stats.gkDistributions,
      gkDistCompleted: stats.gkDistCompleted,
      possession,
    };
  }

  private bundleTeam(team: SimpleTeamCode) {
    const stats = this.team(team);
    const effective = this.effectiveTeamStats(team);
    const roleStats: Record<string, unknown> = {};
    for (const player of this.players.filter((p) => p.team === team)) {
      roleStats[player.label] = {
        role: player.role,
        name: player.name,
        touches: player.stats.touches,
        possFrames: Math.round(player.stats.possessionSeconds * 60),
        passAtt: player.stats.passes,
        passComp: player.stats.passesCompleted,
        passes: player.stats.passes,
        passesCompleted: player.stats.passesCompleted,
        shots: player.stats.shots,
        shotsOnTarget: player.stats.shotsOnTarget,
        goals: player.stats.goals,
        tackles: player.stats.tackles,
        interceptions: player.stats.interceptions,
        clearances: 0,
        recoveries: player.stats.interceptions + player.stats.saves,
        turnovers: Math.max(0, player.stats.passes - player.stats.passesCompleted),
        fouls: 0,
        fouled: 0,
        distance: +player.stats.distance.toFixed(2),
      };
    }
    return {
      name: stats.name,
      formation: stats.formation,
      score: team === "A" ? this.msm.score.home : this.msm.score.away,
      shots: effective.shots,
      shotsOnTarget: effective.shotsOnTarget,
      saves: stats.saves,
      passes: stats.passes,
      passesCompleted: stats.passesCompleted,
      offsides: stats.offsides,
      corners: stats.corners,
      throwIns: stats.throwIns,
      goalKicks: stats.goalKicks,
      roleStats,
      passNetwork: this.passLog.filter((e) => e.team === team).slice(-200),
    };
  }

  private possessionPct() {
    const total = this.teamA.possessionSeconds + this.teamB.possessionSeconds;
    if (total <= 0) return { A: 50, B: 50 };
    const a = Math.round((this.teamA.possessionSeconds / total) * 100);
    return { A: a, B: 100 - a };
  }

  private countAttackersNearGoal(team: SimpleTeamCode) {
    const goal = goalCenterForAttack(this.attackSign(team));
    return this.players.filter((p) => p.team === team && p.role !== "GK" && dist2(p.pos, goal) < 13).length;
  }

  private effectiveTeamStats(team: SimpleTeamCode) {
    const stats = this.team(team);
    const shotBackedGoals = this.goalLog.filter((goal) => goal.team === team && goal.shotBacked !== false).length;
    return {
      shots: Math.max(stats.shots, shotBackedGoals),
      shotsOnTarget: Math.max(stats.shotsOnTarget, shotBackedGoals),
    };
  }

  private attackSign(team: SimpleTeamCode): 1 | -1 {
    return this.attackSignForHalf(team, this.msm.clock.half);
  }

  private attackSignForHalf(team: SimpleTeamCode, half: 1 | 2): 1 | -1 {
    const teamAFirstHalf = half === 1 ? 1 : -1;
    return (team === "A" ? teamAFirstHalf : -teamAFirstHalf) as 1 | -1;
  }

  private team(team: SimpleTeamCode) {
    return team === "A" ? this.teamA : this.teamB;
  }

  private zoneForDist(distToGoal: number) {
    if (distToGoal < 10) return "FINISH";
    if (distToGoal < 18) return "CHANCE_CREATION";
    if (distToGoal < 30) return "PROGRESSION";
    return "BUILDUP";
  }

  private reseed() {
    const salt = this.seedSalt || String(Date.now());
    this.rng = new Rng(seededHash(`${this.teamA.name}|${this.teamB.name}|${salt}`));
  }
}
