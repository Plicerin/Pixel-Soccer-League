#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright-core'

function printHelp() {
  console.log(`Run a CPU-vs-CPU fixture inside a real visible browser session via CDP.

Usage:
  npm run sim:browser -- --home "DC United" --away "Seattle Sounders"

Options:
  --home <team>         Home team name
  --away <team>         Away team name
  --formation-a <f>     Optional home formation
  --formation-b <f>     Optional away formation
  --url <url>           App URL prefix to reuse or open (default: http://127.0.0.1:3001/)
  --cdp <url>           Chrome/Edge remote debugging URL (default: http://127.0.0.1:9222)
  --half-seconds <n>    Half duration in simulation seconds (default: 300)
  --speed <n>           Match clock multiplier passed to the in-page runner (default: 1)
  --timeout-ms <ms>     In-page timeout (default: 900000)
  --report-json <path>  Optional JSON output path
  --new-tab             Force a fresh tab instead of reusing an existing app tab
  --help                Show this help

Notes:
  - Start Chrome/Edge with remote debugging enabled before using this command.
  - Example Edge launch:
      msedge.exe --remote-debugging-port=9222 --user-data-dir=%TEMP%\\psl-edge-debug
  - Reuses the visible browser tab when possible, so you can monitor the match live.`)
}

function parseArgs(argv) {
  const options = {
    homeTeam: '',
    awayTeam: '',
    formationA: '',
    formationB: '',
    url: 'http://127.0.0.1:3001/',
    cdpUrl: 'http://127.0.0.1:9222',
    halfSeconds: 300,
    speedMul: 1,
    timeoutMs: 900000,
    reportJson: '',
    newTab: false,
    help: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--home') {
      options.homeTeam = argv[++i] || ''
    } else if (arg === '--away') {
      options.awayTeam = argv[++i] || ''
    } else if (arg === '--formation-a') {
      options.formationA = argv[++i] || ''
    } else if (arg === '--formation-b') {
      options.formationB = argv[++i] || ''
    } else if (arg === '--url') {
      options.url = argv[++i] || ''
    } else if (arg === '--cdp') {
      options.cdpUrl = argv[++i] || ''
    } else if (arg === '--half-seconds') {
      options.halfSeconds = Number(argv[++i])
    } else if (arg === '--speed') {
      options.speedMul = Number(argv[++i])
    } else if (arg === '--timeout-ms') {
      options.timeoutMs = Number(argv[++i])
    } else if (arg === '--report-json') {
      options.reportJson = argv[++i] || ''
    } else if (arg === '--new-tab') {
      options.newTab = true
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!options.help) {
    if (!options.homeTeam || !options.awayTeam) {
      throw new Error('Use --home and --away to specify the fixture')
    }
    if (!Number.isFinite(options.halfSeconds) || options.halfSeconds <= 0) {
      throw new Error('--half-seconds must be > 0')
    }
    if (!Number.isFinite(options.speedMul) || options.speedMul <= 0) {
      throw new Error('--speed must be > 0')
    }
    if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
      throw new Error('--timeout-ms must be > 0')
    }
  }

  return options
}

async function pickPage(browser, options) {
  const contexts = browser.contexts()
  for (const context of contexts) {
    for (const page of context.pages()) {
      const currentUrl = page.url()
      if (!options.newTab && currentUrl.startsWith(options.url)) {
        await page.bringToFront().catch(() => {})
        return { page, reused: true }
      }
    }
  }

  const context = contexts[0] || await browser.newContext()
  const page = await context.newPage()
  await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.bringToFront().catch(() => {})
  return { page, reused: false }
}

async function runFixtureInPage(page, options) {
  const fixtureOptions = {
    homeTeam: options.homeTeam,
    awayTeam: options.awayTeam,
    formationA: options.formationA || undefined,
    formationB: options.formationB || undefined,
    halfSeconds: Math.floor(options.halfSeconds),
    speedMul: options.speedMul,
    timeoutMs: Math.floor(options.timeoutMs),
  }

  return await page.evaluate(async (runOptions) => {
    if (!window.pslSmokeTest?.runFixture) {
      throw new Error('window.pslSmokeTest.runFixture is unavailable. Reload the app first.')
    }
    return await window.pslSmokeTest.runFixture(runOptions)
  }, fixtureOptions)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  let browser
  try {
    browser = await chromium.connectOverCDP(options.cdpUrl)
  } catch (error) {
    throw new Error(
      `Could not connect to Chrome/Edge CDP at ${options.cdpUrl}. ` +
      `Start a visible browser with --remote-debugging-port=9222 first. ${error?.message || error}`
    )
  }

  try {
    const { page, reused } = await pickPage(browser, options)
    console.log(`[sim:browser] app-tab=${reused ? 'reused' : 'opened'} url=${page.url()}`)
    const result = await runFixtureInPage(page, options)
    console.log(
      `[sim:browser] FINAL ${result.teamA} ${result.scoreA}-${result.scoreB} ${result.teamB} | ` +
      `Shots ${result.shotsA}-${result.shotsB} | SOG ${result.shotsOnTargetA}-${result.shotsOnTargetB}`
    )

    if (options.reportJson) {
      const outPath = path.resolve(process.cwd(), options.reportJson)
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      fs.writeFileSync(outPath, JSON.stringify({
        generatedAt: new Date().toISOString(),
        options: {
          homeTeam: options.homeTeam,
          awayTeam: options.awayTeam,
          formationA: options.formationA || null,
          formationB: options.formationB || null,
          url: options.url,
          cdpUrl: options.cdpUrl,
          halfSeconds: options.halfSeconds,
          speedMul: options.speedMul,
          timeoutMs: options.timeoutMs,
          newTab: options.newTab,
        },
        result,
      }, null, 2))
      console.log(`Saved browser fixture report: ${outPath}`)
    }
  } finally {
    await browser?.close().catch(() => {})
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
