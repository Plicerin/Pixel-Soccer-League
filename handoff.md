# Pixel Soccer League Handoff

## Current Goal

Figure out whether the attacking behavior is salvageable through tuning or whether the possession/attack decision layer needs a rebuild.

## Where We Landed

- The biggest symptom has been striker isolation: the striker gets to dangerous spots while midfield support arrives late or not at all.
- We already tested simple `CM`/`ST` equality and that was not enough.
- We then removed a long list of hidden striker privileges, matched primary `ST` and `CM` stats, buffed defender recovery, and strengthened the force-field shape system.
- My current read is that if the next telemetry still shows the same isolation pattern, the architecture is more likely broken than just badly tuned.

## Major Code Changes Already Made

- Split dashboard filtering from bundle persistence so `SHOT_ON_TARGET_POSITION_SNAPSHOT` stays out of the live dashboard but persists into saved bundles.
- Added richer telemetry around midfield support, striker movement, and shot decisions.
- Reduced pass perfection and several shot-selection problems.
- Removed most explicit striker advantages from:
  - `src/gameEngine.ts`
  - `src/ai/tacticalPositioning.ts`
  - `src/ai/attackingLanes.ts`
  - `src/ai/aiPassModel.ts`
- Added a temporary stat parity hook so the first `ST` and first `CM` on each team share the same stat profile.
- Added defender-only transition/recovery buffs instead of a global defender speed buff.
- Increased force-field stabilization by:
  - raising `forceFieldBlend`
  - increasing home pull for mids
  - reducing forward-run/ball-attraction drift

## Shot Snapshot Status

- Persistence bug: fixed.
  - `SHOT_ON_TARGET_POSITION_SNAPSHOT` now survives into the saved bundle/localStorage path.
- Content bug: mostly fixed on April 21, 2026.
  - Previous issue: snapshots usually had `shooter: null` because they relied on `ballState.lastHeldBy`.
  - New fix: the actual shooter is now carried explicitly through shot launch, saves/parries, and delayed goal restarts before the snapshot is recorded.
- Next thing to verify:
  - run one more match
  - confirm that most or all shot-on-target snapshots now include a real shooter

## Known Remaining Problem

SQLite save reliability is still flaky.

- Live/localStorage bundles can contain full telemetry while the SQLite `bundle_json` sometimes ends up with `events: []`.
- That means event generation is working, but the full-time database save path is still not reliable.

## Best Recent Source of Truth

- Live bundle saved from localStorage:
  - [colorado-rapids-vs-new-york-red-bulls-live-bundle.json](</C:/Users/vrock/Documents/Pixel Soccer League/colorado-rapids-vs-new-york-red-bulls-live-bundle.json>)

## Telemetry Access Procedure

- Default retrieval path for the latest match telemetry:
  1. Check `match-results.json` to identify the latest target match.
  2. Query `psl.db` table `match_results`.
  3. Pull the newest matching row by `team_a_name` / `team_b_name`, ordered by `timestamp DESC`.
  4. Parse `bundle_json` from that row as the authoritative telemetry bundle.
  5. Use `telemetry/*.json` exports only when a standalone extract already exists.
- Reason for this procedure:
  - the SQLite row can contain the full telemetry bundle even when no `extract-*.json` file was written
  - recent Minnesota vs Atlanta telemetry was recovered this way from `match_results.bundle_json`

## What To Do Next

1. Finish a new match without restarting the app.
2. Check `localStorage['psl-tuning']` or the saved bundle for:
   - `SHOT_ON_TARGET_POSITION_SNAPSHOT`
   - whether `detail.shooter` is now populated
3. If shooter data is finally present, analyze midfielder distance to shooter on all shots on target.
4. If midfield support is still clearly absent even after all the role/shape/defender changes, strongly consider scrapping and rebuilding the attacking decision layer.
5. Separately, trace and fix the SQLite full-time save path so `bundle.events` does not get written as empty.

## Stable Overnight Harness

- New stable commands for repeated sim and analysis:
  - `npm run sim:match -- --home "DC United" --away "Columbus Crew"`
  - `npm run telemetry:analyze -- --home "DC United" --away "Columbus Crew"`
  - `npm run iterate:overnight -- --home "DC United" --away "Columbus Crew" --cycles 8`
- These scripts exist specifically to reduce approval churn by keeping future sessions on a small set of repeatable command prefixes instead of ad hoc PowerShell reads.
- Key files:
  - [scripts/headless-sim.mjs](</C:/Users/vrock/Documents/Pixel Soccer League/scripts/headless-sim.mjs>)
  - [scripts/telemetry-analyze-latest.mjs](</C:/Users/vrock/Documents/Pixel Soccer League/scripts/telemetry-analyze-latest.mjs>)
  - [scripts/iterate-overnight.mjs](</C:/Users/vrock/Documents/Pixel Soccer League/scripts/iterate-overnight.mjs>)
- `sim:match` now supports fixed `--home` / `--away`, optional formations, and `--report-json`.
- `telemetry:analyze` reads the latest matching bundle from `psl.db`, summarizes pass/shot/support telemetry, compares against MLS 2025 baselines, and can save a JSON report.
- `iterate:overnight` runs repeated `sim:match` + `telemetry:analyze` cycles and writes per-cycle reports plus an overnight summary into `telemetry/overnight/...`.

## Most Relevant Files

- [src/gameEngine.ts](</C:/Users/vrock/Documents/Pixel Soccer League/src/gameEngine.ts>)
- [src/ai/tacticalPositioning.ts](</C:/Users/vrock/Documents/Pixel Soccer League/src/ai/tacticalPositioning.ts>)
- [src/ai/attackingLanes.ts](</C:/Users/vrock/Documents/Pixel Soccer League/src/ai/attackingLanes.ts>)
- [src/ai/aiPassModel.ts](</C:/Users/vrock/Documents/Pixel Soccer League/src/ai/aiPassModel.ts>)
- [src/ai/forceFieldPositioning.ts](</C:/Users/vrock/Documents/Pixel Soccer League/src/ai/forceFieldPositioning.ts>)
