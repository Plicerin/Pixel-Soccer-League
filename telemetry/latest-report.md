# Telemetry Analysis

## Match
- Fixture: DC United 2-0 San Jose Earthquakes
- Session: ft-1777651030793
- Timestamp: 2026-05-01T15:57:10.793Z
- Shots: 13-10
- Shots on target: 2-1

## Tuning KPIs
- Overall: 53.4 (red)
- Baseline Fit: 50 (red) — one-match MLS stat fit: goals ~2-3, shots ~26, SOT ~9, corners ~8, long-range SOT <=3
  - Inputs: goals 2, shots 23, SOT 3, long-range SOT 0, corners 4
- Soccer Structure: 69.1 (red) — soccer-like structure: width >=18, center+narrow <=35%, overload share >=25%, danger marking >=78%, shot corridor defenders >=1.2, empty-box shots <=35%, pattern touches >=2, real crosses >=5
  - Inputs: width 16.37/15.94, center+narrow worst 65.5%, overload share 28.9%, danger marked 60.9%, shot corridor defenders 5.3, empty-box shots 8.7%, pattern touches 2.09, real crosses 1
- Tuning Efficiency: 41 (red) — low-tweak debt: forced shots <=55%, final-third backpasses <=18, lateral flips <=90, direct-blocker passes <=70, broken rows <=10%
  - Inputs: forced shots 60.9%, final-third backpasses 12, zigzag flips 97, direct-blocker passes 0, broken shot rows 0%

## MLS Baseline Comparison
- Total goals: 2 vs 2.78 baseline (drift -0.78)
- Total shots: 23 vs 26.2 baseline (drift -3.2)
- Total shots on target: 3 vs 9.4 baseline (drift -6.4)
- Total corners: 4 vs 8 baseline (drift -4)

## Match Summary Telemetry
- Event count: 9259
- Pass log events: 131
- Carrier traces: 452
- Attacker zone traces: 443
- Shot decisions: 23
- Pass decisions: 116
- Interceptions: 5
- Turnovers: 2

## Decision Telemetry
- Forced shots: 14 of 23
- AI_SIMPLE broken rows: 0 of 9
- AI_SIMPLE forced broken rows: 0
- Long-range shot decisions: 19
- Pressured long-range shot decisions: 5
- Attacker final-third backpasses: 12
- Attacker in-box backpasses: 0
- Direct-blocker pass decisions: 0

## Movement / Facing
- Carrier traces analyzed: 452
- Carriers tracked: 19
- Forward-carry samples: 190
- Lateral direction flips: 97
- Avg forward progress per flip: 2.56
- Switch requests: 43
- Blocked switch requests: 43
- Carry lock samples: 246
- Facing vs movement mismatch: 25.8%
- Desired vs steer mismatch: 10%

## Box Behavior
- Box traces analyzed: 20
- Attackers tracked in box: 2

## Heat Map / Shape
- DC United: avg width 16.37, avg |avgZ| 1.26, center-locked 94.8%, center+narrow 65.5%
- San Jose Earthquakes: avg width 15.94, avg |avgZ| 1.38, center-locked 96.6%, center+narrow 65.5%
- DC United wide touches vs central touches: 12 vs 36
- San Jose Earthquakes wide touches vs central touches: 39 vs 30
- DC United wide shots vs central shots: 0 vs 13
- San Jose Earthquakes wide shots vs central shots: 1 vs 9
- Position owner samples: 4933
- DC United owner mix: PHASE_HOME:1443 | BOX_COVER:457 | STRUCTURED_ATTACK:158 | WIDE_HOME:44 | PATTERN_ROLE:331 | BOX_CRASH:35 | DANGER_MARK:58 | COLLAPSE_DEFEND:1
- San Jose Earthquakes owner mix: PHASE_HOME:1363 | WIDE_HOME:87 | STRUCTURED_ATTACK:279 | PATTERN_ROLE:283 | BOX_COVER:279 | DANGER_MARK:84 | BOX_CRASH:31
- DC United wide owner avg |z| 5.06, target |z| 8.63: PHASE_HOME:577 | BOX_COVER:187 | WIDE_HOME:44 | STRUCTURED_ATTACK:52 | PATTERN_ROLE:138 | DANGER_MARK:31 | BOX_CRASH:23 | COLLAPSE_DEFEND:1
- San Jose Earthquakes wide owner avg |z| 5.13, target |z| 10.28: WIDE_HOME:87 | STRUCTURED_ATTACK:73 | PATTERN_ROLE:101 | BOX_COVER:79 | PHASE_HOME:561 | DANGER_MARK:22 | BOX_CRASH:31

## Phase Time Distribution
- DC United: buildup 15.5% | progression 72.4% | chance 11% | finish 1.1% (181 samples)
- San Jose Earthquakes: buildup 8.1% | progression 81.2% | chance 10.7% | finish 0% (271 samples)

## Pass Decisions By Zone
- Evaluated: BUILDUP_CENTRAL:79 | FINAL_THIRD_CENTRAL:9 | BUILDUP_HALFSPACE:25 | BOX_CENTRAL:1 | FINAL_THIRD_HALFSPACE:2
- Executed (shouldPass): BUILDUP_CENTRAL:40 | FINAL_THIRD_CENTRAL:1 | BUILDUP_HALFSPACE:13 | BOX_CENTRAL:1

## Pattern Tempo (realism fit per pattern type)
- COUNTER_ATTACK (31x): touches 1.9 [TOO_FEW vs 2-4], pace 3.06u/s [TOO_SLOW vs 4-12u/s], duration 4.68s — expected fast direct
- PATIENT_BUILDUP (9x): touches 1.78 [TOO_FEW vs 3-7], pace -3.83u/s [TOO_SLOW vs 1-4u/s], duration 5.04s — expected deliberate
- WING_ATTACK_LEFT (10x): touches 2 [OK vs 2-4], pace 1.27u/s [TOO_SLOW vs 3-8u/s], duration 2.56s — expected quick deliver
- WING_ATTACK_RIGHT (13x): touches 3 [OK vs 2-4], pace 0.47u/s [TOO_SLOW vs 3-8u/s], duration 5.01s — expected quick deliver
- CENTRAL_COMBO (9x): touches 1.78 [TOO_FEW vs 2-4], pace -2.24u/s [TOO_SLOW vs 2.5-6u/s], duration 3.45s — expected short sharp

## Neo-Play Effectiveness
- Starts: 72; deliveries: 11; shot-producing deliveries: 5 (45.5%); goal-producing deliveries: 0 (0%)
- COUNTER_ATTACK: starts 31, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- PATIENT_BUILDUP: starts 9, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- WING_ATTACK_LEFT: starts 10, deliveries 1, crosses 0, effective 0/1 (0%), goals 0/1 (0%)
- WING_ATTACK_RIGHT: starts 13, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- GIVE_AND_GO: starts 9, deliveries 8, crosses 0, effective 5/8 (62.5%), goals 0/8 (0%)
- STRUCTURED_WING_ATTACK: starts 0, deliveries 2, crosses 2, effective 0/2 (0%), goals 0/2 (0%)

## Defenders In Box At Goal (defensive presence)
- Goals: 2, avg 5 defenders + 1 attackers in box at moment of goal
- Distribution: 4 defenders: 1 goals, 6 defenders: 1 goals
- Samples:
  - A Matti Peltola #8 @ 16': 4 defenders, 2 attackers (OPEN_PLAY)
  - A Caden Clark #11 @ 32': 6 defenders, 0 attackers (OPEN_PLAY)

## Shot Box Defense
- Shots sampled: 23
- Avg defenders in box: 4.74
- Avg defenders in goal corridor: 5.3
- Empty-box shots: 2
- Empty-corridor shots: 0
- Samples:
  - Team A Christian Benteke ST @ 38.7s: 4 box, 6 corridor defenders
  - Team A Matti Peltola CM @ 49s: 4 box, 5 corridor defenders
  - Team B Josef Martínez ST @ 55.8s: 6 box, 6 corridor defenders
  - Team B Josef Martínez ST @ 70.5s: 6 box, 8 corridor defenders
  - Team B Josef Martínez ST @ 74.6s: 5 box, 5 corridor defenders
  - Team A Christian Benteke ST @ 90.5s: 0 box, 1 corridor defenders
  - Team B Josef Martínez ST @ 97.5s: 4 box, 6 corridor defenders
  - Team A Caden Clark ST @ 102.6s: 6 box, 6 corridor defenders

## Final-Third Overloads (attacking commitment)
- DC United: 14/30 1s-windows had 3+ attackers in opp final third (max 4)
- San Jose Earthquakes: 3/27 1s-windows had 3+ attackers in opp final third (max 3)

## Danger-Zone Marking
- Samples: 69
- DC United attackers marked: 35/59 (59.3%), avg nearest defender 2.7
- San Jose Earthquakes attackers marked: 7/10 (70%), avg nearest defender 2.25
- Worst unmarked samples:
  - DC United Christian Benteke ST @ 209.2s: nearest defender 7.1, 18.4u from goal (RUNNER)
  - DC United Christian Benteke ST @ 41.8s: nearest defender 6.38, 17.9u from goal (RUNNER)
  - DC United Christian Benteke ST @ 44.3s: nearest defender 6.38, 17.9u from goal (RUNNER)
  - San Jose Earthquakes Josef Martínez ST @ 268.1s: nearest defender 4.42, 18.4u from goal (NEAR_POST_RUNNER)
  - San Jose Earthquakes Josef Martínez ST @ 227.4s: nearest defender 3.65, 18.2u from goal (NEAR_POST_RUNNER)
  - San Jose Earthquakes Josef Martínez ST @ 226.1s: nearest defender 3.21, 18.6u from goal (NEAR_POST_RUNNER)

## Multi-Touch Opp-Half Sequences (build-up quality)
- Sequences with 2+ distinct players touching ball in opp half: 30 of 49
- Opp-half touches total: 164
- Avg distinct players per possession: 2.22
- Examples:
  - Team A @ 6.6s: 11 touches by Christian Benteke → Aarón Herrera → Randall Leal → Caden Clark → Jared Stroud → Kye Rowles
  - Team B @ 20.3s: 17 touches by Josef Martínez → Noel Buck → Cristian Espinoza → Cristian Arango
  - Team A @ 34.7s: 10 touches by Caden Clark → Christian Benteke → ST → Kye Rowles → Lucas Bartlett → Aarón Herrera → Matti Peltola → CM
  - Team B @ 53.5s: 5 touches by Ian Harkes → Cristian Arango → Josef Martínez → ST
  - Team A @ 56.6s: 3 touches by Christian Benteke → Caden Clark
  - Team B @ 60.1s: 5 touches by Cristian Arango → Ian Harkes → Josef Martínez → ST

## Kickoff Receiver / Goal Correlation
- Kickoff passes recorded: 4; kickoff receives recorded: 4; scorer events: 2
- DC United: 0/2 goals scored by latest kickoff receiver (0%)
- San Jose Earthquakes: 0/0 goals scored by latest kickoff receiver (0%)
- DC United kickoff receivers: (none)
- San Jose Earthquakes kickoff receivers: Nick Lima RM recv:2 intended:2 goals:0 | Ian Harkes CM recv:2 intended:2 goals:0

## Pattern Engine (Phase 2.5)
- Total pattern starts: 72 (A 34, B 38)
- Distinct types per team: A 5, B 5
- Types A: COUNTER_ATTACK:17, PATIENT_BUILDUP:5, WING_ATTACK_LEFT:6, WING_ATTACK_RIGHT:3, CENTRAL_COMBO:3
- Types B: COUNTER_ATTACK:14, PATIENT_BUILDUP:4, WING_ATTACK_RIGHT:10, CENTRAL_COMBO:6, WING_ATTACK_LEFT:4
- Avg duration by type: COUNTER_ATTACK 4.62s, PATIENT_BUILDUP 2.84s, WING_ATTACK_LEFT 2.5s, WING_ATTACK_RIGHT 5.18s, CENTRAL_COMBO 4.21s
- End reasons: possession_lost 47, invalidated 23
- Shots by active pattern: COUNTER_ATTACK 6, WING_ATTACK_LEFT 5, WING_ATTACK_RIGHT 4, CENTRAL_COMBO 3, PATIENT_BUILDUP 4, NONE 1
- Goals by active pattern: WING_ATTACK_LEFT 1, COUNTER_ATTACK 1

## Role Positions (team-in-possession frames)
- DC United:
  - LM: avgX -1.71, avg|Z| 9.44, avgDistToGoal 21.89 (36 samples); opp-half fwdX 18.64 (13); final-third |z| 5.34 (17)
  - RM: avgX -1.16, avg|Z| 10.88, avgDistToGoal 25.11 (38 samples); opp-half fwdX 14.27 (16); final-third |z| 7.83 (17)
  - ST: avgX 1.97, avg|Z| 4.05, avgDistToGoal 22.27 (116 samples); opp-half fwdX 9.8 (74); final-third |z| 4.77 (49)
- San Jose Earthquakes:
  - LM: avgX -1.51, avg|Z| 8.73, avgDistToGoal 30.43 (79 samples); opp-half fwdX 9 (46); final-third |z| 7.27 (12)
  - RM: avgX 5.06, avg|Z| 10.19, avgDistToGoal 24.72 (85 samples); opp-half fwdX 5.11 (26); final-third |z| 8.23 (16)
  - ST: avgX -0.45, avg|Z| 3.12, avgDistToGoal 24.19 (89 samples); opp-half fwdX 8.06 (50); final-third |z| 2.17 (19)

## Event Stream Review
- Event-stream shots: 23
- Event-stream on-target shots: 3
- Long-range on-target shots: 0
- Close-range bad-angle shots: 0
- On-target toe pokes: 0
- Attacker reset passes (BACK/WALL): 24

### Top Zigzag Offenders
- Team B LM Noel Buck: flips 16, avg progress/flip 1.4, switch requests 1, blocked 1, facing mismatch 19.4%
- Team A ST Christian Benteke: flips 14, avg progress/flip 2.44, switch requests 10, blocked 10, facing mismatch 20.5%
- Team B RM Cristian Espinoza: flips 14, avg progress/flip 2.69, switch requests 2, blocked 2, facing mismatch 34.1%
- Team B ST Josef Martínez: flips 12, avg progress/flip 1.61, switch requests 14, blocked 14, facing mismatch 31.9%
- Team B LM Cristian Arango: flips 10, avg progress/flip 1.16, switch requests 0, blocked 0, facing mismatch 39.4%
- Team B RM Nick Lima: flips 10, avg progress/flip 3.48, switch requests 0, blocked 0, facing mismatch 19.2%
- Team A ST Caden Clark: flips 4, avg progress/flip 1.52, switch requests 4, blocked 4, facing mismatch 30.3%
- Team A LB Kye Rowles: flips 4, avg progress/flip 7.52, switch requests 2, blocked 2, facing mismatch 35.3%

### Top Box Loiterers
- Team A LM Randall Leal: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team A RM Jared Stroud: max dwell 0s, max idle 0s, max camp 0s, crowded 0%

## Suggested Improvements
- Final-third recycling is still too common. Tighten attacker backpass vetoes and extend the carry-or-shoot window before resets are allowed.
- Shape is still too central. Strengthen weak-side width anchors and reduce carrier-gravity pull on wide roles and midfield support.
- Danger-zone attackers are still too often unmarked. Tighten goal-side marking assignments for box, cutback, and far-post runners without pulling the ball presser out of shape.
- Too much of the final action still comes through central roles. Encourage wider occupation and more wing-led creation before the finish.
- Some shots still lack second-wave support. Nudge nearby midfielders to arrive a little earlier into the edge-of-box support band.
- Carrier zigzagging is still present. Reduce repeated lateral sign flips by holding the current carry lane longer and tightening the link between desired heading, facing heading, and actual movement heading.
