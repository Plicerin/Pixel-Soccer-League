type TeamStats = {
  score?: number
  shots?: number
  shotsOnTarget?: number
  passes?: number
  passesCompleted?: number
}

type PossessionDiagnostics = {
  speculativePassInterceptions?: number
}

type BundleLike = {
  teamA?: TeamStats
  teamB?: TeamStats
  metadata?: {
    runtimeHalfDuration?: number
  }
  runtimeHalfDuration?: number
  ballFlightTelemetry?: Array<{
    realizedHoldSeconds?: number | null
  }>
  events?: Array<{
    type?: string
    team?: string
    __elapsed?: number
  }>
  fullLengthPossessionDiagnostics?: PossessionDiagnostics
}

export type RuntimeBucketSummary = {
  bucketKey: string
  runtimeHalfSeconds: number
  totalMatchSeconds: number
  matchCount: number
  avgGoals: number
  avgShots: number
  avgShotsOnTarget: number
  avgAttemptedPasses: number
  avgCompletedPasses: number
  avgPassCompletionPct: number
  avgHoldSeconds: number
  medianHoldSeconds: number
  holdSamples: number
  oneTouchLikePct: number
  avgDeliveries: number
  avgCrosses: number
  avgShotProducingDeliveries: number
  avgGoalProducingDeliveries: number
  deliveryShotPct: number
  avgSpeculativePassInterceptions: number
  passTargets: {
    attemptsMin: number
    attemptsMax: number
    completedMin: number
    completedMax: number
  }
}

type MatchReviewRow = {
  runtimeHalfSeconds: number
  totalMatchSeconds: number
  goals: number
  shots: number
  shotsOnTarget: number
  attemptedPasses: number
  completedPasses: number
  completionPct: number
  holdValues: number[]
  oneTouchLikeCount: number
  deliveries: number
  crosses: number
  shotProducingDeliveries: number
  goalProducingDeliveries: number
  speculativePassInterceptions: number
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function average(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export function runtimeBucketKey(runtimeHalfSeconds: number) {
  const halfMinutes = runtimeHalfSeconds / 60
  return `${halfMinutes}m-halves`
}

export function scaledPassTargets(totalMatchSeconds: number) {
  const durationFactor = totalMatchSeconds / (90 * 60)
  return {
    attemptsMin: round(900 * durationFactor, 2),
    attemptsMax: round(954 * durationFactor, 2),
    completedMin: round(729 * durationFactor, 2),
    completedMax: round(756 * durationFactor, 2),
  }
}

function extractRuntimeHalfSeconds(bundle: BundleLike) {
  const raw = Number(bundle?.metadata?.runtimeHalfDuration ?? bundle?.runtimeHalfDuration ?? 0)
  return Number.isFinite(raw) && raw > 0 ? raw : 300
}

function extractDeliveryWindow(events: Array<{ type?: string; team?: string; __elapsed?: number }>) {
  const deliveries = events.filter((event) => event.type === 'PATTERN_DELIVERY_EXECUTED' || event.type === 'PATTERN_CROSS_EXECUTED')
  const shots = events.filter((event) => event.type === 'SHOT')
  const goals = events.filter((event) => event.type === 'GOAL')
  let shotProducing = 0
  let goalProducing = 0
  let crosses = 0
  const windowSeconds = 8
  for (const delivery of deliveries) {
    if (delivery.type === 'PATTERN_CROSS_EXECUTED') crosses += 1
    const start = Number(delivery.__elapsed ?? 0)
    const end = start + windowSeconds
    const shot = shots.find((event) => event.team === delivery.team && Number(event.__elapsed ?? 0) >= start && Number(event.__elapsed ?? 0) <= end)
    const goal = goals.find((event) => event.team === delivery.team && Number(event.__elapsed ?? 0) >= start && Number(event.__elapsed ?? 0) <= end)
    if (shot) shotProducing += 1
    if (goal) goalProducing += 1
  }
  return {
    deliveries: deliveries.length,
    crosses,
    shotProducingDeliveries: shotProducing,
    goalProducingDeliveries: goalProducing,
  }
}

export function bundleToRuntimeReviewRow(bundle: BundleLike): MatchReviewRow {
  const runtimeHalfSeconds = extractRuntimeHalfSeconds(bundle)
  const totalMatchSeconds = runtimeHalfSeconds * 2
  const teamA = bundle.teamA || {}
  const teamB = bundle.teamB || {}
  const attemptedPasses = Number(teamA.passes || 0) + Number(teamB.passes || 0)
  const completedPasses = Number(teamA.passesCompleted || 0) + Number(teamB.passesCompleted || 0)
  const holdValues = Array.isArray(bundle.ballFlightTelemetry)
    ? bundle.ballFlightTelemetry
        .map((flight) => flight?.realizedHoldSeconds)
        .filter((value) => value !== null && value !== undefined)
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value >= 0)
    : []
  const deliveryWindow = extractDeliveryWindow(Array.isArray(bundle.events) ? bundle.events : [])
  return {
    runtimeHalfSeconds,
    totalMatchSeconds,
    goals: Number(teamA.score || 0) + Number(teamB.score || 0),
    shots: Number(teamA.shots || 0) + Number(teamB.shots || 0),
    shotsOnTarget: Number(teamA.shotsOnTarget || 0) + Number(teamB.shotsOnTarget || 0),
    attemptedPasses,
    completedPasses,
    completionPct: attemptedPasses > 0 ? completedPasses / attemptedPasses * 100 : 0,
    holdValues,
    oneTouchLikeCount: holdValues.filter((value) => value <= 0.2).length,
    deliveries: deliveryWindow.deliveries,
    crosses: deliveryWindow.crosses,
    shotProducingDeliveries: deliveryWindow.shotProducingDeliveries,
    goalProducingDeliveries: deliveryWindow.goalProducingDeliveries,
    speculativePassInterceptions: Number(bundle.fullLengthPossessionDiagnostics?.speculativePassInterceptions || 0),
  }
}

export function summarizeRuntimeBuckets(bundles: BundleLike[]) {
  const rows = bundles.map(bundleToRuntimeReviewRow)
  const grouped = new Map<number, MatchReviewRow[]>()
  for (const row of rows) {
    const bucket = grouped.get(row.runtimeHalfSeconds)
    if (bucket) bucket.push(row)
    else grouped.set(row.runtimeHalfSeconds, [row])
  }
  const summaries: RuntimeBucketSummary[] = []
  for (const [runtimeHalfSeconds, bucket] of [...grouped.entries()].sort((a, b) => a[0] - b[0])) {
    const holdValues = bucket.flatMap((row) => row.holdValues)
    const totalDeliveries = bucket.reduce((sum, row) => sum + row.deliveries, 0)
    const totalShotProducingDeliveries = bucket.reduce((sum, row) => sum + row.shotProducingDeliveries, 0)
    const totalGoalProducingDeliveries = bucket.reduce((sum, row) => sum + row.goalProducingDeliveries, 0)
    summaries.push({
      bucketKey: runtimeBucketKey(runtimeHalfSeconds),
      runtimeHalfSeconds,
      totalMatchSeconds: runtimeHalfSeconds * 2,
      matchCount: bucket.length,
      avgGoals: round(average(bucket.map((row) => row.goals))),
      avgShots: round(average(bucket.map((row) => row.shots))),
      avgShotsOnTarget: round(average(bucket.map((row) => row.shotsOnTarget))),
      avgAttemptedPasses: round(average(bucket.map((row) => row.attemptedPasses))),
      avgCompletedPasses: round(average(bucket.map((row) => row.completedPasses))),
      avgPassCompletionPct: round(average(bucket.map((row) => row.completionPct))),
      avgHoldSeconds: round(average(holdValues)),
      medianHoldSeconds: round(median(holdValues)),
      holdSamples: holdValues.length,
      oneTouchLikePct: round(holdValues.length ? bucket.reduce((sum, row) => sum + row.oneTouchLikeCount, 0) / holdValues.length * 100 : 0),
      avgDeliveries: round(average(bucket.map((row) => row.deliveries))),
      avgCrosses: round(average(bucket.map((row) => row.crosses))),
      avgShotProducingDeliveries: round(average(bucket.map((row) => row.shotProducingDeliveries))),
      avgGoalProducingDeliveries: round(average(bucket.map((row) => row.goalProducingDeliveries))),
      deliveryShotPct: round(totalDeliveries ? totalShotProducingDeliveries / totalDeliveries * 100 : 0),
      avgSpeculativePassInterceptions: round(average(bucket.map((row) => row.speculativePassInterceptions))),
      passTargets: scaledPassTargets(runtimeHalfSeconds * 2),
    })
  }
  return summaries
}
