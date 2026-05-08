# Engine / Renderer Split — Soccer Implementation Brief

**Status:** Proposed. Rewritten 2026-05-03 for the current soccer codebase.

## Problem

The gameplay model and the graphics layer are still coupled through the browser runtime.

Today's "headless" mode is not a true engine-only simulation. `scripts\headless-sim.mjs` still launches Chrome, loads the full browser app, builds the Three.js scene, runs the stadium and sprite stack, and then polls `getMatchSnapshot()` / `getTuningBundle()` from the page. That is good enough for correctness checks, but it is too slow and too fragile for bulk tuning.

For tuning loops and regression batches we want a Node-runnable engine with:

- no Three.js
- no DOM
- no React component tree
- no browser page orchestration

The gating concern remains the same: **do not break the on-screen game while doing this.** The browser renderer must continue to work, and browser gameplay plus headless gameplay must stay telemetry-equivalent.

## What "the engine" is in this repo

Today the engine is spread across `src\gameEngine.ts` plus the new-architecture core in `src\core\`.

| Module | Owns |
|---|---|
| Match state / clock | score, phases, half timing, restart state, possession accounting, scoreboard-facing match snapshot |
| New-architecture team logic | `src\core\gameOrchestrator.ts` — tactical blackboards, player-controller ticks, team intent, orchestrator event generation |
| Bridge / compatibility layer | `src\core\gameEngineBridge.ts` — maps legacy player objects into orchestrator state, syncs positions / ball / events both ways |
| Ball physics | `src\core\ballPhysics.ts` plus legacy ball-state handling in `src\gameEngine.ts` |
| Player decisions | `src\ai\playerController.ts`, `src\ai\intentEvaluators.ts`, motion and arbitration helpers |
| Restart rules | kickoff, post-goal kickoff, goal kick, throw-in, corner, foul / free-kick classification and live restart handoff |
| Telemetry emission | `pushTuningEvent(...)`, shot / pass / restart telemetry, snapshots, `getTuningBundle()` |
| Headless-facing state export | `getMatchSnapshot()`, `getTuningBundle()`, and telemetry-recorder-facing public methods on `src\gameEngine.ts` |

What is renderer-only:

| Module | Owns |
|---|---|
| Scene construction | `THREE.Scene`, camera, lights, renderer, materials |
| Stadium / props / pitch visuals | meshes, GLTF/asset setup, overlays |
| Player and ball presentation | sprites, mesh transforms, animation timing, visual markers |
| Browser UI shell | `src\components\RetroFootball.tsx`, React state, panels, dashboard triggers |
| Visual debug overlays | movement overlays, markers, browser-only debug UI |
| Browser loop glue | `requestAnimationFrame`, input, resize, render scheduling |

## The coupling that makes a split hard

The current system still has one large integration surface in `src\gameEngine.ts`:

- it imports `three`
- it owns renderer objects
- it owns gameplay state
- it mirrors orchestrator state back into meshes
- it emits analyzer-visible telemetry
- it exposes `getMatchSnapshot()` / `getTuningBundle()` to the browser

That means the browser shell is not just rendering engine state; it is still part of the gameplay runtime.

The main boundary problems are:

1. **Gameplay state lives next to renderer state.**
   - Ball state, restart state, match state, and telemetry queues are mixed into the same module that updates meshes and camera-facing objects.

2. **The new architecture is still hosted by the legacy/browser engine.**
   - `createGameEngineBridge(...)`
   - `tickBridge(...)`
   - `syncPositionsToOrchestrator(...)`
   - `syncBallToOrchestrator(...)`
   - `syncPositionsFromOrchestrator(...)`
   - `syncBallFromOrchestrator(...)`
   - `processOrchestratorEvents(...)`

   These are clean seams conceptually, but they still execute inside the browser-centric engine loop.

3. **Telemetry parity currently depends on browser integration.**
   - The analyzer depends on events like `PASS`, `SHOT`, `KICKOFF_PASS`, `KICKOFF_RECEIVED`, `SHOT_POSITION_SNAPSHOT`, restart events, pattern events, and match snapshots.
   - We already found one real regression where newarch shots existed but the bridge path did not emit `SHOT_POSITION_SNAPSHOT`.
   - Any extraction that loses event parity is not acceptable.

4. **Headless mode currently depends on page polling, not engine APIs.**
   - `scripts\headless-sim.mjs` currently asks the browser page for `window.__gameRef?.getMatchSnapshot?.()` and `window.__gameRef?.getTuningBundle?.()`.
   - A true engine split should let headless mode call the same core module directly from Node.

## Target architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  Engine core (Node-runnable, no THREE / DOM / React)       │
│                                                             │
│   • Match state: score, clock, phase, restarts             │
│   • Player state: positions, velocities, stamina, roles    │
│   • Ball state: owner, flight, rolling, restart metadata   │
│   • Team AI: orchestrator, blackboards, controllers        │
│   • Physics: movement, ball collection, shot / pass model  │
│   • Rules: kickoff, throw-ins, corners, goal kicks, fouls  │
│   • Telemetry: event queue + bundle builder                │
│   • Deterministic RNG: seed-in, replay-out                 │
│                                                             │
└────────────────────────┬────────────────────────────────────┘
                         │ consumed by
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Browser adapter / renderer                                │
│                                                             │
│   • Constructs Three.js scene                              │
│   • Mirrors engine state into meshes / sprites             │
│   • Runs requestAnimationFrame                             │
│   • Reads engine telemetry for dashboard/UI                │
│   • Owns camera, overlays, visual debug                    │
│                                                             │
└────────────────────────┬────────────────────────────────────┘
                         │ same engine also used by
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Node headless runner                                      │
│                                                             │
│   • Imports engine core directly                           │
│   • Runs update(dt) in a tight loop                        │
│   • Writes the same match snapshot / tuning bundle         │
│   • Powers batch tuning without Chrome                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Two entry points:

- **Browser**
  - constructs renderer + engine
  - mirrors engine state to meshes each frame
  - keeps current UI / visual behavior

- **Node**
  - constructs engine only
  - runs simulation directly
  - emits the same analyzer-visible events and snapshots

## Migration phases

This should not be one giant rewrite. Break it into mergeable phases that preserve behavior.

### Phase 0 — Define the parity contract

Before moving code, define the engine outputs that must stay identical between browser and Node.

Minimum parity set:

- `getMatchSnapshot()` shape
- `getTuningBundle()` shape
- event timing / ordering for:
  - `PASS`
  - `SHOT`
  - `SHOT_POSITION_SNAPSHOT`
  - `SHOT_ON_TARGET_POSITION_SNAPSHOT`
  - `RECOVERY`
  - `INTERCEPTION`
  - `CLEARANCE`
  - `KICKOFF_PASS`
  - `KICKOFF_RECEIVED`
  - goal / corner / goal-kick / throw-in / foul restart events
- final score, shots, SOT, corners, possession, and restart counts

This parity contract blocks merge if browser and Node diverge.

### Phase 1 — State and position abstraction

Move gameplay-critical state behind plain-object accessors so it no longer depends on mesh ownership.

Targets:

- player positions / velocities
- ball position / velocity / held state
- match clock
- restart metadata

Goal:

- the engine path reads and writes plain state objects
- the renderer path mirrors those objects to `THREE.Object3D` instances

This phase should reduce direct gameplay dependence on renderer objects inside `src\gameEngine.ts`.

### Phase 2 — Telemetry / snapshot extraction

Lift the analyzer-facing export layer into an engine-owned module.

Targets:

- `getMatchSnapshot()`
- `getTuningBundle()`
- event queue construction
- shot / pass / restart snapshot helpers

Why this matters:

- headless mode, analyzer tooling, and parity tests should consume engine outputs directly
- browser UI should read those outputs, not define them

This phase is independently valuable because it hardens the telemetry contract even before the full split lands.

### Phase 3 — Extract newarch core from browser host

Promote the current orchestrator stack into a clean engine-core package:

```text
src\engine\
  index.ts
  state.ts
  update.ts
  matchFlow.ts
  restarts.ts
  telemetry.ts
  rng.ts
  adapters\
    browser.ts
```

Likely moved or wrapped first:

- `src\core\gameOrchestrator.ts`
- `src\core\ballPhysics.ts`
- `src\ai\playerController.ts`
- `src\ai\intentEvaluators.ts`

At the end of this phase, the new-architecture simulation loop should run without Three.js.

### Phase 4 — Replace bridge-hosted gameplay with engine-owned update loop

Today the browser loop owns the truth and the orchestrator is partially hosted inside it.

Move toward:

- engine core owning match update
- browser adapter feeding inputs and mirroring outputs
- legacy compatibility code becoming a thin adapter instead of the top-level runtime

This is the riskiest phase because restart law, scoring, telemetry emission, and compatibility with existing browser behavior all meet here.

### Phase 5 — Browser adapter simplification

Make `src\gameEngine.ts` thinner.

Desired end state:

- engine core update call
- state-to-render-object mirroring
- browser-only overlays and presentation
- no engine-critical logic that depends on `three`

The renderer should become a shell around engine state rather than a mixed gameplay host.

### Phase 6 — Node simulator

Add a direct simulator entry point that does not launch Chrome:

```text
scripts\sim-engine.mjs
```

Sketch:

```js
import { createMatch, updateUntilFullTime, getMatchSnapshot, getTuningBundle } from '../src/engine/index.js'

const match = createMatch({ homeTeam, awayTeam, seed, query: { newarch: true } })
while (getMatchSnapshot(match).phase !== 'FULL_TIME') {
  match.update(1 / 60)
}
const snapshot = getMatchSnapshot(match)
const bundle = getTuningBundle(match)
```

This becomes the fast path for:

- one-off tuning checks
- regression fixtures
- batch KPI runs

### Phase 7 — Batch runner

Add a worker-based runner for many seeded fixtures:

```text
scripts\batch-sim-engine.mjs --games 100 --workers 8
```

This should produce the same saved report shape currently used by:

- `scripts\headless-sim.mjs`
- `scripts\telemetry-analyze-latest.mjs`

## Things to handle carefully

### Deterministic RNG

Replace free `Math.random()` usage in the engine path with a seeded RNG.

Why it matters:

- kickoff regressions become reproducible
- sterile-loop bugs become reproducible
- browser-vs-Node parity becomes testable
- telemetry drift can be debugged with fixed seeds

### Timebase parity

The engine must be truly `dt`-driven.

We already hit one real bug where orchestrator elapsed-time accumulation used the wrong time source. Extraction must not reintroduce wall-clock coupling.

### Restart law parity

Kickoffs, post-goal restarts, corners, goal kicks, throw-ins, and foul restarts are currently sensitive integration points. They must behave identically in browser and Node, including intended receiver windows and last-touch classification.

### Telemetry contract stability

This is critical. The analyzer only works if the engine still emits the same event shapes. The shot-snapshot regression we already fixed is the exact class of bug this split must prevent.

### Legacy / newarch coexistence

If the legacy path and the new architecture both remain in the repo during migration, the engine boundary must be explicit:

- shared match / telemetry interfaces
- separate update implementations where needed
- no accidental browser-only behavior leaking into newarch headless mode

### Renderer-only audits

Any integrity checks that depend on sprite meshes, UUIDs, overlays, or DOM state stay on the renderer side. Engine-only checks should use plain state.

## Risk register

| Risk | Mitigation |
|---|---|
| Extraction accidentally changes gameplay | parity test by seed, fixture, and event stream before merge |
| Node and browser disagree on restart or telemetry timing | block merge on kickoff / restart / shot-snapshot parity suite |
| `src\gameEngine.ts` hides more coupling than expected | land phases 1-3 first; get telemetry and state boundaries stable before deeper extraction |
| Seeded RNG shifts overall KPI distributions | rerun tuning baselines after seeding lands; accept deterministic drift only with explicit recalibration |
| Headless output shape breaks analyzer scripts | keep saved bundle and match snapshot contracts stable throughout migration |
| Migration stalls because browser and engine refactors are intertwined | keep browser adapter changes thin and postpone visual cleanup until engine parity is proven |

## Suggested file layout after extraction

```text
src\
  engine\
    index.ts
    state.ts
    update.ts
    matchFlow.ts
    restarts.ts
    telemetry.ts
    rng.ts
    orchestrator.ts        // wrapper around current core orchestrator
    ballPhysics.ts         // extracted from current core
    ai\
      playerController.ts
      intentEvaluators.ts
    adapters\
      browser.ts
  renderer\
    scene.ts
    sprites.ts
    overlays.ts
```

This does not have to be the final folder layout, but the conceptual split should look like this.

## Definition of done

- A direct Node simulator can run a full soccer match without launching Chrome.
- The Node simulator can write the same report shape currently consumed by the telemetry analyzer.
- Browser and Node runs with the same seed produce the same:
  - scoreline
  - restart sequence
  - pass / shot / recovery event stream
  - kickoff telemetry
  - shot snapshot telemetry
- Browser gameplay still renders and behaves the same from the user's point of view.
- Engine-core modules have:
  - zero `import 'three'`
  - zero DOM access
  - zero React dependencies

## Out of scope

- Replacing the current renderer
- UI redesign
- New dashboard features
- Network multiplayer
- Replacing the telemetry DB or analyzer format
- Tactical retuning itself

This extraction should make tuning faster and safer; it is not a substitute for the gameplay fixes still needed in the current model.

## Recommended order if work starts soon

1. Phase 0 parity contract
2. Phase 2 telemetry / snapshot extraction
3. Phase 1 state / position abstraction
4. Phase 3 newarch core extraction
5. Phase 6 Node simulator
6. Phase 5 browser simplification
7. Phase 7 batch runner

This order prioritizes the parts that reduce risk for current gameplay debugging:

- reproducible telemetry
- stable analyzer inputs
- faster headless verification

---

If implementation gets blocked, the best current boundary references are:

- `src\core\gameOrchestrator.ts`
- `src\core\gameEngineBridge.ts`
- `src\core\ballPhysics.ts`
- `src\gameEngine.ts` (`getMatchSnapshot`, `getTuningBundle`, orchestrator event processing)
- `scripts\headless-sim.mjs`
- `scripts\telemetry-analyze-latest.mjs`

Those files define the real engine/headless/telemetry seam in the current soccer codebase.
