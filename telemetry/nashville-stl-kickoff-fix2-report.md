# Telemetry Analysis

## Match
- Fixture: Nashville SC 0-0 St. Louis City SC
- Session: headless-report:nashville-stl-kickoff-fix2.json:0
- Timestamp: 2026-05-03T11:45:18.892Z
- Shots: 2-1
- Shots on target: 1-1

## Tuning KPIs
- Overall: 48.5 (red)
- Baseline Fit: 16 (red) — one-match MLS stat fit: goals ~2-3, shots ~26, SOT ~9, corners ~8, long-range SOT <=3
  - Inputs: goals 0, shots 3, SOT 2, long-range SOT 0, corners 0
- Soccer Structure: 44.7 (red) — soccer-like structure: width >=18, center+narrow <=35%, overload share >=25%, danger marking >=78%, shot corridor defenders >=1.2, empty-box shots <=35%, pattern touches >=2, real crosses >=5
  - Inputs: width 14.27/16.06, center+narrow worst 86.4%, overload share 0%, danger marked 61.9%, shot corridor defenders 0, empty-box shots 100%, pattern touches 1.41, real crosses 1
- Tuning Efficiency: 84.8 (watch) — low-tweak debt: forced shots <=55%, final-third backpasses <=18, lateral flips <=90, direct-blocker passes <=70, broken rows <=10%
  - Inputs: forced shots 33.3%, final-third backpasses 0, zigzag flips 0, direct-blocker passes 0, broken shot rows 0%

## MLS Baseline Comparison
- Total goals: 0 vs 2.78 baseline (drift -2.78)
- Total shots: 3 vs 26.2 baseline (drift -23.2)
- Total shots on target: 2 vs 9.4 baseline (drift -7.4)
- Total corners: 0 vs 8 baseline (drift -8)

## Match Summary Telemetry
- Event count: 3461
- Pass log events: 73
- Carrier traces: 219
- Attacker zone traces: 672
- Shot decisions: 3
- Pass decisions: 54
- Interceptions: 0
- Turnovers: 9

## Decision Telemetry
- Forced shots: 1 of 3
- AI_SIMPLE broken rows: 0 of 0
- AI_SIMPLE forced broken rows: 0
- Long-range shot decisions: 1
- Pressured long-range shot decisions: 1
- Attacker final-third backpasses: 0
- Attacker in-box backpasses: 0
- Direct-blocker pass decisions: 0

## Movement / Facing
- Carrier traces analyzed: 219
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
- Nashville SC: avg width 14.27, avg |avgZ| 0.82, center-locked 100%, center+narrow 86.4%
- St. Louis City SC: avg width 16.06, avg |avgZ| 1.86, center-locked 72.7%, center+narrow 50%
- Nashville SC wide touches vs central touches: 0 vs 0
- St. Louis City SC wide touches vs central touches: 0 vs 0
- Nashville SC wide shots vs central shots: 0 vs 0
- St. Louis City SC wide shots vs central shots: 0 vs 0
- Position owner samples: 2400
- Nashville SC owner mix: ROLE_SLOT:960 | WIDE_HOME:143 | CARRIER:16 | STRUCTURED_ATTACK:81
- St. Louis City SC owner mix: ROLE_SLOT:702 | WIDE_HOME:350 | CARRIER:24 | STRUCTURED_ATTACK:124
- Nashville SC wide owner avg |z| 5.29, target |z| 5.17: ROLE_SLOT:384 | WIDE_HOME:68 | STRUCTURED_ATTACK:25 | CARRIER:3
- St. Louis City SC wide owner avg |z| 6.89, target |z| 6.56: ROLE_SLOT:87 | WIDE_HOME:138 | STRUCTURED_ATTACK:8 | CARRIER:7

## Phase Time Distribution
- Nashville SC: buildup 65.4% | progression 30.1% | chance 4.5% | finish 0% (156 samples)
- St. Louis City SC: buildup 7.9% | progression 88.9% | chance 3.2% | finish 0% (63 samples)

## Pass Decisions By Zone
- Evaluated: BUILDUP_CENTRAL:15 | BUILDUP_HALFSPACE:38 | FINAL_THIRD_HALFSPACE:1
- Executed (shouldPass): BUILDUP_CENTRAL:15 | BUILDUP_HALFSPACE:38 | FINAL_THIRD_HALFSPACE:1

## Pattern Tempo (realism fit per pattern type)
- CENTRAL_COMBO (7x): touches 2.57 [OK vs 2-4], pace -1.17u/s [TOO_SLOW vs 2.5-6u/s], duration 53.46s — expected short sharp
- WING_ATTACK_RIGHT (2x): touches 0 [TOO_FEW vs 2-4], pace nullu/s [no_multi_touch_data vs 3-8u/s], duration 0s — expected quick deliver
- GIVE_AND_GO (3x): touches 1.67 [n/a vs n/a], pace 3.45u/s [n/a vs n/a], duration 1.11s 

## Neo-Play Effectiveness
- Starts: 12; deliveries: 2; shot-producing deliveries: 0 (0%); goal-producing deliveries: 0 (0%)
- GIVE_AND_GO: starts 10, deliveries 2, crosses 2, effective 0/2 (0%), goals 0/2 (0%)
- WING_ATTACK_RIGHT: starts 2, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)

## Defenders In Box At Goal (defensive presence)
- Goals: 0, avg 0 defenders + 0 attackers in box at moment of goal
- Distribution: (none)

## Shot Box Defense
- Shots sampled: 1
- Avg defenders in box: 0
- Avg defenders in goal corridor: 0
- Empty-box shots: 1
- Empty-corridor shots: 1
- Samples:
  - Team A Sam Surridge ST @ 32.4s: 0 box, 0 corridor defenders

## Final-Third Overloads (attacking commitment)
- Nashville SC: 0/19 1s-windows had 3+ attackers in opp final third (max 2)
- St. Louis City SC: 0/4 1s-windows had 3+ attackers in opp final third (max 1)

## Danger-Zone Marking
- Samples: 21
- Nashville SC attackers marked: 10/18 (55.6%), avg nearest defender 3.35
- St. Louis City SC attackers marked: 3/3 (100%), avg nearest defender 0.7
- Worst unmarked samples:
  - Nashville SC Ahmed Qasem ST @ 31s: nearest defender 8.54, 18.5u from goal (SUPPORT)
  - Nashville SC Ahmed Qasem ST @ 30.2s: nearest defender 7.3, 18.6u from goal (SUPPORT)
  - Nashville SC Ahmed Qasem ST @ 31.7s: nearest defender 6.93, 17.6u from goal (SUPPORT)

## Multi-Touch Opp-Half Sequences (build-up quality)
- Sequences with 2+ distinct players touching ball in opp half: 4 of 9
- Opp-half touches total: 59
- Avg distinct players per possession: 2.33
- Examples:
  - Team B @ 9.5s: 3 touches by TEAM → Cedric Teuchert
  - Team A @ 12.8s: 4 touches by Tyler Boyd → Sam Surridge
  - Team A @ 18.4s: 25 touches by TEAM → Ahmed Qasem → Sam Surridge → Tyler Boyd → Alex Muyl → ST
  - Team B @ 46.6s: 23 touches by TEAM → Cedric Teuchert → Alfredo Morales → Conrad Wallem → Marcel Hartel → João Klauss de Mello → Timo Baumgartl → Sang Bin Jeong

## Kickoff Receiver / Goal Correlation
- Kickoff passes recorded: 1; kickoff receives recorded: 2; scorer events: 0
- Nashville SC: 0/0 goals scored by latest kickoff receiver (0%)
- St. Louis City SC: 0/0 goals scored by latest kickoff receiver (0%)
- Nashville SC kickoff receivers: Joe Willis GK recv:1 intended:0 goals:0 | Ahmed Qasem ST recv:0 intended:1 goals:0
- St. Louis City SC kickoff receivers: Cedric Teuchert CM recv:1 intended:0 goals:0

## Pattern Engine (Phase 2.5)
- Total pattern starts: 12 (A 8, B 4)
- Distinct types per team: A 3, B 2
- Types A: CENTRAL_COMBO:4, WING_ATTACK_RIGHT:2, GIVE_AND_GO:2
- Types B: CENTRAL_COMBO:3, GIVE_AND_GO:1
- Avg duration by type: CENTRAL_COMBO 3.35s, WING_ATTACK_RIGHT 0.26s, GIVE_AND_GO 1.53s
- End reasons: intent_changed 8, possession_lost 3
- Shots by active pattern: GIVE_AND_GO 2, CENTRAL_COMBO 1
- Goals by active pattern: (none)

## Role Positions (team-in-possession frames)
- Nashville SC:
  - ST: avgX 1.02, avg|Z| 3.2, avgDistToGoal 29.42 (336 samples); opp-half fwdX 7.6 (144); final-third |z| 3.11 (34)
- St. Louis City SC:
  - ST: avgX -1.02, avg|Z| 4.77, avgDistToGoal 35.42 (336 samples); opp-half fwdX 5.63 (229); final-third |z| 1.75 (6)

## Event Stream Review
- Event-stream shots: 3
- Event-stream on-target shots: 0
- Long-range on-target shots: 0
- Close-range bad-angle shots: 0
- On-target toe pokes: 0
- Attacker reset passes (BACK/WALL): 9

### Top Zigzag Offenders
- Team A GK Joe Willis: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B ST João Klauss de Mello: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A ST Sam Surridge: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B LM Marcel Hartel: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A ST Ahmed Qasem: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B CM Cedric Teuchert: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A RB Alex Muyl: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A RM Tyler Boyd: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%

## Suggested Improvements
- Final-third recycling is still too common. Tighten attacker backpass vetoes and extend the carry-or-shoot window before resets are allowed.
- Shape is still too central. Strengthen weak-side width anchors and reduce carrier-gravity pull on wide roles and midfield support.
- Danger-zone attackers are still too often unmarked. Tighten goal-side marking assignments for box, cutback, and far-post runners without pulling the ball presser out of shape.
- Too much of the final action still comes through central roles. Encourage wider occupation and more wing-led creation before the finish.
- Corner volume is still unrealistically low. Review deflection, blocked-shot, and out-of-play logic so wider attacks can produce restarts naturally.
- Some shots still lack second-wave support. Nudge nearby midfielders to arrive a little earlier into the edge-of-box support band.
