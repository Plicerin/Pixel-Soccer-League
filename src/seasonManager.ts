/**
 * Season Manager — generates world-team season schedules, tracks standings,
 * and simulates CPU-vs-CPU games that the player doesn't play.
 */
import {
  WORLD_CUP_2026_TEAM_GROUPS,
  WORLD_CUP_2026_TEAM_NAMES,
  WORLD_CUP_2026_TEAMS,
} from './teamCatalog.js';

// ── World-team data ───────────────────────────────────────────────────
export const ALL_WORLD_TEAMS = WORLD_CUP_2026_TEAM_NAMES;
export const WORLD_TEAM_GROUPS = WORLD_CUP_2026_TEAM_GROUPS;

export function getTeamGroup(team: string): string {
  return WORLD_CUP_2026_TEAMS.find((entry) => entry.name === team)?.group || 'World';
}

// ── Types ─────────────────────────────────────────────────────────────
export interface SeasonFixture {
  matchday: number;
  home: string;
  away: string;
  result: { homeGoals: number; awayGoals: number } | null; // null = not played yet
  played: boolean;
  isPlayerGame: boolean; // true if playerTeam is home or away
}

export interface TeamStanding {
  team: string;
  conference: string;
  gp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
}

export type SeasonPhase = 'team_select' | 'regular' | 'playoff' | 'completed';

export interface SeasonRecord {
  id: string;
  playerTeam: string;
  createdAt: string;
  currentMatchday: number;  // 0 = not started, 1..N = current
  totalMatchdays: number;
  phase: SeasonPhase;
  schedule: SeasonFixture[];
  standings: TeamStanding[];
  playoffBracket: null; // placeholder for future playoff impl
}

// ── Schedule generation ───────────────────────────────────────────────

/**
 * Generate a balanced world-team schedule.
 * - Each team plays every other team once, alternating home/away.
 * - Games are distributed across matchdays so all teams play each round.
 */
function generateSchedule(playerTeam: string): SeasonFixture[] {
  const teams = [...ALL_WORLD_TEAMS];
  const n = teams.length;
  const fixtures: SeasonFixture[] = [];

  // Use the circle method for scheduling:
  // Fix team[0], rotate the rest.
  const fixed = teams[0];
  const rotating = teams.slice(1); // 29 teams

  for (let round = 0; round < n - 1; round++) {
    const matchday = round + 1;
    const roundFixtures: SeasonFixture[] = [];

    // Pair fixed with rotating[0]
    const opp = rotating[0];
    const homeAway = round % 2 === 0;
    roundFixtures.push({
      matchday,
      home: homeAway ? fixed : opp,
      away: homeAway ? opp : fixed,
      result: null,
      played: false,
      isPlayerGame: fixed === playerTeam || opp === playerTeam,
    });

    // Pair rotating[i] with rotating[n-2-i]
    for (let i = 1; i < rotating.length / 2 + 0.5; i++) {
      const j = rotating.length - i;
      if (i >= j) break;
      const teamA = rotating[i];
      const teamB = rotating[j];
      const ha = (round + i) % 2 === 0;
      roundFixtures.push({
        matchday,
        home: ha ? teamA : teamB,
        away: ha ? teamB : teamA,
        result: null,
        played: false,
        isPlayerGame: teamA === playerTeam || teamB === playerTeam,
      });
    }

    fixtures.push(...roundFixtures);
  }

  return fixtures;
}

// ── Standings initialization ──────────────────────────────────────────

function initializeStandings(): TeamStanding[] {
  return ALL_WORLD_TEAMS.map(team => ({
    team,
    conference: getTeamGroup(team),
    gp: 0, w: 0, d: 0, l: 0,
    gf: 0, ga: 0, gd: 0, pts: 0,
  }));
}

// ── Season record factory ─────────────────────────────────────────────

export function createSeasonRecord(playerTeam: string): SeasonRecord {
  const schedule = generateSchedule(playerTeam);
  const totalMatchdays = ALL_WORLD_TEAMS.length - 1;

  return {
    id: `season-${Date.now()}`,
    playerTeam,
    createdAt: new Date().toISOString(),
    currentMatchday: 1,
    totalMatchdays,
    phase: 'regular',
    schedule,
    standings: initializeStandings(),
    playoffBracket: null,
  };
}

// ── Standings update ──────────────────────────────────────────────────

export function updateStandings(season: SeasonRecord): void {
  // Reset
  for (const s of season.standings) {
    s.gp = 0; s.w = 0; s.d = 0; s.l = 0;
    s.gf = 0; s.ga = 0; s.gd = 0; s.pts = 0;
  }

  const map = new Map(season.standings.map(s => [s.team, s]));

  for (const f of season.schedule) {
    if (!f.played || !f.result) continue;
    const home = map.get(f.home)!;
    const away = map.get(f.away)!;
    const hg = f.result.homeGoals;
    const ag = f.result.awayGoals;

    home.gp++; away.gp++;
    home.gf += hg; home.ga += ag;
    away.gf += ag; away.ga += hg;
    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;

    if (hg > ag) {
      home.w++; away.l++;
      home.pts += 3;
    } else if (hg < ag) {
      away.w++; home.l++;
      away.pts += 3;
    } else {
      home.d++; away.d++;
      home.pts += 1; away.pts += 1;
    }
  }
}

// ── Matchday helpers ──────────────────────────────────────────────────

export function getMatchdayFixtures(season: SeasonRecord, matchday: number): SeasonFixture[] {
  return season.schedule.filter(f => f.matchday === matchday);
}

export function getPlayerFixture(season: SeasonRecord, matchday: number): SeasonFixture | undefined {
  return season.schedule.find(f => f.matchday === matchday && f.isPlayerGame);
}

/** Quick-sim a CPU-vs-CPU fixture. Returns { homeGoals, awayGoals }. */
export function simulateMatch(_home: string, _away: string): { homeGoals: number; awayGoals: number } {
  // Simple Poisson-ish model: each team scores ~1.3 goals on average
  const homeAvg = 1.5;
  const awayAvg = 1.1;

  function poissonRandom(lambda: number): number {
    let L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    return k - 1;
  }

  return {
    homeGoals: poissonRandom(homeAvg),
    awayGoals: poissonRandom(awayAvg),
  };
}

/** Simulate all non-player fixtures for a matchday and update standings. */
export function simMatchday(season: SeasonRecord, matchday: number): void {
  const fixtures = getMatchdayFixtures(season, matchday);
  for (const f of fixtures) {
    if (f.played) continue;
    if (f.isPlayerGame) continue; // player game handled by engine
    f.result = simulateMatch(f.home, f.away);
    f.played = true;
  }
  updateStandings(season);
}

/** Record a player match result. */
export function recordPlayerResult(
  season: SeasonRecord,
  matchday: number,
  homeGoals: number,
  awayGoals: number,
): void {
  const f = getPlayerFixture(season, matchday);
  if (!f) return;
  f.result = { homeGoals, awayGoals };
  f.played = true;
  updateStandings(season);
}

/** Advance to the next matchday. Returns false if season is over. */
export function advanceMatchday(season: SeasonRecord): boolean {
  if (season.currentMatchday >= season.totalMatchdays) {
    season.phase = 'completed';
    return false;
  }
  season.currentMatchday++;
  return true;
}

/** Get sorted standings for a conference (or all). */
export function getSortedStandings(
  season: SeasonRecord,
  conference?: string,
): TeamStanding[] {
  let standings = season.standings;
  if (conference) {
    standings = standings.filter(s => s.conference === conference);
  }
  return [...standings].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.team.localeCompare(b.team);
  });
}

// ── Persistence (localStorage) ────────────────────────────────────────

const STORAGE_KEY = 'psl_season';

export function saveSeason(season: SeasonRecord): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(season));
  } catch { /* quota exceeded — silently fail */ }
}

export function loadSeason(): SeasonRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed) return null;
    const teams = new Set(ALL_WORLD_TEAMS);
    const hasUnknownTeam = !teams.has(parsed.playerTeam)
      || !Array.isArray(parsed.standings)
      || parsed.standings.some((standing: TeamStanding) => !teams.has(standing.team));
    if (hasUnknownTeam) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function deleteSeason(): void {
  localStorage.removeItem(STORAGE_KEY);
}
