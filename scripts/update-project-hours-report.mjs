#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { collectProjectHours } from './project-hours.mjs'

function formatDate(value) {
  if (!value) return 'n/a'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return String(value)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function renderReport(summary) {
  const runLines = summary.automated.runs.slice(-12).map((run) =>
    `| ${run.path} | ${run.state} | ${run.completedGames}/${run.totalGames} | ${run.hours} | ${formatDate(run.updatedAt)} |`)
  const recentActivity = summary.activity.sessions.slice(-8).map((session) =>
    `| ${formatDate(session.startedAt)} | ${formatDate(session.endedAt)} | ${session.hours} | ${session.eventCount} | ${Object.entries(session.sources).map(([k, v]) => `${k}:${v}`).join(', ')} |`
  )
  const codexBlocks = summary.codexCli.blocks.slice(-10).map((block) =>
    `| ${formatDate(block.startedAt)} | ${formatDate(block.endedAt)} | ${block.hours} | ${block.eventCount} | ${block.sessionCount} |`
  )
  const manualRows = summary.manual.sessions.slice(-8).map((session) =>
    `| ${formatDate(session.startedAt)} | ${formatDate(session.stoppedAt)} | ${session.hours} | ${session.note || ''} |`
  )

  return `# Project Hours Report

Generated: ${formatDate(summary.generatedAt)}

## Summary

| Bucket | Hours | Notes |
| --- | ---: | --- |
| Human work estimate | ${summary.totals.humanWorkEstimateHours} | source=${summary.totals.humanWorkSource} |
| Manual worklog hours | ${summary.totals.manualWorklogHours} | Explicit \`hours:start\` / \`hours:stop\` sessions. |
| Codex CLI session hours | ${summary.totals.codexCliSessionHours} | Codex rollout sessions filtered to this repo. |
| Activity-estimate hours | ${summary.totals.activityEstimateHours} | Estimated from Git and file activity. |
| Automated nightly/headless runtime | ${summary.totals.automatedNightlyRuntimeHours} | Wall-clock runtime from overnight summaries. |
| Telemetry game-session runtime | ${summary.totals.telemetryGameSessionRuntimeHours} | In-game match runtime from \`psl.db\`. |
| Machine-assisted total | ${summary.totals.machineAssistedProjectHours} | Human estimate + automated runtime + telemetry runtime. |

## Project Bounds

- Project start: ${formatDate(summary.projectStart)}
- Git available: ${summary.git.available ? 'yes' : 'no'}
- First commit: ${formatDate(summary.git.firstCommitAt)}
- Last commit: ${formatDate(summary.git.lastCommitAt)}
- Commit count: ${summary.git.commitCount}
- Codex CLI sessions matched: ${summary.codexCli.matchedSessions}
- Telemetry matches counted: ${summary.telemetry.matchCount}
- Telemetry DB available: ${summary.telemetry.available ? 'yes' : 'no'}${summary.telemetry.error ? ` (${summary.telemetry.error})` : ''}

## Manual Worklog

- Worklog path: \`${summary.manual.path}\`
- Entries: ${summary.manual.entries}
- Open session: ${summary.manual.openSession ? `${formatDate(summary.manual.openSession.at)}${summary.manual.openSession.note ? ` (${summary.manual.openSession.note})` : ''}` : 'none'}

| Started | Stopped | Hours | Note |
| --- | --- | ---: | --- |
${manualRows.length ? manualRows.join('\n') : '| n/a | n/a | 0 | No manual sessions recorded yet. |'}

## Codex CLI Sessions

- Sessions root: \`${summary.codexCli.sessionsRoot}\`
- Files scanned: ${summary.codexCli.filesScanned}
- Matched sessions: ${summary.codexCli.matchedSessions}
- Event count: ${summary.codexCli.eventCount}
- Block count: ${summary.codexCli.blockCount}
- Idle cutoff: ${summary.codexCli.idleCutoffMinutes} minutes
- Runtime: ${summary.codexCli.totalHours} h

| Started | Ended | Hours | Events | Sessions |
| --- | --- | ---: | ---: | ---: |
${codexBlocks.length ? codexBlocks.join('\n') : '| n/a | n/a | 0 | 0 | 0 |'}

## Activity Estimate

- Event count: ${summary.activity.eventCount}
- Session count: ${summary.activity.sessionCount}
- Session gap: ${summary.activity.settings.gapMinutes} minutes
- Minimum block: ${summary.activity.settings.minBlockMinutes} minutes
- Maximum block: ${summary.activity.settings.maxBlockHours} hours

| Started | Ended | Hours | Events | Sources |
| --- | --- | ---: | ---: | --- |
${recentActivity.length ? recentActivity.join('\n') : '| n/a | n/a | 0 | 0 | No activity events found. |'}

## Automated Nightly / Headless Runtime

| Run | State | Games | Hours | Updated |
| --- | --- | ---: | ---: | --- |
${runLines.length ? runLines.join('\n') : '| n/a | n/a | 0/0 | 0 | No runs found. |'}

## Telemetry Game-Session Runtime

- Source: \`${summary.telemetry.dbPath}\`
- First match: ${formatDate(summary.telemetry.firstMatchAt)}
- Last match: ${formatDate(summary.telemetry.lastMatchAt)}
- Matches counted: ${summary.telemetry.matchCount}
- Runtime: ${summary.telemetry.totalHours} h

## Notes

Human work estimate precedence is manual worklog, then Codex CLI session blocks, then Git/file activity estimate. Human work and automated runtime are deliberately separate. Do not add them together unless explicitly reporting total machine-assisted project time.
`
}

const summary = collectProjectHours()
const outputPath = path.resolve(process.cwd(), 'docs/project-hours-report.md')
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, renderReport(summary), 'utf8')
console.log(`Updated ${path.relative(process.cwd(), outputPath)}`)
