import * as THREE from 'three';

export type AttackLaneRole = 'LW' | 'LM' | 'ST' | 'CM' | 'RM' | 'RW';

export type AttackingRunParams = {
  role: string;
  playerPos: THREE.Vector3;
  ballPos: THREE.Vector3;
  defenders: THREE.Vector3[];
  attackSign: 1 | -1;
  fieldWidth: number;
  fieldDepth: number;
  secondLastDefenderX?: number | null;
  laneDepth?: number;
  laneHalfWidth?: number;
  aheadOfBallDistance?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeRole(role: string): AttackLaneRole | null {
  const upper = (role || '').toUpperCase();
  if (upper === 'LW' || upper === 'LM' || upper === 'ST' || upper === 'CM' || upper === 'RM' || upper === 'RW') {
    return upper;
  }
  return null;
}

export function getLaneForRole(role: string, attackSign: 1 | -1, laneDepth = 18, laneHalfWidth = 10) {
  const normalized = normalizeRole(role);
  switch (normalized) {
    case 'LW':
    case 'LM':
      return new THREE.Vector3(attackSign * laneDepth, 0.15, -laneHalfWidth * 1.08);
    case 'RW':
    case 'RM':
      return new THREE.Vector3(attackSign * laneDepth, 0.15, laneHalfWidth * 1.08);
    case 'ST':
      return new THREE.Vector3(attackSign * (laneDepth + 3), 0.15, 0);
    case 'CM':
      return new THREE.Vector3(attackSign * (laneDepth - 3), 0.15, 0);
    default:
      return new THREE.Vector3(attackSign * laneDepth, 0.15, 0);
  }
}

export function computeAttackingRunTarget(params: AttackingRunParams) {
  const {
    role,
    playerPos,
    ballPos,
    defenders,
    attackSign,
    fieldWidth,
    fieldDepth,
    secondLastDefenderX = null,
    laneDepth = 18,
    laneHalfWidth = 10,
    aheadOfBallDistance = 7,
  } = params;

  const lane = getLaneForRole(role, attackSign, laneDepth, laneHalfWidth);
  const laneTarget = lane.clone();

  // Ball-relative depth: attackers stay just ahead of play while still using lane geometry.
  const laneForward = laneTarget.x * attackSign;
  const ballForward = ballPos.x * attackSign;
  const desiredForward = Math.max(laneForward, ballForward + aheadOfBallDistance);
  laneTarget.x = desiredForward * attackSign;

  // Keep a little ball relation laterally so runs look connected to current possession flow.
  laneTarget.z = clamp(laneTarget.z * 0.84 + ballPos.z * 0.16, -fieldDepth / 2 + 1.6, fieldDepth / 2 - 1.6);

  // Defender avoidance: bend target away from nearby defenders.
  const bendRadius = 7.5;
  const bend = new THREE.Vector3();
  defenders.forEach((defPos) => {
    const away = new THREE.Vector3(laneTarget.x - defPos.x, 0, laneTarget.z - defPos.z);
    const d = away.length();
    if (d > 0.0001 && d < bendRadius) {
      away.normalize();
      bend.addScaledVector(away, (bendRadius - d) * 0.9);
    }
  });
  if (bend.lengthSq() > 0.0001) {
    bend.setLength(Math.min(3.6, bend.length()));
    laneTarget.add(bend);
  }

  // Onside control: do not run beyond ball/2nd-last-defender line.
  if (secondLastDefenderX !== null && Number.isFinite(secondLastDefenderX)) {
    const onsideLimit = attackSign > 0
      ? Math.max(ballPos.x, secondLastDefenderX) - 1.9
      : Math.min(ballPos.x, secondLastDefenderX) + 1.9;
    laneTarget.x = attackSign > 0 ? Math.min(laneTarget.x, onsideLimit) : Math.max(laneTarget.x, onsideLimit);
  }

  // Avoid huge backwards snaps if lane solution is far behind current player.
  const backstop = playerPos.x - attackSign * 4.0;
  laneTarget.x = attackSign > 0 ? Math.max(laneTarget.x, backstop) : Math.min(laneTarget.x, backstop);

  laneTarget.x = clamp(laneTarget.x, -fieldWidth / 2 + 1.5, fieldWidth / 2 - 1.5);
  laneTarget.z = clamp(laneTarget.z, -fieldDepth / 2 + 1.5, fieldDepth / 2 - 1.5);
  laneTarget.y = 0.15;
  return laneTarget;
}

export function getForwardRunTriggerBoost(
  role: string,
  ballForwardVelocity: number,
  distanceAheadOfBall: number,
) {
  const normalized = normalizeRole(role);
  if (!normalized) return 1.0;
  const isFrontLine = normalized === 'LW' || normalized === 'LM' || normalized === 'ST' || normalized === 'RM' || normalized === 'RW';
  if (!isFrontLine) return 1.0;

  const progressBurst = ballForwardVelocity > 3.2 ? 1.18 : (ballForwardVelocity > 2.1 ? 1.1 : 1.0);
  const timingBonus = distanceAheadOfBall > 2.8 ? 1.07 : 1.0;
  return clamp(progressBurst * timingBonus, 1.0, 1.28);
}
