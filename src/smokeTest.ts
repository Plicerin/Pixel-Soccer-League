/**
 * Smoke Test Runner — Automates CPU-vs-CPU matches inside the already-open app window.
 *
 * Usage (browser console):
 *   window.pslSmokeTest.run(10)                         // 10 games, randomize teams
 *   window.pslSmokeTest.run(5, false)                  // 5 games, same default teams
 *   window.pslSmokeTest.runFixture({                   // one fixed-fixture match in the current tab
 *     homeTeam: 'United States',
 *     awayTeam: 'Mexico',
 *     halfSeconds: 120,
 *   })
 *   window.pslSmokeTest.stop()                         // abort early
 */
import { findRecentCompletedMatches } from './telemetry';
import {
  classifyFixtureClockProgress,
  computeFixtureTimeoutMs,
  getFixtureElapsedSimSeconds,
  type FixtureTimeoutReason,
} from './fixtureTiming';
import { DEFAULT_AWAY_TEAM, DEFAULT_HOME_TEAM, WORLD_CUP_2026_TEAM_NAMES } from './teamCatalog.js';

const MLS_TEAMS = WORLD_CUP_2026_TEAM_NAMES;

const FORMATIONS = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '3-4-3'];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickTwoTeams(): [string, string] {
  const a = pickRandom(MLS_TEAMS);
  let b = pickRandom(MLS_TEAMS);
  while (b === a) b = pickRandom(MLS_TEAMS);
  return [a, b];
}

type SmokeTestState = {
  running: boolean;
  aborted: boolean;
  gamesPlayed: number;
  gamesTotal: number;
};

type FixtureRunOptions = {
  homeTeam?: string;
  awayTeam?: string;
  formationA?: string;
  formationB?: string;
  speedMul?: number;
  halfSeconds?: number;
  timeoutMs?: number;
  randomizeTeams?: boolean;
};

type FixtureRunResult = {
  teamA: string;
  teamB: string;
  formA: string;
  formB: string;
  finished: boolean;
  timedOut: boolean;
  timeoutReason: FixtureTimeoutReason | null;
  wallElapsedMs: number;
  simElapsedSeconds: number;
  expectedSimSeconds: number;
  scoreA: number;
  scoreB: number;
  shotsA: number;
  shotsB: number;
  shotsOnTargetA: number;
  shotsOnTargetB: number;
  savesA: number;
  savesB: number;
  sessionId: string | null;
  phase: string;
  half: number;
  elapsedInHalf: number;
  startedAt: number;
  completedAt: number;
  positionalDrift?: any[];
};

type FixtureWaitResult = {
  finished: boolean;
  reason: FixtureTimeoutReason | null;
  wallElapsedMs: number;
  simElapsedSeconds: number;
  expectedSimSeconds: number;
};

// Store state on window so HMR module reloads don't lose it
function getState(): SmokeTestState {
  const w = window as any;
  if (!w.__smokeTestState) {
    w.__smokeTestState = { running: false, aborted: false, gamesPlayed: 0, gamesTotal: 0 };
  }
  return w.__smokeTestState;
}

function getGameRef(): any {
  return (window as any).__gameRef;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForFullTime(options: Required<Pick<FixtureRunOptions, 'halfSeconds' | 'speedMul' | 'timeoutMs'>>): Promise<FixtureWaitResult> {
  const start = Date.now();
  let lastSimElapsed = 0;
  let lastProgressAt = start;
  while (Date.now() - start < options.timeoutMs) {
    const wallElapsedMs = Date.now() - start;
    if (getState().aborted) {
      return {
        finished: false,
        reason: 'aborted',
        wallElapsedMs,
        simElapsedSeconds: lastSimElapsed,
        expectedSimSeconds: options.halfSeconds * 2,
      };
    }
    const game = getGameRef();
    if (!game) {
      return {
        finished: false,
        reason: 'no_game',
        wallElapsedMs,
        simElapsedSeconds: lastSimElapsed,
        expectedSimSeconds: options.halfSeconds * 2,
      };
    }
    const snap = game.getMatchSnapshot?.();
    const simElapsedSeconds = getFixtureElapsedSimSeconds(snap, options.halfSeconds);
    if (simElapsedSeconds > lastSimElapsed + 0.25) {
      lastSimElapsed = simElapsedSeconds;
      lastProgressAt = Date.now();
    }
    if (snap?.phase === 'FULL_TIME') {
      return {
        finished: true,
        reason: null,
        wallElapsedMs,
        simElapsedSeconds,
        expectedSimSeconds: options.halfSeconds * 2,
      };
    }
    const progressReason = classifyFixtureClockProgress({
      wallElapsedMs,
      simElapsedSeconds,
      speedMul: options.speedMul,
    });
    if (progressReason && wallElapsedMs % 30_000 < 500) {
      console.warn(
        `[SmokeTest] Browser clock slow: sim=${simElapsedSeconds.toFixed(1)}s wall=${Math.round(wallElapsedMs / 1000)}s speed=${options.speedMul}x`
      );
    }
    if (Date.now() - lastProgressAt > 90_000) {
      return {
        finished: false,
        reason: 'clock_stalled',
        wallElapsedMs,
        simElapsedSeconds,
        expectedSimSeconds: options.halfSeconds * 2,
      };
    }
    await sleep(500);
  }
  console.warn('[SmokeTest] Timeout waiting for FULL_TIME');
  return {
    finished: false,
    reason: 'wall_time',
    wallElapsedMs: Date.now() - start,
    simElapsedSeconds: lastSimElapsed,
    expectedSimSeconds: options.halfSeconds * 2,
  };
}

async function waitForPhase(phase: string, timeoutMs: number = 10_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snap = getGameRef()?.getMatchSnapshot?.();
    if (snap?.phase === phase) return true;
    await sleep(100);
  }
  return false;
}

function normalizeFixtureOptions(input: FixtureRunOptions = {}): Required<FixtureRunOptions> {
  const [fallbackHome, fallbackAway] = input.randomizeTeams === false
    ? [DEFAULT_HOME_TEAM, DEFAULT_AWAY_TEAM]
    : pickTwoTeams();
  return {
    homeTeam: input.homeTeam || fallbackHome,
    awayTeam: input.awayTeam || fallbackAway,
    formationA: input.formationA || pickRandom(FORMATIONS),
    formationB: input.formationB || pickRandom(FORMATIONS),
    speedMul: Math.max(1, input.speedMul ?? 1),
    halfSeconds: Math.max(30, Math.floor(input.halfSeconds ?? 300)),
    timeoutMs: Math.max(30_000, Math.floor(input.timeoutMs ?? computeFixtureTimeoutMs({
      halfSeconds: Math.max(30, Math.floor(input.halfSeconds ?? 300)),
      speedMul: Math.max(1, input.speedMul ?? 1),
    }))),
    randomizeTeams: input.randomizeTeams ?? true,
  };
}

async function configureFixture(game: any, options: Required<FixtureRunOptions>): Promise<void> {
  game.setSplashSceneMode?.(false);
  game.setMenuVisible?.(false);
  game.resetMatch?.();
  await sleep(300);
  game.setSplashSceneMode?.(false);
  game.setTeamNames?.(options.homeTeam, options.awayTeam);
  game.setTeamFormations?.(options.formationA, options.formationB);
  game.setCpuVsCpu?.(true);
  game.setHalfDurationSeconds?.(options.halfSeconds);
  game.setSeriesSpeedMul?.(options.speedMul);
  game.setRestartDelays?.(options.speedMul > 1 ? 0.2 : 0.8, options.speedMul > 1 ? 0.3 : 1.2);
  game.setMenuVisible?.(false);
  game.startKickoffPresentation?.(true);
}

function buildFixtureResult(game: any, options: Required<FixtureRunOptions>, wait: FixtureWaitResult): FixtureRunResult {
  const snap = game.getMatchSnapshot?.() || {};
  const bundle = game.getTuningBundle?.() || {};
  return {
    teamA: options.homeTeam,
    teamB: options.awayTeam,
    formA: options.formationA,
    formB: options.formationB,
    finished: wait.finished,
    timedOut: !wait.finished && (wait.reason === 'wall_time' || wait.reason === 'clock_stalled' || wait.reason === 'clock_too_slow'),
    timeoutReason: wait.reason,
    wallElapsedMs: wait.wallElapsedMs,
    simElapsedSeconds: wait.simElapsedSeconds,
    expectedSimSeconds: wait.expectedSimSeconds,
    scoreA: snap.scoreA ?? 0,
    scoreB: snap.scoreB ?? 0,
    shotsA: snap.shotsA ?? 0,
    shotsB: snap.shotsB ?? 0,
    shotsOnTargetA: snap.shotsOnTargetA ?? 0,
    shotsOnTargetB: snap.shotsOnTargetB ?? 0,
    savesA: snap.savesA ?? 0,
    savesB: snap.savesB ?? 0,
    sessionId: bundle?.metadata?.sessionId || snap?.sessionId || null,
    phase: snap.phase ?? 'UNKNOWN',
    half: snap.half ?? 0,
    elapsedInHalf: snap.elapsedInHalf ?? 0,
    startedAt: Date.now(),
    completedAt: Date.now(),
    positionalDrift: game.getPositionalDriftReport?.() || bundle?.positionalDrift || [],
  };
}

export async function runFixture(input: FixtureRunOptions = {}): Promise<FixtureRunResult | null> {
  const game = getGameRef();
  if (!game) {
    console.error('[SmokeTest] No game ref found. Make sure the game is loaded.');
    return null;
  }
  const st = getState();
  if (st.running) {
    console.warn('[SmokeTest] Already running.');
    return null;
  }

  const options = normalizeFixtureOptions({ ...input, randomizeTeams: false });
  st.running = true;
  st.aborted = false;
  st.gamesPlayed = 0;
  st.gamesTotal = 1;
  game.setSmokeTestMode?.(true);

  console.log(
    `%c[SmokeTest] Fixture: ${options.homeTeam} (${options.formationA}) vs ${options.awayTeam} (${options.formationB}) | half=${options.halfSeconds}s speed=${options.speedMul}x`,
    'color: #0af'
  );

  try {
    await configureFixture(game, options);
    const wait = await waitForFullTime(options);
    const result = buildFixtureResult(game, options, wait);
    (window as any).__lastSmokeFixtureResult = result;
    if (wait.finished) {
      console.log(
        `%c[SmokeTest] FINAL: ${result.teamA} ${result.scoreA} - ${result.scoreB} ${result.teamB} | Shots: ${result.shotsA}-${result.shotsB} | SOG: ${result.shotsOnTargetA}-${result.shotsOnTargetB}`,
        'color: #ff0'
      );
    } else {
      console.warn(
        `%c[SmokeTest] Fixture ${result.timeoutReason || 'timed_out'} at ${result.phase} half=${result.half} clock=${result.elapsedInHalf.toFixed(1)} wall=${Math.round(result.wallElapsedMs / 1000)}s sim=${result.simElapsedSeconds.toFixed(1)}s/${result.expectedSimSeconds}s`,
        'color: #f80'
      );
    }
    st.gamesPlayed = 1;
    return result;
  } finally {
    game.setSmokeTestMode?.(false);
    game.setSeriesSpeedMul?.(1);
    game.setRestartDelays?.(2.0, 3.0);
    st.running = false;
  }
}

export async function runSmokeTest(numGames: number = 10, randomizeTeams: boolean = true, speedMul: number = 1): Promise<void> {
  const game = getGameRef();
  if (!game) {
    console.error('[SmokeTest] No game ref found. Make sure the game is loaded.');
    return;
  }
  const st = getState();
  if (st.running) {
    console.warn('[SmokeTest] Already running.');
    return;
  }

  st.running = true;
  st.aborted = false;
  st.gamesPlayed = 0;
  st.gamesTotal = numGames;

  // Tell React's onReset callback to only clear UI state, not disable CPU mode
  game.setSmokeTestMode?.(true);

  console.log(`%c[SmokeTest] Starting ${numGames}-game smoke test...`, 'color: #0f0; font-weight: bold');

  try {
  for (let i = 0; i < numGames; i++) {
    if (getState().aborted) {
      console.log(`%c[SmokeTest] Aborted after ${i} games.`, 'color: #f80');
      break;
    }

    // Pick teams
    const options = normalizeFixtureOptions({
      randomizeTeams,
      speedMul,
      homeTeam: randomizeTeams ? undefined : DEFAULT_HOME_TEAM,
      awayTeam: randomizeTeams ? undefined : DEFAULT_AWAY_TEAM,
    });
    const { homeTeam: teamA, awayTeam: teamB, formationA: formA, formationB: formB } = options;

    console.log(`%c[SmokeTest] Game ${i + 1}/${numGames}: ${teamA} (${formA}) vs ${teamB} (${formB})`, 'color: #0af');

    await configureFixture(game, options);

    // Wait for full time
    const wait = await waitForFullTime(options);
    const snap = game.getMatchSnapshot?.();
    const live = game.getLiveTelemetry?.();

    if (wait.finished && snap) {
      console.log(
        `%c[SmokeTest] Game ${i + 1} FINAL: ${teamA} ${snap?.scoreA ?? '?'} - ${snap?.scoreB ?? '?'} ${teamB}  |  Shots: ${snap?.shotsA}-${snap?.shotsB}  SOG: ${snap?.shotsOnTargetA}-${snap?.shotsOnTargetB}  Saves: ${snap?.savesA}-${snap?.savesB}`,
        'color: #ff0'
      );

      // Directly POST the result to match-results.json (bypass IndexedDB lookup)
      try {
        await fetch('/__telemetry/mirror', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: `smoke-${Date.now()}-${i}`,
              startedAt: Date.now(),
              teamAName: teamA,
              teamBName: teamB,
              teamAFormation: formA,
              teamBFormation: formB,
              finalScoreA: snap.scoreA ?? 0,
              finalScoreB: snap.scoreB ?? 0,
              shotsA: snap.shotsA ?? 0,
              shotsB: snap.shotsB ?? 0,
              shotsOnTargetA: snap.shotsOnTargetA ?? 0,
              shotsOnTargetB: snap.shotsOnTargetB ?? 0,
              savesA: snap.savesA ?? 0,
              savesB: snap.savesB ?? 0,
              cornersA: snap.cornersA ?? 0,
              cornersB: snap.cornersB ?? 0,
              foulsA: live?.teamA?.fouls ?? 0,
              foulsB: live?.teamB?.fouls ?? 0,
              penaltiesAwardedA: live?.teamA?.penaltiesAwarded ?? 0,
              penaltiesAwardedB: live?.teamB?.penaltiesAwarded ?? 0,
              penaltiesScoredA: live?.teamA?.penaltiesScored ?? 0,
              penaltiesScoredB: live?.teamB?.penaltiesScored ?? 0,
              throwInsA: live?.teamA?.throwIns ?? 0,
              throwInsB: live?.teamB?.throwIns ?? 0,
              headersA: snap.headersA ?? 0,
              headersB: snap.headersB ?? 0,
              passesA: live?.teamA?.passes ?? 0,
              passesB: live?.teamB?.passes ?? 0,
              tacklesWonA: live?.teamA?.tackles ?? 0,
              tacklesWonB: live?.teamB?.tackles ?? 0,
              clearancesA: live?.teamA?.clearances ?? 0,
              clearancesB: live?.teamB?.clearances ?? 0,
              possessionA: live?.teamA?.possession ?? '',
              possessionB: live?.teamB?.possession ?? '',
              phase: snap.phase,
              half: snap.half,
              elapsedInHalf: snap.elapsedInHalf,
              timestamp: Date.now(),
            }),
        });
      } catch { /* dev server may not be running */ }
    } else {
      console.warn(`%c[SmokeTest] Game ${i + 1} did not finish properly.`, 'color: #f80');
    }

    getState().gamesPlayed = i + 1;

    // Give a brief pause before the next game
    await sleep(300);
  }
  } catch (err) {
    console.error('[SmokeTest] Error during test:', err);
    console.error('[SmokeTest] Games completed before error:', getState().gamesPlayed);
  }

  // Restore normal mode & speeds
  game.setSmokeTestMode?.(false);
  game.setSeriesSpeedMul?.(1);
  game.setRestartDelays?.(2.0, 3.0);

  // Print summary
  const matches = await findRecentCompletedMatches({ limit: numGames });
  console.log(`%c[SmokeTest] Complete! ${getState().gamesPlayed} games played.`, 'color: #0f0; font-weight: bold');
  console.table(matches.map(m => ({
    teams: `${m.teamAName} vs ${m.teamBName}`,
    score: `${m.finalScoreA} - ${m.finalScoreB}`,
    shots: `${m.shotsA} - ${m.shotsB}`,
    sog: `${m.shotsOnTargetA} - ${m.shotsOnTargetB}`,
    saves: `${m.savesA} - ${m.savesB}`,
    formations: `${m.teamAFormation} vs ${m.teamBFormation}`,
  })));

  getState().running = false;
}

export function stopSmokeTest(): void {
  const st = getState();
  if (!st.running) {
    console.log('[SmokeTest] Not running.');
    return;
  }
  st.aborted = true;
  console.log('%c[SmokeTest] Stop requested...', 'color: #f80');
}

export function getTestState(): SmokeTestState {
  return { ...getState() };
}

export function installSmokeTestApi(): void {
  (window as any).pslSmokeTest = {
    run: runSmokeTest,
    runFixture,
    stop: stopSmokeTest,
    state: getTestState,
  };
}
