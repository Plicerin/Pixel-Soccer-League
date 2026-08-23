#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = path.resolve(import.meta.dirname, '..')
const DEFAULT_INPUT = 'data'
const DEFAULT_OUT = path.join('telemetry', 'real-movement-profile.json')
const PITCH = { length: 105, width: 68 }

function usage() {
  return `Usage:
  node scripts/analyze-real-movement-profile.mjs [--input data] [--out telemetry/real-movement-profile.json] [--json]

Builds a first-pass movement profile from Metrica Sports sample-data CSV games.
Expected layout:
  data/Sample_Game_1/Sample_Game_1_RawEventsData.csv
  data/Sample_Game_1/Sample_Game_1_RawTrackingData_Home_Team.csv
  data/Sample_Game_1/Sample_Game_1_RawTrackingData_Away_Team.csv
`
}

function parseArgs(argv) {
  const args = {
    input: path.join(ROOT, DEFAULT_INPUT),
    out: path.join(ROOT, DEFAULT_OUT),
    json: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') args.help = true
    else if (arg === '--json') args.json = true
    else if (arg === '--input') args.input = path.resolve(argv[++i])
    else if (arg === '--out') args.out = path.resolve(argv[++i])
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return args
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.isFile()) out.push(full)
  }
  return out
}

function parseCsvLine(line) {
  const cols = []
  let value = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"'
        i++
      } else {
        quoted = !quoted
      }
    } else if (ch === ',' && !quoted) {
      cols.push(value)
      value = ''
    } else {
      value += ch
    }
  }
  cols.push(value)
  return cols
}

function readCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (!lines.length) return []
  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const row = {}
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? ''
    })
    return row
  })
}

function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function percentile(values, p) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))
  return sorted[index]
}

function round(value, places = 2) {
  if (!Number.isFinite(value)) return null
  const scale = 10 ** places
  return Math.round(value * scale) / scale
}

function summary(values, places = 2) {
  const clean = values.filter(Number.isFinite)
  if (!clean.length) {
    return { count: 0, avg: null, p25: null, p50: null, p75: null, min: null, max: null }
  }
  const total = clean.reduce((sum, value) => sum + value, 0)
  return {
    count: clean.length,
    avg: round(total / clean.length, places),
    p25: round(percentile(clean, 0.25), places),
    p50: round(percentile(clean, 0.5), places),
    p75: round(percentile(clean, 0.75), places),
    min: round(Math.min(...clean), places),
    max: round(Math.max(...clean), places),
  }
}

function discoverGames(inputDir) {
  const files = walk(inputDir)
  const events = files.filter((file) => /RawEventsData\.csv$/i.test(path.basename(file)))
  return events.map((eventsFile) => {
    const dir = path.dirname(eventsFile)
    const homeTracking = files.find((file) => path.dirname(file) === dir && /RawTrackingData_Home_Team\.csv$/i.test(path.basename(file)))
    const awayTracking = files.find((file) => path.dirname(file) === dir && /RawTrackingData_Away_Team\.csv$/i.test(path.basename(file)))
    return {
      id: path.basename(dir),
      dir,
      eventsFile,
      tracking: { Home: homeTracking, Away: awayTracking },
    }
  })
}

function trackingColumnMap(headers) {
  const map = new Map()
  for (const header of headers) {
    const match = header.match(/^(.+)_([xy])$/i)
    if (!match) continue
    const id = match[1]
    const axis = match[2].toLowerCase()
    if (/ball/i.test(id)) continue
    if (!map.has(id)) map.set(id, {})
    map.get(id)[axis] = header
  }
  return [...map.entries()]
    .filter(([, cols]) => cols.x && cols.y)
    .map(([id, cols]) => ({ id, xCol: cols.x, yCol: cols.y }))
}

function loadTracking(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length < 4) return new Map()
  const headerIndex = lines.findIndex((line) => /^Period,Frame,Time \[s\],/i.test(line))
  if (headerIndex < 0) return new Map()
  const headers = parseCsvLine(lines[headerIndex])
  const playerColumns = []
  for (let index = 3; index < headers.length - 1; index += 2) {
    const id = headers[index]
    if (!id || /ball/i.test(id)) break
    playerColumns.push({ id, xIndex: index, yIndex: index + 1 })
  }
  const byPeriod = new Map()
  for (const line of lines.slice(headerIndex + 1)) {
    const cells = parseCsvLine(line)
    const period = Number(cells[0])
    const time = num(cells[2])
    if (!Number.isFinite(period) || !Number.isFinite(time)) continue
    const players = []
    for (const col of playerColumns) {
      const x = num(cells[col.xIndex])
      const y = num(cells[col.yIndex])
      if (x == null || y == null) continue
      players.push({
        id: col.id,
        xNorm: x,
        yNorm: y,
        x: x * PITCH.length,
        y: y * PITCH.width,
      })
    }
    if (!byPeriod.has(period)) byPeriod.set(period, [])
    byPeriod.get(period).push({ time, players })
  }
  for (const frames of byPeriod.values()) frames.sort((a, b) => a.time - b.time)
  return byPeriod
}

function frameAt(byPeriod, period, time) {
  const frames = byPeriod.get(Number(period))
  if (!frames?.length || !Number.isFinite(time)) return null
  let lo = 0
  let hi = frames.length - 1
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (frames[mid].time < time) lo = mid + 1
    else hi = mid
  }
  if (lo > 0 && Math.abs(frames[lo - 1].time - time) < Math.abs(frames[lo].time - time)) return frames[lo - 1]
  return frames[lo]
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function inferDirections(events) {
  const directions = new Map()
  for (const team of ['Home', 'Away']) {
    for (const period of [1, 2]) {
      const periodEvents = events.filter((event) => event.Team === team && Number(event.Period) === period)
      const shotXs = periodEvents
        .filter((event) => /SHOT/i.test(event.Type ?? ''))
        .map((event) => num(event['Start X']))
        .filter(Number.isFinite)
      const passProgress = periodEvents
        .filter((event) => /PASS/i.test(event.Type ?? ''))
        .map((event) => {
          const start = num(event['Start X'])
          const end = num(event['End X'])
          return start == null || end == null ? null : end - start
        })
        .filter(Number.isFinite)
      const shotMedian = median(shotXs)
      const passMedian = median(passProgress)
      const direction = shotMedian != null ? (shotMedian >= 0.5 ? 1 : -1) : (passMedian ?? 0) >= 0 ? 1 : -1
      directions.set(`${team}:${period}`, direction)
    }
  }
  return directions
}

function progressFor(xNorm, direction) {
  return direction === 1 ? xNorm : 1 - xNorm
}

function phaseFor(progress) {
  if (progress < 0.4) return 'buildup'
  if (progress < 0.67) return 'progression'
  return 'finalThird'
}

function isCross(event) {
  return /CROSS/i.test(`${event.Type ?? ''} ${event.Subtype ?? ''}`)
}

function isWide(yNorm) {
  return yNorm <= 0.18 || yNorm >= 0.82
}

function isBox(player, direction) {
  const progress = progressFor(player.xNorm, direction)
  return progress >= 0.84 && Math.abs(player.yNorm - 0.5) <= 0.32
}

function nearestSupportDistance(frame, carrierId) {
  const carrier = frame.players.find((player) => player.id === carrierId)
  if (!carrier) return null
  const teammates = frame.players.filter((player) => player.id !== carrierId)
  if (!teammates.length) return null
  return Math.min(...teammates.map((player) => distance(carrier, player)))
}

function teamWidth(frame) {
  if (!frame?.players?.length) return null
  const ys = frame.players.map((player) => player.y)
  return Math.max(...ys) - Math.min(...ys)
}

function nearestDefenderDistance(attackers, defenders, direction) {
  const dangerousAttackers = attackers.filter((player) => {
    const progress = progressFor(player.xNorm, direction)
    return progress >= 0.72 && Math.abs(player.yNorm - 0.5) <= 0.38
  })
  if (!dangerousAttackers.length || !defenders.length) return []
  return dangerousAttackers.map((attacker) => Math.min(...defenders.map((defender) => distance(attacker, defender))))
}

function analyzeGame(game) {
  const events = readCsv(game.eventsFile)
  const tracking = {
    Home: game.tracking.Home ? loadTracking(game.tracking.Home) : new Map(),
    Away: game.tracking.Away ? loadTracking(game.tracking.Away) : new Map(),
  }
  const directions = inferDirections(events)

  const values = {
    teamWidthByPhase: { buildup: [], progression: [], finalThird: [] },
    supportDistance: [],
    wideEntryToCrossSeconds: [],
    boxAttackersBeforeCross: [],
    dangerousAttackerDefenderDistance: [],
  }
  const coverage = {
    events: events.length,
    crossEvents: 0,
    supportSamples: 0,
    widthSamples: 0,
    defenderDistanceSamples: 0,
  }
  const lastWideEntry = new Map()

  for (const event of events) {
    const team = event.Team
    if (team !== 'Home' && team !== 'Away') continue
    const period = Number(event.Period)
    const startTime = num(event['Start Time [s]'])
    const startX = num(event['Start X'])
    const startY = num(event['Start Y'])
    if (!Number.isFinite(period) || startTime == null || startX == null || startY == null) continue
    const direction = directions.get(`${team}:${period}`) ?? 1
    const progress = progressFor(startX, direction)
    const phase = phaseFor(progress)
    const teamFrame = frameAt(tracking[team], period, startTime)
    const opponent = team === 'Home' ? 'Away' : 'Home'
    const opponentFrame = frameAt(tracking[opponent], period, startTime)

    const width = teamWidth(teamFrame)
    if (width != null) {
      values.teamWidthByPhase[phase].push(width)
      coverage.widthSamples++
    }

    if (event.From && teamFrame) {
      const support = nearestSupportDistance(teamFrame, event.From)
      if (support != null) {
        values.supportDistance.push(support)
        coverage.supportSamples++
      }
    }

    if (isWide(startY) && progress >= 0.48) {
      lastWideEntry.set(`${team}:${period}`, startTime)
    }

    if (isCross(event)) {
      coverage.crossEvents++
      const entryTime = lastWideEntry.get(`${team}:${period}`)
      if (entryTime != null && startTime >= entryTime && startTime - entryTime <= 20) {
        values.wideEntryToCrossSeconds.push(startTime - entryTime)
      }
      if (teamFrame) values.boxAttackersBeforeCross.push(teamFrame.players.filter((player) => isBox(player, direction)).length)
    }

    if (teamFrame && opponentFrame && phase === 'finalThird') {
      const distances = nearestDefenderDistance(teamFrame.players, opponentFrame.players, direction)
      values.dangerousAttackerDefenderDistance.push(...distances)
      coverage.defenderDistanceSamples += distances.length
    }
  }

  return {
    id: game.id,
    sourceFiles: {
      events: path.relative(ROOT, game.eventsFile),
      homeTracking: game.tracking.Home ? path.relative(ROOT, game.tracking.Home) : null,
      awayTracking: game.tracking.Away ? path.relative(ROOT, game.tracking.Away) : null,
    },
    coverage,
    values,
  }
}

function mergeGameProfiles(gameProfiles) {
  const merged = {
    teamWidthByPhase: { buildup: [], progression: [], finalThird: [] },
    supportDistance: [],
    wideEntryToCrossSeconds: [],
    boxAttackersBeforeCross: [],
    dangerousAttackerDefenderDistance: [],
  }
  for (const game of gameProfiles) {
    for (const phase of Object.keys(merged.teamWidthByPhase)) {
      merged.teamWidthByPhase[phase].push(...game.values.teamWidthByPhase[phase])
    }
    merged.supportDistance.push(...game.values.supportDistance)
    merged.wideEntryToCrossSeconds.push(...game.values.wideEntryToCrossSeconds)
    merged.boxAttackersBeforeCross.push(...game.values.boxAttackersBeforeCross)
    merged.dangerousAttackerDefenderDistance.push(...game.values.dangerousAttackerDefenderDistance)
  }
  return merged
}

function buildReport(inputDir) {
  const games = discoverGames(inputDir).filter((game) => game.tracking.Home && game.tracking.Away)
  const skipped = discoverGames(inputDir).filter((game) => !game.tracking.Home || !game.tracking.Away)
  const gameProfiles = games.map(analyzeGame)
  const merged = mergeGameProfiles(gameProfiles)
  return {
    generatedAt: new Date().toISOString(),
    source: {
      kind: 'metrica-sports-sample-data-csv',
      inputDir: path.relative(ROOT, inputDir) || '.',
      pitchMeters: PITCH,
      gamesFound: games.length + skipped.length,
      gamesAnalyzed: games.length,
      gamesSkipped: skipped.map((game) => ({
        id: game.id,
        reason: 'missing Home or Away tracking CSV',
      })),
    },
    metrics: {
      teamWidthMetersByPhase: {
        buildup: summary(merged.teamWidthByPhase.buildup),
        progression: summary(merged.teamWidthByPhase.progression),
        finalThird: summary(merged.teamWidthByPhase.finalThird),
      },
      nearestSupportDistanceMeters: summary(merged.supportDistance),
      wideEntryToCrossSeconds: summary(merged.wideEntryToCrossSeconds),
      boxAttackersBeforeCross: summary(merged.boxAttackersBeforeCross, 1),
      dangerousAttackerNearestDefenderMeters: summary(merged.dangerousAttackerDefenderDistance),
    },
    directorTargets: {
      teamWidthMeters: {
        buildup: summary(merged.teamWidthByPhase.buildup).p50,
        progression: summary(merged.teamWidthByPhase.progression).p50,
        finalThird: summary(merged.teamWidthByPhase.finalThird).p50,
      },
      supportDistanceMeters: {
        preferredMin: summary(merged.supportDistance).p25,
        preferredMedian: summary(merged.supportDistance).p50,
        preferredMax: summary(merged.supportDistance).p75,
      },
      crossTimingSecondsAfterWideEntry: {
        preferredMin: summary(merged.wideEntryToCrossSeconds).p25,
        preferredMedian: summary(merged.wideEntryToCrossSeconds).p50,
        preferredMax: summary(merged.wideEntryToCrossSeconds).p75,
      },
      boxAttackersBeforeCross: {
        preferredMin: summary(merged.boxAttackersBeforeCross, 1).p25,
        preferredMedian: summary(merged.boxAttackersBeforeCross, 1).p50,
      },
      dangerousAttackerDefenderDistanceMeters: {
        preferredMedian: summary(merged.dangerousAttackerDefenderDistance).p50,
        upperWarning: summary(merged.dangerousAttackerDefenderDistance).p75,
      },
    },
    notes: [
      'Coordinates are converted from normalized Metrica CSV coordinates to a 105m x 68m pitch.',
      'Team attack direction is inferred per team and period from shots when available, otherwise pass progression.',
      'This is a measurement scaffold, not a machine-learning model. The director should consume these targets conservatively.',
    ],
    games: gameProfiles.map((game) => ({
      id: game.id,
      sourceFiles: game.sourceFiles,
      coverage: game.coverage,
    })),
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    process.stdout.write(usage())
    return
  }
  const report = buildReport(args.input)
  fs.mkdirSync(path.dirname(args.out), { recursive: true })
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`)
  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    return
  }
  process.stdout.write(`Real movement profile written to ${path.relative(ROOT, args.out)}\n`)
  process.stdout.write(`Games analyzed: ${report.source.gamesAnalyzed}/${report.source.gamesFound}\n`)
  if (report.source.gamesAnalyzed === 0) {
    process.stdout.write(`No complete Metrica CSV games found under ${path.relative(ROOT, args.input) || '.'}\n`)
  }
}

try {
  main()
} catch (err) {
  process.stderr.write(`${err.stack || err.message}\n`)
  process.exitCode = 1
}
