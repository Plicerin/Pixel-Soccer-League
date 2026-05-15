export type FixtureTimeoutReason = 'wall_time' | 'clock_stalled' | 'clock_too_slow' | 'aborted' | 'no_game';

export function computeWatchedFixtureSpeedMul(halfSeconds: number): number {
  void halfSeconds;
  return 1;
}

export function computeFixtureTimeoutMs(input: { halfSeconds: number; speedMul?: number }): number {
  const halfSeconds = Math.max(30, Number(input.halfSeconds) || 300);
  const speedMul = Math.max(1, Number(input.speedMul) || 1);
  const expectedWallMs = (halfSeconds * 2 * 1000) / speedMul;
  return Math.ceil(Math.max(420_000, expectedWallMs * 2 + 120_000));
}

export function getFixtureElapsedSimSeconds(snapshot: any, halfSeconds: number): number {
  const half = Math.max(30, Number(snapshot?.runtimeHalfDuration ?? halfSeconds) || 300);
  if (snapshot?.phase === 'FULL_TIME') return half * 2;
  const clockScale = Math.max(0.001, Number(snapshot?.matchClockScale) || (Number(snapshot?.halfDuration) > half ? Number(snapshot?.halfDuration) / half : 1));
  const elapsed = Math.max(0, Number(snapshot?.elapsedInHalf) || 0);
  return (snapshot?.half === 2 ? half : 0) + Math.min(half, elapsed / clockScale);
}

export function classifyFixtureClockProgress(input: {
  wallElapsedMs: number;
  simElapsedSeconds: number;
  speedMul?: number;
}): FixtureTimeoutReason | null {
  const wallElapsedMs = Math.max(0, Number(input.wallElapsedMs) || 0);
  if (wallElapsedMs < 120_000) return null;
  const speedMul = Math.max(1, Number(input.speedMul) || 1);
  const expectedSimSeconds = (wallElapsedMs / 1000) * speedMul;
  if (expectedSimSeconds <= 0) return null;
  const progressRatio = Math.max(0, Number(input.simElapsedSeconds) || 0) / expectedSimSeconds;
  return progressRatio < 0.1 ? 'clock_too_slow' : null;
}
