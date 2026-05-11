import type { Vec2, PlayerIntent, PlayerBelief, DefensiveCoverRole } from "./types";
import {
  PLAYER_RADIUS,
  PLAYER_GROUND_DRAG_RATE,
  PLAYER_STOP_SPEED_SQ,
  GAME_SPEED_SCALE,
  BASE_RUN_SPEED,
  SPRINT_MULTIPLIER,
  JOG_MULTIPLIER,
  WALK_MULTIPLIER,
  dist2,
  dist2sq,
  normalize2,
  sub2,
  add2,
  scale2,
  len2,
  len2 as speed2,
  clamp,
  angle2,
} from "./constants";

export type MotionResult = {
  newPos: Vec2;
  newVel: Vec2;
  newFacing: number;
  speedUsed: number;
  intentName: string;
};

export function intentTarget(intent: PlayerIntent): Vec2 {
  switch (intent.name) {
    case "move_to": return intent.target;
    case "receive": return intent.target;
    case "support": return intent.target;
    case "overlap": return intent.target;
    case "carry": return intent.target;
    case "pass": return intent.targetPoint;
    case "shoot": return intent.target;
    case "press": return intent.target;
    case "contain": return intent.target;
    case "intercept": return intent.ballInterceptPoint;
    case "clear": return { x: intent.direction.x, z: intent.direction.z };
    case "track_runner": return intent.target;
    case "cover": return intent.target;
    case "hold_position": return intent.target;
    case "goalkeeper_position": return intent.targetPos;
    case "goalkeeper_dive": return intent.targetPos;
    case "goalkeeper_claim": return intent.target;
    case "goalkeeper_distribute": return intent.targetPoint;
  }
}

export function intentUrgency(intent: PlayerIntent): number {
  switch (intent.name) {
    case "move_to": return intent.urgency;
    case "press": return intent.intensity;
    case "goalkeeper_dive": return intent.intensity;
    case "intercept": return 1.0;
    case "cover": return 0.9;
    case "shoot": return 1.0;
    case "clear": return 0.9;
    case "goalkeeper_claim": return 0.9;
    default: return 0.6;
  }
}

export function intentSpeedMultiplier(intent: PlayerIntent): number {
  switch (intent.name) {
    case "move_to": return intent.urgency > 0.8 ? SPRINT_MULTIPLIER : JOG_MULTIPLIER;
    case "press": return SPRINT_MULTIPLIER;
    case "intercept": return SPRINT_MULTIPLIER;
    case "receive": return SPRINT_MULTIPLIER * 0.85;
    case "support": return JOG_MULTIPLIER;
    case "overlap": return SPRINT_MULTIPLIER;
    case "carry": return JOG_MULTIPLIER;
    case "pass": return WALK_MULTIPLIER;
    case "shoot": return 0.1;
    case "contain": return JOG_MULTIPLIER * 0.7;
    case "clear": return WALK_MULTIPLIER;
    case "track_runner": return SPRINT_MULTIPLIER;
    case "cover": return SPRINT_MULTIPLIER * 0.92;
    case "hold_position": return WALK_MULTIPLIER;
    case "goalkeeper_position": return JOG_MULTIPLIER;
    case "goalkeeper_dive": return SPRINT_MULTIPLIER * 1.1;
    case "goalkeeper_claim": return SPRINT_MULTIPLIER;
    case "goalkeeper_distribute": return WALK_MULTIPLIER;
    default: return JOG_MULTIPLIER;
  }
}

export function applyMotion(
  player: PlayerBelief,
  intent: PlayerIntent,
  dt: number,
): MotionResult {
  const target = intentTarget(intent);
  const urgency = intentUrgency(intent);
  const speedMul = intentSpeedMultiplier(intent);
  const maxSpeed = player.speed * speedMul;
  const maxAccel = player.acceleration;

  const toTarget = sub2(target, player.pos);
  const distToTarget = len2(toTarget);
  const arrivalThreshold = intent.name === "hold_position" ? 0.3 : 0.5;

  let desiredVel: Vec2;

  if (distToTarget < arrivalThreshold) {
    desiredVel = { x: 0, z: 0 };
  } else {
    const dirToTarget = normalize2(toTarget);

    if (intent.name === "contain") {
      const jockeyAngle = intent.jockeyAngle;
      const perpX = -Math.sin(jockeyAngle);
      const perpZ = Math.cos(jockeyAngle);
      desiredVel = {
        x: (dirToTarget.x * 0.5 + perpX * 0.5) * maxSpeed,
        z: (dirToTarget.z * 0.5 + perpZ * 0.5) * maxSpeed,
      };
    } else if (distToTarget < 2.0 && urgency < 0.9) {
      const approachSpeed = maxSpeed * (distToTarget / 2.0);
      desiredVel = scale2(dirToTarget, approachSpeed);
    } else {
      desiredVel = scale2(dirToTarget, maxSpeed);
    }
  }

  const dv = sub2(desiredVel, player.vel);
  const dvLen = len2(dv);
  const maxDeltaV = maxAccel * dt;

  let newVel: Vec2;
  if (dvLen <= maxDeltaV) {
    newVel = desiredVel;
  } else {
    const dvNorm = normalize2(dv);
    newVel = add2(player.vel, scale2(dvNorm, maxDeltaV));
  }

  const newSpeed = len2(newVel);
  if (newSpeed > maxSpeed) {
    newVel = scale2(normalize2(newVel), maxSpeed);
  }

  if (newSpeed * newSpeed < PLAYER_STOP_SPEED_SQ) {
    newVel = { x: 0, z: 0 };
  }

  let newPos = add2(player.pos, scale2(newVel, dt));

  let newFacing: number;
  if (newSpeed > 0.1) {
    newFacing = Math.atan2(newVel.z, newVel.x);
  } else if (distToTarget > arrivalThreshold) {
    newFacing = Math.atan2(toTarget.z, toTarget.x);
  } else {
    newFacing = player.facingRad;
  }

  return {
    newPos,
    newVel,
    newFacing,
    speedUsed: newSpeed,
    intentName: intent.name,
  };
}

export type CollisionPair = {
  a: string;
  b: string;
  overlap: number;
  pushA: Vec2;
  pushB: Vec2;
};

export function resolveCollisions(
  positions: Map<string, { pos: Vec2; vel: Vec2; speed: number }>,
  dt: number,
): Map<string, Vec2> {
  const corrections = new Map<string, Vec2>();
  const entries = Array.from(positions.entries());
  const minDist = PLAYER_RADIUS * 2;
  const minDistSq = minDist * minDist;

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [idA, a] = entries[i];
      const [idB, b] = entries[j];

      const dx = b.pos.x - a.pos.x;
      const dz = b.pos.z - a.pos.z;
      const distSq = dx * dx + dz * dz;

      if (distSq < minDistSq && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const overlap = minDist - dist;
        const nx = dx / dist;
        const nz = dz / dist;
        const pushHalf = overlap * 0.5;
        const maxPush = Math.max(a.speed, b.speed) * dt;

        const pushA = Math.min(pushHalf, maxPush);
        const pushB = Math.min(pushHalf, maxPush);

        const corrA = corrections.get(idA) ?? { x: 0, z: 0 };
        corrections.set(idA, {
          x: corrA.x - nx * pushA,
          z: corrA.z - nz * pushA,
        });

        const corrB = corrections.get(idB) ?? { x: 0, z: 0 };
        corrections.set(idB, {
          x: corrB.x + nx * pushB,
          z: corrB.z + nz * pushB,
        });
      }
    }
  }

  return corrections;
}

export function applyMotionWithCollision(
  players: Array<{
    id: string;
    pos: Vec2;
    vel: Vec2;
    facingRad: number;
    speed: number;
    acceleration: number;
  }>,
  intents: Map<string, PlayerIntent>,
  dt: number,
): Map<string, MotionResult> {
  const results = new Map<string, MotionResult>();

  for (const p of players) {
    const intent = intents.get(p.id);
    if (!intent) {
      results.set(p.id, {
        newPos: p.pos,
        newVel: p.vel,
        newFacing: p.facingRad,
        speedUsed: 0,
        intentName: "hold_position",
      });
      continue;
    }

    const belief: PlayerBelief = {
      id: p.id,
      team: "home",
      role: "CM_L",
      pos: p.pos,
      vel: p.vel,
      facingRad: p.facingRad,
      stamina01: 1,
      hasBall: false,
      isGK: false,
      speed: p.speed,
      acceleration: p.acceleration,
      currentIntent: intent.name as any,
      ratings: {} as any,
    };

    const result = applyMotion(belief, intent, dt);
    results.set(p.id, result);
  }

  const positionMap = new Map<string, { pos: Vec2; vel: Vec2; speed: number }>();
  for (const p of players) {
    const r = results.get(p.id);
    if (r) {
      positionMap.set(p.id, { pos: r.newPos, vel: r.newVel, speed: p.speed });
    }
  }

  const corrections = resolveCollisions(positionMap, dt);
  for (const [id, corr] of corrections) {
    const r = results.get(id);
    if (r) {
      r.newPos = add2(r.newPos, corr);
    }
  }

  return results;
}

export function clampSpeed(
  actualSpeed: number,
  maxSpeed: number,
  teleportThreshold: number = maxSpeed * 1.5,
): { clampedSpeed: number; isTeleport: boolean } {
  return {
    clampedSpeed: Math.min(actualSpeed, maxSpeed),
    isTeleport: actualSpeed > teleportThreshold,
  };
}
