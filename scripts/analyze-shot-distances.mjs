#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const shotPath = path.join(rootDir, 'shot-events.ndjson');

if (!fs.existsSync(shotPath)) {
  console.log('No shot-events.ndjson file found');
  process.exit(0);
}

const lines = fs.readFileSync(shotPath, 'utf-8').split('\n').filter(l => l.trim());
const shots = lines.map(l => JSON.parse(l));

// Group by sequence numbers (new match has seq restart at 1)
const matches = [];
let current = [];
let lastSeq = 0;

for (const shot of shots) {
  if (shot.seq && shot.seq < lastSeq) {
    // Sequence reset = new match
    if (current.length > 0) {
      matches.push(current);
    }
    current = [];
  }
  current.push(shot);
  lastSeq = shot.seq || 0;
}
if (current.length > 0) matches.push(current);

console.log(`Found ${matches.length} matches in shot events\n`);

// Analyze last 2 matches
const recent = matches.slice(-2).reverse();

for (let i = 0; i < recent.length; i++) {
  const matchShots = recent[i];
  const timestamp = new Date(matchShots[0].timestamp).toISOString();

  const teamA = matchShots.filter(s => s.team === 'A');
  const teamB = matchShots.filter(s => s.team === 'B');

  const analyze = (shots, label) => {
    const distances = shots.map(s => s.distToGoal).sort((a, b) => a - b);
    const avg = distances.reduce((a, b) => a + b, 0) / distances.length;
    const tapIn = shots.filter(s => s.inTapInZone).length;
    const penalty = shots.filter(s => s.insidePenaltyArea).length;
    const lane = shots.filter(s => s.inShootingLane).length;

    return {
      count: shots.length,
      avg: avg.toFixed(2),
      min: distances[0].toFixed(2),
      max: distances[distances.length - 1].toFixed(2),
      tapIn,
      penalty,
      lane,
      distances: distances.map(d => d.toFixed(1))
    };
  };

  const aStats = analyze(teamA, 'Team A');
  const bStats = analyze(teamB, 'Team B');

  console.log(`Match ${i + 1} (${timestamp}):`);
  console.log(`  Team A: ${aStats.count} shots, avg ${aStats.avg}u, range ${aStats.min}-${aStats.max}u`);
  console.log(`    - Tap-ins: ${aStats.tapIn}, Penalty box: ${aStats.penalty}, Shooting lane: ${aStats.lane}`);
  console.log(`    - Distance distribution: ${aStats.distances.join(', ')}`);
  console.log(`  Team B: ${bStats.count} shots, avg ${bStats.avg}u, range ${bStats.min}-${bStats.max}u`);
  console.log(`    - Tap-ins: ${bStats.tapIn}, Penalty box: ${bStats.penalty}, Shooting lane: ${bStats.lane}`);
  console.log(`    - Distance distribution: ${bStats.distances.join(', ')}`);
  console.log();
}
