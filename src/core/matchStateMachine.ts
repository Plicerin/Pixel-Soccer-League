import type { TeamSide, GameMode, MatchState } from "./types";
import {
  TESTING_HALF_DURATION_SECONDS,
  FIELD_W,
  FIELD_D,
  LEFT_GOAL_X,
  RIGHT_GOAL_X,
  GOAL_MOUTH_HALF_Z,
  isInFieldOfPlay,
} from "./constants";

export type MatchClock = {
  half: 1 | 2;
  elapsedInHalf: number;
  halfDuration: number;
  stoppageTime: number;
};

export type MatchScore = {
  home: number;
  away: number;
};

export type MatchStateMachine = {
  state: MatchState;
  clock: MatchClock;
  score: MatchScore;
  restartTimer: number;
  stoppageAccumulated: number;
};

export function createMatchStateMachine(
  halfDuration: number = TESTING_HALF_DURATION_SECONDS
): MatchStateMachine {
  return {
    state: { kind: "pre_match" },
    clock: { half: 1, elapsedInHalf: 0, halfDuration, stoppageTime: 0 },
    score: { home: 0, away: 0 },
    restartTimer: 0,
    stoppageAccumulated: 0,
  };
}

export function advanceMatchState(
  msm: MatchStateMachine,
  dt: number,
  ballOutEvent: BallOutEvent | null,
  goalEvent: GoalEvent | null,
  clockDt: number = dt,
  haltAtHalftime: boolean = false,
): MatchStateMachine {
  const next = { ...msm };
  next.clock = { ...msm.clock };
  next.score = { ...msm.score };

  switch (next.state.kind) {
    case "pre_match":
      next.state = { kind: "kickoff", team: "home" };
      break;

    case "kickoff": {
      next.clock.elapsedInHalf += clockDt;
      if (next.clock.elapsedInHalf > 0.5) {
        next.state = { kind: "live_play", half: next.clock.half, startTick: 0 };
      }
      break;
    }

    case "live_play": {
      next.clock.elapsedInHalf += clockDt;

      if (goalEvent) {
        next.score[goalEvent.scoringTeam] += 1;
        next.state = { kind: "goal_scored", scoringTeam: goalEvent.scoringTeam, restartAfter: 2.0 };
        next.restartTimer = 2.0;
        break;
      }

      if (ballOutEvent) {
        next.state = {
          kind: "ball_out",
          restartType: ballOutEvent.restartType,
          restartTeam: ballOutEvent.restartTeam,
        };
        next.restartTimer = 1.5;
        break;
      }

      if (next.clock.elapsedInHalf >= next.clock.halfDuration + next.clock.stoppageTime) {
        if (next.clock.half === 1) {
          next.state = { kind: "halftime" };
          next.restartTimer = 3.0;
        } else {
          next.state = { kind: "full_time" };
        }
      }
      break;
    }

    case "ball_out": {
      next.clock.elapsedInHalf += clockDt;
      next.restartTimer -= dt;
      if (next.restartTimer <= 0) {
        const restartTeam = next.state.restartTeam;
        const restartType = next.state.restartType;
        next.state = { kind: "live_play", half: next.clock.half, startTick: 0 };
        next.clock.elapsedInHalf += 0;
      }
      break;
    }

    case "goal_scored": {
      next.clock.elapsedInHalf += clockDt;
      next.restartTimer -= dt;
      if (next.restartTimer <= 0) {
        const scoringTeam = next.state.scoringTeam;
        const restartTeam: TeamSide = scoringTeam === "home" ? "away" : "home";
        next.state = { kind: "kickoff", team: restartTeam };
      }
      break;
    }

    case "halftime": {
      if (haltAtHalftime) break;
      next.restartTimer -= dt;
      if (next.restartTimer <= 0) {
        next.clock.half = 2;
        next.clock.elapsedInHalf = 0;
        next.clock.stoppageTime = 0;
        next.state = { kind: "kickoff", team: "away" };
      }
      break;
    }

    case "full_time":
      break;
  }

  return next;
}

export function getMatchMinute(msm: MatchStateMachine): number {
  const half = msm.clock.half;
  const elapsed = msm.clock.elapsedInHalf;
  const halfDur = msm.clock.halfDuration;
  const minutesPerHalf = 45;
  return Math.max(1, Math.ceil(
    ((half === 1 ? 0 : halfDur) + elapsed) / (halfDur / minutesPerHalf)
  ));
}

export function isLivePlay(state: MatchState): boolean {
  return state.kind === "live_play";
}

export function isDeadBall(state: MatchState): boolean {
  return state.kind === "ball_out" || state.kind === "goal_scored"
    || state.kind === "kickoff" || state.kind === "halftime";
}

export type BallOutEvent = {
  restartType: "throw_in" | "goal_kick" | "corner" | "free_kick" | "penalty";
  restartTeam: TeamSide;
};

export type GoalEvent = {
  scoringTeam: TeamSide;
};

export function detectBallOut(
  ballX: number,
  ballZ: number,
  lastTouchTeam: TeamSide | null,
  homeAttackSign: number,
): BallOutEvent | null {
  const halfZ = FIELD_D / 2;

  if (ballZ > halfZ || ballZ < -halfZ) {
    const restartTeam: TeamSide = lastTouchTeam === "home" ? "away" : "home";
    return { restartType: "throw_in", restartTeam };
  }

  if (ballX > RIGHT_GOAL_X || ballX < LEFT_GOAL_X) {
    if (!lastTouchTeam) return null;
    const defendingLeft = homeAttackSign > 0;
    const goalScored = (defendingLeft && ballX > RIGHT_GOAL_X && Math.abs(ballZ) < GOAL_MOUTH_HALF_Z)
      || (!defendingLeft && ballX < LEFT_GOAL_X && Math.abs(ballZ) < GOAL_MOUTH_HALF_Z);

    if (!goalScored) {
      if (ballX > RIGHT_GOAL_X) {
        const attackingTeam: TeamSide = defendingLeft ? "home" : "away";
        const defendingTeam: TeamSide = attackingTeam === "home" ? "away" : "home";
        return lastTouchTeam === attackingTeam
          ? { restartType: "goal_kick", restartTeam: defendingTeam }
          : { restartType: "corner", restartTeam: attackingTeam };
      }
      if (ballX < LEFT_GOAL_X) {
        const attackingTeam: TeamSide = defendingLeft ? "away" : "home";
        const defendingTeam: TeamSide = attackingTeam === "home" ? "away" : "home";
        return lastTouchTeam === attackingTeam
          ? { restartType: "goal_kick", restartTeam: defendingTeam }
          : { restartType: "corner", restartTeam: attackingTeam };
      }
    }
  }

  return null;
}

export function detectGoalCrossing(
  ballX: number,
  ballZ: number,
  homeAttackSign: number,
): GoalEvent | null {
  const defendingLeft = homeAttackSign > 0;

  if (defendingLeft) {
    if (ballX > RIGHT_GOAL_X && Math.abs(ballZ) < GOAL_MOUTH_HALF_Z) {
      return { scoringTeam: "home" };
    }
    if (ballX < LEFT_GOAL_X && Math.abs(ballZ) < GOAL_MOUTH_HALF_Z) {
      return { scoringTeam: "away" };
    }
  } else {
    if (ballX < LEFT_GOAL_X && Math.abs(ballZ) < GOAL_MOUTH_HALF_Z) {
      return { scoringTeam: "home" };
    }
    if (ballX > RIGHT_GOAL_X && Math.abs(ballZ) < GOAL_MOUTH_HALF_Z) {
      return { scoringTeam: "away" };
    }
  }

  return null;
}
