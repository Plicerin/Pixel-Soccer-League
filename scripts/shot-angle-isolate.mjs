#!/usr/bin/env node
/**
 * Is tight-angle shot accuracy a property of the shot model, or of whatever
 * RNG trajectory the match happened to be on when the shot was struck?
 *
 * The tight-angle test warms each attempt up with 120 ticks of live play so
 * the keeper is set rather than frozen on his kickoff spot. That warm-up also
 * consumes draws from the shared stream, so any change to what happens during
 * those two seconds -- a free kick holding the ball a moment longer, say --
 * re-rolls every shot that follows. This harness measures the same angles with
 * the warm-up as a switch, so the two causes can be told apart:
 *
 *   --warmup 0    the shot model alone. Identical across versions => untouched.
 *   --warmup 120  what the test actually measures.
 *
 * Usage: node scripts/shot-angle-isolate.mjs [--attempts 800] [--warmup 120]
 */
import process from 'node:process'
import { SimpleMatchModel } from '../src/core/simpleMatchModel.ts'
import { LEFT_GOAL_X, RIGHT_GOAL_X } from '../src/core/constants.ts'

const opts = { attempts: 800, warmup: 120, dist: 10 }
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--attempts') opts.attempts = Number(process.argv[++i])
  else if (process.argv[i] === '--warmup') opts.warmup = Number(process.argv[++i])
  else if (process.argv[i] === '--dist') opts.dist = Number(process.argv[++i])
}

const convert = (lateral, distFromGoal) => {
  let onTarget = 0
  for (let seed = 0; seed < opts.attempts; seed++) {
    const model = new SimpleMatchModel()
    model.setSeed(`angle-${lateral}-${distFromGoal}-${seed}`)
    model.startMatch()
    model.msm.state = { kind: 'live_play', half: 1, startTick: 0 }
    model.setManualControlEnabled('A', true)
    const sign = model.attackSign('A')
    const goalX = sign > 0 ? RIGHT_GOAL_X : LEFT_GOAL_X
    const carrier = model.getPlayers().find((p) => p.team === 'A' && p.role !== 'GK')
    carrier.pos = { x: goalX - sign * distFromGoal, y: 0, z: lateral }
    carrier.targetPos = { x: carrier.pos.x, z: lateral }
    model.possession = carrier
    model.manualControl.A.selectedPlayerId = carrier.id
    model.ball.pos = { x: carrier.pos.x, y: 0.18, z: lateral }
    model.manualControl.A.move = { x: sign, z: 0 }
    for (let i = 0; i < opts.warmup; i++) {
      model.possession = carrier
      carrier.pos = { x: goalX - sign * distFromGoal, y: 0, z: lateral }
      model.ball.pos = { x: carrier.pos.x, y: 0.18, z: lateral }
      model.step(1 / 60)
    }
    model.possession = carrier
    model.manualControl.A.selectedPlayerId = carrier.id
    model.manualControl.A.charge = { action: 'shot', progress: 0.6 }
    const before = model.getMatchSnapshot().shotsOnTargetA ?? 0
    model.releaseManualCharge('A')
    for (let i = 0; i < 200 && model.ballFlight; i++) model.step(1 / 60)
    if ((model.getMatchSnapshot().shotsOnTargetA ?? 0) > before) onTarget += 1
  }
  return onTarget / opts.attempts
}

const d = opts.dist
const central = convert(0, d)
const angled = convert(d * 0.85, d)
const veryWide = convert(d * 1.7, d)
const pp = (x) => `${(x * 100).toFixed(1)}%`
// Standard error of the difference between two independent proportions.
const se = (p, q) => Math.sqrt((p * (1 - p) + q * (1 - q)) / opts.attempts) * 100

console.log(`attempts ${opts.attempts}  warmup ${opts.warmup} ticks  dist ${d}u`)
console.log(`central   (z=0)      ${pp(central)}`)
console.log(`angled    (z=${(d * 0.85).toFixed(1)})   ${pp(angled)}`)
console.log(`veryWide  (z=${(d * 1.7).toFixed(1)})   ${pp(veryWide)}`)
console.log('')
console.log(`central - angled    ${(central * 100 - angled * 100).toFixed(1)}pp  (se ${se(central, angled).toFixed(1)}pp)`)
console.log(`angled - veryWide   ${(angled * 100 - veryWide * 100).toFixed(1)}pp  (se ${se(angled, veryWide).toFixed(1)}pp)`)
console.log('')
console.log(`monotonic: ${central > angled && angled > veryWide}`)
