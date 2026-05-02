import * as THREE from 'three';

import { METRICA_DIRECTOR_TARGETS } from './possessionDirector.ts';

export type StructuredAttackType = 'WING_LEFT' | 'WING_RIGHT' | 'NONE';

export type StructuredAttackRole =
  | 'CARRIER'
  | 'NEAR_POST'
  | 'FAR_POST'
  | 'CUTBACK'
  | 'SECOND_WAVE'
  | 'WIDE_OUTLET'
  | 'SAFETY'
  | 'NONE';

export type StructuredAttackState = {
  type: StructuredAttackType;
  team: 'A' | 'B';
  attackSign: 1 | -1;
  carrierName: string;
  carrierSide: 1 | -1;
  roles: Map<string, StructuredAttackRole>;
};

export type StructuredAttackInputs = {
  team: 'A' | 'B';
  attackSign: 1 | -1;
  carrier: any | null;
  teammates: any[];
  fieldWidth: number;
  fieldDepth: number;
  penaltyDepth: number;
  goalMouthHalfWidth: number;
};

export type StructuredTargetInputs = {
  player: any;
  carrier: any;
  state: StructuredAttackState;
  fieldWidth: number;
  fieldDepth: number;
  penaltyDepth: number;
  goalMouthHalfWidth: number;
};

export type StructuredCarrierTargetInputs = {
  carrier: any;
  state: StructuredAttackState;
  fieldWidth: number;
  fieldDepth: number;
  penaltyDepth: number;
};

function roleOf(player: any): string {
  return (player?.displayRole || player?.role || '').toString().toUpperCase();
}

function keyOf(player: any): string {
  return String(player?.name || player?.id || '');
}

function isGoalkeeper(player: any): boolean {
  return roleOf(player) === 'GK';
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function metersToDepthUnits(meters: number, fieldDepth: number) {
  return (meters / 68) * fieldDepth;
}

function directorHalfWidthTarget(fieldDepth: number, phase: 'progression' | 'finalThird') {
  const widthMeters = METRICA_DIRECTOR_TARGETS.teamWidthMeters[phase];
  const halfWidth = metersToDepthUnits(widthMeters, fieldDepth) * 0.5;
  return clamp(halfWidth, fieldDepth * 0.32, fieldDepth * 0.49);
}

function directorSupportDistance(fieldDepth: number) {
  return clamp(
    metersToDepthUnits(METRICA_DIRECTOR_TARGETS.supportDistanceMeters.preferredMedian, fieldDepth),
    fieldDepth * 0.10,
    fieldDepth * 0.20,
  );
}

function findByRoles(players: any[], roles: string[], except = new Set<any>()) {
  return players.find((p) => !except.has(p) && roles.includes(roleOf(p))) || null;
}

function findWideBySide(players: any[], side: 1 | -1, except = new Set<any>()) {
  return players.find((p) => {
    if (except.has(p)) return false;
    const role = roleOf(p);
    if (!['LM', 'RM', 'LW', 'RW', 'LB', 'RB', 'LWB', 'RWB'].includes(role)) return false;
    const homeZ = Number(p?.homePos?.z ?? p?.pos?.z ?? 0);
    return Math.sign(homeZ || (role.includes('L') ? -1 : 1)) === side;
  }) || null;
}

export function selectStructuredAttack(inputs: StructuredAttackInputs): StructuredAttackState | null {
  const { team, attackSign, carrier, teammates, fieldWidth, fieldDepth } = inputs;
  if (!carrier || carrier.team !== team || isGoalkeeper(carrier)) return null;

  const carrierAttackX = carrier.pos.x * attackSign;
  const carrierAbsZ = Math.abs(carrier.pos.z);
  const carrierRole = roleOf(carrier);
  const isWideCarrier =
    carrierAbsZ > fieldDepth * 0.12
    || ['LM', 'RM', 'LW', 'RW', 'LB', 'RB', 'LWB', 'RWB'].includes(carrierRole);
  if (!isWideCarrier || carrierAttackX < -fieldWidth * 0.12) return null;

  const carrierSide = (Math.sign(carrier.pos.z || carrier.homePos?.z || 1) || 1) as 1 | -1;
  const outfield = teammates.filter((tm) => tm !== carrier && !isGoalkeeper(tm));
  const used = new Set<any>([carrier]);
  const roles = new Map<string, StructuredAttackRole>();
  roles.set(keyOf(carrier), 'CARRIER');

  const striker = findByRoles(outfield, ['ST', 'CF'], used);
  if (striker) {
    roles.set(keyOf(striker), 'NEAR_POST');
    used.add(striker);
  }

  const farWide = findWideBySide(outfield, -carrierSide as 1 | -1, used);
  if (farWide) {
    roles.set(keyOf(farWide), 'FAR_POST');
    used.add(farWide);
  }

  const cutback = findByRoles(outfield, ['CAM', 'CM'], used);
  if (cutback) {
    roles.set(keyOf(cutback), 'CUTBACK');
    used.add(cutback);
  }

  const secondWave = findByRoles(outfield, ['CM', 'CAM', 'DM'], used);
  if (secondWave) {
    roles.set(keyOf(secondWave), 'SECOND_WAVE');
    used.add(secondWave);
  }

  const sameWide = findWideBySide(outfield, carrierSide, used);
  if (sameWide) {
    roles.set(keyOf(sameWide), 'WIDE_OUTLET');
    used.add(sameWide);
  }

  for (const tm of outfield) {
    if (used.has(tm)) continue;
    if (['CB', 'LB', 'RB', 'DM'].includes(roleOf(tm))) roles.set(keyOf(tm), 'SAFETY');
  }

  const type: StructuredAttackType = carrierSide < 0 ? 'WING_LEFT' : 'WING_RIGHT';
  return { type, team, attackSign, carrierName: keyOf(carrier), carrierSide, roles };
}

export function getStructuredAttackRole(state: StructuredAttackState | null, player: any): StructuredAttackRole {
  if (!state || !player) return 'NONE';
  return state.roles.get(keyOf(player)) || 'NONE';
}

export function computeStructuredAttackTarget(inputs: StructuredTargetInputs): THREE.Vector3 | null {
  const { player, carrier, state, fieldWidth, fieldDepth, penaltyDepth, goalMouthHalfWidth } = inputs;
  const role = getStructuredAttackRole(state, player);
  if (role === 'NONE' || role === 'CARRIER') return null;

  const attackSign = state.attackSign;
  const goalX = attackSign > 0 ? fieldWidth / 2 : -fieldWidth / 2;
  const side = state.carrierSide;
  const y = 0.15;
  const finalThirdHalfWidth = directorHalfWidthTarget(fieldDepth, 'finalThird');
  const progressionHalfWidth = directorHalfWidthTarget(fieldDepth, 'progression');
  const supportDistance = directorSupportDistance(fieldDepth);
  let x = player.homePos?.x ?? player.pos.x;
  let z = player.homePos?.z ?? player.pos.z;

  if (role === 'NEAR_POST') {
    x = goalX - attackSign * 4.2;
    z = side * Math.max(goalMouthHalfWidth * 0.78, fieldDepth * 0.07);
  } else if (role === 'FAR_POST') {
    x = goalX - attackSign * 4.4;
    z = -side * Math.max(finalThirdHalfWidth * 1.08, goalMouthHalfWidth * 4.9, fieldDepth * 0.38);
  } else if (role === 'CUTBACK') {
    x = goalX - attackSign * (penaltyDepth + 0.2);
    z = side * clamp(finalThirdHalfWidth * 0.62, goalMouthHalfWidth * 3.2, fieldDepth * 0.32);
  } else if (role === 'SECOND_WAVE') {
    x = goalX - attackSign * (penaltyDepth + 1.4);
    z = -side * clamp(finalThirdHalfWidth * 0.58, goalMouthHalfWidth * 3.0, fieldDepth * 0.30);
  } else if (role === 'WIDE_OUTLET') {
    x = carrier.pos.x - attackSign * supportDistance;
    z = side * Math.max(Math.abs(player.homePos?.z ?? 0), progressionHalfWidth, fieldDepth * 0.46);
  } else if (role === 'SAFETY') {
    x = carrier.pos.x - attackSign * supportDistance * 1.75;
    z = clamp(player.homePos?.z ?? 0, -fieldDepth * 0.30, fieldDepth * 0.30);
  }

  return new THREE.Vector3(
    clamp(x, -fieldWidth / 2 + 1.5, fieldWidth / 2 - 1.5),
    y,
    clamp(z, -fieldDepth / 2 + 1.5, fieldDepth / 2 - 1.5),
  );
}

export function computeStructuredCarrierTarget(inputs: StructuredCarrierTargetInputs): THREE.Vector3 {
  const { carrier, state, fieldWidth, fieldDepth, penaltyDepth } = inputs;
  const goalX = state.attackSign > 0 ? fieldWidth / 2 : -fieldWidth / 2;
  const deliveryX = goalX - state.attackSign * (penaltyDepth + 17);
  const currentAttackX = carrier.pos.x * state.attackSign;
  const deliveryAttackX = deliveryX * state.attackSign;
  const targetX = currentAttackX < deliveryAttackX
    ? Math.min(deliveryAttackX, currentAttackX + 8) * state.attackSign
    : carrier.pos.x + state.attackSign * 3.5;
  const homeWide = Math.abs(carrier.homePos?.z ?? 0);
  const targetZ = state.carrierSide * Math.max(
    homeWide,
    Math.abs(carrier.pos.z),
    directorHalfWidthTarget(fieldDepth, 'progression'),
    fieldDepth * 0.46,
  );

  return new THREE.Vector3(
    clamp(targetX, -fieldWidth / 2 + 1.5, fieldWidth / 2 - 1.5),
    0.15,
    clamp(targetZ, -fieldDepth / 2 + 1.5, fieldDepth / 2 - 1.5),
  );
}

export function structuredAttackKey(state: StructuredAttackState | null): string {
  if (!state) return '';
  return `${state.team}:${state.type}:${state.carrierName}:${state.carrierSide}`;
}

export function shouldStructuredCarrierDeliver(inputs: {
  state: StructuredAttackState | null;
  carrier: any;
  fieldWidth: number;
  fieldDepth: number;
  penaltyDepth: number;
}): boolean {
  const { state, carrier, fieldWidth, fieldDepth, penaltyDepth } = inputs;
  if (!state || getStructuredAttackRole(state, carrier) !== 'CARRIER') return false;
  const goalX = state.attackSign > 0 ? fieldWidth / 2 : -fieldWidth / 2;
  const distToGoal = Math.abs(goalX - carrier.pos.x);
  return Math.abs(carrier.pos.z) > fieldDepth * 0.16
    && carrier.pos.x * state.attackSign > 0
    && distToGoal < penaltyDepth + 24;
}
