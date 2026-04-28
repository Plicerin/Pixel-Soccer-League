#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const ROOT = process.cwd()
const CONFIG_PATH = path.join(ROOT, 'project-hours.config.json')
const DEFAULT_CONFIG = {
  projectStart: '2026-04-01T21:17:00-04:00',
  manualWorklogPath: 'project-hours-worklog.jsonl',
  codexCliSessionGapMinutes: 30,
  activitySessionGapMinutes: 45,
  minimumActivityBlockMinutes: 5,
  maximumActivityBlockHours: 3,
  activityRoots: ['src', 'scripts', 'tests', 'docs', 'public', 'package.json', 'package-lock.json'],
  excludePathParts: ['.git', 'node_modules', 'dist', 'telemetry', 'psl.db', 'psl.db-shm', 'psl.db-wal'],
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

function loadConfig() {
  return { ...DEFAULT_CONFIG, ...(readJson(CONFIG_PATH, {}) || {}) }
}

function round(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return 0
  return +Number(value).toFixed(digits)
}

function hours(ms) {
  return round(ms / 36e5, 2)
}

function isoNow() {
  return new Date().toISOString()
}

function parseArgs(argv) {
  const options = { command: 'summary', json: false, note: '' }
  const rest = [...argv]
  if (rest[0] && !rest[0].startsWith('--')) options.command = rest.shift()
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    if (arg === '--json') options.json = true
    else if (arg === '--note') options.note = rest[++i] || ''
    else if (arg === '--help' || arg === '-h') options.command = 'help'
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return options
}

function worklogPath(config) {
  return path.resolve(ROOT, config.manualWorklogPath || DEFAULT_CONFIG.manualWorklogPath)
}

function readWorklog(config) {
  const filePath = worklogPath(config)
  if (!fs.existsSync(filePath)) return []
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line) } catch { return null }
    })
    .filter(Boolean)
}

function appendWorklog(config, entry) {
  const filePath = worklogPath(config)
  fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, 'utf8')
}

function getOpenManualSession(entries) {
  let open = null
  for (const entry of entries) {
    if (entry.type === 'start') open = entry
    if (entry.type === 'stop') open = null
  }
  return open
}

function summarizeManualWorklog(config) {
  const entries = readWorklog(config)
  const sessions = []
  let open = null
  for (const entry of entries) {
    if (entry.type === 'start') {
      if (!open) open = entry
    } else if (entry.type === 'stop' && open) {
      const startedAt = new Date(open.at)
      const stoppedAt = new Date(entry.at)
      if (Number.isFinite(startedAt.getTime()) && Number.isFinite(stoppedAt.getTime()) && stoppedAt > startedAt) {
        sessions.push({
          startedAt: open.at,
          stoppedAt: entry.at,
          note: [open.note, entry.note].filter(Boolean).join(' / '),
          hours: hours(stoppedAt - startedAt),
        })
      }
      open = null
    }
  }
  const totalHours = round(sessions.reduce((sum, session) => sum + session.hours, 0))
  return {
    path: path.relative(ROOT, worklogPath(config)),
    entries: entries.length,
    sessions,
    openSession: open,
    totalHours,
  }
}

function runGit(args) {
  const result = spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: 'NUL',
      GIT_CONFIG_NOSYSTEM: '1',
    },
  })
  if (result.error || result.status !== 0) return null
  return result.stdout.trim()
}

function summarizeGit(config) {
  const first = runGit(['log', '--reverse', '--format=%cI', '-1'])
  const last = runGit(['log', '-1', '--format=%cI'])
  const countRaw = runGit(['rev-list', '--count', 'HEAD'])
  const timestampsRaw = runGit(['log', '--format=%cI'])
  const fallbackStart = config.projectStart
  return {
    available: !!first,
    firstCommitAt: first || fallbackStart,
    lastCommitAt: last || null,
    commitCount: Number(countRaw || 0),
    commitTimestamps: timestampsRaw ? timestampsRaw.split(/\r?\n/).filter(Boolean) : [],
    fallbackProjectStart: fallbackStart,
  }
}

function shouldExclude(relPath, config) {
  const normalized = relPath.replace(/\\/g, '/')
  return (config.excludePathParts || []).some((part) => {
    const p = String(part).replace(/\\/g, '/')
    return normalized === p || normalized.startsWith(`${p}/`) || normalized.includes(`/${p}/`)
  })
}

function collectFileMtimes(config) {
  const timestamps = []
  const roots = config.activityRoots || DEFAULT_CONFIG.activityRoots
  const visit = (absPath) => {
    const rel = path.relative(ROOT, absPath)
    if (!rel || shouldExclude(rel, config)) return
    let stat
    try { stat = fs.statSync(absPath) } catch { return }
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(absPath)) visit(path.join(absPath, entry))
    } else if (stat.isFile()) {
      timestamps.push({ at: stat.mtime.toISOString(), source: 'file', path: rel })
    }
  }
  for (const root of roots) {
    const abs = path.resolve(ROOT, root)
    if (fs.existsSync(abs)) visit(abs)
  }
  return timestamps
}

function estimateActivityHours(config, gitSummary) {
  const events = [
    ...gitSummary.commitTimestamps.map((at) => ({ at, source: 'git' })),
    ...collectFileMtimes(config),
  ]
    .map((event) => ({ ...event, ms: new Date(event.at).getTime() }))
    .filter((event) => Number.isFinite(event.ms))
    .sort((a, b) => a.ms - b.ms)

  const gapMs = Number(config.activitySessionGapMinutes || 45) * 60_000
  const minBlockMs = Number(config.minimumActivityBlockMinutes || 5) * 60_000
  const maxBlockMs = Number(config.maximumActivityBlockHours || 3) * 36e5
  const sessions = []
  let current = null

  for (const event of events) {
    if (!current || event.ms - current.lastMs > gapMs) {
      if (current) sessions.push(current)
      current = { startMs: event.ms, lastMs: event.ms, eventCount: 0, sources: {} }
    }
    current.lastMs = event.ms
    current.eventCount++
    current.sources[event.source] = (current.sources[event.source] || 0) + 1
  }
  if (current) sessions.push(current)

  const finalized = sessions.map((session) => {
    const span = Math.max(minBlockMs, session.lastMs - session.startMs)
    const capped = Math.min(span, maxBlockMs)
    return {
      startedAt: new Date(session.startMs).toISOString(),
      endedAt: new Date(session.lastMs).toISOString(),
      eventCount: session.eventCount,
      sources: session.sources,
      hours: hours(capped),
    }
  })
  return {
    eventCount: events.length,
    sessionCount: finalized.length,
    totalHours: round(finalized.reduce((sum, session) => sum + session.hours, 0)),
    sessions: finalized.slice(-20),
    settings: {
      gapMinutes: Number(config.activitySessionGapMinutes || 45),
      minBlockMinutes: Number(config.minimumActivityBlockMinutes || 5),
      maxBlockHours: Number(config.maximumActivityBlockHours || 3),
    },
  }
}

function normalizePathForCompare(value) {
  if (!value) return ''
  return path.resolve(String(value)).replace(/\\/g, '/').toLowerCase()
}

function collectJsonlFiles(rootDir) {
  const results = []
  if (!fs.existsSync(rootDir)) return results
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory()) visit(abs)
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.jsonl')) results.push(abs)
    }
  }
  visit(rootDir)
  return results
}

function parseJsonl(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line) } catch { return null }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

function codexCliSessions(config) {
  const codexHome = path.join(process.env.USERPROFILE || '', '.codex')
  const sessionsRoot = path.join(codexHome, 'sessions')
  const repoKey = normalizePathForCompare(ROOT)
  const files = collectJsonlFiles(sessionsRoot)
  const sessions = []

  for (const filePath of files) {
    const rows = parseJsonl(filePath)
    const meta = rows.find((row) => row.type === 'session_meta')
    const payload = meta?.payload || {}
    if (normalizePathForCompare(payload.cwd) !== repoKey) continue
    const timestamps = rows
      .map((row) => row.timestamp || row.payload?.timestamp)
      .map((value) => new Date(value).getTime())
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b)
    if (!timestamps.length) continue
    sessions.push({
      id: payload.id || path.basename(filePath, '.jsonl'),
      cwd: payload.cwd || '',
      originator: payload.originator || null,
      source: payload.source || null,
      file: path.relative(ROOT, filePath),
      eventCount: timestamps.length,
      firstEventAt: new Date(timestamps[0]).toISOString(),
      lastEventAt: new Date(timestamps.at(-1)).toISOString(),
      timestamps,
    })
  }

  sessions.sort((a, b) => new Date(a.firstEventAt) - new Date(b.firstEventAt))
  return {
    codexHome,
    sessionsRoot,
    filesScanned: files.length,
    sessionCount: sessions.length,
    sessions,
  }
}

function codexCliBlocks(config) {
  const sessionSummary = codexCliSessions(config)
  const events = sessionSummary.sessions
    .flatMap((session) => session.timestamps.map((ms) => ({ ms, sessionId: session.id })))
    .sort((a, b) => a.ms - b.ms)

  const gapMs = Number(config.codexCliSessionGapMinutes || 30) * 60_000
  const minBlockMs = Number(config.minimumActivityBlockMinutes || 5) * 60_000
  const maxBlockMs = Number(config.maximumActivityBlockHours || 3) * 36e5
  const blocks = []
  let current = null

  for (const event of events) {
    if (!current || event.ms - current.lastMs > gapMs) {
      if (current) blocks.push(current)
      current = { startMs: event.ms, lastMs: event.ms, eventCount: 0, sessionIds: new Set() }
    }
    current.lastMs = event.ms
    current.eventCount++
    current.sessionIds.add(event.sessionId)
  }
  if (current) blocks.push(current)

  const finalized = blocks.map((block) => {
    const span = Math.max(minBlockMs, block.lastMs - block.startMs)
    const capped = Math.min(span, maxBlockMs)
    return {
      startedAt: new Date(block.startMs).toISOString(),
      endedAt: new Date(block.lastMs).toISOString(),
      eventCount: block.eventCount,
      sessionCount: block.sessionIds.size,
      hours: hours(capped),
    }
  })

  return {
    available: fs.existsSync(sessionSummary.sessionsRoot),
    codexHome: sessionSummary.codexHome,
    sessionsRoot: sessionSummary.sessionsRoot,
    filesScanned: sessionSummary.filesScanned,
    matchedSessions: sessionSummary.sessionCount,
    eventCount: events.length,
    blockCount: finalized.length,
    totalHours: round(finalized.reduce((sum, block) => sum + block.hours, 0)),
    idleCutoffMinutes: Number(config.codexCliSessionGapMinutes || 30),
    blocks: finalized.slice(-20),
    sessions: sessionSummary.sessions.map((session) => ({
      id: session.id,
      file: session.file,
      eventCount: session.eventCount,
      firstEventAt: session.firstEventAt,
      lastEventAt: session.lastEventAt,
      originator: session.originator,
      source: session.source,
    })).slice(-20),
  }
}

function walkFiles(rootDir, filename) {
  const results = []
  if (!fs.existsSync(rootDir)) return results
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory()) visit(abs)
      else if (entry.isFile() && entry.name === filename) results.push(abs)
    }
  }
  visit(rootDir)
  return results
}

function summarizeAutomatedRuntime() {
  const summaries = walkFiles(path.join(ROOT, 'telemetry'), 'overnight-summary.json')
  const runs = []
  for (const filePath of summaries) {
    const summary = readJson(filePath)
    if (!summary || summary.dryRun || summary.options?.dryRun) continue
    const started = new Date(summary.resumedAt || summary.generatedAt || 0)
    const status = readJson(path.join(path.dirname(filePath), 'overnight-status.json'), {})
    const updated = new Date(status.updatedAt || summary.completedAt || summary.updatedAt || summary.generatedAt || 0)
    if (!Number.isFinite(started.getTime()) || !Number.isFinite(updated.getTime()) || updated <= started) continue
    runs.push({
      path: path.relative(ROOT, path.dirname(filePath)),
      state: status.state || summary.state || 'unknown',
      completedGames: Number(status.completedGames ?? summary.cycles?.filter((cycle) => cycle.analyzed).length ?? 0),
      totalGames: Number(status.totalGames ?? summary.totalGames ?? summary.options?.cycles ?? 0),
      startedAt: started.toISOString(),
      updatedAt: updated.toISOString(),
      hours: hours(updated - started),
    })
  }
  runs.sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt))
  return {
    runCount: runs.length,
    totalHours: round(runs.reduce((sum, run) => sum + run.hours, 0)),
    runs,
  }
}

function summarizeTelemetryDbRuntime() {
  const dbPath = path.join(ROOT, 'psl.db')
  if (!fs.existsSync(dbPath)) {
    return { available: false, dbPath: 'psl.db', matchCount: 0, totalHours: 0, firstMatchAt: null, lastMatchAt: null }
  }
  try {
    const db = new Database(dbPath, { readonly: true })
    const rows = db.prepare(`
      select timestamp, half, elapsed_in_half
      from match_results
      where phase = 'FULL_TIME' or half is not null or elapsed_in_half is not null
    `).all()
    db.close()
    let seconds = 0
    let first = null
    let last = null
    for (const row of rows) {
      const half = Number(row.half || 0)
      const elapsed = Number(row.elapsed_in_half || 0)
      const matchSeconds = half >= 2 ? 300 + elapsed : elapsed
      if (Number.isFinite(matchSeconds) && matchSeconds > 0) seconds += matchSeconds
      const ts = Number(row.timestamp)
      if (Number.isFinite(ts)) {
        if (first === null || ts < first) first = ts
        if (last === null || ts > last) last = ts
      }
    }
    return {
      available: true,
      dbPath: 'psl.db',
      matchCount: rows.length,
      totalHours: round(seconds / 3600),
      firstMatchAt: first ? new Date(first).toISOString() : null,
      lastMatchAt: last ? new Date(last).toISOString() : null,
    }
  } catch (err) {
    return { available: false, dbPath: 'psl.db', error: err.message, matchCount: 0, totalHours: 0, firstMatchAt: null, lastMatchAt: null }
  }
}

export function collectProjectHours() {
  const config = loadConfig()
  const git = summarizeGit(config)
  const manual = summarizeManualWorklog(config)
  const codexCli = codexCliBlocks(config)
  const activity = estimateActivityHours(config, git)
  const automated = summarizeAutomatedRuntime()
  const telemetry = summarizeTelemetryDbRuntime()
  const humanSource = manual.totalHours > 0
    ? 'manual-worklog'
    : (codexCli.totalHours > 0 ? 'codex-cli-session' : 'git-file-activity')
  const humanHours = humanSource === 'manual-worklog'
    ? manual.totalHours
    : (humanSource === 'codex-cli-session' ? codexCli.totalHours : activity.totalHours)
  return {
    generatedAt: isoNow(),
    projectStart: git.firstCommitAt || config.projectStart,
    git,
    manual,
    codexCli,
    activity,
    automated,
    telemetry,
    totals: {
      humanWorkEstimateHours: humanHours,
      humanWorkSource: humanSource,
      manualWorklogHours: manual.totalHours,
      codexCliSessionHours: codexCli.totalHours,
      activityEstimateHours: activity.totalHours,
      automatedNightlyRuntimeHours: automated.totalHours,
      telemetryGameSessionRuntimeHours: telemetry.totalHours,
      machineAssistedProjectHours: round(humanHours + automated.totalHours + telemetry.totalHours),
    },
  }
}

function printHelp() {
  console.log(`Project hours collector

Usage:
  npm run hours
  npm run hours -- --json
  npm run hours:start -- --note "fielding tuning"
  npm run hours:stop -- --note "built and verified"
  npm run hours:status
`)
}

function printText(summary) {
  const open = summary.manual.openSession
  console.log(`Project hours as of ${summary.generatedAt}`)
  console.log(`Human work estimate: ${summary.totals.humanWorkEstimateHours} h`)
  console.log(`Human work source: ${summary.totals.humanWorkSource}`)
  console.log(`Manual worklog hours: ${summary.totals.manualWorklogHours} h`)
  console.log(`Codex CLI session hours: ${summary.totals.codexCliSessionHours} h`)
  console.log(`Activity-estimate hours: ${summary.totals.activityEstimateHours} h`)
  console.log(`Automated nightly runtime: ${summary.totals.automatedNightlyRuntimeHours} h`)
  console.log(`Telemetry game runtime: ${summary.totals.telemetryGameSessionRuntimeHours} h`)
  console.log(`Project start: ${summary.projectStart}`)
  console.log(`Manual session open: ${open ? `${open.at}${open.note ? ` (${open.note})` : ''}` : 'no'}`)
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const config = loadConfig()
  if (options.command === 'help') return printHelp()
  if (options.command === 'start') {
    const open = getOpenManualSession(readWorklog(config))
    if (open) throw new Error(`Manual work session already open since ${open.at}`)
    appendWorklog(config, { type: 'start', at: isoNow(), note: options.note || '' })
    console.log('Started manual work session.')
    return
  }
  if (options.command === 'stop') {
    const open = getOpenManualSession(readWorklog(config))
    if (!open) throw new Error('No manual work session is open.')
    appendWorklog(config, { type: 'stop', at: isoNow(), note: options.note || '' })
    console.log('Stopped manual work session.')
    return
  }
  if (options.command === 'status') {
    const open = getOpenManualSession(readWorklog(config))
    console.log(open ? `Manual work session open since ${open.at}${open.note ? ` (${open.note})` : ''}` : 'No manual work session is open.')
    return
  }
  const summary = collectProjectHours()
  if (options.json) console.log(JSON.stringify(summary, null, 2))
  else printText(summary)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main()
}
