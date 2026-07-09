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

test('world cup stage view keeps header actions responsive on narrow screens', () => {
  const hub = readFileSync('src/components/WorldCupHub.tsx', 'utf8');

  assert.match(hub, /overflow-x-hidden/);
  assert.match(hub, /flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:gap-4/);
  assert.match(hub, /flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end/);
});
