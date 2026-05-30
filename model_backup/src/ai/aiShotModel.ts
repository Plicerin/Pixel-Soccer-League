import * as THREE from 'three';
import { FIELD_W } from '../../../src/core/constants.ts';

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
  crowdedShotLane?: boolean;
  shotCorridorDefenders?: number;
  shotBoxDefenders?: number;
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
  const goalX = carrier.team === 'A' ? FIELD_W / 2 : -FIELD_W / 2;
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
    crowdedShotLane,
    shotCorridorDefenders,
    shotBoxDefenders,
  } = context;

  const longRangeFactor = clamp((distToGoal - 18) / 14, 0, 1);
  const centralLongRangeFactor = longRangeFactor * (inShootingLane ? 1 : 0.55);
  const crowdedLane = crowdedShotLane === true || Number(shotCorridorDefenders ?? 0) >= 2.5 || Number(shotBoxDefenders ?? 0) >= 4;
  const oneMorePassAvailable = !!passTarget && hasForwardPassOption;
  const crowdedPassSuppression = crowdedLane && oneMorePassAvailable && !inTapInZone
    ? (insidePenaltyArea ? 0.13 : 0.19)
    : 0;
  const baseShotChance = inTapInZone ? 0.34 : (insidePenaltyArea ? 0.27 : (distToGoal < 18 ? 0.12 : 0.022));
  const pressurePenalty = closePressure * (insidePenaltyArea ? 0.045 : 0.105);
  const urgencyBoost = inTapInZone ? 0.22 : (insidePenaltyArea ? 0.09 : (distToGoal < 16 ? 0.04 : 0));
  const roleBias = (roleProfile.shootBias ?? 0.5) - 0.5;
  const skillBonus = (shotSkill - 0.5) * 0.24;
  const supportBonus = hasGoalSupport ? 0.03 : 0;
  const anglePenaltyValue = !inShootingLane && !insidePenaltyArea ? anglePenalty(carrier) : 0;
  const passOptionPenalty = hasForwardPassOption ? (insidePenaltyArea ? 0.015 : 0.07) : (passTarget ? 0.02 : 0);
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
      - crowdedPassSuppression
      - centralLongRangeFactor * 0.105
      - longRangeFactor * closePressure * 0.018
      + teamShotTrend,
    0.02,
    insidePenaltyArea ? 0.66 : 0.42,
  );

  const shotUrgency = clamp(shootChance + (inTapInZone ? 0.16 : 0), 0, 1);
  const supportSuppression = hasForwardPassOption && !insidePenaltyArea ? 0.14 : 0;

  const crowdedPassVeto = crowdedLane && oneMorePassAvailable && !inTapInZone && distToGoal > 7.5;
  const shouldShoot = inTapInZone || (!crowdedPassVeto && (
    insidePenaltyArea && inShootingLane && closePressure <= 3 && shootChance > 0.20
    || (!hasForwardPassOption && shootChance > 0.36)
    || (shootChance > 0.50 && !passTarget)
    || (
      (!passChance || shootChance >= passChance - 0.04)
      && Math.random() < (shootChance * (hasForwardPassOption && !insidePenaltyArea ? 0.13 : 0.38) * (1 - longRangeFactor * 0.34))
    )
  ));

  return {
    shouldShoot,
    shootChance,
    shotUrgency,
    supportSuppression,
  };
}
