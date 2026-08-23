#!/usr/bin/env node
/**
 * Measure how hard a team is to play against.
 *
 * Deliberately avoids shots, goals and pass volume: the model steers those
 * toward MLS targets (underproducingCadenceScale, loadBrake), so anything
 * measured there gets absorbed or inverted. Two previous attempts at CPU
 * difficulty failed exactly that way.
 *
 * These metrics are not governed:
 *   pressure       mean pressureOn() against the ball carrier
 *   timeToPressure seconds a carrier spends unpressured (< 0.5) before contest
 *   completion     pass completion of the team being defended against
 *   tacklesWon     tackles the defending team wins, per match
 *
 * Reports mean +/- standard error across independent seed families, because
 * per-match variance here is large enough to invert a small real effect.
 *
 * Usage:
 *   node scripts/defense-harness.mjs [--games 20] [--families 2] [--half 300]
 */
import process from 'node:process'
import { SimpleMatchModel } from '../src/core/simpleMatchModel.ts'

function parseArgs(argv) {
  const opts = { games: 20, families: 2, half: 300, label: 'baseline', intensity: 1 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--games') opts.games = Number(argv[++i])
    else if (a === '--families') opts.families = Number(argv[++i])
    else if (a === '--half') opts.half = Number(argv[++i])
    else if (a === '--label') opts.label = argv[++i]
    else if (a === '--intensity') opts.intensity = Number(argv[++i])
  }
  return opts
}

/** One match; returns per-match defensive metrics for team B defending A. */
function playMatch(seed, halfSeconds, intensity) {
  const model = new SimpleMatchModel()
  model.setSeed(seed)
  model.setHalfDurationSeconds(halfSeconds)
  // Team B is the one defending in these metrics.
  model.setDefenseIntensity('B', intensity)
  model.startMatch()

  let samples = 0
  let pressureSum = 0
  let unpressuredTicks = 0
  let carrierTicks = 0

  const dt = 1 / 60
  for (let i = 0; i < 60 * 60 * 12 && model.getMatchSnapshot().phase !== 'FULL_TIME'; i++) {
    model.step(dt)
    const carrier = model.possession
    // Only sample while team A actually has someone on the ball.
    if (!carrier || carrier.team !== 'A') continue
    const pressure = model.pressureOnForHarness(carrier)
    pressureSum += pressure
    samples += 1
    carrierTicks += 1
    if (pressure < 0.5) unpressuredTicks += 1
  }

  const snap = model.getMatchSnapshot()
  const passesA = snap.passesA || 0
  return {
    pressure: samples ? pressureSum / samples : 0,
    unpressuredShare: carrierTicks ? unpressuredTicks / carrierTicks : 0,
    completion: passesA ? (snap.passesCompletedA || 0) / passesA : 0,
    tacklesWon: snap.tacklesWonB || 0,
    // Governed output: must NOT move, or the KPI envelope breaks.
    totalShots: (snap.shotsA || 0) + (snap.shotsB || 0),
    totalPasses: (snap.passesA || 0) + (snap.passesB || 0),
  }
}

function summarise(values) {
  const n = values.length
  const mean = values.reduce((a, b) => a + b, 0) / n
  const variance = n > 1 ? values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0
  return { mean, se: Math.sqrt(variance / n), n }
}

const opts = parseArgs(process.argv.slice(2))
const metrics = ['pressure', 'unpressuredShare', 'completion', 'tacklesWon', 'totalShots', 'totalPasses']

console.log(`defense harness: ${opts.label} | ${opts.families} families x ${opts.games} games, ${opts.half}s halves\n`)

const perFamily = []
for (let family = 0; family < opts.families; family++) {
  const rows = []
  for (let g = 0; g < opts.games; g++) rows.push(playMatch(`def-f${family}-${g}`, opts.half, opts.intensity))
  const stats = Object.fromEntries(metrics.map((m) => [m, summarise(rows.map((r) => r[m]))]))
  perFamily.push(stats)
  console.log(`family ${family}:`)
  for (const m of metrics) {
    console.log(`  ${m.padEnd(17)} ${stats[m].mean.toFixed(3)} +/- ${stats[m].se.toFixed(3)}`)
  }
}

// Cross-family agreement is the real test: a metric that disagrees between
// families cannot support a conclusion.
console.log('\ncross-family spread (max mean - min mean, vs largest se):')
for (const m of metrics) {
  const means = perFamily.map((f) => f[m].mean)
  const spread = Math.max(...means) - Math.min(...means)
  const worstSe = Math.max(...perFamily.map((f) => f[m].se))
  const stable = spread <= worstSe * 2
  console.log(`  ${m.padEnd(17)} spread ${spread.toFixed(3)} | se ${worstSe.toFixed(3)} | ${stable ? 'stable' : 'NOISY'}`)
}
