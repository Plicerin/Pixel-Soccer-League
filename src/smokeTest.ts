/**
 * Smoke Test Runner — Automates N CPU-vs-CPU matches with telemetry recording.
 *
 * Usage (browser console):
 *   window.pslSmokeTest.run(10)          // 10 games, randomize teams
 *   window.pslSmokeTest.run(5, false)    // 5 games, same default teams
 *   window.pslSmokeTest.stop()           // abort early
 */
import { TelemetryRecorder, findRecentCompletedMatches, mirrorMatchSummary } from './telemetry';

const MLS_TEAMS = [
  'Atlanta United', 'Austin FC', 'Charlotte FC', 'Chicago Fire', 'FC Cincinnati',
  'Colorado Rapids', 'Columbus Crew', 'DC United', 'FC Dallas', 'Houston Dynamo',
  'Inter Miami', 'LA Galaxy', 'LAFC', 'Minnesota United', 'CF Montreal',
  'Nashville SC', 'New England Revolution', 'New York City FC', 'New York Red Bulls',
  'Orlando City', 'Philadelphia Union', 'Portland Timbers', 'Real Salt Lake',
  'San Diego FC', 'San Jose Earthquakes', 'Seattle Sounders', 'Sporting Kansas City',
  'St. Louis City SC', 'Toronto FC', 'Vancouver Whitecaps',
];

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

async function waitForFullTime(timeoutMs: number = 900_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (getState().aborted) return false;
    const game = getGameRef();
    if (!game) return false;
    const snap = game.getMatchSnapshot?.();
    if (snap?.phase === 'FULL_TIME') return true;
    await sleep(500);
  }
  console.warn('[SmokeTest] Timeout waiting for FULL_TIME');
  return false;
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

export async function runSmokeTest(numGames: number = 10, randomizeTeams: boolean = true): Promise<void> {
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
    const [teamA, teamB] = randomizeTeams ? pickTwoTeams() : ['Inter Miami', 'LA Galaxy'];
    const formA = pickRandom(FORMATIONS);
    const formB = pickRandom(FORMATIONS);

    console.log(`%c[SmokeTest] Game ${i + 1}/${numGames}: ${teamA} (${formA}) vs ${teamB} (${formB})`, 'color: #0af');

    // Reset the match (callback clears full-time UI but preserves CPU mode)
    game.resetMatch?.();
    await sleep(300);

    // Configure teams
    game.setTeamNames?.(teamA, teamB);
    game.setTeamFormations?.(formA, formB);

    // Start telemetry session
    const recorder = new TelemetryRecorder();
    recorder.setContext({
      teamAName: teamA,
      teamBName: teamB,
      teamAFormation: formA,
      teamBFormation: formB,
      notes: `Smoke test game ${i + 1}/${numGames}`,
    });
    await recorder.start(() => getGameRef(), 500);

    await recorder.recordEvent('mode_selected', {
      mode: 'cpu',
      cpuVsCpu: true,
      smokeTest: true,
      gameNumber: i + 1,
      totalGames: numGames,
      teamAName: teamA,
      teamBName: teamB,
    });

    // Start CPU vs CPU at normal speed
    game.setCpuVsCpu?.(true);
    game.setSeriesSpeedMul?.(1);
    game.setRestartDelays?.(0.8, 1.2);
    game.setMenuVisible?.(false);
    game.startKickoffPresentation?.(true);

    // Wait for full time
    const finished = await waitForFullTime();
    const snap = game.getMatchSnapshot?.();

    if (finished && snap) {
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
              sessionId: recorder.getSessionId(),
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

    // Give recorder time to capture the FULL_TIME snapshot
    await sleep(2000);
    await recorder.stop();

    getState().gamesPlayed = i + 1;
    await sleep(300);
  }
  } catch (err) {
    console.error('[SmokeTest] Error during test:', err);
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
    stop: stopSmokeTest,
    state: getTestState,
  };
}
