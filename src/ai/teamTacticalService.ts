import type {
  Vec2,
  TeamSide,
  PlayerBelief,
  MatchBelief,
  PhaseOfPlay,
  BallZone,
  GameMode,
  TeamIntent,
  AttackPattern,
  PlayerRole,
  RoleSlot,
  SupportLane,
  TacticalBlackboard,
  PlayerRatings,
} from "../core/types";
import {
  FIELD_W,
  FIELD_D,
  dist2,
  normalize2,
  sub2,
  len2,
  dot2,
  clamp,
} from "../core/constants";
import { detectPhase, PhaseDetectionInput, isInFinalThird } from "./phaseDetector";
import { computeFormationPositions, computePressLine, createDefaultFormationConfig, FormationConfig } from "./formationEngine";
import { computeRoleBids, assignRolesWithStability, RoleBid } from "./roleAssignment";
import {
  createBlackboard,
  updateBlackboard,
  setPhase,
  setBallZone,
  setTeamIntent,
  setRoleSlots,
  setSupportLanes,
  setTransition,
  advanceTransitionAge,
  markPossessionChange,
  computePressLineY,
  computeCompactness,
  isAttackingPhase,
  isDefendingPhase,
} from "../core/blackboard";
import { computeBallZone } from "../core/beliefState";

export type TeamTacticalConfig = {
  formationConfig: FormationConfig;
  teamServiceHz: number;
  counterpressDurationMax: number;
  counterattackDurationMax: number;
  possessBias: number;
  attackBias: number;
  defendBias: number;
};

export function createDefaultTacticalConfig(): TeamTacticalConfig {
  return {
    formationConfig: createDefaultFormationConfig(),
    teamServiceHz: 4,
    counterpressDurationMax: 2.0,
    counterattackDurationMax: 3.5,
    possessBias: 1.0,
    attackBias: 1.0,
    defendBias: 1.0,
  };
}

export type TeamTacticalState = {
  blackboard: TacticalBlackboard;
  lastPossessionTeam: TeamSide | null;
  timeSinceService: number;
  serviceInterval: number;
  config: TeamTacticalConfig;
};

export function createTeamTacticalState(
  team: TeamSide,
  config?: Partial<TeamTacticalConfig>,
): TeamTacticalState {
  const fullConfig = { ...createDefaultTacticalConfig(), ...config };
  return {
    blackboard: createBlackboard(team),
    lastPossessionTeam: null,
    timeSinceService: fullConfig.teamServiceHz > 0 ? 999 : 0,
    serviceInterval: 1 / fullConfig.teamServiceHz,
    config: fullConfig,
  };
}

export function updateTeamTacticalService(
  state: TeamTacticalState,
  belief: MatchBelief,
  team: TeamSide,
  dt: number,
  isSetPiece: boolean,
): TeamTacticalState {
  const next = { ...state };
  next.timeSinceService += dt;

  const possessionTeam = belief.ball.ownerTeam;
  if (possessionTeam !== null && possessionTeam !== state.lastPossessionTeam) {
    const direction: "won" | "lost" = possessionTeam === team ? "won" : "lost";
    next.blackboard = markPossessionChange(next.blackboard, direction);
    next.lastPossessionTeam = possessionTeam;
  }

  next.blackboard = advanceTransitionAge(next.blackboard, dt);

  if (next.timeSinceService < next.serviceInterval) {
    return next;
  }
  next.timeSinceService = 0;

  const attackSign = team === "home" ? belief.homeAttackSign : belief.awayAttackSign;
  const myPlayers = team === "home" ? belief.homePlayers : belief.awayPlayers;
  const oppPlayers = team === "home" ? belief.awayPlayers : belief.homePlayers;
  const ballPos = belief.ball.pos;

  const ballZone = computeBallZone(ballPos.x, team, attackSign as 1 | -1);

  const phase = detectPhase({
    ballZone,
    ballState: belief.ball.state,
    possessionTeam,
    transitionAge: next.blackboard.transitionAge,
    lastPossessionTeam: state.lastPossessionTeam,
    ballHeight: 0,
    nearOpponentCount: countNearOpponents(ballPos, oppPlayers),
    isSetPiece,
  });

  const compactness = computeCompactness(phase);
  const pressLineY = computePressLineY(ballZone, attackSign as 1 | -1);

  const halfW = FIELD_W / 2;
  const halfD = FIELD_D / 2;
  const roleTargets = computeFormationPositions(
    next.config.formationConfig,
    ballPos,
    attackSign as 1 | -1,
    phase,
    compactness,
    halfW,
    halfD,
  );

  const bids = computeRoleBids(myPlayers, roleTargets);
  const roleSlots = assignRolesWithStability(next.blackboard.roleSlots, bids, roleTargets);

  const supportLanes = computeSupportLanes(myPlayers, oppPlayers, ballPos, attackSign as 1 | -1);

  const teamIntent = selectTeamIntent(
    phase,
    ballZone,
    belief,
    team,
    supportLanes,
    roleSlots,
    next.config,
  );

  const pressLine = computePressLine(phase, ballPos, attackSign as 1 | -1, halfW);

  next.blackboard = {
    ...next.blackboard,
    tick: next.blackboard.tick + 1,
    matchMinute: belief.matchMinute,
    scoreDiff: belief.scoreDiff,
    phase,
    ballZone,
    pressLineY: pressLine,
    compactness,
    roleSlots,
    intent: teamIntent,
    supportLanes,
  };

  return next;
}

function countNearOpponents(ballPos: Vec2, oppPlayers: PlayerBelief[]): number {
  let count = 0;
  for (const p of oppPlayers) {
    if (dist2(ballPos, p.pos) < 5.0) count++;
  }
  return count;
}

function computeSupportLanes(
  myPlayers: PlayerBelief[],
  oppPlayers: PlayerBelief[],
  ballPos: Vec2,
  attackSign: number,
): SupportLane[] {
  const lanes: SupportLane[] = [];
  const carrier = myPlayers.find(p => p.hasBall);
  if (!carrier) return lanes;

  for (const tm of myPlayers) {
    if (tm.id === carrier.id) continue;
    if (tm.isGK) continue;

    const d = dist2(carrier.pos, tm.pos);
    if (d < 3 || d > 30) continue;

    const toTm = normalize2(sub2(tm.pos, carrier.pos));
    const isForward = dot2(toTm, { x: attackSign, z: 0 }) > 0;

    let openness = 1.0;
    for (const opp of oppPlayers) {
      const oppDist = pointToSegmentDistance(opp.pos, carrier.pos, tm.pos);
      if (oppDist < 2.0) {
        openness -= (2.0 - oppDist) / 2.0;
      }
    }
    openness = clamp(openness, 0, 1);

    const score = openness * (isForward ? 1.2 : 0.7) * (1 / (1 + d * 0.05));

    lanes.push({
      laneId: `${carrier.id}->${tm.id}`,
      fromPlayerId: carrier.id,
      toPlayerId: tm.id,
      score: clamp(score, 0, 1),
      distance: d,
      isForward,
    });
  }

  lanes.sort((a, b) => b.score - a.score);
  return lanes.slice(0, 8);
}

function pointToSegmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub2(b, a);
  const ap = sub2(p, a);
  const abLenSq = ab.x * ab.x + ab.z * ab.z;
  if (abLenSq < 0.001) return dist2(p, a);

  let t = (ap.x * ab.x + ap.z * ab.z) / abLenSq;
  t = clamp(t, 0, 1);
  const closest: Vec2 = {
    x: a.x + ab.x * t,
    z: a.z + ab.z * t,
  };
  return dist2(p, closest);
}

function selectTeamIntent(
  phase: PhaseOfPlay,
  ballZone: BallZone,
  belief: MatchBelief,
  team: TeamSide,
  supportLanes: SupportLane[],
  roleSlots: RoleSlot[],
  config: TeamTacticalConfig,
): TeamIntent {
  const possessionTeam = belief.ball.ownerTeam;
  const hasPossession = possessionTeam === team;

  if (!hasPossession) {
    if (phase === "counterpress" && belief.ball.ownerPlayerId) {
      return { kind: "counterpress", triggerPlayerId: belief.ball.ownerPlayerId };
    }
    return { kind: "defend", pressureLevel: phase === "defensive_block" ? 0.6 : 0.3 };
  }

  const bestLane = supportLanes.length > 0 ? supportLanes[0] : null;
  const inFinalThird = ballZone === "opp_attacking" || ballZone === "opp_defensive";

  switch (phase) {
    case "counterattack": {
      const outlet = roleSlots.find(s =>
        s.role === "LW" || s.role === "RW" || s.role === "ST" || s.role === "AM"
      );
      return {
        kind: "counter",
        outletTargetId: outlet?.playerId ?? (bestLane?.toPlayerId ?? ""),
      };
    }

    case "final_third": {
      const shotQuality = computeShotQuality(belief, team);
      if (shotQuality > 0.6) {
        return { kind: "finish", shotQuality };
      }
      const pattern = selectAttackPattern(supportLanes, belief, team);
      const carrier = findCarrier(belief, team);
      return { kind: "attack", pattern, carrierId: carrier?.id ?? "" };
    }

    case "progression": {
      const side = bestLane && bestLane.isForward
        ? (bestLane.toPlayerId && findPlayerRole(bestLane.toPlayerId, roleSlots))
        : "center";
      const sideName = side === "LB" || side === "LW" ? "left"
        : side === "RB" || side === "RW" ? "right"
        : "center";
      return { kind: "progress", side: sideName as "left" | "center" | "right" };
    }

    case "build_up":
    default:
      return { kind: "possess", widthPreference: 0.5 };
  }
}

function computeShotQuality(belief: MatchBelief, team: TeamSide): number {
  const attackSign = team === "home" ? belief.homeAttackSign : belief.awayAttackSign;
  const ballX = belief.ball.pos.x;
  const distToGoal = Math.abs((FIELD_W / 2) - ballX * attackSign);

  let quality = 1.0 - distToGoal / (FIELD_W / 2);
  quality = clamp(quality * 1.5, 0, 1);

  const opps = team === "home" ? belief.awayPlayers : belief.homePlayers;
  for (const opp of opps) {
    if (dist2(belief.ball.pos, opp.pos) < 3.0) {
      quality *= 0.7;
    }
  }

  return quality;
}

function selectAttackPattern(
  supportLanes: SupportLane[],
  belief: MatchBelief,
  team: TeamSide,
): AttackPattern {
  const wideLanes = supportLanes.filter(l =>
    Math.abs(belief.ball.pos.z - (findPlayerPos(l.toPlayerId, belief, team)?.z ?? 0)) > 10
  );

  if (wideLanes.length > 0 && wideLanes[0].score > 0.4) {
    return wideLanes[0].toPlayerId && findPlayerRole(wideLanes[0].toPlayerId, []) === "LW"
      ? "wing_cross" : "wing_cutback";
  }

  const throughLanes = supportLanes.filter(l => l.isForward && l.score > 0.3);
  if (throughLanes.length > 0) return "central_through";

  return "give_and_go";
}

function findCarrier(belief: MatchBelief, team: TeamSide): PlayerBelief | null {
  const myPlayers = team === "home" ? belief.homePlayers : belief.awayPlayers;
  return myPlayers.find(p => p.hasBall) ?? null;
}

function findPlayerRole(playerId: string, roleSlots: RoleSlot[]): PlayerRole | null {
  return roleSlots.find(s => s.playerId === playerId)?.role ?? null;
}

function findPlayerPos(playerId: string, belief: MatchBelief, team: TeamSide): Vec2 | null {
  const all = [...belief.homePlayers, ...belief.awayPlayers];
  return all.find(p => p.id === playerId)?.pos ?? null;
}
