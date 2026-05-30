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
  const visibleHeaderEvents = Array.isArray(bundle.headerAnimationEvents) ? bundle.headerAnimationEvents : [];
  const visibleHeadersA = visibleHeaderEvents.filter((event: any) => event?.team === 'A').length;
  const visibleHeadersB = visibleHeaderEvents.filter((event: any) => event?.team === 'B').length;
  const hasVisibleHeaderAudit = visibleHeaderEvents.length > 0;
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
    headers_a: hasVisibleHeaderAudit ? visibleHeadersA : a.headers ?? snapshot.headersA ?? 0,
    headers_b: hasVisibleHeaderAudit ? visibleHeadersB : b.headers ?? snapshot.headersB ?? 0,
    possession_a: a.possession ?? 50,
    phase: 'FULL_TIME',
    half: 2,
    elapsed_in_half: snapshot.elapsedInHalf ?? 300,
    bundle_json: JSON.stringify(bundle),
  };
}
