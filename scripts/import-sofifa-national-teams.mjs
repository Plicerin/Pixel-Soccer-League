#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const REPO_ROOT = process.cwd();
const INPUT_PATH = process.argv[2] || path.join(REPO_ROOT, "tmp", "sofifa-national-teams.json");
const OUTPUT_PATH = path.join(REPO_ROOT, "src", "data", "sofifaNationalTeams.generated.ts");

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
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

if (!fs.existsSync(INPUT_PATH)) {
  fail(`Missing SOFIFA import file: ${INPUT_PATH}`);
}

const parsed = JSON.parse(fs.readFileSync(INPUT_PATH, "utf8"));
if (!Array.isArray(parsed)) {
  fail("SOFIFA import file must be a JSON array.");
}

const byTeam = new Map();
for (const row of parsed) {
  const team = String(row.team || "").trim();
  if (!team) continue;
  byTeam.set(team, {
    team,
    overall: toNumber(row.overall),
    attack: toNumber(row.attack),
    midfield: toNumber(row.midfield),
    defense: toNumber(row.defense),
  });
}

const missing = TEAM_NAMES.filter((team) => !byTeam.has(team));
if (missing.length) {
  fail(`SOFIFA import missing teams: ${missing.join(", ")}`);
}

const generatedRows = TEAM_NAMES.map((team) => byTeam.get(team));
const output = `import type { SofifaNationalTeamRow } from "./sofifaNationalTeams";

export const SOFIFA_NATIONAL_TEAMS_GENERATED_AT = ${JSON.stringify(new Date().toISOString())};
export const SOFIFA_NATIONAL_TEAMS_GENERATED_SOURCE = ${JSON.stringify(INPUT_PATH)};
export const SOFIFA_NATIONAL_TEAMS_GENERATED_STATUS = "imported" as const;

export const SOFIFA_NATIONAL_TEAMS_GENERATED: SofifaNationalTeamRow[] = ${JSON.stringify(generatedRows, null, 2)};
`;

fs.writeFileSync(OUTPUT_PATH, output);
console.log(`Wrote ${OUTPUT_PATH}`);

