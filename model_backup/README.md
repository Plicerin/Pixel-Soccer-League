# Model Backup — Movement / Passing / Shooting

Snapshot of every source file related to **outfield movement, passing, and shooting** before
the destructive rewrite of 2026-05-10.

- **Branch at backup**: `001-fix-cpu-gameplay`
- **Snapshot commit**: `b05b8dc1cb9a573fc438fd0278e6b85431ed4fa6`
- **Reason for removal**: prior architecture (orchestrator + behavior tree + utility arbitration
  + force-field positioning + pattern engine + structured attack + SWOS tactics + multiple
  pass/shot models) had grown beyond what could be tuned. Clean slate for a simpler approach.
- **Restore from git**: `git checkout b05b8dc -- <path>` for any single file, or
  `git checkout b05b8dc -- src/ai src/core` for the full pre-rewrite state.

Goalkeeper neural-net + training code (`keeperNet`, `seedKeeperWeights`, `trainKeeper`,
`headlessSim`, `rlHarness`) was **not** removed. The `goalkeeperController.ts` *behavior tree*
WAS removed (it depended on `behaviorTree`, `utilityArbitration`, `playerController`, and the
deleted `core/types.ts`); it is in this backup. Telemetry, rendering, season management,
server/db, and constants were also kept in `src/`.

## Files in this backup

### MOVEMENT (21)
| File | What it did |
|------|-------------|
| `src/ai/aiPositioningModel.ts` | Combined tactical position + force-field nudge into a movement target. |
| `src/ai/attackingLanes.ts` | Per-role attacking-run targets within lateral lanes during possession. |
| `src/ai/behaviorTree.ts` | Selector/sequence/condition/action primitives for deterministic decision logic. |
| `src/ai/defensiveStrategy.ts` | Defensive positioning, pressing, marking, interception. |
| `src/ai/forceFieldPositioning.ts` | Formation-pull + ball-attraction + teammate/opponent avoidance + width anchoring. |
| `src/ai/formationEngine.ts` | 4-3-3 anchor definitions and role-based positions with stretch/depth. |
| `src/ai/fsmPositioning.ts` | Single-owner FSM for off-ball movement (Pattern / Structured / SWOS). |
| `src/ai/metricaMotionLibrary.ts` | Real-data frame matching by ball-position similarity. |
| `src/ai/patternEngine.ts` | Team attack patterns (patient build, counter, wing). |
| `src/ai/phaseDetector.ts` | Inferred match phase from ball zone + possession. |
| `src/ai/playerController.ts` | Per-player intent arbitration (BT + utility + hysteresis/cooldown). |
| `src/ai/possessionDirector.ts` | Metrica-derived team width + support-distance targets. |
| `src/ai/restartAndDefenseRules.ts` | Kickoff receivers, goal-mouth spacing, defensive role positions. |
| `src/ai/roleAssignment.ts` | Role bids by position/skill fit with stability constraints. |
| `src/ai/simpleAI.ts` | Simple outfield AI (carriers shoot/pass/dribble; off-ball press/track/support). |
| `src/ai/structuredAttack.ts` | Wing attacks with carrier / near-post / far-post / cutback / second-wave roles. |
| `src/ai/swosTactics.ts` | SWOS .TAC 35-area positional lookup by role + ball location. |
| `src/ai/tacticalPositioning.ts` | Ideal position blending home + ball + role anchor. |
| `src/ai/telemetryCoach.ts` | Real-movement-based coach control via Metrica/Roboflow + threat memory. |
| `src/ai/utilityArbitration.ts` | Intent scoring (lane open, role fit, pressure relief, transition, stamina). |
| `src/core/motionLayer.ts` | Per-tick motion: target extraction, velocity, collision avoidance, drag. |

### PASSING (4)
| File | What it did |
|------|-------------|
| `src/ai/aiPassModel.ts` | Pass-target evaluation: progress + lane pressure + receiver timing. Throws vs ground. |
| `src/ai/crossTelemetry.ts` | Classified a pass as a cross (wide → central) for telemetry. |
| `src/ai/passResolution.ts` | Segment-to-point geometry for rolling-pass reception. |
| `src/ai/tempoRelease.ts` | When to release vs hold inside a structured attack. |

### SHOOTING (2)
| File | What it did |
|------|-------------|
| `src/ai/aiShotModel.ts` | Shot viability: distance + pressure + finishing skill → shoot or pass. |
| `src/ai/goalValidation.ts` | Scoring-actor selection + crossing-award validation for shot/non-shot rules. |

### GOALKEEPER CONTROLLER (1)
| File | What it did |
|------|-------------|
| `src/ai/goalkeeperController.ts` | GK behavior tree (dive on shot, claim loose ball, position on arc, distribute). |

### GLUE (14) — wired the above into the gameplay loop
| File | What it did |
|------|-------------|
| `src/ai/coachAuthority.ts` | Enforced coach-issued movement, validated speed/bounds. |
| `src/ai/intentEvaluators.ts` | Scored pass/shot/carry/support/intercept options for arbitration. |
| `src/ai/metricaEventModel.ts` | Real-world event profiles → coach control directives. |
| `src/ai/outfieldNet.ts` | Pure-JS NN for outfield action selection (pass/shoot/dribble/move). |
| `src/ai/realDataReplay.ts` | Real-data replay frame format + pitch mapping + facing inference. |
| `src/ai/roboflowSportsTracking.ts` | Roboflow tracking frame → coach directives. |
| `src/ai/simpleOffenseModel.ts` | Simple pass/shot/carry target selection with onside + blocking checks. |
| `src/ai/teamTacticalService.ts` | Team belief, phase, formation, role, blackboard updates per tick. |
| `src/core/ballPhysics.ts` | Ball state + physics + pass/shot speed + bounce/spin + player contact. |
| `src/core/beliefState.ts` | Built player/ball/match beliefs each tick. |
| `src/core/blackboard.ts` | Tactical blackboard (phase, zone, press line, compactness, role slots). |
| `src/core/gameEngineBridge.ts` | Synced legacy gameEngine state with the new orchestrator each frame. |
| `src/core/gameOrchestrator.ts` | Main orchestrator: ticked team/player controllers, emitted events, updated ball. |
| `src/core/types.ts` | Core types (Vec2/Vec3, PlayerRole, PlayerIntent, BallCommand, PhaseOfPlay, GameMode, ...). |
| `src/gameEngine.ts` | Top-level game loop; orchestrated AI, coach commands, pass/shot resolution, telemetry. |

### TESTS (17)
| File | What it covered |
|------|-----------------|
| `tests/coachAuthority.test.ts` | Coach authority movement validation + live override. |
| `tests/crossTelemetry.test.ts` | Cross-delivery classification. |
| `tests/gameplayValidationContract.test.ts` | Gameplay validation contract. |
| `tests/goalValidation.test.ts` | Goal-actor selection + crossing-award logic. |
| `tests/headlessSimCpuBehavior.test.ts` | Headless-sim CPU behavior + match results. |
| `tests/helpers/cpuGameplayFixtures.ts` | Fixtures for the CPU gameplay tests. |
| `tests/metricaMotionLibrary.test.ts` | Real-data motion frame matching + normalization. |
| `tests/newArchitectureController.test.ts` | New orchestrator controller architecture. |
| `tests/passResolution.test.ts` | Rolling-pass reception geometry. |
| `tests/positioningGeometry.test.ts` | Pattern + FSM positioning target geometry. |
| `tests/possessionDirector.test.ts` | Possession width + support targets + delivery timing. |
| `tests/realDataReplay.test.ts` | Real-data frame interpolation + coordinate mapping. |
| `tests/restartAndDefenseRules.test.ts` | Kickoff receiver spots + goal-mouth spacing. |
| `tests/simpleOffenseModel.test.ts` | Simple pass/shot target selection. |
| `tests/structuredAttack.test.ts` | Structured-attack role assignment + targets. |
| `tests/telemetryCoach.test.ts` | Telemetry coach threat memory + plan generation. |
| `tests/tempoRelease.test.ts` | Tempo-release decision for structured attacks. |

## Glue points severed in `src/gameEngine.ts`, orchestrator, bridge, RetroFootball

The pre-rewrite `gameEngine.ts` imported every model above. After the rewrite, the
gameplay loop is gone; only init + a render bridge stub remain so `RetroFootball.tsx`
still compiles. To inspect the original wiring, see `model_backup/src/gameEngine.ts`,
`model_backup/src/core/gameOrchestrator.ts`, and `model_backup/src/core/gameEngineBridge.ts`.

## What is still alive in `src/` after the cut

- `src/ai/goalkeeperController.ts`, `keeperNet.ts`, `seedKeeperWeights.ts`, `trainKeeper.ts`,
  `headlessSim.ts`, `rlHarness.ts` — goalkeeper subsystem, untouched.
- `src/core/constants.ts`, `matchStateMachine.ts` — clock / restarts / dimensions; no movement logic.
- `src/telemetry/*`, `src/server/*` — recording + DB layers, untouched.
- `src/components/*`, `src/App.tsx`, `src/main.tsx` — React UI shell.
- `src/seasonManager.ts`, `src/playbookData.ts`, `src/practicePlays.ts`, `src/mlsRatings.ts`,
  `src/mlsTeamStats2025.ts`, `src/smokeTest.ts`, `src/types.ts`, `src/constants.ts` — data + utilities.
