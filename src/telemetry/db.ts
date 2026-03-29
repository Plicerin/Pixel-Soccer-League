import Dexie, { type Table } from 'dexie';

export interface TelemetrySession {
  id: string;
  startedAt: number;
  endedAt?: number;
  teamAName?: string;
  teamBName?: string;
  teamAFormation?: string;
  teamBFormation?: string;
  notes?: string;
}

export interface MatchSnapshotRow {
  id?: number;
  sessionId: string;
  timestamp: number;
  scoreA: number;
  scoreB: number;
  shotsA: number;
  shotsB: number;
  shotsOnTargetA: number;
  shotsOnTargetB: number;
  savesA: number;
  savesB: number;
  offensiveTeam: 'A' | 'B';
  isLive: boolean;
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
}

export interface PlayerSnapshotRow {
  id?: number;
  sessionId: string;
  timestamp: number;
  side: 'offense' | 'defense' | 'all';
  team?: 'A' | 'B';
  rosterTeam?: string;
  name?: string;
  role?: string;
  statsJson: string;
  mls2025Json: string;
}

export interface PerformanceSampleRow {
  id?: number;
  sessionId: string;
  timestamp: number;
  frameDeltaMs: number;
  fpsEstimate: number;
  heapUsedBytes?: number;
  heapLimitBytes?: number;
}

export interface TelemetryEventRow {
  id?: number;
  sessionId: string;
  timestamp: number;
  eventType: string;
  payloadJson: string;
}

export interface RealWorldBaselineRow {
  id: string;
  metricKey: string;
  source: string;
  scopeType: 'global' | 'team' | 'player';
  scopeId?: string;
  value: number;
  unit?: string;
  recordedAt: number;
  notes?: string;
}

export interface CorrectionActionRow {
  id: string;
  sessionId?: string;
  metricKey: string;
  previousValue?: number;
  updatedValue: number;
  rationale: string;
  status: 'proposed' | 'applied' | 'reverted';
  appliedAt: number;
  notes?: string;
}

class PixelSoccerTelemetryDB extends Dexie {
  sessions!: Table<TelemetrySession, string>;
  matchSnapshots!: Table<MatchSnapshotRow, number>;
  playerSnapshots!: Table<PlayerSnapshotRow, number>;
  performanceSamples!: Table<PerformanceSampleRow, number>;
  telemetryEvents!: Table<TelemetryEventRow, number>;
  baselines!: Table<RealWorldBaselineRow, string>;
  corrections!: Table<CorrectionActionRow, string>;

  constructor() {
    super('PixelSoccerTelemetryDB');
    this.version(1).stores({
      sessions: 'id, startedAt, endedAt, teamAName, teamBName',
      matchSnapshots: '++id, sessionId, timestamp, phase, half, isLive',
      playerSnapshots: '++id, sessionId, timestamp, side, team, name, role',
      performanceSamples: '++id, sessionId, timestamp, fpsEstimate',
      telemetryEvents: '++id, sessionId, timestamp, eventType',
      baselines: 'id, metricKey, source, scopeType, scopeId, recordedAt',
      corrections: 'id, sessionId, metricKey, status, appliedAt',
    });
  }
}

export const telemetryDb = new PixelSoccerTelemetryDB();

export function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
