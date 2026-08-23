import type { Vec2, PlayerRole, PhaseOfPlay, TeamSide } from "../core/types";
import {
  FIELD_W,
  FIELD_D,
  LEFT_GOAL_X,
  RIGHT_GOAL_X,
  GOAL_MOUTH_HALF_Z,
  dist2,
  lerp2,
  clamp,
} from "../core/constants";

export type FormationAnchor = {
  role: PlayerRole;
  baseX: number;
  baseZ: number;
};

export const FORMATION_433: FormationAnchor[] = [
  { role: "GK", baseX: -0.42, baseZ: 0.00 },
  { role: "CB_L", baseX: -0.30, baseZ: -0.18 },
  { role: "CB_R", baseX: -0.30, baseZ: 0.18 },
  { role: "LB", baseX: -0.20, baseZ: -0.38 },
  { role: "RB", baseX: -0.20, baseZ: 0.38 },
  { role: "DM", baseX: -0.14, baseZ: 0.00 },
  { role: "CM_L", baseX: -0.04, baseZ: -0.22 },
  { role: "CM_R", baseX: -0.04, baseZ: 0.22 },
  { role: "LW", baseX: 0.22, baseZ: -0.36 },
  { role: "RW", baseX: 0.22, baseZ: 0.36 },
  { role: "ST", baseX: 0.32, baseZ: 0.00 },
  { role: "AM", baseX: 0.12, baseZ: 0.00 },
];

export const ROLE_ANCHOR_MAP: Record<PlayerRole, FormationAnchor> = (() => {
  const map = {} as Record<PlayerRole, FormationAnchor>;
  for (const a of FORMATION_433) {
    map[a.role] = a;
  }
  return map;
})();

export type FormationConfig = {
  anchors: FormationAnchor[];
  widthStretch: number;
  depthStretch: number;
  shiftFactor: number;
};

export function createDefaultFormationConfig(): FormationConfig {
  return {
    anchors: FORMATION_433,
    widthStretch: 1.0,
    depthStretch: 1.0,
    shiftFactor: 0.35,
  };
}

export function computeFormationPositions(
  config: FormationConfig,
  ballPos: Vec2,
  attackSign: number,
  phase: PhaseOfPlay,
  compactness: number,
  halfW: number,
  halfD: number,
): Map<PlayerRole, Vec2> {
  const positions = new Map<PlayerRole, Vec2>();

  const ballShiftNorm = (ballPos.x * attackSign) / halfW;
  const ballShiftClamped = clamp(ballShiftNorm, -0.45, 0.45);

  const depthStretch = phaseDepthStretch(phase) * config.depthStretch;
  const widthStretch = phaseWidthStretch(phase) * config.widthStretch;
  const shift = ballShiftClamped * config.shiftFactor;

  for (const anchor of config.anchors) {
    const roleX = anchor.baseX * depthStretch + shift;
    const roleZ = anchor.baseZ * widthStretch;
    const wideRole = anchor.role === "LW" || anchor.role === "RW" || anchor.role === "LB" || anchor.role === "RB";
    const midfieldEdgeRole = anchor.role === "CM_L" || anchor.role === "CM_R";

    let worldX = roleX * halfW;
    let worldZ = roleZ * halfD;

    if (anchor.role === "GK") {
      const goalX = attackSign > 0 ? LEFT_GOAL_X : RIGHT_GOAL_X;
      worldX = goalX + attackSign * 2.5;
      const gkShift = clamp(ballPos.z * 0.15, -GOAL_MOUTH_HALF_Z * 0.6, GOAL_MOUTH_HALF_Z * 0.6);
      worldZ = gkShift;
    }

    const compactNudge = (1 - compactness) * 3.0;
    if (anchor.role !== "GK") {
      worldZ = worldZ * (1 - compactness * 0.15);
      if (phase === "progression" || phase === "final_third" || phase === "counterattack") {
        if (wideRole) {
          const sign = Math.sign(anchor.baseZ || 0);
          const minWide = (anchor.role === "LW" || anchor.role === "RW") ? halfD * 0.34 : halfD * 0.28;
          worldZ = sign * Math.max(Math.abs(worldZ) * 1.18, minWide);
        } else if (midfieldEdgeRole) {
          worldZ = worldZ * 1.08;
        }
      }
      if (phase === "defensive_block" && (anchor.role === "CB_L" || anchor.role === "CB_R" || anchor.role === "DM")) {
        worldZ *= 0.82;
      }
    }

    positions.set(anchor.role, { x: worldX, z: worldZ });
  }

  return positions;
}

function phaseDepthStretch(phase: PhaseOfPlay): number {
  switch (phase) {
    case "defensive_block": return 0.75;
    case "counterpress": return 0.85;
    case "build_up": return 1.0;
    case "progression": return 1.1;
    case "final_third": return 1.2;
    case "counterattack": return 1.15;
    default: return 1.0;
  }
}

function phaseWidthStretch(phase: PhaseOfPlay): number {
  switch (phase) {
    case "defensive_block": return 0.8;
    case "counterpress": return 0.85;
    case "build_up": return 1.0;
    case "progression": return 1.05;
    case "final_third": return 1.1;
    case "counterattack": return 0.9;
    default: return 1.0;
  }
}

export function computePressLine(
  phase: PhaseOfPlay,
  ballPos: Vec2,
  attackSign: number,
  halfW: number,
): number {
  switch (phase) {
    case "defensive_block":
      return -halfW * 0.35 * attackSign;
    case "counterpress":
      return ballPos.x * 0.7;
    case "build_up":
      return -halfW * 0.1 * attackSign;
    case "progression":
      return halfW * 0.15 * attackSign;
    case "final_third":
      return halfW * 0.35 * attackSign;
    case "counterattack":
      return halfW * 0.1 * attackSign;
    default:
      return 0;
  }
}

export function getAnchorForRole(role: PlayerRole): FormationAnchor {
  return ROLE_ANCHOR_MAP[role];
}

export function isDefensiveRole(role: PlayerRole): boolean {
  return ["GK", "CB_L", "CB_R", "LB", "RB", "DM"].includes(role);
}

export function isAttackingRole(role: PlayerRole): boolean {
  return ["AM", "LW", "RW", "ST"].includes(role);
}

export function isMidfieldRole(role: PlayerRole): boolean {
  return ["CM_L", "CM_R"].includes(role);
}
