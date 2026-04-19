#!/usr/bin/env node
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dbPath = path.join(rootDir, 'psl.db');

const db = new Database(dbPath);
const matches = db.prepare('SELECT * FROM match_results ORDER BY timestamp DESC LIMIT 5').all();

console.log('=== Recent Matches ===\n');
for (const match of matches) {
  console.log(`ID: ${match.session_id || match.id}`);
  console.log(`  ${match.team_a_name} ${match.score_a} - ${match.score_b} ${match.team_b_name}`);
  console.log(`  Shots: ${match.shots_a}(${match.shots_on_target_a}OT) - ${match.shots_b}(${match.shots_on_target_b}OT)`);
  console.log(`  Time: ${new Date(match.timestamp).toISOString()}`);
  console.log();
}

// Try to read shot-events.ndjson
const shotEventsPath = path.join(rootDir, 'shot-events.ndjson');
if (fs.existsSync(shotEventsPath)) {
  console.log('=== Shot Events Analysis ===\n');
  const lines = fs.readFileSync(shotEventsPath, 'utf-8').split('\n').filter(l => l.trim());
  const events = lines.map(l => JSON.parse(l));

  // Group by session (most recent)
  const bySession = {};
  for (const e of events) {
    const sid = e.sessionId || e.team;
    if (!bySession[sid]) bySession[sid] = [];
    bySession[sid].push(e);
  }

  for (const [sid, shots] of Object.entries(bySession).slice(-2)) {
    const distances = shots.map(s => s.distToGoal).filter(d => typeof d === 'number');
    const avg = distances.length ? distances.reduce((a, b) => a + b, 0) / distances.length : 0;
    console.log(`Session ${sid}:`);
    console.log(`  Shots: ${shots.length}, Avg distance: ${avg.toFixed(2)} units`);
    console.log(`  Distance range: ${Math.min(...distances).toFixed(2)} - ${Math.max(...distances).toFixed(2)}`);
  }
}
