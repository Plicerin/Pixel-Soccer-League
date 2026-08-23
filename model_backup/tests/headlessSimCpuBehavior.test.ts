import assert from 'node:assert/strict'
import test from 'node:test'

import { createReportPayload, getMatchWaitTimeoutMs, parseArgs } from '../scripts/headless-sim.mjs'
import { summarizeKeeperEvents, summarizeRestartCounts } from '../scripts/telemetry-analyze-latest.mjs'

test('headless sim preserves fixed validation options for repeated CPU runs', () => {
  const options = parseArgs([
    '--games', '3',
    '--home', 'DC United',
    '--away', 'Columbus Crew',
    '--formation-a', '4-3-3',
    '--formation-b', '4-4-2',
    '--half-seconds', '150',
  ])

  assert.equal(options.games, 3)
  assert.equal(options.homeTeam, 'DC United')
  assert.equal(options.awayTeam, 'Columbus Crew')
  assert.equal(options.formationA, '4-3-3')
  assert.equal(options.formationB, '4-4-2')
  assert.equal(options.halfSeconds, 150)
})

test('headless sim report payload keeps completion evidence for repeated matches', () => {
  const payload = createReportPayload(
    { games: 2, speed: 1, halfSeconds: 150 },
    [
      { teamA: 'DC United', teamB: 'Columbus Crew', scoreA: 2, scoreB: 1, sessionId: 'm1' },
      { teamA: 'DC United', teamB: 'Columbus Crew', scoreA: 1, scoreB: 1, sessionId: 'm2' },
    ],
    { status: 'complete', homeTeam: 'DC United', awayTeam: 'Columbus Crew' },
  )

  assert.equal(payload.status, 'complete')
  assert.equal(payload.gamesCompleted, 2)
  assert.equal(payload.options.homeTeam, 'DC United')
  assert.equal(payload.options.awayTeam, 'Columbus Crew')
  assert.equal(payload.results.length, 2)
})

test('headless sim wait budget expands for multi-game validation runs', () => {
  assert.equal(
    getMatchWaitTimeoutMs({ mode: 'smoke', halfSeconds: 150, speed: 32 })
      < getMatchWaitTimeoutMs({ mode: 'tuning', halfSeconds: 150, speed: 1 }),
    true,
  )
})

test('telemetry analyzer summarizes keeper and restart evidence without changing report shape', () => {
  const keeperSummary = summarizeKeeperEvents(
    { teamA: { saves: 3 }, teamB: { saves: 5 } },
    [
      { team: 'A', detail: { style: 'KEEPER_KICK' } },
      { team: 'B', detail: { style: 'GOAL_KICK' } },
      { team: 'B', detail: { style: 'KEEPER_KICK' } },
    ],
  )
  const restartSummary = summarizeRestartCounts(
    [
      { team: 'A', type: 'CORNER' },
      { team: 'B', type: 'THROW_IN' },
      { team: 'B', type: 'GOAL_KICK' },
    ],
    [
      { team: 'A', detail: { style: 'FREE_KICK' } },
    ],
  )

  assert.equal(keeperSummary.totalSaves, 8)
  assert.equal(keeperSummary.byTeam.A.keeperKicks, 1)
  assert.equal(keeperSummary.byTeam.B.goalKicks, 1)
  assert.deepEqual(restartSummary.total, {
    corners: 1,
    throwIns: 1,
    goalKicks: 1,
    freeKicks: 1,
  })
})
