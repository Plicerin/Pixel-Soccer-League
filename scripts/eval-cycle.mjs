#!/usr/bin/env node
// eval-cycle.mjs — Phase E loop helper.
//
// Purpose: run N headless games, aggregate the resulting telemetry, and
// compare averaged metrics to the previous run. Used to evaluate whether
// a code change moved the needle on the metrics we care about (long-range
// SOT, backpasses, pattern-driven goals, H2/H1 flip ratio, etc.).
//
// This does NOT auto-tune anything. The intent is faster signal: make a
// code change, run a cycle, see deltas, decide. No parameter writes.
//
// Usage:
//   npm run eval:cycle -- --games 4 --label "fsm-a2-baseline"
//   npm run eval:cycle -- --games 4 --label "after-h2-fix" --compare-to "fsm-a2-baseline"
//
// Without --label, uses an auto-generated timestamp label.
// Without --compare-to, compares to the most recent prior cycle on disk.
//
// Reports land in telemetry/eval/<label>/cycle-summary.json plus a console
// delta table. Stable cross-cycle comparison requires running the same
// fixtures — pass --fixed-home / --fixed-away or use the same --seed.
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import Database from 'better-sqlite3'

const PROJECT_ROOT = process.cwd()
const EVAL_DIR = path.join(PROJECT_ROOT, 'telemetry', 'eval')
const DB_PATH = path.join(PROJECT_ROOT, 'psl.db')

function parseArgs(argv) {
  const opts = {
    games: 4,
    label: '',
    compareTo: '',
    home: '',
    away: '',
    halfSeconds: 150,
    fsm: '',  // 'on' | 'off' | '' (default: whatever gameEngine inits to)
    url: '',
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--games') opts.games = Number(argv[++i])
    else if (a === '--label') opts.label = argv[++i] || ''
    else if (a === '--compare-to') opts.compareTo = argv[++i] || ''
    else if (a === '--home') opts.home = argv[++i] || ''
    else if (a === '--away') opts.away = argv[++i] || ''
    else if (a === '--half-seconds') opts.halfSeconds = Number(argv[++i])
    else if (a === '--fsm') opts.fsm = (argv[++i] || '').toLowerCase()
    else if (a === '--url') opts.url = argv[++i] || ''
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0) }
  }
  if (!opts.label) {
    opts.label = `cycle-${new Date().toISOString().replace(/[:.]/g, '-')}`
  }
  return opts
}

function printHelp() {
  console.log(`Usage: npm run eval:cycle -- [options]

  --games <n>          games per cycle (default 4)
  --label <name>       cycle label (folder under telemetry/eval/)
  --compare-to <name>  compare against this label (default: most recent)
  --home <team>        fixed home team across all games (optional)
  --away <team>        fixed away team across all games (optional)
  --half-seconds <n>   half duration override (default 150)
  --fsm <on|off>       force FSM positioning mode (default: gameEngine init value)
  --url <url>          override dev server URL (default: http://127.0.0.1:5173/)
`)
}

function runCommand(label, command, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n[${label}] ${command} ${args.join(' ')}`)
    const child = spawn(command, args, { cwd: PROJECT_ROOT, stdio: 'inherit', windowsHide: true, shell: false })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${label} exit ${code}`)))
  })
}

function getMaxMatchId() {
  if (!fs.existsSync(DB_PATH)) return 0
  const db = new Database(DB_PATH)
  try {
    const row = db.prepare('SELECT MAX(id) AS maxId FROM match_results').get()
    return row?.maxId || 0
  } finally { db.close() }
}

function fetchMatchesSince(minId) {
  const db = new Database(DB_PATH)
  try {
    return db.prepare('SELECT * FROM match_results WHERE id > ? ORDER BY id ASC').all(minId)
  } finally { db.close() }
}

function safe(b, dflt) {
  try { return b ?? dflt } catch { return dflt }
}

// Pull the metrics we care about from a single match bundle.
function extractMetrics(row) {
  let bundle = null
  try { bundle = JSON.parse(row.bundle_json) } catch { return null }
  if (!bundle) return null
  if (bundle.sessionActive === false) return null  // ghost match — skip

  const events = bundle.events || []
  const goalLog = bundle.goalLog || []

  const goals = goalLog.length
  const shotsTotal = (row.shots_a || 0) + (row.shots_b || 0)
  const sotTotal = (row.shots_on_target_a || 0) + (row.shots_on_target_b || 0)

  // Long-range SOT: from event stream
  let longRangeSOT = 0
  let backpasses = 0
  for (const ev of events) {
    if (ev.type === 'SHOT' && ev.detail?.onTarget && (ev.detail?.distYards || 0) >= 22) longRangeSOT++
    if (ev.type === 'PASS_DECISION' && ev.detail?.style === 'BACK') backpasses++
  }
  // attacker backpass count actually lives in ATTACKER_RESET_PASS events typically
  if (backpasses === 0) {
    backpasses = events.filter(e => e.type === 'ATTACKER_RESET_PASS').length
  }

  // Pattern deliveries/crosses. Crosses are strict wide-to-box deliveries;
  // deliveries include launched pattern passes that may be cutbacks/recycles.
  const patternCrosses = events.filter(e => e.type === 'PATTERN_CROSS_EXECUTED').length
  const patternDeliveries = events.filter(e => e.type === 'PATTERN_DELIVERY_EXECUTED' || e.type === 'PATTERN_CROSS_EXECUTED').length

  // Pattern→goal share — find PATTERN_GOAL events or correlate with goalLog
  const patternGoalEvents = events.filter(e => e.type === 'PATTERN_GOAL' || (e.type === 'GOAL' && e.detail?.patternType))
  const patternGoals = patternGoalEvents.length

  // Defenders in box at goal — from GOAL events with detail
  const defendersInBoxAtGoal = []
  for (const ev of events) {
    if (ev.type === 'GOAL' && typeof ev.detail?.defendersInBox === 'number') {
      defendersInBoxAtGoal.push(ev.detail.defendersInBox)
    }
  }
  // Fallback: goalLog has defendersInBox property
  if (defendersInBoxAtGoal.length === 0) {
    for (const g of goalLog) {
      if (typeof g.defendersInBox === 'number') defendersInBoxAtGoal.push(g.defendersInBox)
    }
  }
  const avgDefAtGoal = defendersInBoxAtGoal.length
    ? defendersInBoxAtGoal.reduce((a, b) => a + b, 0) / defendersInBoxAtGoal.length
    : null

  // H2/H1 flip ratio — count CARRIER_TRACE-derived flips by half. Cheap version:
  // count PASS events as proxy isn't useful. Use carrier-trace events.
  const traces = events.filter(e => e.type === 'CARRIER_TRACE')
  let h1Flips = 0
  let h2Flips = 0
  let lastSign = 0
  let lastHalf = 0
  let lastCarrier = null
  for (const t of traces) {
    const carrier = t.detail?.carrier
    if (carrier !== lastCarrier) { lastSign = 0; lastCarrier = carrier }
    const z = t.detail?.z
    if (typeof z !== 'number') continue
    // Use raw z delta sign; computed against previous sample of same carrier.
    // The flip-counting in telemetry-analyze-latest does a more refined version;
    // this is a quick proxy for ratio.
    if (lastHalf !== t.half) { lastHalf = t.half; lastSign = 0 }
    // delta sign comparison requires previous z; since we're not tracking that
    // here, fall through. Simpler: count entries per half as proxy for activity.
    if (t.half === 1) h1Flips++
    else if (t.half === 2) h2Flips++
  }
  // The above is *trace count* not *flip count*. Real flip count needs the
  // same logic the analyzer uses. For now record trace counts as proxy.

  // Final-third overloads — count FINAL_THIRD_OVERLOAD events
  const finalThirdOverloads = events.filter(e => e.type === 'FINAL_THIRD_OVERLOAD').length

  return {
    matchId: bundle.matchId || row.session_id,
    teamA: row.team_a_name,
    teamB: row.team_b_name,
    score: `${row.score_a}-${row.score_b}`,
    goals,
    shotsTotal,
    sotTotal,
    longRangeSOT,
    backpasses,
    patternCrosses,
    patternDeliveries,
    patternGoals,
    avgDefAtGoal,
    finalThirdOverloads,
    traceH1: h1Flips,
    traceH2: h2Flips,
  }
}

function aggregate(matchMetrics) {
  const valid = matchMetrics.filter(Boolean)
  if (valid.length === 0) return null
  const avg = (key) => {
    const nums = valid.map(m => m[key]).filter(v => typeof v === 'number')
    if (nums.length === 0) return null
    return nums.reduce((a, b) => a + b, 0) / nums.length
  }
  const sum = (key) => valid.reduce((a, m) => a + (typeof m[key] === 'number' ? m[key] : 0), 0)
  return {
    games: valid.length,
    avgGoals: round(avg('goals')),
    avgShots: round(avg('shotsTotal')),
    avgSOT: round(avg('sotTotal')),
    avgLongRangeSOT: round(avg('longRangeSOT')),
    avgBackpasses: round(avg('backpasses')),
    avgPatternDeliveries: round(avg('patternDeliveries')),
    avgPatternCrosses: round(avg('patternCrosses')),
    avgPatternGoals: round(avg('patternGoals')),
    avgDefAtGoal: round(avg('avgDefAtGoal')),
    avgFinalThirdOverloads: round(avg('finalThirdOverloads')),
    traceH2overH1: (sum('traceH1') > 0 ? round(sum('traceH2') / sum('traceH1')) : null),
    traceH1Total: sum('traceH1'),
    traceH2Total: sum('traceH2'),
  }
}

function round(v) {
  if (v == null) return null
  return Math.round(v * 100) / 100
}

function findCompareCycle(explicitLabel) {
  if (!fs.existsSync(EVAL_DIR)) return null
  const dirs = fs.readdirSync(EVAL_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()
  if (dirs.length === 0) return null
  if (explicitLabel && dirs.includes(explicitLabel)) {
    return path.join(EVAL_DIR, explicitLabel, 'cycle-summary.json')
  }
  // Most recent prior cycle (last in sorted order)
  return path.join(EVAL_DIR, dirs[dirs.length - 1], 'cycle-summary.json')
}

function loadJsonOrNull(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null }
}

function fmt(v) {
  if (v == null) return '   —'
  return v.toFixed(2).padStart(6)
}

function delta(now, prev) {
  if (now == null || prev == null) return '       '
  const d = now - prev
  const sign = d > 0 ? '+' : ''
  return ` (${sign}${d.toFixed(2)})`.padStart(9)
}

function printComparison(current, previousLabel, previous) {
  console.log('\n========================================================')
  console.log(`Cycle eval — ${current.label}  (${current.games} games)`)
  if (previous) console.log(`Compared to — ${previousLabel} (${previous.games} games)`)
  console.log('--------------------------------------------------------')
  const rows = [
    ['avg goals',              current.avgGoals,              previous?.avgGoals],
    ['avg shots',              current.avgShots,              previous?.avgShots],
    ['avg SOT',                current.avgSOT,                previous?.avgSOT],
    ['avg long-range SOT',     current.avgLongRangeSOT,       previous?.avgLongRangeSOT],
    ['avg backpasses',         current.avgBackpasses,         previous?.avgBackpasses],
    ['avg pattern deliveries', current.avgPatternDeliveries,  previous?.avgPatternDeliveries],
    ['avg pattern crosses',    current.avgPatternCrosses,     previous?.avgPatternCrosses],
    ['avg pattern goals',      current.avgPatternGoals,       previous?.avgPatternGoals],
    ['avg defenders @ goal',   current.avgDefAtGoal,          previous?.avgDefAtGoal],
    ['avg final-third overloads', current.avgFinalThirdOverloads, previous?.avgFinalThirdOverloads],
    ['trace H2/H1 ratio',      current.traceH2overH1,         previous?.traceH2overH1],
  ]
  for (const [name, now, prev] of rows) {
    console.log(`  ${name.padEnd(30)} ${fmt(now)}${delta(now, prev)}`)
  }
  console.log('========================================================\n')
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  console.log(`[eval-cycle] ${opts.games} games — label "${opts.label}"`)
  const labelDir = path.join(EVAL_DIR, opts.label)
  fs.mkdirSync(labelDir, { recursive: true })

  const minId = getMaxMatchId()
  console.log(`[eval-cycle] DB max match id pre-run: ${minId}`)

  // Drive headless-sim. FSM mode is forced via the new --query flag, which
  // appends to whichever URL headless-sim ends up using (default 5173 or
  // the auto-spawned 4173 fallback). This avoids breaking the dev-server
  // fallback by passing an explicit --url with query string.
  // Per-game wall-clock budget: gameplay duration (halves × 2) plus 4 min
  // overhead for startup, kickoff, and cleanup.
  const perGameMs = (opts.halfSeconds * 2 + 240) * 1000
  const totalTimeoutMs = perGameMs * opts.games + 60_000
  const simArgs = ['scripts/headless-sim.mjs',
    '--mode', 'tuning',
    '--games', String(opts.games),
    '--speed', '1',
    '--half-seconds', String(opts.halfSeconds),
    '--gpu-headless',
    '--timeout-ms', String(totalTimeoutMs),
  ]
  if (opts.url) simArgs.push('--url', opts.url)
  if (opts.fsm === 'on' || opts.fsm === 'off') {
    simArgs.push('--query', `fsm=${opts.fsm}`)
    console.log(`[eval-cycle] forcing FSM mode = ${opts.fsm} via ?fsm=${opts.fsm}`)
  }
  if (opts.home) simArgs.push('--home', opts.home)
  if (opts.away) simArgs.push('--away', opts.away)
  // Tolerate partial runs: if sim exits non-zero (timeout, crash), still
  // try to aggregate whatever landed in the DB before exit.
  try {
    await runCommand('sim', process.execPath, simArgs)
  } catch (err) {
    console.warn(`[eval-cycle] sim exited with error: ${err.message}. Aggregating partial results.`)
  }

  // Pull the matches that landed during this run.
  const newRows = fetchMatchesSince(minId)
  console.log(`[eval-cycle] new matches in DB: ${newRows.length}`)
  const metrics = newRows.map(extractMetrics).filter(Boolean)
  if (metrics.length === 0) {
    console.error('[eval-cycle] no usable matches in DB after run — aborting')
    process.exit(2)
  }

  const summary = {
    label: opts.label,
    generatedAt: new Date().toISOString(),
    options: opts,
    matches: metrics,
    ...aggregate(metrics),
  }
  fs.writeFileSync(path.join(labelDir, 'cycle-summary.json'), JSON.stringify(summary, null, 2))

  // Comparison
  let previous = null
  let previousLabel = ''
  const comparePath = findCompareCycle(opts.compareTo)
  if (comparePath && !comparePath.includes(opts.label)) {
    previous = loadJsonOrNull(comparePath)
    previousLabel = previous?.label || path.basename(path.dirname(comparePath))
  }
  printComparison(summary, previousLabel, previous)
  console.log(`Saved: ${path.join(labelDir, 'cycle-summary.json')}`)
}

main().catch((err) => { console.error(err); process.exit(1) })
