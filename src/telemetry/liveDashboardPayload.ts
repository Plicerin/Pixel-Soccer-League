export const LIVE_DASHBOARD_LIMITS = {
  events: 120,
  passLog: 160,
  ballFlightTelemetry: 160,
  visualRealityEvents: 80,
  shapeA: 30,
  shapeB: 30,
  playerPositioning: 60,
  transitions: 50,
  goalLog: 40,
  shotDecisions: 120,
  passDecisions: 160,
  liveEventLog: 60,
  liveShotDecisions: 60,
  livePassDecisions: 60,
} as const;

function tail<T>(value: T, limit: number): T {
  if (!Array.isArray(value)) return value;
  return value.slice(-limit) as T;
}

export function compactLiveDashboardBundle<T extends Record<string, any> | null | undefined>(bundle: T): T {
  if (!bundle) return bundle;
  return {
    ...bundle,
    events: tail(bundle.events, LIVE_DASHBOARD_LIMITS.events),
    passLog: tail(bundle.passLog, LIVE_DASHBOARD_LIMITS.passLog),
    ballFlightTelemetry: tail(bundle.ballFlightTelemetry, LIVE_DASHBOARD_LIMITS.ballFlightTelemetry),
    visualRealityEvents: tail(bundle.visualRealityEvents, LIVE_DASHBOARD_LIMITS.visualRealityEvents),
    shapeA: tail(bundle.shapeA, LIVE_DASHBOARD_LIMITS.shapeA),
    shapeB: tail(bundle.shapeB, LIVE_DASHBOARD_LIMITS.shapeB),
    playerPositioning: tail(bundle.playerPositioning, LIVE_DASHBOARD_LIMITS.playerPositioning),
    transitions: tail(bundle.transitions, LIVE_DASHBOARD_LIMITS.transitions),
    goalLog: tail(bundle.goalLog, LIVE_DASHBOARD_LIMITS.goalLog),
    shotDecisions: tail(bundle.shotDecisions, LIVE_DASHBOARD_LIMITS.shotDecisions),
    passDecisions: tail(bundle.passDecisions, LIVE_DASHBOARD_LIMITS.passDecisions),
  };
}

export function compactLiveDashboardPayload<T extends Record<string, any>>(payload: T): T {
  return {
    ...payload,
    bundle: compactLiveDashboardBundle(payload.bundle),
    live: payload.live
      ? {
          ...payload.live,
          eventLog: tail(payload.live.eventLog, LIVE_DASHBOARD_LIMITS.liveEventLog),
          shotDecisions: tail(payload.live.shotDecisions, LIVE_DASHBOARD_LIMITS.liveShotDecisions),
          passDecisions: tail(payload.live.passDecisions, LIVE_DASHBOARD_LIMITS.livePassDecisions),
        }
      : payload.live,
  };
}
