#!/usr/bin/env node
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dbPath = path.join(rootDir, 'psl.db');

const db = new Database(dbPath);
const matches = db.prepare('SELECT * FROM match_results ORDER BY timestamp DESC LIMIT 6').all();

console.log('=== COMPREHENSIVE TELEMETRY ANALYSIS ===\n');

for (const m of matches) {
  console.log(`${m.team_a_name} ${m.score_a}-${m.score_b} ${m.team_b_name}`);
  console.log(`Time: ${new Date(m.timestamp).toISOString().split('T')[1].slice(0, 8)}`);
  console.log(`Phase: ${m.phase || 'unknown'}`);

  // Shot efficiency
  const shotAccA = m.shots_a > 0 ? (m.shots_on_target_a / m.shots_a * 100).toFixed(0) : '0';
  const shotAccB = m.shots_b > 0 ? (m.shots_on_target_b / m.shots_b * 100).toFixed(0) : '0';
  const convA = m.shots_on_target_a > 0 ? (m.score_a / m.shots_on_target_a * 100).toFixed(0) : '0';
  const convB = m.shots_on_target_b > 0 ? (m.score_b / m.shots_on_target_b * 100).toFixed(0) : '0';

  console.log(`\nTeam A Stats:`);
  console.log(`  Shots: ${m.shots_a} | On Target: ${m.shots_on_target_a} (${shotAccA}%) | Goals: ${m.score_a} | Conversion: ${convA}%`);
  console.log(`  Headers: ${m.headers_a} | Possession: ${m.possession_a}%`);

  console.log(`Team B Stats:`);
  console.log(`  Shots: ${m.shots_b} | On Target: ${m.shots_on_target_b} (${shotAccB}%) | Goals: ${m.score_b} | Conversion: ${convB}%`);
  console.log(`  Headers: ${m.headers_b} | Possession: ${100 - m.possession_a}%`);

  // Defensive metrics
  const savesA = m.saves_a || 0;
  const savesB = m.saves_b || 0;
  console.log(`\nDefense:`);
  console.log(`  Team A Saves: ${savesA} | Team B Saves: ${savesB}`);

  console.log('---\n');
}

// Summary stats
console.log('=== LAST 6 MATCHES AGGREGATE ===\n');
let totalShotsA = 0, totalShotsB = 0, totalOnTargetA = 0, totalOnTargetB = 0;
let totalGoalsA = 0, totalGoalsB = 0, totalPossA = 0;
const count = matches.length;

for (const m of matches) {
  totalShotsA += m.shots_a || 0;
  totalShotsB += m.shots_b || 0;
  totalOnTargetA += m.shots_on_target_a || 0;
  totalOnTargetB += m.shots_on_target_b || 0;
  totalGoalsA += m.score_a || 0;
  totalGoalsB += m.score_b || 0;
  totalPossA += m.possession_a || 50;
}

const avgAccA = totalShotsA > 0 ? (totalOnTargetA / totalShotsA * 100).toFixed(1) : '0';
const avgAccB = totalShotsB > 0 ? (totalOnTargetB / totalShotsB * 100).toFixed(1) : '0';
const avgConvA = totalOnTargetA > 0 ? (totalGoalsA / totalOnTargetA * 100).toFixed(1) : '0';
const avgConvB = totalOnTargetB > 0 ? (totalGoalsB / totalOnTargetB * 100).toFixed(1) : '0';
const avgPossA = (totalPossA / count).toFixed(1);

console.log(`Team A Averages:`);
console.log(`  Shots/match: ${(totalShotsA/count).toFixed(1)} | Accuracy (OT%): ${avgAccA}% | Conversion: ${avgConvA}%`);
console.log(`  Possession: ${avgPossA}% | Goals: ${(totalGoalsA/count).toFixed(2)}/match`);

console.log(`\nTeam B Averages:`);
console.log(`  Shots/match: ${(totalShotsB/count).toFixed(1)} | Accuracy (OT%): ${avgAccB}% | Conversion: ${avgConvB}%`);
console.log(`  Possession: ${(100-avgPossA).toFixed(1)}% | Goals: ${(totalGoalsB/count).toFixed(2)}/match`);

console.log(`\nGoal Differential: ${(totalGoalsA - totalGoalsB).toFixed(0)}`);
