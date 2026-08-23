import type {
  Vec2,
  TeamSide,
  PlayerBelief,
  MatchBelief,
  TacticalBlackboard,
  PlayerIntent,
  PassType,
  ShotStyle,
  PlayerRatings,
} from "../core/types";
import {
  FIELD_W,
  FIELD_D,
  LEFT_GOAL_X,
  RIGHT_GOAL_X,
  GOAL_MOUTH_HALF_Z,
  GAME_SPEED_SCALE,
  BASE_RUN_SPEED,
  dist2,
  normalize2,
  sub2,
  add2,
  scale2,
  len2,
  dot2,
  clamp,
  angle2,
} from "../core/constants";

export type PassOption = {
  targetPlayerId: string;
  targetPoint: Vec2;
  type: PassType;
  weight: number;
  quality: number;
  distance: number;
  openness: number;
  isForward: boolean;
};

export type ShotOption = {
  style: ShotStyle;
  target: Vec2;
  quality: number;
  angle: number;
  distance: number;
  pressure: number;
};

export function evaluatePassOptions(
  carrier: PlayerBelief,
  belief: MatchBelief,
  blackboard: TacticalBlackboard,
): PassOption[] {
  const teammates = carrier.team === "home" ? belief.homePlayers : belief.awayPlayers;
  const opponents = carrier.team === "home" ? belief.awayPlayers : belief.homePlayers;
  const attackSign = carrier.team === "home" ? belief.homeAttackSign : belief.awayAttackSign;
  const goalX = attackSign > 0 ? RIGHT_GOAL_X : LEFT_GOAL_X;
  const carrierAttackX = carrier.pos.x * attackSign;
  const wideCarrier = Math.abs(carrier.pos.z) > FIELD_D * 0.2;
  const advancedWideCarrier = wideCarrier && carrierAttackX > FIELD_W * 0.14;
  const bylineCarrier = advancedWideCarrier && carrierAttackX > FIELD_W * 0.3;
  const options: PassOption[] = [];

  for (const tm of teammates) {
    if (tm.id === carrier.id || tm.isGK) continue;

    const d = dist2(carrier.pos, tm.pos);
    if (d < 2 || d > 35) continue;

    const toTm = normalize2(sub2(tm.pos, carrier.pos));
    const isForward = dot2(toTm, { x: attackSign, z: 0 }) > 0.1;

    const openness = computeOpenness(tm.pos, opponents);
    const pressureOnCarrier = countNearbyOpponents(carrier.pos, opponents, 4.0);

    let type: PassType;
    let weight: number;
    if (d < 8) {
      type = "short";
      weight = 1.0;
    } else if (d < 15) {
      type = isForward && openness > 0.6 ? "through" : "driven";
      weight = 0.9;
    } else if (d < 25) {
      type = Math.abs(tm.pos.z) > FIELD_W * 0.25 ? "cross" : "long";
      weight = 0.7;
    } else {
      type = "long";
      weight = 0.5;
    }

    const passSkill = carrier.ratings.passing / 100;

    const receiverMoveSpeed = len2(tm.vel);
    const receiverMoveDir = receiverMoveSpeed > 0.15 ? normalize2(tm.vel) : { x: 0, z: 0 };
    const receiverLead = clamp(receiverMoveSpeed * 0.25, 0, 0.75);
    let targetPoint: Vec2 = {
      x: tm.pos.x + receiverMoveDir.x * receiverLead,
      z: tm.pos.z + receiverMoveDir.z * receiverLead,
    };
    const receiverAttackX = tm.pos.x * attackSign;
    const receiverCentral = Math.abs(tm.pos.z) < FIELD_D * 0.18;
    const receiverAttackingRole = tm.role === "ST" || tm.role === "AM" || tm.role === "LW" || tm.role === "RW";
    const receiverWide = Math.abs(tm.pos.z) > FIELD_D * 0.2;
    const passProgress = targetPoint.x * attackSign - carrierAttackX;
    const lateralShift = Math.abs(targetPoint.z - carrier.pos.z);
    const settledPossession =
      blackboard.intent.kind === "possess"
      || blackboard.phase === "build_up"
      || blackboard.phase === "progression";
    let deliveryBonus = 0;

    if (advancedWideCarrier && receiverCentral && receiverAttackX >= carrierAttackX - 4) {
      type = bylineCarrier ? "cutback" : "cross";
      weight = bylineCarrier ? 1.08 : 1.02;
      targetPoint = {
        x: clamp(goalX - attackSign * (bylineCarrier ? 8.5 : 6.4), -FIELD_W / 2 + 1.2, FIELD_W / 2 - 1.2),
        z: clamp(tm.pos.z * 0.35, -GOAL_MOUTH_HALF_Z * 1.6, GOAL_MOUTH_HALF_Z * 1.6),
      };
      deliveryBonus += 0.16;
      if (receiverAttackingRole) deliveryBonus += 0.08;
      if (bylineCarrier) deliveryBonus += 0.05;
    } else if (Math.abs(tm.pos.z) > 15 && isForward && d < 20) {
      type = "cross";
    }

    let recyclePenalty = 0;
    let progressBonus = 0;
    if (passProgress > 10) progressBonus += 0.14;
    else if (passProgress > 5) progressBonus += 0.07;
    if (receiverAttackingRole && receiverAttackX > carrierAttackX + 4) {
      progressBonus += receiverCentral ? 0.12 : 0.05;
    }
    if (wideCarrier && receiverCentral && receiverAttackX >= carrierAttackX + 2) {
      progressBonus += 0.1;
    }
    if (settledPossession) {
      if (!isForward) recyclePenalty += 0.12;
      if (passProgress < 2) recyclePenalty += 0.16;
      else if (passProgress < 5) recyclePenalty += 0.08;
      if (lateralShift < 6 && passProgress < 6) recyclePenalty += 0.06;
      if (pressureOnCarrier === 0 && passProgress < 4) recyclePenalty += 0.05;
      if (wideCarrier && receiverWide && passProgress < 7) recyclePenalty += 0.1;
      if (wideCarrier && !receiverCentral && lateralShift < 8 && passProgress < 8) recyclePenalty += 0.08;
    }

    const quality =
      openness * 0.45 +
      passSkill * 0.28 +
      (isForward ? 0.18 : 0) +
      deliveryBonus +
      progressBonus -
      recyclePenalty;

    options.push({
      targetPlayerId: tm.id,
      targetPoint,
      type,
      weight,
      quality: clamp(quality, 0, 1),
      distance: d,
      openness,
      isForward,
    });
  }

  options.sort((a, b) => b.quality - a.quality);
  return options;
}

export function evaluateShotOptions(
  shooter: PlayerBelief,
  belief: MatchBelief,
  blackboard: TacticalBlackboard,
): ShotOption[] {
  const attackSign = shooter.team === "home" ? belief.homeAttackSign : belief.awayAttackSign;
  const goalX = attackSign > 0 ? RIGHT_GOAL_X : LEFT_GOAL_X;
  const goalCenter: Vec2 = { x: goalX, z: 0 };
  const distToGoal = dist2(shooter.pos, goalCenter);

  if (distToGoal > 34) return [];

  const opponents = shooter.team === "home" ? belief.awayPlayers : belief.homePlayers;
  const pressure = countNearbyOpponents(shooter.pos, opponents, 3.0) / 5;

  const toGoal = normalize2(sub2(goalCenter, shooter.pos));
  const angle = Math.atan2(toGoal.z, toGoal.x);

  const shootingSkill = ((shooter.ratings.shooting || 0) + (shooter.ratings.finishing || shooter.ratings.shooting || 0)) / 200;
  const distancePenalty = clamp(1 - distToGoal / 30, 0, 1);
  const centrality = clamp(1 - Math.abs(shooter.pos.z) / Math.max(GOAL_MOUTH_HALF_Z * 4.5, 0.1), 0.42, 1);
  const phaseBoost =
    blackboard.phase === "final_third" ? 1.12
    : blackboard.phase === "counterattack" ? 1.08
    : 1.0;
  const intentBoost =
    blackboard.intent.kind === "finish" ? 1.2
    : blackboard.intent.kind === "attack" || blackboard.intent.kind === "counter" ? 1.08
    : 1.0;
  const roleBoost =
    shooter.role === "ST" ? 1.15
    : shooter.role === "LW" || shooter.role === "RW" || shooter.role === "AM" ? 1.07
    : shooter.role === "CM_L" || shooter.role === "CM_R" ? 0.95
    : 0.82;
  const pressureFactor = clamp(1 - pressure * 0.35, 0.52, 1);
  const baseQuality = clamp(shootingSkill * distancePenalty * centrality * phaseBoost * intentBoost * roleBoost * pressureFactor, 0, 1);
  const wideAngle = Math.abs(shooter.pos.z) > GOAL_MOUTH_HALF_Z * 1.4;

  const options: ShotOption[] = [];

  if (distToGoal < 18) {
    options.push({
      style: "laces_drive",
      target: { x: goalX, z: 0 },
      quality: clamp(baseQuality * (distToGoal < 11 ? 1.16 : 1.0), 0, 1),
      angle,
      distance: distToGoal,
      pressure,
    });
  }

  if (distToGoal < 24) {
    const side = shooter.pos.z > 0 ? -1 : 1;
    options.push({
      style: "curled",
      target: { x: goalX, z: side * GOAL_MOUTH_HALF_Z * 0.6 },
      quality: clamp(baseQuality * (wideAngle ? 1.02 : 0.9), 0, 1),
      angle,
      distance: distToGoal,
      pressure,
    });
  }

  if (distToGoal < 14 && (pressure > 0.22 || blackboard.intent.kind === "finish")) {
    options.push({
      style: "placed",
      target: { x: goalX, z: (shooter.pos.z > 0 ? -1 : 1) * GOAL_MOUTH_HALF_Z * 0.4 },
      quality: clamp(baseQuality * 0.85, 0, 1),
      angle,
      distance: distToGoal,
      pressure,
    });
  }

  if (distToGoal >= 14 && distToGoal < 24 && pressure < 0.38) {
    options.push({
      style: "laces_drive",
      target: { x: goalX, z: clamp(shooter.pos.z * -0.18, -GOAL_MOUTH_HALF_Z * 0.45, GOAL_MOUTH_HALF_Z * 0.45) },
      quality: clamp(baseQuality * 0.84, 0, 1),
      angle,
      distance: distToGoal,
      pressure,
    });
  }

  if (distToGoal > 16 && distToGoal < 28 && pressure < 0.18) {
    options.push({
      style: "chip",
      target: { x: goalX, z: 0 },
      quality: clamp(baseQuality * 0.6, 0, 1),
      angle,
      distance: distToGoal,
      pressure,
    });
  }

  options.sort((a, b) => b.quality - a.quality);
  return options;
}

export function evaluateCarryOption(
  carrier: PlayerBelief,
  belief: MatchBelief,
  blackboard: TacticalBlackboard,
  previousCarryTarget?: Vec2 | null,
): { target: Vec2; ballRetention: number } {
  const attackSign = carrier.team === "home" ? belief.homeAttackSign : belief.awayAttackSign;
  const opponents = carrier.team === "home" ? belief.awayPlayers : belief.homePlayers;
  const goalX = attackSign > 0 ? RIGHT_GOAL_X : LEFT_GOAL_X;

  const forwardDir: Vec2 = { x: attackSign, z: 0 };
  const bestOpp = findNearestOpponent(carrier.pos, opponents);
  const oppDist = bestOpp ? dist2(carrier.pos, bestOpp.pos) : 99;
  const distToGoal = Math.abs(goalX - carrier.pos.x);
  const inFinalThird = carrier.pos.x * attackSign > FIELD_W * 0.15;
  const wideCarrier = Math.abs(carrier.pos.z) > FIELD_D * 0.16;

  let carryTarget: Vec2;
  if (inFinalThird) {
    const forwardStep = clamp(distToGoal * 0.18, 3.8, 6.2);
    const centralPull = clamp(-carrier.pos.z * (wideCarrier ? 0.16 : 0.26), -2.4, 2.4);
    let evadeZ = 0;
    if (bestOpp && oppDist < 3.4) {
      const awayFromOpp = normalize2(sub2(carrier.pos, bestOpp.pos));
      evadeZ = awayFromOpp.z * clamp(3.4 - oppDist, 0.2, 0.9);
    }
    carryTarget = {
      x: carrier.pos.x + attackSign * forwardStep,
      z: clamp(carrier.pos.z + centralPull + evadeZ, -FIELD_D / 2 + 1.2, FIELD_D / 2 - 1.2),
    };
  } else if (oppDist > 5) {
    carryTarget = add2(carrier.pos, scale2(forwardDir, 4));
  } else if (bestOpp) {
    const awayFromOpp = normalize2(sub2(carrier.pos, bestOpp.pos));
    carryTarget = add2(carrier.pos, scale2(awayFromOpp, 3));
  } else {
    carryTarget = add2(carrier.pos, scale2(forwardDir, 2));
  }

  if (previousCarryTarget) {
    carryTarget = stabilizeCarryLane(carrier.pos, carryTarget, previousCarryTarget, oppDist);
  }

  const dribblingSkill = carrier.ratings.dribbling / 100;
  const ballRetention = dribblingSkill * clamp(oppDist / 6, 0, 1);

  return { target: carryTarget, ballRetention };
}

export function evaluateSupportPosition(
  player: PlayerBelief,
  belief: MatchBelief,
  blackboard: TacticalBlackboard,
): Vec2 {
  const slot = blackboard.roleSlots.find(s => s.playerId === player.id);
  const attackSign = player.team === "home" ? belief.homeAttackSign : belief.awayAttackSign;
  const goalX = attackSign > 0 ? RIGHT_GOAL_X : LEFT_GOAL_X;
  const teammates = player.team === "home" ? belief.homePlayers : belief.awayPlayers;
  const carrier = teammates.find(p => p.hasBall) ?? null;
  const baseTarget = slot?.targetPos ?? player.pos;
  if (!carrier || carrier.id === player.id) return baseTarget;

  const carrierAttackX = carrier.pos.x * attackSign;
  const wideCarrier = Math.abs(carrier.pos.z) > FIELD_D * 0.18;
  const sideSign = carrier.pos.z >= 0 ? 1 : -1;
  const nominalSide = inferNominalSide(player, baseTarget);
  const phaseIsAttack =
    blackboard.phase === "final_third"
    || blackboard.phase === "counterattack"
    || blackboard.intent.kind === "attack"
    || blackboard.intent.kind === "finish"
    || blackboard.intent.kind === "counter";

  if (phaseIsAttack && wideCarrier && carrierAttackX > FIELD_W * 0.1) {
    switch (player.role) {
      case "ST":
        return {
          x: clamp(goalX - attackSign * 4.6, -FIELD_W / 2 + 1.5, FIELD_W / 2 - 1.5),
          z: clamp(sideSign * GOAL_MOUTH_HALF_Z * 0.95, -GOAL_MOUTH_HALF_Z * 1.45, GOAL_MOUTH_HALF_Z * 1.45),
        };
      case "AM":
      case "CM_L":
      case "CM_R":
        return {
          x: clamp(goalX - attackSign * 8.2, -FIELD_W / 2 + 1.5, FIELD_W / 2 - 1.5),
          z: clamp(carrier.pos.z * 0.32, -GOAL_MOUTH_HALF_Z * 1.6, GOAL_MOUTH_HALF_Z * 1.6),
        };
      case "LW":
      case "RW":
        if (nominalSide === -sideSign) {
          return {
            x: clamp(goalX - attackSign * 5.9, -FIELD_W / 2 + 1.5, FIELD_W / 2 - 1.5),
            z: clamp(
              -sideSign * Math.max(GOAL_MOUTH_HALF_Z * 1.35, FIELD_D * 0.22),
              -FIELD_D / 2 + 1.5,
              FIELD_D / 2 - 1.5,
            ),
          };
        }
        return {
          x: clamp(carrier.pos.x - attackSign * 2.4, -FIELD_W / 2 + 1.5, FIELD_W / 2 - 1.5),
          z: clamp(carrier.pos.z + sideSign * 4.5, -FIELD_D / 2 + 1.5, FIELD_D / 2 - 1.5),
        };
      case "LB":
      case "RB":
        return {
          x: clamp(carrier.pos.x - attackSign * 5.5, -FIELD_W / 2 + 1.5, FIELD_W / 2 - 1.5),
          z: clamp(
            nominalSide === sideSign ? carrier.pos.z + sideSign * 6.0 : carrier.pos.z - sideSign * 7.5,
            -FIELD_D / 2 + 1.5,
            FIELD_D / 2 - 1.5,
          ),
        };
    }
  }

  if (blackboard.intent.kind === "progress") {
    if (player.role === "LW" || player.role === "RW") {
      return {
        x: Math.max(baseTarget.x, carrier.pos.x - attackSign * 1.8),
        z: clamp(
          Math.sign(baseTarget.z || nominalSide || sideSign) * Math.max(Math.abs(baseTarget.z), FIELD_D * 0.2),
          -FIELD_D / 2 + 1.5,
          FIELD_D / 2 - 1.5,
        ),
      };
    }
    if (player.role === "LB" || player.role === "RB") {
      return {
        x: clamp(carrier.pos.x - attackSign * 7.0, -FIELD_W / 2 + 1.5, FIELD_W / 2 - 1.5),
        z: clamp(
          Math.sign(baseTarget.z || nominalSide || sideSign) * Math.max(Math.abs(baseTarget.z), FIELD_D * 0.18),
          -FIELD_D / 2 + 1.5,
          FIELD_D / 2 - 1.5,
        ),
      };
    }
  }

  if (slot) return slot.targetPos;

  return {
    x: carrier.pos.x + attackSign * 5,
    z: clamp(player.pos.z + (player.pos.z > 0 ? -1.5 : 1.5), -FIELD_D / 2 + 1.2, FIELD_D / 2 - 1.2),
  };
}

export function evaluatePressTarget(
  player: PlayerBelief,
  belief: MatchBelief,
  blackboard: TacticalBlackboard,
): PlayerBelief | null {
  if (player.hasBall) return null;
  if (player.isGK) return null;

  const opponents = player.team === "home" ? belief.awayPlayers : belief.homePlayers;
  const teammates = player.team === "home" ? belief.homePlayers : belief.awayPlayers;
  const ballCarrier = opponents.find(p => p.hasBall);
  if (ballCarrier) {
    const attackSign = player.team === "home" ? belief.homeAttackSign : belief.awayAttackSign;
    const ownGoalX = attackSign > 0 ? LEFT_GOAL_X : RIGHT_GOAL_X;
    const carrierDistToOwnGoal = Math.abs(ownGoalX - ballCarrier.pos.x);
    const ballInOwnWarningZone =
      carrierDistToOwnGoal < FIELD_W * 0.72
      && Math.abs(ballCarrier.pos.z) < FIELD_D * 0.34;
    const ballInOwnDangerZone =
      carrierDistToOwnGoal < FIELD_W * 0.5
      && Math.abs(ballCarrier.pos.z) < FIELD_D * 0.42;
    const myDistToCarrier = dist2(player.pos, ballCarrier.pos);
    const closerTeammates = teammates.filter(tm =>
      !tm.isGK
      && tm.id !== player.id
      && dist2(tm.pos, ballCarrier.pos) < myDistToCarrier - 0.4
    );
    const pressureRank = 1 + closerTeammates.length;
    const deepDefender =
      player.role === "CB_L"
      || player.role === "CB_R"
      || player.role === "LB"
      || player.role === "RB"
      || player.role === "DM";

    if ((ballInOwnWarningZone || ballInOwnDangerZone) && deepDefender) {
      if (pressureRank > 1) return null;
      const emergencyClose = myDistToCarrier < (
        ballInOwnDangerZone
          ? (player.role === "DM" ? 7.2 : 5.6)
          : (player.role === "DM" ? 4.2 : 3.4)
      );
      if (!emergencyClose) return null;
    }

    if (myDistToCarrier < 10) {
      return ballCarrier;
    }
  }

  let nearest: PlayerBelief | null = null;
  let nearestDist = Infinity;
  for (const opp of opponents) {
    const d = dist2(player.pos, opp.pos);
    if (d < nearestDist && d < 8) {
      nearest = opp;
      nearestDist = d;
    }
  }
  return nearest;
}

export function evaluateDefensiveCoverPosition(
  player: PlayerBelief,
  belief: MatchBelief,
  blackboard: TacticalBlackboard,
): { target: Vec2; role: "near_post" | "far_post" | "cutback_lane" | "second_wave" | "deep_cover" } | null {
  if (player.hasBall || player.isGK) return null;

  const attackSign = player.team === "home" ? belief.homeAttackSign : belief.awayAttackSign;
  const ownGoalX = attackSign > 0 ? LEFT_GOAL_X : RIGHT_GOAL_X;
  const opponents = player.team === "home" ? belief.awayPlayers : belief.homePlayers;
  const teammates = player.team === "home" ? belief.homePlayers : belief.awayPlayers;
  const ballCarrier = opponents.find(p => p.hasBall);
  if (!ballCarrier) return null;

  const carrierDistToOwnGoal = Math.abs(ownGoalX - ballCarrier.pos.x);
  const warningZone =
    carrierDistToOwnGoal < FIELD_W * 0.72
    && Math.abs(ballCarrier.pos.z) < FIELD_D * 0.34;
  const dangerZone =
    carrierDistToOwnGoal < FIELD_W * 0.5
    && Math.abs(ballCarrier.pos.z) < FIELD_D * 0.42;
  if (!warningZone && !dangerZone) return null;

  const myDistToCarrier = dist2(player.pos, ballCarrier.pos);
  const closerTeammates = teammates.filter(tm =>
    !tm.isGK
    && tm.id !== player.id
    && dist2(tm.pos, ballCarrier.pos) < myDistToCarrier - 0.4
  );
  const pressureRank = 1 + closerTeammates.length;
  if (pressureRank <= 1 && myDistToCarrier < (dangerZone ? 8.5 : 4.8)) return null;

  const sideSign = ballCarrier.pos.z >= 0 ? 1 : -1;
  let role: "near_post" | "far_post" | "cutback_lane" | "second_wave" | "deep_cover" = "deep_cover";
  let target: Vec2 = {
    x: ownGoalX + attackSign * 8.8,
    z: clamp(ballCarrier.pos.z * 0.22, -GOAL_MOUTH_HALF_Z * 1.35, GOAL_MOUTH_HALF_Z * 1.35),
  };

  switch (player.role) {
    case "CB_L":
    case "CB_R":
      role = sideSign * player.pos.z >= 0 ? "near_post" : "far_post";
      target = {
        x: ownGoalX + attackSign * (role === "near_post" ? 6.2 : 7.6),
        z: clamp(
          role === "near_post" ? sideSign * GOAL_MOUTH_HALF_Z * 0.85 : -sideSign * GOAL_MOUTH_HALF_Z * 1.2,
          -GOAL_MOUTH_HALF_Z * 1.8,
          GOAL_MOUTH_HALF_Z * 1.8,
        ),
      };
      break;
    case "DM":
      role = "cutback_lane";
      target = {
        x: ownGoalX + attackSign * 10.2,
        z: clamp(ballCarrier.pos.z * 0.16, -GOAL_MOUTH_HALF_Z * 1.2, GOAL_MOUTH_HALF_Z * 1.2),
      };
      break;
    case "LB":
    case "RB":
      role = sideSign * player.pos.z >= 0 ? "second_wave" : "far_post";
      target = {
        x: ownGoalX + attackSign * (role === "second_wave" ? 10.8 : 8.8),
        z: clamp(
          role === "second_wave" ? sideSign * GOAL_MOUTH_HALF_Z * 2.15 : -sideSign * GOAL_MOUTH_HALF_Z * 1.45,
          -GOAL_MOUTH_HALF_Z * 2.4,
          GOAL_MOUTH_HALF_Z * 2.4,
        ),
      };
      break;
    default:
      break;
  }

  return { target, role };
}

export function shouldIntercept(
  player: PlayerBelief,
  belief: MatchBelief,
): { point: Vec2; timeToReach: number } | null {
  if (belief.ball.state !== "in_flight" && belief.ball.state !== "loose") return null;
  if (belief.ball.ownerTeam === player.team) return null;

  const ballPos = belief.ball.pos;
  const ballVel = belief.ball.vel;
  const toPlayer = sub2(player.pos, ballPos);

  const ballSpeed = len2(ballVel);
  const playerSpeed = player.speed * 0.85;
  const allPlayers = [...belief.homePlayers, ...belief.awayPlayers];
  const dist = len2(toPlayer);

  if (ballSpeed < 0.75) {
    if (dist > 12) return null;
    const nearestDist = allPlayers.reduce((best, p) => Math.min(best, dist2(ballPos, p.pos)), Infinity);
    if (dist > nearestDist + 1.5) return null;
    return {
      point: ballPos,
      timeToReach: dist / Math.max(playerSpeed, 1),
    };
  }

  if (dist > 15) return null;

  const ballDir = normalize2(ballVel);
  const projection = dot2(toPlayer, ballDir);

  if (projection < 0) return null;

  const closestPoint: Vec2 = add2(ballPos, scale2(ballDir, projection));
  const perpDist = dist2(player.pos, closestPoint);

  if (perpDist > 3.5) return null;

  const timeToReach = perpDist / Math.max(playerSpeed, 1);
  const ballArrivalTime = projection / Math.max(ballSpeed, 1);

  if (timeToReach < ballArrivalTime + 0.5) {
    return { point: closestPoint, timeToReach };
  }

  return null;
}

function computeOpenness(pos: Vec2, opponents: PlayerBelief[]): number {
  let minDist = Infinity;
  for (const opp of opponents) {
    const d = dist2(pos, opp.pos);
    if (d < minDist) minDist = d;
  }
  return clamp(minDist / 8, 0, 1);
}

function countNearbyOpponents(pos: Vec2, opponents: PlayerBelief[], radius: number): number {
  let count = 0;
  for (const opp of opponents) {
    if (dist2(pos, opp.pos) < radius) count++;
  }
  return count;
}

function findNearestOpponent(pos: Vec2, opponents: PlayerBelief[]): PlayerBelief | null {
  let nearest: PlayerBelief | null = null;
  let nearestDist = Infinity;
  for (const opp of opponents) {
    const d = dist2(pos, opp.pos);
    if (d < nearestDist) {
      nearest = opp;
      nearestDist = d;
    }
  }
  return nearest;
}

function stabilizeCarryLane(
  carrierPos: Vec2,
  proposedTarget: Vec2,
  previousTarget: Vec2,
  oppDist: number,
): Vec2 {
  const prevDeltaZ = previousTarget.z - carrierPos.z;
  const nextDeltaZ = proposedTarget.z - carrierPos.z;
  const prevSign = Math.sign(prevDeltaZ);
  const nextSign = Math.sign(nextDeltaZ);

  if (prevSign !== 0 && nextSign !== 0 && prevSign !== nextSign && oppDist > 2.4) {
    return {
      x: proposedTarget.x,
      z: clamp(
        carrierPos.z + prevSign * Math.max(Math.abs(nextDeltaZ) * 0.45, 0.8),
        -FIELD_D / 2 + 1.2,
        FIELD_D / 2 - 1.2,
      ),
    };
  }

  return proposedTarget;
}

function inferNominalSide(player: PlayerBelief, fallback: Vec2): number {
  switch (player.role) {
    case "LW":
    case "LB":
    case "CM_L":
      return -1;
    case "RW":
    case "RB":
    case "CM_R":
      return 1;
    default:
      return fallback.z === 0 ? 0 : Math.sign(fallback.z);
  }
}
