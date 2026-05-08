# Telemetry Analysis

## Match
- Fixture: Nashville SC 0-0 St. Louis City SC
- Session: headless-report:nashville-stl-boxdef-3.json:0
- Timestamp: 2026-05-03T12:27:20.802Z
- Shots: 0-0
- Shots on target: 0-0

## Tuning KPIs
- Overall: 57 (red)
- Baseline Fit: 16 (red) — one-match MLS stat fit: goals ~2-3, shots ~26, SOT ~9, corners ~8, long-range SOT <=3
  - Inputs: goals 0, shots 0, SOT 0, long-range SOT 0, corners 0
- Soccer Structure: 54.9 (red) — soccer-like structure: width >=18, center+narrow <=35%, overload share >=25%, danger marking >=78%, shot corridor defenders >=1.2, empty-box shots <=35%, pattern touches >=2, real crosses >=5
  - Inputs: width 18.33/9.4, center+narrow worst 90.9%, overload share 0%, danger marked 100%, shot corridor defenders 1.5, empty-box shots 0%, pattern touches 1.66, real crosses 1
- Tuning Efficiency: 100 (green) — low-tweak debt: forced shots <=55%, final-third backpasses <=18, lateral flips <=90, direct-blocker passes <=70, broken rows <=10%
  - Inputs: forced shots 0%, final-third backpasses 0, zigzag flips 0, direct-blocker passes 0, broken shot rows 0%

## MLS Baseline Comparison
- Total goals: 0 vs 2.78 baseline (drift -2.78)
- Total shots: 0 vs 26.2 baseline (drift -26.2)
- Total shots on target: 0 vs 9.4 baseline (drift -9.4)
- Total corners: 0 vs 8 baseline (drift -8)

## Match Summary Telemetry
- Event count: 3254
- Pass log events: 95
- Carrier traces: 211
- Attacker zone traces: 336
- Shot decisions: 0
- Pass decisions: 47
- Interceptions: 0
- Turnovers: 6

## Decision Telemetry
- Forced shots: 0 of 0
- AI_SIMPLE broken rows: 0 of 0
- AI_SIMPLE forced broken rows: 0
- Long-range shot decisions: 0
- Pressured long-range shot decisions: 0
- Attacker final-third backpasses: 0
- Attacker in-box backpasses: 0
- Direct-blocker pass decisions: 0

## Movement / Facing
- Carrier traces analyzed: 211
- Carriers tracked: 15
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
- Nashville SC: avg width 18.33, avg |avgZ| 0.48, center-locked 100%, center+narrow 13.6%
- St. Louis City SC: avg width 9.4, avg |avgZ| 1.07, center-locked 100%, center+narrow 90.9%
- Nashville SC wide touches vs central touches: 0 vs 0
- St. Louis City SC wide touches vs central touches: 0 vs 0
- Nashville SC wide shots vs central shots: 0 vs 0
- St. Louis City SC wide shots vs central shots: 0 vs 0
- Position owner samples: 2400
- Nashville SC owner mix: ROLE_SLOT:352 | WIDE_HOME:376 | STRUCTURED_ATTACK:398 | CARRIER:74
- St. Louis City SC owner mix: ROLE_SLOT:1020 | WIDE_HOME:141 | CARRIER:10 | STRUCTURED_ATTACK:29
- Nashville SC wide owner avg |z| 6.94, target |z| 6.67: ROLE_SLOT:118 | WIDE_HOME:214 | STRUCTURED_ATTACK:136 | CARRIER:12
- St. Louis City SC wide owner avg |z| 3.56, target |z| 3.57: ROLE_SLOT:384 | WIDE_HOME:85 | STRUCTURED_ATTACK:10 | CARRIER:1

## Phase Time Distribution
- Nashville SC: buildup 0% | progression 88% | chance 12% | finish 0% (175 samples)
- St. Louis City SC: buildup 38.9% | progression 61.1% | chance 0% | finish 0% (36 samples)

## Pass Decisions By Zone
- Evaluated: BUILDUP_HALFSPACE:14 | BUILDUP_CENTRAL:22 | BUILDUP_WIDE:1 | FINAL_THIRD_HALFSPACE:9 | FINAL_THIRD_CENTRAL:1
- Executed (shouldPass): BUILDUP_HALFSPACE:14 | BUILDUP_CENTRAL:22 | BUILDUP_WIDE:1 | FINAL_THIRD_HALFSPACE:9 | FINAL_THIRD_CENTRAL:1

## Pattern Tempo (realism fit per pattern type)
- CENTRAL_COMBO (13x): touches 1.38 [TOO_FEW vs 2-4], pace -1.41u/s [TOO_SLOW vs 2.5-6u/s], duration 2.9s — expected short sharp
- GIVE_AND_GO (9x): touches 1.67 [n/a vs n/a], pace -1.96u/s [n/a vs n/a], duration 1.64s 
- WING_ATTACK_LEFT (13x): touches 0.85 [TOO_FEW vs 2-4], pace 0.02u/s [TOO_SLOW vs 3-8u/s], duration 6.66s — expected quick deliver
- WING_ATTACK_RIGHT (12x): touches 1.42 [TOO_FEW vs 2-4], pace 0.37u/s [TOO_SLOW vs 3-8u/s], duration 1.01s — expected quick deliver
- WING_CUTBACK (1x): touches 3 [n/a vs n/a], pace -2.77u/s [n/a vs n/a], duration 1.48s 

## Neo-Play Effectiveness
- Starts: 48; deliveries: 2; shot-producing deliveries: 0 (0%); goal-producing deliveries: 0 (0%)
- GIVE_AND_GO: starts 22, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- WING_ATTACK_LEFT: starts 13, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- WING_ATTACK_RIGHT: starts 12, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- WING_CUTBACK: starts 1, deliveries 0, crosses 0, effective 0/0 (0%), goals 0/0 (0%)
- ORCH_DIRECT: starts 0, deliveries 2, crosses 2, effective 0/2 (0%), goals 0/2 (0%)

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
- Nashville SC: 0/0 1s-windows had 3+ attackers in opp final third (max 0)
- St. Louis City SC: 0/0 1s-windows had 3+ attackers in opp final third (max 0)

## Danger-Zone Marking
- Samples: 0
- Nashville SC attackers marked: 0/0 (0%), avg nearest defender 0
- St. Louis City SC attackers marked: 0/0 (0%), avg nearest defender 0

## Multi-Touch Opp-Half Sequences (build-up quality)
- Sequences with 2+ distinct players touching ball in opp half: 5 of 7
- Opp-half touches total: 120
- Avg distinct players per possession: 3.43
- Examples:
  - Team B @ 0.0s: 6 touches by Chris Durkin → TEAM → João Klauss de Mello
  - Team A @ 8.8s: 35 touches by TEAM → Hany Mukhtar → Daniel Lovitz → Andy Najar → Bryan Acosta
  - Team A @ 39.4s: 35 touches by TEAM → Andy Najar → Hany Mukhtar → Daniel Lovitz
  - Team A @ 159.3s: 4 touches by Tyler Boyd → Andy Najar
  - Team B @ 202.2s: 39 touches by TEAM → Eduard Löwen → Conrad Wallem → Henry Kessler → Rasmus Alm → João Klauss de Mello → Alfredo Morales → Marcel Hartel → Cedric Teuchert

## Kickoff Receiver / Goal Correlation
- Kickoff passes recorded: 1; kickoff receives recorded: 2; scorer events: 0
- Nashville SC: 0/0 goals scored by latest kickoff receiver (0%)
- St. Louis City SC: 0/0 goals scored by latest kickoff receiver (0%)
- Nashville SC kickoff receivers: Hany Mukhtar CM recv:1 intended:0 goals:0
- St. Louis City SC kickoff receivers: Chris Durkin RM recv:1 intended:1 goals:0

## Pattern Engine (Phase 2.5)
- Total pattern starts: 48 (A 46, B 2)
- Distinct types per team: A 5, B 1
- Types A: CENTRAL_COMBO:11, GIVE_AND_GO:9, WING_ATTACK_LEFT:13, WING_ATTACK_RIGHT:12, WING_CUTBACK:1
- Types B: CENTRAL_COMBO:2
- Avg duration by type: CENTRAL_COMBO 3.16s, GIVE_AND_GO 1.16s, WING_ATTACK_LEFT 0.6s, WING_ATTACK_RIGHT 1.45s, WING_CUTBACK 1.04s
- End reasons: intent_changed 32, possession_lost 15
- Shots by active pattern: (none)
- Goals by active pattern: (none)

## Role Positions (team-in-possession frames)
- Nashville SC:
  - ST: avgX 0.9, avg|Z| 6.61, avgDistToGoal 43.22 (168 samples); opp-half fwdX 11.32 (84); final-third |z| n/a (0)
- St. Louis City SC:
  - ST: avgX 1.37, avg|Z| 1.24, avgDistToGoal 48.84 (168 samples); opp-half fwdX 14.09 (90); final-third |z| n/a (0)

## Event Stream Review
- Event-stream shots: 0
- Event-stream on-target shots: 0
- Long-range on-target shots: 0
- Close-range bad-angle shots: 0
- On-target toe pokes: 0
- Attacker reset passes (BACK/WALL): 1

### Top Zigzag Offenders
- Team A CB Andy Najar: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A CM Hany Mukhtar: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A CB Daniel Lovitz: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A LB Walker Zimmerman: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B ST João Klauss de Mello: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A RB Alex Muyl: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B CB Conrad Wallem: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B CB Henry Kessler: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%

## Suggested Improvements
- Final-third recycling is still too common. Tighten attacker backpass vetoes and extend the carry-or-shoot window before resets are allowed.
- Shape is still too central. Strengthen weak-side width anchors and reduce carrier-gravity pull on wide roles and midfield support.
- Too much of the final action still comes through central roles. Encourage wider occupation and more wing-led creation before the finish.
- Corner volume is still unrealistically low. Review deflection, blocked-shot, and out-of-play logic so wider attacks can produce restarts naturally.
