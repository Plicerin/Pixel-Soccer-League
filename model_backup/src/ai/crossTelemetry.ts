export type CrossPoint = { x: number; z: number };

export type CrossTelemetryContext = {
  passer: CrossPoint;
  target: CrossPoint;
  attackSign: 1 | -1;
  fieldWidth: number;
  penaltyDepth: number;
  penaltyHalfZ: number;
  goalMouthWidth: number;
};

export function isActualCrossDelivery(ctx: CrossTelemetryContext): boolean {
  const goalX = ctx.attackSign > 0 ? ctx.fieldWidth / 2 : -ctx.fieldWidth / 2;
  const passerDistToGoal = Math.abs(goalX - ctx.passer.x);
  const targetDistToGoal = Math.abs(goalX - ctx.target.x);
  const passerWide = Math.abs(ctx.passer.z) >= Math.max(ctx.goalMouthWidth * 1.35, ctx.penaltyHalfZ * 0.48);
  const passerAdvanced = passerDistToGoal <= ctx.penaltyDepth + 22;
  const targetCentral = Math.abs(ctx.target.z) <= ctx.penaltyHalfZ * 0.96;
  const targetInScoringZone = targetDistToGoal <= ctx.penaltyDepth + 8;
  const targetMoreCentral = Math.abs(ctx.target.z) <= Math.abs(ctx.passer.z) - 1.6;
  const forwardProgress = (ctx.target.x - ctx.passer.x) * ctx.attackSign;
  const notDeepReset = forwardProgress >= -7;

  return passerWide
    && passerAdvanced
    && targetCentral
    && targetInScoringZone
    && targetMoreCentral
    && notDeepReset;
}
