#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const APP_URL = process.env.PSL_APP_URL || 'http://127.0.0.1:3001/'
const CDP_URL = process.env.PSL_CDP_URL || 'http://127.0.0.1:9222'
const OUT_DIR = process.env.PSL_CAPTURE_DIR || 'telemetry/visual-captures'
const FIELD_W = 56 + 4.8 * 2
const FIELD_D = 80 * (FIELD_W / 120)

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function appPages(browser) {
  const pages = []
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      if (page.url().startsWith(APP_URL)) pages.push(page)
    }
  }
  return pages
}

async function waitForGame(page) {
  await page.waitForFunction(() => Boolean(window.__gameRef || window.pslGame), null, { timeout: 30000 })
}

async function forceThrowIn(page) {
  return await page.evaluate(({ fieldD }) => {
    const game = window.__gameRef || window.pslGame
    if (!game?.model) throw new Error('game model is unavailable')
    const model = game.model
    game.setSmokeTestMode?.(true)
    game.setMenuVisible?.(false)
    game.setScoreBugVisible?.(true)
    game.setCpuVsCpu?.(true)
    game.setHalfDurationSeconds?.(300)
    game.setSeriesSpeedMul?.(1)
    game.resetMatch?.()
    game.startKickoffPresentation?.(false)

    model.msm.state = { kind: 'live_play', half: 1, startTick: 0 }
    model.msm.clock.half = 1
    model.msm.clock.elapsedInHalf = 18
    model.msm.restartTimer = 0
    model.visibleBallOutPending = null
    model.pendingBallOutEvent = null
    model.pendingBallOutContext = null
    model.ballFlight = null
    model.restartContext = null
    model.activeRestartPresentation = null

    const players = model.getPlayers()
    const takerSeed = players.find((p) => p.team === 'A' && p.role === 'CM') || players.find((p) => p.team === 'A' && p.role !== 'GK')
    if (!takerSeed) throw new Error('no home outfield player found')
    for (const player of players) {
      const side = player.team === 'A' ? -1 : 1
      player.pos.x = side * (player.role === 'GK' ? 27 : 6 + (player.shirtNumber % 5) * 3)
      player.pos.z = (player.shirtNumber - 6) * 1.3
      player.targetPos = { ...player.pos }
      player.vel = { x: 0, z: 0 }
    }

    const halfZ = fieldD / 2
    const spot = { x: -2, z: halfZ }
    takerSeed.pos = { x: spot.x - 1.2, z: halfZ - 1.1 }
    takerSeed.targetPos = { ...takerSeed.pos }
    model.lastTouchTeam = 'A'
    model.lastTouchPlayerId = takerSeed.id
    model.lastBallPos = { x: spot.x - 0.2, z: halfZ - 0.4 }
    model.ball.pos = { x: spot.x, y: 0.18, z: halfZ + 0.9 }
    model.ball.vel = { x: 0, z: 0 }
    model.possession = null
    const eventStart = model.eventLog?.length || 0

    const context = {
      restartType: 'throw_in',
      restartTeam: 'B',
      spot,
      lastTouchTeam: 'A',
      lastTouchPlayerId: takerSeed.id,
      crossedLine: 'top_touchline',
    }
    model.pendingBallOutEvent = { restartType: 'throw_in', restartTeam: 'away' }
    model.pendingBallOutContext = context
    model.msm.state = { kind: 'ball_out', restartType: 'throw_in', restartTeam: 'away' }
    model.msm.restartTimer = 1.5
    model.installBallOutRestart?.(context)
    game.setPaused?.(false)

    return {
      snapshot: game.getMatchSnapshot?.(),
      state: model.msm.state,
      restartContext: model.restartContext,
      eventStart,
    }
  }, { fieldD: FIELD_D })
}

async function capture() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const browser = await chromium.connectOverCDP(CDP_URL)
  const pages = appPages(browser)
  if (!pages.length) {
    throw new Error(`No existing app tab found at ${APP_URL}. Open/reuse the current debug browser tab first.`)
  }
  const page = pages[0]
  page.setDefaultTimeout(10000)
  await page.bringToFront().catch(() => {})
  await waitForGame(page)
  const id = `throwin-${stamp()}`
  const setup = path.join(OUT_DIR, `${id}-setup.png`)
  const release = path.join(OUT_DIR, `${id}-release.png`)
  const reportPath = path.join(OUT_DIR, `${id}.json`)

  const forced = await forceThrowIn(page)
  await page.waitForTimeout(250)
  await page.screenshot({ path: setup, fullPage: false })
  await page.waitForTimeout(1550)
  await page.screenshot({ path: release, fullPage: false })
  const report = await page.evaluate((startEventCount) => {
    const game = window.__gameRef || window.pslGame
    const model = game?.model
    return {
      snapshot: game?.getMatchSnapshot?.(),
      activeRestartPresentation: game?.activeRestartPresentation || null,
      state: model?.msm?.state || null,
      restartContext: model?.restartContext || null,
      recentEvents: (model?.eventLog || []).slice(startEventCount).map((event) => ({
        action: event.action,
        team: event.team,
        text: event.text,
        meta: event.meta,
      })),
      ball: model?.ball?.pos || null,
    }
  }, forced.eventStart)
  fs.writeFileSync(reportPath, JSON.stringify({ forced, report, setup, release }, null, 2))
  console.log(JSON.stringify({ setup, release, report: reportPath, phase: report.snapshot?.phase, recentEvents: report.recentEvents }, null, 2))
}

capture().then(() => process.exit(0)).catch((error) => {
  console.error(error?.stack || error?.message || String(error))
  process.exit(1)
})
