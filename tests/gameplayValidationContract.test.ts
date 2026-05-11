import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('gameplay validation contract preserves new architecture activation and game ref surfaces', () => {
  const retroFootball = readFileSync('src/components/RetroFootball.tsx', 'utf8')
  const gameEngine = readFileSync('src/gameEngine.ts', 'utf8')
  const bridge = readFileSync('src/core/gameEngineBridge.ts', 'utf8')

  assert.match(retroFootball, /const urlParams = new URLSearchParams\(window\.location\.search\)/)
  assert.match(retroFootball, /setUseNewArchitecture\?\.\(!useLegacyArchitecture\)/)
  assert.match(retroFootball, /if \(!useLegacyArchitecture && urlParams\.has\('newarch'\)\)/)
  assert.match(gameEngine, /setUseNewArchitecture:\s*\(enabled: boolean\)/)
  assert.match(gameEngine, /getMatchSnapshot:\s*\(\)\s*=>/)
  assert.match(gameEngine, /getTuningBundle:\s*\(\)\s*=>/)
  assert.doesNotMatch(gameEngine, /syncPositionsToOrchestrator\(_orchestratorBridge, players\)/)
  assert.doesNotMatch(gameEngine, /syncBallToOrchestrator\(_orchestratorBridge, ballState\)/)
  assert.match(gameEngine, /const orchPlayers = bridge\.orchestrator\.getPlayers\(\)/)
  assert.doesNotMatch(gameEngine, /const fromP = players\.find\(\(p: any\) => String\(p\.id\) === fromId\)/)
  assert.match(bridge, /mapLegacyRoleToOrchestratorRole/)
})

test('gameplay validation contract preserves telemetry and DB consumer surfaces', () => {
  const recorder = readFileSync('src/telemetry/recorder.ts', 'utf8')
  const dashboard = readFileSync('src/components/MatchHistoryDashboard.tsx', 'utf8')
  const gameEngine = readFileSync('src/gameEngine.ts', 'utf8')

  assert.match(recorder, /window\.pslTelemetry\s*=\s*\{/)
  assert.match(dashboard, /fetch\('\/__db\/matches\?limit=50'\)/)
  assert.match(gameEngine, /onPassComplete:\s*\(passerId: string, receiverId: string\)\s*=>/)
  assert.doesNotMatch(gameEngine, /if \(team === 'A'\) \{ gameState\.passesA\+\+; if \(type !== 'long'\) gameState\.passesCompletedA\+\+; \}/)
})
