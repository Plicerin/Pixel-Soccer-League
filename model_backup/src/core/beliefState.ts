import type {
  Vec2,
  TeamSide,
  PlayerRole,
  PlayerBelief,
  BallBelief,
  BallState,
  MatchBelief,
  BallZone,
  PhaseOfPlay,
} from "./types";
import {
  FIELD_W,
  FIELD_D,
  LEFT_GOAL_X,
  RIGHT_GOAL_X,
  GAME_SPEED_SCALE,
  BASE_RUN_SPEED,
  SPRINT_MULTIPLIER,
  dist2,
  isInPenaltyArea,
} from "./constants";

export function computeBallZone(
  ballX: number,
  team: TeamSide,
  attackSign: number,
): BallZone {
  const halfW = FIELD_W / 2;
  const absAttackX = ballX * attackSign;

  if (absAttackX < -halfW * 0.33) {
    return "own_defensive";
  } else if (absAttackX < 0) {
    return "own_mid";
  } else if (absAttackX < halfW * 0.33) {
    return "opp_mid";
  } else {
    if (absAttackX > halfW * 0.7) {
      return "opp_attacking";
    }
    return "opp_defensive";
  }
}

export function inferPhaseOfPlay(
  ballZone: BallZone,
  ballState: BallState,
  possessionTeam: TeamSide | null,
  transitionAge: number,
  lastPossessionTeam: TeamSide | null,
): PhaseOfPlay {
  if (ballState === "dead") return "set_piece";

  if (transitionAge < 2.0 && lastPossessionTeam !== null && possessionTeam !== null
    && lastPossessionTeam !== possessionTeam) {
    if (transitionAge < 1.0) return "counterpress";
    return "counterattack";
  }

  switch (ballZone) {
    case "own_defensive":
    case "own_mid":
      return "build_up";
    case "opp_mid":
      return "progression";
    case "opp_defensive":
    case "opp_attacking":
      return "final_third";
    default:
      return "transition";
  }
}

export function computePossessionTeam(
  ballOwnerTeam: TeamSide | null,
  lastTouchTeam: TeamSide | null,
): TeamSide | null {
  return ballOwnerTeam ?? lastTouchTeam;
}

export type RawPlayerState = {
  id: string;
  team: TeamSide;
  role: PlayerRole;
  x: number;
  z: number;
  prevX: number;
  prevZ: number;
  facingRad: number;
  stamina01: number;
  hasBall: boolean;
  isGK: boolean;
  ratings: PlayerBelief["ratings"];
};

export type RawBallState = {
  x: number;
  z: number;
  y: number;
  prevX: number;
  prevZ: number;
  velY: number;
  ownerPlayerId: string | null;
  ownerTeam: TeamSide | null;
  state: BallState;
};

export function buildPlayerBelief(raw: RawPlayerState, dt: number): PlayerBelief {
  const vx = dt > 0 ? (raw.x - raw.prevX) / dt : 0;
  const vz = dt > 0 ? (raw.z - raw.prevZ) / dt : 0;
  const pace = raw.ratings.pace / 100;
  const baseSpeed = BASE_RUN_SPEED * GAME_SPEED_SCALE;
  const speed = baseSpeed * (0.7 + 0.6 * pace) * SPRINT_MULTIPLIER;
  const acceleration = (raw.ratings.acceleration / 100) * speed * 4.0;

  return {
    id: raw.id,
    team: raw.team,
    role: raw.role,
    pos: { x: raw.x, z: raw.z },
    vel: { x: vx, z: vz },
    facingRad: raw.facingRad,
    stamina01: raw.stamina01,
    hasBall: raw.hasBall,
    isGK: raw.isGK,
    speed,
    acceleration,
    currentIntent: null,
    ratings: raw.ratings,
  };
}

export function buildBallBelief(raw: RawBallState): BallBelief {
  return {
    pos: { x: raw.x, z: raw.z },
    vel: { x: raw.prevX !== undefined ? raw.x - raw.prevX : 0, z: raw.prevZ !== undefined ? raw.z - raw.prevZ : 0 },
    height: raw.y,
    ownerPlayerId: raw.ownerPlayerId,
    ownerTeam: raw.ownerTeam,
    state: raw.state,
  };
}

export function buildMatchBelief(
  homeRaws: RawPlayerState[],
  awayRaws: RawPlayerState[],
  ballRaw: RawBallState,
  dt: number,
  matchMinute: number,
  scoreDiff: number,
  homeAttackSign: 1 | -1,
): MatchBelief {
  const homePlayers = homeRaws.map(r => buildPlayerBelief(r, dt));
  const awayPlayers = awayRaws.map(r => buildPlayerBelief(r, dt));
  const ball = buildBallBelief(ballRaw);

  return {
    tick: 0,
    homePlayers,
    awayPlayers,
    ball,
    homeAttackSign,
    awayAttackSign: (homeAttackSign * -1) as 1 | -1,
    matchMinute,
    scoreDiff,
  };
}

export function findCarrier(belief: MatchBelief): PlayerBelief | null {
  const all = [...belief.homePlayers, ...belief.awayPlayers];
  return all.find(p => p.hasBall) ?? null;
}

export function findPlayerById(belief: MatchBelief, id: string): PlayerBelief | null {
  const all = [...belief.homePlayers, ...belief.awayPlayers];
  return all.find(p => p.id === id) ?? null;
}

export function teammates(belief: MatchBelief, team: TeamSide): PlayerBelief[] {
  return team === "home" ? belief.homePlayers : belief.awayPlayers;
}

export function opponents(belief: MatchBelief, team: TeamSide): PlayerBelief[] {
  return team === "home" ? belief.awayPlayers : belief.homePlayers;
}

export function nearestTeammate(pos: Vec2, team: TeamSide, belief: MatchBelief, excludeId?: string): PlayerBelief | null {
  const tm = teammates(belief, team).filter(p => p.id !== excludeId);
  if (tm.length === 0) return null;
  tm.sort((a, b) => dist2(pos, a.pos) - dist2(pos, b.pos));
  return tm[0];
}

export function nearestOpponent(pos: Vec2, team: TeamSide, belief: MatchBelief): PlayerBelief | null {
  const opp = opponents(belief, team);
  if (opp.length === 0) return null;
  opp.sort((a, b) => dist2(pos, a.pos) - dist2(pos, b.pos));
  return opp[0];
}

export function playersInRadius(pos: Vec2, radius: number, players: PlayerBelief[]): PlayerBelief[] {
  return players.filter(p => dist2(pos, p.pos) <= radius);
}

export function isBallInFinalThird(belief: MatchBelief, team: TeamSide): boolean {
  const attackSign = team === "home" ? belief.homeAttackSign : belief.awayAttackSign;
  const ballX = belief.ball.pos.x;
  return ballX * attackSign > FIELD_W * 0.33;
}

export function isBallInDefensiveThird(belief: MatchBelief, team: TeamSide): boolean {
  const attackSign = team === "home" ? belief.homeAttackSign : belief.awayAttackSign;
  const ballX = belief.ball.pos.x;
  return ballX * attackSign < -FIELD_W * 0.33;
}

export function isBallInPenaltyArea(belief: MatchBelief, team: TeamSide): boolean {
  const defendingLeft = team === "home"
    ? belief.homeAttackSign > 0
    : belief.awayAttackSign > 0;
  return isInPenaltyArea(belief.ball.pos, defendingLeft);
}
