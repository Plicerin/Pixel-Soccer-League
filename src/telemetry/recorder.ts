import { createId, telemetryDb, type CorrectionActionRow, type MatchSnapshotRow, type PlayerSnapshotRow, type RealWorldBaselineRow, type TelemetryEventRow, type TelemetrySession } from './db';
import { buildDriftDashboard, generateDriftRecommendations } from './analysis';
import { seedMLS2025Baselines } from './mls2025-baselines';
import { hasDevServer } from '../runtimeEnv';

type PlayerStatsLike = {
  role?: string;
  team?: 'A' | 'B';
  name?: string;
  pos?: {
    x?: number;
    y?: number;
    z?: number;
  };
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
  headersA?: number;
  headersB?: number;
  passesA?: number;
  passesB?: number;
  passesCompletedA?: number;
  passesCompletedB?: number;
  foulsA?: number;
  foulsB?: number;
  penaltiesAwardedA?: number;
  penaltiesAwardedB?: number;
  penaltiesScoredA?: number;
  penaltiesScoredB?: number;
  penaltiesSavedA?: number;
  penaltiesSavedB?: number;
  penaltiesMissedA?: number;
  penaltiesMissedB?: number;
  penaltyXgA?: number;
  penaltyXgB?: number;
  cornersA?: number;
  cornersB?: number;
  throwInsA?: number;
  throwInsB?: number;
  tacklesWonA?: number;
  tacklesWonB?: number;
  clearancesA?: number;
  clearancesB?: number;
  possessionA?: number;
  possessionB?: number;
  gkDistributionsA?: number;
  gkDistributionsB?: number;
  gkDistCompletedA?: number;
  gkDistCompletedB?: number;
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
  lastShotTelemetry?: any;
  lastKeeperKickTelemetry?: any;
  lastPassLoopTelemetry?: any;
};

type PlayerPositionLike = {
  name?: string;
  team?: 'A' | 'B';
  role?: string;
  x: number;
  y: number;
  z: number;
};

type GameApiLike = {
  getMatchSnapshot?: () => MatchSnapshotLike | null;
  getSelectedPlayerStats?: () => PlayerStatsLike | null;
  getSelectedDefensePlayerStats?: () => PlayerStatsLike | null;
  getPlayers?: () => Array<{
    role?: string;
    team?: 'A' | 'B';
    name?: string;
    pos?: { x?: number; y?: number; z?: number };
    stats?: unknown;
  }>;
  getRenderFps?: () => number;
};

function toTelemetryStats(stats: unknown, pos?: { x?: number; y?: number; z?: number }) {
  const base = stats && typeof stats === 'object' ? { ...(stats as Record<string, unknown>) } : {};
  if (!pos) return base;
  base.position = {
    x: typeof pos.x === 'number' ? pos.x : 0,
    y: typeof pos.y === 'number' ? pos.y : 0,
    z: typeof pos.z === 'number' ? pos.z : 0,
  };
  return base;
}

function toPositionSnapshot(players: Array<{ name?: string; team?: 'A' | 'B'; role?: string; pos?: { x?: number; y?: number; z?: number } }>) {
  return players.map((p) => ({
    name: p.name,
    team: p.team,
    role: p.role,
    x: typeof p.pos?.x === 'number' ? p.pos.x : 0,
    y: typeof p.pos?.y === 'number' ? p.pos.y : 0,
    z: typeof p.pos?.z === 'number' ? p.pos.z : 0,
  }));
}

async function mirrorTelemetrySnapshot(payload: {
  sessionId: string;
  timestamp: number;
  eventType: 'play_stopped' | 'full_time_positions_captured';
  match: {
    scoreA: number;
    scoreB: number;
    phase?: string;
    half?: 1 | 2;
    elapsedInHalf?: number;
    isLive: boolean;
    teamAName?: string;
    teamBName?: string;
  };
  positions: Array<{
    name?: string;
    team?: 'A' | 'B';
    role?: string;
    x: number;
    y: number;
    z: number;
  }>;
}) {
  if (!hasDevServer()) return;
  try {
    await fetch('/__telemetry/mirror-snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Dev server mirror endpoint might not exist; silently ignore.
  }
}

async function mirrorTelemetryBatch(payload: {
  sessionId: string;
  timestamp: number;
  matchSnapshot?: MatchSnapshotRow | null;
  playerSnapshots: PlayerSnapshotRow[];
  performanceSample: {
    sessionId: string;
    timestamp: number;
    frameDeltaMs: number;
    fpsEstimate: number;
    heapUsedBytes?: number;
    heapLimitBytes?: number;
  };
  telemetryEvents: TelemetryEventRow[];
}) {
  if (!hasDevServer()) return;
  try {
    await fetch('/__telemetry/mirror-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Dev server mirror endpoint might not exist; silently ignore.
  }
}

export type DiskMirrorStatus = {
  ok: boolean;
  summaryCount: number;
  snapshotCount: number;
  batchCount: number;
  latestSessionId: string | null;
  latestBatchAt: number | null;
  latestSnapshotAt: number | null;
  latestSummaryAt: number | null;
  latestSnapshotEventType: string | null;
  latestPhase: string | null;
  latestScore: {
    scoreA: number;
    scoreB: number;
  } | null;
};

export type MirroredRecoveryPayload = {
  ok: boolean;
  sessionId: string | null;
  summaryCount: number;
  snapshotCount: number;
  batchCount: number;
  latestSummary: Record<string, unknown> | null;
  latestSnapshot: Record<string, unknown> | null;
  latestBatch: {
    sessionId: string;
    timestamp: number;
    matchSnapshot: Record<string, unknown> | null;
    performanceSample: Record<string, unknown> | null;
    telemetryEventTypes: string[];
    playerSnapshotCount: number;
    samplePlayerNames: string[];
  } | null;
};

export async function getDiskMirrorStatus(): Promise<DiskMirrorStatus | null> {
  if (!hasDevServer()) return null;
  try {
    const response = await fetch('/__telemetry/mirror-status');
    if (!response.ok) return null;
    return await response.json() as DiskMirrorStatus;
  } catch {
    return null;
  }
}

export async function recoverLatestMirroredSession(): Promise<MirroredRecoveryPayload | null> {
  if (!hasDevServer()) return null;
  try {
    const response = await fetch('/__telemetry/recover-latest');
    if (!response.ok) return null;
    return await response.json() as MirroredRecoveryPayload;
  } catch {
    return null;
  }
}

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
  private lastDiskMirrorAt = 0;
  private prevMatchSnapshot: MatchSnapshotLike | null = null;
  private fullTimeCaptured = false;
  private context: TelemetryContext = {};

  private async rotateSessionForMatch(match: MatchSnapshotLike, reason: string) {
    const previousSessionId = this.sessionId;
    if (previousSessionId) {
      await telemetryDb.sessions.update(previousSessionId, { endedAt: Date.now() });
    }

    this.context = {
      ...this.context,
      teamAName: match.teamAName || this.context.teamAName,
      teamBName: match.teamBName || this.context.teamBName,
      teamAFormation: match.teamAFormation || this.context.teamAFormation,
      teamBFormation: match.teamBFormation || this.context.teamBFormation,
      notes: `Auto-rotated telemetry session (${reason})`,
    };

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
    this.prevMatchSnapshot = null;
    this.fullTimeCaptured = false;
    this.lastHeartbeatAt = Date.now();

    await telemetryDb.telemetryEvents.add({
      sessionId: this.sessionId,
      timestamp: Date.now(),
      eventType: 'session_rotated',
      payloadJson: JSON.stringify({
        reason,
        previousSessionId,
        nextSessionId: this.sessionId,
        teamAName: this.context.teamAName,
        teamBName: this.context.teamBName,
      }),
    });
  }

  isRecording() {
    return this.sessionId !== null && this.timerId !== null;
  }

  getSessionId() {
    return this.sessionId;
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
    this.fullTimeCaptured = false;

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

      if (match && match.teamAName && match.teamBName) {
        const contextTeamA = this.context.teamAName;
        const contextTeamB = this.context.teamBName;
        const teamsMismatch =
          !!contextTeamA &&
          !!contextTeamB &&
          (match.teamAName !== contextTeamA || match.teamBName !== contextTeamB);
        if (teamsMismatch) {
          await this.rotateSessionForMatch(match, 'team_name_mismatch');
        }
      }

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
            headersA: match.headersA ?? 0,
            headersB: match.headersB ?? 0,
            passesA: match.passesA ?? 0,
            passesB: match.passesB ?? 0,
            passesCompletedA: match.passesCompletedA ?? 0,
            passesCompletedB: match.passesCompletedB ?? 0,
            foulsA: match.foulsA ?? 0,
            foulsB: match.foulsB ?? 0,
            penaltiesAwardedA: match.penaltiesAwardedA ?? 0,
            penaltiesAwardedB: match.penaltiesAwardedB ?? 0,
            penaltiesScoredA: match.penaltiesScoredA ?? 0,
            penaltiesScoredB: match.penaltiesScoredB ?? 0,
            penaltiesSavedA: match.penaltiesSavedA ?? 0,
            penaltiesSavedB: match.penaltiesSavedB ?? 0,
            penaltiesMissedA: match.penaltiesMissedA ?? 0,
            penaltiesMissedB: match.penaltiesMissedB ?? 0,
            penaltyXgA: match.penaltyXgA ?? 0,
            penaltyXgB: match.penaltyXgB ?? 0,
            cornersA: match.cornersA ?? 0,
            cornersB: match.cornersB ?? 0,
            throwInsA: match.throwInsA ?? 0,
            throwInsB: match.throwInsB ?? 0,
            tacklesWonA: match.tacklesWonA ?? 0,
            tacklesWonB: match.tacklesWonB ?? 0,
            clearancesA: match.clearancesA ?? 0,
            clearancesB: match.clearancesB ?? 0,
            possessionA: match.possessionA ?? 50,
            possessionB: match.possessionB ?? 50,
            gkDistributionsA: match.gkDistributionsA ?? 0,
            gkDistributionsB: match.gkDistributionsB ?? 0,
            gkDistCompletedA: match.gkDistCompletedA ?? 0,
            gkDistCompletedB: match.gkDistCompletedB ?? 0,
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
          statsJson: JSON.stringify(toTelemetryStats(offense?.stats, offense?.pos)),
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
          statsJson: JSON.stringify(toTelemetryStats(defense?.stats, defense?.pos)),
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
        statsJson: JSON.stringify(toTelemetryStats(p?.stats, p?.pos)),
        mls2025Json: JSON.stringify(null),
      }));

      const perf = (performance as any).memory;
      const perfRow = {
        sessionId: this.sessionId!,
        timestamp: now,
        frameDeltaMs,
        fpsEstimate,
        heapUsedBytes: perf?.usedJSHeapSize,
        heapLimitBytes: perf?.jsHeapSizeLimit,
      };
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
            match.savesB !== this.prevMatchSnapshot.savesB ||
            match.headersA !== this.prevMatchSnapshot.headersA ||
            match.headersB !== this.prevMatchSnapshot.headersB
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
                  headersA: this.prevMatchSnapshot.headersA ?? 0,
                  headersB: this.prevMatchSnapshot.headersB ?? 0,
                },
                to: {
                  shotsA: match.shotsA ?? 0,
                  shotsB: match.shotsB ?? 0,
                  shotsOnTargetA: match.shotsOnTargetA ?? 0,
                  shotsOnTargetB: match.shotsOnTargetB ?? 0,
                  savesA: match.savesA ?? 0,
                  savesB: match.savesB ?? 0,
                  headersA: match.headersA ?? 0,
                  headersB: match.headersB ?? 0,
                },
              }),
            });
          }
          const prevShotSeq = (this.prevMatchSnapshot as any).lastShotTelemetry?.seq ?? 0;
          const nextShotSeq = (match as any).lastShotTelemetry?.seq ?? 0;
          if (nextShotSeq > prevShotSeq && (match as any).lastShotTelemetry) {
            eventRows.push({
              sessionId: this.sessionId,
              timestamp: now,
              eventType: 'shot_style_taken',
              payloadJson: JSON.stringify((match as any).lastShotTelemetry),
            });
          }

          const prevKickSeq = (this.prevMatchSnapshot as any).lastKeeperKickTelemetry?.seq ?? 0;
          const nextKickSeq = (match as any).lastKeeperKickTelemetry?.seq ?? 0;
          if (nextKickSeq > prevKickSeq && (match as any).lastKeeperKickTelemetry) {
            eventRows.push({
              sessionId: this.sessionId,
              timestamp: now,
              eventType: 'keeper_kick',
              payloadJson: JSON.stringify((match as any).lastKeeperKickTelemetry),
            });
          }

          const prevPassLoopSeq = (this.prevMatchSnapshot as any).lastPassLoopTelemetry?.seq ?? 0;
          const nextPassLoopSeq = (match as any).lastPassLoopTelemetry?.seq ?? 0;
          if (nextPassLoopSeq > prevPassLoopSeq && (match as any).lastPassLoopTelemetry) {
            eventRows.push({
              sessionId: this.sessionId,
              timestamp: now,
              eventType: 'pass_loop_detected',
              payloadJson: JSON.stringify((match as any).lastPassLoopTelemetry),
            });
          }

          if (!!match.isLive !== !!this.prevMatchSnapshot.isLive) {
            const positionSnapshot = toPositionSnapshot(allPlayers);
            eventRows.push({
              sessionId: this.sessionId,
              timestamp: now,
              eventType: !!match.isLive ? 'play_started' : 'play_stopped',
              payloadJson: JSON.stringify({
                phase: match.phase,
                half: match.half,
                elapsedInHalf: match.elapsedInHalf,
                playerCount: positionSnapshot.length,
                positions: positionSnapshot,
              }),
            });

            if (!match.isLive) {
              void mirrorTelemetrySnapshot({
                sessionId: this.sessionId,
                timestamp: now,
                eventType: 'play_stopped',
                match: {
                  scoreA: match.scoreA ?? 0,
                  scoreB: match.scoreB ?? 0,
                  phase: match.phase,
                  half: match.half,
                  elapsedInHalf: match.elapsedInHalf,
                  isLive: !!match.isLive,
                  teamAName: match.teamAName,
                  teamBName: match.teamBName,
                },
                positions: positionSnapshot,
              });
            }
          }

          if (match.phase === 'FULL_TIME' && !this.fullTimeCaptured) {
            const positionSnapshot = toPositionSnapshot(allPlayers);
            eventRows.push({
              sessionId: this.sessionId,
              timestamp: now,
              eventType: 'full_time_positions_captured',
              payloadJson: JSON.stringify({
                scoreA: match.scoreA ?? 0,
                scoreB: match.scoreB ?? 0,
                elapsedInHalf: match.elapsedInHalf,
                playerCount: positionSnapshot.length,
                positions: positionSnapshot,
              }),
            });

            void mirrorTelemetrySnapshot({
              sessionId: this.sessionId,
              timestamp: now,
              eventType: 'full_time_positions_captured',
              match: {
                scoreA: match.scoreA ?? 0,
                scoreB: match.scoreB ?? 0,
                phase: match.phase,
                half: match.half,
                elapsedInHalf: match.elapsedInHalf,
                isLive: !!match.isLive,
                teamAName: match.teamAName,
                teamBName: match.teamBName,
              },
              positions: positionSnapshot,
            });

            this.fullTimeCaptured = true;
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
          lastShotTelemetry: (match as any).lastShotTelemetry || null,
          lastKeeperKickTelemetry: (match as any).lastKeeperKickTelemetry || null,
          lastPassLoopTelemetry: (match as any).lastPassLoopTelemetry || null,
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
          await telemetryDb.performanceSamples.add(perfRow);
          if (eventRows.length > 0) {
            await telemetryDb.telemetryEvents.bulkAdd(eventRows);
          }
        }
      );

      if (now - this.lastDiskMirrorAt >= 2000) {
        this.lastDiskMirrorAt = now;
        void mirrorTelemetryBatch({
          sessionId: this.sessionId!,
          timestamp: now,
          matchSnapshot: matchRow,
          playerSnapshots: [...playerRows, ...allPlayerRows],
          performanceSample: perfRow,
          telemetryEvents: eventRows,
        });
      }
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
    this.fullTimeCaptured = false;
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
    // Auto-mirror shot events to disk
    if (eventType === 'shot_style_taken' && hasDevServer()) {
      fetch('/__telemetry/shot-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([payload]),
      }).catch(() => {});
    }
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
  headersA: number;
  headersB: number;
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

export type PositionSequenceOptions = {
  sessionId?: string;
  seconds?: number;
  anchor?: 'latest' | 'pause' | 'full_time';
};

export type PositionFrame = {
  timestamp: number;
  players: PlayerPositionLike[];
};

export type PositionSequenceResult = {
  sessionId: string;
  anchor: 'latest' | 'pause' | 'full_time';
  seconds: number;
  fromTimestamp: number;
  toTimestamp: number;
  frameCount: number;
  frames: PositionFrame[];
};

export type MovementSummaryRow = {
  name: string;
  team?: 'A' | 'B';
  role?: string;
  samples: number;
  distanceMeters: number;
  avgSpeedMps: number;
  maxStepMps: number;
};

export type MovementSummaryResult = {
  sessionId: string;
  anchor: 'latest' | 'pause' | 'full_time';
  seconds: number;
  frameCount: number;
  players: MovementSummaryRow[];
};

function parsePositionFromStatsJson(statsJson?: string): { x: number; y: number; z: number } | null {
  if (!statsJson) return null;
  try {
    const parsed = JSON.parse(statsJson) as {
      position?: { x?: number; y?: number; z?: number };
      x?: number;
      y?: number;
      z?: number;
      posX?: number;
      posY?: number;
      posZ?: number;
    };
    const x =
      typeof parsed.position?.x === 'number' ? parsed.position.x
      : typeof parsed.x === 'number' ? parsed.x
      : typeof parsed.posX === 'number' ? parsed.posX
      : null;
    const y =
      typeof parsed.position?.y === 'number' ? parsed.position.y
      : typeof parsed.y === 'number' ? parsed.y
      : typeof parsed.posY === 'number' ? parsed.posY
      : null;
    const z =
      typeof parsed.position?.z === 'number' ? parsed.position.z
      : typeof parsed.z === 'number' ? parsed.z
      : typeof parsed.posZ === 'number' ? parsed.posZ
      : null;
    if (x === null || y === null || z === null) return null;
    return { x, y, z };
  } catch {
    return null;
  }
}

async function resolveSessionIdOrLatest(sessionId?: string) {
  if (sessionId) return sessionId;
  const latest = await telemetryDb.sessions.orderBy('startedAt').last();
  return latest?.id || null;
}

async function resolveAnchorTimestamp(sessionId: string, anchor: 'latest' | 'pause' | 'full_time') {
  if (anchor === 'latest') {
    const latestPlayer = await telemetryDb.playerSnapshots.where('sessionId').equals(sessionId).last();
    return latestPlayer?.timestamp || null;
  }

  if (anchor === 'pause') {
    const pausedEvent = await telemetryDb.telemetryEvents
      .where('sessionId')
      .equals(sessionId)
      .reverse()
      .filter((e) => e.eventType === 'play_stopped')
      .first();
    return pausedEvent?.timestamp || null;
  }

  const fullTimeEvent = await telemetryDb.telemetryEvents
    .where('sessionId')
    .equals(sessionId)
    .reverse()
    .filter((e) => e.eventType === 'full_time_positions_captured')
    .first();
  if (fullTimeEvent) return fullTimeEvent.timestamp;

  const fullTimeSnapshot = await telemetryDb.matchSnapshots
    .where('sessionId')
    .equals(sessionId)
    .reverse()
    .filter((m) => m.phase === 'FULL_TIME')
    .first();
  return fullTimeSnapshot?.timestamp || null;
}

export async function getPositionSequence(options: PositionSequenceOptions = {}): Promise<PositionSequenceResult | null> {
  const sessionId = await resolveSessionIdOrLatest(options.sessionId);
  if (!sessionId) return null;

  const seconds = Math.max(1, Math.min(120, options.seconds ?? 20));
  const anchor = options.anchor ?? 'latest';
  const anchorTimestamp = await resolveAnchorTimestamp(sessionId, anchor);
  if (!anchorTimestamp) return null;

  const fromTimestamp = anchorTimestamp - seconds * 1000;
  const rows = await telemetryDb.playerSnapshots
    .where('sessionId')
    .equals(sessionId)
    .filter((p) => p.side === 'all' && p.timestamp >= fromTimestamp && p.timestamp <= anchorTimestamp)
    .toArray();

  const grouped = new Map<number, PlayerPositionLike[]>();
  for (const row of rows) {
    const pos = parsePositionFromStatsJson(row.statsJson);
    if (!pos) continue;
    const list = grouped.get(row.timestamp) || [];
    list.push({
      name: row.name,
      team: row.team,
      role: row.role,
      x: pos.x,
      y: pos.y,
      z: pos.z,
    });
    grouped.set(row.timestamp, list);
  }

  const frames: PositionFrame[] = Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([timestamp, players]) => ({ timestamp, players }));

  return {
    sessionId,
    anchor,
    seconds,
    fromTimestamp,
    toTimestamp: anchorTimestamp,
    frameCount: frames.length,
    frames,
  };
}

export async function summarizeMovement(options: PositionSequenceOptions = {}): Promise<MovementSummaryResult | null> {
  const sequence = await getPositionSequence(options);
  if (!sequence || sequence.frames.length < 2) return null;

  const byPlayer = new Map<string, Array<{ t: number; x: number; y: number; z: number; team?: 'A' | 'B'; role?: string; name: string }>>();
  for (const frame of sequence.frames) {
    for (const p of frame.players) {
      const name = p.name || 'Unknown';
      const key = `${p.team || '?'}::${name}`;
      const list = byPlayer.get(key) || [];
      list.push({ t: frame.timestamp, x: p.x, y: p.y, z: p.z, team: p.team, role: p.role, name });
      byPlayer.set(key, list);
    }
  }

  const players: MovementSummaryRow[] = [];
  for (const list of byPlayer.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.t - b.t);

    let distanceMeters = 0;
    let maxStepMps = 0;
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const curr = list[i];
      const dt = Math.max(0.001, (curr.t - prev.t) / 1000);
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const dz = curr.z - prev.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const mps = dist / dt;
      distanceMeters += dist;
      if (mps > maxStepMps) maxStepMps = mps;
    }

    const totalSeconds = Math.max(0.001, (list[list.length - 1].t - list[0].t) / 1000);
    players.push({
      name: list[0].name,
      team: list[0].team,
      role: list[0].role,
      samples: list.length,
      distanceMeters,
      avgSpeedMps: distanceMeters / totalSeconds,
      maxStepMps,
    });
  }

  players.sort((a, b) => b.distanceMeters - a.distanceMeters);
  return {
    sessionId: sequence.sessionId,
    anchor: sequence.anchor,
    seconds: sequence.seconds,
    frameCount: sequence.frameCount,
    players,
  };
}

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
    headersA: snapshot.headersA,
    headersB: snapshot.headersB,
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

export async function getLatestSessionSummary(sessionId?: string | null) {
  const session = sessionId
    ? await telemetryDb.sessions.get(sessionId)
    : await telemetryDb.sessions.orderBy('startedAt').last();
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
  mirrorStatus: () => Promise<DiskMirrorStatus | null>;
  recoverMirror: () => Promise<MirroredRecoveryPayload | null>;
  clearAll: () => Promise<void>;
  addBaseline: typeof addRealWorldBaseline;
  addCorrection: typeof addCorrectionAction;
  compareDrift: typeof buildDriftDashboard;
  generateRecommendations: typeof generateDriftRecommendations;
  seedBaselines: typeof seedMLS2025Baselines;
  positions: (options?: PositionSequenceOptions) => Promise<PositionSequenceResult | null>;
  movement: (options?: PositionSequenceOptions) => Promise<MovementSummaryResult | null>;
  shotStats: () => Promise<ShotStatsResult>;
  dumpShotEvents: () => Promise<{ ok: boolean; appended: number }>;
};

declare global {
  interface Window {
    pslTelemetry?: TelemetryDebugApi;
  }
}

type ShotStatsResult = {
  totalShots: number;
  avgDistance: number;
  byTeam: Record<string, { avg: number; count: number }>;
  byStyle: Record<string, { avg: number; count: number }>;
};

async function getShotStats(): Promise<ShotStatsResult> {
  const rows = await telemetryDb.telemetryEvents
    .where('eventType')
    .equals('shot_style_taken')
    .toArray();
  const events = rows.map(r => JSON.parse(r.payloadJson));
  const distances = events.map(e => e.distToGoal).filter((d): d is number => typeof d === 'number');
  const avg = distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : 0;
  const byTeam: Record<string, number[]> = {};
  const byStyle: Record<string, number[]> = {};
  for (const e of events) {
    const t = e.team || 'unknown';
    (byTeam[t] ??= []).push(e.distToGoal ?? 0);
    const s = e.style || 'unknown';
    (byStyle[s] ??= []).push(e.distToGoal ?? 0);
  }
  const summarize = (map: Record<string, number[]>) => {
    const out: Record<string, { avg: number; count: number }> = {};
    for (const [k, ds] of Object.entries(map)) {
      out[k] = { avg: +(ds.reduce((a, b) => a + b, 0) / ds.length).toFixed(2), count: ds.length };
    }
    return out;
  };
  return { totalShots: events.length, avgDistance: +avg.toFixed(2), byTeam: summarize(byTeam), byStyle: summarize(byStyle) };
}

async function dumpShotEventsToFile(): Promise<{ ok: boolean; appended: number }> {
  const rows = await telemetryDb.telemetryEvents
    .where('eventType')
    .equals('shot_style_taken')
    .toArray();
  if (rows.length === 0 || !hasDevServer()) return { ok: true, appended: 0 };
  const payloads = rows.map(r => JSON.parse(r.payloadJson));
  const res = await fetch('/__telemetry/shot-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payloads),
  });
  return await res.json();
}

/**
 * POST the latest session summary to the dev-server mirror endpoint
 * so it's written to match-results.json on disk.
 * Silently no-ops in production (endpoint won't exist).
 */
export async function mirrorMatchSummary(sessionId?: string | null): Promise<boolean> {
  if (!hasDevServer()) return false;
  try {
    const summary = await getLatestSessionSummary(sessionId);
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
    mirrorStatus: getDiskMirrorStatus,
    recoverMirror: recoverLatestMirroredSession,
    clearAll: clearTelemetryDatabase,
    addBaseline: addRealWorldBaseline,
    addCorrection: addCorrectionAction,
    compareDrift: buildDriftDashboard,
    generateRecommendations: generateDriftRecommendations,
    seedBaselines: seedMLS2025Baselines,
    positions: getPositionSequence,
    movement: summarizeMovement,
    shotStats: getShotStats,
    dumpShotEvents: dumpShotEventsToFile,
  };
}
