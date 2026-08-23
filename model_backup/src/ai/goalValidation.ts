export type GoalActorCandidate<TPlayer = unknown> = {
  player: TPlayer | null | undefined;
  team: string | null | undefined;
  goalkeeper: boolean;
};

export function selectGoalActor<TPlayer>(
  scoringTeam: 'A' | 'B',
  candidates: Array<GoalActorCandidate<TPlayer>>,
): TPlayer | null {
  const valid = candidates.filter(candidate => candidate.player && !candidate.goalkeeper);
  const scoringActor = valid.find(candidate => candidate.team === scoringTeam);
  return (scoringActor ?? valid[0])?.player ?? null;
}

export function shouldAwardGoalCrossing<TPlayer>(
  scoringTeam: 'A' | 'B',
  fromShot: boolean,
  _candidates: Array<GoalActorCandidate<TPlayer>>,
): boolean {
  void scoringTeam;
  return fromShot;
}
