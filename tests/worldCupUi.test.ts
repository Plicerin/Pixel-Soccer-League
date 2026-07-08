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
