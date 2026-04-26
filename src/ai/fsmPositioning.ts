import * as THREE from 'three';
import {
  computePatternRoleTarget,
  getPatternRole,
  type TeamPatternState,
} from './patternEngine.ts';
import {
  computeStructuredAttackTarget,
  type StructuredAttackState,
} from './structuredAttack.ts';

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

const _tmp = new THREE.Vector3();

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
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
): { x: number; z: number } {
  const home = player.homePos;
  if (!home) return { x: 0, z: 0 };
  const role = (player.displayRole || player.role || '').toString().toUpperCase();
  if (!hasPossession) {
    return { x: home.x, z: home.z };
  }
  // Only forwards/wingers push noticeably; backline holds shape.
  let pushU = 0;
  if (role === 'ST' || role === 'CF') pushU = attackPhase === 'FINAL_THIRD' ? 8 : 4;
  else if (role === 'LM' || role === 'RM') pushU = attackPhase === 'FINAL_THIRD' ? 6 : 3;
  else if (role === 'CM' || role === 'CAM') pushU = attackPhase === 'FINAL_THIRD' ? 4 : 2;
  else if (role === 'DM') pushU = 1;
  return { x: home.x + attackSign * pushU, z: home.z };
}

// Designated defender per team — closest non-keeper opponent to the ball.
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
function computeBoxCrashTarget(
  player: any,
  carrier: any,
  attackSign: 1 | -1,
  fieldWidth: number,
  fieldDepth: number,
  penaltyDepth: number,
  goalMouthHalfWidth: number,
): { x: number; z: number } | null {
  const role = (player.displayRole || player.role || '').toString().toUpperCase();
  const goalX = attackSign > 0 ? fieldWidth / 2 : -fieldWidth / 2;
  const carrierZ = carrier.pos.z;
  const carrierSide = Math.sign(carrierZ) || 1;
  const playerSide = Math.sign(player.homePos?.z || 0) || (role === 'LM' ? -1 : role === 'RM' ? 1 : 0);

  if (role === 'ST' || role === 'CF') {
    // Penalty spot (~12 yards from goal line, central with slight near-side bias)
    return {
      x: goalX - attackSign * (penaltyDepth * 0.6),
      z: carrierSide * goalMouthHalfWidth * 0.4,
    };
  }
  if (role === 'LM' || role === 'RM') {
    if (playerSide !== 0 && playerSide !== carrierSide) {
      // Opposite-flank winger: arrive far-post but keep enough width to
      // stretch the block instead of joining the central crowd.
      return {
        x: goalX - attackSign * 5.4,
        z: -carrierSide * Math.max(goalMouthHalfWidth * 2.8, fieldDepth * 0.18),
      };
    }
    // Same-flank winger: stay as a wide relief/cutback option.
    return {
      x: goalX - attackSign * (penaltyDepth + 3.5),
      z: carrierSide * Math.max(goalMouthHalfWidth * 3.2, fieldDepth * 0.30),
    };
  }
  if (role === 'CM' || role === 'CAM') {
    // Edge of D / half-space — second-wave pass and shot lane.
    return {
      x: goalX - attackSign * (penaltyDepth + (role === 'CAM' ? 2.8 : 4.2)),
      z: -carrierSide * Math.max(goalMouthHalfWidth * 1.8, fieldDepth * 0.11),
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

export function computeFsmOffBallTarget(ctx: FsmContext): THREE.Vector3 {
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
      return _tmp;
    }
  }

  // 1. Pattern role override — authoritative when active and applicable.
  // Only applies when our team has the ball; pattern target geometry assumes
  // carrier is a teammate.
  if (teamPattern && carrier && carrier.team === player.team) {
    const role = getPatternRole(teamPattern, player);
    if (role !== 'NONE' && role !== 'CARRIER' && role !== 'DEFENDER') {
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
        return _tmp;
      }
    }
  }

  // 2. Phase A.5: COLLAPSE_DEFEND — opponent in our final third + I'm one
  //    of the two closest defenders → collapse toward ball/goal axis.
  if (allPlayers && ballPos && carrier && carrier.team !== player.team) {
    if (shouldCollapseDefend(player, carrier, ballPos, attackSign, fieldWidth, allPlayers)) {
      const t = computeCollapseDefendTarget(player, ballPos, attackSign, fieldWidth);
      _tmp.set(
        clamp(t.x, -fieldWidth / 2 + 1.5, fieldWidth / 2 - 1.5),
        0.15,
        clamp(t.z, -fieldDepth / 2 + 1.5, fieldDepth / 2 - 1.5),
      );
      return _tmp;
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
        const t = computeBoxCrashTarget(player, carrier, attackSign, fieldWidth, fieldDepth, penaltyDepth, goalMouthHalfWidth);
        if (t) {
          _tmp.set(
            clamp(t.x, -fieldWidth / 2 + 1.5, fieldWidth / 2 - 1.5),
            0.15,
            clamp(t.z, -fieldDepth / 2 + 1.5, fieldDepth / 2 - 1.5),
          );
          return _tmp;
        }
      }
    }
  }

  // 4. No pattern role, no special state — phase-shifted home (sensible default).
  // hasPossession means *our* team has the ball, not just any carrier.
  const hasPossession = !!carrier && carrier.team === player.team;
  const shifted = phaseShiftedHome(player, attackSign, hasPossession, attackPhase);
  _tmp.set(
    clamp(shifted.x, -fieldWidth / 2 + 1.5, fieldWidth / 2 - 1.5),
    0.15,
    clamp(shifted.z, -fieldDepth / 2 + 1.5, fieldDepth / 2 - 1.5),
  );
  return _tmp;
}
