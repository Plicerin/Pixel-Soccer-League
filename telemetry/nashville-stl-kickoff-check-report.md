# Telemetry Analysis

## Match
- Fixture: Nashville SC 0-0 St. Louis City SC
- Session: headless-report:nashville-stl-kickoff-check.json:0
- Timestamp: 2026-05-03T11:32:50.314Z
- Shots: 4-2
- Shots on target: 1-0

## Tuning KPIs
- Overall: 39.5 (red)
- Baseline Fit: 16 (red) — one-match MLS stat fit: goals ~2-3, shots ~26, SOT ~9, corners ~8, long-range SOT <=3
  - Inputs: goals 0, shots 6, SOT 1, long-range SOT 0, corners 0
- Soccer Structure: 27.6 (red) — soccer-like structure: width >=18, center+narrow <=35%, overload share >=25%, danger marking >=78%, shot corridor defenders >=1.2, empty-box shots <=35%, pattern touches >=2, real crosses >=5
  - Inputs: width 13.87/12.2, center+narrow worst 68.2%, overload share 0%, danger marked 4%, shot corridor defenders 0, empty-box shots 100%, pattern touches 0.81, real crosses 0
- Tuning Efficiency: 75 (watch) — low-tweak debt: forced shots <=55%, final-third backpasses <=18, lateral flips <=90, direct-blocker passes <=70, broken rows <=10%
  - Inputs: forced shots 83.3%, final-third backpasses 0, zigzag flips 0, direct-blocker passes 0, broken shot rows 0%

## MLS Baseline Comparison
- Total goals: 0 vs 2.78 baseline (drift -2.78)
- Total shots: 6 vs 26.2 baseline (drift -20.2)
- Total shots on target: 1 vs 9.4 baseline (drift -8.4)
- Total corners: 0 vs 8 baseline (drift -8)

## Match Summary Telemetry
- Event count: 3185
- Pass log events: 51
- Carrier traces: 238
- Attacker zone traces: 336
- Shot decisions: 6
- Pass decisions: 26
- Interceptions: 0
- Turnovers: 10

## Decision Telemetry
- Forced shots: 5 of 6
- AI_SIMPLE broken rows: 0 of 0
- AI_SIMPLE forced broken rows: 0
- Long-range shot decisions: 5
- Pressured long-range shot decisions: 5
- Attacker final-third backpasses: 0
- Attacker in-box backpasses: 0
- Direct-blocker pass decisions: 0

## Movement / Facing
- Carrier traces analyzed: 238
- Carriers tracked: 14
- Forward-carry samples: 0
- Lateral direction flips: 0
- Avg forward progress per flip: 0
- Switch requests: 0
- Blocked switch requests: 0
- Carry lock samples: 0
- Facing vs movement mismatch: 0%
- Desired vs steer mismatch: 0%

## Box Behavior
- Box traces analyzed: 72
- Attackers tracked in box: 1

## Heat Map / Shape
- Nashville SC: avg width 13.87, avg |avgZ| 1.88, center-locked 81.8%, center+narrow 68.2%
- St. Louis City SC: avg width 12.2, avg |avgZ| 1.65, center-locked 77.3%, center+narrow 68.2%
- Nashville SC wide touches vs central touches: 0 vs 0
- St. Louis City SC wide touches vs central touches: 0 vs 0
- Nashville SC wide shots vs central shots: 0 vs 0
- St. Louis City SC wide shots vs central shots: 0 vs 0
- Position owner samples: 2380
- Nashville SC owner mix: STRUCTURED_ATTACK:180 | WIDE_HOME:274 | CARRIER:30 | ROLE_SLOT:706
- St. Louis City SC owner mix: ROLE_SLOT:776 | WIDE_HOME:274 | STRUCTURED_ATTACK:117 | CARRIER:23
- Nashville SC wide owner avg |z| 5.28, target |z| 5.16: STRUCTURED_ATTACK:73 | WIDE_HOME:128 | ROLE_SLOT:273 | CARRIER:2
- St. Louis City SC wide owner avg |z| 3.97, target |z| 3.73: ROLE_SLOT:296 | WIDE_HOME:118 | STRUCTURED_ATTACK:46 | CARRIER:16

## Phase Time Distribution
- Nashville SC: buildup 0% | progression 94% | chance 6% | finish 0% (67 samples)
- St. Louis City SC: buildup 65.5% | progression 29.8% | chance 4.7% | finish 0% (171 samples)

## Pass Decisions By Zone
- Evaluated: BUILDUP_CENTRAL:4 | BUILDUP_HALFSPACE:19 | FINAL_THIRD_HALFSPACE:2 | FINAL_THIRD_CENTRAL:1
- Executed (shouldPass): BUILDUP_CENTRAL:4 | BUILDUP_HALFSPACE:19 | FINAL_THIRD_HALFSPACE:2 | FINAL_THIRD_CENTRAL:1

## Pattern Tempo (realism fit per pattern type)
- GIVE_AND_GO (4x): touches 1.5 [n/a vs n/a], pace -2.13u/s [n/a vs n/a], duration 1.02s 
- CENTRAL_COMBO (15x): touches 1.73 [TOO_FEW vs 2-4], pace 0.03u/s [TOO_SLOW vs 2.5-6u/s], duration 1.83s — expected short sharp
- WING_ATTACK_RIGHT (2x): touches 0 [TOO_FEW vs 2-4], pace nullu/s [no_multi_touch_data vs 3-8u/s], duration 0s — expected quick deliver
- WING_ATTACK_LEFT (2x): touches 0 [TOO_FEW vs 2-4], pace nullu/s [no_multi_touch_data vs 3-8u/s], duration 0s — expected quick deliver

## Neo-Play Effectiveness
- Starts: 23; deliveries: 0; shot-producing deliveries: 0 (0%); goal-producing deliveries: 0 (0%)
- GIVE_AND_GO: starts 19, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- WING_ATTACK_RIGHT: starts 2, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- WING_ATTACK_LEFT: starts 2, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)

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
  - Team A Sam Surridge ST @ 3.9s: 0 box, 0 corridor defenders
  - Team A Sam Surridge ST @ 5.1s: 0 box, 0 corridor defenders
  - Team A Sam Surridge ST @ 6.2s: 0 box, 0 corridor defenders
  - Team B Chris Durkin RM @ 189.3s: 0 box, 0 corridor defenders
  - Team B Rasmus Alm LM @ 204.1s: 0 box, 0 corridor defenders

## Final-Third Overloads (attacking commitment)
- Nashville SC: 0/55 1s-windows had 3+ attackers in opp final third (max 1)
- St. Louis City SC: 0/2 1s-windows had 3+ attackers in opp final third (max 1)

## Danger-Zone Marking
- Samples: 75
- Nashville SC attackers marked: 3/75 (4%), avg nearest defender 21.96
- St. Louis City SC attackers marked: 0/0 (0%), avg nearest defender 0
- Worst unmarked samples:
  - Nashville SC Sam Surridge ST @ 19.5s: nearest defender 24.65, 6u from goal (NONE)
  - Nashville SC Sam Surridge ST @ 15.2s: nearest defender 24.54, 6u from goal (NONE)
  - Nashville SC Sam Surridge ST @ 20.9s: nearest defender 24.49, 6u from goal (NONE)

## Multi-Touch Opp-Half Sequences (build-up quality)
- Sequences with 2+ distinct players touching ball in opp half: 8 of 12
- Opp-half touches total: 44
- Avg distinct players per possession: 2.17
- Examples:
  - Team A @ 0.0s: 5 touches by Jacob Shaffelburg → ST
  - Team A @ 151.6s: 2 touches by Jacob Shaffelburg → Hany Mukhtar
  - Team A @ 155.6s: 7 touches by TEAM → Walker Zimmerman → Sam Surridge → Alex Muyl
  - Team B @ 172.8s: 9 touches by TEAM → Conrad Wallem → Eduard Löwen → Marcel Hartel → Rasmus Alm
  - Team A @ 178.5s: 3 touches by Tyler Boyd → Gastón Brugman
  - Team B @ 181.9s: 5 touches by TEAM → Alfredo Morales → Eduard Löwen

## Kickoff Receiver / Goal Correlation
- Kickoff passes recorded: 1; kickoff receives recorded: 0; scorer events: 0
- Nashville SC: 0/0 goals scored by latest kickoff receiver (0%)
- St. Louis City SC: 0/0 goals scored by latest kickoff receiver (0%)
- Nashville SC kickoff receivers: Jacob Shaffelburg RM recv:0 intended:1 goals:0
- St. Louis City SC kickoff receivers: (none)

## Pattern Engine (Phase 2.5)
- Total pattern starts: 23 (A 10, B 13)
- Distinct types per team: A 2, B 4
- Types A: GIVE_AND_GO:2, CENTRAL_COMBO:8
- Types B: CENTRAL_COMBO:7, WING_ATTACK_RIGHT:2, WING_ATTACK_LEFT:2, GIVE_AND_GO:2
- Avg duration by type: CENTRAL_COMBO 2.46s, GIVE_AND_GO 1.69s, WING_ATTACK_RIGHT 0.41s, WING_ATTACK_LEFT 0.67s
- End reasons: intent_changed 18, possession_lost 6
- Shots by active pattern: NONE 4, GIVE_AND_GO 2
- Goals by active pattern: (none)

## Role Positions (team-in-possession frames)
- Nashville SC:
  - ST: avgX 13.46, avg|Z| 2.39, avgDistToGoal 22.24 (168 samples); opp-half fwdX 17.62 (134); final-third |z| 0.34 (76)
- St. Louis City SC:
  - ST: avgX -0.55, avg|Z| 6.48, avgDistToGoal 34.03 (168 samples); opp-half fwdX 4.21 (75); final-third |z| 9.11 (2)

## Event Stream Review
- Event-stream shots: 6
- Event-stream on-target shots: 0
- Long-range on-target shots: 0
- Close-range bad-angle shots: 0
- On-target toe pokes: 0
- Attacker reset passes (BACK/WALL): 6

### Top Zigzag Offenders
- Team B GK Roman Bürki: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A ST Sam Surridge: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B LM Rasmus Alm: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B RM Chris Durkin: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B DM Marcel Hartel: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B CB Conrad Wallem: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A DM Gastón Brugman: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A CB Andy Najar: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%

### Top Box Loiterers
- Team A ST Sam Surridge: max dwell 0s, max idle 0s, max camp 0s, crowded 0%

## Suggested Improvements
- Final-third recycling is still too common. Tighten attacker backpass vetoes and extend the carry-or-shoot window before resets are allowed.
- Shape is still too central. Strengthen weak-side width anchors and reduce carrier-gravity pull on wide roles and midfield support.
- Danger-zone attackers are still too often unmarked. Tighten goal-side marking assignments for box, cutback, and far-post runners without pulling the ball presser out of shape.
- Too many shots are arriving with an empty defensive box. Keep one presser, but pull two non-pressing defenders into the goal corridor when the carrier reaches shooting range.
- Too much of the final action still comes through central roles. Encourage wider occupation and more wing-led creation before the finish.
- Corner volume is still unrealistically low. Review deflection, blocked-shot, and out-of-play logic so wider attacks can produce restarts naturally.
