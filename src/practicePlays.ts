// ─── Role categorisation ─────────────────────────────────────────────────────
export function getPracticeRoleCategory(role: string): string {
  if (role === "GK") return "gk";
  if (["CB", "LCB", "RCB", "SW"].includes(role)) return "cb";
  if (["LB", "RB", "LWB", "RWB"].includes(role)) return "fb";
  if (["DM", "CDM"].includes(role)) return "dm";
  if (["CM", "LCM", "RCM"].includes(role)) return "cm";
  if (["AM", "CAM"].includes(role)) return "am";
  if (["LW", "RW", "WF", "LM", "RM"].includes(role)) return "winger";
  if (["ST", "CF", "SS"].includes(role)) return "striker";
  return "cm";
}

// ─── Play templates ───────────────────────────────────────────────────────────
export type PlayTemplate =
  | "OVERLAP"
  | "UNDERLAP"
  | "GIVE_AND_GO"
  | "SWITCH_OF_PLAY"
  | "THIRD_MAN_RUN"
  | "CUTBACK"
  | "CROSS_PATTERN"
  | "DIAGONAL_THROUGH"
  | "FALSE_9"
  | "COUNTER_3LANE"
  | "TARGET_MAN"
  | "DUMMY_RESTART";

// ─── Data types ───────────────────────────────────────────────────────────────
export interface PracticePlay {
  key: string;
  label: string;
  category: "Core Pattern" | "Chance Creation" | "Transition" | "Set Piece";
  formation: "4-4-2" | "4-3-3" | "4-2-3-1" | "3-5-2" | "3-4-3";
  aiStyle: "BALANCED" | "AGGRESSIVE" | "POSSESSION";
  template: PlayTemplate;
  description: string;
}

export interface RouteData {
  fromX: number;
  fromZ: number;
  toX:   number;
  toZ:   number;
  color: number;
}

// ─── Route templates ──────────────────────────────────────────────────────────
const Y = 65.6 / 120; // game units per yard ≈ 0.547

type RoleSpec = { fwd: number; lat: number; latDir: "out" | "in" | "none"; color: number };
type TemplateSpec = Partial<Record<string, RoleSpec>>;

const ROUTE_TEMPLATES: Record<PlayTemplate, TemplateSpec> = {
  OVERLAP: {
    cb:      { fwd:  2*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
    fb:      { fwd: 18*Y, lat: 12*Y,  latDir: "out",  color: 0x40c4ff },
    dm:      { fwd:  5*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
    cm:      { fwd: 10*Y, lat:  4*Y,  latDir: "out",  color: 0x69f0ae },
    am:      { fwd: 15*Y, lat:  2*Y,  latDir: "out",  color: 0x00e676 },
    winger:  { fwd: 12*Y, lat:  4*Y,  latDir: "out",  color: 0x69f0ae },
    striker: { fwd: 22*Y, lat:  0,    latDir: "none", color: 0x00e676 },
  },
  UNDERLAP: {
    cb:      { fwd:  2*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
    fb:      { fwd: 16*Y, lat:  8*Y,  latDir: "in",   color: 0x40c4ff },
    dm:      { fwd:  5*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
    cm:      { fwd: 10*Y, lat:  4*Y,  latDir: "out",  color: 0x69f0ae },
    am:      { fwd: 18*Y, lat:  0,    latDir: "none", color: 0x00e676 },
    winger:  { fwd: 20*Y, lat: 14*Y,  latDir: "out",  color: 0x00e676 },
    striker: { fwd: 22*Y, lat:  0,    latDir: "none", color: 0x00e676 },
  },
  GIVE_AND_GO: {
    cb:      { fwd:  2*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
    fb:      { fwd:  8*Y, lat:  3*Y,  latDir: "out",  color: 0x80cbc4 },
    dm:      { fwd:  5*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
    cm:      { fwd: 14*Y, lat:  3*Y,  latDir: "in",   color: 0x00e676 },
    am:      { fwd: 15*Y, lat:  0,    latDir: "none", color: 0x00e676 },
    winger:  { fwd: 12*Y, lat:  2*Y,  latDir: "in",   color: 0x00e676 },
    striker: { fwd: 20*Y, lat:  2*Y,  latDir: "out",  color: 0x00e676 },
  },
  SWITCH_OF_PLAY: {
    cb:      { fwd:  1*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
    fb:      { fwd:  5*Y, lat: 14*Y,  latDir: "out",  color: 0x40c4ff },
    dm:      { fwd:  3*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
    cm:      { fwd:  8*Y, lat:  6*Y,  latDir: "out",  color: 0x69f0ae },
    am:      { fwd: 12*Y, lat:  0,    latDir: "none", color: 0x69f0ae },
    winger:  { fwd: 25*Y, lat: 16*Y,  latDir: "out",  color: 0x00e676 },
    striker: { fwd: 22*Y, lat:  0,    latDir: "none", color: 0x00e676 },
  },
  THIRD_MAN_RUN: {
    cb:      { fwd:  2*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
    fb:      { fwd: 10*Y, lat:  8*Y,  latDir: "out",  color: 0x69f0ae },
    dm:      { fwd:  5*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
    cm:      { fwd: 22*Y, lat:  3*Y,  latDir: "in",   color: 0x00e676 },
    am:      { fwd: 12*Y, lat:  0,    latDir: "none", color: 0x69f0ae },
    winger:  { fwd: 15*Y, lat: 12*Y,  latDir: "out",  color: 0x69f0ae },
    striker: { fwd: 10*Y, lat:  0,    latDir: "none", color: 0x69f0ae },
  },
  CUTBACK: {
    cb:      { fwd:  2*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
    fb:      { fwd: 22*Y, lat: 15*Y,  latDir: "out",  color: 0x00e676 },
    dm:      { fwd:  5*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
    cm:      { fwd: 18*Y, lat:  4*Y,  latDir: "in",   color: 0x00e676 },
    am:      { fwd: 20*Y, lat:  0,    latDir: "none", color: 0x00e676 },
    winger:  { fwd: 25*Y, lat: 16*Y,  latDir: "out",  color: 0x00e676 },
    striker: { fwd: 18*Y, lat:  1*Y,  latDir: "out",  color: 0x00e676 },
  },
  CROSS_PATTERN: {
    cb:      { fwd:  2*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
    fb:      { fwd: 18*Y, lat: 12*Y,  latDir: "out",  color: 0x40c4ff },
    dm:      { fwd:  5*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
    cm:      { fwd: 12*Y, lat:  4*Y,  latDir: "out",  color: 0x69f0ae },
    am:      { fwd: 20*Y, lat:  4*Y,  latDir: "in",   color: 0x00e676 },
    winger:  { fwd: 24*Y, lat: 18*Y,  latDir: "out",  color: 0x00e676 },
    striker: { fwd: 22*Y, lat:  2*Y,  latDir: "out",  color: 0x00e676 },
  },
  DIAGONAL_THROUGH: {
    cb:      { fwd:  2*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
    fb:      { fwd: 10*Y, lat:  4*Y,  latDir: "out",  color: 0x40c4ff },
    dm:      { fwd:  5*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
    cm:      { fwd: 18*Y, lat:  6*Y,  latDir: "in",   color: 0x00e676 },
    am:      { fwd: 12*Y, lat:  0,    latDir: "none", color: 0x69f0ae },
    winger:  { fwd: 15*Y, lat: 12*Y,  latDir: "out",  color: 0x69f0ae },
    striker: { fwd: 24*Y, lat:  4*Y,  latDir: "in",   color: 0x00e676 },
  },
  FALSE_9: {
    cb:      { fwd:  2*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
    fb:      { fwd: 14*Y, lat:  8*Y,  latDir: "out",  color: 0x40c4ff },
    dm:      { fwd:  5*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
    cm:      { fwd: 12*Y, lat:  4*Y,  latDir: "out",  color: 0x69f0ae },
    am:      { fwd: 15*Y, lat:  0,    latDir: "none", color: 0x69f0ae },
    winger:  { fwd: 24*Y, lat:  6*Y,  latDir: "in",   color: 0x00e676 },
    striker: { fwd:  2*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
  },
  COUNTER_3LANE: {
    cb:      { fwd:  2*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
    fb:      { fwd: 12*Y, lat: 10*Y,  latDir: "out",  color: 0x40c4ff },
    dm:      { fwd:  8*Y, lat:  0,    latDir: "none", color: 0x69f0ae },
    cm:      { fwd: 20*Y, lat:  4*Y,  latDir: "out",  color: 0x00e676 },
    am:      { fwd: 20*Y, lat:  0,    latDir: "none", color: 0x00e676 },
    winger:  { fwd: 25*Y, lat: 15*Y,  latDir: "out",  color: 0x00e676 },
    striker: { fwd: 28*Y, lat:  0,    latDir: "none", color: 0x00e676 },
  },
  TARGET_MAN: {
    cb:      { fwd:  2*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
    fb:      { fwd: 12*Y, lat:  6*Y,  latDir: "out",  color: 0x40c4ff },
    dm:      { fwd:  5*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
    cm:      { fwd: 15*Y, lat:  4*Y,  latDir: "out",  color: 0x69f0ae },
    am:      { fwd: 25*Y, lat:  2*Y,  latDir: "in",   color: 0x00e676 },
    winger:  { fwd: 25*Y, lat: 12*Y,  latDir: "out",  color: 0x00e676 },
    striker: { fwd: 12*Y, lat:  0,    latDir: "none", color: 0x69f0ae },
  },
  DUMMY_RESTART: {
    cb:      { fwd:  1*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
    fb:      { fwd:  5*Y, lat:  6*Y,  latDir: "out",  color: 0x80cbc4 },
    dm:      { fwd:  3*Y, lat:  0,    latDir: "none", color: 0x80cbc4 },
    cm:      { fwd:  8*Y, lat:  1*Y,  latDir: "out",  color: 0x00e676 },
    am:      { fwd:  4*Y, lat:  2*Y,  latDir: "in",   color: 0x80cbc4 },
    winger:  { fwd: 15*Y, lat: 12*Y,  latDir: "out",  color: 0x00e676 },
    striker: { fwd: 20*Y, lat:  0,    latDir: "none", color: 0x00e676 },
  },
};

export function getPlayRoutes(
  play: PracticePlay,
  players: Array<{ role: string; displayRole?: string; team: string; pos: { x: number; y: number; z: number } }>,
): RouteData[] {
  const template = ROUTE_TEMPLATES[play.template];
  const routes: RouteData[] = [];
  for (const p of players) {
    if (p.team !== "A") continue;
    const cat = getPracticeRoleCategory(p.displayRole || p.role);
    if (cat === "gk") continue;
    const spec = template[cat];
    if (!spec) continue;
    const sideSign = p.pos.z >= 0 ? 1 : -1;
    let dz = 0;
    if (spec.latDir === "out") dz = sideSign * spec.lat;
    else if (spec.latDir === "in") dz = -sideSign * spec.lat;
    const toX = Math.min(30, p.pos.x + spec.fwd * 1);
    const toZ = Math.max(-20, Math.min(20, p.pos.z + dz));
    routes.push({ fromX: p.pos.x, fromZ: p.pos.z, toX, toZ, color: spec.color });
  }
  return routes;
}

export const PRACTICE_PLAYS: PracticePlay[] = [
  {
    key: "overlap",
    label: "The Overlap",
    category: "Core Pattern",
    formation: "4-3-3",
    aiStyle: "AGGRESSIVE",
    template: "OVERLAP",
    description: "Wide fullback runs around the winger to create a 2v1 on the flank",
  },
  {
    key: "underlap",
    label: "The Underlap",
    category: "Core Pattern",
    formation: "4-3-3",
    aiStyle: "POSSESSION",
    template: "UNDERLAP",
    description: "Fullback cuts inside the winger to exploit the half-space",
  },
  {
    key: "give-go",
    label: "Give-and-Go",
    category: "Core Pattern",
    formation: "4-4-2",
    aiStyle: "POSSESSION",
    template: "GIVE_AND_GO",
    description: "Quick one-two combination to break a stagnant defensive line",
  },
  {
    key: "switch",
    label: "Switch of Play",
    category: "Core Pattern",
    formation: "3-5-2",
    aiStyle: "POSSESSION",
    template: "SWITCH_OF_PLAY",
    description: "Rapid movement from one side to the other to exploit shifted defenses",
  },
  {
    key: "third-man",
    label: "Third-Man Run",
    category: "Core Pattern",
    formation: "4-2-3-1",
    aiStyle: "POSSESSION",
    template: "THIRD_MAN_RUN",
    description: "Midfielder passes to striker who lays it off for a late runner",
  },
  {
    key: "cutback",
    label: "Cutback Attack",
    category: "Chance Creation",
    formation: "4-3-3",
    aiStyle: "AGGRESSIVE",
    template: "CUTBACK",
    description: "Winger reaches byline and pulls back to the penalty spot",
  },
  {
    key: "cross-pattern",
    label: "Near/Far Post Runs",
    category: "Chance Creation",
    formation: "4-4-2",
    aiStyle: "AGGRESSIVE",
    template: "CROSS_PATTERN",
    description: "Staggered runs into the box to meet an incoming cross",
  },
  {
    key: "diagonal",
    label: "Diagonal Through Ball",
    category: "Chance Creation",
    formation: "4-3-3",
    aiStyle: "BALANCED",
    template: "DIAGONAL_THROUGH",
    description: "Split the fullback and centerback with a diagonal pass in behind",
  },
  {
    key: "false-9",
    label: "False 9 Drop-In",
    category: "Chance Creation",
    formation: "4-3-3",
    aiStyle: "POSSESSION",
    template: "FALSE_9",
    description: "Striker drops deep to pull centerbacks out of position",
  },
  {
    key: "counter-3",
    label: "3-Lane Counter",
    category: "Transition",
    formation: "4-3-3",
    aiStyle: "AGGRESSIVE",
    template: "COUNTER_3LANE",
    description: "Exploit high lines by filling left, center, and right lanes instantly",
  },
  {
    key: "target-man",
    label: "Outlet to Target Man",
    category: "Transition",
    formation: "4-4-2",
    aiStyle: "BALANCED",
    template: "TARGET_MAN",
    description: "Direct ball to physical striker to hold and wait for runners",
  },
  {
    key: "dummy",
    label: "Dummy Runner Routine",
    category: "Set Piece",
    formation: "4-2-3-1",
    aiStyle: "BALANCED",
    template: "DUMMY_RESTART",
    description: "Deceptive move where a player runs over the ball to freeze the wall",
  },
];

export const PRACTICE_AGGRESSIVENESS = {
  BALANCED: { aimErrorRad: 0.14, pressureError: 0.08 },
  AGGRESSIVE: { aimErrorRad: 0.18, pressureError: 0.1 },
  POSSESSION: { aimErrorRad: 0.11, pressureError: 0.06 },
} as const;

export type AggressivenessKey = keyof typeof PRACTICE_AGGRESSIVENESS;