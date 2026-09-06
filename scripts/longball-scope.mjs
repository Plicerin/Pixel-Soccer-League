#!/usr/bin/env node
/**
 * Measure what more aerial play would cost.
 *
 * Long balls are the lever for run-of-play headers and for getting the ball off
 * the deck. SimpleMatchModel.longBallBias overrides the shipped setting, which
 * is LONG_BALL_PLAYED_MATCH_BIAS on played runtimes and 0 at full length --
 * pass `--biases 0,...` to compare against no long balls at all, not against
 * shipped behaviour.
 *
 * Run it at both runtimes -- they behave differently, because production
 * compression only applies to short matches:
 *   node scripts/longball-scope.mjs --half 300   --games 24   (the played match)
 *   node scripts/longball-scope.mjs --half 2700  --games 8    (what the guard checks)
 */
import process from 'node:process'
import { SimpleMatchModel } from '../src/core/simpleMatchModel.ts'
import { FIELD_SCALE_PER_YARD } from '../src/core/constants.ts'

const opts = { half: 300, games: 24, biases: [0, 0.02, 0.05, 0.1] }
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--half') opts.half = Number(process.argv[++i])
  else if (process.argv[i] === '--games') opts.games = Number(process.argv[++i])
  else if (process.argv[i] === '--biases') opts.biases = process.argv[++i].split(',').map(Number)
}

const proto = Object.getPrototypeOf(new SimpleMatchModel())
let headers = 0
const originalRecord = proto.recordEvent
proto.recordEvent = function (type, ...rest) {
  if (String(type).startsWith('HEADER')) headers += 1
  return originalRecord.call(this, type, ...rest)
}

function run(bias) {
  headers = 0
  const kneeY = 0.18 + 0.30
  let ticks = 0, knee = 0, carried = 0
  let passes = 0, completed = 0, goals = 0, shots = 0, longBalls = 0
  for (let g = 0; g < opts.games; g++) {
    const model = new SimpleMatchModel()
    model.setSeed(`longball-scope-${g}`)
    model.setHalfDurationSeconds(opts.half)
    model.longBallBias = bias
    model.startMatch()
    const maxSteps = Math.ceil((opts.half * 2 + 120) * 60)
    for (let i = 0; i < maxSteps && model.getMatchSnapshot().phase !== 'FULL_TIME'; i++) {
      model.step(1 / 60)
      ticks += 1
      if (model.ball.pos.y > kneeY) knee += 1
      if (!model.ballFlight && model.possession) carried += 1
    }
    const snap = model.getMatchSnapshot()
    passes += (snap.passesA || 0) + (snap.passesB || 0)
    completed += (snap.passesCompletedA || 0) + (snap.passesCompletedB || 0)
    goals += (snap.scoreA || 0) + (snap.scoreB || 0)
    shots += (snap.shotsA || 0) + (snap.shotsB || 0)
    for (const d of model.passDecisions) {
      if (d.x == null || d.targetX == null) continue
      if (Math.hypot(d.targetX - d.x, d.targetZ - d.z) / FIELD_SCALE_PER_YARD >= 32) longBalls += 1
    }
  }
  const per = (x) => x / opts.games
  const col = (v, w) => String(v).padStart(w)
  console.log([
    col(bias.toFixed(2), 5), col(per(passes).toFixed(0), 8), col(per(completed).toFixed(0), 10),
    col((completed / passes * 100).toFixed(1), 8), col(per(goals).toFixed(2), 7), col(per(shots).toFixed(1), 7),
    col(per(longBalls).toFixed(1), 8), col(per(headers).toFixed(1), 9),
    col((knee / ticks * 100).toFixed(1), 8), col((carried / ticks * 100).toFixed(1), 9),
  ].join(''))
}

console.log(`long-ball scope: ${opts.games} games, ${opts.half}s halves (${(opts.half * 2 / 60).toFixed(0)} min matches)\n`)
console.log(' bias   passes completed  compl%   goals  shots longBall  headers  >knee%  carried%')
for (const bias of opts.biases) run(bias)
