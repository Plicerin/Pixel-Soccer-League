#!/usr/bin/env node
/**
 * Measure the CPU keeper's positioning and shot-stopping.
 *
 * The interesting number is `unreachable`: keeperSaveGeometry acting as a veto
 * in resolveShot means an out-of-reach keeper converts a would-be save into a
 * goal outright, so any positioning error shows up directly as conceded goals.
 *
 * Usage: node scripts/keeper-harness.mjs [--games 30] [--half 300]
 */
import process from 'node:process'
import { SimpleMatchModel } from '../src/core/simpleMatchModel.ts'
import { GOAL_MOUTH_HALF_Z, LEFT_GOAL_X, RIGHT_GOAL_X } from '../src/core/constants.ts'

const opts = { games: 30, half: 300 }
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--games') opts.games = Number(process.argv[++i])
  else if (process.argv[i] === '--half') opts.half = Number(process.argv[++i])
}

const shots = []
const proto = Object.getPrototypeOf(new SimpleMatchModel())
const originalGeometry = proto.keeperSaveGeometry
proto.keeperSaveGeometry = function (keeper, origin, target, distYards, pressure, style) {
  const out = originalGeometry.call(this, keeper, origin, target, distYards, pressure, style)
  if (keeper) {
    // Which goal is being defended, and how far off his line the keeper stands.
    const goalX = Math.abs(keeper.pos.x - LEFT_GOAL_X) < Math.abs(keeper.pos.x - RIGHT_GOAL_X)
      ? LEFT_GOAL_X : RIGHT_GOAL_X
    shots.push({
      reachable: out.reachable,
      reachDistance: out.reachDistance,
      maxReach: out.maxReach,
      keeperZ: keeper.pos.z,
      offLine: Math.abs(keeper.pos.x - goalX),
      targetZ: target.z,
      // How far the keeper is from the shot's z-line: the lateral error alone.
      lateralError: Math.abs(keeper.pos.z - target.z),
      originZ: origin.z,
      distYards,
      wide: Math.abs(origin.z) > GOAL_MOUTH_HALF_Z * 2.2,
    })
  }
  return out
}

let goalsFor = 0
for (let g = 0; g < opts.games; g++) {
  const model = new SimpleMatchModel()
  model.setSeed(20000 + g * 37)
  model.setHalfDurationSeconds(opts.half)
  model.startMatch()
  const dt = 1 / 60
  for (let i = 0; i < 60 * 60 * 12 && model.getMatchSnapshot().phase !== 'FULL_TIME'; i++) model.step(dt)
  const snap = model.getMatchSnapshot()
  goalsFor += (snap.scoreA || 0) + (snap.scoreB || 0)
}

const pct = (n, d) => d ? `${((n / d) * 100).toFixed(1)}%` : 'n/a'
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
const unreachable = shots.filter((s) => !s.reachable)
const wide = shots.filter((s) => s.wide)

console.log(`keeper harness: ${opts.games} games, ${opts.half}s halves`)
console.log(`  shots on target facing a keeper: ${shots.length}   goals in sample: ${goalsFor}`)
console.log(`  keeper OUT OF REACH (auto-goal): ${unreachable.length}  (${pct(unreachable.length, shots.length)})`)
console.log(`  mean reach distance / max reach:  ${mean(shots.map((s) => s.reachDistance)).toFixed(2)} / ${mean(shots.map((s) => s.maxReach)).toFixed(2)}`)
console.log(`  mean lateral error (keeper z vs shot z): ${mean(shots.map((s) => s.lateralError)).toFixed(2)}u  (goal mouth is +/-${GOAL_MOUTH_HALF_Z.toFixed(2)}u)`)
console.log(`  mean distance off his goal line:  ${mean(shots.map((s) => s.offLine)).toFixed(2)}u`)
console.log(`  shots from wide positions:        ${wide.length}  (${pct(wide.length, shots.length)}), of those out of reach: ${pct(wide.filter((s) => !s.reachable).length, wide.length)}`)
console.log(`  central shots out of reach:       ${pct(shots.filter((s) => !s.wide && !s.reachable).length, shots.length - wide.length)}`)
