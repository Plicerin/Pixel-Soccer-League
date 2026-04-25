import * as THREE from 'three';
import {
  computePatternRoleTarget,
  getPatternRole,
  type TeamPatternState,
} from './patternEngine.ts';

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

export function computeFsmOffBallTarget(ctx: FsmContext): THREE.Vector3 {
  const { player, carrier, teamPattern, attackSign, fieldWidth, fieldDepth,
    penaltyDepth, goalMouthHalfWidth, attackPhase } = ctx;

  // 1. Pattern role override — authoritative when active and applicable.
  if (teamPattern && carrier) {
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

  // 2. No pattern role — phase-shifted home position (sensible default).
  const hasPossession = !!carrier;
  const shifted = phaseShiftedHome(player, attackSign, hasPossession, attackPhase);
  _tmp.set(
    clamp(shifted.x, -fieldWidth / 2 + 1.5, fieldWidth / 2 - 1.5),
    0.15,
    clamp(shifted.z, -fieldDepth / 2 + 1.5, fieldDepth / 2 - 1.5),
  );
  return _tmp;
}
