import {
  FIELD_D,
  LEFT_GOAL_X,
  RIGHT_GOAL_X,
  GOAL_MOUTH_HALF_Z,
} from "./constants";
import type { Vec2 } from "./types";

export type SimpleTeamCode = "A" | "B";
export type SimpleRole = "GK" | "CB" | "FB" | "DM" | "CM" | "AM" | "W" | "ST";
export type SimpleFormationName = "4-4-2" | "4-3-3" | "4-2-3-1" | "3-5-2" | "3-4-3";

export type SimpleFormationSlot = {
  role: SimpleRole;
  label: string;
  line: "gk" | "def" | "mid" | "att";
  x: number;
  z: number;
};

const MAX_WIDE_Z = FIELD_D * 0.38;
const MID_WIDE_Z = FIELD_D * 0.27;
const HALF_WIDE_Z = FIELD_D * 0.18;

const FORMATIONS: Record<SimpleFormationName, SimpleFormationSlot[]> = {
  "4-4-2": [
    { role: "GK", label: "GK", line: "gk", x: -30, z: 0 },
    { role: "FB", label: "LB", line: "def", x: -20, z: -MAX_WIDE_Z },
    { role: "CB", label: "LCB", line: "def", x: -22, z: -HALF_WIDE_Z },
    { role: "CB", label: "RCB", line: "def", x: -22, z: HALF_WIDE_Z },
    { role: "FB", label: "RB", line: "def", x: -20, z: MAX_WIDE_Z },
    { role: "W", label: "LM", line: "mid", x: -4, z: -MAX_WIDE_Z },
    { role: "CM", label: "LCM", line: "mid", x: -7, z: -HALF_WIDE_Z },
    { role: "CM", label: "RCM", line: "mid", x: -7, z: HALF_WIDE_Z },
    { role: "W", label: "RM", line: "mid", x: -4, z: MAX_WIDE_Z },
    { role: "ST", label: "LST", line: "att", x: 14, z: -HALF_WIDE_Z },
    { role: "ST", label: "RST", line: "att", x: 14, z: HALF_WIDE_Z },
  ],
  "4-3-3": [
    { role: "GK", label: "GK", line: "gk", x: -30, z: 0 },
    { role: "FB", label: "LB", line: "def", x: -20, z: -MAX_WIDE_Z },
    { role: "CB", label: "LCB", line: "def", x: -22, z: -HALF_WIDE_Z },
    { role: "CB", label: "RCB", line: "def", x: -22, z: HALF_WIDE_Z },
    { role: "FB", label: "RB", line: "def", x: -20, z: MAX_WIDE_Z },
    { role: "CM", label: "LCM", line: "mid", x: -5, z: -MID_WIDE_Z },
    { role: "DM", label: "DM", line: "mid", x: -9, z: 0 },
    { role: "CM", label: "RCM", line: "mid", x: -5, z: MID_WIDE_Z },
    { role: "W", label: "LW", line: "att", x: 13, z: -MAX_WIDE_Z },
    { role: "ST", label: "ST", line: "att", x: 16, z: 0 },
    { role: "W", label: "RW", line: "att", x: 13, z: MAX_WIDE_Z },
  ],
  "4-2-3-1": [
    { role: "GK", label: "GK", line: "gk", x: -30, z: 0 },
    { role: "FB", label: "LB", line: "def", x: -20, z: -MAX_WIDE_Z },
    { role: "CB", label: "LCB", line: "def", x: -22, z: -HALF_WIDE_Z },
    { role: "CB", label: "RCB", line: "def", x: -22, z: HALF_WIDE_Z },
    { role: "FB", label: "RB", line: "def", x: -20, z: MAX_WIDE_Z },
    { role: "DM", label: "LDM", line: "mid", x: -9, z: -HALF_WIDE_Z },
    { role: "DM", label: "RDM", line: "mid", x: -9, z: HALF_WIDE_Z },
    { role: "W", label: "LW", line: "att", x: 6, z: -MAX_WIDE_Z },
    { role: "AM", label: "AM", line: "att", x: 7, z: 0 },
    { role: "W", label: "RW", line: "att", x: 6, z: MAX_WIDE_Z },
    { role: "ST", label: "ST", line: "att", x: 17, z: 0 },
  ],
  "3-5-2": [
    { role: "GK", label: "GK", line: "gk", x: -30, z: 0 },
    { role: "CB", label: "LCB", line: "def", x: -22, z: -MID_WIDE_Z },
    { role: "CB", label: "CB", line: "def", x: -24, z: 0 },
    { role: "CB", label: "RCB", line: "def", x: -22, z: MID_WIDE_Z },
    { role: "W", label: "LWB", line: "mid", x: -5, z: -MAX_WIDE_Z },
    { role: "CM", label: "LCM", line: "mid", x: -6, z: -HALF_WIDE_Z },
    { role: "DM", label: "CM", line: "mid", x: -9, z: 0 },
    { role: "CM", label: "RCM", line: "mid", x: -6, z: HALF_WIDE_Z },
    { role: "W", label: "RWB", line: "mid", x: -5, z: MAX_WIDE_Z },
    { role: "ST", label: "LST", line: "att", x: 15, z: -HALF_WIDE_Z },
    { role: "ST", label: "RST", line: "att", x: 15, z: HALF_WIDE_Z },
  ],
  "3-4-3": [
    { role: "GK", label: "GK", line: "gk", x: -30, z: 0 },
    { role: "CB", label: "LCB", line: "def", x: -22, z: -MID_WIDE_Z },
    { role: "CB", label: "CB", line: "def", x: -24, z: 0 },
    { role: "CB", label: "RCB", line: "def", x: -22, z: MID_WIDE_Z },
    { role: "W", label: "LM", line: "mid", x: -5, z: -MAX_WIDE_Z },
    { role: "CM", label: "LCM", line: "mid", x: -8, z: -HALF_WIDE_Z },
    { role: "CM", label: "RCM", line: "mid", x: -8, z: HALF_WIDE_Z },
    { role: "W", label: "RM", line: "mid", x: -5, z: MAX_WIDE_Z },
    { role: "W", label: "LW", line: "att", x: 13, z: -MAX_WIDE_Z },
    { role: "ST", label: "ST", line: "att", x: 17, z: 0 },
    { role: "W", label: "RW", line: "att", x: 13, z: MAX_WIDE_Z },
  ],
};

export function normalizeFormationName(value?: string): SimpleFormationName {
  return value === "4-3-3" || value === "4-2-3-1" || value === "3-5-2" || value === "3-4-3"
    ? value
    : "4-4-2";
}

export function getFormationSlots(value?: string): SimpleFormationSlot[] {
  return FORMATIONS[normalizeFormationName(value)].map((slot) => ({ ...slot }));
}

export function orientSlot(slot: SimpleFormationSlot, attackSign: 1 | -1): Vec2 {
  if (slot.role === "GK") {
    return {
      x: attackSign > 0 ? LEFT_GOAL_X + 2.8 : RIGHT_GOAL_X - 2.8,
      z: 0,
    };
  }
  return {
    x: slot.x * attackSign,
    z: Math.max(-FIELD_D * 0.45, Math.min(FIELD_D * 0.45, slot.z)),
  };
}

export function goalCenterForAttack(attackSign: 1 | -1): Vec2 {
  return { x: attackSign > 0 ? RIGHT_GOAL_X : LEFT_GOAL_X, z: 0 };
}

export function ownGoalCenterForAttack(attackSign: 1 | -1): Vec2 {
  return { x: attackSign > 0 ? LEFT_GOAL_X : RIGHT_GOAL_X, z: 0 };
}

/**
 * Keep a player inside the field of play.
 *
 * `outsideAllowance` lets specific players stand beyond the lines. Restart
 * takers need it: a corner is taken from behind the corner flag and a throw-in
 * from behind the touchline, so clamping them to the interior parks them on
 * the pitch side of the ball -- the wrong side to kick from.
 */
export function clampToPlayable(pos: Vec2, outsideAllowance = 0): Vec2 {
  const slack = Math.max(0, outsideAllowance);
  return {
    x: Math.max(LEFT_GOAL_X + 1 - slack, Math.min(RIGHT_GOAL_X - 1 + slack, pos.x)),
    z: Math.max(-FIELD_D / 2 + 1 - slack, Math.min(FIELD_D / 2 - 1 + slack, pos.z)),
  };
}

export function isCentralGoalMouth(z: number) {
  return Math.abs(z) <= GOAL_MOUTH_HALF_Z;
}
