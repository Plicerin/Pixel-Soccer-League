import * as THREE from 'three';

export const FORMATION_433_ANCHORS = {
  LW: new THREE.Vector3(-20, 0.15, 10),
  ST: new THREE.Vector3(0, 0.15, 12),
  RW: new THREE.Vector3(20, 0.15, 10),
  CM1: new THREE.Vector3(-10, 0.15, 0),
  CM2: new THREE.Vector3(10, 0.15, 0),
  DM: new THREE.Vector3(0, 0.15, -5),
  LB: new THREE.Vector3(-25, 0.15, -10),
  CB1: new THREE.Vector3(-10, 0.15, -15),
  CB2: new THREE.Vector3(10, 0.15, -15),
  RB: new THREE.Vector3(25, 0.15, -10),
} as const;

type TacticalPositionParams = {
  role: string;
  playerPos: THREE.Vector3;
  homePos: THREE.Vector3;
  ballPos: THREE.Vector3;
  teammatePositions: THREE.Vector3[];
  opponentPositions: THREE.Vector3[];
  attackSign: 1 | -1;
  fieldWidth: number;
  fieldDepth: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeRole(role: string) {
  const upper = (role || '').toUpperCase();
  if (upper === 'LM') return 'LW';
  if (upper === 'RM') return 'RW';
  return upper;
}

export function computeIdealTacticalPosition(params: TacticalPositionParams) {
  const {
    role,
    playerPos,
    homePos,
    ballPos,
    teammatePositions,
    opponentPositions,
    attackSign,
    fieldWidth,
    fieldDepth,
  } = params;

  const normalizedRole = normalizeRole(role);
  const ideal = homePos.clone();

  // Ball support shift: everybody leans toward the active play while preserving shape.
  const support = ballPos.clone().sub(ideal).multiplyScalar(0.18);
  support.y = 0;
  ideal.add(support);

  // Teammate spacing: avoid bunching so passing triangles form naturally.
  for (const teammatePos of teammatePositions) {
    const away = playerPos.clone().sub(teammatePos);
    away.y = 0;
    const d = away.length();
    if (d > 0.0001 && d < 6.8) {
      away.normalize().multiplyScalar((6.8 - d) * 0.42);
      ideal.add(away);
    }
  }

  // Opponent pressure: nudge into nearby pockets instead of standing in coverage.
  for (const opponentPos of opponentPositions) {
    const away = ideal.clone().sub(opponentPos);
    away.y = 0;
    const d = away.length();
    if (d > 0.0001 && d < 5.4) {
      away.normalize().multiplyScalar((5.4 - d) * 0.56);
      ideal.add(away);
    }
  }

  if (normalizedRole === 'LW' || normalizedRole === 'RW') {
    ideal.z *= 1.22;
  }

  if (normalizedRole === 'LB' || normalizedRole === 'RB') {
    ideal.z *= 1.1;
  }

  if (normalizedRole === 'CM') {
    ideal.x = THREE.MathUtils.lerp(ideal.x, homePos.x + attackSign * 1.8, 0.18);
  }

  if (normalizedRole === 'DM') {
    const behindBallX = ballPos.x - attackSign * 3.4;
    if ((ideal.x - behindBallX) * attackSign > 0) {
      ideal.x = THREE.MathUtils.lerp(ideal.x, behindBallX, 0.52);
    }
  }

  ideal.x = clamp(ideal.x, -fieldWidth / 2 + 1.5, fieldWidth / 2 - 1.5);
  ideal.z = clamp(ideal.z, -fieldDepth / 2 + 1.5, fieldDepth / 2 - 1.5);
  ideal.y = 0.15;
  return ideal;
}
