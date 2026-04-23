#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'

const MLS_TEAMS = [
  'Atlanta United', 'Austin FC', 'Charlotte FC', 'Chicago Fire', 'FC Cincinnati',
  'Colorado Rapids', 'Columbus Crew', 'DC United', 'FC Dallas', 'Houston Dynamo',
  'Inter Miami', 'LA Galaxy', 'LAFC', 'Minnesota United', 'CF Montreal',
  'Nashville SC', 'New England Revolution', 'New York City FC', 'New York Red Bulls',
  'Orlando City', 'Philadelphia Union', 'Portland Timbers', 'Real Salt Lake',
  'San Diego FC', 'San Jose Earthquakes', 'Seattle Sounders', 'Sporting Kansas City',
  'St. Louis City SC', 'Toronto FC', 'Vancouver Whitecaps',
]

function parseArgs(argv) {
  const options = {
    cycles: 5,
    gamesPerCycle: 1,
    mode: 'tuning',
    speed: 1,
    halfSeconds: 300,
    speedExplicit: false,
    homeTeam: '',
    awayTeam: '',
    formationA: '',
    formationB: '',
    outDir: '',
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--cycles') {
      options.cycles = Number(argv[++i])
    } else if (arg === '--games-per-cycle') {
      options.gamesPerCycle = Number(argv[++i])
    } else if (arg === '--mode') {
      options.mode = (argv[++i] || '').trim().toLowerCase()
    } else if (arg === '--speed') {
      options.speed = Number(argv[++i])
      options.speedExplicit = true
    } else if (arg === '--half-seconds') {
      options.halfSeconds = Number(argv[++i])
    } else if (arg === '--home') {
      options.homeTeam = argv[++i] || ''
    } else if (arg === '--away') {
      options.awayTeam = argv[++i] || ''
    } else if (arg === '--formation-a') {
      options.formationA = argv[++i] || ''
    } else if (arg === '--formation-b') {
      options.formationB = argv[++i] || ''
    } else if (arg === '--out-dir') {
      options.outDir = argv[++i] || ''
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!Number.isFinite(options.cycles) || options.cycles <= 0) throw new Error('--cycles must be > 0')
  if (!Number.isFinite(options.gamesPerCycle) || options.gamesPerCycle <= 0) throw new Error('--games-per-cycle must be > 0')
  if (!options.speedExplicit) {
    options.speed = options.mode === 'smoke' ? 32 : 1
  }
  if (!Number.isFinite(options.speed) || options.speed <= 0) throw new Error('--speed must be > 0')
  if (!Number.isFinite(options.halfSeconds) || options.halfSeconds <= 0) throw new Error('--half-seconds must be > 0')
  if (options.mode !== 'tuning' && options.mode !== 'smoke') throw new Error('--mode must be tuning or smoke')
  if ((options.homeTeam && !options.awayTeam) || (!options.homeTeam && options.awayTeam)) {
    throw new Error('Use --home and --away together for a fixed fixture loop')
  }

  options.cycles = Math.floor(options.cycles)
  options.gamesPerCycle = Math.floor(options.gamesPerCycle)
  options.halfSeconds = Math.floor(options.halfSeconds)
  return options
}

function printHelp() {
  console.log(`Overnight simulation and telemetry loop

Usage:
  npm run iterate:overnight -- --home "DC United" --away "Columbus Crew" --cycles 8

Options:
  --cycles <n>           Number of run/analyze cycles (default: 5)
  --games-per-cycle <n>  Games per cycle (default: 1)
  --mode <name>          Runner mode: tuning or smoke (default: tuning)
  --speed <n>            Match clock override (default: 1 tuning, 32 smoke)
  --half-seconds <n>     Half duration in simulation seconds (default: 300)
  --home <team>          Fixed team A for each cycle
  --away <team>          Fixed team B for each cycle
  --formation-a <f>      Optional fixed formation for team A
  --formation-b <f>      Optional fixed formation for team B
  --out-dir <path>       Output directory for reports

Notes:
  - Tuning mode should stay at clock speed 1 for trustworthy gameplay telemetry.
  - Use --half-seconds when you want quicker truthful verification runs.
  - Smoke mode can use higher clock speeds for runner health checks.
`)
}

function runCommand(label, command, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n[${label}] ${command} ${args.join(' ')}`)
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      windowsHide: true,
      shell: false,
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${label} failed with exit code ${code}`))
    })
  })
}

function npmRunArgs(scriptName, extraArgs) {
  if (scriptName === 'sim:match') {
    return [process.execPath, ['scripts/headless-sim.mjs', ...extraArgs]]
  }
  if (scriptName === 'telemetry:analyze') {
    return [process.execPath, ['--import', 'tsx', 'scripts/telemetry-analyze-latest.mjs', ...extraArgs]]
  }
  if (process.platform === 'win32') {
    const quoted = extraArgs.map((arg) => {
      if (/[\s"]/u.test(arg)) {
        return `"${arg.replace(/"/g, '\\"')}"`
      }
      return arg
    })
    return ['cmd.exe', ['/d', '/s', '/c', `npm run ${scriptName} -- ${quoted.join(' ')}`]]
  }
  return ['npm', ['run', scriptName, '--', ...extraArgs]]
}

function getCycleSimTimeoutMs(options) {
  const regulationSecondsPerGame = Math.max(1, options.halfSeconds) * 2
  const effectiveSpeed = Math.max(1, options.speed)
  const gameplayMsPerGame = Math.ceil((regulationSecondsPerGame / effectiveSpeed) * 1000)
  const bufferMsPerGame = options.mode === 'smoke'
    ? 2 * 60 * 1000
    : 4 * 60 * 1000
  const floorMsPerGame = options.mode === 'smoke'
    ? 3 * 60 * 1000
    : 14 * 60 * 1000
  const perGameTimeoutMs = Math.max(floorMsPerGame, gameplayMsPerGame + bufferMsPerGame)
  return perGameTimeoutMs * Math.max(1, options.gamesPerCycle)
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function buildAllMatchups(teams) {
  const matchups = []
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matchups.push([teams[i], teams[j]])
    }
  }
  return matchups
}

function planBatchFixtures(totalGames) {
  let pool = shuffleInPlace(buildAllMatchups(MLS_TEAMS))
  const fixtures = []
  for (let i = 0; i < totalGames; i++) {
    if (pool.length === 0) {
      pool = shuffleInPlace(buildAllMatchups(MLS_TEAMS))
    }
    const [teamA, teamB] = pool.pop()
    const [homeTeam, awayTeam] = Math.random() < 0.5 ? [teamA, teamB] : [teamB, teamA]
    fixtures.push({
      gameNumber: i + 1,
      homeTeam,
      awayTeam,
    })
  }
  return fixtures
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2))
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = path.resolve(process.cwd(), options.outDir || path.join('telemetry', 'overnight', stamp))
  fs.mkdirSync(outDir, { recursive: true })
  const summaryPath = path.join(outDir, 'overnight-summary.json')
  const statusPath = path.join(outDir, 'overnight-status.json')
  const totalGames = options.cycles * options.gamesPerCycle
  const fixedFixtureLoop = Boolean(options.homeTeam && options.awayTeam)
  const fixturePlan = fixedFixtureLoop
    ? Array.from({ length: totalGames }, (_, index) => ({
        gameNumber: index + 1,
        homeTeam: options.homeTeam,
        awayTeam: options.awayTeam,
      }))
    : planBatchFixtures(totalGames)

  const summary = {
    generatedAt: new Date().toISOString(),
    options,
    outDir,
    simTimeoutMs: getCycleSimTimeoutMs(options),
    totalGames,
    fixturePlan,
    cycles: [],
  }

  const status = {
    generatedAt: summary.generatedAt,
    updatedAt: summary.generatedAt,
    state: 'starting',
    outDir,
    simTimeoutMs: summary.simTimeoutMs,
    completedCycles: 0,
    totalCycles: options.cycles,
    completedGames: 0,
    totalGames,
    fixturePlan,
    currentCycle: null,
    currentPhase: null,
    currentFixtures: [],
    currentSimReport: null,
    currentAnalysisReport: null,
    lastCompletedCycle: null,
    lastCompletedSessionId: null,
    lastCompletedScore: null,
    error: null,
  }
  writeJson(summaryPath, summary)
  writeJson(statusPath, status)

  try {
    for (let cycle = 1; cycle <= options.cycles; cycle++) {
      const cycleLabel = `cycle-${String(cycle).padStart(2, '0')}`
      const simReport = path.join(outDir, `${cycleLabel}-sim.json`)
      const analysisReport = path.join(outDir, `${cycleLabel}-analysis.json`)
      const fixturesPath = path.join(outDir, `${cycleLabel}-fixtures.json`)
      const cycleFixtures = fixturePlan.slice(
        (cycle - 1) * options.gamesPerCycle,
        cycle * options.gamesPerCycle,
      )
      writeJson(fixturesPath, cycleFixtures)

      status.updatedAt = new Date().toISOString()
      status.state = 'running'
      status.currentCycle = cycle
      status.currentPhase = 'sim'
      status.currentFixtures = cycleFixtures
      status.currentSimReport = simReport
      status.currentAnalysisReport = analysisReport
      status.error = null
      writeJson(statusPath, status)

      const simArgs = [
        '--mode', options.mode,
        '--games', String(options.gamesPerCycle),
        '--speed', String(options.speed),
        '--half-seconds', String(options.halfSeconds),
        '--timeout-ms', String(summary.simTimeoutMs),
        '--report-json', simReport,
      ]
      if (fixedFixtureLoop) {
        simArgs.push('--home', options.homeTeam)
        simArgs.push('--away', options.awayTeam)
      } else {
        simArgs.push('--fixtures-json', fixturesPath)
      }
      if (options.formationA) simArgs.push('--formation-a', options.formationA)
      if (options.formationB) simArgs.push('--formation-b', options.formationB)

      const [simCommand, simCommandArgs] = npmRunArgs('sim:match', simArgs)
      await runCommand(`${cycleLabel}:sim`, simCommand, simCommandArgs)

      status.updatedAt = new Date().toISOString()
      status.currentPhase = 'analyze'
      writeJson(statusPath, status)

      const analyzeArgs = ['--latest', '--report-json', analysisReport]
      if (fixedFixtureLoop) {
        analyzeArgs.splice(0, analyzeArgs.length, '--home', options.homeTeam, '--away', options.awayTeam, '--report-json', analysisReport)
      }
      const [analyzeCommand, analyzeCommandArgs] = npmRunArgs('telemetry:analyze', analyzeArgs)
      await runCommand(`${cycleLabel}:analyze`, analyzeCommand, analyzeCommandArgs)

      let analysis = null
      try {
        analysis = JSON.parse(fs.readFileSync(analysisReport, 'utf8'))
      } catch {}

      summary.cycles.push({
        cycle,
        fixturesPath,
        fixtures: cycleFixtures,
        simReport,
        analysisReport,
        sessionId: analysis?.match?.sessionId || null,
        score: analysis?.match?.score || null,
        recommendations: analysis?.recommendations || [],
      })
      writeJson(summaryPath, summary)

      status.updatedAt = new Date().toISOString()
      status.completedCycles = cycle
      status.completedGames = cycle * options.gamesPerCycle
      status.lastCompletedCycle = cycle
      status.lastCompletedSessionId = analysis?.match?.sessionId || null
      status.lastCompletedScore = analysis?.match?.score || null
      status.currentPhase = null
      status.currentFixtures = []
      status.currentSimReport = null
      status.currentAnalysisReport = null
      writeJson(statusPath, status)
    }

    status.updatedAt = new Date().toISOString()
    status.state = 'completed'
    writeJson(statusPath, status)
  } catch (error) {
    status.updatedAt = new Date().toISOString()
    status.state = 'failed'
    status.error = error.message || String(error)
    writeJson(statusPath, status)
    throw error
  }
  console.log(`\nSaved overnight loop summary: ${summaryPath}`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
