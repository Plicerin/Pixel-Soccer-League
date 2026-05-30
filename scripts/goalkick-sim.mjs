#!/usr/bin/env node
import process from 'node:process'
import { SimpleMatchModel } from '../src/core/simpleMatchModel.ts'
import { GOAL_MOUTH_HALF_Z, RIGHT_GOAL_X } from '../src/core/constants.ts'

function parseArgs(argv) {
  return {
    quiet: argv.includes('--quiet'),
    help: argv.includes('--help') || argv.includes('-h'),
  }
}

function printHelp() {
  console.log(`Goal-kick restart regression harness.

Usage:
  node --import tsx scripts/goalkick-sim.mjs

The harness forces two right-goal-line exits:
  1. attacker last touch -> goal_kick to away
  2. defender last touch -> corner to home

It observes the real match-state event shape: { kind: "ball_out", restartType, restartTeam }.
`)
}

function forceRightGoalLineExit(lastTouchTeam) {
  const model = new SimpleMatchModel()
  model.setSeed(`goalkick-sim-${lastTouchTeam}`)
  model.startMatch()
  model.msm.state = { kind: 'live_play', half: 1, startTick: 0 }
  model.msm.clock.elapsedInHalf = 24

  const toucher = model.getPlayers().find((player) => player.team === lastTouchTeam && player.role !== 'GK')
  if (!toucher) throw new Error(`Missing outfield player for team ${lastTouchTeam}`)

  toucher.pos = { x: RIGHT_GOAL_X - 0.7, y: 0, z: GOAL_MOUTH_HALF_Z + 3.0 }
  toucher.targetPos = { x: toucher.pos.x, z: toucher.pos.z }
  model.possession = toucher
  model.rememberTouch(toucher)
  model.ball.pos = { x: toucher.pos.x, y: 0.18, z: toucher.pos.z }
  model.startBallFlight(
    'pass',
    { x: RIGHT_GOAL_X - 0.7, z: GOAL_MOUTH_HALF_Z + 3.0 },
    { x: RIGHT_GOAL_X + 1.4, z: GOAL_MOUTH_HALF_Z + 4.0 },
    0.1,
    0.04,
  )

  const observed = []
  for (let tick = 0; tick < 180; tick++) {
    model.step(1 / 60)
    model.updateVisuals(1 / 60)
    if (model.msm.state.kind === 'ball_out') {
      const ev = {
        kind: 'ball_out',
        restartType: model.msm.state.restartType,
        restartTeam: model.msm.state.restartTeam,
        tick,
      }
      observed.push(ev)
      return { model, observed, event: ev }
    }
  }

  return { model, observed, event: null }
}

function assertRestart(label, result, expectedType, expectedTeam) {
  const ev = result.observed.find((candidate) => candidate.kind === 'ball_out')
  if (!ev) {
    throw new Error(`${label}: expected ball_out restart, saw none`)
  }
  if (ev.restartType !== expectedType || ev.restartTeam !== expectedTeam) {
    throw new Error(
      `${label}: expected ${expectedType}/${expectedTeam}, got ${ev.restartType || 'none'}/${ev.restartTeam || 'none'}`,
    )
  }
  return ev
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    printHelp()
    return
  }

  const goalKick = forceRightGoalLineExit('A')
  const corner = forceRightGoalLineExit('B')
  const goalKickEvent = assertRestart('attacker last touch', goalKick, 'goal_kick', 'away')
  const cornerEvent = assertRestart('defender last touch', corner, 'corner', 'home')

  if (!opts.quiet) {
    console.log(JSON.stringify({
      ok: true,
      firstRestart: goalKickEvent,
      secondRestart: cornerEvent,
      goalKicksB: goalKick.model.getMatchSnapshot().goalKicksB,
      cornersA: corner.model.getMatchSnapshot().cornersA,
    }, null, 2))
  }
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
