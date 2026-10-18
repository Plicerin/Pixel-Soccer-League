import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assetUrl } from '../src/assetUrl';
import { getWorldCupTeamFlagAsset } from '../src/teamCatalog.js';

test('V22 UI kickoff paths clear splash scene before starting kickoff presentation', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
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
  assert.match(engine, /startKickoffPresentation = \(_fromUi = true\) => \{[\s\S]*?this\.menuVisible = false;[\s\S]*?this\.splashSceneMode = false;/, 'engine kickoff must clear menu/splash guards even if a UI path misses it');
});

test('BUG-START-004 menu and splash background do not step live model or audio', () => {
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  const bugs = readFileSync('BUGS.md', 'utf8');
  const spec = readFileSync('SPEC.md', 'utf8');
  assert.match(bugs, /BUG-START-004 \| Fixed - Awaiting User Approval \| Menu background match can keep running/, 'background match isolation bug must remain awaiting user approval');
  assert.match(spec, /V133\. Menu background isolation/, 'menu background isolation behavior must be captured in the spec');
  assert.match(spec, /B127 \| 2026-05-16 \| Splash auto-demo startup was disabled/, 'menu background root cause must be recorded');
  assert.match(engine, /private isModelActive\(\) \{\s*return !this\.paused && !this\.menuVisible && !this\.splashSceneMode;\s*\}/, 'shared model activity gate must include pause/menu/splash visibility');
  assert.match(engine, /const modelActive = this\.isModelActive\(\);[\s\S]*?if \(modelActive && !document\.hidden\) \{[\s\S]*?this\.advanceModel\(dt, true\);[\s\S]*?\}/, 'visible render loop must not step the model while menu/splash/paused');
  assert.match(engine, /if \(modelActive\) \{[\s\S]*?this\.processLiveEventCues\(dt\);[\s\S]*?this\.updateBroadcastCamera\(dt\);[\s\S]*?this\.updateCrowd\(dt\);/, 'menu/splash render loop must not process live-event audio or match action cues');
});

test('V39 browser match setup offers required half lengths and defaults to 5 minutes', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  assert.match(
    source,
    /const \[halfLengthMinutes, setHalfLengthMinutes\] = useState\(5\)/,
    'browser default half length must be 5 minutes',
  );
  // Testers wanted longer matches, so the list grew; these must remain offered.
  const options = source.match(/const PRE_MATCH_HALF_LENGTH_OPTIONS = \[([^\]]*)\]/);
  assert.ok(options, 'expected a stable half-length option list');
  for (const required of ["'2'", "'5'", "'15'", "'45'"]) {
    assert.ok(options[1].includes(required), `half-length options must still offer ${required}`);
  }
  assert.match(source, /options=\{PRE_MATCH_HALF_LENGTH_OPTIONS\}/, 'pre-match half-length dropdown must use the stable option list');
  assert.doesNotMatch(source, /Match half duration/, 'pre-match half length copy should stay concise');
  assert.doesNotMatch(source, /Applies to the CPU vs CPU match timer/, 'pre-match half length helper text should not remain');
  assert.doesNotMatch(source, /Run Watched CPU Test/, 'pre-match debug watched fixture button should not remain');
  assert.doesNotMatch(source, /Randomize All/, 'pre-match setup must not show the removed randomize-all debugging button');
  const setupBlock = source.slice(source.indexOf('const PRE_MATCH_SELECT_CLASSNAME'), source.indexOf('// Memoize to prevent dropdown'));
  assert.doesNotMatch(setupBlock, /text-\[(?:8|9|10|12|13|14|15|16|18|19|22|24|25|26|28|32|34)px\]|text-xs|text-sm|text-base|text-lg|text-xl|text-2xl|text-3xl/, 'pre-match setup text sizes must stay uniform');
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

test('native dropdown options remain readable on light browser option menus', () => {
  const css = readFileSync('src/index.css', 'utf8');
  assert.match(css, /select option,\s*select optgroup\s*\{[\s\S]*?color: #ffffff;/, 'native select options must force white text');
  assert.match(css, /select option,\s*select optgroup\s*\{[\s\S]*?background: #111111;/, 'native select options must force a black background');
});

test('BUG-UI-002 pre-match dropdowns use the module-stable old modal dropdown interaction', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  const teamSetupIndex = source.indexOf('const TeamSetupSection = React.memo');
  const preMatchIndex = source.indexOf('const PreMatchSetupScreen');
  assert.ok(teamSetupIndex >= 0 && teamSetupIndex < preMatchIndex, 'team setup section must be module-stable and not declared inside the pre-match render path');
  assert.match(source, /^const PRE_MATCH_HALF_LENGTH_OPTIONS = \[/m, 'half-length options must be stable outside the render path');
  assert.match(source, /const PRE_MATCH_AGGRESSIVENESS_OPTIONS = Object\.keys\(PRACTICE_AGGRESSIVENESS\) as AggressivenessKey\[\]/, 'aggressiveness options must be stable outside the render path');
  assert.match(source, /const teamOptions = useMemo\(/, 'team options must be memoized so parent game-loop renders do not replace select props');
  assert.match(source, /const CustomDropdown = <T extends string>/, 'pre-match setup should use a shared module-stable custom dropdown component');
  assert.match(source, /data-psl-custom-dropdown="old-modal"/, 'pre-match dropdowns must use the old modal button-list interaction');
  assert.match(source, /role="listbox"/, 'custom pre-match dropdowns must expose listbox semantics');
  assert.match(source, /role="option"/, 'custom pre-match dropdown options must expose option semantics');
  assert.match(source, /document\.addEventListener\('pointerdown', closeFromOutside, true\)/, 'outside-click close must use capture-phase pointerdown');
  assert.doesNotMatch(source, /setTimeout\([\s\S]{0,220}addEventListener/, 'outside-click close must not use delayed listener races');
  assert.match(source, /data-psl-select=\{dataSelect\}/, 'pre-match dropdowns must expose side-specific select markers');
  assert.match(source, /id=\{id\}/, 'pre-match dropdowns must expose explicit ids');
  assert.match(source, /aria-label=\{ariaLabel\}/, 'pre-match dropdowns must expose explicit accessible labels');
  assert.match(source, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/, 'native select pointerdown must not bubble to modal handlers');
  assert.match(source, /onMouseDown=\{\(event\) => event\.stopPropagation\(\)\}/, 'native select mousedown must not bubble to modal handlers');
  assert.match(source, /if \(event\.key === 'ArrowDown'\)[\s\S]*?setIsOpen\(true\);[\s\S]*?moveActive\(1\);/, 'custom dropdown must support keyboard down navigation');
  assert.match(source, /if \(event\.key === 'Enter' \|\| event\.key === ' '\)/, 'custom dropdown must support keyboard selection');
  assert.match(source, /selectOption\(option\);/, 'custom option clicks must update the selected value');
  assert.match(source, /className="fixed inset-0[\s\S]*pointer-events-auto"/, 'pre-match modal backdrop must receive outside mouse events');
  assert.match(source, /onMouseDown=\{\(e\) => \{\s*if \(e\.target === e\.currentTarget\) \{\s*onClose\(\);/s, 'modal backdrop must only close from direct outside mousedown');
  assert.match(source, /onMouseDown=\{\(e\) => e\.stopPropagation\(\)\}/, 'pre-match modal content must shield select clicks from the backdrop');
  assert.match(source, /relative z-50/, 'team select rows must keep a high native dropdown stacking context');
  assert.doesNotMatch(source, /Closing modal from background click/, 'debug modal logging must not remain in the pre-match path');
});

test('V123 home and away dropdowns are independently addressable and wired', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  assert.match(source, /const buttonId = `main-menu-\$\{lowerLabel\}-team-select`/, 'main-menu team selectors need stable side-specific ids');
  assert.match(source, /data-psl-menu-team-select=\{lowerLabel\}/, 'main-menu team selectors need stable side-specific markers');
  assert.match(source, /data-psl-menu-team-menu=\{lowerLabel\}/, 'main-menu team dropdowns need a real clickable option list marker');
  assert.match(source, /data-psl-menu-team-option=\{lowerLabel\}/, 'main-menu team dropdown options need side-specific markers for browser interaction tests');
  assert.match(source, /className="relative z-\[3\] h-full w-full[\s\S]*pointer-events-auto/, 'main-menu dropdown buttons must sit above decorative layers and accept pointer input');
  assert.match(source, /<MenuTeamSelect[\s\S]*label="Home"[\s\S]*value=\{teamAName\}[\s\S]*onChange=\{setTeamAName\}/, 'home main-menu dropdown must update the home team state');
  assert.match(source, /<MenuTeamSelect[\s\S]*label="Away"[\s\S]*value=\{teamBName\}[\s\S]*onChange=\{setTeamBName\}/, 'away main-menu dropdown must update the away team state');
  assert.match(source, /<CustomDropdown[\s\S]*?id=\{`prematch-team-\$\{team\}-select`\}[\s\S]*?dataSelect=\{`prematch-team-\$\{team\}`\}/, 'pre-match team selectors need stable side-specific ids and data markers');
  assert.match(source, /team="B"[\s\S]*name=\{teamBName\}[\s\S]*onNameChange=\{onTeamBNameChange\}/, 'pre-match Team B dropdown must update Team B state');
});

test('V98 pre-match dropdown components are not remounted by live render churn', () => {
  const spec = readFileSync('SPEC.md', 'utf8');
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  assert.match(spec, /V98\. Pre-match dropdown stability/, 'dropdown remount regression must be captured in the spec');
  assert.match(spec, /B92 \| 2026-05-15 \| `TeamSetupSection` was declared inside `PreMatchSetupScreen`/, 'bug log must record the remount root cause');
  assert.match(source, /const TeamSetupSection = React\.memo\(/, 'team setup section must be memoized at module scope');
  assert.doesNotMatch(source, /const PreMatchSetupScreen[\s\S]*const TeamSetupSection[\s\S]*return \(/, 'pre-match screen must not declare team setup section inside its render body');
});

test('BUG-UI-004 pre-match Starting XI button opens real synthetic lineup data', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  assert.match(source, /import \{ getWorldTeamStartingLineup \} from '\.\.\/worldTeamRosters\.js'/, 'pre-match setup must read from the world roster generator');
  assert.match(source, /const \[lineupOpen, setLineupOpen\] = useState\(false\)/, 'lineup button must have a real open/closed state');
  assert.match(source, /const lineup = useMemo\(\(\) => getWorldTeamStartingLineup\(name, formation\), \[name, formation\]\)/, 'lineup must update when team or formation changes');
  assert.match(source, /data-psl-lineup-toggle=\{team\}/, 'lineup toggle must expose a stable browser marker');
  assert.match(source, /aria-expanded=\{lineupOpen\}/, 'lineup button must expose expanded state');
  assert.match(source, /data-psl-lineup-panel=\{team\}/, 'opened lineup panel must expose a stable browser marker');
  assert.match(source, /player\.number[\s\S]*player\.role[\s\S]*player\.name/, 'lineup panel must render number, role, and player name');
  assert.doesNotMatch(source, /Team \{team\} Starting Lineup/, 'placeholder lineup text must not remain');
});

test('V99 country lineups are tracked in spec and bug log', () => {
  const spec = readFileSync('SPEC.md', 'utf8');
  assert.match(spec, /V99\. Pre-match lineups/, 'lineup behavior must be captured in the spec');
  assert.match(spec, /B93 \| 2026-05-15 \| Starting XI panel was a non-interactive placeholder/, 'bug log must record the placeholder root cause');
});

test('V100 pre-match setup hides main menu input and start clicks do not bubble', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  assert.match(source, /const startMenuVisible = allowMainMenu && !hasActiveMatchSession && !isFullTime && !sessionMenuLock && !seasonModeActive && !showPreMatchSetup/, 'main menu/gamepad input must be disabled while pre-match setup is open');
  assert.match(source, /!showPracticeSetup && !showPreMatchSetup && \(/, 'main menu buttons must not remain active behind the pre-match setup overlay');
  assert.match(source, /type="button"[\s\S]*?onClick=\{\(event\) => \{\s*event\.stopPropagation\(\);\s*onStartMatch\(\);/s, 'pre-match start click must not bubble to underlying input layers');
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
  assert.match(source, /snapshot\?\.phase === 'FULL_TIME' && !smokeTestActiveRef\.current && !fullTimeCapturedRef\.current/, 'any uncaptured full-time snapshot must open the end screen even if the phase-change tick was missed');
  assert.match(source, /w-\[min\(96vw,760px\)\][\s\S]*?outline: '5px solid #000'/, 'full-time panel must be wide enough and keep a 5px black outline');
  assert.match(source, /break-words text-\[12px\][\s\S]*?\{fullTimeScore\.teamA\}/, 'home final-screen team name must wrap instead of clipping');
  assert.match(source, /break-words text-\[12px\][\s\S]*?\{fullTimeScore\.teamB\}/, 'away final-screen team name must wrap instead of clipping');
  assert.match(source, /aria-labelledby="full-time-title"/, 'full-time overlay must expose a labelled dialog');
  assert.match(source, /<ScoreboardFlag teamName=\{fullTimeScore\.teamA\} \/>[\s\S]*?<ScoreboardFlag teamName=\{fullTimeScore\.teamB\} \/>/, 'full-time overlay must show real country flags for both teams');
  assert.doesNotMatch(source, /teamA:\s*snapshot\.teamAName \|\| teamAName/, 'stale home team fallback must not be used for full-time score');
  assert.doesNotMatch(source, /teamB:\s*snapshot\.teamBName \|\| teamBName/, 'stale away team fallback must not be used for full-time score');
});

test('V248 watched fixtures persist a fresh full-time DB row even while smoke mode suppresses the normal autosave', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  assert.match(source, /const runner = \(window as any\)\.pslSmokeTest\?\.runFixture;/, 'watched fixtures must still run through the fixture runner');
  assert.match(source, /if \(watchedSnapshot\?\.phase === 'FULL_TIME' && watchedBundle\) \{[\s\S]*?fetch\('\/__db\/match-result'/, 'watched fixture completion must explicitly persist a full-time DB row');
  assert.match(source, /buildMatchResultPayload\(\{[\s\S]*?bundle: watchedBundle,[\s\S]*?snapshot: watchedSnapshot,[\s\S]*?fallbackSessionId: `ft-\$\{Date\.now\(\)\}`/s, 'watched fixture save must use the current full-time bundle and snapshot when building the DB payload');
});

test('headless fixtures sync React team state before the smoke runner starts kickoff', () => {
  const retro = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  const smoke = readFileSync('src/smokeTest.ts', 'utf8');

  assert.match(retro, /applySmokeFixtureSetup: async \(fixture: \{ homeTeam: string; awayTeam: string; formationA: string; formationB: string \}\) => \{/, 'RetroFootball must expose a smoke fixture UI-state bridge');
  assert.match(retro, /setTeamAName\(fixture\.homeTeam\);[\s\S]*setTeamBName\(fixture\.awayTeam\);[\s\S]*setTeamAFormation\(fixture\.formationA\);[\s\S]*setTeamBFormation\(fixture\.formationB\);/s, 'smoke fixture bridge must sync selected teams and formations into React state');
  assert.match(smoke, /const uiFixtureBridge = \(window as any\)\.__pslUiTest\?\.applySmokeFixtureSetup;/, 'smoke fixture runner must look for the UI-state bridge before kickoff');
  assert.match(smoke, /await uiFixtureBridge\(\{[\s\S]*homeTeam: options\.homeTeam,[\s\S]*awayTeam: options\.awayTeam,[\s\S]*formationA: options\.formationA,[\s\S]*formationB: options\.formationB,[\s\S]*\}\);/s, 'smoke fixture runner must await the bridge with the requested fixture selection');
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

test('main menu enables restored human-control modes and wires them into the live engine', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  const model = readFileSync('src/core/simpleMatchModel.ts', 'utf8');
  assert.match(source, /const INTERACTIVE_PLAYER_MODES_ENABLED = true;/, 'live build must explicitly re-enable restored human-control modes');
  assert.doesNotMatch(source, /Interactive 1P and 2P control is not available in the current engine build/, 'main menu must no longer show the broken-mode warning');
  assert.match(source, /const isInteractivePlayerMode = mode === '1p' \|\| mode === '2p';/, 'kickoff wiring must treat both 1P and 2P as human-controlled modes');
  assert.match(source, /gameRef\.current\?\.setHotSeatMode\?\.\(isInteractivePlayerMode \|\| isTesting\);/, 'engine must enable team A manual control for both restored human modes');
  assert.match(source, /gameRef\.current\?\.setTwoPlayerMode\?\.\(isHotSeat\);/, 'engine must enable the second human path only for 2P mode');
  assert.match(engine, /setHotSeatMode = \(enabled: boolean\) => \{[\s\S]*?this\.humanControlEnabled = !!enabled;[\s\S]*?this\.model\.setManualControlEnabled\('A', this\.humanControlEnabled\);/m, 'renderer must turn team A human control back on');
  assert.match(engine, /setTwoPlayerMode = \(enabled: boolean\) => \{[\s\S]*?this\.twoPlayerMode = !!enabled;[\s\S]*?this\.model\.setManualControlEnabled\('B', this\.twoPlayerMode\);/m, 'renderer must expose an explicit second-human control path');
  assert.match(engine, /private pollManualControls\(modelActive: boolean\)/, 'renderer must poll live manual controls every frame');
  assert.match(model, /setManualControlEnabled\(team: SimpleTeamCode, enabled: boolean\)/, 'simple model must expose a public manual-control toggle');
  assert.match(model, /triggerManualPass\(team: SimpleTeamCode\)/, 'simple model must expose a public manual pass command');
  assert.match(model, /triggerManualShot\(team: SimpleTeamCode\)/, 'simple model must expose a public manual shot command');
});

test('browser match HUD includes a real pause button wired to the engine', () => {
  const ui = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  assert.match(ui, /data-psl-pause-button="match"/, 'expected stable pause button marker in match HUD');
  assert.match(ui, /togglePaused\?\.\(\)/, 'pause button must call the engine pause toggle');
  assert.match(engine, /private paused = false/, 'engine must store pause state');
  assert.match(engine, /private isModelActive\(\) \{\s*return !this\.paused && !this\.menuVisible && !this\.splashSceneMode;\s*\}/, 'paused/menu/splash engine must stop model stepping');
  assert.match(engine, /if \(modelActive && !document\.hidden\) \{[\s\S]*?this\.advanceModel\(dt, true\);/, 'visible model stepping must be gated by modelActive');
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

test('V252 minimap overlay and possession panels stay inside the minimap footprint', () => {
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  assert.match(engine, /private readonly miniMapTiltTransform = 'translateX\(-50%\) perspective\(900px\) rotateX\(56deg\)';/, 'pitch and overlay must share one minimap tilt transform');
  assert.doesNotMatch(engine, /rotateX\(50deg\)/, 'overlay canvas must not use a different tilt than the pitch canvas');
  assert.match(engine, /private readonly miniMapPitchPad = 8;/, 'minimap projection must use the same inner pitch padding as the drawn border');
  assert.match(engine, /x: pad \+ \(\(x \+ FIELD_W \/ 2\) \/ FIELD_W\) \* \(this\.miniMapWidth - pad \* 2\)/, 'world-to-minimap x projection must land inside the drawn pitch border');
  assert.match(engine, /y: pad \+ \(\(z \+ FIELD_D \/ 2\) \/ FIELD_D\) \* \(this\.miniMapHeight - pad \* 2\)/, 'world-to-minimap y projection must land inside the drawn pitch border');
  assert.match(engine, /THREE\.MathUtils\.clamp\(pos\.x, pad \+ radius, this\.miniMapWidth - pad - radius\)/, 'player dots must clamp against the inner pitch border, not the raw canvas edge');
  assert.match(engine, /THREE\.MathUtils\.clamp\(pos\.y, pad \+ radius, this\.miniMapHeight - pad - radius\)/, 'player dots must clamp against the inner pitch border, not the raw canvas edge');
  assert.match(engine, /private readonly miniMapPanelInset = 8;/, 'minimap panels must use an explicit inset inside the minimap width');
  assert.match(engine, /private readonly miniMapPanelWidth = Math\.floor\(\(this\.miniMapWidth - this\.miniMapPanelInset \* 3\) \/ 2\);/, 'minimap possession panels must size from the minimap width');
  assert.doesNotMatch(engine, /left: 'calc\(50% - 310px\)'/, 'home possession panel must not sit outside the minimap footprint');
  assert.doesNotMatch(engine, /left: 'calc\(50% \+ 170px\)'/, 'away possession panel must not sit outside the minimap footprint');
});

test('BUG-RENDER-002 player hair color varies deterministically', () => {
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  const bugs = readFileSync('BUGS.md', 'utf8');
  const spec = readFileSync('SPEC.md', 'utf8');
  assert.match(bugs, /BUG-RENDER-002 \| Fixed - Awaiting User Approval \| Player hair\/head color no longer randomized/, 'hair color bug must remain awaiting visual approval');
  assert.match(spec, /V126\. Player hair variation/, 'hair variation behavior must be captured in the spec');
  assert.match(spec, /B119 \| 2026-05-16 \| Player palette selection returned team palettes with `hairBlack` for every player/, 'hair variation root cause must be recorded');
  assert.match(engine, /const PLAYER_HAIR_MATERIALS = \[M\.hairBlack, M\.hairBrown, M\.hairBlond\]/, 'renderer must keep a varied hair material palette');
  assert.match(engine, /private hairMaterialForPlayer\(player: SimplePlayer\)/, 'renderer must select hair material per player');
  assert.match(engine, /const seed = `\$\{player\.team\}:\$\{player\.shirtNumber\}:\$\{player\.name\}:\$\{player\.role\}`/, 'hair selection must be deterministic per player identity');
  assert.match(engine, /return \{ \.\.\.base, hair: this\.hairMaterialForPlayer\(player\) \}/, 'player palette must use varied hair instead of the team default');
  assert.doesNotMatch(engine, /private paletteForPlayer\(player: SimplePlayer\) \{\s*if \(player\.role === 'GK'\) return player\.team === 'A' \? TEAM_PALETTES\.keeperA : TEAM_PALETTES\.keeperB;\s*return player\.team === 'A' \? TEAM_PALETTES\.teamA : TEAM_PALETTES\.teamB;\s*\}/, 'paletteForPlayer must not return all-black team palettes directly');
});

test('BUG-RENDER-004 kit color toggles repaint live merged voxel frames', () => {
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  const bugs = readFileSync('BUGS.md', 'utf8');
  const spec = readFileSync('SPEC.md', 'utf8');
  assert.match(bugs, /BUG-RENDER-004 \| Fixed - Awaiting User Approval \| Kit color toggle does not update player voxels/, 'kit color bug must be promoted and awaiting user approval');
  assert.match(spec, /V160\. Kit color propagation/, 'kit color propagation invariant must be recorded');
  assert.match(spec, /B156 \| 2026-05-18 \| Player frames render from baked merged-geometry vertex colors/, 'kit color root cause must be backpropagated');
  assert.match(engine, /function materialForVoxelPart\(part: VoxelPart, palette: PlayerPalette\)/, 'voxel part material mapping must be centralized');
  assert.match(engine, /if \(part === 'visor'\) return palette\.visor;/, 'visor voxels must use the visor material, not hair');
  assert.doesNotMatch(engine, /part === 'visor' \? palette\.hair/, 'merged frame paths must not map visor voxels to hair');
  assert.match(engine, /setTeamColors = \(team: 'A' \| 'B', shirt: number, pants: number\) => \{[\s\S]*?shirtMat\.color\.setHex\(shirt\);[\s\S]*?pantsMat\.color\.setHex\(pants\);[\s\S]*?this\.recolorPlayerVisual\(player\);/m, 'kit color setter must repaint live player frames after material color changes');
  assert.match(engine, /private recolorPlayerVisual\(player: SimplePlayer\) \{[\s\S]*?visual\.allFrames\.forEach\(\(frame\) => recolorMergedVoxelFrame\(frame, palette\)\);[\s\S]*?\}/m, 'live player visual repaint helper must repaint every frame');
  assert.match(engine, /export function recolorMergedVoxelFrame\(mesh: THREE\.Mesh, palette: PlayerPalette\) \{[\s\S]*?colorAttr\.needsUpdate = true;[\s\S]*?\}/m, 'merged voxel recolor must mark color buffers dirty');
});

test('BUG-RENDER-001 browser game renders a non-simulation referee', () => {
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  const bugs = readFileSync('BUGS.md', 'utf8');
  const spec = readFileSync('SPEC.md', 'utf8');
  assert.match(bugs, /BUG-RENDER-001 \| Fixed - Awaiting User Approval \| Referee missing from field/, 'referee bug must remain awaiting visual approval');
  assert.match(spec, /V146\. Referee visual isolation/, 'referee visual behavior must be captured in the spec');
  assert.match(spec, /B141 \| 2026-05-17 \| Referee materials and palette remained in the renderer/, 'referee root cause must be recorded');
  assert.match(engine, /referee: \{ shirt: M\.refShirt, pants: M\.refPants, hair: M\.hairBlack, visor: M\.refVisor \}/, 'renderer must retain the referee palette');
  assert.match(engine, /private readonly refereePlayer = \{[\s\S]*?id: 'referee'[\s\S]*?role: 'REF'[\s\S]*?\} as unknown as SimplePlayer;/, 'referee must be a renderer-only pseudo player, not part of the model roster');
  assert.match(engine, /this\.refereeVisual = this\.createPlayerVisual\(this\.refereePlayer, TEAM_PALETTES\.referee\);/, 'engine must instantiate a visible referee sprite from the referee palette');
  assert.match(engine, /this\.refereeVisual\.mesh\.name = 'refereeVisual';/, 'referee visual must have a stable scene name for visual probes');
  assert.match(engine, /private updateRefereeVisual\(dt: number\)/, 'engine must update referee tracking every frame');
  assert.match(engine, /this\.updateRefereeVisual\(dt\);/, 'referee update must run from the mesh update pass');
  assert.match(engine, /private refereeTrackingTarget\(\)[\s\S]*?ball\.x - attackSign \* 8\.0[\s\S]*?THREE\.MathUtils\.clamp/, 'referee must track play from a bounded offset instead of overlapping the ball');
  assert.doesNotMatch(engine, /this\.model\.players\.push\([^)]*referee/i, 'referee must not be inserted into simulation players');
});

test('BUG-RENDER-003 player animation cycles are phase-offset', () => {
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  const bugs = readFileSync('BUGS.md', 'utf8');
  const spec = readFileSync('SPEC.md', 'utf8');
  assert.match(bugs, /BUG-RENDER-003 \| Fixed - Awaiting User Approval \| Player animations are synchronized/, 'animation sync bug must remain awaiting visual approval');
  assert.match(spec, /V127\. Player animation desync/, 'animation desync behavior must be captured in the spec');
  assert.match(spec, /B120 \| 2026-05-16 \| Player visuals initialized animation timers at zero/, 'animation sync root cause must be recorded');
  assert.match(engine, /animPhaseOffset: number/, 'player visuals must store a per-player animation phase');
  assert.match(engine, /private animationPhaseForPlayer\(player: SimplePlayer\)/, 'renderer must derive animation phase per player');
  assert.match(engine, /animTimer: animPhaseOffset \* 0\.12/, 'new visuals must start with an offset run-cycle timer');
  assert.match(engine, /breathOffset: animPhaseOffset \* Math\.PI \* 2/, 'idle breathing must use deterministic per-player phase');
  assert.match(engine, /visual\.animTimer = facingChanged \? visual\.animPhaseOffset \* animThreshold : 0;/, 'state/facing changes must restore phase instead of synchronizing every player to zero');
  assert.doesNotMatch(engine, /breathOffset: Math\.random\(\) \* Math\.PI \* 2/, 'player animation/breathing phase must not depend on random startup order');
});

test('ENH-RENDER-004 player scale is visual-only and bounded', () => {
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  const constants = readFileSync('src/core/constants.ts', 'utf8');
  const bugs = readFileSync('BUGS.md', 'utf8');
  const spec = readFileSync('SPEC.md', 'utf8');
  assert.match(bugs, /ENH-RENDER-004 \| Fixed - Awaiting User Approval \| Investigate larger player scale/, 'player scale enhancement must remain awaiting visual approval');
  assert.match(spec, /V130\. Visual-only player scale/, 'player scale behavior must be captured in the spec');
  assert.match(spec, /B123 \| 2026-05-16 \| Player readability needed a larger browser sprite/, 'player scale root cause must be recorded');
  assert.match(engine, /const PLAYER_VISUAL_SCALE = 1\.12;/, 'player visual scale must stay conservative and explicit');
  assert.match(engine, /const scale = PLAYER_VISUAL_SCALE \* \(player\.role === 'GK' \? 1\.08 : 1\) \* \(reactionActive \? 1\.16 : 1\) \* \(headerActive \? 1\.08 : 1\);/, 'renderer must apply the readability scale at mesh level only');
  assert.match(constants, /export const PLAYER_RADIUS = 0\.35;/, 'visual scale must not change model collision radius');
  assert.match(engine, /BROADCAST: \{ height: 46, back: 42, followX: 0\.70, panZ: 0\.45, fov: 29, lookAhead: 0 \}/, 'visual scale change must not hide a camera FOV change');
});

test('V124 ball trail renders only for enabled shot flights', () => {
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  const model = readFileSync('src/core/simpleMatchModel.ts', 'utf8');
  const ui = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  const spec = readFileSync('SPEC.md', 'utf8');
  assert.match(spec, /V124\. Ball trail scope/, 'ball trail scope must be captured in the spec');
  assert.match(model, /getActiveBallFlightKind\(\): BallFlightKind \| null \{[\s\S]*?return this\.ballFlight\?\.kind \?\? null;/, 'model must expose active ball flight kind for renderer gating');
  assert.match(engine, /private shotBallTrailEnabled = true/, 'shot ball trail should default on for shot flights');
  assert.match(engine, /setShotBallTrailEnabled = \(enabled: boolean\) => \{[\s\S]*?this\.shotBallTrailEnabled = !!enabled;[\s\S]*?if \(!this\.shotBallTrailEnabled\) this\.clearBallTrail\(\);[\s\S]*?\};/, 'engine must expose a setting that can fully disable shot trails');
  assert.match(engine, /if \(!this\.shotBallTrailEnabled \|\| this\.model\.getActiveBallFlightKind\(\) !== 'shot'\) \{[\s\S]*?this\.clearBallTrail\(\);[\s\S]*?return;[\s\S]*?\}/, 'ball trail update must clear and exit unless an enabled shot flight is active');
  assert.match(ui, /const \[shotBallTrailEnabled, setShotBallTrailEnabled\] = useState\(true\)/, 'UI must track the shot trail setting');
  assert.ok(ui.includes('gameRef.current?.setShotBallTrailEnabled?.(shotBallTrailEnabled)'), 'engine initialization must apply the shot trail setting');
  assert.match(ui, /checked=\{shotBallTrailEnabled\}[\s\S]*?setShotBallTrailEnabled\(enabled\);[\s\S]*?Shot Ball Trail/, 'options menu must expose a shot ball trail checkbox bound to UI state');
  assert.ok(ui.includes('gameRef.current?.setShotBallTrailEnabled?.(enabled)'), 'shot ball trail checkbox must update the engine setting');
});

test('browser game wires legacy sound assets to match events', () => {
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  const ui = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  const bugs = readFileSync('BUGS.md', 'utf8');
  const spec = readFileSync('SPEC.md', 'utf8');
  assert.match(bugs, /BUG-AUDIO-003 \| Fixed - Awaiting User Approval \| Whistle sound is not activated/, 'whistle bug must remain awaiting audible user approval');
  assert.match(spec, /V107\. Whistle audibility:[\s\S]*?unlocked\/resumed from the user-triggered match-start gesture[\s\S]*?asset-backed helper/, 'whistle audibility invariant must require user-gesture audio unlock and asset-backed playback');
  assert.match(spec, /V136\. Asset-only audio:[\s\S]*?must not synthesize sounds with oscillators or generated tones/, 'asset-only audio invariant must forbid synthetic sound generation');
  assert.match(spec, /B126 \| 2026-05-16 \| Whistle MP3 decode success could suppress the synthetic fallback/, 'whistle fallback root cause must be recorded');
  assert.match(spec, /B128 \| 2026-05-16 \| Match-start paths could stop splash music and start play without explicitly unlocking gameplay Web Audio/, 'match-start audio unlock root cause must be recorded');
  assert.match(spec, /B130 \| 2026-05-16 \| Gameplay audio still included oscillator fallbacks/, 'synthetic audio removal root cause must be recorded');
  assert.match(engine, /const SOUND_ASSETS: Record<SoundBufferKey, string>/, 'engine must define legacy sound asset map');
  // Paths go through assetUrl so they resolve under a GitHub Pages subpath as
  // well as the dev server and Tauri's asset protocol. The invariant these
  // assertions protect is unchanged: real asset files, never synthesised tones
  // (V136), and still the same files.
  assert.match(engine, /whistle: assetUrl\('\/whistle\.mp3'\)/, 'whistle asset must be loaded from public');
  assert.match(engine, /crowd: assetUrl\('\/crowd\.mp3'\)/, 'crowd loop asset must be loaded from public');
  assert.match(engine, /goal: assetUrl\('\/announcer_goal\.mp3'\)/, 'goal announcer asset must be loaded from public');
  assert.match(engine, /post: assetUrl\('\/donk\.mp3'\)/, 'woodwork impact must load the donk asset from public');
  assert.match(engine, /private ensureAudioContext\(\)/, 'engine must initialize Web Audio lazily from user input');
  assert.match(engine, /splashMusicStart = \(\) => \{[\s\S]*?this\.playLoop\('splashMusic'/, 'splash music API must play the legacy menu music');
  assert.match(engine, /setCrowdVolume = \(value: number\) => \{[\s\S]*?linearRampToValueAtTime/, 'crowd volume slider must control audio gain');
  assert.match(engine, /private triggerGoalCrowdSwell\(\)[\s\S]*?base \* 1\.10[\s\S]*?now \+ 8\.0/, 'goals must swell the crowd loop by 10 percent for 8 seconds');
  assert.match(engine, /private playWhistle\(volume = 0\.46\)/, 'whistle playback must use a dedicated audible helper');
  assert.match(engine, /unlockGameplayAudio = \(\) => \{[\s\S]*?const ctx = this\.ensureAudioContext\(\);[\s\S]*?this\.preloadAudio\(\);[\s\S]*?ctx\.resume\(\)/, 'match start must expose a user-gesture audio unlock path that decodes gameplay sounds');
  assert.match(engine, /type WhistleAuditEvent = \{[\s\S]*?assetPlayed: boolean;[\s\S]*?elapsed: number;[\s\S]*?\}/, 'whistle attempts must be auditable');
  assert.match(engine, /private readonly whistleAuditEvents: WhistleAuditEvent\[\] = \[\]/, 'engine must retain bounded whistle audit telemetry');
  assert.match(engine, /whistleAuditEvents: this\.whistleAuditEvents\.slice\(-100\)/, 'tuning bundle must expose recent whistle attempts');
  assert.match(engine, /this\.preloadAudioBytes\(\['splashMusic', 'welcome', 'whistle'\]\);/, 'whistle bytes must preload before match start');
  assert.match(engine, /this\.preloadAudio\(\['splashMusic', 'welcome', 'whistle'\]\);/, 'whistle must decode on the first user audio gesture with menu audio');
  assert.match(engine, /const boostedVolume = Math\.max\(volume, 0\.74\);[\s\S]*?const assetPlayed = this\.playBuffer\('whistle', boostedVolume, 0\.02, 0\.55\);/, 'whistle helper must use the boosted whistle asset');
  assert.doesNotMatch(engine, /createOscillator|playTone|playWhistleTone|OscillatorType/, 'gameplay audio must not generate synthetic oscillator sounds');
  assert.match(engine, /while \(this\.whistleAuditEvents\.length > 100\) this\.whistleAuditEvents\.shift\(\);/, 'whistle audit telemetry must remain bounded');
  assert.match(engine, /private playSoundForLiveEvent\(event: \{ action: string; meta\?: Record<string, unknown> \}\)/, 'live events must be mapped to sound cues');
  assert.match(engine, /case 'KICKOFF':[\s\S]*?if \(event\.meta\?\.phase === 'release'\) \{[\s\S]*?this\.playGameplayBuffer\('kick'[\s\S]*?break;[\s\S]*?\}[\s\S]*?this\.playWhistle\(0\.48\)/, 'kickoff release must not double-whistle; setup alone triggers the audible whistle');
  assert.match(engine, /case 'SHOT':[\s\S]*?this\.playGameplayBuffer\('shot'/, 'shots must trigger shot audio');
  assert.match(engine, /case 'WOODWORK':[\s\S]*?this\.playGameplayBuffer\('post'/, 'woodwork must trigger the donk/post audio');
  assert.match(engine, /case 'GOAL':[\s\S]*?this\.playWhistle\(0\.48\)[\s\S]*?this\.playGameplayBuffer\('goal'[\s\S]*?this\.triggerGoalCrowdSwell\(\)/, 'goals must trigger whistle, announcer audio and crowd swell');
  assert.doesNotMatch(engine, /crowdGoal|applause\.(mp3|wav)/, 'goal reaction must not use applause or one-shot crowdGoal audio');
  assert.match(engine, /case 'CORNER':[\s\S]*?this\.playGameplayBuffer\('corner'/, 'corners must trigger corner audio');
  assert.match(engine, /case 'THROW_IN':[\s\S]*?event\.meta\?\.phase === 'setup'[\s\S]*?this\.playGameplayBuffer\('throw'/, 'throw-in announcer must play on setup, not after release');
  assert.match(engine, /case 'OFFSIDE':[\s\S]*?this\.playWhistle\(0\.5\)[\s\S]*?this\.playGameplayBuffer\('offside'/, 'offsides must trigger the audible whistle helper');
  assert.match(engine, /case 'FOUL':[\s\S]*?this\.playWhistle\(0\.5\)[\s\S]*?this\.playGameplayBuffer\('foul'/, 'fouls must trigger the audible whistle helper');
  assert.match(engine, /case 'HALF':[\s\S]*?case 'FULL':[\s\S]*?this\.playWhistle\(0\.5\)/, 'half-time and full-time must trigger the audible whistle helper');
  assert.match(engine, /case 'THROW':\s*break;\s*case 'THROW_IN':/, 'legacy THROW marker must stay silent so throw-in audio cannot double announce');
  assert.match(engine, /case 'TACKLE':[\s\S]*?this\.playGameplayBuffer\('catch'/, 'tackles must use the soft-body-impact asset');
  assert.match(engine, /private lastThrowInAnnouncementKey = ''/, 'throw-in announcement must track the last restart key');
  assert.match(engine, /private readonly oneShotAudioLastPlayedAt: Partial<Record<SoundBufferKey, number>>/, 'one-shot sounds must have optional cooldown tracking');
  assert.match(engine, /private restartAnnouncementKey\(event: \{ team\?: string; action: string; meta\?: Record<string, unknown> \}\)/, 'restart announcements must have a stable de-dupe key');
  assert.match(engine, /key !== this\.lastThrowInAnnouncementKey/, 'throw-in announcer must suppress duplicate setup/release announcements for the same restart');
  assert.match(engine, /this\.playGameplayBuffer\('throw', 0\.36, 0\.08, 2\.5\)/, 'throw-in announcer must be cooldown-gated and tail-faded, not clipped');
  assert.match(engine, /const fadeStart = now \+ Math\.max\(0, duration - fadeSeconds\);[\s\S]*?source\.stop\(now \+ duration \+ 0\.05\)/, 'one-shot audio must fade at clip tail and stop after full buffer duration');
  assert.doesNotMatch(engine, /case 'TACKLE':[\s\S]{0,140}playTone\(220, 'sawtooth'/, 'tackles must not use the old harsh sawtooth fallback');
  assert.match(engine, /this\.playSoundForLiveEvent\(event\)/, 'event cue loop must invoke the audio mapper');
  assert.match(ui, /const handleKickOff = \([\s\S]*?gameRef\.current\?\.unlockGameplayAudio\?\.\(\);[\s\S]*?const isHotSeat = mode === '2p';/, 'normal kickoff paths must unlock gameplay audio inside the user start handler');
  assert.match(ui, /onPlayMatch=\{\(home, away\) => \{[\s\S]*?gameRef\.current\?\.unlockGameplayAudio\?\.\(\);[\s\S]*?setTimeout\(\(\) =>/, 'season match starts must unlock audio before delayed kickoff setup loses the user gesture');
  assert.match(engine, /case 'KICKOFF':[\s\S]*?event\.meta\?\.phase === 'release'[\s\S]*?break;[\s\S]*?this\.playWhistle\(0\.48\)/, 'release-phase KICKOFF events must exit before the whistle call');
  assert.match(engine, /private readonly audioBytes: Partial<Record<SoundBufferKey, ArrayBuffer>>/, 'audio bytes must be cached before first user gesture');
  assert.match(engine, /private preloadAudioBytes\(keys\?: SoundBufferKey\[\]\)/, 'engine must expose a byte preload path separate from AudioContext playback');
  assert.match(engine, /this\.preloadAudioBytes\(\['splashMusic', 'welcome', 'whistle'\]\);/, 'constructor must cache menu and whistle audio bytes while the splash screen is visible');
  assert.match(engine, /private preloadGameplayAudio\(\)[\s\S]*?this\.preloadAudio\(\)/, 'lower-priority gameplay sounds must be deferred until match start');
  assert.match(engine, /this\.preloadAudio\(\['splashMusic', 'welcome', 'whistle'\]\);/, 'intro music, welcome callout, and whistle must decode before lower-priority sound effects');
  assert.doesNotMatch(engine, /splashMusicStart = \(\) => \{\};/, 'splash music API must not remain stubbed');
  assert.doesNotMatch(engine, /setCrowdVolume = \(_value: number\) => \{\};/, 'crowd volume API must not remain stubbed');
});

test('BUG-AUDIO-004 splash welcome callout is delayed and retry-safe', () => {
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  const bugs = readFileSync('BUGS.md', 'utf8');
  const spec = readFileSync('SPEC.md', 'utf8');
  assert.match(bugs, /BUG-AUDIO-004 \| Fixed - Awaiting User Approval \| Welcome callout does not play after intro music/, 'welcome audio bug must remain awaiting user approval');
  assert.match(spec, /V128\. Menu welcome audio/, 'welcome audio timing must be captured in the spec');
  assert.match(spec, /B121 \| 2026-05-16 \| Welcome callout was scheduled at 900ms/, 'welcome audio root cause must be recorded');
  assert.match(engine, /private splashWelcomeTimer: number \| null = null/, 'engine must track the pending welcome timer');
  // Gain is the user's music volume now, not a literal; the invariant is the 2s delay.
  assert.match(engine, /splashMusicStart = \(\) => \{[\s\S]*?this\.playLoop\('splashMusic', this\.splashMusic, this\.musicVolume \* SPLASH_MUSIC_BASE_GAIN\);[\s\S]*?this\.scheduleSplashWelcome\(2000\);/, 'welcome callout must be scheduled about two seconds after splash music starts');
  assert.match(engine, /splashMusicStop = \(\) => \{[\s\S]*?this\.clearSplashWelcomeTimer\(\);/, 'stopping splash music must clear stale welcome timers');
  assert.match(engine, /private playSplashWelcomeOnce\(\) \{[\s\S]*?if \(this\.splashWelcomePlayed \|\| !this\.splashMusicRequested\) return;[\s\S]*?if \(!this\.playBuffer\('welcome', 0\.48\)\) \{[\s\S]*?this\.scheduleSplashWelcome\(200\);[\s\S]*?return;[\s\S]*?\}[\s\S]*?this\.splashWelcomePlayed = true;/, 'welcome must only be marked played after the buffer actually starts, with retry if decode is late');
  assert.match(engine, /private clearSplashWelcomeTimer\(\) \{[\s\S]*?window\.clearTimeout\(this\.splashWelcomeTimer\);[\s\S]*?this\.splashWelcomeTimer = null;/, 'engine must have a reusable timer cleanup path');
  assert.doesNotMatch(engine, /setTimeout\([\s\S]{0,120}playSplashWelcomeOnce\(\)[\s\S]{0,80}, 900\)/, 'welcome callout must not use the old early 900ms timer');
});

test('CPU vs CPU and watched CPU use selected teams', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  assert.match(source, /BASE_TEAM_OPTIONS = WORLD_CUP_2026_TEAM_NAMES/, 'browser team selectors should default to the official 48-team field');
  assert.match(source, /EASTER_EGG_TEAM_OPTIONS = \['Italy 1982', 'West Germany 1982'\]/, '1982 finalists must be kept behind the easter egg unlock');
  assert.match(source, /easterEggUnlocked \? \[\.\.\.BASE_TEAM_OPTIONS, \.\.\.EASTER_EGG_TEAM_OPTIONS\] : BASE_TEAM_OPTIONS/, 'historic teams must only enter selectors after unlock');
  assert.match(source, /PLAYABLE_WORLD_TEAM_KITS/, 'browser kits must come from the playable world-team catalog');
  assert.match(source, /resolvePlayableTeamKits/, 'browser kit application must use clash-safe home-away resolution');
  assert.match(source, /function randomCpuMatchup\(\): CpuMatchup/, 'CPU matchups must use a shared randomizer');
  assert.match(source, /if \(awayIndex >= homeIndex\) awayIndex \+= 1/, 'randomizer must avoid home and away being the same team');
  assert.match(source, /const kickoffTeams = overrideTeams \?\? \{ a: teamAName, b: teamBName \}/, 'plain CPU kickoff must use selected menu teams');
  assert.match(source, /const assignment = buildPreMatchAssignment\(\);[\s\S]*?const kickoffTeams = \{ a: assignment\.home\.name, b: assignment\.away\.name \}/, 'pre-match setup start must use selected home-away assignment');
  assert.match(source, /focused=\{menuFocusIndex === 4\}[\s\S]*?onClick=\{\(\) => setShowPreMatchSetup\(true\)\}[\s\S]*?CPU vs CPU/, 'CPU vs CPU menu selection must open setup without randomizing teams');
  assert.doesNotMatch(source, /focused=\{menuFocusIndex === 4\}[\s\S]{0,120}tone="muted"[\s\S]*?CPU vs CPU/, 'CPU vs CPU menu item must look enabled like the other primary mode buttons');
  assert.match(source, /else if \(fi === 4\) \{\s*setShowPreMatchSetup\(true\);\s*\}/, 'gamepad CPU vs CPU selection must open setup without randomizing teams');
  assert.match(source, /const assignment = buildPreMatchAssignment\(\);[\s\S]*?const fixtureTeams = \{ a: assignment\.home\.name, b: assignment\.away\.name \}/, 'watched CPU fixture must use selected home-away assignment');
  assert.match(source, /homeTeam: fixtureTeams\.a,\s*awayTeam: fixtureTeams\.b/s, 'fixture runner payload must use the selected teams');
  assert.doesNotMatch(source, /const kickoffTeams = randomCpuMatchup\(\)/, 'pre-match setup start must not randomize teams');
  assert.doesNotMatch(source, /const fixtureTeams = randomCpuMatchup\(\)/, 'watched CPU fixture must not randomize teams');
  assert.doesNotMatch(source, /MLS_TEAM_NAMES\.slice\(\)\.sort\(\(\) => Math\.random\(\) - 0\.5\)/, 'team randomization must not rely on biased array sort shuffling');
});

test('ENH-INPUT-001 restores legacy gamepad menu and match controls', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  const bugs = readFileSync('BUGS.md', 'utf8');
  const spec = readFileSync('SPEC.md', 'utf8');
  assert.match(bugs, /ENH-INPUT-001 \| Fixed - Awaiting User Approval \| Restore old gamepad support/, 'gamepad enhancement must remain awaiting user approval');
  assert.match(spec, /V157\. Browser gamepad controls/, 'gamepad behavior must be captured in the spec');
  assert.match(spec, /B153 \| 2026-05-18 \| Current gamepad support only handled the main menu/, 'gamepad root cause must be recorded');
  assert.match(source, /const gameplayGpPrev = useRef<boolean\[\]>\(new Array\(17\)\.fill\(false\)\)/, 'gameplay/pause gamepad polling must keep its own edge-detection state');
  assert.match(source, /pickStandardGamepad\(/, 'gamepad polling must go through the shared standard-mapping selector, not raw slot 0');
  assert.match(source, /confirmPressed = justPressed\(0\)/, 'A/Cross must be mapped as the confirm button');
  assert.match(source, /backPressed = justPressed\(1\)/, 'B/Circle must be mapped as the back button');
  assert.match(source, /startPressed = justPressed\(9\)/, 'Start must be mapped for pause and halftime continue');
  assert.match(source, /showPreMatchSetupRef\.current[\s\S]*?confirmPressed[\s\S]*?handlePreMatchSetupStartRef\.current\(\)/, 'A/Cross must start the configured pre-match setup');
  assert.match(source, /showPreMatchSetupRef\.current[\s\S]*?backPressed[\s\S]*?setShowPreMatchSetup\(false\)/, 'B/Circle must close pre-match setup');
  assert.match(source, /halftimeAwaitingRef\.current && \(confirmPressed \|\| startPressed\)[\s\S]*?handleContinueHalftimeRef\.current\('manual'\)/, 'A/Cross or Start must continue interactive halftime');
  assert.match(source, /else if \(startPressed\) \{[\s\S]*?handleTogglePauseRef\.current\(\);[\s\S]*?\}/, 'Start must toggle pause while already paused or live');
  assert.match(source, /startMenuVisible = .*&& !showPreMatchSetup && !showPracticeSetup/, 'hidden main-menu gamepad input must not stay active behind setup panels');
  assert.match(source, /if \(stickY < -0\.5 \|\| dpadUp\)[\s\S]*?else if \(stickY > 0\.5 \|\| dpadDown\)/, 'left stick or D-pad must navigate the main menu');
  assert.match(source, /if \(stickX > 0\.5 \|\| dpadRight\)[\s\S]*?setTeamAName[\s\S]*?setTeamBName[\s\S]*?else if \(stickX < -0\.5 \|\| dpadLeft\)/, 'left stick or D-pad must cycle focused home/away team selectors');
});

test('BUG-UI-003 pre-match Home/Away and kit buttons feed kickoff assignment', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  assert.match(source, /type MatchKitKey = 'home' \| 'away'/, 'pre-match kit state must resolve to canonical kit keys');
  assert.match(source, /function preMatchKitKey\(index: number\): MatchKitKey/, 'pre-match kit buttons must map preview indexes to kickoff kit keys');
  assert.match(source, /const buildPreMatchAssignment = \(\) => \{[\s\S]*?return teamAHome \? \{ home: panelA, away: panelB \} : \{ home: panelB, away: panelA \}/, 'home-away toggle must produce explicit home and away panels');
  assert.match(source, /teamBHome=\{!teamAHome\}/, 'Team B home state must be the inverse of Team A home state');
  assert.match(source, /onTeamBHomeChange=\{\(isHome\) => setTeamAHome\(!isHome\)\}/, 'Team B home button must toggle the active home side');
  assert.match(source, /handleKickOff\('cpu', kickoffTeams, \{[\s\S]*?teamAKit: assignment\.home\.kit,[\s\S]*?teamBKit: assignment\.away\.kit,[\s\S]*?teamAFormation: assignment\.home\.formation,[\s\S]*?teamBFormation: assignment\.away\.formation/s, 'pre-match start must pass selected kits and formations into kickoff');
  assert.match(source, /getResolvedMatchKits\(fixtureTeams\.a, fixtureTeams\.b, assignment\.home\.kit, assignment\.away\.kit\)/, 'watched fixture must apply selected pre-match kits');
  assert.match(source, /formationA: assignment\.home\.formation,\s*formationB: assignment\.away\.formation/s, 'watched fixture payload must use selected home-away formations');
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
  // Pan strength is now per-rig, but every rig must still be clamped.
  assert.match(body, /const desiredPanZ = THREE\.MathUtils\.clamp\(this\.cameraFocusSmoothed\.z \* rig\.panZ, -FIELD_D \* 0\.18, FIELD_D \* 0\.18\)/, 'camera vertical pan must be clamped to avoid swinging too far');
  // Height and standoff come from the active rig; the invariant is that pan
  // translates the camera without altering the rig's height.
  assert.match(body, /this\.cameraLerpPosition\.set\(desiredCamX, rig\.height, rig\.back \+ desiredPanZ\)/, 'camera must translate vertically without changing height');
  assert.match(body, /this\.cameraLookTarget\.set\(this\.camera\.position\.x, 0, this\.camera\.position\.z - rig\.back - rig\.lookAhead\)/, 'camera target must translate with camera Z to preserve fixed viewing angle');
  assert.doesNotMatch(body, /edgeTrackT|lookZ|camZMul|camZClamp|finalThirdT/, 'broadcast camera must not swing or zoom into final thirds');
});

test('World Cup start action stays reachable, and a match can be quit to the menu', () => {
  const hub = readFileSync('src/components/WorldCupHub.tsx', 'utf8');
  // The 48-team grid pushed the start button below the fold: testers picked a
  // team, saw no Start prompt, and reported the mode as unstartable.
  assert.match(hub, /sticky bottom-0/, 'the start action must stay pinned above the team grid scroll');
  assert.match(hub, /data-psl-worldcup-start="true"/, 'the start action needs a stable hook');
  const grid = hub.match(/max-h-\[(\d+)vh\] overflow-y-auto/);
  assert.ok(grid, 'expected a scrollable team grid');
  assert.ok(Number(grid[1]) <= 50, `team grid must leave room for the start action, got ${grid[1]}vh`);

  const retro = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  // Testers could only leave a game mode by closing the application.
  assert.match(retro, /const handleQuitToMainMenu = \(\) => \{/, 'a quit-to-menu handler must exist');
  assert.match(retro, /data-psl-quit-to-menu="options"/, 'options must offer quit to main menu');
  assert.match(retro, /onQuitToMenu=\{handleQuitToMainMenu\}/, 'pause must offer quit to main menu');
  const pause = readFileSync('src/components/PauseOverlay.tsx', 'utf8');
  assert.match(pause, /data-psl-quit-to-menu="pause"/, 'pause overlay must render the quit action');
});

test('every camera mode is a distinct rig, not just a stored label', () => {
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  // setCameraMode used to only store a string the model echoed into
  // telemetry, so every option rendered as Broadcast.
  assert.doesNotMatch(engine, /setCameraMode = \(value: string\) => \{ this\.model\.cameraMode = value; \};/, 'camera mode must do more than store a label');
  assert.match(engine, /this\.cameraMode = this\.cameraRigs\[value\] \? value : 'BROADCAST'/, 'camera mode must resolve to a known rig');
  assert.match(engine, /const rig = this\.cameraRigs\[this\.cameraMode\] \?\? this\.cameraRigs\.BROADCAST/, 'the camera must read the active rig each frame');

  const table = engine.match(/private readonly cameraRigs[\s\S]*?\n  \};/);
  assert.ok(table, 'expected a camera rig table');
  for (const mode of ['BROADCAST', 'FOLLOW_BEHIND', 'SIDELINE', 'FIXED_ENDZONE', 'GOAL_THREE_QUARTER', 'STADIUM_CAM']) {
    assert.match(table[0], new RegExp(`${mode}: \{`), `${mode} needs its own rig`);
  }
  // Distinct heights, or the modes look identical on screen.
  const heights = [...table[0].matchAll(/height: ([0-9.]+)/g)].map((m) => Number(m[1]));
  assert.equal(new Set(heights).size, heights.length, `camera rigs must differ in height, got ${heights.join(', ')}`);
});

test('weather and lighting controls are gone rather than inert', () => {
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  const retro = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  // They only stored values the model echoed into telemetry; nothing rendered
  // them, so testers reported the settings having no effect.
  assert.doesNotMatch(engine, /setWeather = /, 'dead weather setter must be removed');
  assert.doesNotMatch(engine, /setLighting = /, 'dead lighting setter must be removed');
  assert.doesNotMatch(retro, /handleWeatherChange|handleLightingChange/, 'dead weather/lighting handlers must be removed');
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

test('BUG-GK-002 keeper save animations emit renderer audit telemetry', () => {
  const source = readFileSync('src/gameEngine.ts', 'utf8');
  const bugs = readFileSync('BUGS.md', 'utf8');
  const spec = readFileSync('SPEC.md', 'utf8');
  assert.match(bugs, /BUG-GK-002 \| Fixed - Awaiting User Approval \| Goalkeeper save animations may not activate/, 'keeper animation bug must remain awaiting visual approval');
  assert.match(spec, /V131\. Keeper animation telemetry/, 'keeper animation telemetry behavior must be captured in the spec');
  assert.match(spec, /B124 \| 2026-05-16 \| Keeper save telemetry proved the model emitted `SAVE`/, 'keeper animation telemetry root cause must be recorded');
  assert.match(source, /type KeeperAnimationEvent = \{[\s\S]*?action: 'SAVE' \| 'SMOTHER';[\s\S]*?keeperId: string;[\s\S]*?direction: KeeperDiveDirection;[\s\S]*?sourceEventSeq: number;/, 'renderer must define a keeper animation audit row');
  assert.match(source, /private readonly keeperAnimationEvents: KeeperAnimationEvent\[\] = \[\]/, 'renderer must keep a bounded keeper animation audit log');
  assert.match(source, /getTuningBundle = \(\) => \(\{[\s\S]*?keeperAnimationEvents: this\.keeperAnimationEvents\.slice\(-100\),[\s\S]*?\}\);/, 'tuning bundle must expose renderer keeper animation events');
  assert.match(source, /if \(event\.action === 'SAVE' \|\| event\.action === 'SMOTHER'\) \{[\s\S]*?this\.keeperReactions\.set\(team, \{ ttl: duration, duration, zLean, direction \}\);[\s\S]*?this\.recordKeeperAnimationEvent\(event, keeper, direction, duration, seq\);/, 'SAVE/SMOTHER events must both install keeper reactions and audit telemetry rows');
  assert.match(source, /private keeperAnimationDirectionFromEvent\(event: \{ action: string; meta\?: Record<string, unknown> \}, keeper: SimplePlayer\): KeeperDiveDirection/, 'smother animation direction must be derived explicitly');
  assert.match(source, /while \(this\.keeperAnimationEvents\.length > 100\) this\.keeperAnimationEvents\.shift\(\);/, 'keeper animation audit log must stay bounded');
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
  assert.match(source, /type HeaderReaction = \{ ttl: number; duration: number; kind: 'shot' \| 'clearance' \| 'touch'; direction: 1 \| -1 \}/, 'header reaction state must be explicit');
  assert.match(source, /private readonly headerReactions = new Map<string, HeaderReaction>/, 'renderer must retain header reactions by player');
  assert.match(source, /event\.action === 'HEADER_SHOT' \|\| event\.action === 'HEADER_CLEARANCE' \|\| event\.action === 'HEADER_TOUCH'/, 'header live events must drive renderer cues');
  assert.match(source, /private updateHeaderSprite/, 'renderer must have a dedicated header sprite path');
  assert.match(source, /this\.headerReactions\.clear\(\)/, 'visual reset must clear header reactions');
});

test('BUG-UI-006 full-time headers come from visible header animations', () => {
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  const ui = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  const bugs = readFileSync('BUGS.md', 'utf8');
  const spec = readFileSync('SPEC.md', 'utf8');
  assert.match(bugs, /BUG-UI-006 \| Fixed - Awaiting User Approval \| Header shown in Game Over without visible header/, 'header summary bug must remain awaiting visual approval');
  assert.match(spec, /V132\. Visible header summary/, 'visible header summary behavior must be captured in the spec');
  assert.match(spec, /B125 \| 2026-05-16 \| Full-time overlay displayed raw header counters/, 'visible header root cause must be recorded');
  assert.match(engine, /type HeaderAnimationEvent = \{[\s\S]*?action: 'HEADER_SHOT' \| 'HEADER_CLEARANCE' \| 'HEADER_TOUCH';[\s\S]*?playerId: string;[\s\S]*?sourceEventSeq: number;/, 'renderer must define a header animation audit row');
  assert.match(engine, /private readonly headerAnimationEvents: HeaderAnimationEvent\[\] = \[\]/, 'renderer must keep a bounded header animation audit log');
  assert.match(engine, /headerAnimationEvents: this\.headerAnimationEvents\.slice\(-100\)/, 'tuning bundle must expose renderer header animation events');
  assert.match(engine, /const kind = event\.action === 'HEADER_SHOT' \? 'shot' : event\.action === 'HEADER_CLEARANCE' \? 'clearance' : 'touch';[\s\S]*?this\.headerReactions\.set\(player\.id,[\s\S]*?this\.recordHeaderAnimationEvent\(event, player, kind, direction, duration, seq\);/, 'header live events must both install reactions and audit telemetry rows');
  assert.match(engine, /while \(this\.headerAnimationEvents\.length > 100\) this\.headerAnimationEvents\.shift\(\);/, 'header animation audit log must stay bounded');
  assert.match(ui, /const visibleHeaderEvents = Array\.isArray\(tuningBundle\?\.headerAnimationEvents\) \? tuningBundle\.headerAnimationEvents : \[\];/, 'full-time capture must read visible header animation telemetry');
  assert.match(ui, /headersA: visibleHeadersA,[\s\S]*?headersB: visibleHeadersB,/, 'full-time summary must use visible header counts');
  assert.doesNotMatch(ui, /headersA: snapshot\.headersA,[\s\S]*?headersB: snapshot\.headersB,/, 'full-time summary must not display raw model header counters directly');
});

test('V78 renderer animates throw-in and corner release phases distinctly from idle', () => {
  const source = readFileSync('src/gameEngine.ts', 'utf8');
  assert.match(source, /if \(restartPose\?\.type === 'throw_in'\) \{\s*this\.updateThrowInSprite\(visual, restartPose\);/s, 'throw-in presentation must use the dedicated sprite path during setup and release');
  assert.match(source, /if \(restartPose\?\.type === 'corner'\) \{\s*this\.updateCornerKickSprite\(visual, restartPose\);/s, 'corner presentation must use the dedicated sprite path during setup and release');
  assert.match(source, /private restartPresentationProgress\(restart: RestartPresentation\)/, 'restart animation must derive visible phase progress');
  assert.match(source, /restart\.phase === 'release' \? Math\.sin\(progress \* Math\.PI\)/, 'restart release must drive a visible movement curve');
  assert.match(source, /private throwInPresentationPlayerPosition\(restart: RestartPresentation\)/, 'throw-in taker must move through a dedicated sideline throw path');
  assert.match(source, /if \(restart\.type === 'throw_in'\) return this\.throwInPresentationPlayerPosition\(restart\)/, 'throw-ins must use a dedicated player-position path');
  assert.match(source, /const lineZ = restart\.spot\.z \+ outsideZ \* 0\.12;/, 'throw-in release foot placement must stay outside the touchline');
  assert.match(source, /THROW_IN_RELEASE_PRESENTATION_SECONDS = 1\.15/, 'throw-in release must stay visible long enough to verify the player motion');
  assert.match(source, /restart\.phase === 'release' && visual\.runFrames\.length \? visual\.runFrames : visual\.idleFrames/, 'corner release must use run/kick frames instead of staying idle');
  assert.doesNotMatch(source, /restartPose\?\.type === 'throw_in' && restartPose\.phase === 'setup'/, 'throw-in special pose must not disappear as soon as release starts');
  assert.doesNotMatch(source, /restart\.spot\.z \+ inwardZ \* 0\.18/, 'throw-in release must not drag the taker inside the touchline');
  assert.doesNotMatch(source, /restartPose\?\.type === 'corner' && restartPose\.phase === 'setup'/, 'corner special pose must not disappear as soon as release starts');
});

test('V239 renderer uses model taker spot for corner and throw-in presentation while leaving the ball at the restart spot', () => {
  const source = readFileSync('src/gameEngine.ts', 'utf8');
  assert.match(source, /takerSpot: \{ x: number; z: number \} \| null;/, 'restart presentation state must carry an explicit taker spot');
  assert.match(source, /const takerSpot = this\.pointFromMeta\(event\.meta\?\.takerSpot\);/, 'renderer must parse model-provided taker spots from restart events');
  assert.match(source, /if \(\(restart\.type === 'throw_in' \|\| restart\.type === 'corner'\) && restart\.takerSpot\) return restart\.takerSpot;/, 'corner and throw-in player presentation must use the model taker spot as the source of truth');
  assert.match(source, /const strike = restart\.takerSpot \|\| \{[\s\S]*?CORNER_OUTSIDE_TOUCHLINE_OFFSET[\s\S]*?\};/, 'corner strike position must prefer the model taker spot over recomputed geometry');
  assert.match(source, /const preload = \{[\s\S]*?strike\.x - kickDirX \* 0\.10[\s\S]*?strike\.z \+ outsideZ \* 0\.06[\s\S]*?\};[\s\S]*?if \(restart\.phase === 'setup'\) \{[\s\S]*?x: preload\.x \+ kickDirX \* setupPulse \* 0\.18,[\s\S]*?z: preload\.z - outsideZ \* Math\.abs\(setupPulse\) \* 0\.10,/s, 'corner setup pose must hold the taker by the flag instead of backing up into an off-corner run-up');
  assert.match(source, /if \(restart\.type === 'corner'\) return \{ x: restart\.spot\.x, y: BALL_GROUND_Y, z: restart\.spot\.z \};/, 'corner setup ball must stay at the restart spot rather than moving to the taker spot');
});

test('V159 renderer keeps penalty restart presentation from hiding penalty ball flight', () => {
  const source = readFileSync('src/gameEngine.ts', 'utf8');
  const spec = readFileSync('SPEC.md', 'utf8');
  const bugs = readFileSync('BUGS.md', 'utf8');
  assert.match(spec, /V159\. Penalty kick flight continuity/, 'penalty flight continuity must be captured in the spec');
  assert.match(bugs, /BUG-PENALTY-001 \| Fixed - Awaiting User Approval \| Penalty kick ball disappears or teleports/, 'penalty teleport bug must remain awaiting visual approval');
  assert.match(source, /event\.action === 'THROW_IN' \|\| event\.action === 'CORNER' \|\| event\.action === 'GOAL_KICK' \|\| event\.action === 'FREE_KICK' \|\| event\.action === 'PENALTY' \|\| event\.action === 'DROP_KICK'/, 'renderer must consume penalty setup/release presentation events');
  assert.match(source, /if \(event\.action === 'PENALTY'\) return 'penalty';/, 'penalty events must resolve to penalty restart presentation type');
  assert.match(source, /if \(restart\.type === 'penalty'\) return \{ x: restart\.spot\.x, y: BALL_GROUND_Y, z: restart\.spot\.z \};/, 'penalty setup may pin the setup ball at the spot');
  assert.match(source, /if \(!restart \|\| restart\.phase !== 'setup'\) return null;/, 'penalty release must not override the live model ball flight');
  assert.match(source, /restartPose\?\.type === 'penalty'[\s\S]*?this\.updateGoalKickSprite\(visual, restartPose\);/s, 'penalty taker must keep a visible release animation without hiding the ball');
});

test('V83 corner kicks animate the taker mesh through the run-up and kick', () => {
  const source = readFileSync('src/gameEngine.ts', 'utf8');
  assert.match(source, /restartPresentationPlayerPosition\(restartPose\)/, 'restart taker mesh position must use the presentation player position');
  assert.match(source, /private restartPresentationPlayerPosition\(restart: RestartPresentation\)/, 'renderer must define restart player positioning separate from ball positioning');
  assert.match(source, /if \(restart\.type === 'corner'\) return this\.cornerPresentationPlayerPosition\(restart\)/, 'corners must use a dedicated player-position path');
  assert.match(source, /private cornerPresentationPlayerPosition\(restart: RestartPresentation\)/, 'corner taker positioning must be isolated and testable');
  assert.match(source, /CORNER_RUNUP_DISTANCE = 1\.15/, 'corner taker must visibly run up to the ball');
  assert.match(source, /const follow = \{[\s\S]*?strike\.x \+ kickDirX \* 0\.16[\s\S]*?strike\.z \+ inwardZ \* 0\.10[\s\S]*?\}/, 'corner taker follow-through must stay on the outside side of the ball');
  assert.match(source, /const followT = THREE\.MathUtils\.smoothstep\(progress, 0\.82, 1\)/, 'corner taker must not cross the ball before the kick reads visually');
  assert.match(source, /visual\.spriteGroup\.rotation\.set\(0, 0, -visual\.dir \* \(plantT \* 0\.18 \+ kickT \* 0\.52\)\)/, 'corner kick sprite swing must be large enough to read');
  assert.match(source, /type === 'corner' && phase === 'release'[\s\S]*?CORNER_RELEASE_PRESENTATION_SECONDS/, 'corner release must stay on screen long enough to show the taker');
});

test('BUG-RESTART-001 corner presentation cannot fall back to ball-only animation', () => {
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  const bugs = readFileSync('BUGS.md', 'utf8');
  const spec = readFileSync('SPEC.md', 'utf8');
  assert.match(bugs, /BUG-RESTART-001 \| Fixed - Awaiting User Approval \| Corner taken by invisible player/, 'corner invisible-player bug must remain awaiting visual approval');
  assert.match(spec, /V139\. Corner taker visibility/, 'corner taker visibility must be captured in the spec');
  assert.match(engine, /type CornerPresentationEvent = \{[\s\S]*?action: 'CORNER';[\s\S]*?requestedTakerId: string \| null;[\s\S]*?usedFallback: boolean;/, 'renderer must define corner presentation audit rows');
  assert.match(engine, /private readonly cornerPresentationEvents: CornerPresentationEvent\[\] = \[\]/, 'renderer must retain corner presentation audit telemetry');
  assert.match(engine, /cornerPresentationEvents: this\.cornerPresentationEvents\.slice\(-100\)/, 'tuning bundle must expose corner presentation telemetry');
  assert.match(engine, /const takerId = this\.resolveRestartPresentationTakerId\(type, event\.team \|\| '', spot, requestedTakerId, fallbackTaker\);/, 'restart presentation must resolve a visible taker id');
  assert.match(engine, /if \(type === 'corner'\) this\.recordCornerPresentationEvent\(event, phase, spot, requestedTakerId, takerId, sourceEventSeq\);/, 'corner presentation must emit an audit row on setup and release');
  assert.match(engine, /this\.model\.players[\s\S]*?player\.team === team && player\.role !== 'GK' && this\.playerMeshes\.has\(player\.id\)[\s\S]*?Math\.hypot\(a\.pos\.x - spot\.x, a\.pos\.z - spot\.z\)/, 'corner fallback must choose a visible non-GK player near the flag');
  assert.match(engine, /while \(this\.cornerPresentationEvents\.length > 100\) this\.cornerPresentationEvents\.shift\(\);/, 'corner presentation audit log must stay bounded');
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
  assert.match(source, /restart\.type === 'goal_kick'\) return \{ x: restart\.spot\.x, y: BALL_GROUND_Y, z: restart\.spot\.z \}/, 'goal-kick setup must pin the ball on the ground at the restart spot');
  assert.match(source, /visual\.spriteGroup\.rotation\.set\(0, 0, -visual\.dir \* kickT \* 0\.28\)/, 'goal-kick release must visibly swing the keeper sprite');
});

test('V80 live telemetry surfaces goal-kick counters', () => {
  const source = readFileSync('src/components/LiveTelemetry.tsx', 'utf8');
  assert.match(source, /goalKicks: number/, 'live team stats must type goal-kick counters');
  assert.match(source, /\{ key: 'goalKicks', label: 'Goal Kicks' \}/, 'live telemetry table must render goal-kick counters');
});

test('V102 goalkick sim harness watches real ball_out restart events', () => {
  const source = readFileSync('scripts/goalkick-sim.mjs', 'utf8');
  assert.doesNotMatch(source, /restart_awarded/, 'goal-kick harness must not wait for a non-existent restart_awarded event');
  assert.match(source, /kind:\s*'ball_out'/, 'goal-kick harness must record the real ball_out state event');
  assert.match(source, /restartType:\s*model\.msm\.state\.restartType/, 'goal-kick harness must inspect the real restart type');
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/goalkick-sim.mjs', '--quiet'], { stdio: 'pipe' });
});

test('V103 backup game orchestrator AI timing uses the actual tick dt', () => {
  const source = readFileSync('model_backup/src/core/gameOrchestrator.ts', 'utf8');
  assert.match(source, /function buildRawBall\(dt: number\)/, 'raw ball previous-position estimate must receive the current tick dt');
  assert.match(source, /prevX: ball\.pos\.x - ball\.vel\.x \* dt/, 'ball previous X must use actual dt, not a fixed 60Hz step');
  assert.match(source, /prevZ: ball\.pos\.z - ball\.vel\.z \* dt/, 'ball previous Z must use actual dt, not a fixed 60Hz step');
  assert.match(source, /function buildBelief\(dt: number\)/, 'belief construction must receive the current tick dt');
  assert.match(source, /buildRawBall\(dt\),\s*dt,/s, 'belief state must pass actual dt into raw ball and player belief construction');
  assert.match(source, /tickGKController\(gkCtrl, playerBelief, belief, blackboard, dt\)/, 'goalkeeper controller timers must advance by actual dt');
  assert.match(source, /tickPlayerAI\(p, belief, blackboard, dt\)/, 'AI tick calls must pass actual dt through');
  assert.doesNotMatch(source, /0\.016/, 'backup orchestrator must not hardcode 60Hz AI timing');
});

test('V104 backup shot angle model uses the real field goal line', () => {
  const source = readFileSync('model_backup/src/ai/aiShotModel.ts', 'utf8');
  assert.match(source, /import \{ FIELD_W \} from ['"].*constants\.ts['"]/, 'shot angle model must import the field width constant');
  assert.match(source, /carrier\.team === 'A' \? FIELD_W \/ 2 : -FIELD_W \/ 2/, 'shot angle model must use actual goal-line X coordinates');
  assert.doesNotMatch(source, /carrier\.team === 'A' \? 60 : -60/, 'shot angle model must not use stale 120m pitch endpoints');
});

test('V108 backup orchestrator clean keeper claims emit one save only', () => {
  const orchestrator = readFileSync('model_backup/src/core/gameOrchestrator.ts', 'utf8');
  const controllerTest = readFileSync('model_backup/tests/newArchitectureController.test.ts', 'utf8');
  assert.match(orchestrator, /ball\.state === "attached" && prevBallState !== "attached" && ball\.ownerPlayerId/, 'save event should be tied to the ownership attach transition');
  assert.match(orchestrator, /events\.push\(\{ kind: "save", keeperId: keeper\.id \}\)/, 'backup orchestrator must still emit keeper save events');
  assert.doesNotMatch(orchestrator, /prevBallWasShot\s*&&\s*!ball\.isShot[\s\S]{0,260}kind: "save"/, 'shot-clear bookkeeping must not emit a second save');
  assert.match(controllerTest, /assert\.equal\(saves\.length, 1, 'clean keeper claim must emit exactly one save event'\)/, 'clean keeper claim regression must assert exactly one save');
  assert.match(controllerTest, /nextResult\.events\.filter\(\(event\) => event\.kind === 'save'\)\.length,[\s\S]*?0,[\s\S]*?'shot-clear bookkeeping after a keeper claim must not emit a second save'/, 'clean keeper claim regression must assert no save on the following tick');
});

test('V109 backup tackle resolution keeps defensive ratings live', () => {
  const orchestrator = readFileSync('model_backup/src/core/gameOrchestrator.ts', 'utf8');
  const ballPhysics = readFileSync('model_backup/src/core/ballPhysics.ts', 'utf8');
  assert.match(ballPhysics, /defensiveAwareness\?: number/, 'ball contact info must carry defensive awareness');
  assert.match(orchestrator, /defensiveAwareness: p\.ratings\.defensiveAwareness/, 'orchestrator must feed defensive awareness into contact resolution');
  assert.match(ballPhysics, /challenger\.standingTackle[\s\S]*?\* 0\.44[\s\S]*?challenger\.defending[\s\S]*?\* 0\.30[\s\S]*?challenger\.defensiveAwareness[\s\S]*?\* 0\.18/, 'tackle score must use standing tackle, defending, and defensive awareness');
  assert.match(ballPhysics, /const score = tackleSkill \+ speedPressure - holderControl \* 0\.72 - d \* 0\.32/, 'tackle outcome must use a score comparison rather than a flat capped chance');
  assert.doesNotMatch(ballPhysics + orchestrator, /skillEdge\s*=\s*\([^)]*\)\s*\/\s*400/, 'rating edge must not be compressed by the old /400 divisor');
  assert.doesNotMatch(ballPhysics + orchestrator, /Math\.(?:min|max)\(0\.10|,\s*0\.10\)/, 'tackle win chance must not be hard-capped at ten percent');
});

test('V110 backup simple offense derives offside risk buffer per candidate', () => {
  const source = readFileSync('model_backup/src/ai/simpleOffenseModel.ts', 'utf8');
  assert.match(source, /function getSimpleOffsideRiskBuffer\(player: SimpleOffensePlayer\)/, 'simple offense must centralize role-specific offside buffer calculation');
  assert.match(source, /const offsideRiskBuffer = getSimpleOffsideRiskBuffer\(teammate\);\s*if \(offside && progress > offsideRiskBuffer\) continue;/, 'primary pass loop must derive offside buffer from the current teammate');
  assert.match(source, /\.filter\(\(teammate\) => \{[\s\S]*?const offsideRiskBuffer = getSimpleOffsideRiskBuffer\(teammate\);[\s\S]*?isSimpleOffsideTarget\(carrier, teammate, opponents, attackSign\) && progress > offsideRiskBuffer/, 'fallback filter must derive offside buffer inside the current teammate callback');
  assert.doesNotMatch(source, /let offsideRiskBuffer[\s\S]*?for \(const teammate of teammates\)[\s\S]*?\.filter\(\(teammate\)/, 'fallback must not capture a stale offsideRiskBuffer from a previous teammate loop');
});

test('V111 backup structured attack preserves zero z side hint', () => {
  const source = readFileSync('model_backup/src/ai/structuredAttack.ts', 'utf8');
  const structuredTest = readFileSync('model_backup/tests/structuredAttack.test.ts', 'utf8');
  assert.match(source, /const zHint = carrier\.pos\.z !== 0 \? carrier\.pos\.z : \(carrier\.homePos\?\.z \?\? 0\);/, 'carrier side must treat z=0 as a real value and then consult homePos');
  assert.match(source, /const carrierSide = \(Math\.sign\(zHint\) \|\| 1\) as 1 \| -1;/, 'carrier side must derive from the explicit z hint');
  assert.doesNotMatch(source, /Math\.sign\(carrier\.pos\.z \|\| carrier\.homePos\?\.z \|\| 1\)/, 'carrier side must not use falsy || fallback on carrier.pos.z');
  assert.match(structuredTest, /central structured carrier uses home side hint without falsy z fallback/, 'structured attack tests must cover central z=0 side hint');
  assert.match(structuredTest, /assert\.equal\(state\.carrierSide, -1\)/, 'central z=0 regression must prove negative home-side hint is preserved');
});

test('V112 backup pattern engine uses Vec2-safe distance math', () => {
  const source = readFileSync('model_backup/src/ai/patternEngine.ts', 'utf8');
  const structuredTest = readFileSync('model_backup/tests/structuredAttack.test.ts', 'utf8');
  assert.match(source, /function distXZ\(a: any, b: any\): number \{\s*return Math\.hypot\(Number\(a\?\.x \?\? 0\) - Number\(b\?\.x \?\? 0\), Number\(a\?\.z \?\? 0\) - Number\(b\?\.z \?\? 0\)\);/s, 'pattern engine must expose plain Vec2-safe distance math');
  assert.doesNotMatch(source, /\.pos\.distanceTo\(/, 'pattern engine must not call THREE.Vector3 distanceTo on player positions');
  assert.match(source, /opponents\.filter\(\(opp\) => distXZ\(opp\.pos, carrier\.pos\) < 6\.5\)/, 'central pressure calculation must use distXZ');
  assert.match(source, /opponents\.filter\(\(opp\) => distXZ\(opp\.pos, carrier\.pos\) < 5\)/, 'patient buildup pressure calculation must use distXZ');
  assert.match(structuredTest, /pattern engine accepts plain Vec2 positions from orchestrator/, 'pattern tests must cover plain Vec2 positions');
});

test('V113 backup pattern outlet side fallback is explicit for missing homePos', () => {
  const source = readFileSync('model_backup/src/ai/patternEngine.ts', 'utf8');
  const structuredTest = readFileSync('model_backup/tests/structuredAttack.test.ts', 'utf8');
  assert.match(source, /const homeZ = player\.homePos\?\.z \?\? 0;/, 'outlet target must default missing homePos.z with nullish fallback');
  assert.match(source, /const offsetZ = carrierZ === 0 \? \(homeZ >= 0 \? 8 : -8\) : -Math\.sign\(carrierZ\) \* 10;/, 'center-carrier outlet side must compare the explicit homeZ value');
  assert.doesNotMatch(source, /player\.homePos\?\.z >= 0/, 'outlet target must not compare optional homePos.z directly because undefined >= 0 is false');
  assert.match(structuredTest, /pattern outlet target defaults missing home side deliberately for center carrier/, 'pattern tests must cover missing homePos with center carrier');
  assert.match(structuredTest, /assert\.equal\(target\.z, 8\)/, 'missing homePos center-carrier outlet regression must prove default side is positive');
});

test('V114 player animation frames do not schedule React renders per tick', () => {
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  assert.match(engine, /const allFrames = \[[\s\S]*?\.\.\.runFrames[\s\S]*?\.\.\.idleFrames[\s\S]*?\]/, 'active renderer must pre-mount player animation frame sets');
  assert.match(engine, /allFrames\.forEach\(\(frame\) => \{\s*frame\.visible = false;\s*spriteGroup\.add\(frame\);\s*\}\);/, 'active renderer must add all frames once and toggle visibility afterward');
  assert.match(engine, /visual\.allFrames\.forEach\(\(frame\) => \{ frame\.visible = false; \}\);/, 'active renderer must hide/show frame meshes directly');
  assert.match(engine, /frames\.forEach\(\(frame, i\) => \{ frame\.visible = i === visual\.frame; \}\);/, 'normal player animation must select frames by mesh visibility');
  assert.doesNotMatch(engine, /setDisplayFrame|displayFrame/, 'active player animation must not use React frame state');
  assert.doesNotMatch(engine, /useFrame\([\s\S]{0,240}set[A-Z][A-Za-z0-9_]*\(/, 'active player animation must not schedule React state from a render-frame callback');
});

test('V115 RetroFootball polling loop guards unchanged state setters', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  assert.match(source, /function shallowEqualRecord\(a: any, b: any\)/, 'polling guards must have a shallow equality helper for stats objects');
  assert.match(source, /function matchSnapshotRenderKey\(snapshot: any \| null\)/, 'polling guards must reduce match snapshots to a render key');
  assert.match(source, /const setSelectedPlayerIfChanged = \(next: any \| null\) => \{[\s\S]*?shallowEqualRecord\(selectedPlayerRef\.current, next\)[\s\S]*?setSelectedPlayer\(next\);[\s\S]*?\};/, 'selected player polling updates must be ref/equality guarded');
  assert.match(source, /const setSelectedDefensePlayerIfChanged = \(next: any \| null\) => \{[\s\S]*?shallowEqualRecord\(selectedDefensePlayerRef\.current, next\)[\s\S]*?setSelectedDefensePlayer\(next\);[\s\S]*?\};/, 'selected defense player polling updates must be ref/equality guarded');
  assert.match(source, /const setIsPausedIfChanged = \(next: boolean\) => \{[\s\S]*?isPausedRef\.current === next[\s\S]*?setIsPaused\(next\);[\s\S]*?\};/, 'pause polling updates must be ref/equality guarded');
  assert.match(source, /const setIsLiveIfChanged = \(next: boolean\) => \{[\s\S]*?isLiveRef\.current === next[\s\S]*?setIsLive\(next\);[\s\S]*?\};/, 'live polling updates must be ref/equality guarded');
  const pollingStart = source.indexOf('const interval = setInterval(() => {');
  const pollingEnd = source.indexOf('}, 100);', pollingStart);
  assert.ok(pollingStart > 0 && pollingEnd > pollingStart, 'RetroFootball polling interval should exist');
  const pollingBody = source.slice(pollingStart, pollingEnd);
  assert.match(pollingBody, /setMatchSnapshotIfChanged\(snapshot\)/, 'polling interval must guard snapshot updates');
  assert.match(pollingBody, /setSelectedPlayerIfChanged\(gameRef\.current\.getSelectedPlayerStats\(\)\)/, 'polling interval must guard selected player updates');
  assert.match(pollingBody, /setSelectedDefensePlayerIfChanged\(gameRef\.current\.getSelectedDefensePlayerStats\(\)\)/, 'polling interval must guard selected defense player updates');
  assert.match(pollingBody, /setIsPausedIfChanged\(/, 'polling interval must guard pause updates');
  assert.match(pollingBody, /setIsLiveIfChanged\(currentIsLive\)/, 'polling interval must guard live updates');
  assert.doesNotMatch(pollingBody, /set(?:SelectedPlayer|SelectedDefensePlayer|MatchSnapshot|IsLive|IsPaused)\(/, 'polling interval must not call high-frequency React setters directly');
});

test('V116 live telemetry render reuses memoized reversed logs', () => {
  const source = readFileSync('src/components/LiveTelemetry.tsx', 'utf8');
  assert.match(source, /import React, \{ useEffect, useMemo, useRef, useState \} from 'react';/, 'LiveTelemetry must import useMemo for derived log views');
  assert.match(source, /const reversedEventLog = useMemo\(\(\) => \[\.\.\.eventLog\]\.reverse\(\), \[eventLog\]\);/, 'event log reverse view must be memoized');
  assert.match(source, /const recentShotDecisions = useMemo\(\(\) => \[\.\.\.shotDecisions\]\.reverse\(\)\.slice\(0, 25\), \[shotDecisions\]\);/, 'shot decision reverse view must be memoized');
  assert.match(source, /const recentPassDecisions = useMemo\(\(\) => \[\.\.\.passDecisions\]\.reverse\(\)\.slice\(0, 25\), \[passDecisions\]\);/, 'pass decision reverse view must be memoized');
  assert.match(source, /reversedEventLog\.map\(/, 'render must consume memoized event log');
  assert.match(source, /recentShotDecisions\.map\(/, 'render must consume memoized shot decisions');
  assert.match(source, /recentPassDecisions\.map\(/, 'render must consume memoized pass decisions');
  assert.doesNotMatch(source, /slice\(\)\.reverse\(\)/, 'render should not allocate slice().reverse() views inline');
});

test('V117 RetroFootball shipping UI gates debug console output', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  assert.match(source, /function pslDebugLog\(\.\.\.args: unknown\[\]\)/, 'RetroFootball debug logging must go through a central helper');
  assert.match(source, /localStorage\.getItem\('psl\.debug'\) !== '1'/, 'debug logging must be opt-in through psl.debug');
  assert.match(source, /console\.info\(\.\.\.args\)/, 'opt-in debug helper may use console.info only after the guard');
  assert.doesNotMatch(source, /console\.log\(/, 'RetroFootball must not call console.log directly in shipping UI paths');
  assert.match(source, /pslDebugLog\('\[PSL-Bridge\] WebSocket connected:'/, 'dashboard bridge logs should use the gated helper');
  assert.match(source, /pslDebugLog\('\[PSL-Bridge\] posting tick='/, 'repeated bridge tick logs should use the gated helper');
});

test('V162 background tabs keep the model clock advancing without rendering catch-up', () => {
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  assert.match(engine, /private startBackgroundModelLoop\(\)/, 'engine must have a background model loop');
  assert.match(engine, /window\.setInterval\(\(\) => \{[\s\S]*?document\.hidden[\s\S]*?this\.advanceModel\(elapsed, false\);[\s\S]*?\}, 250\)/, 'hidden tabs must advance the model from wall-clock elapsed time without visual updates');
  assert.match(engine, /private advanceModel\(dt: number, updateVisuals: boolean\)[\s\S]*?const maxChunk = 0\.05;[\s\S]*?let remaining = Math\.min\(dt, 1\.25\);/, 'background catch-up must be capped and split into normal-sized model chunks');
  assert.match(engine, /if \(modelActive && !document\.hidden\) \{[\s\S]*?this\.advanceModel\(dt, true\);[\s\S]*?\}/, 'requestAnimationFrame must only advance model time while the document is visible');
  assert.match(engine, /window\.clearInterval\(this\.backgroundModelTimer\)/, 'background model interval must be cleaned up on dispose');
});

test('V118 main menu and pre-match controls expose keyboard-safe focus semantics', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  assert.match(source, /data-psl-custom-dropdown-button=\{dataSelect\}/, 'pre-match custom dropdown buttons must expose stable data markers');
  assert.match(source, /aria-haspopup="listbox"[\s\S]*?aria-expanded=\{isOpen\}[\s\S]*?aria-controls=\{listboxId\}/, 'pre-match custom dropdowns must expose expanded listbox semantics');
  assert.match(source, /className="flex w-full[\s\S]*?focus-visible:ring-2 focus-visible:ring-cyan-300/, 'pre-match custom dropdown buttons must have a visible focus ring');
  assert.match(source, /aria-label=\{`\$\{label\} team`\}/, 'main-menu team dropdowns must expose an accessible label');
  assert.match(source, /data-psl-menu-team-select=\{lowerLabel\}[\s\S]*?aria-haspopup="listbox"[\s\S]*?aria-expanded=\{isOpen\}/, 'main-menu team dropdowns must expose expanded listbox semantics');
  assert.match(source, /className="relative z-\[3\] h-full w-full[\s\S]*?focus-visible:ring-2 focus-visible:ring-lime-300/, 'main-menu team dropdowns must have a visible focus ring');
  assert.match(source, /function MenuModeButton[\s\S]*?<button\s+type="button"[\s\S]*?focus-visible:ring-2 focus-visible:ring-lime-300/, 'main-menu mode buttons must be non-submit buttons with visible focus rings');
  assert.match(source, /aria-expanded=\{lineupOpen\}/, 'lineup toggle must expose expanded state');
  assert.match(source, /aria-controls=\{`psl-lineup-panel-\$\{team\}`\}/, 'lineup toggle must point to the controlled panel');
  assert.match(source, /id=\{`psl-lineup-panel-\$\{team\}`\} data-psl-lineup-panel=\{team\}/, 'lineup panel must have a stable controlled id');
  assert.doesNotMatch(source, /setTimeout\([\s\S]{0,220}addEventListener/, 'outside-click handlers must not rely on delayed listener attachment races');
});

test('V119 pre-match setup modal has accessible dialog behavior', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  assert.match(source, /const dialogRef = useRef<HTMLDivElement>\(null\)/, 'pre-match modal must keep a dialog ref for focus management');
  assert.match(source, /role="dialog"[\s\S]*?aria-modal="true"[\s\S]*?aria-labelledby="prematch-title"/, 'pre-match modal container must expose dialog semantics');
  assert.match(source, /tabIndex=\{-1\}/, 'dialog container must be focusable as a fallback target');
  assert.match(source, /<h2 id="prematch-title"[\s\S]*?\[text-wrap:balance\][\s\S]*?>Pre-Match Setup<\/h2>/, 'dialog heading must label the modal and use balanced wrapping');
  assert.match(source, /event\.key === 'Escape'[\s\S]*?onClose\(\)/, 'pre-match modal must close on Escape');
  assert.match(source, /event\.key !== 'Tab'[\s\S]*?const focusable = Array\.from\(dialog\.querySelectorAll<HTMLElement>\(focusableSelector\)\)/, 'pre-match modal must trap Tab navigation inside focusable controls');
  assert.match(source, /document\.addEventListener\('keydown', handleKeyDown, true\)/, 'modal key handling must be attached in capture phase');
  assert.match(source, /document\.removeEventListener\('keydown', handleKeyDown, true\)/, 'modal key handling must clean up the capture listener');
  assert.match(source, /className="fixed inset-0[\s\S]*pointer-events-auto"/, 'modal backdrop must be clickable and not pointer-events-none');
  assert.match(source, /<span aria-hidden="true">⚽<\/span> Start Match/, 'decorative emoji in the start button must be hidden from screen readers');
  assert.doesNotMatch(source, /Pre-Match Setup[\s\S]{0,260}console\.log\(/, 'pre-match close path must not log to console');
  assert.doesNotMatch(source, /Randomize All/, 'removed randomize-all debug action must not return to pre-match setup');
});

test('V120 practice panel selects have labels and visible focus rings', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  assert.match(source, /const PRACTICE_SELECT_CLASSNAME = '[^']*focus-visible:ring-2[^']*focus-visible:ring-emerald-300/, 'practice selects must use a visible focus ring class');
  assert.match(source, /<label htmlFor="practice-setup-team-select"[\s\S]*?>Team<\/label>[\s\S]*?<select\s+id="practice-setup-team-select"[\s\S]*?className=\{`\$\{PRACTICE_SELECT_CLASSNAME\} text-xs px-2 py-2 border-white\/20`\}/, 'practice setup team select must be label-linked and use visible focus styling');
  assert.match(source, /<label htmlFor="practice-play-select"[\s\S]*?>Play<\/label>[\s\S]*?<select\s+id="practice-play-select"[\s\S]*?className=\{PRACTICE_SELECT_CLASSNAME\}/, 'practice play select must be label-linked and use visible focus styling');
  assert.match(source, /<label htmlFor="practice-formation-select"[\s\S]*?>Formation<\/label>[\s\S]*?<select\s+id="practice-formation-select"[\s\S]*?className=\{PRACTICE_SELECT_CLASSNAME\}/, 'practice formation select must be label-linked and use visible focus styling');
  assert.match(source, /<label htmlFor="practice-aggressiveness-select"[\s\S]*?>Aggressiveness<\/label>[\s\S]*?<select\s+id="practice-aggressiveness-select"[\s\S]*?className=\{PRACTICE_SELECT_CLASSNAME\}/, 'practice aggressiveness select must be label-linked and use visible focus styling');
  assert.match(source, /<button\s+type="button"[\s\S]*?setPracticeIsHuman\(true\)/, 'practice Human toggle must be an explicit non-submit button');
  assert.match(source, /<button\s+type="button"[\s\S]*?setPracticeIsHuman\(false\)/, 'practice CPU toggle must be an explicit non-submit button');
});

test('desktop options expose fixed window resolution presets and Tauri window is non-resizable', () => {
  const retro = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  const tauriConfig = readFileSync('src-tauri/tauri.conf.json', 'utf8');
  const pkg = readFileSync('package.json', 'utf8');
  assert.match(retro, /type WindowResolutionPreset = '1280x720' \| '1366x768' \| '1600x900' \| '1920x1080'/, 'resolution presets must be explicit and bounded');
  assert.match(retro, /const WINDOW_RESOLUTION_STORAGE_KEY = 'psl\.windowResolution'/, 'resolution selection must persist through a stable storage key');
  assert.match(retro, /@tauri-apps\/api\/window/, 'desktop resolution control must use the Tauri window API');
  assert.match(retro, /await currentWindow\.setSize\(new LogicalSize\(next\.width, next\.height\)\)/, 'resolution selector must resize the Tauri window to the chosen preset');
  assert.match(retro, /Current: \{WINDOW_RESOLUTION_PRESETS\.find/, 'options panel must show the current resolution preset');
  assert.match(tauriConfig, /"resizable": false/, 'desktop window must not be freely resizable');
  assert.match(tauriConfig, /"maximizable": false/, 'desktop window must not expose maximize when using fixed presets');
  assert.match(tauriConfig, /"width": 1600/, 'desktop window should default to the selected fixed-width baseline');
  assert.match(tauriConfig, /"height": 900/, 'desktop window should default to the selected fixed-height baseline');
  assert.match(pkg, /"@tauri-apps\/api": "\^2\./, 'desktop resolution selector must ship the Tauri JS API dependency');
});

test('live telemetry keeps hook order stable before match data arrives', () => {
  const source = readFileSync('src/components/LiveTelemetry.tsx', 'utf8');
  const guardIndex = source.indexOf('if (!data) {');
  const eventMemoIndex = source.indexOf('const reversedEventLog = useMemo(() => [...eventLog].reverse(), [eventLog]);');
  const shotMemoIndex = source.indexOf('const recentShotDecisions = useMemo(() => [...shotDecisions].reverse().slice(0, 25), [shotDecisions]);');
  const passMemoIndex = source.indexOf('const recentPassDecisions = useMemo(() => [...passDecisions].reverse().slice(0, 25), [passDecisions]);');
  assert.ok(eventMemoIndex >= 0 && eventMemoIndex < guardIndex, 'event log memo hook must run before the empty-data return');
  assert.ok(shotMemoIndex >= 0 && shotMemoIndex < guardIndex, 'shot-decision memo hook must run before the empty-data return');
  assert.ok(passMemoIndex >= 0 && passMemoIndex < guardIndex, 'pass-decision memo hook must run before the empty-data return');
  assert.match(source, /const eventLog = data\?\.eventLog \?\? \[\];/, 'live telemetry must normalize event logs before memoized derived views');
  assert.match(source, /const shotDecisions = data\?\.shotDecisions \?\? \[\];/, 'live telemetry must normalize shot decisions before memoized derived views');
  assert.match(source, /const passDecisions = data\?\.passDecisions \?\? \[\];/, 'live telemetry must normalize pass decisions before memoized derived views');
});

test('V258 desktop menu, stats, manual controls, and corner ownership remain playable', () => {
  const retro = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  const model = readFileSync('src/core/simpleMatchModel.ts', 'utf8');
  assert.match(retro, /z-50 overflow-y-auto overflow-x-hidden/, 'main menu must scroll instead of clipping at default desktop resolution');
  assert.match(retro, /max-h-\[18vh\] object-contain/, 'main-menu title art must scale within the viewport');
  assert.match(retro, /Number\(p\.stats\?\.speed \?\? 0\)\.toFixed\(2\)/, 'Stats must tolerate incomplete player records');
  assert.match(retro, /PASS — HOLD TO CHARGE[\s\S]*?SHOOT — HOLD TO CHARGE[\s\S]*?TACKLE \(WHEN DEFENDING\)/, 'How to Play must document charged pass, shoot, and tackle controls');
  assert.match(engine, /manualSelectedPlayerRing/, 'manual play must render a selected-player ring');
  assert.match(engine, /startKickoffPresentation[\s\S]{0,400}?this\.splashMusicStop\(\);/, 'kickoff must stop the splash theme');
  assert.match(engine, /private applyPausedAudio\(\)[\s\S]{0,400}?ctx\.suspend\(\)/, 'pause must suspend the audio context so looping crowd/ambience stops too');
  assert.match(engine, /ctx\.state === 'suspended' && !this\.paused/, 'audio nodes must not auto-resume a paused context');
  assert.doesNotMatch(engine, /startMatchMusic/, 'kickoff must not restart the theme as match music -- crowd ambience carries live play');
  assert.match(engine, /triggerManualTackle\('A'\)/, 'home player must have a tackle input');
  assert.match(engine, /triggerManualTackle\('B'\)/, 'away player must have a tackle input');
  assert.match(model, /triggerManualTackle\(team: SimpleTeamCode\)/, 'model must expose manual tackle resolution');
  assert.match(model, /direction\?: Vec2/, 'manual pass target options must support aim direction');
  assert.match(model, /const attackingTeam: SimpleTeamCode \| null = goalLine/, 'goal-line restart ownership must derive from the attacking end');
});

test('V255 practice mode redraws routes after kickoff reset and engine tracks active state', () => {
  const source = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  assert.match(source, /gameRef\.current\?\.setPracticeMode\?\.\(isPractice\);/, 'practice kickoff must enable practice mode in the engine');
  assert.match(source, /const isHumanPractice = practiceIsHuman;/, 'practice begin must capture the current human/CPU selection before kickoff');
  assert.match(source, /gameRef\.current\?\.setCpuVsCpu\?\.\(!isHumanPractice\);/, 'practice begin must explicitly set cpuVsCpu from the selected control mode');
  assert.doesNotMatch(source, /setTimeout\(\(\) => \{[\s\S]*?if \(!practiceIsHuman\) gameRef\.current\?\.setCpuVsCpu\?\.\(true\);[\s\S]*?\}, 600\)/s, 'practice begin must not rely on a delayed cpuVsCpu toggle');
  assert.match(source, /const shouldAutoStart = !practiceIsHuman;/, 'practice play selection must derive an explicit human/manual start flag');
  assert.match(source, /if \(practiceIsHuman\) gameRef\.current\?\.setPaused\?\.\(true\);/, 'human practice must pause instead of auto-starting the selected play');
  assert.match(source, /practiceIsHuman && selectedPracticePlay && !practiceActive[\s\S]*?<button[\s\S]*?>\s*Start Play\s*<\/button>/s, 'human practice must expose an explicit Start Play button instead of auto-starting the drill');
  assert.match(source, /applyPracticePlay\(gameRef, play, play\.formation, practiceAggressiveness, shouldAutoStart\);/, 'practice play must route through a reusable helper that can suppress auto-start');
  assert.match(engine, /private practiceModeEnabled = false;/, 'engine must track practice mode enablement');
  assert.match(engine, /private practicePlayActive = false;/, 'engine must track practice play active state');
  assert.match(engine, /setPracticeMode = \(enabled: boolean\) => \{[\s\S]*?this\.practiceModeEnabled = !!enabled;[\s\S]*?if \(!this\.practiceModeEnabled\) \{[\s\S]*?this\.deactivatePracticePlay\(\);[\s\S]*?\}/m, 'engine must enable/disable practice cleanup');
  assert.match(engine, /drawPracticeRoutes = \(routes: unknown\) => \{[\s\S]*?this\.practiceRouteGroup\.visible = this\.practiceRouteVisuals\.length > 0;/m, 'practice routes must render through a real route group');
  assert.match(engine, /resetAndStartPracticePlay = \(redraw\?: \(\) => void\) => \{[\s\S]*?this\.deactivatePracticePlay\(\);[\s\S]*?this\.startKickoffPresentation\(true\);[\s\S]*?window\.requestAnimationFrame\(run\)/s, 'practice kickoff reset must redraw after the kickoff snapshot');
  assert.match(engine, /isPracticePlayActive = \(\) => this\.practiceModeEnabled && this\.practicePlayActive/, 'practice active badge must reflect engine state');
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

test('dashboard match overview scales KPI expectations by runtime length', () => {
  const source = readFileSync('public/dashboard.html', 'utf8');
  assert.match(source, /function getMatchDurationInfo/, 'dashboard should derive match duration from duration metadata');
  assert.match(source, /metadata\?\.runtimeHalfDuration/, 'dashboard should prefer runtime half duration over simulated half duration');
  assert.match(source, /runtimeMinutes/, 'dashboard should label selected half length as runtime, not simulated soccer duration');
  assert.match(source, /durationFactor: runtimeMinutes \/ 90/, 'dashboard must scale KPI expectations by selected runtime length');
  assert.match(source, /Runtime-scaled expected raw totals/, 'overview copy must include runtime-scaled raw expectations');
  assert.match(source, /Shots \/ SOT raw/, 'overview must label raw shot totals');
  assert.match(source, /Shots \/ SOT runtime-scaled expected raw totals/, 'overview copy must compare shots to runtime-scaled expectations');
  assert.match(source, /Completed passes runtime-scaled expected raw total/, 'overview copy must compare completed passes to runtime-scaled expectations');
  assert.match(source, /Passes runtime-scaled expected raw total/, 'overview copy must compare passes to runtime-scaled expectations');
  assert.doesNotMatch(source, /per90|per 90/i, 'dashboard must not treat short matches as compressed 90-minute projections');
  assert.match(source, /metric === 'shotsOnTarget' && value < expected\.min \* 0\.5/, 'dashboard must fail, not watch, extremely low runtime-scaled SOT volume');
  assert.match(source, /statCard\('Runtime'/, 'overview cards must show runtime duration');
  assert.match(source, /statCard\('Runtime KPI'/, 'overview cards must show runtime KPI ranges');
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

test('V52 telemetry tools scale KPI thresholds by runtime length', () => {
  const simpleKpi = readFileSync('scripts/simple-model-kpi.mjs', 'utf8');
  const analyzer = readFileSync('scripts/telemetry-analyze-latest.mjs', 'utf8');

  assert.match(simpleKpi, /function simulationThresholds/, 'simple KPI guard must build runtime-scaled thresholds');
  assert.match(simpleKpi, /simulatedMinutes: 90/, 'simple KPI report must distinguish runtime from simulated match length');
  assert.match(simpleKpi, /durationFactor: runtimeMinutes \/ 90/, 'simple KPI guard must scale raw stat targets by runtime length');
  assert.match(analyzer, /function getBundleDurationInfo/, 'telemetry analyzer must derive duration from bundle metadata');
  assert.match(analyzer, /durationFactor: matchSeconds \/ \(90 \* 60\)/, 'telemetry analyzer must scale baseline expectations by runtime length');
  assert.match(analyzer, /runtime-scaled raw stat fit/, 'telemetry output must disclose runtime-scaled baseline comparisons');
  assert.match(analyzer, /Runtime-scaled attacking volume is too low/, 'analyzer must recommend action when matches underproduce runtime-scaled shots');
  assert.match(analyzer, /Runtime-scaled shot-on-target volume is too low/, 'analyzer must recommend action when matches underproduce runtime-scaled SOT');
  assert.match(analyzer, /Runtime-scaled pass volume is too low/, 'analyzer must recommend action when matches underproduce runtime-scaled passes');
});

test('V141 simple KPI guard reports per-match scoring and shot outliers', () => {
  const simpleKpi = readFileSync('scripts/simple-model-kpi.mjs', 'utf8');
  assert.match(simpleKpi, /maxGoalsInMatch/, 'simple KPI guard must expose max goals in any sampled match');
  assert.match(simpleKpi, /maxShotsInMatch/, 'simple KPI guard must expose max shots in any sampled match');
  assert.match(simpleKpi, /maxShotsOnTargetInMatch/, 'simple KPI guard must expose max SOT in any sampled match');
});

test('V169 telemetry analyzer counts simple-model forced shot reasons', () => {
  const analyzer = readFileSync('scripts/telemetry-analyze-latest.mjs', 'utf8');
  assert.match(analyzer, /function isForcedShotDecision\(decision\)/, 'forced shot classification must be centralized');
  assert.match(analyzer, /selectionType\.includes\('forced'\)/, 'forced shot types must include model-specific forced selections');
  assert.match(analyzer, /reason\.includes\('FORCED_SHOT'\)/, 'forced shot reasons must include STRIKER_PENALTY_AREA_FORCED_SHOT');
  assert.match(analyzer, /reason\.includes\('NO_OUTLET_SHOT'\)/, 'forced shot reasons must include penalty-area no-outlet shots');
});

test('V174 telemetry analyzer falls back to shotDecisions for shot box defense', () => {
  const analyzer = readFileSync('scripts/telemetry-analyze-latest.mjs', 'utf8');
  assert.match(analyzer, /function summarizeShotBoxDefense\(events, bundle = null\)/, 'shot box defense summary must receive the full bundle');
  assert.match(analyzer, /const shotDecisions = Array\.isArray\(bundle\?\.shotDecisions\)/, 'shot box defense must inspect durable shot decisions');
  assert.match(analyzer, /shotDecisionDefenseRows\.length > snapshots\.length/, 'shot decisions must be used when snapshot events are missing or partially capped out');
  assert.match(analyzer, /source: 'shotDecisions'/, 'fallback samples must identify shotDecision source');
  assert.match(analyzer, /shotBoxDefense: summarizeShotBoxDefense\(events, bundle\)/, 'report builder must pass the bundle into shot box defense summary');
});

test('V179 telemetry analyzer preserves persisted free-kick restart counters', () => {
  const analyzer = readFileSync('scripts/telemetry-analyze-latest.mjs', 'utf8');
  assert.match(analyzer, /byTeam\.A\.freeKicks = Number\(bundleA\.freeKicks \?\? 0\)/, 'restart summary must read home free-kick counters from the persisted bundle');
  assert.match(analyzer, /byTeam\.B\.freeKicks = Number\(bundleB\.freeKicks \?\? 0\)/, 'restart summary must read away free-kick counters from the persisted bundle');
  assert.match(analyzer, /freeKicks: byTeam\.A\.freeKicks \+ byTeam\.B\.freeKicks/, 'reported total free kicks must use the per-team restart counters');
  const dashboard = readFileSync('public/dashboard.html', 'utf8');
  assert.match(dashboard, /Free kicks bar: \$\{a\.freeKicks\|\|0\} .* \$\{b\.freeKicks\|\|0\}/, 'copied match overview must include free-kick counters');
  assert.match(dashboard, /compBar\('Free Kicks', a\.freeKicks \|\| 0, b\.freeKicks \|\| 0, 'Free Kicks'\)/, 'dashboard overview bars must render free-kick counters');
});

test('the control reference is single-sourced and matches the real bindings', () => {
  // Review caught the settings CONTROLS tab advertising Shift+G for the lob and
  // Space for switching players, long after those became C and V, with the
  // second player's lob missing entirely. It kept its own hand-written copy of
  // the bindings. Both surfaces read PauseOverlay now; this pins that, and pins
  // every documented key to a handler that actually exists.
  const overlay = readFileSync('src/components/PauseOverlay.tsx', 'utf8');
  const shell = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  const engine = readFileSync('src/gameEngine.ts', 'utf8');

  assert.match(shell, /<ControlReference \/>/, 'settings must render the shared reference');
  for (const stale of ['Keyboard (Home)', 'Keyboard (Away)', 'Shift+G</span>']) {
    assert.ok(!shell.includes(stale), `settings must not hand-roll bindings again: found "${stale}"`);
  }

  const rows = (table: string) => {
    const body = overlay.slice(overlay.indexOf(`${table}: PadLabel[] = [`));
    return [...body.slice(0, body.indexOf('];')).matchAll(/key: (?:'([^']*)'|"([^"]*)")/g)]
      .map((m) => m[1] ?? m[2]);
  };
  // Display label -> the KeyboardEvent codes the engine must handle.
  const CODES: Record<string, string[]> = {
    'W A S D': ['KeyW', 'KeyA', 'KeyS', 'KeyD'],
    'Left Shift': ['ShiftLeft'],
    'Space / G': ['Space', 'KeyG'],
    C: ['KeyC'],
    F: ['KeyF'],
    R: ['KeyR'],
    'Q / E': ['KeyQ', 'KeyE'],
    V: ['KeyV'],
    // A `~` prefix means the engine matches this by pattern, not as a literal
    // key code -- the digits are bound with /^Digit[1-4]$/.
    '1 - 4': ['~Digit[1-4]'],
    'Numpad 1 - 4': ['~Numpad[1-4]'],
    'Arrow keys': ['ArrowUp', 'ArrowLeft'],
    'Right Shift': ['ShiftRight'],
    ',': ['Comma'],
    ';': ['Semicolon'],
    '.': ['Period'],
    '/': ['Slash'],
    '[ / ]': ['BracketLeft', 'BracketRight'],
    "'": ['Quote'],
  };
  for (const table of ['KEYBOARD_P1', 'KEYBOARD_P2']) {
    const keys = rows(table);
    assert.ok(keys.length >= 8, `${table} should document the full keyboard layout, got ${keys.length}`);
    for (const key of keys) {
      const codes = CODES[key];
      assert.ok(codes, `${table} documents "${key}" with no known key code — update this map`);
      for (const code of codes) {
        const needle = code.startsWith('~') ? code.slice(1) : `'${code}'`;
        assert.ok(engine.includes(needle), `${table} advertises ${key}, but the engine never handles ${code}`);
      }
    }
  }

  // The lob charges now, so both players' entries must say so.
  for (const table of ['KEYBOARD_P1', 'KEYBOARD_P2', 'FACE_BUTTONS']) {
    const body = overlay.slice(overlay.indexOf(`${table}: PadLabel[] = [`));
    const lob = body.slice(0, body.indexOf('];')).split('\n').find((line) => /Lob|Chip/i.test(line));
    assert.ok(lob, `${table} must list the lob`);
    assert.match(lob!, /hold to charge/, `${table} must say the lob charges`);
  }
});

test('public assets resolve against the deployment base, not the site root', () => {
  // The GitHub Pages project site serves from /<repo>/, so a root-absolute
  // "/kick.mp3" 404s there while working fine on the dev server and under
  // Tauri's asset protocol -- a silent failure that only shows as missing
  // audio. Everything goes through assetUrl(), which prefixes BASE_URL.
  const sources = ['src/gameEngine.ts', 'src/components/RetroFootball.tsx',
    'src/components/SeasonHub.tsx', 'src/components/WorldCupHub.tsx'];
  const absolute = /(['"`])\/[^'"`\n]*\.(?:mp3|wav|ogg|png|jpg|jpeg|svg|ttf|woff2?)\1/g;
  for (const file of sources) {
    const text = readFileSync(file, 'utf8');
    const stray = [...text.matchAll(absolute)]
      // assetUrl('/kick.mp3') is the correct form; the literal inside it is fine.
      .filter((match) => !text.slice(Math.max(0, match.index - 10), match.index).includes('assetUrl('));
    assert.deepEqual(
      stray.map((match) => match[0]),
      [],
      `${file} has root-absolute asset paths; wrap them in assetUrl() or they 404 under a Pages subpath`,
    );
  }

  // Literal scanning alone missed the flags: getWorldCupTeamFlagAsset builds
  // its path from a template, so no literal appeared anywhere and all 49
  // bundled flags would have 404'd on the project site. Check the generated
  // value resolves too, by running the real builder.
  const flagPath = getWorldCupTeamFlagAsset('Brazil');
  assert.ok(flagPath, 'Brazil should resolve to a bundled flag');
  assert.ok(flagPath.startsWith('/assets/flags/'), `unexpected flag path ${flagPath}`);
  assert.equal(
    assetUrl(flagPath),
    flagPath,
    'with no deployment base the flag path is unchanged, so wrapping it is safe',
  );
  const shell = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  // Count both sides: matching once would pass with a second call site left
  // unwrapped, which is how the flags slipped through the literal scan.
  const builders = shell.match(/getWorldCupTeamFlagAsset\(/g)?.length ?? 0;
  const wrapped = shell.match(/assetUrl\(flagRelative\)/g)?.length ?? 0;
  assert.ok(builders > 0, 'expected the shell to render flags');
  assert.equal(
    wrapped,
    builders,
    `${builders} flag lookups but ${wrapped} resolved against the base; unwrapped flags 404 under a subpath`,
  );

  const helper = readFileSync('src/assetUrl.ts', 'utf8');
  assert.match(helper, /import\.meta[\s\S]{0,80}?BASE_URL/, 'assetUrl must resolve against the vite base');

  const viteConfig = readFileSync('vite.config.ts', 'utf8');
  assert.match(viteConfig, /base: process\.env\.PSL_PAGES_BASE \|\| '\/'/, 'only the Pages build may set a non-root base');
});

test('a team highlight is never white, so it cannot vanish into a light panel', () => {
  // Reported from play: UI elements with a white background make a white team
  // colour invisible. The live scoreboard is bg-white with black text, and the
  // raw shirt colour was handed straight to it -- United States, England and
  // Germany all play in #ffffff.
  const shell = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  const body = shell.slice(shell.indexOf('function getTeamColor('));
  const fn = body.slice(0, body.indexOf('\n}\n'));
  assert.match(fn, /luminance/i, 'the highlight must be luminance-limited');
  assert.match(fn, /MAX_UI_LUMINANCE/, 'and the limit should be named');

  // The scoreboard that consumes it really is white, so the limit matters.
  assert.match(shell, /data-psl-scoreboard="live"[\s\S]{0,400}?bg-white/, 'the live scoreboard is a light panel');

  // Mirror of the shipped clamp: white must come out readable, hues preserved.
  const clamped = (hex: number) => {
    let r = (hex >> 16) & 255;
    let g = (hex >> 8) & 255;
    let b = hex & 255;
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (luminance > 0.5) {
      const scale = 0.5 / luminance;
      r = Math.round(r * scale);
      g = Math.round(g * scale);
      b = Math.round(b * scale);
    }
    return { r, g, b };
  };
  const white = clamped(0xffffff);
  assert.ok(white.r < 200 && white.g < 200 && white.b < 200, `white must be darkened, got ${JSON.stringify(white)}`);
  const mexicoGreen = clamped(0x006847);
  assert.deepEqual(mexicoGreen, { r: 0, g: 0x68, b: 0x47 }, 'a colour that already reads must be left alone');
});

test('reclassifying a tackle as a block keeps it visible, audible and counted', () => {
  // Review on #10: box containment was recorded as a TACKLE and is a BLOCK
  // now. The rename alone made 68 events a match disappear from the snapshot,
  // the exports, the dashboard stream, and the pitch -- having just spent the
  // session making defensive work visible.
  const engine = readFileSync('src/gameEngine.ts', 'utf8');
  assert.match(engine, /case 'BLOCK':/, 'a block needs a sound, as it had when it was a tackle');
  assert.match(engine, /event\.action === 'BLOCK'[\s\S]{0,80}?spawnEventCue/, 'and a ring on the pitch');

  const model = readFileSync('src/core/simpleMatchModel.ts', 'utf8');
  assert.match(model, /blocksA: this\.teamA\.blocks/, 'blocks must reach the match snapshot');
  assert.match(model, /blocks: st\.blocks/, 'and each player export row');
  assert.equal(
    (model.match(/blocks: stats\.blocks/g) ?? []).length,
    2,
    'both team mappings must carry blocks, or the reduced tackle total has no replacement',
  );

  // The dashboard filters out any type it does not list, so a missing BLOCK
  // hides those events even with ALL selected.
  const dashboard = readFileSync('public/dashboard.html', 'utf8');
  const lists = dashboard.match(/\['PASS','SHOT','TACKLE'[^\]]*\]/g) ?? [];
  assert.ok(lists.length >= 3, `expected the three event-type lists, found ${lists.length}`);
  for (const list of lists) {
    assert.ok(list.includes("'BLOCK'"), `event list is missing BLOCK: ${list}`);
  }
});
