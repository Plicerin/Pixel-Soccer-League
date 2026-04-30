# PSL Handover - 2026-04-29

This is the current handover for Pixel Soccer League after the coach-layer work and the headless-runner failures on the original machine.

## Project Context

Pixel Soccer League is a browser soccer simulation with Three.js/TypeScript/Vite. Most runtime logic still lives in `src/gameEngine.ts`. The user is tuning CPU-vs-CPU gameplay toward an MLS-like baseline using match telemetry, browser observation, and headless runs.

Primary goal right now: stop tiny parameter tuning and introduce a stronger tactical "coach" system that can issue explicit attacking and defensive commands, then measure whether players obey and whether those commands create real soccer actions.

## User Preferences And Constraints

- Do not run smoke tests, headless games, or match simulations without explicit authorization.
- When starting a run, always announce a local timestamp, PID, and output folder.
- Runs should be background/detached so chat remains available.
- Headless game runs should use Chrome/Chromium GPU mode: `--gpu-headless`.
- Do not push code unless the user explicitly asks.
- Do not include team names in telemetry/database access approval requests.
- Use `rg` for search and `apply_patch` for manual edits.
- Do not revert unrelated dirty worktree changes.

## Protected Ports From The Old Machine

The old machine had many conflicts. If still relevant:

- `5173` was Aphelion. Do not touch it.
- `8188` was ComfyUI. Do not touch it.
- `8765` was an internal tool. Do not touch it.
- `9224` was protected/debug tooling. Do not touch it.
- `3002` was later approved to kill and was killed.

The move to another computer is meant to avoid these conflicts.

## Recent Gameplay Direction

We concluded that the visual audit was not enough. Screenshots without player IDs cannot tell individual players apart; players have no shirt-number rendering, hair color is random, and sprites are visually ambiguous.

Important distinction:

- Visual audit = after-the-fact screenshots for human sanity checks.
- Coach layer = live tactical command system that tells known engine players what to do.

The user wants a real coach, not an audit. Since the engine already knows player identity, role, team, position, ball state, and target assignment, the coach should use internal state rather than a vision model to identify players.

## Code Changes Implemented

### 1. Structured finish/cutback adjustment

File: `src/gameEngine.ts`

Changes made before coach layer:

- Loosened structured cutback finish rules.
- Cutback receivers can now shoot through moderate pressure and blocked lanes if central enough.
- `STRUCTURED_FINISH_INTENT_HELD` now includes `holdReason`.
- Cutbacks prefer `PLACED` shots out to roughly 15 yards.
- Older pattern crossing logic favors cutbacks more, penalizes covered near-post runners, and avoids converting blocked driven cutbacks into floated lofts.

Telemetry to watch:

- `STRUCTURED_FINISH_INTENT_ARMED`
- `STRUCTURED_FINISH_INTENT_HELD`
- `STRUCTURED_FINISH_INTENT_SHOT`
- `holdReason`

### 2. Coach command layer

File: `src/gameEngine.ts`

Added a first real coach play: `WING_CUTBACK_01`.

New types:

- `CoachCommandRole`
- `CoachDefenseRole`
- `CoachCommandState`

New `gameState` fields:

- `activeCoachCommand`
- `coachCommandSeq`
- `coachCommandLastEndByTeam`

New helper functions:

- `playerCoachKey`
- `findPlayerByCoachKey`
- `getActiveCoachCommand`
- `endCoachCommand`
- `coachTargetForAttackRole`
- `getCoachAttackRole`
- `maybeEmitCoachPlayerReached`
- `chooseCoachDefender`
- `issueWingCutbackCoachCommand`
- `getCoachSupportTarget`
- `getCoachDefensiveTarget`

Attack coach assigns:

- carrier
- near-post runner
- far-post runner
- cutback receiver
- second-wave support

Defense coach assigns:

- pressure carrier
- cover near-post runner
- cover cutback lane
- track far-post runner
- block second-wave support

First-version behavioral changes:

- Off-ball attackers now obey coach support targets strongly during an active command.
- Defenders now obey coach defensive targets during the same command.
- Coach can force a driven cutback instead of waiting for the old director heuristics.
- Coach command ends on shot, delivery failure, possession loss, or expiration.

Follow-up authority changes made after the first telemetry pass:

- Added `getCoachElapsedSeconds()` so coach commands use a single absolute match-clock basis.
- Changed `endCoachCommand()` to default to the coach clock and clamp negative durations to zero.
- Added `coachAttackRoleReached()` and runner-readiness gates.
- Carrier now waits under `coach_waiting_for_runner` while a coach command is active instead of treating the coach as a soft delivery boost.
- Added `COACH_COMMAND_WAIT` telemetry so we can see when the coach is intentionally holding the carrier for runners.
- Coached attackers now enter `COACH_ATTACK` and run harder to assigned targets.
- Coached defenders now enter `COACH_DEFENSE` and stay owned by the coach target instead of immediately falling back to normal defense when close.

New telemetry:

- `COACH_COMMAND_ISSUED`
- `COACH_DEFENSE_ASSIGNED`
- `COACH_PLAYER_REACHED`
- `COACH_COMMAND_DELIVERY`
- `COACH_DELIVERY_RESOLVED`
- `COACH_FINISH_SHOT`
- `COACH_COMMAND_END`
- `COACH_COMMAND_WAIT`

### 3. Headless match launcher

Added file: `scripts/start-headless-match.ps1`

Purpose: replace fragile ad hoc PowerShell wrappers. It starts headless runs with stable logging and output paths.

Expected command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-headless-match.ps1 -Games 1 -Speed 1 -Prefix coach-wing-cutback-onegame
```

It creates a run folder under `telemetry/` with:

- `start-manifest.json`
- `command.txt`
- `launcher.log`
- `runner.pid`
- `runner.out.log`
- `runner.err.log`
- `monitor-runner.ps1`
- `monitor.pid`
- `exit-code.txt` after monitor succeeds
- `sim.json` if the match completes
- `visual-audit/` if visual audit captures frames

Current status: the launcher was later fixed enough to run detached successfully. It now writes a worker script into the run folder, starts PowerShell detached, stores `worker.pid` and `runner.pid`, captures stdout/stderr, and writes `exit-code.txt`.

Known remaining runner problem: if the browser page reloads/navigates while `scripts/headless-sim.mjs` is polling with `page.evaluate()`, the worker exits with code `998` and the series report may not be written. The next reliability fix should catch transient `Execution context was destroyed` errors during polling, retry after navigation, and write partial series results incrementally after every completed match.

## Verification Already Passed

After the coach-layer changes:

```powershell
npm run lint
node --import tsx --test tests\structuredAttack.test.ts tests\possessionDirector.test.ts
```

Both passed.

After adding `scripts/start-headless-match.ps1`:

```powershell
$tokens=$null; $errors=$null; $null=[System.Management.Automation.Language.Parser]::ParseFile('scripts\start-headless-match.ps1',[ref]$tokens,[ref]$errors); if ($errors -and $errors.Count) { $errors | Format-List *; exit 1 } else { 'parse=ok' }
npm run lint
```

Both passed.

After the coach-authority changes:

```powershell
npm run lint
node --import tsx --test tests\structuredAttack.test.ts tests\possessionDirector.test.ts
```

Both passed.

## Latest Coach Telemetry

First successful one-game run after the first coach implementation:

```text
telemetry\coach-wing-cutback-onegame-2026-04-29-185317
Toronto FC 1 - 0 Orlando City
```

Key coach telemetry:

- total events: 8830
- coach events: 168
- `COACH_COMMAND_ISSUED`: 36
- `COACH_DEFENSE_ASSIGNED`: 36
- `COACH_PLAYER_REACHED`: 26
- `COACH_COMMAND_DELIVERY`: 16
- `COACH_DELIVERY_RESOLVED`: 16
- `COACH_COMMAND_END`: 36
- `COACH_FINISH_SHOT`: 2
- command end reasons: `possession_lost` 20, `expired` 13, `delivery_unresolved` 1, `shot_taken` 2
- delivery outcomes: `COMPLETED` 12, `SELF_CAUGHT` 3, `UNRESOLVED` 1
- reached roles were only `PRESS_CARRIER`; no attacking coach roles reached

Conclusion: the coach existed, issued commands, and produced deliveries, but it still lacked real authority over attacking runners. That led directly to the authority changes described above.

Latest 10-match attempt after authority changes:

```text
telemetry\coach-authority-tenmatch-2026-04-29-191018
started=2026-04-29 19:10:18
workerPid=39256
```

It completed 6 games and failed during game 7:

```text
workerException=page.evaluate: Execution context was destroyed, most likely because of a navigation
finished=2026-04-29 19:43:33 exitCode=998
```

This was a headless-runner/browser-context failure, not a confirmed gameplay crash. The page likely reloaded or navigated while the runner was polling `window.__gameRef.getMatchSnapshot()`. Because the runner only writes `sim.json` at the end, no clean series report was produced even though six game summaries were preserved in stdout.

Last completed game before failure:

```text
Game 6 | New York Red Bulls 0 - 0 Colorado Rapids | DRAW
Shots 5-6 | SOG 0-1 | Saves 1-0 | Headers 0-1
Passes 37(36)-39(37) | Tackles 21-20 | Fouls 3-5
Possession 49%-51% | Corners 0-1 | Clearances 1-1
```

Next runner fix: make `scripts/headless-sim.mjs` resilient to page-context loss and write partial results after each completed match.

## Important Recent Telemetry Before Coach Layer

The last successful visual-audit run before the coach change was:

```text
telemetry\visual-audit-fixed-onegame-2026-04-29-153915
Seattle Sounders 0 - 0 New York City FC
```

Key findings:

- 33 total shots, only 3 on target.
- 19 blocked shots.
- 141 neo-play starts.
- 44 structured deliveries.
- 14 real crosses.
- 16 shot-producing structured attacks.
- 0 goal-producing structured attacks.
- `STRUCTURED_FINISH_INTENT_ARMED`: 5
- `STRUCTURED_FINISH_INTENT_HELD`: 5
- `STRUCTURED_FINISH_INTENT_SHOT`: 0

Conclusion: the system was creating situations but refusing to finish them. That directly motivated the cutback/finish changes and then the coach layer.

## Why The Coach Layer Matters

The previous possession director was too weak. It mostly suggested behavior through pattern selection and boosts, but the regular AI could still drift, shoot from distance, pass elsewhere, or arrive late.

The new direction is stronger:

- issue explicit commands to known players
- make off-ball attackers and defenders obey for a short window
- force a specific delivery
- require measurable phase outcomes

The first play is deliberately narrow: `WING_CUTBACK_01`. If this works, the playbook can become data-driven and expand into give-and-go, overlaps, switches, early crosses, third-man runs, etc.

## Next Steps On The New Computer

1. Pull/verify latest repo state.
2. Run:

```powershell
npm install
npm run lint
node --import tsx --test tests\structuredAttack.test.ts tests\possessionDirector.test.ts
```

3. Start one visible or headless check only with explicit user approval.
4. If testing headless, prefer the detached launcher:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-headless-match.ps1 -Games 1 -Speed 1 -Prefix coach-authority-onegame -Url http://127.0.0.1:3001/
```

5. If a longer run is needed, first fix `scripts/headless-sim.mjs` so it writes partial results and recovers from transient page navigation during polling.
6. Run one authorized match and analyze coach telemetry:

Watch counts and outcomes for:

- `COACH_COMMAND_ISSUED`
- `COACH_PLAYER_REACHED`
- `COACH_COMMAND_DELIVERY`
- `COACH_DELIVERY_RESOLVED`
- `COACH_FINISH_SHOT`
- `COACH_COMMAND_END`
- `COACH_COMMAND_WAIT`
- `STRUCTURED_FINISH_INTENT_SHOT`
- `STRUCTURED_FINISH_INTENT_HELD`

Good first success criteria:

- At least several coach commands issued per match.
- Cutback receiver reaches target on a meaningful fraction of commands.
- Coach delivery occurs.
- Some coach deliveries resolve to the intended receiver.
- Some coach possessions create immediate shots.
- The screen visibly shows wide carry plus cutback/runner movement.

Bad signs:

- Commands issue but no players reach targets.
- Carrier never delivers.
- Cutback deliveries are intercepted every time.
- Receiver still holds instead of shooting.
- Defenders over-collapse and block everything.

## Files Most Likely To Touch Next

- `src/gameEngine.ts`
- `scripts/start-headless-match.ps1`
- `scripts/headless-sim.mjs`
- `scripts/telemetry-analyze-latest.mjs`

Potential analyzer improvement: add a coach section to `telemetry-analyze-latest.mjs` that summarizes command issuance, wait rate, reach rate by role, delivery rate, resolved rate, shot rate, and goal rate.

## Current Caveat

The code compiles and a prior coach version completed one match. The latest authority changes have passed lint/tests, but the 10-match validation was interrupted by a headless browser context/navigation failure during game 7. The first task on the new machine should be runner reliability, then a short authorized coach-authority match to verify that attacking roles now reach their targets and that `COACH_COMMAND_WAIT` appears for intentional carrier holds.
