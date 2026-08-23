import test from 'node:test';
import assert from 'node:assert/strict';

import { selectGoalActor, shouldAwardGoalCrossing } from '../src/ai/goalValidation.ts';

test('V17 non-shot goal crossings are blocked until explicit own-goal classification exists', () => {
  assert.equal(shouldAwardGoalCrossing('B', false, []), false);
  assert.equal(
    shouldAwardGoalCrossing('B', false, [{ player: { name: 'runner' }, team: 'B', goalkeeper: false }]),
    false,
  );
});

test('V17 shot goals are still awardable when scorer context is missing', () => {
  assert.equal(shouldAwardGoalCrossing('A', true, []), true);
});

test('V17 goal actor selection prefers scoring team but allows own-goal context', () => {
  const ownGoalActor = { name: 'defender' };
  assert.equal(
    selectGoalActor('A', [{ player: ownGoalActor, team: 'B', goalkeeper: false }]),
    ownGoalActor,
  );
});
