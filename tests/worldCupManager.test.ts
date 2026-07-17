import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceWorldCup,
  createWorldCupRecord,
  getCurrentRoundFixtures,
  getGroupStandings,
  getPlayerFixture,
  getQualifiedTeams,
  recordPlayerResult,
  type WorldCupRecord,
} from '../src/worldCupManager';

function completeCurrentRound(record: WorldCupRecord, homeGoals = 1, awayGoals = 0) {
  for (const fixture of getCurrentRoundFixtures(record)) {
    if (fixture.played) continue;
    fixture.result = {
      homeGoals,
      awayGoals,
      winner: homeGoals === awayGoals ? fixture.home : homeGoals > awayGoals ? fixture.home : fixture.away,
      decidedBy: 'regulation',
      homeScorers: homeGoals > 0 ? Array.from({ length: homeGoals }, () => `${fixture.home} Scorer`) : [],
      awayScorers: awayGoals > 0 ? Array.from({ length: awayGoals }, () => `${fixture.away} Scorer`) : [],
    };
    fixture.played = true;
  }
}

test('world cup manager creates official 48-team group stage state', () => {
  const record = createWorldCupRecord('Mexico');
  assert.equal(record.currentStage, 'group');
  assert.equal(record.currentRound, 1);
  assert.equal(record.groupFixtures.length, 72);
  assert.equal(getCurrentRoundFixtures(record).length, 24);
  assert.ok(getPlayerFixture(record), 'player should have a fixture in the opening group round');
});

test('world cup manager advances from groups into a 32-team knockout bracket', () => {
  const record = createWorldCupRecord('Mexico');

  completeCurrentRound(record, 1, 0);
  advanceWorldCup(record);
  assert.equal(record.currentStage, 'group');
  assert.equal(record.currentRound, 2);

  completeCurrentRound(record, 2, 1);
  advanceWorldCup(record);
  assert.equal(record.currentStage, 'group');
  assert.equal(record.currentRound, 3);

  completeCurrentRound(record, 1, 1);
  advanceWorldCup(record);

  assert.equal(record.currentStage, 'round_of_32');
  assert.equal(record.knockoutFixtures.filter((fixture) => fixture.stage === 'round_of_32').length, 16);
  assert.equal(getQualifiedTeams(record).length, 32);
  assert.equal(getCurrentRoundFixtures(record).length, 16);
});

test('world cup manager records player result and completes tournament flow', () => {
  const record = createWorldCupRecord('Mexico');

  const playerFixture = getPlayerFixture(record);
  assert.ok(playerFixture, 'player fixture should exist in group round one');
  recordPlayerResult(record, 2, 0);
  assert.ok(playerFixture?.played);
  assert.equal(getGroupStandings(record, 'A')[0]?.team, 'Mexico');

  while (record.currentStage === 'group') {
    completeCurrentRound(record, 1, 0);
    advanceWorldCup(record);
  }
  while (record.currentStage !== 'completed') {
    completeCurrentRound(record, 1, 0);
    advanceWorldCup(record);
  }

  assert.equal(record.currentStage, 'completed');
  assert.ok(record.champion, 'completed tournament must have a champion');
});
