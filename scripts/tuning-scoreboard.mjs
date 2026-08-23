#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_OUT_DIR = path.join('telemetry', 'tuning-scoreboard')
const DEFAULT_HISTORY = path.join(DEFAULT_OUT_DIR, 'history.json')

const METRICS = {
  goals: { tier: 'primary', target: 'range', min: 2, max: 3.5, direction: 'range' },
  shots: { tier: 'primary', target: 'range', min: 22, max: 31, direction: 'range' },
  shotsOnTarget: { tier: 'primary', target: 'range', min: 7, max: 12, direction: 'range' },
  widthWorst: { tier: 'primary', target: 'min', min: 18, freezeMin: 20, direction: 'up' },
  dangerMarkedPct: { tier: 'primary', target: 'min', min: 78, direction: 'up' },
  emptyBoxShotPct: { tier: 'primary', target: 'max', max: 35, direction: 'down' },

  longRangeSot: { tier: 'hard', target: 'max', max: 3, direction: 'down' },
  directBlockerPasses: { tier: 'hard', target: 'max', max: 70, direction: 'down' },
  brokenShotRowsPct: { tier: 'hard', target: 'max', max: 10, direction: 'down' },
  forcedShotSharePct: { tier: 'hard', target: 'max', max: 55, direction: 'down' },

  corners: { tier: 'secondary', target: 'range', min: 5, max: 11, direction: 'range' },
  centerAndNarrowWorst: { tier: 'secondary', target: 'max', max: 35, direction: 'down' },
  shotCorridorDefenders: { tier: 'secondary', target: 'min', min: 1.2, direction: 'up' },
  avgPatternTouches: { tier: 'secondary', target: 'min', min: 2, direction: 'up' },
  realCrosses: { tier: 'secondary', target: 'min', min: 5, max: 28, direction: 'range' },
  zigzagFlips: { tier: 'secondary', target: 'max', max: 90, direction: 'down' },
  attackerBackpasses: { tier: 'secondary', target: 'max', max: 18, direction: 'down' },
}

const RECIPES = {
  chance_creation_up: {
    title: 'Chance Creation Up',
    owns: ['shots', 'shotsOnTarget', 'avgPatternTouches'],
    protects: ['longRangeSot', 'corners', 'zigzagFlips', 'emptyBoxShotPct'],
    expected: {
      shots: 'up',
      shotsOnTarget: 'up',
      avgPatternTouches: 'up',
      longRangeSot: 'flat',
      corners: 'flat',
    },
    trigger: (m) => m.shots < 22 || m.shotsOnTarget < 7 || m.avgPatternTouches < 2,
  },
  box_defense_up: {
    title: 'Box Defense Up',
    owns: ['dangerMarkedPct', 'emptyBoxShotPct', 'shotCorridorDefenders'],
    protects: ['shots', 'shotsOnTarget', 'goals'],
    expected: {
      dangerMarkedPct: 'up',
      emptyBoxShotPct: 'down',
      shotCorridorDefenders: 'up',
    },
    trigger: (m) => m.dangerMarkedPct < 78 || m.emptyBoxShotPct > 35 || m.shotCorridorDefenders < 1.2,
  },
  corner_rate_down: {
    title: 'Corner Rate Down',
    owns: ['corners'],
    protects: ['realCrosses', 'shots', 'shotsOnTarget'],
    expected: {
      corners: 'down',
      realCrosses: 'flat',
      shots: 'flat',
    },
    trigger: (m) => m.corners > 11,
  },
  pattern_touches_up: {
    title: 'Pattern Touches Up',
    owns: ['avgPatternTouches', 'shots', 'centerAndNarrowWorst'],
    protects: ['attackerBackpasses', 'zigzagFlips'],
    expected: {
      avgPatternTouches: 'up',
      shots: 'up',
      centerAndNarrowWorst: 'down',
    },
    trigger: (m) => m.avgPatternTouches < 2,
  },
  zigzag_down: {
    title: 'Zigzag Down',
    owns: ['zigzagFlips'],
    protects: ['shots', 'widthWorst', 'realCrosses'],
    expected: {
      zigzagFlips: 'down',
      shots: 'flat',
      widthWorst: 'flat',
    },
    trigger: (m) => m.zigzagFlips > 90,
  },
}

function parseArgs(argv) {
  const options = {
    report: path.join('telemetry', 'latest-report.json'),
    reportsDir: '',
    outDir: DEFAULT_OUT_DIR,
    history: DEFAULT_HISTORY,
    recipe: 'auto',
    noAppend: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--report') options.report = argv[++i] || ''
    else if (arg === '--reports-dir') options.reportsDir = argv[++i] || ''
    else if (arg === '--out-dir') options.outDir = argv[++i] || ''
    else if (arg === '--history') options.history = argv[++i] || ''
    else if (arg === '--recipe') options.recipe = argv[++i] || 'auto'
    else if (arg === '--no-append') options.noAppend = true
    else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  if (options.recipe !== 'auto' && !RECIPES[options.recipe]) {
    throw new Error(`Unknown recipe: ${options.recipe}`)
  }
  return options
}

function printHelp() {
  console.log(`Tuning scoreboard

Usage:
  npm run tuning:scoreboard
  npm run tuning:scoreboard -- --report telemetry/latest-report.json --recipe chance_creation_up
  npm run tuning:scoreboard -- --reports-dir telemetry/overnight-2026-04-27

Options:
  --report <path>       Single analysis report JSON (default telemetry/latest-report.json)
  --reports-dir <path>  Aggregate all cycle-*-analysis.json reports in a directory
  --recipe <name>       auto or one of: ${Object.keys(RECIPES).join(', ')}
  --no-append           Do not append to history; only write latest scoreboard files
`)
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2))
}

function round(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return 0
  const factor = 10 ** digits
  return Math.round(Number(value) * factor) / factor
}

function avg(values) {
  const nums = values.map(Number).filter(Number.isFinite)
  if (!nums.length) return 0
  return nums.reduce((sum, value) => sum + value, 0) / nums.length
}

function loadReports(options) {
  if (options.reportsDir) {
    const dir = path.resolve(process.cwd(), options.reportsDir)
    const reports = fs.readdirSync(dir)
      .filter((name) => /^cycle-\d+-analysis(?:-from-bundle)?\.json$/u.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((name) => path.join(dir, name))
      .map((filePath) => ({ filePath, report: readJson(filePath) }))
    if (!reports.length) throw new Error(`No cycle analysis reports found in ${dir}`)
    return reports
  }
  const filePath = path.resolve(process.cwd(), options.report)
  if (!fs.existsSync(filePath)) throw new Error(`Report not found: ${filePath}`)
  return [{ filePath, report: readJson(filePath) }]
}

function extractMetrics(report) {
  const base = report.kpis?.baselineFit?.inputs || {}
  const structure = report.kpis?.soccerStructure?.inputs || {}
  const efficiency = report.kpis?.tuningEfficiency?.inputs || {}
  return {
    goals: Number(base.goals ?? 0),
    shots: Number(base.shots ?? 0),
    shotsOnTarget: Number(base.shotsOnTarget ?? 0),
    longRangeSot: Number(base.longRangeSot ?? 0),
    corners: Number(base.corners ?? 0),
    widthWorst: Math.min(Number(structure.widthA ?? 0), Number(structure.widthB ?? 0)),
    centerAndNarrowWorst: Number(structure.centerAndNarrowWorst ?? 0),
    dangerMarkedPct: Number(structure.dangerMarkedPct ?? 0),
    shotCorridorDefenders: Number(structure.shotCorridorDefenders ?? 0),
    emptyBoxShotPct: Number(structure.emptyBoxShotPct ?? 0),
    avgPatternTouches: Number(structure.avgPatternTouches ?? 0),
    realCrosses: Number(structure.realCrosses ?? 0),
    forcedShotSharePct: Number(efficiency.forcedShotSharePct ?? 0),
    attackerBackpasses: Number(efficiency.attackerBackpasses ?? 0),
    zigzagFlips: Number(efficiency.zigzagFlips ?? 0),
    directBlockerPasses: Number(efficiency.directBlockerPasses ?? 0),
    brokenShotRowsPct: Number(efficiency.brokenShotRowsPct ?? 0),
  }
}

function aggregateReports(entries) {
  const metricRows = entries.map((entry) => extractMetrics(entry.report))
  const out = {}
  for (const key of Object.keys(METRICS)) {
    out[key] = round(avg(metricRows.map((row) => row[key])), key === 'shotCorridorDefenders' || key === 'avgPatternTouches' ? 2 : 1)
  }
  return out
}

function metricStatus(key, value) {
  const spec = METRICS[key]
  if (spec.target === 'min') {
    if (value >= spec.min) return 'green'
    if (value >= spec.min * 0.85) return 'watch'
    return 'red'
  }
  if (spec.target === 'max') {
    if (value <= spec.max) return 'green'
    if (value <= spec.max * 1.25) return 'watch'
    return 'red'
  }
  if (spec.target === 'range') {
    if (value >= spec.min && value <= spec.max) return 'green'
    const lowWatch = spec.min * 0.85
    const highWatch = spec.max * 1.25
    if (value >= lowWatch && value <= highWatch) return 'watch'
    return 'red'
  }
  return 'red'
}

function movement(key, previous, current) {
  if (!previous || previous[key] == null) return 'new'
  const delta = current[key] - previous[key]
  const spec = METRICS[key]
  const deadband = Math.max(Math.abs(current[key]) * 0.025, 0.2)
  if (Math.abs(delta) < deadband) return 'flat'
  if (spec.direction === 'up') return delta > 0 ? 'better' : 'worse'
  if (spec.direction === 'down') return delta < 0 ? 'better' : 'worse'
  const prevStatus = metricStatus(key, previous[key])
  const currStatus = metricStatus(key, current[key])
  const rank = { red: 0, watch: 1, green: 2 }
  if (rank[currStatus] > rank[prevStatus]) return 'better'
  if (rank[currStatus] < rank[prevStatus]) return 'worse'
  const specMid = (spec.min + spec.max) / 2
  return Math.abs(current[key] - specMid) < Math.abs(previous[key] - specMid) ? 'better' : 'worse'
}

function classify(metrics, previousMetrics) {
  const rows = {}
  for (const [key, spec] of Object.entries(METRICS)) {
    const status = metricStatus(key, metrics[key])
    rows[key] = {
      key,
      tier: spec.tier,
      value: metrics[key],
      status,
      frozen: status === 'green' && (spec.freezeMin == null || metrics[key] >= spec.freezeMin),
      movement: movement(key, previousMetrics, metrics),
      target: describeTarget(spec),
    }
  }
  return rows
}

function describeTarget(spec) {
  if (spec.target === 'min') return `>= ${spec.min}`
  if (spec.target === 'max') return `<= ${spec.max}`
  return `${spec.min}-${spec.max}`
}

function chooseRecipe(metrics) {
  const candidates = Object.entries(RECIPES)
    .filter(([, recipe]) => recipe.trigger(metrics))
    .map(([key, recipe]) => ({ key, recipe, urgency: recipe.owns.filter((metric) => metricStatus(metric, metrics[metric]) === 'red').length }))
    .sort((a, b) => b.urgency - a.urgency)
  return candidates[0]?.key || 'chance_creation_up'
}

function evaluateRecipe(recipeKey, rows, previousRows) {
  const recipe = RECIPES[recipeKey]
  const owned = recipe.owns.map((key) => rows[key]).filter(Boolean)
  const protectedRows = recipe.protects.map((key) => rows[key]).filter(Boolean)
  const ownedBetter = owned.filter((row) => row.movement === 'better' || row.status === 'green').length
  const protectedRegressions = protectedRows.filter((row) => row.movement === 'worse' && row.status !== 'green')
  const hardFailures = Object.values(rows).filter((row) => row.tier === 'hard' && row.status === 'red')
  const primaryRed = Object.values(rows).filter((row) => row.tier === 'primary' && row.status === 'red')
  const enoughOwnedSignal = previousRows ? ownedBetter >= Math.max(1, Math.ceil(owned.length / 2)) : false

  let decision = 'observe'
  if (hardFailures.length) decision = 'reject'
  else if (protectedRegressions.length > 1) decision = 'reject'
  else if (enoughOwnedSignal && primaryRed.length <= 2) decision = 'accept'
  else if (enoughOwnedSignal) decision = 'hold'

  return {
    recipe: recipeKey,
    title: recipe.title,
    decision,
    owned: owned.map((row) => row.key),
    protected: protectedRows.map((row) => row.key),
    ownedBetter,
    protectedRegressions: protectedRegressions.map((row) => row.key),
    hardFailures: hardFailures.map((row) => row.key),
    primaryRed: primaryRed.map((row) => row.key),
  }
}

function readHistory(historyPath) {
  if (!fs.existsSync(historyPath)) return []
  const value = readJson(historyPath)
  return Array.isArray(value) ? value : []
}

function writeMarkdown(scoreboard, filePath) {
  const rowsByTier = (tier) => Object.values(scoreboard.rows).filter((row) => row.tier === tier)
  const formatRows = (tier) => rowsByTier(tier)
    .map((row) => `- ${row.key}: ${row.value} (${row.status}, ${row.movement}, target ${row.target}${row.frozen ? ', frozen' : ''})`)
    .join('\n') || '- None'
  const lines = [
    '# Tuning Scoreboard',
    '',
    `Generated: ${scoreboard.generatedAt}`,
    `Sample: ${scoreboard.sampleSize} report${scoreboard.sampleSize === 1 ? '' : 's'}`,
    `Recipe: ${scoreboard.recipe.title} (${scoreboard.recipe.recipe})`,
    `Decision: ${scoreboard.recipe.decision}`,
    '',
    '## Hard Guardrails',
    '',
    formatRows('hard'),
    '',
    '## Primary Gameplay KPIs',
    '',
    formatRows('primary'),
    '',
    '## Secondary Realism KPIs',
    '',
    formatRows('secondary'),
    '',
    '## Recipe Gate',
    '',
    `- Owned better/green: ${scoreboard.recipe.ownedBetter}/${scoreboard.recipe.owned.length}`,
    `- Protected regressions: ${scoreboard.recipe.protectedRegressions.length ? scoreboard.recipe.protectedRegressions.join(', ') : 'none'}`,
    `- Hard failures: ${scoreboard.recipe.hardFailures.length ? scoreboard.recipe.hardFailures.join(', ') : 'none'}`,
    `- Primary red: ${scoreboard.recipe.primaryRed.length ? scoreboard.recipe.primaryRed.join(', ') : 'none'}`,
    '',
    '## Next Recipe Candidates',
    '',
    scoreboard.nextRecipes.map((entry) => `- ${entry}`).join('\n') || '- None',
    '',
  ]
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, lines.join('\n'))
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const entries = loadReports(options)
  const metrics = aggregateReports(entries)
  const historyPath = path.resolve(process.cwd(), options.history)
  const history = readHistory(historyPath)
  const previous = history[history.length - 1] || null
  const previousMetrics = previous?.metrics || null
  const rows = classify(metrics, previousMetrics)
  const recipeKey = options.recipe === 'auto' ? chooseRecipe(metrics) : options.recipe
  const recipe = evaluateRecipe(recipeKey, rows, previous ? previous.rows : null)
  const nextRecipes = Object.entries(RECIPES)
    .filter(([, candidate]) => candidate.trigger(metrics))
    .map(([key, candidate]) => `${key}: ${candidate.title}`)

  const scoreboard = {
    generatedAt: new Date().toISOString(),
    source: options.reportsDir ? path.resolve(process.cwd(), options.reportsDir) : path.resolve(process.cwd(), options.report),
    sampleSize: entries.length,
    matchIds: entries.map(({ report }) => report.match?.matchId).filter(Boolean),
    metrics,
    rows,
    recipe,
    nextRecipes,
  }

  const outDir = path.resolve(process.cwd(), options.outDir)
  writeJson(path.join(outDir, 'latest-scoreboard.json'), scoreboard)
  writeMarkdown(scoreboard, path.join(outDir, 'latest-scoreboard.md'))
  if (!options.noAppend) {
    const updatedHistory = [...history, {
      generatedAt: scoreboard.generatedAt,
      source: scoreboard.source,
      sampleSize: scoreboard.sampleSize,
      matchIds: scoreboard.matchIds,
      metrics: scoreboard.metrics,
      rows: scoreboard.rows,
      recipe: scoreboard.recipe,
    }]
    writeJson(historyPath, updatedHistory)
  }

  console.log(`Scoreboard: ${path.join(outDir, 'latest-scoreboard.md')}`)
  console.log(`Decision: ${recipe.decision} | recipe ${recipeKey} | sample ${entries.length}`)
}

main()
