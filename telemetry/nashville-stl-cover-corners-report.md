# Telemetry Analysis

## Match
- Fixture: Nashville SC 0-0 St. Louis City SC
- Session: headless-report:nashville-stl-cover-corners.json:0
- Timestamp: 2026-05-03T06:45:27.145Z
- Shots: 0-2
- Shots on target: 0-2

## Tuning KPIs
- Overall: 54.2 (red)
- Baseline Fit: 16 (red) — one-match MLS stat fit: goals ~2-3, shots ~26, SOT ~9, corners ~8, long-range SOT <=3
  - Inputs: goals 0, shots 2, SOT 2, long-range SOT 0, corners 0
- Soccer Structure: 46.7 (red) — soccer-like structure: width >=18, center+narrow <=35%, overload share >=25%, danger marking >=78%, shot corridor defenders >=1.2, empty-box shots <=35%, pattern touches >=2, real crosses >=5
  - Inputs: width 12.9/16.94, center+narrow worst 59.1%, overload share 0%, danger marked 13%, shot corridor defenders 1.5, empty-box shots 0%, pattern touches 1.15, real crosses 2
- Tuning Efficiency: 100 (green) — low-tweak debt: forced shots <=55%, final-third backpasses <=18, lateral flips <=90, direct-blocker passes <=70, broken rows <=10%
  - Inputs: forced shots 0%, final-third backpasses 0, zigzag flips 0, direct-blocker passes 0, broken shot rows 0%

## MLS Baseline Comparison
- Total goals: 0 vs 2.78 baseline (drift -2.78)
- Total shots: 2 vs 26.2 baseline (drift -24.2)
- Total shots on target: 2 vs 9.4 baseline (drift -7.4)
- Total corners: 0 vs 8 baseline (drift -8)

## Match Summary Telemetry
- Event count: 3399
- Pass log events: 95
- Carrier traces: 217
- Attacker zone traces: 504
- Shot decisions: 2
- Pass decisions: 51
- Interceptions: 0
- Turnovers: 16

## Decision Telemetry
- Forced shots: 0 of 2
- AI_SIMPLE broken rows: 0 of 0
- AI_SIMPLE forced broken rows: 0
- Long-range shot decisions: 0
- Pressured long-range shot decisions: 0
- Attacker final-third backpasses: 0
- Attacker in-box backpasses: 0
- Direct-blocker pass decisions: 0

## Movement / Facing
- Carrier traces analyzed: 217
- Carriers tracked: 18
- Forward-carry samples: 0
- Lateral direction flips: 0
- Avg forward progress per flip: 0
- Switch requests: 0
- Blocked switch requests: 0
- Carry lock samples: 0
- Facing vs movement mismatch: 0%
- Desired vs steer mismatch: 0%

## Box Behavior
- Box traces analyzed: 36
- Attackers tracked in box: 2

## Heat Map / Shape
- Nashville SC: avg width 12.9, avg |avgZ| 2.13, center-locked 72.7%, center+narrow 59.1%
- St. Louis City SC: avg width 16.94, avg |avgZ| 0.61, center-locked 95.5%, center+narrow 27.3%
- Nashville SC wide touches vs central touches: 0 vs 0
- St. Louis City SC wide touches vs central touches: 0 vs 0
- Nashville SC wide shots vs central shots: 0 vs 0
- St. Louis City SC wide shots vs central shots: 0 vs 0
- Position owner samples: 2380
- Nashville SC owner mix: ROLE_SLOT:835 | WIDE_HOME:307 | CARRIER:11 | STRUCTURED_ATTACK:37
- St. Louis City SC owner mix: WIDE_HOME:390 | STRUCTURED_ATTACK:323 | CARRIER:62 | ROLE_SLOT:415
- Nashville SC wide owner avg |z| 5.2, target |z| 4.95: ROLE_SLOT:327 | WIDE_HOME:137 | STRUCTURED_ATTACK:12
- St. Louis City SC wide owner avg |z| 7.16, target |z| 6.9: WIDE_HOME:131 | STRUCTURED_ATTACK:38 | ROLE_SLOT:69

## Phase Time Distribution
- Nashville SC: buildup 50.7% | progression 49.3% | chance 0% | finish 0% (67 samples)
- St. Louis City SC: buildup 0% | progression 84.7% | chance 15.3% | finish 0% (150 samples)

## Pass Decisions By Zone
- Evaluated: BUILDUP_CENTRAL:24 | BUILDUP_HALFSPACE:24 | FINAL_THIRD_HALFSPACE:3
- Executed (shouldPass): BUILDUP_CENTRAL:24 | BUILDUP_HALFSPACE:24 | FINAL_THIRD_HALFSPACE:3

## Pattern Tempo (realism fit per pattern type)
- CENTRAL_COMBO (17x): touches 2.53 [OK vs 2-4], pace -0.41u/s [TOO_SLOW vs 2.5-6u/s], duration 2.41s — expected short sharp
- WING_ATTACK_RIGHT (2x): touches 0 [TOO_FEW vs 2-4], pace nullu/s [no_multi_touch_data vs 3-8u/s], duration 0s — expected quick deliver
- WING_ATTACK_LEFT (3x): touches 0.33 [TOO_FEW vs 2-4], pace nullu/s [no_multi_touch_data vs 3-8u/s], duration 0s — expected quick deliver
- GIVE_AND_GO (4x): touches 1.75 [n/a vs n/a], pace -0.66u/s [n/a vs n/a], duration 3.88s 

## Neo-Play Effectiveness
- Starts: 26; deliveries: 4; shot-producing deliveries: 2 (50%); goal-producing deliveries: 0 (0%)
- GIVE_AND_GO: starts 21, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- WING_ATTACK_RIGHT: starts 2, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- WING_ATTACK_LEFT: starts 3, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- ORCH_DIRECT: starts 0, deliveries 4, crosses 4, effective 2/4 (50%), goals 0/4 (0%)

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
- Nashville SC: 0/2 1s-windows had 3+ attackers in opp final third (max 1)
- St. Louis City SC: 0/25 1s-windows had 3+ attackers in opp final third (max 2)

## Danger-Zone Marking
- Samples: 46
- Nashville SC attackers marked: 0/0 (0%), avg nearest defender 0
- St. Louis City SC attackers marked: 6/46 (13%), avg nearest defender 18.14
- Worst unmarked samples:
  - St. Louis City SC João Klauss de Mello ST @ 209.7s: nearest defender 29.89, 0.6u from goal (NONE)
  - St. Louis City SC João Klauss de Mello ST @ 209s: nearest defender 29.62, 0.7u from goal (NONE)
  - St. Louis City SC Sang Bin Jeong ST @ 209.7s: nearest defender 29.54, 1u from goal (NONE)

## Multi-Touch Opp-Half Sequences (build-up quality)
- Sequences with 2+ distinct players touching ball in opp half: 9 of 16
- Opp-half touches total: 124
- Avg distinct players per possession: 2.5
- Examples:
  - Team B @ 0.0s: 36 touches by Sang Bin Jeong → Marcel Hartel → Cedric Teuchert → Henry Kessler → Timo Baumgartl → DM
  - Team B @ 41.0s: 32 touches by Cedric Teuchert → Timo Baumgartl → João Klauss de Mello → Henry Kessler → Marcel Hartel
  - Team A @ 152.7s: 10 touches by Hany Mukhtar → Sam Surridge → TEAM → Gastón Brugman → Bryan Acosta → Daniel Lovitz
  - Team A @ 166.6s: 7 touches by TEAM → Gastón Brugman → Sam Surridge → Tyler Boyd
  - Team A @ 171.8s: 9 touches by TEAM → Hany Mukhtar → Bryan Acosta → Daniel Lovitz
  - Team A @ 174.9s: 13 touches by TEAM → Daniel Lovitz → Hany Mukhtar → Tyler Boyd → Gastón Brugman

## Kickoff Receiver / Goal Correlation
- Kickoff passes recorded: 1; kickoff receives recorded: 0; scorer events: 0
- Nashville SC: 0/0 goals scored by latest kickoff receiver (0%)
- St. Louis City SC: 0/0 goals scored by latest kickoff receiver (0%)
- Nashville SC kickoff receivers: (none)
- St. Louis City SC kickoff receivers: Sang Bin Jeong ST recv:0 intended:1 goals:0

## Pattern Engine (Phase 2.5)
- Total pattern starts: 26 (A 3, B 23)
- Distinct types per team: A 1, B 4
- Types A: CENTRAL_COMBO:3
- Types B: CENTRAL_COMBO:14, WING_ATTACK_RIGHT:2, WING_ATTACK_LEFT:3, GIVE_AND_GO:4
- Avg duration by type: CENTRAL_COMBO 2.88s, WING_ATTACK_RIGHT 0.27s, WING_ATTACK_LEFT 0.35s, GIVE_AND_GO 2.79s
- End reasons: intent_changed 19, possession_lost 8
- Shots by active pattern: GIVE_AND_GO 1, NONE 1
- Goals by active pattern: (none)

## Role Positions (team-in-possession frames)
- Nashville SC:
  - ST: avgX 0.06, avg|Z| 4.49, avgDistToGoal 36.64 (168 samples); opp-half fwdX 5.54 (82); final-third |z| 2.24 (2)
- St. Louis City SC:
  - ST: avgX 5.03, avg|Z| 3.47, avgDistToGoal 27.34 (336 samples); opp-half fwdX 2.31 (115); final-third |z| 2.54 (56)

## Event Stream Review
- Event-stream shots: 2
- Event-stream on-target shots: 0
- Long-range on-target shots: 0
- Close-range bad-angle shots: 0
- On-target toe pokes: 0
- Attacker reset passes (BACK/WALL): 2

### Top Zigzag Offenders
- Team B CM Cedric Teuchert: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B CB Henry Kessler: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B DM Timo Baumgartl: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A GK Joe Willis: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B CB Eduard Löwen: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B ST Sang Bin Jeong: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B CB Conrad Wallem: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A ST Sam Surridge: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%

### Top Box Loiterers
- Team B ST Sang Bin Jeong: max dwell 0s, max idle 0s, max camp 0s, crowded 0%
- Team B ST João Klauss de Mello: max dwell 0s, max idle 0s, max camp 0s, crowded 0%

## Suggested Improvements
- Final-third recycling is still too common. Tighten attacker backpass vetoes and extend the carry-or-shoot window before resets are allowed.
- Shape is still too central. Strengthen weak-side width anchors and reduce carrier-gravity pull on wide roles and midfield support.
- Danger-zone attackers are still too often unmarked. Tighten goal-side marking assignments for box, cutback, and far-post runners without pulling the ball presser out of shape.
- Too much of the final action still comes through central roles. Encourage wider occupation and more wing-led creation before the finish.
- Corner volume is still unrealistically low. Review deflection, blocked-shot, and out-of-play logic so wider attacks can produce restarts naturally.
