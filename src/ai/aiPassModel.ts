import * as THREE from 'three';

export type AIPassModelConstants = {
  fieldWidth: number;
  fieldDepth: number;
  goalMouthWidth: number;
  penaltyDepth: number;
  penaltyHalfZ: number;
};

export function attemptThroughPass(
  carrier: any,
  teammates: any[],
  opponents: any[],
  team: 'A' | 'B',
  attackSign: 1 | -1,
) {
  if (!carrier || teammates.length === 0) return null;

  let bestTarget: any = null;
  let bestScore = -Infinity;
  const passSkill = carrier.stats?.passing ?? 0.52;

  teammates.forEach((candidate) => {
    const passDist = carrier.pos.distanceTo(candidate.pos);
    if (passDist < 14 || passDist > 28) return;

    const progress = (candidate.pos.x - carrier.pos.x) * attackSign;
    if (progress < 3.0) return;

    const receiverSpeed = candidate.stats?.speed ?? 6.0;
    const receiverTime = passDist / Math.max(receiverSpeed, 4.2);
    const defenderTime = Math.min(...opponents.map((opp) => {
      const oppSpeed = Math.max(opp.stats?.speed ?? 5.8, 3.5);
      return opp.pos.distanceTo(candidate.pos) / oppSpeed;
    }));

    if (receiverTime > defenderTime * 0.84) return;

    const lanePressure = opponents.reduce((total, opp) => {
      const dist = opp.pos.distanceTo(candidate.pos);
      return total + Math.max(0, 4.2 - dist);
    }, 0) * 0.20;

    const score = progress * 1.4
      - passDist * 0.06
      + passSkill * 4.2
      - lanePressure
      + Math.max(0, 4 - lanePressure) * 0.25;

    if (score > bestScore) {
      bestScore = score;
      bestTarget = candidate;
    }
  });

  return bestTarget;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getLastDefenderLine(opponents: any[], attackSign: number) {
  const defenderX = opponents.map((opp) => opp.pos.x * attackSign).sort((a, b) => a - b);
  return defenderX.length > 0 ? defenderX[defenderX.length - 1] : -Infinity;
}

function countReceiverPressure(candidate: any, opponents: any[]) {
  return opponents.reduce((pressure, opp) => {
    const d = opp.pos.distanceTo(candidate.pos);
    return pressure + Math.max(0, 4.5 - d);
  }, 0);
}

function getSupportSpace(candidate: any, opponents: any[]) {
  let minDist = Infinity;
  opponents.forEach((opp) => {
    const d = opp.pos.distanceTo(candidate.pos);
    if (d < minDist) minDist = d;
  });
  return Math.max(0, Math.min(minDist, 12));
}

export function selectAIPassTarget(
  carrier: any,
  teammates: any[],
  opponents: any[],
  team: 'A' | 'B',
  attackSign: 1 | -1,
  constants: AIPassModelConstants,
) {
  if (!carrier || teammates.length === 0) return null;

  let bestTarget: any = null;
  let bestScore = -Infinity;
  let bestForwardReceiver: any = null;
  let bestForwardScore = -Infinity;
  const carrierRole = (carrier.displayRole || carrier.role || 'CM').toString().toUpperCase();
  const passSkill = carrier.stats?.passing ?? 0.52;
  const baseIdeal = THREE.MathUtils.lerp(10.4, 17.8, passSkill);
  const lastDefenderX = getLastDefenderLine(opponents, attackSign);
  const carrierX = carrier.pos.x * attackSign;
  const carrierDistToGoal = Math.abs((attackSign > 0 ? constants.fieldWidth / 2 : -constants.fieldWidth / 2) - carrier.pos.x);
  const carrierInFinalThird = carrierDistToGoal < 30;

  teammates.forEach((candidate) => {
    const passDist = carrier.pos.distanceTo(candidate.pos);
    if (passDist < 2.2 || passDist > 38) return;

    const candidateX = candidate.pos.x * attackSign;
    const progress = candidateX - carrierX;
    if (carrierInFinalThird && progress < -1.2) return;

    const candidateRole = (candidate.displayRole || candidate.role || 'CM').toString().toUpperCase();
    if (candidateX > lastDefenderX && candidateX > carrierX) return;

    const receiverDanger = countReceiverPressure(candidate, opponents);
    const supportSpace = getSupportSpace(candidate, opponents);
    const lanePressure = Math.max(0, (4.2 - supportSpace) * 0.9);

    const preferredDist = baseIdeal;
    const preferredDistPenalty = Math.abs(passDist - preferredDist) * THREE.MathUtils.lerp(0.16, 0.07, passSkill);

    const centralLaneGap = Math.abs(candidate.pos.z - carrier.pos.z);
    const secondWavePocketGap = Math.abs(candidateX - carrierX - 5.5);
    const midfieldSupportBonus = ['CM', 'DM'].includes(candidateRole) && progress > 0.4 && supportSpace > 1.7 ? 5.4 : 0;
    const layoffBonus = ['CM', 'DM', 'CAM', 'ST', 'CF'].includes(candidateRole) && progress >= -1.5 && progress <= 7.5 && centralLaneGap < constants.fieldDepth * 0.16 ? 3.4 : 0;
    const strikerTargetBias = 0;
    const centralSupportBias = ['CM', 'DM', 'CAM'].includes(candidateRole) ? Math.max(0, 2.6 - centralLaneGap * 0.14) : 0;
    const secondWavePocketBonus = candidateRole === 'CM'
      && progress >= 2.0
      && progress <= 9.5
      && centralLaneGap < constants.fieldDepth * 0.12
      ? Math.max(0, 4.2 - secondWavePocketGap * 0.42)
      : 0;
    const widthPush = Math.abs(candidate.pos.z) > constants.fieldDepth * 0.18 && progress >= 0 ? 0.8 : 0;
    const wideRecyclePenalty = candidateRole === 'CM'
      && progress >= 0
      && Math.abs(candidate.pos.z) > constants.fieldDepth * 0.2
      ? 1.1
      : 0;
    const crossTargetBonus = Math.abs(candidate.pos.z) < constants.penaltyHalfZ && carrierInFinalThird && Math.abs(candidate.pos.z) < constants.goalMouthWidth ? 2.0 : 0;
    const backwardPenalty = progress < 0 ? (Math.abs(progress) + 0.8) * 6.4 : 0;
    const isOpen = receiverDanger < 5.0 && supportSpace > 0.9;
    const strikerOpenRelaxed = false;
    const centralMidOpenRelaxed = ['CM', 'DM', 'CAM'].includes(candidateRole) && progress > -1.5 && centralLaneGap < constants.fieldDepth * 0.18 && receiverDanger < 5.2 && supportSpace > 0.8;

    const score =
      progress * 0.88
      + supportSpace * 0.78
      - lanePressure * 0.95
      - receiverDanger * 1.95
      - preferredDistPenalty
      - backwardPenalty
      + midfieldSupportBonus
      + layoffBonus
      + strikerTargetBias
      + centralSupportBias
      + secondWavePocketBonus
      + widthPush
      + crossTargetBonus;
    const adjustedScore = score - wideRecyclePenalty;

    const targetIsOpen = isOpen || strikerOpenRelaxed || centralMidOpenRelaxed;
    const forwardCandidate = progress > 1.0;

    if (forwardCandidate && adjustedScore > bestForwardScore) {
      bestForwardScore = adjustedScore;
      bestForwardReceiver = candidate;
    }

    if (targetIsOpen && adjustedScore > bestScore) {
      bestScore = adjustedScore;
      bestTarget = candidate;
    }
  });

  if (!bestTarget && bestForwardReceiver) {
    bestTarget = bestForwardReceiver;
  }

  return bestTarget;
}
