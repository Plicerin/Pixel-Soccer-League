import type {
  Vec2,
  PlayerIntent,
  PlayerBelief,
  MatchBelief,
  TacticalBlackboard,
  IntentName,
} from "../core/types";
import { dist2, normalize2, sub2, len2, dot2, clamp } from "../core/constants";

export type IntentScore = {
  intent: PlayerIntent;
  score: number;
  breakdown: {
    laneOpen: number;
    roleFit: number;
    pressureRelief: number;
    transitionValue: number;
    turnoverRisk: number;
    staminaCost: number;
    hysteresis: number;
    cooldown: number;
  };
};

export type ArbitrationContext = {
  player: PlayerBelief;
  belief: MatchBelief;
  blackboard: TacticalBlackboard;
  lastIntent: IntentName | null;
  recentIntents: Array<{ name: IntentName; tick: number }>;
  currentTick: number;
};

const HYSTERESIS_BONUS = 0.4;
const COOLDOWN_PENALTY = 0.8;
const COOLDOWN_TICKS = 12;

export function scoreIntent(
  candidate: PlayerIntent,
  ctx: ArbitrationContext,
): IntentScore {
  const laneOpen = scoreLaneOpen(candidate, ctx);
  const roleFit = scoreRoleFit(candidate, ctx);
  const pressureRelief = scorePressureRelief(candidate, ctx);
  const transitionValue = scoreTransitionValue(candidate, ctx);
  const turnoverRisk = scoreTurnoverRisk(candidate, ctx);
  const staminaCost = scoreStaminaCost(candidate, ctx);
  const hysteresis = scoreHysteresis(candidate, ctx);
  const cooldown = scoreCooldown(candidate, ctx);

  const score =
    1.8 * laneOpen +
    1.4 * roleFit +
    1.2 * pressureRelief +
    1.0 * transitionValue -
    1.3 * turnoverRisk -
    0.8 * staminaCost +
    hysteresis +
    cooldown;

  return {
    intent: candidate,
    score,
    breakdown: {
      laneOpen,
      roleFit,
      pressureRelief,
      transitionValue,
      turnoverRisk,
      staminaCost,
      hysteresis,
      cooldown,
    },
  };
}

export function arbitrate(
  candidates: PlayerIntent[],
  ctx: ArbitrationContext,
): IntentScore | null {
  if (candidates.length === 0) return null;

  const scored = candidates.map(c => scoreIntent(c, ctx));
  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

export function arbitrateTopN(
  candidates: PlayerIntent[],
  ctx: ArbitrationContext,
  n: number,
): IntentScore[] {
  const scored = candidates.map(c => scoreIntent(c, ctx));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, n);
}

function scoreLaneOpen(candidate: PlayerIntent, ctx: ArbitrationContext): number {
  const opps = ctx.player.team === "home"
    ? ctx.belief.awayPlayers
    : ctx.belief.homePlayers;

  let target: Vec2;
  switch (candidate.name) {
    case "pass":
      target = candidate.targetPoint;
      break;
    case "shoot":
      target = candidate.target;
      break;
    case "move_to":
    case "support":
    case "carry":
    case "overlap":
      target = candidate.target;
      break;
    default:
      return 0.5;
  }

  let minOppDist = Infinity;
  for (const opp of opps) {
    const d = dist2(target, opp.pos);
    if (d < minOppDist) minOppDist = d;
  }

  return clamp(minOppDist / 10, 0, 1);
}

function scoreRoleFit(candidate: PlayerIntent, ctx: ArbitrationContext): number {
  const slot = ctx.blackboard.roleSlots.find(s => s.playerId === ctx.player.id);
  if (!slot) return 0.5;

  switch (candidate.name) {
    case "hold_position":
    case "move_to":
      return 0.9;
    case "press":
    case "contain":
    case "cover":
      if (slot.role === "GK") return 0.1;
      if (slot.role === "CB_L" || slot.role === "CB_R" || slot.role === "DM") return 0.8;
      return 0.5;
    case "pass":
    case "carry":
      if (slot.role === "GK") return 0.2;
      return 0.7;
    case "shoot":
      if (slot.role === "ST" || slot.role === "LW" || slot.role === "RW" || slot.role === "AM") return 0.9;
      return 0.3;
    case "support":
      if (slot.role === "CM_L" || slot.role === "CM_R" || slot.role === "AM") return 0.8;
      return 0.4;
    case "overlap":
      if (slot.role === "LB" || slot.role === "RB") return 0.9;
      return 0.2;
    default:
      return 0.5;
  }
}

function scorePressureRelief(candidate: PlayerIntent, ctx: ArbitrationContext): number {
  if (!ctx.player.hasBall) return 0;

  const opps = ctx.player.team === "home"
    ? ctx.belief.awayPlayers
    : ctx.belief.homePlayers;

  let nearOppCount = 0;
  for (const opp of opps) {
    if (dist2(ctx.player.pos, opp.pos) < 4.0) nearOppCount++;
  }

  if (nearOppCount === 0) return 0;

  switch (candidate.name) {
    case "pass": return nearOppCount * 0.25;
    case "carry": return nearOppCount > 2 ? -0.2 : 0.1;
    case "clear": return nearOppCount > 1 ? 0.6 : 0.1;
    default: return 0;
  }
}

function scoreTransitionValue(candidate: PlayerIntent, ctx: ArbitrationContext): number {
  const phase = ctx.blackboard.phase;
  const isTransition = phase === "counterattack" || phase === "counterpress";

  if (!isTransition) return 0;

  switch (candidate.name) {
    case "pass": {
      const isForward = candidate.targetPoint.x * (ctx.player.team === "home" ? ctx.belief.homeAttackSign : ctx.belief.awayAttackSign) > ctx.player.pos.x * (ctx.player.team === "home" ? ctx.belief.homeAttackSign : ctx.belief.awayAttackSign);
      return isForward ? 0.8 : 0.2;
    }
    case "carry": return 0.3;
    case "press": return phase === "counterpress" ? 0.7 : 0.1;
    default: return 0;
  }
}

function scoreTurnoverRisk(candidate: PlayerIntent, ctx: ArbitrationContext): number {
  switch (candidate.name) {
    case "pass": {
      const d = dist2(ctx.player.pos, candidate.targetPoint);
      const longPassRisk = d > 20 ? 0.5 : d > 10 ? 0.3 : 0.1;
      return longPassRisk;
    }
    case "shoot": return candidate.quality < 0.3 ? 0.4 : 0.1;
    case "carry": return 0.2;
    default: return 0.05;
  }
}

function scoreStaminaCost(candidate: PlayerIntent, ctx: ArbitrationContext): number {
  if (ctx.player.stamina01 > 0.7) return 0;

  const staminaDeficit = 1 - ctx.player.stamina01;

  switch (candidate.name) {
    case "press":
    case "track_runner":
    case "overlap":
    case "intercept":
      return staminaDeficit * 0.5;
    default:
      return 0;
  }
}

function scoreHysteresis(candidate: PlayerIntent, ctx: ArbitrationContext): number {
  if (ctx.lastIntent === null) return 0;
  if (candidate.name === ctx.lastIntent) return HYSTERESIS_BONUS;
  return 0;
}

function scoreCooldown(candidate: PlayerIntent, ctx: ArbitrationContext): number {
  for (const recent of ctx.recentIntents) {
    if (recent.name === candidate.name) {
      const ticksSince = ctx.currentTick - recent.tick;
      if (ticksSince < COOLDOWN_TICKS) {
        const ratio = 1 - ticksSince / COOLDOWN_TICKS;
        return -COOLDOWN_PENALTY * ratio;
      }
    }
  }
  return 0;
}
