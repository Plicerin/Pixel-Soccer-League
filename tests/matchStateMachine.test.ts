import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceMatchState, createMatchStateMachine } from '../src/core/matchStateMachine';

test('V203 watched-match dead-ball presentation does not consume simulated clock', () => {
  let msm = createMatchStateMachine(2700);
  msm = advanceMatchState(msm, 0, null, null);

  assert.equal(msm.state.kind, 'kickoff');
  assert.equal(msm.clock.elapsedInHalf, 0);

  msm = advanceMatchState(msm, 0.25, null, null, 0.25);
  assert.equal(msm.state.kind, 'kickoff');
  assert.equal(msm.clock.elapsedInHalf, 0);

  msm = advanceMatchState(msm, 0.25, null, null, 0.25);
  assert.equal(msm.state.kind, 'live_play');
  assert.equal(msm.clock.elapsedInHalf, 0);

  msm = advanceMatchState(msm, 1, { restartType: 'throw_in', restartTeam: 'home' }, null, 1);
  assert.equal(msm.state.kind, 'ball_out');
  assert.equal(msm.clock.elapsedInHalf, 1);

  msm = advanceMatchState(msm, 1, null, null, 1);
  assert.equal(msm.state.kind, 'ball_out');
  assert.equal(msm.clock.elapsedInHalf, 1);

  msm = advanceMatchState(msm, 1, null, null, 1);
  assert.equal(msm.state.kind, 'live_play');
  assert.equal(msm.clock.elapsedInHalf, 1);

  msm = advanceMatchState(msm, 1, null, { scoringTeam: 'home' }, 1);
  assert.equal(msm.state.kind, 'goal_scored');
  assert.equal(msm.clock.elapsedInHalf, 2);

  msm = advanceMatchState(msm, 1, null, null, 1);
  assert.equal(msm.state.kind, 'goal_scored');
  assert.equal(msm.clock.elapsedInHalf, 2);
});
