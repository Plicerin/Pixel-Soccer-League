import type {
  Vec2,
  TeamSide,
  PlayerRole,
  PhaseOfPlay,
  BallZone,
  GameMode,
  TeamIntent,
  RoleSlot,
  SupportLane,
  RestartMode,
  ScorePressure,
  TacticalBlackboard,
} from "../core/types";

export function createBlackboard(team: TeamSide): TacticalBlackboard {
  return {
    tick: 0,
    matchMinute: 0,
    scoreDiff: 0,
    scorePressure: "tied",
    phase: "transition",
    ballZone: "own_mid",
    pressLineY: 0,
    compactness: 0.5,
    gameMode: "normal",
    roleSlots: [],
    intent: { kind: "possess", widthPreference: 0.5 },
    supportLanes: [],
    setPieceId: null,
    setPiecePhase: null,
    restartMode: null,
    transitionAge: 99,
    transitionDirection: null,
  };
}

export function updateBlackboard(
  bb: TacticalBlackboard,
  updates: Partial<TacticalBlackboard>,
): TacticalBlackboard {
  return { ...bb, ...updates };
}

export function setPhase(bb: TacticalBlackboard, phase: PhaseOfPlay): TacticalBlackboard {
  return { ...bb, phase };
}

export function setBallZone(bb: TacticalBlackboard, ballZone: BallZone): TacticalBlackboard {
  return { ...bb, ballZone };
}

export function setTeamIntent(bb: TacticalBlackboard, intent: TeamIntent): TacticalBlackboard {
  return { ...bb, intent };
}

export function setRoleSlots(bb: TacticalBlackboard, roleSlots: RoleSlot[]): TacticalBlackboard {
  return { ...bb, roleSlots };
}

export function setSupportLanes(bb: TacticalBlackboard, supportLanes: SupportLane[]): TacticalBlackboard {
  return { ...bb, supportLanes };
}

export function setTransition(
  bb: TacticalBlackboard,
  age: number,
  direction: "won" | "lost" | null,
): TacticalBlackboard {
  return { ...bb, transitionAge: age, transitionDirection: direction };
}

export function setRestartMode(
  bb: TacticalBlackboard,
  restartMode: RestartMode | null,
): TacticalBlackboard {
  return { ...bb, restartMode };
}

export function setScorePressure(
  bb: TacticalBlackboard,
  scorePressure: ScorePressure,
): TacticalBlackboard {
  return { ...bb, scorePressure };
}

export function getRoleSlotForPlayer(
  bb: TacticalBlackboard,
  playerId: string,
): RoleSlot | null {
  return bb.roleSlots.find(s => s.playerId === playerId) ?? null;
}

export function getRoleSlotForRole(
  bb: TacticalBlackboard,
  role: PlayerRole,
): RoleSlot | null {
  return bb.roleSlots.find(s => s.role === role) ?? null;
}

export function advanceTransitionAge(bb: TacticalBlackboard, dt: number): TacticalBlackboard {
  if (bb.transitionDirection === null) return bb;
  const newAge = bb.transitionAge + dt;
  if (newAge > 5.0) {
    return { ...bb, transitionAge: newAge, transitionDirection: null };
  }
  return { ...bb, transitionAge: newAge };
}

export function markPossessionChange(
  bb: TacticalBlackboard,
  direction: "won" | "lost",
): TacticalBlackboard {
  return {
    ...bb,
    transitionAge: 0,
    transitionDirection: direction,
  };
}

export function computePressLineY(
  ballZone: BallZone,
  attackSign: number,
): number {
  switch (ballZone) {
    case "own_defensive": return -20 * attackSign;
    case "own_mid": return -8 * attackSign;
    case "opp_mid": return 5 * attackSign;
    case "opp_defensive": return 12 * attackSign;
    case "opp_attacking": return 18 * attackSign;
    default: return 0;
  }
}

export function computeCompactness(
  phase: PhaseOfPlay,
): number {
  switch (phase) {
    case "defensive_block": return 0.85;
    case "counterpress": return 0.75;
    case "build_up": return 0.55;
    case "progression": return 0.50;
    case "final_third": return 0.45;
    case "counterattack": return 0.35;
    default: return 0.50;
  }
}

export function isAttackingPhase(phase: PhaseOfPlay): boolean {
  return phase === "build_up" || phase === "progression" || phase === "final_third" || phase === "counterattack";
}

export function isDefendingPhase(phase: PhaseOfPlay): boolean {
  return phase === "defensive_block" || phase === "counterpress";
}

export function isTransitionPhase(phase: PhaseOfPlay): boolean {
  return phase === "transition" || phase === "counterpress" || phase === "counterattack";
}
