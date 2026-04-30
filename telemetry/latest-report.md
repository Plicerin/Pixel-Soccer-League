# Telemetry Analysis

## Match
- Fixture: Seattle Sounders 0-0 New York City FC
- Session: ft-1777492199234
- Timestamp: 2026-04-29T19:49:59.234Z
- Shots: 23-10
- Shots on target: 3-0

## Tuning KPIs
- Overall: 54.8 (red)
- Baseline Fit: 18.2 (red) — one-match MLS stat fit: goals ~2-3, shots ~26, SOT ~9, corners ~8, long-range SOT <=3
  - Inputs: goals 0, shots 33, SOT 3, long-range SOT 2, corners 4
- Soccer Structure: 72.3 (watch) — soccer-like structure: width >=18, center+narrow <=35%, overload share >=25%, danger marking >=78%, shot corridor defenders >=1.2, empty-box shots <=35%, pattern touches >=2, real crosses >=5
  - Inputs: width 24.01/24.57, center+narrow worst 40.7%, overload share 14.9%, danger marked 65.2%, shot corridor defenders 4.45, empty-box shots 12.1%, pattern touches 1.72, real crosses 14
- Tuning Efficiency: 74 (watch) — low-tweak debt: forced shots <=55%, final-third backpasses <=18, lateral flips <=90, direct-blocker passes <=70, broken rows <=10%
  - Inputs: forced shots 0%, final-third backpasses 6, zigzag flips 137, direct-blocker passes 0, broken shot rows 0%

## MLS Baseline Comparison
- Total goals: 0 vs 2.78 baseline (drift -2.78)
- Total shots: 33 vs 26.2 baseline (drift 6.8)
- Total shots on target: 3 vs 9.4 baseline (drift -6.4)
- Total corners: 4 vs 8 baseline (drift -4)

## Match Summary Telemetry
- Event count: 17275
- Pass log events: 228
- Carrier traces: 744
- Attacker zone traces: 948
- Shot decisions: 33
- Pass decisions: 211
- Interceptions: 17
- Turnovers: 21

## Decision Telemetry
- Forced shots: 0 of 33
- AI_SIMPLE broken rows: 0 of 33
- AI_SIMPLE forced broken rows: 0
- Long-range shot decisions: 30
- Pressured long-range shot decisions: 3
- Attacker final-third backpasses: 6
- Attacker in-box backpasses: 0
- Direct-blocker pass decisions: 0

## Movement / Facing
- Carrier traces analyzed: 744
- Carriers tracked: 20
- Forward-carry samples: 317
- Lateral direction flips: 137
- Avg forward progress per flip: 2.87
- Switch requests: 83
- Blocked switch requests: 83
- Carry lock samples: 510
- Facing vs movement mismatch: 18.4%
- Desired vs steer mismatch: 11.5%

## Box Behavior
- Box traces analyzed: 62
- Attackers tracked in box: 9

## Heat Map / Shape
- Seattle Sounders: avg width 24.01, avg |avgZ| 2.33, center-locked 89.8%, center+narrow 40.7%
- New York City FC: avg width 24.57, avg |avgZ| 1.7, center-locked 83.1%, center+narrow 33.9%
- Seattle Sounders wide touches vs central touches: 20 vs 55
- New York City FC wide touches vs central touches: 50 vs 43
- Seattle Sounders wide shots vs central shots: 0 vs 23
- New York City FC wide shots vs central shots: 1 vs 9
- Position owner samples: 10696
- Seattle Sounders owner mix: PHASE_HOME:3451 | WIDE_HOME:67 | PATTERN_ROLE:680 | DANGER_MARK:248 | BOX_COVER:468 | BOX_CRASH:113 | STRUCTURED_ATTACK:313 | COLLAPSE_DEFEND:1
- New York City FC owner mix: PHASE_HOME:3243 | BOX_COVER:530 | DANGER_MARK:143 | COLLAPSE_DEFEND:7 | PATTERN_ROLE:626 | WIDE_HOME:187 | STRUCTURED_ATTACK:537 | BOX_CRASH:82
- Seattle Sounders wide owner avg |z| 6.69, target |z| 8.05: WIDE_HOME:67 | PATTERN_ROLE:110 | DANGER_MARK:49 | PHASE_HOME:600 | BOX_COVER:121 | BOX_CRASH:38 | STRUCTURED_ATTACK:55
- New York City FC wide owner avg |z| 7.26, target |z| 9.31: PHASE_HOME:1316 | BOX_COVER:214 | WIDE_HOME:187 | PATTERN_ROLE:223 | STRUCTURED_ATTACK:132 | DANGER_MARK:35 | BOX_CRASH:73

## Phase Time Distribution
- Seattle Sounders: buildup 12.7% | progression 66.6% | chance 18.7% | finish 2% (347 samples)
- New York City FC: buildup 21.2% | progression 59.9% | chance 18.4% | finish 0.5% (397 samples)

## Pass Decisions By Zone
- Evaluated: BUILDUP_CENTRAL:131 | FINAL_THIRD_CENTRAL:13 | BUILDUP_HALFSPACE:55 | BOX_CENTRAL:3 | BUILDUP_WIDE:7 | FINAL_THIRD_HALFSPACE:2
- Executed (shouldPass): BUILDUP_CENTRAL:77 | BUILDUP_HALFSPACE:41 | BOX_CENTRAL:3 | FINAL_THIRD_CENTRAL:4 | BUILDUP_WIDE:7 | FINAL_THIRD_HALFSPACE:2

## Pattern Tempo (realism fit per pattern type)
- WING_ATTACK_RIGHT (21x): touches 2.05 [OK vs 2-4], pace -4.15u/s [TOO_SLOW vs 3-8u/s], duration 3.39s — expected quick deliver
- COUNTER_ATTACK (61x): touches 1.87 [TOO_FEW vs 2-4], pace 5.87u/s [OK vs 4-12u/s], duration 3.98s — expected fast direct
- CENTRAL_COMBO (14x): touches 1.93 [TOO_FEW vs 2-4], pace 6.41u/s [TOO_FAST vs 2.5-6u/s], duration 2.15s — expected short sharp
- WING_ATTACK_LEFT (20x): touches 1.45 [TOO_FEW vs 2-4], pace 4.21u/s [OK vs 3-8u/s], duration 3.37s — expected quick deliver
- PATIENT_BUILDUP (25x): touches 1.28 [TOO_FEW vs 3-7], pace 3.52u/s [OK vs 1-4u/s], duration 1.35s — expected deliberate

## Neo-Play Effectiveness
- Starts: 141; deliveries: 44; shot-producing deliveries: 16 (36.4%); goal-producing deliveries: 0 (0%)
- WING_ATTACK_RIGHT: starts 21, deliveries 1, crosses 0, effective 0/1 (0%), goals 0/1 (0%)
- COUNTER_ATTACK: starts 61, deliveries 1, crosses 0, effective 1/1 (100%), goals 0/1 (0%)
- PATIENT_BUILDUP: starts 25, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- GIVE_AND_GO: starts 14, deliveries 10, crosses 0, effective 1/10 (10%), goals 0/10 (0%)
- WING_ATTACK_LEFT: starts 20, deliveries 2, crosses 0, effective 1/2 (50%), goals 0/2 (0%)
- STRUCTURED_WING_ATTACK: starts 0, deliveries 30, crosses 28, effective 13/30 (43.3%), goals 0/30 (0%)

## Defenders In Box At Goal (defensive presence)
- Goals: 0, avg 0 defenders + 0 attackers in box at moment of goal
- Distribution: (none)

## Shot Box Defense
- Shots sampled: 33
- Avg defenders in box: 3.15
- Avg defenders in goal corridor: 4.45
- Empty-box shots: 4
- Empty-corridor shots: 0
- Samples:
  - Team A Obed Vargas ST @ 3.8s: 3 box, 4 corridor defenders
  - Team A Obed Vargas ST @ 24.2s: 5 box, 6 corridor defenders
  - Team A Obed Vargas ST @ 30.6s: 5 box, 6 corridor defenders
  - Team A Obed Vargas ST @ 32.5s: 5 box, 5 corridor defenders
  - Team A Jordan Morris ST @ 55.7s: 6 box, 6 corridor defenders
  - Team A Jordan Morris ST @ 57.5s: 4 box, 4 corridor defenders
  - Team B Alonso Martínez ST @ 64.7s: 2 box, 5 corridor defenders
  - Team A Jordan Morris ST @ 71.1s: 1 box, 3 corridor defenders

## Final-Third Overloads (attacking commitment)
- Seattle Sounders: 6/76 1s-windows had 3+ attackers in opp final third (max 4)
- New York City FC: 20/91 1s-windows had 3+ attackers in opp final third (max 5)

## Danger-Zone Marking
- Samples: 210
- Seattle Sounders attackers marked: 64/95 (67.4%), avg nearest defender 3.76
- New York City FC attackers marked: 73/115 (63.5%), avg nearest defender 3.8
- Worst unmarked samples:
  - Seattle Sounders Pedro De la Vega RM @ 292.1s: nearest defender 48.47, 11u from goal (RUNNER)
  - Seattle Sounders Pedro De la Vega RM @ 344s: nearest defender 24.81, 4u from goal (NONE)
  - Seattle Sounders Pedro De la Vega RM @ 344.3s: nearest defender 22, 5.4u from goal (NONE)
  - New York City FC Nicolás Fernández LM @ 384.3s: nearest defender 31.79, 3.5u from goal (NONE)
  - New York City FC Hannes Wolf RM @ 449.5s: nearest defender 29.04, 3.1u from goal (FAR_POST_RUNNER)
  - New York City FC Nicolás Fernández LM @ 153.4s: nearest defender 22.34, 5u from goal (FAR_POST_RUNNER)

## Multi-Touch Opp-Half Sequences (build-up quality)
- Sequences with 2+ distinct players touching ball in opp half: 55 of 102
- Opp-half touches total: 271
- Avg distinct players per possession: 1.87
- Examples:
  - Team B @ 13.8s: 3 touches by Agustín Ojeda → Maxi Moralez
  - Team A @ 18.0s: 3 touches by Obed Vargas → Jackson Ragen
  - Team A @ 24.2s: 8 touches by ST → Jackson Ragen → Nouhou Tolo → Obed Vargas
  - Team A @ 41.5s: 2 touches by Jackson Ragen → Jesús Ferreira
  - Team A @ 44.3s: 3 touches by Jordan Morris → Obed Vargas
  - Team A @ 48.2s: 3 touches by Nouhou Tolo → Jordan Morris

## Kickoff Receiver / Goal Correlation
- Kickoff passes recorded: 2; kickoff receives recorded: 2; scorer events: 0
- Seattle Sounders: 0/0 goals scored by latest kickoff receiver (0%)
- New York City FC: 0/0 goals scored by latest kickoff receiver (0%)
- Seattle Sounders kickoff receivers: Obed Vargas ST recv:1 intended:1 goals:0
- New York City FC kickoff receivers: Julián Fernández RM recv:1 intended:1 goals:0

## Pattern Engine (Phase 2.5)
- Total pattern starts: 141 (A 67, B 74)
- Distinct types per team: A 5, B 5
- Types A: WING_ATTACK_RIGHT:12, COUNTER_ATTACK:26, CENTRAL_COMBO:8, WING_ATTACK_LEFT:9, PATIENT_BUILDUP:12
- Types B: COUNTER_ATTACK:35, WING_ATTACK_RIGHT:9, PATIENT_BUILDUP:13, WING_ATTACK_LEFT:11, CENTRAL_COMBO:6
- Avg duration by type: WING_ATTACK_RIGHT 3.66s, COUNTER_ATTACK 4.13s, PATIENT_BUILDUP 4.63s, CENTRAL_COMBO 3.44s, WING_ATTACK_LEFT 4.58s
- End reasons: possession_lost 94, invalidated 45
- Shots by active pattern: WING_ATTACK_RIGHT 5, NONE 6, WING_ATTACK_LEFT 2, CENTRAL_COMBO 5, COUNTER_ATTACK 14, PATIENT_BUILDUP 1
- Goals by active pattern: (none)

## Role Positions (team-in-possession frames)
- Seattle Sounders:
  - LM: avgX -3.9, avg|Z| 15.33, avgDistToGoal 30.56 (87 samples); opp-half fwdX 12.11 (33); final-third |z| 9.2 (27)
  - RM: avgX 2, avg|Z| 11.52, avgDistToGoal 30.44 (93 samples); opp-half fwdX 16.34 (45); final-third |z| 8.62 (25)
  - ST: avgX 0.74, avg|Z| 2.93, avgDistToGoal 20.55 (183 samples); opp-half fwdX 10.9 (109); final-third |z| 2.94 (88)
- New York City FC:
  - LM: avgX -2.14, avg|Z| 13.04, avgDistToGoal 27.01 (202 samples); opp-half fwdX 11.59 (124); final-third |z| 10.62 (69)
  - RM: avgX 0.05, avg|Z| 13.16, avgDistToGoal 28.8 (207 samples); opp-half fwdX 11.88 (103); final-third |z| 10.94 (66)
  - ST: avgX -1.86, avg|Z| 4.16, avgDistToGoal 21.36 (176 samples); opp-half fwdX 11.56 (109); final-third |z| 3.03 (82)

## Event Stream Review
- Event-stream shots: 33
- Event-stream on-target shots: 3
- Long-range on-target shots: 2
- Close-range bad-angle shots: 0
- On-target toe pokes: 0
- Attacker reset passes (BACK/WALL): 14

### Long-Range On-Target Shots
- Team A ST: 4', HEADER, 24y, angle 0.33, pressure 4
- Team A ST: 4', CURLED, 31.9y, angle 0.31, pressure 0

### Top Zigzag Offenders
- Team B LM Agustín Ojeda: flips 18, avg progress/flip 1.76, switch requests 5, blocked 5, facing mismatch 14.7%
- Team B LM Nicolás Fernández: flips 16, avg progress/flip 4.03, switch requests 5, blocked 5, facing mismatch 15.4%
- Team B ST Alonso Martínez: flips 12, avg progress/flip 1.33, switch requests 17, blocked 17, facing mismatch 24.1%
- Team A ST Jordan Morris: flips 12, avg progress/flip 4.01, switch requests 11, blocked 11, facing mismatch 26.3%
- Team A ST Obed Vargas: flips 9, avg progress/flip 1.34, switch requests 12, blocked 12, facing mismatch 20.6%
- Team A RM Pedro De la Vega: flips 9, avg progress/flip 1.85, switch requests 5, blocked 5, facing mismatch 16.7%
- Team A LM Albert Rusnák: flips 9, avg progress/flip 4.73, switch requests 2, blocked 2, facing mismatch 13.9%
- Team B RM Julián Fernández: flips 9, avg progress/flip 2.26, switch requests 1, blocked 1, facing mismatch 6.1%

### Top Box Loiterers
- Team A ST Jordan Morris: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team B ST Alonso Martínez: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team A RM Pedro De la Vega: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team A LM Albert Rusnák: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team B LM Nicolás Fernández: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team B RM Hannes Wolf: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team A ST Obed Vargas: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team B LM Agustín Ojeda: max dwell 0s, max idle 0s, max camp 0s, crowded 0%

## Suggested Improvements
- Final-third recycling is still too common. Tighten attacker backpass vetoes and extend the carry-or-shoot window before resets are allowed.
- Shape is still too central. Strengthen weak-side width anchors and reduce carrier-gravity pull on wide roles and midfield support.
- Danger-zone attackers are still too often unmarked. Tighten goal-side marking assignments for box, cutback, and far-post runners without pulling the ball presser out of shape.
- Too much of the final action still comes through central roles. Encourage wider occupation and more wing-led creation before the finish.
- Some shots still lack second-wave support. Nudge nearby midfielders to arrive a little earlier into the edge-of-box support band.
- Carrier zigzagging is still present. Reduce repeated lateral sign flips by holding the current carry lane longer and tightening the link between desired heading, facing heading, and actual movement heading.
