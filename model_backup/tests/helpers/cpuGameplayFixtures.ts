import { createBlackboard } from '../../src/core/blackboard.ts'
import type { MatchBelief, PlayerBelief, TeamSide } from '../../src/core/types.ts'

export function makeRatings(overrides: Partial<PlayerBelief['ratings']> = {}): PlayerBelief['ratings'] {
  return {
    pace: 80,
    shooting: 70,
    passing: 75,
    dribbling: 78,
    defending: 55,
    physical: 72,
    acceleration: 79,
    agility: 74,
    stamina: 80,
    strength: 70,
    finishing: 68,
    shortPassing: 76,
    longPassing: 70,
    defensiveAwareness: 55,
    standingTackle: 50,
    reactions: 72,
    gkDiving: 10,
    gkHandling: 10,
    gkKicking: 10,
    gkReflexes: 10,
    gkPositioning: 10,
    ...overrides,
  }
}

export function makePlayer(overrides: Partial<PlayerBelief> = {}): PlayerBelief {
  return {
    id: 'p1',
    team: 'home',
    role: 'CM_L',
    pos: { x: -4, z: 2 },
    vel: { x: 0, z: 0 },
    facingRad: 0,
    stamina01: 1,
    hasBall: false,
    isGK: false,
    speed: 6,
    acceleration: 12,
    currentIntent: null,
    ratings: makeRatings(),
    ...overrides,
  }
}

export function makeBelief(overrides: Partial<MatchBelief> = {}): MatchBelief {
  const homePlayers = overrides.homePlayers ?? [makePlayer({ id: 'home-1', team: 'home' })]
  const awayPlayers = overrides.awayPlayers ?? [makePlayer({ id: 'away-1', team: 'away', pos: { x: 6, z: -1 } })]
  const ballOwnerPlayerId = homePlayers.find((player) => player.hasBall)?.id ?? null
  const ballOwnerTeam = homePlayers.some((player) => player.hasBall) ? 'home'
    : awayPlayers.some((player) => player.hasBall) ? 'away'
    : null

  return {
    tick: 1,
    homePlayers,
    awayPlayers,
    ball: overrides.ball ?? {
      pos: { x: 0, z: 0 },
      vel: { x: 0, z: 0 },
      height: 0,
      ownerPlayerId: ballOwnerPlayerId,
      ownerTeam: ballOwnerTeam,
      state: ballOwnerTeam ? 'attached' : 'dead',
    },
    homeAttackSign: 1,
    awayAttackSign: -1,
    matchMinute: 1,
    scoreDiff: 0,
    ...overrides,
  }
}

export function makeBlackboard(team: TeamSide = 'home') {
  return createBlackboard(team)
}
