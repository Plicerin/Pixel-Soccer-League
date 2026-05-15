#!/usr/bin/env node

import { chromium } from 'playwright-core'

const APP_URL = 'http://127.0.0.1:3001/'
const CDP_CANDIDATES = ['http://127.0.0.1:9222', 'http://[::1]:9222']

function parseArgs(argv) {
  return {
    stop: argv.includes('--stop'),
    games: Number(argv[argv.indexOf('--games') + 1]) || 100000,
    speed: Number(argv[argv.indexOf('--speed') + 1]) || 1,
  }
}

async function connectExistingBrowser() {
  let lastError = null
  for (const cdpUrl of CDP_CANDIDATES) {
    try {
      const browser = await chromium.connectOverCDP(cdpUrl)
      return { browser, cdpUrl }
    } catch (error) {
      lastError = error
    }
  }
  throw new Error(`Could not connect to existing Edge/Chrome CDP: ${lastError?.message || lastError}`)
}

async function pickAppPage(browser) {
  const contexts = browser.contexts()
  for (const context of contexts) {
    for (const page of context.pages()) {
      if (page.url().startsWith(APP_URL)) {
        await page.bringToFront().catch(() => {})
        return { page, reused: true }
      }
    }
  }

  const context = contexts[0] || await browser.newContext()
  const page = await context.newPage()
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.bringToFront().catch(() => {})
  return { page, reused: false }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const { browser, cdpUrl } = await connectExistingBrowser()
  try {
    const { page, reused } = await pickAppPage(browser)
    await page.waitForFunction(() => Boolean(window.pslSmokeTest?.run), null, { timeout: 30000 })

    if (options.stop) {
      await page.evaluate(() => window.pslSmokeTest.stop())
      console.log(`[browser-loop] stop requested cdp=${cdpUrl} app-tab=${reused ? 'reused' : 'opened'}`)
      return
    }

    const state = await page.evaluate(() => window.pslSmokeTest.state())
    console.log(`[browser-loop] connected cdp=${cdpUrl} app-tab=${reused ? 'reused' : 'opened'} running=${state.running} played=${state.gamesPlayed}/${state.gamesTotal}`)

    if (!state.running) {
      await page.evaluate(
        ({ games, speed }) => window.pslSmokeTest.run(games, true, speed),
        { games: options.games, speed: options.speed },
      )
      return
    }

    while (true) {
      const current = await page.evaluate(() => window.pslSmokeTest.state())
      console.log(`[browser-loop] already running played=${current.gamesPlayed}/${current.gamesTotal} aborted=${current.aborted}`)
      if (!current.running) return
      await new Promise((resolve) => setTimeout(resolve, 30000))
    }
  } finally {
    browser.disconnect()
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
