// Minimal types kept after the 2026-05-10 movement/passing/shooting rewrite.
// Original 302-line file is in `model_backup/src/core/types.ts`.

export type Vec2 = { x: number; z: number };

export type TeamSide = "home" | "away";

export type GameMode =
  | "normal"
  | "kickoff"
  | "goalkick"
  | "freekick"
  | "corner"
  | "throwin"
  | "penalty";

export type MatchState =
  | { kind: "pre_match" }
  | { kind: "kickoff"; team: TeamSide }
  | { kind: "live_play"; half: 1 | 2; startTick: number }
  | { kind: "ball_out"; restartType: "throw_in" | "goal_kick" | "corner" | "free_kick"; restartTeam: TeamSide }
  | { kind: "goal_scored"; scoringTeam: TeamSide; restartAfter: number }
  | { kind: "halftime" }
  | { kind: "full_time" };
