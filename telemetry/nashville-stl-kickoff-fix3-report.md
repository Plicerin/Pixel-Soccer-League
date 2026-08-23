# Telemetry Analysis

## Match
- Fixture: Nashville SC 0-0 St. Louis City SC
- Session: headless-report:nashville-stl-kickoff-fix3.json:0
- Timestamp: 2026-05-03T11:56:06.364Z
- Shots: 8-2
- Shots on target: 1-1

## Tuning KPIs
- Overall: 46.7 (red)
- Baseline Fit: 16 (red) — one-match MLS stat fit: goals ~2-3, shots ~26, SOT ~9, corners ~8, long-range SOT <=3
  - Inputs: goals 0, shots 10, SOT 2, long-range SOT 0, corners 0
- Soccer Structure: 49 (red) — soccer-like structure: width >=18, center+narrow <=35%, overload share >=25%, danger marking >=78%, shot corridor defenders >=1.2, empty-box shots <=35%, pattern touches >=2, real crosses >=5
  - Inputs: width 16.48/16.65, center+narrow worst 50%, overload share 0%, danger marked 71.4%, shot corridor defenders 0, empty-box shots 100%, pattern touches 1.51, real crosses 1
- Tuning Efficiency: 75 (watch) — low-tweak debt: forced shots <=55%, final-third backpasses <=18, lateral flips <=90, direct-blocker passes <=70, broken rows <=10%
  - Inputs: forced shots 80%, final-third backpasses 0, zigzag flips 0, direct-blocker passes 0, broken shot rows 0%

## MLS Baseline Comparison
- Total goals: 0 vs 2.78 baseline (drift -2.78)
- Total shots: 10 vs 26.2 baseline (drift -16.2)
- Total shots on target: 2 vs 9.4 baseline (drift -7.4)
- Total corners: 0 vs 8 baseline (drift -8)

## Match Summary Telemetry
- Event count: 3177
- Pass log events: 75
- Carrier traces: 225
- Attacker zone traces: 336
- Shot decisions: 10
- Pass decisions: 49
- Interceptions: 0
- Turnovers: 18

## Decision Telemetry
- Forced shots: 8 of 10
- AI_SIMPLE broken rows: 0 of 0
- AI_SIMPLE forced broken rows: 0
- Long-range shot decisions: 8
- Pressured long-range shot decisions: 8
- Attacker final-third backpasses: 0
- Attacker in-box backpasses: 0
- Direct-blocker pass decisions: 0

## Movement / Facing
- Carrier traces analyzed: 225
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
- Box traces analyzed: 2
- Attackers tracked in box: 1

## Heat Map / Shape
- Nashville SC: avg width 16.48, avg |avgZ| 1.06, center-locked 95.5%, center+narrow 50%
- St. Louis City SC: avg width 16.65, avg |avgZ| 1.51, center-locked 90.9%, center+narrow 40.9%
- Nashville SC wide touches vs central touches: 0 vs 0
- St. Louis City SC wide touches vs central touches: 0 vs 0
- Nashville SC wide shots vs central shots: 0 vs 0
- St. Louis City SC wide shots vs central shots: 0 vs 0
- Position owner samples: 2360
- Nashville SC owner mix: ROLE_SLOT:596 | WIDE_HOME:346 | STRUCTURED_ATTACK:194 | CARRIER:44
- St. Louis City SC owner mix: ROLE_SLOT:762 | WIDE_HOME:291 | STRUCTURED_ATTACK:105 | CARRIER:22
- Nashville SC wide owner avg |z| 5.81, target |z| 5.49: ROLE_SLOT:235 | WIDE_HOME:180 | STRUCTURED_ATTACK:46 | CARRIER:11
- St. Louis City SC wide owner avg |z| 5.11, target |z| 4.67: ROLE_SLOT:332 | WIDE_HOME:95 | STRUCTURED_ATTACK:44 | CARRIER:1

## Phase Time Distribution
- Nashville SC: buildup 35.7% | progression 63% | chance 1.3% | finish 0% (154 samples)
- St. Louis City SC: buildup 7% | progression 78.9% | chance 14.1% | finish 0% (71 samples)

## Pass Decisions By Zone
- Evaluated: BUILDUP_HALFSPACE:26 | BUILDUP_CENTRAL:19 | FINAL_THIRD_HALFSPACE:4
- Executed (shouldPass): BUILDUP_HALFSPACE:26 | BUILDUP_CENTRAL:19 | FINAL_THIRD_HALFSPACE:4

## Pattern Tempo (realism fit per pattern type)
- CENTRAL_COMBO (11x): touches 2.73 [OK vs 2-4], pace -0.34u/s [TOO_SLOW vs 2.5-6u/s], duration 4.89s — expected short sharp
- WING_ATTACK_LEFT (1x): touches 0 [TOO_FEW vs 2-4], pace nullu/s [no_multi_touch_data vs 3-8u/s], duration 0s — expected quick deliver
- GIVE_AND_GO (5x): touches 1.8 [n/a vs n/a], pace -0.83u/s [n/a vs n/a], duration 1.08s 

## Neo-Play Effectiveness
- Starts: 17; deliveries: 2; shot-producing deliveries: 2 (100%); goal-producing deliveries: 0 (0%)
- GIVE_AND_GO: starts 16, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- WING_ATTACK_LEFT: starts 1, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- ORCH_DIRECT: starts 0, deliveries 2, crosses 2, effective 2/2 (100%), goals 0/2 (0%)

## Defenders In Box At Goal (defensive presence)
- Goals: 0, avg 0 defenders + 0 attackers in box at moment of goal
- Distribution: (none)

## Shot Box Defense
- Shots sampled: 8
- Avg defenders in box: 0
- Avg defenders in goal corridor: 0
- Empty-box shots: 8
- Empty-corridor shots: 8
- Samples:
  - Team A Jacob Shaffelburg RM @ 6.7s: 0 box, 0 corridor defenders
  - Team A Jacob Shaffelburg RM @ 7.9s: 0 box, 0 corridor defenders
  - Team A Sam Surridge ST @ 17.8s: 0 box, 0 corridor defenders
  - Team B Cedric Teuchert CM @ 182.3s: 0 box, 0 corridor defenders
  - Team A Bryan Acosta CM @ 190.4s: 0 box, 0 corridor defenders
  - Team A Bryan Acosta CM @ 193.8s: 0 box, 0 corridor defenders
  - Team A Bryan Acosta CM @ 195s: 0 box, 0 corridor defenders
  - Team A Sam Surridge ST @ 206.4s: 0 box, 0 corridor defenders

## Final-Third Overloads (attacking commitment)
- Nashville SC: 0/4 1s-windows had 3+ attackers in opp final third (max 1)
- St. Louis City SC: 0/9 1s-windows had 3+ attackers in opp final third (max 1)

## Danger-Zone Marking
- Samples: 7
- Nashville SC attackers marked: 2/4 (50%), avg nearest defender 4.43
- St. Louis City SC attackers marked: 3/3 (100%), avg nearest defender 0.99
- Worst unmarked samples:
  - Nashville SC Sam Surridge ST @ 209.7s: nearest defender 10.91, 5.8u from goal (NONE)
  - Nashville SC Sam Surridge ST @ 209s: nearest defender 5.42, 9.7u from goal (NONE)

## Multi-Touch Opp-Half Sequences (build-up quality)
- Sequences with 2+ distinct players touching ball in opp half: 12 of 18
- Opp-half touches total: 106
- Avg distinct players per possession: 2.56
- Examples:
  - Team A @ 0.0s: 17 touches by Jacob Shaffelburg → TEAM → Sam Surridge → RM → ST → Tyler Boyd
  - Team B @ 22.6s: 13 touches by TEAM → Marcel Hartel → Conrad Wallem
  - Team B @ 32.6s: 6 touches by TEAM → Conrad Wallem → Marcel Hartel → CB
  - Team B @ 151.3s: 23 touches by Chris Durkin → João Klauss de Mello → TEAM → Conrad Wallem → Cedric Teuchert → Marcel Hartel → Eduard Löwen → Rasmus Alm → Timo Baumgartl
  - Team A @ 163.7s: 3 touches by TEAM → Bryan Acosta
  - Team B @ 164.7s: 3 touches by TEAM → Marcel Hartel

## Kickoff Receiver / Goal Correlation
- Kickoff passes recorded: 1; kickoff receives recorded: 2; scorer events: 0
- Nashville SC: 0/0 goals scored by latest kickoff receiver (0%)
- St. Louis City SC: 0/0 goals scored by latest kickoff receiver (0%)
- Nashville SC kickoff receivers: Jacob Shaffelburg RM recv:1 intended:1 goals:0
- St. Louis City SC kickoff receivers: Conrad Wallem CB recv:1 intended:0 goals:0

## Pattern Engine (Phase 2.5)
- Total pattern starts: 17 (A 8, B 9)
- Distinct types per team: A 3, B 2
- Types A: CENTRAL_COMBO:6, WING_ATTACK_LEFT:1, GIVE_AND_GO:1
- Types B: CENTRAL_COMBO:5, GIVE_AND_GO:4
- Avg duration by type: CENTRAL_COMBO 4.62s, WING_ATTACK_LEFT 0.78s, GIVE_AND_GO 1.03s
- End reasons: intent_changed 11, possession_lost 6
- Shots by active pattern: CENTRAL_COMBO 6, GIVE_AND_GO 4
- Goals by active pattern: (none)

## Role Positions (team-in-possession frames)
- Nashville SC:
  - ST: avgX -3.87, avg|Z| 4.64, avgDistToGoal 34.95 (168 samples); opp-half fwdX 5.95 (44); final-third |z| 1.08 (5)
- St. Louis City SC:
  - ST: avgX 1.33, avg|Z| 6.99, avgDistToGoal 28.25 (168 samples); opp-half fwdX 4.65 (83); final-third |z| 8.6 (11)

## Event Stream Review
- Event-stream shots: 10
- Event-stream on-target shots: 0
- Long-range on-target shots: 0
- Close-range bad-angle shots: 0
- On-target toe pokes: 0
- Attacker reset passes (BACK/WALL): 8

### Top Zigzag Offenders
- Team A GK Joe Willis: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A CM Bryan Acosta: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A ST Sam Surridge: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A RM Jacob Shaffelburg: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B DM Marcel Hartel: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B CM Cedric Teuchert: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B ST João Klauss de Mello: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B CB Conrad Wallem: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%

### Top Box Loiterers
- Team A ST Sam Surridge: max dwell 0s, max idle 0s, max camp 0s, crowded 0%

## Suggested Improvements
- Final-third recycling is still too common. Tighten attacker backpass vetoes and extend the carry-or-shoot window before resets are allowed.
- Shape is still too central. Strengthen weak-side width anchors and reduce carrier-gravity pull on wide roles and midfield support.
- Danger-zone attackers are still too often unmarked. Tighten goal-side marking assignments for box, cutback, and far-post runners without pulling the ball presser out of shape.
- Too many shots are arriving with an empty defensive box. Keep one presser, but pull two non-pressing defenders into the goal corridor when the carrier reaches shooting range.
- Too much of the final action still comes through central roles. Encourage wider occupation and more wing-led creation before the finish.
- Corner volume is still unrealistically low. Review deflection, blocked-shot, and out-of-play logic so wider attacks can produce restarts naturally.
- Some shots still lack second-wave support. Nudge nearby midfielders to arrive a little earlier into the edge-of-box support band.
