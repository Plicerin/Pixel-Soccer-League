# Handover

## Current State

- Main gameplay focus is still attack realism.
- Improvements made recently:
  - carrier facing vs movement mismatch is much lower than before
  - zigzagging has improved somewhat, but not enough
  - overnight runner now supports whole-batch fixture scheduling and status files
- Biggest remaining gameplay problems:
  - `AI_SIMPLE` shot decisions collapsing into broken forced-shot behavior
  - too many forced shots
  - shape still too central / compressed
  - final-third attacker recycling still too high
  - corners still unrealistically low
  - goalkeeper claim/control behavior is not instrumented yet

## Most Important Recent Discovery

- The raw shot decision dump exposed that `AI_SIMPLE` shot telemetry was effectively nonsense:
  - repeated rows with `shotChance:0`, `passChance:0`, `threshold:0`, `forceShotNow:true`, `shouldShoot:true`
  - occasional `null` fields mixed into the same decision family
- This was stronger evidence than the summary metrics alone.

## Latest Code Changes

### `src/gameEngine.ts`

- Patched the `AI_SIMPLE` shot path so it now computes real:
  - `shotChance`
  - `passChance`
  - `shotThreshold`
- Tightened `forceShotNow` so it does not bulldoze obvious pass/cutback/cross support as easily.
- Added extra simple-shot telemetry fields:
  - `computedShouldShoot`
  - `computedNaturalShotSelection`
  - `forceShotSupportAvailable`

### `scripts/telemetry-analyze-latest.mjs`

- Added analyzer checks for broken `AI_SIMPLE` shot rows.
- New summary fields:
  - `aiSimpleDecisions`
  - `aiSimpleBrokenRows`
  - `forcedAiSimpleBrokenRows`
  - `aiSimpleBrokenPct`
- The analyzer now emits a specific recommendation when `AI_SIMPLE` rows are still zeroed/null.

### `scripts/iterate-overnight.mjs`

- Overnight batches now precompute a fixture schedule across the whole run.
- Added persisted progress files:
  - `overnight-status.json`
  - `overnight-summary.json`

### `scripts/headless-sim.mjs`

- Added `--fixtures-json` support so the overnight runner can pass explicit fixture lists instead of relying on per-process randomization.

### `AGENT_MEMORY.md`

- Added a keeper follow-up note:
  - keeper should control the whole penalty area
  - keeper should collect reachable loose balls in the box
  - keeper should come off the line to smother/block/intercept nearby danger

## Latest Telemetry Read

Latest analyzed match:
- `Colorado Rapids 2-1 CF Montreal`
- session `ft-1776972163820`

Latest summary:
- baseline drift:
  - goals `+0.22`
  - shots `+19.8`
  - SOT `+23.6`
  - corners `-8`
- decision telemetry:
  - forced shots `45/46`
  - `AI_SIMPLE broken 46/46`
  - attacker backpasses `27`
  - direct blocker passes `83`
- movement:
  - lateral flips `109`
  - switch requests `58`
  - facing mismatch `10.6%`
- heat map:
  - Colorado width `15.64`, center+narrow `57.6%`
  - Montreal width `16.06`, center+narrow `54.2%`

## Important Workflow Lesson

- Do not rely only on top-line telemetry summaries.
- For logic bugs, inspect the raw decision tables directly.
- The user correctly caught that the raw shot-decision dump contained a clear smoking gun before the summaries made it obvious.

## Known Blind Spot

- Goalkeeper penalty-area control is still not instrumented.
- Current telemetry does **not** directly report:
  - keeper claim opportunities
  - keeper hesitation on loose balls in the box
  - defender recoveries that should have been keeper claims

## Next Recommended Steps

1. Run one fresh match and inspect whether `AI_SIMPLE broken rows` drops sharply.
2. If broken rows remain high, trace the remaining simple shot override path and block forced shots when evaluation is missing.
3. Add goalkeeper telemetry in `src/gameEngine.ts`:
   - `keeperClaimOpportunity`
   - `keeperClaimDecision`
   - `keeperLooseBallDistance`
   - `keeperWouldReachFirst`
   - `defenderRecoveredInsteadOfKeeper`
   - `keeperOffLineDistance`
4. Teach `scripts/telemetry-analyze-latest.mjs` to summarize those keeper events.
5. Keep reading baseline drift, heat map, pass decisions, shot decisions, and raw decision tables together.

## Validation Status

- `npm run lint` passes after the latest patches.
- The new analyzer warning path is confirmed working on the current saved bundle.
- The gameplay effect of the `AI_SIMPLE` shot patch is **not yet validated** on a fresh post-patch match.
