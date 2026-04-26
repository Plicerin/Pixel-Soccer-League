# Pixel Soccer League Handoff

## Current Status - 2026-04-26

- Active branch: `structured-attack-v1`.
- Latest pushed code commit before this handoff update: `a3926f1 Backprop pass, goal, and cross telemetry guards`.
- Recent fixes: ghost rows hidden from dashboard/analyzer defaults, route-target pass collection, shot-backed goal guard, and split telemetry for structured deliveries vs real crosses.
- Current structural target: shape/width ownership. User-run Kansas City vs Atlanta had good pass completion and a shot-backed goal, but team width stayed around 15 units and home-position error stayed high. The movement-force stack is likely swallowing wide-role intent.
- Important workflow rule: when the user gives two teams, two shorthand names, or a score line, they just ran a match and want telemetry analysis. Do not start a new sim unless explicitly asked.

## Current Goal

Make the match look like soccer through structural movement ownership, not small numeric tuning. Wide roles need to hold believable lanes before cross volume or carrier behavior can be judged cleanly.

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

## Known Remaining Problems

- Width/shape remains too narrow. Average widths around 15 are not believable enough; target 18+ before tuning cross volume.
- Movement ownership is unclear. FSM, pattern role, home pull, force-field, ball attraction, and support logic can all influence the same target.
- `passNetwork` has an accounting smell: some edges report `completed > count`. Prefer `passLog` and team summaries until fixed.
- Old `PATTERN_CROSS_EXECUTED` counts were inflated because they counted structured deliveries. New telemetry separates `PATTERN_DELIVERY_EXECUTED` from actual `PATTERN_CROSS_EXECUTED`; re-baseline with future user-run matches.

## Telemetry Access Procedure

- Trigger: two team names, shorthand names, or score line from the user means they just ran that match.
- Do not start a sim for that trigger. Analyze saved telemetry.
- `telemetry/latest-report.json` and `.md` can be stale. Use them only after confirming session/teams/score.
- First check `telemetry-snapshots.json` for latest session, teams, score, and full-time status.
- Then query `psl.db`:
  ```bash
  sqlite3 psl.db "select id, session_id, datetime(timestamp/1000,'unixepoch'), team_a_name, team_b_name, score_a, score_b, shots_a, shots_b, shots_on_target_a, shots_on_target_b, possession_a from match_results order by id desc limit 12;"
  ```
- Pull the matching row by fixture/session/score and parse `match_results.bundle_json` as authoritative telemetry.
- Inspect `teamA/teamB`, `events`, `passLog`, `goalLog`, `shapeA/B`, `playerPositioning`, `teleportation`, and `passNetwork`.

## What To Do Next

1. Map the open-play movement pipeline in `src/gameEngine.ts` and identify final-target writers.
2. Add or expose telemetry showing which owner wins per role/phase.
3. Give wide roles authoritative build-up/structured-attack ownership so they are not blended back into the center every frame.
4. Re-check user-played telemetry for average width >= 18, lower home-position error, visible wide channels, and pass completion not collapsing.
5. Re-baseline real crosses only after the new delivery/cross split has data from fresh user-run matches.
6. Fix `passNetwork` completion accounting.

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
