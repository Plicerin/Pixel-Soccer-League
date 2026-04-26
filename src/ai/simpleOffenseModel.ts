import * as THREE from 'three';

export type SimpleOffenseTeam = 'A' | 'B';

export type SimpleOffensePlayer = {
  team: SimpleOffenseTeam;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  homePos?: THREE.Vector3;
  role?: string;
  displayRole?: string;
  stats?: Record<string, number>;
  name?: string;
};

export type SimpleOffenseConstants = {
  fieldWidth: number;
  fieldDepth: number;
  goalMouthWidth: number;
  goalMouthHeight: number;
  penaltyDepth: number;
};

export type SimpleShotStyle =
  | 'LACES_DRIVE'
  | 'PLACED'
  | 'CHIP'
  | 'VOLLEY'
  | 'HALF_VOLLEY'
  | 'CURLED'
  | 'TOE_POKE'
  | 'HEADER';

export type SimplePassStyle =
  | 'SHORT'
  | 'DRIVEN'
  | 'OUTSIDE'
  | 'BACK'
  | 'DIAGONAL'
  | 'WALL'
  | 'LONG_LOFTED'
  | 'LONG_DRIVEN'
  | 'CHIP';

export type SimpleShotStyleContext = {
  crossWindow?: boolean;
  keeperOffLine?: boolean;
};

function getRoleLabel(player: SimpleOffensePlayer | null | undefined) {
  return (player?.displayRole || player?.role || '').toString().toUpperCase();
}

function getOpponents(players: SimpleOffensePlayer[], team: SimpleOffenseTeam) {
  return players.filter((player) => player.team !== team && getRoleLabel(player) !== 'GK');
}

export function getSimpleNearestOpponentDistance(
  point: THREE.Vector3,
  opponents: SimpleOffensePlayer[],
) {
  let best = Infinity;
  for (const opp of opponents) {
    const dist = opp.pos.distanceTo(point);
    if (dist < best) best = dist;
  }
  return Number.isFinite(best) ? best : 99;
}

export function getSimpleLaneTraffic(
  from: THREE.Vector3,
  to: THREE.Vector3,
  opponents: SimpleOffensePlayer[],
  laneWidth: number = 2.5,
) {
  return getSimpleLaneBlockerProfile(from, to, opponents, laneWidth).traffic;
}

function getSimpleLaneBlockerProfile(
  from: THREE.Vector3,
  to: THREE.Vector3,
  opponents: SimpleOffensePlayer[],
  laneWidth: number = 2.5,
) {
  const laneX = to.x - from.x;
  const laneZ = to.z - from.z;
  const laneLenSq = laneX * laneX + laneZ * laneZ;
  if (laneLenSq < 0.01) {
    return {
      traffic: 0,
      frontBlockerLateral: 99,
      frontBlockerT: 1,
      frontBlockerCount: 0,
    };
  }

  let traffic = 0;
  let frontBlockerLateral = Infinity;
  let frontBlockerT = 1;
  let frontBlockerCount = 0;
  for (const opp of opponents) {
    const relX = opp.pos.x - from.x;
    const relZ = opp.pos.z - from.z;
    const t = THREE.MathUtils.clamp((relX * laneX + relZ * laneZ) / laneLenSq, 0, 1);
    if (t <= 0.06 || t >= 0.94) continue;

    const closestX = from.x + laneX * t;
    const closestZ = from.z + laneZ * t;
    const dx = opp.pos.x - closestX;
    const dz = opp.pos.z - closestZ;
    const lateral = Math.sqrt(dx * dx + dz * dz);
    if (lateral < laneWidth) {
      traffic += lateral < laneWidth * 0.5 ? 1.0 : 0.55;
    }
    if (t > 0.14 && t < 0.84 && lateral < laneWidth * 0.72) {
      frontBlockerCount += 1;
    }
    if (t > 0.14 && t < 0.84 && lateral < frontBlockerLateral) {
      frontBlockerLateral = lateral;
      frontBlockerT = t;
    }
  }

  return {
    traffic,
    frontBlockerLateral: Number.isFinite(frontBlockerLateral) ? frontBlockerLateral : 99,
    frontBlockerT,
    frontBlockerCount,
  };
}

export function getSimpleOffsideLine(
  carrier: SimpleOffensePlayer,
  opponents: SimpleOffensePlayer[],
  attackSign: 1 | -1,
) {
  const defenders = opponents
    .slice()
    .sort((a, b) => (attackSign > 0 ? b.pos.x - a.pos.x : a.pos.x - b.pos.x));
  const secondLast = defenders[Math.min(1, defenders.length - 1)];
  if (!secondLast) return carrier.pos.x;
  return attackSign > 0
    ? Math.max(secondLast.pos.x, carrier.pos.x)
    : Math.min(secondLast.pos.x, carrier.pos.x);
}

export function isSimpleOffsideTarget(
  carrier: SimpleOffensePlayer,
  target: SimpleOffensePlayer,
  opponents: SimpleOffensePlayer[],
  attackSign: 1 | -1,
) {
  if ((target.pos.x - carrier.pos.x) * attackSign <= 0) return false;
  const offsideLine = getSimpleOffsideLine(carrier, opponents, attackSign);
  return (target.pos.x - offsideLine) * attackSign > 0.35;
}

export function chooseSimplePassTarget(
  carrier: SimpleOffensePlayer,
  teammates: SimpleOffensePlayer[],
  allPlayers: SimpleOffensePlayer[],
  team: SimpleOffenseTeam,
  attackSign: 1 | -1,
) {
  if (!carrier || teammates.length === 0) return null;

  const opponents = getOpponents(allPlayers, team);
  const carrierRole = getRoleLabel(carrier);
  const carrierPressure = opponents.filter((opp) => opp.pos.distanceTo(carrier.pos) < 5.5).length;
  const isAttackingCarrier = ['ST', 'CF', 'CAM', 'LM', 'RM'].includes(carrierRole);
  const isBuildoutCarrier = ['CB', 'LB', 'RB', 'DM'].includes(carrierRole);
  const inFinalThird = carrier.pos.x * attackSign > 14;
  const nearBox = carrier.pos.x * attackSign > 20;
  const wideCarrierInCutbackZone = inFinalThird && Math.abs(carrier.pos.z) > 8.5;
  let bestTarget: SimpleOffensePlayer | null = null;
  let bestScore = -Infinity;

  for (const teammate of teammates) {
    if (!teammate || teammate === carrier || teammate.team !== team || getRoleLabel(teammate) === 'GK') continue;

    const dist = carrier.pos.distanceTo(teammate.pos);
    if (dist < 2.0 || dist > 34) continue;

    const progress = (teammate.pos.x - carrier.pos.x) * attackSign;
    const tmRoleEarly = getRoleLabel(teammate);
    const isArrivingMid = ['CM', 'CAM', 'DM'].includes(tmRoleEarly);
    const isMeaningfulBackpass = progress < -2.0;
    const isLargeBackpass = progress < -5.0;
    if (progress < -10 && carrierPressure < 5) continue;
    // isLargeBackpass veto: exempt central midfielders up to -8 (cutback lay-off targets)
    if (isAttackingCarrier && isLargeBackpass && carrierPressure < 4 && !(isArrivingMid && progress > -8.0)) continue;
    if (inFinalThird && isAttackingCarrier && progress < 0.25 && carrierPressure < 3) {
      const tmWideSep = Math.abs(teammate.pos.z - carrier.pos.z);
      const isCutbackTarget = ['ST', 'CF', 'CAM', 'CM', 'DM'].includes(tmRoleEarly) && progress > -8.0;
      const isLateralSwitch = tmWideSep >= 5.5 && progress > -2.0;
      if (!isCutbackTarget && !isLateralSwitch) continue;
    }
    if (nearBox && isAttackingCarrier && progress < 0.75 && carrierPressure < 4) {
      const tmWideSep = Math.abs(teammate.pos.z - carrier.pos.z);
      const isCutbackTarget = isArrivingMid && progress > -8.0;
      if (tmWideSep < 5.0 && !isCutbackTarget) continue;
    }
    if (inFinalThird && isAttackingCarrier && isMeaningfulBackpass && carrierPressure < 5) {
      // Allow lay-offs to arriving midfielders up to -8 back (extended from -5)
      if (!isArrivingMid || progress < -8.0) continue;
    }
    // Non-buildout deep retreat veto: exempt central midfielders up to -8
    if (!isBuildoutCarrier && progress < -7 && carrierPressure < 5 && !(isArrivingMid && progress > -8.0)) continue;

    const laneProfile = getSimpleLaneBlockerProfile(carrier.pos, teammate.pos, opponents, dist > 16 ? 2.8 : 2.3);
    const laneTraffic = laneProfile.traffic;
    const nearestOpp = getSimpleNearestOpponentDistance(teammate.pos, opponents);
    const directLaneBlocker =
      laneProfile.frontBlockerLateral < (dist > 14 ? 1.35 : 1.15)
      && laneProfile.frontBlockerT > 0.14
      && laneProfile.frontBlockerT < 0.84;
    const wideSeparation = Math.abs(teammate.pos.z - carrier.pos.z);
    const roleLabel = getRoleLabel(teammate);
    const teammateCentrality = Math.abs(teammate.pos.z);
    const teammateIsCentralCutback =
      wideCarrierInCutbackZone
      && ['ST', 'CF', 'CAM', 'CM'].includes(roleLabel)
      && teammateCentrality < 6.8
      && progress > -2.5
      && progress < 7.0;
    const offside = isSimpleOffsideTarget(carrier, teammate, opponents, attackSign);

    if (offside && progress > 1.5) continue;
    if (directLaneBlocker) continue;

    const roleBonus =
      roleLabel === 'ST' || roleLabel === 'CF' ? (progress > 2 ? 2.6 : 0.6) :
      roleLabel === 'CAM' || roleLabel === 'CM' ? 1.9 :
      roleLabel === 'LM' || roleLabel === 'RM' ? 1.5 :
      roleLabel === 'DM' ? 1.2 :
      0.7;

    let score = 0;
    score += Math.min(progress, 14) * 1.35;
    score += Math.max(nearestOpp - 1.5, 0) * 1.2;
    score += Math.min(wideSeparation, 12) * 0.08;
    score += roleBonus;
    score -= Math.abs(dist - (carrierPressure >= 2 ? 8 : 11)) * 0.16;
    score -= laneTraffic * 3.8;
    score -= Math.max(0, 1.7 - laneProfile.frontBlockerLateral) * 5.4;
    score -= laneProfile.frontBlockerCount * 2.2;

    if (progress > 2) score += 2.4;
    if (progress > 5) score += 2.8;
    if (inFinalThird && progress > 1.5) score += 3.2;
    if (teammateIsCentralCutback) score += 5.2;
    if (teammateIsCentralCutback && nearestOpp > 3.0) score += 2.0;
    if (wideCarrierInCutbackZone && teammateCentrality > Math.abs(carrier.pos.z) - 1.5) score -= 2.8;
    if (carrierPressure >= 4 && progress < 0) score += 0.8;
    if (carrierPressure >= 4) {
      score += Math.max(nearestOpp - 3.0, 0) * 1.4;
      if (progress > 3.0) score -= Math.min(progress, 9) * 0.8;
      if (laneTraffic > 0.9 && progress > 1.0) score -= 2.6;
    }
    if (!inFinalThird && carrierPressure >= 4 && progress < 0 && nearestOpp > 4.2) {
      score += isBuildoutCarrier ? 8.0 : 5.0;
    }
    if (!inFinalThird && carrierPressure >= 5 && progress < -1.0 && nearestOpp > 4.8) {
      score += 4.5;
    }
    if (nearestOpp < 1.8) score -= 4.0;
    if (laneTraffic > 2.6) score -= 2.8;
    if (laneProfile.frontBlockerLateral < 1.45) score -= 4.8;
    if (progress < 0) score -= Math.abs(progress) * (isAttackingCarrier ? 2.8 : 1.45);
    if (isAttackingCarrier && progress < -1) score -= 5.5;
    if (inFinalThird && isAttackingCarrier && progress < 0) score -= 7.5;
    if (!isBuildoutCarrier && progress < -3) score -= 4.2;

    if (score > bestScore) {
      bestScore = score;
      bestTarget = teammate;
    }
  }

  if (bestTarget) return bestTarget;

  // Only skip the fallback for pure finishers (ST/CF) under very low pressure —
  // midfielders and wide roles should always get a pass option so passChance > 0.
  const isPrimaryFinisher = ['ST', 'CF'].includes(carrierRole);
  if (isPrimaryFinisher && carrierPressure < 2) return null;

  return teammates
    .filter((teammate) => teammate && teammate !== carrier && teammate.team === team && getRoleLabel(teammate) !== 'GK')
    .sort((a, b) => {
      const aProgress = (a.pos.x - carrier.pos.x) * attackSign;
      const bProgress = (b.pos.x - carrier.pos.x) * attackSign;
      if (Math.abs(aProgress - bProgress) > 0.2) return bProgress - aProgress;
      return getSimpleNearestOpponentDistance(b.pos, opponents) - getSimpleNearestOpponentDistance(a.pos, opponents);
    })[0] || null;
}

export function getSimplePassTargetPoint(
  passer: SimpleOffensePlayer,
  target: SimpleOffensePlayer,
  style: SimplePassStyle,
  constants: SimpleOffenseConstants,
) {
  const dist = passer.pos.distanceTo(target.pos);
  const receiverSpeed = Math.hypot(target.vel.x, target.vel.z);
  let leadTime = dist < 8 ? 0.05 : dist < 16 ? 0.10 : 0.16;
  if (style === 'DRIVEN' || style === 'LONG_DRIVEN') leadTime *= 0.72;
  else if (style === 'BACK' || style === 'WALL') leadTime *= 0.55;
  else if (style === 'CHIP' || style === 'LONG_LOFTED') leadTime *= 1.15;
  if (receiverSpeed > 1.2) leadTime += Math.min(receiverSpeed, 8) * 0.012;

  const point = target.pos.clone().addScaledVector(target.vel.clone().setY(0), leadTime);
  point.x = THREE.MathUtils.clamp(point.x, -constants.fieldWidth / 2 + 1.0, constants.fieldWidth / 2 - 1.0);
  point.z = THREE.MathUtils.clamp(point.z, -constants.fieldDepth / 2 + 1.0, constants.fieldDepth / 2 - 1.0);
  point.y = 0.15;
  return point;
}

export function chooseSimpleShotStyle(
  shooter: SimpleOffensePlayer,
  closePressure: number,
  distToGoal: number,
  inShootingLane: boolean,
  inTapInZone: boolean,
  context: SimpleShotStyleContext = {},
): SimpleShotStyle {
  const wideAngle = Math.abs(shooter?.pos?.z || 0) > 3.1;
  const crossWindow = !!context.crossWindow;
  const keeperOffLine = !!context.keeperOffLine;

  if (crossWindow && distToGoal < 15) {
    return inTapInZone ? 'VOLLEY' : 'HEADER';
  }
  if (keeperOffLine && distToGoal < 18 && closePressure <= 2) {
    return 'CHIP';
  }
  if (inTapInZone && closePressure >= 2 && distToGoal < 4.8) {
    return 'TOE_POKE';
  }
  if (inTapInZone) {
    return 'PLACED';
  }
  if (wideAngle && distToGoal <= 18) {
    return 'CURLED';
  }
  if (wideAngle && distToGoal < 22) {
    return 'LACES_DRIVE';
  }
  if (distToGoal > 22) {
    return inShootingLane ? 'LACES_DRIVE' : 'CURLED';
  }
  if (closePressure >= 3) {
    return distToGoal < 10 ? 'TOE_POKE' : 'LACES_DRIVE';
  }
  if (inShootingLane && distToGoal < 13) {
    return 'PLACED';
  }
  if (inShootingLane && distToGoal < 18) {
    return 'LACES_DRIVE';
  }
  return inShootingLane ? 'LACES_DRIVE' : 'CURLED';
}

export function getSimpleShotStyleParams(
  style: SimpleShotStyle,
  attackSign: 1 | -1,
  shooterZ: number,
) {
  const curlSide = shooterZ >= 0 ? -1 : 1;
  switch (style) {
    case 'LACES_DRIVE':
      return { label: 'LACES DRIVE', releaseY: 0.21, baseSpeed: 25.8, liftMin: 1.7, liftMax: 4.2, aimScale: 0.86, spin: new THREE.Vector3(-attackSign * 3.6, 0, 0) };
    case 'PLACED':
      return { label: 'PLACED SHOT', releaseY: 0.22, baseSpeed: 21.4, liftMin: 2.5, liftMax: 5.3, aimScale: 0.48, spin: new THREE.Vector3(0, curlSide * 2.6, 0) };
    case 'CHIP':
      return { label: 'CHIPPED SHOT', releaseY: 0.27, baseSpeed: 17.8, liftMin: 4.9, liftMax: 8.8, aimScale: 0.64, spin: new THREE.Vector3(attackSign * 4.4, 0, 0) };
    case 'VOLLEY':
      return { label: 'VOLLEY', releaseY: 0.36, baseSpeed: 24.3, liftMin: 3.0, liftMax: 6.2, aimScale: 0.78, spin: new THREE.Vector3(-attackSign * 4.2, curlSide * 1.2, 0) };
    case 'HALF_VOLLEY':
      return { label: 'HALF-VOLLEY', releaseY: 0.20, baseSpeed: 23.1, liftMin: 2.1, liftMax: 5.0, aimScale: 0.82, spin: new THREE.Vector3(-attackSign * 3.8, curlSide * 0.8, 0) };
    case 'CURLED':
      return { label: 'CURLED SHOT', releaseY: 0.24, baseSpeed: 22.2, liftMin: 2.7, liftMax: 5.4, aimScale: 0.58, spin: new THREE.Vector3(0, curlSide * 6.4, 0) };
    case 'TOE_POKE':
      return { label: 'TOE POKE', releaseY: 0.19, baseSpeed: 22.8, liftMin: 1.4, liftMax: 3.4, aimScale: 0.92, spin: new THREE.Vector3(0, 0, 0) };
    case 'HEADER':
    default:
      return { label: 'HEADER', releaseY: 0.90, baseSpeed: 18.2, liftMin: 2.0, liftMax: 4.6, aimScale: 0.52, spin: new THREE.Vector3(0, 0, 0) };
  }
}

export function getSimpleShotTargetPoint(
  shooter: SimpleOffensePlayer,
  goalX: number,
  shotStyle: SimpleShotStyle,
  distToGoal: number,
  constants: Pick<SimpleOffenseConstants, 'goalMouthWidth' | 'goalMouthHeight'>,
  keeperZ: number | null,
  humanAimZ?: number,
  humanAimY?: number,
  context?: {
    shotSelectionType?: 'selected_shot' | 'forced_shot' | null;
    forceShotNow?: boolean;
    closePressure?: number;
    shotAngle?: number;
  },
) {
  if (humanAimZ !== undefined && humanAimY !== undefined) {
    return new THREE.Vector3(
      goalX,
      THREE.MathUtils.clamp(humanAimY, 0.2, constants.goalMouthHeight * 0.96),
      THREE.MathUtils.clamp(humanAimZ, -constants.goalMouthWidth * 0.48, constants.goalMouthWidth * 0.48),
    );
  }

  const forcedShot = context?.forceShotNow === true || context?.shotSelectionType === 'forced_shot';
  const closePressure = context?.closePressure ?? 0;
  const shotAngle = context?.shotAngle ?? Math.abs(Math.atan2(Math.abs(shooter.pos.z), Math.max(0.5, distToGoal)));
  const longRangeFactor = THREE.MathUtils.clamp((distToGoal - 16) / 18, 0, 1);
  const pressureFactor = THREE.MathUtils.clamp((closePressure - 1) / 4, 0, 1);
  const forcedFactor = forcedShot ? 1 : 0;
  const angleFactor = THREE.MathUtils.clamp((shotAngle - 0.18) / 0.7, 0, 1);
  const centralSightFactor = THREE.MathUtils.clamp(1 - shotAngle / 0.38, 0, 1);
  const farPostSign = keeperZ !== null ? (keeperZ >= 0 ? -1 : 1) : (shooter.pos.z >= 0 ? -1 : 1);
  const wideAngleFactor = THREE.MathUtils.clamp(
    Math.abs(shooter.pos.z) / Math.max(constants.goalMouthWidth * 1.9, 1),
    0,
    1,
  );
  let lateralBias =
    shotStyle === 'CURLED' ? 0.40 :
    shotStyle === 'PLACED' ? 0.34 :
    shotStyle === 'CHIP' ? 0.24 :
    shotStyle === 'TOE_POKE' ? 0.16 :
    shotStyle === 'HEADER' ? 0.14 :
    0.20;
  if (distToGoal > 20) lateralBias *= shotStyle === 'PLACED' ? 0.58 : 0.66;
  lateralBias *= 1 + longRangeFactor * 0.30 + forcedFactor * 0.24;
  if (wideAngleFactor > 0) {
    lateralBias *= THREE.MathUtils.lerp(1, distToGoal < 14 ? 0.82 : 0.64, wideAngleFactor);
  }

  const bodyBias = THREE.MathUtils.clamp((-shooter.pos.z / Math.max(constants.goalMouthWidth * 2, 1)) * 0.12, -0.12, 0.12);
  const baseLateralClamp =
    wideAngleFactor > 0.55 && distToGoal > 14
      ? constants.goalMouthWidth * 0.34
      : distToGoal > 18
        ? constants.goalMouthWidth * 0.40
        : constants.goalMouthWidth * 0.46;
  const lateralClamp = baseLateralClamp
    + constants.goalMouthWidth
    * (0.03 + longRangeFactor * 0.08 + forcedFactor * 0.06 + pressureFactor * 0.03 + angleFactor * 0.02);
  const lateralNoise =
    (Math.random() * 2 - 1)
    * constants.goalMouthWidth
    * (
      0.025
      + longRangeFactor * 0.13
      + forcedFactor * 0.085
      + longRangeFactor * forcedFactor * 0.08
      + pressureFactor * 0.045
      + angleFactor * 0.035
      + (shotStyle === 'LACES_DRIVE' && distToGoal > 18 ? 0.045 : 0)
      + (shotStyle === 'PLACED' && distToGoal > 18 ? 0.03 : 0)
    );
  const baseTargetZ = (farPostSign * lateralBias + bodyBias) * constants.goalMouthWidth;
  const bailoutBias = forcedShot ? farPostSign * constants.goalMouthWidth * 0.025 : 0;
  const targetZ = THREE.MathUtils.clamp(baseTargetZ + bailoutBias + lateralNoise, -lateralClamp, lateralClamp);
  let targetY =
    shotStyle === 'CHIP' ? THREE.MathUtils.clamp(1.8 + distToGoal * 0.03, 1.8, 2.8) :
    shotStyle === 'HEADER' ? THREE.MathUtils.clamp(1.0 + distToGoal * 0.02, 1.0, 2.0) :
    shotStyle === 'PLACED' || shotStyle === 'CURLED'
      ? THREE.MathUtils.clamp(0.64 + distToGoal * (wideAngleFactor > 0.45 ? 0.013 : 0.017), 0.64, 1.55) :
    shotStyle === 'VOLLEY' ? THREE.MathUtils.clamp(0.9 + distToGoal * 0.02, 0.9, 1.8) :
    THREE.MathUtils.clamp(0.35 + distToGoal * 0.015, 0.35, 1.25);
  const heightNoise =
    (Math.random() * 2 - 1)
    * (0.04 + longRangeFactor * 0.20 + forcedFactor * 0.13 + longRangeFactor * forcedFactor * 0.08 + pressureFactor * 0.07);
  const targetYMax = constants.goalMouthHeight * (1 + longRangeFactor * 0.10 + forcedFactor * 0.06);
  targetY = THREE.MathUtils.clamp(targetY + heightNoise, 0.18, targetYMax);

  const offFrameChance = THREE.MathUtils.clamp(
    longRangeFactor * 0.38
    + forcedFactor * 0.22
    + longRangeFactor * forcedFactor * 0.16
    + pressureFactor * 0.11
    + centralSightFactor * Math.max(longRangeFactor - 0.05, 0) * 0.32
    + ((shotStyle === 'TOE_POKE' || shotStyle === 'HALF_VOLLEY') ? 0.12 : 0)
    + (shotStyle === 'LACES_DRIVE' ? 0.16 : 0)
    + (shotStyle === 'PLACED' && distToGoal > 18 ? 0.18 : 0),
    0,
    0.88,
  );
  if (distToGoal > 12 && Math.random() < offFrameChance) {
    const missHigh =
      Math.random()
      < (0.34 + longRangeFactor * 0.22 + (shotStyle === 'HALF_VOLLEY' || shotStyle === 'LACES_DRIVE' ? 0.10 : 0));
    if (missHigh) {
      targetY = constants.goalMouthHeight * (1.03 + longRangeFactor * 0.18 + pressureFactor * 0.08);
    } else {
      const missSign = Math.sign(targetZ || farPostSign) || farPostSign;
      targetY = THREE.MathUtils.clamp(targetY + (Math.random() * 2 - 1) * 0.12, 0.18, constants.goalMouthHeight * 1.06);
      return new THREE.Vector3(
        goalX,
        targetY,
        missSign * constants.goalMouthWidth * (0.62 + longRangeFactor * 0.22 + forcedFactor * 0.10),
      );
    }
  }

  return new THREE.Vector3(goalX, targetY, targetZ);
}

export function computeSimpleCarrierHoldTarget(
  carrier: SimpleOffensePlayer,
  attackSign: 1 | -1,
  constants: Pick<SimpleOffenseConstants, 'fieldWidth' | 'fieldDepth' | 'penaltyDepth'>,
) {
  const goalX = attackSign > 0 ? constants.fieldWidth / 2 : -constants.fieldWidth / 2;
  const distToGoal = Math.abs(goalX - carrier.pos.x);
  const forwardStep = distToGoal < constants.penaltyDepth + 6
    ? 3.2
    : distToGoal < constants.fieldWidth * 0.35
      ? 5.2
      : 7.0;
  const targetX = carrier.pos.x + attackSign * forwardStep;
  const targetZ = Math.abs(carrier.pos.z) > constants.fieldDepth * 0.30
    ? carrier.pos.z * 0.78
    : carrier.pos.z * 0.40;

  return new THREE.Vector3(
    THREE.MathUtils.clamp(targetX, -constants.fieldWidth / 2 + 1.5, constants.fieldWidth / 2 - 1.5),
    0.15,
    THREE.MathUtils.clamp(targetZ, -constants.fieldDepth / 2 + 2, constants.fieldDepth / 2 - 2),
  );
}
