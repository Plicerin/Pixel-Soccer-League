# PSL Handover — 2026-04-26

You're picking up Pixel Soccer League (PSL) cold. This document gets you from "what is this repo" to "I can keep working" in 15 minutes. Read top to bottom the first time.

---

## What is this project

Pixel Soccer League is a browser-based soccer simulation, pixel-art aesthetic, deep tactical AI. CPU-vs-CPU matches run in real time with two teams of 11 players each on an MLS-licensed roster. The user (Plicerin / vrocket@gmail.com) is iterating on the AI to produce realistic match telemetry — goals per match, pass distribution, shape, pattern execution, etc., benchmarked against MLS 2025 baselines.

The user is the only player and reviewer. They run matches in a browser, watch what happens, give feedback. There is no other team or stakeholder.

The repo is at `C:\Users\vrock\Documents\Pixel Soccer League` (Windows, PowerShell, Vite dev server on port 3001).

---

## Tech stack

- **Three.js + React Three Fiber** — 3D rendering of the field, ball, players (rectangular pixel sprites, fixed cameras)
- **TypeScript + Vite** — bundler and dev server with HMR
- **React** for non-canvas UI (menus, scoreboard, pre-match setup, season hub)
- **better-sqlite3** as a Vite middleware-served match database (`psl.db` at repo root)
- **Playwright (chromium)** for headless match runs
- **No backend** — Vite dev plugin (`vite.config.ts`) exposes `/__db/match-result`, `/__db/matches`, `/__tuning/push` middlewares that read/write `psl.db`. There is no separate Node server in production.

Run locally:
```bash
npm install
npm run dev    # starts Vite on http://localhost:3001
```

Open the URL, click through the splash, choose teams, kick off. Match plays in real time (~5 min real-time per half).

---

## Architecture orientation

### The big files

- **`src/gameEngine.ts`** — ~24,000 lines, single factory function `initGame(container)`. This is everything: scene setup, players, ball physics, AI decisions, restart logic, halftime, FT, telemetry emission. **Almost all engine logic lives here.** The size is intentional (everything is closure-scoped on the same factory) but searching/editing requires Grep+Read patterns rather than Plan-mode reasoning. Use `grep -n <symbol> src/gameEngine.ts` to navigate.
- **`src/components/RetroFootball.tsx`** — main React component. Mounts the engine, renders DOM overlays (FT screen, menu, history dashboard), wires Vite middleware fetches, runs a 2s `setInterval` "dashboard bridge" that pushes telemetry and triggers FT save.
- **`src/ai/*`** — pure modules pulled out of gameEngine.ts for testability. `patternEngine.ts`, `fsmPositioning.ts`, `tacticalPositioning.ts`, `forceFieldPositioning.ts`, `simpleOffenseModel.ts`, `aiPassModel.ts`, `aiShotModel.ts`. Each is a few hundred lines.
- **`scripts/*`** — Node CLI tools. `headless-sim.mjs` drives chromium for automated games, `telemetry-analyze-latest.mjs` reads psl.db and prints a match report, `iterate-overnight.mjs` runs cycles, `eval-cycle.mjs` is a parked aggregator (see Known limitations).

### The runtime model

When you load the page:
1. React mounts `RetroFootball.tsx`, which calls `initGame(container)` from `gameEngine.ts`. That returns a `gameRef` object with public API (`startKickoffPresentation`, `setTeamNames`, `getMatchSnapshot`, `getTuningBundle`, etc.) and stashes itself at `window.__gameRef`.
2. The engine sets up Three.js scene, players, ball physics, an `animate()` `requestAnimationFrame` loop calling `_simulateStep(now)` every frame, and a `setInterval`-based fallback for backgrounded tabs.
3. React then runs `useEffect`s that drive the splash screen, menu, kickoff handler, telemetry bridge, FT screen.
4. When the user picks teams and clicks Kick Off, React calls `gameRef.setTeamNames`, `setCpuVsCpu(true)`, `startKickoffPresentation(true)`. Engine takes over.
5. Each frame: `_simulateStep` calls AI decision logic for every player, runs ball physics, records telemetry events, checks half / FT.
6. At full time, the engine emits FULL_TIME phase. React's dashboard bridge sees this, posts a bundle to `/__db/match-result`, which writes to `psl.db`.
7. `npm run telemetry:analyze` reads the latest row from `psl.db` and prints a structured analysis.

### Telemetry-driven iteration

This is the workflow we live in:

1. User plays a match
2. After FT, run `npm run telemetry:analyze`
3. Read the report — focus on goals, long-range SOT, pattern crosses, final-third overloads, defenders-in-box-at-goal, pattern → goal share
4. Decide what's wrong; make a code change
5. User plays another match
6. Compare numbers

Per-match snapshot files in `telemetry/snapshot-*.json` are saved by hand (just `node -e` writing aggregates) for posterity. The DB has the full data; snapshots are decision-point summaries.

There's also an MLS-baseline JSON at `src/telemetry/mls2025-baselines.ts` with target ranges (goals 1.5-3.5, corners 4-7, etc.). The analyzer prints drift vs these.

---

## Where to pick up (today)

You are on `structured-attack-v1`. Latest pushed code state before this handover update:
- `a3926f1 Backprop pass, goal, and cross telemetry guards`
- `ff53b93 backprop §B.13 + §V.16: hide ghost match rows`
- `cf59495 Add structured attack delivery controls`

The repo is development-playable. The current structural target is **shape / width ownership**: wide attacking roles and home positions are still being swallowed by the broader movement-force stack. User-run Kansas City vs Atlanta telemetry showed pass resolution is no longer the immediate blocker, but average team width stayed around 15 units and home-position error stayed around 13.

Important workflow rule: when the user gives two team names, two shorthand names, or a score line, assume they just ran a game and want telemetry analysis from existing saved data. Do **not** start a new sim unless they explicitly ask for one.

---

## State of branch

### What's deployed

**FSM positioning substrate** (Phase A1 → A2 → A.5):
- `src/ai/fsmPositioning.ts` — single-owner deterministic off-ball target.
- The legacy off-ball pipeline had three layers (force-field, tactical, pattern role) all writing the same `finalTarget` Vector3 each frame. Last writer won, with `lerp` blends. Result: NEAR_POST_RUNNER fwdX swung -3 to +7 across matches with the same code — pure variance, not tunable.
- FSM substrate replaces this with a hard pre-pass (in `gameEngine.ts` at the top of the per-tick player loop) that steers every off-ball player except: ball holder, both keepers, one designated `bestDefender` per team (closest non-keeper), human-controlled players. Skipped players fall through to legacy logic.
- Pattern role override is authoritative when a pattern is active.
- Phase A.5 added two states on top:
  - `BOX_CRASH` — attackers (ST/CF/LM/RM/CM/CAM) run to NEAR_POST / FAR_POST / cutback / edge-of-D when their team carries past midfield
  - `COLLAPSE_DEFEND` — 2 closest defenders (CB/LB/RB/DM) converge on ball+goal axis when opponent has ball in own final third

**Pattern engine** (`src/ai/patternEngine.ts`):
- `selectPattern`, `isPatternStillValid`, `getPatternRole`, `computePatternRoleTarget`
- Per-team patterns: `WING_ATTACK_LEFT`, `WING_ATTACK_RIGHT`, `COUNTER_ATTACK`, `PATIENT_BUILDUP`, `CENTRAL_COMBO` (less used), `SWITCH_OF_PLAY` (less used)
- Each pattern assigns roles to players: `CARRIER`, `NEAR_POST_RUNNER`, `FAR_POST_RUNNER`, `CUTBACK_RECEIVER`, `RUNNER`, `SUPPORT`, `OUTLET`, `ANCHOR`, `WALL`
- Retrigger cooldowns (3-3.5s for WING/COUNTER, 1.5s for BUILDUP) prevent the same pattern firing immediately again
- Halftime reset clears pattern + counter/transition state (commit `6e29b02`)

**Pattern cross fire**:
- When the carrier reaches a "crossing zone" during a WING_ATTACK or COUNTER pattern, fire a cross to NEAR_POST_RUNNER / FAR_POST_RUNNER / CUTBACK_RECEIVER
- Widened crossing zone (carrier role CARRIER/RUNNER/NONE, carrierAttackX > 0, broader |z| and goal-distance) — was 0 events, now 0-5 per match
- Pattern-scoped 1.5s cooldown prevents the 200-event spam from earlier (lane-blocked crosses re-fired every 0.1s)
- LONG_LOFTED fallback when DRIVEN cross lane is blocked (Phase A.5 brings extra defenders into the box, so ground crosses get blocked more)

**Telemetry guard fixes from `a3926f1`**:
- `src/ai/passResolution.ts` adds segment-based route-target collection so receivers can gather a moving pass when the ball crosses their catch radius between frames.
- Intended passes now expire through `expireIntendedPass(...)`, mark the latest `PASS` as `completed=false`, and emit `PASS_UNRESOLVED` instead of silently hanging.
- `src/ai/goalValidation.ts` blocks non-shot goal crossings until an explicit own-goal classifier exists. Goals must be shot-backed under SPEC §V.17.
- `src/ai/crossTelemetry.ts` separates structured deliveries from real crosses. `PATTERN_DELIVERY_EXECUTED` counts all launched deliveries; `PATTERN_CROSS_EXECUTED` is only for wide-channel passer into a central/box/scoring target under SPEC §V.18.
- `scripts/telemetry-analyze-latest.mjs` and `scripts/eval-cycle.mjs` now report/track pattern deliveries and real crosses separately.

**Ghost-match defenses** (this was an extended saga — see "Gotchas"):
- Splash background demo permanently disabled (was the original ghost source; auto-fired Inter Miami vs LA Galaxy demo behind the splash screen)
- Server-side `/__db/match-result` middleware rejects bundles with `sessionActive=false`
- Smoke-test runs gated out of React auto-save (was polluting the dashboard)
- Match-start hard-blocked when `splashSceneMode` is true (backstop)
- `resetMatch` forces `isLive=false` after `startSoccerRestart` so the menu screen doesn't run a background simulation (this was the final, most stubborn ghost)
- DB/dashboard filtering also hides ghost rows using SPEC §V.16: inactive/demo/smoke rows must not appear in the match dashboard or analyzer default path.

**Diagnostic tooling**:
- **FSM panel** (top-left of game canvas, green border when active): live `FSM:ON/OFF`, `CARR:ON/OFF`, ticks count, handled count, designated pressers per team, current carrier name, last carrier decision, active patterns. Click toggles FSM positioning. Shift-click toggles CARR (Phase B, branch only).
- **MATCH START LOG** (top-right, orange border): every match start + every blocked match start with caller stack hint. Click to copy contents to clipboard. If a ghost match appears, the panel will name the function that triggered it.
- `scripts/telemetry-analyze-latest.mjs` — full match analyzer: per-team×half flip splits with segment counts, pattern tempo with realism-fit bands, role alignment (NEAR_POST fwdX etc.), defenders-in-box-at-goal, final-third overloads, multi-touch sequences.
- `scripts/eval-cycle.mjs` — multi-game cycle runner with delta vs baseline (currently parked because headless gameplay produces ~0 shots; see "Known limitations" below).

### Verified across 17 matches

| Metric | Pre-FSM | Current |
|---|---|---|
| Goals/match | 4-10 | 1-5 (mostly in MLS band) |
| Long-range SOT | 11-21 | 0-12 (mostly low) |
| Pattern → goal share | 30-50% | 50-100% |
| Backpasses | 322-394 | 118-280 |
| Final-third overloads | 0 every match | 0-21, both teams now register |
| Pattern crosses | 0-1 (sometimes spam) | 0-5, mix of DRIVEN + LONG_LOFTED |
| Defenders @ goal | 0.6-1.17 | 1.0-2.0 |

Snapshots saved per match in `telemetry/snapshot-2026-04-2{4,5}*.json`. Each is a structured JSON with the headline numbers from that match.

---

## Branches

```
structured-attack-v1    ← current working branch, pushed
main                    ← older Phase A.5 + cross fix baseline
fsm-positioning         ← merged into main via bae0448 (kept for reference)
phase-b-carrier         ← parked, NOT merged (failed to ship; see post-mortem below)
claude/determined-mcclintock ← unrelated old branch from earlier work
```

To revive Phase B: `git checkout phase-b-carrier`. To abandon it: `git branch -D phase-b-carrier` after the next clean merge.

The user has explicitly asked to commit and push recent handover/code changes on `structured-attack-v1`. Do not push unrelated generated telemetry or runtime files.

---

## Conventions and gotchas

### Caveman mode
The user runs in `caveman` mode (a custom output style that drops articles/fillers). The user's messages will look terse — that's intentional. **Don't write code or commits in caveman style.** Caveman is for chat output, not artifacts. Comments and commit messages stay in normal English.

### HMR caching
Vite's HMR keeps stale closures alive in some cases. The React `useEffect` `setInterval` callback in particular: if you change code inside the callback, HMR replaces the module export but the running interval still holds the old closure. Symptoms: code change committed, hard reload shows new behavior, but soft reload (HMR) doesn't.

**Always tell the user to hard reload (Ctrl+Shift+R) after changes that touch:**
- React `useEffect` bodies
- Anything inside `setInterval` / `setTimeout` callbacks
- The `gameEngine.ts` factory function (for runtime state changes)

### Vite watch.ignored
Telemetry files are in `vite.config.ts`'s `server.watch.ignored` list. **Don't write game state to a file outside that list during a running match** — Vite will trigger a page reload mid-match. We learned this the hard way; `telemetry/latest-report.json` was added to the ignore list (`26f4274`).

### Match flow gotchas
- `startKickoffPresentationSequence` is the official "start a match" entry point. It now traces to MATCH START LOG and refuses when `splashSceneMode` is true.
- `resetMatch` (called from "Return to Main Menu") *also* calls `startSoccerRestart('KICK_OFF', ...)` to stage formation. The downstream `releaseRestart` flips `isLive=true`. We force it back to false in `resetMatch` (`d4a8a37`). If you ever re-enable matches from a menu state, check this.
- Set-piece formations (corners, throw-ins, free kicks) bypass the FSM pre-pass via their own `cornerPresentation` / `throwInPresentation` paths. So during set pieces, players cluster — that's not a bug, the FSM only owns open-play.

### Telemetry events
`pushTuningEvent(elapsedInHalf, half, type, team, role, detail)` writes to `tuningEventLog`. The analyzer reads these. If you add a new event type, the analyzer won't know about it — add a handler in `scripts/telemetry-analyze-latest.mjs`.

### Telemetry access procedure
When the user gives two teams or a score line, they just ran a match. Analyze existing telemetry; do not run a new sim.

Use this order:
1. Check `telemetry-snapshots.json` to confirm the latest session, teams, score, and full-time state.
2. Do not trust `telemetry/latest-report.json` or `telemetry/latest-report.md` blindly; those can be stale exports from a previous analyzer run.
3. Query recent SQLite rows:
   ```bash
   sqlite3 psl.db "select id, session_id, datetime(timestamp/1000,'unixepoch'), team_a_name, team_b_name, score_a, score_b, shots_a, shots_b, shots_on_target_a, shots_on_target_b, possession_a from match_results order by id desc limit 12;"
   ```
4. Select the row that matches the user's fixture or score. Parse `match_results.bundle_json` as the authoritative telemetry bundle.
5. Inspect `teamA/teamB`, `events`, `passLog`, `goalLog`, `shapeA/B`, `playerPositioning`, `teleportation`, and `passNetwork`.

Known accounting smell: at least one user-run bundle had `passNetwork` edges where `completed > count`. Treat pass-network completion ratios as suspect until that is fixed; prefer `passLog`/team summary for pass completion.

### Gameplay metrics
- `MLS_BASELINE` is the realism target. We compare drift against this.
- `force shots` count is high (often >90% of all shots are forced overrides). The intent is to keep matches dynamic; the user has mixed feelings about this.
- `pattern → goal share` is our headline measure of whether the AI is "playing soccer" vs "just hoofing it forward".

### Player object lifecycle
Player objects are recreated at every halftime via `setupFormation()` (`gameEngine.ts:15229`). Anything stashed on `playerAny._someField` survives only the half. Engine-level state (`gameState.teamPatternA`, etc.) does survive, which is why we explicitly clear it at halftime.

### File watchers and DB
`psl.db` is at repo root. The Vite middleware in `vite.config.ts` opens it via `better-sqlite3` lazily (`getDbModule`). Schema is in `src/server/psl-db.ts`. To inspect manually:
```js
const Database = require('better-sqlite3');
const db = new Database('./psl.db');
console.log(db.prepare('SELECT id, team_a_name, team_b_name, score_a, score_b FROM match_results ORDER BY id DESC LIMIT 5').all());
```

### TypeScript forward references
The engine factory is one giant function. Closures captured early (e.g. panel-render functions at line 3200) reference variables declared later (e.g. `gameState` at line 5700). TypeScript flags this as TS2448 "used before declaration." Workaround: stash on `window` or use try/catch with optional chaining. We hit this twice this session.

---

## Known issues / what's still undercooked

**Drive-then-backpass** (ORIGINAL user complaint, NOT FIXED on main):
- Carrier sprints with ball, hits some legacy threshold, picks first backward pass option, recycles. Phase A.5 didn't address carrier decision logic. Phase B attempted full rewrite and failed (see post-mortem).
- Still relevant, but not the current top blocker after the structured-attack pass/goal/cross guard pass.

**Pattern role alignment variance**:
- NEAR_POST_RUNNER and FAR_POST_RUNNER fwdX swings -11 to +11 across matches with same code. Box-crash is meant to fix this but pattern role lookup happens at pattern start and the player who got the role may not actually advance.

**Corner volume always 0**:
- MLS baseline is ~5 corners/team/match. We have 0-2. Deflection / blocked-shot / out-of-play logic isn't producing corner kicks. Untouched in this work.

**Heat map narrow** (center+narrow 60-75%):
- Shape holds tighter than real soccer. Wingers don't stretch wide enough during build-up. Latest Kansas City vs Atlanta user-run telemetry still had average widths around 15 units; target should be closer to 18+ before cross/play shape will look believable.
- This is now the main structural concern: the movement-force stack can swallow finely tuned pattern and home-position intent.

**Pass-network accounting bug**:
- Some `passNetwork` edges report `completed > count`. Do not use those edge-level completion ratios as truth until the aggregation logic is fixed.

**Cross baseline interpretation**:
- Old telemetry inflated `PATTERN_CROSS_EXECUTED` because it counted every structured delivery as a cross. New code splits deliveries from actual crosses. Re-baseline with future user-run matches before tuning cross volume.

**H2 zigzag noise**:
- Per-segment flip rate H2/H1 ratio averages 1.2-1.5x. Original 4-match sample showed 2-6x but proved to be carrier turnover counts, not actual zigzag. Halftime-reset commit (`6e29b02`) reduced total flips ~30% but didn't eliminate the asymmetry. Low priority — confirmed mostly noise.

**Long-range SOT 3-12 per match**:
- Down from 11-21 pre-FSM but still above MLS realism (0-3 typical). Carrier shooting from edge of penalty area is the dominant remaining shot type. Tied to legacy carrier decision logic.

**Pattern over-fire post halftime cooldown reset**:
- Halftime clears pattern cooldowns so H2 can fire patterns immediately. Combined with FSM A.5 produces 100+ patterns per team per match (was 70-90). Each pattern is shorter (2-3s avg). Possible side effect: more carrier turnovers.

---

## Phase B post-mortem (why carrier rewrite failed)

Three commits on `phase-b-carrier` branch attempted to replace the legacy carrier decision tree with a sensible-soccer-style FSM. All failed in different ways:

**v1** (`1f84bef`): three-state model SHOOT/PASS/CARRY with binary gates and 3 fixed-heading carry choices. Tested in Toronto-KC: 0 shots, 0 goals, 3 backpasses, 160 possessions. Failure mode: pass threshold too loose → carriers passed immediately → 1.4-touch sequences → ball never settled.

**v1.5** (`5c64be4`): tightened pass threshold to require 9u progress (5u under pressure), 22% probability gate. Was never actually tested — user reloaded between matches without re-toggling CARR, so the "Mia-Sea" data point with 134 backpasses was actually Phase A.5, not Phase B.

**v2** (`c45a8ba`): rewrote with weighted-influence dribble (mate/opp/goal weights for left/center/right turn) and probabilistic shoot (visualWidth × distance²). Default flipped to ON. Tested in Charlotte-NYC: 0 goals, 1 shot, 9 carrier flips total, top B-line 27.8u in 9.95s = 2.8 u/s.

**Root cause across all three versions**: the FSM carrier returns a decision (SHOOT/PASS/CARRY) but doesn't write the carrier's motion state (sprint, dribble aggression, target speed). The legacy `executeSimpleCarrierDecision` configures these as side effects of its decision tree. When FSM short-circuits with just "go to target", the movement loop downstream falls back to default hold-speed (~2.8 u/s vs typical 5-8 u/s for a real run).

**Architectural fix would be**: either return a full motion descriptor from FSM and have the movement loop read it, or detect FSM mode and apply higher default aggression. Either is more invasive than a single-session afternoon.

---

## Recommended next step (shape ownership)

The next useful work is not one-percent tuning. Treat this as a structural movement-ownership problem:

1. Map the open-play movement pipeline in `src/gameEngine.ts`: FSM target, pattern role target, home-position pull, force-field pull, ball attraction, defensive collapse, and any final `lerp` writes to the same player target.
2. Add or expose telemetry that shows, per role, which owner won the final target in each phase: home, pattern, support, box crash, defender collapse, carrier support, fallback force-field.
3. Give wide roles an authoritative open-play owner during build-up and structured attacks. LM/RM/LW/RW/fullback outlet positions should not be blended back into the center every frame.
4. Re-run against user-played telemetry only. Target first-order shape improvements: average width >= 18, lower home-position error, wide channels visibly occupied, and no loss of pass completion into the 70s.
5. After width is believable, re-check real cross count using the new delivery/cross split. Do not tune cross volume from old `PATTERN_CROSS_EXECUTED` counts.
6. Then fix pass-network accounting (`completed > count`) so dashboard ratios can be trusted again.

Carrier/backpass cleanup remains useful, but width and final-target ownership are the bigger reason the game does not yet look like real soccer.

---

## How to use the diagnostic tooling

**During a match**:
- Top-left FSM panel: live state. Click toggles FSM positioning. (Shift-click toggles CARR only on `phase-b-carrier` branch.)
- Top-right MATCH START LOG: every kickoff. Click to copy text to clipboard. If a ghost match appears, the panel will name the caller.

**After a match**:
```bash
npm run telemetry:analyze
```
Reads from `psl.db` and prints the full report (~80 lines). Key sections: MLS baselines, pattern → goals, role alignment, carrier trajectories with team×half splits, multi-touch opp-half, final-third overloads, defenders-in-box-at-goal.

**To inspect the DB directly**:
```bash
sqlite3 psl.db "select id, session_id, datetime(timestamp/1000,'unixepoch'), team_a_name, team_b_name, score_a, score_b from match_results order by id desc limit 12;"
```

If the user gives a fixture, match by teams/session/score first, then inspect `bundle_json`. `latest-report` files are convenience exports, not authoritative source.

**To delete a polluted row**:
```bash
node -e "const Database = require('better-sqlite3'); const db = new Database('./psl.db'); db.prepare('DELETE FROM match_results WHERE id = 999').run(); db.close();"
```

**Eval cycle (parked)**:
```bash
npm run eval:cycle -- --games 4 --label some-label
```
Currently produces near-zero shots due to headless playwright difference from real browser. Don't trust the output until that's investigated.

---

## URL parameters (override flags)

- `?fsm=off` — disable FSM positioning (legacy pipeline)
- `?fsm=on` — force FSM positioning on
- `?carrier=off` — disable Phase B carrier (only effective on `phase-b-carrier` branch)
- `?carrier=on` — force Phase B carrier on (only effective on `phase-b-carrier` branch)

---

## File map

```
src/ai/fsmPositioning.ts          — Phase A2 + A.5 substrate (single-owner off-ball)
src/ai/patternEngine.ts           — pattern selection + role assignment + role targets
src/ai/passResolution.ts          — route-target pass collection and segment crossing helper
src/ai/goalValidation.ts          — shot-backed goal validation
src/ai/crossTelemetry.ts          — delivery vs real-cross classifier
src/ai/fsmCarrier.ts              — Phase B v2 (parked on phase-b-carrier branch only)
src/ai/tacticalPositioning.ts     — legacy tactical layer (referenced from FSM-off path)
src/ai/forceFieldPositioning.ts   — legacy force-field layer (referenced from FSM-off path)
src/ai/aiPositioningModel.ts      — composes the legacy layers
src/ai/aiPassModel.ts             — pass selection (used by carrier decision)
src/ai/aiShotModel.ts             — shot decision evaluator
src/ai/simpleOffenseModel.ts      — alternative simpler offense logic, parallel path
src/gameEngine.ts                 — engine entry, FSM pre-pass, panel rendering, ~24k lines
src/components/RetroFootball.tsx  — React app, dashboard bridge, FT save logic
src/components/MatchHistoryDashboard.tsx — DB-backed history UI
src/components/SeasonHub.tsx      — season-mode UI
src/server/psl-db.ts              — better-sqlite3 wrapper, schema
vite.config.ts                    — Vite plugins + middleware (the "backend")
scripts/telemetry-analyze-latest.mjs  — match analyzer (Node CLI)
scripts/eval-cycle.mjs            — multi-game cycle runner (parked)
scripts/headless-sim.mjs          — playwright-driven headless match runner
scripts/iterate-overnight.mjs     — older overnight cycle runner
telemetry/snapshot-2026-04-*.json — per-match snapshots, 13+ files
HANDOVER.md                       — this file
handoff.md                        — older short handoff, keep current enough for telemetry procedure
SPEC.md                           — older spec doc, partial coverage
STRUCTURAL_PLAN.md                — earlier plan, mostly superseded
psl.db                            — match results SQLite DB
```

---

## Working with the user

The user is technical (writes commits, knows git, reads code), runs matches manually, gives terse feedback in caveman style. They prefer:

- **Concrete progress over discussion.** They will say "do it" and expect code, not more questions.
- **Team-name shorthand means telemetry analysis.** If they say "Dallas Chicago", "MIA 2 LA 0", or similar, analyze the match they just ran from saved telemetry. Do not kick off a new sim unless explicitly asked.
- **Full sims are for overnight sessions.** During normal interactive work, prefer existing telemetry, analyzer runs, lint/tests, and short smoke checks.
- **Recommendations over option lists.** When you offer choices, name your top pick first with reasoning.
- **No fake autonomy.** I once said "I'll work on it overnight" — they correctly called me out: I'm not a background process. Don't promise work that requires me to keep running.
- **Honesty about failure.** Phase B failed three times. Each time, I named it a failure clearly and rolled back. The user appreciated that more than papering over.
- **Visual feedback.** They asked for on-screen panels instead of console output for diagnostics. Honor that pattern — if something needs to be visible to the user, render it on the canvas.
- **Hard reload as a debug step.** When changes don't appear to take effect, the answer is almost always "hard reload" because of HMR caching. Tell them this every time.

The user can't run shell commands themselves easily during a match — they're using the browser. If you need them to do something, give a single copy-pasteable instruction or surface it in a panel.

---

## Open questions for whoever picks this up

1. Should `phase-b-carrier` be deleted or kept around? Currently kept.
2. Headless gameplay broken (0 shots in playwright). Is the eval-cycle worth the debugging investment, or do we accept that all evaluation goes through user-played matches?
3. Pattern over-fire: is shorter / more frequent patterns a feature or a bug? Telemetry shows higher pattern → goal share with the new behaviour, but tempo readings are mostly TOO_SLOW.
4. Corner volume 0: separate work item or roll into a "set piece pass" project?
5. The legacy carrier decision tree (`executeSimpleCarrierDecision`, ~1500 lines in gameEngine.ts) is the largest remaining block of "tweakable behavior." Phase B tried to replace it wholesale and failed. Is incremental surgical patching the long-term plan, or is there a clean slate worth attempting later?
