import * as THREE from 'three';

type DefensivePositionParams = {
  role: string;
  defensiveHome: THREE.Vector3;
  ballPos: THREE.Vector3;
  opponentPositions: THREE.Vector3[];
  fieldWidth: number;
  fieldDepth: number;
};

type DefensiveBoundsParams = {
  role: string;
  target: THREE.Vector3;
  ballPos: THREE.Vector3;
  attackSign: 1 | -1;
  fieldWidth: number;
  fieldDepth: number;
};

type PressDecisionParams = {
  playerPos: THREE.Vector3;
  ballPos: THREE.Vector3;
  opponentPos: THREE.Vector3;
  opponentFacingAway: boolean;
  ballIsLoose: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distancePointToSegment(point: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) {
  const ab = new THREE.Vector3().subVectors(b, a);
  const ap = new THREE.Vector3().subVectors(point, a);
  const abLenSq = ab.lengthSq();
  if (abLenSq < 0.0001) return point.distanceTo(a);
  const t = clamp(ap.dot(ab) / abLenSq, 0, 1);
  const closest = a.clone().addScaledVector(ab, t);
  return point.distanceTo(closest);
}

export function computeDefensivePosition(params: DefensivePositionParams) {
  const { role, defensiveHome, ballPos, opponentPositions, fieldWidth, fieldDepth } = params;
  const upperRole = (role || '').toUpperCase();
  const ideal = defensiveHome.clone();

  // Ball-side compactness.
  const shift = ballPos.clone().sub(ideal).multiplyScalar(0.1);
  shift.y = 0;
  ideal.add(shift);

  // Keep defensive block compact across width.
  ideal.z = clamp(ideal.z, -24.0, 24.0);

  // Center-backs avoid getting dragged too high.
  if (upperRole === 'CB') {
    ideal.x = Math.max(ideal.x, defensiveHome.x - 4);
  }

  // Protect dangerous pockets by adjusting away from nearby attackers.
  for (const opPos of opponentPositions) {
    const d = ideal.distanceTo(opPos);
    if (d > 0.0001 && d < 5) {
      const adjust = ideal.clone().sub(opPos).normalize().multiplyScalar((5 - d) * 0.6);
      ideal.add(adjust);
    }
  }

  ideal.x = clamp(ideal.x, -fieldWidth / 2 + 1.5, fieldWidth / 2 - 1.5);
  ideal.z = clamp(ideal.z, -fieldDepth / 2 + 1.5, fieldDepth / 2 - 1.5);
  ideal.y = 0.15;
  return ideal;
}

export function computeDefensiveDynamicOffset(params: DefensivePositionParams) {
  const { role, defensiveHome, ballPos, opponentPositions, fieldWidth, fieldDepth } = params;
  const upperRole = (role || '').toUpperCase();
  const offset = new THREE.Vector3();

  const ballShift = ballPos.clone().sub(defensiveHome).multiplyScalar(0.12);
  ballShift.y = 0;
  offset.add(ballShift);

  for (const opPos of opponentPositions) {
    const d = defensiveHome.distanceTo(opPos);
    if (d > 0.0001 && d < 5) {
      const escape = defensiveHome.clone().sub(opPos).normalize().multiplyScalar((5 - d) * 0.5);
      offset.add(escape);
    }
  }

  const dynamic = defensiveHome.clone().add(offset);
  if (upperRole === 'CB') {
    dynamic.x = Math.max(dynamic.x, defensiveHome.x - 4);
  }
  dynamic.x = clamp(dynamic.x, -fieldWidth / 2 + 1.5, fieldWidth / 2 - 1.5);
  dynamic.z = clamp(dynamic.z, -fieldDepth / 2 + 1.5, fieldDepth / 2 - 1.5);
  dynamic.y = 0.15;
  return dynamic;
}

export function computeDisciplinedDefensivePosition(home: THREE.Vector3, dynamicTarget: THREE.Vector3, discipline: number) {
  const d = clamp(discipline, 0, 1);
  return home.clone().multiplyScalar(d).add(dynamicTarget.clone().multiplyScalar(1 - d));
}

export function applyDefensiveDisciplineBounds(params: DefensiveBoundsParams) {
  const { role, target, ballPos, attackSign, fieldWidth, fieldDepth } = params;
  const upperRole = (role || '').toUpperCase();
  const bounded = target.clone();

  if (['CB', 'LB', 'RB', 'DM', 'CM'].includes(upperRole)) {
    const maxAheadX = ballPos.x - attackSign * 2.8;
    bounded.x = attackSign > 0 ? Math.min(bounded.x, maxAheadX) : Math.max(bounded.x, maxAheadX);
    bounded.z = clamp(bounded.z, -24.0, 24.0);
  }

  bounded.x = clamp(bounded.x, -fieldWidth / 2 + 1.5, fieldWidth / 2 - 1.5);
  bounded.z = clamp(bounded.z, -fieldDepth / 2 + 1.5, fieldDepth / 2 - 1.5);
  bounded.y = 0.15;
  return bounded;
}

export function computeDefensiveLineHome(
  role: string,
  defensiveHome: THREE.Vector3,
  ballPos: THREE.Vector3,
  playerPos: THREE.Vector3,
  nearBallPressure: boolean,
  attackSign: 1 | -1,
  fieldWidth: number,
) {
  const upperRole = (role || '').toUpperCase();
  if (!['CB', 'LB', 'RB'].includes(upperRole)) return defensiveHome;

  const next = defensiveHome.clone();
  const ballAhead = (ballPos.x - playerPos.x) * attackSign > 2;
  if (ballAhead) next.x += attackSign * 0.14;
  if (nearBallPressure) next.x -= attackSign * 0.14;

  next.x = clamp(next.x, -fieldWidth / 2 + 1.5, fieldWidth / 2 - 1.5);
  next.y = 0.15;
  return next;
}

export function findDefensiveMarkTarget(playerPos: THREE.Vector3, opponentPositions: THREE.Vector3[], maxDistance = 12) {
  let bestIndex = -1;
  let bestDist = Infinity;
  opponentPositions.forEach((opPos, idx) => {
    const d = playerPos.distanceTo(opPos);
    if (d < bestDist && d < maxDistance) {
      bestDist = d;
      bestIndex = idx;
    }
  });
  return bestIndex;
}

export function getRunnerTrackingVelocity(playerPos: THREE.Vector3, runnerPos: THREE.Vector3, defensiveSpeed: number) {
  const dir = runnerPos.clone().sub(playerPos);
  dir.y = 0;
  const dist = dir.length();
  if (dist < 7.0 && dist > 0.0001) {
    return dir.normalize().multiplyScalar(defensiveSpeed * 0.92);
  }
  return new THREE.Vector3(0, 0, 0);
}

export function shouldDefenderPress(params: PressDecisionParams) {
  const { playerPos, ballPos, opponentPos, opponentFacingAway, ballIsLoose } = params;
  const ballDist = ballPos.distanceTo(playerPos);
  const opDist = opponentPos.distanceTo(playerPos);
  if (ballDist < 4.2) return true;
  if (opDist < 3.2 && opponentFacingAway && ballDist < 5.8) return true;
  if (ballIsLoose && ballDist < 8.6) return true;
  return false;
}

export function predictInterceptionOpportunity(playerPos: THREE.Vector3, passerPos: THREE.Vector3, targetPos: THREE.Vector3, interceptionRadius = 2.5) {
  const laneDist = distancePointToSegment(playerPos, passerPos, targetPos);
  return laneDist < interceptionRadius;
}
