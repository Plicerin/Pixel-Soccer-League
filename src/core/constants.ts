import type { Vec2 } from "./types";

export const PITCH_LENGTH_YDS = 120;
export const PITCH_WIDTH_YDS = 80;
export const EZONE_W = 4.8;
export const FIELD_OF_PLAY_W = 56;
export const FIELD_W = FIELD_OF_PLAY_W + EZONE_W * 2;
export const FIELD_SCALE_PER_YARD = FIELD_W / PITCH_LENGTH_YDS;
export const FIELD_D = PITCH_WIDTH_YDS * FIELD_SCALE_PER_YARD;
export const UNITS_PER_YARD = FIELD_OF_PLAY_W / 100;

export const X_PER_YARD = FIELD_SCALE_PER_YARD;
export const Z_PER_YARD = FIELD_SCALE_PER_YARD;

export const LEFT_GOAL_X = -FIELD_W / 2;
export const RIGHT_GOAL_X = FIELD_W / 2;

export const REGULATION_GOAL_WIDTH_YARDS = 8;
export const GOAL_MOUTH_WIDTH = REGULATION_GOAL_WIDTH_YARDS * Z_PER_YARD;
export const GOAL_MOUTH_HALF_Z = GOAL_MOUTH_WIDTH / 2;
export const GOAL_HEIGHT = (8 / 3) * X_PER_YARD;
export const GOAL_FLOOR_DEPTH = (8 / 3) * X_PER_YARD;

export const PENALTY_DEPTH = 18 * X_PER_YARD;
export const PENALTY_WIDTH = 44 * Z_PER_YARD;
export const PENALTY_HALF_Z = PENALTY_WIDTH / 2;
export const LEFT_PENALTY_X = LEFT_GOAL_X + PENALTY_DEPTH;
export const RIGHT_PENALTY_X = RIGHT_GOAL_X - PENALTY_DEPTH;

export const GOAL_BOX_DEPTH = 6 * X_PER_YARD;
export const GOAL_BOX_WIDTH = 20 * Z_PER_YARD;
export const GOAL_BOX_HALF_Z = GOAL_BOX_WIDTH / 2;

export const CENTER_CIRCLE_RADIUS = 10 * X_PER_YARD;
export const PENALTY_SPOT_DIST = 12 * X_PER_YARD;

export const LOCAL_PITCH_METERS = {
  lengthMeters: PITCH_LENGTH_YDS * 0.9144,
  widthMeters: PITCH_WIDTH_YDS * 0.9144,
};

export const PLAYER_RADIUS = 0.35;
export const BALL_RADIUS = 0.2;
export const BALL_GROUND_Y = 0.15;

// Sim-wide baseline. Do NOT raise this to make the game feel faster: the MLS
// KPI envelope (shots 20-35, passes 900-954) is calibrated against it and a
// +20% bump pushes shots and passes straight out of bounds. Arcade
// responsiveness belongs on the human-controlled player instead.
export const BASE_RUN_SPEED = 5.0;
export const PLAYER_ACCELERATION = 3.0;
export const MANUAL_CONTROL_ACCELERATION_MULTIPLIER = 2.2;
// Arcade top-speed bump for the player you are actually controlling. Kept off
// the CPU so the calibrated simulation output is untouched.
export const MANUAL_CONTROL_SPEED_MULTIPLIER = 1.18;
export const SPRINT_MULTIPLIER = 1.35;
export const JOG_MULTIPLIER = 0.55;
export const WALK_MULTIPLIER = 0.3;

export const BALL_GRAVITY = 9.8;
export const BALL_AIR_DRAG = 0.14;
export const BALL_BOUNCE_RESTITUTION = 0.58;
export const BALL_BOUNCE_GROUND_DAMP = 0.98;
export const BALL_BOUNCE_TO_ROLL_IMPACT_VY = 0.08;
export const BALL_ROLL_LINEAR_DRAG = 0.09;
export const BALL_ROLL_QUAD_DRAG = 0.035;
export const BALL_ROLL_DRAG_START_FACTOR = 0.32;
export const BALL_ROLL_DRAG_RAMP_RATE = 2.4;
export const BALL_ROLL_STOP_SPEED_SQ = 0.0012;
export const BALL_STATIC_FRICTION_SPEED = 0.028;
export const BALL_SPIN_AIR_DAMP = 0.22;
export const BALL_SPIN_GROUND_DAMP = 0.95;

export const PLAYER_GROUND_DRAG_RATE = 8.2;
export const PLAYER_STOP_SPEED_SQ = 0.01;

export const GAME_SPEED_SCALE = 0.7;

export const REGULAR_HALF_DURATION_SECONDS = 45 * 60;
export const TESTING_HALF_DURATION_SECONDS = 2.5 * 60;
export const DEFAULT_HALF_DURATION = TESTING_HALF_DURATION_SECONDS;

export const TEAM_SERVICE_HZ = 4;
export const TEAM_SERVICE_INTERVAL = 1 / TEAM_SERVICE_HZ;

export const PLAYER_CONTROLLER_HZ = 8;
export const PLAYER_CONTROLLER_INTERVAL = 1 / PLAYER_CONTROLLER_HZ;

export const SIMULATION_HZ = 60;
export const SIMULATION_DT = 1 / SIMULATION_HZ;

export const MAX_PLAYER_SPEED = BASE_RUN_SPEED * GAME_SPEED_SCALE * SPRINT_MULTIPLIER;

export const GK_ARC_BASE_RADIUS = 4.0;
export const GK_ARC_MAX_RADIUS = 8.0;
export const GK_COME_OUT_BALL_DIST = 22.0;
export const GK_CLAIM_RADIUS = 2.2;

export const UTILITY_HYSTERESIS_BONUS = 0.4;
export const UTILITY_COOLDOWN_PENALTY = 0.8;
export const UTILITY_COOLDOWN_TICKS = 12;

export function pitchCenter(): Vec2 {
  return { x: 0, z: 0 };
}

export function homeGoalCenter(): Vec2 {
  return { x: LEFT_GOAL_X, z: 0 };
}

export function awayGoalCenter(): Vec2 {
  return { x: RIGHT_GOAL_X, z: 0 };
}

export function isInPenaltyArea(pos: Vec2, defendingLeft: boolean): boolean {
  if (defendingLeft) {
    return pos.x >= LEFT_GOAL_X && pos.x <= LEFT_PENALTY_X
      && pos.z >= -PENALTY_HALF_Z && pos.z <= PENALTY_HALF_Z;
  }
  return pos.x >= RIGHT_PENALTY_X && pos.x <= RIGHT_GOAL_X
    && pos.z >= -PENALTY_HALF_Z && pos.z <= PENALTY_HALF_Z;
}

export function isInGoalBox(pos: Vec2, defendingLeft: boolean): boolean {
  if (defendingLeft) {
    return pos.x >= LEFT_GOAL_X && pos.x <= LEFT_GOAL_X + GOAL_BOX_DEPTH
      && pos.z >= -GOAL_BOX_HALF_Z && pos.z <= GOAL_BOX_HALF_Z;
  }
  return pos.x >= RIGHT_GOAL_X - GOAL_BOX_DEPTH && pos.x <= RIGHT_GOAL_X
    && pos.z >= -GOAL_BOX_HALF_Z && pos.z <= GOAL_BOX_HALF_Z;
}

export function isInFieldOfPlay(pos: Vec2): boolean {
  return pos.x >= LEFT_GOAL_X && pos.x <= RIGHT_GOAL_X
    && pos.z >= -FIELD_D / 2 && pos.z <= FIELD_D / 2;
}

export function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function dist2sq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

export function normalize2(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.z * v.z);
  if (len < 1e-8) return { x: 0, z: 0 };
  return { x: v.x / len, z: v.z / len };
}

export function lerp2(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function angle2(from: Vec2, to: Vec2): number {
  return Math.atan2(to.z - from.z, to.x - from.x);
}

export function add2(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, z: a.z + b.z };
}

export function sub2(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, z: a.z - b.z };
}

export function scale2(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, z: v.z * s };
}

export function len2(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.z * v.z);
}

export function dot2(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.z * b.z;
}
