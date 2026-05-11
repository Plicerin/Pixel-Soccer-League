import type { RoboflowSportsCoachControl } from './roboflowSportsTracking.ts';

export type MetricaEventType =
  | 'SET PIECE'
  | 'RECOVERY'
  | 'PASS'
  | 'BALL LOST'
  | 'BALL OUT'
  | 'SHOT'
  | 'FAULT RECEIVED'
  | 'CHALLENGE'
  | 'CARD';

export type MetricaSampleEventProfile = {
  source: 'metrica-sports/sample-data';
  documentation: 'events-definitions.pdf';
  pitch: {
    lengthMeters: 105;
    widthMeters: 68;
    coordinateSystem: 'normalized_0_1_top_left';
  };
  sampleGames: 2;
  events: {
    total: number;
    byType: Record<MetricaEventType, number>;
  };
  perGame: {
    shots: number;
    shotsPerTeam: number;
    passes: number;
    passesPerTeam: number;
    passesPerShot: number;
    challenges: number;
    recoveries: number;
    ballLost: number;
    setPieces: number;
    corners: number;
    crosses: number;
    throughOrDeepBalls: number;
  };
  shots: {
    total: number;
    onTarget: number;
    goals: number;
    saved: number;
    blocked: number;
    offTarget: number;
    woodwork: number;
    onTargetRate: number;
    blockedRate: number;
    goalRate: number;
  };
  eventDefinitions: {
    possessionEndsWhen: string[];
    pass: string;
    shot: string;
    cross: string;
    throughBall: string;
    deepBall: string;
    blockedShot: string;
    savedShot: string;
    challenge: string;
  };
};

export type MetricaEventCoachState = {
  matchProgress: number;
  teamShots: number;
  teamPasses: number;
  teamCorners: number;
  teamCrosses?: number;
  teamChallenges?: number;
};

export type MetricaEventCoachAdjustment = {
  control: RoboflowSportsCoachControl;
  metrics: {
    expectedShots: number;
    shotDeficit: number;
    passesPerShot: number;
    passRhythmExcess: number;
    expectedCorners: number;
    cornerDeficit: number;
    targetShotsPerTeam: number;
    targetPassesPerShot: number;
  };
};

export const METRICA_SAMPLE_EVENT_PROFILE: MetricaSampleEventProfile = {
  source: 'metrica-sports/sample-data',
  documentation: 'events-definitions.pdf',
  pitch: {
    lengthMeters: 105,
    widthMeters: 68,
    coordinateSystem: 'normalized_0_1_top_left',
  },
  sampleGames: 2,
  events: {
    total: 3680,
    byType: {
      'SET PIECE': 157,
      RECOVERY: 526,
      PASS: 1763,
      'BALL LOST': 490,
      'BALL OUT': 100,
      SHOT: 48,
      'FAULT RECEIVED': 42,
      CHALLENGE: 544,
      CARD: 10,
    },
  },
  perGame: {
    shots: 24.0,
    shotsPerTeam: 12.0,
    passes: 881.5,
    passesPerTeam: 440.75,
    passesPerShot: 36.73,
    challenges: 272.0,
    recoveries: 263.0,
    ballLost: 245.0,
    setPieces: 78.5,
    corners: 9.0,
    crosses: 6.5,
    throughOrDeepBalls: 2.5,
  },
  shots: {
    total: 48,
    onTarget: 21,
    goals: 8,
    saved: 13,
    blocked: 3,
    offTarget: 23,
    woodwork: 1,
    onTargetRate: 21 / 48,
    blockedRate: 3 / 48,
    goalRate: 8 / 48,
  },
  eventDefinitions: {
    possessionEndsWhen: [
      'another player takes over possession',
      'a shot is deflected off the woodwork or another player',
      'the referee significantly deflects the ball',
      'the ball goes out of play',
    ],
    pass: 'possession changes between two players of the same team',
    shot: 'a player attempts a shot towards goal',
    cross: 'an aerial or outer-lane ground pass into the box intended to create a scoring opportunity',
    throughBall: 'a ground pass through opposing defenders to a teammate behind the defensive line',
    deepBall: 'a pass to set up a teammate behind the defensive line',
    blockedShot: 'a goal-bound shot is significantly deflected by a non-last-line defender',
    savedShot: 'the goalkeeper or last line defender averts an on-target shot',
    challenge: 'players engage for possession or to disrupt one another with roughly equal chance at initiation',
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function deriveMetricaEventCoachControl(
  state: MetricaEventCoachState,
  base: RoboflowSportsCoachControl,
  profile: MetricaSampleEventProfile = METRICA_SAMPLE_EVENT_PROFILE,
): MetricaEventCoachAdjustment {
  const progress = clamp(state.matchProgress, 0.04, 1);
  const expectedShots = profile.perGame.shotsPerTeam * progress;
  const shotDeficit = expectedShots - state.teamShots;
  const expectedCorners = (profile.perGame.corners / 2) * progress;
  const cornerDeficit = expectedCorners - state.teamCorners;
  const passesPerShot = state.teamPasses / Math.max(1, state.teamShots);
  const passRhythmExcess = (passesPerShot - profile.perGame.passesPerShot) / profile.perGame.passesPerShot;
  const shotVolumeUrgency = clamp(shotDeficit / 2.4 + passRhythmExcess * 0.45, -0.4, 1.2);
  const widthEventUrgency = clamp(cornerDeficit / 1.4, -0.25, 0.65);

  return {
    control: {
      riskBias: clamp(base.riskBias + Math.max(0, shotVolumeUrgency) * 0.24, -0.5, 0.9),
      shotUrgency: clamp(base.shotUrgency + shotVolumeUrgency * 0.44, -0.55, 1.05),
      passRiskTolerance: clamp(base.passRiskTolerance + Math.max(0, shotVolumeUrgency) * 0.18, -0.45, 1.0),
      widthUrgency: clamp(base.widthUrgency + widthEventUrgency * 0.34, -0.45, 0.95),
      supportUrgency: clamp(base.supportUrgency + Math.max(0, passRhythmExcess) * 0.12, -0.35, 0.9),
      releaseUrgency: clamp(base.releaseUrgency + Math.max(0, shotVolumeUrgency) * 0.55, -0.35, 1.15),
      defensivePressBias: base.defensivePressBias,
    },
    metrics: {
      expectedShots,
      shotDeficit,
      passesPerShot,
      passRhythmExcess,
      expectedCorners,
      cornerDeficit,
      targetShotsPerTeam: profile.perGame.shotsPerTeam,
      targetPassesPerShot: profile.perGame.passesPerShot,
    },
  };
}
