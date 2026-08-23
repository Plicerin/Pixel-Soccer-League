# PSL v2 Architecture Plan — From Scratch Based on Deep Research Report

## Why a rewrite

The current codebase has ~10 competing movement writers that all fight to control each player every frame. The movement gate (V28) catches illegal output but cannot produce good soccer. Incremental tuning has been exhausted. The research report confirms: the correct architecture is a **layered hybrid with explicit time-scale separation** where each player has exactly **one intent owner per frame**.

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  Game Loop (fixed-step, deterministic)           │
│  ┌───────────────────────────────────────────┐  │
│  │  Team Tactical Service (2-5 Hz)           │  │
│  │  - Phase of play detection                │  │
│  │  - Dynamic role assignment                │  │
│  │  - Formation shape + press line           │  │
│  │  - Set-piece selection                    │  │
│  │  - Writes to Tactical Blackboard          │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │  Player Controller (5-10 Hz per player)   │  │
│  │  - Reads blackboard + belief state        │  │
│  │  - Behavior tree produces candidate intents│ │
│  │  - Utility arbitration picks one intent   │  │
│  │  - Intent → MotionRequest                 │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │  Motion Layer (every frame)               │  │
│  │  - Steer toward intent target             │  │
│  │  - Speed cap from player stats            │  │
│  │  - Collision resolution (push, no teleport)│ │
│  │  - Ball contact/dribble physics           │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## Core Principle: One Owner Per Player Per Frame

Every player, every frame:
1. Read blackboard (team intent + role assignment)
2. Behavior tree generates candidate intents
3. Utility scorer picks **one** intent
4. Motion layer steers toward that intent's target
5. **No other system may modify player position after this**

## Layers (bottom-up build order)

### Layer 0: Belief State & Types

New file: `src/core/beliefState.ts`

The belief state is the **single source of truth** that all decision systems read from. No decision system reads raw engine state directly.

```ts
type Vec2 = { x: number; z: number };

type PlayerBelief = {
  id: string;
  team: "home" | "away";
  role: PlayerRole;
  pos: Vec2;
  vel: Vec2;
  facingRad: number;
  stamina01: number;
  hasBall: boolean;
  isGK: boolean;
  speed: number;        // max m/s from ratings
  acceleration: number; // from ratings
  currentIntent: IntentName | null;
};

type BallBelief = {
  pos: Vec2;
  vel: Vec2;
  height: number;      // 0 = ground
  ownerPlayerId: string | null;
  ownerTeam: "home" | "away" | null;
  state: "live" | "dead" | "in_flight" | "loose";
};

type PlayerRole =
  | "GK" | "CB_L" | "CB_R" | "LB" | "RB"
  | "DM" | "CM_L" | "CM_R" | "AM"
  | "LW" | "RW" | "ST";

type PhaseOfPlay =
  | "build_up"       // own half, controlled possession
  | "progression"    // advancing into opponent half
  | "final_third"    // ball in attacking third
  | "defensive_block"// opponent has ball in our half
  | "counterattack"  // rapid transition after gaining possession
  | "counterpress"   // immediate pressure after losing possession
  | "set_piece"      // dead ball situation
  | "transition";    // neither team established

type BallZone =
  | "own_defensive" | "own_mid" | "own_attacking"
  | "opp_defensive" | "opp_mid" | "opp_attacking";
```

New file: `src/core/types.ts` — all shared types for the new architecture.

### Layer 1: Tactical Blackboard

New file: `src/core/blackboard.ts`

The blackboard is shared tactical memory. **Only the Team Tactical Service writes to it. All other systems are read-only consumers.**

```ts
type TacticalBlackboard = {
  tick: number;
  matchMinute: number;
  scoreDiff: number;            // from home team perspective

  // Team-level
  phase: PhaseOfPlay;
  ballZone: BallZone;
  pressLineY: number;           // where the defensive line sits
  compactness: number;          // 0-1 how tight the team shape is
  gameMode: GameMode;           // normal, kickoff, freekick, corner, etc.

  // Per-player role slots
  roleSlots: RoleSlot[];        // one per player, assigned by team service

  // Team tactical intent
  intent: TeamIntent;           // what the team is trying to do
  supportLanes: SupportLane[];  // passing lane evaluations

  // Set piece
  setPieceId: string | null;
  setPiecePhase: "prepare" | "deliver" | "react" | null;

  // Transition
  transitionAge: number;        // seconds since last possession change
  transitionDirection: "won" | "lost" | null;
};

type RoleSlot = {
  playerId: string;
  role: PlayerRole;
  targetPos: Vec2;              // where this role should be right now
  priority: number;             // for role assignment bidding
  confidence: number;           // how certain the assignment is
};

type TeamIntent =
  | { kind: "possess"; widthPreference: number }
  | { kind: "progress"; side: "left" | "center" | "right" }
  | { kind: "attack"; pattern: AttackPattern; carrierId: string }
  | { kind: "finish"; shotQuality: number }
  | { kind: "defend"; pressureLevel: number }
  | { kind: "counterpress"; triggerPlayerId: string }
  | { kind: "counter"; outletTargetId: string }
  | { kind: "set_piece"; patternId: string }
  | { kind: "restart"; type: GameMode };

type AttackPattern =
  | "wing_cutback"
  | "wing_cross"
  | "central_through"
  | "overlap"
  | "give_and_go"
  | "switch_of_play";

type SupportLane = {
  laneId: string;
  fromPlayerId: string;
  toPlayerId: string;
  score: number;     // 0-1 quality
  distance: number;
  isForward: boolean;
};
```

### Layer 2: Team Tactical Service

New file: `src/ai/teamTacticalService.ts`

This is the **single team-level brain**. It ticks at 2-5 Hz (not every frame). It:
1. Reads belief state
2. Detects phase of play
3. Computes formation shape and press line
4. Runs dynamic role assignment (auction/bid system)
5. Selects team intent (attack pattern, defend pressure, etc.)
6. Writes everything to the blackboard

```ts
function updateTeamTacticalService(
  blackboard: TacticalBlackboard,
  belief: MatchBelief,
  team: "home" | "away",
  dt: number
): void;
```

Key sub-modules:
- **Phase detector**: ball zone + possession + transition age → phase
- **Formation engine**: base formation (4-3-3) stretched by ball zone, compressed by phase
- **Role assignment**: each player bids for roles based on current position + skill fit; hungarian/auction algorithm assigns optimally
- **Intent selector**: utility scoring among candidate team intents weighted by phase, score diff, minute

### Layer 3: Player Controller

New file: `src/ai/playerController.ts`

Each player has one controller. It ticks at 5-10 Hz. It:
1. Reads blackboard (team intent + own role slot)
2. Runs a behavior tree to generate candidate intents
3. Scores candidates with utility function (with hysteresis + cooldowns)
4. Outputs exactly **one intent**

```ts
type PlayerIntent =
  | { name: "move_to"; target: Vec2; urgency: number }
  | { name: "receive"; target: Vec2; fromPasserId: string }
  | { name: "support"; target: Vec2; laneId: string }
  | { name: "overlap"; target: Vec2; side: "left" | "right" }
  | { name: "carry"; target: Vec2; ballRetention: number }
  | { name: "pass"; targetPlayerId: string; type: PassType; weight: number }
  | { name: "shoot"; style: ShotStyle; target: Vec2; quality: number }
  | { name: "press"; targetPlayerId: string; intensity: number }
  | { name: "contain"; target: Vec2; jockeyAngle: number }
  | { name: "intercept"; ballInterceptPoint: Vec2; timeToReach: number }
  | { name: "clear"; direction: Vec2 }
  | { name: "track_runner"; targetPlayerId: string; depth: number }
  | { name: "cover"; target: Vec2; role: DefensiveCoverRole }
  | { name: "hold_position"; target: Vec2 }
  | { name: "goalkeeper_position"; centerAngle: number; depth: number }
  | { name: "goalkeeper_dive"; direction: "left" | "right" | "stay"; intensity: number }
  | { name: "goalkeeper_claim"; target: Vec2 }
  | { name: "goalkeeper_distribute"; type: GKDistributionType; targetPlayerId: string };

type PassType = "short" | "driven" | "through" | "cross" | "cutback" | "layoff" | "long";
type ShotStyle = "laces_drive" | "placed" | "curled" | "chip" | "volley" | "header";
type GKDistributionType = "throw" | "driven_kick" | "drop_kick" | "punt" | "goal_kick" | "short_outlet";
type DefensiveCoverRole = "near_post" | "far_post" | "cutback_lane" | "second_wave" | "deep_cover";
```

#### Behavior Tree Structure

New file: `src/ai/behaviorTree.ts`

```
Root
├── Selector: "Is this player the ball carrier?"
│   ├── Sequence: "Carrier in final third"
│   │   ├── Condition: ballInFinalThird
│   │   ├── Condition: hasShootingLane
│   │   └── Action: generate shot intent
│   ├── Sequence: "Carrier has passing option"
│   │   ├── Condition: hasOpenTeammate
│   │   └── Action: generate pass intent
│   ├── Sequence: "Carrier under pressure"
│   │   ├── Condition: pressureOnCarrier > threshold
│   │   └── Action: generate carry/protect intent
│   └── Action: generate carry forward intent
│
├── Selector: "Is this player a defender?"
│   ├── Sequence: "Ball carrier in my zone"
│   │   ├── Condition: ballCarrierNearMyZone
│   │   └── Action: generate press intent
│   ├── Sequence: "Runner in my tracking assignment"
│   │   ├── Condition: assignedRunnerNearby
│   │   └── Action: generate track intent
│   └── Action: generate hold position intent
│
├── Selector: "Is this player the goalkeeper?"
│   ├── Sequence: "Shot incoming"
│   │   ├── Condition: shotDetected
│   │   └── Action: generate dive intent
│   ├── Sequence: "Loose ball in box"
│   │   ├── Condition: looseBallInBox
│   │   └── Action: generate claim intent
│   ├── Sequence: "Ball in hands"
│   │   ├── Condition: hasBall
│   │   └── Action: generate distribute intent
│   └── Action: generate positioning intent
│
└── Selector: "Off-ball attacker"
    ├── Sequence: "Support lane assigned"
    │   ├── Condition: assignedSupportLane
    │   └── Action: generate support/overlap intent
    └── Action: generate move to role target intent
```

#### Utility Arbitration

New file: `src/ai/utilityArbitration.ts`

When a BT produces multiple candidate intents, the utility scorer decides:

```ts
function scoreIntent(candidate: PlayerIntent, ctx: PlayerContext): number {
  let score = 0;

  score += 1.8 * laneOpenScore(candidate, ctx);
  score += 1.4 * roleFitScore(candidate, ctx);      // matches blackboard role slot
  score += 1.2 * pressureReliefScore(candidate, ctx);
  score += 1.0 * transitionValueScore(candidate, ctx);
  score -= 1.3 * turnoverRiskScore(candidate, ctx);
  score -= 0.8 * staminaCostScore(candidate, ctx);
  score += hysteresisBonus(candidate, ctx.lastIntent); // avoid oscillation
  score += cooldownPenalty(candidate, ctx.recentIntents);

  return score;
}
```

### Layer 4: Motion Layer

New file: `src/core/motionLayer.ts`

Runs every frame. Takes the **one intent** from the player controller and produces actual position/velocity changes.

```ts
function applyMotion(
  player: PlayerBelief,
  intent: PlayerIntent,
  dt: number
): { newPos: Vec2; newVel: Vec2; newFacing: number } {
  // 1. Compute target point from intent
  // 2. Compute desired velocity toward target
  // 3. Cap speed to player.maxSpeed
  // 4. Apply acceleration limits (can't change velocity instantly)
  // 5. Resolve collisions (separate overlapping players, but never teleport)
  // 6. Return new position
}
```

**Critical rule**: this is the ONLY system that writes player positions in live play. Collisions may push players apart but the push is bounded by dt * maxSpeed.

### Layer 5: Ball Physics

New file: `src/core/ballPhysics.ts`

Handles ball trajectory, ground rolling, bouncing, and player contact. The ball does not have competing writers either.

```ts
type BallCommand =
  | { kind: "pass"; from: Vec2; to: Vec2; speed: number; type: PassType }
  | { kind: "shot"; from: Vec2; target: Vec2; speed: number; style: ShotStyle }
  | { kind: "dribble"; attachedToPlayerId: string; offset: Vec2 }
  | { kind: "clear"; from: Vec2; direction: Vec2; speed: number }
  | { kind: "launch"; from: Vec2; to: Vec2; speed: number; arc: number }  // goal kick, punt
  | { kind: "dead"; pos: Vec2 };  // ball out of play, reset
```

Ball is either:
- **Attached** to a carrier (dribble offset)
- **In flight** (pass/shot/clear/launch — follows trajectory with deceleration)
- **Loose** (on ground, decelerating from friction)
- **Dead** (out of play, waiting for restart)

No other system may teleport the ball. Restart repositions are explicit `dead` → `launch` transitions logged as restart events.

### Layer 6: Match State Machine

New file: `src/core/matchStateMachine.ts`

Handles match-level state transitions that are NOT per-player:

```ts
type MatchState =
  | { kind: "pre_match" }
  | { kind: "kickoff"; team: "home" | "away" }
  | { kind: "live_play"; half: 1 | 2; startTick: number }
  | { kind: "ball_out"; restartType: "throw_in" | "goal_kick" | "corner" | "free_kick"; restartTeam: "home" | "away" }
  | { kind: "goal_scored"; scoringTeam: "home" | "away"; restartAfter: number }
  | { kind: "halftime" }
  | { kind: "full_time" };
```

This replaces the scattered restart/presentation/restart logic in the current gameEngine.ts.

---

## Goalkeeper Module

New file: `src/ai/goalkeeperController.ts`

The GK is a **specialist player controller** with its own behavior tree branch but still reads from the same blackboard and outputs intents through the same arbitration:

**GK Behavior Tree:**
```
GK Selector
├── Sequence: "Shot incoming"
│   ├── Condition: shotTrajectoryIntersectsGoal
│   ├── Action: compute dive direction + intensity
│   └── Action: generate goalkeeper_dive intent
├── Sequence: "Loose ball claimable"
│   ├── Condition: looseBallInBox AND closestToBall
│   └── Action: generate goalkeeper_claim intent
├── Sequence: "Ball in hands — distribute"
│   ├── Condition: hasBall AND holdTimerExpired
│   ├── Action: select distribution target (utility among outlet options)
│   └── Action: generate goalkeeper_distribute intent
└── Action: generate goalkeeper_position intent
    (position on arc between ball and goal center, depth based on phase)
```

**GK positioning** uses the research report's recommendation: arc positioning between ball and goal center, with depth determined by phase of play and distance of ball. This replaces both the keeperNet neural net (too opaque) and the ad-hoc keeper logic in gameEngine.ts.

**GK distribution** uses utility scoring among candidate targets: short outlet, long kick, punt. Weighted by lane openness, role fit, and game state (winning team holds more, losing team punts more). This replaces the keeperNet distribution decisions.

---

## Files to Delete

Everything under `src/ai/` (all 29 files) — every AI module is being replaced.

The gameEngine.ts monolith will be gutted and split:
- Rendering code stays (materials, sprites, scene setup)
- Game loop stays (but simplified)
- All movement/passing/shooting/keeper/coach logic removed

## Files to Keep (Unchanged)

- `src/mlsRatings.ts` — player ratings database (data)
- `src/mlsTeamStats2025.ts` — team modifiers (data)
- `src/playbookData.ts` — formation data (data, may need adaptation)
- `src/practicePlays.ts` — practice play templates (may need adaptation)
- `src/seasonManager.ts` — season management (UI/logic, separate from match AI)
- `src/smokeTest.ts` — smoke test harness (adapt later)
- `src/telemetry/*` — telemetry recording/analysis (adapt later)
- `src/server/*` — REST API server (adapt later)
- `src/components/*` — React UI components (adapt later, mostly unchanged)
- `src/types.ts` — legacy types (will be superseded)
- `src/constants.ts` — legacy constants (will be superseded)
- `public/*` — assets, sounds
- `scripts/*` — analysis scripts (adapt later)

## New File Structure

```
src/
├── core/
│   ├── types.ts              — all shared types for the new architecture
│   ├── beliefState.ts        — belief state construction from raw engine state
│   ├── blackboard.ts         — tactical blackboard definition + update
│   ├── motionLayer.ts        — intent → position/velocity (single writer)
│   ├── ballPhysics.ts        — ball trajectory, rolling, contact
│   ├── matchStateMachine.ts  — match state transitions (kickoff, live, out, goal, halftime)
│   └── constants.ts          — pitch dimensions, physics constants, timing
├── ai/
│   ├── teamTacticalService.ts — team-level brain (phase, formation, roles, intent)
│   ├── playerController.ts    — per-player BT + utility arbitration
│   ├── behaviorTree.ts        — BT framework + soccer-specific nodes
│   ├── utilityArbitration.ts  — intent scoring with hysteresis/cooldown
│   ├── goalkeeperController.ts— GK specialist controller
│   ├── phaseDetector.ts       — phase of play detection
│   ├── formationEngine.ts     — dynamic formation shape computation
│   ├── roleAssignment.ts      — auction/bid role assignment
│   └── intentEvaluators.ts    — scoring functions for each intent type
├── render/
│   ├── sceneSetup.ts          — Three.js scene, camera, lighting
│   ├── materials.ts           — materials, palettes (from gameEngine)
│   ├── spriteRenderer.ts      — pixel sprite patterns + animation (from gameEngine)
│   ├── fieldRenderer.ts       — pitch, markings, goals
│   └── hudRenderer.ts         — scoreboard, clock, match state display
├── gameEngine.ts              — slimmed: game loop + orchestration only
├── mlsRatings.ts              — unchanged
├── mlsTeamStats2025.ts        — unchanged
├── App.tsx                    — unchanged
├── main.tsx                   — minimal changes
└── components/                — adapt as needed
```

## Build Order (Task Sequence)

Each task produces a **testable, runnable** increment. No task depends on a later task.

### Phase 1: Foundation (can test with manual player placement)

**T1. Core types + constants**
- Define all types in `src/core/types.ts`
- Define pitch/physics constants in `src/core/constants.ts`
- Tests: type compilation, constant bounds

**T2. Match state machine**
- Implement `src/core/matchStateMachine.ts`
- States: pre_match → kickoff → live_play → ball_out → goal_scored → halftime → full_time
- Restart logic: throw-in, goal kick, corner, free kick detection
- Tests: state transitions, restart type detection, clock management

**T3. Belief state builder**
- Implement `src/core/beliefState.ts`
- Takes raw engine positions/velocities and produces `PlayerBelief[]` + `BallBelief`
- Includes ball zone computation, phase hints, possession tracking
- Tests: zone classification, possession detection, velocity from position delta

**T4. Ball physics**
- Implement `src/core/ballPhysics.ts`
- Ball commands, trajectory, rolling deceleration, ground bounce
- Dribble offset (ball position relative to carrier)
- Pass flight: initial velocity, air drag, ground friction after landing
- Shot flight: same + height arc + goal intersection test
- Tests: pass trajectory, shot arc, rolling deceleration, dribble offset

**T5. Motion layer**
- Implement `src/core/motionLayer.ts`
- Intent → target point → desired velocity → speed cap → acceleration limit → position
- Collision resolution: overlap detection, push-apart bounded by maxSpeed * dt
- **No teleport. No position override. One writer.**
- Tests: speed cap enforcement, acceleration limit, collision push bounded, target reaching

### Phase 2: Team Brain

**T6. Tactical blackboard**
- Implement `src/core/blackboard.ts`
- Full blackboard type + create/update functions
- Tests: blackboard creation, update immutability, role slot assignment

**T7. Phase detector**
- Implement `src/ai/phaseDetector.ts`
- Ball zone + possession + transition age → phase
- Phases: build_up, progression, final_third, defensive_block, counterattack, counterpress, set_piece, transition
- Tests: each phase detected correctly from belief state inputs

**T8. Formation engine**
- Implement `src/ai/formationEngine.ts`
- Base 4-3-3 formation anchors per role
- Stretch by ball zone (formation shifts toward ball)
- Compress by phase (defensive_block = tighter, counterattack = stretched)
- Press line computation
- Tests: formation anchors shift with ball position, compactness varies by phase

**T9. Role assignment**
- Implement `src/ai/roleAssignment.ts`
- Each player bids for roles based on: current position vs role target, skill fit from ratings
- Auction/hungarian algorithm for optimal assignment
- GK always assigned GK role
- Tests: assignment stability (same situation = same assignment), skill-weighted preference, GK locked

**T10. Team tactical service**
- Implement `src/ai/teamTacticalService.ts`
- Orchestrates: phase detector → formation engine → role assignment → intent selector
- Writes to blackboard at 2-5 Hz
- Intent selector: utility among possess/progress/attack/defend/counterpress/counter
- Tests: phase changes propagate to blackboard, role slots update, intent selection matches context

### Phase 3: Player Intelligence

**T11. Behavior tree framework**
- Implement `src/ai/behaviorTree.ts`
- BT node types: Selector, Sequence, Condition, Action, Decorator
- Tick function returns candidate intents
- Tests: selector picks first successful, sequence requires all, conditions filter

**T12. Utility arbitration**
- Implement `src/ai/utilityArbitration.ts`
- Scoring functions: laneOpen, roleFit, pressureRelief, transitionValue, turnoverRisk, staminaCost
- Hysteresis bonus for current intent (avoid oscillation)
- Cooldown penalty for recently-abandoned intents
- Tests: scoring produces stable choices, hysteresis prevents oscillation, cooldown blocks rapid switches

**T13. Intent evaluators**
- Implement `src/ai/intentEvaluators.ts`
- Per-intent scoring: pass quality (lane openness, distance, skill), shot quality (angle, distance, pressure), carry risk, support value, press feasibility, intercept timing
- Tests: open lane scores high, blocked shot scores low, turnover risk penalizes risky passes

**T14. Player controller**
- Implement `src/ai/playerController.ts`
- Wires: BT → candidates → utility arbitration → one intent
- Reads blackboard + belief state
- Outputs one `PlayerIntent` per tick
- Tests: carrier in final third produces shot/pass intents, defender produces press/cover intents

**T15. Goalkeeper controller**
- Implement `src/ai/goalkeeperController.ts`
- GK-specific BT: dive, claim, distribute, position
- Arc positioning between ball and goal center
- Distribution utility scoring among outlet targets
- Tests: shot triggers dive, loose ball in box triggers claim, distribution selects open outlet

### Phase 4: Integration

**T16. Slim game engine**
- Gut `gameEngine.ts` — remove all AI, movement, passing, shooting, keeper logic
- Keep: rendering, scene, materials, sprite animation, audio
- New game loop: belief → team service → player controllers → motion layer → ball physics → render
- Each frame: exactly one pass, one writer per player

**T17. Rendering extraction**
- Move rendering code to `src/render/` modules
- gameEngine.ts becomes a thin orchestrator

**T18. RetroFootball component adaptation**
- Update `RetroFootball.tsx` to work with new engine API
- Team selection, match start, CPU-vs-CPU mode still work

### Phase 5: Validation

**T19. Telemetry adaptation**
- Update telemetry recorder to capture new architecture events
- Add: phase changes, intent selections, role assignments, utility scores
- Keep MLS drift comparison working

**T20. Headless runner reliability**
- Fix page-context-loss crash in `scripts/headless-sim.mjs`
- Write partial results after each match
- Retry on navigation errors

**T21. First background match**
- Run one CPU-vs-CPU match with new architecture
- Audit: teleports (should be 0), goals, shots, passes, possession, stuck carriers

**T22. MLS baseline tuning**
- Compare telemetry against MLS 2025 baselines
- Tune utility weights, formation parameters, phase thresholds
- NOT parameter tweaking of the old kind — this is architecturally sound tuning of scoring functions

---

## What This Architecture Guarantees

1. **No competing movement writers** — motion layer is the single position writer
2. **No teleports** — motion layer caps speed, collision pushes are bounded
3. **One intent per player per frame** — BT + utility = one winner
4. **Team coordination** — blackboard + role assignment = shared plan
5. **Local opportunism** — player controllers can deviate from role slot if utility strongly favors it
6. **Debuggability** — every intent is logged with utility scores; "why did player X do Y?" is answerable
7. **Determinism** — fixed-step loop, no randomness in motion, all decisions are scoring-based
8. **Tunable** — utility weights are explicit numbers, not buried in 30k lines of gameEngine

## What We Lose From the Old Code (Intentionally)

- keeperNet neural net (opaque, hard to debug, replaced by utility-scored GK controller)
- outfieldNet neural net (same)
- Force-field positioning (7 competing forces → replaced by single intent from BT)
- FSM positioning (replaced by BT + utility)
- Pattern engine (replaced by team intent + attack patterns in blackboard)
- Structured attack (replaced by attack patterns in team intent)
- Coach authority enforcement (no longer needed — motion layer IS the authority)
- Possession director (replaced by team tactical service)
- Tempo release (replaced by carrier BT branch)
- Telemetry coach (real-data concepts can be re-added later as belief-state inputs)
- Roboflow/Metrica data feeds (can be re-added later as blackboard enrichers, not movement writers)
- All the scattered movement logic in gameEngine.ts (the ~5000 lines of if/else per frame)

## What We Keep

- MLS player ratings (data)
- MLS team stats (data)
- Formation/base playbook data (data)
- Three.js rendering, materials, sprites
- Telemetry recording + drift analysis
- React UI components
- Headless runner (after reliability fix)
- All audio assets
- Season manager
