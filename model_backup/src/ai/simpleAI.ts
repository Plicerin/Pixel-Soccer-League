/**
 * simpleAI.ts — FIFA 92 / Sensible Soccer-style outfield player AI.
 *
 * Three rules for the carrier:
 *   1. Shoot if within range and past halfway.
 *   2. Pass if under pressure or a timed window opens.
 *   3. Dribble toward goal.
 *
 * Three rules for non-carriers:
 *   1. Attackers sprint into space near the opponent goal.
 *   2. Closest defender presses the ball carrier.
 *   3. Everyone else tracks back between ball and own goal.
 */

import type { Vec2, TeamSide, PlayerRole, PlayerIntent, PlayerBelief, MatchBelief } from "../core/types";
import {
  FIELD_W,
  FIELD_D,
  LEFT_GOAL_X,
  RIGHT_GOAL_X,
  GOAL_MOUTH_HALF_Z,
  dist2,
  clamp,
} from "../core/constants";
import { getBallArea, getSWOSTarget } from "./swosTactics";

/** Minimal player data the simple AI needs from the orchestrator. */
export type SimplePlayerInput = {
  id: string;
  team: TeamSide;
  role: PlayerRole;
  pos: Vec2;
  homePos: Vec2;
  hasBall: boolean;
  isGK: boolean;
};

const SHOOT_RANGE = 15;        // units — inside/near the box (slightly wider for wide attackers)
const PRESSURE_DIST = 4.2;     // units — defender "on top of you"
const PRESS_DISTANCE = 30;     // units — press if closer than this to ball

/** Roles that should not clear — attackers and attacking mids play forward, not defensive. */
const NON_CLEARING_ROLES = new Set<PlayerRole>(['ST', 'LW', 'RW', 'AM']);

function nearestOpponentDist(pos: Vec2, opponents: PlayerBelief[]): number {
  let best = 999;
  for (const opp of opponents) {
    const d = dist2(pos, opp.pos);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Pick the best pass target for the carrier.
 * Strongly prefers open, FORWARD teammates. Backward passes only as last resort.
 */
function bestPassTarget(
  carrier: SimplePlayerInput,
  teammates: PlayerBelief[],
  opponents: PlayerBelief[],
  attackSign: 1 | -1,
): PlayerBelief | null {
  const carrierAttX = carrier.pos.x * attackSign;
  let best: PlayerBelief | null = null;
  let bestScore = 0.4; // minimum score to accept a pass

  for (const tm of teammates) {
    if (tm.id === carrier.id || tm.isGK) continue;
    const d = dist2(carrier.pos, tm.pos);
    if (d < 2 || d > 28) continue;

    const tmAttX = tm.pos.x * attackSign;
    const forwardGain = tmAttX - carrierAttX; // positive = teammate is ahead

    // Reject passes that go too far backward — keeps ball moving forward.
    if (forwardGain < -6) continue;

    // How open is the receiver?
    const nearOpp = nearestOpponentDist(tm.pos, opponents);
    if (nearOpp < 1.2) continue; // tightly marked

    const openness = Math.min(nearOpp / 7, 1);
    // Forward passes score much higher than lateral/backward.
    const forwardBonus = Math.max(0, forwardGain / 10) * 1.6;
    const distScore = 1 - d / 30;
    const score = openness + forwardBonus + distScore;

    if (score > bestScore) {
      bestScore = score;
      best = tm;
    }
  }

  return best;
}

/** Main entry point — returns an intent for any outfield non-GK player. */
export function simpleOutfielderTick(
  p: SimplePlayerInput,
  belief: MatchBelief,
  attackSign: 1 | -1,
  elapsed: number, // game seconds
): PlayerIntent {
  const goalX = attackSign > 0 ? RIGHT_GOAL_X : LEFT_GOAL_X;
  const myTeam = p.team === "home" ? belief.homePlayers : belief.awayPlayers;
  const opponents = p.team === "home" ? belief.awayPlayers : belief.homePlayers;
  const ballPos: Vec2 = { x: belief.ball.pos.x, z: belief.ball.pos.z };
  const myTeamHasBall = belief.ball.ownerTeam === p.team;

  // ── CARRIER ─────────────────────────────────────────────────────────────
  if (p.hasBall) {
    const distToGoal = dist2(p.pos, { x: goalX, z: 0 });
    const attackX = p.pos.x * attackSign;
    const oppDist = nearestOpponentDist(p.pos, opponents);
    const underPressure = oppDist < PRESSURE_DIST;
    const inFinalApproach = distToGoal < SHOOT_RANGE + 10; // 25-unit zone around goal

    // 0. Clear if deep in own half and can't find a pass under pressure.
    //    Only defenders and midfielders clear — attackers play forward.
    if (attackX < -8 && underPressure && !NON_CLEARING_ROLES.has(p.role)) {
      const passTarget = bestPassTarget(p, myTeam, opponents, attackSign);
      if (!passTarget) {
        // Clear wide toward the nearest touchline — not through the center.
        const clearDir: Vec2 = { x: attackSign * 0.5, z: (p.pos.z >= 0 ? 1 : -1) * 0.8 };
        return { name: "clear", direction: clearDir };
      }
    }

    // 1. Shoot if in range and at least slightly past the halfway line.
    if (distToGoal < SHOOT_RANGE && attackX > -4) {
      // Accuracy degrades with distance; add scatter so shots can miss wide/high.
      const accuracyFactor = 1 - (distToGoal / SHOOT_RANGE) * 0.4; // 1.0 at 0m → 0.6 at max range
      const scatter = (Math.random() - 0.5) * (GOAL_MOUTH_HALF_Z * 1.4 * (1 - accuracyFactor));
      // Aim at near post then scatter — don't clamp to goal mouth so misses are possible.
      const shotZ = p.pos.z * 0.3 + scatter;
      return {
        name: "shoot",
        style: "laces_drive",
        target: { x: goalX, z: shotZ },
        quality: clamp(accuracyFactor, 0.55, 0.9),
      };
    }

    // 2. Pass if under pressure, or on a 1.5-second heartbeat for variety.
    //    Suppress both inside the final-approach zone so the carrier dribbles in to shoot.
    const heartbeat = !inFinalApproach && (elapsed % 1.5) < 0.14;

    if (underPressure || heartbeat) {
      const target = bestPassTarget(p, myTeam, opponents, attackSign);
      if (target) {
        const d = dist2(p.pos, target.pos);
        const passType = d > 18 ? "long" : d > 8 ? "driven" : "short";
        return {
          name: "pass",
          targetPlayerId: target.id,
          type: passType,
          weight: 1.0,
          targetPoint: { ...target.pos },
        };
      }
      // Under pressure with no good pass target and near goal → panic shoot.
      if (underPressure && inFinalApproach && attackX > 0) {
        const scatter = (Math.random() - 0.5) * GOAL_MOUTH_HALF_Z * 2.2;
        return {
          name: "shoot",
          style: "laces_drive",
          target: { x: goalX, z: p.pos.z * 0.3 + scatter },
          quality: 0.55,
        };
      }
    }

    // 3. Dribble toward goal — drift slightly toward center.
    const carryX = clamp(p.pos.x + attackSign * 3, LEFT_GOAL_X + 1, RIGHT_GOAL_X - 1);
    const carryZ = clamp(p.pos.z * 0.82, -FIELD_D / 2 + 1.5, FIELD_D / 2 - 1.5);
    return {
      name: "carry",
      target: { x: carryX, z: carryZ },
      ballRetention: 0.7,
    };
  }

  // ── NON-CARRIER — SWOS positional lookup ────────────────────────────────────
  // One lookup replaces both the attacking and defending shape code:
  // the 35-area table already encodes correct positions for every ball location.
  const ballArea = getBallArea(ballPos.x, ballPos.z, attackSign);
  const swosTarget = getSWOSTarget(p.role, p.homePos, ballArea, attackSign);

  // ── FIND CLOSEST NON-GK TEAMMATE TO BALL (shared by clearance + pressing) ───
  let closestId = "";
  let closestDist = 999;
  for (const tm of myTeam) {
    if (tm.isGK) continue;
    const d = dist2(tm.pos, ballPos);
    if (d < closestDist) { closestDist = d; closestId = tm.id; }
  }

  // ── CLEARANCE / APPROACH: closest player deals with loose balls in own half ──
  const ballIsLoose = !belief.ball.ownerTeam;
  const ballInOwnHalf = ballPos.x * attackSign < 0;
  const distToBall = dist2(p.pos, ballPos);
  if (ballIsLoose && ballInOwnHalf && p.id === closestId) {
    if (distToBall < 3.5) {
      // Within clearing distance — hoof wide toward the touchline.
      const clearDir: Vec2 = { x: attackSign * 0.5, z: (p.pos.z >= 0 ? 1 : -1) * 0.8 };
      return { name: "clear", direction: clearDir };
    }
    if (distToBall < 14) {
      // Approach the ball so we can clear it.
      return { name: "move_to", target: { ...ballPos }, urgency: 0.95 };
    }
  }

  // ── PRESSING: closest non-GK teammate presses the carrier ──────────────────
  if (!myTeamHasBall) {
    const carrierBelief = [...belief.homePlayers, ...belief.awayPlayers].find(pl => pl.hasBall);
    const carrierPos = carrierBelief?.pos ?? ballPos;
    const carrierId  = carrierBelief?.id ?? "";

    // Don't press inside the center circle — gives kickoff team breathing room.
    const carrierNearCenter = dist2(carrierPos, { x: 0, z: 0 }) < 9;
    if (p.id === closestId && closestDist < PRESS_DISTANCE && !carrierNearCenter) {
      return {
        name: "press",
        targetPlayerId: carrierId,
        intensity: 0.9,
        target: { ...carrierPos },
      };
    }
  }

  // All non-carrier non-pressing players move to their SWOS table position.
  return {
    name: "move_to",
    target: swosTarget,
    urgency: myTeamHasBall ? 0.80 : 0.85,
  };
}
