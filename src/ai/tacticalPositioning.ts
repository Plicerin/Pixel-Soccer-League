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
  ballCarrierPos?: THREE.Vector3;
  ballCarrierRole?: string;
  isTeamInPossession?: boolean;
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
  // Work entirely in scalars to avoid per-call heap allocations
  let ix = homePos.x;
  let iy = homePos.y;
  let iz = homePos.z;

  // Ball support shift: everybody leans toward the active play while preserving shape.
  ix += (ballPos.x - ix) * 0.18;
  iz += (ballPos.z - iz) * 0.18;

  // Teammate spacing: avoid bunching so passing triangles form naturally.
  for (const teammatePos of teammatePositions) {
    const dx = playerPos.x - teammatePos.x;
    const dz = playerPos.z - teammatePos.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > 0.0001 && d < 6.8) {
      const scale = (6.8 - d) * 0.42 / d;
      ix += dx * scale;
      iz += dz * scale;
    }
  }

  // Opponent pressure: nudge into nearby pockets instead of standing in coverage.
  for (const opponentPos of opponentPositions) {
    const dx = ix - opponentPos.x;
    const dz = iz - opponentPos.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > 0.0001 && d < 5.4) {
      const scale = (5.4 - d) * 0.56 / d;
      ix += dx * scale;
      iz += dz * scale;
    }
  }

  // Box the result back into a Vector3 — one allocation per call (the return value)
  const ideal = new THREE.Vector3(ix, iy, iz);

  if (normalizedRole === 'LW' || normalizedRole === 'RW') {
    ideal.z *= 1.22;
  }

  if (normalizedRole === 'LB' || normalizedRole === 'RB') {
    ideal.z *= 1.1;
  }

  if (normalizedRole === 'ST') {
    // Strikers aggressively push into the penalty area during attacks
    const goalX = attackSign > 0 ? fieldWidth / 2 : -fieldWidth / 2;
    const distToGoal = Math.abs(goalX - homePos.x);
    const ballDistToGoal = Math.abs(goalX - ballPos.x);
    const isInAttackingPhase = ballPos.x * attackSign > homePos.x * attackSign - 20; // Wider attacking window
    const isInFinalThird = ballDistToGoal < 35; // Expanded final third
    const isInDangerZone = ballDistToGoal < 25; // Very close to goal

    if (isInAttackingPhase && isInDangerZone) {
      // Danger zone: push DEEP into penalty area for tap-ins (12-13 units from goal)
      ideal.x = THREE.MathUtils.lerp(ideal.x, goalX - attackSign * 12.5, 0.55);
    } else if (isInAttackingPhase && isInFinalThird) {
      // Final third: aggressive push into penalty area (13-14 units from goal)
      ideal.x = THREE.MathUtils.lerp(ideal.x, goalX - attackSign * 13.5, 0.48);
    } else if (isInAttackingPhase && distToGoal > 15) {
      // Mid-field attack: push forward to be ready (15 units from goal)
      ideal.x = THREE.MathUtils.lerp(ideal.x, goalX - attackSign * 15, 0.35);
    }

    // Strikers spread wide when attacking to create passing options and escape markers
    if (isInAttackingPhase) {
      if (Math.abs(ideal.z) < 7) {
        // If too central, aggressively push toward wings
        const widthTarget = ideal.z > 0 ? 8.5 : -8.5;
        ideal.z = THREE.MathUtils.lerp(ideal.z, widthTarget, 0.24);
      } else if (Math.abs(ideal.z) < 5) {
        // Very central: even more aggressive push
        const widthTarget = ideal.z > 0 ? 10 : -10;
        ideal.z = THREE.MathUtils.lerp(ideal.z, widthTarget, 0.32);
      }
    }
  }

  if (normalizedRole === 'CM') {
    ideal.x = THREE.MathUtils.lerp(ideal.x, homePos.x + attackSign * 1.4, 0.18);
  }

  if (normalizedRole === 'DM') {
    const behindBallX = ballPos.x - attackSign * 3.4;
    if ((ideal.x - behindBallX) * attackSign > 0) {
      ideal.x = THREE.MathUtils.lerp(ideal.x, behindBallX, 0.52);
    }
  }

  // ── Aggressive support runs: create safe passing lanes ──
  const { ballCarrierPos, ballCarrierRole, isTeamInPossession } = params;
  if (isTeamInPossession && ballCarrierPos && ballCarrierRole && normalizedRole !== 'CB' && normalizedRole !== 'LB' && normalizedRole !== 'RB') {
    const distToBallCarrier = Math.sqrt((ideal.x - ballCarrierPos.x) ** 2 + (ideal.z - ballCarrierPos.z) ** 2);
    const isAttackingPlayer = ['ST', 'LW', 'RW', 'CM'].includes(normalizedRole);
    const isMidfielder = normalizedRole === 'CM';

    if (isAttackingPlayer && distToBallCarrier < 25) {
      // Forward run: aggressive push 6-8 units ahead of ball carrier
      const forwardTarget = ballCarrierPos.x + attackSign * (6 + (normalizedRole === 'ST' ? 2 : 0));
      ideal.x = THREE.MathUtils.lerp(ideal.x, forwardTarget, 0.42);

      // Wide spacing for wingers: push to ±(10-12) units from center
      if (normalizedRole === 'LW' || normalizedRole === 'RW') {
        const wideTarget = normalizedRole === 'LW' ? -11 : 11;
        ideal.z = THREE.MathUtils.lerp(ideal.z, wideTarget, 0.38);
      }
      // Midfielders create depth stagger: spread at different X depths for passing options
      else if (isMidfielder) {
        const distanceFromCarrier = ideal.x - ballCarrierPos.x;
        // Position at staggered depths: one closer, one further
        const targetDepth = Math.abs(distanceFromCarrier) < 8 ? ballCarrierPos.x + attackSign * 4 : ballCarrierPos.x + attackSign * 10;
        ideal.x = THREE.MathUtils.lerp(ideal.x, targetDepth, 0.35);
      }
    }
  }

  ideal.x = clamp(ideal.x, -fieldWidth / 2 + 1.5, fieldWidth / 2 - 1.5);
  ideal.z = clamp(ideal.z, -fieldDepth / 2 + 1.5, fieldDepth / 2 - 1.5);
  ideal.y = 0.15;
  return ideal;
}
