# Telemetry Analysis

## Match
- Fixture: Nashville SC 0-0 St. Louis City SC
- Session: headless-report:nashville-stl-boxdef-2.json:0
- Timestamp: 2026-05-03T12:22:14.021Z
- Shots: 2-1
- Shots on target: 1-0

## Tuning KPIs
- Overall: 46 (red)
- Baseline Fit: 16 (red) — one-match MLS stat fit: goals ~2-3, shots ~26, SOT ~9, corners ~8, long-range SOT <=3
  - Inputs: goals 0, shots 3, SOT 1, long-range SOT 0, corners 1
- Soccer Structure: 46.9 (red) — soccer-like structure: width >=18, center+narrow <=35%, overload share >=25%, danger marking >=78%, shot corridor defenders >=1.2, empty-box shots <=35%, pattern touches >=2, real crosses >=5
  - Inputs: width 14.64/18.58, center+narrow worst 50%, overload share 0%, danger marked 0%, shot corridor defenders 1, empty-box shots 66.7%, pattern touches 1.67, real crosses 6
- Tuning Efficiency: 75 (watch) — low-tweak debt: forced shots <=55%, final-third backpasses <=18, lateral flips <=90, direct-blocker passes <=70, broken rows <=10%
  - Inputs: forced shots 66.7%, final-third backpasses 0, zigzag flips 0, direct-blocker passes 0, broken shot rows 0%

## MLS Baseline Comparison
- Total goals: 0 vs 2.78 baseline (drift -2.78)
- Total shots: 3 vs 26.2 baseline (drift -23.2)
- Total shots on target: 1 vs 9.4 baseline (drift -8.4)
- Total corners: 1 vs 8 baseline (drift -7)

## Match Summary Telemetry
- Event count: 3476
- Pass log events: 114
- Carrier traces: 205
- Attacker zone traces: 507
- Shot decisions: 3
- Pass decisions: 75
- Interceptions: 0
- Turnovers: 16

## Decision Telemetry
- Forced shots: 2 of 3
- AI_SIMPLE broken rows: 0 of 0
- AI_SIMPLE forced broken rows: 0
- Long-range shot decisions: 2
- Pressured long-range shot decisions: 2
- Attacker final-third backpasses: 0
- Attacker in-box backpasses: 0
- Direct-blocker pass decisions: 0

## Movement / Facing
- Carrier traces analyzed: 205
- Carriers tracked: 19
- Forward-carry samples: 0
- Lateral direction flips: 0
- Avg forward progress per flip: 0
- Switch requests: 0
- Blocked switch requests: 0
- Carry lock samples: 0
- Facing vs movement mismatch: 0%
- Desired vs steer mismatch: 0%

## Box Behavior
- Box traces analyzed: 0
- Attackers tracked in box: 0

## Heat Map / Shape
- Nashville SC: avg width 14.64, avg |avgZ| 2.49, center-locked 68.2%, center+narrow 50%
- St. Louis City SC: avg width 18.58, avg |avgZ| 1.25, center-locked 95.5%, center+narrow 36.4%
- Nashville SC wide touches vs central touches: 0 vs 0
- St. Louis City SC wide touches vs central touches: 0 vs 0
- Nashville SC wide shots vs central shots: 0 vs 0
- St. Louis City SC wide shots vs central shots: 0 vs 0
- Position owner samples: 2420
- Nashville SC owner mix: ROLE_SLOT:768 | WIDE_HOME:297 | CARRIER:25 | STRUCTURED_ATTACK:120
- St. Louis City SC owner mix: ROLE_SLOT:575 | WIDE_HOME:378 | CARRIER:47 | STRUCTURED_ATTACK:210
- Nashville SC wide owner avg |z| 5.1, target |z| 4.71: ROLE_SLOT:326 | WIDE_HOME:105 | STRUCTURED_ATTACK:49 | CARRIER:4
- St. Louis City SC wide owner avg |z| 7.94, target |z| 7.59: ROLE_SLOT:74 | WIDE_HOME:147 | STRUCTURED_ATTACK:17 | CARRIER:4

## Phase Time Distribution
- Nashville SC: buildup 11.5% | progression 82.1% | chance 5.1% | finish 1.3% (78 samples)
- St. Louis City SC: buildup 2.4% | progression 91.3% | chance 6.3% | finish 0% (127 samples)

## Pass Decisions By Zone
- Evaluated: BUILDUP_HALFSPACE:31 | BUILDUP_CENTRAL:30 | FINAL_THIRD_HALFSPACE:2 | BUILDUP_WIDE:12
- Executed (shouldPass): BUILDUP_HALFSPACE:31 | BUILDUP_CENTRAL:30 | FINAL_THIRD_HALFSPACE:2 | BUILDUP_WIDE:12

## Pattern Tempo (realism fit per pattern type)
- CENTRAL_COMBO (23x): touches 2.04 [OK vs 2-4], pace -0.15u/s [TOO_SLOW vs 2.5-6u/s], duration 6.17s — expected short sharp
- GIVE_AND_GO (4x): touches 2.25 [n/a vs n/a], pace -0.07u/s [n/a vs n/a], duration 38.75s 
- WING_ATTACK_LEFT (5x): touches 0.4 [TOO_FEW vs 2-4], pace nullu/s [no_multi_touch_data vs 3-8u/s], duration 0s — expected quick deliver
- WING_ATTACK_RIGHT (2x): touches 2 [OK vs 2-4], pace 0.11u/s [TOO_SLOW vs 3-8u/s], duration 2.75s — expected quick deliver

## Neo-Play Effectiveness
- Starts: 34; deliveries: 12; shot-producing deliveries: 0 (0%); goal-producing deliveries: 0 (0%)
- GIVE_AND_GO: starts 27, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- WING_ATTACK_LEFT: starts 5, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- WING_ATTACK_RIGHT: starts 2, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- ORCH_DIRECT: starts 0, deliveries 12, crosses 12, effective 0/12 (0%), goals 0/12 (0%)

## Defenders In Box At Goal (defensive presence)
- Goals: 0, avg 0 defenders + 0 attackers in box at moment of goal
- Distribution: (none)

## Shot Box Defense
- Shots sampled: 3
- Avg defenders in box: 0.67
- Avg defenders in goal corridor: 1
- Empty-box shots: 2
- Empty-corridor shots: 2
- Samples:
  - Team A Bryan Acosta CM @ 46.6s: 0 box, 0 corridor defenders
  - Team A Bryan Acosta CM @ 46.7s: 0 box, 0 corridor defenders
  - Team B Marcel Hartel LM @ 205.7s: 2 box, 3 corridor defenders

## Final-Third Overloads (attacking commitment)
- Nashville SC: 0/1 1s-windows had 3+ attackers in opp final third (max 1)
- St. Louis City SC: 0/6 1s-windows had 3+ attackers in opp final third (max 1)

## Danger-Zone Marking
- Samples: 1
- Nashville SC attackers marked: 0/1 (0%), avg nearest defender 7.32
- St. Louis City SC attackers marked: 0/0 (0%), avg nearest defender 0
- Worst unmarked samples:
  - Nashville SC Sam Surridge ST @ 59.9s: nearest defender 7.32, 18.6u from goal (SUPPORT)

## Multi-Touch Opp-Half Sequences (build-up quality)
- Sequences with 2+ distinct players touching ball in opp half: 10 of 16
- Opp-half touches total: 102
- Avg distinct players per possession: 2.88
- Examples:
  - Team B @ 0.0s: 20 touches by Sang Bin Jeong → TEAM → Henry Kessler → Timo Baumgartl → Cedric Teuchert → Marcel Hartel
  - Team A @ 37.9s: 7 touches by Tyler Boyd → Jacob Shaffelburg → Bryan Acosta → CM
  - Team A @ 55.5s: 8 touches by Andy Najar → Hany Mukhtar → Jacob Shaffelburg → Bryan Acosta
  - Team B @ 150.9s: 26 touches by Sang Bin Jeong → João Klauss de Mello → TEAM → Eduard Löwen → Cedric Teuchert → Henry Kessler → Timo Baumgartl → Conrad Wallem
  - Team A @ 171.9s: 3 touches by TEAM → Bryan Acosta
  - Team A @ 174.2s: 3 touches by TEAM → Tyler Boyd

## Kickoff Receiver / Goal Correlation
- Kickoff passes recorded: 1; kickoff receives recorded: 2; scorer events: 0
- Nashville SC: 0/0 goals scored by latest kickoff receiver (0%)
- St. Louis City SC: 0/0 goals scored by latest kickoff receiver (0%)
- Nashville SC kickoff receivers: (none)
- St. Louis City SC kickoff receivers: Sang Bin Jeong ST recv:1 intended:1 goals:0 | Eduard Löwen CB recv:1 intended:0 goals:0

## Pattern Engine (Phase 2.5)
- Total pattern starts: 34 (A 18, B 16)
- Distinct types per team: A 4, B 3
- Types A: CENTRAL_COMBO:11, GIVE_AND_GO:2, WING_ATTACK_LEFT:3, WING_ATTACK_RIGHT:2
- Types B: CENTRAL_COMBO:12, WING_ATTACK_LEFT:2, GIVE_AND_GO:2
- Avg duration by type: CENTRAL_COMBO 2.14s, WING_ATTACK_LEFT 0.52s, GIVE_AND_GO 1.53s, WING_ATTACK_RIGHT 0.39s
- End reasons: intent_changed 24, possession_lost 9
- Shots by active pattern: GIVE_AND_GO 3
- Goals by active pattern: (none)

## Role Positions (team-in-possession frames)
- Nashville SC:
  - ST: avgX 1.44, avg|Z| 4.68, avgDistToGoal 38.25 (169 samples); opp-half fwdX 7.32 (103); final-third |z| 12.01 (1)
- St. Louis City SC:
  - ST: avgX 1.38, avg|Z| 2.2, avgDistToGoal 32.34 (338 samples); opp-half fwdX 4.59 (121); final-third |z| 2.32 (8)

## Event Stream Review
- Event-stream shots: 3
- Event-stream on-target shots: 0
- Long-range on-target shots: 0
- Close-range bad-angle shots: 0
- On-target toe pokes: 0
- Attacker reset passes (BACK/WALL): 4

### Top Zigzag Offenders
- Team B CB Conrad Wallem: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B CM Alfredo Morales: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A CB Andy Najar: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A CB Walker Zimmerman: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B CM Cedric Teuchert: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B CB Henry Kessler: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A CM Bryan Acosta: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B ST Sang Bin Jeong: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%

## Suggested Improvements
- Shape is still too central. Strengthen weak-side width anchors and reduce carrier-gravity pull on wide roles and midfield support.
- Danger-zone attackers are still too often unmarked. Tighten goal-side marking assignments for box, cutback, and far-post runners without pulling the ball presser out of shape.
- Too many shots are arriving with an empty defensive box. Keep one presser, but pull two non-pressing defenders into the goal corridor when the carrier reaches shooting range.
- Too much of the final action still comes through central roles. Encourage wider occupation and more wing-led creation before the finish.
- Corner volume is still unrealistically low. Review deflection, blocked-shot, and out-of-play logic so wider attacks can produce restarts naturally.
