export type RealDataReplayPoint = [number, number] | null;

export type RealDataReplayFrame = {
  t: number;
  period: number;
  A: RealDataReplayPoint[];
  B: RealDataReplayPoint[];
  ball?: RealDataReplayPoint;
};

export type RealDataReplayAsset = {
  source: string;
  mode: 'position-only-replay' | 'position-ball-replay';
  sampleEverySeconds: number;
  pitch: {
    lengthMeters: number;
    widthMeters: number;
  };
  playerIds: {
    A: string[];
    B: string[];
  };
  frames: RealDataReplayFrame[];
};

export type ReplayWorldPoint = {
  x: number;
  z: number;
};

export type ReplayFacingMode = 'side' | 'front' | 'back';

export type ReplayFacingState = {
  mode: ReplayFacingMode;
  dir: 1 | -1;
  moving: boolean;
};

export type ReplayPitchDimensions = {
  lengthMeters: number;
  widthMeters: number;
};

export function normalizedMetricaPointToWorld(
  point: RealDataReplayPoint,
  fieldWidth: number,
  fieldDepth: number,
  sourcePitch?: ReplayPitchDimensions | null,
  targetPitch?: ReplayPitchDimensions | null,
): ReplayWorldPoint | null {
  if (!point) return null;
  const [x, y] = point;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (
    sourcePitch
    && targetPitch
    && Number.isFinite(sourcePitch.lengthMeters)
    && Number.isFinite(sourcePitch.widthMeters)
    && Number.isFinite(targetPitch.lengthMeters)
    && Number.isFinite(targetPitch.widthMeters)
    && sourcePitch.lengthMeters > 0
    && sourcePitch.widthMeters > 0
    && targetPitch.lengthMeters > 0
    && targetPitch.widthMeters > 0
  ) {
    const worldUnitsPerMeter = fieldWidth / targetPitch.lengthMeters;
    return {
      x: (x - 0.5) * sourcePitch.lengthMeters * worldUnitsPerMeter,
      z: (y - 0.5) * sourcePitch.widthMeters * worldUnitsPerMeter,
    };
  }
  return {
    x: (x - 0.5) * fieldWidth,
    z: (y - 0.5) * fieldDepth,
  };
}

export function interpolateReplayPoint(
  a: RealDataReplayPoint,
  b: RealDataReplayPoint,
  alpha: number,
): RealDataReplayPoint {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  const t = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 0));
  return [
    Number((a[0] + (b[0] - a[0]) * t).toFixed(5)),
    Number((a[1] + (b[1] - a[1]) * t).toFixed(5)),
  ];
}

export function interpolateReplayFrame(
  current: RealDataReplayFrame,
  next: RealDataReplayFrame | null | undefined,
  alpha: number,
): RealDataReplayFrame {
  if (!next || next.period !== current.period) return current;
  const t = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 0));
  const lerpList = (a: RealDataReplayPoint[], b: RealDataReplayPoint[]) =>
    a.map((point, index) => interpolateReplayPoint(point, b[index] ?? null, t));
  return {
    period: current.period,
    t: Number((current.t + (next.t - current.t) * t).toFixed(3)),
    A: lerpList(current.A, next.A),
    B: lerpList(current.B, next.B),
    ball: interpolateReplayPoint(current.ball ?? null, next.ball ?? null, t),
  };
}

export function deriveReplayFacingFromVelocity(
  vx: number,
  vz: number,
  previous: Pick<ReplayFacingState, 'mode' | 'dir'> = { mode: 'side', dir: 1 },
): ReplayFacingState {
  const safeVx = Number.isFinite(vx) ? vx : 0;
  const safeVz = Number.isFinite(vz) ? vz : 0;
  const speedSq = safeVx * safeVx + safeVz * safeVz;
  if (speedSq <= 0.04) {
    return {
      mode: previous.mode,
      dir: previous.dir >= 0 ? 1 : -1,
      moving: false,
    };
  }

  const absVx = Math.abs(safeVx);
  const absVz = Math.abs(safeVz);
  if (absVz > absVx * 1.3 && absVz > 0.8) {
    return {
      mode: safeVz > 0 ? 'front' : 'back',
      dir: previous.dir >= 0 ? 1 : -1,
      moving: true,
    };
  }

  return {
    mode: 'side',
    dir: safeVx >= 0 ? 1 : -1,
    moving: true,
  };
}

export function findReplayFrameIndex(frames: RealDataReplayFrame[], period: number, timeSeconds: number): number {
  if (frames.length === 0) return -1;
  let lo = 0;
  let hi = frames.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const frame = frames[mid];
    if (frame.period < period || (frame.period === period && frame.t <= timeSeconds)) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best >= 0 ? best : 0;
}
