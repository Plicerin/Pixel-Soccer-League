#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
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

  if (!options.latest && !options.sessionId && !options.homeTeam) {
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

function summarizeShotDecisions(shotDecisions) {
  const forcedShots = shotDecisions.filter((decision) =>
    decision.forceShotNow
    || decision.atGoalLineForce
    || decision.desperationShot
    || decision.shotSelectionType === 'forced_shot',
  )
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
    decision.forceShotNow
    || decision.atGoalLineForce
    || decision.desperationShot
    || decision.shotSelectionType === 'forced_shot',
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
      const sElapsed = (s.half === 2 ? 150 : 0) + Number(s.t ?? 0)
      // Match: first end AFTER this start that hasn't been used.
      let eElapsed = null
      for (let j = 0; j < es.length; j++) {
        if (es[j]._used) continue
        const eSide = es[j]
        const sidesMatch = true
        const eTime = (eSide.half === 2 ? 150 : 0) + Number(eSide.t ?? 0)
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
    const elapsed = (shot.half === 2 ? 150 : 0) + Number(shot.t ?? 0)
    if (!patternIntervals[team]) continue
    const active = patternIntervals[team].find((iv) => iv.startElapsed <= elapsed && (iv.endElapsed === null || iv.endElapsed >= elapsed))
    const key = active ? active.type : 'NONE'
    shotsByActivePattern[key] = (shotsByActivePattern[key] || 0) + 1
  }
  for (const goal of goals) {
    const team = goal.team
    if (!team) continue
    const elapsed = (goal.half === 2 ? 150 : 0) + Number(goal.t ?? 0)
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
  // For each segment >= 4 samples, compute B-line ratio = (direct distance) / (path length).
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
    const elapsed = (event.half === 2 ? 150 : 0) + Number(event.t || 0)
    const x = Number(event.detail?.x ?? 0)
    const z = Number(event.detail?.z ?? 0)
    if (!current || current.carrier !== carrier || (elapsed - current.lastElapsed) > 2) {
      if (current && current.samples.length >= 4) segments.push(current)
      current = {
        carrier, team,
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
  if (current && current.samples.length >= 4) segments.push(current)

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
  let totalFlips = 0
  let totalFlippyCarriers = 0
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
  }

  return {
    totalSegments,
    avgBLineRatio,
    straightRunsOver15Units,
    byLineRunSegments: byLineRunSegments.sort((a, b) => b.directDist - a.directDist).slice(0, 8),
    curlingSegments,
    totalFlips,
    totalFlippyCarriers,
  }
}

// User-requested metric: how many sequences have 2+ distinct players touching the
// ball in the opponent's half. Measures genuine multi-player build-up in attacking
// territory, not solo-carry-and-shoot.
function summarizeMultiTouchOppHalfSequences(events) {
  const touchTypes = new Set(['PASS', 'SHOT', 'RECOVERY', 'CLEARANCE', 'INTERCEPTION', 'TACKLE'])
  // Order events by match time (half + t)
  const ordered = events
    .filter((e) => touchTypes.has(e.type))
    .map((e) => ({ ...e, __elapsed: (e.half === 2 ? 150 : 0) + Number(e.t || 0) }))
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
  const samples = Array.isArray(shapeSamples) ? shapeSamples : []
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

function compareToBaselines(bundle, teamAName, teamBName) {
  const baselineMap = buildTeamBaselineMap()
  const baselineA = baselineMap.get(normalizeTeamName(teamAName).toLowerCase()) || null
  const baselineB = baselineMap.get(normalizeTeamName(teamBName).toLowerCase()) || null

  const global = {
    totalGoals: {
      simulated: (bundle.teamA?.score ?? 0) + (bundle.teamB?.score ?? 0),
      baseline: MLS_2025_GLOBAL_AVERAGES.goalsPerGame,
    },
    totalShots: {
      simulated: (bundle.teamA?.shots ?? 0) + (bundle.teamB?.shots ?? 0),
      baseline: MLS_2025_GLOBAL_AVERAGES.shotsPerGame * 2,
    },
    totalShotsOnTarget: {
      simulated: (bundle.teamA?.shotsOnTarget ?? 0) + (bundle.teamB?.shotsOnTarget ?? 0),
      baseline: MLS_2025_GLOBAL_AVERAGES.shotsOnTargetPerGame * 2,
    },
    totalCorners: {
      simulated: (bundle.teamA?.corners ?? 0) + (bundle.teamB?.corners ?? 0),
      baseline: MLS_2025_GLOBAL_AVERAGES.cornersPerGame * 2,
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
        goals: baselineA.goalsFor,
        shots: baselineA.shotsPerGame,
        shotsOnTarget: baselineA.shotsOnTargetPerGame,
        passCompletionPct: round(baselineA.passCompletionRate * 100, 1),
        possessionPct: round(baselineA.possession * 100, 1),
        corners: baselineA.corners,
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
        goals: baselineB.goalsFor,
        shots: baselineB.shotsPerGame,
        shotsOnTarget: baselineB.shotsOnTargetPerGame,
        passCompletionPct: round(baselineB.passCompletionRate * 100, 1),
        possessionPct: round(baselineB.possession * 100, 1),
        corners: baselineB.corners,
      } : null,
    },
  ]

  return { global, teamComparison }
}

function buildRecommendations(report) {
  const recommendations = []
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
  if (centerAndNarrowWorst > 30 || report.shape.A.avgWidth < 18 || report.shape.B.avgWidth < 18) {
    recommendations.push('Shape is still too central. Strengthen weak-side width anchors and reduce carrier-gravity pull on wide roles and midfield support.')
  }
  if ((report.roleCentrality.A.wideShotShareVsCentral ?? 0) < 0.2 || (report.roleCentrality.B.wideShotShareVsCentral ?? 0) < 0.2) {
    recommendations.push('Too much of the final action still comes through central roles. Encourage wider occupation and more wing-led creation before the finish.')
  }
  if (report.baselines.global.totalCorners.simulated <= 1) {
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

function findBundleRow(db, options) {
  if (options.sessionId) {
    return db.prepare(`
      SELECT session_id, timestamp, team_a_name, team_b_name, bundle_json
      FROM match_results
      WHERE session_id = ?
      LIMIT 1
    `).get(options.sessionId)
  }

  if (options.homeTeam && options.awayTeam) {
    const home = normalizeTeamName(options.homeTeam).toLowerCase()
    const away = normalizeTeamName(options.awayTeam).toLowerCase()
    const rows = db.prepare(`
      SELECT session_id, timestamp, team_a_name, team_b_name, bundle_json
      FROM match_results
      ORDER BY timestamp DESC
      LIMIT 250
    `).all()
    return rows.find((row) => {
      const a = normalizeTeamName(row.team_a_name).toLowerCase()
      const b = normalizeTeamName(row.team_b_name).toLowerCase()
      return (a === home && b === away) || (a === away && b === home)
    }) || null
  }

  return db.prepare(`
    SELECT session_id, timestamp, team_a_name, team_b_name, bundle_json
    FROM match_results
    ORDER BY timestamp DESC
    LIMIT 1
  `).get()
}

function writeReportFile(reportJson, reportMd, report, markdown) {
  const outJson = path.resolve(process.cwd(), reportJson)
  const outMd = path.resolve(process.cwd(), reportMd)
  fs.mkdirSync(path.dirname(outJson), { recursive: true })
  fs.mkdirSync(path.dirname(outMd), { recursive: true })
  fs.writeFileSync(outJson, JSON.stringify(report, null, 2))
  fs.writeFileSync(outMd, markdown)
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
  const teamA = report.match.teamA
  const teamB = report.match.teamB
  const lines = [
    `# Telemetry Analysis`,
    ``,
    `## Match`,
    `- Fixture: ${teamA} ${report.match.score} ${teamB}`,
    `- Session: ${report.match.sessionId}`,
    `- Timestamp: ${new Date(report.match.timestamp).toISOString()}`,
    `- Shots: ${report.match.shotsA}-${report.match.shotsB}`,
    `- Shots on target: ${report.match.shotsOnTargetA}-${report.match.shotsOnTargetB}`,
    ``,
    `## MLS Baseline Comparison`,
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
    `- Turnovers: ${report.counts.turnovers}`,
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
    ``,
    `## Phase Time Distribution`,
    `- ${teamA}: buildup ${report.phaseTime.A.buildupPct}% | progression ${report.phaseTime.A.progressionPct}% | chance ${report.phaseTime.A.chanceCreationPct}% | finish ${report.phaseTime.A.finishPct}% (${report.phaseTime.A.samples} samples)`,
    `- ${teamB}: buildup ${report.phaseTime.B.buildupPct}% | progression ${report.phaseTime.B.progressionPct}% | chance ${report.phaseTime.B.chanceCreationPct}% | finish ${report.phaseTime.B.finishPct}% (${report.phaseTime.B.samples} samples)`,
    ``,
    `## Pass Decisions By Zone`,
    `- Evaluated: ${Object.entries(report.passByZone.evaluated).map(([z, c]) => `${z}:${c}`).join(' | ')}`,
    `- Executed (shouldPass): ${Object.entries(report.passByZone.executed).map(([z, c]) => `${z}:${c}`).join(' | ')}`,
    ``,
    `## Multi-Touch Opp-Half Sequences (build-up quality)`,
    `- Sequences with 2+ distinct players touching ball in opp half: ${report.multiTouchOppHalf.multiTouchOppHalfCount} of ${report.multiTouchOppHalf.totalSequences}`,
    `- Opp-half touches total: ${report.multiTouchOppHalf.totalOppHalfTouches}`,
    `- Avg distinct players per possession: ${report.multiTouchOppHalf.avgDistinctPlayersPerSequence}`,
    ...(report.multiTouchOppHalf.exampleSequences.length > 0
      ? [`- Examples:`, ...report.multiTouchOppHalf.exampleSequences.map((ex) => `  - Team ${ex.team} @ ${ex.firstTouchAt?.toFixed(1)}s: ${ex.touchCount} touches by ${ex.players.join(' → ')}`)]
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

  console.log(`Telemetry report: ${teamA} ${report.match.score} ${teamB} | session ${report.match.sessionId}`)
  console.log(`MLS baseline drift | goals ${global.totalGoals.drift} | shots ${global.totalShots.drift} | SOT ${global.totalShotsOnTarget.drift} | corners ${global.totalCorners.drift}`)
  console.log(`Decision telemetry | forced shots ${report.shotDecisionSummary.forcedShots}/${report.shotDecisionSummary.total} | AI_SIMPLE broken ${report.shotDecisionSummary.aiSimpleBrokenRows}/${report.shotDecisionSummary.aiSimpleDecisions} | attacker backpasses ${report.passDecisionSummary.attackerBackpassesInFinalThird} | direct blocker passes ${report.passDecisionSummary.directBlockerPassDecisions}`)
  console.log(`Movement telemetry | carriers ${report.movement.carriersTracked} | lateral flips ${report.movement.totalLateralFlips} | switch requests ${report.movement.totalSwitchRequests} | facing mismatch ${report.movement.facingMovementMismatchPct}%`)
  console.log(`Heat map | ${teamA} width ${report.shape.A.avgWidth}, center+narrow ${report.shape.A.centerAndNarrowPct}% | ${teamB} width ${report.shape.B.avgWidth}, center+narrow ${report.shape.B.centerAndNarrowPct}%`)
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
  if (traj.byLineRunSegments.length > 0) {
    console.log('Top B-line runs:')
    for (const run of traj.byLineRunSegments.slice(0, 5)) {
      console.log(`  ${run.team} ${run.carrier}: ${run.directDist}u in ${run.duration}s (ratio ${run.bLineRatio}, path ${run.pathLength}u)`)
    }
  }
  const mt = report.multiTouchOppHalf
  console.log(`Multi-touch opp-half sequences | ${mt.multiTouchOppHalfCount} of ${mt.totalSequences} possessions (${mt.totalOppHalfTouches} opp-half touches total, avg ${mt.avgDistinctPlayersPerSequence} distinct players/possession)`)
  if (report.patternCrosses) {
    console.log(`Pattern cross-executed | ${report.patternCrosses.total} events (L:${report.patternCrosses.longLofted} D:${report.patternCrosses.driven})`)
    for (const e of report.patternCrosses.samples) {
      console.log(`  ${e.team} ${e.passer} -> ${e.target} (${e.targetRole}, ${e.style}, ${e.crossDist}u)`)
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
  const dbPath = path.resolve(process.cwd(), 'psl.db')
  const db = new Database(dbPath, { readonly: true })
  const row = findBundleRow(db, options)
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

  const report = {
    generatedAt: new Date().toISOString(),
    match: {
      sessionId: row.session_id,
      timestamp: row.timestamp,
      teamA: row.team_a_name,
      teamB: row.team_b_name,
      score: `${bundle.teamA?.score ?? 0}-${bundle.teamB?.score ?? 0}`,
      shotsA: bundle.teamA?.shots ?? 0,
      shotsB: bundle.teamB?.shots ?? 0,
      shotsOnTargetA: bundle.teamA?.shotsOnTarget ?? 0,
      shotsOnTargetB: bundle.teamB?.shotsOnTarget ?? 0,
    },
    counts: {
      events: events.length,
      passLog: passLog.length,
      midfieldSupport: countByType(events, 'MIDFIELD_SUPPORT'),
      carrierTraces: countByType(events, 'CARRIER_TRACE'),
      attackerZoneTraces: countByType(events, 'ATTACKER_ZONE_TRACE'),
      shotSnapshots: countByType(events, 'SHOT_POSITION_SNAPSHOT'),
      shotOnTargetSnapshots: countByType(events, 'SHOT_ON_TARGET_POSITION_SNAPSHOT'),
      shotDecisions: shotDecisions.length,
      passDecisions: passDecisions.length,
      turnovers: countByType(events, 'TURNOVER'),
      interceptions: countByType(events, 'INTERCEPTION'),
      fouls: countByType(events, 'FOUL'),
      tackles: countByType(events, 'TACKLE'),
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
    eventStream: summarizeEventStream(events, passLog),
    baselines: compareToBaselines(bundle, row.team_a_name, row.team_b_name),
    phaseTime: summarizePhaseTime(events),
    passByZone: summarizePassByZone(passDecisions),
    rolePositions: summarizeRolePositions(events),
    patterns: summarizePatterns(events),
    patternRoleAlignment: summaryPatternRoleAlignment(events),
    carrierTrajectories: summaryCarrierTrajectories(events),
    multiTouchOppHalf: summarizeMultiTouchOppHalfSequences(events),
    patternCrosses: (() => {
      const crossEvents = events.filter((e) => e.type === 'PATTERN_CROSS_EXECUTED')
      return {
        total: crossEvents.length,
        longLofted: crossEvents.filter((e) => e.detail?.style === 'LONG_LOFTED').length,
        driven: crossEvents.filter((e) => e.detail?.style === 'DRIVEN').length,
        samples: crossEvents.slice(0, 6).map((e) => ({
          team: e.team, passer: e.detail?.passer, target: e.detail?.target,
          targetRole: e.detail?.targetRole, style: e.detail?.style, crossDist: e.detail?.crossDist,
        })),
      }
    })(),
  }

  report.recommendations = buildRecommendations(report)
  const markdown = buildMarkdownReport(report)

  printSummary(report)
  writeReportFile(options.reportJson, options.reportMd, report, markdown)
  console.log(`Saved telemetry report JSON: ${path.resolve(process.cwd(), options.reportJson)}`)
  console.log(`Saved telemetry report Markdown: ${path.resolve(process.cwd(), options.reportMd)}`)
}

main()
