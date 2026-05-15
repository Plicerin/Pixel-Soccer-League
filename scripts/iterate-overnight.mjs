#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { WORLD_CUP_2026_TEAM_NAMES } from '../src/teamCatalog.js'

const MLS_TEAMS = WORLD_CUP_2026_TEAM_NAMES

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
    url: 'http://127.0.0.1:3001/',
    dryRun: false,
    resume: false,
    maxCycleAttempts: 2,
    continueOnCycleFailure: true,
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
    } else if (arg === '--url') {
      options.url = argv[++i] || ''
    } else if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--resume') {
      options.resume = true
    } else if (arg === '--max-cycle-attempts') {
      options.maxCycleAttempts = Number(argv[++i])
    } else if (arg === '--no-continue-on-cycle-failure') {
      options.continueOnCycleFailure = false
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
  if (!Number.isFinite(options.maxCycleAttempts) || options.maxCycleAttempts <= 0) throw new Error('--max-cycle-attempts must be > 0')
  if (options.mode !== 'tuning' && options.mode !== 'smoke') throw new Error('--mode must be tuning or smoke')
  if (!options.url) throw new Error('--url cannot be empty')
  if ((options.homeTeam && !options.awayTeam) || (!options.homeTeam && options.awayTeam)) {
    throw new Error('Use --home and --away together for a fixed fixture loop')
  }

  options.cycles = Math.floor(options.cycles)
  options.gamesPerCycle = Math.floor(options.gamesPerCycle)
  options.halfSeconds = Math.floor(options.halfSeconds)
  options.maxCycleAttempts = Math.floor(options.maxCycleAttempts)
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
  --url <url>            Dev server URL for headless runs (default: http://127.0.0.1:3001/)
  --dry-run              Validate and write the overnight plan without running games
  --resume               Reuse an existing out-dir plan and skip completed cycles
  --max-cycle-attempts <n> Retry each cycle before marking it failed (default: 2)
  --no-continue-on-cycle-failure
                         Stop the whole run if one cycle fails after retries

Notes:
  - Tuning mode should stay at clock speed 1 for trustworthy gameplay telemetry.
  - Use --half-seconds when you want quicker truthful verification runs.
  - Smoke mode can use higher clock speeds for runner health checks.
  - Use --no-continue-on-cycle-failure for supervised runs where failed cycles should stop the batch.
`)
}

function appendRunLog(logPath, text) {
  if (!logPath || !text) return
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  fs.appendFileSync(logPath, text)
}

function runCommand(label, command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const header = `\n[${label}] ${command} ${args.join(' ')}\n`
    process.stdout.write(header)
    appendRunLog(options.logPath, header)
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false,
    })
    const handleOutput = (stream, chunk) => {
      const text = chunk.toString()
      stream.write(text)
      appendRunLog(options.logPath, text)
      options.onOutput?.(text)
    }
    child.stdout?.on('data', (chunk) => handleOutput(process.stdout, chunk))
    child.stderr?.on('data', (chunk) => handleOutput(process.stderr, chunk))
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
    : 10 * 60 * 1000
  const floorMsPerGame = options.mode === 'smoke'
    ? 3 * 60 * 1000
    : 24 * 60 * 1000
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

function assertFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`)
  }
}

function buildCycleCommandPlans(options, outDir, fixturePlan, summary) {
  const fixedFixtureLoop = Boolean(options.homeTeam && options.awayTeam)
  const plans = []
  for (let cycle = 1; cycle <= options.cycles; cycle++) {
    const cycleLabel = `cycle-${String(cycle).padStart(2, '0')}`
    const simReport = path.join(outDir, `${cycleLabel}-sim.json`)
    const analysisReport = path.join(outDir, `${cycleLabel}-analysis.json`)
    const fixturesPath = path.join(outDir, `${cycleLabel}-fixtures.json`)
    const cycleFixtures = fixturePlan.slice(
      (cycle - 1) * options.gamesPerCycle,
      cycle * options.gamesPerCycle,
    )
    const simArgs = [
      '--mode', options.mode,
      '--games', String(options.gamesPerCycle),
      '--speed', String(options.speed),
      '--half-seconds', String(options.halfSeconds),
      '--gpu-headless',
      '--timeout-ms', String(summary.simTimeoutMs),
      '--report-json', simReport,
      '--url', options.url,
    ]
    if (fixedFixtureLoop) {
      simArgs.push('--home', options.homeTeam)
      simArgs.push('--away', options.awayTeam)
    } else {
      simArgs.push('--fixtures-json', fixturesPath)
    }
    if (options.formationA) simArgs.push('--formation-a', options.formationA)
    if (options.formationB) simArgs.push('--formation-b', options.formationB)

    const analyzeArgs = ['--latest', '--report-json', analysisReport]
    if (fixedFixtureLoop) {
      analyzeArgs.splice(0, analyzeArgs.length, '--home', options.homeTeam, '--away', options.awayTeam, '--report-json', analysisReport)
    }
    const [simCommand, simCommandArgs] = npmRunArgs('sim:match', simArgs)
    const [analyzeCommand, analyzeCommandArgs] = npmRunArgs('telemetry:analyze', analyzeArgs)
    plans.push({
      cycle,
      cycleLabel,
      fixturesPath,
      fixtures: cycleFixtures,
      simReport,
      analysisReport,
      sim: { command: simCommand, args: simCommandArgs },
      analyze: { command: analyzeCommand, args: analyzeCommandArgs },
    })
  }
  return plans
}

function preflight(options, outDir) {
  assertFileExists(path.resolve(process.cwd(), 'scripts', 'headless-sim.mjs'), 'Headless sim script')
  assertFileExists(path.resolve(process.cwd(), 'scripts', 'telemetry-analyze-latest.mjs'), 'Telemetry analyzer script')
  assertFileExists(path.resolve(process.cwd(), 'package.json'), 'package.json')
  fs.mkdirSync(outDir, { recursive: true })
  fs.accessSync(outDir, fs.constants.W_OK)
  if (options.homeTeam && options.homeTeam === options.awayTeam) {
    throw new Error('--home and --away must be different teams')
  }
}

function readJsonOrNull(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function asNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function round(value, digits = 2) {
  const factor = 10 ** digits
  return Math.round(asNumber(value) * factor) / factor
}

function average(values) {
  const nums = values.map((value) => Number(value)).filter(Number.isFinite)
  if (nums.length === 0) return 0
  return nums.reduce((sum, value) => sum + value, 0) / nums.length
}

function countBy(values) {
  const counts = new Map()
  for (const value of values) {
    if (!value) continue
    counts.set(value, (counts.get(value) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([text, count]) => ({ text, count }))
}

function collectAnalysisReports(summary) {
  return summary.cycles
    .filter((cycle) => cycle.analyzed && cycle.analysisReport)
    .map((cycle) => ({
      cycle: cycle.cycle,
      fixture: cycle.fixtures?.[0] ? `${cycle.fixtures[0].homeTeam} vs ${cycle.fixtures[0].awayTeam}` : '',
      reportPath: cycle.analysisReport,
      report: readJsonOrNull(cycle.analysisReport),
    }))
    .filter((entry) => entry.report)
}

function buildOvernightFindings(summary) {
  const reports = collectAnalysisReports(summary)
  const analyzed = reports.length
  const baseline = {
    goals: { simulated: 0, baseline: 0 },
    shots: { simulated: 0, baseline: 0 },
    shotsOnTarget: { simulated: 0, baseline: 0 },
    corners: { simulated: 0, baseline: 0 },
  }
  const kpis = {
    overall: [],
    baselineFit: [],
    soccerStructure: [],
    tuningEfficiency: [],
  }
  const structureInputs = {
    widthA: [],
    widthB: [],
    centerAndNarrowWorst: [],
    finalThirdOverloadShare: [],
    dangerMarkedPct: [],
    shotCorridorDefenders: [],
    emptyBoxShotPct: [],
    avgPatternTouches: [],
    realCrosses: [],
  }
  const efficiencyInputs = {
    forcedShotSharePct: [],
    attackerBackpasses: [],
    zigzagFlips: [],
    directBlockerPasses: [],
    brokenShotRowsPct: [],
  }
  const recommendations = []
  const matches = []

  for (const { cycle, fixture, report, reportPath } of reports) {
    const global = report.baselines?.global || {}
    baseline.goals.simulated += asNumber(global.totalGoals?.simulated)
    baseline.goals.baseline += asNumber(global.totalGoals?.baseline)
    baseline.shots.simulated += asNumber(global.totalShots?.simulated)
    baseline.shots.baseline += asNumber(global.totalShots?.baseline)
    baseline.shotsOnTarget.simulated += asNumber(global.totalShotsOnTarget?.simulated)
    baseline.shotsOnTarget.baseline += asNumber(global.totalShotsOnTarget?.baseline)
    baseline.corners.simulated += asNumber(global.totalCorners?.simulated)
    baseline.corners.baseline += asNumber(global.totalCorners?.baseline)

    for (const key of Object.keys(kpis)) {
      kpis[key].push(report.kpis?.[key]?.score)
    }
    for (const key of Object.keys(structureInputs)) {
      structureInputs[key].push(report.kpis?.soccerStructure?.inputs?.[key])
    }
    for (const key of Object.keys(efficiencyInputs)) {
      efficiencyInputs[key].push(report.kpis?.tuningEfficiency?.inputs?.[key])
    }
    recommendations.push(...(Array.isArray(report.recommendations) ? report.recommendations : []))
    matches.push({
      cycle,
      fixture: fixture || `${report.match?.teamA || '?'} vs ${report.match?.teamB || '?'}`,
      score: report.match?.score || '',
      reportPath,
      overallKpi: report.kpis?.overall?.score ?? null,
      baselineKpi: report.kpis?.baselineFit?.score ?? null,
      structureKpi: report.kpis?.soccerStructure?.score ?? null,
      efficiencyKpi: report.kpis?.tuningEfficiency?.score ?? null,
      shots: asNumber(report.baselines?.global?.totalShots?.simulated),
      goals: asNumber(report.baselines?.global?.totalGoals?.simulated),
    })
  }

  const avgKpis = Object.fromEntries(Object.entries(kpis).map(([key, values]) => [key, round(average(values), 1)]))
  const avgStructure = Object.fromEntries(Object.entries(structureInputs).map(([key, values]) => [key, round(average(values), 2)]))
  const avgEfficiency = Object.fromEntries(Object.entries(efficiencyInputs).map(([key, values]) => [key, round(average(values), 2)]))
  const drift = Object.fromEntries(Object.entries(baseline).map(([key, value]) => [
    key,
    {
      simulated: round(value.simulated, 2),
      baseline: round(value.baseline, 2),
      drift: round(value.simulated - value.baseline, 2),
    },
  ]))

  const working = []
  const notWorking = []
  const watch = []

  if (avgKpis.tuningEfficiency >= 75) working.push(`Tuning efficiency is holding (${avgKpis.tuningEfficiency}). Forced shots, direct-blocker passes, and broken rows are under guardrail.`)
  else notWorking.push(`Tuning efficiency is below guardrail (${avgKpis.tuningEfficiency}). Check forced shots, bad pass targets, and telemetry debt first.`)

  if (Math.min(avgStructure.widthA, avgStructure.widthB) >= 18 && avgStructure.centerAndNarrowWorst <= 35) {
    working.push(`Team shape is wide enough on average (width ${avgStructure.widthA}/${avgStructure.widthB}, center+narrow worst ${avgStructure.centerAndNarrowWorst}%).`)
  } else {
    notWorking.push(`Team shape is still too narrow or centralized (width ${avgStructure.widthA}/${avgStructure.widthB}, center+narrow worst ${avgStructure.centerAndNarrowWorst}%).`)
  }

  if (avgStructure.realCrosses >= 5) working.push(`Wide delivery volume is present (${avgStructure.realCrosses} real crosses per analyzed match).`)
  else watch.push(`Wide delivery volume is light (${avgStructure.realCrosses} real crosses per analyzed match).`)

  if (drift.shots.drift < -8 || drift.goals.drift < -1.25 || drift.shotsOnTarget.drift < -3) {
    notWorking.push(`Baseline production is under target: goals drift ${drift.goals.drift}, shots drift ${drift.shots.drift}, SOT drift ${drift.shotsOnTarget.drift}.`)
  } else {
    working.push(`Baseline production is within the current guardrail: goals drift ${drift.goals.drift}, shots drift ${drift.shots.drift}, SOT drift ${drift.shotsOnTarget.drift}.`)
  }

  if (avgStructure.dangerMarkedPct < 78) {
    notWorking.push(`Danger-zone marking is below target (${avgStructure.dangerMarkedPct}% marked vs 78% target).`)
  } else {
    working.push(`Danger-zone marking is meeting target (${avgStructure.dangerMarkedPct}% marked).`)
  }

  if (avgStructure.avgPatternTouches < 2) {
    notWorking.push(`Pattern possessions are resolving too quickly (${avgStructure.avgPatternTouches} touches vs 2+ target).`)
  } else {
    working.push(`Pattern possessions have enough touches (${avgStructure.avgPatternTouches}).`)
  }

  if (drift.corners.drift < -3) watch.push(`Corner volume remains low: drift ${drift.corners.drift}.`)
  if (avgEfficiency.zigzagFlips > 90) watch.push(`Carrier zigzag is above guardrail (${avgEfficiency.zigzagFlips} flips).`)
  if (avgEfficiency.attackerBackpasses > 18) watch.push(`Final-third backpasses are above guardrail (${avgEfficiency.attackerBackpasses}).`)

  return {
    generatedAt: new Date().toISOString(),
    mode: 'evaluation-only',
    note: 'No code edits are performed by iterate-overnight. This report aggregates regular-speed telemetry against MLS baseline KPIs.',
    options: summary.options,
    outDir: summary.outDir,
    analyzedCycles: analyzed,
    totalCycles: summary.totalGames,
    averages: {
      kpis: avgKpis,
      structure: avgStructure,
      efficiency: avgEfficiency,
    },
    baselineComparison: drift,
    working,
    notWorking,
    watch,
    recurringRecommendations: countBy(recommendations).slice(0, 8),
    matches,
  }
}

function formatFindingList(items) {
  if (!items.length) return '- None recorded.'
  return items.map((item) => `- ${item}`).join('\n')
}

function writeOvernightFindings(summary, outDir) {
  const findings = buildOvernightFindings(summary)
  const jsonPath = path.join(outDir, 'overnight-findings.json')
  const mdPath = path.join(outDir, 'overnight-findings.md')
  writeJson(jsonPath, findings)
  const lines = [
    '# Overnight Telemetry Findings',
    '',
    `Generated: ${findings.generatedAt}`,
    '',
    'Mode: evaluation-only. No code edits were performed.',
    '',
    '## KPI Averages',
    '',
    `- Overall: ${findings.averages.kpis.overall}`,
    `- Baseline fit: ${findings.averages.kpis.baselineFit}`,
    `- Soccer structure: ${findings.averages.kpis.soccerStructure}`,
    `- Tuning efficiency: ${findings.averages.kpis.tuningEfficiency}`,
    '',
    '## MLS Baseline Comparison',
    '',
    `- Goals: ${findings.baselineComparison.goals.simulated} vs ${findings.baselineComparison.goals.baseline} baseline (drift ${findings.baselineComparison.goals.drift})`,
    `- Shots: ${findings.baselineComparison.shots.simulated} vs ${findings.baselineComparison.shots.baseline} baseline (drift ${findings.baselineComparison.shots.drift})`,
    `- Shots on target: ${findings.baselineComparison.shotsOnTarget.simulated} vs ${findings.baselineComparison.shotsOnTarget.baseline} baseline (drift ${findings.baselineComparison.shotsOnTarget.drift})`,
    `- Corners: ${findings.baselineComparison.corners.simulated} vs ${findings.baselineComparison.corners.baseline} baseline (drift ${findings.baselineComparison.corners.drift})`,
    '',
    '## What Seems To Be Working',
    '',
    formatFindingList(findings.working),
    '',
    '## What Does Not Seem To Be Working',
    '',
    formatFindingList(findings.notWorking),
    '',
    '## Watch List',
    '',
    formatFindingList(findings.watch),
    '',
    '## Recurring Recommendations',
    '',
    findings.recurringRecommendations.length
      ? findings.recurringRecommendations.map((item) => `- ${item.count}x: ${item.text}`).join('\n')
      : '- None recorded.',
    '',
    '## Matches',
    '',
    findings.matches.length
      ? findings.matches.map((match) => `- Cycle ${match.cycle}: ${match.fixture} ${match.score} | overall ${match.overallKpi} | shots ${match.shots} | goals ${match.goals}`).join('\n')
      : '- No analyzed matches.',
    '',
  ]
  fs.writeFileSync(mdPath, lines.join('\n'))
  summary.findingsReport = jsonPath
  summary.findingsMarkdown = mdPath
  return findings
}

function getLastSimResult(simReport) {
  const results = Array.isArray(simReport?.results) ? simReport.results : []
  return results.length > 0 ? results[results.length - 1] : null
}

function buildAnalyzePlanFromSimResult(result, analysisReport, options, simReport, resultIndex) {
  if (!result) {
    return { skipped: true, reason: 'sim report did not contain any results', command: null, args: [] }
  }
  if (result.sessionId) {
    const [command, args] = npmRunArgs('telemetry:analyze', ['--session-id', result.sessionId, '--report-json', analysisReport])
    return { skipped: false, reason: '', command, args }
  }
  const fixtureLabel = `${result.teamA || '?'} vs ${result.teamB || '?'}`
  if (options.mode === 'smoke') {
    return {
      skipped: true,
      reason: `smoke sim did not persist a DB session for ${fixtureLabel}`,
      command: null,
      args: [],
    }
  }
  const [command, args] = npmRunArgs('telemetry:analyze', [
    '--bundle-json', simReport,
    '--result-index', String(resultIndex),
    '--report-json', analysisReport,
  ])
  return {
    skipped: false,
    reason: `using saved sim report because no DB session was persisted for ${fixtureLabel}`,
    command,
    args,
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = path.resolve(process.cwd(), options.outDir || path.join('telemetry', 'overnight', stamp))
  fs.mkdirSync(outDir, { recursive: true })
  preflight(options, outDir)
  const summaryPath = path.join(outDir, 'overnight-summary.json')
  const statusPath = path.join(outDir, 'overnight-status.json')
  const runLogPath = path.join(outDir, 'runner.out.log')
  const existingSummary = options.resume ? readJsonOrNull(summaryPath) : null
  const totalGames = options.cycles * options.gamesPerCycle
  const fixedFixtureLoop = Boolean(options.homeTeam && options.awayTeam)
  const resumedFixturePlan = Array.isArray(existingSummary?.fixturePlan) && existingSummary.fixturePlan.length === totalGames
    ? existingSummary.fixturePlan
    : null
  const fixturePlan = resumedFixturePlan || (fixedFixtureLoop
    ? Array.from({ length: totalGames }, (_, index) => ({
        gameNumber: index + 1,
        homeTeam: options.homeTeam,
        awayTeam: options.awayTeam,
      }))
    : planBatchFixtures(totalGames))

  const summary = {
    generatedAt: existingSummary?.generatedAt || new Date().toISOString(),
    resumedAt: existingSummary ? new Date().toISOString() : null,
    options,
    outDir,
    simTimeoutMs: getCycleSimTimeoutMs(options),
    totalGames,
    fixturePlan,
    dryRun: options.dryRun,
    commandPlans: [],
    cycles: Array.isArray(existingSummary?.cycles) ? existingSummary.cycles : [],
    failedCycles: Array.isArray(existingSummary?.failedCycles) ? existingSummary.failedCycles : [],
  }

  const completedCycleNumbers = new Set(
    summary.cycles
      .filter((cycle) => cycle && !cycle.failed)
      .map((cycle) => Number(cycle.cycle))
      .filter(Number.isFinite),
  )
  const lastCompletedCycle = completedCycleNumbers.size > 0 ? Math.max(...completedCycleNumbers) : null

  const status = {
    generatedAt: summary.generatedAt,
    updatedAt: new Date().toISOString(),
    state: 'starting',
    outDir,
    simTimeoutMs: summary.simTimeoutMs,
    completedCycles: completedCycleNumbers.size,
    totalCycles: options.cycles,
    completedGames: completedCycleNumbers.size * options.gamesPerCycle,
    totalGames,
    fixturePlan,
    currentCycle: null,
    currentPhase: null,
    currentFixtures: [],
    currentSimReport: null,
    currentAnalysisReport: null,
    commandPlansPath: null,
    runnerLogPath: runLogPath,
    lastCompletedCycle,
    lastCompletedSessionId: null,
    lastCompletedScore: null,
    failedCycles: summary.failedCycles,
    error: null,
  }
  const commandPlans = buildCycleCommandPlans(options, outDir, fixturePlan, summary)
  const commandPlansPath = path.join(outDir, 'overnight-command-plan.json')
  summary.commandPlans = commandPlans.map((plan) => ({
    cycle: plan.cycle,
    fixturesPath: plan.fixturesPath,
    fixtures: plan.fixtures,
    simReport: plan.simReport,
    analysisReport: plan.analysisReport,
    sim: plan.sim,
    analyze: plan.analyze,
  }))
  status.commandPlansPath = commandPlansPath
  for (const plan of commandPlans) {
    if (!completedCycleNumbers.has(plan.cycle)) {
      writeJson(plan.fixturesPath, plan.fixtures)
    }
  }
  writeJson(commandPlansPath, summary.commandPlans)
  if (!options.resume || !fs.existsSync(runLogPath)) {
    fs.writeFileSync(runLogPath, `# iterate-overnight ${new Date().toISOString()}\n`)
  }
  writeJson(summaryPath, summary)
  writeJson(statusPath, status)

  const touchStatusFromOutput = () => {
    status.updatedAt = new Date().toISOString()
    writeJson(statusPath, status)
  }

  if (options.dryRun) {
    status.updatedAt = new Date().toISOString()
    status.state = 'dry-run-completed'
    status.currentPhase = null
    writeJson(statusPath, status)
    writeJson(summaryPath, summary)
    console.log(`\nDry run complete. Overnight loop plan: ${summaryPath}`)
    console.log(`Command plan: ${commandPlansPath}`)
    return
  }

  try {
    for (const plan of commandPlans) {
      const { cycle, cycleLabel, simReport, analysisReport, fixturesPath, fixtures: cycleFixtures } = plan
      if (completedCycleNumbers.has(cycle)) {
        console.log(`[${cycleLabel}] skipped: already completed in ${summaryPath}`)
        continue
      }
      writeJson(fixturesPath, cycleFixtures)

      let lastSimResult = null
      let analyzePlan = null
      let analysis = null
      let cycleError = null
      for (let attempt = 1; attempt <= options.maxCycleAttempts; attempt++) {
        try {
          status.updatedAt = new Date().toISOString()
          status.state = 'running'
          status.currentCycle = cycle
          status.currentPhase = 'sim'
          status.currentAttempt = attempt
          status.currentFixtures = cycleFixtures
          status.currentSimReport = simReport
          status.currentAnalysisReport = analysisReport
          status.error = null
          writeJson(statusPath, status)

          if (attempt > 1) {
            console.log(`[${cycleLabel}] retry ${attempt}/${options.maxCycleAttempts}`)
          }
          await runCommand(`${cycleLabel}:sim`, plan.sim.command, plan.sim.args, {
            logPath: runLogPath,
            onOutput: touchStatusFromOutput,
          })
          const simRunReport = readJsonOrNull(simReport)
          lastSimResult = getLastSimResult(simRunReport)
          const simResults = Array.isArray(simRunReport?.results) ? simRunReport.results : []
          const lastSimResultIndex = simResults.length > 0 ? simResults.length - 1 : -1
          analyzePlan = buildAnalyzePlanFromSimResult(lastSimResult, analysisReport, options, simReport, lastSimResultIndex)

          status.updatedAt = new Date().toISOString()
          status.currentPhase = analyzePlan.skipped ? 'analyze-skipped' : 'analyze'
          writeJson(statusPath, status)

          if (analyzePlan.skipped) {
            console.log(`[${cycleLabel}:analyze] skipped: ${analyzePlan.reason}`)
          } else {
            await runCommand(`${cycleLabel}:analyze`, analyzePlan.command, analyzePlan.args, {
              logPath: runLogPath,
              onOutput: touchStatusFromOutput,
            })
          }

          if (!analyzePlan.skipped) {
            analysis = readJsonOrNull(analysisReport)
          }
          cycleError = null
          break
        } catch (error) {
          cycleError = error
          status.updatedAt = new Date().toISOString()
          status.currentPhase = 'retry-wait'
          status.error = error.message || String(error)
          writeJson(statusPath, status)
          console.warn(`[${cycleLabel}] attempt ${attempt}/${options.maxCycleAttempts} failed: ${status.error}`)
          if (attempt < options.maxCycleAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 5000))
          }
        }
      }

      if (cycleError) {
        const failedCycle = {
          cycle,
          fixturesPath,
          fixtures: cycleFixtures,
          simReport,
          analysisReport,
          failed: true,
          attempts: options.maxCycleAttempts,
          error: cycleError.message || String(cycleError),
        }
        summary.failedCycles.push(failedCycle)
        summary.cycles.push(failedCycle)
        writeOvernightFindings(summary, outDir)
        writeJson(summaryPath, summary)
        status.updatedAt = new Date().toISOString()
        status.currentPhase = null
        status.currentFixtures = []
        status.currentSimReport = null
        status.currentAnalysisReport = null
        status.currentAttempt = null
        status.failedCycles = summary.failedCycles
        writeJson(statusPath, status)
        if (!options.continueOnCycleFailure) {
          throw cycleError
        }
        console.warn(`[${cycleLabel}] continuing after failed cycle`)
        continue
      }

      summary.cycles.push({
        cycle,
        fixturesPath,
        fixtures: cycleFixtures,
        simReport,
        analysisReport,
        analyzed: !analyzePlan.skipped,
        analysisSkippedReason: analyzePlan.skipped ? analyzePlan.reason : null,
        simSessionId: lastSimResult?.sessionId || null,
        simScore: lastSimResult ? `${lastSimResult.scoreA}-${lastSimResult.scoreB}` : null,
        sessionId: analysis?.match?.sessionId || null,
        score: analysis?.match?.score || null,
        recommendations: analysis?.recommendations || [],
      })
      completedCycleNumbers.add(cycle)
      writeOvernightFindings(summary, outDir)
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
      status.currentAttempt = null
      status.failedCycles = summary.failedCycles
      writeJson(statusPath, status)
    }

    status.updatedAt = new Date().toISOString()
    status.state = 'completed'
    writeJson(statusPath, status)
    writeOvernightFindings(summary, outDir)
    writeJson(summaryPath, summary)
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
