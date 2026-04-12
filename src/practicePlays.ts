// ─── Role categorisation ─────────────────────────────────────────────────────
export function getPracticeRoleCategory(role: string): string {
  if (role === 'GK') return 'gk';
  if (['CB', 'LCB', 'RCB', 'SW'].includes(role)) return 'cb';
  if (['LB', 'RB', 'LWB', 'RWB'].includes(role)) return 'fb';
  if (['DM', 'CDM'].includes(role)) return 'dm';
  if (['CM', 'LCM', 'RCM'].includes(role)) return 'cm';
  if (['AM', 'CAM'].includes(role)) return 'am';
  if (['LW', 'RW', 'WF', 'LM', 'RM'].includes(role)) return 'winger';
  if (['ST', 'CF', 'SS'].includes(role)) return 'striker';
  return 'cm';
}

// ─── Play templates ───────────────────────────────────────────────────────────
export type PlayTemplate =
  | 'COUNTER_ATTACK'
  | 'GEGENPRESSING'
  | 'TIKI_TAKA'
  | 'POSITIONAL'
  | 'WIDE_ATTACK'
  | 'HIGH_PRESS'
  | 'COUNTER_BLOCK'
  | 'TOTAL_FOOTBALL'
  | 'WING_BACK';

// ─── Data types ───────────────────────────────────────────────────────────────
export interface PracticePlay {
  key: string;
  label: string;
  club: string;
  formation: '4-4-2' | '4-3-3' | '4-2-3-1' | '3-5-2' | '3-4-3';
  aiStyle: 'BALANCED' | 'AGGRESSIVE' | 'POSSESSION';
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
// Team A attacks LEFT → RIGHT (positive x). Striker homePos ≈ x+8.7; right
// penalty area starts at x ≈ +23. Arrow colours:
//   0x00e676  bright green  – finishing runs into the box
//   0x69f0ae  mid green     – midfield / support runs
//   0x40c4ff  light blue    – full-back / wide overlaps
//   0x80cbc4  teal          – defensive / holding positions

const Y = 65.6 / 120; // game units per yard ≈ 0.547

type RoleSpec = { fwd: number; lat: number; latDir: 'out' | 'in' | 'none'; color: number };
type TemplateSpec = Partial<Record<string, RoleSpec>>;

// fwd  = yards forward in attack direction (applied as +x in practice)
// lat  = lateral offset magnitude in yards
// latDir: 'out' = outward from centre, 'in' = invert inward, 'none' = no change

const ROUTE_TEMPLATES: Record<PlayTemplate, TemplateSpec> = {

  // ── Lightning break — striker sprints into the box, wingers stretch the backline ──
  COUNTER_ATTACK: {
    cb:      { fwd:  2*Y, lat:  0,    latDir: 'none', color: 0x80cbc4 },
    fb:      { fwd: 12*Y, lat:  4*Y,  latDir: 'out',  color: 0x40c4ff },
    dm:      { fwd:  5*Y, lat:  0,    latDir: 'none', color: 0x69f0ae },
    cm:      { fwd: 14*Y, lat:  3*Y,  latDir: 'out',  color: 0x69f0ae },
    am:      { fwd: 22*Y, lat:  0,    latDir: 'none', color: 0x00e676 },
    winger:  { fwd: 20*Y, lat:  5*Y,  latDir: 'out',  color: 0x00e676 },
    striker: { fwd: 28*Y, lat:  0,    latDir: 'none', color: 0x00e676 },
  },

  // ── Win the ball high, attack immediately — everyone swarms the box ──
  GEGENPRESSING: {
    cb:      { fwd:  7*Y, lat:  0,    latDir: 'none', color: 0x80cbc4 },
    fb:      { fwd: 14*Y, lat:  2*Y,  latDir: 'out',  color: 0x40c4ff },
    dm:      { fwd: 11*Y, lat:  0,    latDir: 'none', color: 0x69f0ae },
    cm:      { fwd: 17*Y, lat:  3*Y,  latDir: 'out',  color: 0x69f0ae },
    am:      { fwd: 23*Y, lat:  0,    latDir: 'none', color: 0x00e676 },
    winger:  { fwd: 20*Y, lat:  7*Y,  latDir: 'out',  color: 0x00e676 },
    striker: { fwd: 27*Y, lat:  3*Y,  latDir: 'out',  color: 0x00e676 },
  },

  // ── Patient one-touch passing — inverted wingers cut in, striker receives in box ──
  TIKI_TAKA: {
    cb:      { fwd:  5*Y, lat:  3*Y,  latDir: 'out',  color: 0x80cbc4 },
    fb:      { fwd: 10*Y, lat: 10*Y,  latDir: 'out',  color: 0x40c4ff },
    dm:      { fwd:  3*Y, lat:  0,    latDir: 'none', color: 0x80cbc4 },
    cm:      { fwd: 12*Y, lat:  5*Y,  latDir: 'out',  color: 0x69f0ae },
    am:      { fwd: 22*Y, lat:  0,    latDir: 'none', color: 0x00e676 },
    winger:  { fwd: 18*Y, lat:  5*Y,  latDir: 'in',   color: 0x00e676 },
    striker: { fwd: 25*Y, lat:  0,    latDir: 'none', color: 0x00e676 },
  },

  // ── Structured overloads — wingers invert into the half-space for the shot ──
  POSITIONAL: {
    cb:      { fwd:  5*Y, lat:  4*Y,  latDir: 'out',  color: 0x80cbc4 },
    fb:      { fwd: 14*Y, lat: 13*Y,  latDir: 'out',  color: 0x40c4ff },
    dm:      { fwd:  6*Y, lat:  0,    latDir: 'none', color: 0x80cbc4 },
    cm:      { fwd: 14*Y, lat:  5*Y,  latDir: 'out',  color: 0x69f0ae },
    am:      { fwd: 22*Y, lat:  3*Y,  latDir: 'in',   color: 0x00e676 },
    winger:  { fwd: 18*Y, lat:  5*Y,  latDir: 'in',   color: 0x00e676 },
    striker: { fwd: 22*Y, lat:  0,    latDir: 'none', color: 0x00e676 },
  },

  // ── Flood the flanks — deep overlaps, crosses into a box run ──
  WIDE_ATTACK: {
    cb:      { fwd:  2*Y, lat:  0,    latDir: 'none', color: 0x80cbc4 },
    fb:      { fwd: 16*Y, lat: 14*Y,  latDir: 'out',  color: 0x40c4ff },
    dm:      { fwd:  5*Y, lat:  0,    latDir: 'none', color: 0x80cbc4 },
    cm:      { fwd: 12*Y, lat:  4*Y,  latDir: 'out',  color: 0x69f0ae },
    am:      { fwd: 20*Y, lat:  2*Y,  latDir: 'out',  color: 0x00e676 },
    winger:  { fwd: 14*Y, lat: 16*Y,  latDir: 'out',  color: 0x00e676 },
    striker: { fwd: 26*Y, lat:  2*Y,  latDir: 'out',  color: 0x00e676 },
  },

  // ── Win the ball high and shoot immediately — aggressive box entries ──
  HIGH_PRESS: {
    cb:      { fwd:  6*Y, lat:  0,    latDir: 'none', color: 0x80cbc4 },
    fb:      { fwd: 11*Y, lat:  3*Y,  latDir: 'out',  color: 0x40c4ff },
    dm:      { fwd: 10*Y, lat:  0,    latDir: 'none', color: 0x69f0ae },
    cm:      { fwd: 16*Y, lat:  3*Y,  latDir: 'out',  color: 0x69f0ae },
    am:      { fwd: 22*Y, lat:  0,    latDir: 'none', color: 0x00e676 },
    winger:  { fwd: 18*Y, lat:  6*Y,  latDir: 'out',  color: 0x00e676 },
    striker: { fwd: 25*Y, lat:  3*Y,  latDir: 'out',  color: 0x00e676 },
  },

  // ── Sit deep, then burst — lone striker makes the run, support arrives late ──
  COUNTER_BLOCK: {
    cb:      { fwd:  3*Y, lat:  2*Y,  latDir: 'out',  color: 0x80cbc4 },
    fb:      { fwd:  4*Y, lat:  8*Y,  latDir: 'out',  color: 0x40c4ff },
    dm:      { fwd:  7*Y, lat:  0,    latDir: 'none', color: 0x80cbc4 },
    cm:      { fwd: 11*Y, lat:  3*Y,  latDir: 'out',  color: 0x69f0ae },
    am:      { fwd: 18*Y, lat:  4*Y,  latDir: 'out',  color: 0x69f0ae },
    winger:  { fwd: 16*Y, lat:  5*Y,  latDir: 'out',  color: 0x69f0ae },
    striker: { fwd: 28*Y, lat:  0,    latDir: 'none', color: 0x00e676 },
  },

  // ── Fluid positional interchange — everyone can finish from anywhere ──
  TOTAL_FOOTBALL: {
    cb:      { fwd:  6*Y, lat:  4*Y,  latDir: 'out',  color: 0x80cbc4 },
    fb:      { fwd: 13*Y, lat:  8*Y,  latDir: 'out',  color: 0x40c4ff },
    dm:      { fwd:  7*Y, lat:  0,    latDir: 'none', color: 0x69f0ae },
    cm:      { fwd: 14*Y, lat:  5*Y,  latDir: 'out',  color: 0x69f0ae },
    am:      { fwd: 22*Y, lat:  3*Y,  latDir: 'in',   color: 0x00e676 },
    winger:  { fwd: 18*Y, lat: 11*Y,  latDir: 'out',  color: 0x00e676 },
    striker: { fwd: 24*Y, lat:  2*Y,  latDir: 'in',   color: 0x00e676 },
  },

  // ── Wingbacks bomb forward — twin strikers attack the near and far post ──
  WING_BACK: {
    cb:      { fwd:  3*Y, lat:  4*Y,  latDir: 'out',  color: 0x80cbc4 },
    fb:      { fwd: 18*Y, lat: 14*Y,  latDir: 'out',  color: 0x40c4ff },
    dm:      { fwd:  6*Y, lat:  0,    latDir: 'none', color: 0x80cbc4 },
    cm:      { fwd: 12*Y, lat:  4*Y,  latDir: 'out',  color: 0x69f0ae },
    am:      { fwd: 20*Y, lat:  0,    latDir: 'none', color: 0x00e676 },
    winger:  { fwd: 18*Y, lat: 14*Y,  latDir: 'out',  color: 0x00e676 },
    striker: { fwd: 26*Y, lat:  4*Y,  latDir: 'out',  color: 0x00e676 },
  },
};

// ─── Route computation ────────────────────────────────────────────────────────
// In practice mode Team A occupies their normal left-half starting positions
// and attacks toward the RIGHT goal (positive x = left → right).
const PRACTICE_ATK = 1;

export function getPlayRoutes(
  play: PracticePlay,
  players: Array<{ role: string; team: string; pos: { x: number; y: number; z: number } }>,
): RouteData[] {
  const template = ROUTE_TEMPLATES[play.template];
  const routes: RouteData[] = [];
  for (const p of players) {
    if (p.team !== 'A') continue;
    const cat = getPracticeRoleCategory(p.role);
    if (cat === 'gk') continue;
    const spec = template[cat];
    if (!spec) continue;
    const sideSign = p.pos.z >= 0 ? 1 : -1;
    let dz = 0;
    if (spec.latDir === 'out') dz = sideSign * spec.lat;
    else if (spec.latDir === 'in') dz = -sideSign * spec.lat;
    // Clamp so no-one runs into the net or off the touchline
    const toX = Math.min(30, p.pos.x + spec.fwd * PRACTICE_ATK);
    const toZ = Math.max(-20, Math.min(20, p.pos.z + dz));
    routes.push({ fromX: p.pos.x, fromZ: p.pos.z, toX, toZ, color: spec.color });
  }
  return routes;
}

// ─── Play catalogue — 20 famous attacking plays ───────────────────────────────
export const PRACTICE_PLAYS: PracticePlay[] = [

  // ── Real Madrid ──────────────────────────────────────────────────────────────
  {
    key: 'rm-counter',
    label: 'Los Blancos Counter',
    club: 'Real Madrid',
    formation: '4-2-3-1',
    aiStyle: 'AGGRESSIVE',
    template: 'COUNTER_ATTACK',
    description: 'Striker sprints in behind the last line while the AM drives late into the box',
  },
  {
    key: 'rm-galacticos',
    label: 'Galácticos Wide Attack',
    club: 'Real Madrid',
    formation: '4-3-3',
    aiStyle: 'AGGRESSIVE',
    template: 'WIDE_ATTACK',
    description: 'Wingers hug the touchline and whip early crosses for a central striker run',
  },
  {
    key: 'rm-combination',
    label: 'Madrid Triangles',
    club: 'Real Madrid',
    formation: '4-3-3',
    aiStyle: 'POSSESSION',
    template: 'TIKI_TAKA',
    description: 'Quick one-twos through midfield — inverted wingers cut in for the finish',
  },

  // ── FC Barcelona ─────────────────────────────────────────────────────────────
  {
    key: 'barca-tiki-taka',
    label: 'Tiki-Taka',
    club: 'FC Barcelona',
    formation: '4-3-3',
    aiStyle: 'POSSESSION',
    template: 'TIKI_TAKA',
    description: 'Patient one-touch circulation pulls the defence apart — ending with a box strike',
  },
  {
    key: 'barca-positional',
    label: 'Positional Overload',
    club: 'FC Barcelona',
    formation: '4-2-3-1',
    aiStyle: 'POSSESSION',
    template: 'POSITIONAL',
    description: 'Fullbacks invert; wingers occupy half-spaces and shoot from the inside channel',
  },
  {
    key: 'barca-cruyff',
    label: 'Cruyff Total Attack',
    club: 'FC Barcelona',
    formation: '3-4-3',
    aiStyle: 'POSSESSION',
    template: 'TOTAL_FOOTBALL',
    description: 'Every player free to finish — fluid rotations end with a first-time shot',
  },

  // ── Bayern Munich ────────────────────────────────────────────────────────────
  {
    key: 'bay-gegenpressing',
    label: 'Gegenpressing',
    club: 'Bayern Munich',
    formation: '4-2-3-1',
    aiStyle: 'AGGRESSIVE',
    template: 'GEGENPRESSING',
    description: 'Immediate counter-press wins the ball high; attackers flood the box at once',
  },
  {
    key: 'bay-wing-overload',
    label: 'Wing Overload',
    club: 'Bayern Munich',
    formation: '3-4-3',
    aiStyle: 'BALANCED',
    template: 'WIDE_ATTACK',
    description: 'Wingbacks and wingers push to maximum width; low cross finds a box run',
  },
  {
    key: 'bay-blitz',
    label: 'Bayern Blitz',
    club: 'Bayern Munich',
    formation: '4-3-3',
    aiStyle: 'AGGRESSIVE',
    template: 'COUNTER_ATTACK',
    description: 'Direct vertical ball over the high line; striker and CMs arrive in the box together',
  },

  // ── Liverpool ─────────────────────────────────────────────────────────────────
  {
    key: 'liv-gegenpress',
    label: 'Gegenpress Strike',
    club: 'Liverpool',
    formation: '4-3-3',
    aiStyle: 'AGGRESSIVE',
    template: 'GEGENPRESSING',
    description: 'Win it back within seconds; the front three attack the box in unison',
  },
  {
    key: 'liv-vertical',
    label: 'Vertical Blitz',
    club: 'Liverpool',
    formation: '4-3-3',
    aiStyle: 'AGGRESSIVE',
    template: 'COUNTER_ATTACK',
    description: 'Straight vertical ball to the breaking striker; wingers arrive for the rebound',
  },

  // ── Manchester City ───────────────────────────────────────────────────────────
  {
    key: 'mci-halfspace',
    label: 'Half-Space Invasion',
    club: 'Manchester City',
    formation: '4-3-3',
    aiStyle: 'POSSESSION',
    template: 'POSITIONAL',
    description: 'Inverted wingers slice into the half-space; fullbacks stretch wide for the cutback',
  },
  {
    key: 'mci-false9',
    label: "Pep's False 9",
    club: 'Manchester City',
    formation: '3-4-3',
    aiStyle: 'POSSESSION',
    template: 'POSITIONAL',
    description: 'Striker drops deep to create space; late midfield runners arrive inside the box',
  },

  // ── Ajax ──────────────────────────────────────────────────────────────────────
  {
    key: 'ajax-total',
    label: 'Total Football',
    club: 'Ajax',
    formation: '4-3-3',
    aiStyle: 'BALANCED',
    template: 'TOTAL_FOOTBALL',
    description: 'Positional interchange: any player can and will end up pulling the trigger',
  },

  // ── Arsenal ───────────────────────────────────────────────────────────────────
  {
    key: 'ars-wengerball',
    label: 'Wengerball',
    club: 'Arsenal',
    formation: '4-4-2',
    aiStyle: 'POSSESSION',
    template: 'TIKI_TAKA',
    description: 'Slick one-twos on the edge of the box; second striker arrives late for the shot',
  },

  // ── Borussia Dortmund ─────────────────────────────────────────────────────────
  {
    key: 'bvb-direct',
    label: 'BVB Direct Attack',
    club: 'Borussia Dortmund',
    formation: '4-2-3-1',
    aiStyle: 'AGGRESSIVE',
    template: 'COUNTER_ATTACK',
    description: 'Long diagonal ball releases the striker in behind — support pours forward',
  },

  // ── Argentina ─────────────────────────────────────────────────────────────────
  {
    key: 'arg-false9',
    label: 'Argentine False 9',
    club: 'Argentina',
    formation: '4-3-3',
    aiStyle: 'POSSESSION',
    template: 'POSITIONAL',
    description: 'The false 9 drops to receive; wingers make diagonal runs in behind for the finish',
  },

  // ── Brazil ────────────────────────────────────────────────────────────────────
  {
    key: 'bra-joga-bonito',
    label: 'Joga Bonito',
    club: 'Brazil',
    formation: '4-3-3',
    aiStyle: 'AGGRESSIVE',
    template: 'WIDE_ATTACK',
    description: 'Expressive wide play — overlapping fullbacks and wingers combine for a low box cross',
  },

  // ── Netherlands ───────────────────────────────────────────────────────────────
  {
    key: 'ned-total',
    label: 'Oranje Total Football',
    club: 'Netherlands',
    formation: '3-4-3',
    aiStyle: 'BALANCED',
    template: 'TOTAL_FOOTBALL',
    description: 'Fluid positional rotation — every outfield player capable of the killer finish',
  },

  // ── Juventus ──────────────────────────────────────────────────────────────────
  {
    key: 'juve-wingback',
    label: 'Bianconeri Wing Attack',
    club: 'Juventus',
    formation: '3-5-2',
    aiStyle: 'POSSESSION',
    template: 'WING_BACK',
    description: 'Wingbacks bomb to the byline; twin strikers attack near and far post',
  },
];

// ─── Aggressiveness presets ───────────────────────────────────────────────────
export const PRACTICE_AGGRESSIVENESS = {
  CALM:       { label: 'Calm',       aimErrorRad: 0.20, pressureError: 0.04 },
  STANDARD:   { label: 'Standard',   aimErrorRad: 0.14, pressureError: 0.08 },
  AGGRESSIVE: { label: 'Aggressive', aimErrorRad: 0.09, pressureError: 0.13 },
} as const;

export type AggressivenessKey = keyof typeof PRACTICE_AGGRESSIVENESS;
