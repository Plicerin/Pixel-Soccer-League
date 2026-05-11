import type { Vec2, PlayerRole, PlayerBelief, PlayerRatings, RoleSlot } from "../core/types";
import { ALL_ROLES, OUTFIELD_ROLES, DEFENSIVE_ROLES, ATTACKING_ROLES } from "../core/types";
import { dist2, clamp } from "../core/constants";
import { isDefensiveRole, isAttackingRole } from "./formationEngine";

export type RoleBid = {
  playerId: string;
  role: PlayerRole;
  score: number;
  posFit: number;
  skillFit: number;
};

export function computePositionFit(
  playerPos: Vec2,
  roleTargetPos: Vec2,
  maxDistance: number = 25.0,
): number {
  const d = dist2(playerPos, roleTargetPos);
  return clamp(1.0 - d / maxDistance, 0, 1);
}

export function computeSkillFit(
  ratings: PlayerRatings,
  role: PlayerRole,
): number {
  if (role === "GK") {
    const gkAvg = (ratings.gkDiving + ratings.gkHandling + ratings.gkKicking + ratings.gkReflexes + ratings.gkPositioning) / 5;
    return gkAvg / 100;
  }

  if (isDefensiveRole(role)) {
    return (ratings.defending * 0.4 + ratings.physical * 0.2 + ratings.pace * 0.2 + ratings.passing * 0.2) / 100;
  }

  if (isAttackingRole(role)) {
    if (role === "ST") {
      return (ratings.shooting * 0.4 + ratings.dribbling * 0.25 + ratings.pace * 0.2 + ratings.physical * 0.15) / 100;
    }
    if (role === "AM") {
      return (ratings.passing * 0.3 + ratings.dribbling * 0.3 + ratings.shooting * 0.25 + ratings.pace * 0.15) / 100;
    }
    return (ratings.pace * 0.3 + ratings.dribbling * 0.25 + ratings.passing * 0.25 + ratings.shooting * 0.2) / 100;
  }

  return (ratings.passing * 0.3 + ratings.defending * 0.2 + ratings.dribbling * 0.2 + ratings.physical * 0.15 + ratings.pace * 0.15) / 100;
}

export function computeRoleBids(
  players: PlayerBelief[],
  roleTargets: Map<PlayerRole, Vec2>,
): RoleBid[] {
  const bids: RoleBid[] = [];

  for (const player of players) {
    for (const role of ALL_ROLES) {
      if (role === "GK" && !player.isGK) continue;
      if (role !== "GK" && player.isGK) continue;

      const targetPos = roleTargets.get(role);
      if (!targetPos) continue;

      const posFit = computePositionFit(player.pos, targetPos);
      const skillFit = computeSkillFit(player.ratings, role);

      const score = posFit * 0.55 + skillFit * 0.45;

      bids.push({
        playerId: player.id,
        role,
        score,
        posFit,
        skillFit,
      });
    }
  }

  return bids;
}

export function assignRoles(
  bids: RoleBid[],
  roleTargets: Map<PlayerRole, Vec2>,
): RoleSlot[] {
  const assigned = new Map<string, PlayerRole>();
  const assignedRoles = new Set<PlayerRole>();
  const slots: RoleSlot[] = [];

  const sorted = [...bids].sort((a, b) => b.score - a.score);

  for (const bid of sorted) {
    if (assigned.has(bid.playerId)) continue;
    if (assignedRoles.has(bid.role)) continue;

    assigned.set(bid.playerId, bid.role);
    assignedRoles.add(bid.role);

    const targetPos = roleTargets.get(bid.role)!;

    slots.push({
      playerId: bid.playerId,
      role: bid.role,
      targetPos,
      priority: bid.score,
      confidence: bid.score,
    });
  }

  return slots;
}

export function assignRolesWithStability(
  previousSlots: RoleSlot[],
  bids: RoleBid[],
  roleTargets: Map<PlayerRole, Vec2>,
  stabilityThreshold: number = 0.08,
): RoleSlot[] {
  const newSlots = assignRoles(bids, roleTargets);

  const prevMap = new Map<string, RoleSlot>();
  for (const s of previousSlots) {
    prevMap.set(s.playerId, s);
  }

  const stable: RoleSlot[] = [];
  for (const newSlot of newSlots) {
    const prev = prevMap.get(newSlot.playerId);
    if (prev && prev.role === newSlot.role) {
      stable.push({
        ...newSlot,
        confidence: Math.min(1.0, prev.confidence + 0.1),
      });
    } else if (prev) {
      const prevScore = prev.confidence;
      const newScore = newSlot.confidence;
      if (newScore - prevScore > stabilityThreshold) {
        stable.push({ ...newSlot, confidence: newScore * 0.7 });
      } else {
        stable.push({
          ...prev,
          confidence: Math.max(0, prev.confidence - 0.05),
        });
      }
    } else {
      stable.push({ ...newSlot, confidence: newSlot.confidence * 0.6 });
    }
  }

  return stable;
}

export function getUnassignedPlayers(
  players: PlayerBelief[],
  slots: RoleSlot[],
): PlayerBelief[] {
  const assignedIds = new Set(slots.map(s => s.playerId));
  return players.filter(p => !assignedIds.has(p.id));
}
