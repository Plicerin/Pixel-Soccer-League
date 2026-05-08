import type {
  Vec2,
  TeamSide,
  PlayerIntent,
  PlayerBelief,
  MatchBelief,
  TacticalBlackboard,
  IntentName,
} from "../core/types";
import {
  FIELD_W,
  dist2,
  normalize2,
  sub2,
  add2,
  scale2,
  clamp,
} from "../core/constants";
import { BTNode, BTContext, selector, sequence, condition, action, prioritySelector } from "./behaviorTree";
import { arbitrate, IntentScore, ArbitrationContext } from "./utilityArbitration";
import {
  evaluatePassOptions,
  evaluateDefensiveCoverPosition,
  evaluateShotOptions,
  evaluateCarryOption,
  evaluateSupportPosition,
  evaluatePressTarget,
  shouldIntercept,
} from "./intentEvaluators";
import { isAttackingPhase, isDefendingPhase } from "../core/blackboard";

export type PlayerControllerState = {
  playerId: string;
  lastIntent: IntentName | null;
  lastIntentObj: PlayerIntent | null;
  recentIntents: Array<{ name: IntentName; tick: number }>;
  lastTick: number;
  tickInterval: number;
  timeSinceTick: number;
};

export function createPlayerControllerState(
  playerId: string,
  tickHz: number = 8,
): PlayerControllerState {
  return {
    playerId,
    lastIntent: null,
    lastIntentObj: null,
    recentIntents: [],
    lastTick: 0,
    tickInterval: 1 / tickHz,
    timeSinceTick: 999,
  };
}

export function buildOutfielderBT(): BTNode {
  return selector("outfielder_root", [
    sequence("carrier_branch", [
      condition("has_ball", (ctx) => ctx.player.hasBall),
      selector("carrier_options", [
        sequence("final_third_shot", [
          condition("in_final_third", (ctx) => {
            const attackSign = ctx.player.team === "home" ? ctx.belief.homeAttackSign : ctx.belief.awayAttackSign;
            return ctx.player.pos.x * attackSign > FIELD_W * 0.22;
          }),
          condition("has_shooting_lane", (ctx) => {
            const shots = evaluateShotOptions(ctx.player, ctx.belief, ctx.blackboard);
            if (shots.length === 0) return false;
            const best = shots[0];
            const intentKind = ctx.blackboard.intent.kind;
            const isPrimaryFinisher = ["ST", "LW", "RW", "AM"].includes(ctx.player.role);
            if (intentKind === "finish" && isPrimaryFinisher && best.quality >= 0.1) {
              return true;
            }
            let minQuality =
              intentKind === "finish" ? 0.14
              : intentKind === "attack" || intentKind === "counter" ? 0.2
              : 0.24;
            if (isPrimaryFinisher) minQuality -= 0.02;
            if (Math.abs(ctx.player.pos.z) < 8) minQuality -= 0.01;
            return best.quality >= Math.max(0.12, minQuality);
          }),
          action("generate_shot", (ctx) => {
            const shots = evaluateShotOptions(ctx.player, ctx.belief, ctx.blackboard);
            if (shots.length === 0) return null;
            const best = shots[0];
            return {
              name: "shoot",
              style: best.style,
              target: best.target,
              quality: best.quality,
            };
          }),
        ]),
        sequence("wide_delivery_available", [
          condition("advanced_wide_delivery_lane", (ctx) => {
            const attackSign = ctx.player.team === "home" ? ctx.belief.homeAttackSign : ctx.belief.awayAttackSign;
            const attackX = ctx.player.pos.x * attackSign;
            if (attackX < FIELD_W * 0.16 || Math.abs(ctx.player.pos.z) < 9) return false;
            const passes = evaluatePassOptions(ctx.player, ctx.belief, ctx.blackboard);
            const bestPass = passes[0];
            if (!bestPass) return false;
            return (bestPass.type === "cross" || bestPass.type === "cutback") && bestPass.quality >= 0.42;
          }),
          action("generate_wide_delivery", (ctx) => {
            const passes = evaluatePassOptions(ctx.player, ctx.belief, ctx.blackboard);
            const best = passes[0];
            if (!best || (best.type !== "cross" && best.type !== "cutback")) return null;
            return {
              name: "pass",
              targetPlayerId: best.targetPlayerId,
              type: best.type,
              weight: best.weight,
              targetPoint: best.targetPoint,
            };
          }),
        ]),
        sequence("progressive_carry", [
          condition("carry_beats_safe_recycle", (ctx) => {
            const intentKind = ctx.blackboard.intent.kind;
            if (!["progress", "attack", "counter"].includes(intentKind)) return false;
            const attackSign = ctx.player.team === "home" ? ctx.belief.homeAttackSign : ctx.belief.awayAttackSign;
            const attackX = ctx.player.pos.x * attackSign;
            if (attackX > FIELD_W * 0.24) return false;
            const passes = evaluatePassOptions(ctx.player, ctx.belief, ctx.blackboard);
            if (passes.length === 0) return true;
            const bestPass = passes[0];
            const passProgress = bestPass.targetPoint.x * attackSign - attackX;
            return !bestPass.isForward || bestPass.quality < 0.78 || passProgress < 6;
          }),
          action("generate_progressive_carry", (ctx) => {
            const previousCarryTarget = ctx.lastIntent?.name === "carry" ? ctx.lastIntent.target : null;
            const carry = evaluateCarryOption(ctx.player, ctx.belief, ctx.blackboard, previousCarryTarget);
            return { name: "carry", target: carry.target, ballRetention: carry.ballRetention };
          }),
        ]),
        sequence("pass_available", [
          condition("has_pass_option", (ctx) => {
            const passes = evaluatePassOptions(ctx.player, ctx.belief, ctx.blackboard);
            if (passes.length === 0) return false;
            const attackSign = ctx.player.team === "home" ? ctx.belief.homeAttackSign : ctx.belief.awayAttackSign;
            const inFinalThird = ctx.player.pos.x * attackSign > FIELD_W * 0.28;
            const intentKind = ctx.blackboard.intent.kind;
            const bestPass = passes[0];
            const shots = evaluateShotOptions(ctx.player, ctx.belief, ctx.blackboard);
            const bestShotQuality = shots[0]?.quality ?? 0;
            let minPassQuality = inFinalThird
              ? (intentKind === "finish" ? 0.54 : intentKind === "attack" || intentKind === "counter" ? 0.46 : 0.38)
              : 0.3;
            if (intentKind === "counter" && bestPass.isForward) minPassQuality -= 0.08;
            if (inFinalThird && bestShotQuality > 0.16) {
              minPassQuality = Math.max(minPassQuality, bestShotQuality + 0.12);
            }
            return bestPass.quality >= Math.max(0.22, minPassQuality);
          }),
          action("generate_pass", (ctx) => {
            const passes = evaluatePassOptions(ctx.player, ctx.belief, ctx.blackboard);
            if (passes.length === 0) return null;
            const best = passes[0];
            return {
              name: "pass",
              targetPlayerId: best.targetPlayerId,
              type: best.type,
              weight: best.weight,
              targetPoint: best.targetPoint,
            };
          }),
        ]),
        sequence("final_third_attack_carry", [
          condition("advanced_attacker", (ctx) => {
            const attackSign = ctx.player.team === "home" ? ctx.belief.homeAttackSign : ctx.belief.awayAttackSign;
            return ctx.player.pos.x * attackSign > FIELD_W * 0.2;
          }),
          action("generate_attack_carry", (ctx) => {
            const previousCarryTarget = ctx.lastIntent?.name === "carry" ? ctx.lastIntent.target : null;
            const carry = evaluateCarryOption(ctx.player, ctx.belief, ctx.blackboard, previousCarryTarget);
            return { name: "carry", target: carry.target, ballRetention: carry.ballRetention };
          }),
        ]),
        sequence("under_pressure_carry", [
          condition("under_pressure", (ctx) => {
            const opps = ctx.player.team === "home" ? ctx.belief.awayPlayers : ctx.belief.homePlayers;
            let nearCount = 0;
            for (const opp of opps) {
              if (dist2(ctx.player.pos, opp.pos) < 3.5) nearCount++;
            }
            return nearCount > 0;
          }),
          action("generate_carry", (ctx) => {
            const previousCarryTarget = ctx.lastIntent?.name === "carry" ? ctx.lastIntent.target : null;
            const carry = evaluateCarryOption(ctx.player, ctx.belief, ctx.blackboard, previousCarryTarget);
            return { name: "carry", target: carry.target, ballRetention: carry.ballRetention };
          }),
        ]),
        action("generate_carry_forward", (ctx) => {
          const previousCarryTarget = ctx.lastIntent?.name === "carry" ? ctx.lastIntent.target : null;
          const carry = evaluateCarryOption(ctx.player, ctx.belief, ctx.blackboard, previousCarryTarget);
          return { name: "carry", target: carry.target, ballRetention: carry.ballRetention };
        }),
      ]),
    ]),
    sequence("intercept_branch", [
      condition("ball_loose_or_flying", (ctx) => {
        return ctx.belief.ball.state === "in_flight" || ctx.belief.ball.state === "loose";
      }),
      condition("can_intercept", (ctx) => {
        const result = shouldIntercept(ctx.player, ctx.belief);
        return result !== null;
      }),
      action("generate_intercept", (ctx) => {
        const result = shouldIntercept(ctx.player, ctx.belief);
        if (!result) return null;
        return { name: "intercept", ballInterceptPoint: result.point, timeToReach: result.timeToReach };
      }),
    ]),
    sequence("cover_branch", [
      condition("opponent_has_ball_for_cover", (ctx) => ctx.belief.ball.ownerTeam !== null && ctx.belief.ball.ownerTeam !== ctx.player.team),
      condition("has_cover_assignment", (ctx) => evaluateDefensiveCoverPosition(ctx.player, ctx.belief, ctx.blackboard) !== null),
      action("generate_cover", (ctx) => {
        const cover = evaluateDefensiveCoverPosition(ctx.player, ctx.belief, ctx.blackboard);
        if (!cover) return null;
        return { name: "cover", target: cover.target, role: cover.role };
      }),
    ]),
    sequence("press_branch", [
      condition("opponent_has_ball", (ctx) => ctx.belief.ball.ownerTeam !== null && ctx.belief.ball.ownerTeam !== ctx.player.team),
      condition("near_ball_or_assigned", (ctx) => {
        const pressTarget = evaluatePressTarget(ctx.player, ctx.belief, ctx.blackboard);
        return pressTarget !== null;
      }),
      action("generate_press", (ctx) => {
        const pressTarget = evaluatePressTarget(ctx.player, ctx.belief, ctx.blackboard);
        if (!pressTarget) return null;
        const d = dist2(ctx.player.pos, pressTarget.pos);
        const intensity = d < 4 ? 0.9 : 0.5;
        return { name: "press", targetPlayerId: pressTarget.id, intensity, target: { x: pressTarget.pos.x, z: pressTarget.pos.z } };
      }),
    ]),
    action("generate_hold_or_support", (ctx) => {
      const supportPos = evaluateSupportPosition(ctx.player, ctx.belief, ctx.blackboard);
      return { name: "move_to", target: supportPos, urgency: 0.5 };
    }),
  ]);
}

export function tickPlayerController(
  state: PlayerControllerState,
  player: PlayerBelief,
  belief: MatchBelief,
  blackboard: TacticalBlackboard,
  bt: BTNode,
  dt: number,
): { intent: PlayerIntent; newState: PlayerControllerState } | null {
  const next = { ...state, timeSinceTick: state.timeSinceTick + dt };

  if (next.timeSinceTick < next.tickInterval) {
    if (state.lastIntentObj) {
      return {
        intent: state.lastIntentObj,
        newState: next,
      };
    }
    return null;
  }

  next.timeSinceTick = 0;
  next.lastTick++;

  const ctx: BTContext = {
    player,
    belief,
    blackboard,
    lastIntent: state.lastIntentObj,
    candidates: [],
  };

  bt.tick(ctx);

  if (ctx.candidates.length === 0) {
    const slot = blackboard.roleSlots.find(s => s.playerId === player.id);
    const fallback: PlayerIntent = {
      name: "move_to",
      target: slot?.targetPos ?? player.pos,
      urgency: 0.3,
    };
    rememberIntent(next, fallback);
    return { intent: fallback, newState: next };
  }

  const arbCtx: ArbitrationContext = {
    player,
    belief,
    blackboard,
    lastIntent: state.lastIntent,
    recentIntents: state.recentIntents,
    currentTick: next.lastTick,
  };

  const winner = arbitrate(ctx.candidates, arbCtx);
  if (!winner) {
    const slot = blackboard.roleSlots.find(s => s.playerId === player.id);
    const fallback: PlayerIntent = {
      name: "move_to",
      target: slot?.targetPos ?? player.pos,
      urgency: 0.3,
    };
    rememberIntent(next, fallback);
    return { intent: fallback, newState: next };
  }

  rememberIntent(next, winner.intent);

  return { intent: winner.intent, newState: next };
}

function rememberIntent(state: PlayerControllerState, intent: PlayerIntent): void {
  state.lastIntent = intent.name;
  state.lastIntentObj = intent;
  updateRecentIntents(state, intent.name);
}

function updateRecentIntents(state: PlayerControllerState, name: IntentName): void {
  state.recentIntents = [
    { name, tick: state.lastTick },
    ...state.recentIntents.filter(r => state.lastTick - r.tick < 24),
  ].slice(0, 8);
}
