# Gameplay handover and telemetry workflow

## What has been accomplished so far

- Fixed the early newarch structural blockers:
  - between-tick controller intent reuse now preserves the full last `PlayerIntent`
  - kickoff-era ball sync no longer clears an already attached orchestrator ball
  - orchestrator elapsed time now advances by `dt` instead of jumping to the legacy wall clock
  - newarch ball position sync now updates live `gameState.ballPos`
  - orchestrator telemetry speed sampling now uses the real sample interval
- Hardened live authority behavior:
  - added a frame-blend clamp so large `dt` frames cannot create impossible movement spikes
  - widened restart/kickoff bypass windows so valid staging does not trigger false live authority violations
- Restored reliable restart behavior:
  - newarch kickoffs now open each half and each post-goal restart with a protected short staged pass
  - restart/out-of-play classification now respects real last touch instead of intended-team metadata
  - fixed a double-count corner/throw-in integration bug after `startSoccerRestart(...)`
  - added restart regression coverage around corner/goal-kick classification (`V29`)
- Improved attacking structure:
  - wide carriers now prefer real deliveries from advanced wide lanes
  - wing attack support runners now occupy near-post / cutback / far-post lanes more plausibly
  - attacking width, pattern ownership, and delivery telemetry now appear in short newarch runs instead of collapsing to zeros
- Restored telemetry needed for box-defense diagnosis:
  - the newarch/orchestrator shot bridge now emits `SHOT_POSITION_SNAPSHOT`
  - shot-on-target snapshots are restored for analyzer-visible defensive KPIs
- Added defensive regressions and one follow-up cover pass:
  - deep defenders now start dropping earlier for central long-shot threats
  - regression coverage exists for earlier deep box cover
  - this restored measurement, but the broader cover pass over-suppressed shot volume in one short run and still needs narrowing
- Fixed the user-reported kickoff direction bug in the integrated path:
  - orchestrator attack signs are now refreshed from the live engine instead of staying frozen from bridge creation
  - added regression coverage for the missing left-to-right protected restart case
- Rewrote `docs\headless-engine-extraction.md` into a soccer-specific engine/renderer split brief instead of the old baseball placeholder

## Current state

- The model is no longer hard-stalled at the original integration failures.
- Kickoff/restart direction is stable again locally, including the left-to-right case.
- Telemetry is materially more trustworthy than before:
  - shot snapshots are back
  - pattern/phase/owner telemetry is back
  - live ball position and movement sampling are no longer obviously lying
- Gameplay quality is still mixed:
  - some fixtures remain sterile
  - some saved fixtures now produce plausible shot counts and scorelines
- The current hard gate is still **shot-time box defense**:
  - do **not** move on to corner-generation tuning until box-defense KPIs are met in a fresh direct-bundle run
- Important guardrail: **do not push code yet**

## Current box-defense gate

- Target `avg box defenders >= 2.0`
- Target `avg corridor defenders >= 1.5`
- Guardrail `empty box <= 15%`
- Guardrail `empty corridor <= 20%`
- Guardrail `kickoff passes >= 1` and `kickoff receives >= kickoff passes`

## How to run games

### 1. Run a single headless newarch match and save the raw bundle

```powershell
npm run sim:match -- --home "Nashville SC" --away "St. Louis CITY SC" --half-seconds 60 --query "newarch=1" --report-json "telemetry\nashville-stl-boxdef.json"
```

Notes:

- `--half-seconds 60` is the short truthful verification run used during this work.
- `--query "newarch=1"` forces the new gameplay model.
- `--report-json` writes a saved headless bundle/report that the analyzer can read directly.
- The script auto-starts a local Vite server if one is not already available.

### 2. Run a different fixed fixture

```powershell
npm run sim:match -- --home "FC Cincinnati" --away "Chicago Fire FC" --half-seconds 60 --query "newarch=1" --report-json "telemetry\cincinnati-chicago.json"
```

### 3. Run a short multi-game batch

```powershell
npm run sim:headless -- --games 5 --half-seconds 60 --query "newarch=1" --report-json "telemetry\batch-5.json"
```

### 4. Manual browser run if needed

```powershell
npm run dev
```

Then open the app with `?newarch=1` in the URL. Browser/headless results are also visible in the in-app MATCHES dashboard telemetry.

## How to analyze telemetry

### 1. Analyze a saved headless bundle directly

```powershell
npm run telemetry:analyze -- --bundle-json "telemetry\nashville-stl-boxdef.json" --report-json "telemetry\nashville-stl-boxdef-report.json" --report-md "telemetry\nashville-stl-boxdef-report.md"
```

This produces:

- a machine-readable JSON summary
- a human-readable Markdown report

### 2. Analyze the latest saved bundle

```powershell
npm run telemetry:analyze -- --latest
```

Default outputs:

- `telemetry\latest-report.json`
- `telemetry\latest-report.md`

### 3. Analyze a specific saved matchup from IndexedDB-backed telemetry

```powershell
npm run telemetry:analyze -- --home "FC Cincinnati" --away "Chicago Fire FC"
```

### 4. Analyze one exact session

```powershell
npm run telemetry:analyze -- --session-id ft-123456
```

## What to check first in each telemetry report

1. **Kickoff health**
   - `kickoff passes`
   - `kickoff receives`
2. **Shot box defense**
   - `avg box defenders`
   - `avg corridor defenders`
   - `empty box`
   - `empty corridor`
3. **Chance creation**
   - shots / shots on target
   - deliveries / real crosses
   - corners
4. **Noise / integration regressions**
   - `COACH_AUTHORITY_VIOLATION`
   - `LIVE_MOVEMENT_AUTHORITY_VIOLATION`
   - `LIVE_BALL_AUTHORITY_VIOLATION`

## Recommended verification loop

1. Make a small targeted change.
2. Run:

```powershell
npm run lint
npm run test
```

3. Run one direct-bundle short match:

```powershell
npm run sim:match -- --home "Nashville SC" --away "St. Louis CITY SC" --half-seconds 60 --query "newarch=1" --report-json "telemetry\verify.json"
```

4. Analyze it:

```powershell
npm run telemetry:analyze -- --bundle-json "telemetry\verify.json" --report-json "telemetry\verify-report.json" --report-md "telemetry\verify-report.md"
```

5. Do not move to corners until the box-defense gate is actually cleared.

## Recommended next work

- Narrow the early cover trigger so it only activates for central / half-space shooting threats instead of broadly suppressing all chance creation.
- Add richer shot-time defensive labeling if the next pass is still hard to diagnose blind.
- Keep the new left-to-right kickoff restart regression in place as a guardrail while returning focus to box-defense KPIs.
