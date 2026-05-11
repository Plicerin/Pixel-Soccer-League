import * as THREE from 'three';
import { computeIdealTacticalPosition } from './tacticalPositioning.ts';
import { computeForceFieldNudge } from './forceFieldPositioning.ts';

export type AIPositioningParams = {
  role: string;
  playerPos: THREE.Vector3;
  homePos: THREE.Vector3;
  ballPos: THREE.Vector3;
  teammatePositions: THREE.Vector3[];
  opponentPositions: THREE.Vector3[];
  attackSign: 1 | -1;
  fieldWidth: number;
  fieldDepth: number;
  ballCarrierPos?: THREE.Vector3;
  ballCarrierRole?: string;
  isTeamInPossession?: boolean;
  hasPossession: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function computeAIPositioning(params: AIPositioningParams) {
  const tacticalIdeal = computeIdealTacticalPosition(params);
  const ffNudge = computeForceFieldNudge({
    role: params.role,
    playerPos: params.playerPos,
    homePos: params.homePos,
    ballPos: params.ballPos,
    teammatePositions: params.teammatePositions,
    opponentPositions: params.opponentPositions,
    attackSign: params.attackSign,
    hasPossession: params.hasPossession,
    fieldWidth: params.fieldWidth,
    fieldDepth: params.fieldDepth,
  });

  const combined = tacticalIdeal.clone().add(ffNudge);
  combined.x = clamp(combined.x, -params.fieldWidth / 2 + 1.5, params.fieldWidth / 2 - 1.5);
  combined.z = clamp(combined.z, -params.fieldDepth / 2 + 1.5, params.fieldDepth / 2 - 1.5);
  combined.y = 0.15;
  return combined;
}
