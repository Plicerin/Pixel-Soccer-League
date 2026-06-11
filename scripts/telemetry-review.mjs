import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { summarizeRuntimeBuckets } from '../src/telemetry/runtimeReview.ts'

function parseArgs(argv) {
  const options = {
    limit: 120,
    outJson: 'telemetry/runtime-review.json',
    outMd: 'telemetry/runtime-review.md',
    dbPath: 'psl.db',
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--limit') options.limit = Number(argv[++i] || options.limit)
    else if (arg === '--out-json') options.outJson = argv[++i] || options.outJson
    else if (arg === '--out-md') options.outMd = argv[++i] || options.outMd
    else if (arg === '--db') options.dbPath = argv[++i] || options.dbPath
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`Unknown arg: ${arg}`)
  }
  return options
}

function usage() {
  console.log(`Review persisted post-release telemetry by runtime bucket.

Usage:
  npm run telemetry:review
  npm run telemetry:review -- --limit 200
  npm run telemetry:review -- --db psl.db --out-json telemetry/runtime-review.json --out-md telemetry/runtime-review.md`)
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(path.resolve(process.cwd(), filePath)), { recursive: true })
}

function markdown(report) {
  const lines = [
    '# Runtime Telemetry Review',
    '',
    `Generated: ${report.generatedAt}`,
    `Source DB: ${report.dbPath}`,
    `Matches scanned: ${report.matchesScanned}`,
    '',
    '| Bucket | Matches | Avg passes | Avg completed | Target passes | Target completed | Avg hold | Median hold | One-touch-like | Avg deliveries | Shot-producing deliveries | Delivery->shot % | Avg speculative interceptions |',
    '| --- | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ]
  for (const row of report.buckets) {
    lines.push(`| ${row.bucketKey} | ${row.matchCount} | ${row.avgAttemptedPasses} | ${row.avgCompletedPasses} | ${row.passTargets.attemptsMin}-${row.passTargets.attemptsMax} | ${row.passTargets.completedMin}-${row.passTargets.completedMax} | ${row.avgHoldSeconds}s | ${row.medianHoldSeconds}s | ${row.oneTouchLikePct}% | ${row.avgDeliveries} | ${row.avgShotProducingDeliveries} | ${row.deliveryShotPct}% | ${row.avgSpeculativePassInterceptions} |`)
  }
  return `${lines.join('\n')}\n`
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    usage()
    return
  }
  const db = new Database(path.resolve(process.cwd(), options.dbPath), { readonly: true })
  const rows = db.prepare(`
    SELECT session_id, timestamp, bundle_json
    FROM match_results
    WHERE bundle_json IS NOT NULL AND bundle_json != ''
    ORDER BY timestamp DESC, id DESC
    LIMIT ?
  `).all(options.limit)
  const bundles = rows
    .map((row) => {
      try {
        return JSON.parse(row.bundle_json)
      } catch {
        return null
      }
    })
    .filter(Boolean)
  const report = {
    generatedAt: new Date().toISOString(),
    dbPath: path.resolve(process.cwd(), options.dbPath),
    matchesScanned: bundles.length,
    buckets: summarizeRuntimeBuckets(bundles),
  }
  ensureDir(options.outJson)
  ensureDir(options.outMd)
  fs.writeFileSync(path.resolve(process.cwd(), options.outJson), JSON.stringify(report, null, 2))
  fs.writeFileSync(path.resolve(process.cwd(), options.outMd), markdown(report))

  console.log(`Runtime telemetry review | matches ${report.matchesScanned}`)
  for (const row of report.buckets) {
    console.log(
      `${row.bucketKey} | matches ${row.matchCount} | passes ${row.avgAttemptedPasses} vs ${row.passTargets.attemptsMin}-${row.passTargets.attemptsMax}` +
      ` | completed ${row.avgCompletedPasses} vs ${row.passTargets.completedMin}-${row.passTargets.completedMax}` +
      ` | hold ${row.avgHoldSeconds}s median ${row.medianHoldSeconds}s | deliveries ${row.avgDeliveries} | delivery->shot ${row.deliveryShotPct}%`,
    )
  }
  console.log(`Saved JSON: ${path.resolve(process.cwd(), options.outJson)}`)
  console.log(`Saved Markdown: ${path.resolve(process.cwd(), options.outMd)}`)
}

main()
