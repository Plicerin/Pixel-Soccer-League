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
  assert.match(
    source,
    /const showScoreboard = hasActiveMatchSession && !showSplash && !isFullTime/,
    'scoreboard must not render on the start menu without an active match session',
  );
  assert.match(source, /data-psl-scoreboard="live"/, 'expected a stable live scoreboard DOM marker');
  assert.match(source, /matchSnapshot\?\.scoreA/, 'expected scoreboard to render home score from match snapshot');
  assert.match(source, /matchSnapshot\?\.scoreB/, 'expected scoreboard to render away score from match snapshot');
  assert.match(source, /function ScoreboardFlag/, 'scoreboard must render country flags through a dedicated component');
  assert.match(source, /getWorldCupTeamFlag\(teamName\)/, 'scoreboard flags must come from the world-team catalog');
  assert.match(source, /getWorldCupTeamFlagAsset\(teamName\)/, 'scoreboard must render real flag image assets');
  assert.match(source, /<img[\s\S]*src=\{flagAsset\}/, 'scoreboard must use image flags instead of emoji-only rendering');
  assert.match(source, /onError=\{\(event\) => \{[\s\S]*event\.currentTarget\.style\.display = 'none'/, 'scoreboard must keep emoji fallback if a flag image fails');
  assert.match(source, /<ScoreboardFlag teamName=\{scoreboardTeamA\} \/>/, 'home side must show its country flag');
  assert.match(source, /<ScoreboardFlag teamName=\{scoreboardTeamB\} \/>/, 'away side must show its country flag');
});

test('V96 full-time overlay captures active match teams once', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  assert.match(source, /activeMatchTeamsRef/, 'full-time fallback must use the active match team lock');
  assert.match(source, /teamANameRef/, 'full-time fallback must use current refs instead of initial render state');
  assert.match(source, /teamBNameRef/, 'full-time fallback must use current refs instead of initial render state');
  assert.match(source, /fullTimeCapturedRef/, 'full-time overlay must be captured once per match');
  assert.match(source, /activeMatchTeamsRef\.current = \{ a: nextTeamAName, b: nextTeamBName \}/, 'kickoff must lock the selected teams for the final screen');
  assert.match(source, /const teamA = snapshot\.teamAName \|\| activeMatchTeamsRef\.current\?\.a \|\| teamANameRef\.current/, 'home final-screen team must not fall back to stale initial menu state');
  assert.match(source, /const teamB = snapshot\.teamBName \|\| activeMatchTeamsRef\.current\?\.b \|\| teamBNameRef\.current/, 'away final-screen team must not fall back to stale initial menu state');
  assert.doesNotMatch(source, /teamA:\s*snapshot\.teamAName \|\| teamAName/, 'stale home team fallback must not be used for full-time score');
  assert.doesNotMatch(source, /teamB:\s*snapshot\.teamBName \|\| teamBName/, 'stale away team fallback must not be used for full-time score');
});

test('browser menus use the current Pixel Soccer League logo asset', () => {
  const retro = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  const season = readFileSync('src/components/SeasonHub.tsx', 'utf8');
  assert.match(retro, /\/assets\/Pixel%20Soccer%20League2\.png/, 'start and main menus must use the current logo asset');
  assert.match(season, /\/assets\/Pixel%20Soccer%20League2\.png/, 'season hub must use the current logo asset');
  assert.match(retro, /w-\[40rem\] max-w-\[92vw\]/, 'splash logo must render at the larger current size');
  assert.match(retro, /w-\[36rem\] max-w-\[78vw\]/, 'main menu logo must render at the larger current size');
  assert.match(season, /w-\[36rem\] max-w-\[92vw\]/, 'season hub logo must render at the larger current size');
  assert.doesNotMatch(retro, /\/assets\/pixel-soccer-league\.webp/, 'browser menus must not use the old webp logo');
  assert.doesNotMatch(season, /\/assets\/pixel-soccer-league\.webp/, 'season hub must not use the old webp logo');
});

test('browser main menu follows the World Cup mockup layout', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  assert.match(source, /data-psl-main-menu="world-cup"/, 'main menu needs a stable World Cup layout marker');
  assert.doesNotMatch(source, /bg-\[url\('\/assets\/menu\.png'\)\]/, 'main menu must keep the live game canvas background instead of replacing it with the mockup image');
  assert.match(source, /<MenuTeamSelect[\s\S]*label="Home"[\s\S]*<MenuTeamSelect[\s\S]*label="Away"/, 'main menu must render side-by-side flag team selectors');
  assert.match(source, /World Cup Mode/, 'main menu must expose the mockup World Cup Mode action');
  assert.match(source, /const MENU_ITEM_COUNT = 7/, 'gamepad focus count must match the two selectors plus five visible menu buttons');
  assert.doesNotMatch(source, /Real Data Replay[\s\S]*<\/button>/, 'main menu should not show the old replay button in the mockup layout');
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

test('browser game restores the legacy two-canvas minimap', () => {
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  assert.match(engine, /private createMiniMap\(\)/, 'engine must recreate the legacy minimap DOM');
  assert.match(engine, /id = 'canvasPitch'/, 'minimap must include the static pitch canvas');
  assert.match(engine, /id = 'canvasPitchAI'/, 'minimap must include the dynamic player and ball overlay canvas');
  assert.match(engine, /private drawMiniMapPitch\(\)/, 'minimap must draw the static pitch markings');
  assert.match(engine, /private updateMiniMap\(\)/, 'minimap must update from current model state');
  assert.match(engine, /this\.model\.getPlayers\(\)/, 'minimap player dots must come from the active model');
  assert.match(engine, /this\.model\.ball\.pos/, 'minimap ball dot must come from the active model ball');
  assert.match(engine, /this\.model\.possession/, 'minimap must highlight the active ball carrier');
  assert.match(engine, /this\.updateMiniMap\(\)/, 'render loop must keep the minimap live');
  assert.match(engine, /setMenuVisible = \(visible: boolean\) => \{[\s\S]*?this\.applyMiniMapVisibility\(\)/, 'menu visibility must hide/show the minimap without removing it');
});

test('browser game wires legacy sound assets to match events', () => {
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  assert.match(engine, /const SOUND_ASSETS: Record<SoundBufferKey, string>/, 'engine must define legacy sound asset map');
  assert.match(engine, /whistle: '\/whistle\.mp3'/, 'whistle asset must be loaded from public');
  assert.match(engine, /crowd: '\/crowd\.mp3'/, 'crowd loop asset must be loaded from public');
  assert.match(engine, /goal: '\/announcer_goal\.mp3'/, 'goal announcer asset must be loaded from public');
  assert.match(engine, /post: '\/donk\.mp3'/, 'woodwork impact must load the donk asset from public');
  assert.match(engine, /private ensureAudioContext\(\)/, 'engine must initialize Web Audio lazily from user input');
  assert.match(engine, /splashMusicStart = \(\) => \{[\s\S]*?this\.playLoop\('splashMusic'/, 'splash music API must play the legacy menu music');
  assert.match(engine, /setCrowdVolume = \(value: number\) => \{[\s\S]*?linearRampToValueAtTime/, 'crowd volume slider must control audio gain');
  assert.match(engine, /private playSoundForLiveEvent\(event: \{ action: string; meta\?: Record<string, unknown> \}\)/, 'live events must be mapped to sound cues');
  assert.match(engine, /case 'SHOT':[\s\S]*?this\.playGameplayBuffer\('shot'/, 'shots must trigger shot audio');
  assert.match(engine, /case 'WOODWORK':[\s\S]*?this\.playGameplayBuffer\('post'/, 'woodwork must trigger the donk/post audio');
  assert.match(engine, /case 'GOAL':[\s\S]*?this\.playGameplayBuffer\('goal'[\s\S]*?this\.playGameplayBuffer\('crowdGoal'/, 'goals must trigger announcer and crowd audio');
  assert.match(engine, /case 'CORNER':[\s\S]*?this\.playGameplayBuffer\('corner'/, 'corners must trigger corner audio');
  assert.match(engine, /case 'THROW_IN':[\s\S]*?event\.meta\?\.phase === 'setup'[\s\S]*?this\.playGameplayBuffer\('throw'/, 'throw-in announcer must play on setup, not after release');
  assert.match(engine, /this\.playSoundForLiveEvent\(event\)/, 'event cue loop must invoke the audio mapper');
  assert.match(engine, /private readonly audioBytes: Partial<Record<SoundBufferKey, ArrayBuffer>>/, 'audio bytes must be cached before first user gesture');
  assert.match(engine, /private preloadAudioBytes\(keys\?: SoundBufferKey\[\]\)/, 'engine must expose a byte preload path separate from AudioContext playback');
  assert.match(engine, /this\.preloadAudioBytes\(\);/, 'constructor must start audio byte preloading while the splash screen is visible');
  assert.match(engine, /const decodeOrder: SoundBufferKey\[\] = \['splashMusic', 'welcome', 'crowd'/, 'intro music and welcome callout must decode before lower-priority sound effects');
  assert.doesNotMatch(engine, /splashMusicStart = \(\) => \{\};/, 'splash music API must not remain stubbed');
  assert.doesNotMatch(engine, /setCrowdVolume = \(_value: number\) => \{\};/, 'crowd volume API must not remain stubbed');
});

test('CPU vs CPU starts randomize distinct world teams', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  assert.match(source, /BASE_TEAM_OPTIONS = WORLD_CUP_2026_TEAM_NAMES/, 'browser team selectors should default to the official 48-team field');
  assert.match(source, /EASTER_EGG_TEAM_OPTIONS = \['Italy 1982', 'West Germany 1982'\]/, '1982 finalists must be kept behind the easter egg unlock');
  assert.match(source, /easterEggUnlocked \? \[\.\.\.BASE_TEAM_OPTIONS, \.\.\.EASTER_EGG_TEAM_OPTIONS\] : BASE_TEAM_OPTIONS/, 'historic teams must only enter selectors after unlock');
  assert.match(source, /PLAYABLE_WORLD_TEAM_KITS/, 'browser kits must come from the playable world-team catalog');
  assert.match(source, /resolvePlayableTeamKits/, 'browser kit application must use clash-safe home-away resolution');
  assert.match(source, /function randomCpuMatchup\(\): CpuMatchup/, 'CPU matchups must use a shared randomizer');
  assert.match(source, /if \(awayIndex >= homeIndex\) awayIndex \+= 1/, 'randomizer must avoid home and away being the same team');
  assert.match(source, /const kickoffTeams = overrideTeams \?\? \(isCpu \? randomCpuMatchup\(\)/, 'plain CPU kickoff must randomize teams');
  assert.match(source, /const fixtureTeams = randomCpuMatchup\(\)/, 'watched CPU fixture must randomize teams');
  assert.match(source, /homeTeam: fixtureTeams\.a,\s*awayTeam: fixtureTeams\.b/s, 'fixture runner payload must use the randomized teams');
  assert.doesNotMatch(source, /MLS_TEAM_NAMES\.slice\(\)\.sort\(\(\) => Math\.random\(\) - 0\.5\)/, 'team randomization must not rely on biased array sort shuffling');
});

test('main menu unlocks the 1982 final easter egg from the 1982 key sequence', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  assert.match(source, /easterEggSequenceRef\.current === '1982'/, 'main menu must listen for the 1982 unlock sequence');
  assert.match(source, /setEasterEggUnlocked\(true\)/, 'unlock sequence must release the hidden teams');
  assert.match(source, /setTeamAName\('Italy 1982'\)/, 'unlock sequence must select Italy 1982 as home');
  assert.match(source, /setTeamBName\('West Germany 1982'\)/, 'unlock sequence must select West Germany 1982 as away');
  assert.match(source, /1982 Final Unlocked/, 'menu should show feedback after the easter egg unlocks');
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
  assert.match(
    source,
    /!showSplash && !hasActiveMatchSession && watchedFixtureMessage/,
    'watched fixture status must not stay on screen during active live play',
  );
});

test('live match screen does not render tuning or isolated-pass telemetry menus', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  assert.doesNotMatch(source, /Isolated Fwd Pass/, 'isolated forward pass telemetry panel must not render over gameplay');
  assert.doesNotMatch(source, /Listening for events/, 'debug event-listening telemetry copy must not render over gameplay');
  assert.doesNotMatch(source, /Press \[ESC\] for Options/, 'options hint must not render as a persistent live-match overlay');
  assert.doesNotMatch(source, /<TuningLab/, 'tuning lab must not be mounted over the live field');
});

test('broadcast camera pans side to side and up/down without swing rotation', () => {
  const source = readFileSync('src/gameEngine.ts', 'utf8');
  const match = source.match(/private updateBroadcastCamera\(dt: number\) \{[\s\S]*?\n  \}/);
  assert.ok(match, 'expected updateBroadcastCamera implementation');
  const body = match[0];
  assert.match(body, /this\.cameraFocusSmoothed\.z = THREE\.MathUtils\.lerp/, 'camera must smooth touchline-to-touchline ball movement');
  assert.match(body, /const desiredPanZ = THREE\.MathUtils\.clamp\(this\.cameraFocusSmoothed\.z \* 0\.45, -FIELD_D \* 0\.18, FIELD_D \* 0\.18\)/, 'camera vertical pan must be clamped to avoid swinging too far');
  assert.match(body, /this\.cameraLerpPosition\.set\(desiredCamX, this\.broadcastCameraHome\.y, this\.broadcastCameraHome\.z \+ desiredPanZ\)/, 'camera must translate vertically without changing height');
  assert.match(body, /this\.cameraLookTarget\.set\(this\.camera\.position\.x, 0, this\.camera\.position\.z - this\.broadcastCameraHome\.z\)/, 'camera target must translate with camera Z to preserve fixed viewing angle');
  assert.doesNotMatch(body, /edgeTrackT|lookZ|camZMul|camZClamp|finalThirdT/, 'broadcast camera must not swing or zoom into final thirds');
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
  assert.match(source, /type RestartPresentationType = 'throw_in' \| 'corner' \| 'goal_kick' \| 'free_kick' \| 'penalty' \| 'drop_kick'/, 'restart presentation types must be explicit');
  assert.match(source, /activeRestartPresentation/, 'renderer must retain active restart presentation state');
  assert.match(source, /updateRestartPresentationFromEvent/, 'restart live events must feed presentation state');
  assert.match(source, /event\.action === 'THROW_IN'/, 'throw-in live events must be handled by the renderer');
  assert.match(source, /event\.action === 'FREE_KICK'/, 'free-kick live events must be handled by the renderer');
  assert.match(source, /private updateThrowInSprite/, 'throw-in taker must get a controlled setup pose');
  assert.match(source, /private restartPresentationBallPosition/, 'throw-in setup must render the ball above the taker before release');
  assert.match(source, /THROW_IN_OUTSIDE_TOUCHLINE_OFFSET/, 'throw-in taker should be displayed just outside the touchline');
});

test('V70 renderer gives corners a flag setup presentation', () => {
  const source = readFileSync('src/gameEngine.ts', 'utf8');
  assert.match(source, /event\.action === 'CORNER'/, 'corner live events must be handled by the renderer');
  assert.match(source, /private updateCornerKickSprite/, 'corner taker must get a controlled setup pose');
  assert.match(source, /restart\.type === 'corner'/, 'corner restart presentation must pin the ball at the flag during setup');
  assert.match(source, /CORNER_OUTSIDE_TOUCHLINE_OFFSET/, 'corner taker must be displayed clearly outside the touchline by the flag');
  assert.match(source, /CORNER_SETUP_PRESENTATION_SECONDS = 2\.0/, 'corner setup presentation must be long enough to see the player before release');
});

test('V90 renderer has a dedicated header reaction path', () => {
  const source = readFileSync('src/gameEngine.ts', 'utf8');
  assert.match(source, /type HeaderReaction = \{ ttl: number; duration: number; kind: 'shot' \| 'clearance'; direction: 1 \| -1 \}/, 'header reaction state must be explicit');
  assert.match(source, /private readonly headerReactions = new Map<string, HeaderReaction>/, 'renderer must retain header reactions by player');
  assert.match(source, /event\.action === 'HEADER_SHOT' \|\| event\.action === 'HEADER_CLEARANCE'/, 'header live events must drive renderer cues');
  assert.match(source, /private updateHeaderSprite/, 'renderer must have a dedicated header sprite path');
  assert.match(source, /this\.headerReactions\.clear\(\)/, 'visual reset must clear header reactions');
});

test('V78 renderer animates throw-in and corner release phases distinctly from idle', () => {
  const source = readFileSync('src/gameEngine.ts', 'utf8');
  assert.match(source, /if \(restartPose\?\.type === 'throw_in'\) \{\s*this\.updateThrowInSprite\(visual, restartPose\);/s, 'throw-in presentation must use the dedicated sprite path during setup and release');
  assert.match(source, /if \(restartPose\?\.type === 'corner'\) \{\s*this\.updateCornerKickSprite\(visual, restartPose\);/s, 'corner presentation must use the dedicated sprite path during setup and release');
  assert.match(source, /private restartPresentationProgress\(restart: RestartPresentation\)/, 'restart animation must derive visible phase progress');
  assert.match(source, /restart\.phase === 'release' \? Math\.sin\(progress \* Math\.PI\)/, 'restart release must drive a visible movement curve');
  assert.match(source, /private throwInPresentationPlayerPosition\(restart: RestartPresentation\)/, 'throw-in taker must move through a dedicated sideline throw path');
  assert.match(source, /if \(restart\.type === 'throw_in'\) return this\.throwInPresentationPlayerPosition\(restart\)/, 'throw-ins must use a dedicated player-position path');
  assert.match(source, /THROW_IN_RELEASE_PRESENTATION_SECONDS = 1\.15/, 'throw-in release must stay visible long enough to verify the player motion');
  assert.match(source, /restart\.phase === 'release' && visual\.runFrames\.length \? visual\.runFrames : visual\.idleFrames/, 'corner release must use run/kick frames instead of staying idle');
  assert.doesNotMatch(source, /restartPose\?\.type === 'throw_in' && restartPose\.phase === 'setup'/, 'throw-in special pose must not disappear as soon as release starts');
  assert.doesNotMatch(source, /restartPose\?\.type === 'corner' && restartPose\.phase === 'setup'/, 'corner special pose must not disappear as soon as release starts');
});

test('V83 corner kicks animate the taker mesh through the run-up and kick', () => {
  const source = readFileSync('src/gameEngine.ts', 'utf8');
  assert.match(source, /restartPresentationPlayerPosition\(restartPose\)/, 'restart taker mesh position must use the presentation player position');
  assert.match(source, /private restartPresentationPlayerPosition\(restart: RestartPresentation\)/, 'renderer must define restart player positioning separate from ball positioning');
  assert.match(source, /if \(restart\.type === 'corner'\) return this\.cornerPresentationPlayerPosition\(restart\)/, 'corners must use a dedicated player-position path');
  assert.match(source, /private cornerPresentationPlayerPosition\(restart: RestartPresentation\)/, 'corner taker positioning must be isolated and testable');
  assert.match(source, /CORNER_RUNUP_DISTANCE = 1\.15/, 'corner taker must visibly run up to the ball');
  assert.match(source, /const follow = \{[\s\S]*?restart\.spot\.x \+ kickDirX \* 0\.34[\s\S]*?restart\.spot\.z \+ inwardZ \* 0\.24[\s\S]*?\}/, 'corner taker must follow through after striking the ball');
  assert.match(source, /visual\.spriteGroup\.rotation\.set\(0, 0, -visual\.dir \* \(plantT \* 0\.18 \+ kickT \* 0\.52\)\)/, 'corner kick sprite swing must be large enough to read');
  assert.match(source, /type === 'corner' && phase === 'release'[\s\S]*?CORNER_RELEASE_PRESENTATION_SECONDS/, 'corner release must stay on screen long enough to show the taker');
});

test('V85 goal net impact waits for the ball to reach the back-net target', () => {
  const source = readFileSync('src/gameEngine.ts', 'utf8');
  assert.match(source, /pendingGoalNetImpact/, 'renderer must retain a delayed goal net impact');
  assert.match(source, /event\.meta\?\.netTarget/, 'goal event metadata must provide the net target');
  assert.match(source, /private updatePendingGoalNetImpact\(dt: number\)/, 'renderer must update delayed goal net impacts');
  assert.match(source, /this\.ballGroup\.position\.distanceTo\(pending\.target\) <= 0\.55/, 'net impact must wait for ball arrival');
  assert.match(source, /this\.addGoalNetImpact\(pending\.target, pending\.force\)/, 'net deformation must be fired at the back-net target');
  assert.doesNotMatch(source, /if \(event\.action === 'GOAL'\) \{[\s\S]*?this\.addGoalNetImpact\(this\.ballGroup\.position\.clone\(\), 0\.72\);[\s\S]*?\n      \}/, 'goal event must not deform the net immediately at the current ball position');
});

test('V79 renderer gives goalkeeper goal kicks a visible kick presentation', () => {
  const source = readFileSync('src/gameEngine.ts', 'utf8');
  assert.match(source, /restartPose\?\.type === 'goal_kick' \|\| restartPose\?\.type === 'drop_kick'[\s\S]*?this\.updateGoalKickSprite\(visual, restartPose\);/s, 'goal-kick presentation must use a dedicated keeper kick path');
  assert.match(source, /private updateGoalKickSprite\(visual: PlayerVisual, restart: RestartPresentation\)/, 'renderer must define the goal-kick sprite path');
  assert.match(source, /restart\.type === 'goal_kick'\) return \{ x: pos\.x, y: BALL_GROUND_Y, z: pos\.z \}/, 'goal-kick setup must pin the ball on the ground at the restart spot');
  assert.match(source, /visual\.spriteGroup\.rotation\.set\(0, 0, -visual\.dir \* kickT \* 0\.28\)/, 'goal-kick release must visibly swing the keeper sprite');
});

test('V80 live telemetry surfaces goal-kick counters', () => {
  const source = readFileSync('src/components/LiveTelemetry.tsx', 'utf8');
  assert.match(source, /goalKicks: number/, 'live team stats must type goal-kick counters');
  assert.match(source, /\{ key: 'goalKicks', label: 'Goal Kicks' \}/, 'live telemetry table must render goal-kick counters');
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
  assert.match(source, /function getMatchDurationInfo/, 'dashboard should derive match duration from duration metadata');
  assert.match(source, /metadata\?\.runtimeHalfDuration/, 'dashboard should prefer runtime half duration over simulated half duration');
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
