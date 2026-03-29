import { createId, telemetryDb, type CorrectionActionRow } from './db';

export type DriftDashboardRow = {
  metricKey: string;
  label: string;
  unit?: string;
  simulatedValue: number;
  baselineValue: number | null;
  driftAbs: number | null;
  driftPct: number | null;
  thresholdPct: number;
  isAlert: boolean;
  source?: string;
};

export type DriftDashboardResult = {
  sessionId: string | null;
  generatedAt: number;
  rows: DriftDashboardRow[];
};

export type DriftRecommendationResult = {
  sessionId: string | null;
  created: CorrectionActionRow[];
  skippedCount: number;
};

type BuildDashboardOptions = {
  sessionId?: string | null;
  thresholdPct?: number;
};

const DRIFT_WINDOW_LIMIT = 300;

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function readNumericStat(statsJson: string, key: string) {
  try {
    const parsed = JSON.parse(statsJson || '{}');
    const value = parsed?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

async function getLatestSessionId() {
  const latest = await telemetryDb.sessions.orderBy('startedAt').last();
  return latest?.id || null;
}

async function computeSimulatedMetrics(sessionId: string) {
  const [perfRows, playerRows, latestMatch] = await Promise.all([
    telemetryDb.performanceSamples.where('sessionId').equals(sessionId).reverse().limit(DRIFT_WINDOW_LIMIT).toArray(),
    telemetryDb.playerSnapshots.where('sessionId').equals(sessionId).reverse().limit(DRIFT_WINDOW_LIMIT).toArray(),
    telemetryDb.matchSnapshots.where('sessionId').equals(sessionId).last(),
  ]);

  const fpsAvg = average(perfRows.map((row) => row.fpsEstimate));
  const offenseRows = playerRows.filter((row) => row.side === 'offense');
  const defenseRows = playerRows.filter((row) => row.side === 'defense');

  const offenseSpeed = offenseRows
    .map((row) => readNumericStat(row.statsJson, 'speed'))
    .filter((value): value is number => value !== null);
  const offenseTackle = offenseRows
    .map((row) => readNumericStat(row.statsJson, 'tackle'))
    .filter((value): value is number => value !== null);
  const defenseSpeed = defenseRows
    .map((row) => readNumericStat(row.statsJson, 'speed'))
    .filter((value): value is number => value !== null);
  const defenseTackle = defenseRows
    .map((row) => readNumericStat(row.statsJson, 'tackle'))
    .filter((value): value is number => value !== null);

  const totalGoals = latestMatch ? latestMatch.scoreA + latestMatch.scoreB : 0;
  const goalDiffAbs = latestMatch ? Math.abs(latestMatch.scoreA - latestMatch.scoreB) : 0;

  return [
    { metricKey: 'sim.performance.fps_avg', label: 'Average FPS', unit: 'fps', simulatedValue: fpsAvg },
    { metricKey: 'sim.player.offense.speed_avg', label: 'Offense Speed Avg', unit: 'rating', simulatedValue: average(offenseSpeed) },
    { metricKey: 'sim.player.offense.tackle_avg', label: 'Offense Tackle Avg', unit: 'rating', simulatedValue: average(offenseTackle) },
    { metricKey: 'sim.player.defense.speed_avg', label: 'Defense Speed Avg', unit: 'rating', simulatedValue: average(defenseSpeed) },
    { metricKey: 'sim.player.defense.tackle_avg', label: 'Defense Tackle Avg', unit: 'rating', simulatedValue: average(defenseTackle) },
    { metricKey: 'sim.match.total_goals_latest', label: 'Latest Total Goals', unit: 'goals', simulatedValue: totalGoals },
    { metricKey: 'sim.match.goal_diff_abs_latest', label: 'Latest Goal Diff (Abs)', unit: 'goals', simulatedValue: goalDiffAbs },
  ];
}

export async function buildDriftDashboard(options: BuildDashboardOptions = {}): Promise<DriftDashboardResult> {
  const thresholdPct = options.thresholdPct ?? 10;
  const sessionId = options.sessionId || (await getLatestSessionId());

  if (!sessionId) {
    return { sessionId: null, generatedAt: Date.now(), rows: [] };
  }

  const metrics = await computeSimulatedMetrics(sessionId);
  const baselineRows = await telemetryDb.baselines.where('metricKey').anyOf(metrics.map((metric) => metric.metricKey)).toArray();

  const rows: DriftDashboardRow[] = metrics.map((metric) => {
    const baseline = baselineRows.find((row) => row.metricKey === metric.metricKey && row.scopeType === 'global')
      || baselineRows.find((row) => row.metricKey === metric.metricKey)
      || null;

    const baselineValue = baseline?.value ?? null;
    const driftAbs = baselineValue === null ? null : metric.simulatedValue - baselineValue;
    const driftPct = baselineValue === null || baselineValue === 0 ? null : (driftAbs! / Math.abs(baselineValue)) * 100;
    const isAlert = driftPct !== null ? Math.abs(driftPct) >= thresholdPct : false;

    return {
      metricKey: metric.metricKey,
      label: metric.label,
      unit: metric.unit,
      simulatedValue: metric.simulatedValue,
      baselineValue,
      driftAbs,
      driftPct,
      thresholdPct,
      isAlert,
      source: baseline?.source,
    };
  });

  return {
    sessionId,
    generatedAt: Date.now(),
    rows,
  };
}

export async function generateDriftRecommendations(options: BuildDashboardOptions = {}): Promise<DriftRecommendationResult> {
  const dashboard = await buildDriftDashboard(options);
  const now = Date.now();
  const thresholdPct = options.thresholdPct ?? 10;

  if (!dashboard.sessionId) {
    return { sessionId: null, created: [], skippedCount: 0 };
  }

  let skippedCount = 0;
  const created: CorrectionActionRow[] = [];

  for (const row of dashboard.rows) {
    if (!row.isAlert || row.baselineValue === null || row.driftPct === null) continue;

    const existing = await telemetryDb.corrections
      .where('metricKey')
      .equals(row.metricKey)
      .and((item) => item.status === 'proposed' && now - item.appliedAt < 30 * 60 * 1000)
      .first();

    if (existing) {
      skippedCount += 1;
      continue;
    }

    const recommendation: CorrectionActionRow = {
      id: createId(),
      sessionId: dashboard.sessionId,
      metricKey: row.metricKey,
      previousValue: row.simulatedValue,
      updatedValue: row.baselineValue,
      rationale: `Drift ${row.driftPct.toFixed(1)}% exceeded threshold ${thresholdPct}% for ${row.metricKey}.`,
      status: 'proposed',
      notes: `Source: ${row.source || 'unspecified baseline source'}`,
      appliedAt: now,
    };

    await telemetryDb.corrections.put(recommendation);
    created.push(recommendation);
  }

  return {
    sessionId: dashboard.sessionId,
    created,
    skippedCount,
  };
}
