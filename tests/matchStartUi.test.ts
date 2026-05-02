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
