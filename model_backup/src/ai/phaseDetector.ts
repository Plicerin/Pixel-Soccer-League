import type {
  Vec2,
  TeamSide,
  PhaseOfPlay,
  BallZone,
  BallState,
  MatchBelief,
} from "../core/types";
import {
  FIELD_W,
  dist2,
} from "../core/constants";

export type PhaseDetectionInput = {
  ballZone: BallZone;
  ballState: BallState;
  possessionTeam: TeamSide | null;
  transitionAge: number;
  lastPossessionTeam: TeamSide | null;
  ballHeight: number;
  nearOpponentCount: number;
  isSetPiece: boolean;
};

export function detectPhase(input: PhaseDetectionInput): PhaseOfPlay {
  if (input.isSetPiece || input.ballState === "dead") {
    return "set_piece";
  }

  if (input.transitionAge < 2.0
    && input.lastPossessionTeam !== null
    && input.possessionTeam !== null
    && input.lastPossessionTeam !== input.possessionTeam) {
    if (input.transitionAge < 1.0) {
      return "counterpress";
    }
    return "counterattack";
  }

  switch (input.ballZone) {
    case "own_defensive":
      return "defensive_block";
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

export function detectPhaseFromBelief(
  belief: MatchBelief,
  team: TeamSide,
  transitionAge: number,
  lastPossessionTeam: TeamSide | null,
  isSetPiece: boolean,
): PhaseOfPlay {
  const attackSign = team === "home" ? belief.homeAttackSign : belief.awayAttackSign;
  const ballX = belief.ball.pos.x;
  const absAttackX = ballX * attackSign;
  const halfW = FIELD_W / 2;

  let ballZone: BallZone;
  if (absAttackX < -halfW * 0.33) {
    ballZone = "own_defensive";
  } else if (absAttackX < 0) {
    ballZone = "own_mid";
  } else if (absAttackX < halfW * 0.33) {
    ballZone = "opp_mid";
  } else if (absAttackX > halfW * 0.7) {
    ballZone = "opp_attacking";
  } else {
    ballZone = "opp_defensive";
  }

  const possessionTeam = belief.ball.ownerTeam;

  let nearOpponentCount = 0;
  const opps = team === "home" ? belief.awayPlayers : belief.homePlayers;
  const ballPos = belief.ball.pos;
  for (const opp of opps) {
    if (dist2(ballPos, opp.pos) < 5.0) {
      nearOpponentCount++;
    }
  }

  return detectPhase({
    ballZone,
    ballState: belief.ball.state,
    possessionTeam,
    transitionAge,
    lastPossessionTeam,
    ballHeight: 0,
    nearOpponentCount,
    isSetPiece,
  });
}

export function shouldCounterPress(
  phase: PhaseOfPlay,
  transitionAge: number,
  nearOpponentCount: number,
  ballDistance: number,
): boolean {
  if (phase !== "counterpress") return false;
  return transitionAge < 0.8 && nearOpponentCount >= 2 && ballDistance < 8.0;
}

export function shouldDropIntoBlock(
  phase: PhaseOfPlay,
  ballZone: BallZone,
  possessionTeam: TeamSide | null,
  myTeam: TeamSide,
): boolean {
  if (possessionTeam === myTeam) return false;
  return phase === "defensive_block" || ballZone === "own_defensive";
}

export function isInFinalThird(
  belief: MatchBelief,
  team: TeamSide,
): boolean {
  const attackSign = team === "home" ? belief.homeAttackSign : belief.awayAttackSign;
  return belief.ball.pos.x * attackSign > FIELD_W * 0.33;
}
