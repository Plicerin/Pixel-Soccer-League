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
  roles.set(nameKey(carrier), 'CARRIER');
  if (wingCarrier && wingCarrier !== carrier) roles.set(nameKey(wingCarrier), 'CARRIER');
  roles.set(nameKey(st), 'NEAR_POST_RUNNER');
  if (oppositeWinger) roles.set(nameKey(oppositeWinger), 'FAR_POST_RUNNER');
  // One CM arrives at penalty-spot for cutback
  const cutbackMid = cams[0];
  if (cutbackMid) roles.set(nameKey(cutbackMid), 'CUTBACK_RECEIVER');
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
