#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const DEFAULT_URL = 'http://127.0.0.1:5173/'
const FALLBACK_SERVER_PORT = 4173
const FALLBACK_SERVER_URL = `http://127.0.0.1:${FALLBACK_SERVER_PORT}/`
const ALLOWED_GAME_QUANTITIES = [5, 10, 20]

const MLS_TEAMS = [
  'Atlanta United', 'Austin FC', 'Charlotte FC', 'Chicago Fire', 'FC Cincinnati',
  'Colorado Rapids', 'Columbus Crew', 'DC United', 'FC Dallas', 'Houston Dynamo',
  'Inter Miami', 'LA Galaxy', 'LAFC', 'Minnesota United', 'CF Montreal',
  'Nashville SC', 'New England Revolution', 'New York City FC', 'New York Red Bulls',
  'Orlando City', 'Philadelphia Union', 'Portland Timbers', 'Real Salt Lake',
  'San Diego FC', 'San Jose Earthquakes', 'Seattle Sounders', 'Sporting Kansas City',
  'St. Louis City SC', 'Toronto FC', 'Vancouver Whitecaps',
]

const FORMATIONS = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '3-4-3']
const TEAM_ALIASES = new Map([
  ['d.c. united', 'DC United'],
  ['dc united', 'DC United'],
  ['sporting kc', 'Sporting Kansas City'],
  ['sporting kansas city', 'Sporting Kansas City'],
  ['st. louis city sc', 'St. Louis City SC'],
  ['st. louis city', 'St. Louis City SC'],
  ['st. louis city sc', 'St. Louis City SC'],
  ['montreal', 'CF Montreal'],
])

function printHelp() {
  console.log(`Headless CPU vs CPU soccer sim runner

Usage:
  npm run sim:headless -- --games 10
  npm run sim:match -- --home "DC United" --away "Columbus Crew"

Options:
  --mode <name>      Run mode: tuning or smoke (default: tuning)
  --quantity <n>     Preset game quantity: 5, 10, or 20
  --games <n>        Number of CPU vs CPU games to run (default: 10)
  --home <team>      Fixed home team for every game
  --away <team>      Fixed away team for every game
  --formation-a <f>  Fixed formation for team A
  --formation-b <f>  Fixed formation for team B
  --fixtures-json <p>  Use an explicit ordered fixture list for this run
  --report-json <p>  Write a JSON run report to the given path
  --url <url>        Existing dev server URL (default: ${DEFAULT_URL})
  --speed <n>        Match clock multiplier (default: 1 tuning, 32 smoke)
  --half-seconds <n> Half duration in simulation seconds (default: 300)
  --allow-unsafe-speed  Allow speed > 40 (not recommended for telemetry tuning)
  --timeout-ms <ms>  Total timeout for the run
  --verbose          Print browser/server diagnostics
  --headed           Show the browser window
  --help             Show this help

Notes:
  - If ${DEFAULT_URL} is not reachable, the script auto-starts a Vite dev server on ${FALLBACK_SERVER_URL}.
  - Team matchups are randomized from a shuffled pool with no duplicate fixture repeats per cycle.
  - The sim runs headless in Chromium/Edge and prints text summaries as games finish.
  - In tuning mode, keep clock speed at 1 unless you intentionally want unrealistic telemetry.
  - Use --half-seconds for shorter truthful verification runs without reintroducing clock-compression artifacts.
  - Use tuning mode for behavior-trustworthy telemetry runs and smoke mode for fast runner health checks.
  - Results are stored in IndexedDB telemetry and visible in the MATCHES dashboard tab.`)
}

function parseArgs(argv) {
  const options = {
    mode: 'tuning',
    games: 10,
    url: DEFAULT_URL,
    speed: 1,
    halfSeconds: 300,
    speedExplicit: false,
    maxSafeSpeed: 40,
    timeoutMs: null,
    verbose: false,
    customUrl: false,
    headed: false,
    allowUnsafeSpeed: false,
    help: false,
    homeTeam: '',
    awayTeam: '',
    formationA: '',
    formationB: '',
    fixturesJson: '',
    reportJson: '',
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--mode') {
      const next = (argv[i + 1] || '').trim().toLowerCase()
      if (next !== 'tuning' && next !== 'smoke') {
        throw new Error('Expected tuning or smoke after --mode')
      }
      options.mode = next
      i += 1
    } else if (arg === '--smoke') {
      options.mode = 'smoke'
    } else if (arg === '--games') {
      const next = Number(argv[i + 1])
      if (!Number.isFinite(next) || next <= 0) throw new Error('Expected a positive number after --games')
      options.games = Math.floor(next)
      i += 1
    } else if (arg === '--quantity') {
      const next = Number(argv[i + 1])
      if (!Number.isFinite(next) || !ALLOWED_GAME_QUANTITIES.includes(next)) {
        throw new Error(`Expected one of ${ALLOWED_GAME_QUANTITIES.join(', ')} after --quantity`)
      }
      options.games = next
      i += 1
    } else if (arg === '--url') {
      const next = argv[i + 1]
      if (!next) throw new Error('Expected a URL after --url')
      options.url = new URL(next).toString()
      options.customUrl = true
      i += 1
    } else if (arg === '--home') {
      const next = argv[i + 1]
      if (!next) throw new Error('Expected a team name after --home')
      options.homeTeam = next
      i += 1
    } else if (arg === '--away') {
      const next = argv[i + 1]
      if (!next) throw new Error('Expected a team name after --away')
      options.awayTeam = next
      i += 1
    } else if (arg === '--formation-a') {
      const next = argv[i + 1]
      if (!next) throw new Error('Expected a formation after --formation-a')
      options.formationA = next
      i += 1
    } else if (arg === '--formation-b') {
      const next = argv[i + 1]
      if (!next) throw new Error('Expected a formation after --formation-b')
      options.formationB = next
      i += 1
    } else if (arg === '--report-json') {
      const next = argv[i + 1]
      if (!next) throw new Error('Expected a file path after --report-json')
      options.reportJson = next
      i += 1
    } else if (arg === '--fixtures-json') {
      const next = argv[i + 1]
      if (!next) throw new Error('Expected a file path after --fixtures-json')
      options.fixturesJson = next
      i += 1
    } else if (arg === '--speed') {
      const next = Number(argv[i + 1])
      if (!Number.isFinite(next) || next <= 0) throw new Error('Expected a positive number after --speed')
      options.speed = next
      options.speedExplicit = true
      i += 1
    } else if (arg === '--half-seconds') {
      const next = Number(argv[i + 1])
      if (!Number.isFinite(next) || next <= 0) throw new Error('Expected a positive number after --half-seconds')
      options.halfSeconds = Math.floor(next)
      i += 1
    } else if (arg === '--allow-unsafe-speed') {
      options.allowUnsafeSpeed = true
    } else if (arg === '--timeout-ms') {
      const next = Number(argv[i + 1])
      if (!Number.isFinite(next) || next <= 0) throw new Error('Expected a positive number after --timeout-ms')
      options.timeoutMs = Math.floor(next)
      i += 1
    } else if (arg === '--verbose') {
      options.verbose = true
    } else if (arg === '--headed') {
      options.headed = true
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!options.speedExplicit) {
    options.speed = options.mode === 'smoke' ? 32 : 1
  }

  if (!options.timeoutMs) {
    options.timeoutMs = options.games * (options.mode === 'smoke' ? 3 : 5) * 60 * 1000
  }

  if ((options.homeTeam && !options.awayTeam) || (!options.homeTeam && options.awayTeam)) {
    throw new Error('Use --home and --away together for a fixed matchup')
  }
  if (options.fixturesJson && (options.homeTeam || options.awayTeam)) {
    throw new Error('Use --fixtures-json or --home/--away, not both')
  }

  if (!options.allowUnsafeSpeed && options.speed > options.maxSafeSpeed) {
    throw new Error(
      `Requested --speed ${options.speed} exceeds safe telemetry limit ${options.maxSafeSpeed}. ` +
      `Use --allow-unsafe-speed to override (not recommended for tuning runs).`
    )
  }

  if (!options.allowUnsafeSpeed && options.mode === 'tuning' && options.speed > 1) {
    throw new Error(
      `Requested --speed ${options.speed} in tuning mode would compress the match clock and distort telemetry. ` +
      `Use --allow-unsafe-speed to override if you only want a fast smoke-style run.`
    )
  }

  return options
}

function resolveTeamName(input) {
  if (!input) return ''
  const trimmed = input.trim()
  const aliased = TEAM_ALIASES.get(trimmed.toLowerCase()) || trimmed
  const exact = MLS_TEAMS.find((team) => team.toLowerCase() === aliased.toLowerCase())
  if (exact) return exact
  throw new Error(`Unknown team: ${input}`)
}

function resolveFormation(input) {
  if (!input) return ''
  const trimmed = input.trim()
  if (!FORMATIONS.includes(trimmed)) {
    throw new Error(`Unknown formation: ${input}`)
  }
  return trimmed
}

function loadFixtureList(fixturesJsonPath, expectedGames) {
  if (!fixturesJsonPath) return []
  const resolvedPath = path.resolve(process.cwd(), fixturesJsonPath)
  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'))
  } catch (error) {
    throw new Error(`Could not read fixtures JSON at ${resolvedPath}: ${error.message}`)
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected fixtures JSON array at ${resolvedPath}`)
  }
  const fixtures = parsed.map((fixture, index) => {
    if (!fixture || typeof fixture !== 'object') {
      throw new Error(`Fixture ${index + 1} in ${resolvedPath} must be an object`)
    }
    return {
      homeTeam: resolveTeamName(fixture.homeTeam || fixture.home || ''),
      awayTeam: resolveTeamName(fixture.awayTeam || fixture.away || ''),
    }
  })
  for (let i = 0; i < fixtures.length; i++) {
    const fixture = fixtures[i]
    if (!fixture.homeTeam || !fixture.awayTeam) {
      throw new Error(`Fixture ${i + 1} in ${resolvedPath} must include homeTeam and awayTeam`)
    }
    if (fixture.homeTeam === fixture.awayTeam) {
      throw new Error(`Fixture ${i + 1} in ${resolvedPath} cannot use the same team twice`)
    }
  }
  if (expectedGames !== fixtures.length) {
    throw new Error(
      `Expected ${expectedGames} fixture(s) in ${resolvedPath}, found ${fixtures.length}`,
    )
  }
  return fixtures
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
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

function createMatchupPicker(teams) {
  let pool = shuffleInPlace(buildAllMatchups(teams))
  return () => {
    if (pool.length === 0) {
      pool = shuffleInPlace(buildAllMatchups(teams))
    }
    const [a, b] = pool.pop()
    return Math.random() < 0.5 ? [a, b] : [b, a]
  }
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function pct(made, attempts) {
  if (!attempts) return '0.0%'
  return `${((made / attempts) * 100).toFixed(1)}%`
}

async function withCleanupTimeout(work, timeoutMs) {
  return await Promise.race([
    Promise.resolve().then(work),
    delay(timeoutMs).then(() => {
      throw new Error(`cleanup step exceeded ${timeoutMs}ms`)
    }),
  ])
}

async function isUrlReachable(url) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 2500)
  try {
    const response = await fetch(url, { method: 'GET', signal: controller.signal })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}

async function waitForUrl(url, timeoutMs) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isUrlReachable(url)) return true
    await delay(500)
  }
  return false
}

function findBrowserExecutable() {
  const candidates = [
    process.env.HEADLESS_SIM_BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft/Edge/Application/msedge.exe'),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/microsoft-edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
  ].filter(Boolean)

  return candidates.find((c) => fs.existsSync(c)) || ''
}

function spawnDevServer(repoRoot, verbose) {
  const nodeExec = process.execPath
  const viteCli = path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js')
  const child = spawn(nodeExec, [viteCli, '--host', '127.0.0.1', '--port', String(FALLBACK_SERVER_PORT)], {
    cwd: repoRoot,
    env: { ...process.env, BROWSER: 'none' },
    stdio: verbose ? 'inherit' : 'pipe',
    windowsHide: true,
  })
  return child
}

async function terminateChildProcess(child) {
  if (!child || child.exitCode !== null) return
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
      killer.on('close', () => resolve())
      killer.on('error', () => resolve())
    })
    return
  }
  try { child.kill('SIGTERM') } catch {}
}

async function forceKillCurrentProcessTree() {
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(process.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      })
      killer.on('close', () => resolve())
      killer.on('error', () => resolve())
    })
    return
  }

  try {
    process.kill(-process.pid, 'SIGKILL')
  } catch {}
}

function createShutdownController() {
  let active = false
  let forcedKillTimer = null

  return {
    isActive() {
      return active
    },
    async run(reason, cleanup, exitCode = 1) {
      if (active) return
      active = true
      console.error(`[shutdown] ${reason}`)

      forcedKillTimer = setTimeout(() => {
        console.error('[shutdown] forcing process tree kill')
        void forceKillCurrentProcessTree()
      }, 5000)
      forcedKillTimer.unref?.()

      try {
        await cleanup()
      } catch (error) {
        console.error(`[shutdown] cleanup error: ${error?.message || error}`)
      } finally {
        if (forcedKillTimer) {
          clearTimeout(forcedKillTimer)
          forcedKillTimer = null
        }
      }

      process.exit(exitCode)
    },
  }
}

async function waitForGameReady(page, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const ready = await page.evaluate(() => !!window.__gameRef?.getMatchSnapshot)
    if (ready) return true
    await delay(500)
  }
  return false
}

async function startMatch(page, teamA, teamB, formA, formB, speed, mode, halfSeconds) {
  const fastRestarts = speed > 1 || mode === 'smoke'
  const restartMin = fastRestarts ? 0.2 : 0.8
  const restartMax = fastRestarts ? 0.3 : 1.2

  await page.evaluate(() => {
    const game = window.__gameRef
    game.setSmokeTestMode?.(true)
    game.resetMatch()
  })
  await delay(300)

  await page.evaluate(({ teamA, teamB, formA, formB, speed, restartMin, restartMax, halfSeconds }) => {
    const game = window.__gameRef
    window.focus?.()
    document.body?.focus?.()
    game.setTeamNames(teamA, teamB)
    game.setTeamFormations(formA, formB)
    game.setCpuVsCpu(true)
    game.setHalfDurationSeconds?.(halfSeconds)
    game.setSeriesSpeedMul(speed)
    game.setRestartDelays(restartMin, restartMax)
    game.setMenuVisible(false)
  }, { teamA, teamB, formA, formB, speed, restartMin, restartMax, halfSeconds })
  await delay(120)

  await page.evaluate(() => {
    const game = window.__gameRef
    game.startKickoffPresentation?.(true)
  })
}

async function waitForFullTime(page, timeoutMs = 600000) {
  const start = Date.now()
  let lastLog = 0
  let lastMotionAt = Date.now()
  let lastPhase = ''
  let lastHalf = 0
  let lastElapsed = -1
  while (Date.now() - start < timeoutMs) {
    const snap = await page.evaluate(() => {
      const s = window.__gameRef?.getMatchSnapshot?.()
      return s ? { phase: s.phase, half: s.half, elapsedInHalf: s.elapsedInHalf } : null
    })
    if (snap?.phase === 'FULL_TIME') return true
    const phase = snap?.phase || ''
    const half = snap?.half || 0
    const elapsed = Number.isFinite(snap?.elapsedInHalf) ? snap.elapsedInHalf : -1
    const moved =
      phase !== lastPhase ||
      half !== lastHalf ||
      (elapsed >= 0 && Math.abs(elapsed - lastElapsed) > 0.25)
    if (moved) {
      lastMotionAt = Date.now()
      lastPhase = phase
      lastHalf = half
      lastElapsed = elapsed
    } else if (Date.now() - lastMotionAt > 30000) {
      throw new Error(
        `Match stalled while waiting for full time: phase=${phase || 'UNKNOWN'} ` +
        `half=${half || 0} clock=${elapsed >= 0 ? elapsed.toFixed(1) : 'n/a'}`
      )
    }
    const now = Date.now()
    if (now - lastLog > 10000) {
      console.log(`  [poll] phase=${snap?.phase} half=${snap?.half} clock=${snap?.elapsedInHalf?.toFixed(1)}`)
      lastLog = now
    }
    await delay(500)
  }
  return false
}

function getRemainingRunTimeMs(startedAt, totalTimeoutMs) {
  return Math.max(0, totalTimeoutMs - (Date.now() - startedAt))
}

function requireRemainingRunTimeMs(startedAt, totalTimeoutMs, label) {
  const remaining = getRemainingRunTimeMs(startedAt, totalTimeoutMs)
  if (remaining <= 0) {
    throw new Error(`Timed out after ${formatDuration(totalTimeoutMs)} during ${label}`)
  }
  return remaining
}

async function captureMatchResult(page) {
  return page.evaluate(() => {
    const snap = window.__gameRef?.getMatchSnapshot?.()
    if (!snap) return null
    const bundle = window.__gameRef?.getTuningBundle?.() || {}
    return {
      teamA: snap.teamAName,
      teamB: snap.teamBName,
      sessionId: bundle.metadata?.sessionId || snap.sessionId || null,
      scoreA: snap.scoreA,
      scoreB: snap.scoreB,
      shotsA: snap.shotsA,
      shotsB: snap.shotsB,
      sogA: snap.shotsOnTargetA,
      sogB: snap.shotsOnTargetB,
      savesA: snap.savesA,
      savesB: snap.savesB,
      headersA: snap.headersA ?? 0,
      headersB: snap.headersB ?? 0,
      passesA: snap.passesA ?? 0,
      passesB: snap.passesB ?? 0,
      passCompA: snap.passesCompletedA ?? 0,
      passCompB: snap.passesCompletedB ?? 0,
      tacklesA: snap.tacklesWonA ?? 0,
      tacklesB: snap.tacklesWonB ?? 0,
      clearancesA: snap.clearancesA ?? 0,
      clearancesB: snap.clearancesB ?? 0,
      foulsA: snap.foulsA ?? 0,
      foulsB: snap.foulsB ?? 0,
      cornersA: snap.cornersA ?? 0,
      cornersB: snap.cornersB ?? 0,
      possA: snap.possessionA ?? 50,
      possB: snap.possessionB ?? 50,
      formA: snap.teamAFormation,
      formB: snap.teamBFormation,
      goals: snap.goalLog || [],
      // Full tuning telemetry channels
      tuning: {
        roleStatsA: bundle.teamA?.roleStats || {},
        roleStatsB: bundle.teamB?.roleStats || {},
        passNetA: bundle.teamA?.passNetwork || [],
        passNetB: bundle.teamB?.passNetwork || [],
        events: bundle.events || [],
        shapeA: bundle.shapeA || [],
        shapeB: bundle.shapeB || [],
        transitions: bundle.transitions || [],
        metadata: bundle.metadata || {},
      },
    }
  })
}

function printGameSummary(index, result) {
  const winner = result.scoreA > result.scoreB
    ? `${result.teamA} WIN`
    : result.scoreB > result.scoreA
      ? `${result.teamB} WIN`
      : 'DRAW'

  console.log(`Game ${index} | ${result.teamA} ${result.scoreA} - ${result.scoreB} ${result.teamB} | ${winner}`)
  console.log(`  Shots ${result.shotsA}-${result.shotsB} | SOG ${result.sogA}-${result.sogB} | Saves ${result.savesA}-${result.savesB} | Headers ${result.headersA}-${result.headersB}`)
  console.log(`  Passes ${result.passesA}(${result.passCompA})-${result.passesB}(${result.passCompB}) | Tackles ${result.tacklesA}-${result.tacklesB} | Fouls ${result.foulsA}-${result.foulsB}`)
  console.log(`  Possession ${result.possA}%-${result.possB}% | Corners ${result.cornersA}-${result.cornersB} | Clearances ${result.clearancesA}-${result.clearancesB}`)
  console.log(`  Formations: ${result.formA} vs ${result.formB}`)
  if (result.goals.length > 0) {
    const goalStr = result.goals.map(g => `${g.matchMinute}' #${g.shirtNumber} ${g.playerName} (${g.team})`).join(', ')
    console.log(`  Goals: ${goalStr}`)
  }
}

function printAggregate(results) {
  const n = results.length
  const totalGoals = results.reduce((s, r) => s + r.scoreA + r.scoreB, 0)
  const totalShots = results.reduce((s, r) => s + r.shotsA + r.shotsB, 0)
  const totalSog = results.reduce((s, r) => s + r.sogA + r.sogB, 0)
  const totalSaves = results.reduce((s, r) => s + r.savesA + r.savesB, 0)
  const totalPasses = results.reduce((s, r) => s + (r.passesA || 0) + (r.passesB || 0), 0)
  const totalPassComp = results.reduce((s, r) => s + (r.passCompA || 0) + (r.passCompB || 0), 0)
  const totalTackles = results.reduce((s, r) => s + (r.tacklesA || 0) + (r.tacklesB || 0), 0)
  const totalFouls = results.reduce((s, r) => s + (r.foulsA || 0) + (r.foulsB || 0), 0)
  const draws = results.filter(r => r.scoreA === r.scoreB).length
  const cleanSheets = results.filter(r => r.scoreA === 0 || r.scoreB === 0).length

  console.log('')
  console.log(`${'-'.repeat(60)}`)
  console.log(`Run complete | ${n} game${n === 1 ? '' : 's'}`)
  console.log(`  Avg goals/game: ${(totalGoals / n).toFixed(1)} | Range: ${Math.min(...results.map(r => r.scoreA + r.scoreB))}-${Math.max(...results.map(r => r.scoreA + r.scoreB))}`)
  console.log(`  Avg shots/game: ${(totalShots / n).toFixed(1)} | Shot accuracy: ${pct(totalSog, totalShots)}`)
  console.log(`  Avg saves/game: ${(totalSaves / n).toFixed(1)}`)
  console.log(`  Avg passes/game: ${(totalPasses / n).toFixed(1)} | Pass completion: ${pct(totalPassComp, totalPasses)}`)
  console.log(`  Avg tackles/game: ${(totalTackles / n).toFixed(1)} | Avg fouls/game: ${(totalFouls / n).toFixed(1)}`)
  console.log(`  Draws: ${draws}/${n} (${pct(draws, n)}) | Clean sheets: ${cleanSheets}/${n}`)
  console.log(`${'-'.repeat(60)}`)
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }
  const runStartedAt = Date.now()
  const fixedHome = resolveTeamName(options.homeTeam)
  const fixedAway = resolveTeamName(options.awayTeam)
  const fixedFormationA = resolveFormation(options.formationA)
  const fixedFormationB = resolveFormation(options.formationB)
  const explicitFixtures = loadFixtureList(options.fixturesJson, options.games)

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const executablePath = findBrowserExecutable()
  if (!executablePath) {
    throw new Error('No Chromium-based browser found. Set HEADLESS_SIM_BROWSER to an Edge/Chrome executable path.')
  }

  let targetUrl = options.url
  let serverProcess = null
  let browser = null
  let context = null
  let page = null
  let timeoutWatchdog = null
  const shutdown = createShutdownController()

  const cleanupResources = async () => {
    await withCleanupTimeout(async () => {
      if (page) {
        await page.close().catch(() => {})
      }
    }, 2000).catch(() => {})

    await withCleanupTimeout(async () => {
      if (context) {
        await context.close().catch(() => {})
      }
    }, 3000).catch(() => {})

    await withCleanupTimeout(async () => {
      if (browser) {
        await browser.close().catch(() => {})
      }
    }, 3000).catch(() => {})

    await withCleanupTimeout(async () => {
      await terminateChildProcess(serverProcess)
    }, 3000).catch(() => {})
  }

  const handleSignal = (signal) => {
    void shutdown.run(`received ${signal}`, cleanupResources, 1)
  }

  process.once('SIGINT', handleSignal)
  process.once('SIGTERM', handleSignal)

  timeoutWatchdog = setTimeout(() => {
    void shutdown.run(`global timeout after ${formatDuration(options.timeoutMs)}`, cleanupResources, 1)
  }, options.timeoutMs)
  timeoutWatchdog.unref?.()

  if (!(await isUrlReachable(targetUrl))) {
    requireRemainingRunTimeMs(runStartedAt, options.timeoutMs, 'server startup')
    if (options.customUrl) {
      throw new Error(`Target URL is not reachable: ${targetUrl}`)
    }
    console.log(`Server not detected at ${targetUrl}. Starting Vite dev server on ${FALLBACK_SERVER_URL}`)
    serverProcess = spawnDevServer(repoRoot, options.verbose)
    const ready = await waitForUrl(FALLBACK_SERVER_URL, Math.min(30000, requireRemainingRunTimeMs(runStartedAt, options.timeoutMs, 'server startup')))
    if (!ready) {
      throw new Error(`Timed out waiting for Vite dev server at ${FALLBACK_SERVER_URL}`)
    }
    targetUrl = FALLBACK_SERVER_URL
  }

  browser = await chromium.launch({
    executablePath,
    headless: !options.headed,
    args: [
      '--disable-dev-shm-usage',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-angle=swiftshader',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling,BackForwardCache',
    ],
  })

  context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  page = await context.newPage()
  await page.bringToFront().catch(() => {})

  if (options.verbose) {
    page.on('console', (msg) => {
      const type = msg.type()
      if (type === 'error' || type === 'warning') {
        console.error(`[browser:${type}] ${msg.text()}`)
      }
    })
    page.on('pageerror', (err) => console.error(`[pageerror] ${err.message}`))
  }

  try {
    console.log(`Starting headless CPU vs CPU | mode=${options.mode} | games=${options.games} | speed=${options.speed}x | url=${targetUrl}`)
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: Math.min(30000, requireRemainingRunTimeMs(runStartedAt, options.timeoutMs, 'page load')),
    })
    await page.bringToFront().catch(() => {})

    const gameReady = await waitForGameReady(page, Math.min(30000, requireRemainingRunTimeMs(runStartedAt, options.timeoutMs, 'game initialization')))
    if (!gameReady) throw new Error('Game engine did not initialize within timeout')

    const results = []
    const nextMatchup = createMatchupPicker(MLS_TEAMS)

    for (let i = 0; i < options.games; i++) {
      const remainingBeforeKickoff = getRemainingRunTimeMs(runStartedAt, options.timeoutMs)
      if (remainingBeforeKickoff <= 0) {
        throw new Error(`Timed out after ${formatDuration(options.timeoutMs)} waiting for ${options.games} game(s)`)
      }

      const scheduledFixture = explicitFixtures[i] || null
      const [teamA, teamB] = fixedHome && fixedAway
        ? [fixedHome, fixedAway]
        : scheduledFixture
          ? [scheduledFixture.homeTeam, scheduledFixture.awayTeam]
          : nextMatchup()
      const formA = fixedFormationA || pickRandom(FORMATIONS)
      const formB = fixedFormationB || pickRandom(FORMATIONS)

      console.log(`\n[${formatDuration(Date.now() - runStartedAt)}] Game ${i + 1}/${options.games}: ${teamA} (${formA}) vs ${teamB} (${formB})`)

      await page.bringToFront().catch(() => {})
      await startMatch(page, teamA, teamB, formA, formB, options.speed, options.mode, options.halfSeconds)
      await delay(500)

      const remainingForMatch = getRemainingRunTimeMs(runStartedAt, options.timeoutMs)
      if (remainingForMatch <= 0) {
        throw new Error(`Timed out after ${formatDuration(options.timeoutMs)} waiting for ${options.games} game(s)`)
      }

      const finished = await waitForFullTime(page, Math.min(600000, remainingForMatch))
      if (!finished) {
        const elapsed = Date.now() - runStartedAt
        throw new Error(`Timed out after ${formatDuration(elapsed)} waiting for game ${i + 1} to finish`)
      }

      await delay(1000)
      const result = await captureMatchResult(page)
      if (result) {
        if (scheduledFixture) {
          result.fixtureSource = 'scheduled'
        } else if (fixedHome && fixedAway) {
          result.fixtureSource = 'fixed'
        } else {
          result.fixtureSource = 'random'
        }
        results.push(result)
        printGameSummary(results.length, result)
      }
    }

    // Restore normal mode
    await page.evaluate(() => {
      const game = window.__gameRef
      game?.setSmokeTestMode?.(false)
      game?.setSeriesSpeedMul?.(1)
      game?.setRestartDelays?.(2.0, 3.0)
    })

    if (results.length > 0) {
      printAggregate(results)
    }

    if (options.reportJson) {
      const outPath = path.resolve(repoRoot, options.reportJson)
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      fs.writeFileSync(outPath, JSON.stringify({
        generatedAt: new Date().toISOString(),
        options: {
          ...options,
          homeTeam: fixedHome || null,
          awayTeam: fixedAway || null,
          formationA: fixedFormationA || null,
          formationB: fixedFormationB || null,
        },
        results,
      }, null, 2))
      console.log(`Saved headless sim report: ${outPath}`)
    }
  } finally {
    if (timeoutWatchdog) {
      clearTimeout(timeoutWatchdog)
      timeoutWatchdog = null
    }
    process.removeListener('SIGINT', handleSignal)
    process.removeListener('SIGTERM', handleSignal)
    if (!shutdown.isActive()) {
      await cleanupResources()
    }
  }
}

run().catch((error) => {
  console.error(error.message || error)
  process.exitCode = 1
})
