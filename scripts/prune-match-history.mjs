#!/usr/bin/env node

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dbPath = path.join(rootDir, 'psl.db');
const limit = Math.min(Math.max(1, Number.parseInt(process.argv[2] || '10', 10)), 10);

if (!fs.existsSync(dbPath)) {
  console.log(JSON.stringify({ ok: true, reason: 'missing_db', dbPath }));
  process.exit(0);
}

const sizeBefore = fs.statSync(dbPath).size;
const db = new Database(dbPath);

const count = (table) => {
  try {
    return db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
  } catch {
    return null;
  }
};

const before = {
  matches: count('match_results'),
  events: count('telemetry_events'),
};

db.transaction(() => {
  db.prepare(`
    DELETE FROM telemetry_events
    WHERE session_id NOT IN (
      SELECT session_id
      FROM match_results
      WHERE session_id IS NOT NULL AND session_id != ''
      ORDER BY timestamp DESC, id DESC
      LIMIT ?
    )
  `).run(limit);
  db.prepare(`
    DELETE FROM match_results
    WHERE id NOT IN (
      SELECT id
      FROM match_results
      ORDER BY timestamp DESC, id DESC
      LIMIT ?
    )
  `).run(limit);
})();

db.pragma('wal_checkpoint(TRUNCATE)');
db.exec('VACUUM');

const after = {
  matches: count('match_results'),
  events: count('telemetry_events'),
};
db.close();

const sizeAfter = fs.statSync(dbPath).size;
console.log(JSON.stringify({
  ok: true,
  limit,
  before,
  after,
  sizeBefore,
  sizeAfter,
  savedBytes: sizeBefore - sizeAfter,
}, null, 2));
