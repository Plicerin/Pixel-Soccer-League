#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const APP_URL = process.env.PSL_APP_URL || 'http://127.0.0.1:3001/'
const CDP_URL = process.env.PSL_CDP_URL || 'http://127.0.0.1:9222'
const OUT_DIR = process.env.PSL_CAPTURE_DIR || 'telemetry/visual-captures'
const FIELD_W = 56 + 4.8 * 2
const FIELD_D = 80 * (FIELD_W / 120)
const RIGHT_GOAL_X = FIELD_W / 2

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function parseArgs(argv) {
  const parsed = {
    restart: 'corner',
    team: 'A',
    side: 'top-right',
  }
  for (let i = 2; i < argv.length; i++) {
    const value = argv[i]
    if (value === '--restart' && argv[i + 1]) parsed.restart = argv[++i]
    else if (value === '--team' && argv[i + 1]) parsed.team = argv[++i]
    else if (value === '--side' && argv[i + 1]) parsed.side = argv[++i]
  }
  return parsed
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

function fieldSideForScreen(side) {
  if (side.includes('top')) return side.replace('top', 'bottom')
  if (side.includes('bottom')) return side.replace('bottom', 'top')
  return side
}

function restartFixtureConfig(kind, side, team) {
  const fieldSide = fieldSideForScreen(side)
  if (kind === 'throw_in') {
    const top = fieldSide.includes('top')
    return {
      state: { kind: 'ball_out', restartType: 'throw_in', restartTeam: team === 'A' ? 'home' : 'away' },
      context: {
        restartType: 'throw_in',
        restartTeam: team,
        spot: { x: 4, z: top ? FIELD_D / 2 - 0.05 : -FIELD_D / 2 + 0.05 },
        lastTouchTeam: team === 'A' ? 'B' : 'A',
        lastTouchPlayerId: null,
        crossedLine: top ? 'top_touchline' : 'bottom_touchline',
      },
      ballPos: { x: 4, z: top ? FIELD_D / 2 + 0.9 : -FIELD_D / 2 - 0.9 },
    }
  }

  const top = fieldSide.includes('top')
  const right = fieldSide.includes('right')
  return {
    state: { kind: 'ball_out', restartType: 'corner', restartTeam: team === 'A' ? 'home' : 'away' },
    context: {
      restartType: 'corner',
      restartTeam: team,
      spot: {
        x: right ? RIGHT_GOAL_X + 1 : -RIGHT_GOAL_X - 1,
        z: top ? FIELD_D / 2 + 1 : -FIELD_D / 2 - 1,
      },
      lastTouchTeam: team === 'A' ? 'B' : 'A',
      lastTouchPlayerId: null,
      crossedLine: right ? 'right_goal_line' : 'left_goal_line',
    },
    ballPos: {
      x: right ? RIGHT_GOAL_X + 1 : -RIGHT_GOAL_X - 1,
      z: top ? FIELD_D / 2 + 1 : -FIELD_D / 2 - 1,
    },
  }
}

function fallbackClipFor(size, options) {
  const width = Math.max(320, size.width || 1600)
  const height = Math.max(240, size.height || 900)
  const top = options.side.includes('top')
  const right = options.side.includes('right')
  if (options.restart === 'corner') {
    return {
      x: right ? Math.floor(width * 0.58) : 0,
      y: top ? 0 : Math.floor(height * 0.54),
      width: Math.floor(width * 0.42),
      height: Math.floor(height * 0.46),
    }
  }
  return {
    x: 0,
    y: top ? 0 : Math.floor(height * 0.52),
    width,
    height: Math.floor(height * 0.48),
  }
}

function normalizeClip(clip, viewport) {
  if (!clip || !viewport?.width || !viewport?.height) return null
  const maxWidth = Math.max(1, Math.floor(viewport.width))
  const maxHeight = Math.max(1, Math.floor(viewport.height))
  const x = Math.min(Math.max(0, Math.floor(clip.x || 0)), maxWidth - 1)
  const y = Math.min(Math.max(0, Math.floor(clip.y || 0)), maxHeight - 1)
  const width = Math.min(
    Math.max(1, Math.floor(clip.width || maxWidth)),
    maxWidth - x
  )
  const height = Math.min(
    Math.max(1, Math.floor(clip.height || maxHeight)),
    maxHeight - y
  )
  if (width <= 0 || height <= 0) return null
  return { x, y, width, height }
}

async function forceRestart(page, options) {
  return await page.evaluate(({ options, fieldD }) => {
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
    for (const player of players) {
      const side = player.team === 'A' ? -1 : 1
      player.pos.x = side * (player.role === 'GK' ? 27 : 6 + (player.shirtNumber % 5) * 3)
      player.pos.z = (player.shirtNumber - 6) * 1.3
      player.targetPos = { ...player.pos }
      player.vel = { x: 0, z: 0 }
    }

    const fieldSide = options.side.includes('top')
      ? options.side.replace('top', 'bottom')
      : options.side.includes('bottom')
        ? options.side.replace('bottom', 'top')
        : options.side

    const fixture = (() => {
      if (options.restart === 'throw_in') {
        const top = fieldSide.includes('top')
        return {
          state: { kind: 'ball_out', restartType: 'throw_in', restartTeam: options.team === 'A' ? 'home' : 'away' },
          context: {
            restartType: 'throw_in',
            restartTeam: options.team,
            spot: { x: 4, z: top ? fieldD / 2 - 0.05 : -fieldD / 2 + 0.05 },
            lastTouchTeam: options.team === 'A' ? 'B' : 'A',
            lastTouchPlayerId: null,
            crossedLine: top ? 'top_touchline' : 'bottom_touchline',
          },
          ball: { x: 4, y: 0.18, z: top ? fieldD / 2 + 0.9 : -fieldD / 2 - 0.9 },
        }
      }
      const top = fieldSide.includes('top')
      const right = fieldSide.includes('right')
      return {
        state: { kind: 'ball_out', restartType: 'corner', restartTeam: options.team === 'A' ? 'home' : 'away' },
        context: {
          restartType: 'corner',
          restartTeam: options.team,
          spot: { x: right ? 31.4 : -31.4, z: top ? fieldD / 2 + 1 : -fieldD / 2 - 1 },
          lastTouchTeam: options.team === 'A' ? 'B' : 'A',
          lastTouchPlayerId: null,
          crossedLine: right ? 'right_goal_line' : 'left_goal_line',
        },
        ball: { x: right ? 31.4 : -31.4, y: 0.18, z: top ? fieldD / 2 + 1 : -fieldD / 2 - 1 },
      }
    })()

    model.lastTouchTeam = fixture.context.lastTouchTeam
    model.lastTouchPlayerId = fixture.context.lastTouchPlayerId
    model.lastBallPos = { x: fixture.context.spot.x, z: fixture.context.spot.z }
    model.ball.pos = fixture.ball
    model.ball.vel = { x: 0, z: 0 }
    model.possession = null
    const eventStart = model.eventLog?.length || 0

    model.msm.state = fixture.state
    model.msm.restartTimer = 1.5
    model.installBallOutRestart?.(fixture.context)
    const setupEventIndex = Math.max(0, (model.eventLog?.length || 1) - 1)
    const setupEvent = model.eventLog?.[setupEventIndex] || null
    if (setupEvent && typeof game.updateRestartPresentationFromEvent === 'function') {
      game.updateRestartPresentationFromEvent(setupEvent, setupEventIndex)
    }
    game.setPaused?.(true)

    return {
      eventStart,
      setupEventIndex,
      snapshot: game.getMatchSnapshot?.(),
      state: model.msm.state,
      restartContext: model.restartContext,
      activeRestartPresentation: game.activeRestartPresentation || null,
    }
  }, { options, fieldD: FIELD_D })
}

async function projectedClip(page, options) {
  return await page.evaluate((options) => {
    const game = window.__gameRef || window.pslGame
    const camera = game?.camera
    const model = game?.model
    const restart = game?.activeRestartPresentation
    const canvas = game?.renderer?.domElement || document.querySelector('canvas')
    const rect = canvas?.getBoundingClientRect?.() || {
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    }
    if (!camera || !restart || !model) return null
    const visual = restart.takerId ? game?.playerMeshes?.get?.(restart.takerId) : null
    const ballGroup = game?.ballGroup
    const screenPoint = (vec) => {
      const projected = vec.clone().project(camera)
      return {
        x: rect.left + (projected.x * 0.5 + 0.5) * rect.width,
        y: rect.top + (-projected.y * 0.5 + 0.5) * rect.height,
      }
    }
    const points = []
    if (visual?.mesh?.position?.clone) points.push(screenPoint(visual.mesh.position))
    if (ballGroup?.position?.clone) points.push(screenPoint(ballGroup.position))
    const takerSpot = restart?.takerSpot
    if (takerSpot && ballGroup?.position?.clone) {
      const sample = ballGroup.position.clone()
      sample.set(takerSpot.x, 0.18, takerSpot.z)
      points.push(screenPoint(sample))
    }
    const restartSpot = restart?.spot
    if (restartSpot && ballGroup?.position?.clone) {
      const sample = ballGroup.position.clone()
      sample.set(restartSpot.x, 0.18, restartSpot.z)
      points.push(screenPoint(sample))
    }
    const valid = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    if (!valid.length) return null
    const pad = options.restart === 'corner' ? 180 : 150
    const minX = Math.min(...valid.map((point) => point.x)) - pad
    const maxX = Math.max(...valid.map((point) => point.x)) + pad
    const minY = Math.min(...valid.map((point) => point.y)) - pad
    const maxY = Math.max(...valid.map((point) => point.y)) + pad
    const x = Math.max(0, Math.floor(minX))
    const y = Math.max(0, Math.floor(minY))
    const width = Math.max(220, Math.min(window.innerWidth - x, Math.ceil(maxX - minX)))
    const height = Math.max(220, Math.min(window.innerHeight - y, Math.ceil(maxY - minY)))
    return { x, y, width, height, points: valid }
  }, options)
}

async function rendererDebug(page) {
  return await page.evaluate(() => {
    const game = window.__gameRef || window.pslGame
    const camera = game?.camera
    const restart = game?.activeRestartPresentation
    const canvas = game?.renderer?.domElement || document.querySelector('canvas')
    const rect = canvas?.getBoundingClientRect?.() || {
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    }
    const takerVisual = restart?.takerId ? game?.playerMeshes?.get?.(restart.takerId) : null
    const ballGroup = game?.ballGroup
    const toPlain = (vec) =>
      vec ? { x: Number(vec.x), y: Number(vec.y), z: Number(vec.z) } : null
    const screenPoint = (vec) => {
      if (!vec?.clone || !camera) return null
      const projected = vec.clone().project(camera)
      return {
        x: rect.left + (projected.x * 0.5 + 0.5) * rect.width,
        y: rect.top + (-projected.y * 0.5 + 0.5) * rect.height,
        z: projected.z,
      }
    }
    const takerMeshPos = takerVisual?.mesh?.position || null
    const ballPos = ballGroup?.position || null
    const takerSpotPoint =
      restart?.takerSpot && ballPos?.clone
        ? (() => {
            const sample = ballPos.clone()
            sample.set(restart.takerSpot.x, 0.18, restart.takerSpot.z)
            return sample
          })()
        : null
    const restartSpotPoint =
      restart?.spot && ballPos?.clone
        ? (() => {
            const sample = ballPos.clone()
            sample.set(restart.spot.x, 0.18, restart.spot.z)
            return sample
          })()
        : null
    return {
      restart,
      takerMeshPos: toPlain(takerMeshPos),
      ballGroupPos: toPlain(ballPos),
      takerMeshScreen: screenPoint(takerMeshPos),
      ballGroupScreen: screenPoint(ballPos),
      takerSpotScreen: screenPoint(takerSpotPoint),
      restartSpotScreen: screenPoint(restartSpotPoint),
      canvasRect: rect,
      window: { width: window.innerWidth, height: window.innerHeight },
    }
  })
}

async function capture() {
  const options = parseArgs(process.argv)
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const browser = await chromium.connectOverCDP(CDP_URL)
  const pages = appPages(browser)
  if (!pages.length) throw new Error(`No existing app tab found at ${APP_URL}. Open/reuse the current debug browser tab first.`)
  const page = pages[0]
  page.setDefaultTimeout(10000)
  await page.bringToFront().catch(() => {})
  await waitForGame(page)

  const id = `${options.restart}-${options.team}-${options.side}-${stamp()}`
  const setup = path.join(OUT_DIR, `${id}-setup.png`)
  const release = path.join(OUT_DIR, `${id}-release.png`)
  const setupFull = path.join(OUT_DIR, `${id}-setup-full.png`)
  const releaseFull = path.join(OUT_DIR, `${id}-release-full.png`)
  const reportPath = path.join(OUT_DIR, `${id}.json`)

  const forced = await forceRestart(page, options)
  const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))
  await page.waitForTimeout(250)
  const setupDebug = await rendererDebug(page)
  await page.screenshot({ path: setupFull, fullPage: false })
  const setupClip =
    normalizeClip(await projectedClip(page, options), viewport) ||
    normalizeClip(fallbackClipFor(viewport, options), viewport)
  await page.screenshot({ path: setup, fullPage: false, clip: setupClip })
  await page.evaluate(() => {
    const game = window.__gameRef || window.pslGame
    game?.setPaused?.(false)
  })
  await page.waitForTimeout(options.restart === 'corner' ? 1700 : 1550)
  const releaseDebug = await rendererDebug(page)
  await page.screenshot({ path: releaseFull, fullPage: false })
  const releaseClip =
    normalizeClip(await projectedClip(page, options), viewport) ||
    normalizeClip(fallbackClipFor(viewport, options), viewport)
  await page.screenshot({ path: release, fullPage: false, clip: releaseClip })
  await page.evaluate(() => {
    const game = window.__gameRef || window.pslGame
    game?.setPaused?.(true)
  })
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
        detail: event.detail,
        meta: event.meta,
      })),
      ball: model?.ball?.pos || null,
    }
  }, forced.eventStart)

  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      { options, forced, setupDebug, releaseDebug, report, setup, release, setupFull, releaseFull },
      null,
      2
    )
  )
  console.log(JSON.stringify({ setup, release, report: reportPath, forced, recentEvents: report.recentEvents }, null, 2))
}

capture().then(() => process.exit(0)).catch((error) => {
  console.error(error?.stack || error?.message || String(error))
  process.exit(1)
})
