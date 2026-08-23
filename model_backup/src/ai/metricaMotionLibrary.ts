import type { RealDataReplayAsset, RealDataReplayFrame, RealDataReplayPoint } from './realDataReplay.ts';

export type MetricaMotionSourceTeam = 'A' | 'B';

export type MetricaMotionFrameMatch = {
  frameIndex: number;
  sourceTeam: MetricaMotionSourceTeam;
  sourceAttackSign: 1 | -1;
  score: number;
  confidence: number;
};

export type MetricaMotionQuery = {
  ball: { x: number; z: number };
  attackSign: 1 | -1;
  fieldWidth: number;
  fieldDepth: number;
  sourcePitch: { lengthMeters: number; widthMeters: number };
  targetPitch: { lengthMeters: number; widthMeters: number };
  stride?: number;
};

export type MetricaMotionTarget = {
  x: number;
  z: number;
  sourcePlayerIndex: number;
  frameIndex: number;
  sourceTeam: MetricaMotionSourceTeam;
  confidence: number;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function sourceWorldSpan(
  fieldWidth: number,
  sourcePitch: MetricaMotionQuery['sourcePitch'],
  targetPitch: MetricaMotionQuery['targetPitch'],
) {
  const unitsPerMeter = fieldWidth / targetPitch.lengthMeters;
  return {
    width: sourcePitch.lengthMeters * unitsPerMeter,
    depth: sourcePitch.widthMeters * unitsPerMeter,
  };
}

export function worldPointToSourceNormalized(
  point: { x: number; z: number },
  fieldWidth: number,
  sourcePitch: MetricaMotionQuery['sourcePitch'],
  targetPitch: MetricaMotionQuery['targetPitch'],
): [number, number] {
  const span = sourceWorldSpan(fieldWidth, sourcePitch, targetPitch);
  return [
    clamp01(0.5 + point.x / Math.max(0.001, span.width)),
    clamp01(0.5 + point.z / Math.max(0.001, span.depth)),
  ];
}

function sourceAttackSignFor(team: MetricaMotionSourceTeam, period: number): 1 | -1 {
  if (team === 'A') return period === 1 ? 1 : -1;
  return period === 1 ? -1 : 1;
}

function attackNormalized(point: RealDataReplayPoint, attackSign: 1 | -1): { x: number; z: number } | null {
  if (!point) return null;
  const [x, z] = point;
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return {
    x: attackSign > 0 ? x : 1 - x,
    z,
  };
}

function frameBall(frame: RealDataReplayFrame): RealDataReplayPoint {
  return frame.ball ?? null;
}

export function selectMetricaMotionFrame(
  asset: RealDataReplayAsset,
  query: MetricaMotionQuery,
): MetricaMotionFrameMatch | null {
  if (!asset.frames.length) return null;
  const queryBall = worldPointToSourceNormalized(query.ball, query.fieldWidth, query.sourcePitch, query.targetPitch);
  const queryAttackBall = attackNormalized(queryBall, query.attackSign);
  if (!queryAttackBall) return null;
  const stride = Math.max(1, Math.floor(query.stride ?? 6));
  let best: MetricaMotionFrameMatch | null = null;

  for (let i = 0; i < asset.frames.length; i += stride) {
    const frame = asset.frames[i];
    for (const sourceTeam of ['A', 'B'] as const) {
      const sourceAttackSign = sourceAttackSignFor(sourceTeam, frame.period);
      if (sourceAttackSign !== query.attackSign) continue;
      const sourceBall = attackNormalized(frameBall(frame), sourceAttackSign);
      if (!sourceBall) continue;
      const dx = sourceBall.x - queryAttackBall.x;
      const dz = sourceBall.z - queryAttackBall.z;
      const score = dx * dx * 1.7 + dz * dz;
      if (!best || score < best.score) {
        best = {
          frameIndex: i,
          sourceTeam,
          sourceAttackSign,
          score,
          confidence: Math.max(0, 1 - Math.sqrt(score) * 4),
        };
      }
    }
  }

  return best;
}

export function selectMetricaMotionTarget(
  asset: RealDataReplayAsset,
  match: MetricaMotionFrameMatch,
  playerIndex: number,
  query: Pick<MetricaMotionQuery, 'fieldWidth' | 'sourcePitch' | 'targetPitch'>,
): MetricaMotionTarget | null {
  const frame = asset.frames[match.frameIndex];
  if (!frame) return null;
  const sourcePlayers = match.sourceTeam === 'A' ? frame.A : frame.B;
  const point = sourcePlayers[playerIndex] ?? null;
  if (!point) return null;
  const span = sourceWorldSpan(query.fieldWidth, query.sourcePitch, query.targetPitch);
  return {
    x: (point[0] - 0.5) * span.width,
    z: (point[1] - 0.5) * span.depth,
    sourcePlayerIndex: playerIndex,
    frameIndex: match.frameIndex,
    sourceTeam: match.sourceTeam,
    confidence: match.confidence,
  };
}
