#!/usr/bin/env node
/**
 * Scope and then verify the free-kick restart.
 *
 * Written to answer three questions before the rework, and kept to check it
 * afterwards:
 *   1. How many free kicks per match, so a direct-shot option tells us how
 *      many shots it would add to the KPI guard's 33-a-match band.
 *   2. How far from goal they are: only the shootable band matters for a wall
 *      and a direct attempt.
 *   3. What the delivery actually is. Before the rework every single one was a
 *      short pass, which is what the play-tester reported.
 *
 * Usage: node scripts/freekick-scope.mjs [--games 12] [--half 2700]
 */
import process from 'node:process'
import { SimpleMatchModel } from '../src/core/simpleMatchModel.ts'
import { FIELD_SCALE_PER_YARD, LEFT_GOAL_X, RIGHT_GOAL_X } from '../src/core/constants.ts'

const opts = { games: 12, half: 2700, dt: 1 / 30, seed: 'fk-scope' }
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--games') opts.games = Number(process.argv[++i])
  else if (process.argv[i] === '--half') opts.half = Number(process.argv[++i])
}

const FIXTURES = [['USA', 'MEX'], ['BRA', 'ARG'], ['FRA', 'GER'], ['ESP', 'ITA']]
const kicks = []

// Tap the staging call rather than the event log: the log is capped at 5000
// entries and silently truncates the tail of a full-length match, which has
// already produced one wrong header count on this project.
const proto = Object.getPrototypeOf(new SimpleMatchModel())
const stageFreeKick = proto.stageFreeKickRestart
proto.stageFreeKickRestart = function (restartTeam, spot, lastTouchTeam, lastTouchPlayerId) {
  const attackSign = this.attackSign(restartTeam)
  const goalX = attackSign > 0 ? RIGHT_GOAL_X : LEFT_GOAL_X
  const distYards = Math.hypot(goalX - spot.x, spot.z) / FIELD_SCALE_PER_YARD
  kicks.push({ distYards })
  return stageFreeKick.call(this, restartTeam, spot, lastTouchTeam, lastTouchPlayerId)
}

// What the restart was set up as, and how big a wall it drew.
const install = proto.installBallOutRestart
proto.installBallOutRestart = function (context) {
  const out = install.call(this, context)
  const restart = this.restartContext
  const last = kicks[kicks.length - 1]
  if (restart && restart.restartType === 'free_kick' && last) {
    last.plan = restart.plan
    last.wallSize = (restart.wallIds || []).length
  }
  return out
}

// And what it actually played.
// Guarded so the same harness runs against the pre-rework model, where this
// method does not exist at all. That baseline is the only way to tell the
// rework's cost apart from the harness simply using different fixtures to the
// KPI guard.
const executeShot = proto.executeFreeKickShot
if (executeShot) proto.executeFreeKickShot = function (restart, taker) {
  const shotsBefore = this.team(restart.restartTeam).shots
  const out = executeShot.call(this, restart, taker)
  const last = kicks[kicks.length - 1]
  if (last) {
    last.struck = true
    last.scored = !!out
    // A wall block still counts as a shot, so it is not distinguishable here;
    // the blocks total below is the one that moves.
    last.countedShot = this.team(restart.restartTeam).shots > shotsBefore
  }
  return out
}

const execute = proto.executeBallOutRestart
proto.executeBallOutRestart = function () {
  const restart = this.restartContext
  if (restart && restart.restartType === 'free_kick' && restart.plan !== 'free_kick_shoot') {
    const receiver = this.restartReceiver(restart, restart.takerId)
    const last = kicks[kicks.length - 1]
    if (last && receiver) {
      last.deliveryYards = Math.hypot(receiver.pos.x - restart.spot.x, receiver.pos.z - restart.spot.z) / FIELD_SCALE_PER_YARD
    }
  }
  return execute.call(this)
}

let totals = { shots: 0, goals: 0, blocks: 0 }
for (let game = 0; game < opts.games; game++) {
  const model = new SimpleMatchModel()
  const [a, b] = FIXTURES[game % FIXTURES.length]
  model.setTeamNames(a, b)
  model.setSeed(`${opts.seed}:${game}`)
  model.setHalfDurationSeconds(opts.half)
  model.setRestartDelays(0, 0)
  model.startMatch()
  const maxSteps = Math.ceil((opts.half * 2 + 60) / opts.dt) * 4
  for (let step = 0; step < maxSteps && model.getMatchSnapshot().phase !== 'FULL_TIME'; step++) {
    model.step(opts.dt)
  }
  const snap = model.getMatchSnapshot()
  totals.shots += (snap.shotsA || 0) + (snap.shotsB || 0)
  totals.goals += (snap.scoreA || 0) + (snap.scoreB || 0)
  totals.blocks += (snap.blocksA || 0) + (snap.blocksB || 0)
}

const per = (n) => (n / opts.games).toFixed(2)
const pct = (n, of) => (of ? `${((n / of) * 100).toFixed(1)}%` : '-')
const band = (lo, hi) => kicks.filter((k) => k.distYards >= lo && k.distYards < hi).length
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
const planned = (plan) => kicks.filter((k) => k.plan === plan)
const struck = kicks.filter((k) => k.struck)
const walled = kicks.filter((k) => k.wallSize > 0)

console.log(`games                  ${opts.games} @ ${opts.half}s halves`)
console.log(`free kicks             ${kicks.length} (${per(kicks.length)}/match)`)
console.log(`mean distance          ${mean(kicks.map((k) => k.distYards)).toFixed(1)} yd from goal`)
console.log('')
console.log('distance from goal:')
for (const [label, lo, hi] of [['< 18 yd', 0, 18], ['18-25 yd', 18, 25], ['25-35 yd', 25, 35], ['35-45 yd', 35, 45], ['>= 45 yd', 45, 999]]) {
  console.log(`  ${label.padEnd(20)}${String(band(lo, hi)).padStart(4)} ${pct(band(lo, hi), kicks.length)}`)
}
console.log('')
console.log('setup:')
console.log(`  with a wall          ${walled.length} (${per(walled.length)}/match, ${pct(walled.length, kicks.length)})`)
console.log(`  mean wall size       ${mean(walled.map((k) => k.wallSize)).toFixed(2)} bodies`)
console.log('')
console.log('plan chosen:')
for (const plan of ['free_kick_shoot', 'free_kick_cross', 'free_kick_direct']) {
  console.log(`  ${plan.padEnd(20)}${String(planned(plan).length).padStart(4)} (${per(planned(plan).length)}/match, ${pct(planned(plan).length, kicks.length)})`)
}
console.log('')
console.log('direct attempts:')
console.log(`  struck               ${struck.length} (${per(struck.length)}/match)`)
console.log(`  scored               ${struck.filter((k) => k.scored).length} (${per(struck.filter((k) => k.scored).length)}/match, ${pct(struck.filter((k) => k.scored).length, struck.length)} conversion)`)
console.log('')
console.log('match totals, for the KPI bands:')
console.log(`  shots                ${per(totals.shots)}/match`)
console.log(`  goals                ${per(totals.goals)}/match`)
console.log(`  blocks               ${per(totals.blocks)}/match`)
