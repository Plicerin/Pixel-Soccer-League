# Telemetry Analysis

## Match
- Fixture: Nashville SC 0-0 St. Louis City SC
- Session: headless-report:nashville-stl-width-box-pass.json:0
- Timestamp: 2026-05-03T06:34:57.049Z
- Shots: 2-3
- Shots on target: 1-2

## Tuning KPIs
- Overall: 47.5 (red)
- Baseline Fit: 16 (red) — one-match MLS stat fit: goals ~2-3, shots ~26, SOT ~9, corners ~8, long-range SOT <=3
  - Inputs: goals 0, shots 5, SOT 3, long-range SOT 0, corners 0
- Soccer Structure: 44.8 (red) — soccer-like structure: width >=18, center+narrow <=35%, overload share >=25%, danger marking >=78%, shot corridor defenders >=1.2, empty-box shots <=35%, pattern touches >=2, real crosses >=5
  - Inputs: width 19.04/19.32, center+narrow worst 45.5%, overload share 0%, danger marked 5.8%, shot corridor defenders 0, empty-box shots 100%, pattern touches 1.33, real crosses 3
- Tuning Efficiency: 81.8 (watch) — low-tweak debt: forced shots <=55%, final-third backpasses <=18, lateral flips <=90, direct-blocker passes <=70, broken rows <=10%
  - Inputs: forced shots 40%, final-third backpasses 0, zigzag flips 0, direct-blocker passes 0, broken shot rows 0%

## MLS Baseline Comparison
- Total goals: 0 vs 2.78 baseline (drift -2.78)
- Total shots: 5 vs 26.2 baseline (drift -21.2)
- Total shots on target: 3 vs 9.4 baseline (drift -6.4)
- Total corners: 0 vs 8 baseline (drift -8)

## Match Summary Telemetry
- Event count: 3334
- Pass log events: 64
- Carrier traces: 222
- Attacker zone traces: 504
- Shot decisions: 5
- Pass decisions: 39
- Interceptions: 0
- Turnovers: 9

## Decision Telemetry
- Forced shots: 2 of 5
- AI_SIMPLE broken rows: 0 of 0
- AI_SIMPLE forced broken rows: 0
- Long-range shot decisions: 2
- Pressured long-range shot decisions: 2
- Attacker final-third backpasses: 0
- Attacker in-box backpasses: 0
- Direct-blocker pass decisions: 0

## Movement / Facing
- Carrier traces analyzed: 222
- Carriers tracked: 17
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
- Nashville SC: avg width 19.04, avg |avgZ| 1.06, center-locked 100%, center+narrow 45.5%
- St. Louis City SC: avg width 19.32, avg |avgZ| 2.17, center-locked 68.2%, center+narrow 36.4%
- Nashville SC wide touches vs central touches: 0 vs 0
- St. Louis City SC wide touches vs central touches: 0 vs 0
- Nashville SC wide shots vs central shots: 0 vs 0
- St. Louis City SC wide shots vs central shots: 0 vs 0
- Position owner samples: 2400
- Nashville SC owner mix: STRUCTURED_ATTACK:230 | WIDE_HOME:294 | CARRIER:44 | ROLE_SLOT:632
- St. Louis City SC owner mix: ROLE_SLOT:838 | WIDE_HOME:299 | CARRIER:9 | STRUCTURED_ATTACK:54
- Nashville SC wide owner avg |z| 4.37, target |z| 4.21: STRUCTURED_ATTACK:105 | WIDE_HOME:122 | ROLE_SLOT:253
- St. Louis City SC wide owner avg |z| 6.33, target |z| 5.55: ROLE_SLOT:352 | WIDE_HOME:107 | CARRIER:6 | STRUCTURED_ATTACK:15

## Phase Time Distribution
- Nashville SC: buildup 13.1% | progression 82.8% | chance 4.1% | finish 0% (122 samples)
- St. Louis City SC: buildup 79% | progression 14% | chance 7% | finish 0% (100 samples)

## Pass Decisions By Zone
- Evaluated: BUILDUP_CENTRAL:17 | BUILDUP_HALFSPACE:17 | BUILDUP_WIDE:2 | FINAL_THIRD_CENTRAL:2 | FINAL_THIRD_HALFSPACE:1
- Executed (shouldPass): BUILDUP_CENTRAL:17 | BUILDUP_HALFSPACE:17 | BUILDUP_WIDE:2 | FINAL_THIRD_CENTRAL:2 | FINAL_THIRD_HALFSPACE:1

## Pattern Tempo (realism fit per pattern type)
- WING_ATTACK_LEFT (8x): touches 1.5 [TOO_FEW vs 2-4], pace 0.58u/s [TOO_SLOW vs 3-8u/s], duration 1.42s — expected quick deliver
- CENTRAL_COMBO (13x): touches 1.08 [TOO_FEW vs 2-4], pace -0.16u/s [TOO_SLOW vs 2.5-6u/s], duration 7.42s — expected short sharp
- GIVE_AND_GO (5x): touches 1.4 [n/a vs n/a], pace -2.05u/s [n/a vs n/a], duration 0.88s 

## Neo-Play Effectiveness
- Starts: 26; deliveries: 6; shot-producing deliveries: 6 (100%); goal-producing deliveries: 0 (0%)
- WING_ATTACK_LEFT: starts 8, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- GIVE_AND_GO: starts 18, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- ORCH_DIRECT: starts 0, deliveries 6, crosses 6, effective 6/6 (100%), goals 0/6 (0%)

## Defenders In Box At Goal (defensive presence)
- Goals: 0, avg 0 defenders + 0 attackers in box at moment of goal
- Distribution: (none)

## Shot Box Defense
- Shots sampled: 2
- Avg defenders in box: 0
- Avg defenders in goal corridor: 0
- Empty-box shots: 2
- Empty-corridor shots: 2
- Samples:
  - Team B João Klauss de Mello ST @ 186.9s: 0 box, 0 corridor defenders
  - Team A Gastón Brugman CM @ 197.1s: 0 box, 0 corridor defenders

## Final-Third Overloads (attacking commitment)
- Nashville SC: 0/37 1s-windows had 3+ attackers in opp final third (max 1)
- St. Louis City SC: 0/6 1s-windows had 3+ attackers in opp final third (max 1)

## Danger-Zone Marking
- Samples: 52
- Nashville SC attackers marked: 0/49 (0%), avg nearest defender 14.54
- St. Louis City SC attackers marked: 3/3 (100%), avg nearest defender 0.65
- Worst unmarked samples:
  - Nashville SC Sam Surridge ST @ 28.8s: nearest defender 15.94, 15.3u from goal (NONE)
  - Nashville SC Sam Surridge ST @ 29.5s: nearest defender 15.67, 15.3u from goal (NONE)
  - Nashville SC Sam Surridge ST @ 46s: nearest defender 15.13, 15.3u from goal (NONE)

## Multi-Touch Opp-Half Sequences (build-up quality)
- Sequences with 2+ distinct players touching ball in opp half: 9 of 15
- Opp-half touches total: 66
- Avg distinct players per possession: 2.13
- Examples:
  - Team A @ 0.0s: 20 touches by Alex Muyl → Sam Surridge → Andy Najar → Hany Mukhtar → CB
  - Team A @ 151.5s: 14 touches by Alex Muyl → TEAM → Walker Zimmerman → Bryan Acosta → Daniel Lovitz → Jacob Shaffelburg
  - Team B @ 158.9s: 3 touches by TEAM → Alfredo Morales
  - Team B @ 175.9s: 2 touches by Cedric Teuchert → Henry Kessler
  - Team B @ 179.2s: 2 touches by Henry Kessler → Alfredo Morales
  - Team B @ 181.2s: 2 touches by Henry Kessler → Marcel Hartel

## Kickoff Receiver / Goal Correlation
- Kickoff passes recorded: 1; kickoff receives recorded: 0; scorer events: 0
- Nashville SC: 0/0 goals scored by latest kickoff receiver (0%)
- St. Louis City SC: 0/0 goals scored by latest kickoff receiver (0%)
- Nashville SC kickoff receivers: Alex Muyl RM recv:0 intended:1 goals:0
- St. Louis City SC kickoff receivers: (none)

## Pattern Engine (Phase 2.5)
- Total pattern starts: 26 (A 20, B 6)
- Distinct types per team: A 3, B 2
- Types A: WING_ATTACK_LEFT:8, CENTRAL_COMBO:11, GIVE_AND_GO:1
- Types B: CENTRAL_COMBO:2, GIVE_AND_GO:4
- Avg duration by type: CENTRAL_COMBO 1.77s, WING_ATTACK_LEFT 2.09s, GIVE_AND_GO 0.9s
- End reasons: intent_changed 20, possession_lost 7
- Shots by active pattern: NONE 1, GIVE_AND_GO 4
- Goals by active pattern: (none)

## Role Positions (team-in-possession frames)
- Nashville SC:
  - ST: avgX 9.13, avg|Z| 2.25, avgDistToGoal 30.82 (168 samples); opp-half fwdX 10.44 (152); final-third |z| 0.72 (51)
- St. Louis City SC:
  - ST: avgX -3.41, avg|Z| 6.72, avgDistToGoal 30.41 (336 samples); opp-half fwdX 7.19 (236); final-third |z| 2.83 (8)

## Event Stream Review
- Event-stream shots: 5
- Event-stream on-target shots: 0
- Long-range on-target shots: 0
- Close-range bad-angle shots: 0
- On-target toe pokes: 0
- Attacker reset passes (BACK/WALL): 2

### Top Zigzag Offenders
- Team B GK Roman Bürki: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A CM Gastón Brugman: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A ST Sam Surridge: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B LB Eduard Löwen: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A CM Bryan Acosta: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A GK Joe Willis: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B LM Marcel Hartel: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A CB Walker Zimmerman: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%

## Suggested Improvements
- Shape is still too central. Strengthen weak-side width anchors and reduce carrier-gravity pull on wide roles and midfield support.
- Danger-zone attackers are still too often unmarked. Tighten goal-side marking assignments for box, cutback, and far-post runners without pulling the ball presser out of shape.
- Too much of the final action still comes through central roles. Encourage wider occupation and more wing-led creation before the finish.
- Corner volume is still unrealistically low. Review deflection, blocked-shot, and out-of-play logic so wider attacks can produce restarts naturally.
- Some shots still lack second-wave support. Nudge nearby midfielders to arrive a little earlier into the edge-of-box support band.
