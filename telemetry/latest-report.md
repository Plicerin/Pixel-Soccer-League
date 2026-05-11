# Telemetry Analysis

## Match
- Fixture: Inter Miami 1-0 Minnesota United
- Session: headless-report:sim8-corner-fix.json:1
- Timestamp: 2026-05-10T08:07:01.009Z
- Shots: 2-2
- Shots on target: 1-1

## Tuning KPIs
- Overall: 59.7 (red)
- Baseline Fit: 18.7 (red) — one-match MLS stat fit: goals ~2-3, shots ~26, SOT ~9, corners ~8, long-range SOT <=3
  - Inputs: goals 1, shots 4, SOT 2, long-range SOT 1, corners 13
- Soccer Structure: 85.6 (green) — soccer-like structure: width >=18, center+narrow <=35%, overload share >=25%, danger marking >=78%, shot corridor defenders >=1.2, empty-box shots <=35%, pattern touches >=2, real crosses >=5
  - Inputs: width 28.69/28.81, center+narrow worst 3.4%, overload share 75.6%, danger marked 65.8%, shot corridor defenders 1.5, empty-box shots 50%, pattern touches 1.65, real crosses 10
- Tuning Efficiency: 74.9 (watch) — low-tweak debt: forced shots <=55%, final-third backpasses <=18, lateral flips <=90, direct-blocker passes <=70, broken rows <=10%
  - Inputs: forced shots 50%, final-third backpasses 0, zigzag flips 12, direct-blocker passes 0, broken shot rows 0%

## MLS Baseline Comparison
- Total goals: 1 vs 2.78 baseline (drift -1.78)
- Total shots: 4 vs 26.2 baseline (drift -22.2)
- Total shots on target: 2 vs 9.4 baseline (drift -7.4)
- Total corners: 13 vs 8 baseline (drift 5)

## Match Summary Telemetry
- Event count: 15209
- Pass log events: 119
- Carrier traces: 175
- Attacker zone traces: 598
- Shot decisions: 4
- Pass decisions: 0
- Interceptions: 17
- Turnovers: 17
- Keeper saves: 1-0
- Restart counters: corners 0, throw-ins 0, goal kicks 0, free kicks 0

## Decision Telemetry
- Forced shots: 2 of 4
- AI_SIMPLE broken rows: 0 of 1
- AI_SIMPLE forced broken rows: 0
- Long-range shot decisions: 2
- Pressured long-range shot decisions: 2
- Attacker final-third backpasses: 0
- Attacker in-box backpasses: 0
- Direct-blocker pass decisions: 0

## Movement / Facing
- Carrier traces analyzed: 175
- Carriers tracked: 20
- Forward-carry samples: 36
- Lateral direction flips: 12
- Avg forward progress per flip: 0.88
- Switch requests: 51
- Blocked switch requests: 51
- Carry lock samples: 0
- Facing vs movement mismatch: 9.2%
- Desired vs steer mismatch: 25.1%

## Box Behavior
- Box traces analyzed: 69
- Attackers tracked in box: 7

## Heat Map / Shape
- Inter Miami: avg width 28.69, avg |avgZ| 2.72, center-locked 62.1%, center+narrow 3.4%
- Minnesota United: avg width 28.81, avg |avgZ| 3.05, center-locked 55.2%, center+narrow 3.4%
- Inter Miami wide touches vs central touches: 0 vs 0
- Minnesota United wide touches vs central touches: 0 vs 0
- Inter Miami wide shots vs central shots: 0 vs 0
- Minnesota United wide shots vs central shots: 0 vs 0
- Position owner samples: 5579
- Inter Miami owner mix: STRUCTURED_ATTACK:319 | WIDE_HOME:758 | PHASE_HOME:1054 | DANGER_MARK:271 | PATTERN_ROLE:289 | BOX_COVER:73 | BOX_CRASH:26 | COLLAPSE_DEFEND:2
- Minnesota United owner mix: BOX_COVER:111 | WIDE_HOME:793 | PHASE_HOME:1052 | STRUCTURED_ATTACK:279 | BOX_CRASH:61 | PATTERN_ROLE:321 | DANGER_MARK:153 | COLLAPSE_DEFEND:17
- Inter Miami wide owner avg |z| 10.98, target |z| 17.32: STRUCTURED_ATTACK:78 | WIDE_HOME:758 | DANGER_MARK:97 | PATTERN_ROLE:129 | BOX_COVER:22 | BOX_CRASH:26 | COLLAPSE_DEFEND:1
- Minnesota United wide owner avg |z| 10.28, target |z| 17.55: WIDE_HOME:793 | BOX_COVER:56 | STRUCTURED_ATTACK:73 | BOX_CRASH:61 | PATTERN_ROLE:137 | DANGER_MARK:23

## Phase Time Distribution
- Inter Miami: buildup 36% | progression 32.6% | chance 23.3% | finish 8.1% (86 samples)
- Minnesota United: buildup 30.3% | progression 44.9% | chance 20.2% | finish 4.5% (89 samples)

## Pass Decisions By Zone
- Evaluated: 
- Executed (shouldPass): 

## Pattern Tempo (realism fit per pattern type)
- CENTRAL_COMBO (7x): touches 2 [OK vs 2-4], pace -5.09u/s [TOO_SLOW vs 2.5-6u/s], duration 3.66s — expected short sharp
- COUNTER_ATTACK (29x): touches 1.41 [TOO_FEW vs 2-4], pace -2.42u/s [TOO_SLOW vs 4-12u/s], duration 3.77s — expected fast direct
- WING_ATTACK_LEFT (10x): touches 1.5 [TOO_FEW vs 2-4], pace 1.15u/s [TOO_SLOW vs 3-8u/s], duration 4.49s — expected quick deliver
- WING_ATTACK_RIGHT (9x): touches 1.78 [TOO_FEW vs 2-4], pace -5.17u/s [TOO_SLOW vs 3-8u/s], duration 3.14s — expected quick deliver
- PATIENT_BUILDUP (11x): touches 1.55 [TOO_FEW vs 3-7], pace 1.94u/s [OK vs 1-4u/s], duration 3.32s — expected deliberate

## Neo-Play Effectiveness
- Starts: 66; deliveries: 21; shot-producing deliveries: 2 (9.5%); goal-producing deliveries: 0 (0%)
- GIVE_AND_GO: starts 7, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- COUNTER_ATTACK: starts 29, deliveries 4, crosses 4, effective 0/4 (0%), goals 0/4 (0%)
- WING_ATTACK_RIGHT: starts 9, deliveries 9, crosses 8, effective 0/9 (0%), goals 0/9 (0%)
- WING_ATTACK_LEFT: starts 10, deliveries 8, crosses 8, effective 2/8 (25%), goals 0/8 (0%)
- PATIENT_BUILDUP: starts 11, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)

## Defenders In Box At Goal (defensive presence)
- Goals: 1, avg 3 defenders + 1 attackers in box at moment of goal
- Distribution: 3 defenders: 1 goals
- Samples:
  - A Jordi Alba Ramos #3 @ 65': 3 defenders, 1 attackers (OPEN_PLAY)

## Shot Box Defense
- Shots sampled: 4
- Avg defenders in box: 1.75
- Avg defenders in goal corridor: 1.5
- Empty-box shots: 2
- Empty-corridor shots: 2
- Samples:
  - Team B Kelvin Yeboah ST @ 9.7s: 4 box, 4 corridor defenders
  - Team A Luis Suárez CM @ 35.9s: 0 box, 0 corridor defenders
  - Team A Jordi Alba Ramos CB @ 211.6s: 3 box, 2 corridor defenders
  - Team B Kelvin Yeboah ST @ 240.8s: 0 box, 0 corridor defenders

## Final-Third Overloads (attacking commitment)
- Inter Miami: 34/49 1s-windows had 3+ attackers in opp final third (max 3)
- Minnesota United: 45/55 1s-windows had 3+ attackers in opp final third (max 5)

## Danger-Zone Marking
- Samples: 292
- Inter Miami attackers marked: 68/106 (64.2%), avg nearest defender 3.52
- Minnesota United attackers marked: 124/186 (66.7%), avg nearest defender 2.88
- Worst unmarked samples:
  - Inter Miami Tadeo Allende RM @ 33.1s: nearest defender 19.14, 12.4u from goal (FAR_POST_RUNNER)
  - Inter Miami Tadeo Allende RM @ 35s: nearest defender 17.37, 13.3u from goal (FAR_POST_RUNNER)
  - Inter Miami Tadeo Allende RM @ 35.7s: nearest defender 16.4, 9.9u from goal (FAR_POST_RUNNER)
  - Minnesota United Joseph Rosales LM @ 253.5s: nearest defender 16.84, 6.8u from goal (NONE)
  - Minnesota United Joseph Rosales LM @ 252.7s: nearest defender 15.52, 6.8u from goal (NONE)
  - Minnesota United Joseph Rosales LM @ 252s: nearest defender 14.53, 6.8u from goal (NONE)

## Multi-Touch Opp-Half Sequences (build-up quality)
- Sequences with 2+ distinct players touching ball in opp half: 31 of 67
- Opp-half touches total: 125
- Avg distinct players per possession: 1.39
- Examples:
  - Team B @ 9.6s: 3 touches by Joaquín Pereyra → Kelvin Yeboah → ST
  - Team B @ 15.6s: 4 touches by Ho Yeon Jung → Robin Lod → Julian Gressel
  - Team B @ 20.8s: 3 touches by Bongokuhle Hlongwane → Jefferson Díaz
  - Team A @ 32.9s: 5 touches by Fabrice-Jean Picault → Lionel Messi → Luis Suárez → CM
  - Team A @ 46.5s: 4 touches by Lionel Messi → Rodrigo De Paul → Luis Suárez
  - Team A @ 52.5s: 6 touches by Sergio Busquets Burgos → Lionel Messi → Luis Suárez → Rodrigo De Paul

## Kickoff Receiver / Goal Correlation
- Kickoff passes recorded: 3; kickoff receives recorded: 3; scorer events: 1
- Inter Miami: 0/1 goals scored by latest kickoff receiver (0%)
- Minnesota United: 0/0 goals scored by latest kickoff receiver (0%)
- Inter Miami kickoff receivers: Fabrice-Jean Picault ST recv:1 intended:1 goals:0
- Minnesota United kickoff receivers: Kelvin Yeboah ST recv:2 intended:2 goals:0
- Samples:
  - Inter Miami goal Jordi Alba Ramos @ 65': latest kickoff receiver Fabrice-Jean Picault, same=false, 212.41s later

## Pattern Engine (Phase 2.5)
- Total pattern starts: 66 (A 31, B 35)
- Distinct types per team: A 5, B 5
- Types A: CENTRAL_COMBO:2, COUNTER_ATTACK:15, WING_ATTACK_LEFT:4, WING_ATTACK_RIGHT:5, PATIENT_BUILDUP:5
- Types B: CENTRAL_COMBO:5, WING_ATTACK_RIGHT:4, WING_ATTACK_LEFT:6, PATIENT_BUILDUP:6, COUNTER_ATTACK:14
- Avg duration by type: PATIENT_BUILDUP -20.06s, CENTRAL_COMBO 3.09s, COUNTER_ATTACK 5.19s, WING_ATTACK_RIGHT 4.67s, WING_ATTACK_LEFT 4.51s
- End reasons: possession_lost 48, invalidated 17
- Shots by active pattern: CENTRAL_COMBO 1, WING_ATTACK_LEFT 1, WING_ATTACK_RIGHT 1, COUNTER_ATTACK 1
- Goals by active pattern: WING_ATTACK_RIGHT 1

## Role Positions (team-in-possession frames)
- Inter Miami:
  - LM: avgX -0.63, avg|Z| 13.85, avgDistToGoal 16.34 (72 samples); opp-half fwdX 19.85 (32); final-third |z| 13.6 (50)
  - RM: avgX -1.16, avg|Z| 12.82, avgDistToGoal 19.57 (74 samples); opp-half fwdX 14.35 (33); final-third |z| 12.88 (47)
  - ST: avgX -0.39, avg|Z| 5.24, avgDistToGoal 16.94 (68 samples); opp-half fwdX 16.43 (32); final-third |z| 5.87 (52)
- Minnesota United:
  - LM: avgX -5.33, avg|Z| 8.95, avgDistToGoal 17.22 (147 samples); opp-half fwdX 16.89 (94); final-third |z| 8 (106)
  - RM: avgX -3.83, avg|Z| 11.77, avgDistToGoal 20.44 (163 samples); opp-half fwdX 14.05 (103); final-third |z| 10.58 (105)
  - ST: avgX -3.3, avg|Z| 5.62, avgDistToGoal 15.72 (74 samples); opp-half fwdX 19.34 (39); final-third |z| 6.07 (59)

## Event Stream Review
- Event-stream shots: 4
- Event-stream on-target shots: 2
- Long-range on-target shots: 1
- Close-range bad-angle shots: 0
- On-target toe pokes: 0
- Attacker reset passes (BACK/WALL): 6

### Long-Range On-Target Shots
- Team B ST: 44', CURLED, 28.3y, angle 0.3, pressure 2

### Top Zigzag Offenders
- Team B CM Julian Gressel: flips 2, avg progress/flip 2.1, switch requests 9, blocked 9, facing mismatch 11.8%
- Team B ST Kelvin Yeboah: flips 2, avg progress/flip 0.8, switch requests 5, blocked 5, facing mismatch 0%
- Team A CM Luis Suárez: flips 1, avg progress/flip 3, switch requests 13, blocked 13, facing mismatch 8.3%
- Team A LB Sergio Busquets Burgos: flips 1, avg progress/flip 0.9, switch requests 3, blocked 3, facing mismatch 21.4%
- Team B CM Robin Lod: flips 1, avg progress/flip 0.9, switch requests 3, blocked 3, facing mismatch 13.3%
- Team B RM Jefferson Díaz: flips 1, avg progress/flip 0, switch requests 2, blocked 2, facing mismatch 0%
- Team A LM Lionel Messi: flips 1, avg progress/flip 0, switch requests 1, blocked 1, facing mismatch 25%
- Team A RM Tadeo Allende: flips 1, avg progress/flip 0, switch requests 1, blocked 1, facing mismatch 0%

### Top Box Loiterers
- Team B LM Joaquín Pereyra: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team B ST Kelvin Yeboah: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team A ST Fabrice-Jean Picault: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team B LM Joseph Rosales: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team A LM Lionel Messi: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team A RM Tadeo Allende: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team B RM Jefferson Díaz: max dwell 0s, max idle 0s, max camp 0s, crowded 0%

## Suggested Improvements
- Final-third recycling is still too common. Tighten attacker backpass vetoes and extend the carry-or-shoot window before resets are allowed.
- Danger-zone attackers are still too often unmarked. Tighten goal-side marking assignments for box, cutback, and far-post runners without pulling the ball presser out of shape.
- Too many shots are arriving with an empty defensive box. Keep one presser, but pull two non-pressing defenders into the goal corridor when the carrier reaches shooting range.
- Too much of the final action still comes through central roles. Encourage wider occupation and more wing-led creation before the finish.
- Carrier zigzagging is still present. Reduce repeated lateral sign flips by holding the current carry lane longer and tightening the link between desired heading, facing heading, and actual movement heading.
