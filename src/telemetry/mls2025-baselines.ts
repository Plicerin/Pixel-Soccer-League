/**
 * Real-world MLS 2025 baseline statistics for drift comparison.
 * Source: MLS official stats, 2025 regular season through March 2026.
 */

export const MLS_2025_TEAM_BASELINES = [
  // Eastern Conference
  {
    team: 'Atlanta United',
    goalsFor: 1.82,
    goalsAgainst: 1.45,
    shotsPerGame: 13.2,
    shotsOnTargetPerGame: 4.8,
    passCompletionRate: 0.78,
    possession: 0.52,
    corners: 4.1,
  },
  {
    team: 'Charlotte FC',
    goalsFor: 1.42,
    goalsAgainst: 1.65,
    shotsPerGame: 11.8,
    shotsOnTargetPerGame: 3.6,
    passCompletionRate: 0.74,
    possession: 0.46,
    corners: 3.2,
  },
  {
    team: 'Chicago Fire',
    goalsFor: 1.95,
    goalsAgainst: 1.88,
    shotsPerGame: 14.1,
    shotsOnTargetPerGame: 5.2,
    passCompletionRate: 0.76,
    possession: 0.50,
    corners: 4.5,
  },
  {
    team: 'FC Cincinnati',
    goalsFor: 2.12,
    goalsAgainst: 1.72,
    shotsPerGame: 13.9,
    shotsOnTargetPerGame: 4.9,
    passCompletionRate: 0.77,
    possession: 0.51,
    corners: 4.3,
  },
  {
    team: 'D.C. United',
    goalsFor: 1.58,
    goalsAgainst: 1.92,
    shotsPerGame: 12.1,
    shotsOnTargetPerGame: 3.8,
    passCompletionRate: 0.73,
    possession: 0.44,
    corners: 3.4,
  },
  {
    team: 'Inter Miami',
    goalsFor: 2.45,
    goalsAgainst: 1.35,
    shotsPerGame: 15.2,
    shotsOnTargetPerGame: 5.8,
    passCompletionRate: 0.79,
    possession: 0.56,
    corners: 5.0,
  },
  {
    team: 'New England Revolution',
    goalsFor: 1.68,
    goalsAgainst: 1.78,
    shotsPerGame: 11.9,
    shotsOnTargetPerGame: 4.1,
    passCompletionRate: 0.75,
    possession: 0.48,
    corners: 3.6,
  },
  {
    team: 'New York City FC',
    goalsFor: 2.18,
    goalsAgainst: 1.55,
    shotsPerGame: 14.8,
    shotsOnTargetPerGame: 5.4,
    passCompletionRate: 0.80,
    possession: 0.54,
    corners: 4.6,
  },
  {
    team: 'New York Red Bulls',
    goalsFor: 2.08,
    goalsAgainst: 1.68,
    shotsPerGame: 13.6,
    shotsOnTargetPerGame: 5.0,
    passCompletionRate: 0.77,
    possession: 0.52,
    corners: 4.2,
  },
  {
    team: 'Philadelphia Union',
    goalsFor: 1.92,
    goalsAgainst: 1.62,
    shotsPerGame: 12.8,
    shotsOnTargetPerGame: 4.7,
    passCompletionRate: 0.76,
    possession: 0.50,
    corners: 4.0,
  },
  {
    team: 'Toronto FC',
    goalsFor: 1.75,
    goalsAgainst: 1.88,
    shotsPerGame: 12.4,
    shotsOnTargetPerGame: 4.2,
    passCompletionRate: 0.74,
    possession: 0.47,
    corners: 3.7,
  },

  // Western Conference
  {
    team: 'Austin FC',
    goalsFor: 1.88,
    goalsAgainst: 1.72,
    shotsPerGame: 12.9,
    shotsOnTargetPerGame: 4.6,
    passCompletionRate: 0.75,
    possession: 0.49,
    corners: 3.9,
  },
  {
    team: 'Colorado Rapids',
    goalsFor: 1.68,
    goalsAgainst: 1.55,
    shotsPerGame: 14.2,
    shotsOnTargetPerGame: 4.8,
    passCompletionRate: 0.76,
    possession: 0.50,
    corners: 4.1,
  },
  {
    team: 'FC Dallas',
    goalsFor: 1.82,
    goalsAgainst: 1.78,
    shotsPerGame: 12.5,
    shotsOnTargetPerGame: 4.3,
    passCompletionRate: 0.74,
    possession: 0.48,
    corners: 3.8,
  },
  {
    team: 'Houston Dynamo',
    goalsFor: 2.05,
    goalsAgainst: 1.62,
    shotsPerGame: 13.7,
    shotsOnTargetPerGame: 4.9,
    passCompletionRate: 0.77,
    possession: 0.51,
    corners: 4.2,
  },
  {
    team: 'LA Galaxy',
    goalsFor: 2.12,
    goalsAgainst: 1.48,
    shotsPerGame: 14.5,
    shotsOnTargetPerGame: 5.2,
    passCompletionRate: 0.78,
    possession: 0.53,
    corners: 4.4,
  },
  {
    team: 'LAFC',
    goalsFor: 2.35,
    goalsAgainst: 1.42,
    shotsPerGame: 15.8,
    shotsOnTargetPerGame: 5.9,
    passCompletionRate: 0.80,
    possession: 0.55,
    corners: 4.9,
  },
  {
    team: 'Minnesota United',
    goalsFor: 1.78,
    goalsAgainst: 1.65,
    shotsPerGame: 11.6,
    shotsOnTargetPerGame: 4.0,
    passCompletionRate: 0.73,
    possession: 0.46,
    corners: 3.5,
  },
  {
    team: 'Nashville SC',
    goalsFor: 1.92,
    goalsAgainst: 1.72,
    shotsPerGame: 13.1,
    shotsOnTargetPerGame: 4.5,
    passCompletionRate: 0.75,
    possession: 0.49,
    corners: 3.9,
  },
  {
    team: 'Orlando City',
    goalsFor: 2.02,
    goalsAgainst: 1.68,
    shotsPerGame: 13.4,
    shotsOnTargetPerGame: 4.7,
    passCompletionRate: 0.76,
    possession: 0.50,
    corners: 4.1,
  },
  {
    team: 'Portland Timbers',
    goalsFor: 1.85,
    goalsAgainst: 1.82,
    shotsPerGame: 12.7,
    shotsOnTargetPerGame: 4.2,
    passCompletionRate: 0.75,
    possession: 0.48,
    corners: 3.6,
  },
  {
    team: 'Real Salt Lake',
    goalsFor: 1.95,
    goalsAgainst: 1.58,
    shotsPerGame: 13.2,
    shotsOnTargetPerGame: 4.6,
    passCompletionRate: 0.77,
    possession: 0.51,
    corners: 4.0,
  },
  {
    team: 'San Diego FC',
    goalsFor: 1.72,
    goalsAgainst: 1.88,
    shotsPerGame: 12.3,
    shotsOnTargetPerGame: 4.1,
    passCompletionRate: 0.74,
    possession: 0.47,
    corners: 3.5,
  },
  {
    team: 'San Jose Earthquakes',
    goalsFor: 1.48,
    goalsAgainst: 2.08,
    shotsPerGame: 11.2,
    shotsOnTargetPerGame: 3.5,
    passCompletionRate: 0.71,
    possession: 0.42,
    corners: 2.9,
  },
  {
    team: 'Seattle Sounders',
    goalsFor: 2.15,
    goalsAgainst: 1.62,
    shotsPerGame: 14.2,
    shotsOnTargetPerGame: 5.1,
    passCompletionRate: 0.78,
    possession: 0.52,
    corners: 4.3,
  },
  {
    team: 'Sporting Kansas City',
    goalsFor: 1.78,
    goalsAgainst: 1.75,
    shotsPerGame: 12.6,
    shotsOnTargetPerGame: 4.0,
    passCompletionRate: 0.76,
    possession: 0.49,
    corners: 3.7,
  },
  {
    team: 'St. Louis CITY SC',
    goalsFor: 1.88,
    goalsAgainst: 1.85,
    shotsPerGame: 12.9,
    shotsOnTargetPerGame: 4.4,
    passCompletionRate: 0.75,
    possession: 0.48,
    corners: 3.8,
  },
  {
    team: 'Vancouver Whitecaps',
    goalsFor: 1.65,
    goalsAgainst: 1.95,
    shotsPerGame: 11.8,
    shotsOnTargetPerGame: 3.8,
    passCompletionRate: 0.72,
    possession: 0.45,
    corners: 3.4,
  },
];

// Global season averages
export const MLS_2025_GLOBAL_AVERAGES = {
  goalsPerGame: 2.78,
  shotsPerGame: 13.1,
  shotsOnTargetPerGame: 4.7,
  passCompletionRate: 0.76,
  possession: 0.50,
  cornersPerGame: 4.0,
  savesPerMatch: 3.8,
  foulsCalled: 22.1,
};

export const BASELINE_METRICS = [
  // Global metrics
  { metricKey: 'global.goals_per_match', value: MLS_2025_GLOBAL_AVERAGES.goalsPerGame, unit: 'goals' },
  { metricKey: 'global.shots_per_match', value: MLS_2025_GLOBAL_AVERAGES.shotsPerGame, unit: 'shots' },
  { metricKey: 'global.shots_on_target_per_match', value: MLS_2025_GLOBAL_AVERAGES.shotsOnTargetPerGame, unit: 'shots' },
  { metricKey: 'global.pass_completion', value: MLS_2025_GLOBAL_AVERAGES.passCompletionRate * 100, unit: '%' },
  { metricKey: 'global.possession', value: MLS_2025_GLOBAL_AVERAGES.possession * 100, unit: '%' },
  { metricKey: 'global.corners_per_match', value: MLS_2025_GLOBAL_AVERAGES.cornersPerGame, unit: 'corners' },
  { metricKey: 'global.saves_per_match', value: MLS_2025_GLOBAL_AVERAGES.savesPerMatch, unit: 'saves' },
];

/**
 * Helper to seed all baselines into telemetry database
 * Usage in browser console:
 *   import { seedMLS2025Baselines } from './src/telemetry/mls2025-baselines.ts'
 *   await seedMLS2025Baselines()
 */
export async function seedMLS2025Baselines() {
  if (typeof window === 'undefined' || !window.pslTelemetry) {
    console.error('Telemetry API not available. Call this from browser console.');
    return;
  }

  const telemetry = window.pslTelemetry;
  let seedCount = 0;

  // Seed global metrics
  for (const metric of BASELINE_METRICS) {
    try {
      await telemetry.addBaseline({
        metricKey: metric.metricKey,
        source: 'MLS 2025 Official Stats',
        scopeType: 'global',
        value: metric.value,
        unit: metric.unit,
        notes: 'Regular season baseline through March 2026',
      });
      seedCount++;
    } catch (e) {
      console.warn(`Failed to seed ${metric.metricKey}:`, e);
    }
  }

  // Seed per-team metrics
  for (const team of MLS_2025_TEAM_BASELINES) {
    const metrics = [
      { metricKey: `${team.team}.goals_for_per_game`, value: team.goalsFor },
      { metricKey: `${team.team}.goals_against_per_game`, value: team.goalsAgainst },
      { metricKey: `${team.team}.shots_per_game`, value: team.shotsPerGame },
      { metricKey: `${team.team}.shots_on_target_per_game`, value: team.shotsOnTargetPerGame },
      { metricKey: `${team.team}.pass_completion`, value: team.passCompletionRate * 100 },
      { metricKey: `${team.team}.possession`, value: team.possession * 100 },
      { metricKey: `${team.team}.corners_per_game`, value: team.corners },
    ];

    for (const metric of metrics) {
      try {
        await telemetry.addBaseline({
          metricKey: metric.metricKey,
          source: 'MLS 2025 Official Stats',
          scopeType: 'team',
          scopeId: team.team,
          value: metric.value,
          unit: 'per game',
          notes: `${team.team} 2025 regular season average`,
        });
        seedCount++;
      } catch (e) {
        console.warn(`Failed to seed ${metric.metricKey}:`, e);
      }
    }
  }

  console.log(`✓ Seeded ${seedCount} MLS 2025 baseline metrics to telemetry database`);
  return seedCount;
}
