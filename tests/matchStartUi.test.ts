import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('V22 UI kickoff paths clear splash scene before starting kickoff presentation', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  const lines = source.split(/\r?\n/);
  const startLines = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.includes('startKickoffPresentation?.(true)'));

  assert.ok(startLines.length >= 1, 'expected at least one UI kickoff presentation call');

  for (const { index } of startLines) {
    const priorBlock = lines.slice(Math.max(0, index - 4), index).join('\n');
    assert.match(
      priorBlock,
      /setSplashSceneMode\?\.\(false\)/,
      `startKickoffPresentation at line ${index + 1} must clear splash scene mode first`,
    );
  }
});

test('V39 browser match setup offers required half lengths and defaults to 5 minutes', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  assert.match(
    source,
    /const \[halfLengthMinutes, setHalfLengthMinutes\] = useState\(5\)/,
    'browser default half length must be 5 minutes',
  );
  assert.match(source, /options=\{\['2', '5', '15', '45'\]\}/, 'expected only 2, 5, 15, and 45 minute half options');
  assert.match(source, /Number\(snapshot\.halfDuration\)/, 'scoreboard clock must use configured half duration');
});

test('browser match HUD includes live scoreboard and timer', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  assert.match(source, /formatScoreboardClock/, 'expected a scoreboard clock formatter');
  assert.match(source, /scoreboardPhaseLabel/, 'expected a scoreboard phase label');
  assert.match(source, /showScoreboard/, 'expected a live scoreboard visibility gate');
  assert.match(source, /data-psl-scoreboard="live"/, 'expected a stable live scoreboard DOM marker');
  assert.match(source, /matchSnapshot\?\.scoreA/, 'expected scoreboard to render home score from match snapshot');
  assert.match(source, /matchSnapshot\?\.scoreB/, 'expected scoreboard to render away score from match snapshot');
});

test('browser match HUD includes a real pause button wired to the engine', () => {
  const ui = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  assert.match(ui, /data-psl-pause-button="match"/, 'expected stable pause button marker in match HUD');
  assert.match(ui, /togglePaused\?\.\(\)/, 'pause button must call the engine pause toggle');
  assert.match(engine, /private paused = false/, 'engine must store pause state');
  assert.match(engine, /if \(!this\.paused\) \{\s*this\.model\.step\(dt\);/, 'paused engine must stop model stepping');
  assert.match(engine, /getPaused = \(\) => this\.paused/, 'UI needs a pause-state getter');
});

test('browser exposes the simple model engine through the documented game API', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  assert.match(source, /\(window as any\)\.__gameRef = gameRef\.current/, 'automation still needs the legacy debug game ref');
  assert.match(source, /\(window as any\)\.pslGame = gameRef\.current/, 'existing scripts still need pslGame');
  assert.match(source, /\(window as any\)\.game = gameRef\.current/, 'I.gameapi requires the model-backed engine on window.game');
  assert.match(source, /installSmokeTestApi\(\)/, 'browser fixture runner must be installed after the game bridge exists');
});

test('browser fixture harness keeps reused graphics tab lifecycle-active', () => {
  const source = readFileSync('scripts/browser-harness-fixture.mjs', 'utf8');
  assert.match(source, /function keepPageLifecycleActive/, 'browser harness must hold reused tabs active while fixtures run');
  assert.match(source, /function connectBrowser/, 'browser harness must connect through a controlled CDP helper');
  assert.match(source, /function isDestroyedContextError/, 'browser harness must classify reused-tab navigation context races');
  assert.match(source, /function waitForFixtureApi/, 'browser harness must wait for the fixture API in a stable page context');
  assert.match(source, /function evaluateFixtureRun/, 'browser harness must retry fixture evaluation after context destruction');
  assert.match(source, /http:\/\/\[::1\]:9222/, 'browser harness must fall back to IPv6 loopback CDP on Windows');
  assert.match(source, /Page\.setWebLifecycleState', \{ state: 'active' \}/, 'browser harness must prevent hidden-tab RAF stalls');
  assert.match(source, /Emulation\.setFocusEmulationEnabled', \{ enabled: true \}/, 'browser harness must emulate focus for the reused tab');
  assert.match(source, /releaseLifecycleHold/, 'browser harness must release the lifecycle hold after the fixture');
  assert.match(source, /process\.exit\(0\)/, 'browser harness must terminate after report writes so CLI runs do not hang');
});

test('watched fixture status does not cover the live scoreboard', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  assert.match(
    source,
    /data-psl-watched-fixture-status="compact"/,
    'expected watched fixture status to use a stable compact HUD marker',
  );
  assert.match(
    source,
    /absolute bottom-4 left-4 z-30/,
    'watched fixture status must stay below and away from the top-center scoreboard',
  );
  assert.match(
    source,
    /absolute top-5 left-1\/2 z-\[120\]/,
    'scoreboard must render above routine HUD chips',
  );
});

test('broadcast camera tracks side to side without swing rotation', () => {
  const source = readFileSync('src/gameEngine.ts', 'utf8');
  const match = source.match(/private updateBroadcastCamera\(dt: number\) \{[\s\S]*?\n  \}/);
  assert.ok(match, 'expected updateBroadcastCamera implementation');
  const body = match[0];
  assert.match(body, /this\.cameraLerpPosition\.set\(desiredCamX, this\.broadcastCameraHome\.y, this\.broadcastCameraHome\.z\)/, 'camera must keep fixed height and depth');
  assert.match(body, /this\.cameraLookTarget\.set\(this\.camera\.position\.x, 0, 0\)/, 'camera target must move with camera X to preserve fixed viewing angle');
  assert.doesNotMatch(body, /cameraFocusSmoothed\.z|edgeTrackT|lookZ|camZMul|camZClamp|finalThirdT/, 'broadcast camera must not swing by tracking Z or zooming into final thirds');
});

test('V61 renderer does not add extra height to model ball position', () => {
  const source = readFileSync('src/gameEngine.ts', 'utf8');
  assert.match(source, /const ballY = Math\.max\(BALL_GROUND_Y,\s*this\.model\.ball\.pos\.y\)/);
  assert.doesNotMatch(source, /this\.model\.ball\.pos\.y\s*\+\s*0\.2/, 'renderer must not double-count ball radius/height');
});

test('V68 renderer uses keeper dive frames for save events', () => {
  const source = readFileSync('src/gameEngine.ts', 'utf8');
  assert.match(source, /type KeeperDiveDirection = 'left' \| 'right' \| 'up' \| 'down'/, 'expected explicit keeper dive direction type');
  assert.match(source, /private readonly keeperReactions = new Map<string, KeeperReaction>/, 'keeper reactions must carry dive state');
  assert.match(source, /event\.meta\?\.diveDirection/, 'save events must drive the visual direction from model metadata');
  assert.match(source, /private updateKeeperDiveSprite/, 'renderer must have a dedicated keeper dive sprite path');
  assert.match(source, /private keeperDiveFrames/, 'renderer must select the existing dive frame set');
  assert.match(source, /visual\.diveLeftFrames/, 'left dive frames must be reachable');
  assert.match(source, /visual\.diveRightFrames/, 'right dive frames must be reachable');
  assert.match(source, /visual\.diveUpFrames/, 'up dive frames must be reachable');
  assert.match(source, /visual\.diveDownFrames/, 'down dive frames must be reachable');
});

test('V69 renderer gives throw-ins a sideline setup presentation', () => {
  const source = readFileSync('src/gameEngine.ts', 'utf8');
  assert.match(source, /type RestartPresentationType = 'throw_in' \| 'corner' \| 'goal_kick'/, 'restart presentation types must be explicit');
  assert.match(source, /activeRestartPresentation/, 'renderer must retain active restart presentation state');
  assert.match(source, /updateRestartPresentationFromEvent/, 'restart live events must feed presentation state');
  assert.match(source, /event\.action === 'THROW_IN'/, 'throw-in live events must be handled by the renderer');
  assert.match(source, /private updateThrowInSprite/, 'throw-in taker must get a controlled setup pose');
  assert.match(source, /private restartPresentationBallPosition/, 'throw-in setup must render the ball above the taker before release');
  assert.match(source, /FIELD_D \/ 2 \+ 0\.45/, 'throw-in taker should be displayed just outside the touchline');
});

test('V70 renderer gives corners a flag setup presentation', () => {
  const source = readFileSync('src/gameEngine.ts', 'utf8');
  assert.match(source, /event\.action === 'CORNER'/, 'corner live events must be handled by the renderer');
  assert.match(source, /private updateCornerKickSprite/, 'corner taker must get a controlled setup pose');
  assert.match(source, /restart\.type === 'corner'/, 'corner restart presentation must pin the ball at the flag during setup');
  assert.match(source, /restartPresentationPosition\(restart\)/, 'corner presentation must use restart spot for visual placement');
});

test('V62 dashboard and preview server keep completed-match telemetry complete', () => {
  const dashboard = readFileSync('public/dashboard.html', 'utf8');
  const viteConfig = readFileSync('vite.config.ts', 'utf8');
  assert.match(dashboard, /D\?\.sessionId \|\| D\?\.metadata\?\.sessionId \|\| snap\?\.sessionId/, 'dashboard must fetch DB events using metadata session id when needed');
  assert.match(dashboard, /D\.passDecisions\.map/, 'pass intelligence must prefer full pass decision rows over sparse event rows');
  assert.match(dashboard, /const statValue = \(value\) => value \?\? 0/, 'role behavior must not render undefined stat values');
  assert.match(dashboard, /if \(!D && !_historyModeActive && history\.length > 0\)/, 'dashboard must auto-load latest history row when no live payload is present');
  assert.match(dashboard, /if \(D\.tuning\?\.label \|\| D\.tuning\?\.description\)/, 'dashboard must not render undefined tuning marker copy');
  assert.match(viteConfig, /configurePreviewServer\(server\)/, 'preview server must install telemetry DB routes');
  assert.match(viteConfig, /\/__db\/telemetry-events/, 'dashboard telemetry-events route must exist in server middleware');
});

test('dashboard match overview treats short runtime as a full-match simulation', () => {
  const source = readFileSync('public/dashboard.html', 'utf8');
  assert.match(source, /function getMatchDurationInfo/, 'dashboard should derive match duration from halfDuration metadata');
  assert.match(source, /runtimeMinutes/, 'dashboard should label selected half length as runtime, not simulated soccer duration');
  assert.match(source, /durationFactor: 1/, 'dashboard must keep KPI expectations at full-match scale');
  assert.match(source, /Full-match expected raw totals/, 'overview copy must include full-match raw expectations');
  assert.match(source, /Shots \/ SOT raw/, 'overview must label raw shot totals');
  assert.match(source, /Shots \/ SOT full-match expected raw totals/, 'overview copy must compare shots to full-match expectations');
  assert.match(source, /Passes full-match expected raw total/, 'overview copy must compare passes to full-match expectations');
  assert.doesNotMatch(source, /per90|per 90/i, 'dashboard must not treat short matches as compressed 90-minute projections');
  assert.match(source, /metric === 'shotsOnTarget' && value < expected\.min \* 0\.5/, 'dashboard must fail, not watch, extremely low full-match SOT volume');
  assert.match(source, /statCard\('Runtime'/, 'overview cards must show runtime duration');
  assert.match(source, /statCard\('Full-Match KPI'/, 'overview cards must show full-match KPI ranges');
});

test('dashboard reports full-match KPI status and zero-shot failures', () => {
  const source = readFileSync('public/dashboard.html', 'utf8');
  assert.match(source, /id="panelKpis"/, 'dashboard must expose a KPI report panel');
  assert.match(source, /function renderKpiReport/, 'dashboard must render KPI cards and detail rows');
  assert.match(source, /Zero-Shot Guard/, 'dashboard must report the zero-shot full-time guard');
  assert.match(source, /zeroShotFullTime/, 'dashboard must compute zero-shot full-time failures');
  assert.match(source, /Completed match has 0 shots after/, 'dashboard must explain invalid zero-shot completed matches');
  assert.match(source, /renderKpiReport\(\)/, 'master render must update the KPI report panel');
  assert.match(source, /matchPhase: bundle\.metadata\?\.matchPhase \|\| entry\.phase/, 'history loads must preserve full-time phase for KPI guards');
});

test('V52 telemetry tools keep full-match KPI thresholds for compressed runtime matches', () => {
  const simpleKpi = readFileSync('scripts/simple-model-kpi.mjs', 'utf8');
  const analyzer = readFileSync('scripts/telemetry-analyze-latest.mjs', 'utf8');

  assert.match(simpleKpi, /function simulationThresholds/, 'simple KPI guard must compare against full-match thresholds');
  assert.match(simpleKpi, /simulatedMinutes: 90/, 'simple KPI report must distinguish runtime from simulated match length');
  assert.doesNotMatch(simpleKpi, /RATE_SCALED_THRESHOLDS|FULL_MATCH_SECONDS/, 'simple KPI guard must not scale raw stat targets by runtime length');
  assert.match(analyzer, /function getBundleDurationInfo/, 'telemetry analyzer must derive duration from bundle metadata');
  assert.match(analyzer, /durationFactor: 1/, 'telemetry analyzer must keep full-match baseline scale');
  assert.match(analyzer, /full-match raw expectations/, 'telemetry output must disclose full-match baseline comparisons');
  assert.match(analyzer, /Full-match attacking volume is too low/, 'analyzer must recommend action when compressed-runtime matches underproduce full-match shots');
  assert.match(analyzer, /Full-match shot-on-target volume is too low/, 'analyzer must recommend action when completed matches underproduce full-match SOT');
  assert.match(analyzer, /Full-match pass volume is too low/, 'analyzer must recommend action when completed matches underproduce full-match passes');
});
