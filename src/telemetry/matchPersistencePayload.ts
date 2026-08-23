function preferSnapshotStat(snapshotValue: unknown, bundleValue: unknown, fallback = 0) {
  return typeof snapshotValue === 'number' && Number.isFinite(snapshotValue)
    ? snapshotValue
    : bundleValue ?? fallback;
}

function preferSnapshotValue<T>(snapshotValue: T | undefined, bundleValue: T | undefined, fallback: T) {
  return snapshotValue ?? bundleValue ?? fallback;
}

export function buildMatchResultPayload(input: {
  bundle: any;
  snapshot: any;
  fallbackSessionId: string;
  timestamp?: number;
}) {
  const bundle = input.bundle || {};
  const snapshot = input.snapshot || {};
  const metadata = bundle.metadata || {};
  const rawA = bundle.teamA || {};
  const rawB = bundle.teamB || {};
  const sessionId = preferSnapshotValue(snapshot.sessionId, metadata.sessionId, input.fallbackSessionId);
  const matchId = preferSnapshotValue(snapshot.matchId, bundle.matchId ?? metadata.matchId, null);
  const runtimeHalfDuration = preferSnapshotStat(snapshot.runtimeHalfDuration, metadata.runtimeHalfDuration, metadata.halfDuration ?? null);
  const matchClockScale = preferSnapshotStat(snapshot.matchClockScale, metadata.matchClockScale, null);
  const engineRuntimeToken = preferSnapshotValue(snapshot.engineRuntimeToken, bundle.engineRuntimeToken ?? metadata.engineRuntimeToken, null);
  const engineBootedAt = preferSnapshotStat(snapshot.engineBootedAt, bundle.engineBootedAt ?? metadata.engineBootedAt, null);
  const seriesSpeedMul = preferSnapshotStat(snapshot.seriesSpeedMul, metadata.seriesSpeedMul, null);
  const restartDelayGoal = preferSnapshotStat(snapshot.restartDelayGoal, metadata.restartDelayGoal, null);
  const restartDelayHalf = preferSnapshotStat(snapshot.restartDelayHalf, metadata.restartDelayHalf, null);
  const cpuVsCpu = typeof snapshot.cpuVsCpu === 'boolean' ? snapshot.cpuVsCpu : (typeof metadata.cpuVsCpu === 'boolean' ? metadata.cpuVsCpu : null);
  const interactiveHalftime = typeof snapshot.interactiveHalftime === 'boolean'
    ? snapshot.interactiveHalftime
    : (typeof metadata.interactiveHalftime === 'boolean' ? metadata.interactiveHalftime : null);
  const visibleHeaderEvents = Array.isArray(bundle.headerAnimationEvents) ? bundle.headerAnimationEvents : [];
  const visibleHeadersA = visibleHeaderEvents.filter((event: any) => event?.team === 'A').length;
  const visibleHeadersB = visibleHeaderEvents.filter((event: any) => event?.team === 'B').length;
  const hasVisibleHeaderAudit = visibleHeaderEvents.length > 0;
  const a = {
    ...rawA,
    score: preferSnapshotStat(snapshot.scoreA, rawA.score),
    shots: preferSnapshotStat(snapshot.shotsA, rawA.shots),
    shotsOnTarget: preferSnapshotStat(snapshot.shotsOnTargetA, rawA.shotsOnTarget),
    saves: preferSnapshotStat(snapshot.savesA, rawA.saves),
    passes: preferSnapshotStat(snapshot.passesA, rawA.passes),
    passesCompleted: preferSnapshotStat(snapshot.passesCompletedA, rawA.passesCompleted),
    fouls: preferSnapshotStat(snapshot.foulsA, rawA.fouls),
    offsides: preferSnapshotStat(snapshot.offsidesA, rawA.offsides),
    penaltiesAwarded: preferSnapshotStat(snapshot.penaltiesAwardedA, rawA.penaltiesAwarded),
    penaltiesScored: preferSnapshotStat(snapshot.penaltiesScoredA, rawA.penaltiesScored),
    penaltiesSaved: preferSnapshotStat(snapshot.penaltiesSavedA, rawA.penaltiesSaved),
    penaltiesMissed: preferSnapshotStat(snapshot.penaltiesMissedA, rawA.penaltiesMissed),
    corners: preferSnapshotStat(snapshot.cornersA, rawA.corners),
    throwIns: preferSnapshotStat(snapshot.throwInsA, rawA.throwIns),
    goalKicks: preferSnapshotStat(snapshot.goalKicksA, rawA.goalKicks),
    freeKicks: preferSnapshotStat(snapshot.freeKicksA, rawA.freeKicks),
    tackles: preferSnapshotStat(snapshot.tacklesWonA, rawA.tackles),
    clearances: preferSnapshotStat(snapshot.clearancesA, rawA.clearances),
    possession: preferSnapshotStat(snapshot.possessionA, rawA.possession, 50),
  };
  const b = {
    ...rawB,
    score: preferSnapshotStat(snapshot.scoreB, rawB.score),
    shots: preferSnapshotStat(snapshot.shotsB, rawB.shots),
    shotsOnTarget: preferSnapshotStat(snapshot.shotsOnTargetB, rawB.shotsOnTarget),
    saves: preferSnapshotStat(snapshot.savesB, rawB.saves),
    passes: preferSnapshotStat(snapshot.passesB, rawB.passes),
    passesCompleted: preferSnapshotStat(snapshot.passesCompletedB, rawB.passesCompleted),
    fouls: preferSnapshotStat(snapshot.foulsB, rawB.fouls),
    offsides: preferSnapshotStat(snapshot.offsidesB, rawB.offsides),
    penaltiesAwarded: preferSnapshotStat(snapshot.penaltiesAwardedB, rawB.penaltiesAwarded),
    penaltiesScored: preferSnapshotStat(snapshot.penaltiesScoredB, rawB.penaltiesScored),
    penaltiesSaved: preferSnapshotStat(snapshot.penaltiesSavedB, rawB.penaltiesSaved),
    penaltiesMissed: preferSnapshotStat(snapshot.penaltiesMissedB, rawB.penaltiesMissed),
    corners: preferSnapshotStat(snapshot.cornersB, rawB.corners),
    throwIns: preferSnapshotStat(snapshot.throwInsB, rawB.throwIns),
    goalKicks: preferSnapshotStat(snapshot.goalKicksB, rawB.goalKicks),
    freeKicks: preferSnapshotStat(snapshot.freeKicksB, rawB.freeKicks),
    tackles: preferSnapshotStat(snapshot.tacklesWonB, rawB.tackles),
    clearances: preferSnapshotStat(snapshot.clearancesB, rawB.clearances),
    possession: preferSnapshotStat(snapshot.possessionB, rawB.possession, 50),
  };
  const normalizedBundle = {
    ...bundle,
    matchId,
    engineRuntimeToken,
    engineBootedAt,
    teamA: a,
    teamB: b,
    metadata: {
      ...metadata,
      sessionId,
      matchId,
      runtimeHalfDuration,
      matchClockScale,
      seriesSpeedMul,
      restartDelayGoal,
      restartDelayHalf,
      cpuVsCpu,
      interactiveHalftime,
      engineRuntimeToken,
      engineBootedAt,
    },
    persistenceAudit: {
      snapshotTimestamp: snapshot.timestamp ?? null,
      normalizedFromSnapshot: true,
      runtimeStamped: true,
    },
  };
  return {
    session_id: sessionId,
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
    bundle_json: JSON.stringify(normalizedBundle),
  };
}
