export type RoboflowSportsTeam = 'A' | 'B' | 'NEUTRAL';

export type RoboflowSportsTrackedEntity = {
  id: string;
  team: RoboflowSportsTeam;
  className: 'player' | 'goalkeeper' | 'ball' | 'referee';
  role?: string;
  x: number;
  z: number;
  vx?: number;
  vz?: number;
  hasBall?: boolean;
};

export type RoboflowSportsTrackingFrame = {
  source: 'roboflow_sports_radar_tracking';
  pitch: {
    lengthMeters: 120;
    widthMeters: 70;
    coordinateSystem: 'radar_pitch_meters';
  };
  attackingTeam: 'A' | 'B';
  attackingDirection: 1 | -1;
  frameTimeSeconds: number;
  ball: RoboflowSportsTrackedEntity;
  entities: RoboflowSportsTrackedEntity[];
  carrier: RoboflowSportsTrackedEntity | null;
  metrics: {
    phase: 'buildup' | 'progression' | 'finalThird';
    pressureCount: number;
    nearestPressureMeters: number;
    teamWidthMeters: number;
    supportCount: number;
    runnersAhead: number;
    boxAttackers: number;
    centralLaneDefenders: number;
    cutbackAvailable: boolean;
    secondWaveAvailable: boolean;
    wideOutletAvailable: boolean;
    shotLaneCrowded: boolean;
    restDefenseCount: number;
  };
};

export type RoboflowSportsCoachControl = {
  riskBias: number;
  shotUrgency: number;
  passRiskTolerance: number;
  widthUrgency: number;
  supportUrgency: number;
  releaseUrgency: number;
  defensivePressBias: number;
};

export const ROBOFLOW_SPORTS_SOCCER_PITCH = {
  lengthMeters: 120 as const,
  widthMeters: 70 as const,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function createRoboflowSportsTrackingFrame(input: {
  attackingTeam: 'A' | 'B';
  attackingDirection: 1 | -1;
  frameTimeSeconds: number;
  ball: Omit<RoboflowSportsTrackedEntity, 'className' | 'team'> & Partial<Pick<RoboflowSportsTrackedEntity, 'team' | 'className'>>;
  entities: RoboflowSportsTrackedEntity[];
}): RoboflowSportsTrackingFrame {
  const attacking = input.entities.filter((entity) => entity.team === input.attackingTeam && entity.className !== 'ball');
  const defending = input.entities.filter((entity) => entity.team !== input.attackingTeam && entity.team !== 'NEUTRAL' && entity.className !== 'ball');
  const ball: RoboflowSportsTrackedEntity = {
    ...input.ball,
    team: input.ball.team ?? 'NEUTRAL',
    className: 'ball',
  };
  const carrier = attacking.find((entity) => entity.hasBall) || attacking
    .slice()
    .sort((a, b) => distance(a, ball) - distance(b, ball))[0] || null;
  const goalX = input.attackingDirection > 0 ? ROBOFLOW_SPORTS_SOCCER_PITCH.lengthMeters / 2 : -ROBOFLOW_SPORTS_SOCCER_PITCH.lengthMeters / 2;
  const carrierDistToGoal = carrier ? Math.abs(goalX - carrier.x) : ROBOFLOW_SPORTS_SOCCER_PITCH.lengthMeters / 2;
  const phase =
    carrierDistToGoal <= 32 ? 'finalThird'
    : carrierDistToGoal <= 58 ? 'progression'
    : 'buildup';
  const pressureDistances = carrier
    ? defending.map((entity) => distance(entity, carrier)).sort((a, b) => a - b)
    : [];
  const pressureCount = pressureDistances.filter((dist) => dist <= 6.0).length;
  const nearestPressureMeters = pressureDistances[0] ?? 99;
  const teamZ = attacking.map((entity) => entity.z);
  const teamWidthMeters = teamZ.length > 1 ? Math.max(...teamZ) - Math.min(...teamZ) : 0;
  const supportCount = carrier ? attacking.filter((entity) => entity.id !== carrier.id && distance(entity, carrier) <= 18).length : 0;
  const runnersAhead = carrier
    ? attacking.filter((entity) => entity.id !== carrier.id && (entity.x - carrier.x) * input.attackingDirection > 4).length
    : 0;
  const boxAttackers = attacking.filter((entity) => Math.abs(goalX - entity.x) <= 18 && Math.abs(entity.z) <= 21).length;
  const centralLaneDefenders = carrier
    ? defending.filter((entity) => {
      const ahead = (entity.x - carrier.x) * input.attackingDirection > 0;
      return ahead && Math.abs(entity.z) <= 9.5 && Math.abs(goalX - entity.x) <= 34;
    }).length
    : 0;
  const cutbackAvailable = carrier ? attacking.some((entity) =>
    entity.id !== carrier.id
    && Math.abs(goalX - entity.x) >= 14
    && Math.abs(goalX - entity.x) <= 24
    && Math.abs(entity.z) <= 16
    && (entity.x - carrier.x) * input.attackingDirection > -9,
  ) : false;
  const secondWaveAvailable = carrier ? attacking.some((entity) =>
    entity.id !== carrier.id
    && Math.abs(goalX - entity.x) >= 18
    && Math.abs(goalX - entity.x) <= 28
    && Math.abs(entity.z) <= 20,
  ) : false;
  const wideOutletAvailable = carrier ? attacking.some((entity) =>
    entity.id !== carrier.id
    && Math.abs(entity.z) >= 24
    && distance(entity, carrier) <= 30,
  ) : false;
  const restDefenseCount = attacking.filter((entity) => carrier && (carrier.x - entity.x) * input.attackingDirection > 18).length;

  return {
    source: 'roboflow_sports_radar_tracking',
    pitch: {
      lengthMeters: ROBOFLOW_SPORTS_SOCCER_PITCH.lengthMeters,
      widthMeters: ROBOFLOW_SPORTS_SOCCER_PITCH.widthMeters,
      coordinateSystem: 'radar_pitch_meters',
    },
    attackingTeam: input.attackingTeam,
    attackingDirection: input.attackingDirection,
    frameTimeSeconds: input.frameTimeSeconds,
    ball,
    entities: input.entities,
    carrier,
    metrics: {
      phase,
      pressureCount,
      nearestPressureMeters,
      teamWidthMeters,
      supportCount,
      runnersAhead,
      boxAttackers,
      centralLaneDefenders,
      cutbackAvailable,
      secondWaveAvailable,
      wideOutletAvailable,
      shotLaneCrowded: centralLaneDefenders >= 2 || pressureCount >= 2,
      restDefenseCount,
    },
  };
}

export function deriveRoboflowSportsCoachControl(
  frame: RoboflowSportsTrackingFrame,
  base: RoboflowSportsCoachControl,
): RoboflowSportsCoachControl {
  const m = frame.metrics;
  const chanceLaneOpen = m.cutbackAvailable || m.secondWaveAvailable;
  return {
    riskBias: clamp(base.riskBias + (m.runnersAhead >= 2 ? 0.18 : -0.08) + (m.pressureCount >= 2 ? 0.14 : 0), -0.5, 0.75),
    shotUrgency: clamp(base.shotUrgency + (m.phase === 'finalThird' && chanceLaneOpen ? 0.36 : 0) - (m.shotLaneCrowded ? 0.22 : 0), -0.55, 0.9),
    passRiskTolerance: clamp(base.passRiskTolerance + (chanceLaneOpen ? 0.35 : 0) + (m.pressureCount >= 2 ? 0.25 : 0), -0.45, 0.9),
    widthUrgency: clamp(base.widthUrgency + (m.teamWidthMeters < 38 ? 0.28 : -0.08) + (m.wideOutletAvailable ? 0.12 : 0), -0.45, 0.85),
    supportUrgency: clamp(base.supportUrgency + (m.supportCount < 3 ? 0.35 : -0.12), -0.35, 0.85),
    releaseUrgency: clamp(base.releaseUrgency + (m.pressureCount >= 2 ? 0.38 : 0) + (m.phase === 'finalThird' ? 0.24 : 0), -0.35, 0.95),
    defensivePressBias: clamp(base.defensivePressBias + (m.restDefenseCount < 2 ? -0.2 : 0.12), -0.35, 0.75),
  };
}
