#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import Database from 'better-sqlite3'

function parseArgs(argv) {
  const options = {
    db: 'psl.db',
    latest: false,
    waitNewAfterId: 0,
    pollMs: 5000,
    timeoutMs: 45 * 60 * 1000,
    outDir: '',
    playerSpeedThreshold: 14,
    playerJumpThreshold: 8,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--db') {
      options.db = argv[++i] || options.db
    } else if (arg === '--latest') {
      options.latest = true
    } else if (arg === '--wait-new-after-id') {
      options.waitNewAfterId = Number(argv[++i] || 0)
    } else if (arg === '--poll-ms') {
      options.pollMs = Number(argv[++i] || options.pollMs)
    } else if (arg === '--timeout-ms') {
      options.timeoutMs = Number(argv[++i] || options.timeoutMs)
    } else if (arg === '--out-dir') {
      options.outDir = argv[++i] || ''
    } else if (arg === '--player-speed-threshold') {
      options.playerSpeedThreshold = Number(argv[++i] || options.playerSpeedThreshold)
    } else if (arg === '--player-jump-threshold') {
      options.playerJumpThreshold = Number(argv[++i] || options.playerJumpThreshold)
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!options.latest && !options.waitNewAfterId) options.latest = true
  if (!Number.isFinite(options.pollMs) || options.pollMs < 500) options.pollMs = 5000
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1000) options.timeoutMs = 45 * 60 * 1000
  if (!Number.isFinite(options.playerSpeedThreshold) || options.playerSpeedThreshold <= 0) options.playerSpeedThreshold = 14
  if (!Number.isFinite(options.playerJumpThreshold) || options.playerJumpThreshold <= 0) options.playerJumpThreshold = 8
  return options
}

function printHelp() {
  console.log(`Audit saved match telemetry for teleporting balls and players.

Usage:
  node scripts/teleport-audit.mjs --latest
  node scripts/teleport-audit.mjs --wait-new-after-id 489 --out-dir telemetry/teleport-watch

Options:
  --wait-new-after-id <id>       Wait until a later FULL_TIME match row exists.
  --latest                      Audit the latest FULL_TIME row immediately.
  --out-dir <path>              Directory for teleport-audit.json/.md.
  --player-speed-threshold <n>  Flag sampled player speed above n units/s.
  --player-jump-threshold <n>   Flag sampled player jump distance above n units.
`)
}

function openDb(dbPath) {
  return new Database(path.resolve(process.cwd(), dbPath), { readonly: true, fileMustExist: true })
}

function getLatestFullTimeMatch(db, minId = 0) {
  return db.prepare(`
    SELECT id, session_id, timestamp, team_a_name, team_b_name, score_a, score_b, phase, bundle_json
    FROM match_results
    WHERE phase = 'FULL_TIME' AND id > ?
    ORDER BY id DESC
    LIMIT 1
  `).get(minId)
}

async function waitForMatch(options) {
  const started = Date.now()
  while (true) {
    const db = openDb(options.db)
    try {
      const row = getLatestFullTimeMatch(db, options.waitNewAfterId)
      if (row) return row
    } finally {
      db.close()
    }

    if (Date.now() - started > options.timeoutMs) {
      throw new Error(`Timed out waiting for a FULL_TIME match after id ${options.waitNewAfterId}`)
    }
    await delay(options.pollMs)
  }
}

function numberOrNull(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null
  return +value.toFixed(digits)
}

function getPointFromEvent(event) {
  const detail = event?.detail || {}
  const x = numberOrNull(detail.x)
  const z = numberOrNull(detail.z)
  if (x === null || z === null) return null
  return { x, z }
}

function getSampleKey(event) {
  const detail = event?.detail || {}
  const player = detail.player || detail.carrier || event?.role || 'unknown'
  return `${event?.team || '?'}:${player}`
}

function collectPlayerSamples(bundle) {
  const samples = []
  for (const event of bundle.events || []) {
    if (event.type !== 'POSITION_OWNER_SAMPLE' && event.type !== 'CARRIER_TRACE') continue
    const point = getPointFromEvent(event)
    if (!point) continue
    samples.push({
      source: event.type,
      key: getSampleKey(event),
      player: event.detail?.player || event.detail?.carrier || 'unknown',
      team: event.team || '?',
      role: event.role || event.detail?.role || '?',
      t: numberOrNull(event.t) ?? 0,
      half: event.half || 0,
      x: point.x,
      z: point.z,
    })
  }
  return samples
}

function analyzePlayerSpikes(bundle, options) {
  const byKey = new Map()
  for (const sample of collectPlayerSamples(bundle)) {
    if (!byKey.has(sample.key)) byKey.set(sample.key, [])
    byKey.get(sample.key).push(sample)
  }

  const spikes = []
  const topSpeeds = []
  for (const samples of byKey.values()) {
    samples.sort((a, b) => (a.half - b.half) || (a.t - b.t))
    for (let i = 1; i < samples.length; i += 1) {
      const prev = samples[i - 1]
      const cur = samples[i]
      if (cur.half !== prev.half) continue
      const dt = cur.t - prev.t
      if (dt <= 0 || dt > 15) continue
      const dx = cur.x - prev.x
      const dz = cur.z - prev.z
      const dist = Math.hypot(dx, dz)
      const speed = dist / dt
      const row = {
        player: cur.player,
        team: cur.team,
        role: cur.role,
        source: cur.source,
        half: cur.half,
        fromT: round(prev.t),
        toT: round(cur.t),
        dt: round(dt),
        distance: round(dist),
        speed: round(speed),
        from: { x: round(prev.x), z: round(prev.z) },
        to: { x: round(cur.x), z: round(cur.z) },
      }
      topSpeeds.push(row)
      if (speed > options.playerSpeedThreshold || dist > options.playerJumpThreshold) spikes.push(row)
    }
  }

  topSpeeds.sort((a, b) => (b.speed || 0) - (a.speed || 0))
  spikes.sort((a, b) => (b.speed || 0) - (a.speed || 0))
  return {
    sampleCount: collectPlayerSamples(bundle).length,
    trackedPlayers: byKey.size,
    thresholds: {
      playerSpeedUnitsPerSecond: options.playerSpeedThreshold,
      playerJumpUnits: options.playerJumpThreshold,
    },
    spikeCount: spikes.length,
    spikes: spikes.slice(0, 50),
    topSpeeds: topSpeeds.slice(0, 25),
  }
}

function analyzeBallTeleports(bundle) {
  const telemetry = bundle.teleportation || {}
  const log = Array.isArray(telemetry.log) ? telemetry.log : []
  const unexpected = log.filter((entry) => entry.wasReverted === true)
  const restartLike = log.filter((entry) => entry.wasReverted !== true)
  const top = [...log].sort((a, b) => Number(b.jump || 0) - Number(a.jump || 0)).slice(0, 25)
  return {
    detected: Number(telemetry.detected || 0),
    reverted: Number(telemetry.reverted || 0),
    restartRepositions: Number(telemetry.restartRepositions || 0),
    logCount: log.length,
    unexpectedCount: unexpected.length,
    restartLikeCount: restartLike.length,
    topJumps: top.map((entry) => ({
      time: round(Number(entry.time || 0)),
      jump: round(Number(entry.jump || 0)),
      from: entry.from || null,
      to: entry.to || null,
      wasReverted: !!entry.wasReverted,
      held: entry.held || 'none',
      fly: !!entry.fly,
      roll: !!entry.roll,
    })),
  }
}

function buildReport(row, bundle, options) {
  const players = analyzePlayerSpikes(bundle, options)
  const ball = analyzeBallTeleports(bundle)
  return {
    generatedAt: new Date().toISOString(),
    match: {
      id: row.id,
      sessionId: row.session_id,
      timestamp: row.timestamp,
      teamA: row.team_a_name,
      teamB: row.team_b_name,
      score: `${row.score_a}-${row.score_b}`,
      phase: row.phase,
      bundleSessionId: bundle.metadata?.sessionId || null,
      matchId: bundle.matchId || bundle.metadata?.matchId || null,
    },
    verdict: {
      ballTeleportIssue: ball.detected > 0 || ball.unexpectedCount > 0,
      playerTeleportIssue: players.spikeCount > 0,
    },
    ball,
    players,
  }
}

function renderMd(report) {
  const lines = []
  lines.push(`# Teleport Audit`)
  lines.push('')
  lines.push(`Generated: ${report.generatedAt}`)
  lines.push(`Match: #${report.match.id} ${report.match.teamA} ${report.match.score} ${report.match.teamB}`)
  lines.push(`Session: ${report.match.sessionId}`)
  lines.push('')
  lines.push(`## Verdict`)
  lines.push('')
  lines.push(`- Ball teleport issue: ${report.verdict.ballTeleportIssue ? 'YES' : 'NO'}`)
  lines.push(`- Player teleport issue: ${report.verdict.playerTeleportIssue ? 'YES' : 'NO'}`)
  lines.push('')
  lines.push(`## Ball`)
  lines.push('')
  lines.push(`- Detected: ${report.ball.detected}`)
  lines.push(`- Reverted/unexpected: ${report.ball.reverted}`)
  lines.push(`- Restart/dead-ball repositions: ${report.ball.restartRepositions}`)
  lines.push(`- Log rows: ${report.ball.logCount}`)
  lines.push('')
  lines.push(`Top ball jumps:`)
  for (const row of report.ball.topJumps.slice(0, 10)) {
    lines.push(`- t=${row.time}s jump=${row.jump} held=${row.held} fly=${row.fly} roll=${row.roll} reverted=${row.wasReverted}`)
  }
  if (report.ball.topJumps.length === 0) lines.push(`- none`)
  lines.push('')
  lines.push(`## Players`)
  lines.push('')
  lines.push(`- Samples checked: ${report.players.sampleCount}`)
  lines.push(`- Players tracked: ${report.players.trackedPlayers}`)
  lines.push(`- Spike count: ${report.players.spikeCount}`)
  lines.push(`- Thresholds: speed>${report.players.thresholds.playerSpeedUnitsPerSecond} units/s or jump>${report.players.thresholds.playerJumpUnits} units`)
  lines.push('')
  lines.push(`Top player speed spikes:`)
  for (const row of report.players.spikes.slice(0, 15)) {
    lines.push(`- ${row.team} ${row.role} ${row.player}: ${row.speed}u/s over ${row.distance}u in ${row.dt}s, half ${row.half}, ${row.fromT}->${row.toT}`)
  }
  if (report.players.spikes.length === 0) lines.push(`- none`)
  lines.push('')
  lines.push(`Fastest sampled player movements:`)
  for (const row of report.players.topSpeeds.slice(0, 10)) {
    lines.push(`- ${row.team} ${row.role} ${row.player}: ${row.speed}u/s over ${row.distance}u in ${row.dt}s, half ${row.half}, ${row.fromT}->${row.toT}`)
  }
  if (report.players.topSpeeds.length === 0) lines.push(`- none`)
  lines.push('')
  return `${lines.join('\n')}\n`
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  let row
  if (options.latest) {
    const db = openDb(options.db)
    try {
      row = getLatestFullTimeMatch(db, 0)
    } finally {
      db.close()
    }
  } else {
    row = await waitForMatch(options)
  }

  if (!row) throw new Error('No FULL_TIME match found')
  const bundle = JSON.parse(row.bundle_json || '{}')
  const report = buildReport(row, bundle, options)

  const outDir = options.outDir
    ? path.resolve(process.cwd(), options.outDir)
    : path.resolve(process.cwd(), 'telemetry', `teleport-audit-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  fs.mkdirSync(outDir, { recursive: true })
  const jsonPath = path.join(outDir, 'teleport-audit.json')
  const mdPath = path.join(outDir, 'teleport-audit.md')
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  fs.writeFileSync(mdPath, renderMd(report))

  console.log(`Teleport audit complete: ${mdPath}`)
  console.log(`Ball issue: ${report.verdict.ballTeleportIssue ? 'YES' : 'NO'} | Player issue: ${report.verdict.playerTeleportIssue ? 'YES' : 'NO'}`)
  console.log(`Ball detected=${report.ball.detected} restartRepositions=${report.ball.restartRepositions} playerSpikes=${report.players.spikeCount}`)
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err))
  process.exit(1)
})
