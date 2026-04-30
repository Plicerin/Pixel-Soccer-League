export type DirectorIntent =
  | 'WING_OVERLOAD'
  | 'CENTRAL_COMBO'
  | 'COUNTER'
  | 'RECYCLE'
  | 'NONE';

export type DirectorTargets = {
  teamWidthMeters: {
    buildup: number;
    progression: number;
    finalThird: number;
  };
  supportDistanceMeters: {
    preferredMin: number;
    preferredMedian: number;
    preferredMax: number;
  };
  crossTimingSecondsAfterWideEntry: {
    preferredMin: number;
    preferredMedian: number;
    preferredMax: number;
  };
  boxAttackersBeforeCross: {
    preferredMin: number;
    preferredMedian: number;
  };
  dangerousAttackerDefenderDistanceMeters: {
    preferredMedian: number;
    upperWarning: number;
  };
};

export type PossessionDirectorSnapshot = {
  active: boolean;
  team: 'A' | 'B' | '';
  intent: DirectorIntent;
  reason: string;
  targetWidth: number | null;
  supportDistance: { min: number; median: number; max: number };
  crossDelaySeconds: { min: number; median: number; max: number };
  minBoxAttackersBeforeCross: number;
  currentBoxAttackers: number;
  dangerousMarkDistance: { median: number; warning: number };
  action: 'carry' | 'deliver' | 'reset' | 'observe';
};

export const METRICA_DIRECTOR_TARGETS: DirectorTargets = {
  teamWidthMeters: {
    buildup: 37.71,
    progression: 48.5,
    finalThird: 42.86,
  },
  supportDistanceMeters: {
    preferredMin: 5.58,
    preferredMedian: 8.35,
    preferredMax: 11.28,
  },
  crossTimingSecondsAfterWideEntry: {
    preferredMin: 0,
    preferredMedian: 0,
    preferredMax: 1.6,
  },
  boxAttackersBeforeCross: {
    preferredMin: 2,
    preferredMedian: 3,
  },
  dangerousAttackerDefenderDistanceMeters: {
    preferredMedian: 3.47,
    upperWarning: 6.12,
  },
};

export function emptyDirectorSnapshot(): PossessionDirectorSnapshot {
  return {
    active: false,
    team: '',
    intent: 'NONE',
    reason: 'no_possession_intent',
    targetWidth: null,
    supportDistance: { min: 0, median: 0, max: 0 },
    crossDelaySeconds: { min: 0, median: 0, max: 0 },
    minBoxAttackersBeforeCross: 0,
    currentBoxAttackers: 0,
    dangerousMarkDistance: { median: 0, warning: 0 },
    action: 'observe',
  };
}

export function makeDirectorSnapshot(input: {
  team: 'A' | 'B';
  intent: DirectorIntent;
  phase: 'buildup' | 'progression' | 'finalThird';
  currentBoxAttackers?: number;
  action?: PossessionDirectorSnapshot['action'];
  reason?: string;
  targets?: DirectorTargets;
}): PossessionDirectorSnapshot {
  const targets = input.targets ?? METRICA_DIRECTOR_TARGETS;
  return {
    active: true,
    team: input.team,
    intent: input.intent,
    reason: input.reason ?? 'real_movement_profile',
    targetWidth: targets.teamWidthMeters[input.phase],
    supportDistance: {
      min: targets.supportDistanceMeters.preferredMin,
      median: targets.supportDistanceMeters.preferredMedian,
      max: targets.supportDistanceMeters.preferredMax,
    },
    crossDelaySeconds: {
      min: targets.crossTimingSecondsAfterWideEntry.preferredMin,
      median: targets.crossTimingSecondsAfterWideEntry.preferredMedian,
      max: targets.crossTimingSecondsAfterWideEntry.preferredMax,
    },
    minBoxAttackersBeforeCross: targets.boxAttackersBeforeCross.preferredMin,
    currentBoxAttackers: input.currentBoxAttackers ?? 0,
    dangerousMarkDistance: {
      median: targets.dangerousAttackerDefenderDistanceMeters.preferredMedian,
      warning: targets.dangerousAttackerDefenderDistanceMeters.upperWarning,
    },
    action: input.action ?? 'observe',
  };
}

export function shouldHoldWideDeliveryForDirector(input: {
  boxAttackers: number;
  secondsSinceIntentStart: number;
  targets?: DirectorTargets;
}): { hold: boolean; reason: string } {
  const targets = input.targets ?? METRICA_DIRECTOR_TARGETS;
  const minBoxAttackers = targets.boxAttackersBeforeCross.preferredMin;
  const maxSettleSeconds = Math.max(0.8, targets.crossTimingSecondsAfterWideEntry.preferredMax);
  if (input.boxAttackers >= minBoxAttackers) return { hold: false, reason: 'box_ready' };
  if (input.secondsSinceIntentStart < maxSettleSeconds) return { hold: true, reason: 'waiting_for_box_runners' };
  return { hold: false, reason: 'settle_window_expired' };
}
