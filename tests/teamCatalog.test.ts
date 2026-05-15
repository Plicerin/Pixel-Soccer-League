import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_AWAY_TEAM,
  DEFAULT_HOME_TEAM,
  EASTER_EGG_WORLD_TEAMS,
  PLAYABLE_WORLD_TEAM_KITS,
  PLAYABLE_WORLD_TEAM_NAMES,
  resolvePlayableTeamKits,
  WORLD_CUP_2026_TEAM_KITS,
  WORLD_CUP_2026_TEAM_NAMES,
  WORLD_CUP_2026_TEAMS,
  getWorldCupTeamFlagAsset,
  getWorldCupTeamFlag,
  resolveWorldCupTeamName,
} from '../src/teamCatalog.js';
import {
  FIFA_WORLD_CUP_2026_GROUP_STAGE_FIXTURES,
  FIFA_WORLD_CUP_2026_GROUPS,
  randomWorldCup2026GroupFixture,
} from '../src/worldCup2026Schedule.js';

test('world team catalog contains the requested 48-team field', () => {
  assert.equal(WORLD_CUP_2026_TEAMS.length, 48);
  assert.equal(new Set(WORLD_CUP_2026_TEAM_NAMES).size, 48);
  assert.deepEqual(WORLD_CUP_2026_TEAM_NAMES.slice(0, 3), ['Canada', 'Mexico', 'United States']);

  const confederationCounts = WORLD_CUP_2026_TEAMS.reduce<Record<string, number>>((counts, team) => {
    counts[team.confederation] = (counts[team.confederation] || 0) + 1;
    return counts;
  }, {});

  assert.equal(confederationCounts.CONCACAF, 6);
  assert.equal(confederationCounts.UEFA, 16);
  assert.equal(confederationCounts.CONMEBOL, 6);
  assert.equal(confederationCounts.CAF, 10);
  assert.equal(confederationCounts.AFC, 9);
  assert.equal(confederationCounts.OFC, 1);
});

test('world team catalog exposes 1982 final teams as easter eggs outside the 48-team field', () => {
  assert.equal(EASTER_EGG_WORLD_TEAMS.length, 2);
  assert.equal(WORLD_CUP_2026_TEAMS.length, 48, 'easter eggs must not change the official 2026 field size');
  assert.equal(PLAYABLE_WORLD_TEAM_NAMES.length, 50);
  assert.ok(PLAYABLE_WORLD_TEAM_NAMES.includes('Italy 1982'));
  assert.ok(PLAYABLE_WORLD_TEAM_NAMES.includes('West Germany 1982'));
  assert.equal(resolveWorldCupTeamName('Italy'), 'Italy 1982');
  assert.equal(resolveWorldCupTeamName('Germany 1982'), 'West Germany 1982');
  assert.equal(getWorldCupTeamFlag('Italy 1982'), '🇮🇹');
  assert.equal(getWorldCupTeamFlag('West Germany 1982'), '🇩🇪');
  assert.equal(getWorldCupTeamFlagAsset('Italy 1982'), 'https://flagcdn.com/w80/it.png');
  assert.equal(getWorldCupTeamFlagAsset('West Germany 1982'), 'https://flagcdn.com/w80/de.png');
  assert.ok(PLAYABLE_WORLD_TEAM_KITS['Italy 1982']);
  assert.ok(PLAYABLE_WORLD_TEAM_KITS['West Germany 1982']);
});

test('playable team kits resolve home-away color clashes', () => {
  const resolved = resolvePlayableTeamKits('Canada', 'Switzerland', 'home', 'home');
  assert.equal(resolved.homeKey, 'home');
  assert.equal(resolved.awayKey, 'away');
  assert.equal(resolved.home.shirt, 0xd80621);
  assert.equal(resolved.away.shirt, 0xffffff);
});

test('world team catalog provides defaults, aliases, and kits for every team', () => {
  assert.equal(DEFAULT_HOME_TEAM, 'United States');
  assert.equal(DEFAULT_AWAY_TEAM, 'Mexico');
  assert.equal(resolveWorldCupTeamName('USA'), 'United States');
  assert.equal(resolveWorldCupTeamName('Turkey'), 'Türkiye');
  assert.equal(resolveWorldCupTeamName('Curacao'), 'Curaçao');
  assert.equal(resolveWorldCupTeamName('Ivory Coast'), "Côte d'Ivoire");
  assert.equal(getWorldCupTeamFlag('United States'), '🇺🇸');
  assert.equal(getWorldCupTeamFlag('Mexico'), '🇲🇽');
  assert.ok(getWorldCupTeamFlag('England').length > 0);
  assert.equal(getWorldCupTeamFlagAsset('United States'), 'https://flagcdn.com/w80/us.png');
  assert.equal(getWorldCupTeamFlagAsset('England'), 'https://flagcdn.com/w80/gb-eng.png');
  assert.equal(getWorldCupTeamFlagAsset('Scotland'), 'https://flagcdn.com/w80/gb-sct.png');

  for (const team of WORLD_CUP_2026_TEAM_NAMES) {
    const kit = WORLD_CUP_2026_TEAM_KITS[team];
    assert.ok(getWorldCupTeamFlag(team), `${team} missing flag`);
    assert.match(getWorldCupTeamFlagAsset(team), /^https:\/\/flagcdn\.com\/w80\/[a-z-]+\.png$/, `${team} missing real flag asset`);
    assert.ok(kit, `${team} missing kit`);
    assert.equal(typeof kit.home.shirt, 'number', `${team} missing home shirt color`);
    assert.equal(typeof kit.away.pants, 'number', `${team} missing away pants color`);
  }
});

test('FIFA World Cup 2026 group-stage fixtures use the official qualified team field', () => {
  assert.equal(FIFA_WORLD_CUP_2026_GROUP_STAGE_FIXTURES.length, 72);
  assert.equal(new Set(FIFA_WORLD_CUP_2026_GROUP_STAGE_FIXTURES.map((fixture) => fixture.matchNumber)).size, 72);
  assert.deepEqual(FIFA_WORLD_CUP_2026_GROUPS.A, ['Mexico', 'South Africa', 'South Korea', 'Czechia']);
  assert.deepEqual(FIFA_WORLD_CUP_2026_GROUPS.B, ['Canada', 'Bosnia and Herzegovina', 'Qatar', 'Switzerland']);

  const opening = FIFA_WORLD_CUP_2026_GROUP_STAGE_FIXTURES[0];
  assert.equal(opening.matchNumber, 1);
  assert.equal(opening.homeTeam, 'Mexico');
  assert.equal(opening.awayTeam, 'South Africa');
  assert.ok(FIFA_WORLD_CUP_2026_GROUP_STAGE_FIXTURES.some((fixture) => fixture.homeTeam === 'Canada' && fixture.awayTeam === 'Qatar'));
  assert.ok(FIFA_WORLD_CUP_2026_GROUP_STAGE_FIXTURES.some((fixture) => fixture.homeTeam === 'Switzerland' && fixture.awayTeam === 'Canada'));

  const appearances = new Map<string, number>();
  for (const fixture of FIFA_WORLD_CUP_2026_GROUP_STAGE_FIXTURES) {
    assert.ok(WORLD_CUP_2026_TEAM_NAMES.includes(fixture.homeTeam), `${fixture.homeTeam} missing from catalog`);
    assert.ok(WORLD_CUP_2026_TEAM_NAMES.includes(fixture.awayTeam), `${fixture.awayTeam} missing from catalog`);
    appearances.set(fixture.homeTeam, (appearances.get(fixture.homeTeam) || 0) + 1);
    appearances.set(fixture.awayTeam, (appearances.get(fixture.awayTeam) || 0) + 1);
  }
  for (const team of WORLD_CUP_2026_TEAM_NAMES) {
    assert.equal(appearances.get(team), 3, `${team} must have three group fixtures`);
  }

  const sampled = randomWorldCup2026GroupFixture(() => 0);
  assert.equal(sampled.homeTeam, 'Mexico');
  assert.equal(sampled.awayTeam, 'South Africa');
});
