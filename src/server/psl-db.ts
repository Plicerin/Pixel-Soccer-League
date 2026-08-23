import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { filterGhostMatchRows, isGhostMatchRow } from './matchFilters';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '..', '..', 'psl.db');
const MATCH_HISTORY_LIMIT = 10;

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.exec(SCHEMA);
  return _db;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS live_tuning (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ts INTEGER NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS match_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT UNIQUE,
  timestamp INTEGER NOT NULL,
  team_a_name TEXT,
  team_b_name TEXT,
  team_a_formation TEXT,
  team_b_formation TEXT,
  score_a INTEGER DEFAULT 0,
  score_b INTEGER DEFAULT 0,
  shots_a INTEGER DEFAULT 0,
  shots_b INTEGER DEFAULT 0,
  shots_on_target_a INTEGER DEFAULT 0,
  shots_on_target_b INTEGER DEFAULT 0,
  saves_a INTEGER DEFAULT 0,
  saves_b INTEGER DEFAULT 0,
  headers_a INTEGER DEFAULT 0,
  headers_b INTEGER DEFAULT 0,
  possession_a INTEGER DEFAULT 50,
  phase TEXT,
  half INTEGER,
  elapsed_in_half REAL,
  bundle_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_match_results_timestamp_desc
ON match_results(timestamp DESC);

CREATE TABLE IF NOT EXISTS telemetry_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  timestamp DATETIME NOT NULL,
  session_id TEXT NOT NULL,
  player_id TEXT,
  payload TEXT
);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_session_id
ON telemetry_events(session_id, id DESC);
`;

// ── Live tuning relay ──

export function upsertLiveTuning(ts: number, payloadJson: string) {
  const db = getDb();
  db.prepare(`
    INSERT INTO live_tuning (id, ts, payload_json) VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET ts = excluded.ts, payload_json = excluded.payload_json
  `).run(ts, payloadJson);
}

export function getLiveTuning(): { ts: number; payload_json: string } | undefined {
  const db = getDb();
  return db.prepare('SELECT ts, payload_json FROM live_tuning WHERE id = 1').get() as any;
}

export function clearLiveTuning() {
  const db = getDb();
  db.prepare('DELETE FROM live_tuning WHERE id = 1').run();
}

// ── Match results ──

export interface MatchResultRow {
  session_id: string;
  timestamp: number;
  team_a_name: string;
  team_b_name: string;
  team_a_formation: string;
  team_b_formation: string;
  score_a: number;
  score_b: number;
  shots_a: number;
  shots_b: number;
  shots_on_target_a: number;
  shots_on_target_b: number;
  saves_a: number;
  saves_b: number;
  headers_a: number;
  headers_b: number;
  possession_a: number;
  phase: string;
  half: number;
  elapsed_in_half: number;
  bundle_json?: string;
}

export function insertMatchResult(row: MatchResultRow): boolean {
  if (isGhostMatchRow(row)) return false;
  const db = getDb();
  db.transaction((match: MatchResultRow) => {
    db.prepare(`
      INSERT OR REPLACE INTO match_results (
        session_id, timestamp, team_a_name, team_b_name,
        team_a_formation, team_b_formation,
        score_a, score_b, shots_a, shots_b,
        shots_on_target_a, shots_on_target_b,
        saves_a, saves_b, headers_a, headers_b,
        possession_a, phase, half, elapsed_in_half, bundle_json
      ) VALUES (
        @session_id, @timestamp, @team_a_name, @team_b_name,
        @team_a_formation, @team_b_formation,
        @score_a, @score_b, @shots_a, @shots_b,
        @shots_on_target_a, @shots_on_target_b,
        @saves_a, @saves_b, @headers_a, @headers_b,
        @possession_a, @phase, @half, @elapsed_in_half, @bundle_json
      )
    `).run(match);
    pruneMatchHistoryRows(db);
  })(row);
  return true;
}

export function getRecentMatches(limit = 50): MatchResultRow[] {
  const db = getDb();
  const cappedLimit = Math.min(Math.max(1, limit), MATCH_HISTORY_LIMIT);
  const fetchLimit = Math.min(Math.max(cappedLimit * 4, cappedLimit), MATCH_HISTORY_LIMIT * 4);
  const rows = db.prepare(
    'SELECT * FROM match_results ORDER BY timestamp DESC LIMIT ?'
  ).all(fetchLimit) as MatchResultRow[];
  return filterGhostMatchRows(rows).slice(0, cappedLimit);
}

export function getTelemetryEvents(sessionId: string, limit = 10000): Array<Record<string, unknown>> {
  if (!sessionId) return [];
  const db = getDb();
  return db.prepare(
    'SELECT * FROM telemetry_events WHERE session_id = ? ORDER BY id DESC LIMIT ?'
  ).all(sessionId, Math.min(Math.max(1, limit), 10000)) as Array<Record<string, unknown>>;
}

export function pruneMatchHistory(limit = MATCH_HISTORY_LIMIT) {
  const db = getDb();
  db.transaction(() => pruneMatchHistoryRows(db, limit))();
}

function pruneMatchHistoryRows(db: Database.Database, limit = MATCH_HISTORY_LIMIT) {
  const keep = Math.min(Math.max(1, limit), MATCH_HISTORY_LIMIT);
  db.prepare(`
    DELETE FROM telemetry_events
    WHERE session_id NOT IN (
      SELECT session_id
      FROM match_results
      WHERE session_id IS NOT NULL AND session_id != ''
      ORDER BY timestamp DESC, id DESC
      LIMIT ?
    )
  `).run(keep);
  db.prepare(`
    DELETE FROM match_results
    WHERE id NOT IN (
      SELECT id
      FROM match_results
      ORDER BY timestamp DESC, id DESC
      LIMIT ?
    )
  `).run(keep);
}
