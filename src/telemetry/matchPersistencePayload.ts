export function buildMatchResultPayload(input: {
  bundle: any;
  snapshot: any;
  fallbackSessionId: string;
  timestamp?: number;
}) {
  const bundle = input.bundle || {};
  const snapshot = input.snapshot || {};
  const a = bundle.teamA || {};
  const b = bundle.teamB || {};
  return {
    session_id: snapshot.sessionId || input.fallbackSessionId,
    timestamp: input.timestamp ?? Date.now(),
    team_a_name: a.name || '',
    team_b_name: b.name || '',
    team_a_formation: a.formation || '',
    team_b_formation: b.formation || '',
    score_a: a.score ?? 0,
    score_b: b.score ?? 0,
    shots_a: a.shots ?? 0,
    shots_b: b.shots ?? 0,
    shots_on_target_a: a.shotsOnTarget ?? 0,
    shots_on_target_b: b.shotsOnTarget ?? 0,
    saves_a: a.saves ?? 0,
    saves_b: b.saves ?? 0,
    headers_a: 0,
    headers_b: 0,
    possession_a: a.possession ?? 50,
    phase: 'FULL_TIME',
    half: 2,
    elapsed_in_half: snapshot.elapsedInHalf ?? 300,
    bundle_json: JSON.stringify(bundle),
  };
}
