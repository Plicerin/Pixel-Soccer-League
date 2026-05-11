---

description: "Task list for fixing CPU gameplay model"
---

# Tasks: Fix CPU Gameplay Model

**Input**: Design documents from `/specs/001-fix-cpu-gameplay/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Include failing-first automated coverage for every behavior-changing story plus shared gameplay-validation contract surfaces.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish deterministic validation fixtures and repeatable full-match analysis inputs before CPU logic changes begin.

- [X] T001 Add reusable CPU gameplay regression fixtures in tests/helpers/cpuGameplayFixtures.ts
- [X] T002 [P] Add deterministic headless validation scenario options in scripts/headless-sim.mjs
- [X] T003 [P] Add telemetry review summaries for CPU credibility sampling in scripts/telemetry-analyze-latest.mjs

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the shared runtime context and contract guards that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Define shared CPU team-state and match-context types in src/core/types.ts
- [X] T005 [P] Encode transition age, restart mode, and score-pressure context on tactical blackboards in src/core/blackboard.ts
- [X] T006 [P] Add shared gameplay-validation contract coverage in tests/gameplayValidationContract.test.ts
- [X] T007 Preserve `?newarch=1`, `window.__gameRef`, and telemetry parity surfaces in src/gameEngine.ts
- [X] T008 Preserve legacy-to-orchestrator sync invariants for live ball and player state in src/core/gameEngineBridge.ts

**Checkpoint**: Shared context, bridge invariants, and contract tests are ready for story work.

---

## Phase 3: User Story 1 - Play against a credible CPU opponent (Priority: P1) 🎯 MVP

**Goal**: Make the CPU choose believable attacking and defending actions during live human-vs-CPU play.

**Independent Test**: Start a match against the CPU, play through multiple midfield and final-third possessions, and confirm the CPU transitions cleanly between attack and defense without hesitation loops or unrealistic inactivity.

### Tests for User Story 1 (REQUIRED) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T009 [P] [US1] Expand live-play controller regression coverage in tests/newArchitectureController.test.ts
- [X] T010 [P] [US1] Add structured possession-choice assertions for open-play build-up in tests/structuredAttack.test.ts

### Implementation for User Story 1

- [X] T011 [P] [US1] Refine team phase detection and intent selection for midfield and final-third decisions in src/ai/teamTacticalService.ts
- [X] T012 [P] [US1] Refine outfield intent hysteresis and arbitration for believable ball actions in src/ai/playerController.ts
- [X] T013 [P] [US1] Tune pass, carry, shot, and support scoring in src/ai/intentEvaluators.ts
- [X] T014 [P] [US1] Refine goalkeeper support, claim, and distribution choices in src/ai/goalkeeperController.ts
- [X] T015 [US1] Integrate updated team and player decisions into the live tick loop in src/core/gameOrchestrator.ts
- [X] T016 [US1] Validate unchanged kickoff and match-start UX while improved CPU behavior is active in src/components/RetroFootball.tsx and tests/matchStartUi.test.ts

**Checkpoint**: User Story 1 should now support credible human-vs-CPU possessions without UI or control changes.

---

## Phase 4: User Story 2 - Watch believable full-match behavior (Priority: P2)

**Goal**: Make CPU-vs-CPU and long-running matches show varied, coherent behavior across different score states and match phases.

**Independent Test**: Run full matches with CPU control on both sides and verify that build-up, defending, transitions, and score-state behavior vary across the match without one broken pattern repeating.

### Tests for User Story 2 (REQUIRED) ⚠️

- [X] T017 [P] [US2] Add score-state and possession-variety assertions in tests/telemetryCoach.test.ts
- [X] T018 [P] [US2] Add headless full-match repetition and completion coverage in tests/headlessSimCpuBehavior.test.ts

### Implementation for User Story 2

- [X] T019 [P] [US2] Tune tempo release selection for varied possession pacing in src/ai/tempoRelease.ts
- [X] T020 [P] [US2] Tune structured attacking lane selection to avoid repetitive buildup patterns in src/ai/structuredAttack.ts
- [X] T021 [P] [US2] Add leading, tied, and trailing tactical modifiers in src/ai/teamTacticalService.ts
- [X] T022 [US2] Emit richer full-match evidence without changing telemetry bundle shape in src/telemetry/recorder.ts
- [X] T023 [US2] Keep persisted headless validation bundles compatible with existing analysis flows in scripts/headless-sim.mjs and scripts/telemetry-analyze-latest.mjs

**Checkpoint**: User Story 2 should now produce believable full-match variety and score-state coherence in CPU-vs-CPU validation.

---

## Phase 5: User Story 3 - Complete matches without gameplay collapse (Priority: P3)

**Goal**: Recover cleanly from loose balls, restarts, crowded defensive situations, and late-match pressure without deadlocks or irrational CPU behavior.

**Independent Test**: Exercise kickoffs, throw-ins, goal kicks, free kicks, loose balls, and late-match pressure sequences and confirm the match always returns to valid play through full time.

### Tests for User Story 3 (REQUIRED) ⚠️

- [X] T024 [P] [US3] Add loose-ball and restart recovery regressions in tests/restartAndDefenseRules.test.ts
- [X] T025 [P] [US3] Add bridge and orchestrator edge-state recovery assertions in tests/newArchitectureController.test.ts

### Implementation for User Story 3

- [X] T026 [P] [US3] Harden restart receiver protection and defensive spacing rules in src/ai/restartAndDefenseRules.ts
- [X] T027 [P] [US3] Improve loose-ball interception and recovery decisions in src/ai/playerController.ts
- [X] T028 [P] [US3] Improve emergency goalkeeper claims and clearances in src/ai/goalkeeperController.ts
- [X] T029 [US3] Resolve restart, loose-ball, and late-pressure recovery sequencing in src/core/gameOrchestrator.ts
- [X] T030 [US3] Preserve host-engine completion and recovery parity during edge states in src/gameEngine.ts and src/core/gameEngineBridge.ts

**Checkpoint**: User Story 3 should now complete edge-case matches without gameplay collapse or restart-required failures.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish repo-wide validation, documentation, and performance evidence across all stories.

- [X] T031 [P] Update validation steps and reviewer guidance in specs/001-fix-cpu-gameplay/quickstart.md
- [X] T032 [P] Update preserved gameplay-validation surface notes in specs/001-fix-cpu-gameplay/contracts/gameplay-validation-contract.md
- [X] T033 Execute repo-wide type and automated test validation through package.json scripts and tests/**/*.test.ts
- [X] T034 Execute headless 20-match completion and performance validation through scripts/headless-sim.mjs and scripts/telemetry-analyze-latest.mjs

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 → Phase 2**: Setup tasks provide deterministic fixtures and analysis inputs for all later work.
- **Phase 2 → Phases 3-5**: Foundational tasks block every user story because shared context, bridge parity, and contract coverage must exist first.
- **Phase 6**: Depends on the user stories selected for release being complete.

### User Story Dependencies

- **US1 (P1)**: Starts immediately after Phase 2 and defines the MVP gameplay repair.
- **US2 (P2)**: Starts after Phase 2; best completed after US1 because full-match quality builds on believable possession behavior.
- **US3 (P3)**: Starts after Phase 2; best completed after US1 because recovery logic depends on stable live-play decisions and after US2 for full-match validation reuse.

### Within Each User Story

- Write tests first and confirm they fail before changing runtime logic.
- Update decision logic before wiring it into orchestrator or bridge flows.
- Validate UX consistency and performance before story sign-off.

### Suggested Completion Order

1. Phase 1: Setup
2. Phase 2: Foundational
3. Phase 3: User Story 1 (MVP)
4. Phase 4: User Story 2
5. Phase 5: User Story 3
6. Phase 6: Polish

---

## Parallel Opportunities

- **Setup**: T002 and T003 can run in parallel after T001.
- **Foundational**: T005 and T006 can run in parallel after T004.
- **US1**: T009 and T010 can run together; T011, T012, T013, and T014 can run in parallel once the tests exist.
- **US2**: T017 and T018 can run together; T019, T020, and T021 can run in parallel before telemetry integration work.
- **US3**: T024 and T025 can run together; T026, T027, and T028 can run in parallel before orchestrator and bridge recovery wiring.
- **Polish**: T031 and T032 can run in parallel before the final validation runs.

---

## Parallel Example: User Story 1

```text
Task: "T009 [US1] Expand live-play controller regression coverage in tests/newArchitectureController.test.ts"
Task: "T010 [US1] Add structured possession-choice assertions for open-play build-up in tests/structuredAttack.test.ts"

Task: "T011 [US1] Refine team phase detection and intent selection in src/ai/teamTacticalService.ts"
Task: "T012 [US1] Refine outfield intent hysteresis and arbitration in src/ai/playerController.ts"
Task: "T013 [US1] Tune pass, carry, shot, and support scoring in src/ai/intentEvaluators.ts"
Task: "T014 [US1] Refine goalkeeper support, claim, and distribution choices in src/ai/goalkeeperController.ts"
```

## Parallel Example: User Story 2

```text
Task: "T017 [US2] Add score-state and possession-variety assertions in tests/telemetryCoach.test.ts"
Task: "T018 [US2] Add headless full-match repetition and completion coverage in tests/headlessSimCpuBehavior.test.ts"

Task: "T019 [US2] Tune tempo release selection in src/ai/tempoRelease.ts"
Task: "T020 [US2] Tune structured attacking lane selection in src/ai/structuredAttack.ts"
Task: "T021 [US2] Add scoreline tactical modifiers in src/ai/teamTacticalService.ts"
```

## Parallel Example: User Story 3

```text
Task: "T024 [US3] Add loose-ball and restart recovery regressions in tests/restartAndDefenseRules.test.ts"
Task: "T025 [US3] Add bridge and orchestrator edge-state recovery assertions in tests/newArchitectureController.test.ts"

Task: "T026 [US3] Harden restart receiver protection and defensive spacing rules in src/ai/restartAndDefenseRules.ts"
Task: "T027 [US3] Improve loose-ball interception and recovery decisions in src/ai/playerController.ts"
Task: "T028 [US3] Improve emergency goalkeeper claims and clearances in src/ai/goalkeeperController.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate human-vs-CPU live play independently before expanding scope

### Incremental Delivery

1. Finish Setup + Foundational to stabilize the runtime and validation harness
2. Deliver US1 as the first believable live-play increment
3. Add US2 to extend credibility across full matches and score states
4. Add US3 to harden restarts, loose balls, and late-match recovery
5. Finish with repo-wide validation and performance evidence

### Parallel Team Strategy

1. One engineer handles setup/foundational validation surfaces
2. After Phase 2, split US1 live-play logic, US2 full-match variety, and US3 recovery work across separate owners
3. Rejoin for Phase 6 validation, telemetry review, and quickstart updates

---

## Notes

- All tasks use the required checklist format with task IDs, optional `[P]`, story labels where required, and exact file paths.
- Tests are intentionally included for every behavior-changing story and for the shared gameplay-validation contract.
- Story phases are organized so each user story remains independently testable even when implementation order follows P1 → P2 → P3.
