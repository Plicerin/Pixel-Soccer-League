import { METRICA_DIRECTOR_TARGETS } from './possessionDirector.ts';
import {
  ROBOFLOW_SPORTS_SOCCER_PITCH,
  type RoboflowSportsCoachControl,
} from './roboflowSportsTracking.ts';
import { METRICA_SAMPLE_EVENT_PROFILE, type MetricaSampleEventProfile } from './metricaEventModel.ts';

export type TelemetryCoachPhase = 'buildup' | 'progression' | 'finalThird';
export type TelemetryCoachRole =
  | 'CARRIER'
  | 'NEAR_POST'
  | 'FAR_POST'
  | 'CUTBACK'
  | 'SECOND_WAVE'
  | 'WIDE_OUTLET'
  | 'SAFETY';

export type TelemetryCoachFinalActionRole = 'CUTBACK' | 'SECOND_WAVE' | 'NEAR_POST' | 'FAR_POST';

export type TelemetryOpponentCoachThreatMemory = Record<TelemetryCoachFinalActionRole, number>;

export type TelemetryOpponentCoachAdjustment = {
  primaryThreat: TelemetryCoachFinalActionRole | 'BALANCED';
  confidence: number;
  overCoverRoles: TelemetryCoachFinalActionRole[];
  pressCarrier: boolean;
};

export type TelemetryCoachPlan = {
  id: 'real_movement_cutback_control_v1';
  source: 'roboflow_sports_realtime_tracking_profile';
  attackingPrinciples: {
    targetWidth: Record<TelemetryCoachPhase, number>;
    supportDistance: { min: number; median: number; max: number };
    maxCrossDelaySeconds: number;
    minBoxAttackersBeforeDelivery: number;
    finishDistance: { min: number; max: number; secondWaveMax: number };
  };
  deliveryPriority: Array<'CUTBACK' | 'SECOND_WAVE' | 'NEAR_POST' | 'FAR_POST'>;
  suppressions: {
    undefinedDeliveries: true;
    longCentralStrikerShots: true;
    earlyLoftedCrosses: true;
  };
  positionalTracking: {
    source: 'roboflow/sports';
    mode: 'RADAR';
    pitch: {
      lengthMeters: 120;
      widthMeters: 70;
      coordinateSystem: 'radar_pitch_meters';
    };
    frameInputs: Array<'player_detection' | 'player_tracking' | 'team_classification' | 'pitch_keypoints' | 'ball_detection'>;
    learnedControl: RoboflowSportsCoachControl;
  };
  eventModel: MetricaSampleEventProfile;
};

export function createTelemetryCoachPlanFromRealMovement(): TelemetryCoachPlan {
  const targets = METRICA_DIRECTOR_TARGETS;
  return {
    id: 'real_movement_cutback_control_v1',
    source: 'roboflow_sports_realtime_tracking_profile',
    attackingPrinciples: {
      targetWidth: targets.teamWidthMeters,
      supportDistance: {
        min: targets.supportDistanceMeters.preferredMin,
        median: targets.supportDistanceMeters.preferredMedian,
        max: targets.supportDistanceMeters.preferredMax,
      },
      maxCrossDelaySeconds: targets.crossTimingSecondsAfterWideEntry.preferredMax,
      minBoxAttackersBeforeDelivery: targets.boxAttackersBeforeCross.preferredMedian,
      finishDistance: {
        min: 6.0,
        max: 15.8,
        secondWaveMax: 18.0,
      },
    },
    deliveryPriority: ['CUTBACK', 'SECOND_WAVE', 'NEAR_POST', 'FAR_POST'],
    suppressions: {
      undefinedDeliveries: true,
      longCentralStrikerShots: true,
      earlyLoftedCrosses: true,
    },
    positionalTracking: {
      source: 'roboflow/sports',
      mode: 'RADAR',
      pitch: {
        lengthMeters: ROBOFLOW_SPORTS_SOCCER_PITCH.lengthMeters,
        widthMeters: ROBOFLOW_SPORTS_SOCCER_PITCH.widthMeters,
        coordinateSystem: 'radar_pitch_meters',
      },
      frameInputs: ['player_detection', 'player_tracking', 'team_classification', 'pitch_keypoints', 'ball_detection'],
      learnedControl: {
        riskBias: 0.08,
        shotUrgency: 0.10,
        passRiskTolerance: 0.18,
        widthUrgency: 0.20,
        supportUrgency: 0.18,
        releaseUrgency: 0.16,
        defensivePressBias: 0.12,
      },
    },
    eventModel: METRICA_SAMPLE_EVENT_PROFILE,
  };
}

export function isTelemetryCoachExperimentEnabled(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get('telemetryCoach') === '1' || params.get('coach') === 'telemetry';
}

export function shouldTelemetryCoachSuppressStrikerShot(input: {
  role: string;
  distToGoal: number;
  inTapInZone: boolean;
  faceToFaceWithKeeper: boolean;
  keeperProximityShotForce: boolean;
  shotLaneBlocked: boolean;
  closePressure: number;
  plan?: TelemetryCoachPlan;
}): boolean {
  const plan = input.plan ?? createTelemetryCoachPlanFromRealMovement();
  if (!plan.suppressions.longCentralStrikerShots) return false;
  if (input.role.toUpperCase() !== 'ST') return false;
  if (input.inTapInZone || input.faceToFaceWithKeeper || input.keeperProximityShotForce) return false;
  if (input.distToGoal <= plan.attackingPrinciples.finishDistance.max) return false;
  return input.shotLaneBlocked || input.closePressure >= 1 || input.distToGoal >= 18.0;
}

export function createTelemetryOpponentCoachThreatMemory(): TelemetryOpponentCoachThreatMemory {
  return {
    CUTBACK: 0,
    SECOND_WAVE: 0,
    NEAR_POST: 0,
    FAR_POST: 0,
  };
}

export function recordTelemetryOpponentCoachThreat(
  memory: TelemetryOpponentCoachThreatMemory,
  role: string,
): TelemetryOpponentCoachThreatMemory {
  const normalized = role.toUpperCase() as TelemetryCoachFinalActionRole;
  if (!['CUTBACK', 'SECOND_WAVE', 'NEAR_POST', 'FAR_POST'].includes(normalized)) return memory;
  return {
    CUTBACK: memory.CUTBACK,
    SECOND_WAVE: memory.SECOND_WAVE,
    NEAR_POST: memory.NEAR_POST,
    FAR_POST: memory.FAR_POST,
    [normalized]: memory[normalized] + 1,
  };
}

export function chooseTelemetryOpponentCoachAdjustment(
  memory: TelemetryOpponentCoachThreatMemory,
): TelemetryOpponentCoachAdjustment {
  const entries = Object.entries(memory) as Array<[TelemetryCoachFinalActionRole, number]>;
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const [primaryThreat, primaryCount] = entries.sort((a, b) => b[1] - a[1])[0] || ['CUTBACK', 0];
  if (total < 3 || primaryCount < 2) {
    return {
      primaryThreat: 'BALANCED',
      confidence: 0,
      overCoverRoles: [],
      pressCarrier: false,
    };
  }
  const confidence = primaryCount / total;
  const overCoverRoles: TelemetryCoachFinalActionRole[] =
    primaryThreat === 'NEAR_POST' ? ['NEAR_POST', 'CUTBACK']
    : primaryThreat === 'CUTBACK' ? ['CUTBACK', 'SECOND_WAVE']
    : primaryThreat === 'SECOND_WAVE' ? ['SECOND_WAVE', 'CUTBACK']
    : ['FAR_POST', 'NEAR_POST'];
  return {
    primaryThreat,
    confidence,
    overCoverRoles,
    pressCarrier: primaryThreat === 'CUTBACK' || primaryThreat === 'SECOND_WAVE',
  };
}

export function chooseTelemetryCoachCounterActionRole(input: {
  deliveryPriority: TelemetryCoachFinalActionRole[];
  availableRoles: TelemetryCoachFinalActionRole[];
  opponentAdjustment?: TelemetryOpponentCoachAdjustment | null;
}): TelemetryCoachFinalActionRole | null {
  const available = input.deliveryPriority.filter((role) => input.availableRoles.includes(role));
  if (available.length === 0) return null;
  const adjustment = input.opponentAdjustment;
  if (!adjustment || adjustment.primaryThreat === 'BALANCED' || adjustment.confidence < 0.55) return available[0];

  const covered = new Set<TelemetryCoachFinalActionRole>(adjustment.overCoverRoles);
  const uncovered = available.find((role) => !covered.has(role));
  if (uncovered) return uncovered;

  return available
    .slice()
    .sort((a, b) => {
      const coverPenalty = (role: TelemetryCoachFinalActionRole) =>
        (role === adjustment.primaryThreat ? 2 : 0) + (covered.has(role) ? 1 : 0);
      return coverPenalty(a) - coverPenalty(b);
    })[0];
}
