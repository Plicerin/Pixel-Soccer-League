import test from 'node:test'
import assert from 'node:assert/strict'

import { bundleToRuntimeReviewRow, scaledPassTargets, summarizeRuntimeBuckets } from '../src/telemetry/runtimeReview'

test('runtime review scales pass targets by runtime length', () => {
  const targets = scaledPassTargets(10 * 60)
  assert.equal(targets.attemptsMin, 100)
  assert.equal(targets.attemptsMax, 106)
  assert.equal(targets.completedMin, 81)
  assert.equal(targets.completedMax, 84)
})

test('runtime review extracts persisted hold and delivery metrics', () => {
  const row = bundleToRuntimeReviewRow({
    metadata: { runtimeHalfDuration: 300 },
    teamA: { score: 2, shots: 5, shotsOnTarget: 3, passes: 52, passesCompleted: 40 },
    teamB: { score: 1, shots: 7, shotsOnTarget: 4, passes: 54, passesCompleted: 43 },
    ballFlightTelemetry: [
      { realizedHoldSeconds: 0.2 },
      { realizedHoldSeconds: 0.8 },
      { realizedHoldSeconds: null },
    ],
    events: [
      { type: 'PATTERN_CROSS_EXECUTED', team: 'A', __elapsed: 10 },
      { type: 'SHOT', team: 'A', __elapsed: 14 },
      { type: 'GOAL', team: 'A', __elapsed: 15 },
    ],
    fullLengthPossessionDiagnostics: { speculativePassInterceptions: 6 },
  })

  assert.equal(row.totalMatchSeconds, 600)
  assert.equal(row.attemptedPasses, 106)
  assert.equal(row.completedPasses, 83)
  assert.equal(row.holdValues.length, 2)
  assert.equal(row.oneTouchLikeCount, 1)
  assert.equal(row.deliveries, 1)
  assert.equal(row.crosses, 1)
  assert.equal(row.shotProducingDeliveries, 1)
  assert.equal(row.goalProducingDeliveries, 1)
  assert.equal(row.speculativePassInterceptions, 6)
})

test('runtime review summarizes by runtime bucket', () => {
  const summaries = summarizeRuntimeBuckets([
    {
      metadata: { runtimeHalfDuration: 300 },
      teamA: { passes: 50, passesCompleted: 40 },
      teamB: { passes: 52, passesCompleted: 42 },
      ballFlightTelemetry: [{ realizedHoldSeconds: 0.5 }],
      events: [],
    },
    {
      metadata: { runtimeHalfDuration: 300 },
      teamA: { passes: 54, passesCompleted: 41 },
      teamB: { passes: 56, passesCompleted: 43 },
      ballFlightTelemetry: [{ realizedHoldSeconds: 0.7 }, { realizedHoldSeconds: 0.2 }],
      events: [],
    },
    {
      metadata: { runtimeHalfDuration: 2700 },
      teamA: { passes: 470, passesCompleted: 360 },
      teamB: { passes: 472, passesCompleted: 362 },
      ballFlightTelemetry: [{ realizedHoldSeconds: 1.1 }],
      events: [],
      fullLengthPossessionDiagnostics: { speculativePassInterceptions: 8 },
    },
  ])

  assert.equal(summaries.length, 2)
  assert.equal(summaries[0].bucketKey, '5m-halves')
  assert.equal(summaries[0].matchCount, 2)
  assert.equal(summaries[0].avgAttemptedPasses, 106)
  assert.equal(summaries[0].avgCompletedPasses, 83)
  assert.equal(summaries[0].avgHoldSeconds, 0.47)
  assert.equal(summaries[1].bucketKey, '45m-halves')
  assert.equal(summaries[1].avgSpeculativePassInterceptions, 8)
})
