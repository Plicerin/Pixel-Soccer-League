import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.resolve(__dirname, '..', '..', 'psl.db');

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

export function insertMatchResult(row: MatchResultRow) {
  const db = getDb();
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
  `).run(row);
}

export function getRecentMatches(limit = 50): MatchResultRow[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM match_results ORDER BY timestamp DESC LIMIT ?'
  ).all(limit) as MatchResultRow[];
}
