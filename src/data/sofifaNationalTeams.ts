import {
  SOFIFA_NATIONAL_TEAMS_GENERATED,
  SOFIFA_NATIONAL_TEAMS_GENERATED_AT,
  SOFIFA_NATIONAL_TEAMS_GENERATED_SOURCE,
  SOFIFA_NATIONAL_TEAMS_GENERATED_STATUS,
} from "./sofifaNationalTeams.generated";

export const SOFIFA_NATIONAL_TEAMS_SOURCE_URL = 'https://sofifa.com/teams?type=national';

export type SofifaNationalTeamRow = {
  team: string;
  overall: number | null;
  attack: number | null;
  midfield: number | null;
  defense: number | null;
};

const TEAM_NAMES = [
  'Canada',
  'Mexico',
  'United States',
  'Austria',
  'Belgium',
  'Bosnia and Herzegovina',
  'Croatia',
  'Czechia',
  'England',
  'France',
  'Germany',
  'Netherlands',
  'Norway',
  'Portugal',
  'Scotland',
  'Spain',
  'Sweden',
  'Switzerland',
  'Türkiye',
  'Argentina',
  'Brazil',
  'Colombia',
  'Ecuador',
  'Paraguay',
  'Uruguay',
  'Algeria',
  'Cabo Verde',
  "Côte d'Ivoire",
  'DR Congo',
  'Egypt',
  'Ghana',
  'Morocco',
  'Senegal',
  'South Africa',
  'Tunisia',
  'Australia',
  'Iran',
  'Iraq',
  'Japan',
  'Jordan',
  'Qatar',
  'Saudi Arabia',
  'South Korea',
  'Uzbekistan',
  'Curaçao',
  'Haiti',
  'Panama',
  'New Zealand',
] as const;

export const SOFIFA_NATIONAL_TEAMS_PENDING: SofifaNationalTeamRow[] = TEAM_NAMES.map((team) => ({
  team,
  overall: null,
  attack: null,
  midfield: null,
  defense: null,
}));

export const SOFIFA_NATIONAL_TEAMS_PENDING_BY_TEAM = new Map(
  SOFIFA_NATIONAL_TEAMS_PENDING.map((row) => [row.team, row]),
);

export const SOFIFA_NATIONAL_TEAMS = SOFIFA_NATIONAL_TEAMS_GENERATED;
export const SOFIFA_NATIONAL_TEAMS_BY_TEAM = new Map(
  SOFIFA_NATIONAL_TEAMS.map((row) => [row.team, row]),
);
export const SOFIFA_NATIONAL_TEAMS_STATUS = SOFIFA_NATIONAL_TEAMS_GENERATED_STATUS;
export const SOFIFA_NATIONAL_TEAMS_GENERATED_METADATA = {
  generatedAt: SOFIFA_NATIONAL_TEAMS_GENERATED_AT,
  source: SOFIFA_NATIONAL_TEAMS_GENERATED_SOURCE,
};
