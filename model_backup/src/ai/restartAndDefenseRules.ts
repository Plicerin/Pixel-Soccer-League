export type Vec2Like = { x: number; z: number };

export function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeKickoffReceiverSpot(input: {
  center: Vec2Like;
  attackDirection: 1 | -1;
  receiver: Vec2Like;
  fieldDepth: number;
  preferredOwnHalfMeters?: number;
  preferredLateralMeters?: number;
}): Vec2Like {
  const lateralSeed = Math.sign(input.receiver.z || 1) || 1;
  const ownHalfDepth = input.preferredOwnHalfMeters ?? 3.2;
  const lateral = input.preferredLateralMeters ?? 3.4;
  return {
    x: input.center.x - input.attackDirection * ownHalfDepth,
    z: clampValue(lateralSeed * lateral, -input.fieldDepth / 2 + 4.0, input.fieldDepth / 2 - 4.0),
  };
}

export function isKickoffPassSafe(input: {
  center: Vec2Like;
  target: Vec2Like;
  attackDirection: 1 | -1;
  maxDistance?: number;
}): boolean {
  const maxDistance = input.maxDistance ?? 8.0;
  const dxForward = (input.target.x - input.center.x) * input.attackDirection;
  const dist = Math.hypot(input.target.x - input.center.x, input.target.z - input.center.z);
  const inKickingTeamOwnHalf = dxForward <= -0.45;
  return inKickingTeamOwnHalf && dist <= maxDistance && Math.abs(input.target.z - input.center.z) >= 1.25;
}

export type CoachDefenseSpacingRole =
  | 'PRESS_CARRIER'
  | 'COVER_NEAR_POST'
  | 'COVER_CUTBACK'
  | 'TRACK_FAR_POST'
  | 'BLOCK_SECOND_WAVE';

export function spaceCoachGoalMouthDefensiveTarget(input: {
  rawTarget: Vec2Like;
  role: CoachDefenseSpacingRole;
  ownGoalX: number;
  teamAttackDirection: 1 | -1;
  playerHomeZ?: number;
  playerZ?: number;
  shirtNumber?: number;
  goalMouthWidth: number;
  penaltyHalfZ: number;
}): Vec2Like {
  if (input.role === 'PRESS_CARRIER') return { ...input.rawTarget };

  const distFromOwnGoal = Math.abs(input.rawTarget.x - input.ownGoalX);
  const centralGoalMouth = Math.abs(input.rawTarget.z) < input.goalMouthWidth * 1.75;
  if (distFromOwnGoal >= 9.0 && !centralGoalMouth) return { ...input.rawTarget };

  const side =
    Math.sign(input.playerHomeZ || 0)
    || Math.sign(input.playerZ || 0)
    || (input.shirtNumber && input.shirtNumber % 2 ? 1 : -1)
    || 1;
  const depth =
    input.role === 'COVER_NEAR_POST' ? 8.0
    : input.role === 'TRACK_FAR_POST' ? 10.5
    : input.role === 'COVER_CUTBACK' ? 13.0
    : 16.0;
  const zAbs =
    input.role === 'COVER_NEAR_POST' ? input.goalMouthWidth * 1.55
    : input.role === 'TRACK_FAR_POST' ? input.goalMouthWidth * 3.1
    : input.role === 'COVER_CUTBACK' ? input.goalMouthWidth * 2.25
    : input.goalMouthWidth * 1.9;

  return {
    x: input.ownGoalX + input.teamAttackDirection * depth,
    z: clampValue(side * zAbs, -input.penaltyHalfZ, input.penaltyHalfZ),
  };
}
