# Telemetry Analysis

## Match
- Fixture: Minnesota United 0-0 FC Dallas
- Session: ft-1777778110404
- Timestamp: 2026-05-03T03:15:10.404Z
- Shots: 2-8
- Shots on target: 0-1

## Tuning KPIs
- Overall: 54.5 (red)
- Baseline Fit: 12 (red) — one-match MLS stat fit: goals ~2-3, shots ~26, SOT ~9, corners ~8, long-range SOT <=3
  - Inputs: goals 0, shots 10, SOT 1, long-range SOT 1, corners 31
- Soccer Structure: 79.7 (watch) — soccer-like structure: width >=18, center+narrow <=35%, overload share >=25%, danger marking >=78%, shot corridor defenders >=1.2, empty-box shots <=35%, pattern touches >=2, real crosses >=5
  - Inputs: width 22.23/22.76, center+narrow worst 16.9%, overload share 67.4%, danger marked 78.6%, shot corridor defenders 2.7, empty-box shots 10%, pattern touches 1.82, real crosses 0
- Tuning Efficiency: 71.9 (watch) — low-tweak debt: forced shots <=55%, final-third backpasses <=18, lateral flips <=90, direct-blocker passes <=70, broken rows <=10%
  - Inputs: forced shots 50%, final-third backpasses 0, zigzag flips 27, direct-blocker passes 0, broken shot rows 0%

## MLS Baseline Comparison
- Total goals: 0 vs 2.78 baseline (drift -2.78)
- Total shots: 10 vs 26.2 baseline (drift -16.2)
- Total shots on target: 1 vs 9.4 baseline (drift -8.4)
- Total corners: 31 vs 8 baseline (drift 23)

## Match Summary Telemetry
- Event count: 29714
- Pass log events: 240
- Carrier traces: 383
- Attacker zone traces: 1255
- Shot decisions: 10
- Pass decisions: 0
- Interceptions: 27
- Turnovers: 27

## Decision Telemetry
- Forced shots: 5 of 10
- AI_SIMPLE broken rows: 0 of 3
- AI_SIMPLE forced broken rows: 0
- Long-range shot decisions: 5
- Pressured long-range shot decisions: 5
- Attacker final-third backpasses: 0
- Attacker in-box backpasses: 0
- Direct-blocker pass decisions: 0

## Movement / Facing
- Carrier traces analyzed: 383
- Carriers tracked: 20
- Forward-carry samples: 96
- Lateral direction flips: 27
- Avg forward progress per flip: 1.66
- Switch requests: 109
- Blocked switch requests: 109
- Carry lock samples: 0
- Facing vs movement mismatch: 8.7%
- Desired vs steer mismatch: 23.2%

## Box Behavior
- Box traces analyzed: 191
- Attackers tracked in box: 8

## Heat Map / Shape
- Minnesota United: avg width 22.23, avg |avgZ| 2.5, center-locked 70.3%, center+narrow 14.4%
- FC Dallas: avg width 22.76, avg |avgZ| 2.33, center-locked 71.2%, center+narrow 16.9%
- Minnesota United wide touches vs central touches: 19 vs 33
- FC Dallas wide touches vs central touches: 15 vs 39
- Minnesota United wide shots vs central shots: 0 vs 1
- FC Dallas wide shots vs central shots: 3 vs 4
- Position owner samples: 10453
- Minnesota United owner mix: PHASE_HOME:3155 | BOX_COVER:182 | COLLAPSE_DEFEND:11 | DANGER_MARK:602 | PATTERN_ROLE:525 | WIDE_HOME:127 | STRUCTURED_ATTACK:514 | BOX_CRASH:110
- FC Dallas owner mix: PHASE_HOME:3287 | WIDE_HOME:103 | STRUCTURED_ATTACK:671 | BOX_CRASH:176 | PATTERN_ROLE:442 | BOX_COVER:153 | DANGER_MARK:395
- Minnesota United wide owner avg |z| 6.27, target |z| 9.25: PHASE_HOME:1222 | BOX_COVER:84 | DANGER_MARK:207 | PATTERN_ROLE:203 | WIDE_HOME:127 | STRUCTURED_ATTACK:125 | BOX_CRASH:107
- FC Dallas wide owner avg |z| 6.56, target |z| 9.91: WIDE_HOME:103 | PHASE_HOME:1280 | STRUCTURED_ATTACK:168 | BOX_CRASH:176 | PATTERN_ROLE:173 | BOX_COVER:65 | DANGER_MARK:129

## Phase Time Distribution
- Minnesota United: buildup 35% | progression 49.2% | chance 10.7% | finish 5.1% (197 samples)
- FC Dallas: buildup 24.2% | progression 47.3% | chance 22% | finish 6.5% (186 samples)

## Pass Decisions By Zone
- Evaluated: 
- Executed (shouldPass): 

## Pattern Tempo (realism fit per pattern type)
- COUNTER_ATTACK (44x): touches 1.93 [TOO_FEW vs 2-4], pace -4.75u/s [TOO_SLOW vs 4-12u/s], duration 3.67s — expected fast direct
- PATIENT_BUILDUP (26x): touches 1.54 [TOO_FEW vs 3-7], pace 1.65u/s [OK vs 1-4u/s], duration 3.15s — expected deliberate
- WING_ATTACK_LEFT (17x): touches 1.94 [TOO_FEW vs 2-4], pace -5.2u/s [TOO_SLOW vs 3-8u/s], duration 2.87s — expected quick deliver
- CENTRAL_COMBO (15x): touches 2.33 [OK vs 2-4], pace 3.42u/s [OK vs 2.5-6u/s], duration 5.98s — expected short sharp
- WING_ATTACK_RIGHT (13x): touches 1.38 [TOO_FEW vs 2-4], pace -4.75u/s [TOO_SLOW vs 3-8u/s], duration 2.91s — expected quick deliver

## Neo-Play Effectiveness
- Starts: 115; deliveries: 0; shot-producing deliveries: 0 (0%); goal-producing deliveries: 0 (0%)
- WING_ATTACK_RIGHT: starts 13, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- COUNTER_ATTACK: starts 44, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- GIVE_AND_GO: starts 15, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- PATIENT_BUILDUP: starts 26, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- WING_ATTACK_LEFT: starts 17, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)

## Defenders In Box At Goal (defensive presence)
- Goals: 0, avg 0 defenders + 0 attackers in box at moment of goal
- Distribution: (none)

## Shot Box Defense
- Shots sampled: 10
- Avg defenders in box: 2.5
- Avg defenders in goal corridor: 2.7
- Empty-box shots: 1
- Empty-corridor shots: 0
- Samples:
  - Team B Petar Musa ST @ 19.1s: 2 box, 4 corridor defenders
  - Team B Petar Musa ST @ 74.7s: 3 box, 3 corridor defenders
  - Team B Anderson Julio LM @ 137.8s: 1 box, 2 corridor defenders
  - Team A Ho Yeon Jung CB @ 270.9s: 4 box, 3 corridor defenders
  - Team B Petar Musa ST @ 178.7s: 0 box, 1 corridor defenders
  - Team B Anderson Julio LM @ 218.5s: 3 box, 2 corridor defenders
  - Team B Christian Cappis CM @ 248.4s: 2 box, 3 corridor defenders
  - Team B Osaze Urhoghide CB @ 266.5s: 3 box, 2 corridor defenders

## Final-Third Overloads (attacking commitment)
- Minnesota United: 55/78 1s-windows had 3+ attackers in opp final third (max 5)
- FC Dallas: 70/109 1s-windows had 3+ attackers in opp final third (max 5)

## Danger-Zone Marking
- Samples: 616
- Minnesota United attackers marked: 215/266 (80.8%), avg nearest defender 2.2
- FC Dallas attackers marked: 269/350 (76.9%), avg nearest defender 2.35
- Worst unmarked samples:
  - Minnesota United Kelvin Yeboah ST @ 106.8s: nearest defender 7.33, 18.6u from goal (NONE)
  - Minnesota United Kelvin Yeboah ST @ 153.3s: nearest defender 7.33, 18.6u from goal (NONE)
  - Minnesota United Kelvin Yeboah ST @ 160.5s: nearest defender 7.33, 18.6u from goal (NONE)
  - FC Dallas Paxton Pomykal RM @ 173.8s: nearest defender 13.74, 14.2u from goal (NONE)
  - FC Dallas Paxton Pomykal RM @ 172.8s: nearest defender 13.33, 17.7u from goal (NONE)
  - FC Dallas Paxton Pomykal RM @ 175.7s: nearest defender 11.57, 13.3u from goal (CARRIER)

## Multi-Touch Opp-Half Sequences (build-up quality)
- Sequences with 2+ distinct players touching ball in opp half: 48 of 116
- Opp-half touches total: 209
- Avg distinct players per possession: 1.36
- Examples:
  - Team B @ 10.6s: 13 touches by Petar Musa → Don Deedson Louicius → Sebastian Lletget → Christian Cappis → ST
  - Team B @ 26.9s: 4 touches by Anderson Julio → Sebastian Lletget
  - Team B @ 56.5s: 10 touches by Anderson Julio → Sebastian Lletget → Christian Cappis
  - Team A @ 64.3s: 2 touches by RM → David Justin Taylor
  - Team B @ 70.4s: 7 touches by Paxton Pomykal → Anderson Julio → Sebastian Lletget → Petar Musa → ST
  - Team B @ 79.4s: 2 touches by Ramiro Moschen Benetti → Paxton Pomykal

## Kickoff Receiver / Goal Correlation
- Kickoff passes recorded: 2; kickoff receives recorded: 1; scorer events: 0
- Minnesota United: 0/0 goals scored by latest kickoff receiver (0%)
- FC Dallas: 0/0 goals scored by latest kickoff receiver (0%)
- Minnesota United kickoff receivers: David Justin Taylor RM recv:1 intended:1 goals:0
- FC Dallas kickoff receivers: Don Deedson Louicius RM recv:0 intended:1 goals:0

## Pattern Engine (Phase 2.5)
- Total pattern starts: 115 (A 61, B 54)
- Distinct types per team: A 5, B 5
- Types A: COUNTER_ATTACK:25, PATIENT_BUILDUP:15, WING_ATTACK_LEFT:7, CENTRAL_COMBO:9, WING_ATTACK_RIGHT:5
- Types B: WING_ATTACK_RIGHT:8, COUNTER_ATTACK:19, CENTRAL_COMBO:6, PATIENT_BUILDUP:11, WING_ATTACK_LEFT:10
- Avg duration by type: WING_ATTACK_RIGHT 4.24s, COUNTER_ATTACK 5.16s, CENTRAL_COMBO 4.58s, PATIENT_BUILDUP 5.08s, WING_ATTACK_LEFT 3.9s
- End reasons: possession_lost 74, invalidated 39
- Shots by active pattern: WING_ATTACK_RIGHT 2, CENTRAL_COMBO 2, COUNTER_ATTACK 2, WING_ATTACK_LEFT 3, NONE 1
- Goals by active pattern: (none)

## Role Positions (team-in-possession frames)
- Minnesota United:
  - LM: avgX 5.35, avg|Z| 7.22, avgDistToGoal 18.46 (205 samples); opp-half fwdX 21.19 (107); final-third |z| 6.07 (125)
  - RM: avgX 6.62, avg|Z| 11.82, avgDistToGoal 25.04 (248 samples); opp-half fwdX 17.94 (158); final-third |z| 11.4 (123)
  - ST: avgX 2.57, avg|Z| 6.53, avgDistToGoal 18.62 (124 samples); opp-half fwdX 16.01 (67); final-third |z| 5.51 (93)
- FC Dallas:
  - LM: avgX 6.14, avg|Z| 6.97, avgDistToGoal 17.4 (257 samples); opp-half fwdX 14.28 (101); final-third |z| 5.27 (160)
  - RM: avgX 4.83, avg|Z| 10.79, avgDistToGoal 17.65 (281 samples); opp-half fwdX 14.49 (110); final-third |z| 11.77 (194)
  - ST: avgX 4.35, avg|Z| 6.77, avgDistToGoal 17.55 (140 samples); opp-half fwdX 14.41 (53); final-third |z| 7.69 (107)

## Event Stream Review
- Event-stream shots: 10
- Event-stream on-target shots: 1
- Long-range on-target shots: 1
- Close-range bad-angle shots: 0
- On-target toe pokes: 0
- Attacker reset passes (BACK/WALL): 6

### Long-Range On-Target Shots
- Team B ST: 40', CURLED, 30.5y, angle 0.36, pressure 1

### Top Zigzag Offenders
- Team B CM Sebastian Lletget: flips 4, avg progress/flip 0.8, switch requests 9, blocked 9, facing mismatch 4%
- Team B ST Petar Musa: flips 4, avg progress/flip 0.55, switch requests 5, blocked 5, facing mismatch 17.1%
- Team B LM Patrickson Delgado: flips 4, avg progress/flip 3.02, switch requests 1, blocked 1, facing mismatch 10%
- Team A RM David Justin Taylor: flips 3, avg progress/flip 0.73, switch requests 1, blocked 1, facing mismatch 35.3%
- Team A CM Robin Lod: flips 2, avg progress/flip 0, switch requests 10, blocked 10, facing mismatch 12%
- Team A RM Jefferson Díaz: flips 2, avg progress/flip 0.6, switch requests 5, blocked 5, facing mismatch 6.1%
- Team B RM Don Deedson Louicius: flips 2, avg progress/flip 1, switch requests 1, blocked 1, facing mismatch 11.1%
- Team B CB Osaze Urhoghide: flips 2, avg progress/flip 0.4, switch requests 1, blocked 1, facing mismatch 0%

### Top Box Loiterers
- Team A RM Jefferson Díaz: max dwell 0.22s, max idle 0s, max camp 0s, crowded 30%
- Team B LM Anderson Julio: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team A LM Joaquín Pereyra: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team B LM Patrickson Delgado: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team A LM Joseph Rosales: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team B RM Paxton Pomykal: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team A ST Kelvin Yeboah: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team B ST Petar Musa: max dwell 0s, max idle 0s, max camp 0s, crowded 0%

## Suggested Improvements
- Final-third recycling is still too common. Tighten attacker backpass vetoes and extend the carry-or-shoot window before resets are allowed.
- Too much of the final action still comes through central roles. Encourage wider occupation and more wing-led creation before the finish.
- Some shots still lack second-wave support. Nudge nearby midfielders to arrive a little earlier into the edge-of-box support band.
- Carrier zigzagging is still present. Reduce repeated lateral sign flips by holding the current carry lane longer and tightening the link between desired heading, facing heading, and actual movement heading.
