# STRUCTURAL PLAN — Stop Tweaking, Fix Architecture

## Principle

Parameter tweaks failed. System lacks three structural things:
1. **Role discipline** — CBs carry to opposing box; strikers sit deep; wingers force-shoot centrally
2. **Phase state machine** — every frame is a local heuristic. No higher intent.
3. **Pattern library** — no crosses, through-balls, cutbacks, third-man runs

Fix structurally. Tune only after structure holds.

### Rules
- Gates are mandatory. Advance only when ALL gates pass on 3 consecutive CPU-vs-CPU matches.
- Each phase ends with: telemetry validation + snapshot + git tag.
- Regression = revert tag, not more tweaks.
- No parameter tweaks outside current phase's sub-objectives.

---

## Evidence driving plan

Sample CF Montreal vs San Jose (34 events, 80s in):
- 25+ passes, only **1 to a striker**
- CBs as recipients **9+ times** (Piette, Neal, Pearce, Romney, Costa)
- CB Piette tackled at (28.8, 2.9) — CB in **opposing penalty area**
- CB Neal at attacking-third x=0.2 multiple times
- 0:22 tap-in from wide angle (bad position)
- 0:42 shot from 27 yards (long range)

Diagnosis: defense circulates, midfield doesn't progress, strikers don't receive, wingers shoot from distance. No structure.

---

## PHASE 0 — Instrumentation + Freeze

**Objective**: Measure before fixing. Git tag baseline so we can revert.

### Gates
- **G0.1** Snapshot captures: pass-by-phase counts, phase time %, role avg-X / avg-|Z| per frame
- **G0.2** Git tag `pre-structural-fixes` applied
- **G0.3** Baseline reference saved from 3 most recent matches

### Sub-objectives
- **S0.1** Extend analyzer — emit phase time % per team
- **S0.2** Pass breakdown by carrier zone in snapshot
- **S0.3** Role avg-X and avg-|Z| in snapshot (team-in-possession frames only)
- **S0.4** Git tag

---

## PHASE 1 — Role Discipline

**Objective**: Each role has enforced depth/width bounds. Defenders stay back, attackers stay forward.

### Gates (3 consecutive matches)
- **G1.1** CB forward-X ≤ 0 (midfield line) for 95%+ of in-possession frames
- **G1.2** ST forward-X ≥ +15 in opp half possession frames, 80%+
- **G1.3** LM/RM |Z| ≥ 12 in final-third frames, 70%+
- **G1.4** Non-attacker shots (CB/LB/RB/DM combined) ≤ 3 per team
- **G1.5** Passes to ST ≥ 15% of completed passes (currently < 2%)

### Sub-objectives
- **S1.1** Defender X-cap: CB/LB/RB with ball past midfield → only legal action is pass (no carry forward)
- **S1.2** Striker line-enforcement: post-tactical hard lerp toward `max(carrier.x + 10, opp_last_def_x - 2)` at 0.70 blend in possession
- **S1.3** Winger width: phase-aware blend — 0.55 progression/final-third, 0.30 own third
- **S1.4** Role shot allowlist:
  - CB/LB/RB: only if `dist<5 && keeperDist<3 && forced`
  - DM: only if `dist<8 && inBox`
  - CM: only if `dist<12 && inBox`
  - Others: current logic

---

## PHASE 2 — Phase State Machine

**Objective**: Ball has explicit phase. Phase drives carrier decision.

### Phases
| Phase | Trigger | Primary goal |
|---|---|---|
| `TRANSITION` | First 2s after recovery | Quick forward pass or protect ball |
| `BUILDUP` | Own third, possession > 2s | Circulate, find line-break |
| `PROGRESSION` | Mid third | Line-break, switch, dribble through |
| `CHANCE_CREATION` | Final third, no shot window | Generate cross / cutback / through-ball |
| `FINISH` | Shot window open OR in 6-yard box | Shoot or cutback |

### Gates
- **G2.1** Phase stability: 90%+ of runs last ≥ 1.5s (no flip-flop)
- **G2.2** Time budget: BUILDUP 30-45%, PROGRESSION 25-35%, CHANCE_CREATION 15-25%, FINISH 5-10%
- **G2.3** Pass style matches phase: SHORT/DRIVEN in buildup ≥ 70%, CROSS/CUTBACK/THROUGH in chance creation ≥ 50%

### Sub-objectives
- **S2.1** `ballPhase` enum on gameState, computed each tick from carrier x + time-since-recovery
- **S2.2** Emit `PHASE_TRANSITION` telemetry events
- **S2.3** Refactor `executeSimpleCarrierDecision` → dispatch `executeBuildupDecision`, `executeProgressionDecision`, `executeChanceCreationDecision`, `executeFinishDecision`
- **S2.4** Phase-specific veto rules (force-shot impossible outside FINISH except `atGoalLineForce`)

---

## PHASE 2.5 — Pattern Engine (prerequisite for Phase 3 & 4)

**Objective**: Give AI multi-player coordinated patterns as a first-class concept.
Today: every frame is a local carrier decision. No team-level intent, no coordination.
Soccer needs coordinated multi-player patterns ("wing attack left", "central combo", "counter-attack").

**Why this matters**: Position caps and pass scoring alone cannot produce variety. The
same stateless local AI, tweaked a hundred ways, still produces "one play: run and shoot"
because no player knows what the team is doing. Pattern engine establishes team-level intent.

### Concepts

- **Pattern**: named team-level attacking intent with expected duration and role assignments.
  - Examples: `WING_ATTACK_LEFT`, `WING_ATTACK_RIGHT`, `CENTRAL_COMBO`, `COUNTER_ATTACK`, `PATIENT_BUILDUP`, `SWITCH_OF_PLAY`.
- **Pattern state** on team: `{type, startedAt, expiresAt, roles: Map<player, 'CARRIER'|'RUNNER'|'OUTLET'|'DECOY'|'SUPPORT'>}`.
- **Pattern selector**: on ball recovery OR on pattern expiry OR when current pattern becomes invalid, pick new pattern from library based on situation (ball position, team shape, opposition shape, game state).
- **Pattern execution**: each player's frame decision is modulated by their role in the active pattern. Example: during `WING_ATTACK_LEFT`, the LM's role is `CARRIER`, ST's role is `RUNNER` (near post), CAM's role is `SUPPORT` (far post cutback option), RM's role is `OUTLET` (weak-side width).
- **Pattern completion**: pattern ends on goal / lost possession / timeout / phase change.

### Gates

- **G2.5.1** At any moment each team has an active pattern (or is in NEUTRAL state briefly during transitions). No frames without pattern context except TRANSITION phase.
- **G2.5.2** Pattern variety per match: at least 4 different pattern types fire per team per match.
- **G2.5.3** Average pattern duration 3-8 seconds (not instantaneous flip, not stuck for 30s).
- **G2.5.4** Telemetry emits `PATTERN_START`, `PATTERN_END`, `PATTERN_ROLE_ASSIGNED` events.

### Sub-objectives

- **S2.5.1** Type + storage: `TeamPatternState` on gameState.teamA/teamB. Pattern enum, role enum, role-to-player map.
- **S2.5.2** Pattern selector: `pickPattern(team, ball, teammates, opponents, gameState)` returns pattern or null. Starter library:
  - `PATIENT_BUILDUP`: ball in own third, low pressure. Roles: CB as CARRIER, DM/CB as OUTLET pair, CM as FORWARD_OUTLET.
  - `WING_ATTACK_LEFT` / `WING_ATTACK_RIGHT`: ball in progression on a flank. Roles: LM/RM as CARRIER, ST as NEAR_POST_RUNNER, opposite winger as FAR_POST, CM as CUTBACK_RECEIVER.
  - `CENTRAL_COMBO`: ball in final-third central, ST ahead. Roles: CM/carrier + ST play 1-2.
  - `COUNTER_ATTACK`: recovered ball in own half, ≥ 2 attackers ahead of opp midfield line. Roles: ST and wingers as RUNNERS, carrier DRIVES ball forward.
  - `SWITCH_OF_PLAY`: on one flank > 5s with no progress. Roles: CB/CM as CARRIER, opposite-flank winger as TARGET.
- **S2.5.3** Role-modulated positioning: extend position target logic to consult pattern role. Example: NEAR_POST_RUNNER target = goalpost + 2 units near; FAR_POST target = opposite goalpost + 2 units far; CUTBACK_RECEIVER target = penalty spot area.
- **S2.5.4** Role-modulated decision: extend carrier decision to consult pattern. Example: CARRIER in WING_ATTACK_LEFT at byline with near-post RUNNER available → prefer CROSS style pass over SHORT.
- **S2.5.5** Pattern lifecycle: start on ball recovery or pattern-expired, end on goal/possession-lost/timeout/invalid-situation.

### Deliverable

First 3 patterns end-to-end (`PATIENT_BUILDUP`, `WING_ATTACK_LEFT`/`RIGHT`, `COUNTER_ATTACK`)
with role-modulated positioning + decision. Single test match should show identifiably
different patterns firing across the 5 minutes with appropriate telemetry events.

**Phases 3 and 4 become "extend pattern library"** rather than "add more pass vetoes". Phase 1
position caps relax into pattern-provided targets — `PATIENT_BUILDUP` keeps CBs deep, `WING_ATTACK`
forces wide winger, `CENTRAL_COMBO` lets winger tuck in. No more conflicting enforcement layers.

---

## PHASE 3 — Progression Patterns (extend pattern library)

**Objective**: Expand pattern library with progression patterns. Uses Phase 2.5 engine.

### Patterns added to library
- **LINE_BREAK**: ball with CB/DM, receiver candidate past opp midfield line. Carrier passes line-breaking DRIVEN/THROUGH pass. Receiver = RUNNER role.
- **SWITCH_OF_PLAY** (already in Phase 2.5 starter): validated here with gates.
- **THIRD_MAN_RUN**: CB → CM (pivot) → striker's timed run. Three-player coordinated pattern.

### Gates
- **G3.1** BUILDUP → PROGRESSION transitions ≥ 8 per match
- **G3.2** PROGRESSION → CHANCE_CREATION transitions ≥ 5 per match
- **G3.3** LINE_BREAK patterns complete ≥ 3 per match (carrier passes + receiver actually progresses)
- **G3.4** SWITCH_OF_PLAY patterns fire ≥ 2 per match
- **G3.5** THIRD_MAN_RUN completed ≥ 1 per match

### Sub-objectives
- **S3.1** Add `LINE_BREAK` and `THIRD_MAN_RUN` to pattern library
- **S3.2** Selector priority tuning: when in own third with 2+ seconds possession, `LINE_BREAK` preferred over `PATIENT_BUILDUP` if viable
- **S3.3** Third-man run: pattern assigns STRIKER as RUNNER, CM as PIVOT, CB as INITIATOR. Role positions + timed decisions encode the pattern.

---

## PHASE 4 — Final-Third Patterns (extend pattern library)

**Objective**: Add final-third patterns. Uses Phase 2.5 engine.

### Patterns added to library
- **WING_ATTACK_LEFT/RIGHT** (already in Phase 2.5 starter): validated here with gates.
- **CENTRAL_COMBO** (already in Phase 2.5 starter): validated here with gates.
- **THROUGH_BALL**: midfielder with ball, striker past opp last defender, clear lane. Pattern assigns STRIKER as RUNNER, carrier plays DRIVEN through.

### Gates
- **G4.1** Crosses per match ≥ 6 (emerge from WING_ATTACK byline completion)
- **G4.2** Cutback passes ≥ 3 (emerge from WING_ATTACK cutback decision)
- **G4.3** Through-balls ≥ 2 (emerge from THROUGH_BALL pattern)
- **G4.4** Corners ≥ 4 (emerge naturally from wing attacks crossing endline)
- **G4.5** Shots from cross/cutback/through-ball ≥ 40% of all shots
- **G4.6** Pattern diversity in final third: each match has ≥ 3 of {wing-attack-left, wing-attack-right, central-combo, through-ball} each firing ≥ 1 time

### Sub-objectives
- **S4.1** WING_ATTACK pattern completion: CARRIER (winger) at byline + NEAR_POST_RUNNER (striker) in box + FAR_POST (opp winger) at back post → carrier's action is CROSS pass (LONG_LOFTED or DRIVEN low) to whichever runner has best lane
- **S4.2** CUTBACK within WING_ATTACK: if CUTBACK_RECEIVER (arriving CM) is in pocket + byline path clear for few more meters, prefer cutback over cross
- **S4.3** CENTRAL_COMBO: 1-2 between carrier and nearest advanced teammate. Both players have roles (CARRIER, WALL). Wall player holds brief + returns pass.
- **S4.4** THROUGH_BALL: detect precondition (striker past opp last def + lane clear). Pattern triggers pivot through pass.
- **S4.5** Pattern library lookup cleaned up: no more ad-hoc "if winger on byline, cross" scattered through carrier decision. All crossing happens through WING_ATTACK pattern execution.

---

## PHASE 5 — Shot Quality Gate

**Objective**: Shots complete patterns. Force-shots vanish.

### Gates
- **G5.1** Force-shot rate ≤ 25% (currently 98%)
- **G5.2** Shots per match 20-35 (MLS 26.2)
- **G5.3** Shots from inside box ≥ 60% (currently 46%)
- **G5.4** SOT rate ≤ 45% (MLS 36%)
- **G5.5** Goals per match 2-4 (MLS 2.78)
- **G5.6** Long-range (>25y) shots ≤ 3 per match

### Sub-objectives
- **S5.1** Remove `forceShotNow` escape paths when phase-appropriate pattern exists
- **S5.2** Dynamic shot threshold by phase: easy in FINISH, hard in CHANCE_CREATION, impossible in BUILDUP/PROGRESSION (except `atGoalLineForce`)
- **S5.3** Keeper save model: higher save rate on weak/long shots; parry rate producing corner-deflections
- **S5.4** Shot accuracy model: off-target bias scales with distance, angle, pressure

---

## PHASE 6 — Defensive Structure (future)

**Objective**: Reactive defense → structured defense with pressing triggers, shape, recovery runs.

Sketched — detail after Phase 5:
- Pressing triggers (low block vs high press)
- Back-line cohesion
- Recovery runs on transition
- Keeper claim zone + distribution logic

May start parallel with Phase 4.

---

## EXECUTION

**Order**: 0 → 1 → 2 → 3 → 4 → 5. Phase 6 may parallel with Phase 4.

**Each phase requires**:
1. Gates measurable in analyzer
2. Gates pass on 3 consecutive matches
3. Snapshot saved + git tag
4. Only then advance

**Regression policy**: If prior-phase gates fail later, revert git tag, diagnose, fix, re-validate. Do NOT paper over.

**No parameter tweaks** outside current phase's sub-objectives.

---

## Current state (as of 2026-04-24)

### Phase 0 — COMPLETE
- Analyzer extended for phase time %, pass-by-zone, role positions (phase-filtered)
- Git tag `pre-structural-fixes` at commit `454d44a`

### Phase 1 — PARTIAL VALIDATION (4 matches run)
Gates G1.1 (CB depth), G1.4 (non-attacker shots), G1.5 (pass-to-ST ~14%) mostly passing.
G1.2 (ST opp-half fwdX) trending up (4.5 → 11.48) but not at 15.
G1.3 (LM/RM |z| final-third) stuck at 4-6. **Determined: cannot solve positioning in isolation.**

Key learning from match 4: unconditional winger width at 0.75 blend regressed passing
(hasForwardOption 20% → 7.7%). Wingers far wide → pass triangles broken.
Partial rollback in commit `fc91347`.

**Verdict**: Positioning is downstream of patterns. Phase 1 positioning layers conflict
and fight each other. Real fix is Phase 2.5 Pattern Engine — position targets emerge
from active pattern, not hard-coded role caps.

### Next: Phase 2 (state machine) + Phase 2.5 (pattern engine)
Phase 2 establishes ball-phase awareness. Phase 2.5 adds pattern state + role assignments.
Phases 3 and 4 become "extend pattern library" with LINE_BREAK, THIRD_MAN_RUN, WING_ATTACK,
CENTRAL_COMBO, THROUGH_BALL. Position enforcement moves from hard caps to pattern-role-driven
targets.
