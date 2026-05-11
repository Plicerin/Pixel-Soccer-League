export type CoachAuthorityReason = 'carrier_stall' | 'final_third_clock' | 'pattern_contract';

export type CoachAuthorityDecision = {
  action: 'shot' | 'pass';
  reason: CoachAuthorityReason;
};

export type CoachAuthorityPoint = {
  x: number;
  z: number;
};

export type CoachAuthorityMoveCommand = {
  target: CoachAuthorityPoint;
  owner: string;
  maxSpeed: number;
};

export type CoachAuthorityMovementInput = {
  previous: CoachAuthorityPoint;
  attempted: CoachAuthorityPoint;
  command: CoachAuthorityMoveCommand | null;
  dt: number;
  fieldWidth: number;
  fieldDepth: number;
  speedSlack?: number;
  routeTolerance?: number;
};

export type CoachAuthorityMovementViolation =
  | 'missing_command'
  | 'speed_cap'
  | 'field_bounds'
  | 'off_route';

export type CoachAuthorityMovementResult = {
  position: CoachAuthorityPoint;
  violations: CoachAuthorityMovementViolation[];
  attemptedSpeed: number;
  allowedSpeed: number;
};

export type LiveMovementAuthorityInput = {
  previous: CoachAuthorityPoint;
  attempted: CoachAuthorityPoint;
  dt: number;
  maxSpeed: number;
  fieldWidth: number;
  fieldDepth: number;
  allowTeleport?: boolean;
  speedSlack?: number;
};

export type LiveMovementAuthorityViolation =
  | 'live_speed_cap'
  | 'field_bounds';

export type LiveMovementAuthorityResult = {
  position: CoachAuthorityPoint;
  violations: LiveMovementAuthorityViolation[];
  attemptedSpeed: number;
  allowedSpeed: number;
  capped: boolean;
};

export type CoachAuthorityInput = {
  inAttackResolutionZone: boolean;
  holdSeconds: number;
  finalThirdAge: number;
  timeSinceTeamShot: number;
  patternResolutionDue: boolean;
  hasPassTarget: boolean;
  canShoot: boolean;
  shotAngle: number;
  distToGoal: number;
  maxCarrySeconds?: number;
};

const ATTACK_HOLD_CAP_SECONDS = 2.25;
const FINAL_THIRD_CLOCK_CAP_SECONDS = 2.75;
const MIN_TEAM_SHOT_GAP_SECONDS = 1.0;
const MIN_RECEIVER_SETTLE_SECONDS = 0.85;

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

export function clampFrameBlend(dt: number, rate: number, min = 0, max = 1) {
  const safeDt = Number.isFinite(dt) ? dt : 0;
  const safeRate = Number.isFinite(rate) ? rate : 0;
  return clampNumber(safeDt * safeRate, min, max);
}

export function enforceCoachAuthorityMovement(input: CoachAuthorityMovementInput): CoachAuthorityMovementResult {
  const violations: CoachAuthorityMovementViolation[] = [];
  const safeDt = Math.max(0.001, Number.isFinite(input.dt) ? input.dt : 0.001);
  const speedSlack = input.speedSlack ?? 1.08;
  const routeTolerance = input.routeTolerance ?? 0.08;
  const halfW = Math.max(0, input.fieldWidth / 2);
  const halfD = Math.max(0, input.fieldDepth / 2);
  const previous = {
    x: Number.isFinite(input.previous.x) ? input.previous.x : 0,
    z: Number.isFinite(input.previous.z) ? input.previous.z : 0,
  };
  let position = {
    x: Number.isFinite(input.attempted.x) ? input.attempted.x : previous.x,
    z: Number.isFinite(input.attempted.z) ? input.attempted.z : previous.z,
  };

  if (!input.command) {
    const uncommandedDistance = Math.hypot(position.x - previous.x, position.z - previous.z);
    if (uncommandedDistance > routeTolerance) {
      position = { ...previous };
      violations.push('missing_command');
    }
  } else {
    const bounded = {
      x: clampNumber(position.x, -halfW, halfW),
      z: clampNumber(position.z, -halfD, halfD),
    };
    if (bounded.x !== position.x || bounded.z !== position.z) {
      violations.push('field_bounds');
      position = bounded;
    }

    const dx = position.x - previous.x;
    const dz = position.z - previous.z;
    const attemptedDistance = Math.hypot(dx, dz);
    const maxStep = Math.max(0, input.command.maxSpeed * speedSlack * safeDt);
    if (attemptedDistance > maxStep && attemptedDistance > 0.0001) {
      const scale = maxStep / attemptedDistance;
      position = {
        x: previous.x + dx * scale,
        z: previous.z + dz * scale,
      };
      violations.push('speed_cap');
    }

    const targetDx = input.command.target.x - previous.x;
    const targetDz = input.command.target.z - previous.z;
    const targetDist = Math.hypot(targetDx, targetDz);
    const moveDx = position.x - previous.x;
    const moveDz = position.z - previous.z;
    const moveDist = Math.hypot(moveDx, moveDz);
    if (targetDist > routeTolerance && moveDist > routeTolerance) {
      const routeDot = (targetDx * moveDx + targetDz * moveDz) / Math.max(0.0001, targetDist * moveDist);
      if (routeDot < -0.15) {
        const step = Math.min(maxStep, targetDist);
        position = {
          x: previous.x + (targetDx / targetDist) * step,
          z: previous.z + (targetDz / targetDist) * step,
        };
        violations.push('off_route');
      }
    }

    const finalBounded = {
      x: clampNumber(position.x, -halfW, halfW),
      z: clampNumber(position.z, -halfD, halfD),
    };
    if (finalBounded.x !== position.x || finalBounded.z !== position.z) {
      violations.push('field_bounds');
      position = finalBounded;
    }
  }

  const attemptedSpeed = Math.hypot(input.attempted.x - previous.x, input.attempted.z - previous.z) / safeDt;
  const allowedSpeed = input.command ? input.command.maxSpeed * speedSlack : 0;
  return {
    position,
    violations: unique(violations),
    attemptedSpeed,
    allowedSpeed,
  };
}

export function enforceLiveMovementAuthority(input: LiveMovementAuthorityInput): LiveMovementAuthorityResult {
  const violations: LiveMovementAuthorityViolation[] = [];
  const safeDt = Math.max(0.001, Number.isFinite(input.dt) ? input.dt : 0.001);
  const speedSlack = input.speedSlack ?? 1.08;
  const halfW = Math.max(0, input.fieldWidth / 2);
  const halfD = Math.max(0, input.fieldDepth / 2);
  const previous = {
    x: Number.isFinite(input.previous.x) ? input.previous.x : 0,
    z: Number.isFinite(input.previous.z) ? input.previous.z : 0,
  };
  let position = {
    x: Number.isFinite(input.attempted.x) ? input.attempted.x : previous.x,
    z: Number.isFinite(input.attempted.z) ? input.attempted.z : previous.z,
  };

  const bounded = {
    x: clampNumber(position.x, -halfW, halfW),
    z: clampNumber(position.z, -halfD, halfD),
  };
  if (bounded.x !== position.x || bounded.z !== position.z) {
    position = bounded;
    violations.push('field_bounds');
  }

  const dx = position.x - previous.x;
  const dz = position.z - previous.z;
  const attemptedDistance = Math.hypot(dx, dz);
  const allowedSpeed = Math.max(0, input.maxSpeed * speedSlack);
  const maxStep = allowedSpeed * safeDt;
  let capped = false;
  if (!input.allowTeleport && attemptedDistance > maxStep && attemptedDistance > 0.0001) {
    const scale = maxStep / attemptedDistance;
    position = {
      x: previous.x + dx * scale,
      z: previous.z + dz * scale,
    };
    violations.push('live_speed_cap');
    capped = true;
  }

  const finalBounded = {
    x: clampNumber(position.x, -halfW, halfW),
    z: clampNumber(position.z, -halfD, halfD),
  };
  if (finalBounded.x !== position.x || finalBounded.z !== position.z) {
    position = finalBounded;
    violations.push('field_bounds');
  }

  return {
    position,
    violations: unique(violations),
    attemptedSpeed: attemptedDistance / safeDt,
    allowedSpeed,
    capped,
  };
}

export function selectCoachAuthorityAction(input: CoachAuthorityInput): CoachAuthorityDecision | null {
  const maxCarrySeconds = input.maxCarrySeconds ?? 6.0;
  const hardStall = input.holdSeconds >= maxCarrySeconds;
  const finalThirdClockDue =
    input.inAttackResolutionZone
    && input.timeSinceTeamShot >= MIN_TEAM_SHOT_GAP_SECONDS
    && (
      input.holdSeconds >= ATTACK_HOLD_CAP_SECONDS
      || (input.finalThirdAge >= FINAL_THIRD_CLOCK_CAP_SECONDS && input.holdSeconds >= MIN_RECEIVER_SETTLE_SECONDS)
    );
  const patternDue =
    input.inAttackResolutionZone
    && input.timeSinceTeamShot >= MIN_TEAM_SHOT_GAP_SECONDS
    && input.patternResolutionDue
    && input.holdSeconds >= MIN_RECEIVER_SETTLE_SECONDS;

  if (!hardStall && !finalThirdClockDue && !patternDue) return null;

  const reason: CoachAuthorityReason =
    hardStall ? 'carrier_stall'
    : patternDue ? 'pattern_contract'
    : 'final_third_clock';

  const strongShot =
    input.canShoot
    && (
      input.distToGoal <= 14
      || (input.distToGoal <= 20 && input.shotAngle <= 0.48)
      || (!input.hasPassTarget && input.distToGoal <= 22 && input.shotAngle <= 0.70)
      || (hardStall && input.distToGoal <= 24 && input.shotAngle <= 0.62)
    );

  if (strongShot) return { action: 'shot', reason };
  if (input.hasPassTarget) return { action: 'pass', reason };
  if (input.canShoot && input.distToGoal <= 30 && input.shotAngle <= 0.88) return { action: 'shot', reason };
  return null;
}
