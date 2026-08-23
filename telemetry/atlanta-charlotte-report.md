# Telemetry Analysis

## Match
- Fixture: Atlanta United 1-2 Charlotte FC
- Session: ft-1777782314244
- Timestamp: 2026-05-03T04:25:14.244Z
- Shots: 12-11
- Shots on target: 2-3

## Tuning KPIs
- Overall: 73.2 (watch)
- Baseline Fit: 55 (red) — one-match MLS stat fit: goals ~2-3, shots ~26, SOT ~9, corners ~8, long-range SOT <=3
  - Inputs: goals 3, shots 23, SOT 5, long-range SOT 0, corners 39
- Soccer Structure: 81.5 (watch) — soccer-like structure: width >=18, center+narrow <=35%, overload share >=25%, danger marking >=78%, shot corridor defenders >=1.2, empty-box shots <=35%, pattern touches >=2, real crosses >=5
  - Inputs: width 23.52/22.99, center+narrow worst 17.8%, overload share 83.4%, danger marked 77.6%, shot corridor defenders 2.87, empty-box shots 0%, pattern touches 1.79, real crosses 0
- Tuning Efficiency: 83.1 (watch) — low-tweak debt: forced shots <=55%, final-third backpasses <=18, lateral flips <=90, direct-blocker passes <=70, broken rows <=10%
  - Inputs: forced shots 26.1%, final-third backpasses 0, zigzag flips 25, direct-blocker passes 0, broken shot rows 0%

## MLS Baseline Comparison
- Total goals: 3 vs 2.78 baseline (drift 0.22)
- Total shots: 23 vs 26.2 baseline (drift -3.2)
- Total shots on target: 5 vs 9.4 baseline (drift -4.4)
- Total corners: 39 vs 8 baseline (drift 31)

## Match Summary Telemetry
- Event count: 25046
- Pass log events: 218
- Carrier traces: 314
- Attacker zone traces: 1315
- Shot decisions: 23
- Pass decisions: 0
- Interceptions: 24
- Turnovers: 25

## Decision Telemetry
- Forced shots: 6 of 23
- AI_SIMPLE broken rows: 0 of 12
- AI_SIMPLE forced broken rows: 0
- Long-range shot decisions: 5
- Pressured long-range shot decisions: 4
- Attacker final-third backpasses: 0
- Attacker in-box backpasses: 0
- Direct-blocker pass decisions: 0

## Movement / Facing
- Carrier traces analyzed: 314
- Carriers tracked: 19
- Forward-carry samples: 86
- Lateral direction flips: 25
- Avg forward progress per flip: 0.78
- Switch requests: 68
- Blocked switch requests: 68
- Carry lock samples: 0
- Facing vs movement mismatch: 15.7%
- Desired vs steer mismatch: 24.8%

## Box Behavior
- Box traces analyzed: 256
- Attackers tracked in box: 8

## Heat Map / Shape
- Atlanta United: avg width 23.52, avg |avgZ| 2.17, center-locked 78%, center+narrow 17.8%
- Charlotte FC: avg width 22.99, avg |avgZ| 2.35, center-locked 66.1%, center+narrow 14.4%
- Atlanta United wide touches vs central touches: 17 vs 35
- Charlotte FC wide touches vs central touches: 20 vs 39
- Atlanta United wide shots vs central shots: 1 vs 8
- Charlotte FC wide shots vs central shots: 3 vs 5
- Position owner samples: 11120
- Atlanta United owner mix: PHASE_HOME:3501 | WIDE_HOME:65 | STRUCTURED_ATTACK:713 | BOX_CRASH:216 | PATTERN_ROLE:376 | BOX_COVER:133 | COLLAPSE_DEFEND:9 | DANGER_MARK:543
- Charlotte FC owner mix: PHASE_HOME:3351 | BOX_COVER:165 | WIDE_HOME:115 | PATTERN_ROLE:469 | DANGER_MARK:687 | STRUCTURED_ATTACK:597 | BOX_CRASH:171 | COLLAPSE_DEFEND:9
- Atlanta United wide owner avg |z| 6.56, target |z| 9.7: WIDE_HOME:65 | PHASE_HOME:1420 | STRUCTURED_ATTACK:178 | BOX_CRASH:205 | BOX_COVER:45 | PATTERN_ROLE:148 | DANGER_MARK:187
- Charlotte FC wide owner avg |z| 6.83, target |z| 9.52: PHASE_HOME:1285 | BOX_COVER:63 | WIDE_HOME:115 | DANGER_MARK:228 | PATTERN_ROLE:188 | STRUCTURED_ATTACK:145 | BOX_CRASH:169

## Phase Time Distribution
- Atlanta United: buildup 18.1% | progression 42.5% | chance 32.5% | finish 6.9% (160 samples)
- Charlotte FC: buildup 38.3% | progression 42.9% | chance 10.4% | finish 8.4% (154 samples)

## Pass Decisions By Zone
- Evaluated: 
- Executed (shouldPass): 

## Pattern Tempo (realism fit per pattern type)
- WING_ATTACK_LEFT (10x): touches 2.3 [OK vs 2-4], pace -3u/s [TOO_SLOW vs 3-8u/s], duration 7.66s — expected quick deliver
- WING_ATTACK_RIGHT (19x): touches 1.95 [TOO_FEW vs 2-4], pace 0.11u/s [TOO_SLOW vs 3-8u/s], duration 3.71s — expected quick deliver
- PATIENT_BUILDUP (24x): touches 1.33 [TOO_FEW vs 3-7], pace 2.51u/s [OK vs 1-4u/s], duration 2.75s — expected deliberate
- COUNTER_ATTACK (48x): touches 1.85 [TOO_FEW vs 2-4], pace 0.47u/s [TOO_SLOW vs 4-12u/s], duration 5.03s — expected fast direct
- CENTRAL_COMBO (15x): touches 1.53 [TOO_FEW vs 2-4], pace 4.38u/s [OK vs 2.5-6u/s], duration 3.95s — expected short sharp

## Neo-Play Effectiveness
- Starts: 116; deliveries: 0; shot-producing deliveries: 0 (0%); goal-producing deliveries: 0 (0%)
- COUNTER_ATTACK: starts 48, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- WING_ATTACK_LEFT: starts 10, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- WING_ATTACK_RIGHT: starts 19, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- PATIENT_BUILDUP: starts 24, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- GIVE_AND_GO: starts 15, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)

## Defenders In Box At Goal (defensive presence)
- Goals: 3, avg 4 defenders + 2.33 attackers in box at moment of goal
- Distribution: 3 defenders: 1 goals, 4 defenders: 1 goals, 5 defenders: 1 goals
- Samples:
  - A Stian Gregersen #4 @ 45': 3 defenders, 3 attackers (OPEN_PLAY)
  - B Liel Abada #8 @ 66': 5 defenders, 2 attackers (OPEN_PLAY)
  - B Harry Toffolo #3 @ 73': 4 defenders, 2 attackers (OPEN_PLAY)

## Shot Box Defense
- Shots sampled: 23
- Avg defenders in box: 3.17
- Avg defenders in goal corridor: 2.87
- Empty-box shots: 0
- Empty-corridor shots: 0
- Samples:
  - Team A Miguel Almirón CM @ 19.5s: 4 box, 3 corridor defenders
  - Team A Emmanuel Latte Lath ST @ 47s: 3 box, 3 corridor defenders
  - Team A Emmanuel Latte Lath ST @ 78.9s: 3 box, 4 corridor defenders
  - Team B Harry Toffolo CB @ 102.5s: 3 box, 2 corridor defenders
  - Team B Harry Toffolo CB @ 113.4s: 3 box, 3 corridor defenders
  - Team A Saba Lobjanidze RM @ 177.4s: 4 box, 4 corridor defenders
  - Team A Emmanuel Latte Lath ST @ 187.8s: 2 box, 2 corridor defenders
  - Team B Idan Toklomati ST @ 239s: 4 box, 2 corridor defenders

## Final-Third Overloads (attacking commitment)
- Atlanta United: 92/100 1s-windows had 3+ attackers in opp final third (max 5)
- Charlotte FC: 68/91 1s-windows had 3+ attackers in opp final third (max 5)

## Danger-Zone Marking
- Samples: 771
- Atlanta United attackers marked: 346/442 (78.3%), avg nearest defender 2.64
- Charlotte FC attackers marked: 252/329 (76.6%), avg nearest defender 2.54
- Worst unmarked samples:
  - Atlanta United Emmanuel Latte Lath ST @ 447.2s: nearest defender 21.07, 1u from goal (NONE)
  - Atlanta United Emmanuel Latte Lath ST @ 446.5s: nearest defender 21.05, 1u from goal (NONE)
  - Atlanta United Emmanuel Latte Lath ST @ 445.8s: nearest defender 20.81, 1u from goal (NONE)
  - Charlotte FC Wilfried Zaha LM @ 359.5s: nearest defender 13.43, 4.8u from goal (NONE)
  - Charlotte FC Brandt Bronico LM @ 105.6s: nearest defender 13.08, 9.2u from goal (NONE)
  - Charlotte FC Wilfried Zaha LM @ 358.8s: nearest defender 12.7, 4.8u from goal (NONE)

## Multi-Touch Opp-Half Sequences (build-up quality)
- Sequences with 2+ distinct players touching ball in opp half: 50 of 122
- Opp-half touches total: 217
- Avg distinct players per possession: 1.38
- Examples:
  - Team A @ 16.8s: 7 touches by Enea Mihaj → Saba Lobjanidze → Miguel Almirón → CM
  - Team A @ 27.3s: 3 touches by Pedro Miguel Santos Amador → Saba Lobjanidze
  - Team A @ 45.1s: 3 touches by Enea Mihaj → Emmanuel Latte Lath → ST
  - Team A @ 62.4s: 2 touches by Stian Gregersen → Miguel Almirón
  - Team A @ 74.6s: 5 touches by Pedro Miguel Santos Amador → Emmanuel Latte Lath → Enea Mihaj → ST
  - Team B @ 100.3s: 5 touches by Tim Ream → Harry Toffolo → CB → Brandt Bronico → Liel Abada

## Kickoff Receiver / Goal Correlation
- Kickoff passes recorded: 5; kickoff receives recorded: 3; scorer events: 3
- Atlanta United: 0/1 goals scored by latest kickoff receiver (0%)
- Charlotte FC: 0/2 goals scored by latest kickoff receiver (0%)
- Atlanta United kickoff receivers: Bartosz Slisz CM recv:2 intended:2 goals:0 | Brooks Lennon RM recv:0 intended:2 goals:0
- Charlotte FC kickoff receivers: Ashley Westwood CM recv:1 intended:1 goals:0
- Samples:
  - Atlanta United goal Stian Gregersen @ 45': latest kickoff receiver Bartosz Slisz, same=false, 9.09s later
  - Charlotte FC goal Harry Toffolo @ 73': latest kickoff receiver Ashley Westwood, same=false, 36.84s later

## Pattern Engine (Phase 2.5)
- Total pattern starts: 116 (A 57, B 59)
- Distinct types per team: A 5, B 5
- Types A: WING_ATTACK_LEFT:5, WING_ATTACK_RIGHT:10, PATIENT_BUILDUP:11, COUNTER_ATTACK:23, CENTRAL_COMBO:8
- Types B: COUNTER_ATTACK:25, WING_ATTACK_RIGHT:9, PATIENT_BUILDUP:13, CENTRAL_COMBO:7, WING_ATTACK_LEFT:5
- Avg duration by type: COUNTER_ATTACK 4.89s, WING_ATTACK_LEFT 6.14s, WING_ATTACK_RIGHT 5.42s, PATIENT_BUILDUP 4.91s, CENTRAL_COMBO 4.37s
- End reasons: possession_lost 79, invalidated 35
- Shots by active pattern: WING_ATTACK_LEFT 4, NONE 4, COUNTER_ATTACK 4, CENTRAL_COMBO 5, WING_ATTACK_RIGHT 4, PATIENT_BUILDUP 2
- Goals by active pattern: WING_ATTACK_RIGHT 1, PATIENT_BUILDUP 1, CENTRAL_COMBO 1

## Role Positions (team-in-possession frames)
- Atlanta United:
  - LM: avgX 7.44, avg|Z| 7.64, avgDistToGoal 14.94 (276 samples); opp-half fwdX 21.94 (170); final-third |z| 6.76 (224)
  - RM: avgX 7.4, avg|Z| 9.97, avgDistToGoal 16.45 (273 samples); opp-half fwdX 19.61 (173); final-third |z| 10.71 (207)
  - ST: avgX 4.94, avg|Z| 6.6, avgDistToGoal 16.8 (151 samples); opp-half fwdX 18.66 (91); final-third |z| 5.76 (129)
- Charlotte FC:
  - LM: avgX 7.88, avg|Z| 7.42, avgDistToGoal 15.2 (216 samples); opp-half fwdX 17.88 (68); final-third |z| 6.75 (160)
  - RM: avgX 8.24, avg|Z| 12.9, avgDistToGoal 20.67 (266 samples); opp-half fwdX 17.26 (65); final-third |z| 12.35 (166)
  - ST: avgX 8.23, avg|Z| 5.82, avgDistToGoal 16.82 (133 samples); opp-half fwdX 14.73 (35); final-third |z| 6.11 (95)

## Event Stream Review
- Event-stream shots: 23
- Event-stream on-target shots: 5
- Long-range on-target shots: 0
- Close-range bad-angle shots: 0
- On-target toe pokes: 0
- Attacker reset passes (BACK/WALL): 14

### Top Zigzag Offenders
- Team A CM Miguel Almirón: flips 5, avg progress/flip 1.56, switch requests 9, blocked 9, facing mismatch 13.2%
- Team A CM Bartosz Slisz: flips 4, avg progress/flip 0.58, switch requests 7, blocked 7, facing mismatch 17.2%
- Team B ST Idan Toklomati: flips 3, avg progress/flip 1, switch requests 8, blocked 8, facing mismatch 0%
- Team A ST Emmanuel Latte Lath: flips 3, avg progress/flip 0.5, switch requests 6, blocked 6, facing mismatch 16.7%
- Team B LM Brandt Bronico: flips 3, avg progress/flip 0.6, switch requests 1, blocked 1, facing mismatch 30.8%
- Team B RM Kerwin Vargas: flips 2, avg progress/flip 0.6, switch requests 1, blocked 1, facing mismatch 28.6%
- Team A RM Brooks Lennon: flips 2, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 38.9%
- Team A LM Pedro Miguel Santos Amador: flips 2, avg progress/flip 0.9, switch requests 0, blocked 0, facing mismatch 25%

### Top Box Loiterers
- Team A LM Aleksey Miranchuk: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team B LM Wilfried Zaha: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team A LM Pedro Miguel Santos Amador: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team A RM Saba Lobjanidze: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team B LM Brandt Bronico: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team A ST Emmanuel Latte Lath: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team B ST Idan Toklomati: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team B RM Liel Abada: max dwell 0s, max idle 0s, max camp 0s, crowded 0%

## Suggested Improvements
- Final-third recycling is still too common. Tighten attacker backpass vetoes and extend the carry-or-shoot window before resets are allowed.
- Too much of the final action still comes through central roles. Encourage wider occupation and more wing-led creation before the finish.
- Carrier zigzagging is still present. Reduce repeated lateral sign flips by holding the current carry lane longer and tightening the link between desired heading, facing heading, and actual movement heading.
