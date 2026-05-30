import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('V121 browser-loadable infinite free-play script locks time and score', () => {
  const source = readFileSync('public/infinite-game.js', 'utf8');
  const alias = readFileSync('public/ig.js', 'utf8');

  assert.ok(source.startsWith(';'), 'script must begin with a semicolon so inline/console paste cannot call a prior expression');
  assert.match(source, /;var s=document\.createElement\("script"\);s\.src="\/infinite-game\.js\?cache="\+Date\.now\(\);document\.head\.appendChild\(s\)/, 'script header must document the safest console loader');
  assert.match(alias, /script\.src = '\/infinite-game\.js\?cache=' \+ Date\.now\(\)/, 'short alias must load the full helper with cache busting');
  assert.match(alias, /window\.pslInfiniteGame/, 'short alias must reuse an already-loaded helper');
  assert.match(source, /window\.pslInfiniteGame = api/, 'script must expose a browser console API');
  assert.match(source, /async function start\(options = \{\}\)/, 'script must provide a start function');
  assert.match(source, /function stop\(\)/, 'script must provide a reversible stop function');
  assert.match(source, /Number\.MAX_SAFE_INTEGER \/ 1000/, 'script must use a practical infinite half duration');
  assert.match(source, /model\.msm\.clock\.halfDuration = INFINITE_HALF_SECONDS/, 'script must harden the model clock against full time');
  assert.match(source, /model\.msm\.score\.home = 0[\s\S]*model\.msm\.score\.away = 0/, 'script must lock model score at 0-0');
  assert.match(source, /game\.model\.step = function patchedInfiniteStep/, 'script must enforce the override after every model step');
  assert.match(source, /snapshot\.phase === 'FULL_TIME' \? 'LIVE_PLAY'/, 'script must sanitize full-time snapshots');
  assert.match(source, /\[data-psl-scoreboard="live"\]/, 'script must hide the React scoreboard when scoreless mode is active');
  assert.match(source, /\[data-psl-scoreboard="engine-live"\]/, 'script must hide the engine scoreboard when scoreless mode is active');
  assert.match(source, /start\(\)\.catch/, 'loading the script should auto-start unless manual mode is requested');
});
