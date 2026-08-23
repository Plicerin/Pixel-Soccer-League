# Telemetry Analysis

## Match
- Fixture: Nashville SC 0-0 St. Louis City SC
- Session: headless-report:nashville-stl-boxdef-1.json:0
- Timestamp: 2026-05-03T12:04:01.643Z
- Shots: 1-2
- Shots on target: 1-2

## Tuning KPIs
- Overall: 53.4 (red)
- Baseline Fit: 16 (red) — one-match MLS stat fit: goals ~2-3, shots ~26, SOT ~9, corners ~8, long-range SOT <=3
  - Inputs: goals 0, shots 3, SOT 3, long-range SOT 0, corners 0
- Soccer Structure: 44.2 (red) — soccer-like structure: width >=18, center+narrow <=35%, overload share >=25%, danger marking >=78%, shot corridor defenders >=1.2, empty-box shots <=35%, pattern touches >=2, real crosses >=5
  - Inputs: width 11.51/10.46, center+narrow worst 81.8%, overload share 0%, danger marked 100%, shot corridor defenders 1.5, empty-box shots 0%, pattern touches 0.96, real crosses 0
- Tuning Efficiency: 100 (green) — low-tweak debt: forced shots <=55%, final-third backpasses <=18, lateral flips <=90, direct-blocker passes <=70, broken rows <=10%
  - Inputs: forced shots 0%, final-third backpasses 0, zigzag flips 0, direct-blocker passes 0, broken shot rows 0%

## MLS Baseline Comparison
- Total goals: 0 vs 2.78 baseline (drift -2.78)
- Total shots: 3 vs 26.2 baseline (drift -23.2)
- Total shots on target: 3 vs 9.4 baseline (drift -6.4)
- Total corners: 0 vs 8 baseline (drift -8)

## Match Summary Telemetry
- Event count: 3292
- Pass log events: 50
- Carrier traces: 250
- Attacker zone traces: 504
- Shot decisions: 3
- Pass decisions: 40
- Interceptions: 0
- Turnovers: 11

## Decision Telemetry
- Forced shots: 0 of 3
- AI_SIMPLE broken rows: 0 of 0
- AI_SIMPLE forced broken rows: 0
- Long-range shot decisions: 0
- Pressured long-range shot decisions: 0
- Attacker final-third backpasses: 0
- Attacker in-box backpasses: 0
- Direct-blocker pass decisions: 0

## Movement / Facing
- Carrier traces analyzed: 250
- Carriers tracked: 16
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
- Nashville SC: avg width 11.51, avg |avgZ| 1.21, center-locked 90.9%, center+narrow 81.8%
- St. Louis City SC: avg width 10.46, avg |avgZ| 1.62, center-locked 86.4%, center+narrow 81.8%
- Nashville SC wide touches vs central touches: 0 vs 0
- St. Louis City SC wide touches vs central touches: 0 vs 0
- Nashville SC wide shots vs central shots: 0 vs 0
- St. Louis City SC wide shots vs central shots: 0 vs 0
- Position owner samples: 2400
- Nashville SC owner mix: ROLE_SLOT:1037 | WIDE_HOME:98 | STRUCTURED_ATTACK:57 | CARRIER:8
- St. Louis City SC owner mix: ROLE_SLOT:935 | WIDE_HOME:145 | STRUCTURED_ATTACK:96 | CARRIER:24
- Nashville SC wide owner avg |z| 4.13, target |z| 3.99: ROLE_SLOT:397 | WIDE_HOME:63 | STRUCTURED_ATTACK:18 | CARRIER:2
- St. Louis City SC wide owner avg |z| 3.39, target |z| 3.19: ROLE_SLOT:371 | WIDE_HOME:69 | STRUCTURED_ATTACK:35 | CARRIER:5

## Phase Time Distribution
- Nashville SC: buildup 78% | progression 18% | chance 4% | finish 0% (100 samples)
- St. Louis City SC: buildup 56% | progression 41.3% | chance 2.7% | finish 0% (150 samples)

## Pass Decisions By Zone
- Evaluated: BUILDUP_CENTRAL:13 | BUILDUP_HALFSPACE:27
- Executed (shouldPass): BUILDUP_CENTRAL:13 | BUILDUP_HALFSPACE:27

## Pattern Tempo (realism fit per pattern type)
- CENTRAL_COMBO (8x): touches 1.5 [TOO_FEW vs 2-4], pace -0.27u/s [TOO_SLOW vs 2.5-6u/s], duration 3.15s — expected short sharp
- GIVE_AND_GO (3x): touches 1.33 [n/a vs n/a], pace 3.87u/s [n/a vs n/a], duration 0.62s 
- WING_ATTACK_LEFT (1x): touches 0 [TOO_FEW vs 2-4], pace nullu/s [no_multi_touch_data vs 3-8u/s], duration 0s — expected quick deliver
- CENTRAL_THROUGH (1x): touches 1 [n/a vs n/a], pace nullu/s [no_multi_touch_data vs n/a], duration 0s 

## Neo-Play Effectiveness
- Starts: 13; deliveries: 0; shot-producing deliveries: 0 (0%); goal-producing deliveries: 0 (0%)
- GIVE_AND_GO: starts 11, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- WING_ATTACK_LEFT: starts 1, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- CENTRAL_THROUGH: starts 1, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)

## Defenders In Box At Goal (defensive presence)
- Goals: 0, avg 0 defenders + 0 attackers in box at moment of goal
- Distribution: (none)

## Shot Box Defense
- Shots sampled: 0
- Avg defenders in box: 0
- Avg defenders in goal corridor: 0
- Empty-box shots: 0
- Empty-corridor shots: 0

## Final-Third Overloads (attacking commitment)
- Nashville SC: 0/24 1s-windows had 3+ attackers in opp final third (max 1)
- St. Louis City SC: 0/0 1s-windows had 3+ attackers in opp final third (max 0)

## Danger-Zone Marking
- Samples: 1
- Nashville SC attackers marked: 1/1 (100%), avg nearest defender 0.7
- St. Louis City SC attackers marked: 0/0 (0%), avg nearest defender 0

## Multi-Touch Opp-Half Sequences (build-up quality)
- Sequences with 2+ distinct players touching ball in opp half: 7 of 10
- Opp-half touches total: 84
- Avg distinct players per possession: 3.3
- Examples:
  - Team B @ 0.0s: 9 touches by João Klauss de Mello → TEAM → Chris Durkin → Conrad Wallem
  - Team A @ 9.4s: 9 touches by TEAM → Bryan Acosta → Gastón Brugman → Ahmed Qasem
  - Team B @ 16.4s: 4 touches by Cedric Teuchert → Conrad Wallem
  - Team A @ 20.1s: 6 touches by TEAM → Tyler Boyd → Daniel Lovitz → Hany Mukhtar → CB
  - Team B @ 152.4s: 39 touches by TEAM → Marcel Hartel → Eduard Löwen → Henry Kessler → Conrad Wallem → Rasmus Alm → Alfredo Morales → Timo Baumgartl → Cedric Teuchert → João Klauss de Mello
  - Team B @ 164.7s: 11 touches by TEAM → Conrad Wallem → Cedric Teuchert → Marcel Hartel

## Kickoff Receiver / Goal Correlation
- Kickoff passes recorded: 1; kickoff receives recorded: 2; scorer events: 0
- Nashville SC: 0/0 goals scored by latest kickoff receiver (0%)
- St. Louis City SC: 0/0 goals scored by latest kickoff receiver (0%)
- Nashville SC kickoff receivers: (none)
- St. Louis City SC kickoff receivers: João Klauss de Mello ST recv:1 intended:1 goals:0 | Marcel Hartel DM recv:1 intended:0 goals:0

## Pattern Engine (Phase 2.5)
- Total pattern starts: 13 (A 5, B 8)
- Distinct types per team: A 3, B 3
- Types A: CENTRAL_COMBO:3, GIVE_AND_GO:1, WING_ATTACK_LEFT:1
- Types B: CENTRAL_COMBO:5, CENTRAL_THROUGH:1, GIVE_AND_GO:2
- Avg duration by type: CENTRAL_COMBO 2.31s, GIVE_AND_GO 0.64s, WING_ATTACK_LEFT 0.52s, CENTRAL_THROUGH 1.04s
- End reasons: intent_changed 8, possession_lost 5
- Shots by active pattern: GIVE_AND_GO 3
- Goals by active pattern: (none)

## Role Positions (team-in-possession frames)
- Nashville SC:
  - ST: avgX -4.21, avg|Z| 3.41, avgDistToGoal 34.09 (336 samples); opp-half fwdX 3.65 (59); final-third |z| 2.39 (33)
- St. Louis City SC:
  - ST: avgX -2.51, avg|Z| 3.05, avgDistToGoal 31.81 (168 samples); opp-half fwdX 5.36 (123); final-third |z| n/a (0)

## Event Stream Review
- Event-stream shots: 3
- Event-stream on-target shots: 0
- Long-range on-target shots: 0
- Close-range bad-angle shots: 0
- On-target toe pokes: 0
- Attacker reset passes (BACK/WALL): 3

### Top Zigzag Offenders
- Team B GK Roman Bürki: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A GK Joe Willis: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B ST João Klauss de Mello: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B DM Marcel Hartel: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A CM Gastón Brugman: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B DM Cedric Teuchert: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A RM Tyler Boyd: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B CB Conrad Wallem: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%

## Suggested Improvements
- Shape is still too central. Strengthen weak-side width anchors and reduce carrier-gravity pull on wide roles and midfield support.
- Too much of the final action still comes through central roles. Encourage wider occupation and more wing-led creation before the finish.
- Corner volume is still unrealistically low. Review deflection, blocked-shot, and out-of-play logic so wider attacks can produce restarts naturally.
