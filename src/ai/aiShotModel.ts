import * as THREE from 'three';

export type AIShotDecisionContext = {
  carrier: any;
  distToGoal: number;
  closePressure: number;
  inShootingLane: boolean;
  inTapInZone: boolean;
  insidePenaltyArea: boolean;
  passTarget: any | null;
  hasForwardPassOption: boolean;
  hasGoalSupport: boolean;
  roleProfile: any;
  shotSkill: number;
  dribbleSkill: number;
  passChance: number | null;
  activeAIStyle: any;
  team: 'A' | 'B';
  gameState: any;
};

export type AIShotDecisionResult = {
  shouldShoot: boolean;
  shootChance: number;
  shotUrgency: number;
  supportSuppression: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function anglePenalty(carrier: any) {
  const goalX = carrier.team === 'A' ? 60 : -60;
  const angle = Math.abs(Math.atan2(carrier.pos.z, Math.abs(goalX - carrier.pos.x)));
  return angle > 0.55 ? 0.14 : 0;
}

export function evaluateShotDecision(context: AIShotDecisionContext): AIShotDecisionResult {
  const {
    carrier,
    distToGoal,
    closePressure,
    inShootingLane,
    inTapInZone,
    insidePenaltyArea,
    passTarget,
    hasForwardPassOption,
    hasGoalSupport,
    roleProfile,
    shotSkill,
    dribbleSkill,
    passChance,
    activeAIStyle,
    gameState,
  } = context;

  const baseShotChance = inTapInZone ? 0.30 : (insidePenaltyArea ? 0.22 : (distToGoal < 18 ? 0.09 : 0.03));
  const pressurePenalty = closePressure * (insidePenaltyArea ? 0.06 : 0.11);
  const urgencyBoost = inTapInZone ? 0.20 : (insidePenaltyArea ? 0.06 : (distToGoal < 14 ? 0.02 : 0));
  const roleBias = (roleProfile.shootBias ?? 0.5) - 0.5;
  const skillBonus = (shotSkill - 0.5) * 0.24;
  const supportBonus = hasGoalSupport ? 0.03 : 0;
  const anglePenaltyValue = !inShootingLane && !insidePenaltyArea ? anglePenalty(carrier) : 0;
  const passOptionPenalty = hasForwardPassOption ? (insidePenaltyArea ? 0.03 : 0.10) : (passTarget ? 0.03 : 0);
  const teamShotTrend = (() => {
    const shots = carrier.team === 'A' ? gameState.shotsA : gameState.shotsB;
    const onTarget = carrier.team === 'A' ? gameState.shotsOnTargetA : gameState.shotsOnTargetB;
    const accuracy = shots > 0 ? onTarget / shots : 0.28;
    return clamp((0.22 - accuracy) * 0.38, 0, 0.06);
  })();

  const shootChance = clamp(
    baseShotChance
      + urgencyBoost
      - pressurePenalty
      + roleBias * 0.18
      + skillBonus
      + supportBonus
      - anglePenaltyValue
      - passOptionPenalty
      + teamShotTrend,
    0.02,
    0.58,
  );

  const shotUrgency = clamp(shootChance + (inTapInZone ? 0.16 : 0), 0, 1);
  const supportSuppression = hasForwardPassOption && !insidePenaltyArea ? 0.14 : 0;

  const shouldShoot = inTapInZone
    || insidePenaltyArea && inShootingLane && closePressure <= 2 && shootChance > 0.22
    || (!hasForwardPassOption && shootChance > 0.42)
    || (shootChance > 0.56 && !passTarget)
    || (
      (!passChance || shootChance >= passChance - 0.04)
      && Math.random() < (shootChance * (hasForwardPassOption && !insidePenaltyArea ? 0.18 : 0.42))
    );

  return {
    shouldShoot,
    shootChance,
    shotUrgency,
    supportSuppression,
  };
}
