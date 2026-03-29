import { createId, telemetryDb, type CorrectionActionRow, type MatchSnapshotRow, type PlayerSnapshotRow, type RealWorldBaselineRow, type TelemetryEventRow, type TelemetrySession } from './db';
import { buildDriftDashboard, generateDriftRecommendations } from './analysis';

type PlayerStatsLike = {
  role?: string;
  team?: 'A' | 'B';
  name?: string;
  rosterTeam?: string;
  stats?: unknown;
  mls2025?: unknown;
};

type MatchSnapshotLike = {
  timestamp?: number;
  scoreA?: number;
  scoreB?: number;
  shotsA?: number;
  shotsB?: number;
  shotsOnTargetA?: number;
  shotsOnTargetB?: number;
  savesA?: number;
  savesB?: number;
  offensiveTeam?: 'A' | 'B';
  isLive?: boolean;
  weather?: string;
  lighting?: string;
  aiStyle?: string;
  cameraMode?: string;
  phase?: string;
  half?: 1 | 2;
  elapsedInHalf?: number;
  teamAName?: string;
  teamBName?: string;
  teamAFormation?: string;
  teamBFormation?: string;
};

type GameApiLike = {
  getMatchSnapshot?: () => MatchSnapshotLike | null;
  getSelectedPlayerStats?: () => PlayerStatsLike | null;
  getSelectedDefensePlayerStats?: () => PlayerStatsLike | null;
  getPlayers?: () => Array<{ role?: string; team?: 'A' | 'B'; name?: string; stats?: unknown }>;
  getRenderFps?: () => number;
};

export type TelemetryContext = {
  teamAName?: string;
  teamBName?: string;
  teamAFormation?: string;
  teamBFormation?: string;
  notes?: string;
};

export class TelemetryRecorder {
  private sessionId: string | null = null;
  private timerId: number | null = null;
  private lastTickMs = 0;
  private lastHeartbeatAt = 0;
  private prevMatchSnapshot: MatchSnapshotLike | null = null;
  private context: TelemetryContext = {};

  isRecording() {
    return this.sessionId !== null && this.timerId !== null;
  }

  setContext(nextContext: TelemetryContext) {
    this.context = { ...this.context, ...nextContext };
  }

  async start(getGameApi: () => GameApiLike | null | undefined, intervalMs = 1000) {
    if (this.isRecording()) return this.sessionId;

    const newSession: TelemetrySession = {
      id: createId(),
      startedAt: Date.now(),
      teamAName: this.context.teamAName,
      teamBName: this.context.teamBName,
      teamAFormation: this.context.teamAFormation,
      teamBFormation: this.context.teamBFormation,
      notes: this.context.notes,
    };

    await telemetryDb.sessions.put(newSession);
    this.sessionId = newSession.id;
    this.lastTickMs = performance.now();
    this.lastHeartbeatAt = Date.now();
    this.prevMatchSnapshot = null;

    this.timerId = window.setInterval(async () => {
      const api = getGameApi();
      if (!api || !this.sessionId) return;

      const nowPerf = performance.now();
      const frameDeltaMs = Math.max(0.1, nowPerf - this.lastTickMs);
      this.lastTickMs = nowPerf;
      const sampledFps = api.getRenderFps?.();
      const fpsEstimate = typeof sampledFps === 'number' && Number.isFinite(sampledFps)
        ? Math.max(0, Math.min(240, sampledFps))
        : Math.min(240, 1000 / frameDeltaMs);
      const now = Date.now();

      const match = api.getMatchSnapshot?.() || null;
      const offense = api.getSelectedPlayerStats?.() || null;
      const defense = api.getSelectedDefensePlayerStats?.() || null;
      const allPlayers = api.getPlayers?.() || [];
      const eventRows: TelemetryEventRow[] = [];

      const matchRow: MatchSnapshotRow | null = match
        ? {
            sessionId: this.sessionId,
            timestamp: match.timestamp || now,
            scoreA: match.scoreA ?? 0,
            scoreB: match.scoreB ?? 0,
            shotsA: match.shotsA ?? 0,
            shotsB: match.shotsB ?? 0,
            shotsOnTargetA: match.shotsOnTargetA ?? 0,
            shotsOnTargetB: match.shotsOnTargetB ?? 0,
            savesA: match.savesA ?? 0,
            savesB: match.savesB ?? 0,
            offensiveTeam: match.offensiveTeam ?? 'A',
            isLive: !!match.isLive,
            weather: match.weather,
            lighting: match.lighting,
            aiStyle: match.aiStyle,
            cameraMode: match.cameraMode,
            phase: match.phase,
            half: match.half,
            elapsedInHalf: match.elapsedInHalf,
            teamAName: match.teamAName,
            teamBName: match.teamBName,
            teamAFormation: match.teamAFormation,
            teamBFormation: match.teamBFormation,
          }
        : null;

      const playerRows: PlayerSnapshotRow[] = [
        {
          sessionId: this.sessionId,
          timestamp: now,
          side: 'offense',
          team: offense?.team,
          rosterTeam: offense?.rosterTeam,
          name: offense?.name,
          role: offense?.role,
          statsJson: JSON.stringify(offense?.stats ?? {}),
          mls2025Json: JSON.stringify(offense?.mls2025 ?? null),
        },
        {
          sessionId: this.sessionId,
          timestamp: now,
          side: 'defense',
          team: defense?.team,
          rosterTeam: defense?.rosterTeam,
          name: defense?.name,
          role: defense?.role,
          statsJson: JSON.stringify(defense?.stats ?? {}),
          mls2025Json: JSON.stringify(defense?.mls2025 ?? null),
        },
      ];

      const allPlayerRows: PlayerSnapshotRow[] = allPlayers.map((p) => ({
        sessionId: this.sessionId!,
        timestamp: now,
        side: 'all',
        team: p?.team,
        rosterTeam: undefined,
        name: p?.name,
        role: p?.role,
        statsJson: JSON.stringify(p?.stats ?? {}),
        mls2025Json: JSON.stringify(null),
      }));

      const perf = (performance as any).memory;
      if (match) {
        if (!this.prevMatchSnapshot) {
          eventRows.push({
            sessionId: this.sessionId,
            timestamp: now,
            eventType: 'match_snapshot_started',
            payloadJson: JSON.stringify({
              scoreA: match.scoreA ?? 0,
              scoreB: match.scoreB ?? 0,
              phase: match.phase,
              half: match.half,
              isLive: !!match.isLive,
            }),
          });
        } else {
          if (match.scoreA !== this.prevMatchSnapshot.scoreA || match.scoreB !== this.prevMatchSnapshot.scoreB) {
            eventRows.push({
              sessionId: this.sessionId,
              timestamp: now,
              eventType: 'score_changed',
              payloadJson: JSON.stringify({
                from: {
                  scoreA: this.prevMatchSnapshot.scoreA ?? 0,
                  scoreB: this.prevMatchSnapshot.scoreB ?? 0,
                },
                to: {
                  scoreA: match.scoreA ?? 0,
                  scoreB: match.scoreB ?? 0,
                },
              }),
            });
          }
          if (match.phase !== this.prevMatchSnapshot.phase || match.half !== this.prevMatchSnapshot.half) {
            eventRows.push({
              sessionId: this.sessionId,
              timestamp: now,
              eventType: 'phase_changed',
              payloadJson: JSON.stringify({
                from: {
                  phase: this.prevMatchSnapshot.phase,
                  half: this.prevMatchSnapshot.half,
                },
                to: {
                  phase: match.phase,
                  half: match.half,
                },
              }),
            });
          }
          if (
            match.shotsA !== this.prevMatchSnapshot.shotsA ||
            match.shotsB !== this.prevMatchSnapshot.shotsB ||
            match.shotsOnTargetA !== this.prevMatchSnapshot.shotsOnTargetA ||
            match.shotsOnTargetB !== this.prevMatchSnapshot.shotsOnTargetB ||
            match.savesA !== this.prevMatchSnapshot.savesA ||
            match.savesB !== this.prevMatchSnapshot.savesB
          ) {
            eventRows.push({
              sessionId: this.sessionId,
              timestamp: now,
              eventType: 'shot_stats_changed',
              payloadJson: JSON.stringify({
                from: {
                  shotsA: this.prevMatchSnapshot.shotsA ?? 0,
                  shotsB: this.prevMatchSnapshot.shotsB ?? 0,
                  shotsOnTargetA: this.prevMatchSnapshot.shotsOnTargetA ?? 0,
                  shotsOnTargetB: this.prevMatchSnapshot.shotsOnTargetB ?? 0,
                  savesA: this.prevMatchSnapshot.savesA ?? 0,
                  savesB: this.prevMatchSnapshot.savesB ?? 0,
                },
                to: {
                  shotsA: match.shotsA ?? 0,
                  shotsB: match.shotsB ?? 0,
                  shotsOnTargetA: match.shotsOnTargetA ?? 0,
                  shotsOnTargetB: match.shotsOnTargetB ?? 0,
                  savesA: match.savesA ?? 0,
                  savesB: match.savesB ?? 0,
                },
              }),
            });
          }
          if (!!match.isLive !== !!this.prevMatchSnapshot.isLive) {
            eventRows.push({
              sessionId: this.sessionId,
              timestamp: now,
              eventType: !!match.isLive ? 'play_started' : 'play_stopped',
              payloadJson: JSON.stringify({
                phase: match.phase,
                half: match.half,
                elapsedInHalf: match.elapsedInHalf,
              }),
            });
          }
        }

        if (now - this.lastHeartbeatAt >= 5000) {
          eventRows.push({
            sessionId: this.sessionId,
            timestamp: now,
            eventType: 'heartbeat',
            payloadJson: JSON.stringify({
              isLive: !!match.isLive,
              scoreA: match.scoreA ?? 0,
              scoreB: match.scoreB ?? 0,
              phase: match.phase,
              half: match.half,
              elapsedInHalf: match.elapsedInHalf,
            }),
          });
          this.lastHeartbeatAt = now;
        }

        this.prevMatchSnapshot = {
          scoreA: match.scoreA,
          scoreB: match.scoreB,
          shotsA: match.shotsA,
          shotsB: match.shotsB,
          shotsOnTargetA: match.shotsOnTargetA,
          shotsOnTargetB: match.shotsOnTargetB,
          savesA: match.savesA,
          savesB: match.savesB,
          phase: match.phase,
          half: match.half,
          isLive: match.isLive,
          elapsedInHalf: match.elapsedInHalf,
        };
      }

      await telemetryDb.transaction(
        'rw',
        telemetryDb.matchSnapshots,
        telemetryDb.playerSnapshots,
        telemetryDb.performanceSamples,
        telemetryDb.telemetryEvents,
        async () => {
          if (matchRow) await telemetryDb.matchSnapshots.add(matchRow);
          await telemetryDb.playerSnapshots.bulkAdd([...playerRows, ...allPlayerRows]);
          await telemetryDb.performanceSamples.add({
            sessionId: this.sessionId!,
            timestamp: now,
            frameDeltaMs,
            fpsEstimate,
            heapUsedBytes: perf?.usedJSHeapSize,
            heapLimitBytes: perf?.jsHeapSizeLimit,
          });
          if (eventRows.length > 0) {
            await telemetryDb.telemetryEvents.bulkAdd(eventRows);
          }
        }
      );
    }, intervalMs);

    return this.sessionId;
  }

  async stop() {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.sessionId) {
      await telemetryDb.sessions.update(this.sessionId, { endedAt: Date.now() });
      this.sessionId = null;
    }
    this.prevMatchSnapshot = null;
  }

  async recordEvent(eventType: string, payload: unknown, sessionId?: string) {
    const sid = sessionId || this.sessionId;
    if (!sid) return;
    const row: TelemetryEventRow = {
      sessionId: sid,
      timestamp: Date.now(),
      eventType,
      payloadJson: JSON.stringify(payload ?? {}),
    };
    await telemetryDb.telemetryEvents.add(row);
  }
}

export async function addRealWorldBaseline(input: Omit<RealWorldBaselineRow, 'id' | 'recordedAt'> & { id?: string; recordedAt?: number }) {
  const row: RealWorldBaselineRow = {
    id: input.id || createId(),
    metricKey: input.metricKey,
    source: input.source,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    value: input.value,
    unit: input.unit,
    notes: input.notes,
    recordedAt: input.recordedAt || Date.now(),
  };
  await telemetryDb.baselines.put(row);
  return row;
}

export async function addCorrectionAction(input: Omit<CorrectionActionRow, 'id' | 'appliedAt'> & { id?: string; appliedAt?: number }) {
  const row: CorrectionActionRow = {
    id: input.id || createId(),
    sessionId: input.sessionId,
    metricKey: input.metricKey,
    previousValue: input.previousValue,
    updatedValue: input.updatedValue,
    rationale: input.rationale,
    status: input.status,
    notes: input.notes,
    appliedAt: input.appliedAt || Date.now(),
  };
  await telemetryDb.corrections.put(row);
  return row;
}

export async function exportTelemetryBundle() {
  const [sessions, matchSnapshots, playerSnapshots, performanceSamples, telemetryEvents, baselines, corrections] = await Promise.all([
    telemetryDb.sessions.toArray(),
    telemetryDb.matchSnapshots.toArray(),
    telemetryDb.playerSnapshots.toArray(),
    telemetryDb.performanceSamples.toArray(),
    telemetryDb.telemetryEvents.toArray(),
    telemetryDb.baselines.toArray(),
    telemetryDb.corrections.toArray(),
  ]);

  return {
    exportedAt: Date.now(),
    sessions,
    matchSnapshots,
    playerSnapshots,
    performanceSamples,
    telemetryEvents,
    baselines,
    corrections,
  };
}

export type TelemetrySessionSummary = {
  sessionId: string;
  startedAt: number;
  endedAt?: number;
  teamAName?: string;
  teamBName?: string;
  teamAFormation?: string;
  teamBFormation?: string;
  finalScoreA: number;
  finalScoreB: number;
  shotsA: number;
  shotsB: number;
  shotsOnTargetA: number;
  shotsOnTargetB: number;
  savesA: number;
  savesB: number;
  phase?: string;
  half?: 1 | 2;
  elapsedInHalf?: number;
  timestamp: number;
};

export type RecentMatchQuery = {
  teamAName?: string;
  teamBName?: string;
  scoreA?: number;
  scoreB?: number;
  limit?: number;
};

function normalizeName(value?: string) {
  return (value || '').trim().toLowerCase();
}

function toSessionSummary(session: TelemetrySession, snapshot: MatchSnapshotRow): TelemetrySessionSummary {
  return {
    sessionId: session.id,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    teamAName: snapshot.teamAName || session.teamAName,
    teamBName: snapshot.teamBName || session.teamBName,
    teamAFormation: snapshot.teamAFormation || session.teamAFormation,
    teamBFormation: snapshot.teamBFormation || session.teamBFormation,
    finalScoreA: snapshot.scoreA,
    finalScoreB: snapshot.scoreB,
    shotsA: snapshot.shotsA,
    shotsB: snapshot.shotsB,
    shotsOnTargetA: snapshot.shotsOnTargetA,
    shotsOnTargetB: snapshot.shotsOnTargetB,
    savesA: snapshot.savesA,
    savesB: snapshot.savesB,
    phase: snapshot.phase,
    half: snapshot.half,
    elapsedInHalf: snapshot.elapsedInHalf,
    timestamp: snapshot.timestamp,
  };
}

async function getBestTerminalSnapshot(sessionId: string) {
  const fullTime = await telemetryDb.matchSnapshots
    .where('sessionId')
    .equals(sessionId)
    .reverse()
    .filter((row) => row.phase === 'FULL_TIME')
    .first();
  if (fullTime) return fullTime;

  return telemetryDb.matchSnapshots
    .where('sessionId')
    .equals(sessionId)
    .last();
}

export async function getLatestSessionSummary() {
  const session = await telemetryDb.sessions.orderBy('startedAt').last();
  if (!session) return null;

  const snapshot = await getBestTerminalSnapshot(session.id);
  if (!snapshot) return null;

  return toSessionSummary(session, snapshot);
}

export async function findRecentCompletedMatches(query: RecentMatchQuery = {}) {
  const limit = Math.max(1, Math.min(50, query.limit ?? 10));
  const teamAFilter = normalizeName(query.teamAName);
  const teamBFilter = normalizeName(query.teamBName);

  const sessions = await telemetryDb.sessions.orderBy('startedAt').reverse().limit(120).toArray();
  const summaries: TelemetrySessionSummary[] = [];

  for (const session of sessions) {
    const sessionTeamA = normalizeName(session.teamAName);
    const sessionTeamB = normalizeName(session.teamBName);
    if (teamAFilter && !sessionTeamA.includes(teamAFilter)) continue;
    if (teamBFilter && !sessionTeamB.includes(teamBFilter)) continue;

    const snapshot = await getBestTerminalSnapshot(session.id);
    if (!snapshot) continue;
    if (snapshot.phase !== 'FULL_TIME') continue;
    if (typeof query.scoreA === 'number' && snapshot.scoreA !== query.scoreA) continue;
    if (typeof query.scoreB === 'number' && snapshot.scoreB !== query.scoreB) continue;

    summaries.push(toSessionSummary(session, snapshot));
    if (summaries.length >= limit) break;
  }

  return summaries;
}

export async function getTelemetryCounts() {
  const [sessions, matchSnapshots, playerSnapshots, performanceSamples, telemetryEvents, baselines, corrections] = await Promise.all([
    telemetryDb.sessions.count(),
    telemetryDb.matchSnapshots.count(),
    telemetryDb.playerSnapshots.count(),
    telemetryDb.performanceSamples.count(),
    telemetryDb.telemetryEvents.count(),
    telemetryDb.baselines.count(),
    telemetryDb.corrections.count(),
  ]);

  return { sessions, matchSnapshots, playerSnapshots, performanceSamples, telemetryEvents, baselines, corrections };
}

export async function clearTelemetryDatabase() {
  await telemetryDb.transaction(
    'rw',
    [
      telemetryDb.sessions,
      telemetryDb.matchSnapshots,
      telemetryDb.playerSnapshots,
      telemetryDb.performanceSamples,
      telemetryDb.telemetryEvents,
      telemetryDb.baselines,
      telemetryDb.corrections,
    ],
    async () => {
      await telemetryDb.sessions.clear();
      await telemetryDb.matchSnapshots.clear();
      await telemetryDb.playerSnapshots.clear();
      await telemetryDb.performanceSamples.clear();
      await telemetryDb.telemetryEvents.clear();
      await telemetryDb.baselines.clear();
      await telemetryDb.corrections.clear();
    }
  );
}

type TelemetryDebugApi = {
  counts: () => Promise<Awaited<ReturnType<typeof getTelemetryCounts>>>;
  exportAll: () => Promise<Awaited<ReturnType<typeof exportTelemetryBundle>>>;
  latestSummary: () => Promise<Awaited<ReturnType<typeof getLatestSessionSummary>>>;
  findMatches: (query?: RecentMatchQuery) => Promise<Awaited<ReturnType<typeof findRecentCompletedMatches>>>;
  mirrorToFile: () => Promise<boolean>;
  clearAll: () => Promise<void>;
  addBaseline: typeof addRealWorldBaseline;
  addCorrection: typeof addCorrectionAction;
  compareDrift: typeof buildDriftDashboard;
  generateRecommendations: typeof generateDriftRecommendations;
};

declare global {
  interface Window {
    pslTelemetry?: TelemetryDebugApi;
  }
}

/**
 * POST the latest session summary to the dev-server mirror endpoint
 * so it's written to match-results.json on disk.
 * Silently no-ops in production (endpoint won't exist).
 */
export async function mirrorMatchSummary(): Promise<boolean> {
  try {
    const summary = await getLatestSessionSummary();
    if (!summary) return false;
    const res = await fetch('/__telemetry/mirror', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(summary),
    });
    return res.ok;
  } catch {
    // Dev server not running or prod build – silently skip
    return false;
  }
}

export function installTelemetryDebugApi() {
  window.pslTelemetry = {
    counts: getTelemetryCounts,
    exportAll: exportTelemetryBundle,
    latestSummary: getLatestSessionSummary,
    findMatches: findRecentCompletedMatches,
    mirrorToFile: mirrorMatchSummary,
    clearAll: clearTelemetryDatabase,
    addBaseline: addRealWorldBaseline,
    addCorrection: addCorrectionAction,
    compareDrift: buildDriftDashboard,
    generateRecommendations: generateDriftRecommendations,
  };
}
