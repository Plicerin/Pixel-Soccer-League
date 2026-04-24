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

## PHASE 3 — Progression Patterns

**Objective**: Ball moves BUILDUP → PROGRESSION with intent, not circulation.

### Patterns
- **Line-break**: CB/DM → CM/winger past opposition midfield line
- **Switch of play**: CB/CM → opposite winger after 5s on one side
- **Third-man run**: CB → CM → striker's run

### Gates
- **G3.1** BUILDUP → PROGRESSION transitions ≥ 8 per match
- **G3.2** PROGRESSION → CHANCE_CREATION transitions ≥ 5 per match
- **G3.3** Line-breaking passes (progression ≥ 8 units past opp midfielders) ≥ 5 per match
- **G3.4** Switches (long cross-axis pass, dist > 20) ≥ 2 per match

### Sub-objectives
- **S3.1** BUILDUP pass scoring prioritizes line-break receivers
- **S3.2** Switch-of-play trigger: team on one flank > 5s → boost opposite-flank winger score
- **S3.3** Third-man-run: CM with ball + striker making run → through-ball score boost

---

## PHASE 4 — Final-Third Patterns

**Objective**: In CHANCE_CREATION, structured patterns — no carry-and-shoot.

### Patterns
- **Wing attack**: winger to byline → cross or cutback
- **Central combo**: 1-2 or lay-off
- **Through-ball**: mid threads pass behind defense

### Gates
- **G4.1** Crosses per match ≥ 6
- **G4.2** Cutback passes ≥ 3
- **G4.3** Through-balls ≥ 2
- **G4.4** Corners ≥ 4 (emerging naturally from wing attacks crossing endline)
- **G4.5** Shots from cross/cutback/through-ball ≥ 40% of all shots

### Sub-objectives
- **S4.1** Wing-attack FSM: LM/RM in final third with byline path + striker in box → trigger cross
- **S4.2** Cutback trigger: LM/RM at byline (|z|>15, dist<penaltyDepth+4) + arriving midfielder → prefer cutback over shot
- **S4.3** Striker make-run: when CM has ball in progression, striker runs to shoulder of last defender
- **S4.4** Through-ball detection: carrier in mid-third, striker past opp last def, clear lane → DRIVEN through

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

## Current state (as of 2026-04-23)

### Phase 0 — COMPLETE
- S0.1-S0.3 analyzer extended: phase time %, pass-by-zone, role positions
- S0.4 git tag `pre-structural-fixes` applied at commit `454d44a`

### Phase 1 — CODE COMPLETE, PENDING VALIDATION (3 matches)
- S1.1 `forceDefenderPass` — CB/LB/RB past midfield with valid target → force pass
- S1.2 Striker line enforcement — target `max(carrier.x+10, oppLastDef-2)` at 0.70 blend
- S1.3 Winger width phase-aware blend — 0.55 in progression/final-third, 0.30 in own third
- S1.4 Role shot allowlist — CB/LB/RB: only dist<5 & keeper<3. CM/DM: only in box dist<12.

Next action: run 3 CPU-vs-CPU matches. Validate Phase 1 gates (G1.1-G1.5). Revert tag if regression, else advance to Phase 2.
