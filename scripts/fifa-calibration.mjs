#!/usr/bin/env node

import process from 'node:process'
import { SimpleMatchModel } from '../src/core/simpleMatchModel.ts'
import { FIFA_MEN_RANKINGS_2026_04_01 } from '../src/data/fifaMenRankings2026-04-01.ts'

const DEFAULT_GAMES_PER_FIXTURE = 20
const DEFAULT_HALF_SECONDS = 900
const DEFAULT_DT = 0.25

function printHelp() {
  console.log(`FIFA calibration harness

Usage:
  npm run sim:fifa-calibrate
  npm run sim:fifa-calibrate -- --games-per-fixture 30 --half-seconds 900

Options:
  --games-per-fixture <n>  Repeat count per fixed fixture (default ${DEFAULT_GAMES_PER_FIXTURE})
  --half-seconds <n>       Half duration in model seconds (default ${DEFAULT_HALF_SECONDS})
  --dt <n>                 Model timestep in seconds (default ${DEFAULT_DT})
  --bucket <name>          Optional fixture bucket filter: near-elite, medium-gap, large-gap`)
}

function parseArgs(argv) {
  const options = {
    gamesPerFixture: DEFAULT_GAMES_PER_FIXTURE,
    halfSeconds: DEFAULT_HALF_SECONDS,
    dt: DEFAULT_DT,
    bucket: '',
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--games-per-fixture') {
      options.gamesPerFixture = Number(argv[i + 1] || 0)
      i += 1
    } else if (arg === '--half-seconds') {
      options.halfSeconds = Number(argv[i + 1] || 0)
      i += 1
    } else if (arg === '--dt') {
      options.dt = Number(argv[i + 1] || 0)
      i += 1
    } else if (arg === '--bucket') {
      options.bucket = String(argv[i + 1] || '').trim().toLowerCase()
      i += 1
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  if (!Number.isFinite(options.gamesPerFixture) || options.gamesPerFixture <= 0) {
    throw new Error('Expected a positive number for --games-per-fixture')
  }
  if (!Number.isFinite(options.halfSeconds) || options.halfSeconds <= 0) {
    throw new Error('Expected a positive number for --half-seconds')
  }
  if (!Number.isFinite(options.dt) || options.dt <= 0) {
    throw new Error('Expected a positive number for --dt')
  }
  return options
}

function getTieredFixtures() {
  const byTeam = new Map(FIFA_MEN_RANKINGS_2026_04_01.map((row) => [row.team, row]))
  const base = [
    ['France', 'Spain', 'near-elite'],
    ['Argentina', 'England', 'near-elite'],
    ['Germany', 'Mexico', 'medium-gap'],
    ['Uruguay', 'Austria', 'medium-gap'],
    ['Canada', 'Sweden', 'medium-gap'],
    ['Belgium', 'Curaçao', 'large-gap'],
    ['United States', 'Haiti', 'large-gap'],
    ['Japan', 'South Africa', 'large-gap'],
    ['Portugal', 'Bosnia and Herzegovina', 'large-gap'],
  ]
  return base.map(([favorite, underdog, bucket]) => {
    const fav = byTeam.get(favorite)
    const dog = byTeam.get(underdog)
    if (!fav || !dog) throw new Error(`Missing FIFA ranking row for ${favorite} or ${underdog}`)
    return {
      favorite,
      underdog,
      favoriteRank: fav.rank,
      underdogRank: dog.rank,
      rankGap: dog.rank - fav.rank,
      bucket,
    }
  })
}

function runFixtureGame(fixture, gameIndex, options) {
  const model = new SimpleMatchModel()
  const favoriteHome = gameIndex % 2 === 0
  const teamA = favoriteHome ? fixture.favorite : fixture.underdog
  const teamB = favoriteHome ? fixture.underdog : fixture.favorite
  model.setTeamNames(teamA, teamB)
  model.setTeamFormations('4-3-3', '4-3-3')
  model.setSeed(`fifa-cal:${fixture.favorite}:${fixture.underdog}:${gameIndex}`)
  model.setHalfDurationSeconds(options.halfSeconds)
  model.setRestartDelays(0, 0)
  model.startMatch()

  const maxSteps = Math.ceil((options.halfSeconds * 2 + 60) / options.dt) * 4
  for (let step = 0; step < maxSteps && model.getMatchSnapshot().phase !== 'FULL_TIME'; step += 1) {
    model.step(options.dt)
  }

  const snapshot = model.getMatchSnapshot()
  const favoriteScore = favoriteHome ? snapshot.scoreA : snapshot.scoreB
  const underdogScore = favoriteHome ? snapshot.scoreB : snapshot.scoreA
  return {
    favoriteScore,
    underdogScore,
    shots: snapshot.shotsA + snapshot.shotsB,
    shotsOnTarget: snapshot.shotsOnTargetA + snapshot.shotsOnTargetB,
    passes: snapshot.passesA + snapshot.passesB,
    completedPasses: snapshot.passesCompletedA + snapshot.passesCompletedB,
  }
}

function summarizeFixture(fixture, options) {
  const summary = {
    ...fixture,
    games: 0,
    favoriteWins: 0,
    underdogWins: 0,
    draws: 0,
    favoriteGoals: 0,
    underdogGoals: 0,
    shots: 0,
    shotsOnTarget: 0,
    passes: 0,
    completedPasses: 0,
  }
  for (let i = 0; i < options.gamesPerFixture; i += 1) {
    const game = runFixtureGame(fixture, i, options)
    summary.games += 1
    summary.favoriteGoals += game.favoriteScore
    summary.underdogGoals += game.underdogScore
    summary.shots += game.shots
    summary.shotsOnTarget += game.shotsOnTarget
    summary.passes += game.passes
    summary.completedPasses += game.completedPasses
    if (game.favoriteScore > game.underdogScore) summary.favoriteWins += 1
    else if (game.favoriteScore < game.underdogScore) summary.underdogWins += 1
    else summary.draws += 1
  }
  return {
    ...summary,
    favoriteWinRate: summary.favoriteWins / summary.games,
    favoritePointsPerGame: (summary.favoriteWins * 3 + summary.draws) / summary.games,
    goalDiffPerGame: (summary.favoriteGoals - summary.underdogGoals) / summary.games,
    shotsPerGame: summary.shots / summary.games,
    shotsOnTargetPerGame: summary.shotsOnTarget / summary.games,
    passesPerGame: summary.passes / summary.games,
    completedPassesPerGame: summary.completedPasses / summary.games,
  }
}

function summarizeBuckets(rows) {
  const buckets = new Map()
  for (const row of rows) {
    const bucket = buckets.get(row.bucket) || {
      bucket: row.bucket,
      games: 0,
      favoriteWins: 0,
      underdogWins: 0,
      draws: 0,
      favoriteGoals: 0,
      underdogGoals: 0,
    }
    bucket.games += row.games
    bucket.favoriteWins += row.favoriteWins
    bucket.underdogWins += row.underdogWins
    bucket.draws += row.draws
    bucket.favoriteGoals += row.favoriteGoals
    bucket.underdogGoals += row.underdogGoals
    buckets.set(row.bucket, bucket)
  }
  return [...buckets.values()].map((bucket) => ({
    ...bucket,
    favoriteWinRate: bucket.favoriteWins / bucket.games,
    favoritePointsPerGame: (bucket.favoriteWins * 3 + bucket.draws) / bucket.games,
    goalDiffPerGame: (bucket.favoriteGoals - bucket.underdogGoals) / bucket.games,
  }))
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`
}

function printSummary(rows, bucketRows, options) {
  console.log(`FIFA calibration | halfSeconds=${options.halfSeconds} | gamesPerFixture=${options.gamesPerFixture}`)
  console.log('')
  console.log('Bucket summary')
  for (const row of bucketRows) {
    console.log(
      `  ${row.bucket.padEnd(12)} games=${String(row.games).padStart(3)} ` +
      `favWin=${pct(row.favoriteWinRate).padStart(6)} ` +
      `favPPG=${row.favoritePointsPerGame.toFixed(2)} ` +
      `goalDiff=${row.goalDiffPerGame.toFixed(2)}`
    )
  }
  console.log('')
  console.log('Fixture summary')
  for (const row of rows) {
    console.log(
      `  ${row.favorite} (#${row.favoriteRank}) vs ${row.underdog} (#${row.underdogRank}) ` +
      `gap=${String(row.rankGap).padStart(2)} | ` +
      `favWin=${pct(row.favoriteWinRate).padStart(6)} | ` +
      `favPPG=${row.favoritePointsPerGame.toFixed(2)} | ` +
      `goalDiff=${row.goalDiffPerGame.toFixed(2)}`
    )
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const fixtures = getTieredFixtures().filter((fixture) => !options.bucket || fixture.bucket === options.bucket)
  if (fixtures.length === 0) {
    throw new Error(`No fixtures matched bucket "${options.bucket}"`)
  }
  const rows = fixtures.map((fixture) => summarizeFixture(fixture, options))
  const bucketRows = summarizeBuckets(rows)
  printSummary(rows, bucketRows, options)
}

try {
  main()
} catch (error) {
  console.error(error.message || error)
  process.exit(1)
}
