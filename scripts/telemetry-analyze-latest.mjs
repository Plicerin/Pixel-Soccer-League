#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { MLS_2025_GLOBAL_AVERAGES, MLS_2025_TEAM_BASELINES } from '../src/telemetry/mls2025-baselines.ts'

const TEAM_ALIASES = new Map([
  ['dc united', 'D.C. United'],
  ['d.c. united', 'D.C. United'],
  ['sporting kc', 'Sporting Kansas City'],
  ['st. louis city sc', 'St. Louis CITY SC'],
  ['st. louis city', 'St. Louis CITY SC'],
  ['montreal', 'CF Montreal'],
])

function parseArgs(argv) {
  const options = {
    sessionId: '',
    homeTeam: '',
    awayTeam: '',
    latest: false,
    reportJson: '',
    reportMd: '',
    bundleJson: '',
    resultIndex: -1,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--session-id') {
      options.sessionId = argv[++i] || ''
    } else if (arg === '--home') {
      options.homeTeam = argv[++i] || ''
    } else if (arg === '--away') {
      options.awayTeam = argv[++i] || ''
    } else if (arg === '--latest') {
      options.latest = true
    } else if (arg === '--report-json') {
      options.reportJson = argv[++i] || ''
    } else if (arg === '--report-md') {
      options.reportMd = argv[++i] || ''
    } else if (arg === '--bundle-json') {
      options.bundleJson = argv[++i] || ''
    } else if (arg === '--result-index') {
      options.resultIndex = Number(argv[++i])
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if ((options.homeTeam && !options.awayTeam) || (!options.homeTeam && options.awayTeam)) {
    throw new Error('Use --home and --away together when filtering by matchup')
  }

  if (!options.latest && !options.sessionId && !options.homeTeam && !options.bundleJson) {
    options.latest = true
  }

  if (!options.reportJson) {
    options.reportJson = 'telemetry/latest-report.json'
  }
  if (!options.reportMd) {
    options.reportMd = 'telemetry/latest-report.md'
  }

  return options
}

function printHelp() {
  console.log(`Analyze the latest saved telemetry package and produce a full report

Usage:
  npm run telemetry:analyze -- --latest
  npm run telemetry:analyze -- --home "Inter Miami" --away "Nashville SC"
  npm run telemetry:analyze -- --session-id ft-123456

Options:
  --latest            Analyze the most recent saved bundle
  --home <team>       Filter by the latest matching fixture
  --away <team>       Filter by the latest matching fixture
  --session-id <id>   Analyze one exact session
  --bundle-json <p>   Analyze a saved headless sim report or raw tuning bundle
  --result-index <n>  Result index inside a headless sim report (default: last)
  --report-json <p>   Write the machine-readable report JSON
  --report-md <p>     Write the human-readable markdown report
`)
}

function normalizeTeamName(name) {
  if (!name) return ''
  const trimmed = name.trim()
  return TEAM_ALIASES.get(trimmed.toLowerCase()) || trimmed
}

function buildTeamBaselineMap() {
  const map = new Map()
  for (const row of MLS_2025_TEAM_BASELINES) {
    map.set(normalizeTeamName(row.team).toLowerCase(), row)
  }
  return map
}

function round(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return 0
  return +Number(value).toFixed(digits)
}

function pct(count, total, digits = 1) {
  if (!total) return 0
  return round((count / total) * 100, digits)
}

function countByType(events, type) {
  return events.filter((event) => event.type === type).length
}

function angleDelta(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  let delta = a - b
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  return delta
}

function getRoleLabel(entry) {
  return (entry?.role || entry?.passerRole || entry?.displayRole || '').toString().toUpperCase()
}

function summarizePasses(passLog, team) {
  const passes = passLog.filter((event) => event.team === team)
  const byRole = {}
  let totalProgress = 0
  let backward = 0
  let forward = 0
  let lateral = 0

  for (const pass of passes) {
    const detail = pass.detail || {}
    const progress = Number(detail.progress ?? 0)
    const direction = detail.passDirection || (progress > 1 ? 'forward' : (progress < -1 ? 'backward' : 'lateral'))
    const role = pass.role || detail.passerRole || '?'
    totalProgress += progress
    byRole[role] ??= { total: 0, backward: 0, forward: 0, lateral: 0 }
    byRole[role].total += 1

    if (direction === 'forward') {
      forward += 1
      byRole[role].forward += 1
    } else if (direction === 'backward') {
      backward += 1
      byRole[role].backward += 1
    } else {
      lateral += 1
      byRole[role].lateral += 1
    }
  }

  const topRoles = Object.fromEntries(
    Object.entries(byRole)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 8),
  )

  return {
    total: passes.length,
    avgProgress: passes.length ? round(totalProgress / passes.length) : 0,
    backwardPct: pct(backward, passes.length),
    forwardPct: pct(forward, passes.length),
    lateralPct: pct(lateral, passes.length),
    topRoles,
  }
}

function summarizeShotSupport(events) {
  const relevant = events.filter((event) => event.type === 'SHOT_POSITION_SNAPSHOT' || event.type === 'SHOT_ON_TARGET_POSITION_SNAPSHOT')
  return relevant.map((event) => {
    const players = Array.isArray(event.detail?.players) ? event.detail.players : []
    const shooter = event.detail?.shooter || {}
    const midfielders = players
      .filter((player) => player.team === shooter.team && player.name !== shooter.name && player.isMidfielder)
      .sort((a, b) => (a.distToShooter ?? 999) - (b.distToShooter ?? 999))
    return {
      type: event.type,
      minute: event.minute,
      shooter: shooter.name || 'Unknown',
      shooterRole: shooter.role || '?',
      nearestMid: midfielders[0] ? round(midfielders[0].distToShooter, 1) : null,
      secondMid: midfielders[1] ? round(midfielders[1].distToShooter, 1) : null,
    }
  })
}

function summarizePassDecisions(passDecisions) {
  const attackerBackpasses = passDecisions.filter((decision) => {
    const role = getRoleLabel({ role: decision.passerRole })
    return ['ST', 'CF', 'CAM', 'LM', 'RM'].includes(role)
      && decision.passStyle === 'BACK'
      && decision.inFinalThird
  })
  const attackerBoxBackpasses = attackerBackpasses.filter((decision) => decision.insidePenaltyArea)
  const directBlockers = passDecisions.filter((decision) => decision.passDirectBlocker)
  const vetoCounts = {}

  for (const decision of passDecisions) {
    const reason = decision.holdReason || 'none'
    vetoCounts[reason] = (vetoCounts[reason] || 0) + 1
  }

  return {
    total: passDecisions.length,
    attackerBackpassesInFinalThird: attackerBackpasses.length,
    attackerBackpassesInBox: attackerBoxBackpasses.length,
    directBlockerPassDecisions: directBlockers.length,
    topHoldReasons: Object.fromEntries(
      Object.entries(vetoCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8),
    ),
    recentAttackerBackpasses: attackerBackpasses.slice(-12),
  }
}

function summarizeCarrierMovement(events) {
  const carrierTraces = events.filter((event) => event.type === 'CARRIER_TRACE')
  const attackerZoneTraces = events.filter((event) => event.type === 'ATTACKER_ZONE_TRACE')
  const byCarrier = new Map()

  carrierTraces.forEach((event, index) => {
    const detail = event.detail || {}
    const carrier = detail.carrier || 'Unknown'
    const team = event.team || detail.team || '?'
    const key = `${team}:${carrier}`
    if (!byCarrier.has(key)) {
      byCarrier.set(key, {
        carrier,
        team,
        role: event.role || detail.role || '?',
        traces: [],
      })
    }
    byCarrier.get(key).traces.push({
      index,
      minute: event.minute ?? 0,
      detail,
    })
  })

  let totalLateralFlips = 0
  let totalForwardCarrySamples = 0
  let totalSwitchRequests = 0
  let totalBlockedSwitches = 0
  let totalCarryLockSamples = 0
  let totalFacingMovementMismatch = 0
  let totalDesiredSteerMismatch = 0
  let totalFacingSamples = 0
  let totalDesiredSamples = 0
  let totalForwardProgressAtFlip = 0
  const offenders = []

  for (const group of byCarrier.values()) {
    let prevLateralSign = 0
    let lateralFlips = 0
    let forwardSamples = 0
    let switchRequests = 0
    let blockedSwitches = 0
    let carryLockSamples = 0
    let facingMovementMismatch = 0
    let desiredSteerMismatch = 0
    let facingSamples = 0
    let desiredSamples = 0
    let forwardProgressAtFlip = 0
    let prevDistToGoal = null

    for (const trace of group.traces) {
      const detail = trace.detail || {}
      const movementDirX = Number(detail.movementDirX)
      const movementDirZ = Number(detail.movementDirZ)
      const wantsFlip = !!detail.wantsLateralFlip
      const blockedFlip = wantsFlip && !!detail.steerSwitchLockActive
      const carryLocked = !!detail.carrySwitchLockActive
      const facingDelta = angleDelta(Number(detail.facingHeading), Number(detail.currentHeading))
      const desiredDelta = angleDelta(Number(detail.desiredHeading), Number(detail.steerHeading))

      if (wantsFlip) switchRequests += 1
      if (blockedFlip) blockedSwitches += 1
      if (carryLocked) carryLockSamples += 1

      if (Number.isFinite(facingDelta) && Number(detail.speed ?? 0) > 0.25) {
        facingSamples += 1
        if (Math.abs(facingDelta) > 0.45) facingMovementMismatch += 1
      }

      if (Number.isFinite(desiredDelta)) {
        desiredSamples += 1
        if (Math.abs(desiredDelta) > 0.55) desiredSteerMismatch += 1
      }

      if (Number.isFinite(movementDirX) && Number.isFinite(movementDirZ) && Math.abs(movementDirX) > 0.35 && Math.abs(movementDirZ) > 0.18) {
        forwardSamples += 1
        const lateralSign = Math.sign(movementDirZ)
        if (prevLateralSign !== 0 && lateralSign !== 0 && lateralSign !== prevLateralSign) {
          lateralFlips += 1
          const distToGoal = Number(detail.distToGoal)
          if (Number.isFinite(distToGoal) && Number.isFinite(prevDistToGoal)) {
            forwardProgressAtFlip += Math.max(0, prevDistToGoal - distToGoal)
          }
        }
        prevLateralSign = lateralSign
      }
      const distToGoal = Number(detail.distToGoal)
      prevDistToGoal = Number.isFinite(distToGoal) ? distToGoal : prevDistToGoal
    }

    totalLateralFlips += lateralFlips
    totalForwardCarrySamples += forwardSamples
    totalSwitchRequests += switchRequests
    totalBlockedSwitches += blockedSwitches
    totalCarryLockSamples += carryLockSamples
    totalFacingMovementMismatch += facingMovementMismatch
    totalDesiredSteerMismatch += desiredSteerMismatch
    totalFacingSamples += facingSamples
    totalDesiredSamples += desiredSamples
    totalForwardProgressAtFlip += forwardProgressAtFlip

    offenders.push({
      carrier: group.carrier,
      team: group.team,
      role: group.role,
      traces: group.traces.length,
      forwardCarrySamples: forwardSamples,
      lateralFlips,
      lateralFlipRate: forwardSamples > 1 ? round(lateralFlips / Math.max(forwardSamples - 1, 1), 2) : 0,
      switchRequests,
      blockedSwitches,
      carryLockSamples,
      avgForwardProgressPerFlip: lateralFlips > 0 ? round(forwardProgressAtFlip / lateralFlips, 2) : 0,
      facingMovementMismatchPct: facingSamples > 0 ? pct(facingMovementMismatch, facingSamples) : 0,
      desiredSteerMismatchPct: desiredSamples > 0 ? pct(desiredSteerMismatch, desiredSamples) : 0,
    })
  }

  offenders.sort((a, b) =>
    (b.lateralFlips - a.lateralFlips)
    || (b.switchRequests - a.switchRequests)
    || (b.facingMovementMismatchPct - a.facingMovementMismatchPct)
    || (b.traces - a.traces)
  )

  return {
    carrierTraceCount: carrierTraces.length,
    attackerZoneTraceCount: attackerZoneTraces.length,
    carriersTracked: byCarrier.size,
    totalForwardCarrySamples,
    totalLateralFlips,
    totalSwitchRequests,
    totalBlockedSwitches,
    totalCarryLockSamples,
    avgForwardProgressPerFlip: totalLateralFlips > 0 ? round(totalForwardProgressAtFlip / totalLateralFlips, 2) : 0,
    facingMovementMismatchPct: totalFacingSamples > 0 ? pct(totalFacingMovementMismatch, totalFacingSamples) : 0,
    desiredSteerMismatchPct: totalDesiredSamples > 0 ? pct(totalDesiredSteerMismatch, totalDesiredSamples) : 0,
    topZigzagOffenders: offenders.slice(0, 8),
  }
}

function summarizeAttackerBoxBehavior(events) {
  const traces = events.filter((event) => event.type === 'ATTACKER_ZONE_TRACE')
  const boxTraces = traces.filter((event) => String(event.detail?.zone || '').startsWith('BOX_'))
  const byPlayer = new Map()

  for (const event of boxTraces) {
    const detail = event.detail || {}
    const player = detail.playerName || 'Unknown'
    const team = event.team || '?'
    const key = `${team}:${player}`
    if (!byPlayer.has(key)) {
      byPlayer.set(key, {
        player,
        team,
        role: event.role || detail.role || '?',
        traces: 0,
        maxBoxDwellSeconds: 0,
        maxBoxIdleSeconds: 0,
        maxBoxCampSeconds: 0,
        crowdedSamples: 0,
      })
    }
    const row = byPlayer.get(key)
    row.traces += 1
    row.maxBoxDwellSeconds = Math.max(row.maxBoxDwellSeconds, Number(detail.boxDwellSeconds) || 0)
    row.maxBoxIdleSeconds = Math.max(row.maxBoxIdleSeconds, Number(detail.boxIdleSeconds) || 0)
    row.maxBoxCampSeconds = Math.max(row.maxBoxCampSeconds, Number(detail.boxCampSeconds) || 0)
    if (detail.boxCrowded) row.crowdedSamples += 1
  }

  const offenders = [...byPlayer.values()]
    .sort((a, b) =>
      (b.maxBoxCampSeconds - a.maxBoxCampSeconds)
      || (b.maxBoxIdleSeconds - a.maxBoxIdleSeconds)
      || (b.maxBoxDwellSeconds - a.maxBoxDwellSeconds)
      || (b.crowdedSamples - a.crowdedSamples)
      || (b.traces - a.traces)
    )
    .slice(0, 8)
    .map((row) => ({
      ...row,
      crowdedPct: row.traces > 0 ? pct(row.crowdedSamples, row.traces) : 0,
      maxBoxDwellSeconds: round(row.maxBoxDwellSeconds, 2),
      maxBoxIdleSeconds: round(row.maxBoxIdleSeconds, 2),
      maxBoxCampSeconds: round(row.maxBoxCampSeconds, 2),
    }))

  return {
    totalBoxTraces: boxTraces.length,
    playersTracked: byPlayer.size,
    topBoxLoiterers: offenders,
  }
}

function isForcedShotDecision(decision) {
  const reason = String(decision.resolutionReason || decision.reason || '').toUpperCase()
  const selectionType = String(decision.shotSelectionType || '')
  return !!(
    decision.forceShotNow
    || decision.atGoalLineForce
    || decision.desperationShot
    || selectionType === 'forced_shot'
    || selectionType.includes('forced')
    || reason.includes('FORCED_SHOT')
    || reason.includes('NO_OUTLET_SHOT')
    || reason.includes('NO_SHOT_')
  )
}

function summarizeShotDecisions(shotDecisions) {
  const forcedShots = shotDecisions.filter(isForcedShotDecision)
  const selectedShots = shotDecisions.filter((decision) =>
    decision.shouldShoot
    && !forcedShots.includes(decision),
  )
  const aiSimpleDecisions = shotDecisions.filter((decision) => decision.decisionType === 'AI_SIMPLE')
  const aiSimpleBrokenRows = aiSimpleDecisions.filter((decision) => {
    const shotChance = decision.shotChance
    const passChance = decision.passChance
    const shotThreshold = decision.shotThreshold ?? decision.threshold
    const zeroed =
      Number(shotChance) === 0
      && Number(passChance) === 0
      && Number(shotThreshold) === 0
    const nullish =
      shotChance == null
      || passChance == null
      || shotThreshold == null
    return zeroed || nullish
  })
  const forcedAiSimpleBrokenRows = aiSimpleBrokenRows.filter((decision) =>
    isForcedShotDecision(decision),
  )
  const longRange = shotDecisions.filter((decision) => Number(decision.distToGoalYards ?? 0) >= 24)
  const pressuredLongRange = longRange.filter((decision) => Number(decision.closePressure ?? 0) >= 2)

  return {
    total: shotDecisions.length,
    forcedShots: forcedShots.length,
    selectedShots: selectedShots.length,
    desperationShots: shotDecisions.filter((decision) => decision.desperationShot).length,
    goalLineForces: shotDecisions.filter((decision) => decision.atGoalLineForce).length,
    longRangeDecisions: longRange.length,
    pressuredLongRangeDecisions: pressuredLongRange.length,
    aiSimpleDecisions: aiSimpleDecisions.length,
    aiSimpleBrokenRows: aiSimpleBrokenRows.length,
    forcedAiSimpleBrokenRows: forcedAiSimpleBrokenRows.length,
    aiSimpleBrokenPct: aiSimpleDecisions.length > 0 ? round((aiSimpleBrokenRows.length / aiSimpleDecisions.length) * 100, 1) : 0,
    recentForcedShots: forcedShots.slice(-10).map((decision) => ({
      minute: round(decision.elapsedInHalf ?? 0, 1),
      team: decision.team,
      shooter: decision.shooter,
      role: decision.role,
      distYards: round(decision.distToGoalYards ?? 0, 1),
      pressure: decision.closePressure ?? 0,
      style: decision.style || 'AUTO',
    })),
  }
}

// ── Phase 0 instrumentation: phase time %, pass-by-zone, role positions ───────────────

function phaseFromCarrierDetail(detail) {
  if (!detail) return 'UNKNOWN'
  const insidePenaltyArea = !!detail.insidePenaltyArea
  const byline = !!detail.byline
  const distToGoal = Number(detail.distToGoal ?? NaN)
  if (insidePenaltyArea || byline) return 'FINISH'
  if (!Number.isFinite(distToGoal)) return 'UNKNOWN'
  if (distToGoal <= 22) return 'CHANCE_CREATION'
  if (distToGoal <= 44) return 'PROGRESSION'
  return 'BUILDUP'
}

function summarizePhaseTime(events) {
  const carrierTraces = events.filter((event) => event.type === 'CARRIER_TRACE')
  const byTeam = {
    A: { BUILDUP: 0, PROGRESSION: 0, CHANCE_CREATION: 0, FINISH: 0, UNKNOWN: 0, total: 0 },
    B: { BUILDUP: 0, PROGRESSION: 0, CHANCE_CREATION: 0, FINISH: 0, UNKNOWN: 0, total: 0 },
  }
  for (const event of carrierTraces) {
    const team = event.team
    if (!byTeam[team]) continue
    const phase = phaseFromCarrierDetail(event.detail || {})
    byTeam[team][phase] = (byTeam[team][phase] || 0) + 1
    byTeam[team].total++
  }
  const result = {}
  for (const team of ['A', 'B']) {
    const b = byTeam[team]
    result[team] = {
      samples: b.total,
      buildupPct: pct(b.BUILDUP, b.total),
      progressionPct: pct(b.PROGRESSION, b.total),
      chanceCreationPct: pct(b.CHANCE_CREATION, b.total),
      finishPct: pct(b.FINISH, b.total),
    }
  }
  return result
}

function summarizePassByZone(passDecisions) {
  const evaluated = {}
  const executed = {}
  for (const decision of passDecisions) {
    const zone = decision.carrierZone || 'UNKNOWN'
    evaluated[zone] = (evaluated[zone] || 0) + 1
    if (decision.shouldPass) executed[zone] = (executed[zone] || 0) + 1
  }
  return { evaluated, executed }
}

// ── Phase 2.5 pattern engine telemetry ────────────────────────────────

function summarizePatterns(events) {
  const starts = events.filter((event) => event.type === 'PATTERN_START')
  const ends = events.filter((event) => event.type === 'PATTERN_END')
  const shots = events.filter((event) => event.type === 'SHOT')
  const goals = events.filter((event) => event.type === 'GOAL')

  const byTypePerTeam = { A: {}, B: {} }
  const durationsByType = {}
  const endReasonCounts = {}
  const patternIntervals = { A: [], B: [] }

  for (const start of starts) {
    const team = start.team
    const detail = start.detail || {}
    const type = detail.type || 'UNKNOWN'
    if (!byTypePerTeam[team]) continue
    byTypePerTeam[team][type] = (byTypePerTeam[team][type] || 0) + 1
  }
  for (const endEvt of ends) {
    const detail = endEvt.detail || {}
    const type = detail.type || 'UNKNOWN'
    const duration = Number(detail.duration ?? 0)
    const reason = detail.reason || 'unknown'
    if (!durationsByType[type]) durationsByType[type] = []
    durationsByType[type].push(duration)
    endReasonCounts[reason] = (endReasonCounts[reason] || 0) + 1
  }

  // Build pattern timeline per team: each interval { type, team, startElapsed, endElapsed }
  const startsByTeam = { A: [], B: [] }
  const endsByTeam = { A: [], B: [] }
  for (const evt of starts) if (startsByTeam[evt.team]) startsByTeam[evt.team].push(evt)
  for (const evt of ends) if (endsByTeam[evt.team]) endsByTeam[evt.team].push(evt)
  for (const team of ['A', 'B']) {
    const ss = startsByTeam[team]
    const es = endsByTeam[team]
    for (let i = 0; i < ss.length; i++) {
      const s = ss[i]
      const sElapsed = getEventElapsed(s)
      // Match: first end AFTER this start that hasn't been used.
      let eElapsed = null
      for (let j = 0; j < es.length; j++) {
        if (es[j]._used) continue
        const eSide = es[j]
        const sidesMatch = true
        const eTime = getEventElapsed(eSide)
        if (sidesMatch && eTime >= sElapsed) {
          eElapsed = eTime
          es[j]._used = true
          break
        }
      }
      patternIntervals[team].push({
        type: s.detail?.type || 'UNKNOWN',
        startElapsed: sElapsed,
        endElapsed: eElapsed,
        initiator: s.detail?.initiator || null,
      })
    }
  }

  // Shot → active pattern correlation. Goals sourced ONLY from GOAL events (authoritative).
  const shotsByActivePattern = {}
  const goalsByActivePattern = {}
  for (const shot of shots) {
    const team = shot.team
    const elapsed = getEventElapsed(shot)
    if (!patternIntervals[team]) continue
    const active = patternIntervals[team].find((iv) => iv.startElapsed <= elapsed && (iv.endElapsed === null || iv.endElapsed >= elapsed))
    const key = active ? active.type : 'NONE'
    shotsByActivePattern[key] = (shotsByActivePattern[key] || 0) + 1
  }
  for (const goal of goals) {
    const team = goal.team
    if (!team) continue
    const elapsed = getEventElapsed(goal)
    if (!patternIntervals[team]) continue
    const active = patternIntervals[team].find((iv) => iv.startElapsed <= elapsed && (iv.endElapsed === null || iv.endElapsed >= elapsed))
    const key = active ? active.type : 'NONE'
    goalsByActivePattern[key] = (goalsByActivePattern[key] || 0) + 1
  }

  const avgDurationByType = {}
  for (const [type, arr] of Object.entries(durationsByType)) {
    if (!arr.length) continue
    avgDurationByType[type] = round(arr.reduce((a, b) => a + b, 0) / arr.length)
  }

  const totalStarts = starts.length
  const distinctTypesA = Object.keys(byTypePerTeam.A).length
  const distinctTypesB = Object.keys(byTypePerTeam.B).length

  return {
    totalStarts,
    totalEnds: ends.length,
    typesPerTeam: byTypePerTeam,
    distinctTypesA,
    distinctTypesB,
    avgDurationByType,
    endReasonCounts,
    shotsByActivePattern,
    goalsByActivePattern,
    patternsPerTeamA: Object.values(byTypePerTeam.A).reduce((a, b) => a + b, 0),
    patternsPerTeamB: Object.values(byTypePerTeam.B).reduce((a, b) => a + b, 0),
  }
}

// ── Phase 2.5: pattern role position alignment + B-line carrier detection ───────

function summaryPatternRoleAlignment(events) {
  // Verify that players in a given pattern role actually reach expected positions.
  // E.g. NEAR_POST_RUNNER should be within ~10 units of opposing goalpost on avg.
  const traces = events.filter((event) => event.type === 'ATTACKER_ZONE_TRACE')
  const byRole = {}
  for (const event of traces) {
    const patternRole = event.detail?.patternRole
    if (!patternRole || patternRole === 'NONE') continue
    const team = event.team
    const attackSign = team === 'A' ? 1 : -1
    if (!byRole[patternRole]) byRole[patternRole] = { samples: 0, sumForwardX: 0, sumAbsZ: 0, sumDistToGoal: 0 }
    byRole[patternRole].samples++
    byRole[patternRole].sumForwardX += Number(event.detail?.x ?? 0) * attackSign
    byRole[patternRole].sumAbsZ += Math.abs(Number(event.detail?.z ?? 0))
    byRole[patternRole].sumDistToGoal += Number(event.detail?.distToGoal ?? 0)
  }
  const result = {}
  for (const [role, v] of Object.entries(byRole)) {
    if (v.samples < 3) continue
    result[role] = {
      samples: v.samples,
      avgForwardX: round(v.sumForwardX / v.samples),
      avgAbsZ: round(v.sumAbsZ / v.samples),
      avgDistToGoal: round(v.sumDistToGoal / v.samples),
    }
  }
  return result
}

function summaryCarrierTrajectories(events) {
  // Group CARRIER_TRACE by carrier name + possession "segment".
  // A new segment starts when gap between consecutive samples > 2s OR carrier name changes.
  // For each segment >= 2 samples, compute B-line ratio = (direct distance) / (path length).
  // 1.0 = perfectly straight line. <0.7 = curved.
  const traces = events.filter((event) => event.type === 'CARRIER_TRACE')
  // Sort by half then t
  traces.sort((a, b) => {
    if (a.half !== b.half) return a.half - b.half
    return (Number(a.t) || 0) - (Number(b.t) || 0)
  })
  const segments = []
  let current = null
  for (const event of traces) {
    const carrier = event.detail?.carrier || 'Unknown'
    const team = event.team
    const elapsed = getEventElapsed(event)
    const segmentId = Number(event.detail?.segmentId ?? NaN)
    const x = Number(event.detail?.x ?? 0)
    const z = Number(event.detail?.z ?? 0)
    const tagged = Number.isFinite(segmentId)
    const startNewSegment = tagged
      ? !current || current.segmentId !== segmentId || current.team !== team
      : !current || current.carrier !== carrier || (elapsed - current.lastElapsed) > 2
    if (startNewSegment) {
      if (current && current.samples.length >= 2) segments.push(current)
      current = {
        carrier, team, segmentId: Number.isFinite(segmentId) ? segmentId : null,
        firstElapsed: elapsed,
        lastElapsed: elapsed,
        samples: [{ x, z, elapsed }],
        pathLength: 0,
      }
    } else {
      const prev = current.samples[current.samples.length - 1]
      const dx = x - prev.x
      const dz = z - prev.z
      current.pathLength += Math.hypot(dx, dz)
      current.samples.push({ x, z, elapsed })
      current.lastElapsed = elapsed
    }
  }
  if (current && current.samples.length >= 2) segments.push(current)

  const byLineRunSegments = []
  let totalSegments = 0
  let totalBLine = 0
  let curlingSegments = 0
  let straightRunsOver15Units = 0
  for (const seg of segments) {
    totalSegments++
    const first = seg.samples[0]
    const last = seg.samples[seg.samples.length - 1]
    const directDist = Math.hypot(last.x - first.x, last.z - first.z)
    const bLineRatio = seg.pathLength > 0.001 ? directDist / seg.pathLength : 0
    if (bLineRatio > 0.85 && directDist > 15) {
      straightRunsOver15Units++
      byLineRunSegments.push({
        carrier: seg.carrier,
        team: seg.team,
        duration: +(seg.lastElapsed - seg.firstElapsed).toFixed(2),
        directDist: +directDist.toFixed(1),
        pathLength: +seg.pathLength.toFixed(1),
        bLineRatio: +bLineRatio.toFixed(2),
      })
    }
    if (directDist > 5) {
      totalBLine += bLineRatio
    }
    if (bLineRatio < 0.7 && directDist > 5) curlingSegments++
  }
  const avgBLineRatio = totalSegments > 0 ? round(totalBLine / totalSegments) : 0

  // Zigzag: count lateral sign flips per carrier segment (reusing existing carrier movement logic but per-segment).
  // Also split flips three ways:
  //   - by team (A vs B totals)
  //   - by team per half (A-H1, A-H2, B-H1, B-H2) — accounts for the side switch
  //   - by direction of travel (left-to-right vs right-to-left, independent of team)
  let totalFlips = 0
  let totalFlippyCarriers = 0
  const flipsByTeam = { A: 0, B: 0 }
  const flipsByTeamHalf = { A1: 0, A2: 0, B1: 0, B2: 0 }
  const flipsByDirection = { L2R: 0, R2L: 0 }
  const segmentsByTeam = { A: 0, B: 0 }
  const segmentsByDirection = { L2R: 0, R2L: 0 }
  const segmentsByTeamHalf = { A1: 0, A2: 0, B1: 0, B2: 0 }
  for (const seg of segments) {
    let lastLateralSign = 0
    let flips = 0
    for (let i = 1; i < seg.samples.length; i++) {
      const dz = seg.samples[i].z - seg.samples[i - 1].z
      const currentSign = dz > 0.1 ? 1 : dz < -0.1 ? -1 : 0
      if (currentSign !== 0 && lastLateralSign !== 0 && currentSign !== lastLateralSign) {
        flips++
      }
      if (currentSign !== 0) lastLateralSign = currentSign
    }
    totalFlips += flips
    if (flips >= 4) totalFlippyCarriers++
    if (seg.team === 'A' || seg.team === 'B') {
      flipsByTeam[seg.team] += flips
      segmentsByTeam[seg.team] += 1
      const half = seg.firstElapsed >= 150 ? 2 : 1
      flipsByTeamHalf[`${seg.team}${half}`] += flips
      segmentsByTeamHalf[`${seg.team}${half}`] += 1
    }
    const first = seg.samples[0]
    const last = seg.samples[seg.samples.length - 1]
    const dx = last.x - first.x
    if (Math.abs(dx) > 1) {
      const key = dx > 0 ? 'L2R' : 'R2L'
      flipsByDirection[key] += flips
      segmentsByDirection[key] += 1
    }
  }

  return {
    totalSegments,
    avgBLineRatio,
    straightRunsOver15Units,
    byLineRunSegments: byLineRunSegments.sort((a, b) => b.directDist - a.directDist).slice(0, 8),
    curlingSegments,
    totalFlips,
    totalFlippyCarriers,
    flipsByTeam,
    flipsByTeamHalf,
    flipsByDirection,
    segmentsByTeam,
    segmentsByDirection,
    segmentsByTeamHalf,
  }
}

// User-requested metric: defenders in the penalty area when goals are scored.
// Uses goalLog[].defendersInBox + attackersInBox (already captured per goal).
// A realistic finishing mix has defenders varying — wide open tap-ins (0-1
// defenders) vs scrambled scrimmage goals (3+ defenders). All-0 = defense
// model collapsed; all-4+ = unrealistic super-deep defense.
function summarizeDefendersInBoxAtGoal(bundle) {
  const gl = Array.isArray(bundle?.goalLog) ? bundle.goalLog : []
  if (gl.length === 0) {
    return { goalCount: 0, avgDefendersInBox: 0, avgAttackersInBox: 0, distribution: {}, samples: [] }
  }
  let sumDef = 0, sumAtk = 0
  const distribution = {}
  const samples = []
  for (const g of gl) {
    const def = Number(g.defendersInBox ?? 0)
    const atk = Number(g.attackersInBox ?? 0)
    sumDef += def
    sumAtk += atk
    distribution[def] = (distribution[def] || 0) + 1
    samples.push({
      team: g.team, scorer: g.playerName, shirt: g.shirtNumber, minute: g.matchMinute,
      defendersInBox: def, attackersInBox: atk,
      outfieldBoxCrowd: g.outfieldBoxCrowd ?? (def + atk),
      playPattern: g.playPattern, isBreakaway: !!g.isBreakaway,
    })
  }
  return {
    goalCount: gl.length,
    avgDefendersInBox: round(sumDef / gl.length),
    avgAttackersInBox: round(sumAtk / gl.length),
    distribution,
    samples,
  }
}

function summarizeShotBoxDefense(events, bundle = null) {
  const FIELD_W = 65.6
  const PENALTY_DEPTH = 9.6
  const GOAL_MOUTH_HALF_WIDTH = 1.85
  const snapshots = events.filter((event) => event.type === 'SHOT_POSITION_SNAPSHOT')
  const shotDecisions = Array.isArray(bundle?.shotDecisions) ? bundle.shotDecisions : []
  const stats = {
    shots: 0,
    avgDefendersInBox: 0,
    avgDefendersInCorridor: 0,
    emptyBoxShots: 0,
    emptyCorridorShots: 0,
    samples: [],
  }
  let sumBox = 0
  let sumCorridor = 0
  const shotDecisionDefenseRows = shotDecisions.filter((row) => Number.isFinite(Number(row.defendersInBox)))
  if (shotDecisionDefenseRows.length > snapshots.length) {
    for (const row of shotDecisionDefenseRows) {
      const defendersInBox = Number(row.defendersInBox ?? 0)
      const defendersInCorridor = Number(row.defendersInCorridor ?? 0)
      stats.shots++
      sumBox += defendersInBox
      sumCorridor += defendersInCorridor
      if (defendersInBox === 0) stats.emptyBoxShots++
      if (defendersInCorridor === 0) stats.emptyCorridorShots++
      if (stats.samples.length < 8) {
        stats.samples.push({
          t: round(Number(row.elapsedInHalf ?? row.minute ?? 0), 1),
          team: row.team,
          shooter: row.shooter || 'Unknown',
          shooterRole: row.role || 'UNK',
          ballX: round(Number(row.shotOrigin?.x ?? row.ballX ?? row.distToGoal ?? 0), 1),
          ballZ: round(Number(row.shotOrigin?.z ?? row.ballZ ?? 0), 1),
          defendersInBox,
          defendersInCorridor,
          source: 'shotDecisions',
        })
      }
    }
    stats.avgDefendersInBox = stats.shots ? round(sumBox / stats.shots) : 0
    stats.avgDefendersInCorridor = stats.shots ? round(sumCorridor / stats.shots) : 0
    return stats
  }
  for (const event of snapshots) {
    const ball = event.detail?.ball
    const players = Array.isArray(event.detail?.players) ? event.detail.players : []
    if (!ball || players.length === 0) continue
    const attackingTeam = event.team
    const goalX = Number(ball.x) >= 0 ? FIELD_W / 2 : -FIELD_W / 2
    const defenders = players.filter((p) => p.team !== attackingTeam && p.role !== 'GK')
    const defendersInBox = defenders.filter((p) =>
      Math.abs(Number(p.x) - goalX) <= PENALTY_DEPTH
      && Math.abs(Number(p.z)) <= GOAL_MOUTH_HALF_WIDTH * 4.4
    ).length
    const defendersInCorridor = defenders.filter((p) =>
      Math.abs(Number(p.x) - goalX) <= PENALTY_DEPTH + 3
      && Math.abs(Number(p.z)) <= GOAL_MOUTH_HALF_WIDTH * 2.5
    ).length
    stats.shots++
    sumBox += defendersInBox
    sumCorridor += defendersInCorridor
    if (defendersInBox === 0) stats.emptyBoxShots++
    if (defendersInCorridor === 0) stats.emptyCorridorShots++
    if (stats.samples.length < 8) {
      stats.samples.push({
        t: round(getEventElapsed(event), 1),
        team: attackingTeam,
        shooter: event.detail?.shooter?.name || 'Unknown',
        shooterRole: event.detail?.shooter?.role || event.role || 'UNK',
        ballX: round(Number(ball.x), 1),
        ballZ: round(Number(ball.z), 1),
        defendersInBox,
        defendersInCorridor,
      })
    }
  }
  stats.avgDefendersInBox = stats.shots ? round(sumBox / stats.shots) : 0
  stats.avgDefendersInCorridor = stats.shots ? round(sumCorridor / stats.shots) : 0
  return stats
}

function getEventElapsed(event) {
  const half = Number(event.half ?? event.detail?.half ?? 1)
  return (half === 2 ? 150 : 0) + Number(event.t || event.detail?.t || 0)
}

function summarizeKickoffGoalCorrelation(events) {
  const passes = events
    .filter((event) => event.type === 'KICKOFF_PASS')
    .map((event) => ({ ...event, __elapsed: getEventElapsed(event) }))
    .sort((a, b) => a.__elapsed - b.__elapsed)
  const receives = events
    .filter((event) => event.type === 'KICKOFF_RECEIVED')
    .map((event) => ({ ...event, __elapsed: getEventElapsed(event) }))
    .sort((a, b) => a.__elapsed - b.__elapsed)
  const goals = events
    .filter((event) => event.type === 'GOAL_SCORER')
    .map((event) => ({ ...event, __elapsed: getEventElapsed(event) }))
    .sort((a, b) => a.__elapsed - b.__elapsed)

  const byTeam = {
    A: { passes: 0, receives: 0, goals: 0, sameAsLatestKickoffReceiverGoals: 0, sameAsLatestKickoffReceiverPct: 0, receivers: [], scorers: [], samples: [] },
    B: { passes: 0, receives: 0, goals: 0, sameAsLatestKickoffReceiverGoals: 0, sameAsLatestKickoffReceiverPct: 0, receivers: [], scorers: [], samples: [] },
  }
  const receiverStats = { A: new Map(), B: new Map() }
  const scorerStats = { A: new Map(), B: new Map() }

  const ensureReceiver = (team, name, role = null) => {
    if (!receiverStats[team]) return null
    const key = name || 'Unknown'
    if (!receiverStats[team].has(key)) {
      receiverStats[team].set(key, {
        player: key,
        role,
        intendedTargets: 0,
        actualReceives: 0,
        matchedExpectedReceives: 0,
        goalsAfterLatestKickoffReceive: 0,
        avgSecondsFromReceiveToGoal: 0,
        goalSeconds: [],
      })
    }
    const stat = receiverStats[team].get(key)
    if (!stat.role && role) stat.role = role
    return stat
  }
  const ensureScorer = (team, name, role = null) => {
    if (!scorerStats[team]) return null
    const key = name || 'Unknown'
    if (!scorerStats[team].has(key)) {
      scorerStats[team].set(key, { player: key, role, goals: 0 })
    }
    const stat = scorerStats[team].get(key)
    if (!stat.role && role) stat.role = role
    return stat
  }

  for (const pass of passes) {
    const team = pass.team
    if (!byTeam[team]) continue
    byTeam[team].passes++
    const target = pass.detail?.target || null
    if (target) {
      const stat = ensureReceiver(team, target, pass.detail?.targetRole)
      if (stat) stat.intendedTargets++
    }
  }

  for (const receive of receives) {
    const team = receive.team
    if (!byTeam[team]) continue
    byTeam[team].receives++
    const receiver = receive.detail?.receiver || 'Unknown'
    const stat = ensureReceiver(team, receiver, receive.detail?.receiverRole)
    if (stat) {
      stat.actualReceives++
      if (receive.detail?.matchedExpectedReceiver) stat.matchedExpectedReceives++
    }
  }

  for (const goal of goals) {
    const team = goal.team
    if (!byTeam[team]) continue
    byTeam[team].goals++
    const scorer = goal.detail?.scorer || 'Unknown'
    const scorerStat = ensureScorer(team, scorer, goal.detail?.scorerRole)
    if (scorerStat) scorerStat.goals++
    const latestReceive = receives
      .filter((receive) => receive.team === team && receive.__elapsed <= goal.__elapsed)
      .at(-1)
    if (!latestReceive) continue
    const receiver = latestReceive.detail?.receiver || 'Unknown'
    const samePlayer = receiver === scorer
    const secondsToGoal = round(goal.__elapsed - latestReceive.__elapsed)
    if (samePlayer) {
      byTeam[team].sameAsLatestKickoffReceiverGoals++
      const stat = ensureReceiver(team, receiver, latestReceive.detail?.receiverRole)
      if (stat) {
        stat.goalsAfterLatestKickoffReceive++
        stat.goalSeconds.push(secondsToGoal)
      }
    }
    if (byTeam[team].samples.length < 6) {
      byTeam[team].samples.push({
        scorer,
        scorerRole: goal.detail?.scorerRole || null,
        kickoffReceiver: receiver,
        kickoffReceiverRole: latestReceive.detail?.receiverRole || null,
        samePlayer,
        secondsToGoal,
        sequenceId: latestReceive.detail?.sequenceId ?? null,
        minute: goal.detail?.matchMinute ?? null,
      })
    }
  }

  for (const team of ['A', 'B']) {
    byTeam[team].sameAsLatestKickoffReceiverPct = pct(byTeam[team].sameAsLatestKickoffReceiverGoals, byTeam[team].goals)
    byTeam[team].receivers = Array.from(receiverStats[team].values())
      .map((stat) => ({
        ...stat,
        avgSecondsFromReceiveToGoal: stat.goalSeconds.length
          ? round(stat.goalSeconds.reduce((a, b) => a + b, 0) / stat.goalSeconds.length)
          : 0,
        goalSeconds: undefined,
      }))
      .sort((a, b) => (b.actualReceives - a.actualReceives) || (b.intendedTargets - a.intendedTargets) || (b.goalsAfterLatestKickoffReceive - a.goalsAfterLatestKickoffReceive))
      .slice(0, 8)
    byTeam[team].scorers = Array.from(scorerStats[team].values())
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 8)
  }

  return {
    kickoffPasses: passes.length,
    kickoffReceives: receives.length,
    goalScorerEvents: goals.length,
    byTeam,
  }
}

// User-requested metric: how many 1-second windows have 3+ distinct attackers
// from the same team in opposition final third. Measures attacking commitment
// (overloads in the final third) vs sterile solo attacks.
function summarizeFinalThirdOverloads(events) {
  const traces = events.filter((event) => event.type === 'ATTACKER_ZONE_TRACE')
  // Bin per team per 1-second window. Key: `${team}:${secondBucket}` → Set of player names.
  const buckets = new Map()
  for (const evt of traces) {
    const team = evt.team
    if (team !== 'A' && team !== 'B') continue
    const distToGoal = Number(evt.detail?.distToGoal ?? 99)
    if (distToGoal > 22) continue
    const playerName = evt.detail?.playerName || evt.role || 'unknown'
    const elapsed = getEventElapsed(evt)
    const bucket = Math.floor(elapsed)
    const key = `${team}:${bucket}`
    let set = buckets.get(key)
    if (!set) { set = new Set(); buckets.set(key, set) }
    set.add(playerName)
  }
  const statsA = { totalBuckets: 0, bucketsWithOverload: 0, maxAttackersInBucket: 0 }
  const statsB = { totalBuckets: 0, bucketsWithOverload: 0, maxAttackersInBucket: 0 }
  for (const [key, set] of buckets.entries()) {
    const team = key.split(':')[0]
    const stats = team === 'A' ? statsA : statsB
    stats.totalBuckets++
    if (set.size > stats.maxAttackersInBucket) stats.maxAttackersInBucket = set.size
    if (set.size >= 3) stats.bucketsWithOverload++
  }
  return { A: statsA, B: statsB }
}

function summarizeDangerMarking(events) {
  const traces = events.filter((event) => event.type === 'ATTACKER_ZONE_TRACE' && event.detail?.dangerMarkingZone)
  const byTeam = {
    A: { samples: 0, marked: 0, unmarked: 0, markedPct: 0, avgNearestDefenderDist: 0, worstSamples: [] },
    B: { samples: 0, marked: 0, unmarked: 0, markedPct: 0, avgNearestDefenderDist: 0, worstSamples: [] },
  }
  const sums = { A: 0, B: 0 }
  for (const event of traces) {
    const team = event.team
    if (team !== 'A' && team !== 'B') continue
    const row = byTeam[team]
    row.samples++
    const dist = Number(event.detail?.nearestDefenderDist ?? NaN)
    if (Number.isFinite(dist)) sums[team] += dist
    if (event.detail?.dangerMarked) row.marked++
    else {
      row.unmarked++
      row.worstSamples.push({
        t: round(getEventElapsed(event), 1),
        player: event.detail?.playerName || 'Unknown',
        role: event.role,
        zone: event.detail?.zone || 'UNKNOWN',
        distToGoal: round(Number(event.detail?.distToGoal ?? 0), 1),
        nearestDefenderDist: Number.isFinite(dist) ? round(dist, 2) : null,
        patternRole: event.detail?.patternRole || 'NONE',
      })
    }
  }
  for (const team of ['A', 'B']) {
    const row = byTeam[team]
    row.markedPct = pct(row.marked, row.samples)
    row.avgNearestDefenderDist = row.samples ? round(sums[team] / row.samples) : 0
    row.worstSamples.sort((a, b) => (b.nearestDefenderDist ?? 0) - (a.nearestDefenderDist ?? 0))
    row.worstSamples = row.worstSamples.slice(0, 6)
  }
  return { samples: traces.length, byTeam }
}

// User-requested metric: how many sequences have 2+ distinct players touching the
// ball in the opponent's half. Measures genuine multi-player build-up in attacking
// territory, not solo-carry-and-shoot.
function summarizeMultiTouchOppHalfSequences(events) {
  const touchTypes = new Set(['PASS', 'SHOT', 'RECOVERY', 'CLEARANCE', 'INTERCEPTION', 'TACKLE'])
  // Order events by match time (half + t)
  const ordered = events
    .filter((e) => touchTypes.has(e.type))
    .map((e) => ({ ...e, __elapsed: getEventElapsed(e) }))
    .sort((a, b) => a.__elapsed - b.__elapsed)

  const sequences = []
  let current = null
  for (const evt of ordered) {
    const team = evt.team
    if (!team || !['A', 'B'].includes(team)) continue
    // PASS carries two touches (passer + receiver). TACKLE/INTERCEPTION change possession.
    // For simplicity: possession sequence bounded by team changes.
    if (!current || current.team !== team) {
      if (current) sequences.push(current)
      current = { team, touches: [] }
    }
    // Pass: two touches (passer at event.detail.x,z; receiver at event.detail.targetX,targetZ)
    if (evt.type === 'PASS') {
      const passer = evt.detail?.passer || evt.role || null
      const passerRole = evt.role || null
      const passerX = Number(evt.detail?.x ?? NaN)
      if (passer && Number.isFinite(passerX)) {
        current.touches.push({ player: passer, role: passerRole, x: passerX, t: evt.__elapsed })
      }
      // Receiver counts as the next touch only if completed
      const receiver = evt.detail?.receiver || evt.detail?.to || null
      const receiverRole = evt.detail?.receiverRole || evt.detail?.toRole || null
      const receiverX = Number(evt.detail?.targetX ?? NaN)
      if (receiver && evt.detail?.completed !== false && Number.isFinite(receiverX)) {
        current.touches.push({ player: receiver, role: receiverRole, x: receiverX, t: evt.__elapsed + 0.001 })
      }
    } else {
      const player = evt.detail?.passer || evt.detail?.shooter || evt.detail?.vs || evt.role || 'unknown'
      const role = evt.role || null
      const x = Number(evt.detail?.x ?? NaN)
      if (Number.isFinite(x)) {
        current.touches.push({ player, role, x, t: evt.__elapsed })
      }
    }
  }
  if (current) sequences.push(current)

  let totalSequences = sequences.length
  let multiTouchOppHalfCount = 0
  let totalOppHalfTouches = 0
  let totalOppHalfDistinctPlayers = 0
  const exampleSequences = []

  for (const seq of sequences) {
    const attackSign = seq.team === 'A' ? 1 : -1
    const oppHalfTouches = seq.touches.filter((t) => t.x * attackSign > 0)
    const distinctPlayersInOppHalf = new Set(oppHalfTouches.map((t) => t.player))
    totalOppHalfTouches += oppHalfTouches.length
    totalOppHalfDistinctPlayers += distinctPlayersInOppHalf.size
    if (distinctPlayersInOppHalf.size >= 2) {
      multiTouchOppHalfCount++
      if (exampleSequences.length < 6) {
        exampleSequences.push({
          team: seq.team,
          players: Array.from(distinctPlayersInOppHalf),
          touchCount: oppHalfTouches.length,
          firstTouchAt: oppHalfTouches[0]?.t,
        })
      }
    }
  }

  return {
    totalSequences,
    multiTouchOppHalfCount,
    totalOppHalfTouches,
    avgDistinctPlayersPerSequence: totalSequences > 0 ? round(totalOppHalfDistinctPlayers / totalSequences) : 0,
    exampleSequences,
  }
}

// Touches-per-pattern + pace-of-attack.
// Walks patterns and correlates PASS/SHOT events to active pattern per team.
// Tempo expectation per pattern type lets us flag situation-appropriate pace.
function summarizePatternTempo(events) {
  const touchTypes = new Set(['PASS', 'SHOT'])
  // Build pattern intervals per team (reuse logic from summarizePatterns)
  const starts = events.filter((e) => e.type === 'PATTERN_START')
  const ends = events.filter((e) => e.type === 'PATTERN_END')
  const startsByTeam = { A: [], B: [] }
  const endsByTeam = { A: [], B: [] }
  for (const s of starts) if (startsByTeam[s.team]) startsByTeam[s.team].push(s)
  for (const e of ends) if (endsByTeam[e.team]) endsByTeam[e.team].push({ ...e, _used: false })

  const intervals = []
  for (const team of ['A', 'B']) {
    for (const s of startsByTeam[team]) {
      const sElapsed = getEventElapsed(s)
      let endElapsed = null
      for (const e of endsByTeam[team]) {
        if (e._used) continue
        const eTime = getEventElapsed(e)
        if (eTime >= sElapsed) { endElapsed = eTime; e._used = true; break }
      }
      intervals.push({
        team, type: s.detail?.type || 'UNKNOWN', startElapsed: sElapsed, endElapsed,
        touches: 0, firstTouchAt: null, lastTouchAt: null,
        firstTouchX: null, lastTouchX: null,
        firstTouchZ: null, lastTouchZ: null,
      })
    }
  }

  const touchEvents = events
    .filter((e) => touchTypes.has(e.type))
    .map((e) => ({ ...e, _elapsed: getEventElapsed(e) }))
    .sort((a, b) => a._elapsed - b._elapsed)

  for (const evt of touchEvents) {
    const team = evt.team
    const t = evt._elapsed
    const x = Number(evt.detail?.x ?? NaN)
    const z = Number(evt.detail?.z ?? NaN)
    // Find containing pattern interval for this team
    const iv = intervals.find((iv) =>
      iv.team === team
      && iv.startElapsed <= t
      && (iv.endElapsed === null || iv.endElapsed >= t))
    if (iv && Number.isFinite(x)) {
      iv.touches++
      if (iv.firstTouchAt === null) {
        iv.firstTouchAt = t; iv.firstTouchX = x; iv.firstTouchZ = z
      }
      iv.lastTouchAt = t; iv.lastTouchX = x; iv.lastTouchZ = z
    }
  }

  const byType = {}
  for (const iv of intervals) {
    if (!byType[iv.type]) byType[iv.type] = { count: 0, totalTouches: 0, multiTouchCount: 0, totalDuration: 0, durationSamples: 0, paceSamples: [] }
    byType[iv.type].count++
    byType[iv.type].totalTouches += iv.touches
    // Pace only makes sense with 2+ distinct touches (first and last at different spots).
    if (iv.touches >= 2 && iv.firstTouchAt !== null && iv.lastTouchAt !== null && iv.lastTouchAt > iv.firstTouchAt + 0.2) {
      const duration = iv.lastTouchAt - iv.firstTouchAt
      const attackSign = iv.team === 'A' ? 1 : -1
      const distance = (iv.lastTouchX - iv.firstTouchX) * attackSign
      byType[iv.type].multiTouchCount++
      byType[iv.type].totalDuration += duration
      byType[iv.type].durationSamples++
      byType[iv.type].paceSamples.push(distance / duration)
    }
  }

  // Expected tempo per pattern type (realism heuristic)
  const expected = {
    COUNTER_ATTACK: { touches: [2, 4], pace: [4.0, 12.0], label: 'fast direct' },
    WING_ATTACK_LEFT: { touches: [2, 4], pace: [3.0, 8.0], label: 'quick deliver' },
    WING_ATTACK_RIGHT: { touches: [2, 4], pace: [3.0, 8.0], label: 'quick deliver' },
    PATIENT_BUILDUP: { touches: [3, 7], pace: [1.0, 4.0], label: 'deliberate' },
    CENTRAL_COMBO: { touches: [2, 4], pace: [2.5, 6.0], label: 'short sharp' },
  }

  const result = {}
  for (const [type, v] of Object.entries(byType)) {
    if (v.count === 0) continue
    const avgTouches = round(v.totalTouches / v.count)
    const avgDuration = v.durationSamples > 0 ? round(v.totalDuration / v.durationSamples) : 0
    const avgPace = v.paceSamples.length > 0 ? round(v.paceSamples.reduce((a, b) => a + b, 0) / v.paceSamples.length) : 0
    const exp = expected[type]
    let touchFit = 'n/a', paceFit = 'n/a'
    if (exp) {
      if (avgTouches < exp.touches[0]) touchFit = 'TOO_FEW'
      else if (avgTouches > exp.touches[1]) touchFit = 'TOO_MANY'
      else touchFit = 'OK'
      if (avgPace < exp.pace[0]) paceFit = 'TOO_SLOW'
      else if (avgPace > exp.pace[1]) paceFit = 'TOO_FAST'
      else paceFit = 'OK'
    }
    result[type] = {
      count: v.count,
      multiTouchCount: v.multiTouchCount,
      avgTouches,
      avgDuration,
      avgPace: v.paceSamples.length > 0 ? avgPace : null,
      expectedTouches: exp?.touches || null,
      expectedPace: exp?.pace || null,
      expectedLabel: exp?.label || null,
      touchFit,
      paceFit: v.paceSamples.length > 0 ? paceFit : 'no_multi_touch_data',
    }
  }
  return result
}

function neoPlayNameFor(type, detail = {}) {
  return detail.playName || (type === 'CENTRAL_COMBO' ? 'GIVE_AND_GO' : type || 'UNKNOWN')
}

function summarizeNeoPlayEffectiveness(events) {
  const starts = events
    .filter((event) => event.type === 'PATTERN_START')
    .map((event) => ({ ...event, __elapsed: getEventElapsed(event) }))
  const deliveries = events
    .filter((event) => event.type === 'PATTERN_DELIVERY_EXECUTED' || event.type === 'PATTERN_CROSS_EXECUTED')
    .map((event) => ({ ...event, __elapsed: getEventElapsed(event) }))
    .sort((a, b) => a.__elapsed - b.__elapsed)
  const shots = events
    .filter((event) => event.type === 'SHOT')
    .map((event) => ({ ...event, __elapsed: getEventElapsed(event) }))
    .sort((a, b) => a.__elapsed - b.__elapsed)
  const goals = events
    .filter((event) => event.type === 'GOAL' || event.type === 'GOAL_SCORER')
    .map((event) => ({ ...event, __elapsed: getEventElapsed(event) }))
    .sort((a, b) => a.__elapsed - b.__elapsed)

  const byPlay = {}
  const ensure = (playName, patternType) => {
    const key = playName || patternType || 'UNKNOWN'
    if (!byPlay[key]) {
      byPlay[key] = {
        playName: key,
        patternTypes: {},
        starts: 0,
        deliveries: 0,
        crosses: 0,
        shotCreatingDeliveries: 0,
        goalCreatingDeliveries: 0,
        effectivenessPct: 0,
        goalRatePct: 0,
        samples: [],
      }
    }
    if (patternType) byPlay[key].patternTypes[patternType] = (byPlay[key].patternTypes[patternType] || 0) + 1
    return byPlay[key]
  }

  for (const start of starts) {
    const patternType = start.detail?.type || 'UNKNOWN'
    const row = ensure(neoPlayNameFor(patternType, start.detail), patternType)
    row.starts++
  }

  const outcomeWindowSeconds = 8
  for (const delivery of deliveries) {
    const detail = delivery.detail || {}
    const patternType = detail.patternType || detail.type || 'UNKNOWN'
    const row = ensure(neoPlayNameFor(patternType, detail), patternType)
    row.deliveries++
    if (delivery.type === 'PATTERN_CROSS_EXECUTED' || detail.realCross) row.crosses++

    const windowEnd = delivery.__elapsed + outcomeWindowSeconds
    const shot = shots.find((event) =>
      event.team === delivery.team
      && event.__elapsed >= delivery.__elapsed
      && event.__elapsed <= windowEnd)
    const goal = goals.find((event) =>
      event.team === delivery.team
      && event.__elapsed >= delivery.__elapsed
      && event.__elapsed <= windowEnd)

    if (shot) row.shotCreatingDeliveries++
    if (goal) row.goalCreatingDeliveries++
    if (row.samples.length < 5) {
      row.samples.push({
        team: delivery.team,
        t: round(delivery.__elapsed, 1),
        patternType,
        passer: detail.passer || null,
        passerRole: detail.passerRole || null,
        target: detail.target || null,
        targetRole: detail.targetRole || null,
        style: detail.style || null,
        shotWithinSeconds: shot ? round(shot.__elapsed - delivery.__elapsed, 1) : null,
        goalWithinSeconds: goal ? round(goal.__elapsed - delivery.__elapsed, 1) : null,
      })
    }
  }

  let totalStarts = 0
  let totalDeliveries = 0
  let totalShotCreatingDeliveries = 0
  let totalGoalCreatingDeliveries = 0
  for (const row of Object.values(byPlay)) {
    totalStarts += row.starts
    totalDeliveries += row.deliveries
    totalShotCreatingDeliveries += row.shotCreatingDeliveries
    totalGoalCreatingDeliveries += row.goalCreatingDeliveries
    row.effectivenessPct = pct(row.shotCreatingDeliveries, row.deliveries)
    row.goalRatePct = pct(row.goalCreatingDeliveries, row.deliveries)
  }

  return {
    outcomeWindowSeconds,
    totalStarts,
    totalDeliveries,
    totalShotCreatingDeliveries,
    totalGoalCreatingDeliveries,
    effectivenessPct: pct(totalShotCreatingDeliveries, totalDeliveries),
    goalRatePct: pct(totalGoalCreatingDeliveries, totalDeliveries),
    byPlay,
  }
}

function summarizeRolePositions(events) {
  const traces = events.filter((event) => event.type === 'ATTACKER_ZONE_TRACE')
  const byTeamRole = new Map()
  for (const event of traces) {
    const team = event.team
    const role = event.role
    if (!team || !role) continue
    const key = `${team}:${role}`
    let entry = byTeamRole.get(key)
    if (!entry) {
      entry = {
        team, role,
        samples: 0, sumX: 0, sumAbsZ: 0, sumDistToGoal: 0,
        // Phase-filtered: only when player is in opp half / final third
        oppHalfSamples: 0, oppHalfSumForwardX: 0,
        finalThirdSamples: 0, finalThirdSumAbsZ: 0,
      }
      byTeamRole.set(key, entry)
    }
    const detail = event.detail || {}
    const x = Number(detail.x ?? 0)
    const absZ = Math.abs(Number(detail.z ?? 0))
    const distToGoal = Number(detail.distToGoal ?? 0)
    // Infer attack direction from team: A attacks +x, B attacks -x (default convention)
    const attackSign = team === 'A' ? 1 : -1
    const forwardX = x * attackSign
    entry.samples++
    entry.sumX += x
    entry.sumAbsZ += absZ
    entry.sumDistToGoal += distToGoal
    // Opp half = forwardX > 0 (player crossed midfield in attack direction)
    if (forwardX > 0) {
      entry.oppHalfSamples++
      entry.oppHalfSumForwardX += forwardX
    }
    // Final third = distToGoal <= 22 (matches gameEngine FINAL_THIRD zone threshold)
    if (distToGoal <= 22) {
      entry.finalThirdSamples++
      entry.finalThirdSumAbsZ += absZ
    }
  }
  const result = { A: [], B: [] }
  for (const entry of byTeamRole.values()) {
    if (!entry.samples) continue
    const summary = {
      role: entry.role,
      samples: entry.samples,
      avgX: round(entry.sumX / entry.samples),
      avgAbsZ: round(entry.sumAbsZ / entry.samples),
      avgDistToGoal: round(entry.sumDistToGoal / entry.samples),
      oppHalfSamples: entry.oppHalfSamples,
      avgForwardXInOppHalf: entry.oppHalfSamples ? round(entry.oppHalfSumForwardX / entry.oppHalfSamples) : null,
      finalThirdSamples: entry.finalThirdSamples,
      avgAbsZInFinalThird: entry.finalThirdSamples ? round(entry.finalThirdSumAbsZ / entry.finalThirdSamples) : null,
    }
    if (result[entry.team]) result[entry.team].push(summary)
  }
  result.A.sort((a, b) => a.role.localeCompare(b.role))
  result.B.sort((a, b) => a.role.localeCompare(b.role))
  return result
}

function summarizeShape(shapeSamples, teamName) {
  const rawSamples = Array.isArray(shapeSamples) ? shapeSamples : []
  const samples = rawSamples.length && rawSamples.every((sample) => Number.isFinite(Number(sample.width)))
    ? rawSamples
    : (() => {
      const byMoment = new Map()
      for (const sample of rawSamples) {
        const half = Number(sample.half ?? 0)
        const t = Number(sample.t ?? 0)
        const x = Number(sample.x ?? NaN)
        const z = Number(sample.z ?? NaN)
        if (!Number.isFinite(half) || !Number.isFinite(t) || !Number.isFinite(x) || !Number.isFinite(z)) continue
        const key = `${half}:${t}`
        if (!byMoment.has(key)) byMoment.set(key, { xs: [], zs: [], half, t })
        const bucket = byMoment.get(key)
        bucket.xs.push(x)
        bucket.zs.push(z)
      }
      return Array.from(byMoment.values()).map((bucket) => {
        const zs = bucket.zs
        const xs = bucket.xs
        const avgZ = zs.length ? zs.reduce((sum, value) => sum + value, 0) / zs.length : 0
        const avgX = xs.length ? xs.reduce((sum, value) => sum + value, 0) / xs.length : 0
        const compactness = zs.length
          ? zs.reduce((sum, z, index) => sum + Math.hypot(xs[index] - avgX, z - avgZ), 0) / zs.length
          : 0
        return {
          half: bucket.half,
          t: bucket.t,
          avgZ,
          width: zs.length ? Math.max(...zs) - Math.min(...zs) : 0,
          depth: xs.length ? Math.max(...xs) - Math.min(...xs) : 0,
          compactness,
        }
      })
    })()
  const centerLocked = samples.filter((sample) => Math.abs(Number(sample.avgZ ?? 0)) <= 3)
  const narrow = samples.filter((sample) => Number(sample.width ?? 0) < 18)
  const centerAndNarrow = samples.filter((sample) => Math.abs(Number(sample.avgZ ?? 0)) <= 3 && Number(sample.width ?? 0) < 18)

  return {
    team: teamName,
    snapshots: samples.length,
    avgWidth: samples.length ? round(samples.reduce((sum, sample) => sum + Number(sample.width ?? 0), 0) / samples.length) : 0,
    minWidth: samples.length ? round(Math.min(...samples.map((sample) => Number(sample.width ?? 0)))) : 0,
    maxWidth: samples.length ? round(Math.max(...samples.map((sample) => Number(sample.width ?? 0)))) : 0,
    avgDepth: samples.length ? round(samples.reduce((sum, sample) => sum + Number(sample.depth ?? 0), 0) / samples.length) : 0,
    avgCompactness: samples.length ? round(samples.reduce((sum, sample) => sum + Number(sample.compactness ?? 0), 0) / samples.length) : 0,
    avgAbsAvgZ: samples.length ? round(samples.reduce((sum, sample) => sum + Math.abs(Number(sample.avgZ ?? 0)), 0) / samples.length) : 0,
    centerLockedPct: pct(centerLocked.length, samples.length),
    narrowPct: pct(narrow.length, samples.length),
    centerAndNarrowPct: pct(centerAndNarrow.length, samples.length),
  }
}

function summarizePositionOwners(events) {
  const samples = events.filter((event) => event.type === 'POSITION_OWNER_SAMPLE')
  const byTeam = { A: {}, B: {} }
  const wideByTeam = {
    A: { samples: 0, sumAbsZ: 0, sumTargetAbsZ: 0, byOwner: {} },
    B: { samples: 0, sumAbsZ: 0, sumTargetAbsZ: 0, byOwner: {} },
  }
  const wideRoles = new Set(['LM', 'RM', 'LW', 'RW', 'LB', 'RB', 'LWB', 'RWB', 'W', 'FB'])

  for (const event of samples) {
    const team = event.team === 'B' ? 'B' : 'A'
    const role = String(event.detail?.label || event.detail?.owner || event.role || '').toUpperCase()
    const owner = String(event.detail?.owner || event.detail?.label || event.role || 'UNKNOWN')
    byTeam[team][owner] = (byTeam[team][owner] || 0) + 1
    if (wideRoles.has(role)) {
      const bucket = wideByTeam[team]
      bucket.samples++
      bucket.sumAbsZ += Number(event.detail?.absZ ?? 0)
      bucket.sumTargetAbsZ += Number(event.detail?.targetAbsZ ?? 0)
      bucket.byOwner[owner] = (bucket.byOwner[owner] || 0) + 1
    }
  }

  const finalizeWide = (bucket) => ({
    samples: bucket.samples,
    avgAbsZ: bucket.samples ? round(bucket.sumAbsZ / bucket.samples) : 0,
    avgTargetAbsZ: bucket.samples ? round(bucket.sumTargetAbsZ / bucket.samples) : 0,
    byOwner: bucket.byOwner,
  })

  return {
    samples: samples.length,
    byTeam,
    wide: {
      A: finalizeWide(wideByTeam.A),
      B: finalizeWide(wideByTeam.B),
    },
  }
}

function summarizeRoleCentrality(teamBundle) {
  const roleStats = teamBundle?.roleStats || {}
  let wideTouches = 0
  let centralTouches = 0
  let wideShots = 0
  let centralShots = 0

  for (const [role, stats] of Object.entries(roleStats)) {
    const touches = Number(stats?.touches ?? 0)
    const shots = Number(stats?.shots ?? 0)
    if (['LM', 'RM', 'LB', 'RB', 'LWB', 'RWB'].includes(role)) {
      wideTouches += touches
      wideShots += shots
    }
    if (['ST', 'CF', 'CAM', 'CM', 'DM', 'CDM'].includes(role)) {
      centralTouches += touches
      centralShots += shots
    }
  }

  return {
    wideTouches,
    centralTouches,
    wideTouchShareVsCentral: centralTouches > 0 ? round(wideTouches / centralTouches) : null,
    wideShots,
    centralShots,
    wideShotShareVsCentral: centralShots > 0 ? round(wideShots / centralShots) : null,
  }
}

function summarizeEventStream(events, passLog) {
  const shots = events.filter((event) => event.type === 'SHOT')
  const onTargetShots = shots.filter((event) => !!event.detail?.onTarget)
  const goals = shots.filter((event) => !!event.detail?.goal)
  const longRangeOnTarget = onTargetShots
    .filter((event) => Number(event.detail?.distYards ?? 0) >= 24)
    .map((event) => ({
      minute: event.minute,
      team: event.team,
      role: event.role,
      style: event.detail?.style || 'AUTO',
      distYards: round(event.detail?.distYards ?? 0, 1),
      pressure: Number(event.detail?.nearbyOppPressure ?? 0),
      angle: round(event.detail?.angleToGoal ?? 0, 2),
      goal: !!event.detail?.goal,
    }))
  const closeRangeBadAngles = shots
    .filter((event) => Number(event.detail?.distYards ?? 99) <= 10 && Number(event.detail?.angleToGoal ?? 0) >= 0.75)
    .map((event) => ({
      minute: event.minute,
      team: event.team,
      role: event.role,
      style: event.detail?.style || 'AUTO',
      distYards: round(event.detail?.distYards ?? 0, 1),
      angle: round(event.detail?.angleToGoal ?? 0, 2),
      onTarget: !!event.detail?.onTarget,
      goal: !!event.detail?.goal,
    }))
  const toePokesOnTarget = onTargetShots
    .filter((event) => (event.detail?.style || '').toUpperCase() === 'TOE_POKE')
    .map((event) => ({
      minute: event.minute,
      team: event.team,
      role: event.role,
      distYards: round(event.detail?.distYards ?? 0, 1),
      angle: round(event.detail?.angleToGoal ?? 0, 2),
      goal: !!event.detail?.goal,
    }))
  const attackerResetPasses = passLog
    .filter((event) => {
      const role = getRoleLabel(event)
      const style = (event.detail?.style || '').toString().toUpperCase()
      return ['ST', 'CF', 'CAM', 'LM', 'RM'].includes(role) && ['BACK', 'WALL'].includes(style)
    })
    .map((event) => ({
      minute: event.minute,
      team: event.team,
      role: event.role,
      style: event.detail?.style || 'UNKNOWN',
      progress: round(event.detail?.progress ?? 0, 1),
      distToGoal: round(event.detail?.passerDistToGoal ?? 0, 1),
    }))

  return {
    totalShots: shots.length,
    onTargetShots: onTargetShots.length,
    goals: goals.length,
    longRangeOnTargetCount: longRangeOnTarget.length,
    closeRangeBadAngleCount: closeRangeBadAngles.length,
    toePokesOnTargetCount: toePokesOnTarget.length,
    attackerResetPassCount: attackerResetPasses.length,
    longRangeOnTarget: longRangeOnTarget.slice(0, 12),
    closeRangeBadAngles: closeRangeBadAngles.slice(0, 12),
    toePokesOnTarget: toePokesOnTarget.slice(0, 12),
    attackerResetPasses: attackerResetPasses.slice(0, 16),
  }
}

function summarizeKeeperEvents(bundle, passLog = []) {
  const passStyle = (entry) => String(entry?.detail?.style ?? entry?.style ?? '').toUpperCase()
  const byTeam = {
    A: {
      saves: bundle.teamA?.saves ?? 0,
      keeperKicks: 0,
      goalKicks: 0,
    },
    B: {
      saves: bundle.teamB?.saves ?? 0,
      keeperKicks: 0,
      goalKicks: 0,
    },
  }

  for (const entry of passLog) {
    const team = entry?.team
    if (team !== 'A' && team !== 'B') continue
    const style = passStyle(entry)
    if (style === 'KEEPER_KICK') byTeam[team].keeperKicks += 1
    if (style === 'GOAL_KICK') byTeam[team].goalKicks += 1
  }

  return {
    totalSaves: byTeam.A.saves + byTeam.B.saves,
    byTeam,
  }
}

function summarizeRestartCounts(events, passLog = [], bundle = null) {
  const byTeam = {
    A: { corners: 0, throwIns: 0, goalKicks: 0, freeKicks: 0, penalties: 0 },
    B: { corners: 0, throwIns: 0, goalKicks: 0, freeKicks: 0, penalties: 0 },
  }

  const bundleA = bundle?.teamA || {}
  const bundleB = bundle?.teamB || {}
  byTeam.A.corners = Number(bundleA.corners ?? 0)
  byTeam.B.corners = Number(bundleB.corners ?? 0)
  byTeam.A.throwIns = Number(bundleA.throwIns ?? 0)
  byTeam.B.throwIns = Number(bundleB.throwIns ?? 0)
  byTeam.A.goalKicks = Number(bundleA.goalKicks ?? 0)
  byTeam.B.goalKicks = Number(bundleB.goalKicks ?? 0)
  byTeam.A.freeKicks = Number(bundleA.freeKicks ?? 0)
  byTeam.B.freeKicks = Number(bundleB.freeKicks ?? 0)
  byTeam.A.penalties = Number(bundleA.penaltiesAwarded ?? 0)
  byTeam.B.penalties = Number(bundleB.penaltiesAwarded ?? 0)

  const eventCounts = {
    A: { corners: 0, throwIns: 0, goalKicks: 0, penalties: 0 },
    B: { corners: 0, throwIns: 0, goalKicks: 0, penalties: 0 },
  }

  for (const event of events) {
    const team = event?.team
    if (team !== 'A' && team !== 'B') continue
    if (event.type === 'CORNER') eventCounts[team].corners += 1
    if (event.type === 'THROW_IN') eventCounts[team].throwIns += 1
    if (event.type === 'GOAL_KICK') eventCounts[team].goalKicks += 1
    if (event.type === 'PENALTY' && event.detail?.phase === 'setup') eventCounts[team].penalties += 1
  }

  for (const team of ['A', 'B']) {
    byTeam[team].corners = Math.max(byTeam[team].corners, eventCounts[team].corners)
    byTeam[team].throwIns = Math.max(byTeam[team].throwIns, eventCounts[team].throwIns)
    byTeam[team].goalKicks = Math.max(byTeam[team].goalKicks, eventCounts[team].goalKicks)
    byTeam[team].penalties = Math.max(byTeam[team].penalties, eventCounts[team].penalties)
  }

  for (const entry of passLog) {
    const team = entry?.team
    if (team !== 'A' && team !== 'B') continue
    const style = String(entry?.detail?.style ?? entry?.style ?? '').toUpperCase()
    if (style === 'FREE_KICK') byTeam[team].freeKicks += 1
  }

  return {
    total: {
      corners: byTeam.A.corners + byTeam.B.corners,
      throwIns: byTeam.A.throwIns + byTeam.B.throwIns,
      goalKicks: byTeam.A.goalKicks + byTeam.B.goalKicks,
      freeKicks: byTeam.A.freeKicks + byTeam.B.freeKicks,
      penalties: byTeam.A.penalties + byTeam.B.penalties,
    },
    byTeam,
  }
}

function compareToBaselines(bundle, teamAName, teamBName) {
  const baselineMap = buildTeamBaselineMap()
  const baselineA = baselineMap.get(normalizeTeamName(teamAName).toLowerCase()) || null
  const baselineB = baselineMap.get(normalizeTeamName(teamBName).toLowerCase()) || null
  const duration = getBundleDurationInfo(bundle)
  const scaleBaseline = (value) => round((Number(value) || 0) * duration.durationFactor)

  const global = {
    totalGoals: {
      simulated: (bundle.teamA?.score ?? 0) + (bundle.teamB?.score ?? 0),
      baseline: scaleBaseline(MLS_2025_GLOBAL_AVERAGES.goalsPerGame),
    },
    totalShots: {
      simulated: (bundle.teamA?.shots ?? 0) + (bundle.teamB?.shots ?? 0),
      baseline: scaleBaseline(MLS_2025_GLOBAL_AVERAGES.shotsPerGame * 2),
    },
    totalShotsOnTarget: {
      simulated: (bundle.teamA?.shotsOnTarget ?? 0) + (bundle.teamB?.shotsOnTarget ?? 0),
      baseline: scaleBaseline(MLS_2025_GLOBAL_AVERAGES.shotsOnTargetPerGame * 2),
    },
    totalCorners: {
      simulated: (bundle.teamA?.corners ?? 0) + (bundle.teamB?.corners ?? 0),
      baseline: scaleBaseline(MLS_2025_GLOBAL_AVERAGES.cornersPerGame * 2),
    },
  }

  for (const value of Object.values(global)) {
    value.drift = round(value.simulated - value.baseline)
  }

  const teamComparison = [
    {
      team: teamAName,
      simulated: {
        goals: bundle.teamA?.score ?? 0,
        shots: bundle.teamA?.shots ?? 0,
        shotsOnTarget: bundle.teamA?.shotsOnTarget ?? 0,
        passCompletionPct: bundle.teamA?.passes ? round(((bundle.teamA?.passesCompleted ?? 0) / bundle.teamA.passes) * 100, 1) : 0,
        possessionPct: bundle.teamA?.possession ?? 50,
        corners: bundle.teamA?.corners ?? 0,
      },
      baseline: baselineA ? {
        goals: scaleBaseline(baselineA.goalsFor),
        shots: scaleBaseline(baselineA.shotsPerGame),
        shotsOnTarget: scaleBaseline(baselineA.shotsOnTargetPerGame),
        passCompletionPct: round(baselineA.passCompletionRate * 100, 1),
        possessionPct: round(baselineA.possession * 100, 1),
        corners: scaleBaseline(baselineA.corners),
      } : null,
    },
    {
      team: teamBName,
      simulated: {
        goals: bundle.teamB?.score ?? 0,
        shots: bundle.teamB?.shots ?? 0,
        shotsOnTarget: bundle.teamB?.shotsOnTarget ?? 0,
        passCompletionPct: bundle.teamB?.passes ? round(((bundle.teamB?.passesCompleted ?? 0) / bundle.teamB.passes) * 100, 1) : 0,
        possessionPct: bundle.teamB?.possession ?? 50,
        corners: bundle.teamB?.corners ?? 0,
      },
      baseline: baselineB ? {
        goals: scaleBaseline(baselineB.goalsFor),
        shots: scaleBaseline(baselineB.shotsPerGame),
        shotsOnTarget: scaleBaseline(baselineB.shotsOnTargetPerGame),
        passCompletionPct: round(baselineB.passCompletionRate * 100, 1),
        possessionPct: round(baselineB.possession * 100, 1),
        corners: scaleBaseline(baselineB.corners),
      } : null,
    },
  ]

  return { duration, global, teamComparison }
}

function getBundleDurationInfo(bundle) {
  const runtimeHalfSeconds = Number(bundle?.metadata?.runtimeHalfDuration ?? 0)
  const halfSeconds = Math.max(
    1,
    Number.isFinite(runtimeHalfSeconds) && runtimeHalfSeconds > 0
      ? runtimeHalfSeconds
      : Number(bundle?.metadata?.halfDuration ?? 2700) || 2700,
  )
  const matchSeconds = halfSeconds * 2
  return {
    halfSeconds,
    matchSeconds,
    runtimeMinutes: round(matchSeconds / 60, 2),
    matchMinutes: 90,
    durationFactor: matchSeconds / (90 * 60),
  }
}

function getBundleRuntimeProvenance(bundle) {
  const metadata = bundle?.metadata || {}
  const persistenceAudit = bundle?.persistenceAudit || {}
  const engineRuntimeToken = typeof (bundle?.engineRuntimeToken ?? metadata.engineRuntimeToken) === 'string'
    ? (bundle.engineRuntimeToken ?? metadata.engineRuntimeToken)
    : null
  const engineBootedAtRaw = Number(bundle?.engineBootedAt ?? metadata.engineBootedAt)
  const engineBootedAt = Number.isFinite(engineBootedAtRaw) && engineBootedAtRaw > 0 ? engineBootedAtRaw : null
  const runtimeHalfDurationRaw = Number(metadata.runtimeHalfDuration)
  const runtimeHalfDuration = Number.isFinite(runtimeHalfDurationRaw) && runtimeHalfDurationRaw > 0 ? runtimeHalfDurationRaw : null
  const simulatedHalfDurationRaw = Number(metadata.halfDuration ?? metadata.simulatedHalfDuration)
  const simulatedHalfDuration = Number.isFinite(simulatedHalfDurationRaw) && simulatedHalfDurationRaw > 0 ? simulatedHalfDurationRaw : null
  const matchClockScaleRaw = Number(metadata.matchClockScale)
  const matchClockScale = Number.isFinite(matchClockScaleRaw) && matchClockScaleRaw > 0 ? round(matchClockScaleRaw, 4) : null
  const legacy = !engineRuntimeToken
  return {
    engineRuntimeToken,
    engineBootedAt,
    runtimeHalfDuration,
    simulatedHalfDuration,
    matchClockScale,
    seriesSpeedMul: Number.isFinite(Number(metadata.seriesSpeedMul)) ? Number(metadata.seriesSpeedMul) : null,
    restartDelayGoal: Number.isFinite(Number(metadata.restartDelayGoal)) ? Number(metadata.restartDelayGoal) : null,
    restartDelayHalf: Number.isFinite(Number(metadata.restartDelayHalf)) ? Number(metadata.restartDelayHalf) : null,
    cpuVsCpu: typeof metadata.cpuVsCpu === 'boolean' ? metadata.cpuVsCpu : null,
    interactiveHalftime: typeof metadata.interactiveHalftime === 'boolean' ? metadata.interactiveHalftime : null,
    persistenceStamped: persistenceAudit.runtimeStamped === true,
    normalizedFromSnapshot: persistenceAudit.normalizedFromSnapshot === true,
    legacy,
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function scoreRange(value, target, tolerance) {
  if (!Number.isFinite(value) || !Number.isFinite(target) || !Number.isFinite(tolerance) || tolerance <= 0) return 0
  return clamp01(1 - Math.abs(value - target) / tolerance)
}

function scoreMax(value, maxValue) {
  if (!Number.isFinite(value) || !Number.isFinite(maxValue) || maxValue <= 0) return 0
  return clamp01(1 - value / maxValue)
}

function scoreMin(value, minValue) {
  if (!Number.isFinite(value) || !Number.isFinite(minValue) || minValue <= 0) return 0
  return clamp01(value / minValue)
}

function weightedScore(parts) {
  let totalWeight = 0
  let weighted = 0
  for (const part of parts) {
    const weight = Number(part.weight ?? 0)
    if (weight <= 0) continue
    totalWeight += weight
    weighted += clamp01(Number(part.score ?? 0)) * weight
  }
  return totalWeight > 0 ? round((weighted / totalWeight) * 100, 1) : 0
}

function gradeKpi(score) {
  if (score >= 85) return 'green'
  if (score >= 70) return 'watch'
  return 'red'
}

function summarizeKpis(report) {
  const disabledMetrics = new Set(report.model?.disabledMetrics || [])
  const simpleModelV1 = report.model?.name === 'simple-v1'
  const durationFactor = Number(report.baselines.duration?.durationFactor ?? 1) || 1
  const durationMinutes = Number(report.baselines.duration?.matchMinutes ?? 90) || 90
  const scaleTarget = (value) => value * durationFactor
  const scaleTolerance = (value, floor) => Math.max(floor, value * durationFactor)
  const goals = Number(report.baselines.global.totalGoals.simulated ?? 0)
  const shots = Number(report.baselines.global.totalShots.simulated ?? 0)
  const sot = Number(report.baselines.global.totalShotsOnTarget.simulated ?? 0)
  const corners = Number(report.baselines.global.totalCorners.simulated ?? 0)
  const widthA = Number(report.shape.A.avgWidth ?? 0)
  const widthB = Number(report.shape.B.avgWidth ?? 0)
  const centerNarrowWorst = Math.max(Number(report.shape.A.centerAndNarrowPct ?? 0), Number(report.shape.B.centerAndNarrowPct ?? 0))
  const overloadShareA = Number(report.finalThirdOverloads.A.totalBuckets ?? 0) > 0
    ? Number(report.finalThirdOverloads.A.bucketsWithOverload ?? 0) / Number(report.finalThirdOverloads.A.totalBuckets)
    : 0
  const overloadShareB = Number(report.finalThirdOverloads.B.totalBuckets ?? 0) > 0
    ? Number(report.finalThirdOverloads.B.bucketsWithOverload ?? 0) / Number(report.finalThirdOverloads.B.totalBuckets)
    : 0
  const overloadShare = (overloadShareA + overloadShareB) / 2
  const dangerMarkingSamples = Number(report.dangerMarking?.byTeam?.A?.samples ?? 0) + Number(report.dangerMarking?.byTeam?.B?.samples ?? 0)
  const dangerMarkedPct = dangerMarkingSamples > 0
    ? ((Number(report.dangerMarking.byTeam.A.marked ?? 0) + Number(report.dangerMarking.byTeam.B.marked ?? 0)) / dangerMarkingSamples) * 100
    : 100
  const shotBoxDefenseShots = Number(report.shotBoxDefense?.shots ?? 0)
  const shotBoxEmptyRate = shotBoxDefenseShots > 0
    ? Number(report.shotBoxDefense.emptyBoxShots ?? 0) / shotBoxDefenseShots
    : 0
  const shotCorridorDefenders = shotBoxDefenseShots > 0
    ? Number(report.shotBoxDefense.avgDefendersInCorridor ?? 0)
    : 1.5
  const patternTempoValues = Object.values(report.patternTempo || {})
  const avgPatternTouches = patternTempoValues.length
    ? patternTempoValues.reduce((sum, entry) => sum + Number(entry.avgTouches ?? 0), 0) / patternTempoValues.length
    : 0
  const forcedShotShare = Number(report.shotDecisionSummary.total ?? 0) > 0
    ? Number(report.shotDecisionSummary.forcedShots ?? 0) / Number(report.shotDecisionSummary.total)
    : 0
  const longRangeSot = Number(report.eventStream.longRangeOnTargetCount ?? 0)
  const attackerBackpasses = Number(report.passDecisionSummary.attackerBackpassesInFinalThird ?? 0)
  const zigzagFlips = Number(report.movement.totalLateralFlips ?? 0)

  const baselineFit = {
    score: weightedScore([
      { label: 'goals', score: scoreRange(goals, scaleTarget(2.8), scaleTolerance(2.2, 1.25)), weight: 0.22 },
      { label: 'shots', score: scoreRange(shots, scaleTarget(26), scaleTolerance(9, 1.5)), weight: 0.22 },
      { label: 'shotsOnTarget', score: scoreRange(sot, scaleTarget(9.5), scaleTolerance(5.5, 1)), weight: 0.24 },
      { label: 'longRangeSot', score: scoreMax(longRangeSot, Math.max(1, scaleTarget(4))), weight: 0.16 },
      { label: 'corners', score: scoreRange(corners, scaleTarget(8), scaleTolerance(6, 1)), weight: disabledMetrics.has('corners') ? 0 : 0.16 },
    ]),
    inputs: { goals, shots, shotsOnTarget: sot, longRangeSot, corners, durationMinutes, durationFactor: round(durationFactor, 4), disabledMetrics: [...disabledMetrics] },
    target: disabledMetrics.has('corners')
      ? `simple-v1 runtime-scaled raw stat fit: goals ~${round(scaleTarget(2.8))}, shots ~${round(scaleTarget(26))}, SOT ~${round(scaleTarget(9.5))}; corners disabled`
      : `one-match MLS runtime-scaled raw stat fit: goals ~${round(scaleTarget(2.8))}, shots ~${round(scaleTarget(26))}, SOT ~${round(scaleTarget(9.5))}, corners ~${round(scaleTarget(8))}`,
  }

  const soccerStructure = simpleModelV1
    ? {
        score: 100,
        inputs: {
          widthA,
          widthB,
          centerAndNarrowWorst: centerNarrowWorst,
          finalThirdOverloadShare: round(overloadShare * 100, 1),
          disabledForModel: 'simple-v1',
        },
        target: 'advanced shape/pattern/cross structure is out of scope for simple-v1',
      }
    : {
        score: weightedScore([
          { label: 'teamWidthA', score: scoreMin(widthA, 18), weight: 0.17 },
          { label: 'teamWidthB', score: scoreMin(widthB, 18), weight: 0.17 },
          { label: 'centerAndNarrow', score: scoreMax(centerNarrowWorst, 35), weight: 0.18 },
          { label: 'overloads', score: scoreMin(overloadShare, 0.25), weight: 0.14 },
          { label: 'dangerMarking', score: scoreMin(dangerMarkedPct, 78), weight: 0.12 },
          { label: 'shotBoxDefense', score: Math.min(scoreMin(shotCorridorDefenders, 1.2), scoreMax(shotBoxEmptyRate, 0.35)), weight: 0.10 },
          { label: 'patternTouches', score: scoreMin(avgPatternTouches, 2.0), weight: 0.14 },
          { label: 'realCrosses', score: scoreMin(Number(report.patternCrosses.total ?? 0), 5), weight: 0.10 },
        ]),
        inputs: {
          widthA,
          widthB,
          centerAndNarrowWorst: centerNarrowWorst,
          finalThirdOverloadShare: round(overloadShare * 100, 1),
          dangerMarkedPct: round(dangerMarkedPct, 1),
          shotCorridorDefenders: round(shotCorridorDefenders, 2),
          emptyBoxShotPct: round(shotBoxEmptyRate * 100, 1),
          avgPatternTouches: round(avgPatternTouches, 2),
          realCrosses: Number(report.patternCrosses.total ?? 0),
        },
        target: 'soccer-like structure: width >=18, center+narrow <=35%, overload share >=25%, danger marking >=78%, shot corridor defenders >=1.2, empty-box shots <=35%, pattern touches >=2, real crosses >=5',
      }

  const tuningEfficiency = {
    score: weightedScore([
      { label: 'forcedShotShare', score: scoreMax(forcedShotShare, 0.55), weight: 0.25 },
      { label: 'attackerBackpasses', score: scoreMax(attackerBackpasses, 18), weight: 0.24 },
      { label: 'zigzagFlips', score: scoreMax(zigzagFlips, 90), weight: 0.18 },
      { label: 'directBlockerPasses', score: scoreMax(Number(report.passDecisionSummary.directBlockerPassDecisions ?? 0), 70), weight: 0.18 },
      { label: 'brokenShotRows', score: scoreMax(Number(report.shotDecisionSummary.aiSimpleBrokenPct ?? 0), 10), weight: 0.15 },
    ]),
    inputs: {
      forcedShotSharePct: round(forcedShotShare * 100, 1),
      attackerBackpasses,
      zigzagFlips,
      directBlockerPasses: Number(report.passDecisionSummary.directBlockerPassDecisions ?? 0),
      brokenShotRowsPct: Number(report.shotDecisionSummary.aiSimpleBrokenPct ?? 0),
    },
    target: 'low-tweak debt: forced shots <=55%, final-third backpasses <=18, lateral flips <=90, direct-blocker passes <=70, broken rows <=10%',
  }

  const kpis = {
    baselineFit: { ...baselineFit, grade: gradeKpi(baselineFit.score) },
    soccerStructure: { ...soccerStructure, grade: gradeKpi(soccerStructure.score) },
    tuningEfficiency: { ...tuningEfficiency, grade: gradeKpi(tuningEfficiency.score) },
  }
  const scores = Object.values(kpis).map((entry) => Number(entry.score ?? 0))
  kpis.overall = {
    score: scores.length ? round(scores.reduce((sum, score) => sum + score, 0) / scores.length, 1) : 0,
  }
  kpis.overall.grade = gradeKpi(kpis.overall.score)
  return kpis
}

function buildRecommendations(report) {
  const recommendations = []
  const simpleModelV1 = report.model?.name === 'simple-v1'
  const worstBackpassRate = Math.max(report.passProfile.A.backwardPct, report.passProfile.B.backwardPct)
  const centerAndNarrowWorst = Math.max(report.shape.A.centerAndNarrowPct, report.shape.B.centerAndNarrowPct)
  const longRangeOnTarget = report.eventStream.longRangeOnTargetCount
  const toePokesOnTarget = report.eventStream.toePokesOnTargetCount
  const totalOnTargetDrift = report.baselines.global.totalShotsOnTarget.drift
  const attackerBackpasses = report.passDecisionSummary.attackerBackpassesInFinalThird
  const zigzagFlips = report.movement?.totalLateralFlips ?? 0
  const zigzagOffender = report.movement?.topZigzagOffenders?.[0] || null
  const topBoxLoiterer = report.boxBehavior?.topBoxLoiterers?.[0] || null
  const brokenAiSimpleRows = report.shotDecisionSummary.aiSimpleBrokenRows ?? 0
  const forcedBrokenAiSimpleRows = report.shotDecisionSummary.forcedAiSimpleBrokenRows ?? 0
  const brokenAiSimplePct = report.shotDecisionSummary.aiSimpleBrokenPct ?? 0
  const dangerMarkedWorst = Math.min(
    report.dangerMarking?.byTeam?.A?.samples ? report.dangerMarking.byTeam.A.markedPct : 100,
    report.dangerMarking?.byTeam?.B?.samples ? report.dangerMarking.byTeam.B.markedPct : 100,
  )
  const emptyShotBoxRate = report.shotBoxDefense?.shots
    ? report.shotBoxDefense.emptyBoxShots / report.shotBoxDefense.shots
    : 0
  const totalShots = Number(report.baselines.global.totalShots.simulated ?? 0)
  const totalShotsOnTarget = Number(report.baselines.global.totalShotsOnTarget.simulated ?? 0)
  const totalGoals = Number(report.baselines.global.totalGoals.simulated ?? 0)
  const totalPasses = Math.max(
    Number(report.counts.passLog ?? 0),
    Number(report.match.passesA ?? 0) + Number(report.match.passesB ?? 0),
  )
  const durationFactor = Number(report.baselines.duration?.durationFactor ?? 1) || 1
  const runtimeShotMin = round(20 * durationFactor)
  const runtimeShotOnTargetMin = round(7 * durationFactor)
  const runtimePassMin = round(900 * durationFactor)
  const runtimePassMax = round(954 * durationFactor)

  if (totalShots === 0) {
    recommendations.push(`Completed match has 0 shots despite ${totalPasses} pass events. Treat this as a model failure: goalmouth smothers, final-third backpasses, or low shot urge consumed all attacking production.`)
  }
  if (totalShots > 0 && totalShots < runtimeShotMin) {
    recommendations.push(`Runtime-scaled attacking volume is too low: ${totalShots} shots vs the ${runtimeShotMin}-${round(35 * durationFactor)} MLS target for ${report.baselines.duration.runtimeMinutes} runtime minutes.`)
  }
  if (totalShotsOnTarget < runtimeShotOnTargetMin) {
    recommendations.push(`Runtime-scaled shot-on-target volume is too low: ${totalShotsOnTarget} SOT vs the ${runtimeShotOnTargetMin}-${round(16 * durationFactor)} MLS target for ${report.baselines.duration.runtimeMinutes} runtime minutes.`)
  }
  if (totalPasses > 0 && totalPasses < runtimePassMin) {
    recommendations.push(`Runtime-scaled pass volume is too low: ${totalPasses} passes vs the ${runtimePassMin}-${runtimePassMax} target for ${report.baselines.duration.runtimeMinutes} runtime minutes.`)
  }
  if (totalGoals === 0 && totalShots < 10) {
    recommendations.push('Scoreless output with very low shot volume is not a defensive 0-0; it is an underproduction failure. Tune shot creation first, then finishing.')
  }
  if (forcedBrokenAiSimpleRows >= 3 || brokenAiSimplePct >= 20) {
    recommendations.push('AI_SIMPLE shot decisions are still collapsing into zeroed/null evaluation rows. Separate computed shot/pass values from forced overrides and block forced shots when the real evaluation is missing.')
  }
  if (totalOnTargetDrift > 4 || longRangeOnTarget >= 3) {
    recommendations.push('Long-range shot accuracy is still too clean. Push more off-frame bias onto 20+ yard attempts, especially central shots and pressured strikes.')
  }
  if (toePokesOnTarget >= 2) {
    recommendations.push('TOE_POKE finishes are still too reliable. Add more miss tendency and weaker on-frame bias for toe-poke shots outside true tap-in range.')
  }
  if (attackerBackpasses > 12 || worstBackpassRate > 18) {
    recommendations.push('Final-third recycling is still too common. Tighten attacker backpass vetoes and extend the carry-or-shoot window before resets are allowed.')
  }
  if (!simpleModelV1 && (centerAndNarrowWorst > 30 || report.shape.A.avgWidth < 18 || report.shape.B.avgWidth < 18)) {
    recommendations.push('Shape is still too central. Strengthen weak-side width anchors and reduce carrier-gravity pull on wide roles and midfield support.')
  }
  if (!simpleModelV1 && dangerMarkedWorst < 70) {
    recommendations.push('Danger-zone attackers are still too often unmarked. Tighten goal-side marking assignments for box, cutback, and far-post runners without pulling the ball presser out of shape.')
  }
  if (!simpleModelV1 && report.shotBoxDefense?.shots >= 3 && emptyShotBoxRate > 0.25) {
    recommendations.push('Too many shots are arriving with an empty defensive box. Keep one presser, but pull two non-pressing defenders into the goal corridor when the carrier reaches shooting range.')
  }
  if (!simpleModelV1 && ((report.roleCentrality.A.wideShotShareVsCentral ?? 0) < 0.2 || (report.roleCentrality.B.wideShotShareVsCentral ?? 0) < 0.2)) {
    recommendations.push('Too much of the final action still comes through central roles. Encourage wider occupation and more wing-led creation before the finish.')
  }
  if (!simpleModelV1 && report.baselines.global.totalCorners.simulated <= 1) {
    recommendations.push('Corner volume is still unrealistically low. Review deflection, blocked-shot, and out-of-play logic so wider attacks can produce restarts naturally.')
  }
  if (report.shotSupport.some((shot) => shot.nearestMid !== null && shot.nearestMid > 12)) {
    recommendations.push('Some shots still lack second-wave support. Nudge nearby midfielders to arrive a little earlier into the edge-of-box support band.')
  }
  if (zigzagFlips >= 12 || (zigzagOffender && zigzagOffender.lateralFlips >= 4)) {
    recommendations.push('Carrier zigzagging is still present. Reduce repeated lateral sign flips by holding the current carry lane longer and tightening the link between desired heading, facing heading, and actual movement heading.')
  }
  if (topBoxLoiterer && (topBoxLoiterer.maxBoxCampSeconds >= 0.5 || topBoxLoiterer.maxBoxIdleSeconds >= 0.4 || topBoxLoiterer.maxBoxDwellSeconds >= 1.2)) {
    recommendations.push('Attackers are still lingering in the opponent box. Force dynamic box roles so extra attackers vacate, rotate, or resolve instead of standing in occupied central lanes.')
  }
  if (recommendations.length === 0) {
    recommendations.push('No major red flags detected in this latest bundle. Run a few more matches and compare whether the same patterns repeat before retuning again.')
  }

  return recommendations
}

function isGhostBundleRow(row) {
  if (!row?.bundle_json) return false
  try {
    const bundle = JSON.parse(row.bundle_json)
    if (bundle?.sessionActive === false) return true
    const teamA = String(row.team_a_name || bundle?.teamA?.name || '')
    const teamB = String(row.team_b_name || bundle?.teamB?.name || '')
    const phase = String(row.phase || bundle?.phase || '')
    const matchId = String(bundle?.matchId || bundle?.metadata?.matchId || '').trim()
    return teamA === 'Inter Miami' && teamB === 'LA Galaxy' && phase === 'FULL_TIME' && !matchId
  } catch {
    return false
  }
}

function findBundleRow(db, options) {
  if (options.sessionId) {
    const row = db.prepare(`
      SELECT session_id, timestamp, team_a_name, team_b_name, phase, bundle_json
      FROM match_results
      WHERE session_id = ?
      LIMIT 1
    `).get(options.sessionId)
    return row && !isGhostBundleRow(row) ? row : null
  }

  if (options.homeTeam && options.awayTeam) {
    const home = normalizeTeamName(options.homeTeam).toLowerCase()
    const away = normalizeTeamName(options.awayTeam).toLowerCase()
    const rows = db.prepare(`
      SELECT session_id, timestamp, team_a_name, team_b_name, phase, bundle_json
      FROM match_results
      ORDER BY timestamp DESC
      LIMIT 250
    `).all()
    return rows.find((row) => {
      if (isGhostBundleRow(row)) return false
      const a = normalizeTeamName(row.team_a_name).toLowerCase()
      const b = normalizeTeamName(row.team_b_name).toLowerCase()
      return (a === home && b === away) || (a === away && b === home)
    }) || null
  }

  const latestRows = db.prepare(`
    SELECT session_id, timestamp, team_a_name, team_b_name, phase, bundle_json
    FROM match_results
    ORDER BY timestamp DESC
    LIMIT 250
  `).all()
  return latestRows.find((row) => !isGhostBundleRow(row)) || null
}

function writeReportFile(reportJson, reportMd, report, markdown) {
  const outJson = path.resolve(process.cwd(), reportJson)
  const outMd = path.resolve(process.cwd(), reportMd)
  fs.mkdirSync(path.dirname(outJson), { recursive: true })
  fs.mkdirSync(path.dirname(outMd), { recursive: true })
  fs.writeFileSync(outJson, JSON.stringify(report, null, 2))
  fs.writeFileSync(outMd, markdown)
}

function buildBundleFromHeadlessResult(report, result, index) {
  const tuning = result?.tuning && typeof result.tuning === 'object' ? result.tuning : {}
  const metadata = tuning.metadata || {}
  return {
    ...tuning,
    matchId: metadata.matchId || `headless-${path.basename(report.__sourcePath || 'sim-report')}-${index}`,
    sessionActive: true,
    teamA: {
      name: result.teamA,
      score: result.scoreA ?? 0,
      shots: result.shotsA ?? 0,
      shotsOnTarget: result.sogA ?? 0,
      saves: result.savesA ?? 0,
      passes: result.passesA ?? 0,
      passesCompleted: result.passCompA ?? 0,
      passCompletions: result.passCompA ?? 0,
      tackles: result.tacklesA ?? 0,
      clearances: result.clearancesA ?? 0,
      fouls: result.foulsA ?? 0,
      offsides: result.offsidesA ?? 0,
      corners: result.cornersA ?? 0,
      freeKicks: result.freeKicksA ?? 0,
      possession: result.possA ?? 0,
      roles: tuning.roleStatsA || {},
    },
    teamB: {
      name: result.teamB,
      score: result.scoreB ?? 0,
      shots: result.shotsB ?? 0,
      shotsOnTarget: result.sogB ?? 0,
      saves: result.savesB ?? 0,
      passes: result.passesB ?? 0,
      passesCompleted: result.passCompB ?? 0,
      passCompletions: result.passCompB ?? 0,
      tackles: result.tacklesB ?? 0,
      clearances: result.clearancesB ?? 0,
      fouls: result.foulsB ?? 0,
      offsides: result.offsidesB ?? 0,
      corners: result.cornersB ?? 0,
      freeKicks: result.freeKicksB ?? 0,
      possession: result.possB ?? 0,
      roles: tuning.roleStatsB || {},
    },
    goalLog: Array.isArray(tuning.goalLog) ? tuning.goalLog : (Array.isArray(result.goals) ? result.goals : []),
    passLog: Array.isArray(tuning.passLog) ? tuning.passLog : [],
    shotDecisions: Array.isArray(tuning.shotDecisions) ? tuning.shotDecisions : [],
    passDecisions: Array.isArray(tuning.passDecisions) ? tuning.passDecisions : [],
  }
}

function loadBundleRowFromFile(filePath, resultIndex) {
  const resolved = path.resolve(process.cwd(), filePath)
  const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'))
  parsed.__sourcePath = resolved
  if (parsed.model === 'simple-v1' && parsed.summary && Array.isArray(parsed.results) && resultIndex < 0) {
    const summary = parsed.summary
    const teamAPossession = Number(summary.possessionA ?? 50)
    const passesPerTeam = Number(summary.passes ?? 0) / 2
    const passCompletionPerTeam = passesPerTeam * (Number(summary.passCompletionPct ?? 0) / 100)
    const bundle = {
      matchId: `simple-model-kpi-aggregate-${path.basename(resolved)}`,
      sessionActive: true,
      events: [],
      passLog: [],
      shotDecisions: [],
      passDecisions: [],
      shapeA: [],
      shapeB: [],
      goalLog: [],
      tuning: {
        model: 'simple-v1',
        disabledRules: [],
      },
      telemetry: {
        disabledMetrics: [],
      },
      metadata: {
        model: 'simple-v1',
        sessionId: `simple-kpi-aggregate:${path.basename(resolved)}`,
        generatedAt: Date.parse(parsed.generatedAt || '') || Date.now(),
        games: summary.games,
      },
      teamA: {
        name: 'Simple Model Aggregate',
        score: Number(summary.goals ?? 0) / 2,
        shots: Number(summary.shots ?? 0) / 2,
        shotsOnTarget: Number(summary.shotsOnTarget ?? 0) / 2,
        saves: Number(summary.saves ?? 0) / 2,
        passes: passesPerTeam,
        passesCompleted: passCompletionPerTeam,
        passCompletions: passCompletionPerTeam,
        tackles: Number(summary.tackles ?? 0),
        fouls: Number(summary.fouls ?? 0),
        offsides: Number(summary.offsides ?? 0),
        corners: Number(summary.corners ?? 0),
        freeKicks: Number(summary.freeKicks ?? 0),
        possession: teamAPossession,
        roles: {},
      },
      teamB: {
        name: 'MLS KPI Target',
        score: Number(summary.goals ?? 0) / 2,
        shots: Number(summary.shots ?? 0) / 2,
        shotsOnTarget: Number(summary.shotsOnTarget ?? 0) / 2,
        saves: Number(summary.saves ?? 0) / 2,
        passes: passesPerTeam,
        passesCompleted: passCompletionPerTeam,
        passCompletions: passCompletionPerTeam,
        corners: 0,
        freeKicks: 0,
        tackles: 0,
        fouls: 0,
        offsides: 0,
        possession: 100 - teamAPossession,
        roles: {},
      },
    }
    return {
      session_id: bundle.metadata.sessionId,
      timestamp: bundle.metadata.generatedAt,
      team_a_name: bundle.teamA.name,
      team_b_name: bundle.teamB.name,
      bundle_json: JSON.stringify(bundle),
    }
  }
  if (Array.isArray(parsed.results)) {
    const index = Number.isInteger(resultIndex) && resultIndex >= 0
      ? resultIndex
      : parsed.results.length - 1
    const result = parsed.results[index]
    if (!result) throw new Error(`No result at index ${index} in ${resolved}`)
    const bundle = buildBundleFromHeadlessResult(parsed, result, index)
    return {
      session_id: result.sessionId || `headless-report:${path.basename(resolved)}:${index}`,
      timestamp: bundle.metadata?.timestamp || Date.parse(parsed.generatedAt || '') || Date.now(),
      team_a_name: result.teamA || bundle.metadata?.teamAName || 'Team A',
      team_b_name: result.teamB || bundle.metadata?.teamBName || 'Team B',
      bundle_json: JSON.stringify(bundle),
    }
  }
  const bundle = parsed.bundle || parsed
  return {
    session_id: bundle.metadata?.sessionId || bundle.matchId || `bundle-file:${path.basename(resolved)}`,
    timestamp: bundle.metadata?.timestamp || Date.now(),
    team_a_name: bundle.teamA?.name || bundle.metadata?.teamAName || 'Team A',
    team_b_name: bundle.teamB?.name || bundle.metadata?.teamBName || 'Team B',
    bundle_json: JSON.stringify(bundle),
  }
}

function formatEventBullet(event) {
  const bits = []
  if (event.minute !== undefined && event.minute !== null) bits.push(`${event.minute}'`)
  if (event.style) bits.push(event.style)
  if (event.distYards !== undefined) bits.push(`${event.distYards}y`)
  if (event.angle !== undefined) bits.push(`angle ${event.angle}`)
  if (event.pressure !== undefined) bits.push(`pressure ${event.pressure}`)
  if (event.goal) bits.push('goal')
  if (event.onTarget) bits.push('on target')
  return bits.join(', ')
}

function buildMarkdownReport(report) {
  const global = report.baselines.global
  const duration = report.baselines.duration || { matchMinutes: 90, halfSeconds: 2700, durationFactor: 1 }
  const provenance = report.match.runtimeProvenance || {}
  const teamA = report.match.teamA
  const teamB = report.match.teamB
  const lines = [
    `# Telemetry Analysis`,
    ``,
    `## Match`,
    `- Fixture: ${teamA} ${report.match.score} ${teamB}`,
    `- Session: ${report.match.sessionId}`,
    `- Timestamp: ${new Date(report.match.timestamp).toISOString()}`,
    `- Runtime duration: ${duration.runtimeMinutes} minutes total (${duration.halfSeconds}s halves)`,
    `- Simulated match duration: ${duration.matchMinutes} minutes`,
    `- Runtime provenance: ${provenance.engineRuntimeToken ? `token ${provenance.engineRuntimeToken}` : 'legacy / unstamped'}${provenance.engineBootedAt ? `, booted ${new Date(provenance.engineBootedAt).toISOString()}` : ''}`,
    `- Runtime config: scale ${provenance.matchClockScale ?? 'n/a'}, speed ${provenance.seriesSpeedMul ?? 'n/a'}, restart delays ${provenance.restartDelayGoal ?? 'n/a'}/${provenance.restartDelayHalf ?? 'n/a'}, cpuVsCpu ${provenance.cpuVsCpu ?? 'n/a'}, interactive halftime ${provenance.interactiveHalftime ?? 'n/a'}, persisted from snapshot ${provenance.normalizedFromSnapshot ? 'yes' : 'no'}`,
    `- Shots: ${report.match.shotsA}-${report.match.shotsB}`,
    `- Shots on target: ${report.match.shotsOnTargetA}-${report.match.shotsOnTargetB}`,
    ``,
    `## Tuning KPIs`,
    `- Overall: ${report.kpis.overall.score} (${report.kpis.overall.grade})`,
    `- Baseline Fit: ${report.kpis.baselineFit.score} (${report.kpis.baselineFit.grade}) — ${report.kpis.baselineFit.target}`,
    `  - Inputs: goals ${report.kpis.baselineFit.inputs.goals}, shots ${report.kpis.baselineFit.inputs.shots}, SOT ${report.kpis.baselineFit.inputs.shotsOnTarget}, long-range SOT ${report.kpis.baselineFit.inputs.longRangeSot}, corners ${report.kpis.baselineFit.inputs.corners}`,
    `- Soccer Structure: ${report.kpis.soccerStructure.score} (${report.kpis.soccerStructure.grade}) — ${report.kpis.soccerStructure.target}`,
    `  - Inputs: width ${report.kpis.soccerStructure.inputs.widthA}/${report.kpis.soccerStructure.inputs.widthB}, center+narrow worst ${report.kpis.soccerStructure.inputs.centerAndNarrowWorst}%, overload share ${report.kpis.soccerStructure.inputs.finalThirdOverloadShare}%, danger marked ${report.kpis.soccerStructure.inputs.dangerMarkedPct}%, shot corridor defenders ${report.kpis.soccerStructure.inputs.shotCorridorDefenders}, empty-box shots ${report.kpis.soccerStructure.inputs.emptyBoxShotPct}%, pattern touches ${report.kpis.soccerStructure.inputs.avgPatternTouches}, real crosses ${report.kpis.soccerStructure.inputs.realCrosses}`,
    `- Tuning Efficiency: ${report.kpis.tuningEfficiency.score} (${report.kpis.tuningEfficiency.grade}) — ${report.kpis.tuningEfficiency.target}`,
    `  - Inputs: forced shots ${report.kpis.tuningEfficiency.inputs.forcedShotSharePct}%, final-third backpasses ${report.kpis.tuningEfficiency.inputs.attackerBackpasses}, zigzag flips ${report.kpis.tuningEfficiency.inputs.zigzagFlips}, direct-blocker passes ${report.kpis.tuningEfficiency.inputs.directBlockerPasses}, broken shot rows ${report.kpis.tuningEfficiency.inputs.brokenShotRowsPct}%`,
    ``,
    `## MLS Baseline Comparison`,
    `- Baselines below are runtime-scaled MLS raw expectations for ${duration.runtimeMinutes} runtime minutes.`,
    `- Total goals: ${global.totalGoals.simulated} vs ${global.totalGoals.baseline} baseline (drift ${global.totalGoals.drift})`,
    `- Total shots: ${global.totalShots.simulated} vs ${global.totalShots.baseline} baseline (drift ${global.totalShots.drift})`,
    `- Total shots on target: ${global.totalShotsOnTarget.simulated} vs ${global.totalShotsOnTarget.baseline} baseline (drift ${global.totalShotsOnTarget.drift})`,
    `- Total corners: ${global.totalCorners.simulated} vs ${global.totalCorners.baseline} baseline (drift ${global.totalCorners.drift})`,
    ``,
    `## Match Summary Telemetry`,
    `- Event count: ${report.counts.events}`,
    `- Pass log events: ${report.counts.passLog}`,
    `- Carrier traces: ${report.counts.carrierTraces}`,
    `- Attacker zone traces: ${report.counts.attackerZoneTraces}`,
    `- Shot decisions: ${report.counts.shotDecisions}`,
    `- Pass decisions: ${report.counts.passDecisions}`,
    `- Interceptions: ${report.counts.interceptions}`,
    `- Tackles: ${report.counts.tackles}`,
    `- Fouls: ${report.counts.fouls}`,
    `- Offsides: ${report.counts.offsides}`,
    `- Turnovers: ${report.counts.turnovers}`,
    `- Keeper saves: ${report.keeperSummary.byTeam.A.saves}-${report.keeperSummary.byTeam.B.saves}`,
    `- Restart counters: corners ${report.restartSummary.total.corners}, throw-ins ${report.restartSummary.total.throwIns}, goal kicks ${report.restartSummary.total.goalKicks}, free kicks ${report.restartSummary.total.freeKicks}, penalties ${report.restartSummary.total.penalties}`,
    ``,
    `## Decision Telemetry`,
    `- Forced shots: ${report.shotDecisionSummary.forcedShots} of ${report.shotDecisionSummary.total}`,
    `- AI_SIMPLE broken rows: ${report.shotDecisionSummary.aiSimpleBrokenRows} of ${report.shotDecisionSummary.aiSimpleDecisions}`,
    `- AI_SIMPLE forced broken rows: ${report.shotDecisionSummary.forcedAiSimpleBrokenRows}`,
    `- Long-range shot decisions: ${report.shotDecisionSummary.longRangeDecisions}`,
    `- Pressured long-range shot decisions: ${report.shotDecisionSummary.pressuredLongRangeDecisions}`,
    `- Attacker final-third backpasses: ${report.passDecisionSummary.attackerBackpassesInFinalThird}`,
    `- Attacker in-box backpasses: ${report.passDecisionSummary.attackerBackpassesInBox}`,
    `- Direct-blocker pass decisions: ${report.passDecisionSummary.directBlockerPassDecisions}`,
    ``,
    `## Movement / Facing`,
    `- Carrier traces analyzed: ${report.movement.carrierTraceCount}`,
    `- Carriers tracked: ${report.movement.carriersTracked}`,
    `- Forward-carry samples: ${report.movement.totalForwardCarrySamples}`,
    `- Lateral direction flips: ${report.movement.totalLateralFlips}`,
    `- Avg forward progress per flip: ${report.movement.avgForwardProgressPerFlip}`,
    `- Switch requests: ${report.movement.totalSwitchRequests}`,
    `- Blocked switch requests: ${report.movement.totalBlockedSwitches}`,
    `- Carry lock samples: ${report.movement.totalCarryLockSamples}`,
    `- Facing vs movement mismatch: ${report.movement.facingMovementMismatchPct}%`,
    `- Desired vs steer mismatch: ${report.movement.desiredSteerMismatchPct}%`,
    ``,
    `## Box Behavior`,
    `- Box traces analyzed: ${report.boxBehavior.totalBoxTraces}`,
    `- Attackers tracked in box: ${report.boxBehavior.playersTracked}`,
    ``,
    `## Heat Map / Shape`,
    `- ${teamA}: avg width ${report.shape.A.avgWidth}, avg |avgZ| ${report.shape.A.avgAbsAvgZ}, center-locked ${report.shape.A.centerLockedPct}%, center+narrow ${report.shape.A.centerAndNarrowPct}%`,
    `- ${teamB}: avg width ${report.shape.B.avgWidth}, avg |avgZ| ${report.shape.B.avgAbsAvgZ}, center-locked ${report.shape.B.centerLockedPct}%, center+narrow ${report.shape.B.centerAndNarrowPct}%`,
    `- ${teamA} wide touches vs central touches: ${report.roleCentrality.A.wideTouches} vs ${report.roleCentrality.A.centralTouches}`,
    `- ${teamB} wide touches vs central touches: ${report.roleCentrality.B.wideTouches} vs ${report.roleCentrality.B.centralTouches}`,
    `- ${teamA} wide shots vs central shots: ${report.roleCentrality.A.wideShots} vs ${report.roleCentrality.A.centralShots}`,
    `- ${teamB} wide shots vs central shots: ${report.roleCentrality.B.wideShots} vs ${report.roleCentrality.B.centralShots}`,
    `- Position owner samples: ${report.positionOwners.samples}`,
    `- ${teamA} owner mix: ${Object.entries(report.positionOwners.byTeam.A).map(([owner, count]) => `${owner}:${count}`).join(' | ') || '(none)'}`,
    `- ${teamB} owner mix: ${Object.entries(report.positionOwners.byTeam.B).map(([owner, count]) => `${owner}:${count}`).join(' | ') || '(none)'}`,
    `- ${teamA} wide owner avg |z| ${report.positionOwners.wide.A.avgAbsZ}, target |z| ${report.positionOwners.wide.A.avgTargetAbsZ}: ${Object.entries(report.positionOwners.wide.A.byOwner).map(([owner, count]) => `${owner}:${count}`).join(' | ') || '(none)'}`,
    `- ${teamB} wide owner avg |z| ${report.positionOwners.wide.B.avgAbsZ}, target |z| ${report.positionOwners.wide.B.avgTargetAbsZ}: ${Object.entries(report.positionOwners.wide.B.byOwner).map(([owner, count]) => `${owner}:${count}`).join(' | ') || '(none)'}`,
    ``,
    `## Phase Time Distribution`,
    `- ${teamA}: buildup ${report.phaseTime.A.buildupPct}% | progression ${report.phaseTime.A.progressionPct}% | chance ${report.phaseTime.A.chanceCreationPct}% | finish ${report.phaseTime.A.finishPct}% (${report.phaseTime.A.samples} samples)`,
    `- ${teamB}: buildup ${report.phaseTime.B.buildupPct}% | progression ${report.phaseTime.B.progressionPct}% | chance ${report.phaseTime.B.chanceCreationPct}% | finish ${report.phaseTime.B.finishPct}% (${report.phaseTime.B.samples} samples)`,
    ``,
    `## Pass Decisions By Zone`,
    `- Evaluated: ${Object.entries(report.passByZone.evaluated).map(([z, c]) => `${z}:${c}`).join(' | ')}`,
    `- Executed (shouldPass): ${Object.entries(report.passByZone.executed).map(([z, c]) => `${z}:${c}`).join(' | ')}`,
    ``,
    `## Pattern Tempo (realism fit per pattern type)`,
    ...(report.patternTempo
      ? Object.entries(report.patternTempo).map(([type, v]) => {
          const expT = v.expectedTouches ? `${v.expectedTouches[0]}-${v.expectedTouches[1]}` : 'n/a'
          const expP = v.expectedPace ? `${v.expectedPace[0]}-${v.expectedPace[1]}u/s` : 'n/a'
          return `- ${type} (${v.count}x): touches ${v.avgTouches} [${v.touchFit} vs ${expT}], pace ${v.avgPace}u/s [${v.paceFit} vs ${expP}], duration ${v.avgDuration}s ${v.expectedLabel ? '— expected ' + v.expectedLabel : ''}`
        })
      : ['(no pattern tempo data)']),
    ``,
    `## Neo-Play Effectiveness`,
    `- Starts: ${report.neoPlays.totalStarts}; deliveries: ${report.neoPlays.totalDeliveries}; shot-producing deliveries: ${report.neoPlays.totalShotCreatingDeliveries} (${report.neoPlays.effectivenessPct}%); goal-producing deliveries: ${report.neoPlays.totalGoalCreatingDeliveries} (${report.neoPlays.goalRatePct}%)`,
    ...(Object.values(report.neoPlays.byPlay || {}).length
      ? Object.values(report.neoPlays.byPlay).map((v) => `- ${v.playName}: starts ${v.starts}, deliveries ${v.deliveries}, crosses ${v.crosses}, effective ${v.shotCreatingDeliveries}/${v.deliveries} (${v.effectivenessPct}%), goals ${v.goalCreatingDeliveries}/${v.deliveries} (${v.goalRatePct}%)`)
      : ['(no neo-play delivery data)']),
    ``,
    `## Defenders In Box At Goal (defensive presence)`,
    `- Goals: ${report.defendersInBoxAtGoal.goalCount}, avg ${report.defendersInBoxAtGoal.avgDefendersInBox} defenders + ${report.defendersInBoxAtGoal.avgAttackersInBox} attackers in box at moment of goal`,
    `- Distribution: ${Object.entries(report.defendersInBoxAtGoal.distribution).sort((a, b) => Number(a[0]) - Number(b[0])).map(([n, c]) => `${n} defenders: ${c} goals`).join(', ') || '(none)'}`,
    ...(report.defendersInBoxAtGoal.samples.length > 0
      ? [`- Samples:`, ...report.defendersInBoxAtGoal.samples.map((s) => `  - ${s.team} ${s.scorer} #${s.shirt} @ ${s.minute}': ${s.defendersInBox} defenders, ${s.attackersInBox} attackers (${s.playPattern}${s.isBreakaway ? ', breakaway' : ''})`)]
      : []),
    ``,
    `## Shot Box Defense`,
    `- Shots sampled: ${report.shotBoxDefense.shots}`,
    `- Avg defenders in box: ${report.shotBoxDefense.avgDefendersInBox}`,
    `- Avg defenders in goal corridor: ${report.shotBoxDefense.avgDefendersInCorridor}`,
    `- Empty-box shots: ${report.shotBoxDefense.emptyBoxShots}`,
    `- Empty-corridor shots: ${report.shotBoxDefense.emptyCorridorShots}`,
    ...(report.shotBoxDefense.samples.length > 0
      ? [`- Samples:`, ...report.shotBoxDefense.samples.map((s) => `  - Team ${s.team} ${s.shooter} ${s.shooterRole} @ ${s.t}s: ${s.defendersInBox} box, ${s.defendersInCorridor} corridor defenders`)]
      : []),
    ``,
    `## Final-Third Overloads (attacking commitment)`,
    `- ${teamA}: ${report.finalThirdOverloads.A.bucketsWithOverload}/${report.finalThirdOverloads.A.totalBuckets} 1s-windows had 3+ attackers in opp final third (max ${report.finalThirdOverloads.A.maxAttackersInBucket})`,
    `- ${teamB}: ${report.finalThirdOverloads.B.bucketsWithOverload}/${report.finalThirdOverloads.B.totalBuckets} 1s-windows had 3+ attackers in opp final third (max ${report.finalThirdOverloads.B.maxAttackersInBucket})`,
    ``,
    `## Danger-Zone Marking`,
    `- Samples: ${report.dangerMarking.samples}`,
    `- ${teamA} attackers marked: ${report.dangerMarking.byTeam.A.marked}/${report.dangerMarking.byTeam.A.samples} (${report.dangerMarking.byTeam.A.markedPct}%), avg nearest defender ${report.dangerMarking.byTeam.A.avgNearestDefenderDist}`,
    `- ${teamB} attackers marked: ${report.dangerMarking.byTeam.B.marked}/${report.dangerMarking.byTeam.B.samples} (${report.dangerMarking.byTeam.B.markedPct}%), avg nearest defender ${report.dangerMarking.byTeam.B.avgNearestDefenderDist}`,
    ...(report.dangerMarking.byTeam.A.worstSamples.length + report.dangerMarking.byTeam.B.worstSamples.length > 0
      ? [
          `- Worst unmarked samples:`,
          ...report.dangerMarking.byTeam.A.worstSamples.slice(0, 3).map((s) => `  - ${teamA} ${s.player} ${s.role} @ ${s.t}s: nearest defender ${s.nearestDefenderDist}, ${s.distToGoal}u from goal (${s.patternRole})`),
          ...report.dangerMarking.byTeam.B.worstSamples.slice(0, 3).map((s) => `  - ${teamB} ${s.player} ${s.role} @ ${s.t}s: nearest defender ${s.nearestDefenderDist}, ${s.distToGoal}u from goal (${s.patternRole})`),
        ]
      : []),
    ``,
    `## Multi-Touch Opp-Half Sequences (build-up quality)`,
    `- Sequences with 2+ distinct players touching ball in opp half: ${report.multiTouchOppHalf.multiTouchOppHalfCount} of ${report.multiTouchOppHalf.totalSequences}`,
    `- Opp-half touches total: ${report.multiTouchOppHalf.totalOppHalfTouches}`,
    `- Avg distinct players per possession: ${report.multiTouchOppHalf.avgDistinctPlayersPerSequence}`,
    ...(report.multiTouchOppHalf.exampleSequences.length > 0
      ? [`- Examples:`, ...report.multiTouchOppHalf.exampleSequences.map((ex) => `  - Team ${ex.team} @ ${ex.firstTouchAt?.toFixed(1)}s: ${ex.touchCount} touches by ${ex.players.join(' → ')}`)]
      : []),
    ``,
    `## Kickoff Receiver / Goal Correlation`,
    `- Kickoff passes recorded: ${report.kickoffGoalCorrelation.kickoffPasses}; kickoff receives recorded: ${report.kickoffGoalCorrelation.kickoffReceives}; scorer events: ${report.kickoffGoalCorrelation.goalScorerEvents}`,
    `- ${teamA}: ${report.kickoffGoalCorrelation.byTeam.A.sameAsLatestKickoffReceiverGoals}/${report.kickoffGoalCorrelation.byTeam.A.goals} goals scored by latest kickoff receiver (${report.kickoffGoalCorrelation.byTeam.A.sameAsLatestKickoffReceiverPct}%)`,
    `- ${teamB}: ${report.kickoffGoalCorrelation.byTeam.B.sameAsLatestKickoffReceiverGoals}/${report.kickoffGoalCorrelation.byTeam.B.goals} goals scored by latest kickoff receiver (${report.kickoffGoalCorrelation.byTeam.B.sameAsLatestKickoffReceiverPct}%)`,
    `- ${teamA} kickoff receivers: ${report.kickoffGoalCorrelation.byTeam.A.receivers.map((r) => `${r.player} ${r.role || ''} recv:${r.actualReceives} intended:${r.intendedTargets} goals:${r.goalsAfterLatestKickoffReceive}`).join(' | ') || '(none)'}`,
    `- ${teamB} kickoff receivers: ${report.kickoffGoalCorrelation.byTeam.B.receivers.map((r) => `${r.player} ${r.role || ''} recv:${r.actualReceives} intended:${r.intendedTargets} goals:${r.goalsAfterLatestKickoffReceive}`).join(' | ') || '(none)'}`,
    ...(report.kickoffGoalCorrelation.byTeam.A.samples.length + report.kickoffGoalCorrelation.byTeam.B.samples.length > 0
      ? [
          `- Samples:`,
          ...report.kickoffGoalCorrelation.byTeam.A.samples.map((s) => `  - ${teamA} goal ${s.scorer} @ ${s.minute ?? '?'}': latest kickoff receiver ${s.kickoffReceiver}, same=${s.samePlayer}, ${s.secondsToGoal}s later`),
          ...report.kickoffGoalCorrelation.byTeam.B.samples.map((s) => `  - ${teamB} goal ${s.scorer} @ ${s.minute ?? '?'}': latest kickoff receiver ${s.kickoffReceiver}, same=${s.samePlayer}, ${s.secondsToGoal}s later`),
        ]
      : []),
    ``,
    `## Pattern Engine (Phase 2.5)`,
    `- Total pattern starts: ${report.patterns.totalStarts} (A ${report.patterns.patternsPerTeamA}, B ${report.patterns.patternsPerTeamB})`,
    `- Distinct types per team: A ${report.patterns.distinctTypesA}, B ${report.patterns.distinctTypesB}`,
    `- Types A: ${Object.entries(report.patterns.typesPerTeam.A || {}).map(([t, c]) => `${t}:${c}`).join(', ') || '(none)'}`,
    `- Types B: ${Object.entries(report.patterns.typesPerTeam.B || {}).map(([t, c]) => `${t}:${c}`).join(', ') || '(none)'}`,
    `- Avg duration by type: ${Object.entries(report.patterns.avgDurationByType).map(([t, d]) => `${t} ${d}s`).join(', ') || '(none)'}`,
    `- End reasons: ${Object.entries(report.patterns.endReasonCounts).map(([r, c]) => `${r} ${c}`).join(', ') || '(none)'}`,
    `- Shots by active pattern: ${Object.entries(report.patterns.shotsByActivePattern).map(([t, c]) => `${t} ${c}`).join(', ') || '(none)'}`,
    `- Goals by active pattern: ${Object.entries(report.patterns.goalsByActivePattern).filter(([k]) => k !== '__seen').map(([t, c]) => `${t} ${c}`).join(', ') || '(none)'}`,
    ``,
    `## Role Positions (team-in-possession frames)`,
    `- ${teamA}:`,
    ...report.rolePositions.A.map((entry) => `  - ${entry.role}: avgX ${entry.avgX}, avg|Z| ${entry.avgAbsZ}, avgDistToGoal ${entry.avgDistToGoal} (${entry.samples} samples); opp-half fwdX ${entry.avgForwardXInOppHalf ?? 'n/a'} (${entry.oppHalfSamples}); final-third |z| ${entry.avgAbsZInFinalThird ?? 'n/a'} (${entry.finalThirdSamples})`),
    `- ${teamB}:`,
    ...report.rolePositions.B.map((entry) => `  - ${entry.role}: avgX ${entry.avgX}, avg|Z| ${entry.avgAbsZ}, avgDistToGoal ${entry.avgDistToGoal} (${entry.samples} samples); opp-half fwdX ${entry.avgForwardXInOppHalf ?? 'n/a'} (${entry.oppHalfSamples}); final-third |z| ${entry.avgAbsZInFinalThird ?? 'n/a'} (${entry.finalThirdSamples})`),
    ``,
    `## Event Stream Review`,
    `- Event-stream shots: ${report.eventStream.totalShots}`,
    `- Event-stream on-target shots: ${report.eventStream.onTargetShots}`,
    `- Long-range on-target shots: ${report.eventStream.longRangeOnTargetCount}`,
    `- Close-range bad-angle shots: ${report.eventStream.closeRangeBadAngleCount}`,
    `- On-target toe pokes: ${report.eventStream.toePokesOnTargetCount}`,
    `- Attacker reset passes (BACK/WALL): ${report.eventStream.attackerResetPassCount}`,
  ]

  if (report.eventStream.longRangeOnTarget.length > 0) {
    lines.push(``, `### Long-Range On-Target Shots`)
    for (const event of report.eventStream.longRangeOnTarget) {
      lines.push(`- Team ${event.team} ${event.role}: ${formatEventBullet(event)}`)
    }
  }

  if (report.eventStream.closeRangeBadAngles.length > 0) {
    lines.push(``, `### Close-Range Bad-Angle Shots`)
    for (const event of report.eventStream.closeRangeBadAngles) {
      lines.push(`- Team ${event.team} ${event.role}: ${formatEventBullet(event)}`)
    }
  }

  if (report.movement.topZigzagOffenders.length > 0) {
    lines.push(``, `### Top Zigzag Offenders`)
    for (const offender of report.movement.topZigzagOffenders) {
      lines.push(`- Team ${offender.team} ${offender.role} ${offender.carrier}: flips ${offender.lateralFlips}, avg progress/flip ${offender.avgForwardProgressPerFlip}, switch requests ${offender.switchRequests}, blocked ${offender.blockedSwitches}, facing mismatch ${offender.facingMovementMismatchPct}%`)
    }
  }

  if (report.boxBehavior.topBoxLoiterers.length > 0) {
    lines.push(``, `### Top Box Loiterers`)
    for (const offender of report.boxBehavior.topBoxLoiterers) {
      lines.push(`- Team ${offender.team} ${offender.role} ${offender.player}: max dwell ${offender.maxBoxDwellSeconds}s, max idle ${offender.maxBoxIdleSeconds}s, max camp ${offender.maxBoxCampSeconds}s, crowded ${offender.crowdedPct}%`)
    }
  }

  if (report.recommendations.length > 0) {
    lines.push(``, `## Suggested Improvements`)
    for (const recommendation of report.recommendations) {
      lines.push(`- ${recommendation}`)
    }
  }

  return `${lines.join('\n')}\n`
}

function printSummary(report) {
  const teamA = report.match.teamA
  const teamB = report.match.teamB
  const global = report.baselines.global
  const duration = report.baselines.duration || { matchMinutes: 90, halfSeconds: 2700, durationFactor: 1 }
  const provenance = report.match.runtimeProvenance || {}

  const mid = report.match.matchId ? ` [${report.match.matchId}]` : ''
  console.log(`Telemetry report: ${teamA} ${report.match.score} ${teamB}${mid} | session ${report.match.sessionId}`)
  console.log(`Runtime duration ${duration.runtimeMinutes} min total (${duration.halfSeconds}s halves); simulated match is 90 min and MLS baselines are runtime-scaled to the selected real duration`)
  console.log(`Runtime provenance | ${provenance.engineRuntimeToken ? `token ${provenance.engineRuntimeToken}` : 'legacy/unstamped'} | scale ${provenance.matchClockScale ?? 'n/a'} | speed ${provenance.seriesSpeedMul ?? 'n/a'} | delays ${provenance.restartDelayGoal ?? 'n/a'}/${provenance.restartDelayHalf ?? 'n/a'} | persisted ${provenance.normalizedFromSnapshot ? 'snapshot-normalized' : 'raw'}`)
  console.log(`Tuning KPIs | overall ${report.kpis.overall.score} (${report.kpis.overall.grade}) | baseline ${report.kpis.baselineFit.score} (${report.kpis.baselineFit.grade}) | structure ${report.kpis.soccerStructure.score} (${report.kpis.soccerStructure.grade}) | efficiency ${report.kpis.tuningEfficiency.score} (${report.kpis.tuningEfficiency.grade})`)
  console.log(`MLS baseline drift | goals ${global.totalGoals.drift} | shots ${global.totalShots.drift} | SOT ${global.totalShotsOnTarget.drift} | corners ${global.totalCorners.drift}`)
  console.log(`Decision telemetry | forced shots ${report.shotDecisionSummary.forcedShots}/${report.shotDecisionSummary.total} | AI_SIMPLE broken ${report.shotDecisionSummary.aiSimpleBrokenRows}/${report.shotDecisionSummary.aiSimpleDecisions} | attacker backpasses ${report.passDecisionSummary.attackerBackpassesInFinalThird} | direct blocker passes ${report.passDecisionSummary.directBlockerPassDecisions}`)
  console.log(`Keeper / restarts | saves ${report.keeperSummary.byTeam.A.saves}-${report.keeperSummary.byTeam.B.saves} | corners ${report.restartSummary.total.corners} | throw-ins ${report.restartSummary.total.throwIns} | goal kicks ${report.restartSummary.total.goalKicks} | free kicks ${report.restartSummary.total.freeKicks} | penalties ${report.restartSummary.total.penalties}`)
  console.log(`Movement telemetry | carriers ${report.movement.carriersTracked} | lateral flips ${report.movement.totalLateralFlips} | switch requests ${report.movement.totalSwitchRequests} | facing mismatch ${report.movement.facingMovementMismatchPct}%`)
  console.log(`Heat map | ${teamA} width ${report.shape.A.avgWidth}, center+narrow ${report.shape.A.centerAndNarrowPct}% | ${teamB} width ${report.shape.B.avgWidth}, center+narrow ${report.shape.B.centerAndNarrowPct}%`)
  const ownerFmt = (team) => Object.entries(report.positionOwners.byTeam[team]).map(([owner, count]) => `${owner}:${count}`).join(' | ') || '(none)'
  console.log(`Position owners | samples ${report.positionOwners.samples} | A ${ownerFmt('A')} | B ${ownerFmt('B')}`)
  console.log(`Wide owner targets | A avg |z| ${report.positionOwners.wide.A.avgAbsZ} target ${report.positionOwners.wide.A.avgTargetAbsZ} | B avg |z| ${report.positionOwners.wide.B.avgAbsZ} target ${report.positionOwners.wide.B.avgTargetAbsZ}`)
  console.log(`Event stream | long-range on-target ${report.eventStream.longRangeOnTargetCount} | bad-angle close shots ${report.eventStream.closeRangeBadAngleCount} | toe pokes on target ${report.eventStream.toePokesOnTargetCount}`)
  const ptA = report.phaseTime.A
  const ptB = report.phaseTime.B
  console.log(`Phase time A | buildup ${ptA.buildupPct}% | progression ${ptA.progressionPct}% | chance ${ptA.chanceCreationPct}% | finish ${ptA.finishPct}%`)
  console.log(`Phase time B | buildup ${ptB.buildupPct}% | progression ${ptB.progressionPct}% | chance ${ptB.chanceCreationPct}% | finish ${ptB.finishPct}%`)
  const rpA = report.rolePositions.A.filter((entry) => ['ST', 'CF', 'LM', 'RM', 'CB', 'CM'].includes(entry.role))
  const rpB = report.rolePositions.B.filter((entry) => ['ST', 'CF', 'LM', 'RM', 'CB', 'CM'].includes(entry.role))
  const roleFmt = (rp) => rp.map((entry) => `${entry.role} x=${entry.avgX} |z|=${entry.avgAbsZ}`).join(' | ')
  if (rpA.length) console.log(`Role positions A | ${roleFmt(rpA)}`)
  if (rpB.length) console.log(`Role positions B | ${roleFmt(rpB)}`)
  const gateFmt = (rp) => {
    const st = rp.find((e) => e.role === 'ST')
    const lm = rp.find((e) => e.role === 'LM')
    const rm = rp.find((e) => e.role === 'RM')
    const parts = []
    if (st) parts.push(`ST opp-half fwdX=${st.avgForwardXInOppHalf ?? 'n/a'} (${st.oppHalfSamples} samples)`)
    if (lm) parts.push(`LM final-third |z|=${lm.avgAbsZInFinalThird ?? 'n/a'} (${lm.finalThirdSamples})`)
    if (rm) parts.push(`RM final-third |z|=${rm.avgAbsZInFinalThird ?? 'n/a'} (${rm.finalThirdSamples})`)
    return parts.join(' | ')
  }
  const gA = gateFmt(rpA)
  const gB = gateFmt(rpB)
  if (gA) console.log(`Phase 1 gates A | ${gA}`)
  if (gB) console.log(`Phase 1 gates B | ${gB}`)
  const pat = report.patterns
  const typesA = Object.entries(pat.typesPerTeam.A || {}).map(([t, c]) => `${t}:${c}`).join(',')
  const typesB = Object.entries(pat.typesPerTeam.B || {}).map(([t, c]) => `${t}:${c}`).join(',')
  console.log(`Patterns A (${pat.patternsPerTeamA}, distinct ${pat.distinctTypesA}) | ${typesA || '(none)'}`)
  console.log(`Patterns B (${pat.patternsPerTeamB}, distinct ${pat.distinctTypesB}) | ${typesB || '(none)'}`)
  const durs = Object.entries(pat.avgDurationByType).map(([t, d]) => `${t}:${d}s`).join(' | ')
  if (durs) console.log(`Avg duration | ${durs}`)
  const reasons = Object.entries(pat.endReasonCounts).map(([r, c]) => `${r}:${c}`).join(' | ')
  if (reasons) console.log(`End reasons | ${reasons}`)
  const shotCorr = Object.entries(pat.shotsByActivePattern).map(([t, c]) => `${t}:${c}`).join(' | ')
  if (shotCorr) console.log(`Shots during pattern | ${shotCorr}`)
  const goalCorr = Object.entries(pat.goalsByActivePattern).filter(([k]) => k !== '__seen').map(([t, c]) => `${t}:${c}`).join(' | ')
  if (goalCorr) console.log(`Goals during pattern | ${goalCorr}`)
  const align = report.patternRoleAlignment
  const alignStr = Object.entries(align).map(([r, v]) => `${r}: fwdX=${v.avgForwardX} |z|=${v.avgAbsZ} dist=${v.avgDistToGoal} (${v.samples})`).join(' | ')
  if (alignStr) console.log(`Pattern role alignment | ${alignStr}`)
  const traj = report.carrierTrajectories
  console.log(`Carrier trajectories | segments=${traj.totalSegments} avgBLineRatio=${traj.avgBLineRatio} strightRuns>15u=${traj.straightRunsOver15Units} flippyCarriers=${traj.totalFlippyCarriers} totalFlips=${traj.totalFlips}`)
  if (traj.flipsByTeam) {
    const a = traj.flipsByTeam.A || 0, b = traj.flipsByTeam.B || 0
    const aSeg = traj.segmentsByTeam.A || 0, bSeg = traj.segmentsByTeam.B || 0
    const aFlipsPerSeg = aSeg > 0 ? (a / aSeg).toFixed(2) : '0'
    const bFlipsPerSeg = bSeg > 0 ? (b / bSeg).toFixed(2) : '0'
    console.log(`  by team | A: ${a} flips / ${aSeg} segs (${aFlipsPerSeg}/seg) | B: ${b} flips / ${bSeg} segs (${bFlipsPerSeg}/seg)`)
  }
  if (traj.flipsByTeamHalf) {
    const h = traj.flipsByTeamHalf
    const s = traj.segmentsByTeamHalf || { A1: 0, A2: 0, B1: 0, B2: 0 }
    const fmt = (flips, segs) => segs > 0 ? `${flips} flips / ${segs} segs (${(flips/segs).toFixed(2)}/seg)` : `${flips} flips / 0 segs`
    console.log(`  by team×half | A-H1: ${fmt(h.A1 || 0, s.A1 || 0)} | A-H2: ${fmt(h.A2 || 0, s.A2 || 0)}`)
    console.log(`               | B-H1: ${fmt(h.B1 || 0, s.B1 || 0)} | B-H2: ${fmt(h.B2 || 0, s.B2 || 0)}`)
  }
  if (traj.flipsByDirection) {
    const l2r = traj.flipsByDirection.L2R || 0, r2l = traj.flipsByDirection.R2L || 0
    const l2rSeg = traj.segmentsByDirection.L2R || 0, r2lSeg = traj.segmentsByDirection.R2L || 0
    const l2rPer = l2rSeg > 0 ? (l2r / l2rSeg).toFixed(2) : '0'
    const r2lPer = r2lSeg > 0 ? (r2l / r2lSeg).toFixed(2) : '0'
    console.log(`  by direction | L→R: ${l2r} flips / ${l2rSeg} segs (${l2rPer}/seg) | R→L: ${r2l} flips / ${r2lSeg} segs (${r2lPer}/seg)`)
  }
  if (traj.byLineRunSegments.length > 0) {
    console.log('Top B-line runs:')
    for (const run of traj.byLineRunSegments.slice(0, 5)) {
      console.log(`  ${run.team} ${run.carrier}: ${run.directDist}u in ${run.duration}s (ratio ${run.bLineRatio}, path ${run.pathLength}u)`)
    }
  }
  const mt = report.multiTouchOppHalf
  console.log(`Multi-touch opp-half sequences | ${mt.multiTouchOppHalfCount} of ${mt.totalSequences} possessions (${mt.totalOppHalfTouches} opp-half touches total, avg ${mt.avgDistinctPlayersPerSequence} distinct players/possession)`)
  const ko = report.kickoffGoalCorrelation
  console.log(`Kickoff receiver correlation | passes ${ko.kickoffPasses}, receives ${ko.kickoffReceives}, scorer events ${ko.goalScorerEvents}`)
  const koFmt = (team) => {
    const row = ko.byTeam[team]
    const receivers = row.receivers.slice(0, 4).map((r) => `${r.player}:${r.actualReceives} recv/${r.intendedTargets} target/${r.goalsAfterLatestKickoffReceive} goals`).join(' | ') || '(none)'
    return `${row.sameAsLatestKickoffReceiverGoals}/${row.goals} goals same as latest KO receiver (${row.sameAsLatestKickoffReceiverPct}%) | ${receivers}`
  }
  console.log(`  A ${koFmt('A')}`)
  console.log(`  B ${koFmt('B')}`)
  const ft = report.finalThirdOverloads
  console.log(`Final-third overloads (>=3 attackers, 1s windows) | A: ${ft.A.bucketsWithOverload}/${ft.A.totalBuckets} (max ${ft.A.maxAttackersInBucket}) | B: ${ft.B.bucketsWithOverload}/${ft.B.totalBuckets} (max ${ft.B.maxAttackersInBucket})`)
  const dm = report.dangerMarking
  console.log(`Danger marking | samples ${dm.samples} | A ${dm.byTeam.A.marked}/${dm.byTeam.A.samples} marked (${dm.byTeam.A.markedPct}%, avg ${dm.byTeam.A.avgNearestDefenderDist}u) | B ${dm.byTeam.B.marked}/${dm.byTeam.B.samples} marked (${dm.byTeam.B.markedPct}%, avg ${dm.byTeam.B.avgNearestDefenderDist}u)`)
  const db = report.defendersInBoxAtGoal
  if (db.goalCount > 0) {
    const dist = Object.entries(db.distribution).sort((a, b) => Number(a[0]) - Number(b[0])).map(([n, c]) => `${n}d:${c}`).join(' ')
    console.log(`Defenders in box at goal | ${db.goalCount} goals, avg ${db.avgDefendersInBox} defenders + ${db.avgAttackersInBox} attackers | dist ${dist}`)
  }
  const sbd = report.shotBoxDefense
  console.log(`Shot box defense | shots ${sbd.shots} | avg box defenders ${sbd.avgDefendersInBox} | avg corridor defenders ${sbd.avgDefendersInCorridor} | empty box ${sbd.emptyBoxShots} | empty corridor ${sbd.emptyCorridorShots}`)
  if (report.patternTempo) {
    console.log('Pattern tempo (realism fit):')
    for (const [type, v] of Object.entries(report.patternTempo)) {
      const expT = v.expectedTouches ? `${v.expectedTouches[0]}-${v.expectedTouches[1]}` : 'n/a'
      const expP = v.expectedPace ? `${v.expectedPace[0]}-${v.expectedPace[1]}u/s` : 'n/a'
      const paceStr = v.avgPace != null ? `pace=${v.avgPace}u/s [${v.paceFit} vs ${expP}]` : `pace=n/a (${v.count - v.multiTouchCount}/${v.count} had <2 touches)`
      console.log(`  ${type} (${v.count}x, ${v.multiTouchCount} multi-touch): touches=${v.avgTouches} [${v.touchFit} vs ${expT}] ${paceStr} dur=${v.avgDuration}s`)
    }
  }
  if (report.patternCrosses) {
    console.log(`Pattern delivery/cross | ${report.patternCrosses.deliveries} deliveries, ${report.patternCrosses.total} real crosses (L:${report.patternCrosses.longLofted} D:${report.patternCrosses.driven})`)
    for (const e of report.patternCrosses.samples) {
      console.log(`  ${e.team} ${e.passer} -> ${e.target} (${e.targetRole}, ${e.style}, ${e.crossDist}u)`)
    }
  }
  if (report.neoPlays) {
    console.log(`Neo-play effectiveness | starts ${report.neoPlays.totalStarts} | deliveries ${report.neoPlays.totalDeliveries} | shot-producing ${report.neoPlays.totalShotCreatingDeliveries} (${report.neoPlays.effectivenessPct}%) | goal-producing ${report.neoPlays.totalGoalCreatingDeliveries} (${report.neoPlays.goalRatePct}%)`)
    for (const row of Object.values(report.neoPlays.byPlay || {})) {
      console.log(`  ${row.playName}: starts=${row.starts} deliveries=${row.deliveries} crosses=${row.crosses} effective=${row.shotCreatingDeliveries}/${row.deliveries} (${row.effectivenessPct}%) goals=${row.goalCreatingDeliveries}/${row.deliveries} (${row.goalRatePct}%)`)
    }
  }
  if (mt.exampleSequences.length > 0) {
    console.log('Sample multi-touch opp-half sequences:')
    for (const ex of mt.exampleSequences) {
      console.log(`  team ${ex.team} @ ${ex.firstTouchAt?.toFixed(1)}s: ${ex.touchCount} touches by ${ex.players.join(' → ')}`)
    }
  }
  if (report.recommendations.length > 0) {
    console.log('Top recommendations:')
    for (const recommendation of report.recommendations) {
      console.log(`- ${recommendation}`)
    }
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  let db = null
  const row = options.bundleJson
    ? loadBundleRowFromFile(options.bundleJson, options.resultIndex)
    : (() => {
        const dbPath = path.resolve(process.cwd(), 'psl.db')
        db = new Database(dbPath, { readonly: true })
        return findBundleRow(db, options)
      })()
  if (!row) {
    throw new Error('No matching telemetry bundle found.')
  }

  const bundle = JSON.parse(row.bundle_json)
  const events = Array.isArray(bundle.events) ? bundle.events : []
  const passLog = Array.isArray(bundle.passLog) ? bundle.passLog : []
  const shotDecisions = Array.isArray(bundle.shotDecisions) ? bundle.shotDecisions : []
  const passDecisions = Array.isArray(bundle.passDecisions) ? bundle.passDecisions : []
  const shapeA = Array.isArray(bundle.shapeA) ? bundle.shapeA : []
  const shapeB = Array.isArray(bundle.shapeB) ? bundle.shapeB : []
  const runtimeProvenance = getBundleRuntimeProvenance(bundle)

  const report = {
    generatedAt: new Date().toISOString(),
    model: {
      name: bundle.metadata?.model || bundle.tuning?.model || null,
      disabledRules: bundle.tuning?.disabledRules || [],
      disabledMetrics: bundle.telemetry?.disabledMetrics || (
        (bundle.metadata?.model || bundle.tuning?.model) === 'simple-v1'
          ? ['fouls']
          : []
      ),
    },
    match: {
      sessionId: row.session_id,
      matchId: bundle.matchId || null,
      timestamp: row.timestamp,
      teamA: row.team_a_name,
      teamB: row.team_b_name,
      score: `${bundle.teamA?.score ?? 0}-${bundle.teamB?.score ?? 0}`,
      shotsA: bundle.teamA?.shots ?? 0,
      shotsB: bundle.teamB?.shots ?? 0,
      shotsOnTargetA: bundle.teamA?.shotsOnTarget ?? 0,
      shotsOnTargetB: bundle.teamB?.shotsOnTarget ?? 0,
      passesA: bundle.teamA?.passes ?? 0,
      passesB: bundle.teamB?.passes ?? 0,
      runtimeProvenance,
    },
    counts: {
      events: events.length,
      passLog: passLog.length,
      midfieldSupport: countByType(events, 'MIDFIELD_SUPPORT'),
      carrierTraces: countByType(events, 'CARRIER_TRACE'),
      attackerZoneTraces: countByType(events, 'ATTACKER_ZONE_TRACE'),
      positionOwnerSamples: countByType(events, 'POSITION_OWNER_SAMPLE'),
      kickoffPasses: countByType(events, 'KICKOFF_PASS'),
      kickoffReceives: countByType(events, 'KICKOFF_RECEIVED'),
      goalScorerEvents: countByType(events, 'GOAL_SCORER'),
      shotSnapshots: countByType(events, 'SHOT_POSITION_SNAPSHOT'),
      shotOnTargetSnapshots: countByType(events, 'SHOT_ON_TARGET_POSITION_SNAPSHOT'),
      shotDecisions: shotDecisions.length,
      passDecisions: passDecisions.length,
      turnovers: countByType(events, 'TURNOVER'),
      interceptions: countByType(events, 'INTERCEPTION'),
      fouls: countByType(events, 'FOUL') || Number(bundle.teamA?.fouls ?? 0) + Number(bundle.teamB?.fouls ?? 0),
      tackles: countByType(events, 'TACKLE') || Number(bundle.teamA?.tackles ?? 0) + Number(bundle.teamB?.tackles ?? 0),
      offsides: countByType(events, 'OFFSIDE') || Number(bundle.teamA?.offsides ?? 0) + Number(bundle.teamB?.offsides ?? 0),
    },
    passProfile: {
      A: { team: row.team_a_name, ...summarizePasses(passLog, 'A') },
      B: { team: row.team_b_name, ...summarizePasses(passLog, 'B') },
    },
    passDecisionSummary: summarizePassDecisions(passDecisions),
    shotDecisionSummary: summarizeShotDecisions(shotDecisions),
    movement: summarizeCarrierMovement(events),
    boxBehavior: summarizeAttackerBoxBehavior(events),
    shotSupport: summarizeShotSupport(events),
    shape: {
      A: summarizeShape(shapeA, row.team_a_name),
      B: summarizeShape(shapeB, row.team_b_name),
    },
    roleCentrality: {
      A: summarizeRoleCentrality(bundle.teamA),
      B: summarizeRoleCentrality(bundle.teamB),
    },
    positionOwners: summarizePositionOwners(events),
    eventStream: summarizeEventStream(events, passLog),
    keeperSummary: summarizeKeeperEvents(bundle, passLog),
    restartSummary: summarizeRestartCounts(events, passLog, bundle),
    baselines: compareToBaselines(bundle, row.team_a_name, row.team_b_name),
    phaseTime: summarizePhaseTime(events),
    passByZone: summarizePassByZone(passDecisions),
    rolePositions: summarizeRolePositions(events),
    patterns: summarizePatterns(events),
    patternRoleAlignment: summaryPatternRoleAlignment(events),
    carrierTrajectories: summaryCarrierTrajectories(events),
    multiTouchOppHalf: summarizeMultiTouchOppHalfSequences(events),
    finalThirdOverloads: summarizeFinalThirdOverloads(events),
    dangerMarking: summarizeDangerMarking(events),
    defendersInBoxAtGoal: summarizeDefendersInBoxAtGoal(bundle),
    shotBoxDefense: summarizeShotBoxDefense(events, bundle),
    kickoffGoalCorrelation: summarizeKickoffGoalCorrelation(events),
    patternTempo: summarizePatternTempo(events),
    neoPlays: summarizeNeoPlayEffectiveness(events),
    patternCrosses: (() => {
      const crossEvents = events.filter((e) => e.type === 'PATTERN_CROSS_EXECUTED')
      const deliveryEvents = events.filter((e) => e.type === 'PATTERN_DELIVERY_EXECUTED' || e.type === 'PATTERN_CROSS_EXECUTED')
      return {
        total: crossEvents.length,
        deliveries: deliveryEvents.length,
        longLofted: crossEvents.filter((e) => e.detail?.style === 'LONG_LOFTED').length,
        driven: crossEvents.filter((e) => e.detail?.style === 'DRIVEN').length,
        samples: crossEvents.slice(0, 6).map((e) => ({
          team: e.team, passer: e.detail?.passer, target: e.detail?.target,
          targetRole: e.detail?.targetRole, style: e.detail?.style, crossDist: e.detail?.crossDist,
        })),
      }
    })(),
  }

  report.kpis = summarizeKpis(report)
  report.recommendations = buildRecommendations(report)
  const markdown = buildMarkdownReport(report)

  printSummary(report)
  writeReportFile(options.reportJson, options.reportMd, report, markdown)
  console.log(`Saved telemetry report JSON: ${path.resolve(process.cwd(), options.reportJson)}`)
  console.log(`Saved telemetry report Markdown: ${path.resolve(process.cwd(), options.reportMd)}`)
}

export {
  getBundleDurationInfo,
  getBundleRuntimeProvenance,
  summarizeKeeperEvents,
  summarizeRestartCounts,
  summarizeShape,
  summarizePositionOwners,
  summaryCarrierTrajectories,
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false

if (isDirectRun) {
  main()
}
