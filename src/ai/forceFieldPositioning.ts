/**
 * Force-Field Positioning System
 * Ported from GameplayFootball's ElizaController + TeamAIController.
 *
 * Computes a positional nudge using attractive/repulsive forces:
 *   1. Formation pull   – attract to adapted home (stronger for defenders)
 *   2. Ball attraction   – support the play in depth; wide players hold width
 *   3. Teammate repulsion – maintain spacing / passing triangles
 *   4. Opponent avoidance – find open pockets
 *   5. Goalside marking   – when out of possession, sit between opponent & own goal
 *   6. Forward run        – attackers push toward opponent goal in possession
 *   7. Width anchor       – wide players pulled toward their flank
 *
 * Usage:
 *   const nudge = computeForceFieldNudge({ ...params });
 *   finalTarget.add(nudge);            // direct add
 *   // OR
 *   finalTarget.lerp(finalTarget.clone().add(nudge), blend);  // blended
 */

import * as THREE from 'three';

// ── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

const WIDE_ROLES = new Set(['LB', 'RB', 'LM', 'RM', 'LW', 'RW']);

function isWideRole(role: string) {
  const upper = (role || '').toUpperCase();
  if (upper === 'LM') return true;
  if (upper === 'RM') return true;
  return WIDE_ROLES.has(upper);
}

function normalizeRole(role: string) {
  const upper = (role || '').toUpperCase();
  if (upper === 'LM') return 'LW';
  if (upper === 'RM') return 'RW';
  return upper;
}

/** 0 = fully defensive, 1 = fully offensive */
function getMindset(role: string): number {
  const map: Record<string, number> = {
    GK: 0, CB: 0.3, LB: 0.45, RB: 0.45, DM: 0.5,
    CM: 0.7, LW: 0.80, RW: 0.80, LM: 0.80, RM: 0.80,
    AM: 0.88, ST: 0.95,
  };
  return map[(role || '').toUpperCase()] ?? 0.7;
}

/**
 * Returns -1 for left-flank (negative z), +1 for right-flank (positive z).
 * Based on the player's formation home position.
 */
function getFlankSign(homeZ: number): number {
  return homeZ < 0 ? -1 : 1;
}

// ── Public API ──────────────────────────────────────────────────────────────

export type ForceFieldParams = {
  role: string;
  playerPos: THREE.Vector3;
  homePos: THREE.Vector3;
  ballPos: THREE.Vector3;
  teammatePositions: THREE.Vector3[];
  opponentPositions: THREE.Vector3[];
  /** 1 = attacks toward +x, -1 = attacks toward -x */
  attackSign: 1 | -1;
  /** true when this player's team has possession */
  hasPossession: boolean;
  fieldWidth: number;
  fieldDepth: number;
};

/**
 * Compute a force-field positional nudge in world-space (x/z, y=0).
 * Add or blend the result into the player's steering target.
 */
export function computeForceFieldNudge(params: ForceFieldParams): THREE.Vector3 {
  const {
    role, playerPos, homePos, ballPos,
    teammatePositions, opponentPositions,
    attackSign, hasPossession,
    fieldWidth, fieldDepth,
  } = params;

  const mindset = getMindset(role);
  const nRole = normalizeRole(role);
  const ownGoalX = attackSign > 0 ? -fieldWidth / 2 : fieldWidth / 2;

  // Force accumulator (x = pitch length, z = pitch width)
  let fx = 0;
  let fz = 0;

  // ── FORCE 1: Formation pull ───────────────────────────────────────────
  // Defenders pulled harder, attackers freer to roam.
  const homePull = hasPossession
    ? (0.34 - mindset * 0.14)
    : (0.7 - mindset * 0.2);
  const toHomeX = homePos.x - playerPos.x;
  const toHomeZ = homePos.z - playerPos.z;
  const homeDist = Math.sqrt(toHomeX * toHomeX + toHomeZ * toHomeZ);
  if (homeDist > 0.5) {
    const cap = Math.min(homeDist, 18);
    fx += (toHomeX / homeDist) * homePull * cap;
    fz += (toHomeZ / homeDist) * homePull * cap;
  }

  // ── FORCE 1b: Possession depth shift ──────────────────────────────────
  // Nudge the whole team upfield when in possession.
  if (hasPossession) {
    const depthShift = 3 + mindset * 8;
    fx += attackSign * depthShift;
  }

  // ── FORCE 2: Ball attraction ──────────────────────────────────────────
  // Support the play. Wide players: depth only (hold width).
  // Reduced multiplier (5→3) to stop midfielders collapsing into a tight ball-adjacent cluster.
  if (hasPossession) {
    const toBallX = ballPos.x - playerPos.x;
    const toBallZ = ballPos.z - playerPos.z;
    const ballDist = Math.sqrt(toBallX * toBallX + toBallZ * toBallZ);
    if (ballDist > 5 && ballDist < 25) {
      const attract = 0.18 + mindset * 0.25;
      fx += (toBallX / ballDist) * attract * 2.2;
      if (!isWideRole(role)) {
        fz += (toBallZ / ballDist) * attract * 2.2;
      }
    }
  }

  // ── FORCE 3: Teammate repulsion ───────────────────────────────────────
  const spacingRadius = 14; // wider detection range
  const spacingIdealMin = 7; // below this = extra hard kick
  for (const mate of teammatePositions) {
    const dx = playerPos.x - mate.x;
    const dz = playerPos.z - mate.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > 0.05 && d < spacingRadius) {
      // Baseline repulsion + steep inner kick below the ideal-floor threshold (9 m buffer → 6 m ideal).
      const base = Math.pow((spacingRadius - d) / spacingRadius, 1.3) * 7.0;
      const innerKick = d < spacingIdealMin ? (spacingIdealMin - d) * 3.0 : 0;
      const repel = base + innerKick;
      fx += (dx / d) * repel;
      fz += (dz / d) * repel;
    }
  }

  // ── FORCE 4: Opponent avoidance ───────────────────────────────────────
  const oppRadius = 6.2; // ~10m × 0.62
  for (const opp of opponentPositions) {
    const dx = playerPos.x - opp.x;
    const dz = playerPos.z - opp.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > 0.05 && d < oppRadius) {
      const str = hasPossession ? 2.5 : 1.2;
      const avoid = Math.pow((oppRadius - d) / oppRadius, 1.5) * str;
      fx += (dx / d) * avoid;
      fz += (dz / d) * avoid;
    }
  }

  // ── FORCE 5: Goalside defensive marking ───────────────────────────────
  if (!hasPossession && mindset < 0.7) {
    const defWeight = clamp(1.0 - mindset, 0.1, 0.9);
    let nearestOpp: THREE.Vector3 | null = null;
    let nearestD = Infinity;
    for (const opp of opponentPositions) {
      const d = Math.sqrt(
        (homePos.x - opp.x) ** 2 + (homePos.z - opp.z) ** 2,
      );
      if (d < nearestD) { nearestD = d; nearestOpp = opp; }
    }
    if (nearestOpp && nearestD < 22) {
      // Sit between opponent and own goal
      const markX = nearestOpp.x + (ownGoalX - nearestOpp.x) * (0.2 + defWeight * 0.15);
      const markZ = nearestOpp.z;
      const toMarkX = markX - playerPos.x;
      const toMarkZ = markZ - playerPos.z;
      const toMarkD = Math.sqrt(toMarkX * toMarkX + toMarkZ * toMarkZ);
      if (toMarkD > 0.5) {
        fx += (toMarkX / toMarkD) * defWeight * 6.2;
        fz += (toMarkZ / toMarkD) * defWeight * 3.1;
      }
    }
  }

  // ── FORCE 6: Forward attacking runs ───────────────────────────────────
  if (hasPossession && mindset > 0.2) {
    const runStrength = (mindset - 0.1) * 22;
    fx += attackSign * runStrength;
  }

  // ── FORCE 7: Width anchor ────────────────────────────────────────────
  if (isWideRole(role)) {
    const flank = getFlankSign(homePos.z);
    const targetZ = flank * fieldDepth * 0.42; // 42% of half-width toward sideline
    const widthPull = (targetZ - playerPos.z) * 0.5;
    fz += clamp(widthPull, -8, 8);
  }

  // Build result vector (y = 0, all movement on xz plane)
  const nudge = new THREE.Vector3(fx, 0, fz);

  // Safety clamp so the force-field can't teleport anyone
  const maxNudge = 16;
  if (nudge.length() > maxNudge) {
    nudge.normalize().multiplyScalar(maxNudge);
  }

  return nudge;
}
