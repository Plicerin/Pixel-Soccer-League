#!/usr/bin/env node

import express from 'express';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const port = Number(process.env.PORT || 3001);
const dbPath = path.join(rootDir, 'psl.db');
const matchHistoryLimit = 10;

const app = express();
app.use(express.json({ limit: '10mb' }));

let db = null;
const schema = `
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

function getDb() {
  if (db) return db;
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(schema);
  pruneMatchHistoryRows();
  return db;
}

function pruneMatchHistoryRows() {
  const database = db;
  if (!database) return;
  database.prepare(`
    DELETE FROM telemetry_events
    WHERE session_id NOT IN (
      SELECT session_id
      FROM match_results
      WHERE session_id IS NOT NULL AND session_id != ''
      ORDER BY timestamp DESC, id DESC
      LIMIT ?
    )
  `).run(matchHistoryLimit);
  database.prepare(`
    DELETE FROM match_results
    WHERE id NOT IN (
      SELECT id
      FROM match_results
      ORDER BY timestamp DESC, id DESC
      LIMIT ?
    )
  `).run(matchHistoryLimit);
}

function isSplashGhostPayload(parsed) {
  const bundle = parsed?.bundle || parsed;
  const snapshot = parsed?.snapshot || bundle?.snapshot || {};
  if (parsed?.sessionActive === false || bundle?.sessionActive === false || snapshot?.sessionActive === false) {
    return true;
  }
  const teamA = String(bundle?.teamA?.name || snapshot?.teamA?.name || '');
  const teamB = String(bundle?.teamB?.name || snapshot?.teamB?.name || '');
  const matchId = String(snapshot?.matchId || bundle?.matchId || bundle?.metadata?.matchId || '').trim();
  return teamA === 'Inter Miami' && teamB === 'LA Galaxy' && !matchId;
}

app.get('/__health', (_req, res) => {
  res.json({ ok: true, server: 'static-preview' });
});

app.post('/__tuning/push', (req, res) => {
  if (isSplashGhostPayload(req.body)) {
    getDb().prepare('DELETE FROM live_tuning WHERE id = 1').run();
    res.status(202).json({ ok: false, reason: 'ghost_live_tuning_rejected' });
    return;
  }
  getDb().prepare(`
    INSERT INTO live_tuning (id, ts, payload_json) VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET ts = excluded.ts, payload_json = excluded.payload_json
  `).run(req.body?.ts || Date.now(), JSON.stringify(req.body));
  res.json({ ok: true });
});

app.post('/__tuning/clear', (_req, res) => {
  getDb().prepare('DELETE FROM live_tuning WHERE id = 1').run();
  res.json({ ok: true });
});

app.get('/__tuning/pull', (_req, res) => {
  const row = getDb().prepare('SELECT ts, payload_json FROM live_tuning WHERE id = 1').get();
  if (!row) {
    res.status(204).end();
    return;
  }
  res.type('application/json').send(row.payload_json);
});

app.post('/__db/match-result', (req, res) => {
  let bundle = null;
  try {
    bundle = req.body?.bundle_json ? JSON.parse(req.body.bundle_json) : null;
  } catch {}
  if (isSplashGhostPayload(bundle) || isSplashGhostPayload(req.body)) {
    res.status(202).json({ ok: false, reason: 'ghost_match_rejected' });
    return;
  }
  const database = getDb();
  database.transaction((match) => {
    database.prepare(`
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
    pruneMatchHistoryRows();
  })(req.body);
  res.json({ ok: true });
});

app.get('/__db/matches', (req, res) => {
  const limit = Math.min(matchHistoryLimit, Math.max(1, Number.parseInt(String(req.query.limit || '10'), 10)));
  const rows = getDb()
    .prepare('SELECT * FROM match_results ORDER BY timestamp DESC, id DESC LIMIT ?')
    .all(limit);
  res.json(rows);
});

app.get('/__db/telemetry-events', (req, res) => {
  const sessionId = String(req.query.session_id || '');
  const limit = Math.min(10000, Math.max(1, Number.parseInt(String(req.query.limit || '10000'), 10)));
  if (!sessionId) {
    res.json([]);
    return;
  }
  const rows = getDb()
    .prepare('SELECT * FROM telemetry_events WHERE session_id = ? ORDER BY id DESC LIMIT ?')
    .all(sessionId, limit);
  res.json(rows);
});

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use((_req, res) => {
    res.status(503).send('dist/index.html is missing. Run npm run build first.');
  });
} else {
  app.use(express.static(distDir, {
    etag: true,
    maxAge: '1h',
  }));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Static preview server running on http://localhost:${port}/`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
