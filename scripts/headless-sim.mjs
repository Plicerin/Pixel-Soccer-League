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

function printHelp() {
  console.log(`Headless CPU vs CPU soccer sim runner

Usage:
  npm run sim:headless -- --games 10

Options:
  --games <n>        Number of CPU vs CPU games to run (default: 10)
  --url <url>        Existing dev server URL (default: ${DEFAULT_URL})
  --speed <n>        Game speed multiplier (default: 20)
  --timeout-ms <ms>  Total timeout for the run
  --verbose          Print browser/server diagnostics
  --headed           Show the browser window
  --help             Show this help

Notes:
  - If ${DEFAULT_URL} is not reachable, the script auto-starts a Vite dev server on ${FALLBACK_SERVER_URL}.
  - Team matchups are randomized from a shuffled pool with no duplicate fixture repeats per cycle.
  - The sim runs headless in Chromium/Edge and prints text summaries as games finish.
  - Results are stored in IndexedDB telemetry and visible in the MATCHES dashboard tab.`)
}

function parseArgs(argv) {
  const options = {
    games: 10,
    url: DEFAULT_URL,
    speed: 20,
    timeoutMs: null,
    verbose: false,
    customUrl: false,
    headed: false,
    help: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--games') {
      const next = Number(argv[i + 1])
      if (!Number.isFinite(next) || next <= 0) throw new Error('Expected a positive number after --games')
      options.games = Math.floor(next)
      i += 1
    } else if (arg === '--url') {
      const next = argv[i + 1]
      if (!next) throw new Error('Expected a URL after --url')
      options.url = new URL(next).toString()
      options.customUrl = true
      i += 1
    } else if (arg === '--speed') {
      const next = Number(argv[i + 1])
      if (!Number.isFinite(next) || next <= 0) throw new Error('Expected a positive number after --speed')
      options.speed = next
      i += 1
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

  if (!options.timeoutMs) {
    options.timeoutMs = options.games * 5 * 60 * 1000
  }

  return options
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
  const child = process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/s', '/c', `npm run dev -- --host 127.0.0.1 --port ${FALLBACK_SERVER_PORT}`], {
        cwd: repoRoot,
        env: { ...process.env, BROWSER: 'none' },
        stdio: verbose ? 'inherit' : 'pipe',
        windowsHide: true,
      })
    : spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(FALLBACK_SERVER_PORT)], {
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

async function waitForGameReady(page, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const ready = await page.evaluate(() => !!window.__gameRef?.getMatchSnapshot)
    if (ready) return true
    await delay(500)
  }
  return false
}

async function startMatch(page, teamA, teamB, formA, formB, speed) {
  await page.evaluate(({ teamA, teamB, formA, formB, speed }) => {
    const game = window.__gameRef
    game.setSmokeTestMode?.(true)
    game.resetMatch()
    game.setTeamNames(teamA, teamB)
    game.setTeamFormations(formA, formB)
    game.setCpuVsCpu(true)
    game.setSeriesSpeedMul(speed)
    game.setRestartDelays(0.8, 1.2)
    game.setMenuVisible(false)
    game.startKickoffPresentation(true)
  }, { teamA, teamB, formA, formB, speed })
}

async function waitForFullTime(page, timeoutMs = 600000) {
  const start = Date.now()
  let lastLog = 0
  while (Date.now() - start < timeoutMs) {
    const snap = await page.evaluate(() => {
      const s = window.__gameRef?.getMatchSnapshot?.()
      return s ? { phase: s.phase, half: s.half, elapsedInHalf: s.elapsedInHalf } : null
    })
    if (snap?.phase === 'FULL_TIME') return true
    const now = Date.now()
    if (now - lastLog > 10000) {
      console.log(`  [poll] phase=${snap?.phase} half=${snap?.half} clock=${snap?.elapsedInHalf?.toFixed(1)}`)
      lastLog = now
    }
    await delay(500)
  }
  return false
}

async function captureMatchResult(page) {
  return page.evaluate(() => {
    const snap = window.__gameRef?.getMatchSnapshot?.()
    if (!snap) return null
    const bundle = window.__gameRef?.getTuningBundle?.() || {}
    return {
      teamA: snap.teamAName,
      teamB: snap.teamBName,
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

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const executablePath = findBrowserExecutable()
  if (!executablePath) {
    throw new Error('No Chromium-based browser found. Set HEADLESS_SIM_BROWSER to an Edge/Chrome executable path.')
  }

  let targetUrl = options.url
  let serverProcess = null

  if (!(await isUrlReachable(targetUrl))) {
    if (options.customUrl) {
      throw new Error(`Target URL is not reachable: ${targetUrl}`)
    }
    console.log(`Server not detected at ${targetUrl}. Starting Vite dev server on ${FALLBACK_SERVER_URL}`)
    serverProcess = spawnDevServer(repoRoot, options.verbose)
    const ready = await waitForUrl(FALLBACK_SERVER_URL, 30000)
    if (!ready) {
      throw new Error(`Timed out waiting for Vite dev server at ${FALLBACK_SERVER_URL}`)
    }
    targetUrl = FALLBACK_SERVER_URL
  }

  const browser = await chromium.launch({
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
    ],
  })

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()

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
    console.log(`Starting headless CPU vs CPU | games=${options.games} | speed=${options.speed}x | url=${targetUrl}`)
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

    const gameReady = await waitForGameReady(page)
    if (!gameReady) throw new Error('Game engine did not initialize within timeout')

    const results = []
    const nextMatchup = createMatchupPicker(MLS_TEAMS)
    const startedAt = Date.now()

    for (let i = 0; i < options.games; i++) {
      const elapsed = Date.now() - startedAt
      if (elapsed > options.timeoutMs) {
        throw new Error(`Timed out after ${formatDuration(elapsed)} waiting for ${options.games} game(s)`)
      }

      const [teamA, teamB] = nextMatchup()
      const formA = pickRandom(FORMATIONS)
      const formB = pickRandom(FORMATIONS)

      console.log(`\n[${formatDuration(Date.now() - startedAt)}] Game ${i + 1}/${options.games}: ${teamA} (${formA}) vs ${teamB} (${formB})`)

      await startMatch(page, teamA, teamB, formA, formB, options.speed)
      await delay(500)

      const finished = await waitForFullTime(page, 600000)
      if (!finished) {
        console.warn(`  ? Game ${i + 1} did not finish (timeout). Skipping.`)
        continue
      }

      await delay(1000)
      const result = await captureMatchResult(page)
      if (result) {
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
  } finally {
    await context.close()
    await browser.close()
    await terminateChildProcess(serverProcess)
  }
}

run().catch((error) => {
  console.error(error.message || error)
  process.exitCode = 1
})
