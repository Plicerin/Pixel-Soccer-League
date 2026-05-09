import type { Vec2, Vec3, BallState, BallCommand, PassType, ShotStyle } from "./types";
import {
  BALL_GROUND_Y,
  BALL_RADIUS,
  BALL_GRAVITY,
  BALL_AIR_DRAG,
  BALL_BOUNCE_RESTITUTION,
  BALL_BOUNCE_GROUND_DAMP,
  BALL_BOUNCE_TO_ROLL_IMPACT_VY,
  BALL_ROLL_LINEAR_DRAG,
  BALL_ROLL_QUAD_DRAG,
  BALL_ROLL_DRAG_START_FACTOR,
  BALL_ROLL_DRAG_RAMP_RATE,
  BALL_ROLL_STOP_SPEED_SQ,
  BALL_STATIC_FRICTION_SPEED,
  BALL_SPIN_AIR_DAMP,
  BALL_SPIN_GROUND_DAMP,
  FIELD_W,
  FIELD_D,
  LEFT_GOAL_X,
  RIGHT_GOAL_X,
  GOAL_MOUTH_HALF_Z,
  GOAL_HEIGHT,
  GOAL_FLOOR_DEPTH,
  PLAYER_RADIUS,
  GAME_SPEED_SCALE,
  BASE_RUN_SPEED,
  dist2,
  isInFieldOfPlay,
  len2,
  normalize2,
  sub2,
  add2,
  scale2,
  dot2,
  clamp,
} from "./constants";
import { segmentCrossesReceiverRadius } from "../ai/passResolution";

export type BallPhysicsState = {
  pos: Vec3;
  vel: Vec3;
  spin: Vec3;
  state: BallState;
  rollingTime: number;
  rollingLaunchSpeed: number;
  ownerPlayerId: string | null;
  ownerTeam: "home" | "away" | null;
  lastHeldById: string | null;
  lastHeldAtTime: number;
  attachedToId: string | null;
  attachFrom: Vec3;
  attachUntil: number;
  dribbleVel: Vec2;
  intendedReceiverId: string | null;
  intendedTeam: "home" | "away" | null;
  intendedUntil: number;
  isShot: boolean;
  settleTimer: number;
};

export function createBallPhysicsState(): BallPhysicsState {
  return {
    pos: { x: 0, y: BALL_GROUND_Y, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    spin: { x: 0, y: 0, z: 0 },
    state: "dead",
    rollingTime: 0,
    rollingLaunchSpeed: 0,
    ownerPlayerId: null,
    ownerTeam: null,
    lastHeldById: null,
    lastHeldAtTime: -10,
    attachedToId: null,
    attachFrom: { x: 0, y: BALL_GROUND_Y, z: 0 },
    attachUntil: 0,
    dribbleVel: { x: 0, z: 0 },
    intendedReceiverId: null,
    intendedTeam: null,
    intendedUntil: 0,
    isShot: false,
    settleTimer: 0,
  };
}

export type PlayerContactInfo = {
  id: string;
  team: "home" | "away";
  pos: Vec2;
  vel: Vec2;
  facingRad: number;
  isGK: boolean;
  isInOwnBox: boolean;
  speed: number;
  dribbling: number;
  defending?: number;
  standingTackle?: number;
  reactions?: number;
  strength?: number;
};

export function executeBallCommand(
  ball: BallPhysicsState,
  cmd: BallCommand,
  elapsed: number,
): void {
  const lastTouchPlayerId = ball.ownerPlayerId ?? ball.lastHeldById;
  switch (cmd.kind) {
    case "pass": {
      const dir2 = normalize2(sub2(cmd.to, cmd.from));
      const travelTime = dist2(cmd.from, cmd.to) / Math.max(cmd.speed, 0.1);
      ball.pos = { x: cmd.from.x, y: BALL_GROUND_Y, z: cmd.from.z };
      ball.vel = { x: dir2.x * cmd.speed, y: 0, z: dir2.z * cmd.speed };
      ball.state = "in_flight";
      ball.ownerPlayerId = null;
      ball.ownerTeam = null;
      ball.attachedToId = null;
      ball.isShot = false;
      ball.rollingTime = 0;
      ball.rollingLaunchSpeed = 0;
      ball.lastHeldById = lastTouchPlayerId;
      ball.lastHeldAtTime = elapsed;
      ball.intendedReceiverId = cmd.intendedReceiverId ?? null;
      ball.intendedTeam = cmd.intendedTeam ?? null;
      ball.intendedUntil = ball.intendedReceiverId ? elapsed + clamp(travelTime + 1.1, 0.75, 4.0) : 0;
      break;
    }
    case "shot": {
      const dir2 = normalize2(sub2(cmd.target, cmd.from));
      const horizSpeed = cmd.speed * Math.cos(Math.atan2(cmd.arcHeight, dist2(cmd.from, cmd.target)));
      const vertSpeed = cmd.speed * Math.sin(Math.atan2(cmd.arcHeight, dist2(cmd.from, cmd.target)));
      ball.pos = { x: cmd.from.x, y: BALL_GROUND_Y + 0.05, z: cmd.from.z };
      ball.vel = { x: dir2.x * horizSpeed, y: vertSpeed, z: dir2.z * horizSpeed };
      ball.state = "in_flight";
      ball.ownerPlayerId = null;
      ball.ownerTeam = null;
      ball.attachedToId = null;
      ball.isShot = true;
      ball.rollingTime = 0;
      ball.rollingLaunchSpeed = 0;
      ball.lastHeldById = lastTouchPlayerId;
      ball.lastHeldAtTime = elapsed;
      ball.intendedReceiverId = null;
      ball.intendedTeam = null;
      ball.intendedUntil = 0;
      break;
    }
    case "dribble": {
      ball.state = "attached";
      ball.ownerPlayerId = cmd.attachedToPlayerId;
      ball.vel = { x: 0, y: 0, z: 0 };
      ball.intendedReceiverId = null;
      ball.intendedTeam = null;
      ball.intendedUntil = 0;
      break;
    }
    case "clear": {
      const dir = normalize2(cmd.direction);
      ball.pos = { x: cmd.from.x, y: BALL_GROUND_Y + 0.15, z: cmd.from.z };
      ball.vel = { x: dir.x * cmd.speed, y: cmd.speed * 0.25, z: dir.z * cmd.speed };
      ball.state = "in_flight";
      ball.ownerPlayerId = null;
      ball.ownerTeam = null;
      ball.attachedToId = null;
      ball.isShot = false;
      ball.rollingTime = 0;
      ball.rollingLaunchSpeed = 0;
      ball.lastHeldById = lastTouchPlayerId;
      ball.lastHeldAtTime = elapsed;
      ball.intendedReceiverId = null;
      ball.intendedTeam = null;
      ball.intendedUntil = 0;
      break;
    }
    case "launch": {
      const dir2 = normalize2(sub2(cmd.to, cmd.from));
      const d = dist2(cmd.from, cmd.to);
      const horizSpeed = cmd.speed;
      const flightTime = d / Math.max(horizSpeed, 0.1);
      const vertSpeed = (cmd.arcHeight > 0 ? cmd.arcHeight * 4 / flightTime : 0);
      ball.pos = { x: cmd.from.x, y: BALL_GROUND_Y + 0.1, z: cmd.from.z };
      ball.vel = { x: dir2.x * horizSpeed, y: vertSpeed, z: dir2.z * horizSpeed };
      ball.state = "in_flight";
      ball.ownerPlayerId = null;
      ball.ownerTeam = null;
      ball.attachedToId = null;
      ball.isShot = false;
      ball.rollingTime = 0;
      ball.rollingLaunchSpeed = 0;
      ball.lastHeldById = lastTouchPlayerId;
      ball.lastHeldAtTime = elapsed;
      ball.intendedReceiverId = cmd.intendedReceiverId ?? null;
      ball.intendedTeam = cmd.intendedTeam ?? null;
      ball.intendedUntil = ball.intendedReceiverId ? elapsed + clamp(flightTime + 1.25, 0.75, 4.75) : 0;
      break;
    }
    case "dead": {
      ball.pos = { x: cmd.pos.x, y: BALL_GROUND_Y, z: cmd.pos.z };
      ball.vel = { x: 0, y: 0, z: 0 };
      ball.spin = { x: 0, y: 0, z: 0 };
      ball.state = "dead";
      ball.rollingTime = 0;
      ball.rollingLaunchSpeed = 0;
      ball.ownerPlayerId = null;
      ball.ownerTeam = null;
      ball.intendedReceiverId = null;
      ball.intendedTeam = null;
      ball.intendedUntil = 0;
      break;
    }
  }
}

export function updateBallPhysics(
  ball: BallPhysicsState,
  players: PlayerContactInfo[],
  elapsed: number,
  dt: number,
): BallPhysicsState {
  const b = { ...ball, pos: { ...ball.pos }, vel: { ...ball.vel }, spin: { ...ball.spin }, dribbleVel: { ...ball.dribbleVel } };
  const prevFlatPos = { x: b.pos.x, z: b.pos.z };

  switch (b.state) {
    case "attached":
      updateAttachedBall(b, players, elapsed, dt);
      break;
    case "in_flight":
      updateFlyingBall(b, dt);
      break;
    case "loose":
      updateRollingBall(b, dt);
      break;
    case "dead":
      break;
  }

  if (b.state === "in_flight" || b.state === "loose") {
    if (b.state === "in_flight" && b.isShot) {
      const blockDefender = findShotBlockDefender(b, players, prevFlatPos);
      if (blockDefender) {
        deflectShotByDefender(b, blockDefender, elapsed);
      }
    }
    const collector = findCollector(b, players, elapsed, prevFlatPos);
    if (collector) {
      collectBall(b, collector, elapsed);
    }
  }

  applyGoalInteriorCollision(b);

  return b;
}

function updateAttachedBall(
  b: BallPhysicsState,
  players: PlayerContactInfo[],
  elapsed: number,
  dt: number,
): void {
  const holder = players.find(p => p.id === b.ownerPlayerId);
  if (!holder) {
    b.state = "loose";
    b.rollingTime = 0;
    return;
  }

  const speed = len2(holder.vel);
  let facing: Vec2;
  if (speed > 0.15) {
    facing = normalize2(holder.vel);
  } else {
    facing = { x: Math.cos(holder.facingRad), z: Math.sin(holder.facingRad) };
  }

  const lateral: Vec2 = { x: -facing.z, z: facing.x };
  const dribbleSkill = holder.dribbling / 100;
  const controlRadius = 0.35 + 0.20 * (1 - dribbleSkill);
  const leadTime = Math.min(speed * 0.04, 0.35);
  const cadence = elapsed * 10.0;
  const sway = speed > 0.8 ? Math.sin(cadence) * (0.02 + 0.05 * Math.min(speed / 7, 1)) : 0;
  const lift = speed > 0.2 ? Math.abs(Math.sin(cadence * 0.5)) * 0.04 : 0;

  const controlPoint: Vec2 = {
    x: holder.pos.x + facing.x * controlRadius + holder.vel.x * leadTime + lateral.x * sway,
    z: holder.pos.z + facing.z * controlRadius + holder.vel.z * leadTime + lateral.z * sway,
  };

  if (holder.isGK && holder.isInOwnBox) {
    const handLead = 0.28;
    b.pos.x = holder.pos.x + facing.x * handLead;
    b.pos.y = 0.58;
    b.pos.z = holder.pos.z + facing.z * handLead;
  } else {
    b.pos.x = controlPoint.x;
    b.pos.y = BALL_GROUND_Y + 0.03 + lift;
    b.pos.z = controlPoint.z;
  }

  b.dribbleVel = { x: holder.vel.x, z: holder.vel.z };
  const dispossessor = findCarrierDispossessor(holder, players);
  if (!dispossessor) return;

  b.ownerPlayerId = dispossessor.id;
  b.ownerTeam = dispossessor.team;
  b.lastHeldById = dispossessor.id;
  b.lastHeldAtTime = elapsed;
  b.intendedReceiverId = null;
  b.intendedTeam = null;
  b.intendedUntil = 0;
  b.isShot = false;
  b.vel = { x: 0, y: 0, z: 0 };
  b.spin = { x: 0, y: 0, z: 0 };
  b.rollingTime = 0;
  b.rollingLaunchSpeed = 0;
  b.dribbleVel = { x: 0, z: 0 };
  b.pos.x = dispossessor.pos.x;
  b.pos.y = dispossessor.isGK && dispossessor.isInOwnBox ? 0.58 : BALL_GROUND_Y + 0.03;
  b.pos.z = dispossessor.pos.z;
}

function updateFlyingBall(b: BallPhysicsState, dt: number): void {
  b.pos.x += b.vel.x * dt;
  b.pos.z += b.vel.z * dt;
  b.pos.y += b.vel.y * dt;

  const airDrag = Math.max(0, 1.0 - dt * BALL_AIR_DRAG);
  b.vel.x *= airDrag;
  b.vel.z *= airDrag;
  b.vel.y -= BALL_GRAVITY * dt;

  const spinMag = Math.sqrt(b.spin.x * b.spin.x + b.spin.y * b.spin.y + b.spin.z * b.spin.z);
  if (spinMag > 0.5) {
    const magnusX = b.spin.y * b.vel.z - b.spin.z * b.vel.y;
    const magnusY = b.spin.z * b.vel.x - b.spin.x * b.vel.z;
    const magnusZ = b.spin.x * b.vel.y - b.spin.y * b.vel.x;
    const magnusScale = 0.018 * dt;
    b.vel.x += magnusX * magnusScale;
    b.vel.y += magnusY * magnusScale;
    b.vel.z += magnusZ * magnusScale;
  }

  dampSpin(b, BALL_SPIN_AIR_DAMP, dt);

  if (b.pos.y <= BALL_GROUND_Y) {
    b.pos.y = BALL_GROUND_Y;
    const impactVy = Math.abs(b.vel.y);
    if (impactVy > BALL_BOUNCE_TO_ROLL_IMPACT_VY) {
      b.vel.y = impactVy * BALL_BOUNCE_RESTITUTION;
      const groundImpulse = Math.max(0.05, Math.min(0.2, 0.05 + impactVy * 0.02));
      b.vel.x *= BALL_BOUNCE_GROUND_DAMP - groundImpulse * 0.35;
      b.vel.z *= BALL_BOUNCE_GROUND_DAMP - groundImpulse * 0.35;
    } else {
      b.state = "loose";
      b.vel.y = 0;
      b.rollingTime = 0;
      b.rollingLaunchSpeed = Math.sqrt(b.vel.x * b.vel.x + b.vel.z * b.vel.z);
    }
  }
}

function updateRollingBall(b: BallPhysicsState, dt: number): void {
  if (b.rollingTime <= 0) {
    b.rollingLaunchSpeed = Math.max(
      b.rollingLaunchSpeed,
      Math.sqrt(b.vel.x * b.vel.x + b.vel.z * b.vel.z)
    );
  }
  b.rollingTime += dt;

  b.pos.x += b.vel.x * dt;
  b.pos.z += b.vel.z * dt;
  b.pos.y = BALL_GROUND_Y;

  const horizSpeed = Math.sqrt(b.vel.x * b.vel.x + b.vel.z * b.vel.z);
  if (horizSpeed > 0.0001) {
    const dragRamp = 1 - Math.exp(-b.rollingTime * BALL_ROLL_DRAG_RAMP_RATE);
    const dragScale = BALL_ROLL_DRAG_START_FACTOR + (1 - BALL_ROLL_DRAG_START_FACTOR) * dragRamp;
    const dragAccel = (BALL_ROLL_LINEAR_DRAG + BALL_ROLL_QUAD_DRAG * horizSpeed * horizSpeed) * dragScale;
    let newSpeed = Math.max(0, horizSpeed - dragAccel * dt);

    if (b.rollingTime < 0.55 && b.rollingLaunchSpeed > 0.01) {
      const earlyFloor = b.rollingLaunchSpeed * 0.82;
      newSpeed = Math.max(newSpeed, earlyFloor * (1 - dragRamp));
    }

    const scale = newSpeed / horizSpeed;
    b.vel.x *= scale;
    b.vel.z *= scale;
  }

  dampSpin(b, BALL_SPIN_GROUND_DAMP, dt);

  b.vel.y = 0;
  const speedSq = b.vel.x * b.vel.x + b.vel.z * b.vel.z;
  const speedLin = Math.sqrt(speedSq);
  if (speedSq < BALL_ROLL_STOP_SPEED_SQ || speedLin < BALL_STATIC_FRICTION_SPEED) {
    b.state = "dead";
    b.vel = { x: 0, y: 0, z: 0 };
    b.spin = { x: 0, y: 0, z: 0 };
    b.rollingTime = 0;
    b.rollingLaunchSpeed = 0;
  }
}

function dampSpin(b: BallPhysicsState, rate: number, dt: number): void {
  const damp = Math.max(0, 1.0 - dt * rate);
  b.spin.x *= damp;
  b.spin.y *= damp;
  b.spin.z *= damp;
  const sq = b.spin.x * b.spin.x + b.spin.y * b.spin.y + b.spin.z * b.spin.z;
  if (sq < 0.000001) {
    b.spin = { x: 0, y: 0, z: 0 };
  }
}

function findCollector(
  b: BallPhysicsState,
  players: PlayerContactInfo[],
  elapsed: number,
  prevFlatPos?: Vec2,
): PlayerContactInfo | null {
  let collector: PlayerContactInfo | null = null;
  let bestDist = Infinity;

  const intendedReceiver = b.intendedReceiverId
    ? players.find(p => p.id === b.intendedReceiverId)
    : null;
  const inIntendedWindow = elapsed <= b.intendedUntil;

  if (intendedReceiver && inIntendedWindow) {
    const incomingSpeed = Math.sqrt(b.vel.x * b.vel.x + b.vel.z * b.vel.z);
    const receiveHorizon = clamp(
      dist2({ x: b.pos.x, z: b.pos.z }, intendedReceiver.pos) / Math.max(incomingSpeed, 1.5),
      0,
      0.45,
    );
    const projectedReceiverPos = add2(
      intendedReceiver.pos,
      scale2(intendedReceiver.vel, receiveHorizon),
    );
    const receiverRadius = incomingSpeed > 12 ? 1.55 : 1.3;
    const d = dist2({ x: b.pos.x, z: b.pos.z }, intendedReceiver.pos);
    const projectedDist = dist2({ x: b.pos.x, z: b.pos.z }, projectedReceiverPos);
    if (d < receiverRadius || projectedDist < receiverRadius) {
      return intendedReceiver;
    }
    if (prevFlatPos && segmentCrossesReceiverRadius(intendedReceiver.pos, prevFlatPos, { x: b.pos.x, z: b.pos.z }, receiverRadius)) {
      return intendedReceiver;
    }
    if (prevFlatPos && segmentCrossesReceiverRadius(projectedReceiverPos, prevFlatPos, { x: b.pos.x, z: b.pos.z }, receiverRadius)) {
      return intendedReceiver;
    }
  }

  for (const p of players) {
    if (p.id === b.lastHeldById && (elapsed - b.lastHeldAtTime) < 0.15) continue;
    if (p.id === b.ownerPlayerId) continue;

    const d = dist2({ x: b.pos.x, z: b.pos.z }, p.pos);
    let collectRadius: number;

    if (p.isGK && p.isInOwnBox) {
      collectRadius = 1.35;
    } else if (b.isShot && !p.isGK) {
      // Shots bypass outfield players — only the keeper should catch them.
      // Defenders can still deflect via findShotBlockDefender (in_flight only).
      collectRadius = 0.18;
    } else if (intendedReceiver && p.id === intendedReceiver.id && inIntendedWindow) {
      collectRadius = 1.1;
    } else if (b.intendedTeam && p.team === b.intendedTeam && inIntendedWindow) {
      collectRadius = 0.95;
    } else if (b.intendedTeam && p.team !== b.intendedTeam && inIntendedWindow) {
      collectRadius = 0.34;
    } else {
      collectRadius = 0.82;
    }

    if (d < collectRadius && d < bestDist) {
      collector = p;
      bestDist = d;
    }
  }

  return collector;
}

function findShotBlockDefender(
  b: BallPhysicsState,
  players: PlayerContactInfo[],
  prevFlatPos?: Vec2,
): PlayerContactInfo | null {
  const shooter = b.lastHeldById ? players.find((p) => p.id === b.lastHeldById) : null;
  const shooterTeam = shooter?.team ?? null;
  const flatPos = { x: b.pos.x, z: b.pos.z };
  const shotDir = normalize2({ x: b.vel.x, z: b.vel.z });
  let best: PlayerContactInfo | null = null;
  let bestDist = Infinity;

  for (const p of players) {
    if (p.isGK || !p.isInOwnBox) continue;
    if (shooterTeam && p.team === shooterTeam) continue;
    if (b.pos.y > 1.15) continue;
    const d = dist2(flatPos, p.pos);
    if (d > 0.8 || d >= bestDist) continue;
    const movingTowardDefender = (b.vel.x * (p.pos.x - b.pos.x) + b.vel.z * (p.pos.z - b.pos.z)) > 0;
    if (!movingTowardDefender) continue;
    if (shooter) {
      const alongShot = dot2(sub2(p.pos, shooter.pos), shotDir);
      if (alongShot < 1.1) continue;
    }
    const blockRadius = b.pos.y < 0.6 ? 0.6 : 0.42;
    const crossesPath = prevFlatPos
      ? segmentCrossesReceiverRadius(p.pos, prevFlatPos, flatPos, blockRadius)
      : d < blockRadius;
    if (!crossesPath) continue;
    best = p;
    bestDist = d;
  }

  return best;
}

function deflectShotByDefender(
  b: BallPhysicsState,
  defender: PlayerContactInfo,
  elapsed: number,
): void {
  const towardGoalX = Math.sign(b.vel.x || (defender.team === "home" ? -1 : 1)) || 1;
  const outwardZ = Math.sign(Math.abs(b.pos.z) > 0.25 ? b.pos.z : defender.pos.z || 1) || 1;
  const horizSpeed = Math.max(6.5, Math.sqrt(b.vel.x * b.vel.x + b.vel.z * b.vel.z) * 0.78);
  b.state = "in_flight";
  b.ownerPlayerId = null;
  b.ownerTeam = null;
  b.pos.y = Math.max(b.pos.y, BALL_GROUND_Y + 0.12);
  b.vel.x = towardGoalX * Math.max(Math.abs(b.vel.x) * 0.62, horizSpeed * 0.72);
  b.vel.z = outwardZ * Math.max(Math.abs(b.vel.z) + 4.8, horizSpeed * 0.55);
  b.vel.y = Math.max(Math.abs(b.vel.y) * 0.2, 1.2);
  b.spin.z = outwardZ * 8;
  b.spin.y = towardGoalX * 4;
  b.lastHeldById = defender.id;
  b.lastHeldAtTime = elapsed;
  b.intendedReceiverId = null;
  b.intendedTeam = null;
  b.intendedUntil = 0;
  b.isShot = false;
}

function collectBall(b: BallPhysicsState, collector: PlayerContactInfo, elapsed: number): void {
  b.state = "attached";
  b.ownerPlayerId = collector.id;
  b.ownerTeam = collector.team;
  b.vel = { x: 0, y: 0, z: 0 };
  b.spin = { x: 0, y: 0, z: 0 };
  b.rollingTime = 0;
  b.rollingLaunchSpeed = 0;
  b.isShot = false;
  b.lastHeldById = collector.id;
  b.lastHeldAtTime = elapsed;
  b.intendedReceiverId = null;
  b.intendedTeam = null;
  b.intendedUntil = 0;
  b.pos.x = collector.pos.x;
  b.pos.z = collector.pos.z;
}

function findCarrierDispossessor(
  holder: PlayerContactInfo,
  players: PlayerContactInfo[],
): PlayerContactInfo | null {
  if (holder.isGK && holder.isInOwnBox) return null;

  let best: PlayerContactInfo | null = null;
  let bestScore = 0.18;
  for (const challenger of players) {
    if (challenger.id === holder.id || challenger.team === holder.team) continue;

    const d = dist2(holder.pos, challenger.pos);
    if (d > 1.15) continue;

    const toHolder = normalize2(sub2(holder.pos, challenger.pos));
    const challengerDir = len2(challenger.vel) > 0.2
      ? normalize2(challenger.vel)
      : { x: Math.cos(challenger.facingRad), z: Math.sin(challenger.facingRad) };
    const closingAngle = dot2(toHolder, challengerDir);
    if (closingAngle < 0.05 && d > 0.72) continue;

    const tackleSkill = (
      (challenger.defending ?? 60) * 0.42 +
      (challenger.standingTackle ?? challenger.defending ?? 60) * 0.38 +
      (challenger.strength ?? 60) * 0.20
    ) / 100;
    const holderControl = (
      holder.dribbling * 0.6 +
      (holder.reactions ?? 60) * 0.25 +
      (holder.strength ?? 60) * 0.15
    ) / 100;
    const speedPressure = clamp(len2(challenger.vel) / Math.max(challenger.speed, 1), 0, 1) * 0.18;
    const score = tackleSkill + speedPressure - holderControl * 0.72 - d * 0.32;
    if (score <= bestScore) continue;
    best = challenger;
    bestScore = score;
  }

  return best;
}

function applyGoalInteriorCollision(b: BallPhysicsState): void {
  const halfW = GOAL_MOUTH_HALF_Z;
  const goalTopY = GOAL_HEIGHT;
  const leftGoalX = LEFT_GOAL_X;
  const rightGoalX = RIGHT_GOAL_X;
  const leftGoalBackX = leftGoalX - GOAL_FLOOR_DEPTH - BALL_RADIUS;
  const rightGoalBackX = rightGoalX + GOAL_FLOOR_DEPTH + BALL_RADIUS;
  const sideRestitution = 0.28;
  const backRestitution = 0.22;
  const mouthRestitution = 0.18;
  const roofRestitution = 0.16;

  const inGoalHeight = b.pos.y <= goalTopY + BALL_RADIUS;
  const inGoalWidth = Math.abs(b.pos.z) < halfW + BALL_RADIUS;

  if (b.pos.x < leftGoalX && inGoalWidth && inGoalHeight) {
    if (b.pos.x > leftGoalX - BALL_RADIUS) {
      b.pos.x = leftGoalX - BALL_RADIUS;
      b.vel.x = -Math.abs(b.vel.x) * mouthRestitution;
    }
    if (b.pos.x < leftGoalBackX + BALL_RADIUS) {
      b.pos.x = leftGoalBackX + BALL_RADIUS;
      b.vel.x = Math.abs(b.vel.x) * backRestitution;
    }
    if (b.pos.z < -halfW + BALL_RADIUS) {
      b.pos.z = -halfW + BALL_RADIUS;
      b.vel.z = Math.abs(b.vel.z) * sideRestitution;
    } else if (b.pos.z > halfW - BALL_RADIUS) {
      b.pos.z = halfW - BALL_RADIUS;
      b.vel.z = -Math.abs(b.vel.z) * sideRestitution;
    }
    if (b.pos.y > goalTopY - BALL_RADIUS) {
      b.pos.y = goalTopY - BALL_RADIUS;
      b.vel.y = -Math.abs(b.vel.y) * roofRestitution;
    }
    b.vel.x *= 0.7; b.vel.z *= 0.7; b.vel.y *= 0.7;
    b.settleTimer += 0.016;
    const speed = Math.sqrt(b.vel.x * b.vel.x + b.vel.z * b.vel.z);
    if (speed < 0.3 && Math.abs(b.vel.y) < 0.2) {
      b.vel = { x: 0, y: 0, z: 0 };
    }
  }

  if (b.pos.x > rightGoalX && inGoalWidth && inGoalHeight) {
    if (b.pos.x < rightGoalX + BALL_RADIUS) {
      b.pos.x = rightGoalX + BALL_RADIUS;
      b.vel.x = Math.abs(b.vel.x) * mouthRestitution;
    }
    if (b.pos.x > rightGoalBackX - BALL_RADIUS) {
      b.pos.x = rightGoalBackX - BALL_RADIUS;
      b.vel.x = -Math.abs(b.vel.x) * backRestitution;
    }
    if (b.pos.z < -halfW + BALL_RADIUS) {
      b.pos.z = -halfW + BALL_RADIUS;
      b.vel.z = Math.abs(b.vel.z) * sideRestitution;
    } else if (b.pos.z > halfW - BALL_RADIUS) {
      b.pos.z = halfW - BALL_RADIUS;
      b.vel.z = -Math.abs(b.vel.z) * sideRestitution;
    }
    if (b.pos.y > goalTopY - BALL_RADIUS) {
      b.pos.y = goalTopY - BALL_RADIUS;
      b.vel.y = -Math.abs(b.vel.y) * roofRestitution;
    }
    b.vel.x *= 0.7; b.vel.z *= 0.7; b.vel.y *= 0.7;
    b.settleTimer += 0.016;
    const speed = Math.sqrt(b.vel.x * b.vel.x + b.vel.z * b.vel.z);
    if (speed < 0.3 && Math.abs(b.vel.y) < 0.2) {
      b.vel = { x: 0, y: 0, z: 0 };
    }
  }
}

export function computePassSpeed(distance: number, type: PassType): number {
  const base = BASE_RUN_SPEED * GAME_SPEED_SCALE;
  switch (type) {
    case "short": return base * 1.6;
    case "driven": return base * 2.4;
    case "through": return base * 2.0;
    case "cross": return base * 2.2;
    case "cutback": return base * 1.4;
    case "layoff": return base * 1.2;
    case "long": return base * 2.8;
    default: return base * 1.8;
  }
}

export function computeShotSpeed(shootingSkill: number): number {
  const base = BASE_RUN_SPEED * GAME_SPEED_SCALE;
  return base * (2.5 + shootingSkill / 100 * 1.5);
}

export function computeArcHeight(distance: number, type: PassType | "shot"): number {
  switch (type) {
    case "cross": return distance * 0.2;
    case "long": return distance * 0.12;
    case "shot": return distance * 0.08;
    case "driven": return distance * 0.03;
    default: return distance * 0.05;
  }
}

export function isBallInGoalMouth(
  ballX: number,
  ballZ: number,
  ballY: number,
): { scored: boolean; team: "home" | "away" } | null {
  if (ballX > RIGHT_GOAL_X && Math.abs(ballZ) < GOAL_MOUTH_HALF_Z && ballY < GOAL_HEIGHT) {
    return { scored: true, team: "home" };
  }
  if (ballX < LEFT_GOAL_X && Math.abs(ballZ) < GOAL_MOUTH_HALF_Z && ballY < GOAL_HEIGHT) {
    return { scored: true, team: "away" };
  }
  return null;
}
