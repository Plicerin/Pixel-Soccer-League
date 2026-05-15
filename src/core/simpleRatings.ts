import { getMLS2025TeamModifiers } from "../mlsTeamStats2025";
import type { SimpleRole } from "./simpleFormations";

export type SimplePlayerRatings = {
  pace: number;
  passing: number;
  shooting: number;
  defense: number;
  keeper: number;
};

export type SimpleTeamTuning = {
  attack: number;
  defense: number;
  tempo: number;
  possession: number;
};

const ROLE_BASE: Record<SimpleRole, SimplePlayerRatings> = {
  GK: { pace: 0.42, passing: 0.56, shooting: 0.08, defense: 0.35, keeper: 0.68 },
  CB: { pace: 0.55, passing: 0.60, shooting: 0.18, defense: 0.72, keeper: 0.05 },
  FB: { pace: 0.68, passing: 0.62, shooting: 0.24, defense: 0.63, keeper: 0.05 },
  DM: { pace: 0.61, passing: 0.69, shooting: 0.32, defense: 0.70, keeper: 0.05 },
  CM: { pace: 0.64, passing: 0.72, shooting: 0.42, defense: 0.58, keeper: 0.05 },
  AM: { pace: 0.67, passing: 0.74, shooting: 0.58, defense: 0.42, keeper: 0.05 },
  W: { pace: 0.75, passing: 0.66, shooting: 0.55, defense: 0.38, keeper: 0.05 },
  ST: { pace: 0.70, passing: 0.58, shooting: 0.72, defense: 0.28, keeper: 0.05 },
};

const HISTORIC_FINAL_ROSTERS: Record<string, string[]> = {
  "Italy 1982": [
    "Dino Zoff",
    "Gaetano Scirea",
    "Giuseppe Bergomi",
    "Claudio Gentile",
    "Fulvio Collovati",
    "Antonio Cabrini",
    "Gabriele Oriali",
    "Marco Tardelli",
    "Bruno Conti",
    "Francesco Graziani",
    "Paolo Rossi",
  ],
  "West Germany 1982": [
    "Harald Schumacher",
    "Uli Stielike",
    "Manfred Kaltz",
    "Karlheinz Förster",
    "Bernd Förster",
    "Hans-Peter Briegel",
    "Wolfgang Dremmler",
    "Paul Breitner",
    "Karl-Heinz Rummenigge",
    "Pierre Littbarski",
    "Klaus Fischer",
  ],
};

function clamp01(value: number) {
  return Math.max(0.05, Math.min(0.95, value));
}

export function getTeamTuning(teamName: string): SimpleTeamTuning {
  const modifiers = getMLS2025TeamModifiers(teamName);
  if (!modifiers) {
    return { attack: 0.5, defense: 0.5, tempo: 0.5, possession: 0.5 };
  }
  return {
    attack: clamp01(0.5 + modifiers.attackCentered * 0.18),
    defense: clamp01(0.5 + modifiers.defenseCentered * 0.16),
    tempo: clamp01(0.5 + modifiers.overallCentered * 0.10 + modifiers.attackCentered * 0.06),
    possession: clamp01(0.5 + modifiers.overallCentered * 0.08 + modifiers.defenseCentered * 0.04),
  };
}

export function getRoleRatings(role: SimpleRole, teamName: string, playerIndex: number): SimplePlayerRatings {
  const base = ROLE_BASE[role];
  const tuning = getTeamTuning(teamName);
  const variation = (((playerIndex * 37) % 11) - 5) / 100;
  const attackBoost = (tuning.attack - 0.5) * 0.28;
  const defenseBoost = (tuning.defense - 0.5) * 0.26;
  const possessionBoost = (tuning.possession - 0.5) * 0.20;
  return {
    pace: clamp01(base.pace + variation + (tuning.tempo - 0.5) * 0.16),
    passing: clamp01(base.passing + variation * 0.6 + possessionBoost),
    shooting: clamp01(base.shooting + variation * 0.5 + attackBoost),
    defense: clamp01(base.defense + variation * 0.5 + defenseBoost),
    keeper: clamp01(base.keeper + (role === "GK" ? defenseBoost * 0.6 : 0)),
  };
}

export function defaultPlayerName(teamName: string, role: SimpleRole, label: string, index: number) {
  const historicName = HISTORIC_FINAL_ROSTERS[teamName]?.[index];
  if (historicName) return historicName;

  const prefix = teamName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase() || "PSL";
  return `${prefix} ${label || role} ${index + 1}`;
}
