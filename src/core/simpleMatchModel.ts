import {
  BASE_RUN_SPEED,
  BALL_RADIUS,
  CENTER_CIRCLE_RADIUS,
  FIELD_D,
  FIELD_SCALE_PER_YARD,
  FIELD_W,
  GOAL_BOX_DEPTH,
  GOAL_BOX_HALF_Z,
  GOAL_FLOOR_DEPTH,
  GOAL_MOUTH_HALF_Z,
  LEFT_GOAL_X,
  LEFT_PENALTY_X,
  MANUAL_CONTROL_ACCELERATION_MULTIPLIER,
  MANUAL_CONTROL_SPEED_MULTIPLIER,
  PENALTY_HALF_Z,
  PENALTY_SPOT_DIST,
  PLAYER_ACCELERATION,
  PLAYER_RADIUS,
  RIGHT_GOAL_X,
  RIGHT_PENALTY_X,
  SIMULATION_DT,
  SPRINT_MULTIPLIER,
  clamp,
  dist2,
  isInPenaltyArea,
  normalize2,
} from "./constants";
import { DEFAULT_AWAY_TEAM, DEFAULT_HOME_TEAM } from "../teamCatalog.js";
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

const POST_GOAL_RESET_SPEED_MULTIPLIER = 1.3;
const CPU_PHASE_PAUSE_SECONDS = 1.35;
const GOAL_KICK_LONG_CHANCE = 0.45;
const GOAL_KICK_LONG_MIN_YARDS = 28;
const GOAL_KICK_LONG_MAX_YARDS = 72;
const GOAL_KICK_LONG_ARC = 1.02;
const CORNER_KICK_ARC = 1.35;
const LOFTED_PASS_ARC = 0.82;
// Player sprites stand ~0.78 units tall, so a manual lob peaks well clear of a
// defender's head rather than skimming it. Kept under CORNER_KICK_ARC (1.35).
const MANUAL_LOB_ARC = 1.15;
// Exponential roll decay: damp = 1 - FRICTION * 3 * dt, so the effective rate
// is 3x this value per second. 0.84 (rate 2.52/s) scrubbed ~92% of the ball's
// pace in a single second, which read on screen as the ball stopping dead.
// Slack the corner/throw-in taker gets beyond the lines, so they can stand
// behind the ball instead of being clamped onto the pitch side of it.
const RESTART_TAKER_OUTSIDE_ALLOWANCE = 2.5;
// How long a human-owned restart waits for the player before the dead-ball
// watchdog steps in and plays it for them.
// Long enough to walk up and take it, short enough that a player who does not
// realise it is their restart is not left staring at a frozen pitch. Testers
// read the old 25s leash as the game hanging.
const MANUAL_RESTART_WATCHDOG_SECONDS = 7;
// Manual tackling: a contested attempt on a cooldown, not a guaranteed strip.
// Hold-to-charge: full power after ~0.9s, matching the original charge feel.
const MANUAL_CHARGE_RATE = 1.1;
const MANUAL_CHARGE_MIN_POWER = 0.55;
const MANUAL_CHARGE_POWER_SPAN = 0.85;
const MANUAL_TACKLE_RANGE = 3.25;
const MANUAL_TACKLE_COOLDOWN_SECONDS = 0.65;
const LOOSE_BALL_GROUND_FRICTION = 0.5;
/** Gravity in world units/s^2 (1 unit ~= 1.67 m, so 9.81 m/s^2 -> ~5.9). */
const BALL_GRAVITY = 5.9;
/** Share of vertical speed kept per bounce. Turf, so fairly dead. */
const BALL_BOUNCE_RESTITUTION = 0.55;
/** Below this the ball is rolling, not bouncing. */
const BALL_BOUNCE_REST_SPEED = 0.35;
// Fraction of true flight pace an uncollected ground pass keeps on landing.
const LOOSE_BALL_LANDING_CARRY = 0.62;
// Lofted balls land steeply, so they keep less of their pace than a driven one.
const LOOSE_BALL_AERIAL_LANDING_CARRY = 0.35;
// Headroom the per-tick anti-teleport cap allows above a player's own top
// speed, so collision nudges are absorbed without throttling normal running.
const PLAYER_DISPLACEMENT_CAP_TOLERANCE = 1.12;

type GoalKickRestartPlan = {
  receiver: SimplePlayer | null;
  style: "goal_kick" | "goal_kick_long";
  contestDistance: number | null;
  targetMiddleThird: boolean;
  forcedLong: boolean;
  noSafeShort: boolean;
};

type KeeperDropKickPlan = {
  receiver: SimplePlayer | null;
  style: "drop_kick" | "drop_kick_long";
  contestDistance: number | null;
  targetMiddleThird: boolean;
  forcedLong: boolean;
  noSafeShort: boolean;
};

type PassTargetOptions = {
  minProgress?: number;
  preferForward?: boolean;
  reason?: string;
  direction?: Vec2;
  /** Force a lofted delivery -- the player's manual lob/chip button. */
  lofted?: boolean;
  /** Charge power (~0.55 tap .. 1.4 full). Reaches for longer outlets when high. */
  power?: number;
};

// Lob charges like the other two: runManualAction already took "lob",
// only the charge type excluded it, so the key fired instantly at full power.
type ManualChargeAction = "pass" | "shot" | "lob";

/**
 * Coaching intent. Applied as a delta on top of the team's identity-derived
 * tuning (getTeamTuning -> FIFA/MLS ratings), never as a replacement, so a
 * stronger side stays stronger at every setting.
 */
/**
 * CPU difficulty. Only ever raises how hard the CPU defends -- never touches
 * shot or pass appetite, which the model governs toward MLS targets and which
 * therefore absorbs or inverts any change (measured twice, both failed).
 */
export type CpuDifficultyKey = "RELAXED" | "NORMAL" | "COMPETITIVE" | "RUTHLESS";

export const CPU_DIFFICULTY_INTENSITY: Record<CpuDifficultyKey, number> = {
  RELAXED: 0.65,
  NORMAL: 1,
  COMPETITIVE: 1.35,
  RUTHLESS: 1.7,
};

/**
 * Defensive intensity per team for a difficulty and who is holding a pad.
 *
 * Pure so it can be tested: the engine used to compute this once, inside
 * setCpuDifficulty, which left it stale whenever hot-seat or two-player mode
 * changed afterwards.
 */
export function cpuDefenseIntensities(
  difficulty: CpuDifficultyKey,
  humanControlsA: boolean,
  humanControlsB: boolean,
): Record<SimpleTeamCode, number> {
  const intensity = CPU_DIFFICULTY_INTENSITY[difficulty] ?? 1;
  // A side a person is playing defends normally; difficulty is the CPU's.
  return { A: humanControlsA ? 1 : intensity, B: humanControlsB ? 1 : intensity };
}

/**
 * Which side a set-piece routine key should act for, or null to ignore it.
 *
 * Pure so it can be tested. The keyboard handler was hard-wired to team A,
 * which left the away player unable to call anything in two-player mode, and
 * the first test for the fix called setRestartPlan("B", ...) straight at the
 * model -- which already worked -- so it would have passed with the handler
 * still routing to A.
 */
export function restartRoutineTeam(
  restartTeam: SimpleTeamCode | null,
  requireTeam: SimpleTeamCode | undefined,
  humanControlsA: boolean,
  humanControlsB: boolean,
): SimpleTeamCode | null {
  if (!restartTeam) return null;
  // Player 1's keys must not steer player 2's corner, or the reverse.
  if (requireTeam && restartTeam !== requireTeam) return null;
  if (restartTeam === "A" && !humanControlsA) return null;
  if (restartTeam === "B" && !humanControlsB) return null;
  return restartTeam;
}

export type TeamAggressionKey = "BALANCED" | "AGGRESSIVE" | "POSSESSION";

// Aimed passing: how tight the corridor around the arrow is, and how far a
// tap versus a full charge plays the ball.
// cos(20 degrees): a receiver must be within 20 degrees of the arrow.
const AIMED_PASS_MIN_ALIGNMENT = 0.94;
const AIMED_PASS_MIN_RANGE = 6;
const AIMED_PASS_MAX_RANGE = 34;

const TEAM_AGGRESSION_DELTAS: Record<TeamAggressionKey, { attack: number; defense: number; tempo: number }> = {
  BALANCED: { attack: 0, defense: 0, tempo: 0 },
  AGGRESSIVE: { attack: 0.15, defense: -0.08, tempo: 0.10 },
  POSSESSION: { attack: -0.13, defense: 0.08, tempo: -0.12 },
};

/** When the game may re-pick which player you control. */
export type AutoSwitchMode = "AUTOMATIC" | "AIR_BALLS" | "LOOSE_BALLS" | "MANUAL";

type ManualControlState = {
  enabled: boolean;
  selectedPlayerId: string | null;
  move: Vec2;
  sprinting: boolean;
  /** Hold-to-charge: null when idle, otherwise the action and its 0..1 fill. */
  charge: { action: ManualChargeAction; progress: number } | null;
  autoSwitch: AutoSwitchMode;
};

export type SimplePlayerStats = {
  passes: number;
  passesCompleted: number;
  shots: number;
  shotsOnTarget: number;
  goals: number;
  saves: number;
  headers: number;
  headerShots: number;
  headerClearances: number;
  tackles: number;
  fouls: number;
  fouled: number;
  penaltiesTaken: number;
  penaltiesScored: number;
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
  targetOwner: string;
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
  headers: number;
  headerShots: number;
  headerClearances: number;
  passes: number;
  passesCompleted: number;
  tacklesWon: number;
  clearances: number;
  fouls: number;
  offsides: number;
  penaltiesAwarded: number;
  penaltiesTaken: number;
  penaltiesScored: number;
  penaltiesSaved: number;
  penaltiesMissed: number;
  penaltyXg: number;
  corners: number;
  throwIns: number;
  goalKicks: number;
  freeKicks: number;
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
  /** Monotonic id. Consumers must track this, not an array index: the log is
   *  capped with shift(), which renumbers every index underneath them. */
  seq: number;
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
  settleSeconds?: number;
  aerial?: boolean;
  headerEligible?: boolean;
  /** Height the ball leaves from, for a ball headed or nodded onward. */
  launchHeight?: number;
  sourceAction?: string;
  attackingTeam?: SimpleTeamCode;
  passerId?: string;
  passerName?: string;
  receiverId?: string;
  contactSource?: string;
  contactPoint?: Vec2;
  keeperReachDistance?: number | null;
  keeperMaxReach?: number;
  elapsed: number;
  duration: number;
  arc: number;
};

type BallFlightOptions = {
  settleSeconds?: number;
  aerial?: boolean;
  headerEligible?: boolean;
  /** Height the ball leaves from, for a ball headed or nodded onward. */
  launchHeight?: number;
  sourceAction?: string;
  attackingTeam?: SimpleTeamCode;
  passerId?: string;
  passerName?: string;
  receiverId?: string;
  contactSource?: string;
  contactPoint?: Vec2;
  keeperReachDistance?: number | null;
  keeperMaxReach?: number;
  /** Charge power: scales the ball's travel speed for manual strikes. */
  speedMultiplier?: number;
};

type ShotResolutionContext = {
  reason?: string;
  forceOnTarget?: boolean;
  forceGoal?: boolean;
  forceSave?: boolean;
  forceWoodwork?: boolean;
  forceWoodworkPart?: "crossbar" | "post";
  minOnTargetChance?: number;
  minGoalChance?: number;
  goalChanceMultiplier?: number;
  /** Height the ball is struck from, for headers. */
  launchHeight?: number;
  style?: string;
  /** Manual aim (stick/keys). Lateral component steers placement across the mouth. */
  aimDirection?: Vec2;
  /** Charge power (~0.55 tap .. 1.4 full): drives ball speed and accuracy. */
  power?: number;
  /**
   * Human pressed shoot. Exempts the shot from the CPU shot-selection gates:
   * those recycle long attempts into a pass, which for a player reads as the
   * shoot button firing the ball at a teammate instead of where they aimed.
   */
  manual?: boolean;
  details?: Record<string, unknown>;
};

type ShotDefenseSnapshot = {
  defendersInBox: number;
  attackersInBox: number;
  defendersInCorridor: number;
  nearestDefenderDistance: number | null;
  keeperDistance: number | null;
  keeperReachable?: boolean;
  keeperReachDistance?: number | null;
  keeperMaxReach?: number;
};

type CompletedPassMemory = {
  team: SimpleTeamCode;
  fromId: string;
  toId: string;
  pairKey: string;
  streak: number;
};

export type RestartPlan =
  | "corner_near_post"
  | "corner_far_post"
  | "corner_short"
  | "corner_edge"
  | "throw_short"
  | "goal_kick_short"
  | "goal_kick_long"
  | "free_kick_direct"
  | "penalty";

/** A called routine's runners count as set once they are this close. */
const CALLED_ROUTINE_ARRIVAL = 2.5;
/** And they never hold the restart longer than this. */
const CALLED_ROUTINE_MAX_WAIT_SECONDS = 2.5;

/**
 * The routines a person can call on a corner, in D-pad order.
 *
 * One table shared by the model, the input handling and the on-screen prompt:
 * the control reference drifted out of step with its bindings once already
 * because two places described the same thing.
 */
export const CORNER_ROUTINES = [
  { plan: "corner_short", direction: "left", key: "1", label: "Short", hint: "two players drop to the corner" },
  { plan: "corner_near_post", direction: "up", key: "2", label: "Near post", hint: "attack the near stick" },
  { plan: "corner_far_post", direction: "right", key: "3", label: "Far post", hint: "overload the back stick" },
  { plan: "corner_edge", direction: "down", key: "4", label: "Edge of box", hint: "lay it off to the D" },
] as const satisfies ReadonlyArray<{
  plan: RestartPlan;
  direction: "left" | "up" | "right" | "down";
  key: string;
  label: string;
  hint: string;
}>;

type BallOutRestartContext = {
  restartType: BallOutEvent["restartType"];
  restartTeam: SimpleTeamCode;
  spot: Vec2;
  lastTouchTeam: SimpleTeamCode | null;
  lastTouchPlayerId: string | null;
  crossedLine: "left_goal_line" | "right_goal_line" | "top_touchline" | "bottom_touchline" | "infraction";
  takerId?: string;
  fouledPlayerId?: string | null;
  plan?: RestartPlan;
  /** Set when a person chose the routine, so the CPU does not overwrite it. */
  planChosenBy?: SimpleTeamCode;
  /** Dead-ball seconds at the moment it was called, to bound the wait. */
  planChosenAt?: number;
};

type VisibleBallOutPending = {
  event: BallOutEvent;
  context: BallOutRestartContext;
  holdSeconds: number;
};

export type BallFlightTelemetry = {
  seq: number;
  kind: BallFlightKind;
  minute: number;
  half: number;
  elapsedInHalf: number;
  elapsedWallSeconds?: number;
  distance: number;
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
  aerial?: boolean;
  headerEligible?: boolean;
  /** Height the ball leaves from, for a ball headed or nodded onward. */
  launchHeight?: number;
  sourceAction?: string;
  attackingTeam?: SimpleTeamCode;
  passerId?: string;
  passerName?: string;
  receiverId?: string;
  contactSource?: string;
  contactPoint?: Vec2;
  keeperReachDistance?: number | null;
  keeperMaxReach?: number;
  receptionOutcome?: "received" | "loose" | "no_target";
  receptionGap?: number | null;
  settleSeconds?: number;
  realizedHoldSeconds?: number | null;
  holdResolvedBy?: string | null;
};

type ActiveReceptionTelemetry = {
  flightSeq: number;
  playerId: string;
  playerName: string;
  receivedAtWall: number;
  settleSeconds: number;
};

type FullLengthPossessionDiagnostics = {
  noSafeOutletPassFails: number;
  speculativePassInterceptions: number;
  nonDangerTerminalShots: number;
  speculativeInterceptionDistanceBands: {
    lt14: number;
    y14_16: number;
    y16_18: number;
    gte18: number;
  };
  speculativeInterceptionSeparationBands: {
    lt2_5: number;
    y2_5_3_5: number;
    y3_5_4_5: number;
    gte4_5: number;
  };
  samples: Record<string, unknown>[];
};

type PhasePacingTelemetry = {
  seq: number;
  phase: string;
  reason: string;
  durationSeconds: number;
  half: 1 | 2;
  scoreA: number;
  scoreB: number;
  elapsedInHalf: number;
};

type StrikerBoxPossession = {
  seq: number;
  team: SimpleTeamCode;
  playerId: string;
  playerName: string;
  startedAt: number;
  deadlineAt: number;
  entryPos: Vec2;
  entryDistToGoal: number;
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

const DEFAULT_TEAM_A = DEFAULT_HOME_TEAM;
const DEFAULT_TEAM_B = DEFAULT_AWAY_TEAM;
const KICKOFF_OWN_HALF_BUFFER = 2.4;
const KICKOFF_SHAPE_RELEASE_SECONDS = 18;
const KICKOFF_SHAPE_HOLD_SECONDS = 2.4;
const KICKOFF_LANE_RELEASE_SECONDS = 2.0;
const BALL_HOLD_TIME_MULTIPLIER = 1.5;
/** Pass distance from which the ball is played ahead of the receiver. */
const PASS_LEAD_MIN_DISTANCE = 6;
/** Distance from which the receiver runs onto it and carries, so settles fast. */
const LED_PASS_SHORT_SETTLE_DISTANCE = 13;
const PASS_LEAD_MIN = 0.65;
/** Held under the 1.6u gap auditFlightLanding treats as an empty landing. */
const PASS_LEAD_MAX = 1.5;
/** Share of his reachable distance the receiver is asked to cover. */
const PASS_LEAD_REACH_FRACTION = 0.45;
const VISIBLE_RECEPTION_HOLD_MIN_SECONDS = 1.5;
const VISIBLE_RECEPTION_HOLD_MAX_SECONDS = 3.0;
const PLAYER_MIN_SEPARATION = PLAYER_RADIUS * 2;
/** A forward ball this long is played through the air, wherever it lands. */
const LONG_BALL_AERIAL_YARDS = 32;
/** Forward gain that makes a long pass a genuine long ball, in world units. */
const LONG_BALL_MIN_PROGRESS = 10;
/** How many team-mates break shape to offer at once; 4 starts to swarm. */
/**
 * Working pace as a share of top speed. Fitted to the Metrica distribution:
 * roughly half the match walking, a third jogging, sprinting rare.
 */
const PACE_WALK = 0.17;
const PACE_JOG = 0.42;
const PACE_RUN = 0.64;
const PACE_SPRINT = 1;
/** Being this far from your mark is urgent whatever you were doing. */
const PACE_JOG_GAP = 9;
const PACE_HUSTLE_GAP = 24;

const SHOW_FOR_BALL_COUNT = 3;
/** Only players already this close to the carrier come and offer. */
const SHOW_FOR_BALL_RANGE = 26;
/** Carrier pressure below which nobody needs to come short. */
const SHOW_FOR_BALL_MIN_PRESSURE = 0.35;
/** Offer angles relative to the attacking direction, and how far out. */
const SHOW_FOR_BALL_ANGLES = [0, Math.PI / 5, -Math.PI / 5, Math.PI / 2.5, -Math.PI / 2.5, Math.PI / 1.8, -Math.PI / 1.8];
const SHOW_FOR_BALL_RADII = [8, 12, 16];
/** Halves at or under this are matches someone plays, not background sim. */
const PLAYED_MATCH_MAX_HALF_SECONDS = 900;
/** Measured free at this level in a played match; see scripts/longball-scope.mjs. */
const LONG_BALL_PLAYED_MATCH_BIAS = 0.05;
/**
 * Conversion of shots on target.
 *
 * The chance formula was tuned when keeperSaveGeometry let ~3.7% of shots on
 * target past the keeper on positioning error alone, which resolveShot scores
 * outright. Fixing his positioning removed those unearned goals and dropped
 * production to 2.13 a match against an MLS target of 2.80, converting 22.4%
 * of shots on target where the real figure is ~29.5%. This earns them back
 * through finishing instead.
 */
const SHOT_CONVERSION_SCALE = 1.62;
/**
 * How often a header in the box is a goal attempt rather than a knock-down.
 *
 * 42-90% of attacking headers were shots, making headed attempts 43% of every
 * shot in the match against roughly 10% in real football. That single figure
 * is why shot volume ran 30% over target and why only 28% of shots were on
 * target: headers are the least accurate attempt there is. The rest become
 * header touches, which is what most box headers actually are.
 */
const HEADER_SHOT_ATTEMPT_SCALE = 0.22;
/**
 * Base chance a shot is on target, before distance, angle and pressure.
 *
 * Left 27.8% of shots on target against roughly 36.5% in real football, so the
 * model created chances and then sprayed them. Cutting headed attempts did not
 * touch this -- headers were not disproportionately wide, there were simply too
 * many of them.
 */
const SHOT_ON_TARGET_BASE = 0.51;
/**
 * Half-width used to decide whether a ball crossing the line is a goal.
 *
 * This used to be GOAL_MOUTH_HALF_Z - BALL_RADIUS, which disagreed with both
 * the posts the renderer draws (GOAL_MOUTH_HALF_Z) and detectBallOut's own
 * test (also GOAL_MOUTH_HALF_Z). A ball crossing in the 0.2u between them was
 * rejected here as "not a goal", and detectBallOut then declined it as "not a
 * ball-out, that's a goal" -- so nothing caught it and play simply carried on
 * with the ball in the net. 0.2u is a third of a metre inside each post: the
 * side netting, exactly where it was reported.
 */
const GOAL_MOUTH_SCORING_HALF_Z = GOAL_MOUTH_HALF_Z;

const HEADER_MIN_ARC = 0.18;
const HEADER_CONTEST_RADIUS = 3.2;
const SIMULATED_HALF_DURATION_SECONDS = 45 * 60;
const OFFSIDE_CLEAR_MARGIN = 1.25;
const OFFSIDE_SELECTION_CHANCE = 0.06;
const OFFSIDE_TARGET_LOCK_SECONDS = 24;
const OFFSIDE_SUPPORT_HOLD_BUFFER = 0.55;
const PRESSURE_FOUL_MIN_PRESSURE = 0.55;
const PRESSURE_FOUL_MAX_CHANCE = 0.034;
const PRESSURE_PENALTY_FOUL_MAX_CHANCE = 0.006;
const PRESSURE_PENALTY_FOUL_MULTIPLIER = 0.14;
const PRESSURE_FOUL_SOFT_CAP_PER_MINUTE = 0.24;
const PRESSURE_FOUL_HARD_CAP_PER_MINUTE = 0.32;
const KEEPER_HANDS_STANDOFF_RADIUS = 6 * FIELD_SCALE_PER_YARD;
const KEEPER_HANDS_STANDOFF_TARGET_RADIUS = 7.5 * FIELD_SCALE_PER_YARD;
const KEEPER_SMOTHER_CONTACT_RADIUS = 1.05;
const STRIKER_BOX_EXIT_BUFFER = 0.75;
const BALL_RECEPTION_RADIUS = 1.55;
const AERIAL_RECEPTION_RADIUS = 2.15;
const LOOSE_BALL_CLAIM_RADIUS = 1.35;
// Real contact distance: player radius + ball radius, plus a little slack for
// a foot reaching. Claiming a loose ball is a game convenience and stays
// generous; recording a *touch* must mean the player actually reached it,
// because touch decides corner vs goal kick.
const TOUCH_CONTACT_RADIUS = 0.95;
// Above this speed a loose ball must be reached, not merely stood near.
/** Keeper depth off his goal line, by how close the ball is (field units). */
const KEEPER_SWEEP_RANGE = 26;
const KEEPER_NARROW_RANGE = 13;
const KEEPER_SET_RANGE = 6;
const KEEPER_SWEEPER_DEPTH = 3.6;
const KEEPER_NARROW_DEPTH = 4.2;
const KEEPER_SET_DEPTH = 2.0;
const KEEPER_LINE_DEPTH = 0.8;
/** Never advance more than this share of the way to the ball. */
const KEEPER_MAX_COMMIT_FRACTION = 0.55;
/** How far past each post the keeper may shuffle. */
const KEEPER_POST_OVERLAP = 0.9;

const LOOSE_BALL_CLAIM_SPEED_LIMIT = 6;
// Perimeter wall: matches wallOffset in the renderer's stadium build.
const STADIUM_WALL_OFFSET = 9.5;
const STADIUM_WALL_RESTITUTION = 0.55;
// Long enough to see the ball run on and rebound before the restart is staged.
const BALL_OUT_HOLD_SECONDS = 0.9;
// Mid-flight collection: how close a player must be to a ball played into
// space, and how low the ball must be for them to control it.
const MID_FLIGHT_COLLECT_RADIUS = 1.1;
const MID_FLIGHT_COLLECT_MAX_HEIGHT = 0.55;
// How far the ball must have travelled before anyone can cut it out, so a pass
// is never swallowed at the passer's feet.
const MID_FLIGHT_COLLECT_MIN_TRAVEL = 9;

function createStats(): SimplePlayerStats {
  return {
    passes: 0,
    passesCompleted: 0,
    shots: 0,
    shotsOnTarget: 0,
    goals: 0,
    saves: 0,
    headers: 0,
    headerShots: 0,
    headerClearances: 0,
    tackles: 0,
    fouls: 0,
    fouled: 0,
    penaltiesTaken: 0,
    penaltiesScored: 0,
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
    headers: 0,
    headerShots: 0,
    headerClearances: 0,
    passes: 0,
    passesCompleted: 0,
    tacklesWon: 0,
    clearances: 0,
    fouls: 0,
    offsides: 0,
    penaltiesAwarded: 0,
    penaltiesTaken: 0,
    penaltiesScored: 0,
    penaltiesSaved: 0,
    penaltiesMissed: 0,
    penaltyXg: 0,
    corners: 0,
    throwIns: 0,
    goalKicks: 0,
    freeKicks: 0,
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
  private liveEventSeq = 0;
  private readonly teamAggression: Record<SimpleTeamCode, TeamAggressionKey> = { A: "BALANCED", B: "BALANCED" };
  private readonly manualTackleCooldown: Record<SimpleTeamCode, number> = { A: 0, B: 0 };
  readonly events: SimpleEvent[] = [];
  readonly passLog: SimpleEvent[] = [];
  readonly shotDecisions: Record<string, unknown>[] = [];
  readonly shotOpportunities: Record<string, unknown>[] = [];
  readonly passDecisions: Record<string, unknown>[] = [];
  readonly headerLog: Record<string, unknown>[] = [];
  readonly shapeA: Record<string, unknown>[] = [];
  readonly shapeB: Record<string, unknown>[] = [];
  readonly playerPositioning: Record<string, unknown>[] = [];
  readonly goalLog: Record<string, unknown>[] = [];
  readonly ballOutLog: Record<string, unknown>[] = [];
  readonly ballFlightTelemetry: BallFlightTelemetry[] = [];
  readonly phasePacingTelemetry: PhasePacingTelemetry[] = [];
  readonly strikerBoxTelemetry: Record<string, unknown>[] = [];
  readonly visualRealityEvents: VisualRealityEvent[] = [];

  msm: MatchStateMachine = createMatchStateMachine();
  ball: BallState = { pos: { x: 0, y: 0.18, z: 0 }, vel: { x: 0, z: 0 } };
  possession: SimplePlayer | null = null;
  teamA = makeTeamStats(DEFAULT_TEAM_A, "4-3-3");
  teamB = makeTeamStats(DEFAULT_TEAM_B, "4-4-2");
  cpuVsCpu = false;
  seriesSpeedMul = 1;
  runtimeHalfDuration = this.msm.clock.halfDuration;
  matchClockScale = 1;
  restartDelayGoal = 2.0;
  restartDelayHalf = 3.0;
  weather = "SUNNY";
  lighting = "NOON";
  aiStyle = "BALANCED";
  /** Match setting: when false, fouls are never awarded. */
  foulsEnabled = true;
  /**
   * Per-team defensive intensity, 1 = current behaviour. Scales how hard this
   * team presses the opposition carrier. Deliberately NOT a shot/pass lever:
   * those are governed toward MLS targets and absorb changes.
   */
  private readonly defenseIntensity: Record<SimpleTeamCode, number> = { A: 1, B: 1 };
  cameraMode = "BROADCAST";
  lastShotTelemetry: Record<string, unknown> | null = null;
  lastKeeperKickTelemetry: Record<string, unknown> | null = null;
  lastPassLoopTelemetry: Record<string, unknown> | null = null;
  private rng = new Rng(1);
  private actionTimer = 0;
  private visualReceptionSettleRemaining = 0;
  private visualReceptionPlayerId: string | null = null;
  private deliveryContinuationRemaining = 0;
  private deliveryContinuationPlayerId: string | null = null;
  private elapsedTotal = 0;
  private eventSeq = 0;
  private shotSeq = 0;
  /** Vertical speed of a loose ball; only ever non-zero while it bounces. */
  /**
   * Share of open-play passes played long. null uses the runtime default.
   * Only scripts/longball-scope.mjs sets this explicitly.
   */
  longBallBias: number | null = null;
  private ballVelY = 0;
  private keeperSeq = 0;
  private passLoopSeq = 0;
  private ballFlightSeq = 0;
  private phasePacingSeq = 0;
  private strikerBoxSeq = 0;
  private offsideTargetSelectionLockedUntil = 0;
  private strikerBoxPossession: StrikerBoxPossession | null = null;
  private lastStateKind = "pre_match";
  private shapeTimer = 0;
  private carrierTraceTimer = 0;
  private carrierTraceSegmentSeq = 0;
  private activeCarrierTraceOwnerId: string | null = null;
  private activeReceptionTelemetry: ActiveReceptionTelemetry | null = null;
  private seedSalt = "";
  private ballFlight: BallFlightState | null = null;
  private lastCompletedPass: CompletedPassMemory | null = null;
  private dribblePhase = 0;
  private kickoffTeam: SimpleTeamCode | null = null;
  private kickoffKickerId: string | null = null;
  private kickoffReceiverId: string | null = null;
  private kickoffShapeReleaseRemaining = 0;
  private kickoffSetupMoving = false;
  private lastTouchTeam: SimpleTeamCode | null = null;
  private lastTouchPlayerId: string | null = null;
  private lastBallPos: Vec2 = { x: 0, z: 0 };
  private pendingBallOutEvent: BallOutEvent | null = null;
  private pendingBallOutContext: BallOutRestartContext | null = null;
  private pendingMissGoalLineOut: { event: BallOutEvent; context: BallOutRestartContext } | null = null;
  private visibleBallOutPending: VisibleBallOutPending | null = null;
  private pendingFlightGoalEvent: GoalEvent | null = null;
  private pendingGoalAnnouncement: { team: SimpleTeamCode; detail: string; meta: Record<string, unknown> } | null = null;
  private goalNetSettleRemaining = 0;
  private goalKickoffSetupInstalled = false;
  private restartContext: BallOutRestartContext | null = null;
  private cpuPhasePauseRemaining = 0;
  private cpuPhasePauseKey = "";
  private cpuPhasePauseConsumedKey = "";
  private deadBallStateKey = "";
  private deadBallStateWallSeconds = 0;
  private interactiveHalftime = false;
  private sessionId = this.makeSessionId();
  private engineRuntimeToken: string | null = null;
  private engineBootedAt: number | null = null;
  private readonly manualControl: Record<SimpleTeamCode, ManualControlState> = {
    A: { enabled: false, selectedPlayerId: null, move: { x: 0, z: 0 }, sprinting: false, charge: null, autoSwitch: "AUTOMATIC" },
    B: { enabled: false, selectedPlayerId: null, move: { x: 0, z: 0 }, sprinting: false, charge: null, autoSwitch: "AUTOMATIC" },
  };
  private fullLengthPossessionDiagnostics: FullLengthPossessionDiagnostics = {
    noSafeOutletPassFails: 0,
    speculativePassInterceptions: 0,
    nonDangerTerminalShots: 0,
    speculativeInterceptionDistanceBands: { lt14: 0, y14_16: 0, y16_18: 0, gte18: 0 },
    speculativeInterceptionSeparationBands: { lt2_5: 0, y2_5_3_5: 0, y3_5_4_5: 0, gte4_5: 0 },
    samples: [],
  };

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
    const runtimeDuration = Math.max(5, Number(seconds) || 150);
    this.runtimeHalfDuration = runtimeDuration;
    this.msm.clock.halfDuration = SIMULATED_HALF_DURATION_SECONDS;
    this.matchClockScale = SIMULATED_HALF_DURATION_SECONDS / runtimeDuration;
  }

  setSeriesSpeedMul(value: number) {
    this.seriesSpeedMul = Math.max(0.1, Math.min(80, Number(value) || 1));
  }

  setRestartDelays(goalDelay: number, halfDelay: number) {
    this.restartDelayGoal = Math.max(0, Number(goalDelay) || 0);
    this.restartDelayHalf = Math.max(0, Number(halfDelay) || 0);
  }

  setInteractiveHalftime(enabled: boolean) {
    this.interactiveHalftime = !!enabled;
  }

  setManualControlEnabled(team: SimpleTeamCode, enabled: boolean) {
    const state = this.manualControl[team];
    state.enabled = !!enabled;
    state.move = { x: 0, z: 0 };
    state.sprinting = false;
    state.charge = null;
    if (!enabled) {
      state.selectedPlayerId = null;
      return;
    }
    this.ensureManualSelection(team);
  }

  setManualMove(team: SimpleTeamCode, x: number, z: number) {
    const state = this.manualControl[team];
    state.move = {
      x: clamp(Number.isFinite(x) ? x : 0, -1, 1),
      z: clamp(Number.isFinite(z) ? z : 0, -1, 1),
    };
    if (state.enabled) this.ensureManualSelection(team);
  }

  /**
   * How much the coaching dial scales shot appetite. The rated attack tuning
   * only contributes ~0.001 to shootUrge, far too small for a setting the
   * player chooses, so intent scales the whole urge instead.
   */
  private aggressionShotScale(team: SimpleTeamCode) {
    const delta = TEAM_AGGRESSION_DELTAS[this.teamAggression[team]] ?? TEAM_AGGRESSION_DELTAS.BALANCED;
    return clamp(1 + delta.attack * 1.9, 0.6, 1.5);
  }

  /** Coaching intent for a team. Modifies, never replaces, its rated tuning. */
  setTeamAggression(team: SimpleTeamCode, key: TeamAggressionKey) {
    this.teamAggression[team] = TEAM_AGGRESSION_DELTAS[key] ? key : "BALANCED";
  }

  getTeamAggression(team: SimpleTeamCode) {
    return this.teamAggression[team];
  }

  /**
   * Team tuning as the match should actually play it: rated identity plus the
   * coach's intent. Player ratings are deliberately NOT re-derived from this --
   * changing a coaching setting must not restat the squad mid-match.
   */
  effectiveTuning(team: SimpleTeamCode) {
    const base = this.team(team).tuning;
    const delta = TEAM_AGGRESSION_DELTAS[this.teamAggression[team]] ?? TEAM_AGGRESSION_DELTAS.BALANCED;
    return {
      ...base,
      attack: clamp(base.attack + delta.attack, 0, 1),
      defense: clamp(base.defense + delta.defense, 0, 1),
      tempo: clamp(base.tempo + delta.tempo, 0, 1),
    };
  }

  /**
   * Which situations may steal control away from the player. The switching
   * behaviour always existed; this is the selector that drives it.
   */
  setAutoSwitchMode(team: SimpleTeamCode, mode: AutoSwitchMode) {
    this.manualControl[team].autoSwitch = mode;
  }

  getAutoSwitchMode(team: SimpleTeamCode) {
    return this.manualControl[team].autoSwitch;
  }

  /** Hold-to-sprint. Only the team's currently selected player is boosted. */
  setManualSprint(team: SimpleTeamCode, active: boolean) {
    const state = this.manualControl[team];
    state.sprinting = state.enabled && !!active;
  }

  isManualSprinting(team: SimpleTeamCode) {
    return this.manualControl[team].sprinting;
  }

  cycleManualPlayer(team: SimpleTeamCode, dir: -1 | 1) {
    const state = this.manualControl[team];
    if (!state.enabled) return null;
    const players = this.teamFieldPlayers(team);
    if (players.length === 0) return null;
    const currentIndex = Math.max(0, players.findIndex((player) => player.id === state.selectedPlayerId));
    const nextIndex = (currentIndex + dir + players.length) % players.length;
    state.selectedPlayerId = players[nextIndex]?.id ?? players[0]?.id ?? null;
    return this.manualSelectedPlayer(team);
  }

  selectNearestManualPlayer(team: SimpleTeamCode) {
    const state = this.manualControl[team];
    if (!state.enabled) return null;
    const nearest = this.nearestFieldPlayerToBall(team);
    state.selectedPlayerId = nearest?.id ?? state.selectedPlayerId;
    return nearest;
  }

  triggerManualPass(team: SimpleTeamCode) {
    return this.runManualAction(team, "pass");
  }

  /**
   * Begin charging a pass or shot. Power builds while held and is applied on
   * release, so a tap is a soft ball and a full hold is struck hard.
   */
  beginManualCharge(team: SimpleTeamCode, action: ManualChargeAction) {
    const state = this.manualControl[team];
    if (!state.enabled) return false;
    if (!this.canManualActNow(team)) return false;
    state.charge = { action, progress: 0 };
    return true;
  }

  /** Fire the charged action. Returns whether anything was played. */
  releaseManualCharge(team: SimpleTeamCode) {
    const state = this.manualControl[team];
    const charge = state.charge;
    state.charge = null;
    if (!charge || !state.enabled) return false;
    const power = MANUAL_CHARGE_MIN_POWER + charge.progress * MANUAL_CHARGE_POWER_SPAN;
    return this.runManualAction(team, charge.action, power);
  }

  cancelManualCharge(team: SimpleTeamCode) {
    this.manualControl[team].charge = null;
  }

  /**
   * What the player must do to resume play, or null. The hold is invisible
   * without this: testers saw the pitch stop and assumed the game had frozen.
   */
  getManualRestartPrompt() {
    const restart = this.restartContext;
    if (!restart || !this.awaitingManualRestart()) return null;
    const label = restart.restartType === "free_kick" ? "Free kick"
      : restart.restartType === "corner" ? "Corner"
      : restart.restartType === "throw_in" ? "Throw-in"
      : restart.restartType === "goal_kick" ? "Goal kick"
      : "Restart";
    return {
      team: restart.restartTeam,
      restartType: restart.restartType,
      label,
      secondsRemaining: Math.max(0, MANUAL_RESTART_WATCHDOG_SECONDS - this.deadBallStateWallSeconds),
    };
  }

  /**
   * Call a set-piece routine. Only while the restart is still pending and only
   * for the side taking it, so it cannot be used to steer the opposition.
   */
  setRestartPlan(team: SimpleTeamCode, plan: RestartPlan) {
    const restart = this.restartContext;
    if (!restart || restart.restartTeam !== team) return false;
    if (!this.awaitingManualRestart()) return false;
    if (!this.manualControl[team].enabled) return false;
    if (restart.restartType === "corner" && !CORNER_ROUTINES.some((routine) => routine.plan === plan)) return false;
    restart.plan = plan;
    restart.planChosenBy = team;
    restart.planChosenAt = this.deadBallStateWallSeconds;
    if (restart.restartType === "corner") this.positionCornerPlayers(restart);
    return true;
  }

  /** Which routines can be called right now, and which is selected. */
  getRestartPlanOptions() {
    const restart = this.restartContext;
    if (!restart || !this.awaitingManualRestart()) return null;
    if (restart.restartType !== "corner") return null;
    if (!this.manualControl[restart.restartTeam].enabled) return null;
    return {
      team: restart.restartTeam,
      restartType: restart.restartType,
      selected: restart.plan ?? null,
      chosen: restart.planChosenBy === restart.restartTeam,
      routines: CORNER_ROUTINES.map((routine) => ({ ...routine })),
    };
  }

  /** Renderer read-model for the aim arrow and power ring. */
  getManualChargeState(team: SimpleTeamCode) {
    const state = this.manualControl[team];
    if (!state.enabled || !state.charge) return null;
    const carrier = this.manualSelectedPlayer(team);
    if (!carrier) return null;
    return {
      action: state.charge.action,
      progress: state.charge.progress,
      power: MANUAL_CHARGE_MIN_POWER + state.charge.progress * MANUAL_CHARGE_POWER_SPAN,
      origin: { x: carrier.pos.x, z: carrier.pos.z },
      aim: { ...state.move },
      attackSign: this.attackSign(team),
      hasBall: this.possession?.id === carrier.id,
    };
  }

  private canManualActNow(team: SimpleTeamCode) {
    if (this.msm.state.kind === "ball_out") return this.restartContext?.restartTeam === team;
    if (this.msm.state.kind !== "live_play" || this.ballFlight) return false;
    return !!this.possession && this.possession.team === team;
  }

  private advanceManualCharges(dt: number) {
    for (const team of ["A", "B"] as const) {
      const state = this.manualControl[team];
      if (!state.charge) continue;
      // Losing the ball (or the phase) cancels the charge rather than firing it.
      if (!this.canManualActNow(team)) {
        state.charge = null;
        continue;
      }
      state.charge.progress = Math.min(1, state.charge.progress + dt * MANUAL_CHARGE_RATE);
    }
  }

  /** Distance from a point to the edge of the playable area along a unit ray. */
  private distanceToPlayableEdge(origin: Vec2, unit: Vec2) {
    const minX = LEFT_GOAL_X + 1;
    const maxX = RIGHT_GOAL_X - 1;
    const minZ = -FIELD_D / 2 + 1;
    const maxZ = FIELD_D / 2 - 1;
    let limit = Infinity;
    if (unit.x > 1e-6) limit = Math.min(limit, (maxX - origin.x) / unit.x);
    if (unit.x < -1e-6) limit = Math.min(limit, (minX - origin.x) / unit.x);
    if (unit.z > 1e-6) limit = Math.min(limit, (maxZ - origin.z) / unit.z);
    if (unit.z < -1e-6) limit = Math.min(limit, (minZ - origin.z) / unit.z);
    return Math.max(0, Number.isFinite(limit) ? limit : 0);
  }

  /** How far along the arrow a charged pass is aimed. */
  private aimedPassRange(power?: number) {
    const reach = power === undefined
      ? 0.5
      : clamp((power - MANUAL_CHARGE_MIN_POWER) / MANUAL_CHARGE_POWER_SPAN, 0, 1);
    return AIMED_PASS_MIN_RANGE + reach * (AIMED_PASS_MAX_RANGE - AIMED_PASS_MIN_RANGE);
  }

  /**
   * Play the ball along the aim arrow into space. Used when no team-mate sits
   * on the line: the arrow said the ball goes there, so it goes there, and
   * whoever gets to it first collects it.
   */
  private resolveDirectionalPass(carrier: SimplePlayer, direction: Vec2, power?: number, lofted = false) {
    const length = Math.hypot(direction.x, direction.z);
    if (length < 0.15) return false;
    const unit = { x: direction.x / length, z: direction.z / length };
    const range = this.aimedPassRange(power);
    const origin = { x: carrier.pos.x, z: carrier.pos.z };
    // Shorten along the ray to stay in play rather than clamping the endpoint:
    // clamping bends the ball away from the arrow, which is the whole promise.
    const reach = Math.min(range, this.distanceToPlayableEdge(origin, unit));
    const landing = { x: origin.x + unit.x * reach, z: origin.z + unit.z * reach };
    const distance = dist2(origin, landing);
    if (distance < 1) return false;

    const stats = this.team(carrier.team);
    stats.passes += 1;
    carrier.stats.passes += 1;
    this.rememberTouch(carrier);
    this.finalizeActiveReceptionTelemetryForPlayer(carrier, "pass");
    this.possession = null;
    this.lastCompletedPass = null;

    const arc = lofted ? MANUAL_LOB_ARC : 0.32;
    this.startBallFlight(
      "pass",
      origin,
      landing,
      this.flightDuration(clamp(distance / 24, 0.65, 1.25)),
      arc,
      undefined,
      {
        aerial: lofted,
        headerEligible: lofted,
        sourceAction: lofted ? "manual_lob_space" : "manual_pass_space",
        attackingTeam: carrier.team,
        passerId: carrier.id,
        passerName: carrier.name,
      },
    );
    this.addLiveEvent(carrier.team, "PASS", `${carrier.label} into space`);
    this.recordEvent("PASS", carrier.team, carrier, {
      outcome: "into_space",
      reason: lofted ? "MANUAL_LOB_SPACE" : "MANUAL_PASS_SPACE",
      distance: +distance.toFixed(2),
    });
    return true;
  }

  /** Chip/lob: same targeting as a pass, but lofted so it can be headed. */
  triggerManualLobPass(team: SimpleTeamCode) {
    return this.runManualAction(team, "lob");
  }

  triggerManualShot(team: SimpleTeamCode) {
    return this.runManualAction(team, "shot");
  }

  triggerManualTackle(team: SimpleTeamCode) {
    if (!this.manualControl[team].enabled || this.msm.state.kind !== "live_play" || this.ballFlight) return false;
    const carrier = this.possession;
    const defender = this.manualSelectedPlayer(team);
    if (!carrier || carrier.team === team || !defender) {
      this.selectNearestManualPlayer(team);
      return false;
    }
    const gap = dist2(defender.pos, carrier.pos);
    if (gap > MANUAL_TACKLE_RANGE) return false;
    // A tackle used to be an unconditional steal inside range, with no cooldown
    // and no foul risk, so mashing the button stripped the CPU every time and
    // there was no contest at all. Contest it on defence vs the carrier.
    if (this.manualTackleCooldown[team] > 0) return false;
    this.manualTackleCooldown[team] = MANUAL_TACKLE_COOLDOWN_SECONDS;

    const pressure = Math.max(0.25, 2.4 - gap * 0.45);
    const proximity = clamp(1 - gap / MANUAL_TACKLE_RANGE, 0, 1);
    const carrierSpeed = Math.hypot(carrier.vel.x, carrier.vel.z);
    const skillEdge = (defender.ratings.defense ?? 0.5) - (carrier.ratings.pace ?? 0.5) * 0.6;
    const winChance = clamp(
      0.26 + proximity * 0.34 + skillEdge * 0.30 - Math.min(0.12, carrierSpeed * 0.02),
      0.12,
      0.82,
    );
    this.finalizeActiveReceptionTelemetryForPlayer(carrier, "manual_tackle");

    if (this.rng.next() >= winChance) {
      // Mistimed. From behind or at pace it is a foul rather than a clean miss.
      const foulChance = clamp(0.16 + (1 - proximity) * 0.24, 0.10, 0.42);
      if (this.rng.next() < foulChance) {
        this.resolveFoul(defender, carrier, pressure, "MANUAL_TACKLE_FOUL");
        return false;
      }
      // A missed tackle used to emit telemetry only, so the player got no
      // feedback at all and could not tell whether the button had registered.
      this.addLiveEvent(defender.team, "TACKLE_MISS", `${defender.label} missed the tackle`, {
        playerId: defender.id,
        playerName: defender.name,
        carrier: carrier.name,
      });
      this.recordEvent("TACKLE", defender.team, defender, { carrier: carrier.name, outcome: "missed", pressure, reason: "MANUAL_TACKLE_MISS" });
      return false;
    }

    this.possession = defender;
    this.rememberTouch(defender);
    this.startTackleRecoveryFlight(carrier, defender);
    this.recordTackle(defender, carrier, pressure, "MANUAL_TACKLE");
    this.recordEvent("TURNOVER", defender.team, defender, { carrier: carrier.name, outcome: "tackle", pressure, reason: "MANUAL_TACKLE" });
    return true;
  }

  setSeed(seed: string | number) {
    this.seedSalt = String(seed || "");
    this.reseed();
  }

  setRuntimeProvenance(input: { engineRuntimeToken?: string | null; engineBootedAt?: number | null }) {
    this.engineRuntimeToken = typeof input.engineRuntimeToken === "string" && input.engineRuntimeToken.trim()
      ? input.engineRuntimeToken
      : null;
    this.engineBootedAt = Number.isFinite(input.engineBootedAt) ? Number(input.engineBootedAt) : null;
  }

  resetMatch() {
    this.msm = createMatchStateMachine(this.msm.clock.halfDuration);
    this.teamA = makeTeamStats(this.teamA.name, this.teamA.formation);
    this.teamB = makeTeamStats(this.teamB.name, this.teamB.formation);
    this.ball = { pos: { x: 0, y: 0.18, z: 0 }, vel: { x: 0, z: 0 } };
    this.ballFlight = null;
    this.possession = null;
    this.actionTimer = 0;
    this.visualReceptionSettleRemaining = 0;
    this.visualReceptionPlayerId = null;
    this.deliveryContinuationRemaining = 0;
    this.deliveryContinuationPlayerId = null;
    this.activeReceptionTelemetry = null;
    this.elapsedTotal = 0;
    this.eventSeq = 0;
    this.liveEventSeq = 0;
    this.shotSeq = 0;
    this.keeperSeq = 0;
    this.passLoopSeq = 0;
    this.ballFlightSeq = 0;
    this.phasePacingSeq = 0;
    this.strikerBoxSeq = 0;
    this.offsideTargetSelectionLockedUntil = 0;
    this.strikerBoxPossession = null;
    this.lastCompletedPass = null;
    this.dribblePhase = 0;
    this.kickoffTeam = null;
    this.kickoffKickerId = null;
    this.kickoffReceiverId = null;
    this.kickoffShapeReleaseRemaining = 0;
    this.kickoffSetupMoving = false;
    this.carrierTraceTimer = 0;
    this.carrierTraceSegmentSeq = 0;
    this.activeCarrierTraceOwnerId = null;
    this.lastTouchTeam = null;
    this.lastTouchPlayerId = null;
    this.lastBallPos = { x: 0, z: 0 };
    this.pendingBallOutEvent = null;
    this.pendingBallOutContext = null;
    this.pendingMissGoalLineOut = null;
    this.visibleBallOutPending = null;
    this.pendingFlightGoalEvent = null;
    this.pendingGoalAnnouncement = null;
    this.goalNetSettleRemaining = 0;
    this.goalKickoffSetupInstalled = false;
    this.restartContext = null;
    this.cpuPhasePauseRemaining = 0;
    this.cpuPhasePauseKey = "";
    this.cpuPhasePauseConsumedKey = "";
    this.deadBallStateKey = "";
    this.deadBallStateWallSeconds = 0;
    this.manualControl.A.selectedPlayerId = null;
    this.manualControl.A.move = { x: 0, z: 0 };
    this.manualControl.B.selectedPlayerId = null;
    this.manualControl.B.move = { x: 0, z: 0 };
    this.lastShotTelemetry = null;
    this.lastKeeperKickTelemetry = null;
    this.lastPassLoopTelemetry = null;
    this.sessionId = this.makeSessionId();
    this.fullLengthPossessionDiagnostics = {
      noSafeOutletPassFails: 0,
      speculativePassInterceptions: 0,
      nonDangerTerminalShots: 0,
      speculativeInterceptionDistanceBands: { lt14: 0, y14_16: 0, y16_18: 0, gte18: 0 },
      speculativeInterceptionSeparationBands: { lt2_5: 0, y2_5_3_5: 0, y3_5_4_5: 0, gte4_5: 0 },
      samples: [],
    };
    this.eventLog.length = 0;
    this.events.length = 0;
    this.passLog.length = 0;
    this.shotDecisions.length = 0;
    this.shotOpportunities.length = 0;
    this.passDecisions.length = 0;
    this.headerLog.length = 0;
    this.ballOutLog.length = 0;
    this.shapeA.length = 0;
    this.shapeB.length = 0;
    this.playerPositioning.length = 0;
    this.goalLog.length = 0;
    this.ballFlightTelemetry.length = 0;
    this.phasePacingTelemetry.length = 0;
    this.strikerBoxTelemetry.length = 0;
    this.visualRealityEvents.length = 0;
    this.reseed();
    this.rebuildTeams();
  }

  startMatch() {
    if (this.msm.state.kind !== "pre_match" || this.msm.clock.half !== 1 || this.msm.clock.elapsedInHalf > 0) {
      this.resetMatch();
    }
    if (this.msm.state.kind === "pre_match") {
      this.msm = advanceMatchState(this.msm, 0, null, null);
      this.installKickoffSetup(this.msm.state.kind === "kickoff" ? codeFromSide(this.msm.state.team) : "A");
      this.addLiveEvent("", "KICKOFF", `${this.teamA.name} vs ${this.teamB.name}`, {
        phase: "setup",
        restartType: "kickoff",
      });
    }
  }

  continueFromHalftime(mode: "manual" | "auto_cpu" = "manual") {
    if (this.msm.state.kind !== "halftime") return false;
    this.msm.clock.half = 2;
    this.msm.clock.elapsedInHalf = 0;
    this.msm.clock.stoppageTime = 0;
    this.msm.state = { kind: "kickoff", team: "away" };
    this.msm.restartTimer = 0;
    this.possession = null;
    this.ballFlight = null;
    this.activeReceptionTelemetry = null;
    this.pendingBallOutEvent = null;
    this.pendingBallOutContext = null;
    this.pendingMissGoalLineOut = null;
    this.visibleBallOutPending = null;
    this.restartContext = null;
    this.goalKickoffSetupInstalled = false;
    this.kickoffShapeReleaseRemaining = 0;
    this.cpuPhasePauseRemaining = 0;
    this.cpuPhasePauseKey = "";
    this.cpuPhasePauseConsumedKey = "";
    this.deadBallStateKey = "";
    this.deadBallStateWallSeconds = 0;
    this.installKickoffSetup("B", { snapPlayers: true });
    this.addLiveEvent("", "HALFTIME_CONTINUE", "second half kickoff", {
      mode,
      phase: "continue",
      restartType: "kickoff",
    });
    return true;
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

  getActiveBallFlightKind(): BallFlightKind | null {
    return this.ballFlight?.kind ?? null;
  }

  getMatchSnapshot() {
    const poss = this.possession?.team || "A";
    const possession = this.possessionPct();
    const effectiveA = this.effectiveTeamStats("A");
    const effectiveB = this.effectiveTeamStats("B");
    const matchId = this.buildMatchId();
    return {
      sessionId: this.sessionId,
      matchId,
      timestamp: Date.now(),
      scoreA: this.msm.score.home,
      scoreB: this.msm.score.away,
      shotsA: effectiveA.shots,
      shotsB: effectiveB.shots,
      shotsOnTargetA: effectiveA.shotsOnTarget,
      shotsOnTargetB: effectiveB.shotsOnTarget,
      savesA: this.teamA.saves,
      savesB: this.teamB.saves,
      headersA: this.teamA.headers,
      headersB: this.teamB.headers,
      passesA: this.teamA.passes,
      passesB: this.teamB.passes,
      passesCompletedA: this.teamA.passesCompleted,
      passesCompletedB: this.teamB.passesCompleted,
      foulsA: this.teamA.fouls,
      foulsB: this.teamB.fouls,
      offsidesA: this.teamA.offsides,
      offsidesB: this.teamB.offsides,
      penaltiesAwardedA: this.teamA.penaltiesAwarded,
      penaltiesAwardedB: this.teamB.penaltiesAwarded,
      penaltiesScoredA: this.teamA.penaltiesScored,
      penaltiesScoredB: this.teamB.penaltiesScored,
      penaltiesSavedA: this.teamA.penaltiesSaved,
      penaltiesSavedB: this.teamB.penaltiesSaved,
      penaltiesMissedA: this.teamA.penaltiesMissed,
      penaltiesMissedB: this.teamB.penaltiesMissed,
      penaltyXgA: +this.teamA.penaltyXg.toFixed(2),
      penaltyXgB: +this.teamB.penaltyXg.toFixed(2),
      cornersA: this.teamA.corners,
      cornersB: this.teamB.corners,
      throwInsA: this.teamA.throwIns,
      throwInsB: this.teamB.throwIns,
      goalKicksA: this.teamA.goalKicks,
      goalKicksB: this.teamB.goalKicks,
      freeKicksA: this.teamA.freeKicks,
      freeKicksB: this.teamB.freeKicks,
      tacklesWonA: this.teamA.tacklesWon,
      tacklesWonB: this.teamB.tacklesWon,
      clearancesA: this.teamA.clearances,
      clearancesB: this.teamB.clearances,
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
      runtimeHalfDuration: this.runtimeHalfDuration,
      matchClockScale: this.matchClockScale,
      seriesSpeedMul: this.seriesSpeedMul,
      restartDelayGoal: this.restartDelayGoal,
      restartDelayHalf: this.restartDelayHalf,
      cpuVsCpu: this.cpuVsCpu,
      interactiveHalftime: this.interactiveHalftime,
      engineRuntimeToken: this.engineRuntimeToken,
      engineBootedAt: this.engineBootedAt,
      teamAName: this.teamA.name,
      teamBName: this.teamB.name,
      teamAFormation: this.teamA.formation,
      teamBFormation: this.teamB.formation,
      lastShotTelemetry: this.lastShotTelemetry,
      lastKeeperKickTelemetry: this.lastKeeperKickTelemetry,
      lastPassLoopTelemetry: this.lastPassLoopTelemetry,
      goalLog: this.goalLog,
      fullLengthPossessionDiagnostics: {
        noSafeOutletPassFails: this.fullLengthPossessionDiagnostics.noSafeOutletPassFails,
        speculativePassInterceptions: this.fullLengthPossessionDiagnostics.speculativePassInterceptions,
        nonDangerTerminalShots: this.fullLengthPossessionDiagnostics.nonDangerTerminalShots,
        speculativeInterceptionDistanceBands: { ...this.fullLengthPossessionDiagnostics.speculativeInterceptionDistanceBands },
        speculativeInterceptionSeparationBands: { ...this.fullLengthPossessionDiagnostics.speculativeInterceptionSeparationBands },
      },
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
      runtimeHalfDuration: this.runtimeHalfDuration,
      matchClockScale: this.matchClockScale,
      isLive: this.msm.state.kind === "live_play",
      score: { a: this.msm.score.home, b: this.msm.score.away },
      eventLog: this.eventLog.slice(-80),
      shotDecisions: this.shotDecisions.slice(-80),
      shotOpportunities: this.shotOpportunities.slice(-80),
      passDecisions: this.passDecisions.slice(-80),
      strikerBoxTelemetry: this.strikerBoxTelemetry.slice(-40),
      headerLog: this.headerLog.slice(-80),
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
    const matchId = this.buildMatchId();
    return {
      matchId,
      sessionActive: true,
      engineRuntimeToken: this.engineRuntimeToken,
      engineBootedAt: this.engineBootedAt,
      teamA: this.bundleTeam("A"),
      teamB: this.bundleTeam("B"),
      events: this.events.slice(-5000),
      passLog: this.passLog.slice(-2000),
      headerLog: this.headerLog.slice(-1000),
      ballFlightTelemetry: this.ballFlightTelemetry.slice(-2000),
      phasePacingTelemetry: this.phasePacingTelemetry.slice(-200),
      strikerBoxTelemetry: this.strikerBoxTelemetry.slice(-1000),
      visualRealityEvents: this.visualRealityEvents.slice(-1000),
      shapeA: this.shapeA.slice(-600),
      shapeB: this.shapeB.slice(-600),
      playerPositioning: this.playerPositioning.slice(-600),
      transitions: this.events.filter((event) => event.type === "TURNOVER" || event.type === "GOAL").slice(-200),
      goalLog: this.goalLog,
      shotDecisions: this.shotDecisions.slice(-1000),
      shotOpportunities: this.shotOpportunities.slice(-1000),
      passDecisions: this.passDecisions.slice(-1000),
      ballOutLog: this.ballOutLog.slice(-1000),
      fullLengthPossessionDiagnostics: {
        noSafeOutletPassFails: this.fullLengthPossessionDiagnostics.noSafeOutletPassFails,
        speculativePassInterceptions: this.fullLengthPossessionDiagnostics.speculativePassInterceptions,
        nonDangerTerminalShots: this.fullLengthPossessionDiagnostics.nonDangerTerminalShots,
        speculativeInterceptionDistanceBands: { ...this.fullLengthPossessionDiagnostics.speculativeInterceptionDistanceBands },
        speculativeInterceptionSeparationBands: { ...this.fullLengthPossessionDiagnostics.speculativeInterceptionSeparationBands },
        samples: this.fullLengthPossessionDiagnostics.samples.slice(-200),
      },
      possessionDirector: this.getLiveTelemetry().possessionDirector,
      tuning: {
        model: "simple-v1",
        disabledRules: [],
      },
      telemetry: {
        disabledMetrics: [],
      },
      metadata: {
        model: "simple-v1",
        sessionId: this.sessionId,
        matchId,
        halfDuration: this.msm.clock.halfDuration,
        runtimeHalfDuration: this.runtimeHalfDuration,
        matchClockScale: this.matchClockScale,
        seriesSpeedMul: this.seriesSpeedMul,
        restartDelayGoal: this.restartDelayGoal,
        restartDelayHalf: this.restartDelayHalf,
        cpuVsCpu: this.cpuVsCpu,
        interactiveHalftime: this.interactiveHalftime,
        engineRuntimeToken: this.engineRuntimeToken,
        engineBootedAt: this.engineBootedAt,
        simulatedHalfDuration: this.msm.clock.halfDuration,
        generatedAt: Date.now(),
      },
    };
  }

  private makeSessionId() {
    return `simple-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private buildMatchId() {
    return `simple-${this.teamA.name}-${this.teamB.name}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  }

  getSelectedPlayerStats() {
    return this.manualSelectedPlayer("A") || this.possession || this.players.find((p) => p.team === "A") || null;
  }

  getSelectedDefensePlayerStats() {
    const selectedB = this.manualSelectedPlayer("B");
    if (selectedB) return selectedB;
    if (!this.possession) return this.players.find((p) => p.team === "B") || null;
    return this.nearestOpponent(this.possession, otherTeam(this.possession.team));
  }

  private teamFieldPlayers(team: SimpleTeamCode) {
    return this.players.filter((player) => player.team === team && player.role !== "GK");
  }

  private nearestFieldPlayerToBall(team: SimpleTeamCode) {
    const players = this.teamFieldPlayers(team);
    if (players.length === 0) return null;
    return players.reduce((best, player) => {
      const bestDist = dist2(best.pos, this.ball.pos);
      const nextDist = dist2(player.pos, this.ball.pos);
      return nextDist < bestDist ? player : best;
    });
  }

  private manualSelectedPlayer(team: SimpleTeamCode) {
    const state = this.manualControl[team];
    if (!state.enabled) return null;
    const current = state.selectedPlayerId
      ? this.players.find((player) => player.id === state.selectedPlayerId && player.team === team && player.role !== "GK") ?? null
      : null;
    if (current) return current;
    this.ensureManualSelection(team);
    return state.selectedPlayerId
      ? this.players.find((player) => player.id === state.selectedPlayerId && player.team === team && player.role !== "GK") ?? null
      : null;
  }

  /** Does the current mode allow the game to re-pick the controlled player? */
  private shouldAutoReselect(team: SimpleTeamCode) {
    switch (this.manualControl[team].autoSwitch) {
      case "MANUAL":
        return false;
      case "AIR_BALLS":
        return !!this.ballFlight?.aerial || this.ball.pos.y > this.ballGroundY() + 0.35;
      case "LOOSE_BALLS":
        return !this.possession;
      default:
        return true;
    }
  }

  private ensureManualSelection(team: SimpleTeamCode) {
    const state = this.manualControl[team];
    if (!state.enabled) return null;
    const fieldPlayers = this.teamFieldPlayers(team);
    if (fieldPlayers.length === 0) {
      state.selectedPlayerId = null;
      return null;
    }
    // Keep the player's pick unless the mode permits a switch. A stale id
    // (substituted or missing player) is always replaced so control cannot be
    // stranded on nobody.
    const current = fieldPlayers.find((player) => player.id === state.selectedPlayerId) ?? null;
    if (current && !this.shouldAutoReselect(team)) return current;

    const possessionPlayer = this.possession && this.possession.team === team && this.possession.role !== "GK"
      ? this.possession
      : null;
    const preferred = possessionPlayer ?? this.nearestFieldPlayerToBall(team) ?? fieldPlayers[0];
    state.selectedPlayerId = preferred?.id ?? null;
    return preferred ?? null;
  }

  /**
   * True while a restart awarded to a human team is staged and waiting on that
   * player. Deliberately does not require the taker to be in position: the hold
   * has to start the instant the restart is awarded, or the 1.5s timer expires
   * while the player is still walking up and the CPU plays the ball for them.
   */
  private awaitingManualRestart() {
    const restart = this.restartContext;
    if (!restart || this.msm.state.kind !== "ball_out") return false;
    if (restart.restartType === "penalty") return false;
    return !!this.manualControl[restart.restartTeam]?.enabled;
  }

  /** Player pressed a ball action while holding a restart: put it back in play. */
  private takeManualRestart(team: SimpleTeamCode) {
    const restart = this.restartContext;
    if (!restart || restart.restartTeam !== team) return false;
    if (!this.awaitingManualRestart()) return false;
    // A called routine only moves targets; the runners still have to get there,
    // or receiver selection and the delivery read the shape the routine just
    // replaced. Deliberately not isCornerSetupReady: that wants five box
    // attackers, six box defenders and the taker all set at once, which only
    // 4% of staged corners ever reach, so using it would leave the take button
    // dead until the 7s watchdog fired.
    if (restart.restartType === "corner" && !this.isCalledRoutineReady(restart)) return false;
    this.msm.restartTimer = 0;
    this.msm.state = { kind: "live_play", half: this.msm.clock.half, startTick: 0 };
    this.executeBallOutRestart();
    return true;
  }

  private runManualAction(team: SimpleTeamCode, action: "pass" | "shot" | "lob", power = 1) {
    const state = this.manualControl[team];
    if (!state.enabled) return false;
    if (this.msm.state.kind === "ball_out") return this.takeManualRestart(team);
    if (this.msm.state.kind !== "live_play" || this.ballFlight) return false;
    const carrier = this.possession;
    if (!carrier || carrier.team !== team) {
      this.selectNearestManualPlayer(team);
      return false;
    }
    if (carrier.role !== "GK") state.selectedPlayerId = carrier.id;
    const pressure = this.pressureOn(carrier);
    this.actionTimer = this.nextActionDelay();
    const direction = Math.hypot(state.move.x, state.move.z) > 0.2 ? { ...state.move } : undefined;
    if (action === "pass" || action === "lob") {
      const played = this.resolvePass(carrier, pressure, {
        preferForward: !direction,
        direction,
        lofted: action === "lob",
        power,
        reason: action === "lob" ? "MANUAL_LOB" : "MANUAL_PASS",
      });
      if (played || !direction) return played;
      // Nobody on the arrow: play it into that space rather than quietly
      // picking a team-mate somewhere else.
      return this.resolveDirectionalPass(carrier, direction, power, action === "lob");
    }
    // resolveShot returns a GoalEvent, so it is null for every shot that does
    // not score. Reporting that as "false" told callers the button did nothing
    // on a save, miss or woodwork. Compare the team's shot tally instead: it is
    // incremented once a shot is genuinely taken.
    const shotsBefore = this.team(carrier.team).shots;
    const goal = this.resolveShot(carrier, dist2(carrier.pos, goalCenterForAttack(this.attackSign(carrier.team))), pressure, {
      reason: "MANUAL_SHOT",
      style: pressure > 1 ? "driven" : "early",
      // Shots used to ignore aim entirely and always place randomly across the
      // mouth, so the stick/keys had no effect on where the ball went.
      aimDirection: direction,
      manual: true,
      power,
      details: { manualControl: true, power: +power.toFixed(2) },
    });
    return !!goal || this.team(carrier.team).shots > shotsBefore;
  }

  private cpuPhasePauseKeyForCurrentState() {
    const state = this.msm.state;
    const base = `${state.kind}|h${this.msm.clock.half}|${this.msm.score.home}-${this.msm.score.away}`;
    if (state.kind === "kickoff") return `${base}|${state.team}`;
    if (state.kind === "ball_out") return `${base}|${state.restartType}|${state.restartTeam}|${this.eventLog.length}`;
    if (state.kind === "goal_scored") return `${base}|${state.scoringTeam}`;
    if (state.kind === "halftime") return `${base}|halftime`;
    return "";
  }

  private deadBallWatchKeyForCurrentState() {
    const state = this.msm.state;
    if (state.kind === "kickoff") return `kickoff|h${this.msm.clock.half}|${state.team}`;
    if (state.kind === "ball_out") return `ball_out|h${this.msm.clock.half}|${state.restartType}|${state.restartTeam}`;
    if (state.kind === "goal_scored") return `goal_scored|h${this.msm.clock.half}|${state.scoringTeam}|${this.msm.score.home}-${this.msm.score.away}`;
    if (state.kind === "halftime" && (!this.interactiveHalftime || this.cpuVsCpu)) return `halftime|h${this.msm.clock.half}|${this.msm.score.home}-${this.msm.score.away}`;
    return "";
  }

  private resetCpuPhasePauseForCurrentState() {
    const currentKey = this.cpuPhasePauseKeyForCurrentState();
    if (currentKey) this.cpuPhasePauseConsumedKey = currentKey;
    this.cpuPhasePauseRemaining = 0;
    this.cpuPhasePauseKey = "";
  }

  private snapPlayersToTargets() {
    for (const player of this.players) {
      const clamped = clampToPlayable(player.targetPos);
      player.targetPos = { ...clamped };
      player.pos.x = clamped.x;
      player.pos.z = clamped.z;
      player.vel = { x: 0, z: 0 };
    }
  }

  private forceResolveDeadBallStall(reason: string) {
    const kind = this.msm.state.kind;
    if (kind === "kickoff") {
      this.snapPlayersToTargets();
      this.kickoffSetupMoving = false;
      this.resetCpuPhasePauseForCurrentState();
      this.ball.pos.x = 0;
      this.ball.pos.y = this.ballGroundY();
      this.ball.pos.z = 0;
      this.ball.vel = { x: 0, z: 0 };
      this.msm.state = { kind: "live_play", half: this.msm.clock.half, startTick: 0 };
      this.executeKickoff();
    } else if (kind === "ball_out") {
      const taker = this.restartContext?.takerId
        ? this.players.find((player) => player.id === this.restartContext?.takerId)
        : null;
      if (this.restartContext) {
        if (this.restartContext.restartType === "corner") this.positionCornerPlayers(this.restartContext);
        if (this.restartContext.restartType === "goal_kick") this.positionGoalKickPlayers(this.restartContext);
        if (this.restartContext.restartType === "penalty") this.positionPenaltyPlayers(this.restartContext);
        if (taker) taker.targetPos = this.restartTakerTarget(this.restartContext);
      }
      this.snapPlayersToTargets();
      if (this.restartContext && taker && (this.restartContext.restartType === "corner" || this.restartContext.restartType === "throw_in")) {
        const rawTarget = this.restartTakerTarget(this.restartContext);
        taker.targetPos = { ...rawTarget };
        taker.pos.x = rawTarget.x;
        taker.pos.z = rawTarget.z;
        taker.vel = { x: 0, z: 0 };
      }
      this.resetCpuPhasePauseForCurrentState();
      this.ball.vel = { x: 0, z: 0 };
      if (this.restartContext) {
        this.ball.pos.x = this.restartContext.spot.x;
        this.ball.pos.y = this.ballGroundY();
        this.ball.pos.z = this.restartContext.spot.z;
      }
      this.msm.state = { kind: "live_play", half: this.msm.clock.half, startTick: 0 };
      this.executeBallOutRestart();
    } else if (kind === "goal_scored") {
      const scoringTeam = (this.msm.state as { kind: "goal_scored"; scoringTeam: TeamSide }).scoringTeam;
      const restartTeam: SimpleTeamCode = scoringTeam === "home" ? "B" : "A";
      this.goalNetSettleRemaining = 0;
      this.installKickoffSetup(restartTeam, { snapPlayers: true });
      this.goalKickoffSetupInstalled = true;
      this.resetCpuPhasePauseForCurrentState();
      this.ball.pos.x = 0;
      this.ball.pos.y = this.ballGroundY();
      this.ball.pos.z = 0;
      this.ball.vel = { x: 0, z: 0 };
      this.msm.state = { kind: "kickoff", team: teamSide(restartTeam) };
      this.executeKickoff();
      this.msm.state = { kind: "live_play", half: this.msm.clock.half, startTick: 0 };
    } else if (kind === "halftime") {
      if (this.interactiveHalftime) {
        const continued = this.continueFromHalftime("auto_cpu");
        if (continued) {
          this.executeKickoff();
          this.msm.state = { kind: "live_play", half: this.msm.clock.half, startTick: 0 };
        }
      } else {
        this.resetCpuPhasePauseForCurrentState();
        this.msm.restartTimer = 0;
      }
    }
    this.deadBallStateKey = "";
    this.deadBallStateWallSeconds = 0;
    this.addLiveEvent("", "WATCHDOG", `${reason}:${kind}`, {
      phase: phaseName(this.msm),
      half: this.msm.clock.half,
      elapsedInHalf: +this.msm.clock.elapsedInHalf.toFixed(2),
      reason,
      stalledState: kind,
    });
  }

  private updateDeadBallWatchdog(dt: number) {
    const key = this.deadBallWatchKeyForCurrentState();
    if (!key) {
      this.deadBallStateKey = "";
      this.deadBallStateWallSeconds = 0;
      return;
    }
    if (key !== this.deadBallStateKey) {
      this.deadBallStateKey = key;
      this.deadBallStateWallSeconds = 0;
    }
    this.deadBallStateWallSeconds += dt;
    // A restart the player is holding gets a long leash -- the 6s dead-ball
    // watchdog otherwise force-resolved it and the CPU took the player's free
    // kick for them. Still bounded, so a player who never presses cannot hang
    // the match.
    const threshold = this.awaitingManualRestart()
      ? MANUAL_RESTART_WATCHDOG_SECONDS
      : this.msm.state.kind === "halftime" ? 8 : 6;
    if (this.deadBallStateWallSeconds >= threshold) {
      this.forceResolveDeadBallStall("DEAD_BALL_STALL_WATCHDOG");
    }
  }

  private maybeStartCpuPhasePause(reason: string, seconds = CPU_PHASE_PAUSE_SECONDS) {
    if (!this.cpuVsCpu) return false;
    const key = this.cpuPhasePauseKeyForCurrentState();
    if (!key || key === this.cpuPhasePauseConsumedKey || this.cpuPhasePauseRemaining > 0) return this.cpuPhasePauseRemaining > 0;
    this.cpuPhasePauseKey = key;
    this.cpuPhasePauseRemaining = seconds;
    this.phasePacingTelemetry.push({
      seq: ++this.phasePacingSeq,
      phase: phaseName(this.msm),
      reason,
      durationSeconds: +seconds.toFixed(2),
      half: this.msm.clock.half,
      scoreA: this.msm.score.home,
      scoreB: this.msm.score.away,
      elapsedInHalf: +this.msm.clock.elapsedInHalf.toFixed(2),
    });
    while (this.phasePacingTelemetry.length > 200) this.phasePacingTelemetry.shift();
    return true;
  }

  private consumeCpuPhasePause(dt: number) {
    if (!this.cpuVsCpu || this.cpuPhasePauseRemaining <= 0) return false;
    this.cpuPhasePauseRemaining = Math.max(0, this.cpuPhasePauseRemaining - dt);
    if (this.cpuPhasePauseRemaining <= 0) {
      this.cpuPhasePauseConsumedKey = this.cpuPhasePauseKey;
      this.cpuPhasePauseKey = "";
    }
    this.elapsedTotal += dt;
    this.lastStateKind = this.msm.state.kind;
    return true;
  }

  private stepFixed(dt: number) {
    const prevKind = this.msm.state.kind;
    const clockDt = dt * this.matchClockScale;
    this.advanceManualCharges(dt);
    this.manualTackleCooldown.A = Math.max(0, this.manualTackleCooldown.A - dt);
    this.manualTackleCooldown.B = Math.max(0, this.manualTackleCooldown.B - dt);
    this.updateDeadBallWatchdog(dt);
    // Park the ball on the centre spot for the whole break, not just when play
    // resumes. continueFromHalftime placed it via installKickoffSetup, but the
    // interactive break returns early waiting for the player, so the ball sat
    // wherever the whistle caught it. Keyed on the state rather than the
    // transition because the CPU phase pause consumes the transition and marks
    // lastStateKind before any later check runs.
    if (this.msm.state.kind === "halftime") {
      this.ballFlight = null;
      this.possession = null;
      this.ball.pos.x = 0;
      this.ball.pos.z = 0;
      this.ball.pos.y = this.ballGroundY();
      this.ball.vel = { x: 0, z: 0 };
      this.lastBallPos = { x: 0, z: 0 };
    }
    let goalEvent: GoalEvent | null = null;
    this.pendingBallOutEvent = null;
    this.pendingBallOutContext = null;
    if (this.msm.state.kind === "ball_out" && this.restartContext?.restartType === "goal_kick" && !this.isGoalKickSetupReady(this.restartContext)) {
      this.msm.restartTimer = Math.max(this.msm.restartTimer, dt + SIMULATION_DT);
    }
    if (this.msm.state.kind === "ball_out" && this.restartContext?.restartType === "corner" && !this.isCornerSetupReady(this.restartContext)) {
      this.msm.restartTimer = Math.max(this.msm.restartTimer, dt + SIMULATION_DT);
    }
    if (this.msm.state.kind === "ball_out" && this.restartContext?.restartType === "penalty" && !this.isPenaltySetupReady(this.restartContext)) {
      this.msm.restartTimer = Math.max(this.msm.restartTimer, dt + SIMULATION_DT);
    }
    // A restart awarded to a human team waits for that player to take it.
    // Without this the timer expired and the CPU played the ball while the
    // player was still walking up to it.
    if (this.awaitingManualRestart()) {
      this.msm.restartTimer = Math.max(this.msm.restartTimer, dt + SIMULATION_DT);
    }
    if (this.msm.state.kind === "goal_scored" && this.goalNetVisualPending()) {
      this.msm.restartTimer = Math.max(this.msm.restartTimer, dt + SIMULATION_DT);
    }
    if (this.msm.state.kind === "goal_scored" && this.kickoffSetupMoving && !this.isKickoffSetupReady()) {
      this.msm.restartTimer = Math.max(this.msm.restartTimer, dt + SIMULATION_DT);
    }
    const halfLimit = this.msm.clock.halfDuration + this.msm.clock.stoppageTime;
    if (this.msm.state.kind === "live_play" && this.msm.clock.elapsedInHalf < halfLimit) {
      if (this.shouldForceFinalNoShotAttempt(clockDt)) {
        goalEvent = this.forceNoShotAttempt("NO_SHOT_FINAL_WHISTLE");
      } else {
        goalEvent = this.playLiveTick(dt);
      }
    }

    if (this.msm.state.kind === "kickoff" && this.kickoffSetupMoving && !this.isKickoffSetupReady()) {
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

    if (this.msm.state.kind === "kickoff" && this.maybeStartCpuPhasePause("kickoff_setup_ready")) {
      if (this.consumeCpuPhasePause(dt)) return;
    }
    if (this.cpuVsCpu && this.msm.state.kind === "ball_out") {
      if (this.restartContext) this.moveRestartPlayers(dt);
      const restartType = this.restartContext?.restartType || (this.msm.state as { kind: "ball_out"; restartType: string }).restartType;
      if (this.maybeStartCpuPhasePause(`restart_${restartType}`)) {
        if (this.consumeCpuPhasePause(dt)) return;
      }
    }
    if (this.msm.state.kind === "goal_scored") {
      const kickoffReady = !this.kickoffSetupMoving || this.isKickoffSetupReady();
      if (this.goalKickoffSetupInstalled && !this.goalNetVisualPending() && kickoffReady && this.maybeStartCpuPhasePause("post_goal_reset_ready")) {
        if (this.consumeCpuPhasePause(dt)) return;
      }
    }
    if (this.interactiveHalftime && this.msm.state.kind === "halftime") {
      const halftimeKey = this.cpuPhasePauseKeyForCurrentState();
      if (this.cpuVsCpu) {
        if (this.maybeStartCpuPhasePause("halftime_break")) {
          if (this.consumeCpuPhasePause(dt)) return;
        }
        if (halftimeKey && this.cpuPhasePauseConsumedKey === halftimeKey) {
          this.continueFromHalftime("auto_cpu");
        }
      }
      this.elapsedTotal += dt;
      this.lastStateKind = this.msm.state.kind;
      return;
    }
    if (!this.interactiveHalftime && this.msm.state.kind === "halftime" && this.maybeStartCpuPhasePause("halftime_break")) {
      if (this.consumeCpuPhasePause(dt)) return;
    }

    const ballOutEvent = goalEvent ? null : this.pendingBallOutEvent;
    const ballOutContext = goalEvent ? null : this.pendingBallOutContext;
    this.msm = advanceMatchState(this.msm, dt, ballOutEvent, goalEvent, clockDt, this.interactiveHalftime);
    this.elapsedTotal += dt;
    this.kickoffShapeReleaseRemaining = Math.max(0, this.kickoffShapeReleaseRemaining - dt);
    if (this.kickoffShapeReleaseRemaining <= 0 && this.msm.state.kind !== "kickoff") {
      this.kickoffKickerId = null;
      this.kickoffReceiverId = null;
    }

    if (this.msm.state.kind === "ball_out") {
      if (prevKind !== "ball_out" && !this.restartContext) this.installBallOutRestart(ballOutContext);
      this.moveRestartPlayers(dt);
    } else if (this.msm.state.kind === "goal_scored") {
      this.msm.restartTimer = Math.min(this.msm.restartTimer, this.restartDelayGoal);
      const goalVisualComplete = this.updateGoalScoredBall(dt);
      if (!goalVisualComplete) {
        this.msm.restartTimer = Math.max(this.msm.restartTimer, dt + SIMULATION_DT);
      }
      if (!this.goalKickoffSetupInstalled && goalVisualComplete) {
        const scoringTeam = (this.msm.state as { kind: "goal_scored"; scoringTeam: TeamSide }).scoringTeam;
        const restartTeam: SimpleTeamCode = scoringTeam === "home" ? "B" : "A";
        this.installKickoffSetup(restartTeam);
        this.goalKickoffSetupInstalled = true;
      }
      if (this.kickoffSetupMoving) {
        this.movePlayers(dt, POST_GOAL_RESET_SPEED_MULTIPLIER);
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

    if (this.msm.state.kind === "kickoff" && prevKind !== "kickoff" && !this.goalKickoffSetupInstalled) {
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
      this.kickoffSetupMoving = false;
      this.ball.vel = { x: 0, z: 0 };
      this.addLiveEvent("", "HALF", "halftime");
    }
    if (this.msm.state.kind === "full_time" && prevKind !== "full_time") {
      if (this.totalShots() === 0) this.forceNoShotAttempt("NO_SHOT_FULL_TIME_FALLBACK");
      this.addLiveEvent("", "FULL", `${this.teamA.name} ${this.msm.score.home}-${this.msm.score.away} ${this.teamB.name}`);
    }
    // Safety net: the announcement is normally flushed when the shot flight
    // lands, but it must never be stranded if that path is missed.
    if (this.pendingGoalAnnouncement && !this.ballFlight) this.flushPendingGoalAnnouncement();
    for (const player of this.players) {
      // Honour the restart-taker allowance: this runs after moveRestartPlayers
      // has snapped the corner/throw-in taker behind the ball, and clamping
      // them here put them back on the pitch side of it.
      const clamped = clampToPlayable(player.pos, this.playableOutsideAllowance(player));
      player.pos.x = clamped.x;
      player.pos.z = clamped.z;
    }
    this.lastStateKind = this.msm.state.kind;
  }

  /**
   * Ball motion after it has left the pitch but before the restart is staged.
   * It keeps its pace, bounces off the perimeter wall and settles, rather than
   * stopping dead on the line.
   */
  private updateOutOfPlayBallMotion(dt: number) {
    this.ballVelY = 0;
    const speed = Math.hypot(this.ball.vel.x, this.ball.vel.z);
    if (speed <= 0.01) {
      this.ball.vel = { x: 0, z: 0 };
      this.ball.pos.y = this.ballGroundY();
      return;
    }

    this.ball.pos.x += this.ball.vel.x * dt;
    this.ball.pos.z += this.ball.vel.z * dt;

    const wallX = FIELD_W / 2 + STADIUM_WALL_OFFSET;
    const wallZ = FIELD_D / 2 + STADIUM_WALL_OFFSET;
    if (Math.abs(this.ball.pos.x) > wallX) {
      this.ball.pos.x = Math.sign(this.ball.pos.x) * wallX;
      this.ball.vel.x *= -STADIUM_WALL_RESTITUTION;
      this.ball.vel.z *= STADIUM_WALL_RESTITUTION;
    }
    if (Math.abs(this.ball.pos.z) > wallZ) {
      this.ball.pos.z = Math.sign(this.ball.pos.z) * wallZ;
      this.ball.vel.z *= -STADIUM_WALL_RESTITUTION;
      this.ball.vel.x *= STADIUM_WALL_RESTITUTION;
    }

    // Light drag once it is out of play: at 3x the ball stopped around 5u
    // short of the wall inside the hold, so it never actually got there.
    const damp = Math.max(0, 1 - LOOSE_BALL_GROUND_FRICTION * dt * 0.9);
    this.ball.vel.x *= damp;
    this.ball.vel.z *= damp;
    this.ball.pos.y = this.ballGroundY();
  }

  private playLiveTick(dt: number): GoalEvent | null {
    if (this.visibleBallOutPending) {
      this.activeCarrierTraceOwnerId = null;
      this.visibleBallOutPending.holdSeconds -= dt;
      // Let the ball run on and rebound off the stadium wall instead of
      // freezing dead the instant it crosses a line -- it reads as a bug.
      this.updateOutOfPlayBallMotion(dt);
      if (this.visibleBallOutPending.holdSeconds <= 0) {
        this.pendingBallOutEvent = this.visibleBallOutPending.event;
        this.pendingBallOutContext = this.visibleBallOutPending.context;
        this.visibleBallOutPending = null;
      }
      return null;
    }
    if (!this.possession && !this.ballFlight) this.updateLooseBallMotion(dt);
    // A loose ball can cross a line too. Detection used to run only inside the
    // ballFlight branch below, so a ball rolling out -- or into the net --
    // while nobody was carrying it was simply never noticed.
    if (!this.possession && !this.ballFlight) {
      const looseBallGoal = this.detectAndStageBallOut();
      if (looseBallGoal) return looseBallGoal;
    }
    if (!this.possession && !this.ballFlight) this.claimLooseBallPossession("A");
    if (this.possession) {
      // Only record a touch when the player is genuinely on the ball. The
      // loose-ball claim radius (1.35u) is far wider than real contact
      // (~0.55u), so recording every frame let a defender standing near a
      // ball rolling out become the "last toucher" without touching it --
      // turning a goal kick into a corner.
      if (dist2(this.possession.pos, { x: this.ball.pos.x, z: this.ball.pos.z }) <= TOUCH_CONTACT_RADIUS) {
        this.rememberTouch(this.possession);
      }
      this.team(this.possession.team).possessionSeconds += dt;
      this.possession.stats.possessionSeconds += dt;
    }
    this.updateTargets();
    if (!this.possession && !this.ballFlight) this.updateLooseBallChaseTarget();
    this.movePlayers(dt);
    if (this.possession && !this.ballFlight) this.updateControlledBall(dt, this.possession);
    if (this.visualReceptionSettleRemaining > 0) {
      this.visualReceptionSettleRemaining = Math.max(0, this.visualReceptionSettleRemaining - dt);
      if (this.visualReceptionSettleRemaining <= 0) this.visualReceptionPlayerId = null;
    }
    if (this.deliveryContinuationRemaining > 0) {
      this.deliveryContinuationRemaining = Math.max(0, this.deliveryContinuationRemaining - dt);
      if (this.deliveryContinuationRemaining <= 0) this.deliveryContinuationPlayerId = null;
    }
    this.shapeTimer += dt;
    if (this.shapeTimer >= 1) {
      this.shapeTimer = 0;
      this.sampleShape();
    }
    this.flushInactiveStrikerBoxPossession();
    if (this.ballFlight) {
      this.activeCarrierTraceOwnerId = null;
      this.actionTimer = Math.max(0, this.actionTimer - dt);
      this.updateBallFlight(dt);
      if (this.pendingFlightGoalEvent && !this.ballFlight) {
        const goalEvent = this.pendingFlightGoalEvent;
        this.pendingFlightGoalEvent = null;
        this.flushPendingGoalAnnouncement();
        return goalEvent;
      }
      const goalLineGoal = this.detectAndStageBallOut();
      if (goalLineGoal) return goalLineGoal;
      if (!this.ballFlight && this.possession) this.updateControlledBall(dt, this.possession);
      return null;
    }

    const carrier = this.possession;
    if (!carrier) {
      this.activeCarrierTraceOwnerId = null;
      return null;
    }
    if (this.activeCarrierTraceOwnerId !== carrier.id) {
      this.activeCarrierTraceOwnerId = carrier.id;
      this.carrierTraceSegmentSeq += 1;
      this.carrierTraceTimer = 0;
    }
    const pressure = this.pressureOn(carrier);
    const attackSign = this.attackSign(carrier.team);
    const goal = goalCenterForAttack(attackSign);
    const distToGoal = dist2(carrier.pos, goal);
    const forwardX = (goal.x - carrier.pos.x) * attackSign;
    this.carrierTraceTimer -= dt;
    if (this.carrierTraceTimer <= 0) {
      this.recordCarrierTrace(carrier, distToGoal, pressure);
      this.carrierTraceTimer = 0.1;
    }

    const manualCarrier =
      this.manualControl[carrier.team].enabled
      && this.manualSelectedPlayer(carrier.team)?.id === carrier.id;
    if (manualCarrier) {
      this.actionTimer = Math.max(0, this.actionTimer - dt);
      if (this.actionTimer <= 0 && !this.hasKeeperSmotherContact(carrier)) {
        this.actionTimer = 0.12;
        if (this.resolvePressureDuel(carrier, pressure)) return null;
      }
      return null;
    }

    const urgentGoalmouth = distToGoal < 4.6 && carrier.role !== "GK";
    const outfieldInPenaltyArea = carrier.role !== "GK" && this.isInAttackingPenaltyArea(carrier);
    const strikerInPenaltyArea = this.isStrikerInAttackingPenaltyArea(carrier);
    const deliveryContinuation = this.isDeliveryContinuationCarrier(carrier, distToGoal);
    const strikerBoxPossession = this.updateStrikerBoxPossession(carrier, distToGoal, pressure);
    const noShotPressure = this.shouldApplyNoShotPressure(carrier, distToGoal, forwardX);
    if (urgentGoalmouth) this.actionTimer = Math.min(this.actionTimer, 1.35);
    if (outfieldInPenaltyArea) this.actionTimer = Math.min(this.actionTimer, 0.38);
    if (deliveryContinuation) this.actionTimer = Math.min(this.actionTimer, outfieldInPenaltyArea ? 0.30 : 0.34);
    if (strikerBoxPossession) {
      this.actionTimer = Math.min(
        this.actionTimer,
        Math.max(0, strikerBoxPossession.deadlineAt - this.elapsedTotal),
      );
    }
    if (noShotPressure) this.actionTimer = Math.min(this.actionTimer, 0.35);
    const compressedShotFloor = this.shouldApplyCompressedShotFloor(carrier, distToGoal, forwardX)
      && !urgentGoalmouth
      && !outfieldInPenaltyArea
      && !this.isStrikerNearPenaltyArea(carrier, distToGoal);
    if (compressedShotFloor) this.actionTimer = Math.min(this.actionTimer, 0.18);

    this.actionTimer -= dt;
    if (this.actionTimer > 0) return null;
    this.actionTimer = this.nextActionDelay();

    if (carrier.role === "GK") {
      this.executeKeeperDropKick(carrier, pressure);
      return null;
    }

    const keeperSmotherContact = this.hasKeeperSmotherContact(carrier);
    if (!keeperSmotherContact && this.resolvePressureDuel(carrier, pressure)) {
      this.finishStrikerBoxPossession(carrier, "pressure_loss", distToGoal, pressure);
      return null;
    }

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
        this.recordTackle(keeper, carrier, pressure, "GOAL_LINE_RECOVERY");
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
          this.recordTackle(keeper, carrier, pressure, "KEEPER_SMOTHER");
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
      this.recordShotOpportunity(carrier, distToGoal, pressure, 1, "goalmouth_finish", {
        urgentGoalmouth,
        keeperDist,
        reason: "GOALMOUTH_FINISH",
      });
      return this.resolveShot(carrier, distToGoal, pressure, {
        reason: "GOALMOUTH_FINISH",
        forceOnTarget: true,
        style: "toe_poke",
        details: {
          urgentGoalmouth,
          keeperDist,
        },
      });
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

    const inAttackingPenaltyArea = this.isInAttackingPenaltyArea(carrier);
    if (inAttackingPenaltyArea) {
      const penaltyShotChance = this.penaltyAreaShotChance(carrier, distToGoal, pressure);
      if (strikerInPenaltyArea) {
        const teamShotLoad = this.team(carrier.team).shots;
        const matchShotLoad = this.teamA.shots + this.teamB.shots;
        const forcedShotQuality = this.forcedShotQualityDebt(carrier, distToGoal, pressure);
        // Tuning note: this is the narrow brake for repeated central striker
        // box shots. Revert the early-repeat thresholds to 26/14 if chance
        // creation drops below KPI after browser validation.
        const repeatedStrikerBoxPressure = matchShotLoad >= 14 || teamShotLoad >= 7;
        const shotLoadContainment = repeatedStrikerBoxPressure || matchShotLoad >= 26 || teamShotLoad >= 14 || forcedShotQuality.shouldContain;
        if (this.resolveStrikerBoxPhysicalLoss(carrier, distToGoal, pressure, {
          shotLoadContainment,
          qualityDebt: forcedShotQuality.qualityDebt,
          qualityReason: forcedShotQuality.reason,
        })) return null;
        const dwellSeconds = this.strikerBoxDwellSeconds(carrier);
        const forcedMinOnTargetChance = matchShotLoad >= 36 ? 0.14 : matchShotLoad >= 30 ? 0.20 : matchShotLoad >= 26 ? 0.28 : 0.38;
        const forcedGoalChanceMultiplier = matchShotLoad >= 36 ? 0.28 : matchShotLoad >= 30 ? 0.36 : matchShotLoad >= 26 ? 0.44 : 0.52;
        this.recordShotOpportunity(carrier, distToGoal, pressure, 1, "striker_penalty_area_forced_shot", {
          forwardX,
          inAttackingPenaltyArea,
          reason: "STRIKER_PENALTY_AREA_FORCED_SHOT",
          dwellSeconds,
          matchShotLoad,
          shotQualityDebt: forcedShotQuality.qualityDebt,
          shotQualityReason: forcedShotQuality.reason,
        });
        this.finishStrikerBoxPossession(carrier, "shot", distToGoal, pressure, {
          reason: "STRIKER_PENALTY_AREA_FORCED_SHOT",
          matchShotLoad,
          shotQualityDebt: forcedShotQuality.qualityDebt,
          shotQualityReason: forcedShotQuality.reason,
        });
        return this.resolveShot(carrier, distToGoal, pressure, {
          reason: "STRIKER_PENALTY_AREA_FORCED_SHOT",
          style: pressure > 1.1 ? "first_time" : "driven",
          minOnTargetChance: forcedMinOnTargetChance,
          goalChanceMultiplier: forcedGoalChanceMultiplier,
          details: {
            inAttackingPenaltyArea,
            shotSelectionType: "striker_penalty_area_forced_shot",
            forwardX,
            dwellSeconds,
            matchShotLoad,
            shotQualityDebt: forcedShotQuality.qualityDebt,
            shotQualityReason: forcedShotQuality.reason,
          },
        });
      }
      const penaltyShotRoll = this.rng.next();
      if (penaltyShotChance > penaltyShotRoll) {
        this.recordShotOpportunity(carrier, distToGoal, pressure, penaltyShotChance, "penalty_area_shot", {
          roll: penaltyShotRoll,
          forwardX,
          inAttackingPenaltyArea,
          reason: "PENALTY_AREA_SHOT",
        });
        return this.resolveShot(carrier, distToGoal, pressure, {
          reason: "PENALTY_AREA_SHOT",
          style: pressure > 1.1 ? "first_time" : "driven",
          details: {
            inAttackingPenaltyArea,
            shotSelectionType: "penalty_area_shot",
            forwardX,
          },
        });
      }
      this.recordShotOpportunity(carrier, distToGoal, pressure, penaltyShotChance, "penalty_area_pass", {
        roll: penaltyShotRoll,
        forwardX,
        inAttackingPenaltyArea,
        reason: "PENALTY_AREA_PASS_OR_SHOT",
      });
      const passed = this.resolvePass(carrier, pressure, { minProgress: 0, preferForward: true, reason: "PENALTY_AREA_PASS_OR_SHOT" });
      if (!passed) {
        const matchShotLoad = this.teamA.shots + this.teamB.shots;
        const forcedShotQuality = this.forcedShotQualityDebt(carrier, distToGoal, pressure);
        const compressedContainment = this.productionCompression() > 1.01
          && (matchShotLoad >= 6 || pressure >= 0.42 || forcedShotQuality.shouldContain);
        if ((matchShotLoad >= 26 || compressedContainment || forcedShotQuality.shouldContain)
          && this.resolvePenaltyAreaContainmentLoss(carrier, distToGoal, pressure, {
            qualityDebt: forcedShotQuality.qualityDebt,
            qualityReason: forcedShotQuality.reason,
          })) return null;
        const noOutletMinOnTargetChance = matchShotLoad >= 36 ? 0.16 : matchShotLoad >= 30 ? 0.22 : 0.32;
        const noOutletGoalChanceMultiplier = matchShotLoad >= 36 ? 0.30 : matchShotLoad >= 30 ? 0.38 : 0.48;
        this.recordShotOpportunity(carrier, distToGoal, pressure, 1, "penalty_area_no_outlet_forced_shot", {
          roll: penaltyShotRoll,
          forwardX,
          inAttackingPenaltyArea,
          reason: "PENALTY_AREA_NO_OUTLET_SHOT",
          matchShotLoad,
          shotQualityDebt: forcedShotQuality.qualityDebt,
          shotQualityReason: forcedShotQuality.reason,
        });
        return this.resolveShot(carrier, distToGoal, pressure, {
          reason: "PENALTY_AREA_NO_OUTLET_SHOT",
          style: pressure > 1.1 ? "first_time" : "driven",
          minOnTargetChance: noOutletMinOnTargetChance,
          goalChanceMultiplier: noOutletGoalChanceMultiplier,
          details: {
            inAttackingPenaltyArea,
            shotSelectionType: "penalty_area_no_outlet_forced_shot",
            forwardX,
            noOutlet: true,
            matchShotLoad,
            shotQualityDebt: forcedShotQuality.qualityDebt,
            shotQualityReason: forcedShotQuality.reason,
          },
        });
      }
      return null;
    }

    const compressedDeliveryContinuation = deliveryContinuation && this.productionCompression() > 1.01;
    const dangerousDeliverySecondAction = deliveryContinuation
      && (carrier.role === "W" || carrier.role === "AM" || carrier.role === "ST")
      && distToGoal <= 24;
    const pressuredChanceCreationShotWindow = !deliveryContinuation
      && distToGoal <= 18
      && forwardX >= 12
      && pressure >= 1.1
      && carrier.role !== "CB"
      && carrier.role !== "FB";
    const distanceShotChance = clamp(
      this.distanceShotChance(carrier, distToGoal, pressure, forwardX)
        + (deliveryContinuation && distToGoal <= 20
          ? compressedDeliveryContinuation
            ? dangerousDeliverySecondAction ? 0.040 : 0.028
            : dangerousDeliverySecondAction ? 0.024 : 0.016
          : pressuredChanceCreationShotWindow
            ? carrier.role === "W" || carrier.role === "AM" || carrier.role === "ST" ? 0.012 : 0.008
          : 0),
      0,
      0.14,
    );
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

    if (compressedShotFloor) {
      this.recordShotOpportunity(carrier, distToGoal, pressure, 1, "compressed_runtime_shot_floor", {
        forwardX,
        reason: "COMPRESSED_RUNTIME_SHOT_FLOOR",
        matchShotLoad: this.totalShots(),
      });
      return this.resolveShot(carrier, distToGoal, pressure, {
        reason: "COMPRESSED_RUNTIME_SHOT_FLOOR",
        style: distToGoal < 14 ? "driven" : "early",
        minOnTargetChance: 0.24,
        goalChanceMultiplier: 0.42,
        details: {
          forwardX,
          compressedRuntime: true,
        },
      });
    }

    const shootUrge = clamp(
      this.shootUrge(carrier, distToGoal, pressure)
        + (deliveryContinuation
          ? compressedDeliveryContinuation
            ? carrier.role === "ST" ? (dangerousDeliverySecondAction ? 0.058 : 0.040)
              : carrier.role === "AM" ? (dangerousDeliverySecondAction ? 0.046 : 0.030)
                : carrier.role === "W" ? (dangerousDeliverySecondAction ? 0.042 : distToGoal <= 18 ? 0.022 : 0.012)
                  : distToGoal <= 18 ? 0.022
                    : 0.012
            : carrier.role === "ST" ? (dangerousDeliverySecondAction ? 0.036 : 0.026)
              : carrier.role === "AM" ? (dangerousDeliverySecondAction ? 0.028 : 0.018)
                : carrier.role === "W" ? (dangerousDeliverySecondAction ? 0.024 : distToGoal <= 18 ? 0.012 : 0.006)
                  : distToGoal <= 18 ? 0.012
                  : 0.006
          : pressuredChanceCreationShotWindow
            ? carrier.role === "ST" ? 0.036
              : carrier.role === "AM" || carrier.role === "W" ? 0.028
                : carrier.role === "CM" || carrier.role === "DM" ? 0.024
                  : 0.018
          : 0),
      0.001,
      0.14,
    );
    const shootRoll = this.rng.next();
    if (shootUrge > shootRoll) {
      this.recordShotOpportunity(carrier, distToGoal, pressure, shootUrge, "shot", {
        roll: shootRoll,
        forwardX,
      });
      return this.resolveShot(carrier, distToGoal, pressure);
    }

    const shouldPass = dangerousDeliverySecondAction
      ? compressedDeliveryContinuation
        ? pressure > 1.18 || (forwardX < 6 && carrier.role !== "W") || this.rng.next() < 0.38
        : pressure > 0.95 || (forwardX < 7 && carrier.role !== "W") || this.rng.next() < 0.58
      : pressuredChanceCreationShotWindow
        ? pressure > 2.9 || forwardX < 11 || this.rng.next() < 0.44
      : compressedDeliveryContinuation
        ? pressure > 1.05 || forwardX < 8 || this.rng.next() < 0.72
        : pressure > 0.8 || forwardX < 10 || this.rng.next() < 0.995;
    if (shouldPass) {
      const strikerNearBox = this.isStrikerNearPenaltyArea(carrier, distToGoal);
      const forwardDeliveryContinuation = deliveryContinuation && (carrier.role === "ST" || carrier.role === "AM" || distToGoal <= 18);
      this.recordShotOpportunity(carrier, distToGoal, pressure, shootUrge, strikerNearBox || forwardDeliveryContinuation ? "striker_near_box_forward_creation" : "pass", {
        roll: shootRoll,
        forwardX,
        reason: strikerNearBox || forwardDeliveryContinuation ? "STRIKER_NEAR_BOX_FORWARD_CREATION" : undefined,
      });
      const passed = this.resolvePass(carrier, pressure, strikerNearBox || deliveryContinuation
        ? {
          minProgress: deliveryContinuation && compressedDeliveryContinuation ? 1 : 0,
          preferForward: true,
          reason: deliveryContinuation ? "DELIVERY_CONTINUATION" : "STRIKER_NEAR_BOX_FORWARD_CREATION",
        }
        : {});
      if (!passed && (strikerNearBox || forwardDeliveryContinuation)) {
        const forcedShotQuality = this.forcedShotQualityDebt(carrier, distToGoal, pressure);
        const compressedContainment = this.productionCompression() > 1.01
          && !deliveryContinuation
          && (this.teamA.shots + this.teamB.shots >= 6 || pressure >= 0.40 || forcedShotQuality.shouldContain);
        // Tuning note: this uses the existing high-load containment path for
        // near-box no-outlet shots. Revert to the plain call below if near-box
        // chance creation drops too far:
        // this.resolveStrikerBoxPhysicalLoss(carrier, distToGoal, pressure)
        if ((this.teamA.shots + this.teamB.shots > 28 || compressedContainment) && this.resolveStrikerBoxPhysicalLoss(carrier, distToGoal, pressure, {
          shotLoadContainment: true,
          qualityDebt: forcedShotQuality.qualityDebt,
          qualityReason: forcedShotQuality.reason,
        })) return null;
        this.recordShotOpportunity(carrier, distToGoal, pressure, 1, "striker_near_box_forced_shot", {
          roll: shootRoll,
          forwardX,
          reason: deliveryContinuation ? "DELIVERY_CONTINUATION_NO_OUTLET_SHOT" : "STRIKER_NEAR_BOX_NO_OUTLET_SHOT",
          shotQualityDebt: forcedShotQuality.qualityDebt,
          shotQualityReason: forcedShotQuality.reason,
        });
        return this.resolveShot(carrier, distToGoal, pressure, {
          reason: deliveryContinuation ? "DELIVERY_CONTINUATION_NO_OUTLET_SHOT" : "STRIKER_NEAR_BOX_NO_OUTLET_SHOT",
          style: pressure > 1.0 ? "first_time" : "driven",
          minOnTargetChance: 0.34,
          goalChanceMultiplier: 0.50,
          details: {
            shotSelectionType: "striker_near_box_forced_shot",
            forwardX,
            noForwardOutlet: true,
            shotQualityDebt: forcedShotQuality.qualityDebt,
            shotQualityReason: forcedShotQuality.reason,
          },
        });
      }
      return null;
    }

    this.recordShotOpportunity(carrier, distToGoal, pressure, shootUrge, "tackle_check", {
      roll: shootRoll,
      forwardX,
    });
    return this.resolveTackleChance(carrier, pressure);
  }

  private hasKeeperSmotherContact(carrier: SimplePlayer) {
    if (carrier.role === "GK" || !this.isInAttackingPenaltyArea(carrier)) return false;
    const keeper = this.players.find((player) => player.team === otherTeam(carrier.team) && player.role === "GK");
    return !!keeper && dist2(carrier.pos, keeper.pos) <= KEEPER_SMOTHER_CONTACT_RADIUS;
  }

  updateVisuals(dt: number) {
    if (this.shouldPinKickoffBallToCenter()) {
      this.ball.pos.x = 0;
      this.ball.pos.y = 0.18;
      this.ball.pos.z = 0;
      return;
    }
    if (this.ballFlight) return;
    if (this.possession && this.msm.state.kind === "live_play") {
      this.auditCarrierBallGap(this.possession);
    }
  }

  private shouldPinKickoffBallToCenter() {
    if (this.msm.state.kind === "kickoff") return true;
    if (!this.kickoffSetupMoving) return false;
    return this.msm.state.kind === "goal_scored" || this.msm.state.kind === "halftime";
  }

  private updateControlledBall(dt: number, carrier: SimplePlayer) {
    this.ballVelY = 0;
    const settlingReception = this.visualReceptionPlayerId === carrier.id && this.visualReceptionSettleRemaining > 0;
    this.dribblePhase += dt * (settlingReception ? 2.2 : 9);
    const previous = { x: this.ball.pos.x, z: this.ball.pos.z };
    this.lastBallPos = previous;
    const target = settlingReception
      ? this.settledReceptionBallTarget(carrier)
      : this.controlledBallTarget(carrier);
    const dx = target.x - this.ball.pos.x;
    const dz = target.z - this.ball.pos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    const carrierSpeed = Math.sqrt(carrier.vel.x * carrier.vel.x + carrier.vel.z * carrier.vel.z);
    const maxStep = settlingReception
      ? Math.max(0.025, (BASE_RUN_SPEED * 0.65 + carrierSpeed * 0.20) * dt)
      : Math.max(0.04, (BASE_RUN_SPEED * 1.9 + carrierSpeed * 0.55) * dt);
    if (distance <= maxStep || distance < 0.001) {
      this.ball.pos.x = target.x;
      this.ball.pos.z = target.z;
    } else {
      this.ball.pos.x += (dx / distance) * maxStep;
      this.ball.pos.z += (dz / distance) * maxStep;
    }
    const gapToCarrier = dist2(this.ball.pos, carrier.pos);
    const maxLeash = 1.85;
    if (gapToCarrier > maxLeash) {
      const away = normalize2({ x: this.ball.pos.x - carrier.pos.x, z: this.ball.pos.z - carrier.pos.z });
      this.ball.pos.x = carrier.pos.x + away.x * maxLeash;
      this.ball.pos.z = carrier.pos.z + away.z * maxLeash;
    }
    this.ball.pos.y += (target.y - this.ball.pos.y) * clamp(dt * 12, 0, 1);
    this.ball.vel = {
      x: dt > 0 ? (this.ball.pos.x - previous.x) / dt : 0,
      z: dt > 0 ? (this.ball.pos.z - previous.z) / dt : 0,
    };
    this.auditCarrierBallGap(carrier);
  }

  private settledReceptionBallTarget(carrier: SimplePlayer) {
    const goal = goalCenterForAttack(this.attackSign(carrier.team));
    const forward = normalize2({ x: goal.x - carrier.pos.x, z: goal.z - carrier.pos.z });
    return {
      x: carrier.pos.x + forward.x * 0.18,
      y: 0.08,
      z: carrier.pos.z + forward.z * 0.12,
    };
  }

  private controlledBallTarget(carrier: SimplePlayer) {
    const goal = goalCenterForAttack(this.attackSign(carrier.team));
    const forward = normalize2({ x: goal.x - carrier.pos.x, z: goal.z - carrier.pos.z });
    const lateral = { x: -forward.z, z: forward.x };
    const touch = Math.sin(this.dribblePhase);
    const lead = 0.82 + Math.max(0, touch) * 0.34;
    const side = Math.sin(this.dribblePhase * 0.5 + carrier.shirtNumber) * 0.26;
    const target = clampToPlayable({
      x: carrier.pos.x + forward.x * lead + lateral.x * side,
      z: carrier.pos.z + forward.z * lead + lateral.z * side,
    });
    return {
      x: target.x,
      y: 0.14 + Math.max(0, touch) * 0.12,
      z: target.z,
    };
  }

  /**
   * Let a player collect a ball that is passing them mid-flight.
   *
   * Reception used to be tested only at the landing point, and loose-ball
   * claiming was skipped entirely while a flight was active, so a ball played
   * into space flew straight through everyone -- testers saw passes run past
   * the intended receiver with no chance to take control.
   *
   * Only applies to balls played into space (no nominated receiver) and only
   * when the ball is low enough to control.
   */
  private tryMidFlightCollection() {
    const flight = this.ballFlight;
    if (!flight) return false;
    if (flight.kind !== "pass" && flight.kind !== "restart") return false;
    if (flight.followPlayerId) return false;
    if (this.ball.pos.y > this.ballGroundY() + MID_FLIGHT_COLLECT_MAX_HEIGHT) return false;
    // The ball must have actually travelled: without this the check fires on
    // the first frame, while the passer's team-mates are still standing around
    // the ball, and swallows the pass before it goes anywhere.
    const travelled = dist2({ x: this.ball.pos.x, z: this.ball.pos.z }, flight.from);
    if (travelled < MID_FLIGHT_COLLECT_MIN_TRAVEL) return false;
    if (flight.elapsed / Math.max(0.001, flight.duration) > 0.85) return false;

    const ball = { x: this.ball.pos.x, z: this.ball.pos.z };
    let best: { player: SimplePlayer; gap: number } | null = null;
    for (const player of this.players) {
      if (player.id === flight.passerId) continue;
      const gap = dist2(player.pos, ball);
      if (gap > MID_FLIGHT_COLLECT_RADIUS) continue;
      if (!best || gap < best.gap) best = { player, gap };
    }
    if (!best) return false;

    this.ballFlight = null;
    this.ball.vel = { x: 0, z: 0 };
    this.possession = best.player;
    best.player.stats.touches += 1;
    this.rememberTouch(best.player);
    this.visualReceptionPlayerId = best.player.id;
    return true;
  }

  private updateBallFlight(dt: number) {
    const flight = this.ballFlight;
    if (!flight) return;
    if (this.tryMidFlightCollection()) return;
    const prev = { x: this.ball.pos.x, z: this.ball.pos.z };
    this.lastBallPos = prev;
    flight.elapsed += Math.max(0, dt);
    const t = clamp(flight.elapsed / Math.max(0.001, flight.duration), 0, 1);
    this.ball.pos.x = flight.from.x + (flight.to.x - flight.from.x) * t;
    this.ball.pos.z = flight.from.z + (flight.to.z - flight.from.z) * t;
    // A headed ball leaves from head height and drops; without this the ball
    // teleported back to the turf the instant the header resolved, so 12.8
    // headers a match were each visible for a single frame.
    // Squared, not linear: a headed ball drops away quickly rather than gliding
    // at head height for the whole flight, which kept it above
    // MID_FLIGHT_COLLECT_MAX_HEIGHT long enough to change who won it.
    const launchDrop = flight.launchHeight
      ? Math.max(0, flight.launchHeight - this.ballGroundY()) * (1 - t) * (1 - t)
      : 0;
    this.ball.pos.y = this.ballGroundY() + launchDrop + Math.sin(Math.PI * t) * flight.arc;
    this.ball.vel = {
      x: dt > 0 ? (this.ball.pos.x - prev.x) / dt : 0,
      z: dt > 0 ? (this.ball.pos.z - prev.z) / dt : 0,
    };
    if (t >= 1) {
      if (this.resolveAerialHeaderOnArrival(flight)) return;
      if (this.resolveDangerousDeliveryFirstTimeShotOnArrival(flight)) return;
      // The closing step is clamped to t=1, so it advances only a fraction of a
      // normal timestep and this.ball.vel here reads an order of magnitude
      // slower than the pass actually travelled. Derive the carry from the
      // flight's own geometry instead, or an uncollected ball dies on the spot.
      const flightDx = flight.to.x - flight.from.x;
      const flightDz = flight.to.z - flight.from.z;
      const flightLen = Math.hypot(flightDx, flightDz);
      const flightSpeed = flightLen / Math.max(0.001, flight.duration);
      const landingVel = flightLen > 1e-4
        ? { x: (flightDx / flightLen) * flightSpeed, z: (flightDz / flightLen) * flightSpeed }
        : { x: 0, z: 0 };
      this.ball.pos.x = flight.to.x;
      this.ball.pos.y = this.ballGroundY();
      this.ball.pos.z = flight.to.z;
      this.ball.vel = { x: 0, z: 0 };
      const received = this.resolveBallFlightReception(flight);
      if (!received) {
        // Vertical speed at touchdown: d/dt of arc*sin(pi*t) at t = 1.
        const impactSpeed = (flight.arc * Math.PI) / Math.max(0.001, flight.duration);
        const rebound = impactSpeed * BALL_BOUNCE_RESTITUTION;
        this.ballVelY = rebound > BALL_BOUNCE_REST_SPEED ? rebound : 0;
        if (flight.kind === "pass" || flight.kind === "restart" || flight.kind === "interception") {
          // Aerial balls drop steeper and lose more pace on the bounce than a
          // driven ground ball, but they must still run on. Excluding them
          // here left every uncollected lob, cross and corner dead on the spot.
          const carry = flight.aerial || flight.headerEligible
            ? LOOSE_BALL_AERIAL_LANDING_CARRY
            : LOOSE_BALL_LANDING_CARRY;
          this.ball.vel = { x: landingVel.x * carry, z: landingVel.z * carry };
        }
        this.auditFlightLanding(flight);
      }
      this.ballFlight = null;
      return;
    }
  }

  private resolveBallFlightReception(flight: BallFlightState) {
    if (flight.kind === "shot" || flight.kind === "miss") return false;
    const latest = this.ballFlightTelemetry.at(-1);
    const player = flight.followPlayerId ? this.players.find((p) => p.id === flight.followPlayerId) || null : null;
    if (!player) {
      if (latest && latest.seq === this.ballFlightSeq) {
        latest.receptionOutcome = "no_target";
        latest.receptionGap = null;
      }
      this.activeReceptionTelemetry = null;
      this.possession = null;
      return false;
    }
    const ball = { x: this.ball.pos.x, z: this.ball.pos.z };
    const gap = dist2(ball, player.pos);
    const radius = flight.aerial || flight.headerEligible ? AERIAL_RECEPTION_RADIUS : BALL_RECEPTION_RADIUS;
    if (latest && latest.seq === this.ballFlightSeq) {
      latest.receptionGap = +gap.toFixed(2);
    }
    if (gap > radius) {
      if (latest && latest.seq === this.ballFlightSeq) latest.receptionOutcome = "loose";
      this.activeReceptionTelemetry = null;
      this.possession = null;
      this.lastCompletedPass = null;
      return false;
    }
    if (latest && latest.seq === this.ballFlightSeq) latest.receptionOutcome = "received";
    this.possession = player;
    this.rememberTouch(player);
    this.visualReceptionPlayerId = player.id;
    const settle = Math.max(0, flight.settleSeconds ?? 0);
    if (latest && latest.seq === this.ballFlightSeq) {
      latest.settleSeconds = +settle.toFixed(2);
      latest.realizedHoldSeconds = null;
      latest.holdResolvedBy = null;
      this.activeReceptionTelemetry = {
        flightSeq: latest.seq,
        playerId: player.id,
        playerName: player.name,
        receivedAtWall: +this.elapsedTotal.toFixed(3),
        settleSeconds: +settle.toFixed(2),
      };
    } else {
      this.activeReceptionTelemetry = null;
    }
    this.visualReceptionSettleRemaining = settle;
    if (this.productionCompression() > 1.01) {
      const goal = goalCenterForAttack(this.attackSign(player.team));
      const distToGoal = dist2(player.pos, goal);
      const distYards = (distToGoal / FIELD_W) * 120;
      const pressure = this.pressureOn(player);
      const dangerousArrival = flight.sourceAction === "cross"
        || flight.sourceAction === "lofted_pass"
        || this.isInAttackingPenaltyAreaWithBuffer(player, 3.2)
        || this.isStrikerNearPenaltyArea(player, distToGoal);
      const compressedArrivalDelay = distYards > 54
        ? 0.60
        : distYards > 32
          ? 0.72
          : distYards > 18
            ? 0.80
            : 0.86;
      if (dangerousArrival) {
        const compressedDecisionFloor = 0.42;
        this.actionTimer = Math.min(this.actionTimer, Math.max(compressedDecisionFloor, Math.min(settle, compressedArrivalDelay)));
      } else {
        const roleBonus = player.role === "CB" || player.role === "FB" || player.role === "CM" || player.role === "DM"
          ? 0.20
          : player.role === "AM" || player.role === "W"
            ? 0.08
            : 0;
        const ordinaryFloorBase = distYards > 54
          ? 1.95
          : distYards > 38
            ? 1.55
            : distYards > 24
              ? 1.20
              : 0.90;
        const pressureRelief = pressure > 0.55
          ? 0.55
          : pressure > 0.35
            ? 0.32
            : pressure > 0.22
              ? 0.14
              : 0;
        const compressedDecisionFloor = Math.max(0.78, ordinaryFloorBase + roleBonus - pressureRelief);
        this.actionTimer = Math.max(this.actionTimer, compressedDecisionFloor);
      }
    }
    if (this.isDangerousDeliveryReception(flight, player)) {
      this.actionTimer = Math.min(
        this.actionTimer,
        this.productionCompression() > 1.01
          ? Math.max(0.18, Math.min(settle, 0.30))
          : Math.max(0.24, Math.min(settle, 0.42)),
      );
      this.deliveryContinuationPlayerId = player.id;
      this.deliveryContinuationRemaining = Math.max(
        this.deliveryContinuationRemaining,
        this.productionCompression() > 1.01
          ? Math.max(1.05, settle + 0.55)
          : Math.max(0.75, settle + 0.30),
      );
    }
    return true;
  }

  private resolveDangerousDeliveryFirstTimeShotOnArrival(flight: BallFlightState) {
    if (this.productionCompression() <= 1.01) return false;
    if (flight.sourceAction !== "cross" && flight.sourceAction !== "lofted_pass") return false;
    const receiverId = flight.followPlayerId || flight.receiverId;
    const receiver = receiverId ? this.players.find((player) => player.id === receiverId) || null : null;
    if (!receiver || receiver.role === "GK") return false;
    if (!this.isDangerousDeliveryReception(flight, receiver)) return false;
    const contact = { x: flight.to.x, z: flight.to.z };
    const contactGap = dist2(receiver.pos, contact);
    if (contactGap > 2.45) return false;
    const distToGoal = dist2(contact, goalCenterForAttack(this.attackSign(receiver.team)));
    if (distToGoal > 20) return false;
    const pressure = this.pressureOn(receiver);
    const inOrNearBox = this.isInAttackingPenaltyAreaWithBuffer(receiver, 3.2) || this.isStrikerNearPenaltyArea(receiver, distToGoal);
    const firstTimeShotChance = clamp(
      (flight.sourceAction === "cross" ? 0.25 : 0.18)
      + (receiver.role === "ST" ? 0.17 : receiver.role === "AM" ? 0.13 : receiver.role === "W" ? 0.10 : 0.08)
      + (inOrNearBox ? 0.10 : 0)
      + (distToGoal <= 12 ? 0.12 : distToGoal <= 16 ? 0.07 : 0.03)
      + (flight.arc >= 0.55 ? 0.04 : 0.015)
      - pressure * 0.05
      - contactGap * 0.04,
      0.22,
      0.58,
    );
    if (this.rng.next() >= firstTimeShotChance) return false;

    this.ballFlight = null;
    this.possession = receiver;
    this.rememberTouch(receiver);
    this.ball.pos.x = contact.x;
    this.ball.pos.y = this.ballGroundY() + Math.max(0.26, Math.min(0.58, flight.arc * 0.66));
    this.ball.pos.z = contact.z;
    this.recordShotOpportunity(receiver, distToGoal, pressure, firstTimeShotChance, "delivery_first_time_shot", {
      sourceAction: flight.sourceAction,
      compressedRuntime: true,
      contactGap: +contactGap.toFixed(2),
      ballHeight: +Math.max(0.26, Math.min(0.58, flight.arc * 0.66)).toFixed(2),
    });
    const goalEvent = this.resolveShot(receiver, distToGoal, pressure, {
      reason: "DELIVERY_FIRST_TIME_SHOT",
      style: flight.arc >= 0.55 ? "volley" : "first_time",
      minOnTargetChance: 0.24,
      details: {
        sourceAction: flight.sourceAction,
        compressedRuntime: true,
        firstTimeDeliveryShot: true,
        contactGap: +contactGap.toFixed(2),
        ballHeight: +Math.max(0.26, Math.min(0.58, flight.arc * 0.66)).toFixed(2),
      },
    });
    if (goalEvent) this.pendingFlightGoalEvent = goalEvent;
    return true;
  }

  private isDangerousDeliveryReception(flight: BallFlightState, player: SimplePlayer) {
    if (flight.sourceAction !== "cross" && flight.sourceAction !== "lofted_pass") return false;
    if (player.role === "GK") return false;
    const goal = goalCenterForAttack(this.attackSign(player.team));
    const distToGoal = dist2(player.pos, goal);
    return player.role === "ST"
      || player.role === "AM"
      || this.isInAttackingPenaltyAreaWithBuffer(player, 2.8)
      || this.isStrikerNearPenaltyArea(player, distToGoal)
      || (player.role === "W" && distToGoal <= 20)
      || (player.role === "CM" && distToGoal <= 18 && Math.abs(player.pos.z) <= FIELD_D * 0.22);
  }

  private isDangerousDeliveryTouch(player: SimplePlayer, flight: BallFlightState) {
    if (flight.sourceAction !== "cross" && flight.sourceAction !== "lofted_pass") return false;
    if (!flight.attackingTeam || flight.attackingTeam !== player.team) return false;
    if (flight.followPlayerId && flight.followPlayerId !== player.id) return false;
    if (flight.receiverId && flight.receiverId !== player.id) return false;
    return this.isDangerousDeliveryReception(flight, player);
  }

  private isDeliveryContinuationCarrier(carrier: SimplePlayer, distToGoal: number) {
    if (this.deliveryContinuationPlayerId !== carrier.id || this.deliveryContinuationRemaining <= 0) return false;
    if (carrier.role === "GK") return false;
    return this.isFinalThirdCarrier(carrier, distToGoal)
      || this.isInAttackingPenaltyAreaWithBuffer(carrier, 2.8)
      || this.isStrikerNearPenaltyArea(carrier, distToGoal);
  }

  private resolveAerialHeaderOnArrival(flight: BallFlightState) {
    if (!flight.headerEligible || flight.sourceAction === "header_clearance") return false;
    if (flight.kind !== "restart" && flight.arc < HEADER_MIN_ARC) return false;
    const attackingTeam = flight.attackingTeam
      || this.players.find((player) => player.id === flight.followPlayerId)?.team
      || null;
    if (!attackingTeam) return false;
    const contact = { x: flight.to.x, z: flight.to.z };
    const defendingTeam = otherTeam(attackingTeam);
    const receiver = flight.followPlayerId ? this.players.find((player) => player.id === flight.followPlayerId) || null : null;
    const attacker = receiver?.team === attackingTeam
      ? receiver
      : this.nearestTeamPlayer(attackingTeam, contact);
    const defender = this.nearestTeamPlayer(defendingTeam, contact);
    const attackerGap = attacker ? dist2(attacker.pos, contact) : Infinity;
    const defenderGap = defender ? dist2(defender.pos, contact) : Infinity;
    const attackerCanHead = !!attacker
      && attacker.role !== "GK"
      && attackerGap <= HEADER_CONTEST_RADIUS
      && this.isHeaderShotZone(attacker.team, contact);
    const defenderCanHead = !!defender
      && defender.role !== "GK"
      && defenderGap <= HEADER_CONTEST_RADIUS
      && this.isDefensiveHeaderZone(defender.team, contact);

    if (defender && defenderCanHead && (!attackerCanHead || defenderGap + 0.25 < attackerGap || this.rng.next() < 0.42)) {
      this.performHeaderClearance(defender, flight, contact, defenderGap);
      return true;
    }
    if (attacker && attackerCanHead) {
      const compressedDangerousDelivery = this.productionCompression() > 1.01
        && (flight.sourceAction === "cross" || flight.sourceAction === "lofted_pass")
        && !!receiver
        && receiver.id === attacker.id;
      const sourceBonus = flight.sourceAction === "corner" ? 0.18
        : flight.sourceAction === "cross" ? (compressedDangerousDelivery ? 0.26 : 0.12)
          : flight.sourceAction === "lofted_pass" ? (compressedDangerousDelivery ? 0.17 : 0.07)
            : flight.sourceAction === "throw_in" ? 0.04
              : 0;
      const shotChance = HEADER_SHOT_ATTEMPT_SCALE * clamp(
        0.52
        + sourceBonus
        + attacker.ratings.shooting * 0.12
        + (compressedDangerousDelivery ? 0.10 : 0)
        - attackerGap * 0.06,
        0.42,
        0.90,
      );
      if (this.rng.next() < shotChance) {
        this.performHeaderShot(attacker, flight, contact, attackerGap);
        return true;
      }
      this.performHeaderTouch(attacker, flight, contact, attackerGap);
      return true;
    }
    if (defender && defenderCanHead && this.rng.next() < 0.65) {
      this.performHeaderClearance(defender, flight, contact, defenderGap);
      return true;
    }
    if (defender && defenderCanHead) {
      this.performHeaderTouch(defender, flight, contact, defenderGap);
      return true;
    }
    const midfieldHeader = this.midfieldAerialHeaderTouch(flight, attacker, defender, attackerGap, defenderGap);
    if (midfieldHeader) {
      this.performHeaderTouch(midfieldHeader.player, flight, contact, midfieldHeader.contactGap);
      return true;
    }
    return false;
  }

  private midfieldAerialHeaderTouch(
    flight: BallFlightState,
    attacker: SimplePlayer | null,
    defender: SimplePlayer | null,
    attackerGap: number,
    defenderGap: number,
  ) {
    const source = flight.sourceAction || flight.kind;
    const touchChance =
      source === "goal_kick_long" || source === "drop_kick" ? 0.78 :
      source === "lofted_pass" ? 0.58 :
      source === "throw_in" ? 0.34 :
      0.22;
    if (this.rng.next() >= touchChance) return null;
    const candidates = [
      attacker && attacker.role !== "GK" && attackerGap <= HEADER_CONTEST_RADIUS + 0.55
        ? { player: attacker, contactGap: attackerGap }
        : null,
      defender && defender.role !== "GK" && defenderGap <= HEADER_CONTEST_RADIUS + 0.55
        ? { player: defender, contactGap: defenderGap }
        : null,
    ].filter((candidate): candidate is { player: SimplePlayer; contactGap: number } => !!candidate);
    if (!candidates.length) return null;
    candidates.sort((a, b) => a.contactGap - b.contactGap);
    if (candidates.length === 1) return candidates[0];
    if (candidates[1].contactGap + 0.35 < candidates[0].contactGap) return candidates[1];
    return candidates[0];
  }

  private isHeaderShotZone(team: SimpleTeamCode, pos: Vec2) {
    const goal = goalCenterForAttack(this.attackSign(team));
    return dist2(pos, goal) <= 15 && Math.abs(pos.z) <= PENALTY_HALF_Z + 2.5;
  }

  private isDefensiveHeaderZone(team: SimpleTeamCode, pos: Vec2) {
    const ownGoal = goalCenterForAttack((-this.attackSign(team)) as 1 | -1);
    return dist2(pos, ownGoal) <= 19 && Math.abs(pos.z) <= PENALTY_HALF_Z + 3.0;
  }

  private performHeaderShot(player: SimplePlayer, flight: BallFlightState, contact: Vec2, contactGap: number) {
    this.ballFlight = null;
    this.possession = player;
    this.rememberTouch(player);
    this.ball.pos.x = contact.x;
    this.ball.pos.y = this.ballGroundY() + Math.max(0.72, Math.min(1.05, flight.arc));
    this.ball.pos.z = contact.z;
    this.recordHeader(player, "shot", flight, contact, contactGap);
    this.addLiveEvent(player.team, "HEADER_SHOT", `${player.label} header`, {
      playerId: player.id,
      playerName: player.name,
      sourceAction: flight.sourceAction,
      contactPoint: { x: +contact.x.toFixed(2), z: +contact.z.toFixed(2) },
      ballHeight: +Math.max(0.72, Math.min(1.05, flight.arc)).toFixed(2),
    });
    const distToGoal = dist2(contact, goalCenterForAttack(this.attackSign(player.team)));
    const pressure = this.pressureOn(player);
    const headerGoalFit = this.setPieceHeaderGoalChanceMultiplier(player, flight);
    const compressedHeaderGoalMultiplier = this.productionCompression() <= 1.01
      ? 1
      : this.runtimeHalfDuration <= 150
        ? 0.62
        : this.runtimeHalfDuration <= 300
          ? 0.72
          : this.runtimeHalfDuration <= 900
            ? 0.86
            : 1;
    const headerGoalMultiplier = headerGoalFit.multiplier * compressedHeaderGoalMultiplier;
    const goalEvent = this.resolveShot(player, distToGoal, pressure, {
      reason: "HEADER_SHOT",
      style: "HEADER",
      launchHeight: this.ball.pos.y,
      minGoalChance: 0.08,
      goalChanceMultiplier: headerGoalMultiplier,
      details: {
        header: true,
        sourceAction: flight.sourceAction,
        ballHeight: +Math.max(0.72, Math.min(1.05, flight.arc)).toFixed(2),
        contactGap: +contactGap.toFixed(2),
        setPieceHeaderGoalMultiplier: headerGoalFit.multiplier,
        compressedHeaderGoalMultiplier,
        headerGoalMultiplier,
        setPieceHeaderDampReason: headerGoalFit.reason,
        recentCornerHeaderGoals: headerGoalFit.recentCornerHeaderGoals,
        teamCornerHeaderGoals: headerGoalFit.teamCornerHeaderGoals,
      },
    });
    if (goalEvent) this.pendingFlightGoalEvent = goalEvent;
  }

  private setPieceHeaderGoalChanceMultiplier(player: SimplePlayer, flight: BallFlightState) {
    if (flight.sourceAction !== "corner") {
      return {
        multiplier: 1,
        reason: "not_corner",
        recentCornerHeaderGoals: 0,
        teamCornerHeaderGoals: 0,
      };
    }
    const currentMinute = getMatchMinute(this.msm);
    const teamCornerHeaderGoals = this.goalLog.filter((goal) =>
      goal.team === player.team
      && goal.resolutionReason === "HEADER_SHOT"
      && goal.sourceAction === "corner"
    );
    const recentCornerHeaderGoals = teamCornerHeaderGoals.filter((goal) => {
      const goalMinute = Number(goal.matchMinute ?? currentMinute);
      return Number.isFinite(goalMinute) && Math.abs(currentMinute - goalMinute) <= 12;
    }).length;
    const matchScore = this.teamA.score + this.teamB.score;
    const minute = this.simulatedMatchMinute();
    let multiplier = 1;
    let reason = "clean_corner_header";
    if (recentCornerHeaderGoals >= 1 && minute < 20) {
      multiplier *= 0.38;
      reason = "early_repeat_corner_header_goal";
    } else if (recentCornerHeaderGoals >= 1) {
      multiplier *= 0.55;
      reason = "repeat_corner_header_goal";
    }
    if (recentCornerHeaderGoals >= 1 && minute < 10 && matchScore >= 2) {
      multiplier *= 0.75;
      reason = "early_set_piece_goal_cluster";
    }
    if (teamCornerHeaderGoals.length >= 2) {
      multiplier *= 0.82;
      reason = "team_corner_header_goal_load";
    }
    // Revert path: return 1 here if corner-header conversion becomes too cold.
    return {
      multiplier: clamp(+multiplier.toFixed(3), 0.22, 1),
      reason,
      recentCornerHeaderGoals,
      teamCornerHeaderGoals: teamCornerHeaderGoals.length,
    };
  }

  private performHeaderClearance(player: SimplePlayer, flight: BallFlightState, contact: Vec2, contactGap: number) {
    this.ballFlight = null;
    this.possession = null;
    this.lastCompletedPass = null;
    this.rememberTouch(player);
    const stats = this.team(player.team);
    stats.clearances += 1;
    player.stats.touches += 1;
    this.recordHeader(player, "clearance", flight, contact, contactGap);
    this.addLiveEvent(player.team, "HEADER_CLEARANCE", `${player.label} cleared`, {
      playerId: player.id,
      playerName: player.name,
      sourceAction: flight.sourceAction,
      contactPoint: { x: +contact.x.toFixed(2), z: +contact.z.toFixed(2) },
      ballHeight: +Math.max(0.72, Math.min(1.05, flight.arc)).toFixed(2),
    });
    this.recordEvent("CLEARANCE", player.team, player, {
      style: "HEADER",
      sourceAction: flight.sourceAction,
      contactGap: +contactGap.toFixed(2),
      x: +contact.x.toFixed(2),
      z: +contact.z.toFixed(2),
    });
    const attackSign = this.attackSign(player.team);
    const target = clampToPlayable({
      x: contact.x + attackSign * this.rng.range(16, 27),
      z: contact.z + this.rng.range(-10, 10),
    });
    this.ball.pos.x = contact.x;
    this.ball.pos.y = this.ballGroundY() + Math.max(0.72, Math.min(1.05, flight.arc));
    this.ball.pos.z = contact.z;
    this.startBallFlight("pass", contact, target, this.flightDuration(0.9), 0.55, undefined, {
      aerial: true,
      headerEligible: false,
      sourceAction: "header_clearance",
      attackingTeam: player.team,
      passerId: player.id,
      passerName: player.name,
    });
    this.actionTimer = Math.max(this.actionTimer, 0.45);
  }

  private performHeaderTouch(player: SimplePlayer, flight: BallFlightState, contact: Vec2, contactGap: number) {
    this.ballFlight = null;
    this.possession = player;
    this.rememberTouch(player);
    player.stats.touches += 1;
    this.ball.pos.x = contact.x;
    this.ball.pos.y = this.ballGroundY() + Math.max(0.68, Math.min(0.95, flight.arc));
    this.ball.pos.z = contact.z;
    this.recordHeader(player, "touch", flight, contact, contactGap);
    this.addLiveEvent(player.team, "HEADER_TOUCH", `${player.label} header`, {
      playerId: player.id,
      playerName: player.name,
      sourceAction: flight.sourceAction,
      contactPoint: { x: +contact.x.toFixed(2), z: +contact.z.toFixed(2) },
      ballHeight: +Math.max(0.68, Math.min(0.95, flight.arc)).toFixed(2),
    });
    const dangerousDeliveryTouch = this.productionCompression() > 1.01 && this.isDangerousDeliveryTouch(player, flight);
    if (dangerousDeliveryTouch) {
      this.deliveryContinuationPlayerId = player.id;
      this.deliveryContinuationRemaining = Math.max(this.deliveryContinuationRemaining, 1.25);
    }
    const quickFollow = dangerousDeliveryTouch
      ? 0.14
      : flight.sourceAction === "cross" || flight.sourceAction === "lofted_pass" ? 0.24 : 0.35;
    this.actionTimer = dangerousDeliveryTouch
      ? this.actionTimer > 0 ? Math.min(this.actionTimer, quickFollow) : quickFollow
      : Math.max(this.actionTimer, quickFollow);
  }

  private recordHeader(player: SimplePlayer, type: "shot" | "clearance" | "touch", flight: BallFlightState, contact: Vec2, contactGap: number) {
    const stats = this.team(player.team);
    stats.headers += 1;
    player.stats.headers += 1;
    if (type === "shot") {
      stats.headerShots += 1;
      player.stats.headerShots += 1;
    } else if (type === "clearance") {
      stats.headerClearances += 1;
      player.stats.headerClearances += 1;
    }
    const row = {
      seq: this.headerLog.length + 1,
      type,
      team: player.team,
      playerId: player.id,
      playerName: player.name,
      role: player.role,
      sourceAction: flight.sourceAction || flight.kind,
      minute: getMatchMinute(this.msm),
      half: this.msm.clock.half,
      elapsedInHalf: +this.msm.clock.elapsedInHalf.toFixed(2),
      ballHeight: +Math.max(0.72, Math.min(1.05, flight.arc)).toFixed(2),
      contactGap: +contactGap.toFixed(2),
      x: +contact.x.toFixed(2),
      z: +contact.z.toFixed(2),
    };
    this.headerLog.push(row);
    if (this.headerLog.length > 1000) this.headerLog.shift();
    this.recordEvent(type === "shot" ? "HEADER_SHOT" : type === "clearance" ? "HEADER_CLEARANCE" : "HEADER_TOUCH", player.team, player, row);
  }

  private goalNetVisualPending() {
    return !!this.ballFlight || this.goalNetSettleRemaining > 0;
  }

  private updateGoalScoredBall(dt: number) {
    const hadFlight = !!this.ballFlight;
    if (this.ballFlight) this.updateBallFlight(dt);
    if (hadFlight && !this.ballFlight) {
      this.goalNetSettleRemaining = Math.max(this.goalNetSettleRemaining, 1.5);
    }
    if (!this.ballFlight && this.goalNetSettleRemaining > 0) {
      this.goalNetSettleRemaining = Math.max(0, this.goalNetSettleRemaining - dt);
      this.ball.vel = { x: 0, z: 0 };
      this.ball.pos.y = this.ballGroundY();
    }
    return !this.ballFlight && this.goalNetSettleRemaining <= 0;
  }

  private updateTargets() {
    const protectedKeeper = this.keeperWithHandsPossession();
    const possessionCarrier = this.possession;
    const supportCarrierZone = possessionCarrier
      ? this.zoneForDist(dist2(possessionCarrier.pos, goalCenterForAttack(this.attackSign(possessionCarrier.team))))
      : null;
    const fiveMinuteContinuationDamping = this.runtimeHalfDuration > 150 && this.runtimeHalfDuration <= 300;
    const fifteenMinuteContinuationDamping = this.runtimeHalfDuration === 900;
    const compressedContinuationSupportPhase = this.productionCompression() > 1.01
      && !!possessionCarrier
      && possessionCarrier.role !== "GK"
      && (supportCarrierZone === "BUILDUP" || supportCarrierZone === "PROGRESSION");
    const fullLengthContinuationSupportPhase = this.fullLengthContinuationOutletPhase(possessionCarrier, supportCarrierZone || undefined);
    const continuationSupportPhase = compressedContinuationSupportPhase || fullLengthContinuationSupportPhase;
    for (const player of this.players) {
      const attackSign = this.attackSign(player.team);
      const ball = { x: this.ball.pos.x, z: this.ball.pos.z };
      const receivingFlight = this.ballFlight?.followPlayerId === player.id;
      const formationAnchor = this.ballZoneFormationAnchor(player);
      let target = formationAnchor.pos;
      let targetOwner = `formation_${formationAnchor.zone}`;
      if (this.possession?.id === player.id) {
        if (receivingFlight && this.ballFlight) {
          target = { ...this.ballFlight.to };
          targetOwner = "carrier_receive_flight";
        } else if (this.visualReceptionPlayerId === player.id && this.visualReceptionSettleRemaining > 0) {
          const goal = goalCenterForAttack(attackSign);
          const dir = normalize2({ x: goal.x - player.pos.x, z: goal.z - player.pos.z });
          const settleLead = Math.min(0.42, 0.18 + this.visualReceptionSettleRemaining * 0.35);
          target = {
            x: player.pos.x + dir.x * settleLead,
            z: player.pos.z + dir.z * settleLead,
          };
          targetOwner = "carrier_reception_settle";
        } else {
          const goal = goalCenterForAttack(attackSign);
          const dir = normalize2({ x: goal.x - player.pos.x, z: goal.z - player.pos.z });
          const lane = Math.sin(this.elapsedTotal * 0.8 + player.shirtNumber) * 1.8;
      const expansion = this.attackExpansionScale();
      if (player.role !== "GK" && this.isInAttackingPenaltyArea(player)) {
        target = this.penaltyAreaDecisionTarget(player);
        targetOwner = "carrier_box_attack";
      } else if (player.role === "ST" && this.isStrikerInShotPreparationZone(player)) {
        target = this.strikerShotPreparationTarget(player);
        targetOwner = "carrier_shot_prep";
      } else {
        target = { x: player.pos.x + dir.x * 8 * expansion, z: player.pos.z + dir.z * 5 * Math.min(expansion, 1.6) + lane };
        targetOwner = "carrier_drive";
      }
        }
      } else if (this.possession?.team === player.team) {
        const push = player.role === "ST" || player.role === "W" || player.role === "AM" ? 7 : 3;
        const expansion = this.attackExpansionScale();
        const lateralHomeBlend = player.role === "W" ? 0.98
          : player.role === "FB" ? 0.92
            : player.role === "AM" ? 0.88
              : 0.85;
        const lateralBallBlend = player.role === "W" ? 0.08
          : player.role === "FB" ? 0.12
            : player.role === "AM" ? 0.16
              : 0.18;
        target = {
          x: formationAnchor.pos.x + attackSign * clamp(ball.x * 0.18 + push * expansion, -8, 16),
          z: formationAnchor.pos.z * lateralHomeBlend + ball.z * lateralBallBlend,
        };
        targetOwner = "support_shape_attack";
        if (continuationSupportPhase && possessionCarrier) {
          const supportLane = compressedContinuationSupportPhase
            ? player.role === "CM" ? 1.6
              : player.role === "FB" ? 2.2
                : player.role === "W" ? 3.4
                  : player.role === "AM" ? 2.0
                    : player.role === "ST" ? 4.4
                      : 0.8
            : player.role === "CM" ? 1.6
              : player.role === "FB" ? 2.1
                : player.role === "W" ? 2.7
                : player.role === "AM" ? 1.9
                    : player.role === "ST" ? 3.3
                      : 0.85;
          const continuationBlend = compressedContinuationSupportPhase
            ? supportCarrierZone === "BUILDUP" ? 0.20 : 0.28
            : supportCarrierZone === "BUILDUP" ? 0.20 : 0.26;
          const supportLaneScale = fiveMinuteContinuationDamping && compressedContinuationSupportPhase ? 0.85
            : fifteenMinuteContinuationDamping && compressedContinuationSupportPhase ? 0.84
              : 1;
          const continuationBlendScale = fiveMinuteContinuationDamping && compressedContinuationSupportPhase ? 0.82
            : fifteenMinuteContinuationDamping && compressedContinuationSupportPhase ? 0.82
              : 1;
          const laneSign = Math.sign(player.homePos.z || 1);
          const supportTarget = {
            x: possessionCarrier.pos.x + attackSign * supportLane * supportLaneScale,
            z: lerpNumber(
              player.homePos.z,
              possessionCarrier.pos.z + laneSign * Math.max(1.8, Math.abs(player.homePos.z) * 0.34),
              continuationBlend * continuationBlendScale,
            ),
          };
          target = {
            x: lerpNumber(target.x, supportTarget.x, continuationBlend * continuationBlendScale),
            z: lerpNumber(target.z, supportTarget.z, continuationBlend * continuationBlendScale),
          };
          targetOwner = "support_continuation";
        }
        if (player.role === "W" || player.role === "FB") {
          const wideFloor = player.role === "W"
            ? Math.max(10.5, Math.abs(player.homePos.z) * 0.92)
            : Math.max(8.5, Math.abs(player.homePos.z) * 0.82);
          const wideSign = Math.sign(player.homePos.z || target.z || 1) || 1;
          const widened = wideSign * Math.max(wideFloor, Math.abs(target.z));
          target = { ...target, z: widened };
          targetOwner = "support_wide_lane_hold";
        }
        // The support blends above move a player only ~26% of the way from his
        // formation slot toward the ball, so nobody ever arrives -- the shape
        // drifts and the carrier is left picking from whoever happens to be
        // standing nearby. The two closest team-mates now actually come and
        // offer: a real angle, at passing range, away from the nearest marker.
        const offer = this.showForBallTarget(player, possessionCarrier, attackSign);
        if (offer) {
          target = offer;
          targetOwner = "support_show_for_ball";
        }
        target = this.constrainAttackingSupportToOffsideLine(player, target, ball);
      } else if (this.possession && player.team !== this.possession.team) {
        const nearest = this.nearestOpponent(this.possession, player.team);
        const ownGoal = goalCenterForAttack((-attackSign) as 1 | -1);
        const dangerDist = dist2(this.possession.pos, ownGoal);
        const dangerCollapse = dangerDist <= 22;
        const boxEmergency = dangerDist <= 17
          && Math.abs(this.possession.pos.z) <= PENALTY_HALF_Z + 3.5;
        const boxOccupancyEmergency = dangerDist <= 20
          && Math.abs(this.possession.pos.z) <= PENALTY_HALF_Z + 5.5
          && (this.isInAttackingPenaltyAreaWithBuffer(this.possession, 2.8)
            || this.isStrikerNearPenaltyArea(this.possession, dangerDist));
        const fifteenMinuteBoxOccupancyEmergency = this.runtimeHalfDuration === 900
          && boxOccupancyEmergency;
        const extraBoxBody = boxOccupancyEmergency
          && nearest?.id !== player.id
          && (player.role === "CB" || player.role === "FB" || player.role === "CM" || player.role === "DM");
        if (nearest?.id === player.id) {
          target = {
            x: ball.x - attackSign * (
              boxEmergency
                ? 0.30
                : fifteenMinuteBoxOccupancyEmergency
                  ? 0.34
                  : boxOccupancyEmergency
                    ? 0.42
                  : dangerCollapse ? 0.6 : 0.8
            ),
            z: lerpNumber(
              player.pos.z,
              ball.z,
              boxEmergency
                ? 0.93
                : fifteenMinuteBoxOccupancyEmergency
                  ? 0.91
                  : boxOccupancyEmergency
                    ? 0.87
                  : dangerCollapse ? 0.82 : 1,
            ),
          };
          targetOwner = boxEmergency
            ? "defend_ball_pressure_box"
            : boxOccupancyEmergency
              ? "defend_ball_pressure_collapse"
              : "defend_ball_pressure";
        } else {
          target = {
            x: player.homePos.x + attackSign * clamp(ball.x * (dangerCollapse ? 0.18 : 0.12), dangerCollapse ? -7 : -5, dangerCollapse ? 7 : 5),
            z: player.homePos.z * (dangerCollapse ? 0.62 : 0.75) + ball.z * (dangerCollapse ? 0.38 : 0.25),
          };
          targetOwner = dangerCollapse ? "defend_shape_collapse" : "defend_shape_shell";
          if (dangerCollapse && (player.role === "CB" || player.role === "FB" || player.role === "CM" || player.role === "DM")) {
            target = {
              x: lerpNumber(
                target.x,
                ball.x - attackSign * (
                  boxEmergency
                    ? player.role === "CB" ? 0.8 : 1.25
                    : fifteenMinuteBoxOccupancyEmergency
                      ? player.role === "CB" ? 0.92 : 1.28
                    : boxOccupancyEmergency
                      ? player.role === "CB" ? 1.0 : 1.45
                    : player.role === "CB" ? 1.1 : 1.7
                ),
                boxEmergency
                  ? player.role === "CB" ? 0.58 : 0.44
                  : fifteenMinuteBoxOccupancyEmergency
                    ? player.role === "CB" ? 0.56 : 0.43
                  : boxOccupancyEmergency
                    ? player.role === "CB" ? 0.50 : 0.39
                  : player.role === "CB" ? 0.42 : 0.30,
              ),
              z: lerpNumber(
                target.z,
                ball.z,
                boxEmergency
                  ? player.role === "CB" ? 0.62 : 0.46
                  : fifteenMinuteBoxOccupancyEmergency
                    ? player.role === "CB" ? 0.60 : 0.46
                  : boxOccupancyEmergency
                    ? player.role === "CB" ? 0.56 : 0.42
                  : player.role === "CB" ? 0.46 : 0.34,
              ),
            };
            targetOwner = boxEmergency ? "defend_box_emergency" : "defend_shape_collapse";
          }
          if (extraBoxBody) {
            target = {
              x: lerpNumber(
                target.x,
                ball.x - attackSign * (
                  fifteenMinuteBoxOccupancyEmergency
                    ? player.role === "CB" ? 0.92 : player.role === "CM" || player.role === "DM" ? 1.18 : 1.34
                    : player.role === "CB" ? 1.18 : player.role === "CM" || player.role === "DM" ? 1.55 : 1.72
                ),
                fifteenMinuteBoxOccupancyEmergency
                  ? player.role === "CB" ? 0.48 : 0.42
                  : player.role === "CB" ? 0.34 : 0.28,
              ),
              z: lerpNumber(
                target.z,
                ball.z,
                fifteenMinuteBoxOccupancyEmergency
                  ? player.role === "CB" ? 0.48 : 0.42
                  : player.role === "CB" ? 0.34 : 0.28,
              ),
            };
            targetOwner = "defend_extra_box_body";
          }
        }
      }
      if (player.role === "GK" && !receivingFlight) {
        const cover = this.keeperCoverTarget(player, attackSign, ball);
        target = cover.target;
        targetOwner = cover.owner;
      }
      if (protectedKeeper && player.team !== protectedKeeper.team) {
        target = this.keeperStandoffTarget(player, protectedKeeper, target);
        targetOwner = "keeper_hands_standoff";
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
        if (player.id !== this.possession?.id) {
          const kickoffAnchor = this.kickoffLegalPosition(player.homePos, player, player.id === this.kickoffKickerId);
          const laneReleaseProgress = clamp(releaseAge / KICKOFF_LANE_RELEASE_SECONDS, 0, 1);
          target.z = lerpNumber(kickoffAnchor.z, target.z, laneReleaseProgress);
        }
        targetOwner = "kickoff_shape_release";
      }
      player.targetPos = clampToPlayable(target);
      player.targetOwner = targetOwner;
    }
    this.applyManualControlTargets();
  }

  private ballZoneFormationAnchor(player: SimplePlayer) {
    const progress = this.ball.pos.x * this.attackSign(player.team);
    const zone = progress < -22 ? "defensive_third"
      : progress < -7 ? "build_up"
        : progress < 16 ? "midfield"
          : "final_third";
    const roleShift = zone === "defensive_third"
      ? player.role === "ST" ? -8 : player.role === "W" || player.role === "AM" ? -5 : player.role === "CM" || player.role === "DM" ? -3 : -1
      : zone === "build_up"
        ? player.role === "ST" || player.role === "W" ? -2 : 0
        : zone === "midfield"
          ? player.role === "ST" || player.role === "W" || player.role === "AM" ? 2 : player.role === "FB" ? 1 : 0
          : player.role === "ST" ? 5 : player.role === "W" || player.role === "AM" ? 4 : player.role === "FB" ? 2 : 1;
    const lateralScale = zone === "defensive_third" ? 0.9 : zone === "final_third" ? 1.08 : 1;
    return {
      zone,
      pos: clampToPlayable({
        x: player.homePos.x + this.attackSign(player.team) * roleShift,
        z: player.homePos.z * lateralScale,
      }),
    };
  }

  private applyManualControlTargets() {
    if (this.msm.state.kind !== "live_play") return;
    for (const team of ["A", "B"] as const) {
      const state = this.manualControl[team];
      if (!state.enabled) continue;
      const selected = this.manualSelectedPlayer(team);
      if (!selected) continue;
      const moveLen = Math.hypot(state.move.x, state.move.z);
      if (moveLen <= 0.05) {
        selected.targetPos = clampToPlayable({ x: selected.pos.x, z: selected.pos.z });
      } else {
        const scale = 6 / moveLen;
        selected.targetPos = clampToPlayable({
          x: selected.pos.x + state.move.x * scale,
          z: selected.pos.z + state.move.z * scale,
        });
      }
      selected.targetOwner = "manual_control";
    }
  }

  private keeperWithHandsPossession() {
    if (this.msm.state.kind !== "live_play") return null;
    if (this.ballFlight) return null;
    if (!this.possession || this.possession.role !== "GK") return null;
    return this.possession;
  }

  private keeperStandoffTarget(player: SimplePlayer, keeper: SimplePlayer, proposed: Vec2) {
    const targetGap = dist2(proposed, keeper.pos);
    const currentGap = dist2(player.pos, keeper.pos);
    if (targetGap >= KEEPER_HANDS_STANDOFF_RADIUS && currentGap >= KEEPER_HANDS_STANDOFF_RADIUS) return proposed;
    const source = targetGap > 0.05 ? proposed : player.pos;
    let away = { x: source.x - keeper.pos.x, z: source.z - keeper.pos.z };
    if (Math.hypot(away.x, away.z) < 0.05) {
      away = {
        x: -this.attackSign(keeper.team),
        z: Math.sign(player.homePos.z - keeper.pos.z || player.shirtNumber - 6) || 1,
      };
    }
    const dir = normalize2(away);
    return clampToPlayable({
      x: keeper.pos.x + dir.x * KEEPER_HANDS_STANDOFF_TARGET_RADIUS,
      z: keeper.pos.z + dir.z * KEEPER_HANDS_STANDOFF_TARGET_RADIUS,
    });
  }

  private constrainAttackingSupportToOffsideLine(player: SimplePlayer, target: Vec2, ball: Vec2) {
    if (player.role === "GK") return target;
    if (!["ST", "W", "AM", "CM"].includes(player.role)) return target;
    const attackSign = this.attackSign(player.team);
    const maxOnsideX = this.attackingOffsideHoldX(player.team, ball);
    if (maxOnsideX == null) return target;
    const targetNorm = target.x * attackSign;
    const maxNorm = maxOnsideX * attackSign;
    if (targetNorm <= maxNorm) return target;
    return { ...target, x: maxOnsideX };
  }

  private attackingOffsideHoldX(team: SimpleTeamCode, ball: Vec2) {
    const attackSign = this.attackSign(team);
    const defenders = this.players
      .filter((player) => player.team === otherTeam(team))
      .map((player) => player.pos.x * attackSign)
      .sort((a, b) => b - a);
    const secondLastDefenderX = defenders[1];
    if (!Number.isFinite(secondLastDefenderX)) return null;
    const ballX = ball.x * attackSign;
    const offsideLine = Math.max(ballX, secondLastDefenderX);
    if (offsideLine <= 0) return null;
    return (offsideLine - OFFSIDE_SUPPORT_HOLD_BUFFER) * attackSign;
  }

  /**
   * Arcade bump plus sprint, both applied only to the player a human is
   * actually driving. CPU players stay on the calibrated baseline so the MLS
   * KPI envelope is unaffected.
   */
  private manualSpeedMultiplier(player: SimplePlayer) {
    const state = this.manualControl[player.team];
    if (!state.enabled || state.selectedPlayerId !== player.id) return 1;
    return MANUAL_CONTROL_SPEED_MULTIPLIER * (state.sprinting ? SPRINT_MULTIPLIER : 1);
  }

  /**
   * How hard a player should be working, as a share of their top speed.
   *
   * Everyone used to accelerate to playerMaxSpeed toward their target whatever
   * the distance or the urgency, so a player was either standing on their mark
   * or flat out. Against the Metrica tracking data that put the model at 40% of
   * player-frames sprinting where real football is 2%, with no jogging middle
   * at all -- which is why the game read as static and frantic at once.
   *
   * targetOwner already says what each player is doing, so pace off that.
   */
  private pacingFraction(player: SimplePlayer, gapToTarget: number) {
    // A person on the pad sets their own pace with the sprint button.
    if (this.manualControl[player.team].enabled && this.manualSelectedPlayer(player.team)?.id === player.id) return 1;
    // The keeper already matched the real 0.75 m/s before any pacing, because
    // his target barely moves. Pacing him on top of that halved it.
    if (player.role === "GK") return 1;
    const owner = player.targetOwner || "";
    let pace = PACE_JOG;
    if (owner.startsWith("defend_ball_pressure") || owner === "defend_box_emergency" || owner === "defend_shape_collapse") pace = PACE_SPRINT;
    else if (owner === "carrier_receive_flight" || owner === "carrier_box_attack") pace = PACE_SPRINT;
    else if (owner === "defend_extra_box_body" || owner === "carrier_drive") pace = PACE_RUN;
    // Coming to offer for the ball is a jog, not a sprint; it is 11% of all
    // off-ball time and at run pace it fattened the running band on its own.
    else if (owner === "support_show_for_ball") pace = PACE_JOG;
    // Holding a shape is walking work: the defensive shell alone is a third of
    // all off-ball time, and leaving it on the jog default is most of why the
    // model could not get its walking share up to the real 53%.
    else if (owner === "carrier_reception_settle" || owner === "support_wide_lane_hold" || owner === "home_anchor") pace = PACE_WALK;
    else if (owner === "defend_shape_shell") pace = PACE_WALK;
    else if (owner.startsWith("formation_") || owner.startsWith("keeper_")) pace = PACE_WALK;
    else if (owner === "manual_control") pace = PACE_SPRINT;
    // Out of position is its own urgency: you hustle back rather than stroll,
    // and without this a walking pace never recovers a broken shape.
    if (gapToTarget > PACE_HUSTLE_GAP) pace = Math.max(pace, PACE_RUN);
    else if (gapToTarget > PACE_JOG_GAP) pace = Math.max(pace, PACE_JOG);
    return pace;
  }

  private playerMaxSpeed(player: SimplePlayer, movementSpeedMultiplier: number) {
    return BASE_RUN_SPEED
      * (0.42 + player.ratings.pace * 0.58)
      * movementSpeedMultiplier
      * this.manualSpeedMultiplier(player);
  }

  /**
   * How far outside the lines this player may stand.
   *
   * Only the active corner/throw-in taker gets any: the laws put them behind
   * the line, and the interior clamp otherwise drags them to the pitch side of
   * the ball so they appear to take the corner from the wrong side.
   */
  private playableOutsideAllowance(player: SimplePlayer) {
    const restart = this.restartContext;
    if (!restart || restart.takerId !== player.id) return 0;
    return restart.restartType === "corner" || restart.restartType === "throw_in"
      ? RESTART_TAKER_OUTSIDE_ALLOWANCE
      : 0;
  }

  private movePlayers(dt: number, speedMultiplier = 1) {
    const tickStart = new Map(this.players.map((player) => [player.id, { x: player.pos.x, z: player.pos.z }]));
    const movementSpeedMultiplier = Math.max(0, speedMultiplier);
    for (const player of this.players) {
      const target = player.targetPos;
      const dx = target.x - player.pos.x;
      const dz = target.z - player.pos.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      const maxSpeed = this.playerMaxSpeed(player, movementSpeedMultiplier) * this.pacingFraction(player, len);
      const oldX = player.pos.x;
      const oldZ = player.pos.z;
      if (len > 0.001) {
        const dirX = dx / len;
        const dirZ = dz / len;
        const currentSpeedTowardTarget = Math.max(0, player.vel.x * dirX + player.vel.z * dirZ);
        const manualSelected = this.manualControl[player.team].enabled && this.manualSelectedPlayer(player.team)?.id === player.id;
        const acceleration = PLAYER_ACCELERATION * (manualSelected ? MANUAL_CONTROL_ACCELERATION_MULTIPLIER : 1);
        const speed = Math.min(maxSpeed, currentSpeedTowardTarget + acceleration * dt);
        const step = Math.min(len, speed * dt);
        if (step >= len) {
          player.pos.x = target.x;
          player.pos.z = target.z;
        } else if (speed > 0.001) {
          player.pos.x += dirX * step;
          player.pos.z += dirZ * step;
        }
        const clamped = clampToPlayable(player.pos, this.playableOutsideAllowance(player));
        player.pos.x = clamped.x;
        player.pos.z = clamped.z;
      } else {
        player.vel = { x: 0, z: 0 };
        continue;
      }
      player.vel = { x: (player.pos.x - oldX) / dt, z: (player.pos.z - oldZ) / dt };
      player.stats.distance += Math.sqrt((player.pos.x - oldX) ** 2 + (player.pos.z - oldZ) ** 2);
    }
    const skipCap = this.playersNeedImmediateOverlapRecovery();
    this.resolvePlayerCollisions();
    if (!skipCap) this.capTickPlayerDisplacements(tickStart, dt, movementSpeedMultiplier);
    for (const player of this.players) {
      const clamped = clampToPlayable(player.pos, this.playableOutsideAllowance(player));
      player.pos.x = clamped.x;
      player.pos.z = clamped.z;
    }
  }

  private playersNeedImmediateOverlapRecovery() {
    const recoveryDistanceSq = 0.05 * 0.05;
    for (let i = 0; i < this.players.length; i++) {
      const a = this.players[i];
      for (let j = i + 1; j < this.players.length; j++) {
        const b = this.players[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const aParked = dist2(a.pos, a.targetPos) < 0.001;
        const bParked = dist2(b.pos, b.targetPos) < 0.001;
        if (aParked && bParked && dx * dx + dz * dz < recoveryDistanceSq) return true;
      }
    }
    return false;
  }

  private capTickPlayerDisplacements(startPositions: Map<string, Vec2>, dt: number, speedMultiplier = 1) {
    for (const player of this.players) {
      const start = startPositions.get(player.id);
      if (!start) continue;
      // Anti-teleport guard, not a speed governor. It used to be a flat
      // BASE_RUN_SPEED * 0.93 for everyone, which throttled quick players below
      // their own top speed and would have eaten the sprint boost entirely.
      const maxVisualStep = this.playerMaxSpeed(player, Math.max(0, speedMultiplier))
        * PLAYER_DISPLACEMENT_CAP_TOLERANCE
        * Math.max(0, dt);
      const dx = player.pos.x - start.x;
      const dz = player.pos.z - start.z;
      const moved = Math.hypot(dx, dz);
      if (moved <= maxVisualStep || moved <= 0.0001) continue;
      const scale = maxVisualStep / moved;
      player.pos.x = start.x + dx * scale;
      player.pos.z = start.z + dz * scale;
      player.vel = { x: (player.pos.x - start.x) / dt, z: (player.pos.z - start.z) / dt };
    }
  }

  private resolvePlayerCollisions() {
    const minDistance = PLAYER_MIN_SEPARATION;
    const minDistanceSq = minDistance * minDistance;
    for (let iteration = 0; iteration < 4; iteration++) {
      let corrected = false;
      for (let i = 0; i < this.players.length; i++) {
        const a = this.players[i];
        for (let j = i + 1; j < this.players.length; j++) {
          const b = this.players[j];
          const dx = b.pos.x - a.pos.x;
          const dz = b.pos.z - a.pos.z;
          const distanceSq = dx * dx + dz * dz;
          if (distanceSq >= minDistanceSq) continue;

          const distance = Math.sqrt(distanceSq);
          let nx = 1;
          let nz = 0;
          if (distance > 0.0001) {
            nx = dx / distance;
            nz = dz / distance;
          } else {
            const angle = ((i + 1) * 2.399963 + (j + 1) * 0.917) % (Math.PI * 2);
            nx = Math.cos(angle);
            nz = Math.sin(angle);
          }

          const push = (minDistance - distance) * 0.5;
          a.pos.x -= nx * push;
          a.pos.z -= nz * push;
          b.pos.x += nx * push;
          b.pos.z += nz * push;

          const clampedA = clampToPlayable(a.pos, this.playableOutsideAllowance(a));
          const clampedB = clampToPlayable(b.pos, this.playableOutsideAllowance(b));
          a.pos.x = clampedA.x;
          a.pos.z = clampedA.z;
          b.pos.x = clampedB.x;
          b.pos.z = clampedB.z;
          corrected = true;
        }
      }
      if (!corrected) return;
    }
  }

  private resolvePass(carrier: SimplePlayer, pressure: number, options: PassTargetOptions = {}) {
    this.finalizeActiveReceptionTelemetryForPlayer(carrier, "pass");
    const target = this.bestPassTarget(carrier, options);
    if (!target) {
      this.recordFullLengthPossessionDiagnostic("no_safe_outlet_pass_fail", carrier, {
        pressure: +pressure.toFixed(2),
        reason: options.reason || "GENERIC_PASS",
      });
      return false;
    }
    this.rememberTouch(carrier);
    const origin = { x: carrier.pos.x, z: carrier.pos.z };
    const distance = dist2(carrier.pos, target.pos);
    const progress = (target.pos.x - carrier.pos.x) * this.attackSign(carrier.team);
    const separation = this.nearestDefenderDistance(target, otherTeam(carrier.team));
    const offside = this.offsideInfraction(carrier, target, origin);
    if (offside) {
      this.resolveOffside(carrier, target, offside, origin);
      return true;
    }
    const passStyle = progress > 3 ? "FORWARD" : progress < -2 ? "BACK" : "LATERAL";
    const targetDistToGoal = dist2(target.pos, goalCenterForAttack(this.attackSign(carrier.team)));
    const carrierZone = this.zoneForDist(dist2(carrier.pos, goalCenterForAttack(this.attackSign(carrier.team))));
    const compressedContinuationCarrier = this.productionCompression() > 1.01
      && (carrierZone === "BUILDUP" || carrierZone === "PROGRESSION");
    const fiveMinuteContinuationRecovery = this.runtimeHalfDuration === 300;
    const fifteenMinuteContinuationDamping = this.runtimeHalfDuration === 900;
    const fullLengthContinuationCarrier = this.fullLengthContinuationOutletPhase(carrier, carrierZone);
    const fifteenMinuteContinuationDensityClamp = this.runtimeHalfDuration === 900
      && (compressedContinuationCarrier || fullLengthContinuationCarrier);
    const wideDelivery = this.isWideFinalThirdDelivery(carrier, target, progress, targetDistToGoal);
    const drivenCross = wideDelivery && this.rng.next() < 0.42;
    // A long ball only counted as aerial if it finished near the goal, so every
    // raking pass into midfield arrived on the deck and could never be
    // contested in the air. headerEligible follows aerialDelivery, and
    // resolveAerialHeaderOnArrival is gated on it, which is why 92% of arriving
    // flights were never even considered for a header.
    const longBallForward = passStyle === "FORWARD"
      && distance / FIELD_SCALE_PER_YARD >= LONG_BALL_AERIAL_YARDS
      && progress >= 10;
    const aerialDelivery = !!options.lofted || wideDelivery || longBallForward || (passStyle === "FORWARD"
      && distance / FIELD_SCALE_PER_YARD >= 24
      && progress >= 7
      && targetDistToGoal <= 16);
    const deliveryStyle = wideDelivery ? (drivenCross ? "DRIVEN" : "LONG_LOFTED") : null;
    // One arc for the whole delivery. It used to be computed only on the
    // completion path, so an intercepted or out-of-play lob was re-drawn with a
    // hardcoded flat arc and read as a knee-high pass.
    const passArc = wideDelivery
      ? (drivenCross ? 0.42 : LOFTED_PASS_ARC)
      : options.lofted
        ? MANUAL_LOB_ARC
        : aerialDelivery ? LOFTED_PASS_ARC : 0.32;
    const safeSupportPassBoost = !wideDelivery
      ? compressedContinuationCarrier && distance <= 13 && progress >= -1.5
        ? fifteenMinuteContinuationDamping
          ? 0.018
          : 0.03
        : fullLengthContinuationCarrier && distance <= 11.5 && progress >= -1
          ? 0.052
          : 0
      : 0;
    const fifteenMinuteSafeSupportBoost = !wideDelivery
      && fifteenMinuteContinuationDensityClamp
      && compressedContinuationCarrier
      && distance <= 12.5
      && progress >= -1.2
      && separation >= 2.6
      ? 0.012
      : 0;
    const fiveMinuteSafeCompletionBoost = !wideDelivery
      && fiveMinuteContinuationRecovery
      && compressedContinuationCarrier
      && distance <= 12
      && progress >= -1
      && separation >= 2.6
      ? 0.016
      : 0;
    const fullLengthMediumBandBoost = !wideDelivery
      && fullLengthContinuationCarrier
      && distance > 11.5
      && distance <= 18
      && progress >= -0.5
      && separation >= 2.4
      ? clamp((18 - distance) / 6, 0, 1) * 0.028
        + (separation >= 3.2 ? 0.026 : 0.014)
        + (target.role === "CM" || target.role === "FB" || target.role === "AM" ? 0.016 : 0)
      : 0;
    const fullLengthSafeMediumLongBoost = !wideDelivery
      && fullLengthContinuationCarrier
      && distance >= 16
      && distance <= 18
      && progress >= 3.5
      && separation >= 4.5
      ? 0.034 + (target.role === "CM" || target.role === "FB" || target.role === "AM" ? 0.016 : 0)
        + 0.012
      : 0;
    const fifteenMinuteSafeCompletionDamping = !wideDelivery
      && fifteenMinuteContinuationDensityClamp
      && distance <= 12.5
      && progress >= -0.5
      && separation >= 2.6
      ? 0.044
      : 0;
    const completionChance = clamp(
      0.832
        + (carrier.ratings.passing - 0.6) * 0.20
        - distance * 0.012
        - pressure * 0.075
        + separation * 0.018
        - Math.max(0, progress) * 0.003
        + safeSupportPassBoost
        + fifteenMinuteSafeSupportBoost
        + fiveMinuteSafeCompletionBoost
        + fullLengthMediumBandBoost
        + fullLengthSafeMediumLongBoost
        + (fullLengthContinuationCarrier ? 0.038 : 0)
        - fifteenMinuteSafeCompletionDamping
        - (wideDelivery ? (drivenCross ? 0.10 : 0.07) : 0),
      wideDelivery ? 0.26 : 0.34,
      0.855,
    );
    let complete = this.rng.next() < completionChance;
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
      completionChanceExact: +completionChance.toFixed(4),
      shouldPass: true,
      passStyle,
      aerialDelivery,
      realCross: wideDelivery,
      deliveryStyle,
      x: +carrier.pos.x.toFixed(2),
      z: +carrier.pos.z.toFixed(2),
      targetX: +target.pos.x.toFixed(2),
      targetZ: +target.pos.z.toFixed(2),
      receiver: target.name,
      receiverRole: target.role,
      to: target.name,
      toRole: target.role,
      carrierZone: this.zoneForDist(dist2(carrier.pos, goalCenterForAttack(this.attackSign(carrier.team)))),
      passContextReason: options.reason,
      forwardPreferred: !!options.preferForward,
      completed: complete,
      completionResolution: "standard",
      receiverRecoveryChance: 0,
    };
    this.passDecisions.push(decision);

    const finalizePassCompletion = (resolution: string) => {
      decision.completed = true;
      decision.completionResolution = resolution;
      stats.passesCompleted += 1;
      carrier.stats.passesCompleted += 1;
      target.stats.touches += 1;
      this.possession = target;
      this.rememberTouch(target);
      const groundPass = !wideDelivery && !aerialDelivery;
      // Two separate questions that used to share one flag. Leading the ball
      // into space is about where it lands; the short settle is about a receiver
      // who arrives at a run and carries it rather than stopping it dead. Tying
      // them together meant any attempt to lead more passes also stripped the
      // visible reception hold off them, which is what V74/V170/V221 caught.
      const leadReceiver = groundPass && distance >= PASS_LEAD_MIN_DISTANCE;
      const runsOntoPass = groundPass && distance >= LED_PASS_SHORT_SETTLE_DISTANCE;
      const landingPoint = this.passLandingPoint(origin, target.pos, distance, leadReceiver, target.ratings.pace);
      const settleSeconds = runsOntoPass ? 0.18 : this.visibleReceptionHoldSeconds();
      const flightSeconds = this.startBallFlight("pass", origin, landingPoint, this.flightDuration(clamp(distance / 24, 0.65, 1.25)), passArc, target, {
        aerial: aerialDelivery,
        headerEligible: aerialDelivery,
        settleSeconds,
        sourceAction: wideDelivery ? "cross" : aerialDelivery ? "lofted_pass" : "pass",
        attackingTeam: carrier.team,
        passerId: carrier.id,
        passerName: carrier.name,
        receiverId: target.id,
      });
      this.deferActionAfterReception(flightSeconds, settleSeconds);
      this.rememberCompletedPass(carrier, target);
      this.addLiveEvent(carrier.team, "PASS", `${carrier.label} to ${target.label}`);
      const event = this.recordEvent("PASS", carrier.team, carrier, {
        ...decision,
        target: target.name,
        outcome: "complete",
        progress,
      });
      this.passLog.push(event);
      if (wideDelivery) {
        this.recordWideDeliveryEvent(carrier, target, deliveryStyle, distance, aerialDelivery, progress, "complete");
      }
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
      return true;
    };

    if (complete) {
      return finalizePassCompletion("standard");
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
      this.startBallFlight("pass", origin, outTarget, this.flightDuration(clamp(distance / 24, 0.65, 1.25)), aerialDelivery ? passArc : 0.35);
      this.addLiveEvent(otherTeam(carrier.team), "THROW", `${carrier.label} pass ran out`);
      const event = this.recordEvent("TURNOVER", otherTeam(carrier.team), carrier, {
        passer: carrier.name,
        intendedTarget: target.name,
        outcome: "out_of_play",
        restartType: "throw_in",
        completionChance,
      });
      this.passLog.push(event);
      if (wideDelivery) this.recordWideDeliveryEvent(carrier, target, deliveryStyle, distance, aerialDelivery, progress, "out_of_play");
      return true;
    }

    const interceptor = this.nearestOpponent(target, otherTeam(carrier.team)) || target;
    const cutOutReach = dist2(interceptor.pos, target.pos);
    const safeMediumLongCutOutGate = fullLengthContinuationCarrier
      && !wideDelivery
      && distance >= 16
      && distance <= 18
      && progress >= 3
      && separation >= 4.2
      && cutOutReach >= 3.7;
    if (safeMediumLongCutOutGate) {
      decision.completionResolution = "reach_gate";
      return finalizePassCompletion("reach_gate");
    } else {
      this.possession = interceptor.team !== carrier.team ? interceptor : this.nearestTeamPlayer(otherTeam(carrier.team), target.pos);
      this.lastCompletedPass = null;
      if (this.possession) {
        this.rememberTouch(this.possession);
        this.possession.stats.interceptions += 1;
        this.possession.stats.touches += 1;
        const settleSeconds = this.visibleReceptionHoldSeconds();
        const flightSeconds = this.startBallFlight("interception", origin, this.possession.pos, this.flightDuration(clamp(distance / 24, 0.65, 1.3)), aerialDelivery ? passArc : 0.65, this.possession, {
          settleSeconds,
        });
        this.deferActionAfterReception(flightSeconds, settleSeconds);
        this.recordEvent("INTERCEPTION", this.possession.team, this.possession, {
          passer: carrier.name,
          intendedTarget: target.name,
          completionChance,
        });
      }
      this.addLiveEvent(otherTeam(carrier.team), "TURNOVER", `${target.label} pass cut out`);
      const event = this.recordEvent("TURNOVER", otherTeam(carrier.team), this.possession || carrier, {
        passer: carrier.name,
        intendedTarget: target.name,
        outcome: "interception",
        completionChance,
      });
      this.passLog.push(event);
      if (!wideDelivery && distance >= 16 && progress >= 4) {
        this.recordFullLengthPossessionDiagnostic("speculative_pass_interception", carrier, {
          pressure: +pressure.toFixed(2),
          distance: +distance.toFixed(2),
          receiverSeparation: +separation.toFixed(2),
          interceptorReach: +cutOutReach.toFixed(2),
          cutOutReachGate: safeMediumLongCutOutGate,
          progress: +progress.toFixed(2),
          targetRole: target.role,
          reason: options.reason || "GENERIC_PASS",
        });
      }
      if (wideDelivery) this.recordWideDeliveryEvent(carrier, target, deliveryStyle, distance, aerialDelivery, progress, "intercepted");
      return true;
    }
  }

  private recordWideDeliveryEvent(
    carrier: SimplePlayer,
    target: SimplePlayer,
    style: "DRIVEN" | "LONG_LOFTED" | null,
    distance: number,
    aerial: boolean,
    progress: number,
    outcome: "complete" | "out_of_play" | "intercepted",
  ) {
    this.recordEvent("PATTERN_CROSS_EXECUTED", carrier.team, carrier, {
      playName: "WIDE_DELIVERY",
      patternType: "WIDE_DELIVERY",
      passer: carrier.name,
      passerRole: carrier.role,
      target: target.name,
      targetRole: target.role,
      style,
      crossDist: +distance.toFixed(2),
      realCross: true,
      aerial,
      progress: +progress.toFixed(2),
      outcome,
    });
  }

  private executeKeeperDropKick(keeper: SimplePlayer, pressure: number) {
    this.finalizeActiveReceptionTelemetryForPlayer(keeper, "drop_kick");
    const origin = { x: this.ball.pos.x, z: this.ball.pos.z };
    const plan = this.dropKickPlan(keeper);
    const target = plan.receiver;
    if (!target) return;
    const distance = dist2(origin, target.pos);
    const progress = (target.pos.x - keeper.pos.x) * this.attackSign(keeper.team);
    const separation = this.nearestDefenderDistance(target, otherTeam(keeper.team));
    const longDropKick = plan.style === "drop_kick_long";
    const completionChance = clamp(
      (longDropKick ? 0.58 : 0.66)
        + keeper.ratings.passing * 0.12
        + separation * 0.010
        - Math.max(0, distance - 26) * 0.010
        - pressure * 0.050,
      longDropKick ? 0.38 : 0.46,
      longDropKick ? 0.70 : 0.78,
    );
    const complete = this.rng.next() < completionChance;
    const stats = this.team(keeper.team);
    stats.gkDistributions += 1;
    stats.passes += 1;
    keeper.stats.passes += 1;
    keeper.stats.touches += 1;
    const telemetry = {
      seq: ++this.keeperSeq,
      team: keeper.team,
      keeper: keeper.name,
      style: plan.style,
      completed: complete,
      distance: +distance.toFixed(2),
      target: target.name,
      completionChance: +completionChance.toFixed(2),
      contestDistance: plan.contestDistance === null || plan.contestDistance === undefined ? null : +plan.contestDistance.toFixed(2),
      targetMiddleThird: plan.targetMiddleThird,
      forcedLong: plan.forcedLong,
      noSafeShort: plan.noSafeShort,
    };
    this.lastKeeperKickTelemetry = telemetry;
    const releaseMeta = {
      phase: "release",
      restartType: "drop_kick",
      presentationKind: "drop_kick",
      presentationSeconds: 0.95,
      takerId: keeper.id,
      takerName: keeper.name,
      receiverId: target.id,
      receiverName: target.name,
      spot: { x: +origin.x.toFixed(2), z: +origin.z.toFixed(2) },
      targetPoint: { x: +target.pos.x.toFixed(2), z: +target.pos.z.toFixed(2) },
      distance: +distance.toFixed(2),
      completionChance: +completionChance.toFixed(2),
      completed: complete,
      dropKickStyle: plan.style,
      arcHeight: longDropKick ? GOAL_KICK_LONG_ARC : 0.82,
      aerial: true,
      headerEligible: true,
      contestDistance: plan.contestDistance === null || plan.contestDistance === undefined ? null : +plan.contestDistance.toFixed(2),
      targetMiddleThird: plan.targetMiddleThird,
      forcedLong: plan.forcedLong,
      noSafeShort: plan.noSafeShort,
    };
    this.addLiveEvent(keeper.team, "DROP_KICK", `${keeper.label} to ${target.label}`, releaseMeta);
    this.recordEvent("DROP_KICK", keeper.team, keeper, releaseMeta);

    if (complete) {
      stats.gkDistCompleted += 1;
      stats.passesCompleted += 1;
      keeper.stats.passesCompleted += 1;
      target.stats.touches += 1;
      this.possession = target;
      this.rememberTouch(target);
      const settleSeconds = this.visibleReceptionHoldSeconds();
      const flightSeconds = this.startBallFlight("pass", origin, target.pos, this.flightDuration(clamp(distance / 24, 0.85, 1.45)), longDropKick ? GOAL_KICK_LONG_ARC : 0.82, target, {
        aerial: true,
        headerEligible: true,
        settleSeconds,
        sourceAction: longDropKick ? "drop_kick_long" : "drop_kick",
        attackingTeam: keeper.team,
        passerId: keeper.id,
        passerName: keeper.name,
        receiverId: target.id,
      });
      this.deferActionAfterReception(flightSeconds, settleSeconds);
      const event = this.recordEvent("PASS", keeper.team, keeper, {
        ...releaseMeta,
        passer: keeper.name,
        target: target.name,
        outcome: "complete",
        passStyle: longDropKick ? "DROP_KICK_LONG" : "DROP_KICK",
        progress,
      });
      this.passLog.push(event);
      this.rememberCompletedPass(keeper, target);
      return;
    }

    const interceptor = this.nearestTeamPlayer(otherTeam(keeper.team), target.pos);
    this.possession = interceptor;
    this.lastCompletedPass = null;
    if (interceptor) {
      this.rememberTouch(interceptor);
      interceptor.stats.interceptions += 1;
      interceptor.stats.touches += 1;
      const settleSeconds = this.visibleReceptionHoldSeconds();
      const flightSeconds = this.startBallFlight("interception", origin, interceptor.pos, this.flightDuration(clamp(distance / 24, 0.85, 1.45)), longDropKick ? GOAL_KICK_LONG_ARC : 0.85, interceptor, {
        aerial: true,
        headerEligible: true,
        settleSeconds,
        sourceAction: longDropKick ? "drop_kick_long" : "drop_kick",
        attackingTeam: keeper.team,
        passerId: keeper.id,
        passerName: keeper.name,
        receiverId: interceptor.id,
      });
      this.deferActionAfterReception(flightSeconds, settleSeconds);
      this.recordEvent("INTERCEPTION", interceptor.team, interceptor, {
        passer: keeper.name,
        intendedTarget: target.name,
        sourceAction: longDropKick ? "drop_kick_long" : "drop_kick",
        completionChance,
      });
    }
    const event = this.recordEvent("TURNOVER", otherTeam(keeper.team), interceptor || keeper, {
      passer: keeper.name,
      intendedTarget: target.name,
      outcome: longDropKick ? "drop_kick_long_interception" : "drop_kick_interception",
      completionChance,
    });
    this.passLog.push(event);
  }

  private dropKickPlan(keeper: SimplePlayer): KeeperDropKickPlan {
    const origin = { x: this.ball.pos.x, z: this.ball.pos.z };
    const noSafeShort = !this.hasSafeShortKeeperOutlet(keeper.team, origin, keeper.id);
    const longOptions = this.keeperLongDistributionOptions(keeper.team, origin, keeper.id);
    if (noSafeShort && longOptions.length) {
      const selected = longOptions[0];
      return {
        receiver: selected.player,
        style: "drop_kick_long",
        contestDistance: selected.contestDistance,
        targetMiddleThird: selected.targetMiddleThird,
        forcedLong: true,
        noSafeShort,
      };
    }

    const maxDropKickDistance = 78 * FIELD_SCALE_PER_YARD;
    const roleScore = (player: SimplePlayer) => player.role === "ST" ? 5 : player.role === "W" ? 4 : player.role === "AM" ? 3 : player.role === "CM" ? 2 : 0;
    const attackSign = this.attackSign(keeper.team);
    const scored = this.players
      .filter((player) => player.team === keeper.team && player.role !== "GK")
      .map((player) => {
        const d = dist2(keeper.pos, player.pos);
        const progress = (player.pos.x - keeper.pos.x) * attackSign;
        const separation = this.nearestDefenderDistance(player, otherTeam(keeper.team));
        return {
          player,
          score: roleScore(player) * 4 + progress * 0.30 + separation * 0.35 - Math.abs(d - 32) * 0.12 + this.rng.range(-0.25, 0.25),
        };
      })
      .sort((a, b) => b.score - a.score);
    const candidates = scored.filter((candidate) => dist2(keeper.pos, candidate.player.pos) <= maxDropKickDistance);
    const selected = candidates[0]?.player || null;
    return {
      receiver: selected,
      style: "drop_kick",
      contestDistance: selected ? this.nearestOpponentDistance(selected.pos, keeper.team) : null,
      targetMiddleThird: selected ? Math.abs(selected.pos.x) <= FIELD_W / 6 + 5 : false,
      forcedLong: false,
      noSafeShort,
    };
  }

  private offsideInfraction(carrier: SimplePlayer, target: SimplePlayer, ballAtTouch: Vec2) {
    if (target.team !== carrier.team || target.role === "GK") return null;
    const attackSign = this.attackSign(carrier.team);
    const targetX = target.pos.x * attackSign;
    const ballX = ballAtTouch.x * attackSign;
    if (targetX <= 0) return null;
    if (targetX <= ballX + OFFSIDE_CLEAR_MARGIN) return null;

    const defenders = this.players
      .filter((player) => player.team === otherTeam(carrier.team))
      .map((player) => player.pos.x * attackSign)
      .sort((a, b) => b - a);
    const secondLastDefenderX = defenders[1] ?? defenders[0] ?? Infinity;
    const offsideLine = Math.max(ballX, secondLastDefenderX);
    if (targetX <= offsideLine + OFFSIDE_CLEAR_MARGIN) return null;
    return {
      attackSign,
      targetX,
      ballX,
      secondLastDefenderX,
      offsideLine,
      margin: targetX - offsideLine,
    };
  }

  private resolveOffside(carrier: SimplePlayer, target: SimplePlayer, offside: NonNullable<ReturnType<SimpleMatchModel["offsideInfraction"]>>, ballAtTouch: Vec2) {
    const defendingTeam = otherTeam(carrier.team);
    const restartSpot = clampToPlayable(ballAtTouch);
    const restartTaker = this.nearestTeamPlayer(defendingTeam, restartSpot) || this.players.find((player) => player.team === defendingTeam) || null;
    this.team(carrier.team).offsides += 1;
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
      restartSpot: { x: +restartSpot.x.toFixed(2), z: +restartSpot.z.toFixed(2) },
    });
    this.passLog.push(event);
    this.offsideTargetSelectionLockedUntil = this.elapsedTotal + OFFSIDE_TARGET_LOCK_SECONDS;
    this.stageFreeKickRestart(defendingTeam, restartSpot, carrier.team, carrier.id);
  }

  private resolveShot(
    carrier: SimplePlayer,
    distToGoal: number,
    pressure: number,
    context: ShotResolutionContext = {},
  ): GoalEvent | null {
    this.finalizeActiveReceptionTelemetryForPlayer(carrier, "shot");
    const carrierDistYards = (distToGoal / FIELD_W) * 120;
    if (!context.manual && !context.forceGoal && !context.forceOnTarget && context.reason !== "NO_SHOT_FINAL_WHISTLE" && context.reason !== "NO_SHOT_FULL_TIME_FALLBACK" && carrierDistYards > 36) {
      this.recordShotOpportunity(carrier, distToGoal, pressure, 0, "range_recycled", {
        reason: "LONG_SHOT_SUPPRESSED",
        distToGoalYards: +carrierDistYards.toFixed(1),
      });
      this.resolvePass(carrier, pressure);
      return null;
    }
    const teamStats = this.team(carrier.team);
    const defendingTeam = otherTeam(carrier.team);
    this.rememberTouch(carrier);
    this.recordFullLengthPossessionDiagnostic("non_danger_terminal_shot", carrier, {
      pressure: +pressure.toFixed(2),
      reason: context.reason || "NORMAL_SHOT",
      style: context.style || null,
    });
    const keeper = this.players.find((p) => p.team === defendingTeam && p.role === "GK");
    const shotOrigin = this.shotOriginForCarrier(carrier);
    const shotDistToGoal = dist2(shotOrigin, goalCenterForAttack(this.attackSign(carrier.team)));
    const shotDefense = this.shotDefenseSnapshot(carrier.team, shotOrigin, carrier);
    const shotDistToGoalYards = (shotDistToGoal / FIELD_W) * 120;
    const carrierBallGap = dist2(shotOrigin, carrier.pos);
    // Penalty from the real shooting angle, not raw lateral offset. Offset
    // alone treats z=5 at six units out (a tight ~40 degree angle with almost
    // no visible goal) the same as z=5 from thirty units out, where the angle
    // is trivial -- which is why shooting from wide close range converted
    // better than shooting from straight in front.
    // Lateral offset, not the true shooting angle. Deliberately left alone:
    // switching to atan2(lateral, distanceToGoal) is more correct in isolation
    // but it also feeds CPU shot selection, and doing so pushed total passes
    // and peak shots past their KPI ceilings. The angle problem the player
    // actually felt lives in the manual on-target floor below.
    const anglePenalty = Math.min(1, Math.abs(shotOrigin.z) / (FIELD_D * 0.42));
    const longRangeCentrality = shotDistToGoalYards > 22 ? clamp(1 - anglePenalty / 0.35, 0, 1) : 0;
    const fifteenMinuteLongShotSuppressed = this.runtimeHalfDuration === 900
      && !context.forceGoal
      && !context.forceOnTarget
      && context.reason !== "NO_SHOT_FINAL_WHISTLE"
      && context.reason !== "NO_SHOT_FULL_TIME_FALLBACK"
      && !this.isInAttackingPenaltyArea(carrier)
      && shotDistToGoalYards > 24
      && (pressure > 1 || anglePenalty > 0.16)
      && (longRangeCentrality > 0.3 || anglePenalty > 0.2);
    if (fifteenMinuteLongShotSuppressed && !context.manual) {
      this.recordShotOpportunity(carrier, distToGoal, pressure, 0, "range_recycled", {
        reason: "FIFTEEN_MINUTE_LONG_SHOT_SUPPRESSED",
        distToGoalYards: +shotDistToGoalYards.toFixed(1),
      });
      this.resolvePass(carrier, pressure);
      return null;
    }
    const fifteenMinuteLongRangeOffFramePenalty = this.runtimeHalfDuration === 900
      && shotDistToGoalYards > 20
      && !this.isInAttackingPenaltyArea(carrier)
      ? Math.max(0, shotDistToGoalYards - 20) * 0.006
        + longRangeCentrality * 0.012
        + clamp(pressure * 0.006, 0, 0.012)
      : 0;
    const longRangeOffFramePenalty = shotDistToGoalYards > 20
      ? Math.max(0, shotDistToGoalYards - 20) * 0.010
        + (shotDistToGoalYards > 24 ? Math.max(0, shotDistToGoalYards - 24) * 0.012 : 0)
        + clamp(1 - anglePenalty / 0.42, 0, 1) * 0.030
        + clamp(pressure * 0.010, 0, 0.020)
        + fifteenMinuteLongRangeOffFramePenalty
      : 0;
    const distanceOnTargetPenalty = Math.max(0, shotDistToGoalYards - 18) * 0.010
      + Math.max(0, shotDistToGoalYards - 22) * 0.007
      + longRangeCentrality * 0.025
      + (shotDistToGoalYards > 22 ? clamp(pressure * 0.012, 0, 0.02) : 0)
      + longRangeOffFramePenalty;
    const shotLoadOnTargetPenalty = Math.max(0, teamStats.shots - 18) * 0.006
      + Math.max(0, this.teamA.shots + this.teamB.shots - 36) * 0.004;
    const compressedOnTargetBoost = this.productionCompression() <= 1.01
      ? 0
      : this.runtimeHalfDuration <= 300
        ? 0.140
        : this.runtimeHalfDuration <= 900
          ? 0
          : 0.140;
    const rawOnTargetChance = SHOT_ON_TARGET_BASE + compressedOnTargetBoost - shotDistToGoal * 0.011 - distanceOnTargetPenalty - shotLoadOnTargetPenalty - anglePenalty * 0.20 - pressure * 0.055 + carrier.ratings.shooting * 0.10;
    // A human who aimed and pressed shoot is not taking a speculative punt.
    // The CPU model bottoms out around 0.08, which put ~93% of manual shots off
    // target and made every aimed shot fly diagonally wide.
    // Blasting it is less accurate than a placed side-foot.
    const chargePower = clamp(context.power ?? 1, MANUAL_CHARGE_MIN_POWER, MANUAL_CHARGE_MIN_POWER + MANUAL_CHARGE_POWER_SPAN);
    const powerAccuracyCost = context.manual ? Math.max(0, chargePower - 1.05) * 0.35 : 0;
    // The floor must respect the shooting angle. Without the anglePenalty term
    // it overrode the angle entirely, so a tight 40-degree shot from six units
    // out was *more* likely to be on target than one from straight in front --
    // which is why shooting from the corner was the most reliable way to score.
    const manualOnTargetFloor = context.manual
      ? clamp(
          0.82
            - shotDistToGoalYards * 0.012
            - pressure * 0.06
            - anglePenalty * 0.38
            + carrier.ratings.shooting * 0.10
            - powerAccuracyCost,
          0.20,
          0.93,
        )
      : 0;
    const onTargetChance = clamp(
      Math.max(rawOnTargetChance, context.minOnTargetChance ?? 0, manualOnTargetFloor),
      0.08,
      context.manual ? 0.93 : 0.68,
    );
    const onTarget = context.forceOnTarget || this.rng.next() < onTargetChance;
    teamStats.shots += 1;
    carrier.stats.shots += 1;
    carrier.stats.touches += 1;
    const style = context.style || (shotDistToGoal < 10 ? "placed" : pressure > 1.4 ? "first_time" : "driven");
    const decision = {
      seq: ++this.shotSeq,
      decisionType: "SIMPLE_V1",
      team: carrier.team,
      shooter: carrier.name,
      role: carrier.role,
      style,
      shouldShoot: true,
      distToGoal: +shotDistToGoal.toFixed(2),
      distToGoalYards: +shotDistToGoalYards.toFixed(1),
      carrierDistToGoal: +distToGoal.toFixed(2),
      carrierBallGap: +carrierBallGap.toFixed(2),
      closePressure: +pressure.toFixed(2),
      anglePenalty: +anglePenalty.toFixed(2),
      onTargetChance: +onTargetChance.toFixed(2),
      elapsedInHalf: this.msm.clock.elapsedInHalf,
      resolutionReason: context.reason || "NORMAL_SHOT",
      forcedByGeometry: !!context.forceGoal,
      ...shotDefense,
      ...context.details,
    };
    this.shotDecisions.push(decision);
    this.lastShotTelemetry = decision;
    const naturalWoodworkAllowed = !context.reason?.includes("FORCED");
    const woodwork = !onTarget
      && !context.forceGoal
      && !context.forceSave
      && (context.forceWoodwork || (naturalWoodworkAllowed && this.shouldHitWoodwork(shotDistToGoalYards, anglePenalty, pressure)));
    const woodworkTarget = woodwork ? this.woodworkTarget(carrier.team, context.forceWoodworkPart) : null;
    // Both goals face along x, so the goal mouth is parameterised purely by z:
    // the z part of the aim IS "where across the mouth". Do NOT rotate this
    // into a shot-relative frame -- that flips the lateral sign with the
    // attacking direction, so the same stick push aimed at opposite sides
    // after the half-time end swap.
    const aimLateral = (() => {
      const aim = context.aimDirection;
      if (!aim || Math.hypot(aim.x, aim.z) <= 0.2) return null;
      return clamp(aim.z, -1, 1);
    })();
    const shotTarget = woodworkTarget || this.shotTarget(carrier.team, onTarget, anglePenalty, aimLateral, !!context.manual);

    this.recordShotPositionSnapshot(carrier.team, carrier, shotOrigin, shotDefense);
    this.recordEvent("SHOT", carrier.team, carrier, {
      ...decision,
      onTarget,
    });
    this.addLiveEvent(carrier.team, "SHOT", `${carrier.label} ${style}`);

    if (woodwork) {
      const woodworkMeta = {
        shooter: carrier.name,
        framePart: woodworkTarget?.framePart || "crossbar",
        shotOrigin: { x: +shotOrigin.x.toFixed(2), z: +shotOrigin.z.toFixed(2) },
        shotTarget: { x: +shotTarget.x.toFixed(2), z: +shotTarget.z.toFixed(2) },
        distToGoalYards: +shotDistToGoalYards.toFixed(1),
        resolutionReason: context.reason || "WOODWORK_MISS",
      };
      this.recordEvent("WOODWORK", carrier.team, carrier, woodworkMeta);
      this.addLiveEvent(carrier.team, "WOODWORK", `${carrier.label} ${woodworkMeta.framePart}`, woodworkMeta);
      this.startBallFlight("miss", shotOrigin, shotTarget, this.flightDuration(clamp(shotDistToGoal / 34, 0.8, 1.45)), 0.95, undefined, { speedMultiplier: context.manual ? chargePower : 1, launchHeight: context.launchHeight });
      this.possession = null;
      return null;
    }

    if (!onTarget) {
      this.startBallFlight("miss", shotOrigin, shotTarget, this.flightDuration(clamp(shotDistToGoal / 34, 0.8, 1.45)), 1.4, undefined, { speedMultiplier: context.manual ? chargePower : 1, launchHeight: context.launchHeight });
      this.possession = null;
      return null;
    }

    teamStats.shotsOnTarget += 1;
    carrier.stats.shotsOnTarget += 1;
    this.recordEvent("SHOT_ON_TARGET", carrier.team, carrier, decision);
    const keeperQuality = keeper?.ratings.keeper ?? 0.62;
    const distToGoalYards = shotDistToGoalYards;
    const maxGoalDistanceYards = this.maxGoalDistanceYards(carrier.role, context);
    const invalidGoalGeometry = distToGoalYards > maxGoalDistanceYards;
    Object.assign(decision, {
      maxGoalDistanceYards,
      invalidGoalGeometry,
    });
    const matchScoreForGoal = this.teamA.score + this.teamB.score;
    const matchShotLoadForGoal = this.teamA.shots + this.teamB.shots;
    const scoreLoadGoalPenalty = Math.max(0, matchScoreForGoal - 4) * 0.035
      + Math.max(0, matchScoreForGoal - 5) * 0.055
      + Math.max(0, teamStats.score - 3) * 0.050
      + Math.max(0, matchShotLoadForGoal - 30) * 0.010;
    const highScoreGoalFloor = matchScoreForGoal >= 7 ? 0.004 : matchScoreForGoal >= 6 ? 0.012 : 0.030;
    const baseGoalChance = invalidGoalGeometry
      ? 0
      : clamp(0.500 - keeperQuality * 0.17 - shotDistToGoal * 0.0055 - Math.max(0, shotDistToGoalYards - 12) * 0.0055 - scoreLoadGoalPenalty - anglePenalty * 0.11 - pressure * 0.028 + carrier.ratings.shooting * 0.12, highScoreGoalFloor, 0.47);
    const compressedGoalChanceMultiplier = this.productionCompression() <= 1.01
      ? 1
      : this.runtimeHalfDuration <= 150
        ? 0.76
        : this.runtimeHalfDuration <= 300
          ? 0.84
          : this.runtimeHalfDuration <= 900
            ? 0.96
            : 1.08;
    const earlyBurst = this.earlyBurstGoalChanceMultiplier(matchScoreForGoal, teamStats.score, context);
    const earlyBurstGoalMultiplier = earlyBurst.multiplier;
    const lowScoreGoalMultiplier = this.lowScoreGoalChanceMultiplier(matchScoreForGoal, context);
    // Finishing uplift, but never against the anti-cluster dampers. Those exist
    // to stop goals arriving in bursts, so inflating a shot the model has
    // deliberately suppressed defeats the mechanism outright (V176, V181).
    const conversionDampingActive = earlyBurstGoalMultiplier < 1
      || lowScoreGoalMultiplier < 1
      || compressedGoalChanceMultiplier < 1
      // Set-piece header damping arrives through the caller's multiplier.
      || (context.goalChanceMultiplier ?? 1) < 1;
    const conversionScale = conversionDampingActive ? 1 : SHOT_CONVERSION_SCALE;
    const adjustedBaseGoalChance = baseGoalChance * conversionScale * compressedGoalChanceMultiplier * earlyBurstGoalMultiplier * lowScoreGoalMultiplier * (context.goalChanceMultiplier ?? 1);
    const forcedGoal = !!context.forceGoal && !invalidGoalGeometry;
    const highScoreMinGoalCap = matchScoreForGoal >= 7 ? 0.015 : matchScoreForGoal >= 6 ? 0.035 : Infinity;
    const minGoalChance = Math.min(context.minGoalChance ?? 0, highScoreMinGoalCap);
    const goalChance = forcedGoal ? 1 : Math.max(adjustedBaseGoalChance, invalidGoalGeometry ? 0 : minGoalChance);
    Object.assign(decision, {
      baseGoalChance: +baseGoalChance.toFixed(3),
      compressedGoalChanceMultiplier,
      earlyBurstGoalMultiplier,
      earlyBurstScoreMultiplier: earlyBurst.scoreMultiplier,
      earlyShotTempoMultiplier: earlyBurst.shotTempoMultiplier,
      lowScoreGoalMultiplier,
      goalChance: +goalChance.toFixed(3),
    });
    const saveGeometry = this.keeperSaveGeometry(keeper, shotOrigin, shotTarget, shotDistToGoalYards, pressure, style);
    const shotDefenseWithKeeper = this.shotDefenseSnapshot(carrier.team, shotOrigin, carrier, saveGeometry);
    Object.assign(decision, shotDefenseWithKeeper);
    let goal = context.forceSave || invalidGoalGeometry ? false : forcedGoal || this.rng.next() < goalChance;
    if (!goal && !context.forceSave && !invalidGoalGeometry && !saveGeometry.reachable) {
      goal = true;
      Object.assign(decision, {
        keeperReachable: false,
        keeperReachDistance: saveGeometry.reachDistance,
        keeperMaxReach: saveGeometry.maxReach,
      });
    }
    if (!goal) {
      const defending = this.team(defendingTeam);
      defending.saves += 1;
      if (keeper) keeper.stats.saves += 1;
      const saveTarget = keeper?.pos || shotTarget;
      const diveDirection = this.keeperDiveDirection(keeper, shotTarget);
      const keeperStart = keeper ? { x: +keeper.pos.x.toFixed(2), z: +keeper.pos.z.toFixed(2) } : null;
      const shouldCatch = !!keeper && saveGeometry.reachable && this.isKeeperCatchSave(shotTarget, shotDistToGoalYards, pressure);
      const shouldParry = !!keeper
        && saveGeometry.reachable
        && !shouldCatch
        && !context.forceSave
        && this.shouldParrySaveForCorner(shotTarget, shotDistToGoalYards, anglePenalty, pressure, keeperQuality);
      const saveOutcome = shouldParry ? "parry_corner" : "catch";
      const saveMeta = {
        diveDirection,
        keeperStart,
        saveOutcome,
        fieldResolved: true,
        contactSource: shouldParry ? "keeper_reachable_parry" : shouldCatch ? "keeper_catch" : "keeper_reachable_save",
        keeperReachable: saveGeometry.reachable,
        keeperReachDistance: saveGeometry.reachDistance,
        keeperMaxReach: saveGeometry.maxReach,
        contactPoint: saveGeometry.contactPoint,
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
      if (shouldParry) {
        const parryTarget = this.cornerParryTarget(carrier.team, shotTarget);
        this.rememberTouch(keeper);
        this.startBallFlight("save", shotOrigin, parryTarget, this.flightDuration(clamp(shotDistToGoal / 34, 0.75, 1.35)), 0.32, undefined, {
          sourceAction: "keeper_parry_corner",
          attackingTeam: carrier.team,
          contactSource: saveMeta.contactSource,
          contactPoint: saveMeta.contactPoint,
          keeperReachDistance: saveMeta.keeperReachDistance,
          keeperMaxReach: saveMeta.keeperMaxReach,
        });
        this.possession = null;
        return null;
      }
      if (dist2(shotOrigin, saveTarget) / FIELD_SCALE_PER_YARD >= 3) {
        this.startBallFlight("save", shotOrigin, saveTarget, this.flightDuration(clamp(shotDistToGoal / 34, 0.75, 1.35)), 1.1, keeper || undefined, { speedMultiplier: context.manual ? chargePower : 1, launchHeight: context.launchHeight });
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
    const netTarget = this.goalNetTarget(carrier.team, shotTarget);
    const goalRow = {
      team: carrier.team,
      playerName: carrier.name,
      scorer: carrier.name,
      shirtNumber: carrier.shirtNumber,
      role: carrier.role,
      matchMinute: getMatchMinute(this.msm),
      elapsedInHalf: this.msm.clock.elapsedInHalf,
      distToGoal: shotDistToGoal,
      distToGoalYards: +distToGoalYards.toFixed(1),
      carrierDistToGoal: +distToGoal.toFixed(2),
      carrierBallGap: +carrierBallGap.toFixed(2),
      maxGoalDistanceYards,
      invalidGoalGeometry,
      resolutionReason: context.reason || "NORMAL_SHOT",
      goalChance,
      shotTarget: { x: +shotTarget.x.toFixed(2), z: +shotTarget.z.toFixed(2) },
      netTarget: { x: +netTarget.x.toFixed(2), z: +netTarget.z.toFixed(2) },
      shotBacked: true,
      ...shotDefenseWithKeeper,
      ...context.details,
    };
    this.goalLog.push(goalRow);
    this.recordEvent("GOAL", carrier.team, carrier, goalRow);
    // Hold the announcement until the ball is actually in the net. A shot is
    // resolved the instant it is struck, but the ball then flies for up to a
    // few seconds -- announcing here called the goal well before it happened.
    this.pendingGoalAnnouncement = {
      team: carrier.team,
      detail: `${carrier.name} ${goalRow.matchMinute}'`,
      meta: {
        shotOrigin: { x: +shotOrigin.x.toFixed(2), z: +shotOrigin.z.toFixed(2) },
        shotTarget: { x: +shotTarget.x.toFixed(2), z: +shotTarget.z.toFixed(2) },
        netTarget: { x: +netTarget.x.toFixed(2), y: this.ballGroundY(), z: +netTarget.z.toFixed(2) },
      },
    };
    this.goalNetSettleRemaining = 0;
    this.goalKickoffSetupInstalled = false;
    // A harder strike gets there sooner.
    this.startBallFlight(
      "shot",
      shotOrigin,
      netTarget,
      this.flightDuration(clamp(shotDistToGoal / 34, 0.75, 1.4)),
      1.0,
      undefined,
      { speedMultiplier: context.manual ? chargePower : 1 },
    );
    this.possession = null;
    return { scoringTeam: teamSide(carrier.team) };
  }

  private shotOriginForCarrier(carrier: SimplePlayer): Vec2 {
    const visibleBall = { x: this.ball.pos.x, z: this.ball.pos.z };
    if (!this.ballFlight && this.possession?.id === carrier.id && dist2(visibleBall, carrier.pos) <= 2.15) {
      return visibleBall;
    }
    return { x: carrier.pos.x, z: carrier.pos.z };
  }

  private resolveTackleChance(carrier: SimplePlayer, pressure: number): GoalEvent | null {
    if (pressure < 1.2) return null;
    const chance = clamp((pressure - 1.1) * 0.08, 0, 0.18);
    if (this.rng.next() > chance) return null;
    const tackler = this.nearestOpponent(carrier, otherTeam(carrier.team));
    if (!tackler) return null;
    this.finalizeActiveReceptionTelemetryForPlayer(carrier, "tackle");
    this.possession = tackler;
    this.rememberTouch(tackler);
    this.startTackleRecoveryFlight(carrier, tackler);
    this.recordTackle(tackler, carrier, pressure, "PRESSURE_TACKLE");
    this.recordEvent("TURNOVER", tackler.team, tackler, {
      carrier: carrier.name,
      outcome: "tackle",
      pressure,
    });
    return null;
  }

  private resolvePressureDuel(carrier: SimplePlayer, pressure: number): boolean {
    if (carrier.role === "GK" || pressure < 0.25) return false;
    const defender = this.nearestOpponent(carrier, otherTeam(carrier.team));
    if (!defender) return false;
    const deliveryContinuation = this.isDeliveryContinuationCarrier(
      carrier,
      dist2(carrier.pos, goalCenterForAttack(this.attackSign(carrier.team))),
    );
    const foulChance = this.pressureFoulChance(defender, carrier, pressure);
    if (this.rng.next() < foulChance) {
      if (deliveryContinuation) {
        const distToGoal = dist2(carrier.pos, goalCenterForAttack(this.attackSign(carrier.team)));
        this.recordShotOpportunity(carrier, distToGoal, pressure, 0, "delivery_disrupted", {
          reason: "DELIVERY_CONTINUATION_PRESSURE_FOUL",
          compressedRuntime: this.productionCompression() > 1.01,
        });
      }
      this.resolveFoul(defender, carrier, pressure, "PRESSURE_FOUL");
      return true;
    }
    const tackleChance = clamp((pressure - 0.25) * 0.100 + defender.ratings.defense * 0.020, 0.015, 0.160);
    if (this.rng.next() >= tackleChance) return false;
    if (deliveryContinuation) {
      const distToGoal = dist2(carrier.pos, goalCenterForAttack(this.attackSign(carrier.team)));
      this.recordShotOpportunity(carrier, distToGoal, pressure, tackleChance, "delivery_disrupted", {
        reason: "DELIVERY_CONTINUATION_PRESSURE_DUEL",
        compressedRuntime: this.productionCompression() > 1.01,
      });
    }
    this.possession = defender;
    this.rememberTouch(defender);
    this.startTackleRecoveryFlight(carrier, defender);
    this.recordTackle(defender, carrier, pressure, "PRESSURE_DUEL");
    this.recordEvent("TURNOVER", defender.team, defender, {
      carrier: carrier.name,
      outcome: "tackle",
      pressure,
      reason: "PRESSURE_DUEL",
    });
    return true;
  }

  private pressureFoulChance(defender: SimplePlayer, carrier: SimplePlayer, pressure: number) {
    if (pressure < PRESSURE_FOUL_MIN_PRESSURE) return 0;
    const penaltyCandidate = this.isPenaltyFoul(defender, carrier);
    const rawChance = (pressure - PRESSURE_FOUL_MIN_PRESSURE) * 0.034 + (1 - defender.ratings.defense) * 0.006;
    const compression = this.productionCompression();
    const foulElapsedSeconds = compression > 1.01 ? this.elapsedTotal * this.matchClockScale : this.elapsedTotal;
    const foulRatePerMinute = (this.teamA.fouls + this.teamB.fouls) / Math.max(1, foulElapsedSeconds / 60);
    const foulLoadMultiplier = foulRatePerMinute > PRESSURE_FOUL_HARD_CAP_PER_MINUTE
      ? 0.35
      : foulRatePerMinute > PRESSURE_FOUL_SOFT_CAP_PER_MINUTE
        ? 0.65
        : 1;
    const zoneMultiplier = penaltyCandidate ? PRESSURE_PENALTY_FOUL_MULTIPLIER : 1;
    const compressedFoulMultiplier = penaltyCandidate || compression <= 1.01 ? 1 : clamp(1 + (Math.sqrt(compression) - 1) * 0.42, 1, 4.4);
    const maxChance = penaltyCandidate ? PRESSURE_PENALTY_FOUL_MAX_CHANCE : PRESSURE_FOUL_MAX_CHANCE * compressedFoulMultiplier;
    return clamp(rawChance * zoneMultiplier * foulLoadMultiplier * compressedFoulMultiplier, penaltyCandidate ? 0.0005 : 0.0022, maxChance);
  }

  private startTackleRecoveryFlight(carrier: SimplePlayer, defender: SimplePlayer) {
    defender.targetPos = { x: defender.pos.x, z: defender.pos.z };
    const origin = { x: this.ball.pos.x, z: this.ball.pos.z };
    const fallbackOrigin = dist2(origin, carrier.pos) <= 2.2 ? origin : { x: carrier.pos.x, z: carrier.pos.z };
    const distance = dist2(fallbackOrigin, defender.pos);
    const flightSeconds = this.startBallFlight(
      "interception",
      fallbackOrigin,
      defender.pos,
      this.flightDuration(clamp(distance / 18, 0.45, 0.85)),
      0.10,
      defender,
      { sourceAction: "tackle_recovery", receiverId: defender.id, settleSeconds: 0.25 },
    );
    this.deferActionAfterReception(flightSeconds, 0.25);
  }

  private recordTackle(tackler: SimplePlayer, carrier: SimplePlayer | null | undefined, pressure: number, reason: string) {
    this.team(tackler.team).tacklesWon += 1;
    tackler.stats.tackles += 1;
    tackler.stats.touches += 1;
    this.addLiveEvent(tackler.team, "TACKLE", `${tackler.label} won it`, {
      playerId: tackler.id,
      playerName: tackler.name,
      carrier: carrier?.name || null,
      pressure: +pressure.toFixed(2),
      reason,
    });
    this.recordEvent("TACKLE", tackler.team, tackler, {
      tackler: tackler.name,
      carrier: carrier?.name || null,
      pressure: +pressure.toFixed(2),
      reason,
    });
  }

  private recordFoul(committer: SimplePlayer, fouled: SimplePlayer, pressure: number, reason: string) {
    this.team(committer.team).fouls += 1;
    committer.stats.fouls += 1;
    fouled.stats.fouled += 1;
    this.addLiveEvent(committer.team, "FOUL", `${committer.label} foul`, {
      playerId: committer.id,
      playerName: committer.name,
      fouledPlayerId: fouled.id,
      fouledPlayerName: fouled.name,
      pressure: +pressure.toFixed(2),
      reason,
    });
    this.recordEvent("FOUL", committer.team, committer, {
      committer: committer.name,
      fouled: fouled.name,
      pressure: +pressure.toFixed(2),
      reason,
    });
  }

  private resolveFoul(committer: SimplePlayer, fouled: SimplePlayer, pressure: number, reason: string) {
    // Match option: with fouls off, contact simply does not stop play.
    if (!this.foulsEnabled) return false;
    this.finalizeActiveReceptionTelemetryForPlayer(fouled, "foul");
    this.recordFoul(committer, fouled, pressure, reason);
    if (this.isPenaltyFoul(committer, fouled)) {
      this.stagePenaltyRestart(fouled.team, committer.team, committer.id, fouled.id);
      return;
    }
    this.stageFreeKickRestart(fouled.team, fouled.pos, committer.team, committer.id);
  }

  private isPenaltyFoul(committer: SimplePlayer, fouled: SimplePlayer) {
    if (committer.team === fouled.team) return false;
    const defendingLeft = this.attackSign(committer.team) > 0;
    return isInPenaltyArea(committer.pos, defendingLeft) && isInPenaltyArea(fouled.pos, defendingLeft);
  }

  private stagePenaltyRestart(restartTeam: SimpleTeamCode, lastTouchTeam: SimpleTeamCode | null, lastTouchPlayerId: string | null, fouledPlayerId: string | null) {
    this.finalizeActiveReceptionTelemetryForPlayer(this.possession, "penalty_restart");
    const attackSign = this.attackSign(restartTeam);
    const spot = this.penaltySpotForAttack(attackSign);
    const restartSide = teamSide(restartTeam);
    this.pendingBallOutEvent = {
      restartType: "penalty",
      restartTeam: restartSide,
    };
    this.pendingBallOutContext = {
      restartType: "penalty",
      restartTeam,
      spot,
      lastTouchTeam,
      lastTouchPlayerId,
      crossedLine: "infraction",
      fouledPlayerId,
    };
    this.possession = null;
    this.ballFlight = null;
    this.lastCompletedPass = null;
    this.ball.pos = { x: spot.x, y: this.ballGroundY(), z: spot.z };
    this.ball.vel = { x: 0, z: 0 };
    this.actionTimer = Math.max(this.actionTimer, 0.75);
    if (this.msm.state.kind === "live_play") {
      this.msm.state = { kind: "ball_out", restartType: "penalty", restartTeam: restartSide };
      this.msm.restartTimer = 1.8;
      this.installBallOutRestart(this.pendingBallOutContext);
    }
  }

  private shouldParrySaveForCorner(shotTarget: Vec2, shotDistToGoalYards: number, anglePenalty: number, pressure: number, keeperQuality: number) {
    if (shotDistToGoalYards > 30) return false;
    const mouthEdge = clamp(Math.abs(shotTarget.z) / Math.max(0.1, GOAL_MOUTH_HALF_Z), 0, 1);
    const chance = clamp(0.88 + mouthEdge * 0.08 + anglePenalty * 0.04 + pressure * 0.012 - keeperQuality * 0.03, 0.82, 0.98);
    return this.rng.next() < chance;
  }

  /**
   * Where the keeper should stand.
   *
   * The old anchor parked him at a fixed 2.4u off his line and tracked only
   * 25% of the ball's z, which left him a mean 2.72u off the ball->goal line
   * (125% of a goal half-width) and barely moving at 0.74 units/sec. It also
   * had him drift *backwards* as an attacker closed, because the sweep step
   * scaled with distance-to-goal.
   *
   * Instead: stand on the line from the goal centre to the ball, which is what
   * covering the angle means, at a depth that peaks around the box edge and
   * drops as a shot becomes point-blank. Never past the ball itself.
   */
  private keeperCoverTarget(player: SimplePlayer, attackSign: 1 | -1, ball: Vec2) {
    const ownGoal = goalCenterForAttack((-attackSign) as 1 | -1);
    const threat = dist2(ball, ownGoal);
    // Depth off the goal line. High and sweeping when play is far away, furthest
    // out around the edge of the area to narrow the angle, then back towards the
    // line once the ball is close enough that reaction beats position.
    let depth: number;
    if (threat >= KEEPER_SWEEP_RANGE) depth = KEEPER_SWEEPER_DEPTH;
    else if (threat >= KEEPER_NARROW_RANGE) {
      const t = (threat - KEEPER_NARROW_RANGE) / (KEEPER_SWEEP_RANGE - KEEPER_NARROW_RANGE);
      depth = lerpNumber(KEEPER_NARROW_DEPTH, KEEPER_SWEEPER_DEPTH, t);
    } else if (threat >= KEEPER_SET_RANGE) {
      const t = (threat - KEEPER_SET_RANGE) / (KEEPER_NARROW_RANGE - KEEPER_SET_RANGE);
      depth = lerpNumber(KEEPER_SET_DEPTH, KEEPER_NARROW_DEPTH, t);
    } else depth = Math.max(KEEPER_LINE_DEPTH, threat * 0.34);
    // Never commit past the ball: that is how keepers get chipped.
    depth = Math.min(depth, Math.max(KEEPER_LINE_DEPTH, threat * KEEPER_MAX_COMMIT_FRACTION));
    const owner = threat >= KEEPER_NARROW_RANGE ? "keeper_sweep" : "keeper_cover_angle";
    if (threat < 0.2) return { target: { x: ownGoal.x + attackSign * depth, z: 0 }, owner };
    const t = depth / threat;
    return {
      target: {
        x: ownGoal.x + (ball.x - ownGoal.x) * t,
        // Stay in front of the mouth: chasing the ball to the touchline leaves
        // an empty net behind him.
        z: clamp(ball.z * t, -(GOAL_MOUTH_HALF_Z + KEEPER_POST_OVERLAP), GOAL_MOUTH_HALF_Z + KEEPER_POST_OVERLAP),
      },
      owner,
    };
  }

  private keeperSaveGeometry(
    keeper: SimplePlayer | undefined,
    shotOrigin: Vec2,
    shotTarget: Vec2,
    shotDistToGoalYards: number,
    pressure: number,
    shotStyle?: string,
  ) {
    if (!keeper) {
      return {
        reachable: false,
        reachDistance: null,
        maxReach: 0,
        contactPoint: { x: +shotTarget.x.toFixed(2), z: +shotTarget.z.toFixed(2) },
      };
    }
    const keeperQuality = keeper.ratings.keeper ?? 0.62;
    // The gap the keeper must actually cover: where the shot crosses his own
    // depth, not where it ends up. Measuring to the goal-line target made every
    // step off the line count against him, so narrowing the angle -- the whole
    // point of coming out -- read as worse positioning. Measuring to the flight
    // line as a whole went too far the other way and made the check inert.
    const shotSpanX = shotTarget.x - shotOrigin.x;
    const reachDistance = Math.abs(shotSpanX) < 0.5
      ? dist2(keeper.pos, shotTarget)
      : Math.abs(
        keeper.pos.z
        - (shotOrigin.z + (shotTarget.z - shotOrigin.z) * clamp((keeper.pos.x - shotOrigin.x) / shotSpanX, 0, 1)),
      );
    const reactionPenalty = Math.max(0, 9 - shotDistToGoalYards) * 0.055 + pressure * 0.035;
    const maxReach = (5.0 + keeperQuality * 2.2) * FIELD_SCALE_PER_YARD - reactionPenalty;
    const headerReachGrace = shotStyle === "HEADER"
      ? this.productionCompression() > 1.01
        ? 0.32
        : 0.22
      : 0;
    return {
      reachable: reachDistance <= maxReach + headerReachGrace,
      reachDistance: +reachDistance.toFixed(2),
      maxReach: +maxReach.toFixed(2),
      headerReachGrace: +headerReachGrace.toFixed(2),
      contactPoint: { x: +shotTarget.x.toFixed(2), z: +shotTarget.z.toFixed(2) },
      shotOrigin: { x: +shotOrigin.x.toFixed(2), z: +shotOrigin.z.toFixed(2) },
    };
  }

  private isKeeperCatchSave(shotTarget: Vec2, shotDistToGoalYards: number, pressure: number) {
    const centralTarget = Math.abs(shotTarget.z) <= GOAL_MOUTH_HALF_Z * 0.45;
    return centralTarget && shotDistToGoalYards <= 14 && pressure <= 1.4;
  }

  private cornerParryTarget(attackingTeam: SimpleTeamCode, shotTarget: Vec2): Vec2 {
    const attackSign = this.attackSign(attackingTeam);
    const goalLineX = attackSign > 0 ? RIGHT_GOAL_X : LEFT_GOAL_X;
    const zSign = Math.sign(shotTarget.z || this.rng.range(-1, 1)) || 1;
    return {
      x: goalLineX + attackSign * 1.15,
      z: clamp(zSign * this.rng.range(GOAL_MOUTH_HALF_Z + 1.0, PENALTY_HALF_Z + 1.5), -FIELD_D / 2 + 0.5, FIELD_D / 2 - 0.5),
    };
  }

  private penaltySpotForAttack(attackSign: 1 | -1): Vec2 {
    return {
      x: attackSign > 0 ? RIGHT_GOAL_X - PENALTY_SPOT_DIST : LEFT_GOAL_X + PENALTY_SPOT_DIST,
      z: 0,
    };
  }

  private stageFreeKickRestart(restartTeam: SimpleTeamCode, spot: Vec2, lastTouchTeam: SimpleTeamCode | null, lastTouchPlayerId: string | null) {
    this.finalizeActiveReceptionTelemetryForPlayer(this.possession, "free_kick_restart");
    const clampedSpot = clampToPlayable({
      x: clamp(spot.x, LEFT_GOAL_X + 0.8, RIGHT_GOAL_X - 0.8),
      z: clamp(spot.z, -FIELD_D / 2 + 0.8, FIELD_D / 2 - 0.8),
    });
    const restartSide = teamSide(restartTeam);
    this.pendingBallOutEvent = {
      restartType: "free_kick",
      restartTeam: restartSide,
    };
    this.pendingBallOutContext = {
      restartType: "free_kick",
      restartTeam,
      spot: clampedSpot,
      lastTouchTeam,
      lastTouchPlayerId,
      crossedLine: "infraction",
    };
    this.possession = null;
    this.ballFlight = null;
    this.lastCompletedPass = null;
    this.ball.pos = { x: clampedSpot.x, y: this.ballGroundY(), z: clampedSpot.z };
    this.ball.vel = { x: 0, z: 0 };
    this.actionTimer = Math.max(this.actionTimer, 0.75);
    if (this.msm.state.kind === "live_play") {
      this.msm.state = { kind: "ball_out", restartType: "free_kick", restartTeam: restartSide };
      this.msm.restartTimer = 1.5;
      this.installBallOutRestart(this.pendingBallOutContext);
    }
  }

  private totalShots() {
    return this.teamA.shots + this.teamB.shots;
  }

  private simulatedMatchMinute() {
    const halfDuration = Math.max(1, this.msm.clock.halfDuration);
    const totalElapsed = (this.msm.clock.half - 1) * halfDuration + this.msm.clock.elapsedInHalf;
    return clamp(totalElapsed / (halfDuration * 2), 0, 1) * 90;
  }

  private earlyBurstGoalChanceMultiplier(
    matchScore: number,
    teamScore: number,
    context: ShotResolutionContext,
  ) {
    if (context.forceGoal || context.reason === "OPEN_NET_FINISH" || context.reason === "PENALTY_KICK") {
      return { multiplier: 1, scoreMultiplier: 1, shotTempoMultiplier: 1 };
    }
    const minute = this.simulatedMatchMinute();
    if (minute >= 32) return { multiplier: 1, scoreMultiplier: 1, shotTempoMultiplier: 1 };

    let scoreMultiplier = 1;
    if (minute < 15) {
      if (matchScore >= 3) scoreMultiplier = 0.50;
    } else if (minute < 25) {
      if (matchScore >= 5) scoreMultiplier = 0.42;
      else if (matchScore >= 4) scoreMultiplier = 0.58;
      else if (matchScore >= 3) scoreMultiplier = 0.78;
    } else {
      if (matchScore >= 6) scoreMultiplier = 0.62;
      else if (matchScore >= 5) scoreMultiplier = 0.78;
    }
    if (teamScore >= 2 && minute < 25 && scoreMultiplier < 1) scoreMultiplier *= 0.92;

    const matchShots = this.teamA.shots + this.teamB.shots;
    const matchSot = this.teamA.shotsOnTarget + this.teamB.shotsOnTarget;
    const forcedBoxShot = context.reason === "STRIKER_PENALTY_AREA_FORCED_SHOT"
      || context.reason === "PENALTY_AREA_SHOT"
      || context.reason === "PENALTY_AREA_NO_OUTLET_SHOT"
      || context.reason === "GOALMOUTH_FINISH";
    let shotTempoMultiplier = 1;
    if (forcedBoxShot && minute < 10) {
      if (matchShots >= 14 || matchSot >= 7) shotTempoMultiplier = 0.42;
      else if (matchShots >= 10 || matchSot >= 5) shotTempoMultiplier = 0.55;
      else if (matchShots >= 8 || matchSot >= 4) shotTempoMultiplier = 0.55;
      else if (matchShots >= 6) shotTempoMultiplier = 0.82;
    } else if (forcedBoxShot && minute < 15) {
      if (matchShots >= 18 || matchSot >= 9) shotTempoMultiplier = 0.50;
      else if (matchShots >= 14 || matchSot >= 7) shotTempoMultiplier = 0.65;
      else if (matchShots >= 10 || matchSot >= 5) shotTempoMultiplier = 0.82;
    }

    scoreMultiplier = clamp(+scoreMultiplier.toFixed(3), 0.22, 1);
    shotTempoMultiplier = clamp(+shotTempoMultiplier.toFixed(3), 0.22, 1);
    return {
      multiplier: clamp(+(scoreMultiplier * shotTempoMultiplier).toFixed(3), 0.22, 1),
      scoreMultiplier,
      shotTempoMultiplier,
    };
  }

  private lowScoreGoalChanceMultiplier(matchScore: number, context: ShotResolutionContext) {
    if (context.forceGoal || context.reason === "OPEN_NET_FINISH" || context.reason === "PENALTY_KICK") return 1;
    const minute = this.simulatedMatchMinute();
    if (minute < 22) return 1;
    if (matchScore <= 0 && minute >= 30) return 1.34;
    if (matchScore <= 1 && minute >= 40) return 1.26;
    if (matchScore <= 2 && minute >= 60) return 1.16;
    return 1;
  }

  private shotDefenseSnapshot(
    attackingTeam: SimpleTeamCode,
    ball: Vec2,
    shooter?: SimplePlayer | null,
    keeperGeometry?: { reachable: boolean; reachDistance: number | null; maxReach: number },
  ): ShotDefenseSnapshot {
    const defendingTeam = otherTeam(attackingTeam);
    const attackSign = this.attackSign(attackingTeam);
    const defendingLeft = attackSign < 0;
    const goal = goalCenterForAttack(attackSign);
    const penaltyDepth = Math.abs(RIGHT_GOAL_X - RIGHT_PENALTY_X);
    const attackers = this.players.filter((player) => player.team === attackingTeam && player.role !== "GK");
    const defenders = this.players.filter((player) => player.team === defendingTeam && player.role !== "GK");
    const keeper = this.players.find((player) => player.team === defendingTeam && player.role === "GK") || null;
    const defendersInBox = defenders.filter((player) => isInPenaltyArea(player.pos, defendingLeft)).length;
    const attackersInBox = attackers.filter((player) => isInPenaltyArea(player.pos, defendingLeft)).length;
    const defendersInCorridor = defenders.filter((player) =>
      Math.abs(player.pos.x - goal.x) <= penaltyDepth + 3
      && Math.abs(player.pos.z) <= GOAL_MOUTH_HALF_Z * 2.5
    ).length;
    const nearestDefenderDistance = defenders.length
      ? Math.min(...defenders.map((player) => dist2(player.pos, ball)))
      : null;
    const keeperDistance = keeper ? dist2(keeper.pos, ball) : null;
    return {
      defendersInBox,
      attackersInBox,
      defendersInCorridor,
      outfieldBoxCrowd: defendersInBox + attackersInBox,
      nearestDefenderDistance: nearestDefenderDistance == null ? null : +nearestDefenderDistance.toFixed(2),
      keeperDistance: keeperDistance == null ? null : +keeperDistance.toFixed(2),
      ...(keeperGeometry ? {
        keeperReachable: keeperGeometry.reachable,
        keeperReachDistance: keeperGeometry.reachDistance == null ? null : +keeperGeometry.reachDistance.toFixed(2),
        keeperMaxReach: +keeperGeometry.maxReach.toFixed(2),
      } : {}),
      shooterId: shooter?.id,
      shooterName: shooter?.name,
      shooterRole: shooter?.role,
    } as ShotDefenseSnapshot;
  }

  private recordShotPositionSnapshot(
    attackingTeam: SimpleTeamCode,
    shooter: SimplePlayer,
    ball: Vec2,
    defense: ShotDefenseSnapshot,
  ) {
    this.recordEvent("SHOT_POSITION_SNAPSHOT", attackingTeam, shooter, {
      shooter: {
        id: shooter.id,
        name: shooter.name,
        role: shooter.role,
        x: +shooter.pos.x.toFixed(2),
        z: +shooter.pos.z.toFixed(2),
      },
      ball: { x: +ball.x.toFixed(2), z: +ball.z.toFixed(2) },
      players: this.players.map((player) => ({
        id: player.id,
        name: player.name,
        team: player.team,
        role: player.role,
        x: +player.pos.x.toFixed(2),
        z: +player.pos.z.toFixed(2),
      })),
      ...defense,
    });
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

  private shouldApplyCompressedShotFloor(carrier: SimplePlayer, distToGoal: number, forwardX: number) {
    if (this.productionCompression() <= 1.01) return false;
    if (this.msm.state.kind !== "live_play" || carrier.role === "GK") return false;
    if (this.ballFlight) return false;
    const totalShots = this.totalShots();
    if (totalShots >= 26) return false;
    const halfDuration = Math.max(1, this.msm.clock.halfDuration);
    const totalElapsed = (this.msm.clock.half - 1) * halfDuration + this.msm.clock.elapsedInHalf;
    const matchProgress = clamp(totalElapsed / (halfDuration * 2), 0, 1);
    if (this.runtimeHalfDuration <= 300) {
      if (matchProgress < 0.78) return false;
      if (totalShots >= 2) return false;
      const distYards = (distToGoal / FIELD_W) * 120;
      return distYards <= 26 && forwardX >= 3;
    }
    const runtimeScale = clamp((halfDuration * 2) / (45 * 60 * 2), 0.03, 1);
    const expectedFloor = 22 * runtimeScale * matchProgress;
    if (totalShots >= expectedFloor) return false;
    const distYards = (distToGoal / FIELD_W) * 120;
    const maxYards = matchProgress > 0.72 ? 34 : 30;
    return distYards <= maxYards && forwardX >= -5;
  }

  private shouldForceFinalNoShotAttempt(dt: number) {
    if (this.totalShots() > 0) return false;
    if (this.msm.state.kind !== "live_play" || this.msm.clock.half !== 2) return false;
    if (!this.possession || this.possession.role === "GK") return false;
    if (this.ballFlight && this.msm.clock.elapsedInHalf + dt < this.msm.clock.halfDuration + this.msm.clock.stoppageTime) return false;
    const halfLimit = this.msm.clock.halfDuration + this.msm.clock.stoppageTime;
    return this.msm.clock.elapsedInHalf + dt >= halfLimit;
  }

  private forceNoShotAttempt(reason: string): GoalEvent | null {
    const carrier = this.forceShotCarrier();
    if (!carrier) return null;
    this.possession = carrier;
    this.ballFlight = null;
    this.ball.pos.x = carrier.pos.x;
    this.ball.pos.y = this.ballGroundY();
    this.ball.pos.z = carrier.pos.z;
    const goal = goalCenterForAttack(this.attackSign(carrier.team));
    const distToGoal = dist2(carrier.pos, goal);
    const pressure = this.pressureOn(carrier);
    this.recordShotOpportunity(carrier, distToGoal, pressure, 1, "minimum_shot_floor", {
      reason,
      forcedAtClockEnd: reason === "NO_SHOT_FINAL_WHISTLE",
    });
    return this.resolveShot(carrier, distToGoal, pressure, {
      reason,
      style: distToGoal < 14 ? "driven" : "desperation",
      forceSave: reason === "NO_SHOT_FINAL_WHISTLE",
      goalChanceMultiplier: reason === "NO_SHOT_FINAL_WHISTLE" ? 0 : undefined,
      details: {
        forcedAtClockEnd: reason === "NO_SHOT_FINAL_WHISTLE",
      },
    });
  }

  private forceShotCarrier() {
    if (this.possession && this.possession.role !== "GK") return this.possession;
    const team = this.possession?.team || "A";
    const goal = goalCenterForAttack(this.attackSign(team));
    return this.players
      .filter((player) => player.team === team && player.role !== "GK")
      .sort((a, b) => dist2(a.pos, goal) - dist2(b.pos, goal))[0] || null;
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
      const homePos = clampToPlayable(orientSlot(slot, attackSign));
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
        targetOwner: "home_anchor",
        ratings: getRoleRatings(slot.role, stats.name, index),
        stats: createStats(),
      });
    });
  }

  private installKickoffPossession(team: SimpleTeamCode) {
    this.activeReceptionTelemetry = null;
    const attackSign = this.attackSign(team);
    for (const player of this.players) {
      const slot = getFormationSlots(this.team(player.team).formation)[Number(player.id.split("-")[1]) || 0];
      const homePos = clampToPlayable(orientSlot(slot, this.attackSign(player.team)));
      player.homePos = homePos;
      player.pos.x = homePos.x;
      player.pos.z = homePos.z;
      player.targetPos = { ...homePos };
      player.targetOwner = "home_anchor";
    }
    const starter =
      this.players.find((p) => p.team === team && p.role === "ST")
      || this.players.find((p) => p.team === team && p.role === "CM")
      || this.players.find((p) => p.team === team);
    if (starter) {
      starter.pos.x = 0;
      starter.pos.z = 0;
      this.possession = starter;
      this.ballFlight = null;
      this.ball.pos.x = 0;
      this.ball.pos.y = 0.18;
      this.ball.pos.z = 0;
    }
  }

  private installKickoffSetup(team: SimpleTeamCode, options: { snapPlayers?: boolean } = {}) {
    this.activeReceptionTelemetry = null;
    this.kickoffTeam = team;
    this.ballFlight = null;
    this.ball.pos.x = 0;
    this.ball.pos.y = this.ballGroundY();
    this.ball.pos.z = 0;
    this.ball.vel = { x: 0, z: 0 };
    const snapPlayers = options.snapPlayers ?? this.shouldSnapKickoffSetup();
    this.kickoffSetupMoving = !snapPlayers;

    const starter =
      this.players.find((p) => p.team === team && p.role === "ST")
      || this.players.find((p) => p.team === team && p.role === "CM")
      || this.players.find((p) => p.team === team);
    this.kickoffKickerId = starter?.id || null;
    this.kickoffReceiverId = starter ? this.preferredKickoffReceiver(team, starter.id)?.id || null : null;
    const kickoffLaneAssignments = new Map<SimpleTeamCode, Map<string, number>>([
      ["A", this.kickoffTeamLaneAssignments("A")],
      ["B", this.kickoffTeamLaneAssignments("B")],
    ]);

    for (const player of this.players) {
      const slot = getFormationSlots(this.team(player.team).formation)[Number(player.id.split("-")[1]) || 0];
      const homePos = clampToPlayable(orientSlot(slot, this.attackSign(player.team)));
      player.homePos = homePos;
      const kickoffPos = this.kickoffLegalPosition(
        homePos,
        player,
        player.id === this.kickoffKickerId,
        player.id === this.kickoffReceiverId,
      );
      const laneOverride = kickoffLaneAssignments.get(player.team)?.get(player.id);
      if (laneOverride !== undefined) kickoffPos.z = laneOverride;
      if (!snapPlayers) {
        const laneOffset = player.role === "GK" ? 2.8 : 1.5;
        kickoffPos.z = clamp(kickoffPos.z + (player.team === "A" ? laneOffset : -laneOffset), -FIELD_D / 2 + 1, FIELD_D / 2 - 1);
      }
      player.targetPos = { ...kickoffPos };
      player.targetOwner = "home_anchor";
      if (snapPlayers) {
        player.pos.x = kickoffPos.x;
        player.pos.z = kickoffPos.z;
        player.vel = { x: 0, z: 0 };
      }
    }

    this.resolveKickoffSetupOverlaps();
    if (snapPlayers) {
      for (const player of this.players) {
        player.pos.x = player.targetPos.x;
        player.pos.z = player.targetPos.z;
        player.vel = { x: 0, z: 0 };
      }
    }

    if (starter) {
      const starterPos = { x: 0, z: 0 };
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

  private resolveKickoffSetupOverlaps() {
    const minGap = 2.2;
    for (const team of ["A", "B"] as const) {
      const teamPlayers = this.players.filter((player) => player.team === team && player.role !== "GK");
      for (let iteration = 0; iteration < 4; iteration++) {
        let changed = false;
        for (let i = 0; i < teamPlayers.length; i++) {
          for (let j = i + 1; j < teamPlayers.length; j++) {
            const a = teamPlayers[i];
            const b = teamPlayers[j];
            if (a.id === this.kickoffKickerId || b.id === this.kickoffKickerId) continue;
            const gap = dist2(a.targetPos, b.targetPos);
            if (gap >= minGap) continue;
            const movable = this.kickoffOverlapMover(a, b);
            const fixed = movable.id === a.id ? b : a;
            const zSign = movable.homePos.z < -0.2 ? -1 : movable.homePos.z > 0.2 ? 1 : (movable.shirtNumber % 2 === 0 ? 1 : -1);
            const needed = minGap - gap + 0.05;
            movable.targetPos = clampToPlayable({
              x: movable.targetPos.x - this.attackSign(movable.team) * needed * 0.18,
              z: movable.targetPos.z + zSign * needed,
            });
            changed = true;
          }
        }
        if (!changed) break;
      }
    }
  }

  private kickoffOverlapMover(a: SimplePlayer, b: SimplePlayer) {
    const score = (player: SimplePlayer) => {
      if (player.id === this.kickoffReceiverId) return -10;
      if (player.role === "ST" || player.role === "W" || player.role === "AM") return 3;
      if (player.role === "CM" || player.role === "DM") return 2;
      return 1;
    };
    return score(a) > score(b) ? a : score(b) > score(a) ? b : a.shirtNumber > b.shirtNumber ? a : b;
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
      return dist2(player.pos, player.targetPos) <= tolerance || this.isKickoffPlayerLegallySet(player);
    });
    if (ready) this.kickoffSetupMoving = false;
    return ready;
  }

  private isKickoffPlayerLegallySet(player: SimplePlayer) {
    if (player.id === this.kickoffKickerId) return dist2(player.pos, player.targetPos) <= 0.42;
    const attackSign = this.attackSign(player.team);
    const ownHalfOk = player.pos.x * attackSign <= -KICKOFF_OWN_HALF_BUFFER + 0.35;
    const centerCircleOk = Math.hypot(player.pos.x, player.pos.z) >= CENTER_CIRCLE_RADIUS - 0.25;
    return ownHalfOk && centerCircleOk;
  }

  private kickoffRoleDepth(player: SimplePlayer, isReceiver: boolean) {
    if (isReceiver) return KICKOFF_OWN_HALF_BUFFER;
    const baseDepth = (() => {
      switch (player.role) {
        case "ST": return 7.8;
        case "W": return 9.8;
        case "AM": return 11.4;
        case "CM": return 15.4;
        case "DM": return 18.6;
        case "FB": return 23.6;
        case "CB": return 28.8;
        default: return 17.1;
      }
    })();
    const compressedScale = this.productionCompression() > 1.01 ? 0.88 : 1;
    return baseDepth * compressedScale;
  }

  private kickoffRoleLane(homePos: Vec2, player: SimplePlayer) {
    const sign = homePos.z < -0.15 ? -1 : homePos.z > 0.15 ? 1 : (player.shirtNumber % 2 === 0 ? 1 : -1);
    const absHomeZ = Math.abs(homePos.z);
    let minLane = 5.8;
    switch (player.role) {
      case "ST": minLane = 8.8; break;
      case "W": minLane = 15.5; break;
      case "AM": minLane = 9.4; break;
      case "CM": minLane = 7.8; break;
      case "DM": minLane = 6.6; break;
      case "FB": minLane = 16.8; break;
      case "CB": minLane = 9.6; break;
    }
    const expandedLane = (player.role === "W" || player.role === "FB")
      ? absHomeZ * 1.18 + 0.8
      : absHomeZ * 1.12 + 0.35;
    return sign * clamp(Math.max(minLane, expandedLane), minLane, FIELD_D / 2 - 2.4);
  }

  private kickoffTeamLaneAssignments(team: SimpleTeamCode) {
    const players = this.players
      .filter((player) =>
        player.team === team
        && player.role !== "GK"
        && player.id !== this.kickoffKickerId
        && player.id !== this.kickoffReceiverId)
      .sort((a, b) => a.homePos.z - b.homePos.z || a.homePos.x - b.homePos.x || a.shirtNumber - b.shirtNumber);
    const assignments = new Map<string, number>();
    const count = players.length;
    if (count === 0) return assignments;
    const baseEdge = Math.max(20, 22 + Math.max(0, count - 6) * 1.4);
    const runtimeScale = this.productionCompression() > 1.01 ? 0.72 : 1;
    const edge = clamp(baseEdge * runtimeScale, 16.5, FIELD_D / 2 - 2.8);
    const centerIndex = (count - 1) / 2;
    for (let i = 0; i < count; i++) {
      const normalized = count === 1 ? 0 : (i - centerIndex) / Math.max(centerIndex, 1);
      assignments.set(players[i].id, clamp(normalized * edge, -edge, edge));
    }
    return assignments;
  }

  private kickoffLegalPosition(homePos: Vec2, player: SimplePlayer, isKicker: boolean, isReceiver = false): Vec2 {
    const attackSign = this.attackSign(player.team);
    if (isKicker) return { x: 0, z: 0 };
    if (player.role === "GK") return clampToPlayable(homePos);
    const ownHalfBuffer = isReceiver
      ? KICKOFF_OWN_HALF_BUFFER
      : player.role === "ST" || player.role === "W" || player.role === "AM"
        ? 6.8
        : 4.6;

    const roleDepth = this.kickoffRoleDepth(player, isReceiver);
    let x = -attackSign * Math.max(roleDepth, ownHalfBuffer);
    let z = homePos.z;
    if (!isReceiver) {
      z = this.kickoffRoleLane(homePos, player);
      const lateralDepthBias = clamp(homePos.z / 10, -1.6, 1.6);
      const wideRetreat = clamp(Math.abs(homePos.z) * 0.08, 0, 1.8);
      x = clamp(
        -attackSign * (Math.max(roleDepth, ownHalfBuffer) + wideRetreat) + attackSign * lateralDepthBias,
        -FIELD_W / 2 + 1,
        FIELD_W / 2 - 1,
      );
    } else if (x * attackSign > -ownHalfBuffer) {
      x = -ownHalfBuffer * attackSign;
    }

    const centerClearance = CENTER_CIRCLE_RADIUS + 0.6;
    const centralLaneClearance = CENTER_CIRCLE_RADIUS + 3.6;
    const prefersNegativeLane = player.homePos.z < -0.4;
    const prefersPositiveLane = player.homePos.z > 0.4;
    const centralCompressed = isReceiver && Math.abs(player.homePos.z) <= 8.5 && x * attackSign >= -(CENTER_CIRCLE_RADIUS + 4.4);
    if (centralCompressed && Math.abs(z) < centralLaneClearance) {
      if (prefersNegativeLane) z = -centralLaneClearance;
      else if (prefersPositiveLane) z = centralLaneClearance;
      else z = (player.shirtNumber % 2 === 0 ? 1 : -1) * centralLaneClearance;
    }
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
      this.kickoffReceiverId = null;
      this.kickoffSetupMoving = false;
      return;
    }

    const origin = { x: 0, z: 0 };
    const distance = dist2(origin, receiver.pos);
    const progress = (receiver.pos.x - origin.x) * this.attackSign(team);
    const stats = this.team(team);
    this.finalizeActiveReceptionTelemetryForPlayer(kicker, "kickoff_pass");
    stats.passes += 1;
    stats.passesCompleted += 1;
    kicker.stats.passes += 1;
    kicker.stats.passesCompleted += 1;
    this.possession = receiver;
    const settleSeconds = this.visibleReceptionHoldSeconds();
    const flightSeconds = this.startBallFlight("pass", origin, receiver.pos, this.flightDuration(clamp(distance / 24, 0.55, 0.9)), 0.45, receiver, {
      settleSeconds,
    });
    this.addLiveEvent(team, "KICKOFF", `${kicker.label} to ${receiver.label}`, {
      phase: "release",
      restartType: "kickoff",
      kickerId: kicker.id,
      receiverId: receiver.id,
    });
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
      x: +origin.x.toFixed(2),
      z: +origin.z.toFixed(2),
      targetX: +receiver.pos.x.toFixed(2),
      targetZ: +receiver.pos.z.toFixed(2),
      receiver: receiver.name,
      receiverRole: receiver.role,
      to: receiver.name,
      toRole: receiver.role,
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
    this.deferActionAfterReception(flightSeconds, settleSeconds);
    this.kickoffShapeReleaseRemaining = KICKOFF_SHAPE_RELEASE_SECONDS;
    this.kickoffTeam = null;
    this.kickoffReceiverId = null;
    this.kickoffSetupMoving = false;
    this.goalKickoffSetupInstalled = false;
  }

  /** Is the ball fully outside the touchlines or goal lines? */
  private ballIsBeyondPlayableLines(pos: Vec2) {
    return Math.abs(pos.z) > FIELD_D / 2
      || pos.x > RIGHT_GOAL_X
      || pos.x < LEFT_GOAL_X;
  }

  private claimLooseBallPossession(fallbackTeam: SimpleTeamCode) {
    const ball = { x: this.ball.pos.x, z: this.ball.pos.z };
    // A ball already over a line is out; claiming it there would record a touch
    // by whoever happened to be standing nearby and flip a goal kick into a
    // corner. Leave it for the ball-out detector.
    if (this.ballIsBeyondPlayableLines(ball)) return false;
    const nearest = this.nearestPlayerTo(ball);
    if (!nearest || nearest.gap > LOOSE_BALL_CLAIM_RADIUS) return false;
    // A quick ball needs a real interception, not proximity. Without this a
    // defender standing near a ball speeding out "claims" it, is recorded as
    // the last toucher, and the goal kick becomes a corner.
    const ballSpeed = Math.hypot(this.ball.vel.x, this.ball.vel.z);
    if (ballSpeed > LOOSE_BALL_CLAIM_SPEED_LIMIT && nearest.gap > TOUCH_CONTACT_RADIUS) return false;
    const claimant = nearest.player;
    this.possession = claimant;
    if (claimant && !this.ballFlight) this.ball.vel = { x: 0, z: 0 };
    return true;
  }

  private updateLooseBallChaseTarget() {
    const nearest = this.nearestPlayerTo({ x: this.ball.pos.x, z: this.ball.pos.z });
    if (!nearest) return;
    nearest.player.targetPos = clampToPlayable({ x: this.ball.pos.x, z: this.ball.pos.z });
  }

  private updateLooseBallMotion(dt: number) {
    this.updateBallBounce(dt);
    const speed = Math.hypot(this.ball.vel.x, this.ball.vel.z);
    if (speed <= 0.01) {
      this.ball.vel = { x: 0, z: 0 };
      return;
    }
    // Ball-out and goal detection compare against lastBallPos. Only ball
    // flights maintained it, so a free-rolling ball had no previous position
    // and could cross a line unnoticed.
    this.lastBallPos = { x: this.ball.pos.x, z: this.ball.pos.z };
    this.ball.pos.x += this.ball.vel.x * dt;
    this.ball.pos.z += this.ball.vel.z * dt;
    const damp = Math.max(0, 1 - LOOSE_BALL_GROUND_FRICTION * dt * 3.0);
    this.ball.vel.x *= damp;
    this.ball.vel.z *= damp;
  }

  /**
   * Let a landed ball bounce instead of sticking to the turf.
   *
   * A ball flight ended by snapping y to ground level, so every long ball,
   * clearance and uncollected cross died flat on impact -- the single biggest
   * reason the ball read as glued to the floor.
   */
  private updateBallBounce(dt: number) {
    const ground = this.ballGroundY();
    if (this.ballVelY === 0 && this.ball.pos.y <= ground + 1e-6) {
      this.ball.pos.y = ground;
      return;
    }
    this.ballVelY -= BALL_GRAVITY * dt;
    this.ball.pos.y += this.ballVelY * dt;
    if (this.ball.pos.y <= ground) {
      this.ball.pos.y = ground;
      const rebound = -this.ballVelY * BALL_BOUNCE_RESTITUTION;
      this.ballVelY = rebound > BALL_BOUNCE_REST_SPEED ? rebound : 0;
      // Each bounce scrubs a little pace off the ground run too.
      this.ball.vel.x *= 0.88;
      this.ball.vel.z *= 0.88;
    }
  }

  private kickoffReceiver(team: SimpleTeamCode, kickerId: string) {
    const preferred = this.kickoffReceiverId
      ? this.players.find((player) => player.id === this.kickoffReceiverId && player.team === team && player.id !== kickerId)
      : null;
    if (preferred) return preferred;
    return this.preferredKickoffReceiver(team, kickerId);
  }

  private preferredKickoffReceiver(team: SimpleTeamCode, kickerId: string) {
    const attackSign = this.attackSign(team);
    const candidates = this.players
      .filter((player) => player.team === team && player.id !== kickerId && player.role !== "GK")
      .filter((player) => player.pos.x * attackSign < -0.1)
      .sort((a, b) => {
        const roleScore = (player: SimplePlayer) =>
          player.role === "CM" || player.role === "DM" || player.role === "AM" ? 0
          : player.role === "CB" || player.role === "FB" ? 1
          : 2;
        return roleScore(a) - roleScore(b)
          || Math.abs(a.homePos.z) - Math.abs(b.homePos.z)
          || Math.abs(a.pos.z) - Math.abs(b.pos.z);
      });
    return candidates[0] || null;
  }

  private rememberTouch(player: SimplePlayer | null | undefined) {
    if (!player) return;
    this.lastTouchTeam = player.team;
    this.lastTouchPlayerId = player.id;
  }

  private detectAndStageBallOut(): GoalEvent | null {
    if (this.pendingBallOutEvent || this.msm.state.kind !== "live_play") return null;
    if (this.pendingMissGoalLineOut && !this.ballFlight) {
      const { event, context } = this.pendingMissGoalLineOut;
      this.pendingMissGoalLineOut = null;
      this.visibleBallOutPending = { event, context, holdSeconds: BALL_OUT_HOLD_SECONDS };
      this.possession = null;
      // Keep the ball's pace: updateOutOfPlayBallMotion runs it on into the
      // stadium wall during the hold. Zeroing here froze it on the line.
      this.addBallOutLog(event, context);
      return null;
    }
    const current = { x: this.ball.pos.x, z: this.ball.pos.z };
    // Positional fallback. The crossing test needs the ball to move from inside
    // to outside within one frame; if it is already past the line -- a deflection
    // that started there, a dropped frame, a ball nudged over at rest -- the
    // goal is never seen. detectBallOut returns null for a goal, so nothing
    // else catches it either.
    const settledInNet = !this.ballFlight && this.goalMouthContainsBall(current);
    const goalMouthCrossing = this.detectGoalMouthCrossing(this.lastBallPos, current)
      ?? (settledInNet ? this.goalMouthCrossingFromPosition(current) : null);
    if (goalMouthCrossing && this.pendingFlightGoalEvent && this.ballFlight?.kind === "shot") {
      return null;
    }
    if (goalMouthCrossing && this.ballFlight?.kind === "miss") {
      this.pendingMissGoalLineOut ||= this.buildGoalMouthMissOut(goalMouthCrossing);
      return null;
    }
    if (goalMouthCrossing) return this.resolveGoalMouthCrossing(goalMouthCrossing);
    const detected = detectBallOut(current.x, current.z, this.lastTouchTeam ? teamSide(this.lastTouchTeam) : null, this.attackSign("A"));
    if (!detected) return null;
    const context = this.buildBallOutContext(detected, this.lastBallPos, current);
    if (!context) return null;
    const goalLineOut = context.crossedLine === "left_goal_line" || context.crossedLine === "right_goal_line";
    // Do not discard: hold it until the flight ends, or the ball stays in play
    // having already left the pitch.
    if (goalLineOut && this.ballFlight) {
      this.pendingMissGoalLineOut ||= { event: detected, context };
      return null;
    }
    if (goalLineOut) {
      this.visibleBallOutPending = { event: detected, context, holdSeconds: BALL_OUT_HOLD_SECONDS };
      this.possession = null;
      // Keep the ball's pace: updateOutOfPlayBallMotion runs it on into the
      // stadium wall during the hold. Zeroing here froze it on the line.
      this.addBallOutLog(detected, context);
      return null;
    }
    // Touchline outs get the same run-on as goal-line ones. Only the goal line
    // was handled before, so a throw-in -- much the commonest way the ball goes
    // out -- still froze it dead on the line, which is what was reported after
    // this was supposedly fixed.
    this.truncateActiveFlightAtOutOfPlay(context.spot);
    if (this.ballFlight) {
      // Hand the flight's pace to the loose ball so it keeps travelling rather
      // than stopping where the flight was cut short.
      const flight = this.ballFlight;
      const span = { x: flight.to.x - flight.from.x, z: flight.to.z - flight.from.z };
      const length = Math.hypot(span.x, span.z);
      const speed = length / Math.max(0.001, flight.duration);
      this.ballFlight = null;
      this.ball.vel = length > 1e-4
        ? { x: (span.x / length) * speed * LOOSE_BALL_LANDING_CARRY, z: (span.z / length) * speed * LOOSE_BALL_LANDING_CARRY }
        : { x: 0, z: 0 };
    }
    this.visibleBallOutPending = { event: detected, context, holdSeconds: BALL_OUT_HOLD_SECONDS };
    this.possession = null;
    this.addBallOutLog(detected, context);
    return null;
  }

  private buildGoalMouthMissOut(crossing: {
    scoringTeam: SimpleTeamCode;
    spot: Vec2;
    crossedLine: "left_goal_line" | "right_goal_line";
  }) {
    if (!this.lastTouchTeam) return null;
    const restartType: BallOutEvent["restartType"] = this.lastTouchTeam === crossing.scoringTeam ? "goal_kick" : "corner";
    const restartTeam = restartType === "goal_kick" ? otherTeam(crossing.scoringTeam) : crossing.scoringTeam;
    const event: BallOutEvent = { restartType, restartTeam: teamSide(restartTeam) };
    const context: BallOutRestartContext = {
      restartType,
      restartTeam,
      spot: { ...crossing.spot },
      lastTouchTeam: this.lastTouchTeam,
      lastTouchPlayerId: this.lastTouchPlayerId,
      crossedLine: crossing.crossedLine,
    };
    return { event, context };
  }

  /** Is the ball fully over a goal line and between the posts? */
  private goalMouthContainsBall(pos: Vec2) {
    const mouthHalf = GOAL_MOUTH_SCORING_HALF_Z;
    if (Math.abs(pos.z) > mouthHalf) return false;
    return pos.x > RIGHT_GOAL_X + BALL_RADIUS || pos.x < LEFT_GOAL_X - BALL_RADIUS;
  }

  /** Build a crossing record for a ball that is already in the net. */
  private goalMouthCrossingFromPosition(pos: Vec2) {
    const crossingRight = pos.x > 0;
    return {
      scoringTeam: (crossingRight
        ? (this.attackSign("A") > 0 ? "A" : "B")
        : (this.attackSign("A") < 0 ? "A" : "B")) as SimpleTeamCode,
      spot: { x: crossingRight ? RIGHT_GOAL_X : LEFT_GOAL_X, z: pos.z },
      crossedLine: (crossingRight ? "right_goal_line" : "left_goal_line") as "left_goal_line" | "right_goal_line",
    };
  }

  private detectGoalMouthCrossing(from: Vec2, to: Vec2): {
    scoringTeam: SimpleTeamCode;
    spot: Vec2;
    crossedLine: "left_goal_line" | "right_goal_line";
  } | null {
    const mouthHalf = GOAL_MOUTH_SCORING_HALF_Z;
    const crossingRight = from.x <= RIGHT_GOAL_X + BALL_RADIUS && to.x > RIGHT_GOAL_X + BALL_RADIUS;
    const crossingLeft = from.x >= LEFT_GOAL_X - BALL_RADIUS && to.x < LEFT_GOAL_X - BALL_RADIUS;
    if (!crossingRight && !crossingLeft) return null;

    const fullBallLineX = crossingRight ? RIGHT_GOAL_X + BALL_RADIUS : LEFT_GOAL_X - BALL_RADIUS;
    const goalLineX = crossingRight ? RIGHT_GOAL_X : LEFT_GOAL_X;
    const t = Math.abs(to.x - from.x) > 0.001 ? clamp((fullBallLineX - from.x) / (to.x - from.x), 0, 1) : 1;
    const crossingZ = from.z + (to.z - from.z) * t;
    if (Math.abs(crossingZ) > mouthHalf) return null;

    const scoringTeam: SimpleTeamCode = crossingRight
      ? (this.attackSign("A") > 0 ? "A" : "B")
      : (this.attackSign("A") < 0 ? "A" : "B");
    const crossedLine: "left_goal_line" | "right_goal_line" = crossingRight ? "right_goal_line" : "left_goal_line";
    return {
      scoringTeam,
      spot: { x: goalLineX, z: crossingZ },
      crossedLine,
    };
  }

  private resolveGoalMouthCrossing(crossing: {
    scoringTeam: SimpleTeamCode;
    spot: Vec2;
    crossedLine: "left_goal_line" | "right_goal_line";
  }): GoalEvent {
    this.finalizeActiveReceptionTelemetryForPlayer(this.possession, "goal");
    const lastTouch = this.lastTouchPlayerId
      ? this.players.find((player) => player.id === this.lastTouchPlayerId) || null
      : null;
    const ownGoal = !!this.lastTouchTeam && this.lastTouchTeam !== crossing.scoringTeam;
    const scoringStats = this.team(crossing.scoringTeam);
    scoringStats.score += 1;
    if (!ownGoal && lastTouch?.team === crossing.scoringTeam) {
      lastTouch.stats.goals += 1;
    }

    const netTarget = this.goalNetTarget(crossing.scoringTeam, crossing.spot);
    const playerName = ownGoal ? "Own Goal" : (lastTouch?.name || "Goal");
    const shotDefense = this.shotDefenseSnapshot(crossing.scoringTeam, crossing.spot, lastTouch || undefined);
    const goalRow = {
      team: crossing.scoringTeam,
      playerName,
      scorer: playerName,
      shirtNumber: ownGoal ? undefined : lastTouch?.shirtNumber,
      role: ownGoal ? "OG" : lastTouch?.role,
      matchMinute: getMatchMinute(this.msm),
      elapsedInHalf: this.msm.clock.elapsedInHalf,
      distToGoal: 0,
      distToGoalYards: 0,
      carrierDistToGoal: 0,
      carrierBallGap: 0,
      maxGoalDistanceYards: 0,
      invalidGoalGeometry: false,
      resolutionReason: "GOAL_MOUTH_CROSSING",
      goalChance: 1,
      shotTarget: { x: +crossing.spot.x.toFixed(2), z: +crossing.spot.z.toFixed(2) },
      netTarget: { x: +netTarget.x.toFixed(2), z: +netTarget.z.toFixed(2) },
      shotBacked: false,
      fieldResolved: true,
      ownGoal,
      lastTouchTeam: this.lastTouchTeam,
      lastTouchPlayerId: this.lastTouchPlayerId,
      lastTouchPlayerName: lastTouch?.name || null,
      crossedLine: crossing.crossedLine,
      ...shotDefense,
    };
    this.goalLog.push(goalRow);
    this.recordEvent("GOAL", crossing.scoringTeam, lastTouch || undefined, goalRow);
    // A shot goal stages an announcement in resolveShot and the ball then flies
    // into the net, where this crossing detector fires too. Both used to
    // announce, which is the double GOAL: drop the staged one, this is the
    // moment the ball actually crossed the line.
    this.pendingGoalAnnouncement = null;
    this.addLiveEvent(crossing.scoringTeam, "GOAL", `${playerName} ${goalRow.matchMinute}'`, {
      shotOrigin: { x: +this.lastBallPos.x.toFixed(2), z: +this.lastBallPos.z.toFixed(2) },
      shotTarget: { x: +crossing.spot.x.toFixed(2), z: +crossing.spot.z.toFixed(2) },
      netTarget: { x: +netTarget.x.toFixed(2), y: this.ballGroundY(), z: +netTarget.z.toFixed(2) },
      resolutionReason: "GOAL_MOUTH_CROSSING",
      fieldResolved: true,
      ownGoal,
      lastTouchPlayerName: lastTouch?.name || null,
    });

    this.pendingBallOutEvent = null;
    this.pendingBallOutContext = null;
    this.pendingMissGoalLineOut = null;
    this.visibleBallOutPending = null;
    this.restartContext = null;
    this.ballFlight = null;
    this.ball.pos.x = crossing.spot.x;
    this.ball.pos.y = this.ballGroundY();
    this.ball.pos.z = crossing.spot.z;
    this.ball.vel = { x: 0, z: 0 };
    this.goalNetSettleRemaining = 0;
    this.goalKickoffSetupInstalled = false;
    this.startBallFlight("shot", crossing.spot, netTarget, this.flightDuration(0.45), 0.55, undefined, {
      sourceAction: "goal_mouth_crossing",
      attackingTeam: crossing.scoringTeam,
      passerId: lastTouch?.id,
      passerName: lastTouch?.name,
    });
    this.possession = null;
    return { scoringTeam: teamSide(crossing.scoringTeam) };
  }

  private addBallOutLog(detected: BallOutEvent, context: BallOutRestartContext) {
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
    const lastTouchTeam = this.lastTouchTeam;
    const goalLine = crossedLine === "left_goal_line" || crossedLine === "right_goal_line";
    const attackingTeam: SimpleTeamCode | null = goalLine
      ? (crossedLine === "right_goal_line"
        ? (this.attackSign("A") > 0 ? "A" : "B")
        : (this.attackSign("A") < 0 ? "A" : "B"))
      : null;
    const restartType = goalLine && attackingTeam && lastTouchTeam
      ? (lastTouchTeam === attackingTeam ? "goal_kick" : "corner")
      : event.restartType;
    const restartTeam = restartType === "corner" && attackingTeam
      ? attackingTeam
      : restartType === "goal_kick" && attackingTeam
        ? otherTeam(attackingTeam)
        : codeFromSide(event.restartTeam);
    return {
      restartType,
      restartTeam,
      spot,
      lastTouchTeam,
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
    this.finalizeActiveReceptionTelemetryForPlayer(this.possession, "restart");
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
    restart.plan = this.restartPlanFor(restart, taker);
    this.restartContext = restart;
    this.ballFlight = null;
    this.possession = taker || null;
    this.ball.pos = { x: restart.spot.x, y: this.ballGroundY(), z: restart.spot.z };
    this.ball.vel = { x: 0, z: 0 };
    if (taker) {
      taker.targetPos = this.restartTakerTarget(restart);
    }
    if (restart.restartType === "corner") this.positionCornerPlayers(restart);
    const stats = this.team(restart.restartTeam);
    if (restart.restartType === "corner") stats.corners += 1;
    if (restart.restartType === "throw_in") stats.throwIns += 1;
    if (restart.restartType === "goal_kick") stats.goalKicks += 1;
    if (restart.restartType === "free_kick") stats.freeKicks += 1;
    if (restart.restartType === "penalty") {
      stats.penaltiesAwarded += 1;
      stats.penaltyXg += 0.78;
    }
    const presentationKind = restart.restartType === "corner" ? "corner_kick" : restart.restartType;
    const presentationSeconds = restart.restartType === "corner" ? 2.0 : restart.restartType === "throw_in" ? 1.9 : restart.restartType === "penalty" ? 2.2 : 1.8;
    const takerSpot = taker ? this.restartTakerTarget(restart) : null;
    const setupMeta = {
      phase: "setup",
      restartType: restart.restartType,
      presentationKind,
      presentationSeconds,
      restartPlan: restart.plan,
      takerId: taker?.id || null,
      takerName: taker?.name || null,
      spot: { ...restart.spot },
      takerSpot,
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
      const ownGoalX = attackSign > 0 ? LEFT_GOAL_X + GOAL_BOX_DEPTH * 0.65 : RIGHT_GOAL_X - GOAL_BOX_DEPTH * 0.65;
      return { x: ownGoalX, z: clamp(restart.spot.z * 0.18, -GOAL_BOX_HALF_Z * 0.82, GOAL_BOX_HALF_Z * 0.82) };
    }
    if (restart.restartType === "free_kick") {
      return {
        x: clamp(restart.spot.x, LEFT_GOAL_X + 0.8, RIGHT_GOAL_X - 0.8),
        z: clamp(restart.spot.z, -FIELD_D / 2 + 0.8, FIELD_D / 2 - 0.8),
      };
    }
    if (restart.restartType === "penalty") {
      return this.penaltySpotForAttack(this.attackSign(restart.restartTeam));
    }
    return { x: clamp(restart.spot.x, LEFT_GOAL_X + 0.8, RIGHT_GOAL_X - 0.8), z: restart.spot.z >= 0 ? FIELD_D / 2 - 0.25 : -FIELD_D / 2 + 0.25 };
  }

  private restartTaker(restart: BallOutRestartContext) {
    if (restart.restartType === "goal_kick") {
      return this.players.find((player) => player.team === restart.restartTeam && player.role === "GK") || null;
    }
    if (restart.restartType === "corner") {
      const roleScore = (player: SimplePlayer) => player.role === "W" ? 4 : player.role === "FB" ? 3 : player.role === "AM" ? 2 : player.role === "CM" ? 1 : 0;
      return this.players
        .filter((player) => player.team === restart.restartTeam && player.role !== "GK")
        .sort((a, b) => (dist2(a.pos, restart.spot) - roleScore(a) * 1.8) - (dist2(b.pos, restart.spot) - roleScore(b) * 1.8))[0] || null;
    }
    if (restart.restartType === "penalty") {
      const fouled = restart.fouledPlayerId ? this.players.find((player) => player.id === restart.fouledPlayerId) : null;
      if (fouled && fouled.team === restart.restartTeam && fouled.role !== "GK") return fouled;
      return this.players
        .filter((player) => player.team === restart.restartTeam && player.role !== "GK")
        .sort((a, b) => b.ratings.shooting - a.ratings.shooting)[0] || null;
    }
    return this.nearestTeamPlayer(restart.restartTeam, restart.spot)
      || this.players.find((player) => player.team === restart.restartTeam && player.role !== "GK")
      || null;
  }

  private restartTakerTarget(restart: BallOutRestartContext): Vec2 {
    if (restart.restartType === "goal_kick") {
      return clampToPlayable(restart.spot);
    }
    if (restart.restartType === "corner") {
      return this.cornerTakerTarget(restart);
    }
    if (restart.restartType === "throw_in") {
      return this.throwInTakerTarget(restart);
    }
    if (restart.restartType === "free_kick") {
      const attackSign = this.attackSign(restart.restartTeam);
      return clampToPlayable({ x: restart.spot.x - attackSign * 0.45, z: restart.spot.z });
    }
    if (restart.restartType === "penalty") {
      const attackSign = this.attackSign(restart.restartTeam);
      return clampToPlayable({ x: restart.spot.x - attackSign * 0.85, z: restart.spot.z });
    }
    const inwardZ = restart.spot.z > 0 ? -0.9 : restart.spot.z < 0 ? 0.9 : 0;
    const inwardX = restart.spot.x > RIGHT_GOAL_X - 1 ? -0.9 : restart.spot.x < LEFT_GOAL_X + 1 ? 0.9 : 0;
    return clampToPlayable({ x: restart.spot.x + inwardX, z: restart.spot.z + inwardZ });
  }

  private throwInTakerTarget(restart: BallOutRestartContext): Vec2 {
    const outsideZ = restart.spot.z >= 0 ? FIELD_D / 2 + 0.42 : -FIELD_D / 2 - 0.42;
    return {
      x: clamp(restart.spot.x, LEFT_GOAL_X + 0.8, RIGHT_GOAL_X - 0.8),
      z: outsideZ,
    };
  }

  private cornerTakerTarget(restart: BallOutRestartContext): Vec2 {
    const goalLineSide = restart.spot.x >= 0 ? 1 : -1;
    const touchlineSide = restart.spot.z >= 0 ? 1 : -1;
    return {
      x: restart.spot.x + goalLineSide * 0.5,
      z: restart.spot.z + touchlineSide * 0.5,
    };
  }

  private moveRestartPlayers(dt: number) {
    const restart = this.restartContext;
    if (!restart) return;
    if (restart.restartType === "corner") this.positionCornerPlayers(restart);
    if (restart.restartType === "goal_kick") this.positionGoalKickPlayers(restart);
    if (restart.restartType === "penalty") this.positionPenaltyPlayers(restart);
    const taker = restart.takerId ? this.players.find((player) => player.id === restart.takerId) : null;
    if (taker) taker.targetPos = this.restartTakerTarget(restart);
    this.movePlayers(dt);
    if (restart.restartType === "corner" && taker) {
      const target = this.cornerTakerTarget(restart);
      taker.pos.x = target.x;
      taker.pos.z = target.z;
      taker.vel = { x: 0, z: 0 };
    }
    if (restart.restartType === "throw_in" && taker) {
      const target = this.throwInTakerTarget(restart);
      taker.pos.x = target.x;
      taker.pos.z = target.z;
      taker.vel = { x: 0, z: 0 };
    }
    this.ball.pos = { x: restart.spot.x, y: this.ballGroundY(), z: restart.spot.z };
    this.ball.vel = { x: 0, z: 0 };
  }

  private goalKickDefendingLeft(restart: BallOutRestartContext) {
    return this.attackSign(restart.restartTeam) > 0;
  }

  private positionGoalKickPlayers(restart: BallOutRestartContext) {
    const defendingLeft = this.goalKickDefendingLeft(restart);
    const defendingTeam = restart.restartTeam;
    const opponentTeam = otherTeam(defendingTeam);
    const exitX = defendingLeft ? LEFT_PENALTY_X + 0.9 : RIGHT_PENALTY_X - 0.9;
    for (const player of this.players) {
      if (player.team === opponentTeam && (isInPenaltyArea(player.pos, defendingLeft) || isInPenaltyArea(player.targetPos, defendingLeft))) {
        player.targetPos = clampToPlayable({
          x: exitX,
          z: clamp(player.pos.z, -PENALTY_HALF_Z + 0.6, PENALTY_HALF_Z - 0.6),
        });
      }
    }
  }

  private isGoalKickSetupReady(restart: BallOutRestartContext) {
    const defendingLeft = this.goalKickDefendingLeft(restart);
    const taker = restart.takerId ? this.players.find((player) => player.id === restart.takerId) : null;
    if (taker && dist2(taker.pos, restart.spot) > 0.75) return false;
    return this.players
      .filter((player) => player.team === otherTeam(restart.restartTeam))
      .every((player) => !isInPenaltyArea(player.pos, defendingLeft) && !isInPenaltyArea(player.targetPos, defendingLeft));
  }

  private cornerDefendingLeft(restart: BallOutRestartContext) {
    return this.attackSign(restart.restartTeam) < 0;
  }

  private positionCornerPlayers(restart: BallOutRestartContext) {
    const attackSign = this.attackSign(restart.restartTeam);
    const defendingLeft = this.cornerDefendingLeft(restart);
    const attackingTeam = restart.restartTeam;
    const defendingTeam = otherTeam(attackingTeam);
    const goalX = attackSign > 0 ? RIGHT_GOAL_X : LEFT_GOAL_X;
    const side = restart.spot.z >= 0 ? 1 : -1;
    const far = -side;
    const takerId = restart.takerId || null;
    const keeper = this.players.find((player) => player.team === defendingTeam && player.role === "GK") || null;
    const clampLane = (z: number) => clamp(z, -PENALTY_HALF_Z + 0.55, PENALTY_HALF_Z - 0.55);
    // The routine decides the shape. Without this every corner set up
    // identically and the plan only changed which team-mate the ball was aimed
    // at, so calling one made no visible difference in the box.
    const plan = restart.plan;
    const shortCorner = plan === "corner_short";
    const edgeCorner = plan === "corner_edge";
    // Near post pulls bodies to the ball side, far post loads the back stick.
    const overload = plan === "corner_far_post" ? far : plan === "corner_near_post" ? side : 0;
    const boxSlots = [
      { x: goalX - attackSign * 4.1, z: clampLane(far * 1.4) },
      { x: goalX - attackSign * 5.2, z: clampLane(far * 4.3) },
      { x: goalX - attackSign * 5.8, z: clampLane(side * 2.8) },
      { x: goalX - attackSign * 7.0, z: clampLane(0.2) },
      { x: goalX - attackSign * 8.2, z: clampLane(far * 6.9) },
      { x: goalX - attackSign * 9.2, z: clampLane(side * 5.8) },
      { x: goalX - attackSign * 10.6, z: clampLane(far * 0.4) },
    ];
    if (overload !== 0) {
      // Drag the front three toward the loaded post rather than moving everyone,
      // so the box still has bodies spread across it.
      for (let i = 0; i < 3 && i < boxSlots.length; i += 1) {
        boxSlots[i] = { x: boxSlots[i].x, z: clampLane(boxSlots[i].z + overload * 2.6) };
      }
    }
    if (shortCorner) {
      // Two out to the flag for the short option; the rest hold the box.
      boxSlots[0] = { x: restart.spot.x - attackSign * 2.4, z: clamp(restart.spot.z - side * 2.2, -FIELD_D / 2 + 1, FIELD_D / 2 - 1) };
      boxSlots[1] = { x: restart.spot.x - attackSign * 5.4, z: clamp(restart.spot.z - side * 4.0, -FIELD_D / 2 + 1, FIELD_D / 2 - 1) };
    }
    if (edgeCorner) {
      // Someone at the top of the D for the cut-back, and nobody crowding the
      // six-yard box in front of him.
      boxSlots[0] = { x: goalX - attackSign * 13.2, z: clampLane(0.4) };
      boxSlots[3] = { x: goalX - attackSign * 11.4, z: clampLane(side * 3.2) };
    }
    const coverSlots = [
      { x: goalX - attackSign * 16.8, z: clamp(side * 9.4, -FIELD_D / 2 + 2.2, FIELD_D / 2 - 2.2) },
      { x: goalX - attackSign * 21.5, z: clamp(far * 5.2, -FIELD_D / 2 + 2.2, FIELD_D / 2 - 2.2) },
    ];
    const defenderSlots = [
      { x: goalX - attackSign * 3.2, z: clampLane(0) },
      { x: goalX - attackSign * 4.6, z: clampLane(far * 2.8) },
      { x: goalX - attackSign * 5.3, z: clampLane(side * 2.6) },
      { x: goalX - attackSign * 6.4, z: clampLane(far * 5.6) },
      { x: goalX - attackSign * 7.4, z: clampLane(side * 5.1) },
      { x: goalX - attackSign * 8.7, z: clampLane(far * 0.5) },
      { x: goalX - attackSign * 9.8, z: clampLane(side * 7.1) },
      { x: goalX - attackSign * 11.0, z: clampLane(far * 7.4) },
    ];
    const defenderEdgeSlots = [
      { x: goalX - attackSign * 13.8, z: clamp(side * 8.6, -FIELD_D / 2 + 1.7, FIELD_D / 2 - 1.7) },
      { x: goalX - attackSign * 15.4, z: clamp(far * 3.2, -FIELD_D / 2 + 1.7, FIELD_D / 2 - 1.7) },
    ];
    const attackPriority = (player: SimplePlayer) => player.role === "ST" ? 7
      : player.role === "AM" ? 6
        : player.role === "W" ? 5
          : player.role === "CM" ? 4
            : player.role === "DM" ? 2
              : player.role === "FB" ? 1
                : 0;
    const defensePriority = (player: SimplePlayer) => player.role === "CB" ? 7
      : player.role === "FB" ? 6
        : player.role === "DM" ? 5
          : player.role === "CM" ? 4
            : player.role === "ST" ? 1
              : 2;
    const attackers = this.players
      .filter((player) => player.team === attackingTeam && player.role !== "GK" && player.id !== takerId)
      .sort((a, b) => attackPriority(b) - attackPriority(a) || a.shirtNumber - b.shirtNumber);
    const defenders = this.players
      .filter((player) => player.team === defendingTeam && player.role !== "GK")
      .sort((a, b) => defensePriority(b) - defensePriority(a) || a.shirtNumber - b.shirtNumber);
    for (const [index, player] of attackers.entries()) {
      const slot = index < boxSlots.length ? boxSlots[index] : coverSlots[Math.min(index - boxSlots.length, coverSlots.length - 1)];
      player.targetPos = clampToPlayable(slot);
    }
    if (keeper) keeper.targetPos = clampToPlayable({ x: goalX - attackSign * 0.62, z: clamp(side * 0.25, -GOAL_MOUTH_HALF_Z * 0.72, GOAL_MOUTH_HALF_Z * 0.72) });
    for (const [index, player] of defenders.entries()) {
      const slot = index < defenderSlots.length ? defenderSlots[index] : defenderEdgeSlots[Math.min(index - defenderSlots.length, defenderEdgeSlots.length - 1)];
      player.targetPos = clampToPlayable(slot);
    }
  }

  private cornerFormationTelemetry(restart: BallOutRestartContext) {
    const defendingLeft = this.cornerDefendingLeft(restart);
    const taker = restart.takerId ? this.players.find((player) => player.id === restart.takerId) : null;
    const attackingPlayers = this.players.filter((player) => player.team === restart.restartTeam && player.role !== "GK" && player.id !== restart.takerId);
    const defendingPlayers = this.players.filter((player) => player.team === otherTeam(restart.restartTeam) && player.role !== "GK");
    const boxAttackers = attackingPlayers.filter((player) => isInPenaltyArea(player.pos, defendingLeft)).length;
    const boxDefenders = defendingPlayers.filter((player) => isInPenaltyArea(player.pos, defendingLeft)).length;
    const targetBoxAttackers = attackingPlayers.filter((player) => isInPenaltyArea(player.targetPos, defendingLeft)).length;
    const targetBoxDefenders = defendingPlayers.filter((player) => isInPenaltyArea(player.targetPos, defendingLeft)).length;
    const coverAttackers = attackingPlayers.length - targetBoxAttackers;
    return {
      boxAttackers,
      boxDefenders,
      targetBoxAttackers,
      targetBoxDefenders,
      coverAttackers,
      takerAtFlag: taker ? dist2(taker.pos, this.restartTakerTarget(restart)) <= 1.25 : false,
    };
  }

  /**
   * Have the runners for a called routine arrived?
   *
   * Only the players the routine actually moved need to be in place, and it is
   * capped in time so the take button can never feel dead -- an unreachable
   * shape costs a short pause, not a stuck restart.
   */
  private isCalledRoutineReady(restart: BallOutRestartContext) {
    if (restart.planChosenBy !== restart.restartTeam) return true;
    const waited = this.deadBallStateWallSeconds - (restart.planChosenAt ?? 0);
    if (waited >= CALLED_ROUTINE_MAX_WAIT_SECONDS) return true;
    const movers = this.players.filter((player) => player.team === restart.restartTeam
      && player.role !== "GK"
      && player.id !== restart.takerId);
    return movers.every((player) => !player.targetPos
      || dist2(player.pos, player.targetPos) <= CALLED_ROUTINE_ARRIVAL);
  }

  private isCornerSetupReady(restart: BallOutRestartContext) {
    const taker = restart.takerId ? this.players.find((player) => player.id === restart.takerId) : null;
    if (taker && dist2(taker.pos, this.restartTakerTarget(restart)) > 1.25) return false;
    const formation = this.cornerFormationTelemetry(restart);
    return formation.boxAttackers >= 5
      && formation.boxDefenders >= 6
      && formation.coverAttackers >= 1
      && formation.coverAttackers <= 3;
  }

  private penaltyDefendingLeft(restart: BallOutRestartContext) {
    return this.attackSign(restart.restartTeam) < 0;
  }

  private positionPenaltyPlayers(restart: BallOutRestartContext) {
    const defendingLeft = this.penaltyDefendingLeft(restart);
    const takerId = restart.takerId || null;
    const defendingTeam = otherTeam(restart.restartTeam);
    const keeper = this.players.find((player) => player.team === defendingTeam && player.role === "GK") || null;
    const keeperLineX = defendingLeft ? LEFT_GOAL_X + 0.38 : RIGHT_GOAL_X - 0.38;
    if (keeper) keeper.targetPos = { x: keeperLineX, z: 0 };
    const outsideX = defendingLeft ? LEFT_PENALTY_X + 1.1 : RIGHT_PENALTY_X - 1.1;
    for (const player of this.players) {
      if (player.id === takerId || player.id === keeper?.id) continue;
      if (isInPenaltyArea(player.pos, defendingLeft) || isInPenaltyArea(player.targetPos, defendingLeft) || dist2(player.pos, restart.spot) < CENTER_CIRCLE_RADIUS) {
        const lane = ((player.shirtNumber % 6) - 2.5) * 1.65;
        player.targetPos = clampToPlayable({
          x: outsideX,
          z: clamp(player.pos.z + lane, -PENALTY_HALF_Z - 2.0, PENALTY_HALF_Z + 2.0),
        });
      }
    }
  }

  private isPenaltySetupReady(restart: BallOutRestartContext) {
    const defendingLeft = this.penaltyDefendingLeft(restart);
    const taker = restart.takerId ? this.players.find((player) => player.id === restart.takerId) : null;
    const keeper = this.players.find((player) => player.team === otherTeam(restart.restartTeam) && player.role === "GK") || null;
    if (taker && dist2(taker.pos, this.restartTakerTarget(restart)) > 1.2) return false;
    if (keeper) {
      const keeperLineX = defendingLeft ? LEFT_GOAL_X + 0.38 : RIGHT_GOAL_X - 0.38;
      if (dist2(keeper.pos, { x: keeperLineX, z: 0 }) > 1.4) return false;
    }
    return this.players
      .filter((player) => player.id !== taker?.id && player.id !== keeper?.id)
      .every((player) => !isInPenaltyArea(player.pos, defendingLeft));
  }

  private executeBallOutRestart() {
    const restart = this.restartContext;
    if (!restart) return;
    const taker = restart.takerId ? this.players.find((player) => player.id === restart.takerId) : null;
    if (restart.restartType === "penalty") {
      const goalEvent = taker ? this.executePenaltyRestart(restart, taker) : null;
      this.restartContext = null;
      if (goalEvent) {
        this.msm.score[goalEvent.scoringTeam] += 1;
        this.msm.state = { kind: "goal_scored", scoringTeam: goalEvent.scoringTeam, restartAfter: 2.0 };
        this.msm.restartTimer = this.restartDelayGoal;
      }
      return;
    }
    const goalKickPlan = restart.restartType === "goal_kick"
      ? this.goalKickRestartPlan(restart, taker?.id, restart.plan === "goal_kick_long")
      : null;
    const receiver = goalKickPlan?.receiver || this.restartReceiver(restart, taker?.id);
    if (!receiver) {
      this.restartContext = null;
      return;
    }
    this.possession = receiver;
    this.rememberTouch(receiver);
    const distance = dist2(restart.spot, receiver.pos);
    const longGoalKick = goalKickPlan?.style === "goal_kick_long";
    const groundedCorner = restart.restartType === "corner"
      && (restart.plan === "corner_short" || restart.plan === "corner_edge");
    const cornerDeliveryStyle = restart.restartType !== "corner"
      ? null
      : groundedCorner
        ? "DRIVEN"
        : (this.rng.next() < 0.16 ? "DRIVEN" : this.rng.next() < 0.58 ? "MEDIUM_ARC" : "LOOPED");
    const arcHeight = restart.restartType === "throw_in" ? 0.85
      : restart.restartType === "corner" ? (groundedCorner ? 0.16 : cornerDeliveryStyle === "DRIVEN" ? 0.84 : cornerDeliveryStyle === "MEDIUM_ARC" ? 1.02 : CORNER_KICK_ARC)
      : restart.restartType === "free_kick" ? 0.32
      : longGoalKick ? GOAL_KICK_LONG_ARC
      : 0.22;
    const headerEligible = (restart.restartType === "corner" && !groundedCorner) || longGoalKick || (restart.restartType === "throw_in" && dist2(receiver.pos, goalCenterForAttack(this.attackSign(restart.restartTeam))) <= 14);
    const settleSeconds = this.visibleReceptionHoldSeconds();
    const flightSeconds = this.startBallFlight("restart", restart.spot, receiver.pos, this.flightDuration(clamp(distance / 24, 0.7, 1.45)), arcHeight, receiver, {
      aerial: (restart.restartType === "corner" && !groundedCorner) || restart.restartType === "throw_in" || longGoalKick,
      headerEligible,
      settleSeconds,
      sourceAction: longGoalKick ? "goal_kick_long" : restart.restartType,
      attackingTeam: restart.restartTeam,
      passerId: taker?.id,
      passerName: taker?.name,
      receiverId: receiver.id,
    });
    const presentationKind = restart.restartType === "corner" ? "corner_kick" : restart.restartType;
    const presentationSeconds = restart.restartType === "corner" ? 1.35 : restart.restartType === "throw_in" ? 1.15 : 0.8;
    const cornerFormation = restart.restartType === "corner" ? this.cornerFormationTelemetry(restart) : undefined;
    const takerSpot = taker ? this.restartTakerTarget(restart) : null;
    const releaseMeta = {
      phase: "release",
      restartType: restart.restartType,
      presentationKind,
      presentationSeconds,
      restartPlan: restart.plan,
      takerId: taker?.id || null,
      takerName: taker?.name || null,
      takerSpot,
      receiverId: receiver.id,
      receiverName: receiver.name,
      spot: { ...restart.spot },
      targetPoint: { x: +receiver.pos.x.toFixed(2), z: +receiver.pos.z.toFixed(2) },
      distance: +distance.toFixed(2),
      arcHeight,
      aerial: (restart.restartType === "corner" && !groundedCorner) || restart.restartType === "throw_in" || longGoalKick,
      headerEligible,
      goalKickStyle: goalKickPlan?.style,
      cornerDeliveryStyle,
      contestDistance: goalKickPlan?.contestDistance === null || goalKickPlan?.contestDistance === undefined ? null : +goalKickPlan.contestDistance.toFixed(2),
      targetMiddleThird: goalKickPlan?.targetMiddleThird,
      forcedLong: goalKickPlan?.forcedLong,
      noSafeShort: goalKickPlan?.noSafeShort,
      cornerFormation,
      offsideExempt: restart.restartType === "goal_kick",
    };
    this.addLiveEvent(restart.restartTeam, this.restartAction(restart.restartType), `${taker?.label || "Restart"} to ${receiver.label}`, releaseMeta);
    this.passLog.push(this.recordEvent(this.restartAction(restart.restartType), restart.restartTeam, taker || receiver, {
      ...releaseMeta,
      target: receiver.name,
      outcome: "complete",
      offsideExempt: restart.restartType === "goal_kick",
    }));
    if (restart.restartType === "goal_kick" && taker?.role === "GK") {
      const stats = this.team(restart.restartTeam);
      stats.gkDistributions += 1;
      stats.gkDistCompleted += 1;
      this.lastKeeperKickTelemetry = {
        seq: ++this.keeperSeq,
        team: restart.restartTeam,
        keeper: taker.name,
        style: goalKickPlan?.style || "goal_kick",
        completed: true,
        distance: +distance.toFixed(2),
        target: receiver.name,
        receiverRole: receiver.role,
        arcHeight,
        aerial: longGoalKick,
        targetPoint: { x: +receiver.pos.x.toFixed(2), z: +receiver.pos.z.toFixed(2) },
        contestDistance: goalKickPlan?.contestDistance === null || goalKickPlan?.contestDistance === undefined ? null : +goalKickPlan.contestDistance.toFixed(2),
        targetMiddleThird: goalKickPlan?.targetMiddleThird,
        forcedLong: goalKickPlan?.forcedLong,
        noSafeShort: goalKickPlan?.noSafeShort,
      };
    }
    this.deferActionAfterReception(flightSeconds, settleSeconds);
    this.restartContext = null;
  }

  private executePenaltyRestart(restart: BallOutRestartContext, taker: SimplePlayer): GoalEvent | null {
    const attacking = this.team(restart.restartTeam);
    const defendingTeam = otherTeam(restart.restartTeam);
    const defending = this.team(defendingTeam);
    const keeper = this.players.find((player) => player.team === defendingTeam && player.role === "GK") || null;
    const spot = this.penaltySpotForAttack(this.attackSign(restart.restartTeam));
    this.ballFlight = null;
    this.ball.pos = { x: spot.x, y: this.ballGroundY(), z: spot.z };
    this.ball.vel = { x: 0, z: 0 };
    const goal = goalCenterForAttack(this.attackSign(restart.restartTeam));
    const targetZ = this.rng.range(-GOAL_MOUTH_HALF_Z * 0.82, GOAL_MOUTH_HALF_Z * 0.82);
    const shotTarget = { x: goal.x, z: targetZ };
    const keeperQuality = keeper?.ratings.keeper ?? 0.62;
    const missChance = clamp(0.115 - taker.ratings.shooting * 0.045, 0.055, 0.115);
    const saveChance = clamp(0.165 + keeperQuality * 0.075 - taker.ratings.shooting * 0.050, 0.115, 0.225);
    const roll = this.rng.next();
    const missed = roll < missChance;
    const saveGeometry = this.keeperSaveGeometry(keeper || undefined, spot, shotTarget, 12, 0);
    const shotDefense = this.shotDefenseSnapshot(restart.restartTeam, spot, taker, saveGeometry);
    const saveRoll = !missed && roll < missChance + saveChance;
    const saved = saveRoll && saveGeometry.reachable;
    const scored = !missed && !saved;
    const xg = 0.78;
    const distance = dist2(spot, goal);
    const distanceYards = (distance / FIELD_W) * 120;
    const decision = {
      seq: ++this.shotSeq,
      decisionType: "PENALTY_KICK",
      team: taker.team,
      shooter: taker.name,
      role: taker.role,
      style: "penalty",
      shouldShoot: true,
      distToGoal: +distance.toFixed(2),
      distToGoalYards: +distanceYards.toFixed(1),
      carrierDistToGoal: +distance.toFixed(2),
      carrierBallGap: 0,
      closePressure: 0,
      anglePenalty: 0,
      onTargetChance: +(1 - missChance).toFixed(2),
      goalChance: +(1 - missChance - saveChance).toFixed(2),
      penaltyXg: xg,
      elapsedInHalf: this.msm.clock.elapsedInHalf,
      resolutionReason: "PENALTY_KICK",
      outcome: scored ? "goal" : saved ? "saved" : "missed",
      saveRoll,
      keeperReachable: saveGeometry.reachable,
      keeperReachDistance: saveGeometry.reachDistance,
      keeperMaxReach: saveGeometry.maxReach,
      shotTarget: { x: +shotTarget.x.toFixed(2), z: +shotTarget.z.toFixed(2) },
      ...shotDefense,
    };
    this.shotDecisions.push(decision);
    this.lastShotTelemetry = decision;
    this.rememberTouch(taker);
    attacking.penaltiesTaken += 1;
    attacking.shots += 1;
    taker.stats.penaltiesTaken += 1;
    taker.stats.shots += 1;
    taker.stats.touches += 1;
    this.recordEvent("PENALTY", restart.restartTeam, taker, {
      phase: "release",
      restartType: "penalty",
      presentationKind: "penalty",
      presentationSeconds: 0.9,
      takerId: taker.id,
      takerName: taker.name,
      spot: { ...spot },
      targetPoint: { x: +shotTarget.x.toFixed(2), z: +shotTarget.z.toFixed(2) },
      outcome: decision.outcome,
      penaltyXg: xg,
    });
    this.addLiveEvent(restart.restartTeam, "PENALTY", `${taker.label} penalty`, {
      phase: "release",
      restartType: "penalty",
      presentationKind: "penalty",
      presentationSeconds: 0.9,
      takerId: taker.id,
      takerName: taker.name,
      spot: { ...spot },
      outcome: decision.outcome,
    });
    this.recordShotPositionSnapshot(restart.restartTeam, taker, spot, shotDefense);
    this.recordEvent("SHOT", restart.restartTeam, taker, {
      ...decision,
      onTarget: !missed,
    });
    this.addLiveEvent(restart.restartTeam, "SHOT", `${taker.label} penalty`);

    if (missed) {
      attacking.penaltiesMissed += 1;
      const missSide = targetZ < 0 ? -1 : 1;
      const missTarget = {
        x: goal.x + this.attackSign(restart.restartTeam) * this.rng.range(0.7, 1.5),
        z: missSide * (GOAL_MOUTH_HALF_Z + this.rng.range(0.55, 1.7)),
      };
      this.startBallFlight("miss", spot, missTarget, this.flightDuration(0.9), 0.42, undefined, {
        sourceAction: "penalty",
        attackingTeam: restart.restartTeam,
        passerId: taker.id,
        passerName: taker.name,
      });
      this.possession = null;
      return null;
    }

    attacking.shotsOnTarget += 1;
    taker.stats.shotsOnTarget += 1;
    this.recordEvent("SHOT_ON_TARGET", restart.restartTeam, taker, decision);

    if (saved) {
      attacking.penaltiesSaved += 1;
      defending.saves += 1;
      if (keeper) keeper.stats.saves += 1;
      const saveTarget = keeper?.pos || { x: goal.x - this.attackSign(restart.restartTeam) * 0.55, z: 0 };
      const diveDirection = this.keeperDiveDirection(keeper || undefined, shotTarget);
      const saveMeta = {
        shooter: taker.name,
        keeper: keeper?.name || "Keeper",
        diveDirection,
        fieldResolved: true,
        contactSource: "keeper_reachable_penalty_save",
        keeperReachable: saveGeometry.reachable,
        keeperReachDistance: saveGeometry.reachDistance,
        keeperMaxReach: saveGeometry.maxReach,
        contactPoint: saveGeometry.contactPoint,
        shotOrigin: { x: +spot.x.toFixed(2), z: +spot.z.toFixed(2) },
        shotTarget: { x: +shotTarget.x.toFixed(2), z: +shotTarget.z.toFixed(2) },
        saveTarget: { x: +saveTarget.x.toFixed(2), z: +saveTarget.z.toFixed(2) },
        resolutionReason: "PENALTY_KICK",
      };
      this.recordEvent("SAVE", defendingTeam, keeper || taker, saveMeta);
      this.addLiveEvent(defendingTeam, "SAVE", keeper ? keeper.label : "GK", saveMeta);
      this.startBallFlight("save", spot, saveTarget, this.flightDuration(0.65), 0.55, keeper || undefined, {
        sourceAction: "penalty",
        attackingTeam: restart.restartTeam,
        passerId: taker.id,
        passerName: taker.name,
        contactSource: saveMeta.contactSource,
        contactPoint: saveMeta.contactPoint,
        keeperReachDistance: saveMeta.keeperReachDistance,
        keeperMaxReach: saveMeta.keeperMaxReach,
      });
      this.installKeeperPossession(defendingTeam);
      return null;
    }

    attacking.penaltiesScored += 1;
    taker.stats.penaltiesScored += 1;
    attacking.score += 1;
    taker.stats.goals += 1;
    const netTarget = this.goalNetTarget(restart.restartTeam, shotTarget);
    const goalRow = {
      team: restart.restartTeam,
      playerName: taker.name,
      scorer: taker.name,
      shirtNumber: taker.shirtNumber,
      role: taker.role,
      matchMinute: getMatchMinute(this.msm),
      elapsedInHalf: this.msm.clock.elapsedInHalf,
      distToGoal: distance,
      distToGoalYards: +distanceYards.toFixed(1),
      carrierDistToGoal: +distance.toFixed(2),
      carrierBallGap: 0,
      maxGoalDistanceYards: 12,
      invalidGoalGeometry: false,
      resolutionReason: "PENALTY_KICK",
      goalChance: +(1 - missChance - saveChance).toFixed(2),
      penaltyXg: xg,
      shotTarget: { x: +shotTarget.x.toFixed(2), z: +shotTarget.z.toFixed(2) },
      netTarget: { x: +netTarget.x.toFixed(2), z: +netTarget.z.toFixed(2) },
      shotBacked: true,
      ...shotDefense,
    };
    this.goalLog.push(goalRow);
    this.recordEvent("GOAL", restart.restartTeam, taker, goalRow);
    this.addLiveEvent(restart.restartTeam, "GOAL", `${taker.name} ${goalRow.matchMinute}'`, {
      shotOrigin: { x: +spot.x.toFixed(2), z: +spot.z.toFixed(2) },
      shotTarget: { x: +shotTarget.x.toFixed(2), z: +shotTarget.z.toFixed(2) },
      netTarget: { x: +netTarget.x.toFixed(2), y: this.ballGroundY(), z: +netTarget.z.toFixed(2) },
      resolutionReason: "PENALTY_KICK",
    });
    this.goalNetSettleRemaining = 0;
    this.goalKickoffSetupInstalled = false;
    this.startBallFlight("shot", spot, netTarget, this.flightDuration(0.65), 0.65, undefined, {
      sourceAction: "penalty",
      attackingTeam: restart.restartTeam,
      passerId: taker.id,
      passerName: taker.name,
    });
    this.possession = null;
    return { scoringTeam: teamSide(restart.restartTeam) };
  }

  private goalKickRestartPlan(restart: BallOutRestartContext, takerId?: string, plannedLong?: boolean): GoalKickRestartPlan {
    const shortReceiver = this.restartReceiver(restart, takerId);
    const attackSign = this.attackSign(restart.restartTeam);
    const noSafeShort = !this.hasSafeShortKeeperOutlet(restart.restartTeam, restart.spot, takerId);
    const scoredLongOptions = this.keeperLongDistributionOptions(restart.restartTeam, restart.spot, takerId);

    const useLong = scoredLongOptions.length > 0 && (plannedLong ?? (noSafeShort || this.rng.next() < GOAL_KICK_LONG_CHANCE));
    if (useLong) {
      const selected = scoredLongOptions[0];
      return {
        receiver: selected.player,
        style: "goal_kick_long",
        contestDistance: selected.contestDistance,
        targetMiddleThird: selected.targetMiddleThird,
        forcedLong: noSafeShort,
        noSafeShort,
      };
    }

    return {
      receiver: shortReceiver,
      style: "goal_kick",
      contestDistance: shortReceiver ? this.nearestOpponentDistance(shortReceiver.pos, restart.restartTeam) : null,
      targetMiddleThird: shortReceiver ? Math.abs(shortReceiver.pos.x) <= FIELD_W / 6 + 5 : false,
      forcedLong: false,
      noSafeShort,
    };
  }

  private hasSafeShortKeeperOutlet(team: SimpleTeamCode, origin: Vec2, takerId?: string) {
    return this.players.some((player) => {
      if (player.team !== team || player.id === takerId || player.role === "GK") return false;
      const distanceYards = dist2(origin, player.pos) / FIELD_SCALE_PER_YARD;
      if (distanceYards < 5 || distanceYards > 26) return false;
      const separation = this.nearestDefenderDistance(player, otherTeam(team));
      return separation / FIELD_SCALE_PER_YARD >= 5.5;
    });
  }

  private keeperLongDistributionOptions(team: SimpleTeamCode, origin: Vec2, takerId?: string) {
    const attackSign = this.attackSign(team);
    const middleThirdLimit = FIELD_W / 6;
    const primary = this.players
      .filter((player) => player.team === team && player.id !== takerId && player.role !== "GK")
      .map((player) => {
        const distance = dist2(origin, player.pos);
        const distanceYards = distance / FIELD_SCALE_PER_YARD;
        const progress = (player.pos.x - origin.x) * attackSign;
        const roleBonus = player.role === "ST" ? 6 : player.role === "AM" ? 5 : player.role === "W" ? 4 : player.role === "CM" ? 3 : 0;
        const centrality = Math.max(0, 8 - Math.abs(player.pos.z) * 0.4);
        const targetMiddleThird = Math.abs(player.pos.x) <= middleThirdLimit + 5;
        const middleThirdBonus = Math.abs(player.pos.x) <= middleThirdLimit ? 5 : targetMiddleThird ? 2 : 0;
        const contestDistance = this.nearestOpponentDistance(player.pos, team);
        const contestBonus = contestDistance === null ? 2 : clamp(contestDistance / FIELD_SCALE_PER_YARD - 2, -2, 5);
        return { player, distance, distanceYards, progress, contestDistance, targetMiddleThird, score: progress + roleBonus + centrality + middleThirdBonus + contestBonus };
      })
      .filter((option) => (
        option.progress > 0
        && option.distanceYards >= GOAL_KICK_LONG_MIN_YARDS
        && option.distanceYards <= GOAL_KICK_LONG_MAX_YARDS
        && option.targetMiddleThird
      ))
      .sort((a, b) => b.score - a.score);
    if (primary.length) return primary;

    return this.players
      .filter((player) => player.team === team && player.id !== takerId && player.role !== "GK")
      .map((player) => {
        const distance = dist2(origin, player.pos);
        const distanceYards = distance / FIELD_SCALE_PER_YARD;
        const progress = (player.pos.x - origin.x) * attackSign;
        const targetMiddleThird = Math.abs(player.pos.x) <= middleThirdLimit + 8;
        const contestDistance = this.nearestOpponentDistance(player.pos, team);
        return {
          player,
          distance,
          distanceYards,
          progress,
          contestDistance,
          targetMiddleThird,
          score: progress + (targetMiddleThird ? 5 : 0) - Math.abs(distanceYards - 42) * 0.16,
        };
      })
      .filter((option) => option.progress > 0 && option.distanceYards >= GOAL_KICK_LONG_MIN_YARDS * 0.8 && option.distanceYards <= GOAL_KICK_LONG_MAX_YARDS)
      .sort((a, b) => b.score - a.score);
  }

  private nearestOpponentDistance(pos: Vec2, team: SimpleTeamCode) {
    const opponent = otherTeam(team);
    let nearest: number | null = null;
    for (const player of this.players) {
      if (player.team !== opponent) continue;
      const distance = dist2(pos, player.pos);
      if (nearest === null || distance < nearest) nearest = distance;
    }
    return nearest;
  }

  private restartReceiver(restart: BallOutRestartContext, takerId?: string) {
    const attackSign = this.attackSign(restart.restartTeam);
    const candidates = this.players
      .filter((player) => player.team === restart.restartTeam && player.id !== takerId && player.role !== "GK")
      .sort((a, b) => {
        if (restart.restartType === "corner") {
          const goal = goalCenterForAttack(attackSign);
          const nearSide = restart.spot.z >= 0 ? 1 : -1;
          // Where the routine wants the ball: the flag for a short one, the top
          // of the D for a lay-off, otherwise the loaded post.
          const target = restart.plan === "corner_short"
            ? { x: restart.spot.x - attackSign * 3.2, z: restart.spot.z - nearSide * 3.0 }
            : restart.plan === "corner_edge"
              ? { x: goal.x - attackSign * 12.6, z: 0.4 }
              : { x: goal.x - attackSign * 4.8, z: (restart.plan === "corner_far_post" ? -nearSide : nearSide) * 3.5 };
          return dist2(a.pos, target) - dist2(b.pos, target);
        }
        return dist2(a.pos, restart.spot) - dist2(b.pos, restart.spot);
      });
    return candidates[0] || null;
  }

  private restartPlanFor(restart: BallOutRestartContext, taker: SimplePlayer | null): NonNullable<BallOutRestartContext["plan"]> {
    // A routine the player called wins; otherwise the CPU picks its own.
    if (restart.planChosenBy === restart.restartTeam && restart.plan) return restart.plan;
    if (restart.restartType === "corner") return (taker?.shirtNumber ?? 0) % 2 === 0 ? "corner_far_post" : "corner_near_post";
    if (restart.restartType === "throw_in") return "throw_short";
    if (restart.restartType === "goal_kick") return this.goalKickRestartPlan(restart, taker?.id).style === "goal_kick_long" ? "goal_kick_long" : "goal_kick_short";
    if (restart.restartType === "penalty") return "penalty";
    return "free_kick_direct";
  }

  private restartAction(type: BallOutEvent["restartType"]) {
    if (type === "throw_in") return "THROW_IN";
    if (type === "goal_kick") return "GOAL_KICK";
    if (type === "corner") return "CORNER";
    if (type === "penalty") return "PENALTY";
    return "FREE_KICK";
  }

  private installKeeperPossession(team: SimpleTeamCode) {
    const keeper = this.players.find((p) => p.team === team && p.role === "GK");
    if (!keeper) return;
    this.possession = keeper;
    this.rememberTouch(keeper);
    this.addLiveEvent(team, "GK", "keeper possession");
  }

  private startBallFlight(kind: BallFlightKind, from: Vec2, to: Vec2, duration: number, arc: number, followPlayer?: SimplePlayer, options: BallFlightOptions = {}) {
    this.ballVelY = 0;
    const previousFlightTelemetry = this.ballFlight ? this.ballFlightTelemetry.at(-1) : null;
    const start = this.ballFlight ? { x: this.ball.pos.x, z: this.ball.pos.z } : { ...from };
    const target = { x: to.x, z: to.z };
    const distanceUnits = dist2(start, target);
    const distanceYards = distanceUnits / FIELD_SCALE_PER_YARD;
    // The passed duration is only a readability hint -- real pace comes from the
    // target speed, so charge power has to scale that to be felt.
    const speedScale = clamp(options.speedMultiplier ?? 1, 0.5, 1.6);
    const targetSpeedMps = this.ballFlightTargetSpeedMps(kind, distanceYards) * speedScale;
    const speedDuration = (distanceYards * 0.9144) / targetSpeedMps;
    const minDuration = kind === "shot" || kind === "save" || kind === "miss" ? 0.12 : 0.18;
    const readabilityDuration = kind === "shot" || kind === "save" || kind === "miss" ? 0 : Math.min(duration * 0.45, 0.18);
    const maxDuration = kind === "shot" || kind === "save" || kind === "miss" ? 3.2 : 2.4;
    const safeDuration = clamp(Math.max(0.001, speedDuration, readabilityDuration), minDuration, maxDuration);
    const speedUnitsPerSecond = distanceUnits / safeDuration;
    const speedYardsPerSecond = distanceYards / safeDuration;
    const flightArc = this.ballFlightArc(kind, distanceYards, arc);
    const headerEligible = !!options.headerEligible && (flightArc >= HEADER_MIN_ARC || kind === "restart");
    this.ballFlight = {
      kind,
      from: start,
      to: target,
      followPlayerId: followPlayer?.id,
      settleSeconds: options.settleSeconds,
      aerial: !!options.aerial || headerEligible,
      headerEligible,
      launchHeight: options.launchHeight,
      sourceAction: options.sourceAction,
      attackingTeam: options.attackingTeam,
      passerId: options.passerId,
      passerName: options.passerName,
      receiverId: options.receiverId || followPlayer?.id,
      contactSource: options.contactSource,
      contactPoint: options.contactPoint,
      keeperReachDistance: options.keeperReachDistance,
      keeperMaxReach: options.keeperMaxReach,
      elapsed: 0,
      duration: safeDuration,
      arc: flightArc,
    };
    const launchElapsedInHalf = this.ballFlight && previousFlightTelemetry && previousFlightTelemetry.seq === this.ballFlightSeq
      ? +(previousFlightTelemetry.elapsedInHalf + previousFlightTelemetry.durationSeconds).toFixed(2)
      : +this.msm.clock.elapsedInHalf.toFixed(2);
    const launchElapsedWallSeconds = this.ballFlight && previousFlightTelemetry?.elapsedWallSeconds != null && previousFlightTelemetry.seq === this.ballFlightSeq
      ? +(previousFlightTelemetry.elapsedWallSeconds + previousFlightTelemetry.durationSeconds).toFixed(3)
      : +this.elapsedTotal.toFixed(3);
    this.ballFlightTelemetry.push({
      seq: ++this.ballFlightSeq,
      kind,
      minute: getMatchMinute(this.msm),
      half: this.msm.clock.half,
      elapsedInHalf: launchElapsedInHalf,
      elapsedWallSeconds: launchElapsedWallSeconds,
      distance: +distanceUnits.toFixed(2),
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
      aerial: !!options.aerial || headerEligible,
      headerEligible,
      launchHeight: options.launchHeight,
      sourceAction: options.sourceAction,
      attackingTeam: options.attackingTeam,
      passerId: options.passerId,
      passerName: options.passerName,
      receiverId: options.receiverId || followPlayer?.id,
      contactSource: options.contactSource,
      contactPoint: options.contactPoint,
      keeperReachDistance: options.keeperReachDistance,
      keeperMaxReach: options.keeperMaxReach,
      settleSeconds: options.settleSeconds == null ? undefined : +options.settleSeconds.toFixed(2),
      arc: +flightArc.toFixed(3),
    });
    if (this.ballFlightTelemetry.length > 2400) this.ballFlightTelemetry.shift();
    this.ball.pos.x = start.x;
    this.ball.pos.y = this.ballGroundY();
    this.ball.pos.z = start.z;
    this.ball.vel = distanceUnits > 0.001
      ? { x: ((target.x - start.x) / distanceUnits) * speedUnitsPerSecond, z: ((target.z - start.z) / distanceUnits) * speedUnitsPerSecond }
      : { x: 0, z: 0 };
    return safeDuration;
  }

  private deferActionAfterReception(flightSeconds: number, settleSeconds: number) {
    this.actionTimer = Math.max(this.actionTimer, flightSeconds + settleSeconds + 0.001);
  }

  private finalizeActiveReceptionTelemetryForPlayer(player: SimplePlayer | null | undefined, resolvedBy: string) {
    if (!player || !this.activeReceptionTelemetry) return;
    if (this.activeReceptionTelemetry.playerId !== player.id) return;
    const receive = this.activeReceptionTelemetry;
    for (let i = this.ballFlightTelemetry.length - 1; i >= 0; i--) {
      const flight = this.ballFlightTelemetry[i];
      if (flight.seq !== receive.flightSeq) continue;
      const hold = Math.max(0, this.elapsedTotal - receive.receivedAtWall);
      flight.realizedHoldSeconds = +hold.toFixed(2);
      flight.holdResolvedBy = resolvedBy;
      break;
    }
    this.activeReceptionTelemetry = null;
  }

  private visibleReceptionHoldSeconds() {
    const hold = this.rng.range(VISIBLE_RECEPTION_HOLD_MIN_SECONDS, VISIBLE_RECEPTION_HOLD_MAX_SECONDS);
    const compression = this.productionCompression();
    if (compression <= 1.01) return hold;
    return this.rng.range(1.10, 1.50);
  }

  private ballGroundY() {
    return 0.18;
  }

  private ballFlightArc(kind: BallFlightKind, distanceYards: number, requestedArc: number) {
    if (kind === "pass" || kind === "restart") {
      if (requestedArc > 0.5) return Math.min(requestedArc, 1.45);
      // Arc is peak height in world units (~1.67 m each), so knee is ~0.30,
      // waist ~0.55 and head ~1.00. The band above used to be pinned just under
      // HEADER_MIN_ARC (0.18 -- barely shin height) on the theory that clearing
      // it turned midfield passes into headed arrivals. It does not:
      // resolveAerialHeaderOnArrival needs flight.headerEligible, which ordinary
      // passes never set, so the ceiling only kept the ball on the carpet. It
      // measured at 5.1% of match time above knee height.
      //
      // Short and midfield balls still travel along the deck -- that is what a
      // 20-yard pass looks like, and mid-flight collection depends on it
      // (MID_FLIGHT_COLLECT_MAX_HEIGHT). The height belongs on the long ones.
      //
      // A caller asking for a very flat arc means a driven ball played into
      // space, so honour that at any distance rather than lofting it over the
      // runner chasing it.
      const driven = requestedArc < 0.2;
      // A restart that explicitly asks to stay flat means it: a short corner or
      // a lay-off to the D is played to feet however far the receiver happens
      // to be standing. Without this the distance curve lofted them to 0.48 and
      // the "grounded" corner was grounded in name only.
      if (kind === "restart" && driven) return requestedArc;
      if (distanceYards <= 12) return 0.06;
      if (distanceYards <= 28) return lerpNumber(0.07, 0.13, clamp((distanceYards - 12) / 16, 0, 1));
      if (distanceYards <= 42) return lerpNumber(0.20, 0.45, clamp((distanceYards - 28) / 14, 0, 1));
      if (driven) return lerpNumber(0.30, 0.48, clamp((distanceYards - 42) / 24, 0, 1));
      return Math.max(requestedArc, lerpNumber(0.72, 1.05, clamp((distanceYards - 42) / 24, 0, 1)));
    }
    if (kind === "interception") return requestedArc > 0.5 ? Math.min(requestedArc, 1.05) : Math.min(requestedArc, 0.10);
    if (kind === "save") return Math.min(requestedArc, 0.22);
    if (kind === "shot") return Math.min(requestedArc, 0.30);
    if (kind === "miss") return Math.min(requestedArc, 0.38);
    return Math.min(requestedArc, 0.18);
  }

  private nextActionDelay() {
    const carrier = this.possession;
    if (carrier && carrier.role !== "GK" && this.runtimeHalfDuration >= 1800) {
      return clamp(this.fullLengthOutfieldCadenceDelay(carrier), 0.03, 8.5);
    }
    if (carrier && carrier.role !== "GK") {
      return clamp(this.compressedOutfieldCadenceDelay(carrier), 0.03, 8.5);
    }
    const tempo = this.effectiveTuning(this.possession?.team || "A").tempo;
    const baseDelay = clamp(4.75 - tempo * 1.25 + this.rng.range(-0.8, 1.1), 2.75, 6.25);
    return clamp((baseDelay * BALL_HOLD_TIME_MULTIPLIER * this.underproducingCadenceScale()) / this.productionCompression(), 0.03, 8.5);
  }

  private fullLengthOutfieldCadenceDelay(carrier: SimplePlayer) {
    const tempo = this.effectiveTuning(carrier.team).tempo;
    const distToGoal = dist2(carrier.pos, goalCenterForAttack(this.attackSign(carrier.team)));
    const zone = this.zoneForDist(distToGoal);
    const pressure = this.pressureOn(carrier);
    const zoneWindow = zone === "BUILDUP"
      ? { min: 5.18, max: 7.56 }
      : zone === "PROGRESSION"
        ? { min: 3.78, max: 5.87 }
        : zone === "CHANCE_CREATION"
          ? { min: 2.52, max: 3.93 }
          : { min: 1.14, max: 1.6 };
    const roleOffset = carrier.role === "CB" ? 0.28
      : carrier.role === "CM" ? 0.12
        : carrier.role === "FB" ? 0.06
          : carrier.role === "W" ? -0.10
            : carrier.role === "AM" ? -0.16
              : carrier.role === "ST" ? -0.20
                : 0;
    const tempoScale = lerpNumber(1.08, 0.90, tempo);
    const pressureScale = lerpNumber(1.0, 0.84, clamp(pressure / 1.3, 0, 1));
    const underproductionScale = this.underproducingCadenceScale();
    const base = this.rng.range(zoneWindow.min, zoneWindow.max) + roleOffset;
    return Math.max(0.42, base * tempoScale * pressureScale * underproductionScale);
  }

  private compressedOutfieldCadenceDelay(carrier: SimplePlayer) {
    const tempo = this.effectiveTuning(carrier.team).tempo;
    const distToGoal = dist2(carrier.pos, goalCenterForAttack(this.attackSign(carrier.team)));
    const zone = this.zoneForDist(distToGoal);
    const pressure = this.pressureOn(carrier);
    const zoneWindow = zone === "BUILDUP"
      ? { min: 4.9, max: 7.1 }
      : zone === "PROGRESSION"
        ? { min: 3.5, max: 5.3 }
        : zone === "CHANCE_CREATION"
          ? { min: 2.1, max: 3.4 }
          : { min: 0.96, max: 1.42 };
    const roleOffset = carrier.role === "CB" ? 0.24
      : carrier.role === "CM" ? 0.12
        : carrier.role === "FB" ? 0.08
          : carrier.role === "DM" ? 0.10
            : carrier.role === "W" ? -0.04
              : carrier.role === "AM" ? -0.08
                : carrier.role === "ST" ? -0.12
                  : 0;
    const tempoScale = lerpNumber(1.06, 0.92, tempo);
    const pressureScale = lerpNumber(1.0, 0.82, clamp(pressure / 1.3, 0, 1));
    const runtimeScale = this.runtimeHalfDuration <= 150
      ? 1.18
      : this.runtimeHalfDuration <= 300
        ? 1.07
        : this.runtimeHalfDuration <= 900
          ? 1.06
          : 1.0;
    const compressedPassLagScale = (zone === "BUILDUP" || zone === "PROGRESSION")
      ? this.compressedPassLagCadenceScale()
      : 1;
    const base = this.rng.range(zoneWindow.min, zoneWindow.max) + roleOffset;
    return Math.max(0.48, base * tempoScale * pressureScale * runtimeScale * compressedPassLagScale);
  }

  private compressedPassLagCadenceScale() {
    if (this.runtimeHalfDuration > 300) return 1;
    const totalPasses = this.teamA.passes + this.teamB.passes;
    const totalMatchSeconds = Math.max(1, this.runtimeHalfDuration * 2);
    const progress = clamp(this.elapsedTotal / totalMatchSeconds, 0, 1);
    if (progress >= 0.70 && totalPasses < 82) return 0.90;
    if (progress >= 0.55 && totalPasses < 66) return 0.94;
    if (progress >= 0.40 && totalPasses < 48) return 0.97;
    return 1;
  }

  private underproducingCadenceScale() {
    const carrier = this.possession;
    if (!carrier || this.runtimeHalfDuration < 1800) return 1;
    if (this.elapsedTotal < 8 * 60) return 1;
    const totalShots = this.teamA.shots + this.teamB.shots;
    const totalPasses = this.teamA.passes + this.teamB.passes;
    if (totalShots >= 24 || totalPasses >= 320) return 1;
    const distToGoal = dist2(carrier.pos, goalCenterForAttack(this.attackSign(carrier.team)));
    if (this.isInAttackingPenaltyArea(carrier) || distToGoal < 10) return 1;
    if (carrier.role === "CB" || carrier.role === "CM") return 0.84;
    if (carrier.role === "W" || carrier.role === "FB") return 0.88;
    return 0.92;
  }

  private productionCompression() {
    const halfDuration = Math.max(1, this.runtimeHalfDuration);
    return clamp(1 + 9.40 * (2700 / halfDuration - 1), 1, 96);
  }

  private fullLengthContinuationOutletPhase(
    carrier: SimplePlayer | null | undefined,
    zone?: "BUILDUP" | "PROGRESSION" | "CHANCE_CREATION" | "FINISH",
  ) {
    if (!carrier || carrier.role === "GK" || this.runtimeHalfDuration < 1800) return false;
    const carrierZone = zone || this.zoneForDist(dist2(carrier.pos, goalCenterForAttack(this.attackSign(carrier.team))));
    if (carrierZone !== "BUILDUP" && carrierZone !== "PROGRESSION") return false;
    if (this.elapsedTotal < 6 * 60) return false;
    const totalMatchSeconds = Math.max(1, this.runtimeHalfDuration * 2);
    const elapsedRatio = clamp(this.elapsedTotal / totalMatchSeconds, 0, 1);
    const expectedPassesByNow = 927 * elapsedRatio;
    const expectedCompletedPassesByNow = 742.5 * elapsedRatio;
    const totalPasses = this.teamA.passes + this.teamB.passes;
    const totalCompletedPasses = this.teamA.passesCompleted + this.teamB.passesCompleted;
    return totalPasses < expectedPassesByNow * 0.95
      || totalCompletedPasses < expectedCompletedPassesByNow * 0.95;
  }

  private recordFullLengthPossessionDiagnostic(
    kind: "no_safe_outlet_pass_fail" | "speculative_pass_interception" | "non_danger_terminal_shot",
    carrier: SimplePlayer,
    detail: Record<string, unknown>,
  ) {
    if (this.runtimeHalfDuration < 1800) return;
    const distToGoal = dist2(carrier.pos, goalCenterForAttack(this.attackSign(carrier.team)));
    const zone = this.zoneForDist(distToGoal);
    if (zone !== "BUILDUP" && zone !== "PROGRESSION") return;
    if (kind === "no_safe_outlet_pass_fail") this.fullLengthPossessionDiagnostics.noSafeOutletPassFails += 1;
    else if (kind === "speculative_pass_interception") {
      this.fullLengthPossessionDiagnostics.speculativePassInterceptions += 1;
      const attemptedDistance = Number(detail.distance);
      if (Number.isFinite(attemptedDistance)) {
        if (attemptedDistance < 14) this.fullLengthPossessionDiagnostics.speculativeInterceptionDistanceBands.lt14 += 1;
        else if (attemptedDistance < 16) this.fullLengthPossessionDiagnostics.speculativeInterceptionDistanceBands.y14_16 += 1;
        else if (attemptedDistance < 18) this.fullLengthPossessionDiagnostics.speculativeInterceptionDistanceBands.y16_18 += 1;
        else this.fullLengthPossessionDiagnostics.speculativeInterceptionDistanceBands.gte18 += 1;
      }
      const receiverSeparation = Number(detail.receiverSeparation);
      if (Number.isFinite(receiverSeparation)) {
        if (receiverSeparation < 2.5) this.fullLengthPossessionDiagnostics.speculativeInterceptionSeparationBands.lt2_5 += 1;
        else if (receiverSeparation < 3.5) this.fullLengthPossessionDiagnostics.speculativeInterceptionSeparationBands.y2_5_3_5 += 1;
        else if (receiverSeparation < 4.5) this.fullLengthPossessionDiagnostics.speculativeInterceptionSeparationBands.y3_5_4_5 += 1;
        else this.fullLengthPossessionDiagnostics.speculativeInterceptionSeparationBands.gte4_5 += 1;
      }
    }
    else this.fullLengthPossessionDiagnostics.nonDangerTerminalShots += 1;
    this.fullLengthPossessionDiagnostics.samples.push({
      kind,
      minute: getMatchMinute(this.msm),
      half: this.msm.clock.half,
      elapsedInHalf: +this.msm.clock.elapsedInHalf.toFixed(2),
      team: carrier.team,
      role: carrier.role,
      zone,
      x: +carrier.pos.x.toFixed(2),
      z: +carrier.pos.z.toFixed(2),
      ...detail,
    });
    if (this.fullLengthPossessionDiagnostics.samples.length > 1000) {
      this.fullLengthPossessionDiagnostics.samples.splice(0, this.fullLengthPossessionDiagnostics.samples.length - 1000);
    }
  }

  private flightDuration(baseDuration: number) {
    return clamp(baseDuration, 0.55, 1.35);
  }

  /**
   * Where a pass should actually land.
   *
   * Played at the receiver's feet he has no reason to move, which is why only
   * 3% of receivers moved toward the ball. Played ahead of him he has to come
   * and get it. The lead is capped by what he can physically cover during the
   * flight, or the ball lands in space nobody reaches and the run looks broken
   * (auditFlightLanding flags a gap over 1.6u).
   */
  private passLandingPoint(origin: Vec2, receiver: Vec2, distance: number, leadReceiver: boolean, receiverPace = 0.5) {
    if (!leadReceiver) return { ...receiver };
    const direction = normalize2({ x: receiver.x - origin.x, z: receiver.z - origin.z });
    const flightSeconds = this.flightDuration(clamp(distance / 24, 0.65, 1.25));
    const receiverSpeed = BASE_RUN_SPEED * (0.42 + receiverPace * 0.58);
    const reachable = Math.max(0, receiverSpeed * flightSeconds * PASS_LEAD_REACH_FRACTION);
    const lead = Math.min(
      clamp((distance - PASS_LEAD_MIN_DISTANCE) * 0.12, PASS_LEAD_MIN, PASS_LEAD_MAX),
      reachable,
    );
    return clampToPlayable({
      x: receiver.x + direction.x * lead,
      z: receiver.z + direction.z * lead,
    });
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
    if (flight.sourceAction === "header_clearance") return;
    if (flight.sourceAction === "keeper_parry_corner") return;
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
    if (this.msm.state.kind !== "live_play") return 1;
    const minute = this.simulatedMatchMinute();
    const shotLoad = this.totalShots();
    const volumeBoost = shotLoad < 10 ? 1.24 : shotLoad < 18 ? 1.14 : shotLoad < 26 ? 1.07 : 1;
    const phaseBoost = minute < 30 ? 1.12 : minute < 75 ? 1.05 : 1;
    return clamp(volumeBoost * phaseBoost, 1, 1.28);
  }

  private shotTarget(team: SimpleTeamCode, onTarget: boolean, anglePenalty: number, aimLateral: number | null = null, manual = false): Vec2 {
    const goal = goalCenterForAttack(this.attackSign(team));
    const span = GOAL_MOUTH_HALF_Z * 0.75;
    if (onTarget) {
      if (aimLateral !== null) {
        // Tight spread for a deliberate shot: aiming should place the ball,
        // not merely nudge it.
        const spread = this.rng.range(-0.18, 0.18) * span;
        return { x: goal.x, z: clamp(aimLateral * span + spread, -span, span) };
      }
      return { x: goal.x, z: this.rng.range(-span, span) };
    }
    const missSide = aimLateral !== null && Math.abs(aimLateral) > 0.25
      ? Math.sign(aimLateral)
      : this.rng.next() < 0.5 ? -1 : 1;
    if (manual) {
      // A missed manual shot goes narrowly wide, not spraying across the pitch.
      return {
        x: goal.x + this.attackSign(team) * this.rng.range(0.6, 1.8),
        z: missSide * (GOAL_MOUTH_HALF_Z + this.rng.range(0.25, 1.5)),
      };
    }
    const missZ = missSide * (GOAL_MOUTH_HALF_Z + this.rng.range(0.8, 4.2 + anglePenalty * 2));
    return { x: goal.x + this.attackSign(team) * this.rng.range(0.6, 1.8), z: missZ };
  }

  private shouldHitWoodwork(distToGoalYards: number, anglePenalty: number, pressure: number) {
    if (distToGoalYards > 28 || anglePenalty > 0.62 || pressure > 1.8) return false;
    const chance = clamp(0.025 + (28 - distToGoalYards) * 0.0014 - anglePenalty * 0.018, 0.008, 0.055);
    return this.rng.next() < chance;
  }

  private woodworkTarget(team: SimpleTeamCode, forcedPart?: "crossbar" | "post"): Vec2 & { framePart: "crossbar" | "post" } {
    const attackSign = this.attackSign(team);
    const goal = goalCenterForAttack(attackSign);
    const framePart: "crossbar" | "post" = forcedPart || (this.rng.next() < 0.68 ? "crossbar" : "post");
    const side = this.rng.next() < 0.5 ? -1 : 1;
    const outsidePostZ = side * (GOAL_MOUTH_HALF_Z + this.rng.range(0.04, 0.18));
    return {
      x: goal.x + attackSign * this.rng.range(0.35, 0.95),
      z: outsidePostZ,
      framePart,
    };
  }

  private goalNetTarget(team: SimpleTeamCode, mouthTarget: Vec2): Vec2 {
    const attackSign = this.attackSign(team);
    const goal = goalCenterForAttack(attackSign);
    const halfWidth = Math.max(0.6, GOAL_MOUTH_HALF_Z - 0.12);
    return {
      x: goal.x + attackSign * GOAL_FLOOR_DEPTH * 0.75,
      z: clamp(mouthTarget.z * 0.5, -halfWidth * 0.6, halfWidth * 0.6),
    };
  }

  private keeperDiveDirection(keeper: SimplePlayer | undefined, shotTarget: Vec2): KeeperDiveDirection {
    if (!keeper) return "down";
    const lateral = shotTarget.z - keeper.pos.z;
    if (Math.abs(lateral) > 0.45) return lateral < 0 ? "left" : "right";
    const goalward = Math.abs(shotTarget.x - keeper.pos.x);
    return goalward > 1.2 ? "up" : "down";
  }

  private bestPassTarget(carrier: SimplePlayer, options: PassTargetOptions = {}) {
    const attackSign = this.attackSign(carrier.team);
    const own = this.players.filter((p) => p.team === carrier.team && p.id !== carrier.id && p.role !== "GK");
    // Occasionally go long. The model otherwise plays ~11 balls of 32+ yards per
    // 90 minutes against roughly 50 in real football, which is why nothing is
    // ever contested in the air: run-of-play headers need long balls to exist
    // before they can be won. Measured in scripts/longball-scope.mjs.
    const longBallBias = this.effectiveLongBallBias();
    if (longBallBias > 0 && !options.direction && this.rng.next() < longBallBias) {
      const target = this.bestLongBallTarget(carrier, own, attackSign);
      if (target) return target;
    }
    if (options.direction) {
      const length = Math.hypot(options.direction.x, options.direction.z);
      if (length > 0.15) {
        const direction = { x: options.direction.x / length, z: options.direction.z / length };
        const ranked = own
          .map((player) => {
            const dx = player.pos.x - carrier.pos.x;
            const dz = player.pos.z - carrier.pos.z;
            const distance = Math.hypot(dx, dz);
            const alignment = distance > 0.1 ? (dx * direction.x + dz * direction.z) / distance : -1;
            return { player, distance, alignment };
          })
          .filter(({ distance }) => distance >= 1.5)
          .sort((a, b) => b.alignment - a.alignment || a.distance - b.distance);
        // An explicit aim is an instruction, not a hint. Prefer a well-aligned
        // outlet, then anything not behind, then simply the best available.
        // Falling through to the CPU chooser (as this used to when the cone was
        // empty) silently turned an aimed forward ball into a backwards pass.
        // The aim arrow is a promise about where the ball goes, so only a
        // team-mate genuinely near the aim ray may receive it. A wide cone plus
        // distance-ranked picking sent 75% of passes more than 45 degrees off
        // the arrow. If nobody is on the line, return null and let the caller
        // play the ball into that space instead.
        const range = this.aimedPassRange(options.power);
        const corridor = ranked
          .map((candidate) => {
            const dx = candidate.player.pos.x - carrier.pos.x;
            const dz = candidate.player.pos.z - carrier.pos.z;
            const along = dx * direction.x + dz * direction.z;
            const lateral = Math.abs(dx * -direction.z + dz * direction.x);
            return { ...candidate, along, lateral };
          })
          // Angular gate, not a fixed corridor: a 4.5u offset is a gentle miss
          // at 30u range but a 29-degree error at 8u.
          .filter((candidate) => candidate.along > 1.5 && candidate.alignment >= AIMED_PASS_MIN_ALIGNMENT)
          // Never hand the aim an offside receiver. The CPU chooser filters
          // these out, this branch did not, so aiming forward picked the most
          // advanced team-mate and the pass was flagged the instant it left --
          // 3.6% of aimed lobs and 9.7% of aimed passes against 0.2% for the
          // CPU's own picks. Dropping them here lets the caller play the ball
          // into the space instead, which is what the arrow promised anyway.
          .filter((candidate) => !this.offsideInfraction(carrier, candidate.player, carrier.pos))
          // Prefer the one closest to where the charge says the ball lands.
          .sort((a, b) => (Math.abs(a.along - range) + a.lateral * 1.4) - (Math.abs(b.along - range) + b.lateral * 1.4));
        if (corridor.length) return corridor[0].player;
        return null;
      }
    }
    const deliveryTarget = this.bestWideDeliveryTarget(carrier, own);
    if (deliveryTarget) return deliveryTarget;
    const carrierDistToGoal = dist2(carrier.pos, goalCenterForAttack(attackSign));
    const finalThirdCarrier = this.isFinalThirdCarrier(carrier, carrierDistToGoal);
    const carrierZone = this.zoneForDist(carrierDistToGoal);
    const fiveMinuteContinuationDamping = this.runtimeHalfDuration > 150 && this.runtimeHalfDuration <= 300;
    const fiveMinuteFinalThirdRecycleClamp = this.runtimeHalfDuration === 300
      && this.productionCompression() > 1.01
      && finalThirdCarrier
      && carrier.role !== "ST"
      && carrier.role !== "GK";
    const fifteenMinuteContinuationDamping = this.runtimeHalfDuration === 900;
    const fifteenMinuteFinalThirdRecycleClamp = this.runtimeHalfDuration === 900
      && finalThirdCarrier
      && carrier.role !== "ST"
      && carrier.role !== "GK";
    const compressedContinuationCarrier = this.productionCompression() > 1.01
      && (carrierZone === "BUILDUP" || carrierZone === "PROGRESSION");
    const fullLengthContinuationCarrier = this.fullLengthContinuationOutletPhase(carrier, carrierZone);
    const choose = (maxDistance: number, allowOffsideTarget = false) => {
      let best: SimplePlayer | null = null;
      let bestScore = -Infinity;
      for (const target of own) {
        const d = dist2(carrier.pos, target.pos);
        if (d < 2 || d > maxDistance) continue;
        if (this.wouldExceedPassPairLoop(carrier, target)) continue;
        if (!allowOffsideTarget && this.offsideInfraction(carrier, target, carrier.pos)) continue;
        const progress = (target.pos.x - carrier.pos.x) * attackSign;
        if (options.minProgress !== undefined && progress < options.minProgress) continue;
        const separation = this.nearestDefenderDistance(target, otherTeam(carrier.team));
        const targetDistToGoal = dist2(target.pos, goalCenterForAttack(attackSign));
        const roleBonus = target.role === "ST" || target.role === "W" || target.role === "AM" ? 1.6 : 0;
        const progressWeight = progress >= 0 ? (options.preferForward ? 0.72 : 0.45) : 0.18;
        let backPenalty = progress < -2 ? Math.abs(progress) * (options.preferForward ? 1.6 : 0.75) : 0;
        if (finalThirdCarrier && progress < -1.5) backPenalty += 3.4 + Math.abs(progress) * 1.1;
        const forwardBonus = options.preferForward && progress > 1 ? Math.min(progress, 8) * 0.35 : 0;
        const closerToGoalBonus = finalThirdCarrier && targetDistToGoal < carrierDistToGoal ? Math.min((carrierDistToGoal - targetDistToGoal) * 0.16, 2.6) : 0;
        const continuationLinkBonus = compressedContinuationCarrier
          ? Math.max(0, 13 - d) * 0.10
            + (progress >= -1 ? 0.45 : 0)
            + (target.role === "CM" || target.role === "FB" || target.role === "AM" ? 0.40 : 0)
          : fullLengthContinuationCarrier
            ? Math.max(0, 10.5 - d) * 0.11
              + (progress >= -0.5 ? 0.34 : 0)
              + (target.role === "CM" || target.role === "FB" || target.role === "AM" ? 0.30 : 0)
            : 0;
        const compressedContinuationLinkScale = fiveMinuteContinuationDamping && compressedContinuationCarrier ? 0.82
          : fifteenMinuteContinuationDamping && compressedContinuationCarrier ? 0.84
            : 1;
        const longSpeculativePenalty = compressedContinuationCarrier && d > 18
          ? (d - 18) * 0.28
          : fullLengthContinuationCarrier && d > 14
            ? (d - 14) * 0.22
            : 0;
        const speculativeExposurePenalty = fullLengthContinuationCarrier && d > 13
          ? Math.max(0, 3.8 - separation) * 0.68
          : 0;
        const directBuildupStrikerPenalty = fullLengthContinuationCarrier
          && carrierZone === "BUILDUP"
          && target.role === "ST"
          && (carrier.role === "CM" || carrier.role === "DM" || carrier.role === "FB" || carrier.role === "W")
          && d >= 15.5
          && progress >= 13
          ? 1.35 + Math.max(0, 4.8 - separation) * 0.42
          : 0;
        const fiveMinuteFinalThirdRecyclePenalty = fiveMinuteFinalThirdRecycleClamp
          ? progress < 1.5
            ? (1.5 - progress) * 1.04
              + (progress < 0 ? 0.42 : 0)
              + (targetDistToGoal >= carrierDistToGoal - 0.4 ? 0.24 : 0)
              + (target.role === "CM" || target.role === "FB" || target.role === "CB" || target.role === "DM" ? 0.20 : 0)
            : 0
          : 0;
        const fifteenMinuteFinalThirdRecyclePenalty = fifteenMinuteFinalThirdRecycleClamp
          ? progress < 1.4
            ? (1.4 - progress) * 0.86
              + (progress < 0 ? 0.34 : 0)
              + (targetDistToGoal >= carrierDistToGoal - 0.55 ? 0.24 : 0)
              + (target.role === "CM" || target.role === "FB" || target.role === "CB" || target.role === "DM" ? 0.24 : 0)
            : 0
          : 0;
        const fifteenMinuteForwardOutletBonus = fifteenMinuteFinalThirdRecycleClamp && progress > 1.6
          ? Math.min(progress, 7) * 0.09
            + (targetDistToGoal < carrierDistToGoal - 0.8 ? 0.22 : 0)
            + (target.role === "ST" || target.role === "AM" || target.role === "W" ? 0.20 : 0)
          : 0;
        const score = separation * 1.2 + progress * progressWeight - d * 0.58 + roleBonus + forwardBonus + closerToGoalBonus + continuationLinkBonus * compressedContinuationLinkScale + fifteenMinuteForwardOutletBonus - backPenalty - longSpeculativePenalty - speculativeExposurePenalty - directBuildupStrikerPenalty - fiveMinuteFinalThirdRecyclePenalty - fifteenMinuteFinalThirdRecyclePenalty + this.rng.range(-0.5, 0.5);
        if (score > bestScore) {
          bestScore = score;
          best = target;
        }
      }
      return best;
    };
    const chooseOffside = (maxDistance: number) => {
      let best: SimplePlayer | null = null;
      let bestScore = -Infinity;
      for (const target of own) {
        const d = dist2(carrier.pos, target.pos);
        if (d < 8 || d > maxDistance) continue;
        const offside = this.offsideInfraction(carrier, target, carrier.pos);
        if (!offside) continue;
        if (offside.margin < OFFSIDE_CLEAR_MARGIN * 2) continue;
        const progress = (target.pos.x - carrier.pos.x) * attackSign;
        const roleBonus = target.role === "ST" || target.role === "W" || target.role === "AM" ? 2.2 : 0;
        const score = progress * 0.34 + roleBonus - d * 0.22 + offside.margin * 0.8;
        if (score > bestScore) {
          bestScore = score;
          best = target;
        }
      }
      return best;
    };
    const canSelectOffsideTarget = this.elapsedTotal >= this.offsideTargetSelectionLockedUntil;
    if (canSelectOffsideTarget && this.rng.next() < OFFSIDE_SELECTION_CHANCE) {
      const offsideTarget = chooseOffside(55);
      if (offsideTarget) return offsideTarget;
    }
    return choose(9.5)
      || choose(13.5)
      || choose(19)
      || choose(28)
      || choose(42);
  }

  private isFinalThirdCarrier(carrier: SimplePlayer, distToGoal: number) {
    if (carrier.role === "GK" || carrier.role === "CB") return false;
    const distYards = (distToGoal / FIELD_W) * 120;
    return distYards <= 48;
  }

  private isWideFinalThirdDelivery(carrier: SimplePlayer, target: SimplePlayer, progress: number, targetDistToGoal: number) {
    if (!["W", "FB", "AM", "CM"].includes(carrier.role)) return false;
    const compressed = this.productionCompression() > 1.01;
    if (progress < (compressed ? 0.15 : 0.5)) return false;
    const carrierDistToGoal = dist2(carrier.pos, goalCenterForAttack(this.attackSign(carrier.team)));
    const carrierDistYards = (carrierDistToGoal / FIELD_W) * 120;
    const matchShotLoad = this.teamA.shots + this.teamB.shots;
    const underproducing = matchShotLoad <= 18;
    if (carrierDistYards > (compressed ? (underproducing ? 48 : 44) : (underproducing ? 44 : 40))) return false;
    if (Math.abs(carrier.pos.z) < FIELD_D * (compressed ? (underproducing ? 0.16 : 0.18) : (underproducing ? 0.20 : 0.22))) return false;
    if (Math.abs(target.pos.z) > FIELD_D * (compressed ? 0.30 : 0.28)) return false;
    return target.role === "ST"
      || target.role === "AM"
      || this.isInAttackingPenaltyAreaWithBuffer(target, 2.8)
      || targetDistToGoal <= (compressed ? (underproducing ? 20 : 18) : (underproducing ? 17 : 15));
  }

  /**
   * Long balls are gated to the runtimes a person actually plays.
   *
   * At full length the same bias costs ~9 completed passes a match, which drops
   * completedPasses under its floor. The 90-minute simulation only ever produces
   * league and tournament scorelines -- nobody watches it -- so it keeps the
   * tuned envelope and the played match gets the aerial game.
   */
  private effectiveLongBallBias() {
    if (this.longBallBias !== null) return this.longBallBias;
    return this.runtimeHalfDuration <= PLAYED_MATCH_MAX_HALF_SECONDS ? LONG_BALL_PLAYED_MATCH_BIAS : 0;
  }

  /** Furthest forward option, preferring one with room to bring it down. */
  private bestLongBallTarget(carrier: SimplePlayer, own: SimplePlayer[], attackSign: 1 | -1) {
    let best: SimplePlayer | null = null;
    let bestScore = -Infinity;
    for (const player of own) {
      const progress = (player.pos.x - carrier.pos.x) * attackSign;
      if (progress < LONG_BALL_MIN_PROGRESS) continue;
      const distance = dist2(carrier.pos, player.pos);
      if (distance / FIELD_SCALE_PER_YARD < LONG_BALL_AERIAL_YARDS) continue;
      if (this.offsideInfraction(carrier, player, carrier.pos)) continue;
      const separation = this.nearestDefenderDistance(player, otherTeam(carrier.team));
      const score = distance + separation * 1.5;
      if (score > bestScore) {
        bestScore = score;
        best = player;
      }
    }
    return best;
  }

  /**
   * Where a team-mate should run to offer the carrier a pass.
   *
   * Only the nearest few do this; everyone else holds the shape, or the team
   * collapses onto the ball. Returns null for players who should stay put.
   */
  private showForBallTarget(player: SimplePlayer, carrier: SimplePlayer, attackSign: 1 | -1) {
    if (player.role === "GK" || player.id === carrier.id) return null;
    // Played runtimes only, matching the long-ball gate. At full length this
    // moves goals by ~0.26 -- twice the headroom that band has left -- so the
    // guard cannot tell a real regression from seed noise here. The 90-minute
    // simulation keeps the tuned envelope; see the note in SPEC.md.
    if (this.runtimeHalfDuration > PLAYED_MATCH_MAX_HALF_SECONDS) return null;
    // Come short only when the carrier actually needs an out. Offering on every
    // frame made the whole team orbit the ball and pushed pass volume 5% over
    // its ceiling; a run you make because your team-mate is under pressure is
    // also the run a footballer actually makes.
    if (this.pressureOn(carrier) < SHOW_FOR_BALL_MIN_PRESSURE) return null;
    const gap = dist2(player.pos, carrier.pos);
    if (gap > SHOW_FOR_BALL_RANGE) return null;
    let nearer = 0;
    for (const mate of this.players) {
      if (mate.team !== player.team || mate.role === "GK" || mate.id === carrier.id || mate.id === player.id) continue;
      if (dist2(mate.pos, carrier.pos) < gap) nearer += 1;
    }
    if (nearer >= SHOW_FOR_BALL_COUNT) return null;
    const opponents = this.players.filter((o) => o.team !== player.team && o.role !== "GK");
    let best: Vec2 | null = null;
    let bestScore = -Infinity;
    // Fixed offers around the carrier rather than random ones, so the run is
    // repeatable frame to frame and the player does not jitter between spots.
    for (const angle of SHOW_FOR_BALL_ANGLES) {
      for (const radius of SHOW_FOR_BALL_RADII) {
        const candidate = clampToPlayable({
          x: carrier.pos.x + attackSign * Math.cos(angle) * radius,
          z: carrier.pos.z + Math.sin(angle) * radius,
        });
        let clearance = Infinity;
        for (const opponent of opponents) clearance = Math.min(clearance, dist2(opponent.pos, candidate));
        const progress = (candidate.x - carrier.pos.x) * attackSign;
        // Room to receive first, then getting ahead of the ball, then not
        // asking the player to sprint across the pitch to take up the position.
        const score = Math.min(clearance, 6) * 1.6 + progress * 0.45 - dist2(player.pos, candidate) * 0.35;
        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      }
    }
    return best;
  }

  private bestWideDeliveryTarget(carrier: SimplePlayer, own: SimplePlayer[]) {
    const attackSign = this.attackSign(carrier.team);
    const carrierDistToGoal = dist2(carrier.pos, goalCenterForAttack(attackSign));
    const carrierDistYards = (carrierDistToGoal / FIELD_W) * 120;
    const matchShotLoad = this.teamA.shots + this.teamB.shots;
    const underproducing = matchShotLoad <= 18;
    const compressed = this.productionCompression() > 1.01;
    if (carrier.role === "GK"
      || carrierDistYards > (compressed ? (underproducing ? 48 : 44) : (underproducing ? 44 : 40))
      || Math.abs(carrier.pos.z) < FIELD_D * (compressed ? (underproducing ? 0.16 : 0.18) : (underproducing ? 0.20 : 0.22))) return null;
    let best: SimplePlayer | null = null;
    let bestScore = -Infinity;
    const centralDeliveryAvailable = compressed && own.some((candidate) => {
      const candidateInOrNearBox = this.isInAttackingPenaltyAreaWithBuffer(candidate, 2.8);
      if (candidate.role !== "ST" && candidate.role !== "AM" && !candidateInOrNearBox) return false;
      const d = dist2(carrier.pos, candidate.pos);
      if (d < 4 || d > 31) return false;
      if (this.offsideInfraction(carrier, candidate, carrier.pos)) return false;
      const progress = (candidate.pos.x - carrier.pos.x) * attackSign;
      if (progress < 0.15) return false;
      const candidateDistToGoal = dist2(candidate.pos, goalCenterForAttack(attackSign));
      const candidateDistYards = (candidateDistToGoal / FIELD_W) * 120;
      return candidateDistYards <= (underproducing ? 36 : 33) && Math.abs(candidate.pos.z) <= FIELD_D * 0.30;
    });
    for (const target of own) {
      const d = dist2(carrier.pos, target.pos);
      if (d < 4 || d > (compressed ? 31 : 28)) continue;
      if (this.wouldExceedPassPairLoop(carrier, target)) continue;
      if (this.offsideInfraction(carrier, target, carrier.pos)) continue;
      const progress = (target.pos.x - carrier.pos.x) * attackSign;
      if (progress < (compressed ? 0.15 : 0.5)) continue;
      const targetDistToGoal = dist2(target.pos, goalCenterForAttack(attackSign));
      const targetDistYards = (targetDistToGoal / FIELD_W) * 120;
      if (targetDistYards > (compressed ? (underproducing ? 36 : 33) : (underproducing ? 32 : 29))) continue;
      if (Math.abs(target.pos.z) > FIELD_D * (compressed ? 0.30 : 0.28)) continue;
      const inOrNearBox = this.isInAttackingPenaltyAreaWithBuffer(target, 2.8);
      if (target.role !== "ST" && target.role !== "AM" && !inOrNearBox) continue;
      if (compressed && target.role === "W" && centralDeliveryAvailable) continue;
      const separation = this.nearestDefenderDistance(target, otherTeam(carrier.team));
      const centrality = clamp(1 - Math.abs(target.pos.z) / (FIELD_D * 0.28), 0, 1);
      const roleBonus = target.role === "ST" ? 3.4 : target.role === "AM" ? 2.4 : inOrNearBox ? 1.2 : 0;
      const boxBonus = inOrNearBox ? 1.4 : 0;
      const halfSpaceBonus = Math.abs(carrier.pos.z) < FIELD_D * 0.24 ? 0.8 : 0;
      const underproductionBonus = underproducing ? 0.9 : 0;
      const compressedBonus = compressed ? 0.7 : 0;
      const score = separation * 1.35
        + centrality * 2.6
        + roleBonus
        + boxBonus
        + halfSpaceBonus
        + underproductionBonus
        + compressedBonus
        + progress * 0.28
        - d * 0.18
        + this.rng.range(-0.25, 0.25);
      if (score > bestScore) {
        bestScore = score;
        best = target;
      }
    }
    return best;
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
    const role = carrier.role === "ST" ? 0.014 : carrier.role === "W" || carrier.role === "AM" ? 0.009 : 0.005;
    const distYards = (distToGoal / FIELD_W) * 120;
    const distance = distToGoal < 8 ? 0.094 : distToGoal < 14 ? 0.062 : distToGoal < 22 ? 0.022 : distToGoal < 29 ? 0.005 : 0;
    const centrality = clamp(1 - Math.abs(carrier.pos.z) / (FIELD_D * 0.42), 0, 1);
    const pressureBoost = Math.min(0.010, pressure * 0.0023);
    const attackBoost = (this.effectiveTuning(carrier.team).attack - 0.5) * 0.007;
    const centralBoost = distYards <= 24 ? centrality * 0.012 : centrality * 0.004;
    const longRangeBrake = distYards > 30 ? 0.22 : distYards > 24 ? 0.45 : 1;
    const matchShotLoad = this.teamA.shots + this.teamB.shots;
    const loadBrake = matchShotLoad > 36 ? 0.12 : matchShotLoad > 32 ? 0.32 : matchShotLoad > 28 ? 0.62 : 1;
    return clamp(
      (role + distance + pressureBoost + attackBoost + centralBoost)
        * this.aggressionShotScale(carrier.team)
        * this.shotSelectionScale() * longRangeBrake * loadBrake,
      0.001,
      0.11,
    );
  }

  private distanceShotChance(carrier: SimplePlayer, distToGoal: number, pressure: number, forwardX: number) {
    if (!["ST", "W", "AM", "CM"].includes(carrier.role)) return 0;
    if (forwardX < 8) return 0;
    const distYards = (distToGoal / FIELD_W) * 120;
    if (distYards < 20 || distYards > 30) return 0;
    const centrality = clamp(1 - Math.abs(carrier.pos.z) / (FIELD_D * 0.38), 0, 1);
    if (centrality < 0.32) return 0;
    const roleBase = carrier.role === "ST" ? 0.021 : carrier.role === "AM" ? 0.018 : carrier.role === "W" ? 0.012 : 0.008;
    const sweetSpot = clamp(1 - Math.abs(distYards - 24) / 7, 0, 1);
    const centralBoost = centrality * 0.010;
    const attackBoost = (this.effectiveTuning(carrier.team).attack - 0.5) * 0.005;
    const pressureBoost = clamp(pressure * 0.0045, 0, 0.008);
    const matchShotLoad = this.teamA.shots + this.teamB.shots;
    const loadMultiplier = matchShotLoad > 40 ? 0 : matchShotLoad > 34 ? 0.25 : 1;
    return clamp((roleBase + sweetSpot * 0.012 + centralBoost + attackBoost + pressureBoost) * this.shotSelectionScale() * loadMultiplier, 0, 0.042);
  }

  private isInAttackingPenaltyArea(carrier: SimplePlayer) {
    return isInPenaltyArea(carrier.pos, this.attackSign(carrier.team) < 0);
  }

  private isInAttackingPenaltyAreaWithBuffer(carrier: SimplePlayer, buffer: number) {
    const defendingLeft = this.attackSign(carrier.team) < 0;
    const pos = carrier.pos;
    if (Math.abs(pos.z) > PENALTY_HALF_Z + buffer) return false;
    return defendingLeft
      ? pos.x >= LEFT_GOAL_X - buffer && pos.x <= LEFT_PENALTY_X + buffer
      : pos.x >= RIGHT_PENALTY_X - buffer && pos.x <= RIGHT_GOAL_X + buffer;
  }

  private isStrikerInAttackingPenaltyArea(carrier: SimplePlayer) {
    return carrier.role === "ST" && this.isInAttackingPenaltyArea(carrier);
  }

  private strikerPenaltyAreaShotDeadline() {
    return 0.22;
  }

  private updateStrikerBoxPossession(carrier: SimplePlayer, distToGoal: number, pressure: number) {
    const active = this.strikerBoxPossession;
    const inStrikerBox = this.isStrikerInAttackingPenaltyArea(carrier);
    const activeSameCarrier = active?.playerId === carrier.id;
    const stillInActiveBoxZone = activeSameCarrier
      && carrier.role === "ST"
      && this.isInAttackingPenaltyAreaWithBuffer(carrier, STRIKER_BOX_EXIT_BUFFER);
    if (!inStrikerBox && !stillInActiveBoxZone) {
      if (active?.playerId === carrier.id) this.finishStrikerBoxPossession(carrier, "left_box", distToGoal, pressure);
      else if (active) {
        this.recordStrikerBoxOutcome(active, "lost_possession", carrier, distToGoal, pressure);
        this.strikerBoxPossession = null;
      }
      return null;
    }

    if (activeSameCarrier) return active;
    if (!inStrikerBox) return null;
    if (active) this.recordStrikerBoxOutcome(active, "lost_possession", carrier, distToGoal, pressure);

    const next: StrikerBoxPossession = {
      seq: ++this.strikerBoxSeq,
      team: carrier.team,
      playerId: carrier.id,
      playerName: carrier.name,
      startedAt: this.elapsedTotal,
      deadlineAt: this.elapsedTotal + this.strikerPenaltyAreaShotDeadline(),
      entryPos: { x: carrier.pos.x, z: carrier.pos.z },
      entryDistToGoal: distToGoal,
    };
    this.strikerBoxPossession = next;
    this.recordStrikerBoxOutcome(next, "entry", carrier, distToGoal, pressure);
    return next;
  }

  private flushInactiveStrikerBoxPossession() {
    const active = this.strikerBoxPossession;
    if (!active) return;
    const activePlayer = this.players.find((player) => player.id === active.playerId);
    const carrier = this.possession || activePlayer;
    if (!carrier) {
      this.strikerBoxPossession = null;
      return;
    }
    if (carrier.id === active.playerId && this.isInAttackingPenaltyAreaWithBuffer(carrier, STRIKER_BOX_EXIT_BUFFER)) return;
    const goal = goalCenterForAttack(this.attackSign(active.team));
    const distToGoal = dist2(carrier.pos, goal);
    const pressure = carrier.id === active.playerId ? this.pressureOn(carrier) : 0;
    this.recordStrikerBoxOutcome(active, carrier.id === active.playerId ? "left_box" : "lost_possession", carrier, distToGoal, pressure);
    this.strikerBoxPossession = null;
  }

  private strikerBoxDwellSeconds(carrier: SimplePlayer) {
    const active = this.strikerBoxPossession;
    if (!active || active.playerId !== carrier.id) return 0;
    return +(this.elapsedTotal - active.startedAt).toFixed(2);
  }

  private finishStrikerBoxPossession(
    carrier: SimplePlayer,
    outcome: string,
    distToGoal: number,
    pressure: number,
    details: Record<string, unknown> = {},
  ) {
    const active = this.strikerBoxPossession;
    if (!active || active.playerId !== carrier.id) return;
    this.recordStrikerBoxOutcome(active, outcome, carrier, distToGoal, pressure, details);
    this.strikerBoxPossession = null;
  }

  private recordStrikerBoxOutcome(
    active: StrikerBoxPossession,
    outcome: string,
    carrier: SimplePlayer,
    distToGoal: number,
    pressure: number,
    details: Record<string, unknown> = {},
  ) {
    const dwellSeconds = +(this.elapsedTotal - active.startedAt).toFixed(2);
    const deadlineSeconds = +(active.deadlineAt - active.startedAt).toFixed(2);
    this.strikerBoxTelemetry.push({
      seq: active.seq,
      team: active.team,
      playerId: active.playerId,
      playerName: active.playerName,
      outcome,
      startedAt: +active.startedAt.toFixed(2),
      elapsedTotal: +this.elapsedTotal.toFixed(2),
      dwellSeconds,
      deadlineSeconds,
      withinDeadline: dwellSeconds <= deadlineSeconds + 0.05 || outcome === "entry",
      entryPos: { x: +active.entryPos.x.toFixed(2), z: +active.entryPos.z.toFixed(2) },
      currentPos: { x: +carrier.pos.x.toFixed(2), z: +carrier.pos.z.toFixed(2) },
      entryDistToGoal: +active.entryDistToGoal.toFixed(2),
      distToGoal: +distToGoal.toFixed(2),
      pressure: +pressure.toFixed(2),
      ...details,
    });
    if (this.strikerBoxTelemetry.length > 1000) this.strikerBoxTelemetry.splice(0, this.strikerBoxTelemetry.length - 1000);
  }

  private resolveStrikerBoxPhysicalLoss(
    carrier: SimplePlayer,
    distToGoal: number,
    pressure: number,
    options: { shotLoadContainment?: boolean; qualityDebt?: number; qualityReason?: string } = {},
  ) {
    const defender = this.nearestOpponent(carrier, otherTeam(carrier.team));
    if (!defender) return false;
    const defenderDistance = dist2(carrier.pos, defender.pos);
    const matchShotLoad = this.teamA.shots + this.teamB.shots;
    const containmentRadius = options.shotLoadContainment ? 7.2 : 5.7;
    if (defenderDistance > containmentRadius) return false;
    if (!options.shotLoadContainment && matchShotLoad < 18 && pressure < 0.45 && defenderDistance > 3.8) return false;

    // Tuning note: this is the existing high-load containment curve. If
    // high-load striker shots overcorrect, revert contained values to
    // 0.94 / 0.82 / 0.66 / 0.48.
    const loadPressure = options.shotLoadContainment
      ? matchShotLoad > 42 ? 0.97 : matchShotLoad > 36 ? 0.88 : matchShotLoad > 30 ? 0.70 : 0.50
      : matchShotLoad > 38 ? 0.72 : matchShotLoad > 34 ? 0.58 : matchShotLoad > 30 ? 0.44 : matchShotLoad > 26 ? 0.28 : matchShotLoad > 22 ? 0.16 : 0.07;
    const proximityPressure = clamp((containmentRadius - defenderDistance) / containmentRadius, 0, 1) * (options.shotLoadContainment ? 0.46 : 0.38);
    const livePressure = clamp(pressure * 0.055, 0, 0.18);
    const qualityPressure = clamp(((options.qualityDebt ?? 0) - 0.48) * 0.34, 0, 0.16);
    const keeperBonus = defender.role === "GK" ? 0.08 : 0;
    const chance = clamp(loadPressure + proximityPressure + livePressure + qualityPressure + keeperBonus, 0.04, options.shotLoadContainment ? 0.98 : 0.86);
    if (this.rng.next() >= chance) return false;

    this.finishStrikerBoxPossession(carrier, defender.role === "GK" ? "keeper_smother" : "defender_block", distToGoal, pressure, {
      defenderId: defender.id,
      defenderName: defender.name,
      defenderRole: defender.role,
      defenderDistance: +defenderDistance.toFixed(2),
      chance: +chance.toFixed(3),
      matchShotLoad,
      shotQualityDebt: +(options.qualityDebt ?? 0).toFixed(3),
      shotQualityReason: options.qualityReason || null,
    });
    this.possession = defender;
    this.recordTackle(defender, carrier, pressure, defender.role === "GK" ? "STRIKER_BOX_KEEPER_SMOTHER" : "STRIKER_BOX_BLOCK");
    this.startBallFlight("interception", { x: carrier.pos.x, z: carrier.pos.z }, defender.pos, this.flightDuration(0.36), 0.34, defender);
    this.addLiveEvent(defender.team, defender.role === "GK" ? "SMOTHER" : "TACKLE", `${defender.label} stopped ${carrier.label}`);
    this.recordEvent(defender.role === "GK" ? "KEEPER_SMOTHER" : "TACKLE", defender.team, defender, {
      carrier: carrier.name,
      distToGoal,
      pressure,
      defenderDistance,
      chance,
      matchShotLoad,
      shotQualityDebt: options.qualityDebt ?? 0,
      shotQualityReason: options.qualityReason || null,
      reason: defender.role === "GK" ? "STRIKER_BOX_KEEPER_SMOTHER" : "STRIKER_BOX_BLOCK",
    });
    return true;
  }

  private resolvePenaltyAreaContainmentLoss(
    carrier: SimplePlayer,
    distToGoal: number,
    pressure: number,
    options: { qualityDebt?: number; qualityReason?: string } = {},
  ) {
    const defender = this.nearestOpponent(carrier, otherTeam(carrier.team));
    if (!defender) return false;
    const defenderDistance = dist2(carrier.pos, defender.pos);
    if (defenderDistance > 6.2) return false;
    const matchShotLoad = this.teamA.shots + this.teamB.shots;
    const loadPressure = matchShotLoad > 42 ? 0.86 : matchShotLoad > 36 ? 0.70 : matchShotLoad > 30 ? 0.52 : 0.34;
    const proximityPressure = clamp((6.2 - defenderDistance) / 6.2, 0, 1) * 0.38;
    const livePressure = clamp(pressure * 0.06, 0, 0.18);
    const qualityPressure = clamp(((options.qualityDebt ?? 0) - 0.45) * 0.34, 0, 0.17);
    const keeperBonus = defender.role === "GK" ? 0.10 : 0;
    const chance = clamp(loadPressure + proximityPressure + livePressure + qualityPressure + keeperBonus, 0.10, 0.92);
    if (this.rng.next() >= chance) return false;

    this.possession = defender;
    this.recordTackle(defender, carrier, pressure, defender.role === "GK" ? "PENALTY_AREA_KEEPER_SMOTHER" : "PENALTY_AREA_CONTAINMENT_BLOCK");
    this.startBallFlight("interception", { x: carrier.pos.x, z: carrier.pos.z }, defender.pos, this.flightDuration(0.36), 0.32, defender);
    this.addLiveEvent(defender.team, defender.role === "GK" ? "SMOTHER" : "TACKLE", `${defender.label} contained ${carrier.label}`);
    this.recordEvent(defender.role === "GK" ? "KEEPER_SMOTHER" : "TACKLE", defender.team, defender, {
      carrier: carrier.name,
      distToGoal,
      pressure,
      defenderDistance,
      chance,
      matchShotLoad,
      shotQualityDebt: options.qualityDebt ?? 0,
      shotQualityReason: options.qualityReason || null,
      reason: defender.role === "GK" ? "PENALTY_AREA_KEEPER_SMOTHER" : "PENALTY_AREA_CONTAINMENT_BLOCK",
    });
    return true;
  }

  private forcedShotQualityDebt(carrier: SimplePlayer, distToGoal: number, pressure: number) {
    const distYards = (distToGoal / FIELD_W) * 120;
    const matchShotLoad = this.teamA.shots + this.teamB.shots;
    const teamShotLoad = this.team(carrier.team).shots;
    const widePenalty = clamp((Math.abs(carrier.pos.z) - GOAL_MOUTH_HALF_Z * 1.25) / (PENALTY_HALF_Z - GOAL_MOUTH_HALF_Z * 1.25), 0, 1);
    const distancePenalty = clamp((distYards - 15.5) / 10.5, 0, 1);
    const pressurePenalty = clamp(pressure / 2.2, 0, 1);
    const loadPenalty = clamp((matchShotLoad - 24) / 18, 0, 1);
    const teamLoadPenalty = clamp((teamShotLoad - 13) / 12, 0, 1);
    const centralCloseCredit = distYards <= 13.5 && Math.abs(carrier.pos.z) <= GOAL_MOUTH_HALF_Z * 1.6 ? 0.24 : 0;
    const qualityDebt = clamp(
      widePenalty * 0.34
        + distancePenalty * 0.30
        + pressurePenalty * 0.18
        + loadPenalty * 0.14
        + teamLoadPenalty * 0.10
        - centralCloseCredit,
      0,
      1,
    );
    const shouldContain = matchShotLoad >= 26 && qualityDebt >= (carrier.role === "ST" ? 0.47 : 0.40);
    const reason = widePenalty >= 0.55 ? "wide_angle"
      : distancePenalty >= 0.55 ? "low_value_distance"
        : pressurePenalty >= 0.65 ? "pressured"
          : loadPenalty >= 0.55 ? "high_match_shot_load"
            : teamLoadPenalty >= 0.55 ? "high_team_shot_load"
              : "acceptable";
    return {
      qualityDebt: +qualityDebt.toFixed(3),
      shouldContain,
      reason,
      distYards: +distYards.toFixed(1),
      matchShotLoad,
      teamShotLoad,
    };
  }

  private isStrikerNearPenaltyArea(carrier: SimplePlayer, distToGoal: number) {
    if (carrier.role !== "ST") return false;
    const attackSign = this.attackSign(carrier.team);
    const defendingLeft = attackSign < 0;
    const boxEdgeX = defendingLeft ? LEFT_PENALTY_X : RIGHT_PENALTY_X;
    const distanceFromBox = (boxEdgeX - carrier.pos.x) * attackSign;
    const nearBox = distanceFromBox >= -0.8 && distanceFromBox <= 2.2 && Math.abs(carrier.pos.z) <= PENALTY_HALF_Z + 3.2;
    return nearBox;
  }

  private isStrikerInShotPreparationZone(carrier: SimplePlayer) {
    if (carrier.role !== "ST") return false;
    const distToGoal = dist2(carrier.pos, goalCenterForAttack(this.attackSign(carrier.team)));
    return this.isInAttackingPenaltyArea(carrier) || this.isStrikerNearPenaltyArea(carrier, distToGoal);
  }

  private strikerShotPreparationTarget(carrier: SimplePlayer) {
    const attackSign = this.attackSign(carrier.team);
    const insideBox = this.isInAttackingPenaltyArea(carrier);
    const lateralSettle = clamp(-carrier.pos.z, -0.65, 0.65);
    const forwardSettle = insideBox ? 0 : attackSign * 0.18;
    return clampToPlayable({
      x: carrier.pos.x + forwardSettle,
      z: carrier.pos.z + lateralSettle,
    });
  }

  private penaltyAreaDecisionTarget(carrier: SimplePlayer) {
    const lateralSettle = clamp(-carrier.pos.z, -0.55, 0.55);
    return clampToPlayable({
      x: carrier.pos.x,
      z: carrier.pos.z + lateralSettle,
    });
  }

  private penaltyAreaShotChance(carrier: SimplePlayer, distToGoal: number, pressure: number) {
    if (carrier.role === "GK") return 0;
    const roleBase = carrier.role === "ST" ? 0.62
      : carrier.role === "W" || carrier.role === "AM" ? 0.42
        : carrier.role === "CM" || carrier.role === "DM" ? 0.30
          : 0.20;
    const distanceBoost = distToGoal < 10.5 ? 0.16 : distToGoal < 13 ? 0.08 : distToGoal < 16 ? 0.03 : 0;
    const pressureBoost = clamp(pressure * 0.020, 0, 0.04);
    const distYards = (distToGoal / FIELD_W) * 120;
    const nonStriker = carrier.role !== "ST";
    const edgeDistanceBrake = nonStriker
      ? distYards >= 23 ? 0.42 : distYards >= 21.5 ? 0.55 : distYards >= 20 ? 0.72 : 1
      : 1;
    const wideBrake = nonStriker && Math.abs(carrier.pos.z) >= GOAL_MOUTH_HALF_Z * 2.4 ? 0.82 : 1;
    const pressureBrake = nonStriker && pressure >= 1.35 ? 0.86 : 1;
    const teamShotLoad = this.team(carrier.team).shots;
    const matchShotLoad = this.teamA.shots + this.teamB.shots;
    const loadMultiplier = distToGoal < 10.5
      ? matchShotLoad > 38 ? 0.05 : matchShotLoad > 34 ? 0.08 : matchShotLoad > 30 ? 0.18 : matchShotLoad > 26 ? 0.34 : teamShotLoad > 24 ? 0.42 : 1
      : matchShotLoad > 38 ? 0.005 : matchShotLoad > 32 ? 0.035 : matchShotLoad > 28 ? 0.12 : teamShotLoad > 20 ? 0.12 : teamShotLoad > 15 ? 0.24 : 1;
    // Tuning note: this only damps non-striker box-edge/wide attempts that
    // produced repeated 22-25 yard "penalty-area" shots. Revert these three
    // brakes to 1 if non-striker chance creation drops below KPI.
    const qualityMultiplier = edgeDistanceBrake * wideBrake * pressureBrake;
    return clamp((roleBase + distanceBoost + pressureBoost) * loadMultiplier * qualityMultiplier, 0.025, 0.72);
  }

  private shotSelectionScale() {
    const compression = this.productionCompression();
    const compressedRuntimeBoost = compression <= 1.01
      ? 1
      : this.runtimeHalfDuration <= 150
        ? 0.56
        : this.runtimeHalfDuration <= 300
          ? 0.62
          : clamp(1 + (Math.sqrt(compression) - 1) * 0.09, 1, 1.45);
    return 1.70 * compressedRuntimeBoost;
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

  /** Defensive intensity for a team. 1 is the calibrated baseline. */
  setDefenseIntensity(team: SimpleTeamCode, value: number) {
    this.defenseIntensity[team] = clamp(Number(value) || 1, 0.5, 2);
  }

  getDefenseIntensity(team: SimpleTeamCode) {
    return this.defenseIntensity[team];
  }

  /** Read-only view of pressureOn for the defensive measurement harness. */
  pressureOnForHarness(player: SimplePlayer) {
    return this.pressureOn(player);
  }

  private pressureOn(player: SimplePlayer) {
    if (this.keeperWithHandsPossession()?.id === player.id) return 0;
    const opponents = this.players.filter((p) => p.team !== player.team);
    let pressure = 0;
    for (const opponent of opponents) {
      const d = dist2(player.pos, opponent.pos);
      const intensity = this.defenseIntensity[opponent.team];
      if (d < 5.5) pressure += (5.5 - d) / 5.5 * (0.65 + opponent.ratings.defense) * intensity;
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
      const goal = goalCenterForAttack(attackSign);
      const teamPlayers = this.players.filter((p) => p.team === team);
      const shapePlayers = teamPlayers.filter((p) => p.role !== "GK");
      const rows = teamPlayers.map((p) => ({
        type: "POSITION_OWNER_SAMPLE",
        team,
        role: p.role,
        owner: this.positionOwnerLabel(p),
        targetOwner: p.targetOwner,
        label: p.label,
        player: p.name,
        x: +p.pos.x.toFixed(2),
        z: +p.pos.z.toFixed(2),
        targetX: +p.targetPos.x.toFixed(2),
        targetZ: +p.targetPos.z.toFixed(2),
        forwardX: +(p.pos.x * attackSign).toFixed(2),
        absZ: +Math.abs(p.pos.z).toFixed(2),
        targetAbsZ: +Math.abs(p.targetPos.z).toFixed(2),
        distToGoal: +dist2(p.pos, goal).toFixed(2),
        t: +this.msm.clock.elapsedInHalf.toFixed(2),
        half: this.msm.clock.half,
      }));
      const target = team === "A" ? this.shapeA : this.shapeB;
      const zValues = shapePlayers.map((p) => p.pos.z);
      const forwardValues = shapePlayers.map((p) => p.pos.x * attackSign);
      const centroid = shapePlayers.reduce((sum, p) => ({ x: sum.x + p.pos.x, z: sum.z + p.pos.z }), { x: 0, z: 0 });
      const centroidX = shapePlayers.length ? centroid.x / shapePlayers.length : 0;
      const centroidZ = shapePlayers.length ? centroid.z / shapePlayers.length : 0;
      const compactness = shapePlayers.length
        ? shapePlayers.reduce((sum, p) => sum + dist2(p.pos, { x: centroidX, z: centroidZ }), 0) / shapePlayers.length
        : 0;
      target.push({
        team,
        t: +this.msm.clock.elapsedInHalf.toFixed(2),
        half: this.msm.clock.half,
        avgZ: shapePlayers.length ? +(shapePlayers.reduce((sum, p) => sum + p.pos.z, 0) / shapePlayers.length).toFixed(2) : 0,
        width: zValues.length ? +(Math.max(...zValues) - Math.min(...zValues)).toFixed(2) : 0,
        depth: forwardValues.length ? +(Math.max(...forwardValues) - Math.min(...forwardValues)).toFixed(2) : 0,
        compactness: +compactness.toFixed(2),
      });
      this.playerPositioning.push(...rows);
      for (const row of rows) this.recordEvent("POSITION_OWNER_SAMPLE", team, this.players.find((p) => p.name === row.player), row);
      this.recordAttackerZoneSamples(team, goal);
    }
  }

  private recordAttackerZoneSamples(team: SimpleTeamCode, goal: Vec2) {
    const attackSign = this.attackSign(team);
    for (const player of this.players) {
      if (player.team !== team || player.role === "GK") continue;
      const distToGoal = dist2(player.pos, goal);
      const nearestDefenderDist = this.nearestDefenderDistance(player, otherTeam(team));
      const dangerMarkingZone = distToGoal <= 22;
      const inOppHalf = player.pos.x * attackSign > 0;
      if (!inOppHalf && !dangerMarkingZone) continue;
      this.recordEvent("ATTACKER_ZONE_TRACE", team, player, {
        playerName: player.name,
        role: player.role,
        patternRole: this.positionOwnerLabel(player),
        targetOwner: player.targetOwner,
        x: +player.pos.x.toFixed(2),
        z: +player.pos.z.toFixed(2),
        distToGoal: +distToGoal.toFixed(2),
        dangerMarkingZone,
        dangerMarked: dangerMarkingZone && nearestDefenderDist / FIELD_SCALE_PER_YARD <= 3.5,
        nearestDefenderDist: +nearestDefenderDist.toFixed(2),
        zone: this.zoneForDist(distToGoal),
      });
    }
  }

  private recordCarrierTrace(carrier: SimplePlayer, distToGoal: number, pressure: number) {
    const speed = Math.sqrt(carrier.vel.x * carrier.vel.x + carrier.vel.z * carrier.vel.z);
    const movementDirX = speed > 0.001 ? carrier.vel.x / speed : 0;
    const movementDirZ = speed > 0.001 ? carrier.vel.z / speed : 0;
    const targetDx = carrier.targetPos.x - carrier.pos.x;
    const targetDz = carrier.targetPos.z - carrier.pos.z;
    const desiredHeading = Math.atan2(targetDz, targetDx);
    const currentHeading = speed > 0.001 ? Math.atan2(carrier.vel.z, carrier.vel.x) : desiredHeading;
    this.recordEvent("CARRIER_TRACE", carrier.team, carrier, {
      carrier: carrier.name,
      role: carrier.role,
      x: +carrier.pos.x.toFixed(2),
      z: +carrier.pos.z.toFixed(2),
      targetX: +carrier.targetPos.x.toFixed(2),
      targetZ: +carrier.targetPos.z.toFixed(2),
      distToGoal: +distToGoal.toFixed(2),
      pressure: +pressure.toFixed(2),
      speed: +speed.toFixed(3),
      movementDirX: +movementDirX.toFixed(3),
      movementDirZ: +movementDirZ.toFixed(3),
      desiredHeading: +desiredHeading.toFixed(3),
      steerHeading: +desiredHeading.toFixed(3),
      currentHeading: +currentHeading.toFixed(3),
      facingHeading: +currentHeading.toFixed(3),
      segmentId: this.carrierTraceSegmentSeq,
      phase: this.zoneForDist(distToGoal),
    });
  }

  private positionOwnerLabel(player: SimplePlayer) {
    if (player.role === "GK") return "GK";
    if (player.role === "FB") return player.homePos.z < 0 ? "LB" : "RB";
    if (player.role === "W") return player.homePos.z < 0 ? "LW" : "RW";
    if (player.role === "CB") {
      if (Math.abs(player.homePos.z) < 1) return "CB";
      return player.homePos.z < 0 ? "LCB" : "RCB";
    }
    if (player.role === "CM") {
      if (Math.abs(player.homePos.z) < 1) return "CM";
      return player.homePos.z < 0 ? "LCM" : "RCM";
    }
    if (player.role === "ST") {
      if (Math.abs(player.homePos.z) < 1) return "ST";
      return player.homePos.z < 0 ? "LST" : "RST";
    }
    return player.role;
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

  /** Emit the goal announcement that was held back until the ball arrived. */
  private flushPendingGoalAnnouncement() {
    const pending = this.pendingGoalAnnouncement;
    if (!pending) return;
    this.pendingGoalAnnouncement = null;
    this.addLiveEvent(pending.team, "GOAL", pending.detail, pending.meta);
  }

  private addLiveEvent(team: SimpleTeamCode | "", action: string, detail: string, meta?: Record<string, unknown>) {
    this.eventLog.push({ seq: ++this.liveEventSeq, time: Date.now(), team, action, detail, ...(meta ? { meta } : {}) });
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
      headers: stats.headers,
      headerShots: stats.headerShots,
      headerClearances: stats.headerClearances,
      tackles: stats.tacklesWon,
      clearances: stats.clearances,
      fouls: stats.fouls,
      offsides: stats.offsides,
      penaltiesAwarded: stats.penaltiesAwarded,
      penaltiesTaken: stats.penaltiesTaken,
      penaltiesScored: stats.penaltiesScored,
      penaltiesSaved: stats.penaltiesSaved,
      penaltiesMissed: stats.penaltiesMissed,
      penaltyXg: +stats.penaltyXg.toFixed(2),
      corners: stats.corners,
      throwIns: stats.throwIns,
      goalKicks: stats.goalKicks,
      freeKicks: stats.freeKicks,
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
        headers: player.stats.headers,
        headerShots: player.stats.headerShots,
        headerClearances: player.stats.headerClearances,
        tackles: player.stats.tackles,
        interceptions: player.stats.interceptions,
        clearances: player.stats.headerClearances,
        recoveries: player.stats.interceptions + player.stats.saves,
        turnovers: Math.max(0, player.stats.passes - player.stats.passesCompleted),
        fouls: player.stats.fouls,
        fouled: player.stats.fouled,
        penaltiesTaken: player.stats.penaltiesTaken,
        penaltiesScored: player.stats.penaltiesScored,
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
      headers: stats.headers,
      headerShots: stats.headerShots,
      headerClearances: stats.headerClearances,
      clearances: stats.clearances,
      passes: stats.passes,
      passesCompleted: stats.passesCompleted,
      tackles: stats.tacklesWon,
      fouls: stats.fouls,
      offsides: stats.offsides,
      penaltiesAwarded: stats.penaltiesAwarded,
      penaltiesTaken: stats.penaltiesTaken,
      penaltiesScored: stats.penaltiesScored,
      penaltiesSaved: stats.penaltiesSaved,
      penaltiesMissed: stats.penaltiesMissed,
      penaltyXg: +stats.penaltyXg.toFixed(2),
      corners: stats.corners,
      throwIns: stats.throwIns,
      goalKicks: stats.goalKicks,
      freeKicks: stats.freeKicks,
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
