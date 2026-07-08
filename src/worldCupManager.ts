import { getTeamStrengthProfile } from './core/simpleRatings';
import {
  FIFA_WORLD_CUP_2026_GROUPS,
  FIFA_WORLD_CUP_2026_GROUP_STAGE_FIXTURES,
} from './worldCup2026Schedule.js';

export type WorldCupStage =
  | 'group'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarterfinal'
  | 'semifinal'
  | 'third_place'
  | 'final'
  | 'completed';

export interface WorldCupResult {
  homeGoals: number;
  awayGoals: number;
  winner: string | null;
  decidedBy: 'regulation' | 'tiebreak';
}

export interface WorldCupFixture {
  id: string;
  stage: Exclude<WorldCupStage, 'completed'>;
  round: number;
  group: string | null;
  matchNumber: number | null;
  home: string;
  away: string;
  result: WorldCupResult | null;
  played: boolean;
  isPlayerGame: boolean;
}

export interface GroupStanding {
  group: string;
  team: string;
  gp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
}

export interface WorldCupRecord {
  id: string;
  playerTeam: string;
  createdAt: string;
  currentStage: WorldCupStage;
  currentRound: number;
  groupFixtures: WorldCupFixture[];
  knockoutFixtures: WorldCupFixture[];
  standings: GroupStanding[];
  champion: string | null;
}

const STORAGE_KEY = 'psl_world_cup';
const GROUP_NAMES = Object.keys(FIFA_WORLD_CUP_2026_GROUPS);
const STAGE_ORDER: Exclude<WorldCupStage, 'group' | 'completed'>[] = [
  'round_of_32',
  'round_of_16',
  'quarterfinal',
  'semifinal',
  'third_place',
  'final',
];

function poissonRandom(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

function groupRoundForIndex(groupIndex: number) {
  if (groupIndex < 2) return 1;
  if (groupIndex < 4) return 2;
  return 3;
}

function fixtureId(stage: string, round: number, home: string, away: string) {
  return `${stage}-${round}-${home}-${away}`.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
}

function createEmptyStandings(): GroupStanding[] {
  return GROUP_NAMES.flatMap((group) =>
    FIFA_WORLD_CUP_2026_GROUPS[group as keyof typeof FIFA_WORLD_CUP_2026_GROUPS].map((team) => ({
      group,
      team,
      gp: 0,
      w: 0,
      d: 0,
      l: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      pts: 0,
    })),
  );
}

function compareStandings(a: GroupStanding, b: GroupStanding) {
  if (b.pts !== a.pts) return b.pts - a.pts;
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  if (a.ga !== b.ga) return a.ga - b.ga;
  return a.team.localeCompare(b.team);
}

function getTeamStrength(team: string) {
  return getTeamStrengthProfile(team).normalizedStrength || 0.5;
}

function simulateGoals(home: string, away: string) {
  const homeStrength = getTeamStrength(home);
  const awayStrength = getTeamStrength(away);
  const diff = homeStrength - awayStrength;
  const homeLambda = Math.max(0.35, 1.15 + diff * 1.2 + 0.12);
  const awayLambda = Math.max(0.25, 1.00 - diff * 1.0);
  return {
    homeGoals: poissonRandom(homeLambda),
    awayGoals: poissonRandom(awayLambda),
  };
}

function resolveTieWinner(home: string, away: string) {
  const homeStrength = getTeamStrength(home);
  const awayStrength = getTeamStrength(away);
  const total = homeStrength + awayStrength;
  return Math.random() < homeStrength / Math.max(0.001, total) ? home : away;
}

function buildWorldCupResult(home: string, away: string, homeGoals: number, awayGoals: number, knockout = false): WorldCupResult {
  if (!knockout) {
    return {
      homeGoals,
      awayGoals,
      winner: homeGoals === awayGoals ? null : homeGoals > awayGoals ? home : away,
      decidedBy: 'regulation',
    };
  }
  if (homeGoals !== awayGoals) {
    return {
      homeGoals,
      awayGoals,
      winner: homeGoals > awayGoals ? home : away,
      decidedBy: 'regulation',
    };
  }
  return {
    homeGoals,
    awayGoals,
    winner: resolveTieWinner(home, away),
    decidedBy: 'tiebreak',
  };
}

function updateStandingsFromFixtures(fixtures: WorldCupFixture[]) {
  const standings = createEmptyStandings();
  const map = new Map(standings.map((row) => [row.team, row]));
  for (const fixture of fixtures) {
    if (!fixture.played || !fixture.result) continue;
    const home = map.get(fixture.home);
    const away = map.get(fixture.away);
    if (!home || !away) continue;
    const { homeGoals, awayGoals } = fixture.result;
    home.gp += 1;
    away.gp += 1;
    home.gf += homeGoals;
    home.ga += awayGoals;
    away.gf += awayGoals;
    away.ga += homeGoals;
    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;
    if (homeGoals > awayGoals) {
      home.w += 1;
      away.l += 1;
      home.pts += 3;
    } else if (awayGoals > homeGoals) {
      away.w += 1;
      home.l += 1;
      away.pts += 3;
    } else {
      home.d += 1;
      away.d += 1;
      home.pts += 1;
      away.pts += 1;
    }
  }
  return standings;
}

function sortGroupStandings(standings: GroupStanding[], group: string) {
  return standings.filter((row) => row.group === group).sort(compareStandings);
}

function rankedQualifiers(standings: GroupStanding[]) {
  const winners: Array<GroupStanding & { finish: 1 | 2 | 3 }> = [];
  const runnersUp: Array<GroupStanding & { finish: 1 | 2 | 3 }> = [];
  const thirds: Array<GroupStanding & { finish: 1 | 2 | 3 }> = [];
  for (const group of GROUP_NAMES) {
    const rows = sortGroupStandings(standings, group);
    winners.push({ ...rows[0], finish: 1 });
    runnersUp.push({ ...rows[1], finish: 2 });
    thirds.push({ ...rows[2], finish: 3 });
  }
  thirds.sort(compareStandings);
  const bestThirds = thirds.slice(0, 8);
  const seeds = [...winners, ...runnersUp, ...bestThirds];
  seeds.sort((a, b) => {
    if (a.finish !== b.finish) return a.finish - b.finish;
    return compareStandings(a, b);
  });
  return seeds;
}

function buildKnockoutRoundOf32(standings: GroupStanding[], playerTeam: string) {
  const seeds = rankedQualifiers(standings);
  const fixtures: WorldCupFixture[] = [];
  for (let i = 0; i < seeds.length / 2; i += 1) {
    const home = seeds[i];
    const away = seeds[seeds.length - 1 - i];
    fixtures.push({
      id: fixtureId('round_of_32', 1, home.team, away.team),
      stage: 'round_of_32',
      round: 1,
      group: null,
      matchNumber: null,
      home: home.team,
      away: away.team,
      result: null,
      played: false,
      isPlayerGame: home.team === playerTeam || away.team === playerTeam,
    });
  }
  return fixtures;
}

function fixtureWinner(fixture: WorldCupFixture) {
  if (!fixture.result) return null;
  if (fixture.result.winner) return fixture.result.winner;
  if (fixture.result.homeGoals > fixture.result.awayGoals) return fixture.home;
  if (fixture.result.awayGoals > fixture.result.homeGoals) return fixture.away;
  return null;
}

function createNextKnockoutStage(
  previousFixtures: WorldCupFixture[],
  stage: Exclude<WorldCupStage, 'group' | 'completed' | 'third_place'>,
  playerTeam: string,
) {
  const winners = previousFixtures.map(fixtureWinner).filter(Boolean) as string[];
  const fixtures: WorldCupFixture[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    fixtures.push({
      id: fixtureId(stage, 1, winners[i], winners[i + 1]),
      stage,
      round: 1,
      group: null,
      matchNumber: null,
      home: winners[i],
      away: winners[i + 1],
      result: null,
      played: false,
      isPlayerGame: winners[i] === playerTeam || winners[i + 1] === playerTeam,
    });
  }
  return fixtures;
}

function createFinalFixturesFromSemis(previousFixtures: WorldCupFixture[], playerTeam: string) {
  const winners = previousFixtures.map(fixtureWinner).filter(Boolean) as string[];
  const losers = previousFixtures.map((fixture) => {
    const winner = fixtureWinner(fixture);
    if (!winner) return null;
    return winner === fixture.home ? fixture.away : fixture.home;
  }).filter(Boolean) as string[];

  const thirdPlace: WorldCupFixture = {
    id: fixtureId('third_place', 1, losers[0], losers[1]),
    stage: 'third_place',
    round: 1,
    group: null,
    matchNumber: null,
    home: losers[0],
    away: losers[1],
    result: null,
    played: false,
    isPlayerGame: losers[0] === playerTeam || losers[1] === playerTeam,
  };
  const final: WorldCupFixture = {
    id: fixtureId('final', 1, winners[0], winners[1]),
    stage: 'final',
    round: 1,
    group: null,
    matchNumber: null,
    home: winners[0],
    away: winners[1],
    result: null,
    played: false,
    isPlayerGame: winners[0] === playerTeam || winners[1] === playerTeam,
  };
  return { thirdPlace, final };
}

export function createWorldCupRecord(playerTeam: string): WorldCupRecord {
  const groupedCounts = new Map<string, number>();
  const groupFixtures = FIFA_WORLD_CUP_2026_GROUP_STAGE_FIXTURES.map((fixture) => {
    const seen = groupedCounts.get(fixture.group) || 0;
    groupedCounts.set(fixture.group, seen + 1);
    const round = groupRoundForIndex(seen);
    return {
      id: fixtureId('group', round, fixture.homeTeam, fixture.awayTeam),
      stage: 'group' as const,
      round,
      group: fixture.group,
      matchNumber: fixture.matchNumber,
      home: fixture.homeTeam,
      away: fixture.awayTeam,
      result: null,
      played: false,
      isPlayerGame: fixture.homeTeam === playerTeam || fixture.awayTeam === playerTeam,
    };
  });
  return {
    id: `world-cup-${Date.now()}`,
    playerTeam,
    createdAt: new Date().toISOString(),
    currentStage: 'group',
    currentRound: 1,
    groupFixtures,
    knockoutFixtures: [],
    standings: createEmptyStandings(),
    champion: null,
  };
}

export function getCurrentRoundFixtures(record: WorldCupRecord) {
  const source = record.currentStage === 'group' ? record.groupFixtures : record.knockoutFixtures;
  return source.filter((fixture) => fixture.stage === record.currentStage && fixture.round === record.currentRound);
}

export function getPlayerFixture(record: WorldCupRecord) {
  return getCurrentRoundFixtures(record).find((fixture) => fixture.isPlayerGame);
}

export function getGroupStandings(record: WorldCupRecord, group: string) {
  return sortGroupStandings(record.standings, group);
}

export function getAllGroupStandings(record: WorldCupRecord) {
  return GROUP_NAMES.map((group) => ({
    group,
    standings: getGroupStandings(record, group),
  }));
}

export function getPlayerGroup(record: WorldCupRecord) {
  return GROUP_NAMES.find((group) =>
    getGroupStandings(record, group).some((row) => row.team === record.playerTeam),
  ) || null;
}

export function getKnockoutFixtures(record: WorldCupRecord, stage?: Exclude<WorldCupStage, 'group' | 'completed'>) {
  return stage ? record.knockoutFixtures.filter((fixture) => fixture.stage === stage) : record.knockoutFixtures.slice();
}

export function simulateWorldCupMatch(home: string, away: string, knockout = false): WorldCupResult {
  const { homeGoals, awayGoals } = simulateGoals(home, away);
  return buildWorldCupResult(home, away, homeGoals, awayGoals, knockout);
}

export function recomputeWorldCupTables(record: WorldCupRecord) {
  record.standings = updateStandingsFromFixtures(record.groupFixtures);
}

export function simCurrentRound(record: WorldCupRecord) {
  const knockout = record.currentStage !== 'group';
  for (const fixture of getCurrentRoundFixtures(record)) {
    if (fixture.played) continue;
    fixture.result = simulateWorldCupMatch(fixture.home, fixture.away, knockout);
    fixture.played = true;
  }
  recomputeWorldCupTables(record);
}

export function recordPlayerResult(record: WorldCupRecord, homeGoals: number, awayGoals: number) {
  const fixture = getPlayerFixture(record);
  if (!fixture || fixture.played) return;
  fixture.result = buildWorldCupResult(fixture.home, fixture.away, homeGoals, awayGoals, fixture.stage !== 'group');
  fixture.played = true;
  recomputeWorldCupTables(record);
}

export function isCurrentRoundComplete(record: WorldCupRecord) {
  return getCurrentRoundFixtures(record).every((fixture) => fixture.played);
}

export function advanceWorldCup(record: WorldCupRecord) {
  if (record.currentStage === 'completed') return false;
  if (!isCurrentRoundComplete(record)) return true;
  if (record.currentStage === 'group') {
    if (record.currentRound < 3) {
      record.currentRound += 1;
      return true;
    }
    recomputeWorldCupTables(record);
    record.knockoutFixtures.push(...buildKnockoutRoundOf32(record.standings, record.playerTeam));
    record.currentStage = 'round_of_32';
    record.currentRound = 1;
    return true;
  }

  if (record.currentStage === 'round_of_32') {
    record.knockoutFixtures.push(...createNextKnockoutStage(getCurrentRoundFixtures(record), 'round_of_16', record.playerTeam));
    record.currentStage = 'round_of_16';
    return true;
  }
  if (record.currentStage === 'round_of_16') {
    record.knockoutFixtures.push(...createNextKnockoutStage(getCurrentRoundFixtures(record), 'quarterfinal', record.playerTeam));
    record.currentStage = 'quarterfinal';
    return true;
  }
  if (record.currentStage === 'quarterfinal') {
    record.knockoutFixtures.push(...createNextKnockoutStage(getCurrentRoundFixtures(record), 'semifinal', record.playerTeam));
    record.currentStage = 'semifinal';
    return true;
  }
  if (record.currentStage === 'semifinal') {
    const finals = createFinalFixturesFromSemis(getCurrentRoundFixtures(record), record.playerTeam);
    record.knockoutFixtures.push(finals.thirdPlace, finals.final);
    record.currentStage = 'third_place';
    return true;
  }
  if (record.currentStage === 'third_place') {
    record.currentStage = 'final';
    return true;
  }
  if (record.currentStage === 'final') {
    const finalFixture = getCurrentRoundFixtures(record)[0];
    record.champion = finalFixture ? fixtureWinner(finalFixture) : null;
    record.currentStage = 'completed';
    return false;
  }
  return false;
}

export function getQualifiedTeams(record: WorldCupRecord) {
  return rankedQualifiers(record.standings);
}

export function saveWorldCup(record: WorldCupRecord) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {}
}

export function loadWorldCup(): WorldCupRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorldCupRecord;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.playerTeam || !Array.isArray(parsed.groupFixtures) || !Array.isArray(parsed.standings)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function deleteWorldCup() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function stageLabel(stage: WorldCupStage, round: number) {
  if (stage === 'group') return `Group Stage — Round ${round}`;
  if (stage === 'round_of_32') return 'Round of 32';
  if (stage === 'round_of_16') return 'Round of 16';
  if (stage === 'quarterfinal') return 'Quarterfinals';
  if (stage === 'semifinal') return 'Semifinals';
  if (stage === 'third_place') return 'Third Place';
  if (stage === 'final') return 'Final';
  return 'Tournament Complete';
}

export function fixtureScoreLabel(fixture: WorldCupFixture) {
  if (!fixture.result) return '-';
  const base = `${fixture.result.homeGoals} - ${fixture.result.awayGoals}`;
  return fixture.result.decidedBy === 'tiebreak' ? `${base} (TB)` : base;
}

export function availableKnockoutStages(record: WorldCupRecord) {
  return STAGE_ORDER.filter((stage) => record.knockoutFixtures.some((fixture) => fixture.stage === stage));
}
