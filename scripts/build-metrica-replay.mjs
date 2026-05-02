#!/usr/bin/env node

import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INPUT_DIR = path.join(ROOT, 'docs', 'external', 'metrica-sample-data');
const OUTPUT_DIR = path.join(ROOT, 'public', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'metrica-sample-game-1-replay.json');
const SAMPLE_EVERY_SECONDS = 0.2;
const PLAYER_LIMIT = 11;

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function isFiniteCoord(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1;
}

function isFiniteBallCoord(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= -0.25 && n <= 1.25;
}

async function readTrackingCsv(file) {
  const rl = readline.createInterface({
    input: createReadStream(file),
    crlfDelay: Infinity,
  });
  let lineNo = 0;
  let playerIds = [];
  let coordColumns = [];
  let ballColumns = null;
  const frames = new Map();
  const last = [];
  let lastBall = null;
  let nextSampleAt = 0;

  for await (const line of rl) {
    lineNo += 1;
    const cols = parseCsvLine(line);
    if (lineNo === 2) {
      playerIds = cols
        .slice(3)
        .filter((value, index) => index % 2 === 0 && value.trim() !== 'Ball' && value.trim() !== '')
        .slice(0, PLAYER_LIMIT);
      continue;
    }
    if (lineNo === 3) {
      for (let i = 3; i < cols.length - 1 && coordColumns.length < PLAYER_LIMIT; i += 2) {
        if ((cols[i] || '').trim() === 'Ball') {
          ballColumns = [i, i + 1];
          break;
        }
        coordColumns.push([i, i + 1]);
      }
      if (!ballColumns) {
        const ballIndex = cols.findIndex((value) => (value || '').trim() === 'Ball');
        if (ballIndex >= 0 && ballIndex < cols.length - 1) ballColumns = [ballIndex, ballIndex + 1];
      }
      continue;
    }
    if (lineNo < 4 || cols.length < 4) continue;
    const period = Number(cols[0]);
    const t = Number(cols[2]);
    if (!Number.isFinite(period) || !Number.isFinite(t)) continue;
    if (t + 0.0001 < nextSampleAt) continue;
    nextSampleAt = t + SAMPLE_EVERY_SECONDS;

    const positions = coordColumns.map(([xCol, yCol], idx) => {
      const x = Number(cols[xCol]);
      const y = Number(cols[yCol]);
      if (isFiniteCoord(x) && isFiniteCoord(y)) {
        last[idx] = [Number(x.toFixed(5)), Number(y.toFixed(5))];
      }
      return last[idx] || null;
    });
    if (ballColumns) {
      const ballX = Number(cols[ballColumns[0]]);
      const ballY = Number(cols[ballColumns[1]]);
      if (isFiniteBallCoord(ballX) && isFiniteBallCoord(ballY)) {
        lastBall = [Number(ballX.toFixed(5)), Number(ballY.toFixed(5))];
      }
    }
    frames.set(`${period}:${t.toFixed(2)}`, { period, t: Number(t.toFixed(2)), positions, ball: lastBall });
  }

  return { playerIds, frames };
}

async function main() {
  const homePath = path.join(INPUT_DIR, 'Sample_Game_1_RawTrackingData_Home_Team.csv');
  const awayPath = path.join(INPUT_DIR, 'Sample_Game_1_RawTrackingData_Away_Team.csv');
  const [home, away] = await Promise.all([
    readTrackingCsv(homePath),
    readTrackingCsv(awayPath),
  ]);

  const merged = [];
  for (const [key, homeFrame] of home.frames.entries()) {
    const awayFrame = away.frames.get(key);
    if (!awayFrame) continue;
    merged.push({
      t: homeFrame.t,
      period: homeFrame.period,
      A: homeFrame.positions,
      B: awayFrame.positions,
      ball: homeFrame.ball || awayFrame.ball || null,
    });
  }
  merged.sort((a, b) => (a.period - b.period) || (a.t - b.t));

  const payload = {
    source: 'metrica-sports/sample-data/Sample_Game_1_RawTrackingData',
    mode: 'position-ball-replay',
    sampleEverySeconds: SAMPLE_EVERY_SECONDS,
    pitch: { lengthMeters: 105, widthMeters: 68 },
    playerIds: {
      A: home.playerIds,
      B: away.playerIds,
    },
    frames: merged,
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(payload));
  process.stdout.write(`wrote ${path.relative(ROOT, OUTPUT_FILE)} with ${merged.length} frames\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
