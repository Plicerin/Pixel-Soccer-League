#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'

const SAFE_MAX_SPEED = 40
const DEFAULT_SPEED = 20
const DEFAULT_GAMES = 20

const MLS_GLOBAL_BASELINE = {
  goalsPerGame: 2.78,
  shotsPerGame: 13.1,
  shotsOnTargetPerGame: 4.7,
  passCompletionRate: 0.76,
  cornersPerGame: 4.0,
  savesPerMatch: 3.8,
}

const MLS_TEAM_BASELINES = {
  'Atlanta United': { goalsFor: 1.82, shotsPerGame: 13.2, shotsOnTargetPerGame: 4.8, passCompletionRate: 0.78, corners: 4.1 },
  'Austin FC': { goalsFor: 1.88, shotsPerGame: 12.9, shotsOnTargetPerGame: 4.6, passCompletionRate: 0.75, corners: 3.9 },
  'Charlotte FC': { goalsFor: 1.42, shotsPerGame: 11.8, shotsOnTargetPerGame: 3.6, passCompletionRate: 0.74, corners: 3.2 },
  'Chicago Fire': { goalsFor: 1.95, shotsPerGame: 14.1, shotsOnTargetPerGame: 5.2, passCompletionRate: 0.76, corners: 4.5 },
  'FC Cincinnati': { goalsFor: 2.12, shotsPerGame: 13.9, shotsOnTargetPerGame: 4.9, passCompletionRate: 0.77, corners: 4.3 },
  'Colorado Rapids': { goalsFor: 1.68, shotsPerGame: 14.2, shotsOnTargetPerGame: 4.8, passCompletionRate: 0.76, corners: 4.1 },
  'Columbus Crew': { goalsFor: 2.12, shotsPerGame: 13.9, shotsOnTargetPerGame: 4.9, passCompletionRate: 0.77, corners: 4.3 },
  'DC United': { goalsFor: 1.58, shotsPerGame: 12.1, shotsOnTargetPerGame: 3.8, passCompletionRate: 0.73, corners: 3.4 },
  'D.C. United': { goalsFor: 1.58, shotsPerGame: 12.1, shotsOnTargetPerGame: 3.8, passCompletionRate: 0.73, corners: 3.4 },
  'FC Dallas': { goalsFor: 1.82, shotsPerGame: 12.5, shotsOnTargetPerGame: 4.3, passCompletionRate: 0.74, corners: 3.8 },
  'Houston Dynamo': { goalsFor: 2.05, shotsPerGame: 13.7, shotsOnTargetPerGame: 4.9, passCompletionRate: 0.77, corners: 4.2 },
  'Inter Miami': { goalsFor: 2.45, shotsPerGame: 15.2, shotsOnTargetPerGame: 5.8, passCompletionRate: 0.79, corners: 5.0 },
  'LA Galaxy': { goalsFor: 2.12, shotsPerGame: 14.5, shotsOnTargetPerGame: 5.2, passCompletionRate: 0.78, corners: 4.4 },
  'LAFC': { goalsFor: 2.35, shotsPerGame: 15.8, shotsOnTargetPerGame: 5.9, passCompletionRate: 0.8, corners: 4.9 },
  'Minnesota United': { goalsFor: 1.78, shotsPerGame: 11.6, shotsOnTargetPerGame: 4.0, passCompletionRate: 0.73, corners: 3.5 },
  'CF Montreal': { goalsFor: 1.72, shotsPerGame: 12.3, shotsOnTargetPerGame: 4.1, passCompletionRate: 0.74, corners: 3.5 },
  'Montreal': { goalsFor: 1.72, shotsPerGame: 12.3, shotsOnTargetPerGame: 4.1, passCompletionRate: 0.74, corners: 3.5 },
  'Nashville SC': { goalsFor: 1.92, shotsPerGame: 13.1, shotsOnTargetPerGame: 4.5, passCompletionRate: 0.75, corners: 3.9 },
  'New England Revolution': { goalsFor: 1.68, shotsPerGame: 11.9, shotsOnTargetPerGame: 4.1, passCompletionRate: 0.75, corners: 3.6 },
  'New York City FC': { goalsFor: 2.18, shotsPerGame: 14.8, shotsOnTargetPerGame: 5.4, passCompletionRate: 0.8, corners: 4.6 },
  'New York Red Bulls': { goalsFor: 2.08, shotsPerGame: 13.6, shotsOnTargetPerGame: 5.0, passCompletionRate: 0.77, corners: 4.2 },
  'Orlando City': { goalsFor: 2.02, shotsPerGame: 13.4, shotsOnTargetPerGame: 4.7, passCompletionRate: 0.76, corners: 4.1 },
  'Philadelphia Union': { goalsFor: 1.92, shotsPerGame: 12.8, shotsOnTargetPerGame: 4.7, passCompletionRate: 0.76, corners: 4.0 },
  'Portland Timbers': { goalsFor: 1.85, shotsPerGame: 12.7, shotsOnTargetPerGame: 4.2, passCompletionRate: 0.75, corners: 3.6 },
  'Real Salt Lake': { goalsFor: 1.95, shotsPerGame: 13.2, shotsOnTargetPerGame: 4.6, passCompletionRate: 0.77, corners: 4.0 },
  'San Diego FC': { goalsFor: 1.72, shotsPerGame: 12.3, shotsOnTargetPerGame: 4.1, passCompletionRate: 0.74, corners: 3.5 },
  'San Jose Earthquakes': { goalsFor: 1.48, shotsPerGame: 11.2, shotsOnTargetPerGame: 3.5, passCompletionRate: 0.71, corners: 2.9 },
  'Seattle Sounders': { goalsFor: 2.15, shotsPerGame: 14.2, shotsOnTargetPerGame: 5.1, passCompletionRate: 0.78, corners: 4.3 },
  'Sporting Kansas City': { goalsFor: 1.78, shotsPerGame: 12.6, shotsOnTargetPerGame: 4.0, passCompletionRate: 0.76, corners: 3.7 },
  'St. Louis City SC': { goalsFor: 1.88, shotsPerGame: 12.9, shotsOnTargetPerGame: 4.4, passCompletionRate: 0.75, corners: 3.8 },
  'St. Louis CITY SC': { goalsFor: 1.88, shotsPerGame: 12.9, shotsOnTargetPerGame: 4.4, passCompletionRate: 0.75, corners: 3.8 },
  'Toronto FC': { goalsFor: 1.75, shotsPerGame: 12.4, shotsOnTargetPerGame: 4.2, passCompletionRate: 0.74, corners: 3.7 },
  'Vancouver Whitecaps': { goalsFor: 1.65, shotsPerGame: 11.8, shotsOnTargetPerGame: 3.8, passCompletionRate: 0.72, corners: 3.4 },
}

function parseArgs(argv) {
  const options = {
    firstGames: DEFAULT_GAMES,
    secondGames: DEFAULT_GAMES,
    speed: DEFAULT_SPEED,
    skipRuns: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--first-games') {
      options.firstGames = Number(argv[++i])
    } else if (arg === '--second-games') {
      options.secondGames = Number(argv[++i])
    } else if (arg === '--speed') {
      options.speed = Number(argv[++i])
    } else if (arg === '--skip-runs') {
      options.skipRuns = true
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!Number.isFinite(options.firstGames) || options.firstGames <= 0) throw new Error('--first-games must be > 0')
  if (!Number.isFinite(options.secondGames) || options.secondGames <= 0) throw new Error('--second-games must be > 0')
  if (!Number.isFinite(options.speed) || options.speed <= 0) throw new Error('--speed must be > 0')
  if (options.speed > SAFE_MAX_SPEED) {
    throw new Error(`Unsafe --speed ${options.speed}. Use <= ${SAFE_MAX_SPEED} for valid gameplay telemetry.`)
  }

  options.firstGames = Math.floor(options.firstGames)
  options.secondGames = Math.floor(options.secondGames)
  return options
}

function printHelp() {
  console.log(`Telemetry tuning harness\n\nUsage:\n  node scripts/tuning-validation.mjs [options]\n\nOptions:\n  --first-games <n>   First loop game count (default: 20)\n  --second-games <n>  Second loop game count (default: 20)\n  --speed <n>         Safe simulation speed <= 40 (default: 20)\n  --skip-runs         Analyze existing results only\n`)
}

function runHeadlessSim({ games, speed, label }) {
  return new Promise((resolve, reject) => {
    console.log(`\n[${label}] Running ${games} games at speed ${speed}...`)
    const child = spawn(
      process.platform === 'win32' ? 'cmd.exe' : 'npm',
      process.platform === 'win32'
        ? ['/d', '/s', '/c', `npm run sim:headless -- --games ${games} --speed ${speed}`]
        : ['run', 'sim:headless', '--', '--games', String(games), '--speed', String(speed)],
      { stdio: 'inherit', windowsHide: true }
    )

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`headless sim failed with exit code ${code}`))
    })
  })
}

function readMatchResults() {
  const file = path.resolve(process.cwd(), 'match-results.json')
  const raw = fs.readFileSync(file, 'utf8')
  return JSON.parse(raw)
}

function pickNewestUniqueSessions(rows, n, afterTs = 0) {
  const filtered = rows
    .filter((r) => Number(r.timestamp || 0) > afterTs)
    .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
  const out = []
  const seen = new Set()
  for (const row of filtered) {
    const sid = String(row.sessionId || '')
    if (!sid || seen.has(sid)) continue
    seen.add(sid)
    out.push(row)
    if (out.length >= n) break
  }
  return out.reverse()
}

function avg(vals) {
  if (!vals.length) return 0
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function summarizeMatches(matches) {
  const goals = matches.map((m) => (m.finalScoreA ?? 0) + (m.finalScoreB ?? 0))
  const shots = matches.map((m) => (m.shotsA ?? 0) + (m.shotsB ?? 0))
  const shotsOnTarget = matches.map((m) => (m.shotsOnTargetA ?? 0) + (m.shotsOnTargetB ?? 0))
  const corners = matches.map((m) => (m.cornersA ?? 0) + (m.cornersB ?? 0))
  const saves = matches.map((m) => (m.savesA ?? 0) + (m.savesB ?? 0))
  const passes = matches.map((m) => (m.passesA ?? 0) + (m.passesB ?? 0))
  const passCompleted = matches.map((m) => (m.passesCompletedA ?? 0) + (m.passesCompletedB ?? 0))

  const totalPasses = passes.reduce((a, b) => a + b, 0)
  const totalPassCompleted = passCompleted.reduce((a, b) => a + b, 0)

  return {
    games: matches.length,
    goalsPerGame: avg(goals),
    shotsPerGame: avg(shots),
    shotsOnTargetPerGame: avg(shotsOnTarget),
    cornersPerGame: avg(corners),
    savesPerGame: avg(saves),
    passCompletionPct: totalPasses > 0 ? (totalPassCompleted / totalPasses) * 100 : 0,
    drawsPct: matches.length > 0 ? (matches.filter((m) => (m.finalScoreA ?? 0) === (m.finalScoreB ?? 0)).length / matches.length) * 100 : 0,
    cleanSheetsPct: matches.length > 0
      ? (matches.filter((m) => (m.finalScoreA ?? 0) === 0 || (m.finalScoreB ?? 0) === 0).length / matches.length) * 100
      : 0,
  }
}

function buildGlobalBaseline() {
  return {
    goalsPerGame: MLS_GLOBAL_BASELINE.goalsPerGame,
    shotsPerGame: MLS_GLOBAL_BASELINE.shotsPerGame,
    shotsOnTargetPerGame: MLS_GLOBAL_BASELINE.shotsOnTargetPerGame,
    cornersPerGame: MLS_GLOBAL_BASELINE.cornersPerGame,
    savesPerGame: MLS_GLOBAL_BASELINE.savesPerMatch,
    passCompletionPct: MLS_GLOBAL_BASELINE.passCompletionRate * 100,
  }
}

function buildTeamWeightedBaseline(matches) {
  let goals = 0
  let shots = 0
  let sot = 0
  let corners = 0
  let passPct = 0
  let covered = 0

  for (const m of matches) {
    const a = MLS_TEAM_BASELINES[m.teamAName]
    const b = MLS_TEAM_BASELINES[m.teamBName]
    if (!a || !b) continue
    goals += a.goalsFor + b.goalsFor
    shots += a.shotsPerGame + b.shotsPerGame
    sot += a.shotsOnTargetPerGame + b.shotsOnTargetPerGame
    corners += a.corners + b.corners
    passPct += ((a.passCompletionRate + b.passCompletionRate) / 2) * 100
    covered += 1
  }

  if (covered === 0) return buildGlobalBaseline()
  return {
    goalsPerGame: goals / covered,
    shotsPerGame: shots / covered,
    shotsOnTargetPerGame: sot / covered,
    cornersPerGame: corners / covered,
    savesPerGame: MLS_GLOBAL_BASELINE.savesPerMatch,
    passCompletionPct: passPct / covered,
  }
}

function metricDrift(sim, base) {
  const drift = {}
  for (const key of Object.keys(base)) {
    const s = sim[key] ?? 0
    const b = base[key] ?? 0
    const abs = s - b
    const pct = b === 0 ? 0 : (abs / Math.abs(b)) * 100
    drift[key] = { simulated: s, baseline: b, abs, pct }
  }
  return drift
}

function applyGameEngineRetune() {
  const filePath = path.resolve(process.cwd(), 'src/gameEngine.ts')
  let text = fs.readFileSync(filePath, 'utf8')

  const replacements = [
    ['passChanceFar: 0.45,', 'passChanceFar: 0.42,'],
    ['passChanceNear: 0.34,', 'passChanceNear: 0.30,'],
    ['shootChanceFar: 0.24,', 'shootChanceFar: 0.30,'],
    ['shootChanceNear: 0.46,', 'shootChanceNear: 0.55,'],
    ['cpuShotAimErrorRad: 0.33,', 'cpuShotAimErrorRad: 0.30,'],
    ['shootChanceNear: 0.60,', 'shootChanceNear: 0.68,'],
    ['cpuShotAimErrorRad: 0.40,', 'cpuShotAimErrorRad: 0.36,'],
    ['shootChanceFar: 0.35,', 'shootChanceFar: 0.40,'],
    ['shootChanceNear: 0.36,', 'shootChanceNear: 0.44,'],
    ['cpuShotAimErrorRad: 0.30,', 'cpuShotAimErrorRad: 0.27,'],
    ['Math.min(pressure, 4) * 0.012', 'Math.min(pressure, 4) * 0.0075'],
    ['nearbyOppPressure * 0.0052', 'nearbyOppPressure * 0.0038'],
    ['THREE.MathUtils.lerp(0.50, 0.30, passSkill)', 'THREE.MathUtils.lerp(0.42, 0.24, passSkill)'],
    ['Math.min(nearbyOppPressure, 3) / 3);', 'Math.min(nearbyOppPressure, 3) / 3);'],
    ['THREE.MathUtils.lerp(1.0, 0.97, Math.min(nearbyOppPressure, 3) / 3)', 'THREE.MathUtils.lerp(1.0, 0.982, Math.min(nearbyOppPressure, 3) / 3)'],
    ['nearbyOppPressure * 0.012', 'nearbyOppPressure * 0.009'],
    ['nearbyOppPressure * 0.0095', 'nearbyOppPressure * 0.0075'],
    ['nearbyOppPressure * 0.0105', 'nearbyOppPressure * 0.0082'],
    ['closePressure >= 3 ? 0.12 : (closePressure === 2 ? 0.07 : (closePressure === 1 ? 0.03 : 0))', 'closePressure >= 3 ? 0.15 : (closePressure === 2 ? 0.09 : (closePressure === 1 ? 0.04 : 0))'],
    ['carryLanePressure > 2.1 ? 0.10 : (carryLanePressure > 1.1 ? 0.05 : 0)', 'carryLanePressure > 2.1 ? 0.13 : (carryLanePressure > 1.1 ? 0.07 : 0)'],
  ]

  let changes = 0
  for (const [from, to] of replacements) {
    if (text.includes(from)) {
      text = text.replace(from, to)
      changes += 1
    }
  }

  if (changes === 0) {
    throw new Error('No tunable literals were replaced. Tuning step aborted to avoid false-positive run.')
  }

  fs.writeFileSync(filePath, text)
  return { filePath, changes }
}

function toFixedSummary(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === 'number' ? Number(v.toFixed(3)) : v
  }
  return out
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const startTs = Date.now()

  if (!opts.skipRuns) {
    await runHeadlessSim({ games: opts.firstGames, speed: opts.speed, label: 'Loop 1' })
  }

  const allAfterFirst = pickNewestUniqueSessions(readMatchResults(), opts.firstGames, startTs)
  const loop1Summary = summarizeMatches(allAfterFirst)
  const globalBaseline = buildGlobalBaseline()
  const weightedBaseline = buildTeamWeightedBaseline(allAfterFirst)

  const loop1DriftGlobal = metricDrift(loop1Summary, globalBaseline)
  const loop1DriftWeighted = metricDrift(loop1Summary, weightedBaseline)

  const tuningChange = applyGameEngineRetune()
  console.log(`\nApplied tuning updates in ${tuningChange.filePath} (${tuningChange.changes} literal changes).`)

  const midTs = Date.now()
  if (!opts.skipRuns) {
    await runHeadlessSim({ games: opts.secondGames, speed: opts.speed, label: 'Loop 2' })
  }

  const allAfterSecond = pickNewestUniqueSessions(readMatchResults(), opts.secondGames, midTs)
  const loop2Summary = summarizeMatches(allAfterSecond)
  const loop2DriftGlobal = metricDrift(loop2Summary, globalBaseline)
  const loop2DriftWeighted = metricDrift(loop2Summary, weightedBaseline)

  const report = {
    generatedAt: new Date().toISOString(),
    config: opts,
    loop1: {
      matchesAnalyzed: allAfterFirst.length,
      summary: toFixedSummary(loop1Summary),
      driftVsGlobal: loop1DriftGlobal,
      driftVsTeamWeighted: loop1DriftWeighted,
    },
    tuningApplied: tuningChange,
    loop2: {
      matchesAnalyzed: allAfterSecond.length,
      summary: toFixedSummary(loop2Summary),
      driftVsGlobal: loop2DriftGlobal,
      driftVsTeamWeighted: loop2DriftWeighted,
    },
  }

  const outDir = path.resolve(process.cwd(), 'telemetry')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `tuning-validation-${Date.now()}.json`)
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2))

  console.log(`\nSaved tuning validation report: ${outPath}`)
  console.log('\nLoop 1 summary:', report.loop1.summary)
  console.log('Loop 2 summary:', report.loop2.summary)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
