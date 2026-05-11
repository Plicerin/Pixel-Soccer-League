import * as THREE from 'three';
import {
  computePatternRoleTarget,
  getPatternRole,
  type TeamPatternState,
} from './patternEngine.ts';
import {
  computeStructuredAttackTarget,
  getStructuredAttackRole,
  type StructuredAttackState,
} from './structuredAttack.ts';
import { getBallArea, getSWOSTarget } from './swosTactics.ts';

// Phase A FSM positioning — single-owner deterministic target for off-ball players.
// Inspired by ysoccer-ai's AiStatePositioning: walk to a home target, no force field,
// no layered blending. Pattern role wins authoritatively when assigned.
//
// Usage: gated behind gameState.fsmPositioningEnabled. When off, the legacy
// getSupportRunTarget pipeline runs. When on, this function fully replaces it
// for off-ball players (carrier always falls through to legacy logic).
//
// Why ditch the legacy pipeline for off-ball:
// - Telemetry across 10+ matches showed NEAR_POST_RUNNER fwdX swinging from
//   -3 to +7 with the same code. Three layers (tactical, force-field, pattern
//   role) all wrote the same target each frame; whichever happened to dominate
//   first determined the match. That's not a tunable system — it's variance.
// - Sensible Soccer / ysoccer's lesson: one writer per state, explicit
//   transitions, deterministic outputs. Sophistication goes IN the states,
//   not in layered overrides.

export type FsmContext = {
  player: any;
  carrier: any | null;
  teamPattern: TeamPatternState | null;
  attackSign: 1 | -1;
  fieldWidth: number;
  fieldDepth: number;
  penaltyDepth: number;
  goalMouthHalfWidth: number;
  attackPhase: string; // 'BUILDUP' | 'PROGRESSION' | 'TRANSITION' | 'FINAL_THIRD'
  // Phase A.5 additions — needed for box-crash + defensive collapse states.
  // The caller can omit these for a Phase A1/A2-style call (no extra states),
  // but providing them unlocks BOX_CRASH and COLLAPSE_DEFEND.
  allPlayers?: any[];
  ballPos?: THREE.Vector3;
  structuredAttack?: StructuredAttackState | null;
};

export type FsmMovementOwner =
  | 'STRUCTURED_ATTACK'
  | 'PATTERN_ROLE'
  | 'COLLAPSE_DEFEND'
  | 'DANGER_MARK'
  | 'BOX_COVER'
  | 'BOX_CRASH'
  | 'WIDE_HOME'
  | 'PHASE_HOME';

export type FsmTargetResult = {
  target: THREE.Vector3;
  owner: FsmMovementOwner;
  patternRole?: string;
  structuredRole?: string;
};

const _tmp = new THREE.Vector3();

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function roleLabelOf(player: any): string {
  return (player?.displayRole || player?.role || '').toString().toUpperCase();
}

function isGK(player: any): boolean {
  return roleLabelOf(player) === 'GK';
}

// Phase-aware shift on top of homePos. When team has the ball, push the
// formation slot forward by a small amount; when defending, hold home. This
// is the only "dynamic" adjustment for non-pattern off-ball players in FSM
// mode — keeps movement readable while still responding to game state.
function phaseShiftedHome(
  player: any,
  attackSign: 1 | -1,
  hasPossession: boolean,
  attackPhase: string,
  fieldDepth: number,
  ballPos?: THREE.Vector3,
): { x: number; z: number; owner: FsmMovementOwner } {
  const home = player.homePos;
  if (!home) return { x: 0, z: 0, owner: 'PHASE_HOME' };
  const role = (player.displayRole || player.role || '').toString().toUpperCase();

  // SWOS ball-area-aware positioning: look up the 35-area table for the role
  // so every non-carrier player's target shifts with ball position, not just
  // during special states (box-crash, pattern, etc.).
  if (ballPos) {
    const ballArea = getBallArea(ballPos.x, ballPos.z, attackSign);
    const swosTarget = getSWOSTarget(role, home, ballArea, attackSign);

    // Small possession push on top of SWOS base (SWOS already encodes retreating
    // when defending, so this is only a modest additional nudge when attacking).
    let pushU = 0;
    if (hasPossession && attackPhase === 'FINAL_THIRD') {
      if (role === 'ST' || role === 'CF') pushU = 2.5;
      else if (role === 'LM' || role === 'RM' || role === 'LW' || role === 'RW') pushU = 2.5;
      else if (role === 'CM' || role === 'CAM' || role === 'AM') pushU = 1.5;
    }

    const isWideMid = role === 'LM' || role === 'RM' || role === 'LW' || role === 'RW';
    const isFullback = role === 'LB' || role === 'RB' || role === 'LWB' || role === 'RWB';
    if (isWideMid || isFullback) {
      const side = Math.sign(home.z || (role.includes('L') ? -1 : 1)) || 1;
      const minWideAbsZ = isWideMid
        ? (attackPhase === 'FINAL_THIRD' ? fieldDepth * 0.66 : fieldDepth * 0.60)
        : (attackPhase === 'FINAL_THIRD' ? fieldDepth * 0.60 : attackPhase === 'TRANSITION' ? fieldDepth * 0.56 : fieldDepth * 0.52);
      const naturalAbsZ = Math.abs(swosTarget.z);
      return {
        x: swosTarget.x + attackSign * pushU,
        z: side * Math.max(naturalAbsZ, minWideAbsZ),
        owner: 'WIDE_HOME',
      };
    }

    return { x: swosTarget.x + attackSign * pushU, z: swosTarget.z, owner: 'PHASE_HOME' };
  }

  // Fallback when ballPos not available: original static homePos logic.
  if (!hasPossession) {
    return { x: home.x, z: home.z, owner: 'PHASE_HOME' };
  }
  let pushU = 0;
  if (role === 'ST' || role === 'CF') pushU = attackPhase === 'FINAL_THIRD' ? 8 : 4;
  else if (role === 'LM' || role === 'RM' || role === 'LW' || role === 'RW') pushU = attackPhase === 'FINAL_THIRD' ? 7 : 4;
  else if (role === 'CM' || role === 'CAM') pushU = attackPhase === 'FINAL_THIRD' ? 4.5 : 2.5;
  else if (role === 'DM') pushU = 1;

  const isWideMidFb = role === 'LM' || role === 'RM' || role === 'LW' || role === 'RW';
  const isFullbackFb = role === 'LB' || role === 'RB' || role === 'LWB' || role === 'RWB';
  if (isWideMidFb || isFullbackFb) {
    const side = Math.sign(home.z || (role.includes('L') ? -1 : 1)) || 1;
    const minWideAbsZ = isWideMidFb
      ? (attackPhase === 'FINAL_THIRD' ? fieldDepth * 0.66 : fieldDepth * 0.60)
      : (attackPhase === 'FINAL_THIRD' ? fieldDepth * 0.60 : attackPhase === 'TRANSITION' ? fieldDepth * 0.56 : fieldDepth * 0.52);
    const naturalAbsZ = Math.abs(home.z || 0);
    return { x: home.x + attackSign * pushU, z: side * Math.max(naturalAbsZ, minWideAbsZ), owner: 'WIDE_HOME' };
  }
  return { x: home.x + attackSign * pushU, z: home.z, owner: 'PHASE_HOME' };
}


// Only this player chases / presses; everyone else holds shape.
// Inspired by ysoccer-ai's "bestDefender" concept (only one player aggressively
// tracks the ball, the rest stay in POSITIONING).
export function pickFsmDefender(team: 'A' | 'B', allPlayers: any[], ballPos: THREE.Vector3): any | null {
  let best: any = null;
  let bestDist = Infinity;
  for (const p of allPlayers) {
    if (p.team !== team) continue;
    const role = (p.displayRole || p.role || '').toString().toUpperCase();
    if (role === 'GK') continue;
    const d = p.pos.distanceTo(ballPos);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best;
}

// ── Phase A.5: BOX_CRASH state ─────────────────────────────────────────
// When a teammate has the ball deep in the opponent's final third, off-ball
// attackers should break from homePos and run into shooting positions.
// Without this, FSM A2 attackers stay in formation and the carrier finds
// no forward pass options — producing the "ST drives 15y then backpasses"
// behaviour observed across user-played matches.
//
// Role-specific landing spots (in attack-direction coordinates relative
// to the opponent goal at +fieldWidth/2 * attackSign):
//   ST: penalty spot (~12y from goal, central)
//   LM/RM (opposite-flank from carrier): far post
//   LM/RM (same flank as carrier): cutback receiver at edge of box
//   CM/CAM: edge of D for second-wave shot
function countCentralFinalThirdAttackers(
  player: any,
  carrier: any,
  allPlayers: any[] | undefined,
  attackSign: 1 | -1,
  fieldWidth: number,
  penaltyDepth: number,
  goalMouthHalfWidth: number,
): number {
  if (!allPlayers || allPlayers.length === 0) return 0;
  const goalX = attackSign > 0 ? fieldWidth / 2 : -fieldWidth / 2;
  return allPlayers
    .filter((p) => p.team === player.team)
    .filter((p) => p !== player)
    .filter((p) => !isGK(p))
    .filter((p) => ['ST', 'CF', 'CAM', 'CM', 'LM', 'RM', 'LW', 'RW'].includes(roleLabelOf(p)))
    .filter((p) => Math.abs(goalX - p.pos.x) <= penaltyDepth + 12)
    .filter((p) => Math.abs(p.pos.z) <= goalMouthHalfWidth * 4.8)
    .filter((p) => p === carrier || (p.pos.x * attackSign) > fieldWidth * 0.18)
    .length;
}

function computeBoxCrashTarget(
  player: any,
  carrier: any,
  attackSign: 1 | -1,
  fieldWidth: number,
  fieldDepth: number,
  penaltyDepth: number,
  goalMouthHalfWidth: number,
  allPlayers?: any[],
): { x: number; z: number } | null {
  const role = (player.displayRole || player.role || '').toString().toUpperCase();
  const goalX = attackSign > 0 ? fieldWidth / 2 : -fieldWidth / 2;
  const carrierZ = carrier.pos.z;
  const carrierSide = Math.sign(carrierZ) || 1;
  const playerSide = Math.sign(player.homePos?.z || 0) || (role === 'LM' ? -1 : role === 'RM' ? 1 : 0);
  const centralCrowd = countCentralFinalThirdAttackers(
    player,
    carrier,
    allPlayers,
    attackSign,
    fieldWidth,
    penaltyDepth,
    goalMouthHalfWidth,
  );

  if (role === 'ST' || role === 'CF') {
    const laneSide = playerSide || Math.sign(player.pos?.z || 0) || -carrierSide || 1;
    if (centralCrowd >= 2) {
      // If the box is already occupied, rotate the striker into a half-space
      // receiver instead of adding another body to the blocked central lane.
      return {
        x: goalX - attackSign * (penaltyDepth + 2.2),
        z: laneSide * Math.max(goalMouthHalfWidth * 3.2, fieldDepth * 0.24),
      };
    }
    // Arrive in a channel, not on the same central penalty spot every attack.
    return {
      x: goalX - attackSign * (penaltyDepth * 0.52),
      z: laneSide * Math.max(goalMouthHalfWidth * 1.7, fieldDepth * 0.09),
    };
  }
  if (role === 'LM' || role === 'RM') {
    if (playerSide !== 0 && playerSide !== carrierSide) {
      // Opposite-flank winger: arrive far-post but keep enough width to
      // stretch the block instead of joining the central crowd.
      return {
        x: goalX - attackSign * 4.8,
        z: -carrierSide * Math.max(goalMouthHalfWidth * 4.6, fieldDepth * 0.42),
      };
    }
    // Same-flank winger: stay as a wide relief/cutback option.
    return {
      x: goalX - attackSign * (penaltyDepth + 3.5),
      z: carrierSide * Math.max(goalMouthHalfWidth * 4.8, fieldDepth * 0.54),
    };
  }
  if (role === 'CM' || role === 'CAM') {
    // Edge of D / half-space — second-wave pass and shot lane. Keep this lane
    // visibly separate from the striker channel so cutbacks have a real target.
    return {
      x: goalX - attackSign * (penaltyDepth + (role === 'CAM' ? 2.2 : 4.5)),
      z: -carrierSide * Math.max(goalMouthHalfWidth * 3.0, fieldDepth * 0.18),
    };
  }
  return null; // backline + DM hold shape
}

// ── Phase A.5: COLLAPSE_DEFEND state ──────────────────────────────────
// When the opponent has the ball deep in our final third, the 2 closest
// non-pressing defenders break from homePos and converge between the ball
// and our own goal. Combined with the existing "bestDefender" presser, this
// gives 3 defenders engaging in the box instead of 1 chasing while 9 watch.
function isInsideOwnFinalThird(ballX: number, attackSign: 1 | -1, fieldWidth: number): boolean {
  // Own final third: ball is in defender's defensive third — i.e. attackSign
  // direction is *negative* of the ball's progress toward the player's goal.
  // Player's own goal is at -fieldWidth/2 * attackSign. Final third is the
  // 1/3 of the field nearest the own goal.
  const ownGoalX = -attackSign * (fieldWidth / 2);
  const distToOwnGoal = Math.abs(ballX - ownGoalX);
  return distToOwnGoal < fieldWidth * 0.33;
}

function shouldCollapseDefend(
  player: any,
  carrier: any | null,
  ballPos: THREE.Vector3,
  attackSign: 1 | -1,
  fieldWidth: number,
  allPlayers: any[],
): boolean {
  const role = (player.displayRole || player.role || '').toString().toUpperCase();
  // Only outfield defenders + DM.
  if (role !== 'CB' && role !== 'LB' && role !== 'RB' && role !== 'DM') return false;
  // Opponent must have ball or ball must be in our defensive third.
  const opponentHasBall = carrier && carrier.team !== player.team;
  if (!opponentHasBall) return false;
  if (!isInsideOwnFinalThird(ballPos.x, attackSign, fieldWidth)) return false;
  // Pick the 2 closest defenders to the ball (excluding GK + the bestDefender
  // which is already pressing). Only those 2 collapse; others hold shape.
  const myTeam = player.team;
  const defenders = allPlayers.filter((p) => {
    if (p.team !== myTeam) return false;
    const r = (p.displayRole || p.role || '').toString().toUpperCase();
    return r === 'CB' || r === 'LB' || r === 'RB' || r === 'DM';
  });
  defenders.sort((a, b) => a.pos.distanceTo(ballPos) - b.pos.distanceTo(ballPos));
  // Index 0 is the closest — usually the bestDefender presser. Take 1 and 2.
  // (If allPlayers includes the carrier as a 'defender', they're naturally
  //  excluded by team filter above.)
  const collapseSet = defenders.slice(1, 3); // 2 closest after the front presser
  return collapseSet.includes(player);
}

function computeCollapseDefendTarget(
  player: any,
  ballPos: THREE.Vector3,
  attackSign: 1 | -1,
  fieldWidth: number,
): { x: number; z: number } {
  // Position the defender 4 units between the ball and our own goal, on
  // the same z-side as their home position (preserves left/right marking).
  const ownGoalX = -attackSign * (fieldWidth / 2);
  const towardGoal = Math.sign(ownGoalX - ballPos.x) || -attackSign;
  const targetX = ballPos.x + towardGoal * 4;
  const homeZ = player.homePos?.z ?? 0;
  // Bias toward the ball z but keep the marker on their home side.
  const targetZ = homeZ * 0.5 + ballPos.z * 0.5;
  return { x: targetX, z: targetZ };
}

function isDangerousAttacker(
  attacker: any,
  defenderAttackSign: 1 | -1,
  fieldWidth: number,
  penaltyDepth: number,
  goalMouthHalfWidth: number,
): boolean {
  if (!attacker || isGK(attacker)) return false;
  const role = roleLabelOf(attacker);
  if (!['ST', 'CF', 'CAM', 'CM', 'LM', 'RM', 'LW', 'RW'].includes(role)) return false;
  const ownGoalX = -defenderAttackSign * (fieldWidth / 2);
  const distToOwnGoal = Math.abs(ownGoalX - attacker.pos.x);
  const centralDanger = Math.abs(attacker.pos.z) <= goalMouthHalfWidth * 5.4;
  const boxOrEdge = distToOwnGoal <= penaltyDepth + 13.5;
  const finalThird = distToOwnGoal <= fieldWidth * 0.38;
  return boxOrEdge || (finalThird && centralDanger);
}

function scoreDangerousAttacker(
  attacker: any,
  defenderAttackSign: 1 | -1,
  fieldWidth: number,
  penaltyDepth: number,
  goalMouthHalfWidth: number,
): number {
  const ownGoalX = -defenderAttackSign * (fieldWidth / 2);
  const distToOwnGoal = Math.abs(ownGoalX - attacker.pos.x);
  const role = roleLabelOf(attacker);
  const centrality = Math.abs(attacker.pos.z);
  const roleBonus =
    role === 'ST' || role === 'CF' ? 9
    : role === 'CAM' ? 5.5
    : role === 'CM' ? 3.2
    : 2.5;
  const boxBonus = distToOwnGoal <= penaltyDepth + 6 ? 8 : distToOwnGoal <= penaltyDepth + 10 ? 3 : 0;
  const centralBonus = centrality <= goalMouthHalfWidth * 2.8 ? 6.5 : centrality <= goalMouthHalfWidth * 5.4 ? 2.8 : 0;
  return roleBonus + boxBonus + centralBonus + Math.max(0, fieldWidth * 0.38 - distToOwnGoal) * 0.26;
}

function getDangerMarkAssignment(
  player: any,
  carrier: any | null,
  defenderAttackSign: 1 | -1,
  fieldWidth: number,
  fieldDepth: number,
  penaltyDepth: number,
  goalMouthHalfWidth: number,
  allPlayers: any[],
  ballPos: THREE.Vector3,
): any | null {
  if (!carrier || carrier.team === player.team) return null;
  const role = roleLabelOf(player);
  if (!['CB', 'LB', 'RB', 'LWB', 'RWB', 'DM', 'CM', 'LM', 'RM'].includes(role)) return null;
  void fieldDepth;
  const ballPresser = pickFsmDefender(player.team, allPlayers, ballPos);

  const dangerousAttackers = allPlayers
    .filter((p) => p.team !== player.team)
    .filter((p) => p !== carrier)
    .filter((p) => isDangerousAttacker(p, defenderAttackSign, fieldWidth, penaltyDepth, goalMouthHalfWidth))
    .sort((a, b) =>
      scoreDangerousAttacker(b, defenderAttackSign, fieldWidth, penaltyDepth, goalMouthHalfWidth)
      - scoreDangerousAttacker(a, defenderAttackSign, fieldWidth, penaltyDepth, goalMouthHalfWidth)
    )
    .slice(0, 8);
  if (dangerousAttackers.length === 0) return null;

  const defenders = allPlayers
    .filter((p) => p.team === player.team)
    .filter((p) => p !== ballPresser)
    .filter((p) => {
      if (isGK(p)) return false;
      const r = roleLabelOf(p);
      return ['CB', 'LB', 'RB', 'LWB', 'RWB', 'DM', 'CM', 'LM', 'RM'].includes(r);
    });
  const usedDefenders = new Set<any>();
  for (const attacker of dangerousAttackers) {
    let best: any = null;
    let bestScore = Infinity;
    for (const defender of defenders) {
      if (usedDefenders.has(defender)) continue;
      const d = defender.pos.distanceTo(attacker.pos);
      const roleLabel = roleLabelOf(defender);
      const markerBias =
        ['CB', 'LB', 'RB', 'LWB', 'RWB', 'DM'].includes(roleLabel) ? -3.2
        : roleLabel === 'CM' ? -1.3
        : 0;
      const goalSideBias = (defender.pos.x - attacker.pos.x) * defenderAttackSign < 0 ? -1.2 : 1.0;
      const score = d + markerBias + goalSideBias;
      if (score < bestScore) {
        bestScore = score;
        best = defender;
      }
    }
    if (!best) continue;
    usedDefenders.add(best);
    if (best === player) return attacker;
  }
  return null;
}

function computeDangerMarkTarget(
  attacker: any,
  defenderAttackSign: 1 | -1,
  fieldWidth: number,
): { x: number; z: number } {
  const ownGoalX = -defenderAttackSign * (fieldWidth / 2);
  const toGoalX = ownGoalX - attacker.pos.x;
  const toGoalZ = -attacker.pos.z;
  const len = Math.max(0.001, Math.hypot(toGoalX, toGoalZ));
  const markDistance = 0.42;
  return {
    x: attacker.pos.x + (toGoalX / len) * markDistance,
    z: attacker.pos.z + (toGoalZ / len) * markDistance,
  };
}

function shouldBoxCoverDefend(
  player: any,
  carrier: any | null,
  defenderAttackSign: 1 | -1,
  fieldWidth: number,
  penaltyDepth: number,
  goalMouthHalfWidth: number,
  allPlayers: any[],
  ballPos: THREE.Vector3,
): boolean {
  if (!carrier || carrier.team === player.team) return false;
  const role = roleLabelOf(player);
  if (!['CB', 'LB', 'RB', 'LWB', 'RWB', 'DM', 'CM', 'LM', 'RM'].includes(role)) return false;
  const ownGoalX = -defenderAttackSign * (fieldWidth / 2);
  const distToOwnGoal = Math.abs(ownGoalX - ballPos.x);
  const centralShotThreat = Math.abs(ballPos.z) <= goalMouthHalfWidth * 9.2;
  const boxEdgeThreat = distToOwnGoal <= penaltyDepth + 28;
  const urgentCentralThreat = distToOwnGoal <= penaltyDepth + 20 && Math.abs(ballPos.z) <= goalMouthHalfWidth * 6.8;
  if (!boxEdgeThreat || !centralShotThreat) return false;

  const ballPresser = pickFsmDefender(player.team, allPlayers, ballPos);
  if (player === ballPresser) return false;
  const coverCount = urgentCentralThreat ? 7 : 6;
  const goalLaneScore = (p: any) => {
    const toGoalX = ownGoalX - ballPos.x;
    const toGoalZ = -ballPos.z;
    const lenSq = Math.max(0.001, toGoalX * toGoalX + toGoalZ * toGoalZ);
    const relX = p.pos.x - ballPos.x;
    const relZ = p.pos.z - ballPos.z;
    const t = clamp((relX * toGoalX + relZ * toGoalZ) / lenSq, 0, 1);
    const laneX = ballPos.x + toGoalX * t;
    const laneZ = ballPos.z + toGoalZ * t;
    const laneDist = Math.hypot(p.pos.x - laneX, p.pos.z - laneZ);
    const roleBias =
      ['CB', 'DM'].includes(roleLabelOf(p)) ? -3.0
      : ['LB', 'RB', 'LWB', 'RWB'].includes(roleLabelOf(p)) ? -1.6
      : roleLabelOf(p) === 'CM' ? -1.1
      : 0;
    return laneDist * 2.4 + p.pos.distanceTo(ballPos) * 0.28 + roleBias;
  };
  const candidates = allPlayers
    .filter((p) => p.team === player.team && p !== ballPresser && !isGK(p))
    .filter((p) => ['CB', 'LB', 'RB', 'LWB', 'RWB', 'DM', 'CM', 'LM', 'RM'].includes(roleLabelOf(p)))
    .sort((a, b) => goalLaneScore(a) - goalLaneScore(b));
  return candidates.slice(0, coverCount).includes(player);
}

function computeBoxCoverTarget(
  player: any,
  ballPos: THREE.Vector3,
  defenderAttackSign: 1 | -1,
  fieldWidth: number,
  goalMouthHalfWidth: number,
  allPlayers: any[],
): { x: number; z: number } {
  const ownGoalX = -defenderAttackSign * (fieldWidth / 2);
  const towardGoal = Math.sign(ownGoalX - ballPos.x) || -defenderAttackSign;
  const goalLaneScore = (p: any) => {
    const toGoalX = ownGoalX - ballPos.x;
    const toGoalZ = -ballPos.z;
    const lenSq = Math.max(0.001, toGoalX * toGoalX + toGoalZ * toGoalZ);
    const relX = p.pos.x - ballPos.x;
    const relZ = p.pos.z - ballPos.z;
    const t = clamp((relX * toGoalX + relZ * toGoalZ) / lenSq, 0, 1);
    const laneX = ballPos.x + toGoalX * t;
    const laneZ = ballPos.z + toGoalZ * t;
    return Math.hypot(p.pos.x - laneX, p.pos.z - laneZ);
  };
  const coverMates = allPlayers
    .filter((p) => p.team === player.team && !isGK(p))
    .filter((p) => ['CB', 'LB', 'RB', 'LWB', 'RWB', 'DM', 'CM', 'LM', 'RM'].includes(roleLabelOf(p)))
    .sort((a, b) => goalLaneScore(a) - goalLaneScore(b));
  const idx = Math.max(0, coverMates.indexOf(player));
  const laneSlots = [0, -goalMouthHalfWidth * 1.05, goalMouthHalfWidth * 1.05, -goalMouthHalfWidth * 1.9, goalMouthHalfWidth * 1.9, 0];
  const slot = laneSlots[idx % laneSlots.length];
  const boxDepthSlots = [5.8, 6.8, 7.8, 8.7, 9.2, 7.2];
  const boxDepth = boxDepthSlots[idx % boxDepthSlots.length];
  const shieldX = ballPos.x + towardGoal * (4.8 + Math.min(idx, 3) * 0.65);
  const boxX = ownGoalX - towardGoal * boxDepth;
  const targetX = Math.abs(ownGoalX - shieldX) < Math.abs(ownGoalX - boxX) ? shieldX : boxX;
  return {
    x: targetX,
    z: ballPos.z * 0.10 + slot * 0.90,
  };
}

export function computeFsmOffBallTargetWithOwner(ctx: FsmContext): FsmTargetResult {
  const { player, carrier, teamPattern, attackSign, fieldWidth, fieldDepth,
    penaltyDepth, goalMouthHalfWidth, attackPhase, allPlayers, ballPos, structuredAttack } = ctx;

  // 0. Structured attack override — one owner for active team moves.
  // This intentionally wins before legacy pattern roles: during the rebuild,
  // wing attack slots should be simple, readable, and deterministic.
  if (structuredAttack && carrier && carrier.team === player.team) {
    const target = computeStructuredAttackTarget({
      player,
      carrier,
      state: structuredAttack,
      fieldWidth,
      fieldDepth,
      penaltyDepth,
      goalMouthHalfWidth,
    });
    if (target) {
      _tmp.copy(target);
      return {
        target: _tmp,
        owner: 'STRUCTURED_ATTACK',
        structuredRole: getStructuredAttackRole(structuredAttack, player),
      };
    }
  }

  // 1. Pattern role override — authoritative when active and applicable.
  // Only applies when our team has the ball; pattern target geometry assumes
  // carrier is a teammate.
  if (teamPattern && carrier && carrier.team === player.team) {
    const role = getPatternRole(teamPattern, player);
    if (role !== 'NONE' && role !== 'DEFENDER' && (role !== 'CARRIER' || player !== carrier)) {
      const override = computePatternRoleTarget({
        player,
        role,
        pattern: teamPattern,
        carrier,
        attackSign,
        fieldWidth,
        fieldDepth,
        penaltyDepth,
        goalMouthHalfWidth,
      });
      if (override) {
        // FSM rule: pattern role wins fully. No lerp blend with home —
        // that's the bug we're fixing. The pattern engine already chose
        // who plays this role; trust it.
        _tmp.set(
          clamp(override.x, -fieldWidth / 2 + 1.5, fieldWidth / 2 - 1.5),
          0.15,
          clamp(override.z, -fieldDepth / 2 + 1.5, fieldDepth / 2 - 1.5),
        );
        return { target: _tmp, owner: 'PATTERN_ROLE', patternRole: role };
      }
    }
  }

  // 2. Phase A.5: COLLAPSE_DEFEND — opponent in our final third + I'm one
  //    of the two closest defenders → collapse toward ball/goal axis.
  if (allPlayers && ballPos && carrier && carrier.team !== player.team) {
    const dangerMark = getDangerMarkAssignment(
      player,
      carrier,
      attackSign,
      fieldWidth,
      fieldDepth,
      penaltyDepth,
      goalMouthHalfWidth,
      allPlayers,
      ballPos,
    );
    if (dangerMark) {
      const t = computeDangerMarkTarget(dangerMark, attackSign, fieldWidth);
      _tmp.set(
        clamp(t.x, -fieldWidth / 2 + 1.5, fieldWidth / 2 - 1.5),
        0.15,
        clamp(t.z, -fieldDepth / 2 + 1.5, fieldDepth / 2 - 1.5),
      );
      return { target: _tmp, owner: 'DANGER_MARK' };
    }
    if (shouldBoxCoverDefend(player, carrier, attackSign, fieldWidth, penaltyDepth, goalMouthHalfWidth, allPlayers, ballPos)) {
      const t = computeBoxCoverTarget(player, ballPos, attackSign, fieldWidth, goalMouthHalfWidth, allPlayers);
      _tmp.set(
        clamp(t.x, -fieldWidth / 2 + 1.5, fieldWidth / 2 - 1.5),
        0.15,
        clamp(t.z, -fieldDepth / 2 + 1.5, fieldDepth / 2 - 1.5),
      );
      return { target: _tmp, owner: 'BOX_COVER' };
    }
    if (shouldCollapseDefend(player, carrier, ballPos, attackSign, fieldWidth, allPlayers)) {
      const t = computeCollapseDefendTarget(player, ballPos, attackSign, fieldWidth);
      _tmp.set(
        clamp(t.x, -fieldWidth / 2 + 1.5, fieldWidth / 2 - 1.5),
        0.15,
        clamp(t.z, -fieldDepth / 2 + 1.5, fieldDepth / 2 - 1.5),
      );
      return { target: _tmp, owner: 'COLLAPSE_DEFEND' };
    }
  }

  // 3. Phase A.5: BOX_CRASH — my team has ball deep in opponent third → run
  //    into a shooting position. Only fires for attacker roles when carrier
  //    is past the halfway line into the attacking third.
  if (carrier && carrier.team === player.team && carrier !== player) {
    const carrierAttackX = carrier.pos.x * attackSign;
    if (carrierAttackX > fieldWidth * 0.12) {
      const role = (player.displayRole || player.role || '').toString().toUpperCase();
      const isAttacker = role === 'ST' || role === 'CF' || role === 'LM' || role === 'RM' || role === 'CM' || role === 'CAM';
      if (isAttacker) {
        const t = computeBoxCrashTarget(player, carrier, attackSign, fieldWidth, fieldDepth, penaltyDepth, goalMouthHalfWidth, allPlayers);
        if (t) {
          _tmp.set(
            clamp(t.x, -fieldWidth / 2 + 1.5, fieldWidth / 2 - 1.5),
            0.15,
            clamp(t.z, -fieldDepth / 2 + 1.5, fieldDepth / 2 - 1.5),
          );
          return { target: _tmp, owner: 'BOX_CRASH' };
        }
      }
    }
  }

  // 4. No pattern role, no special state — phase-shifted home (sensible default).
  // hasPossession means *our* team has the ball, not just any carrier.
  const hasPossession = !!carrier && carrier.team === player.team;
  const shifted = phaseShiftedHome(player, attackSign, hasPossession, attackPhase, fieldDepth, ballPos);
  _tmp.set(
    clamp(shifted.x, -fieldWidth / 2 + 1.5, fieldWidth / 2 - 1.5),
    0.15,
    clamp(shifted.z, -fieldDepth / 2 + 1.5, fieldDepth / 2 - 1.5),
  );
  return { target: _tmp, owner: shifted.owner };
}

export function computeFsmOffBallTarget(ctx: FsmContext): THREE.Vector3 {
  return computeFsmOffBallTargetWithOwner(ctx).target;
}
