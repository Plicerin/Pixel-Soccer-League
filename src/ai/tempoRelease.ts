export type TempoReleaseRole = 'NEAR_POST' | 'FAR_POST' | 'CUTBACK' | 'SECOND_WAVE';

export type TempoReleaseTarget = {
  role: TempoReleaseRole;
  finishLane: boolean;
  laneAcceptable: boolean;
  laneBlocked: boolean;
  passDist: number;
  maxPassDist: number;
  oppSpace: number;
  forwardProg: number;
  score: number;
};

export type TempoReleaseContext = {
  secondsSinceIntentStart: number;
  structuredTouchCount: number;
  coachWaitCapHit: boolean;
  carrierWideEnough: boolean;
  carrierAdvancedEnough: boolean;
};

export type TempoReleaseDecision<T extends TempoReleaseTarget> = {
  ready: boolean;
  target: T | null;
  reason: 'tempo_age' | 'setup_complete' | 'coach_wait_cap' | 'not_ready' | 'no_central_finish';
};

function tempoReason(input: TempoReleaseContext): TempoReleaseDecision<TempoReleaseTarget>['reason'] {
  if (input.coachWaitCapHit) return 'coach_wait_cap';
  if (input.structuredTouchCount >= 2) return 'setup_complete';
  if (input.secondsSinceIntentStart >= 2.15) return 'tempo_age';
  return 'not_ready';
}

function centralTempoScore(entry: TempoReleaseTarget) {
  return (
    (entry.role === 'SECOND_WAVE' ? 3.4 : 3.1)
    + (entry.finishLane ? 2.4 : -4.0)
    + Math.max(-0.6, Math.min(1.4, (entry.oppSpace - 1.0) / 2.8))
    - Math.max(0, entry.passDist - entry.maxPassDist) * 0.18
    + Math.max(-0.4, Math.min(0.8, (entry.forwardProg + 2.0) / 10.0))
    + entry.score * 0.08
  );
}

export function chooseTempoReleaseTarget<T extends TempoReleaseTarget>(
  targets: T[],
  context: TempoReleaseContext,
): TempoReleaseDecision<T> {
  const reason = tempoReason(context);
  const ready = reason !== 'not_ready' && context.carrierWideEnough && context.carrierAdvancedEnough;
  if (!ready) return { ready: false, target: null, reason: 'not_ready' };

  const central = targets
    .filter((entry) =>
      (entry.role === 'SECOND_WAVE' || entry.role === 'CUTBACK')
      && entry.finishLane
      && entry.laneAcceptable
      && !entry.laneBlocked
      && entry.passDist <= entry.maxPassDist + 3.5
      && entry.oppSpace >= 0.85
      && entry.forwardProg > -10.0
    )
    .sort((a, b) => centralTempoScore(b) - centralTempoScore(a));

  return {
    ready: true,
    target: central[0] || null,
    reason: central[0] ? reason : 'no_central_finish',
  };
}
