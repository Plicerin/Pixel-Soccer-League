export type MatchRowLike = {
  session_id?: string | null;
  bundle_json?: string | null;
  team_a_name?: string | null;
  team_b_name?: string | null;
  phase?: string | null;
};

export function isGhostMatchRow(row: MatchRowLike): boolean {
  if (!row?.bundle_json) return false;
  try {
    const bundle = JSON.parse(row.bundle_json);
    if (bundle?.sessionActive === false) return true;

    const teamA = String(row.team_a_name || bundle?.teamA?.name || bundle?.snapshot?.teamA?.name || '');
    const teamB = String(row.team_b_name || bundle?.teamB?.name || bundle?.snapshot?.teamB?.name || '');
    const isDefaultSplashFixture = teamA === 'Inter Miami' && teamB === 'LA Galaxy';
    const matchId = String(bundle?.matchId || bundle?.metadata?.matchId || '').trim();
    const phase = String(row.phase || bundle?.phase || bundle?.metadata?.phase || bundle?.snapshot?.phase || '');

    // Modern real starts stamp an M-xxxxx id in startKickoffPresentationSequence.
    // A default Miami-Galaxy FULL_TIME row with sessionActive=true but no matchId
    // means the engine reached full time without going through the real match
    // start path, which is the current ghost-game failure mode.
    const generatedFullTimeSession = /^ft-\d+$/u.test(String(row.session_id || ''));
    return isDefaultSplashFixture && !matchId && (phase === 'FULL_TIME' || generatedFullTimeSession);
  } catch {
    return false;
  }
}

export function filterGhostMatchRows<T extends MatchRowLike>(rows: T[]): T[] {
  return rows.filter((row) => !isGhostMatchRow(row));
}
