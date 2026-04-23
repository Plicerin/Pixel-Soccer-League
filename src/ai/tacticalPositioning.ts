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
    // Temporary de-privileging test: striker tactical target should not outrun CM support by design.
    ideal.x = THREE.MathUtils.lerp(ideal.x, homePos.x + attackSign * 1.4, 0.18);
  }

  if (normalizedRole === 'CM') {
    ideal.x = THREE.MathUtils.lerp(ideal.x, homePos.x + attackSign * 1.4, 0.18);
  }

  if (normalizedRole === 'DM') {
    const goalX = attackSign > 0 ? fieldWidth / 2 : -fieldWidth / 2;
    const ballDistToGoal = Math.abs(goalX - ballPos.x);
    const inAttackingHalf = ballPos.x * attackSign > homePos.x * attackSign + 6;
    const allowHigherSupport = inAttackingHalf && ballDistToGoal < 34;
    const behindBallOffset = allowHigherSupport ? 0.8 : 3.4;
    const behindBallBlend = allowHigherSupport ? 0.22 : 0.52;
    const behindBallX = ballPos.x - attackSign * behindBallOffset;
    if ((ideal.x - behindBallX) * attackSign > 0) {
      ideal.x = THREE.MathUtils.lerp(ideal.x, behindBallX, behindBallBlend);
    }
  }

  // ── Aggressive support runs: create safe passing lanes ──
  const { ballCarrierPos, ballCarrierRole, isTeamInPossession } = params;
  if (isTeamInPossession && ballCarrierPos && ballCarrierRole && normalizedRole !== 'CB' && normalizedRole !== 'LB' && normalizedRole !== 'RB') {
    const distToBallCarrier = Math.sqrt((ideal.x - ballCarrierPos.x) ** 2 + (ideal.z - ballCarrierPos.z) ** 2);
    const isAttackingPlayer = ['ST', 'LW', 'RW', 'CM', 'DM'].includes(normalizedRole);
    const isMidfielder = normalizedRole === 'CM' || normalizedRole === 'DM';

    if (isAttackingPlayer && distToBallCarrier < 25) {
      // Forward run: aggressive push 6-8 units ahead of ball carrier
      const forwardTarget = ballCarrierPos.x + attackSign * (
        normalizedRole === 'ST' ? 6
        : normalizedRole === 'DM' ? 4.5
        : 6
      );
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
        const nearDepth = normalizedRole === 'DM' ? 2.5 : 4;
        const farDepth = normalizedRole === 'DM' ? 7 : 10;
        const targetDepth = Math.abs(distanceFromCarrier) < 8
          ? ballCarrierPos.x + attackSign * nearDepth
          : ballCarrierPos.x + attackSign * farDepth;
        ideal.x = THREE.MathUtils.lerp(ideal.x, targetDepth, normalizedRole === 'DM' ? 0.28 : 0.35);
      }
    }
  }

  ideal.x = clamp(ideal.x, -fieldWidth / 2 + 1.5, fieldWidth / 2 - 1.5);
  ideal.z = clamp(ideal.z, -fieldDepth / 2 + 1.5, fieldDepth / 2 - 1.5);
  ideal.y = 0.15;
  return ideal;
}
