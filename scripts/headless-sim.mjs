#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { WORLD_CUP_2026_TEAM_NAMES, resolveWorldCupTeamName } from '../src/teamCatalog.js'

const DEFAULT_URL = 'http://127.0.0.1:5173/'
const FALLBACK_SERVER_PORT = 4173
const FALLBACK_SERVER_URL = `http://127.0.0.1:${FALLBACK_SERVER_PORT}/`
const ALLOWED_GAME_QUANTITIES = [5, 10, 20]

const MLS_TEAMS = WORLD_CUP_2026_TEAM_NAMES

const FORMATIONS = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '3-4-3']
const TEAM_ALIASES = new Map()

function computeFixtureRuntimeTimeoutMs(halfSeconds, speed) {
  const safeHalfSeconds = Math.max(30, Number(halfSeconds) || 300)
  const safeSpeed = Math.max(1, Number(speed) || 1)
  const expectedWallMs = (safeHalfSeconds * 2 * 1000) / safeSpeed
  return Math.ceil(Math.max(420_000, expectedWallMs * 2 + 120_000))
}

function printHelp() {
  console.log(`Headless CPU vs CPU soccer sim runner

Usage:
  npm run sim:headless -- --games 10
  npm run sim:match -- --home "United States" --away "Mexico"

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
  --half-seconds <n> Half duration in simulation seconds (default: 150)
  --allow-unsafe-speed  Allow speed > 40 (not recommended for telemetry tuning)
  --timeout-ms <ms>  Total timeout for the run
  --gpu-headless     Use Chrome/Edge headless with GPU acceleration (default)
  --no-gpu-headless  Disable GPU acceleration and use software rendering flags
  --visual-audit     Save screenshots around structured delivery/finish events
  --visual-audit-dir <p>  Directory for visual audit screenshots/manifest
  --verbose          Print browser/server diagnostics
  --headed           Show the browser window
  --help             Show this help

Notes:
  - If ${DEFAULT_URL} is not reachable, the script auto-starts a Vite dev server on ${FALLBACK_SERVER_URL}.
  - Team matchups are randomized from the 48-team world catalog with no duplicate fixture repeats per cycle.
  - The sim runs headless in Chrome/Edge and prints text summaries as games finish.
  - Chrome is preferred for headless GPU mode; set HEADLESS_SIM_BROWSER to override.
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
    halfSeconds: 150,
    speedExplicit: false,
    maxSafeSpeed: 40,
    timeoutMs: null,
    verbose: false,
    customUrl: false,
    headed: false,
    gpuHeadless: true,
    visualAudit: false,
    visualAuditDir: '',
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
    } else if (arg === '--query') {
      const next = argv[i + 1]
      if (!next) throw new Error('Expected a query string after --query')
      options.querySuffix = next.startsWith('?') ? next.slice(1) : next
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
    } else if (arg === '--gpu-headless') {
      options.gpuHeadless = true
    } else if (arg === '--no-gpu-headless') {
      options.gpuHeadless = false
    } else if (arg === '--visual-audit') {
      options.visualAudit = true
    } else if (arg === '--visual-audit-dir') {
      const next = argv[i + 1]
      if (!next) throw new Error('Expected a directory path after --visual-audit-dir')
      options.visualAuditDir = next
      i += 1
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
    const perGameTimeoutMs = options.mode === 'smoke'
      ? Math.max(180_000, Math.ceil(((Math.max(1, options.halfSeconds) * 2) / Math.max(1, options.speed)) * 1000 + 90_000))
      : computeFixtureRuntimeTimeoutMs(options.halfSeconds, options.speed)
    options.timeoutMs = Math.ceil(options.games * perGameTimeoutMs + 60_000)
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
  const worldCupTeam = resolveWorldCupTeamName(trimmed)
  if (worldCupTeam) return worldCupTeam
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

async function getUrlHtml(url) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 2500)
  try {
    const response = await fetch(url, { method: 'GET', signal: controller.signal })
    if (!response.ok) return ''
    return await response.text()
  } catch {
    return ''
  } finally {
    clearTimeout(timeoutId)
  }
}

async function isPixelSoccerUrl(url) {
  const html = await getUrlHtml(url)
  return /<title>\s*Pixel Soccer League\s*<\/title>/i.test(html)
    || /\/src\/main\.tsx/.test(html)
    || /pixel-soccer-league/i.test(html)
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
  const override = process.env.HEADLESS_SIM_BROWSER
  const candidates = [
    override,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft/Edge/Application/msedge.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/microsoft-edge',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
  ].filter(Boolean)

  return candidates.find((c) => fs.existsSync(c)) || ''
}

async function waitForPixelSoccerUrl(url, timeoutMs) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isPixelSoccerUrl(url)) return true
    await delay(500)
  }
  return false
}

function getBrowserLaunchArgs(options) {
  const shared = [
    '--disable-dev-shm-usage',
    '--enable-webgl',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling,BackForwardCache',
  ]

  if (options.gpuHeadless) {
    return [
      ...shared,
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--use-angle=d3d11',
      '--enable-unsafe-webgpu',
    ]
  }

  return [
    ...shared,
    '--disable-gpu',
    '--ignore-gpu-blocklist',
    '--use-angle=swiftshader',
  ]
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
    const ready = await evaluateWithPageRetry(page, () => {
      const game = window.__gameRef?.setTeamNames ? window.__gameRef : window.pslGame
      if (game?.setTeamNames) window.__gameRef = game
      return !!(
        game?.getMatchSnapshot
        && game?.setTeamNames
        && game?.setTeamFormations
        && game?.resetMatch
        && game?.startKickoffPresentation
        && window.pslSmokeTest?.runFixture
      )
    })
    if (ready) return true
    await delay(500)
  }
  return false
}

async function startMatch(page, teamA, teamB, formA, formB, speed, mode, halfSeconds) {
  const startedViaSmokeApi = await evaluateWithPageRetry(page, ({ teamA, teamB, formA, formB, speed, halfSeconds }) => {
    window.focus?.()
    document.body?.focus?.()
    window.__gameRef?.setSplashSceneMode?.(false)
    window.__gameRef?.setMenuVisible?.(false)
    const smoke = window.pslSmokeTest
    if (!smoke?.runFixture) return false
    const existingStartedAt = Number(window.__headlessFixtureStartedAt || 0)
    if (window.__headlessFixturePromise?.finally && Date.now() - existingStartedAt < 15000) return true
    window.__headlessFixturePromise = null
    window.__headlessFixtureError = null
    window.__headlessFixtureResult = null
    window.__headlessFixtureStartedAt = Date.now()
    window.__headlessFixturePromise = Promise.resolve(smoke.runFixture({
      homeTeam: teamA,
      awayTeam: teamB,
      formationA: formA,
      formationB: formB,
      speedMul: speed,
      halfSeconds,
      timeoutMs: 1_440_000,
      randomizeTeams: false,
    }))
    window.__headlessFixturePromise
      .then((result) => { window.__headlessFixtureResult = result })
      .catch((error) => { window.__headlessFixtureError = String(error?.stack || error?.message || error) })
      .finally(() => {
        window.__headlessFixturePromise = null
        window.__headlessFixtureStartedAt = 0
      })
    return true
  }, { teamA, teamB, formA, formB, speed, halfSeconds })

  if (startedViaSmokeApi) {
    await waitForMatchStart(page, 20000)
    return
  }

  throw new Error('Browser smoke-test fixture API is not available')
}

async function readMatchStartState(page) {
  return evaluateWithPageRetry(page, () => {
    const game = window.__gameRef
    const snap = game?.getMatchSnapshot?.()
    const result = window.__headlessFixtureResult || null
    return {
      hasGame: !!game,
      hasSmoke: typeof window.pslSmokeTest?.runFixture === 'function',
      hasPromise: !!window.__headlessFixturePromise,
      fixtureError: window.__headlessFixtureError || null,
      fixtureResult: result ? {
        phase: result.phase || null,
        half: result.half || 0,
        elapsedInHalf: Number.isFinite(result.elapsedInHalf) ? result.elapsedInHalf : null,
        timedOut: !!result.timedOut,
      } : null,
      matchId: snap?.matchId || null,
      phase: snap?.phase || null,
      half: snap?.half || 0,
      elapsedInHalf: Number.isFinite(snap?.elapsedInHalf) ? snap.elapsedInHalf : null,
      isLive: !!snap?.isLive,
      message: snap?.message || '',
      teamAName: snap?.teamAName || null,
      teamBName: snap?.teamBName || null,
    }
  }, undefined, { label: 'match start state', retries: 4, retryDelayMs: 500 })
}

async function waitForMatchStart(page, timeoutMs = 20000) {
  const start = Date.now()
  let lastState = null
  while (Date.now() - start < timeoutMs) {
    const state = await readMatchStartState(page)
    lastState = state
    if (state.fixtureError) {
      throw new Error(`Browser fixture failed before match start: ${state.fixtureError}`)
    }
    if (
      (state.phase === 'FIRST_HALF' || state.phase === 'SECOND_HALF')
      && Number.isFinite(state.elapsedInHalf)
      && state.elapsedInHalf > 0.2
    ) {
      return state
    }
    await delay(500)
  }
  throw new Error(
    'Match did not start after fixture request: ' +
    JSON.stringify(lastState || {}, null, 0)
  )
}

async function waitForFullTime(page, timeoutMs = 600000, visualAuditRecorder = null, gameIndex = 0) {
  const start = Date.now()
  let lastLog = 0
  let lastMotionAt = Date.now()
  let lastPhase = ''
  let lastHalf = 0
  let lastElapsed = -1
  while (Date.now() - start < timeoutMs) {
    const snap = await evaluateWithPageRetry(page, () => {
      const s = window.__gameRef?.getMatchSnapshot?.()
      return s ? { phase: s.phase, half: s.half, elapsedInHalf: s.elapsedInHalf } : null
    }, undefined, { label: 'match snapshot poll', retries: 4, retryDelayMs: 750 })
    if (snap?.phase === 'FULL_TIME') return true
    await pollVisualAudit(page, visualAuditRecorder, gameIndex)
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

async function waitForFixtureCompletion(page, timeoutMs = 600000, visualAuditRecorder = null, gameIndex = 0) {
  const start = Date.now()
  let lastLog = 0
  while (Date.now() - start < timeoutMs) {
    const state = await readMatchStartState(page)
    if (state.fixtureError) {
      throw new Error(`Browser fixture failed before completion: ${state.fixtureError}`)
    }
    await pollVisualAudit(page, visualAuditRecorder, gameIndex)
    if (state.fixtureResult) return state.fixtureResult
    const now = Date.now()
    if (now - lastLog > 10000) {
      const clock = Number.isFinite(state.elapsedInHalf) ? state.elapsedInHalf.toFixed(1) : 'n/a'
      console.log(`  [poll] phase=${state.phase || 'UNKNOWN'} half=${state.half || 0} clock=${clock} fixturePending=${state.hasPromise ? 'yes' : 'no'}`)
      lastLog = now
    }
    await delay(500)
  }
  return null
}

function getMatchWaitTimeoutMs(options) {
  const regulationMs = ((Math.max(1, options.halfSeconds) * 2) / Math.max(1, options.speed)) * 1000
  const presentationBufferMs = options.mode === 'smoke' ? 90_000 : 8 * 60_000
  const floorMs = options.mode === 'smoke' ? 600_000 : 20 * 60_000
  return Math.max(floorMs, Math.ceil(regulationMs + presentationBufferMs))
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

function sanitizeFilePart(value) {
  return String(value || '')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item'
}

function getDefaultVisualAuditDir(repoRoot, options) {
  if (options.visualAuditDir) return path.resolve(repoRoot, options.visualAuditDir)
  if (options.reportJson) return path.join(path.dirname(path.resolve(repoRoot, options.reportJson)), 'visual-audit')
  return path.join(repoRoot, 'telemetry', `visual-audit-${Date.now()}`)
}

function createVisualAuditRecorder(repoRoot, options) {
  if (!options.visualAudit) return null
  const auditDir = getDefaultVisualAuditDir(repoRoot, options)
  const framesDir = path.join(auditDir, 'frames')
  fs.mkdirSync(framesDir, { recursive: true })
  const watchedTypes = new Set([
    'STRUCTURED_ATTACK_DELIVERY',
    'STRUCTURED_DELIVERY_RESOLVED',
    'STRUCTURED_FINISH_INTENT_ARMED',
    'STRUCTURED_FINISH_INTENT_HELD',
    'STRUCTURED_FINISH_INTENT_SHOT',
    'DIRECTOR_FINISH_BOOST',
    'SHOT',
    'SHOT_BLOCKED',
    'GOAL',
  ])
  return {
    auditDir,
    framesDir,
    watchedTypes,
    entries: [],
    seen: new Set(),
    pending: [],
    maxAnchorsPerGame: 36,
  }
}

function visualAuditEventKey(gameIndex, event) {
  const detail = event?.detail || {}
  return [
    gameIndex,
    event?.half ?? '',
    event?.t ?? '',
    event?.type ?? '',
    event?.team ?? '',
    detail.passer || '',
    detail.target || '',
    detail.collector || '',
    detail.role || '',
  ].join('|')
}

function shouldAnchorVisualAuditEvent(recorder, event) {
  if (!event || !recorder.watchedTypes.has(event.type)) return false
  if (event.type === 'SHOT') return event.detail?.goal === true || event.detail?.onTarget === true
  return true
}

async function captureVisualAuditFrame(page, recorder, gameIndex, phase, event, offsetSec) {
  const detail = event?.detail || {}
  const base = [
    `g${String(gameIndex).padStart(2, '0')}`,
    `h${event?.half ?? 0}`,
    `t${String(Math.round(Number(event?.t ?? 0) * 10)).padStart(5, '0')}`,
    sanitizeFilePart(event?.type || 'event'),
    `${offsetSec >= 0 ? 'p' : 'm'}${String(Math.round(Math.abs(offsetSec) * 10)).padStart(2, '0')}`,
  ].join('_')
  const fileName = `${base}.jpg`
  const absPath = path.join(recorder.framesDir, fileName)
  await page.screenshot({ path: absPath, type: 'jpeg', quality: 78, fullPage: false })
  recorder.entries.push({
    gameIndex,
    phase,
    offsetSec,
    image: path.relative(recorder.auditDir, absPath).replace(/\\/g, '/'),
    event: {
      t: event?.t ?? null,
      half: event?.half ?? null,
      minute: event?.minute ?? null,
      type: event?.type || '',
      team: event?.team || '',
      role: event?.role || '',
      detail: {
        patternType: detail.patternType ?? null,
        targetRole: detail.targetRole ?? detail.role ?? null,
        style: detail.style ?? null,
        realCross: detail.realCross ?? null,
        outcome: detail.outcome ?? null,
        matchedTarget: detail.matchedTarget ?? null,
        passer: detail.passer ?? null,
        target: detail.target ?? null,
        collector: detail.collector ?? null,
        collectorRole: detail.collectorRole ?? null,
        distToGoal: detail.distToGoal ?? null,
        closePressure: detail.closePressure ?? null,
        ballDistFromIntendedPoint: detail.ballDistFromIntendedPoint ?? null,
        nearestDefenderDist: detail.nearestDefenderDist ?? null,
      },
    },
  })
}

async function pollVisualAudit(page, recorder, gameIndex) {
  if (!recorder) return
  const now = Date.now()
  const events = await page.evaluate(() => {
    const bundle = window.__gameRef?.getTuningBundle?.()
    return Array.isArray(bundle?.events) ? bundle.events.slice(-80) : []
  }).catch(() => [])
  let anchorsThisGame = recorder.entries.filter((entry) => entry.gameIndex === gameIndex && entry.offsetSec === 0).length
  for (const event of events) {
    if (!shouldAnchorVisualAuditEvent(recorder, event)) continue
    const key = visualAuditEventKey(gameIndex, event)
    if (recorder.seen.has(key)) continue
    if (anchorsThisGame >= recorder.maxAnchorsPerGame && event.type !== 'GOAL') continue
    recorder.seen.add(key)
    await captureVisualAuditFrame(page, recorder, gameIndex, 'anchor', event, 0)
    anchorsThisGame += 1
    recorder.pending.push({ dueAt: now + 1200, gameIndex, event, offsetSec: 1.2 })
    recorder.pending.push({ dueAt: now + 2400, gameIndex, event, offsetSec: 2.4 })
  }
  const due = recorder.pending.filter((item) => item.dueAt <= now)
  recorder.pending = recorder.pending.filter((item) => item.dueAt > now)
  for (const item of due) {
    await captureVisualAuditFrame(page, recorder, item.gameIndex, 'followup', item.event, item.offsetSec)
  }
}

function writeVisualAuditReport(recorder, runSummary = {}) {
  if (!recorder) return
  const manifest = {
    generatedAt: new Date().toISOString(),
    summary: runSummary,
    entries: recorder.entries,
  }
  fs.writeFileSync(path.join(recorder.auditDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  const cards = recorder.entries.map((entry) => {
    const detail = entry.event.detail || {}
    const title = `${entry.event.type} ${entry.event.team || ''} ${detail.targetRole || detail.outcome || ''}`.trim()
    const meta = [
      `game ${entry.gameIndex}`,
      `half ${entry.event.half ?? '?'}`,
      `t ${entry.event.t ?? '?'}`,
      `+${entry.offsetSec}s`,
      detail.passer && detail.target ? `${detail.passer} -> ${detail.target}` : '',
      detail.collector ? `collector ${detail.collector} (${detail.collectorRole || '?'})` : '',
      detail.realCross === true ? 'real cross' : '',
      detail.matchedTarget === true ? 'matched target' : '',
    ].filter(Boolean).join(' | ')
    return `<article>
  <img src="${entry.image}" alt="${title}">
  <h2>${title}</h2>
  <p>${meta}</p>
</article>`
  }).join('\n')
  fs.writeFileSync(path.join(recorder.auditDir, 'contact-sheet.html'), `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Pixel Soccer Visual Audit</title>
<style>
body{font-family:Arial,sans-serif;margin:24px;background:#111;color:#eee}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
article{background:#1b1b1b;border:1px solid #333;padding:10px;border-radius:6px}
img{display:block;width:100%;height:auto;background:#000}
h2{font-size:13px;margin:8px 0 4px}
p{font-size:11px;line-height:1.35;color:#bbb;margin:0}
</style>
<h1>Pixel Soccer Visual Audit</h1>
<p>${manifest.generatedAt} | ${recorder.entries.length} frames</p>
<main>
${cards}
</main>
</html>`)
}

async function captureMatchResult(page) {
  return evaluateWithPageRetry(page, () => {
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
        passLog: bundle.passLog || [],
        shapeA: bundle.shapeA || [],
        shapeB: bundle.shapeB || [],
        playerPositioning: bundle.playerPositioning || [],
        transitions: bundle.transitions || [],
        goalLog: bundle.goalLog || [],
        shotDecisions: bundle.shotDecisions || [],
        passDecisions: bundle.passDecisions || [],
        possessionDirector: bundle.possessionDirector || null,
        tuning: bundle.tuning || null,
        teleportation: bundle.teleportation || null,
        metadata: bundle.metadata || {},
      },
      // Diagnostic — shot decision gate counters surfaced from gameEngine
      shotGateStats: window.__shotGateStats || null,
    }
  })
}

function isTransientPageEvaluationError(error) {
  const message = String(error?.message || error || '').toLowerCase()
  return (
    message.includes('execution context was destroyed') ||
    message.includes('most likely because of a navigation') ||
    message.includes('navigation') ||
    message.includes('target closed') ||
    message.includes('page closed') ||
    message.includes('context closed')
  )
}

async function evaluateWithPageRetry(page, fn, arg, options = {}) {
  const {
    label = 'page evaluation',
    retries = 3,
    retryDelayMs = 500,
  } = options
  let lastError = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return arguments.length >= 3 && arg !== undefined
        ? await page.evaluate(fn, arg)
        : await page.evaluate(fn)
    } catch (error) {
      lastError = error
      if (!isTransientPageEvaluationError(error) || attempt >= retries) break
      console.warn(`[runner] transient ${label} failure; retrying (${attempt + 1}/${retries}): ${error.message || error}`)
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {})
      await delay(retryDelayMs)
    }
  }
  throw lastError
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
  if (result.shotGateStats) {
    const s = result.shotGateStats
    console.log(`  ShotGate | eligible:${s.eligible} natural:${s.naturalSel} role:${s.roleAllowed} chanceOK:${s.shotChanceOK} passOK:${s.passChanceOK} should:${s.shouldShoot} passWins:${s.shouldShootButPassWins} fired:${s.fired} forceFired:${s.forceShotFired}`)
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

function createReportPayload(options, results, runMeta = {}) {
  return {
    generatedAt: new Date().toISOString(),
    status: runMeta.status || 'partial',
    gamesCompleted: results.length,
    options: {
      ...options,
      homeTeam: runMeta.homeTeam || null,
      awayTeam: runMeta.awayTeam || null,
      formationA: runMeta.formationA || null,
      formationB: runMeta.formationB || null,
    },
    results,
  }
}

export {
  createReportPayload,
  getMatchWaitTimeoutMs,
  loadFixtureList,
  parseArgs,
  resolveFormation,
  resolveTeamName,
}

function writeHeadlessReport(repoRoot, options, results, runMeta = {}) {
  if (!options.reportJson) return null
  const outPath = path.resolve(repoRoot, options.reportJson)
  const tempPath = `${outPath}.tmp`
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(tempPath, JSON.stringify(createReportPayload(options, results, runMeta), null, 2))
  fs.renameSync(tempPath, outPath)
  return outPath
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
    throw new Error('No Chromium-based browser found. Install Chrome/Edge or set HEADLESS_SIM_BROWSER to an executable path.')
  }

  let targetUrl = options.url
  let serverProcess = null
  let browser = null
  let context = null
  let page = null
  let timeoutWatchdog = null
  const visualAuditRecorder = createVisualAuditRecorder(repoRoot, options)
  const shutdown = createShutdownController()
  const results = []

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

  const targetIsPixelSoccer = await isPixelSoccerUrl(targetUrl)
  if (!targetIsPixelSoccer) {
    requireRemainingRunTimeMs(runStartedAt, options.timeoutMs, 'server startup')
    if (options.customUrl) {
      throw new Error(`Target URL is not serving Pixel Soccer League: ${targetUrl}`)
    }
    const reachable = await isUrlReachable(targetUrl)
    console.log(`${reachable ? 'Non-PSL server detected' : 'Server not detected'} at ${targetUrl}. Starting Vite dev server on ${FALLBACK_SERVER_URL}`)
    serverProcess = spawnDevServer(repoRoot, options.verbose)
    const ready = await waitForPixelSoccerUrl(FALLBACK_SERVER_URL, Math.min(30000, requireRemainingRunTimeMs(runStartedAt, options.timeoutMs, 'server startup')))
    if (!ready) {
      throw new Error(`Timed out waiting for Vite dev server at ${FALLBACK_SERVER_URL}`)
    }
    targetUrl = FALLBACK_SERVER_URL
  }

  browser = await chromium.launch({
    executablePath,
    headless: !options.headed,
    args: getBrowserLaunchArgs(options),
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
    // Append query suffix (e.g. fsm=off) after URL resolution so it
    // survives the dev-server fallback path.
    if (options.querySuffix) {
      const sep = targetUrl.includes('?') ? '&' : '?'
      targetUrl = `${targetUrl}${sep}${options.querySuffix}`
    }
    console.log(`Starting headless CPU vs CPU | mode=${options.mode} | games=${options.games} | speed=${options.speed}x | gpuHeadless=${options.gpuHeadless ? 'on' : 'off'} | browser=${executablePath} | url=${targetUrl}`)
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: Math.min(30000, requireRemainingRunTimeMs(runStartedAt, options.timeoutMs, 'page load')),
    })
    await page.bringToFront().catch(() => {})

    const gameReady = await waitForGameReady(page, Math.min(30000, requireRemainingRunTimeMs(runStartedAt, options.timeoutMs, 'game initialization')))
    if (!gameReady) throw new Error('Game engine did not initialize within timeout')

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

      const fixtureResult = await waitForFixtureCompletion(page, Math.min(getMatchWaitTimeoutMs(options), remainingForMatch), visualAuditRecorder, i + 1)
      if (!fixtureResult) {
        const elapsed = Date.now() - runStartedAt
        throw new Error(`Timed out after ${formatDuration(elapsed)} waiting for game ${i + 1} to finish`)
      }
      if (fixtureResult.timedOut) {
        throw new Error(
          `Fixture timed out (${fixtureResult.timeoutReason || 'unknown'}) while waiting for game ${i + 1} ` +
          `at phase=${fixtureResult.phase || 'UNKNOWN'} half=${fixtureResult.half || 0} ` +
          `clock=${Number.isFinite(fixtureResult.elapsedInHalf) ? fixtureResult.elapsedInHalf.toFixed(1) : 'n/a'}`
        )
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
        const partialPath = writeHeadlessReport(repoRoot, options, results, {
          status: results.length === options.games ? 'complete' : 'partial',
          homeTeam: fixedHome || null,
          awayTeam: fixedAway || null,
          formationA: fixedFormationA || null,
          formationB: fixedFormationB || null,
        })
        if (partialPath) {
          console.log(`Saved partial headless sim report: ${partialPath}`)
        }
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
    writeVisualAuditReport(visualAuditRecorder, {
      games: results.length,
      reportJson: options.reportJson || null,
      url: targetUrl,
    })
    if (visualAuditRecorder) {
      console.log(`Saved visual audit: ${visualAuditRecorder.auditDir}`)
    }

    if (options.reportJson) {
      const outPath = writeHeadlessReport(repoRoot, options, results, {
        status: 'complete',
        homeTeam: fixedHome || null,
        awayTeam: fixedAway || null,
        formationA: fixedFormationA || null,
        formationB: fixedFormationB || null,
      })
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

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false

if (isDirectRun) {
  run().catch((error) => {
    console.error(error.message || error)
    process.exitCode = 1
  })
}
