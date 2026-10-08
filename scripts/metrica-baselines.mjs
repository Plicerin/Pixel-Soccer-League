#!/usr/bin/env node
/**
 * Real-football baselines from the Metrica Sports public tracking data
 * (github.com/metrica-sports/sample-data, vendored at docs/external/).
 *
 * The off-ball movement and pass-leading tuning was done against the KPI guard
 * and judgement; this measures the same quantities on real matches so the
 * model's numbers can be checked rather than argued about.
 *
 * Tracking is 25fps, coordinates normalised 0-1 over a 105 x 68 m pitch.
 * Reported in metres and m/s. The model's own unit is ~1.672 m.
 *
 * Usage: node scripts/metrica-baselines.mjs [--game 1]
 */
import { readFileSync } from 'node:fs'
import { SimpleMatchModel } from '../src/core/simpleMatchModel.ts'
import path from 'node:path'
import process from 'node:process'

const PITCH_X = 105, PITCH_Y = 68, FPS = 25
const DIR = path.join(process.cwd(), 'docs', 'external', 'metrica-sample-data')
let game = 1
for (let i = 2; i < process.argv.length; i++) if (process.argv[i] === '--game') game = Number(process.argv[++i])

function loadTracking(side) {
  const rows = readFileSync(path.join(DIR, `Sample_Game_${game}_RawTrackingData_${side}_Team.csv`), 'utf8').split('\n')
  const names = rows[2].split(',')
  // Column pairs: a player's x is at i, y at i+1, where names[i] is non-empty.
  const cols = []
  for (let i = 3; i < names.length - 1; i++) {
    const label = names[i].trim()
    if (label && label !== 'Ball') cols.push({ label, x: i, y: i + 1 })
  }
  const ballIdx = names.findIndex((n) => n.trim() === 'Ball')
  const frames = []
  for (let r = 3; r < rows.length; r++) {
    const f = rows[r].split(',')
    if (f.length < 5) continue
    const players = cols.map((c) => ({
      label: c.label,
      x: Number(f[c.x]) * PITCH_X,
      y: Number(f[c.y]) * PITCH_Y,
    })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    const ball = ballIdx >= 0
      ? { x: Number(f[ballIdx]) * PITCH_X, y: Number(f[ballIdx + 1]) * PITCH_Y }
      : null
    frames.push({ t: Number(f[2]), players, ball: ball && Number.isFinite(ball.x) ? ball : null })
  }
  return frames
}

const home = loadTracking('Home')
const away = loadTracking('Away')
const n = Math.min(home.length, away.length)

// The keeper is whoever sits furthest from the middle on average.
const meanX = (frames) => {
  const sum = new Map(), count = new Map()
  for (let i = 0; i < frames.length; i += 25) {
    for (const p of frames[i].players) {
      sum.set(p.label, (sum.get(p.label) || 0) + p.x)
      count.set(p.label, (count.get(p.label) || 0) + 1)
    }
  }
  return [...sum.entries()].map(([label, s]) => ({ label, x: s / count.get(label) }))
}
const keeperOf = (frames) => {
  const sum = new Map(), count = new Map()
  for (let i = 0; i < frames.length; i += 25) {
    for (const p of frames[i].players) {
      // Distance to the nearer goal line, which survives the half-time swap.
      sum.set(p.label, (sum.get(p.label) || 0) + Math.min(p.x, PITCH_X - p.x))
      count.set(p.label, (count.get(p.label) || 0) + 1)
    }
  }
  const scored = [...sum.entries()]
    .filter(([label]) => count.get(label) > frames.length / 25 * 0.5)
    .map(([label, s]) => ({ label, d: s / count.get(label) }))
  return scored.reduce((best, cur) => (cur.d < best.d ? cur : best)).label
}
const homeGk = keeperOf(home), awayGk = keeperOf(away)

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

// --- player speed, sampled over 1s windows so it is a real pace not jitter ---
let speedSum = 0, speedN = 0, gkSpeedSum = 0, gkSpeedN = 0
const realSpeeds = []
let withBallSum = 0, withBallN = 0, withoutSum = 0, withoutN = 0
// --- support shape around whoever is on the ball ---
let carrierFrames = 0
const nearest = [[], [], []]
let inRangeSum = 0, freeSum = 0
const CARRIER_RADIUS = 2.0, RANGE_MIN = 6.7, RANGE_MAX = 40.1, MARKED = 5.9 // model's 4u/24u/3.5u

for (let i = FPS; i < n; i += FPS) {
  for (const [frames, gk, mates, opps] of [
    [home, homeGk, home, away],
    [away, awayGk, away, home],
  ]) {
    const prev = frames[i - 1], cur = frames[i]
    if (!prev || !cur) continue
    const prevById = new Map(prev.players.map((p) => [p.label, p]))
    for (const p of cur.players) {
      const q = prevById.get(p.label)
      if (!q) continue
      const speed = dist(p, q) * FPS
      if (!Number.isFinite(speed) || speed > 12) continue
      if (p.label === gk) { gkSpeedSum += speed; gkSpeedN++; continue }
      speedSum += speed; speedN++
      if (realSpeeds.length < 400000) realSpeeds.push(speed)
      // Does this player's team have the ball?
      const ball = cur.ball
      if (!ball) continue
      const ourNearest = Math.min(...cur.players.filter((o) => o.label !== gk).map((o) => dist(o, ball)))
      const theirFrames = mates === home ? away : home
      const theirCur = theirFrames[i]
      if (!theirCur) continue
      const theirGk = mates === home ? awayGk : homeGk
      const theirNearest = Math.min(...theirCur.players.filter((o) => o.label !== theirGk).map((o) => dist(o, ball)))
      if (ourNearest <= theirNearest) { withBallSum += speed; withBallN++ } else { withoutSum += speed; withoutN++ }
    }
  }

  // Support shape: find the single player closest to the ball across both teams.
  const cur = home[i], curA = away[i]
  const ball = cur?.ball || curA?.ball
  if (!cur || !curA || !ball) continue
  const all = [
    ...cur.players.filter((p) => p.label !== homeGk).map((p) => ({ ...p, team: 'H' })),
    ...curA.players.filter((p) => p.label !== awayGk).map((p) => ({ ...p, team: 'A' })),
  ]
  const carrier = all.reduce((best, p) => (dist(p, ball) < dist(best, ball) ? p : best))
  if (dist(carrier, ball) > CARRIER_RADIUS) continue
  carrierFrames++
  const own = all.filter((p) => p.team === carrier.team && p.label !== carrier.label)
  const foes = all.filter((p) => p.team !== carrier.team)
  const gaps = own.map((p) => dist(p, carrier)).sort((a, b) => a - b)
  for (let k = 0; k < 3; k++) if (gaps[k] !== undefined) nearest[k].push(gaps[k])
  const inRange = own.filter((p) => { const d = dist(p, carrier); return d > RANGE_MIN && d < RANGE_MAX })
  inRangeSum += inRange.length
  freeSum += inRange.filter((p) => Math.min(...foes.map((o) => dist(o, p))) > MARKED).length
}

const med = (xs) => (xs.length ? xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)] : NaN)
const U = 1.672 // metres per model unit

console.log(`Metrica sample game ${game} — ${(n / FPS / 60).toFixed(0)} min of tracking, keepers ${homeGk}/${awayGk}\n`)
console.log('MOVEMENT (instantaneous, both sides)  real            model          model in m/s')
const mm = (u) => (u * U).toFixed(2)
console.log(`  outfield player speed        ${(speedSum / speedN).toFixed(2)} m/s        2.24 u/s        ${mm(2.24)} m/s`)
console.log(`  ... team in possession       ${(withBallSum / withBallN).toFixed(2)} m/s        2.40 u/s        ${mm(2.40)} m/s`)
console.log(`  ... team out of possession   ${(withoutSum / withoutN).toFixed(2)} m/s`)
console.log(`  goalkeeper                   ${(gkSpeedSum / gkSpeedN).toFixed(2)} m/s        0.63 u/s        ${mm(0.63)} m/s`)
console.log(`\nSUPPORT AROUND THE BALL  (${carrierFrames} sampled seconds with someone on the ball)`)
console.log(`  nearest team-mate            ${med(nearest[0]).toFixed(1)} m`)
console.log(`  2nd nearest                  ${med(nearest[1]).toFixed(1)} m`)
console.log(`  3rd nearest                  ${med(nearest[2]).toFixed(1)} m`)
console.log(`  team-mates in passing range  ${(inRangeSum / carrierFrames).toFixed(1)} of 9     model 5.9`)
console.log(`  ... of those unmarked        ${(freeSum / carrierFrames).toFixed(1)}           model 4.3`)

// --- the same quantities from the model, measured identically ---
function modelBaselines(games = 6, halfSeconds = 300) {
  let sp = 0, spN = 0, gk = 0, gkN = 0, wb = 0, wbN = 0, wo = 0, woN = 0
  let carrierFrames = 0, inRange = 0, free = 0
  const near = [[], [], []]
  const speeds = []
  for (let g = 0; g < games; g++) {
    const m = new SimpleMatchModel()
    m.setSeed(`metrica-compare-${g}`)
    m.setHalfDurationSeconds(halfSeconds)
    m.startMatch()
    for (let i = 0; i < 60 * (halfSeconds * 2 + 120) && m.getMatchSnapshot().phase !== 'FULL_TIME'; i++) {
      m.step(1 / 60)
      // Instantaneous speed, exactly what the real side now measures.
      for (const p of m.players) {
        const speed = Math.hypot(p.vel.x, p.vel.z) * U
        if (!Number.isFinite(speed)) continue
        if (p.role === 'GK') { gk += speed; gkN++; continue }
        sp += speed; spN++
        // Every 12th frame, not the first 400k samples: the plain cap filled
        // inside the first 333 s of game 0, so the reported distribution came
        // from a prefix of one match while the means used all six.
        if (i % 12 === 0) speeds.push(speed)
        if (m.possession) {
          if (p.team === m.possession.team) { wb += speed; wbN++ } else { wo += speed; woN++ }
        }
      }
      if (i % 60) continue
      const carrier = m.possession
      if (!carrier || carrier.role === 'GK') continue
      carrierFrames++
      const own = m.players.filter((p) => p.team === carrier.team && p.role !== 'GK' && p.id !== carrier.id)
      const foes = m.players.filter((p) => p.team !== carrier.team && p.role !== 'GK')
      const gaps = own.map((p) => dist2u(p.pos, carrier.pos)).sort((a, b) => a - b)
      for (let k = 0; k < 3; k++) if (gaps[k] !== undefined) near[k].push(gaps[k] * U)
      const options = own.filter((p) => { const d = dist2u(p.pos, carrier.pos); return d > 4 && d < 24 })
      inRange += options.length
      free += options.filter((p) => Math.min(...foes.map((o) => dist2u(o.pos, p.pos))) > 3.5).length
    }
  }
  return {
    speed: sp / spN, gk: gk / gkN, withBall: wb / wbN, without: wo / woN,
    near: near.map(med), inRange: inRange / carrierFrames, free: free / carrierFrames, speeds,
  }
}
const dist2u = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)

const mdl = modelBaselines()
const row = (label, real, model, note = '') => {
  const delta = model / real
  const flag = delta > 1.25 || delta < 0.8 ? '  <-- off' : ''
  console.log(`  ${label.padEnd(28)} ${real.toFixed(2).padStart(6)}      ${model.toFixed(2).padStart(6)}     ${('x' + delta.toFixed(2)).padStart(6)}${flag}${note}`)
}
console.log(`

SIDE BY SIDE (metres, m/s)        real      model      ratio`)
row('outfield speed', speedSum / speedN, mdl.speed)
row('... in possession', withBallSum / withBallN, mdl.withBall)
row('... out of possession', withoutSum / withoutN, mdl.without)
row('goalkeeper speed', gkSpeedSum / gkSpeedN, mdl.gk)
row('nearest team-mate', med(nearest[0]), mdl.near[0])
row('2nd nearest', med(nearest[1]), mdl.near[1])
row('3rd nearest', med(nearest[2]), mdl.near[2])
row('options in passing range', inRangeSum / carrierFrames, mdl.inRange)
row('... unmarked', freeSum / carrierFrames, mdl.free)

const pct = (xs, f) => { const a = xs.slice().sort((x, y) => x - y); return a[Math.floor(a.length * f)] }
const share = (xs, lo, hi) => (xs.filter((v) => v >= lo && v < hi).length / xs.length * 100)
console.log(`

SPEED DISTRIBUTION (m/s)          real      model`)
for (const f of [0.1, 0.25, 0.5, 0.75, 0.9, 0.99]) {
  console.log(`  p${String(Math.round(f * 100)).padStart(2)}                            ${pct(realSpeeds, f).toFixed(2).padStart(6)}     ${pct(mdl.speeds, f).toFixed(2).padStart(6)}`)
}
console.log(`
TIME SPENT (% of player-frames)   real      model`)
console.log(`  walking      (< 1.5 m/s)       ${share(realSpeeds, 0, 1.5).toFixed(1).padStart(5)}%    ${share(mdl.speeds, 0, 1.5).toFixed(1).padStart(5)}%`)
console.log(`  jogging      (1.5 - 4)         ${share(realSpeeds, 1.5, 4).toFixed(1).padStart(5)}%    ${share(mdl.speeds, 1.5, 4).toFixed(1).padStart(5)}%`)
console.log(`  running      (4 - 5.5)         ${share(realSpeeds, 4, 5.5).toFixed(1).padStart(5)}%    ${share(mdl.speeds, 4, 5.5).toFixed(1).padStart(5)}%`)
console.log(`  sprinting    (>= 5.5)          ${share(realSpeeds, 5.5, 99).toFixed(1).padStart(5)}%    ${share(mdl.speeds, 5.5, 99).toFixed(1).padStart(5)}%`)
