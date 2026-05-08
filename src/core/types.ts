export type Vec2 = { x: number; z: number };

export type Vec3 = { x: number; y: number; z: number };

export type TeamSide = "home" | "away";

export type PlayerRole =
  | "GK"
  | "CB_L"
  | "CB_R"
  | "LB"
  | "RB"
  | "DM"
  | "CM_L"
  | "CM_R"
  | "AM"
  | "LW"
  | "RW"
  | "ST";

export const ALL_ROLES: PlayerRole[] = [
  "GK", "CB_L", "CB_R", "LB", "RB",
  "DM", "CM_L", "CM_R", "AM",
  "LW", "RW", "ST",
];

export const OUTFIELD_ROLES: PlayerRole[] = ALL_ROLES.filter(r => r !== "GK");

export const DEFENSIVE_ROLES: PlayerRole[] = ["GK", "CB_L", "CB_R", "LB", "RB", "DM"];

export const ATTACKING_ROLES: PlayerRole[] = ["CM_L", "CM_R", "AM", "LW", "RW", "ST"];

export type PhaseOfPlay =
  | "build_up"
  | "progression"
  | "final_third"
  | "defensive_block"
  | "counterattack"
  | "counterpress"
  | "set_piece"
  | "transition";

export type BallZone =
  | "own_defensive"
  | "own_mid"
  | "own_attacking"
  | "opp_defensive"
  | "opp_mid"
  | "opp_attacking";

export type GameMode =
  | "normal"
  | "kickoff"
  | "goalkick"
  | "freekick"
  | "corner"
  | "throwin"
  | "penalty";

export type PassType =
  | "short"
  | "driven"
  | "through"
  | "cross"
  | "cutback"
  | "layoff"
  | "long";

export type ShotStyle =
  | "laces_drive"
  | "placed"
  | "curled"
  | "chip"
  | "volley"
  | "header";

export type GKDistributionType =
  | "throw"
  | "driven_kick"
  | "drop_kick"
  | "punt"
  | "goal_kick"
  | "short_outlet";

export type DefensiveCoverRole =
  | "near_post"
  | "far_post"
  | "cutback_lane"
  | "second_wave"
  | "deep_cover";

export type AttackPattern =
  | "wing_cutback"
  | "wing_cross"
  | "central_through"
  | "overlap"
  | "give_and_go"
  | "switch_of_play";

export type IntentName =
  | "move_to"
  | "receive"
  | "support"
  | "overlap"
  | "carry"
  | "pass"
  | "shoot"
  | "press"
  | "contain"
  | "intercept"
  | "clear"
  | "track_runner"
  | "cover"
  | "hold_position"
  | "goalkeeper_position"
  | "goalkeeper_dive"
  | "goalkeeper_claim"
  | "goalkeeper_distribute";

export type PlayerIntent =
  | { name: "move_to"; target: Vec2; urgency: number }
  | { name: "receive"; target: Vec2; fromPasserId: string }
  | { name: "support"; target: Vec2; laneId: string }
  | { name: "overlap"; target: Vec2; side: "left" | "right" }
  | { name: "carry"; target: Vec2; ballRetention: number }
  | { name: "pass"; targetPlayerId: string; type: PassType; weight: number; targetPoint: Vec2 }
  | { name: "shoot"; style: ShotStyle; target: Vec2; quality: number }
  | { name: "press"; targetPlayerId: string; intensity: number; target: Vec2 }
  | { name: "contain"; target: Vec2; jockeyAngle: number }
  | { name: "intercept"; ballInterceptPoint: Vec2; timeToReach: number }
  | { name: "clear"; direction: Vec2 }
  | { name: "track_runner"; targetPlayerId: string; depth: number; target: Vec2 }
  | { name: "cover"; target: Vec2; role: DefensiveCoverRole }
  | { name: "hold_position"; target: Vec2 }
  | { name: "goalkeeper_position"; centerAngle: number; depth: number; targetPos: Vec2 }
  | { name: "goalkeeper_dive"; direction: "left" | "right" | "stay"; intensity: number; targetPos: Vec2 }
  | { name: "goalkeeper_claim"; target: Vec2 }
  | { name: "goalkeeper_distribute"; type: GKDistributionType; targetPlayerId: string; targetPoint: Vec2 };

export type TeamIntent =
  | { kind: "possess"; widthPreference: number }
  | { kind: "progress"; side: "left" | "center" | "right" }
  | { kind: "attack"; pattern: AttackPattern; carrierId: string }
  | { kind: "finish"; shotQuality: number }
  | { kind: "defend"; pressureLevel: number }
  | { kind: "counterpress"; triggerPlayerId: string }
  | { kind: "counter"; outletTargetId: string }
  | { kind: "set_piece"; patternId: string }
  | { kind: "restart"; type: GameMode };

export type BallState = "attached" | "in_flight" | "loose" | "dead";

export type BallCommand =
  | { kind: "pass"; from: Vec2; to: Vec2; speed: number; type: PassType; intendedReceiverId?: string; intendedTeam?: TeamSide }
  | { kind: "shot"; from: Vec2; target: Vec2; speed: number; style: ShotStyle; arcHeight: number }
  | { kind: "dribble"; attachedToPlayerId: string; offset: Vec2 }
  | { kind: "clear"; from: Vec2; direction: Vec2; speed: number }
  | { kind: "launch"; from: Vec2; to: Vec2; speed: number; arcHeight: number; intendedReceiverId?: string; intendedTeam?: TeamSide }
  | { kind: "dead"; pos: Vec2 };

export type PlayerBelief = {
  id: string;
  team: TeamSide;
  role: PlayerRole;
  pos: Vec2;
  vel: Vec2;
  facingRad: number;
  stamina01: number;
  hasBall: boolean;
  isGK: boolean;
  speed: number;
  acceleration: number;
  currentIntent: IntentName | null;
  ratings: PlayerRatings;
};

export type PlayerRatings = {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  acceleration: number;
  agility: number;
  stamina: number;
  strength: number;
  finishing: number;
  shortPassing: number;
  longPassing: number;
  defensiveAwareness: number;
  standingTackle: number;
  reactions: number;
  gkDiving: number;
  gkHandling: number;
  gkKicking: number;
  gkReflexes: number;
  gkPositioning: number;
};

export type BallBelief = {
  pos: Vec2;
  vel: Vec2;
  height: number;
  ownerPlayerId: string | null;
  ownerTeam: TeamSide | null;
  state: BallState;
};

export type MatchBelief = {
  tick: number;
  homePlayers: PlayerBelief[];
  awayPlayers: PlayerBelief[];
  ball: BallBelief;
  homeAttackSign: 1 | -1;
  awayAttackSign: 1 | -1;
  matchMinute: number;
  scoreDiff: number;
};

export type RoleSlot = {
  playerId: string;
  role: PlayerRole;
  targetPos: Vec2;
  priority: number;
  confidence: number;
};

export type SupportLane = {
  laneId: string;
  fromPlayerId: string;
  toPlayerId: string;
  score: number;
  distance: number;
  isForward: boolean;
};

export type TacticalBlackboard = {
  tick: number;
  matchMinute: number;
  scoreDiff: number;
  phase: PhaseOfPlay;
  ballZone: BallZone;
  pressLineY: number;
  compactness: number;
  gameMode: GameMode;
  roleSlots: RoleSlot[];
  intent: TeamIntent;
  supportLanes: SupportLane[];
  setPieceId: string | null;
  setPiecePhase: "prepare" | "deliver" | "react" | null;
  transitionAge: number;
  transitionDirection: "won" | "lost" | null;
};

export type MatchState =
  | { kind: "pre_match" }
  | { kind: "kickoff"; team: TeamSide }
  | { kind: "live_play"; half: 1 | 2; startTick: number }
  | { kind: "ball_out"; restartType: "throw_in" | "goal_kick" | "corner" | "free_kick"; restartTeam: TeamSide }
  | { kind: "goal_scored"; scoringTeam: TeamSide; restartAfter: number }
  | { kind: "halftime" }
  | { kind: "full_time" };
