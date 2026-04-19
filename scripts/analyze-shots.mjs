#!/usr/bin/env node
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dbPath = path.join(rootDir, 'psl.db');

const db = new Database(dbPath);

// Get last 5 matches
const matches = db.prepare('SELECT * FROM match_results ORDER BY timestamp DESC LIMIT 5').all();

// Read shot events
const shotEventsPath = path.join(rootDir, 'shot-events.ndjson');
let allShots = [];
if (fs.existsSync(shotEventsPath)) {
  const lines = fs.readFileSync(shotEventsPath, 'utf-8').split('\n').filter(l => l.trim());
  allShots = lines.map(l => JSON.parse(l));
}

console.log('=== Last 2 Matches (Target for Telemetry Analysis) ===\n');

// Focus on last 2 matches: SKC vs Seattle and Portland vs New England
const targetMatches = matches.slice(0, 2);

for (let i = 0; i < targetMatches.length; i++) {
  const m = targetMatches[i];
  console.log(`${i === 0 ? '🎯 MOST RECENT:' : 'Previous:'} ${m.team_a_name} ${m.score_a} - ${m.score_b} ${m.team_b_name}`);
  console.log(`   Session ID: ${m.session_id}`);
  console.log(`   Shots: A=${m.shots_a}(${m.shots_on_target_a}OT), B=${m.shots_b}(${m.shots_on_target_b}OT)`);
  console.log(`   Time: ${new Date(m.timestamp).toISOString()}`);

  // Try to find shots for this match by session ID
  const matchShots = allShots.filter(s => {
    // Try to match by session ID or recent timestamp proximity
    return s.sessionId === m.session_id ||
           (Math.abs(s.timestamp - m.timestamp) < 5000 &&
            (s.team === m.team_a_name || s.team === m.team_b_name));
  });

  if (matchShots.length > 0) {
    const distances = matchShots.map(s => s.distToGoal).filter(d => typeof d === 'number');
    const avg = distances.reduce((a, b) => a + b, 0) / distances.length;
    const onTarget = matchShots.filter(s => s.onTarget).length;

    console.log(`   📊 Shot Analysis: ${matchShots.length} events captured`);
    console.log(`      - Avg distance: ${avg.toFixed(2)} units (1 unit ≈ 1.8-2 yards)`);
    console.log(`      - On target: ${onTarget}/${matchShots.length}`);
    console.log(`      - Range: ${Math.min(...distances).toFixed(2)} - ${Math.max(...distances).toFixed(2)} units`);
  } else {
    console.log(`   ⚠️  No shot events found in database`);
  }
  console.log();
}

// Summary of all teams
console.log('=== All Recent Matches Summary ===\n');
for (const m of matches) {
  const shotAccuracy = m.shots_on_target_a > 0 ? ((m.score_a / m.shots_on_target_a) * 100).toFixed(0) : 'N/A';
  console.log(`${m.team_a_name.padEnd(20)} ${m.score_a}-${m.score_b} ${m.team_b_name.padStart(20)}`);
  console.log(`  Shots: ${m.shots_a}(${m.shots_on_target_a}OT) | Accuracy: ${shotAccuracy}%\n`);
}
