import { WORLD_CUP_2026_TEAM_NAMES } from './teamCatalog.js';

export const FIFA_WORLD_CUP_2026_GROUPS = {
  A: ['Mexico', 'South Africa', 'South Korea', 'Czechia'],
  B: ['Canada', 'Bosnia and Herzegovina', 'Qatar', 'Switzerland'],
  C: ['Brazil', 'Morocco', 'Haiti', 'Scotland'],
  D: ['United States', 'Paraguay', 'Australia', 'Türkiye'],
  E: ['Germany', 'Curaçao', "Côte d'Ivoire", 'Ecuador'],
  F: ['Netherlands', 'Japan', 'Sweden', 'Tunisia'],
  G: ['Belgium', 'Egypt', 'Iran', 'New Zealand'],
  H: ['Spain', 'Cabo Verde', 'Saudi Arabia', 'Uruguay'],
  I: ['France', 'Senegal', 'Iraq', 'Norway'],
  J: ['Argentina', 'Algeria', 'Austria', 'Jordan'],
  K: ['Portugal', 'DR Congo', 'Uzbekistan', 'Colombia'],
  L: ['England', 'Croatia', 'Ghana', 'Panama'],
};

/** @type {Array<[string, number, string, string]>} */
const FIXTURE_ROWS = [
  ['A', 1, 'Mexico', 'South Africa'],
  ['A', 2, 'South Korea', 'Czechia'],
  ['A', 25, 'Czechia', 'South Africa'],
  ['A', 28, 'Mexico', 'South Korea'],
  ['A', 53, 'Czechia', 'Mexico'],
  ['A', 54, 'South Africa', 'South Korea'],

  ['B', 3, 'Canada', 'Bosnia and Herzegovina'],
  ['B', 8, 'Qatar', 'Switzerland'],
  ['B', 26, 'Switzerland', 'Bosnia and Herzegovina'],
  ['B', 27, 'Canada', 'Qatar'],
  ['B', 51, 'Switzerland', 'Canada'],
  ['B', 52, 'Bosnia and Herzegovina', 'Qatar'],

  ['C', 5, 'Haiti', 'Scotland'],
  ['C', 7, 'Brazil', 'Morocco'],
  ['C', 29, 'Brazil', 'Haiti'],
  ['C', 30, 'Scotland', 'Morocco'],
  ['C', 49, 'Scotland', 'Brazil'],
  ['C', 50, 'Morocco', 'Haiti'],

  ['D', 4, 'United States', 'Paraguay'],
  ['D', 6, 'Australia', 'Türkiye'],
  ['D', 31, 'Türkiye', 'Paraguay'],
  ['D', 32, 'United States', 'Australia'],
  ['D', 59, 'United States', 'Türkiye'],
  ['D', 60, 'Paraguay', 'Australia'],

  ['E', 9, "Côte d'Ivoire", 'Ecuador'],
  ['E', 10, 'Germany', 'Curaçao'],
  ['E', 33, 'Germany', "Côte d'Ivoire"],
  ['E', 34, 'Ecuador', 'Curaçao'],
  ['E', 55, 'Ecuador', 'Germany'],
  ['E', 56, 'Curaçao', "Côte d'Ivoire"],

  ['F', 11, 'Netherlands', 'Japan'],
  ['F', 12, 'Sweden', 'Tunisia'],
  ['F', 35, 'Netherlands', 'Sweden'],
  ['F', 36, 'Tunisia', 'Japan'],
  ['F', 57, 'Japan', 'Sweden'],
  ['F', 58, 'Tunisia', 'Netherlands'],

  ['G', 15, 'Belgium', 'Egypt'],
  ['G', 16, 'Iran', 'New Zealand'],
  ['G', 39, 'Belgium', 'Iran'],
  ['G', 40, 'New Zealand', 'Egypt'],
  ['G', 63, 'New Zealand', 'Belgium'],
  ['G', 64, 'Egypt', 'Iran'],

  ['H', 13, 'Spain', 'Cabo Verde'],
  ['H', 14, 'Saudi Arabia', 'Uruguay'],
  ['H', 37, 'Spain', 'Saudi Arabia'],
  ['H', 38, 'Uruguay', 'Cabo Verde'],
  ['H', 65, 'Uruguay', 'Spain'],
  ['H', 66, 'Cabo Verde', 'Saudi Arabia'],

  ['I', 17, 'France', 'Senegal'],
  ['I', 18, 'Iraq', 'Norway'],
  ['I', 41, 'Norway', 'Senegal'],
  ['I', 42, 'France', 'Iraq'],
  ['I', 61, 'Norway', 'France'],
  ['I', 62, 'Senegal', 'Iraq'],

  ['J', 19, 'Argentina', 'Algeria'],
  ['J', 20, 'Austria', 'Jordan'],
  ['J', 43, 'Argentina', 'Austria'],
  ['J', 44, 'Jordan', 'Algeria'],
  ['J', 69, 'Jordan', 'Argentina'],
  ['J', 70, 'Algeria', 'Austria'],

  ['K', 23, 'Portugal', 'DR Congo'],
  ['K', 24, 'Uzbekistan', 'Colombia'],
  ['K', 47, 'Portugal', 'Uzbekistan'],
  ['K', 48, 'Colombia', 'DR Congo'],
  ['K', 71, 'Colombia', 'Portugal'],
  ['K', 72, 'DR Congo', 'Uzbekistan'],

  ['L', 21, 'Ghana', 'Panama'],
  ['L', 22, 'England', 'Croatia'],
  ['L', 45, 'England', 'Ghana'],
  ['L', 46, 'Panama', 'Croatia'],
  ['L', 67, 'Panama', 'England'],
  ['L', 68, 'Croatia', 'Ghana'],
];

const TEAM_SET = new Set(WORLD_CUP_2026_TEAM_NAMES);

export const FIFA_WORLD_CUP_2026_GROUP_STAGE_FIXTURES = FIXTURE_ROWS
  .map(([group, matchNumber, homeTeam, awayTeam]) => {
    if (!TEAM_SET.has(homeTeam) || !TEAM_SET.has(awayTeam)) {
      throw new Error(`Unknown FIFA World Cup 2026 fixture team: ${homeTeam} v ${awayTeam}`);
    }
    return {
      source: 'FIFA',
      stage: 'group',
      group,
      matchNumber,
      homeTeam,
      awayTeam,
    };
  })
  .sort((a, b) => a.matchNumber - b.matchNumber);

export function randomWorldCup2026GroupFixture(rng = Math.random) {
  const index = Math.floor(rng() * FIFA_WORLD_CUP_2026_GROUP_STAGE_FIXTURES.length);
  return FIFA_WORLD_CUP_2026_GROUP_STAGE_FIXTURES[Math.max(0, Math.min(FIFA_WORLD_CUP_2026_GROUP_STAGE_FIXTURES.length - 1, index))];
}
