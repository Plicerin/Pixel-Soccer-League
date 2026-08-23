import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('World Cup mode uses a dedicated hub instead of the season shell', () => {
  const retro = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  const hub = readFileSync('src/components/WorldCupHub.tsx', 'utf8');

  assert.match(retro, /import WorldCupHub from '\.\/WorldCupHub';/);
  assert.doesNotMatch(retro, /<SeasonHub/);
  assert.match(retro, /<WorldCupHub/);

  assert.match(hub, /World Cup Mode/);
  assert.match(hub, /Knockout Bracket/);
  assert.match(hub, /Group Tables/);
  assert.match(hub, /Start World Cup as/);
});

test('world cup browser smoke harness is wired through the existing Playwright CDP stack', () => {
  const pkg = readFileSync('package.json', 'utf8');
  const script = readFileSync('scripts/worldcup-browser-smoke.mjs', 'utf8');
  const retro = readFileSync('src/components/RetroFootball.tsx', 'utf8');
  const hub = readFileSync('src/components/WorldCupHub.tsx', 'utf8');

  assert.match(pkg, /"sim:worldcup": "node scripts\/worldcup-browser-smoke\.mjs"/);
  assert.match(script, /import \{ chromium \} from 'playwright-core'/);
  assert.match(script, /const STORAGE_KEY = 'psl_world_cup'/);
  assert.match(script, /__pslUiTest\?\.openWorldCupMode/);
  assert.match(script, /__pslWorldCupTest\?\.snapshot/);
  assert.match(retro, /__pslUiTest = \{/);
  assert.match(retro, /openWorldCupMode: \(team\?: string\) => \{/);
  assert.match(hub, /__pslWorldCupTest = \{/);
  assert.match(script, /World Cup Mode/);
  assert.match(script, /__pslWorldCupTest\?\.simRound/);
  assert.match(script, /__pslWorldCupTest\?\.advance/);
  assert.match(script, /Champion:/);
});

test('headless sim waits for fixture runner completion and budgets tuning runs beyond five minutes', () => {
  const script = readFileSync('scripts/headless-sim.mjs', 'utf8');

  assert.match(script, /function computeFixtureRuntimeTimeoutMs\(halfSeconds, speed\)/);
  assert.match(script, /options\.timeoutMs = Math\.ceil\(options\.games \* perGameTimeoutMs \+ 60_000\)/);
  assert.match(script, /async function waitForFixtureCompletion\(page, timeoutMs = 600000, visualAuditRecorder = null, gameIndex = 0\)/);
  assert.match(script, /const fixtureResult = await waitForFixtureCompletion\(page, Math\.min\(getMatchWaitTimeoutMs\(options\), remainingForMatch\), visualAuditRecorder, i \+ 1\)/);
  assert.match(script, /if \(fixtureResult\.timedOut\) \{/);
});

test('world cup stage view keeps header actions responsive on narrow screens', () => {
  const hub = readFileSync('src/components/WorldCupHub.tsx', 'utf8');

  assert.match(hub, /overflow-x-hidden/);
  assert.match(hub, /flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:gap-4/);
  assert.match(hub, /flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end/);
  assert.match(hub, /max-w-6xl/);
  assert.match(hub, /break-words/);
  assert.match(hub, /min-w-\[760px\]/);
  assert.match(hub, /Save PNG/);
  assert.match(hub, /data-export-ignore="true"/);
  assert.match(hub, /handleExportScreenshot/);
  assert.match(hub, /exportElementAsPng/);
  assert.match(hub, /World Champions/);
  assert.match(hub, /Golden Boot/);
  assert.match(hub, /Big Final/);
  assert.match(hub, /Third Place Playoff/);
  assert.match(hub, /getWorldCupTeamFlag/);
});
