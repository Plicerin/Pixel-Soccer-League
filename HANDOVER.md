# PSL Handover — 2026-04-25

## Where to pick up

You are on `main` at commit `d4a8a37` ("Fix ghost match: force isLive=false after resetMatch's restart sequence"). The repo is **shippable as-is** for development play. 17 user-played matches verify the substrate.

The next sensible piece of work is a **surgical patch to legacy carrier** — kill the "drive then backpass" bug without rewriting the whole carrier model. See "Recommended next step" below.

---

## State of main

### What's deployed

**FSM positioning substrate** (Phase A1 → A2 → A.5):
- `src/ai/fsmPositioning.ts` — single-owner deterministic off-ball target
- Replaces the legacy 3-layer (force-field + tactical + pattern role) competition with a hard pre-pass that steers every off-ball player except: ball holder, both keepers, one designated `bestDefender` per team, human-controlled
- Pattern role override is authoritative when a pattern is active
- Phase A.5 added two states on top:
  - `BOX_CRASH` — attackers (ST/CF/LM/RM/CM/CAM) run to NEAR_POST / FAR_POST / cutback / edge-of-D when their team carries past midfield
  - `COLLAPSE_DEFEND` — 2 closest defenders (CB/LB/RB/DM) converge on ball+goal axis when opponent has ball in own final third

**Pattern engine** (`src/ai/patternEngine.ts`):
- `selectPattern`, `isPatternStillValid`, `getPatternRole`, `computePatternRoleTarget`
- Retrigger cooldowns (3-3.5s for WING/COUNTER, 1.5s for BUILDUP)
- Halftime reset clears pattern + counter/transition state

**Pattern cross fire**:
- Widened crossing zone (WING_ATTACK or COUNTER, carrier role CARRIER/RUNNER/NONE, carrierAttackX > 0, broader |z| and goal-distance)
- Pattern-scoped 1.5s cooldown prevents the 200-event spam from earlier
- LONG_LOFTED fallback when DRIVEN cross lane is blocked

**Ghost-match defenses**:
- Splash background demo permanently disabled (was the original source)
- Server-side `/__db/match-result` rejects bundles with `sessionActive=false`
- Smoke-test runs gated out of React auto-save (was polluting the dashboard)
- Match-start hard-blocked when `splashSceneMode` is true (backstop)
- `resetMatch` forces `isLive=false` after `startSoccerRestart` so the menu screen doesn't run a background simulation

**Diagnostic tooling**:
- FSM panel (top-left): live `FSM:ON/OFF`, `CARR:ON/OFF`, ticks, handled count, pressers, carrier, last carrier decision, active patterns. Click toggles FSM. Shift-click toggles CARR (Phase B, branch only).
- MATCH START LOG (top-right): every match start + every blocked match start with caller stack hint. Click to copy contents to clipboard.
- `scripts/telemetry-analyze-latest.mjs` — full match analyzer with per-team×half flip splits, segment counts, pattern tempo, role alignment, defenders-in-box-at-goal, final-third overloads, multi-touch sequences.
- `scripts/eval-cycle.mjs` — multi-game cycle runner with delta vs baseline (currently parked because headless gameplay produces ~0 shots; see "Known limitations" below).

### Verified across 17 matches (FSM A2 + Phase A.5 + cross fix)

| Metric | Pre-FSM | Current |
|---|---|---|
| Goals/match | 4-10 | 1-5 (mostly in MLS band) |
| Long-range SOT | 11-21 | 0-12 (mostly low) |
| Pattern → goal share | 30-50% | 50-100% |
| Backpasses | 322-394 | 118-280 |
| Final-third overloads | 0 every match | 0-21, both teams now register |
| Pattern crosses | 0-1 (sometimes spam) | 0-5, mix of DRIVEN + LONG_LOFTED |
| Defenders @ goal | 0.6-1.17 | 1.0-2.0 |

Snapshots saved per match in `telemetry/snapshot-2026-04-2{4,5}*.json`.

---

## Branches

```
main                    ← current, Phase A.5 + cross fix (shippable)
fsm-positioning         ← merged into main via bae0448 (kept for reference)
phase-b-carrier         ← parked, NOT merged (failed to ship; see post-mortem below)
claude/determined-mcclintock ← unrelated old branch
```

To revive Phase B: `git checkout phase-b-carrier`. To abandon it: `git branch -D phase-b-carrier` after the next clean merge.

---

## Known issues / what's still undercooked

**Drive-then-backpass** (ORIGINAL user complaint, NOT FIXED on main):
- Carrier sprints with ball, hits some legacy threshold, picks first backward pass option, recycles. Phase A.5 didn't address carrier decision logic. Phase B attempted full rewrite and failed (see post-mortem).
- See "Recommended next step" — surgical patch is the cheapest viable approach.

**Pattern role alignment variance**:
- NEAR_POST_RUNNER and FAR_POST_RUNNER fwdX swings -11 to +11 across matches with same code. Box-crash is meant to fix this but pattern role lookup happens at pattern start and the player who got the role may not actually advance.

**Corner volume always 0**:
- MLS baseline is ~5 corners/team/match. We have 0-2. Deflection / blocked-shot / out-of-play logic isn't producing corner kicks. Untouched in this work.

**Heat map narrow** (center+narrow 60-75%):
- Shape holds tighter than real soccer. Wingers don't stretch wide enough during build-up. Phase A.5 prioritised pattern/box-crash positions, didn't address baseline width.

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

## Recommended next step (surgical legacy patch)

Bypass the Phase B architecture problem by patching the specific user complaint without rewriting carrier internals.

The "drive then backpass" bug lives in legacy `executeSimpleCarrierDecision` (gameEngine.ts ~12369). The flow:
1. Carrier sprints (legacy dribble works fine — 5-8 u/s)
2. Hits a state where `simplePassChance > simpleShotThreshold`
3. `chooseAIPassTarget` returns the best pass target — often the closest backward option when forward is blocked
4. Pass executes, ball goes back

The patch:
1. Find the carrier-decided pass execution path (around line 12500-13700 in gameEngine.ts)
2. Add a guard: if `(target.pos.x - carrier.pos.x) * attackSign < -2` (target is behind carrier in attack direction) AND `carrier.pos.x * attackSign > 0` (carrier is in opp half), **reject the pass** and let the carrier fall through to dribble
3. Possibly: add 0.5s "no-recycle" cooldown after rejection so we don't loop

This leaves dribble speed, sprint state, weighted decisions all alone. Only kills the specific pass branch that produces user-visible "drive then backpass" frustration.

Risk: low. Affected lines: ~10-30. Testing: 2-3 user matches.

If it works → Phase A.5 + this patch is the shippable state for a long while.
If it regresses something → revert the single commit, no broader damage.

---

## How to use the diagnostic tooling

**During a match**:
- Top-left FSM panel: live state. Click toggles FSM positioning. (Shift-click toggles CARR only on `phase-b-carrier` branch.)
- Top-right MATCH START LOG: every kickoff. Click to copy text to clipboard. If a ghost match appears, the panel will name the caller.

**After a match**:
```
npm run telemetry:analyze
```
Reads from `psl.db` and prints the full report (~80 lines). Key sections: MLS baselines, pattern → goals, role alignment, carrier trajectories with team×half splits, multi-touch opp-half, final-third overloads, defenders-in-box-at-goal.

**To inspect the DB directly**:
```
curl http://localhost:3001/__db/matches?limit=5
```

**Eval cycle (parked)**:
```
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
src/ai/fsmPositioning.ts      — Phase A2 + A.5 substrate (single-owner off-ball)
src/ai/patternEngine.ts       — pattern selection + role assignment
src/ai/fsmCarrier.ts          — Phase B v2 (parked on phase-b-carrier branch only)
src/gameEngine.ts             — engine entry, FSM pre-pass, panel rendering
src/components/RetroFootball.tsx  — React app, dashboard bridge, FT save logic
scripts/telemetry-analyze-latest.mjs  — match analyzer
scripts/eval-cycle.mjs        — multi-game cycle runner (parked)
scripts/headless-sim.mjs      — playwright-driven headless match runner
telemetry/snapshot-2026-04-*.json  — per-match snapshots, 13+ files
HANDOVER.md                   — this file
```

---

## Open questions for whoever picks this up

1. Should `phase-b-carrier` be deleted or kept around? Currently kept.
2. Headless gameplay broken (0 shots in playwright). Is the eval-cycle worth the debugging investment, or do we accept that all evaluation goes through user-played matches?
3. Pattern over-fire: is shorter / more frequent patterns a feature or a bug? Telemetry shows higher pattern → goal share with the new behaviour, but tempo readings are mostly TOO_SLOW.
4. Corner volume 0: separate work item or roll into a "set piece pass" project?
