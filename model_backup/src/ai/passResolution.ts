export type FlatPoint = {
  x: number;
  z: number;
};

export function distancePointToSegmentXZ(point: FlatPoint, from: FlatPoint, to: FlatPoint): number {
  const segX = to.x - from.x;
  const segZ = to.z - from.z;
  const lenSq = segX * segX + segZ * segZ;
  if (lenSq <= 0.0001) {
    return Math.hypot(point.x - to.x, point.z - to.z);
  }
  const relX = point.x - from.x;
  const relZ = point.z - from.z;
  const t = Math.max(0, Math.min(1, (relX * segX + relZ * segZ) / lenSq));
  const closestX = from.x + segX * t;
  const closestZ = from.z + segZ * t;
  return Math.hypot(point.x - closestX, point.z - closestZ);
}

export function segmentCrossesReceiverRadius(
  receiver: FlatPoint,
  from: FlatPoint,
  to: FlatPoint,
  radius: number,
): boolean {
  return distancePointToSegmentXZ(receiver, from, to) <= radius;
}
