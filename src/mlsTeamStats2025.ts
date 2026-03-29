export interface MLS2025TeamStats {
  points: number;
  gamesPlayed: number;
  goalsFor: number;
  goalsAgainst: number;
  pointsPerGame: number;
}

const MLS_2025_TEAM_STATS: Record<string, MLS2025TeamStats> = {
  'Atlanta United': { points: 28, gamesPlayed: 34, goalsFor: 38, goalsAgainst: 63, pointsPerGame: 0.82 },
  'Austin FC': { points: 47, gamesPlayed: 34, goalsFor: 37, goalsAgainst: 45, pointsPerGame: 1.38 },
  'Charlotte FC': { points: 59, gamesPlayed: 34, goalsFor: 55, goalsAgainst: 46, pointsPerGame: 1.74 },
  'Chicago Fire': { points: 53, gamesPlayed: 34, goalsFor: 68, goalsAgainst: 60, pointsPerGame: 1.56 },
  'FC Cincinnati': { points: 65, gamesPlayed: 34, goalsFor: 52, goalsAgainst: 40, pointsPerGame: 1.91 },
  'Colorado Rapids': { points: 41, gamesPlayed: 34, goalsFor: 44, goalsAgainst: 56, pointsPerGame: 1.21 },
  'Columbus Crew': { points: 54, gamesPlayed: 34, goalsFor: 55, goalsAgainst: 51, pointsPerGame: 1.59 },
  'DC United': { points: 26, gamesPlayed: 34, goalsFor: 30, goalsAgainst: 66, pointsPerGame: 0.76 },
  'FC Dallas': { points: 44, gamesPlayed: 34, goalsFor: 52, goalsAgainst: 55, pointsPerGame: 1.29 },
  'Houston Dynamo': { points: 37, gamesPlayed: 34, goalsFor: 43, goalsAgainst: 56, pointsPerGame: 1.09 },
  'Inter Miami': { points: 65, gamesPlayed: 34, goalsFor: 81, goalsAgainst: 55, pointsPerGame: 1.91 },
  'LA Galaxy': { points: 30, gamesPlayed: 34, goalsFor: 46, goalsAgainst: 66, pointsPerGame: 0.88 },
  LAFC: { points: 60, gamesPlayed: 34, goalsFor: 65, goalsAgainst: 40, pointsPerGame: 1.76 },
  'Minnesota United': { points: 58, gamesPlayed: 34, goalsFor: 56, goalsAgainst: 39, pointsPerGame: 1.71 },
  'CF Montreal': { points: 28, gamesPlayed: 34, goalsFor: 34, goalsAgainst: 60, pointsPerGame: 0.82 },
  'Nashville SC': { points: 54, gamesPlayed: 34, goalsFor: 58, goalsAgainst: 45, pointsPerGame: 1.59 },
  'New England Revolution': { points: 36, gamesPlayed: 34, goalsFor: 44, goalsAgainst: 51, pointsPerGame: 1.06 },
  'New York City FC': { points: 56, gamesPlayed: 34, goalsFor: 50, goalsAgainst: 44, pointsPerGame: 1.65 },
  'New York Red Bulls': { points: 43, gamesPlayed: 34, goalsFor: 48, goalsAgainst: 47, pointsPerGame: 1.26 },
  'Orlando City': { points: 53, gamesPlayed: 34, goalsFor: 63, goalsAgainst: 51, pointsPerGame: 1.56 },
  'Philadelphia Union': { points: 66, gamesPlayed: 34, goalsFor: 57, goalsAgainst: 35, pointsPerGame: 1.94 },
  'Portland Timbers': { points: 44, gamesPlayed: 34, goalsFor: 41, goalsAgainst: 48, pointsPerGame: 1.29 },
  'Real Salt Lake': { points: 41, gamesPlayed: 34, goalsFor: 38, goalsAgainst: 49, pointsPerGame: 1.21 },
  'San Diego FC': { points: 63, gamesPlayed: 34, goalsFor: 64, goalsAgainst: 41, pointsPerGame: 1.85 },
  'San Jose Earthquakes': { points: 41, gamesPlayed: 34, goalsFor: 60, goalsAgainst: 63, pointsPerGame: 1.21 },
  'Seattle Sounders': { points: 55, gamesPlayed: 34, goalsFor: 58, goalsAgainst: 48, pointsPerGame: 1.62 },
  'Sporting Kansas City': { points: 28, gamesPlayed: 34, goalsFor: 46, goalsAgainst: 70, pointsPerGame: 0.82 },
  'St. Louis City SC': { points: 32, gamesPlayed: 34, goalsFor: 44, goalsAgainst: 58, pointsPerGame: 0.94 },
  'Toronto FC': { points: 32, gamesPlayed: 34, goalsFor: 37, goalsAgainst: 44, pointsPerGame: 0.94 },
  'Vancouver Whitecaps': { points: 63, gamesPlayed: 34, goalsFor: 66, goalsAgainst: 38, pointsPerGame: 1.85 },
};

const TEAM_ALIASES: Record<string, string> = {
  'cfmontreal': 'CF Montreal',
  'cfmontrealfc': 'CF Montreal',
  'cfmontrealclubdefutbol': 'CF Montreal',
  'cfmontrealclubdefoot': 'CF Montreal',
  'dcunited': 'DC United',
  'dcunitedfc': 'DC United',
  'intermiamicf': 'Inter Miami',
  'houstondynamofc': 'Houston Dynamo',
  'chicagofirefc': 'Chicago Fire',
  'losangelesfootballclub': 'LAFC',
  'newyorkcityfootballclub': 'New York City FC',
  'newyorkcityfc': 'New York City FC',
  'redbullnewyork': 'New York Red Bulls',
  'newyorkredbulls': 'New York Red Bulls',
  'stlouiscitysc': 'St. Louis City SC',
  'sandiegofootballclub': 'San Diego FC',
  'minnesotaunitedfc': 'Minnesota United',
  'seattlesoundersfc': 'Seattle Sounders',
  'vancouverwhitecapsfc': 'Vancouver Whitecaps',
};

function normalizeTeamName(value: string) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const TEAM_BY_NORMALIZED_NAME = Object.keys(MLS_2025_TEAM_STATS).reduce<Record<string, string>>((acc, teamName) => {
  acc[normalizeTeamName(teamName)] = teamName;
  return acc;
}, {});

Object.entries(TEAM_ALIASES).forEach(([alias, canonicalName]) => {
  TEAM_BY_NORMALIZED_NAME[alias] = canonicalName;
});

const PPG_MIN = 0.76;
const PPG_MAX = 1.94;
const GPG_MIN = 0.882352941176471;
const GPG_MAX = 2.38235294117647;
const GAPG_MIN = 1.02941176470588;
const GAPG_MAX = 2.05882352941176;

function normalize01(value: number, min: number, max: number) {
  if (max <= min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function getMLS2025TeamStats(teamName: string): MLS2025TeamStats | null {
  const key = normalizeTeamName(teamName);
  const canonical = TEAM_BY_NORMALIZED_NAME[key];
  return canonical ? MLS_2025_TEAM_STATS[canonical] : null;
}

export function getMLS2025TeamModifiers(teamName: string) {
  const stats = getMLS2025TeamStats(teamName);
  if (!stats) return null;

  const goalsForPerGame = stats.goalsFor / stats.gamesPlayed;
  const goalsAgainstPerGame = stats.goalsAgainst / stats.gamesPlayed;

  const ppg = normalize01(stats.pointsPerGame, PPG_MIN, PPG_MAX);
  const attack = normalize01(goalsForPerGame, GPG_MIN, GPG_MAX);
  const defense = 1 - normalize01(goalsAgainstPerGame, GAPG_MIN, GAPG_MAX);

  return {
    // 0..1 quality axes
    ppg,
    attack,
    defense,
    // centered range -1..1, weighted toward points per game
    overallCentered: (0.6 * ppg + 0.25 * attack + 0.15 * defense) * 2 - 1,
    attackCentered: attack * 2 - 1,
    defenseCentered: defense * 2 - 1,
  };
}
