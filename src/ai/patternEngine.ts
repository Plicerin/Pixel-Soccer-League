/**
 * Pattern Engine — Phase 2.5
 *
 * Gives the AI team-level attacking intent as a first-class concept.
 * Each team has a current active pattern with role assignments per player.
 * Players consult their role when computing position targets and carrier decisions.
 *
 * Pattern = named coordinated multi-player intent with expected duration and role map.
 * Without this, the AI is stateless per frame and produces "one play: run and shoot".
 *
 * This module is pure data + pure functions. Wiring lives in gameEngine.ts.
 */

import * as THREE from 'three';

export type AttackPatternType =
  | 'PATIENT_BUILDUP'
  | 'COUNTER_ATTACK'
  | 'WING_ATTACK_LEFT'
  | 'WING_ATTACK_RIGHT'
  | 'CENTRAL_COMBO'
  | 'SWITCH_OF_PLAY'
  | 'NEUTRAL';

export type PatternRole =
  | 'CARRIER'           // player on the ball, drives the pattern
  | 'RUNNER'            // makes a run off the ball (into space)
  | 'NEAR_POST_RUNNER'  // crashes the near post on wing attacks
  | 'FAR_POST_RUNNER'   // holds far post on wing attacks
  | 'CUTBACK_RECEIVER'  // arrives at penalty-spot area for cutback
  | 'WALL'              // receives + immediately returns (1-2)
  | 'OUTLET'            // safe sideways/backward option to retain possession
  | 'ANCHOR'            // holds defensive shape (DM during attack)
  | 'DECOY'             // pulls a defender out of position
  | 'SUPPORT'           // general under-the-ball support
  | 'DEFENDER'          // normal defensive role (not part of pattern)
  | 'NONE';

export type PatternRoleAssignment = {
  playerName: string;
  role: PatternRole;
};

export type TeamPatternState = {
  type: AttackPatternType;
  startedAt: number;     // match elapsed seconds
  expiresAt: number;     // latest elapsed second at which this pattern auto-ends
  side: 'A' | 'B';
  roles: Map<string, PatternRole>;  // keyed by player.name or unique id
  initiatorName: string | null;     // the player who started the pattern (usually carrier at start)
  metadata: Record<string, unknown>;
};

export type PatternInputs = {
  elapsedSeconds: number;
  team: 'A' | 'B';
  attackSign: 1 | -1;
  carrier: any | null;
  teammates: any[];   // all teammates including GK
  opponents: any[];
  ball: THREE.Vector3;
  fieldWidth: number;
  fieldDepth: number;
  justRecoveredPossession: boolean;   // true if possession changed hands within last ~2s
  secondsSinceRecovery: number;
};

const DEFAULT_DURATION_SECONDS: Record<AttackPatternType, number> = {
  PATIENT_BUILDUP: 6,
  COUNTER_ATTACK: 5,
  WING_ATTACK_LEFT: 5,
  WING_ATTACK_RIGHT: 5,
  CENTRAL_COMBO: 4,
  SWITCH_OF_PLAY: 3,
  NEUTRAL: 1,
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function roleLabelOf(player: any): string {
  return (player?.displayRole || player?.role || '').toString().toUpperCase();
}

function isGK(player: any): boolean {
  return roleLabelOf(player) === 'GK';
}

function attackProgressX(player: any, attackSign: 1 | -1): number {
  return (player?.pos?.x ?? 0) * attackSign;
}

function distToOppGoal(player: any, attackSign: 1 | -1, fieldWidth: number): number {
  const goalX = attackSign > 0 ? fieldWidth / 2 : -fieldWidth / 2;
  return Math.abs(goalX - (player?.pos?.x ?? 0));
}

function getOppLastDefenderAttackX(opponents: any[], attackSign: 1 | -1): number {
  let maxAttackX = -Infinity;
  for (const opp of opponents) {
    if (isGK(opp)) continue;
    const ax = attackProgressX(opp, attackSign);
    if (ax > maxAttackX) maxAttackX = ax;
  }
  return maxAttackX;
}

function findPlayerByRole(teammates: any[], role: string): any | null {
  for (const tm of teammates) {
    if (roleLabelOf(tm) === role) return tm;
  }
  return null;
}

function findAllByRole(teammates: any[], roles: string[]): any[] {
  return teammates.filter((tm) => roles.includes(roleLabelOf(tm)));
}

function nameKey(player: any): string {
  return player?.name || player?.displayRole || player?.role || 'unknown';
}

// ── Pattern precondition checks + role assignments ──────────────────────────

function tryCounterAttack(inputs: PatternInputs): TeamPatternState | null {
  const { carrier, teammates, opponents, attackSign, justRecoveredPossession, elapsedSeconds, team } = inputs;
  if (!carrier || !justRecoveredPossession) return null;
  // Precondition: at least 2 teammates ahead of opp midfield line (or ball is in own half).
  const carrierAttackX = attackProgressX(carrier, attackSign);
  const teammatesAheadOfCarrier = teammates.filter((tm) => {
    if (tm === carrier || isGK(tm)) return false;
    return attackProgressX(tm, attackSign) > carrierAttackX + 3;
  });
  if (teammatesAheadOfCarrier.length < 2) return null;

  const roles = new Map<string, PatternRole>();
  roles.set(nameKey(carrier), 'CARRIER');

  // Assign RUNNER to the 2 most advanced attackers (ST + whichever winger is further forward)
  const sorted = teammatesAheadOfCarrier.slice().sort((a, b) => attackProgressX(b, attackSign) - attackProgressX(a, attackSign));
  const runners = sorted.slice(0, 2);
  for (const r of runners) roles.set(nameKey(r), 'RUNNER');
  // Any remaining attackers become SUPPORT
  for (const tm of teammatesAheadOfCarrier) {
    if (!roles.has(nameKey(tm))) roles.set(nameKey(tm), 'SUPPORT');
  }
  // Defenders behind ball: ANCHOR role (hold line, don't overcommit)
  for (const tm of teammates) {
    if (roles.has(nameKey(tm))) continue;
    if (isGK(tm)) continue;
    const label = roleLabelOf(tm);
    if (['CB', 'LB', 'RB', 'DM'].includes(label)) roles.set(nameKey(tm), 'ANCHOR');
  }

  return {
    type: 'COUNTER_ATTACK',
    startedAt: elapsedSeconds,
    expiresAt: elapsedSeconds + DEFAULT_DURATION_SECONDS.COUNTER_ATTACK,
    side: team,
    roles,
    initiatorName: nameKey(carrier),
    metadata: { opponentsCount: opponents.length },
  };
}

function tryWingAttack(inputs: PatternInputs): TeamPatternState | null {
  const { carrier, teammates, attackSign, elapsedSeconds, team, fieldDepth, fieldWidth } = inputs;
  if (!carrier) return null;
  const carrierAttackX = attackProgressX(carrier, attackSign);
  // Precondition: ball has crossed into opp half, carrier or a winger is on a flank.
  if (carrierAttackX <= 0) return null;

  const carrierZ = carrier.pos.z;
  const carrierRole = roleLabelOf(carrier);
  const carrierOnFlank = Math.abs(carrierZ) > fieldDepth * 0.18;

  // Prefer pattern when a winger is available as flank carrier or target.
  const lm = findPlayerByRole(teammates, 'LM');
  const rm = findPlayerByRole(teammates, 'RM');
  const st = findPlayerByRole(teammates, 'ST') || findPlayerByRole(teammates, 'CF');
  const cams = findAllByRole(teammates, ['CAM', 'CM']);
  if (!st) return null; // need a striker to run near-post

  const side: 'LEFT' | 'RIGHT' = carrierZ < 0 ? 'LEFT' : 'RIGHT';
  const type: AttackPatternType = side === 'LEFT' ? 'WING_ATTACK_LEFT' : 'WING_ATTACK_RIGHT';
  const wingCarrier = side === 'LEFT' ? lm : rm;
  const oppositeWinger = side === 'LEFT' ? rm : lm;

  // Only trigger this pattern if the flank winger has the ball OR is close enough
  // to become the carrier soon (within ~12 units of ball).
  const wingCarrierIsCarrier = wingCarrier === carrier;
  const wingCarrierNearBall = wingCarrier && wingCarrier.pos.distanceTo(carrier.pos) < 14;
  if (!carrierOnFlank && !wingCarrierIsCarrier && !wingCarrierNearBall) return null;

  const roles = new Map<string, PatternRole>();
  // Only one CARRIER: the player actually holding the ball. If another winger could be
  // the flank carrier but isn't, tag them RUNNER so they advance to support position.
  roles.set(nameKey(carrier), 'CARRIER');
  if (wingCarrier && wingCarrier !== carrier) roles.set(nameKey(wingCarrier), 'RUNNER');
  roles.set(nameKey(st), 'NEAR_POST_RUNNER');
  if (oppositeWinger && oppositeWinger !== carrier && oppositeWinger !== wingCarrier) {
    roles.set(nameKey(oppositeWinger), 'FAR_POST_RUNNER');
  }
  // One CM arrives at penalty-spot for cutback
  const cutbackMid = cams[0];
  if (cutbackMid && !roles.has(nameKey(cutbackMid))) roles.set(nameKey(cutbackMid), 'CUTBACK_RECEIVER');
  // Other CMs = SUPPORT (under-the-ball, ready for lay-off)
  for (const cm of cams.slice(1)) roles.set(nameKey(cm), 'SUPPORT');
  // DM and CBs = ANCHOR
  for (const tm of teammates) {
    if (roles.has(nameKey(tm)) || isGK(tm)) continue;
    const label = roleLabelOf(tm);
    if (['CB', 'LB', 'RB', 'DM'].includes(label)) roles.set(nameKey(tm), 'ANCHOR');
  }

  return {
    type,
    startedAt: elapsedSeconds,
    expiresAt: elapsedSeconds + DEFAULT_DURATION_SECONDS[type],
    side: team,
    roles,
    initiatorName: nameKey(carrier),
    metadata: { flank: side, fieldWidth },
  };
}

function tryPatientBuildup(inputs: PatternInputs): TeamPatternState | null {
  const { carrier, teammates, opponents, attackSign, elapsedSeconds, team, fieldWidth } = inputs;
  if (!carrier) return null;
  // Precondition: ball is in own third or just past midfield, low immediate pressure.
  const distGoal = distToOppGoal(carrier, attackSign, fieldWidth);
  if (distGoal < fieldWidth / 2) return null; // already past midfield — use progression / wing pattern
  const pressure = opponents.filter((opp) => opp.pos.distanceTo(carrier.pos) < 5).length;
  if (pressure >= 3) return null; // under pressure, not buildup phase

  const roles = new Map<string, PatternRole>();
  roles.set(nameKey(carrier), 'CARRIER');
  // CBs and DM = OUTLET (short safe options)
  for (const tm of teammates) {
    if (roles.has(nameKey(tm)) || isGK(tm)) continue;
    const label = roleLabelOf(tm);
    if (['CB', 'LB', 'RB', 'DM'].includes(label)) roles.set(nameKey(tm), 'OUTLET');
  }
  // CMs = SUPPORT (forward-outlet)
  for (const tm of teammates) {
    if (roles.has(nameKey(tm)) || isGK(tm)) continue;
    const label = roleLabelOf(tm);
    if (['CM', 'CAM'].includes(label)) roles.set(nameKey(tm), 'SUPPORT');
  }
  // LM/RM/ST hold forward line (they will receive once ball progresses)
  for (const tm of teammates) {
    if (roles.has(nameKey(tm)) || isGK(tm)) continue;
    const label = roleLabelOf(tm);
    if (['LM', 'RM', 'ST', 'CF'].includes(label)) roles.set(nameKey(tm), 'RUNNER');
  }

  return {
    type: 'PATIENT_BUILDUP',
    startedAt: elapsedSeconds,
    expiresAt: elapsedSeconds + DEFAULT_DURATION_SECONDS.PATIENT_BUILDUP,
    side: team,
    roles,
    initiatorName: nameKey(carrier),
    metadata: {},
  };
}

// ── Pattern selector ────────────────────────────────────────────────────────

/**
 * Pick a new pattern. Priority: counter-attack > wing-attack > patient buildup > null (NEUTRAL).
 * Selector is called on ball recovery OR when current pattern expires/invalidates.
 */
export function selectPattern(inputs: PatternInputs): TeamPatternState | null {
  return (
    tryCounterAttack(inputs)
    || tryWingAttack(inputs)
    || tryPatientBuildup(inputs)
    || null
  );
}

/**
 * Check if a pattern is still valid given current state.
 * Returns true if pattern should continue, false if it should end.
 */
export function isPatternStillValid(state: TeamPatternState, inputs: PatternInputs): boolean {
  if (inputs.elapsedSeconds >= state.expiresAt) return false;
  if (!inputs.carrier) return false;
  // Carrier switched teams — pattern dead.
  if (inputs.carrier.team !== state.side) return false;

  // Type-specific invalidations.
  if (state.type === 'COUNTER_ATTACK') {
    // Counter expires when team slows down (ball back in own half for > 2s after start).
    if (inputs.secondsSinceRecovery > 3 && attackProgressX(inputs.carrier, inputs.attackSign) < 0) return false;
  }
  if (state.type === 'WING_ATTACK_LEFT' || state.type === 'WING_ATTACK_RIGHT') {
    // Wing attack ends if carrier moves far to opposite flank or deeply into own half.
    // Loosened from previous -3 margin which caused 2s flip-flops during central runs.
    const carrierAttackX = attackProgressX(inputs.carrier, inputs.attackSign);
    if (carrierAttackX < -6) return false;
    const carrierZ = inputs.carrier.pos.z;
    if (state.type === 'WING_ATTACK_LEFT' && carrierZ > 7) return false;
    if (state.type === 'WING_ATTACK_RIGHT' && carrierZ < -7) return false;
  }
  if (state.type === 'PATIENT_BUILDUP') {
    // Buildup ends when ball crosses midfield.
    if (attackProgressX(inputs.carrier, inputs.attackSign) > 0) return false;
  }
  return true;
}

/**
 * Look up a player's role in the team's active pattern.
 * Returns 'NONE' if no pattern or player not in role map.
 */
export function getPatternRole(state: TeamPatternState | null, player: any): PatternRole {
  if (!state || !player) return 'NONE';
  return state.roles.get(nameKey(player)) || 'NONE';
}

export type PatternTargetInputs = {
  player: any;
  role: PatternRole;
  pattern: TeamPatternState;
  carrier: any | null;
  attackSign: 1 | -1;
  fieldWidth: number;
  fieldDepth: number;
  penaltyDepth: number;
  goalMouthHalfWidth: number;
};

export type PatternTargetOverride = {
  x: number;
  z: number;
  blend: number; // 0..1 — strength of the pattern override vs existing target
} | null;

/**
 * Compute a pattern-role-driven position target for a player.
 * Returns null if the role doesn't warrant a positional override.
 * Apply after tactical + force-field positioning to let pattern dominate.
 */
export function computePatternRoleTarget(inputs: PatternTargetInputs): PatternTargetOverride {
  const { player, role, pattern, carrier, attackSign, fieldWidth, fieldDepth, penaltyDepth, goalMouthHalfWidth } = inputs;
  if (!player || !pattern) return null;
  const goalX = attackSign > 0 ? fieldWidth / 2 : -fieldWidth / 2;
  const penaltySpotX = goalX - attackSign * penaltyDepth * 0.6; // ~12-yard mark

  switch (role) {
    case 'NEAR_POST_RUNNER': {
      // Near post = goalpost on same side as where ball is coming from (carrier side).
      // Only fire when carrier has meaningfully advanced (past midfield) — otherwise
      // striker shouldn't be sprinting at empty posts during buildup.
      const carrierAttackX = (carrier?.pos?.x ?? 0) * attackSign;
      if (carrierAttackX < 0) return null;
      const carrierZ = carrier?.pos?.z ?? 0;
      const nearSide = Math.sign(carrierZ) || 1;
      const nearPostZ = nearSide * goalMouthHalfWidth * 0.5;
      const nearPostX = goalX - attackSign * 4;
      return { x: nearPostX, z: nearPostZ, blend: 0.9 };
    }
    case 'FAR_POST_RUNNER': {
      const carrierAttackX = (carrier?.pos?.x ?? 0) * attackSign;
      if (carrierAttackX < 0) return null;
      const carrierZ = carrier?.pos?.z ?? 0;
      const farSide = -(Math.sign(carrierZ) || 1);
      const farPostZ = farSide * goalMouthHalfWidth * 0.9;
      const farPostX = goalX - attackSign * 3.5;
      return { x: farPostX, z: farPostZ, blend: 0.85 };
    }
    case 'CUTBACK_RECEIVER': {
      const carrierAttackX = (carrier?.pos?.x ?? 0) * attackSign;
      if (carrierAttackX < 0) return null;
      const carrierZ = carrier?.pos?.z ?? 0;
      const side = Math.sign(carrierZ) || 0;
      const cutbackZ = side * goalMouthHalfWidth * 0.4;
      return { x: penaltySpotX, z: cutbackZ, blend: 0.85 };
    }
    case 'OUTLET': {
      // Short safe option near keeper/carrier during buildup. Stay spread wide.
      if (!carrier) return null;
      // Offset: opposite z from carrier so team spreads.
      const carrierZ = carrier.pos.z;
      const offsetZ = carrierZ === 0 ? (player.homePos?.z >= 0 ? 8 : -8) : -Math.sign(carrierZ) * 10;
      const behindX = carrier.pos.x - attackSign * 3;
      return { x: behindX, z: offsetZ, blend: 0.35 };
    }
    case 'ANCHOR': {
      // Hold defensive shape. Stay around midfield line, don't commit forward.
      if (!carrier) return null;
      const anchorX = Math.min(carrier.pos.x * attackSign, 0) * attackSign; // clamp to own half
      // Keep natural z from home so back line stays connected.
      const anchorZ = player.homePos?.z ?? 0;
      return { x: anchorX, z: anchorZ, blend: 0.55 };
    }
    case 'RUNNER': {
      // In COUNTER_ATTACK: sprint ahead of carrier.
      // In PATIENT_BUILDUP: hold forward line (don't drop deep).
      if (!carrier) return null;
      if (pattern.type === 'COUNTER_ATTACK') {
        const sprintAheadX = carrier.pos.x + attackSign * 18;
        // Preserve own z roughly; don't all crash central.
        const runnerZ = player.homePos?.z ?? 0;
        return { x: sprintAheadX, z: runnerZ * 0.7, blend: 0.60 };
      }
      if (pattern.type === 'PATIENT_BUILDUP') {
        // Hold forward line ~ near attacking third edge.
        const forwardLineAttackX = fieldWidth * 0.18;
        const holdX = attackSign * forwardLineAttackX;
        const runnerZ = player.homePos?.z ?? 0;
        return { x: holdX, z: runnerZ * 0.9, blend: 0.40 };
      }
      return null;
    }
    case 'SUPPORT': {
      // Midfielder under-the-ball support. Short distance from carrier, opposite side.
      if (!carrier) return null;
      const supportX = carrier.pos.x - attackSign * 4;
      const carrierZ = carrier.pos.z;
      const supportZ = carrierZ === 0 ? (player.homePos?.z ?? 0) : -Math.sign(carrierZ) * 4;
      return { x: supportX, z: supportZ, blend: 0.35 };
    }
    case 'WALL': {
      // 1-2 wall player: 3-4 units from carrier, slightly ahead.
      if (!carrier) return null;
      const wallX = carrier.pos.x + attackSign * 3;
      const wallZ = (carrier.pos.z + (player.homePos?.z ?? 0)) * 0.5;
      return { x: wallX, z: wallZ, blend: 0.55 };
    }
    default:
      return null;
  }
}
