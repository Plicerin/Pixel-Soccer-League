#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright-core'

const STORAGE_KEY = 'psl_world_cup'

function printHelp() {
  console.log(`Run a World Cup browser smoke flow through the live UI via CDP.

Usage:
  npm run sim:worldcup -- --team "Brazil"

Options:
  --team <name>         Player team to start as (default: Brazil)
  --url <url>           App URL prefix (default: http://127.0.0.1:3001/)
  --cdp <url>           Chrome/Edge remote debugging URL (default: http://127.0.0.1:9222)
  --timeout-ms <ms>     Browser action timeout (default: 30000)
  --report-json <path>  Optional JSON output path
  --screenshots <dir>   Optional directory for checkpoint screenshots
  --new-tab             Force a fresh tab instead of reusing an existing app tab
  --help                Show this help

Notes:
  - This is a UI smoke harness, not a gameplay KPI tool.
  - It uses the real World Cup hub flow, simulates rounds through the UI,
    verifies persistence after reload, and runs to champion.`)
}

function parseArgs(argv) {
  const options = {
    team: 'Brazil',
    url: 'http://127.0.0.1:3001/',
    cdpUrl: 'http://127.0.0.1:9222',
    timeoutMs: 30000,
    reportJson: '',
    screenshotsDir: '',
    newTab: false,
    help: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--team') {
      options.team = argv[++i] || ''
    } else if (arg === '--url') {
      options.url = argv[++i] || ''
    } else if (arg === '--cdp') {
      options.cdpUrl = argv[++i] || ''
    } else if (arg === '--timeout-ms') {
      options.timeoutMs = Number(argv[++i])
    } else if (arg === '--report-json') {
      options.reportJson = argv[++i] || ''
    } else if (arg === '--screenshots') {
      options.screenshotsDir = argv[++i] || ''
    } else if (arg === '--new-tab') {
      options.newTab = true
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!options.help) {
    if (!options.team) throw new Error('Use --team to select the World Cup side')
    if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
      throw new Error('--timeout-ms must be > 0')
    }
  }

  return options
}

async function connectBrowser(options) {
  const candidates = [options.cdpUrl]
  if (options.cdpUrl === 'http://127.0.0.1:9222') {
    candidates.push('http://[::1]:9222')
  }

  let lastError = null
  for (const cdpUrl of candidates) {
    try {
      const browser = await chromium.connectOverCDP(cdpUrl)
      return { browser, cdpUrl }
    } catch (error) {
      lastError = error
    }
  }

  throw new Error(
    `Could not connect to Chrome/Edge CDP at ${candidates.join(' or ')}. ` +
    `Start a visible browser with --remote-debugging-port=9222 first. ${lastError?.message || lastError}`
  )
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
  await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs })
  await page.bringToFront().catch(() => {})
  return { page, reused: false }
}

async function waitForVisible(page, locator, timeoutMs) {
  await locator.first().waitFor({ state: 'visible', timeout: timeoutMs })
}

async function clickButton(page, name, timeoutMs) {
  const button = page.getByRole('button', { name, exact: true }).first()
  try {
    await waitForVisible(page, button, timeoutMs)
  } catch {
    const pageText = await page.locator('body').innerText().catch(() => '')
    throw new Error(`Button "${name}" was not visible.\nVisible text snapshot:\n${pageText.slice(0, 2000) || '(empty body)'}`)
  }
  await button.click()
}

async function maybeClickButton(page, name, timeoutMs) {
  const button = page.getByRole('button', { name, exact: true }).first()
  if (await button.isVisible({ timeout: 250 }).catch(() => false)) {
    await button.click()
    return true
  }
  return false
}

async function readWorldCupState(page) {
  return await page.evaluate((storageKey) => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }, STORAGE_KEY)
}

async function clearWorldCupState(page) {
  await page.evaluate((storageKey) => {
    window.localStorage.removeItem(storageKey)
  }, STORAGE_KEY)
}

async function dismissSplash(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 200 }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }))
  }).catch(() => {})
  const splashText = page.getByText('PRESS ANY BUTTON TO START', { exact: true })
  await splashText.waitFor({ state: 'hidden', timeout: 4000 }).catch(() => {})
  await page.waitForTimeout(250)
}

async function ensureMainMenuReady(page, options) {
  await dismissSplash(page)
  const closeOverlayButton = page.getByRole('button', { name: '[ESC] CLOSE', exact: true }).first()
  if (await closeOverlayButton.isVisible({ timeout: 500 }).catch(() => false)) {
    await closeOverlayButton.click().catch(() => {})
    await page.waitForTimeout(250)
  }
  const worldCupButton = page.getByRole('button', { name: 'World Cup Mode', exact: true }).first()
  if (await worldCupButton.isVisible({ timeout: 1000 }).catch(() => false)) return

  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(200)
  if (await closeOverlayButton.isVisible({ timeout: 500 }).catch(() => false)) {
    await closeOverlayButton.click().catch(() => {})
    await page.waitForTimeout(200)
  }
  await dismissSplash(page)
  try {
    await worldCupButton.waitFor({ state: 'visible', timeout: options.timeoutMs })
  } catch (error) {
    const pageText = await page.locator('body').innerText().catch(() => '')
    throw new Error(
      `Main menu did not become ready. Visible text snapshot:\n${pageText.slice(0, 2000) || '(empty body)'}`
    )
  }
}

async function screenshot(page, dir, name) {
  if (!dir) return ''
  const outDir = path.resolve(process.cwd(), dir)
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `${name}.png`)
  await page.screenshot({ path: outPath, fullPage: true })
  return outPath
}

async function openWorldCupMode(page, options) {
  await page.goto(`${options.url}${options.url.includes('?') ? '&' : '?'}worldCupSmoke=${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: options.timeoutMs,
  })
  await page.waitForFunction(() => Boolean(window.__pslUiTest?.openWorldCupMode), null, {
    timeout: Math.min(options.timeoutMs, 15000),
  }).catch(() => {})
  const bridged = await page.evaluate(() => {
    if ((window).__pslUiTest?.openWorldCupMode) {
      (window).__pslUiTest.openWorldCupMode()
      return true
    }
    return false
  }).catch(() => false)
  if (!bridged) {
    await ensureMainMenuReady(page, options)
    await clickButton(page, 'World Cup Mode', options.timeoutMs)
    return
  }
  await page.waitForTimeout(300)
}

async function startTournament(page, options) {
  await clearWorldCupState(page)
  await page.reload({ waitUntil: 'domcontentloaded', timeout: options.timeoutMs })
  await page.waitForFunction(() => Boolean(window.__pslUiTest?.openWorldCupMode), null, {
    timeout: Math.min(options.timeoutMs, 15000),
  })
  await page.evaluate((team) => {
    window.__pslUiTest.openWorldCupMode(team)
  }, options.team)
  await page.waitForFunction(() => Boolean(window.__pslWorldCupTest?.snapshot), null, {
    timeout: Math.min(options.timeoutMs, 15000),
  })
}

async function continueTournamentAfterReload(page, options) {
  await page.reload({ waitUntil: 'domcontentloaded', timeout: options.timeoutMs })
  await page.waitForFunction(() => Boolean(window.__pslUiTest?.openWorldCupMode), null, {
    timeout: Math.min(options.timeoutMs, 15000),
  })
  await page.evaluate(() => {
    window.__pslUiTest.openWorldCupMode()
  })
  await page.waitForFunction(() => Boolean(window.__pslWorldCupTest?.snapshot), null, {
    timeout: Math.min(options.timeoutMs, 15000),
  })
}

async function assertNavigationViews(page, options) {
  await clickButton(page, 'Groups', options.timeoutMs)
  await page.getByText('Group Tables', { exact: true }).waitFor({ state: 'visible', timeout: options.timeoutMs })
  await clickButton(page, 'Back', options.timeoutMs)

  await clickButton(page, 'Schedule', options.timeoutMs)
  await page.getByText('Current Round', { exact: true }).waitFor({ state: 'visible', timeout: options.timeoutMs })
  await clickButton(page, 'Back', options.timeoutMs)

  await clickButton(page, 'Bracket', options.timeoutMs)
  await page.getByText('Knockout Bracket', { exact: true }).waitFor({ state: 'visible', timeout: options.timeoutMs })
  await clickButton(page, 'Back', options.timeoutMs)
}

async function worldCupSnapshot(page) {
  return await page.evaluate(() => window.__pslWorldCupTest?.snapshot?.() ?? null)
}

async function worldCupSimRound(page) {
  return await page.evaluate(() => window.__pslWorldCupTest?.simRound?.() ?? null)
}

async function worldCupAdvance(page) {
  return await page.evaluate(() => window.__pslWorldCupTest?.advance?.() ?? null)
}

async function advanceTournamentThroughUi(page, options, report) {
  let reloadChecked = false
  let safety = 0
  while (safety < 80) {
    safety += 1
    const state = await worldCupSnapshot(page)
    if (!state) throw new Error('World Cup state missing from localStorage during smoke run')
    report.timeline.push({
      step: safety,
      stage: state.currentStage,
      round: state.currentRound,
      champion: state.champion || null,
    })

    if (state.currentStage === 'completed') {
      await page.getByText(`Champion: ${state.champion}`, { exact: true }).waitFor({ state: 'visible', timeout: options.timeoutMs })
      return state
    }

    if (!reloadChecked && (state.currentRound > 1 || state.currentStage !== 'group')) {
      reloadChecked = true
      report.reloadCheckpoint = {
        stage: state.currentStage,
        round: state.currentRound,
      }
      await screenshot(page, options.screenshotsDir, 'worldcup-mid-reload')
      await continueTournamentAfterReload(page, options)
      const reloaded = await worldCupSnapshot(page)
      if (!reloaded || reloaded.currentStage !== state.currentStage || reloaded.currentRound !== state.currentRound) {
        throw new Error('World Cup persistence failed across reload')
      }
    }

    const fixtures = (state.currentStage === 'group' ? state.groupFixtures : state.knockoutFixtures)
      .filter((fixture) => fixture.stage === state.currentStage && fixture.round === state.currentRound)
    const allPlayed = fixtures.every((fixture) => fixture.played)
    if (!allPlayed) {
      await worldCupSimRound(page)
      await page.waitForTimeout(300)
      continue
    }
    await worldCupAdvance(page)
    await page.waitForTimeout(300)
    continue
  }

  throw new Error('World Cup smoke exceeded safety limit')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const { browser, cdpUrl } = await connectBrowser(options)
  try {
    const { page, reused } = await pickPage(browser, options)
    page.setDefaultTimeout(options.timeoutMs)

    const report = {
      generatedAt: new Date().toISOString(),
      options: {
        team: options.team,
        url: options.url,
        cdpUrl,
        timeoutMs: options.timeoutMs,
        newTab: options.newTab,
      },
      appTab: reused ? 'reused' : 'opened',
      screenshots: {},
      timeline: [],
      reloadCheckpoint: null,
      finalState: null,
    }

    console.log(`[sim:worldcup] cdp=${cdpUrl} app-tab=${report.appTab} url=${page.url()}`)
    await startTournament(page, options)
    report.screenshots.start = await screenshot(page, options.screenshotsDir, 'worldcup-start')
    await assertNavigationViews(page, options)
    const finalState = await advanceTournamentThroughUi(page, options, report)
    report.finalState = {
      stage: finalState.currentStage,
      round: finalState.currentRound,
      champion: finalState.champion,
      playerTeam: finalState.playerTeam,
    }
    report.screenshots.final = await screenshot(page, options.screenshotsDir, 'worldcup-final')

    console.log(`[sim:worldcup] COMPLETE champion=${finalState.champion} player=${finalState.playerTeam}`)

    if (options.reportJson) {
      const outPath = path.resolve(process.cwd(), options.reportJson)
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      fs.writeFileSync(outPath, JSON.stringify(report, null, 2))
      console.log(`Saved world cup smoke report: ${outPath}`)
    }
  } finally {
    browser?.disconnect?.()
  }
}

main().then(() => {
  process.exit(0)
}).catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
