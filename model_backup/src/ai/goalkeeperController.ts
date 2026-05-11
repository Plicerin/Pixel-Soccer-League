import type {
  Vec2,
  TeamSide,
  PlayerIntent,
  PlayerBelief,
  MatchBelief,
  TacticalBlackboard,
  GKDistributionType,
} from "../core/types";
import {
  FIELD_W,
  LEFT_GOAL_X,
  RIGHT_GOAL_X,
  GOAL_MOUTH_HALF_Z,
  GOAL_HEIGHT,
  GK_ARC_BASE_RADIUS,
  GK_ARC_MAX_RADIUS,
  GK_COME_OUT_BALL_DIST,
  GK_CLAIM_RADIUS,
  dist2,
  normalize2,
  sub2,
  add2,
  scale2,
  len2,
  clamp,
  angle2,
} from "../core/constants";
import { BTNode, BTContext, selector, sequence, condition, action } from "./behaviorTree";
import { arbitrate, ArbitrationContext, IntentScore } from "./utilityArbitration";
import { PlayerControllerState, createPlayerControllerState, tickPlayerController } from "./playerController";

export function buildGKBehaviorTree(): BTNode {
  return selector("gk_root", [
    sequence("shot_incoming", [
      condition("shot_incoming", (ctx) => isShotIncoming(ctx)),
      action("generate_dive", (ctx) => generateDiveIntent(ctx)),
    ]),
    sequence("loose_ball_claimable", [
      condition("ball_loose_in_box", (ctx) => {
        if (ctx.belief.ball.state !== "loose" && ctx.belief.ball.state !== "in_flight") return false;
        const defendingLeft = isDefendingLeft(ctx);
        return isBallInBox(ctx.belief.ball.pos, defendingLeft);
      }),
      condition("closest_to_ball", (ctx) => {
        const teammates = ctx.player.team === "home" ? ctx.belief.homePlayers : ctx.belief.awayPlayers;
        let myDist = dist2(ctx.player.pos, ctx.belief.ball.pos);
        for (const tm of teammates) {
          if (tm.id === ctx.player.id || !tm.isGK) continue;
          if (dist2(tm.pos, ctx.belief.ball.pos) < myDist) return false;
        }
        return true;
      }),
      action("generate_claim", (ctx) => {
        return { name: "goalkeeper_claim", target: ctx.belief.ball.pos };
      }),
    ]),
    sequence("has_ball_distribute", [
      condition("has_ball", (ctx) => ctx.player.hasBall),
      action("generate_distribute", (ctx) => generateDistributeIntent(ctx)),
    ]),
    action("generate_position", (ctx) => generatePositionIntent(ctx)),
  ]);
}

function isShotIncoming(ctx: BTContext): boolean {
  if (ctx.belief.ball.state !== "in_flight") return false;
  if (ctx.belief.ball.vel) {
    const ballSpeed = len2(ctx.belief.ball.vel);
    if (ballSpeed < 10) return false;
  }

  const defendingLeft = isDefendingLeft(ctx);
  const goalX = defendingLeft ? LEFT_GOAL_X : RIGHT_GOAL_X;
  const ballPos = ctx.belief.ball.pos;
  const ballVel = ctx.belief.ball.vel;

  const ballDir = normalize2(ballVel);
  const attackSign = ctx.player.team === "home" ? ctx.belief.homeAttackSign : ctx.belief.awayAttackSign;
  const towardGoal = ballDir.x * attackSign < -0.3;

  if (!towardGoal) return false;

  const toGoal = sub2({ x: goalX, z: 0 }, ballPos);
  const distToGoal = len2(toGoal);
  if (distToGoal > 25) return false;

  const crossZ = ballPos.z + ballDir.z * (distToGoal / Math.max(Math.abs(ballDir.x), 0.01));
  return Math.abs(crossZ) < GOAL_MOUTH_HALF_Z + 1.5;
}

function isDefendingLeft(ctx: BTContext): boolean {
  const attackSign = ctx.player.team === "home" ? ctx.belief.homeAttackSign : ctx.belief.awayAttackSign;
  return attackSign > 0;
}

function isBallInBox(ballPos: Vec2, defendingLeft: boolean): boolean {
  const goalX = defendingLeft ? LEFT_GOAL_X : RIGHT_GOAL_X;
  const penDepth = 18 * (FIELD_W / 120);
  const penHalfZ = 22 * (FIELD_W / 120);

  if (defendingLeft) {
    return ballPos.x >= goalX && ballPos.x <= goalX + penDepth
      && Math.abs(ballPos.z) < penHalfZ;
  }
  return ballPos.x <= goalX && ballPos.x >= goalX - penDepth
    && Math.abs(ballPos.z) < penHalfZ;
}

function generateDiveIntent(ctx: BTContext): PlayerIntent | null {
  const defendingLeft = isDefendingLeft(ctx);
  const goalX = defendingLeft ? LEFT_GOAL_X : RIGHT_GOAL_X;
  const goalCenter: Vec2 = { x: goalX, z: 0 };

  const ballPos = ctx.belief.ball.pos;
  const ballVel = ctx.belief.ball.vel;
  const ballSpeed = len2(ballVel);

  const toGoal = sub2(goalCenter, ballPos);
  const distToGoal = len2(toGoal);
  const ballDir = normalize2(ballVel);
  const t = Math.max(0.1, distToGoal / Math.max(ballSpeed * Math.abs(ballDir.x), 0.01));
  const predictedZ = ballPos.z + ballVel.z * Math.min(t, 1.5);

  let direction: "left" | "right" | "stay";
  if (predictedZ < -0.5) {
    direction = predictedZ < ctx.player.pos.z ? "left" : "right";
  } else if (predictedZ > 0.5) {
    direction = predictedZ > ctx.player.pos.z ? "right" : "left";
  } else {
    direction = "stay";
  }

  const intensity = clamp(ballSpeed / 20, 0.3, 1.0);
  const diveTarget: Vec2 = {
    x: goalX + (defendingLeft ? 1 : -1) * 0.5,
    z: clamp(predictedZ, -GOAL_MOUTH_HALF_Z, GOAL_MOUTH_HALF_Z),
  };

  return {
    name: "goalkeeper_dive",
    direction,
    intensity,
    targetPos: diveTarget,
  };
}

function generateDistributeIntent(ctx: BTContext): PlayerIntent | null {
  const teammates = ctx.player.team === "home" ? ctx.belief.homePlayers : ctx.belief.awayPlayers;
  const opponents = ctx.player.team === "home" ? ctx.belief.awayPlayers : ctx.belief.homePlayers;

  const options: Array<{ playerId: string; point: Vec2; type: GKDistributionType; score: number }> = [];

  for (const tm of teammates) {
    if (tm.id === ctx.player.id || tm.isGK) continue;

    const d = dist2(ctx.player.pos, tm.pos);
    const openness = computeOpenness(tm.pos, opponents);

    if (d < 15 && openness > 0.4) {
      options.push({
        playerId: tm.id,
        point: add2(tm.pos, scale2(normalize2(sub2(tm.pos, ctx.player.pos)), 1.0)),
        type: "throw",
        score: openness * 0.6 + (1 - d / 35) * 0.4,
      });
    } else if (d < 25 && openness > 0.3) {
      options.push({
        playerId: tm.id,
        point: add2(tm.pos, scale2(normalize2(sub2(tm.pos, ctx.player.pos)), 2.0)),
        type: "driven_kick",
        score: openness * 0.4 + (1 - d / 35) * 0.3 + (d > 20 ? 0.2 : 0),
      });
    }
  }

  options.push({
    playerId: "",
    point: { x: 0, z: ctx.player.pos.z > 0 ? -5 : 5 },
    type: "punt",
    score: 0.3,
  });

  options.sort((a, b) => b.score - a.score);
  const best = options[0] ?? options[0];

  if (!best) return null;

  return {
    name: "goalkeeper_distribute",
    type: best.type,
    targetPlayerId: best.playerId,
    targetPoint: best.point,
  };
}

function generatePositionIntent(ctx: BTContext): PlayerIntent {
  const defendingLeft = isDefendingLeft(ctx);
  const goalX = defendingLeft ? LEFT_GOAL_X : RIGHT_GOAL_X;
  const goalCenter: Vec2 = { x: goalX, z: 0 };
  const ballPos = ctx.belief.ball.pos;

  const toBall = normalize2(sub2(ballPos, goalCenter));
  const ballDist = dist2(goalCenter, ballPos);

  const arcRadius = clamp(
    GK_ARC_BASE_RADIUS + (ballDist - 5) * 0.15,
    GK_ARC_BASE_RADIUS,
    GK_ARC_MAX_RADIUS,
  );

  const depth = clamp(1.5 + ballDist * 0.08, 1.5, 6.0);

  const posOnArc: Vec2 = {
    x: goalX + (defendingLeft ? 1 : -1) * depth,
    z: clamp(ballPos.z * 0.35, -GOAL_MOUTH_HALF_Z * 0.8, GOAL_MOUTH_HALF_Z * 0.8),
  };

  const centerAngle = Math.atan2(ballPos.z - posOnArc.z, ballPos.x - posOnArc.x);

  return {
    name: "goalkeeper_position",
    centerAngle,
    depth,
    targetPos: posOnArc,
  };
}

function computeOpenness(pos: Vec2, opponents: PlayerBelief[]): number {
  let minDist = Infinity;
  for (const opp of opponents) {
    const d = dist2(pos, opp.pos);
    if (d < minDist) minDist = d;
  }
  return clamp(minDist / 8, 0, 1);
}

export function createGKControllerState(
  playerId: string,
): PlayerControllerState {
  return createPlayerControllerState(playerId, 10);
}

export function tickGKController(
  state: PlayerControllerState,
  player: PlayerBelief,
  belief: MatchBelief,
  blackboard: TacticalBlackboard,
  dt: number,
): { intent: PlayerIntent; newState: PlayerControllerState } | null {
  const bt = buildGKBehaviorTree();
  return tickPlayerController(state, player, belief, blackboard, bt, dt);
}
