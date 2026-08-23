# Telemetry Analysis

## Match
- Fixture: Nashville SC 0-0 St. Louis City SC
- Session: headless-report:nashville-stl-batch10.json:9
- Timestamp: 2026-05-03T07:11:10.312Z
- Shots: 4-1
- Shots on target: 0-0

## Tuning KPIs
- Overall: 46.7 (red)
- Baseline Fit: 16 (red) — one-match MLS stat fit: goals ~2-3, shots ~26, SOT ~9, corners ~8, long-range SOT <=3
  - Inputs: goals 0, shots 5, SOT 0, long-range SOT 0, corners 0
- Soccer Structure: 49.1 (red) — soccer-like structure: width >=18, center+narrow <=35%, overload share >=25%, danger marking >=78%, shot corridor defenders >=1.2, empty-box shots <=35%, pattern touches >=2, real crosses >=5
  - Inputs: width 16.38/15.62, center+narrow worst 59.1%, overload share 0%, danger marked 100%, shot corridor defenders 0, empty-box shots 100%, pattern touches 1.82, real crosses 0
- Tuning Efficiency: 75 (watch) — low-tweak debt: forced shots <=55%, final-third backpasses <=18, lateral flips <=90, direct-blocker passes <=70, broken rows <=10%
  - Inputs: forced shots 100%, final-third backpasses 0, zigzag flips 0, direct-blocker passes 0, broken shot rows 0%

## MLS Baseline Comparison
- Total goals: 0 vs 2.78 baseline (drift -2.78)
- Total shots: 5 vs 26.2 baseline (drift -21.2)
- Total shots on target: 0 vs 9.4 baseline (drift -9.4)
- Total corners: 0 vs 8 baseline (drift -8)

## Match Summary Telemetry
- Event count: 3309
- Pass log events: 113
- Carrier traces: 222
- Attacker zone traces: 336
- Shot decisions: 5
- Pass decisions: 78
- Interceptions: 0
- Turnovers: 18

## Decision Telemetry
- Forced shots: 5 of 5
- AI_SIMPLE broken rows: 0 of 0
- AI_SIMPLE forced broken rows: 0
- Long-range shot decisions: 5
- Pressured long-range shot decisions: 5
- Attacker final-third backpasses: 0
- Attacker in-box backpasses: 0
- Direct-blocker pass decisions: 0

## Movement / Facing
- Carrier traces analyzed: 222
- Carriers tracked: 20
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
- Nashville SC: avg width 16.38, avg |avgZ| 1.15, center-locked 90.9%, center+narrow 54.5%
- St. Louis City SC: avg width 15.62, avg |avgZ| 1.59, center-locked 81.8%, center+narrow 59.1%
- Nashville SC wide touches vs central touches: 0 vs 0
- St. Louis City SC wide touches vs central touches: 0 vs 0
- Nashville SC wide shots vs central shots: 0 vs 0
- St. Louis City SC wide shots vs central shots: 0 vs 0
- Position owner samples: 2400
- Nashville SC owner mix: ROLE_SLOT:578 | WIDE_HOME:328 | STRUCTURED_ATTACK:249 | CARRIER:45
- St. Louis City SC owner mix: STRUCTURED_ATTACK:178 | CARRIER:35 | WIDE_HOME:356 | ROLE_SLOT:631
- Nashville SC wide owner avg |z| 6, target |z| 6.09: ROLE_SLOT:230 | WIDE_HOME:141 | STRUCTURED_ATTACK:82 | CARRIER:27
- St. Louis City SC wide owner avg |z| 5.75, target |z| 5.51: STRUCTURED_ATTACK:79 | WIDE_HOME:138 | ROLE_SLOT:253 | CARRIER:10

## Phase Time Distribution
- Nashville SC: buildup 0% | progression 89% | chance 11% | finish 0% (127 samples)
- St. Louis City SC: buildup 2.1% | progression 97.9% | chance 0% | finish 0% (95 samples)

## Pass Decisions By Zone
- Evaluated: BUILDUP_CENTRAL:17 | BUILDUP_HALFSPACE:58 | FINAL_THIRD_CENTRAL:1 | FINAL_THIRD_HALFSPACE:2
- Executed (shouldPass): BUILDUP_CENTRAL:17 | BUILDUP_HALFSPACE:58 | FINAL_THIRD_CENTRAL:1 | FINAL_THIRD_HALFSPACE:2

## Pattern Tempo (realism fit per pattern type)
- CENTRAL_COMBO (25x): touches 1.2 [TOO_FEW vs 2-4], pace -0.62u/s [TOO_SLOW vs 2.5-6u/s], duration 1.67s — expected short sharp
- GIVE_AND_GO (3x): touches 2.67 [n/a vs n/a], pace -2.4u/s [n/a vs n/a], duration 1.54s 
- WING_ATTACK_RIGHT (5x): touches 3.2 [OK vs 2-4], pace -0.53u/s [TOO_SLOW vs 3-8u/s], duration 14.15s — expected quick deliver
- WING_ATTACK_LEFT (5x): touches 0.2 [TOO_FEW vs 2-4], pace nullu/s [no_multi_touch_data vs 3-8u/s], duration 0s — expected quick deliver

## Neo-Play Effectiveness
- Starts: 38; deliveries: 0; shot-producing deliveries: 0 (0%); goal-producing deliveries: 0 (0%)
- WING_ATTACK_LEFT: starts 5, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- GIVE_AND_GO: starts 28, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- WING_ATTACK_RIGHT: starts 5, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)

## Defenders In Box At Goal (defensive presence)
- Goals: 0, avg 0 defenders + 0 attackers in box at moment of goal
- Distribution: (none)

## Shot Box Defense
- Shots sampled: 5
- Avg defenders in box: 0
- Avg defenders in goal corridor: 0
- Empty-box shots: 5
- Empty-corridor shots: 5
- Samples:
  - Team B João Klauss de Mello ST @ 8.1s: 0 box, 0 corridor defenders
  - Team A Edvard Tagseth CM @ 33.4s: 0 box, 0 corridor defenders
  - Team A Edvard Tagseth CM @ 34.6s: 0 box, 0 corridor defenders
  - Team A Edvard Tagseth CM @ 35.8s: 0 box, 0 corridor defenders
  - Team A Sam Surridge ST @ 162.2s: 0 box, 0 corridor defenders

## Final-Third Overloads (attacking commitment)
- Nashville SC: 0/4 1s-windows had 3+ attackers in opp final third (max 1)
- St. Louis City SC: 0/8 1s-windows had 3+ attackers in opp final third (max 1)

## Danger-Zone Marking
- Samples: 1
- Nashville SC attackers marked: 1/1 (100%), avg nearest defender 0.63
- St. Louis City SC attackers marked: 0/0 (0%), avg nearest defender 0

## Multi-Touch Opp-Half Sequences (build-up quality)
- Sequences with 2+ distinct players touching ball in opp half: 15 of 19
- Opp-half touches total: 131
- Avg distinct players per possession: 3
- Examples:
  - Team B @ 0.0s: 13 touches by Chris Durkin → João Klauss de Mello → Marcel Hartel → ST
  - Team A @ 12.5s: 9 touches by Tyler Boyd → Daniel Lovitz → Edvard Tagseth
  - Team B @ 20.3s: 8 touches by Marcel Hartel → Henry Kessler → João Klauss de Mello
  - Team A @ 26.9s: 15 touches by Hany Mukhtar → Edvard Tagseth → Daniel Lovitz → CM → Tyler Boyd
  - Team B @ 40.2s: 20 touches by Kyle Hiebert → Henry Kessler → João Klauss de Mello → Rasmus Alm → Chris Durkin
  - Team B @ 59.4s: 2 touches by Rasmus Alm → João Klauss de Mello

## Kickoff Receiver / Goal Correlation
- Kickoff passes recorded: 1; kickoff receives recorded: 0; scorer events: 0
- Nashville SC: 0/0 goals scored by latest kickoff receiver (0%)
- St. Louis City SC: 0/0 goals scored by latest kickoff receiver (0%)
- Nashville SC kickoff receivers: (none)
- St. Louis City SC kickoff receivers: Chris Durkin RM recv:0 intended:1 goals:0

## Pattern Engine (Phase 2.5)
- Total pattern starts: 38 (A 28, B 10)
- Distinct types per team: A 4, B 3
- Types A: CENTRAL_COMBO:18, GIVE_AND_GO:3, WING_ATTACK_RIGHT:3, WING_ATTACK_LEFT:4
- Types B: WING_ATTACK_LEFT:1, CENTRAL_COMBO:7, WING_ATTACK_RIGHT:2
- Avg duration by type: CENTRAL_COMBO 2.26s, WING_ATTACK_LEFT 0.57s, GIVE_AND_GO 1.96s, WING_ATTACK_RIGHT 0.31s
- End reasons: intent_changed 30, possession_lost 7
- Shots by active pattern: NONE 1, GIVE_AND_GO 4
- Goals by active pattern: (none)

## Role Positions (team-in-possession frames)
- Nashville SC:
  - ST: avgX -4.67, avg|Z| 3.88, avgDistToGoal 31.84 (168 samples); opp-half fwdX 2.48 (22); final-third |z| 4.89 (5)
- St. Louis City SC:
  - ST: avgX -6.09, avg|Z| 4.39, avgDistToGoal 34.15 (168 samples); opp-half fwdX 6.67 (156); final-third |z| 4.1 (8)

## Event Stream Review
- Event-stream shots: 5
- Event-stream on-target shots: 0
- Long-range on-target shots: 0
- Close-range bad-angle shots: 0
- On-target toe pokes: 0
- Attacker reset passes (BACK/WALL): 9

### Top Zigzag Offenders
- Team B ST João Klauss de Mello: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A RM Tyler Boyd: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A CM Edvard Tagseth: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A ST Sam Surridge: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A LB Walker Zimmerman: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A LM Hany Mukhtar: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A RB Alex Muyl: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A CB Daniel Lovitz: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%

## Suggested Improvements
- Shape is still too central. Strengthen weak-side width anchors and reduce carrier-gravity pull on wide roles and midfield support.
- Too many shots are arriving with an empty defensive box. Keep one presser, but pull two non-pressing defenders into the goal corridor when the carrier reaches shooting range.
- Too much of the final action still comes through central roles. Encourage wider occupation and more wing-led creation before the finish.
- Corner volume is still unrealistically low. Review deflection, blocked-shot, and out-of-play logic so wider attacks can produce restarts naturally.
- Some shots still lack second-wave support. Nudge nearby midfielders to arrive a little earlier into the edge-of-box support band.
