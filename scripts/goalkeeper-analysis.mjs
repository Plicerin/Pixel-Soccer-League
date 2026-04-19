#!/usr/bin/env node
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dbPath = path.join(rootDir, 'psl.db');

const db = new Database(dbPath);
const matches = db.prepare('SELECT * FROM match_results ORDER BY timestamp DESC LIMIT 10').all();

console.log('=== GOALKEEPER PERFORMANCE ANALYSIS ===\n');

let totalSavesA = 0, totalShotsOnTargetA = 0;
let totalSavesB = 0, totalShotsOnTargetB = 0;

for (const m of matches) {
  const saveRateA = m.shots_on_target_b > 0 ? (m.saves_a / m.shots_on_target_b * 100).toFixed(1) : '0';
  const saveRateB = m.shots_on_target_a > 0 ? (m.saves_b / m.shots_on_target_a * 100).toFixed(1) : '0';

  console.log(`${m.team_a_name} vs ${m.team_b_name}`);
  console.log(`  Team A GK: ${m.saves_a} saves / ${m.shots_on_target_b} shots on target = ${saveRateA}% save rate`);
  console.log(`  Team B GK: ${m.saves_b} saves / ${m.shots_on_target_a} shots on target = ${saveRateB}% save rate`);

  totalSavesA += m.saves_a || 0;
  totalSavesB += m.saves_b || 0;
  totalShotsOnTargetA += m.shots_on_target_a || 0;
  totalShotsOnTargetB += m.shots_on_target_b || 0;
}

console.log('\n=== AGGREGATE GOALKEEPER STATS (Last 10) ===\n');
const avgSaveRateA = totalShotsOnTargetB > 0 ? (totalSavesA / totalShotsOnTargetB * 100).toFixed(1) : '0';
const avgSaveRateB = totalShotsOnTargetA > 0 ? (totalSavesB / totalShotsOnTargetA * 100).toFixed(1) : '0';

console.log(`Team A Goalkeepers:`);
console.log(`  Total Saves: ${totalSavesA}`);
console.log(`  Shots Faced: ${totalShotsOnTargetB}`);
console.log(`  Average Save Rate: ${avgSaveRateA}%`);
console.log(`  Goals Allowed: ${totalShotsOnTargetB - totalSavesA}`);

console.log(`\nTeam B Goalkeepers:`);
console.log(`  Total Saves: ${totalSavesB}`);
console.log(`  Shots Faced: ${totalShotsOnTargetA}`);
console.log(`  Average Save Rate: ${avgSaveRateB}%`);
console.log(`  Goals Allowed: ${totalShotsOnTargetA - totalSavesB}`);

// Check keeper-experience data
const keeperExpPath = path.join(rootDir, 'keeper-experience.ndjson');
if (fs.existsSync(keeperExpPath)) {
  console.log('\n=== KEEPER EXPERIENCE / TRAINING DATA ===\n');
  const lines = fs.readFileSync(keeperExpPath, 'utf-8').split('\n').filter(l => l.trim());
  const exps = lines.map(l => JSON.parse(l));

  let positive = 0, negative = 0, neutral = 0;
  for (const e of exps) {
    if (e.reward > 0) positive++;
    else if (e.reward < 0) negative++;
    else neutral++;
  }

  console.log(`Keeper experience events: ${exps.length}`);
  console.log(`  Positive rewards: ${positive}`);
  console.log(`  Negative rewards: ${negative}`);
  console.log(`  Neutral: ${neutral}`);
}

// Professional MLS benchmark
console.log('\n=== COMPARISON TO PROFESSIONAL MLS ===\n');
console.log('Typical MLS Goalkeeper Save Rate: 65-75%');
console.log('Typical Professional Shot Conversion: 12-15% (so ~85-88% save rate)');
console.log(`\nCurrent System:`);
console.log(`  Team A Save Rate: ${avgSaveRateA}%`);
console.log(`  Team B Save Rate: ${avgSaveRateB}%`);

if (parseFloat(avgSaveRateA) > 75) {
  console.log(`\n⚠️  Team A keepers are TOO GOOD (>75% save rate)`);
}
if (parseFloat(avgSaveRateB) > 75) {
  console.log(`⚠️  Team B keepers are TOO GOOD (>75% save rate)`);
}
