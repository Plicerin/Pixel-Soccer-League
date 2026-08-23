#!/usr/bin/env node

import { chromium } from 'playwright-core'

const APP_URL = 'http://127.0.0.1:3001/'
const CDP_CANDIDATES = ['http://127.0.0.1:9222', 'http://[::1]:9222']

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function connectBrowser() {
  let lastError = null
  for (const cdpUrl of CDP_CANDIDATES) {
    try {
      return await chromium.connectOverCDP(cdpUrl)
    } catch (error) {
      lastError = error
    }
  }
  throw new Error(`Could not connect to existing Edge/Chrome CDP: ${lastError?.message || lastError}`)
}

async function findAppPage(browser) {
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      if (page.url().startsWith(APP_URL)) return page
    }
  }
  return null
}

const browser = await connectBrowser()
const page = await findAppPage(browser)
if (!page) throw new Error(`No existing app tab found for ${APP_URL}`)

while (true) {
  const state = await page.evaluate(() => ({
    hasSmoke: Boolean(window.pslSmokeTest?.state),
    smoke: window.pslSmokeTest?.state?.() || null,
    snapshot: window.pslGame?.getMatchSnapshot?.() || null,
  }))
  if (!state.hasSmoke || !state.smoke?.running) {
    console.log('[browser-loop] smoke runner idle')
    process.exit(0)
  }
  const snap = state.snapshot
  const clock = snap ? `${snap.phase} h${snap.half} ${Number(snap.elapsedInHalf || 0).toFixed(1)}s` : 'unknown clock'
  console.log(`[browser-loop] waiting for current match: ${clock}`)
  await sleep(30000)
}
