# Leftovers — what survived the 2026-05-10 movement/passing/shooting cull

Snapshot of every code file still in the live tree (`src/`, `tests/`, `scripts/`)
after commit `ee288bf`. Removed code lives in `model_backup/` (see its
`README.md`).

The **gameplay loop is gone**: AI, controllers, coach, ball physics,
orchestrator, bridge, blackboard, behavior tree, formation/role/positioning,
pass/shot models, telemetry coach, replay/tracking adapters, and every test
covering them. What remains is the React shell, sprite/material code, the GK
neural-net subsystem, telemetry recording + DB, season/scheduling data, server
endpoints, and the analytics scripts.

## src/ — entry + shell

| Path | Purpose |
|------|---------|
| `src/main.tsx` | React root; renders `<App />` and warms the keeper-kicks query. |
| `src/App.tsx` | Top-level component; just mounts `<RetroFootball />`. |
| `src/index.css` | Global Tailwind/CSS (not listed in inventory but referenced). |

## src/ — data + shared

| Path | Purpose |
|------|---------|
| `src/types.ts` | Legacy top-level types (`Point`, `PlayerType`, `AIPlayer`, `GameState`) used by old 3D scene components. |
| `src/constants.ts` | Top-level UI/canvas constants (`CANVAS_WIDTH`, colors, `PLAYER_SIZE`) — feeds the legacy 2D `FootballGame.tsx` path. |
| `src/playbookData.ts` | Offense/defense formation tables (shotgun/spread/pro) and pass/defense playbooks. |
| `src/practicePlays.ts` | Practice-play templates + role categorisation; consumed by `TuningLab` and the practice menu in `RetroFootball`. |
| `src/mlsRatings.ts` | MLS player rating dataset. |
| `src/mlsTeamStats2025.ts` | MLS 2025 season team stats + per-team modifiers. |
| `src/seasonManager.ts` | Season schedule generator, standings tracker, CPU-vs-CPU result simulator. |
| `src/smokeTest.ts` | `window.pslSmokeTest` runner that automates CPU-vs-CPU matches inside the live app window. |

## src/core/ — slim engine layer

Most of `core/` was deleted (orchestrator, bridge, blackboard, ball physics,
belief state, motion layer). What is left:

| Path | Purpose |
|------|---------|
| `src/core/types.ts` | Slim type set kept post-cull: `Vec2`, `TeamSide`, `GameMode`, `MatchState`. (Originally 302 lines of role/intent/blackboard/belief types — restore from `model_backup/src/core/types.ts` if needed.) |
| `src/core/constants.ts` | Pitch dimensions, yard conversions, goal mouth geometry, GK arc radii, vector math helpers (`dist2`, `normalize2`, `clamp`, etc.). No movement logic. |
| `src/core/matchStateMachine.ts` | Match clock + score + restart state machine; advances half/full-time. No AI. |

## src/ai/ — keeper neural-net only

Every outfield AI file (positioning, passing, shooting, behavior tree, role
assignment, patterns, force-field, FSM, SWOS, defensive strategy, telemetry
coach, real-data replay, etc.) is gone. Surviving GK NN pipeline:

| Path | Purpose |
|------|---------|
| `src/ai/keeperNet.ts` | Pure-JS feed-forward NN for keeper distribution action selection (`throw / kick / punt / goal_kick`). |
| `src/ai/seedKeeperWeights.ts` | Generates synthetic keeper experience from a rule-based policy to seed the net. |
| `src/ai/trainKeeper.ts` | Offline trainer (policy gradient or behavioural cloning) over collected experience JSON. |
| `src/ai/headlessSim.ts` | Reference-only stub (`export {}`) — pre-rewrite headless sim was already replaced by the browser experience pipeline. |
| `src/ai/rlHarness.ts` | Re-export shim: `keeperNet`, `encodeKeeperState`, `KEEPER_ACTIONS`. Kept for any external import. |

The GK behavior tree (`goalkeeperController.ts`) was deleted — it depended on
the now-gone behavior tree, utility arbitration, and player controller.

## src/gameEngine.ts — sprite stub

Now 343 lines (was 31,034). Keeps every sprite/material/voxel-frame builder so
the React shell still compiles:

- `M` (THREE materials), `TEAM_PALETTES`, `PlayerPalette`
- `PLAYER_PATTERNS`, `PLAYER_IDLE_PATTERNS`,
  `PLAYER_FRONT_RUN_COMPOSED`, `PLAYER_FRONT_IDLE_COMPOSED`,
  `PLAYER_BACK_RUN_COMPOSED`, `PLAYER_BACK_IDLE_COMPOSED`
- `KEEPER_PATTERNS`, `KEEPER_IDLE_PATTERNS`,
  `KEEPER_DIVE_LEFT_PATTERNS`, `KEEPER_DIVE_RIGHT_PATTERNS`,
  `KEEPER_DIVE_UP_PATTERNS`, `KEEPER_DIVE_DOWN_PATTERNS`
- `buildPlayerFrame`, `buildMergedPlayerFrame`, `recolorMergedVoxelFrame`
- `initGame(container)` → returns a `Proxy<any>` whose every method is a no-op,
  so `RetroFootball.tsx` mounts without throwing. Nothing simulates, nothing renders.

## src/components/ — React UI

| Path | Purpose |
|------|---------|
| `src/components/RetroFootball.tsx` | Main game-window component; menus, formation/team selection, season hub entry, settings, telemetry overlays, practice-play toolbar. Calls `initGame` (now stubbed). |
| `src/components/AnimationInspector.tsx` | Sprite-frame inspector for player + keeper poses; uses `gameEngine` PATTERN exports. |
| `src/components/FrameViewer.tsx` | Frame-by-frame voxel viewer; uses `gameEngine` PATTERN exports. |
| `src/components/StaticImageGenerator.tsx` | Renders a player sprite to a canvas data-URL via `buildPlayerFrame`; used by player cards. |
| `src/components/Player.tsx` | Atari-style 2D sprite renderer (legacy 2D path). |
| `src/components/Ball.tsx` | `<Sphere>` ball mesh for the legacy 3D scene. |
| `src/components/Field.tsx` | 100×60 SVG/Canvas field for the legacy 2D path. |
| `src/components/Goalpost.tsx` | Goalpost mesh for the legacy 3D scene. |
| `src/components/GameScene.tsx` | Three.js scene wrapper for the legacy 3D path; consumes `GameState` from `src/types.ts`. |
| `src/components/FootballGame.tsx` | Legacy 2D football game (canvas-based). |
| `src/components/FootballGame3D.tsx` | Legacy 3D wrapper using R3F + post-processing pixelation. |
| `src/components/PlayerCard.tsx` | Player info card; embeds `StaticImageGenerator`. |
| `src/components/WRStatsCard.tsx` | Wide-receiver-style stats card. |
| `src/components/LiveTelemetry.tsx` | Live in-match telemetry overlay (passes, shots, possession). |
| `src/components/MatchHistoryDashboard.tsx` | Past-match browser fed by the telemetry DB. |
| `src/components/TuningLab.tsx` | Practice-play tuning panel; takes a `gameRef` and consumes `practicePlays`. |
| `src/components/SeasonHub.tsx` | Season management UI (create/save/delete seasons, standings, fixtures). |

Note: many of these were wired to the old game-loop API. With `initGame` stubbed
they still mount — anything that invoked a method (`gameRef.current?.foo()`)
now hits the no-op proxy and silently does nothing. Re-wire when the new engine lands.

## src/telemetry/ — recording + drift analysis

| Path | Purpose |
|------|---------|
| `src/telemetry/index.ts` | Re-export hub for the telemetry module. |
| `src/telemetry/db.ts` | Dexie (IndexedDB) schema + tables for sessions, snapshots, events, baselines, corrections. |
| `src/telemetry/recorder.ts` | Session recorder; builds drift dashboards and recommendations from snapshots. |
| `src/telemetry/analysis.ts` | Drift dashboard + correction analysis utilities. |
| `src/telemetry/keeper-kicks.ts` | Query helpers for keeper kick stats out of the telemetry DB. |
| `src/telemetry/mls2025-baselines.ts` | Real-world MLS 2025 baselines (team + global averages) used as drift reference. |

## src/server/ — Express + SQLite

| Path | Purpose |
|------|---------|
| `src/server/psl-db.ts` | `better-sqlite3` wrapper for `psl.db`; applies ghost-match filtering. |
| `src/server/matchFilters.ts` | Predicates that exclude ghost / partial / pre-kickoff match rows from history. |
| `src/server/keeper-stats.ts` | Express route `/api/stats/keeper-kicks`. |

## tests/ — surviving tests (3)

| Path | Purpose |
|------|---------|
| `tests/matchFilters.test.ts` | Verifies ghost-match filtering predicates. |
| `tests/matchStartUi.test.ts` | UI test: kickoff path clears splash before presenting. |
| `tests/pslCli.test.ts` | `psl` CLI: `doctor`, `kpi scoreboard`, unknown-command error shape. |

All three pass under `npm test`. The 17 movement/pass/shoot/orchestrator tests
were deleted (snapshots in `model_backup/tests/`).

## scripts/ — tooling

### Dev / build
| Path | Purpose |
|------|---------|
| `scripts/dev.mjs` | Start Vite dev server. |
| `scripts/preview.mjs` | Serve a Vite production build. |
| `scripts/psl.mjs` | `psl` CLI entry (`bin` in package.json). |

### Headless simulation / browser harness
| Path | Purpose |
|------|---------|
| `scripts/headless-sim.mjs` | Playwright headless runner for CPU-vs-CPU matches. (Will produce nothing useful until a new engine is wired up.) |
| `scripts/browser-harness-fixture.mjs` | Run a fixed-fixture match via Playwright against the live app. |
| `scripts/probe-headless-gpu.mjs` | Verify GPU acceleration is available in headless Chromium. |
| `scripts/open-debug-browser.mjs` | Launch a debug Chromium pointed at the local dev server. |

### Iteration / tuning
| Path | Purpose |
|------|---------|
| `scripts/iterate-overnight.mjs` | Long-running tuning loop (cycles + games-per-cycle). |
| `scripts/eval-cycle.mjs` | Phase-E evaluation loop: run N games, aggregate telemetry, compare to previous run. |
| `scripts/self-edit-loop.mjs` | Self-editing iteration helper (requires `--apply`). |
| `scripts/tuning-scoreboard.mjs` | Track tuning history and emit a scoreboard. |
| `scripts/tuning-validation.mjs` | Sanity-checks tuning runs (e.g. enforces `SAFE_MAX_SPEED`). |

### Analytics
| Path | Purpose |
|------|---------|
| `scripts/analyze-shots.mjs` | Shot-event analytics from `psl.db`. |
| `scripts/analyze-shot-distances.mjs` | Histogram shot distances from `shot-events.ndjson`. |
| `scripts/goalkeeper-analysis.mjs` | Keeper performance analytics from the DB. |
| `scripts/full-telemetry-analysis.mjs` | Aggregate telemetry analytics across many sessions. |
| `scripts/telemetry-analyze-latest.mjs` | Compare the latest session against MLS 2025 baselines. |
| `scripts/teleport-audit.mjs` | Detect player teleport / discontinuity bugs in stored snapshots. |
| `scripts/analyze-real-movement-profile.mjs` | Build a movement profile from real-world tracking data under `data/`. |
| `scripts/build-metrica-replay.mjs` | Convert Metrica sample-data CSV/JSON into replay assets. |
| `scripts/pull-match-data.mjs` | Export selected match rows from the DB. |

### Project ops
| Path | Purpose |
|------|---------|
| `scripts/project-hours.mjs` | Tracker — `start`, `stop`, `status`, log to `psl.db`. |
| `scripts/update-project-hours-report.mjs` | Refresh the rendered hours report. |

## Removed entry points still referenced by package.json scripts

These npm scripts now point at code paths that will fail or do nothing useful
until the engine is rewritten:

- `npm run sim:headless` / `sim:match` / `sim:smoke` / `sim:headless:5/10/20` —
  call `headless-sim.mjs`, which boots the app via Playwright; with `initGame`
  stubbed there is no simulation to record.
- `npm run sim:browser` — same caveat.
- `npm run iterate:overnight`, `npm run tuning:series`, `npm run eval:cycle`,
  `npm run eval:guard` — depend on the headless sim producing telemetry.

Decide during the rewrite whether to repoint or remove these.

## How to recover any removed file

```bash
# Single file
git checkout b05b8dc -- src/ai/aiPassModel.ts

# Whole directories
git checkout b05b8dc -- src/ai src/core
```

Or copy from `model_backup/` directly.
