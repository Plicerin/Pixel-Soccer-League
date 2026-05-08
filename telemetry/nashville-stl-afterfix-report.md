# Telemetry Analysis

## Match
- Fixture: Nashville SC 0-0 St. Louis City SC
- Session: headless-report:nashville-stl-afterfix.json:0
- Timestamp: 2026-05-03T05:58:56.392Z
- Shots: 0-4
- Shots on target: 0-1

## Tuning KPIs
- Overall: 41.8 (red)
- Baseline Fit: 16 (red) — one-match MLS stat fit: goals ~2-3, shots ~26, SOT ~9, corners ~8, long-range SOT <=3
  - Inputs: goals 0, shots 4, SOT 1, long-range SOT 0, corners 0
- Soccer Structure: 34.3 (red) — soccer-like structure: width >=18, center+narrow <=35%, overload share >=25%, danger marking >=78%, shot corridor defenders >=1.2, empty-box shots <=35%, pattern touches >=2, real crosses >=5
  - Inputs: width 13.28/14.66, center+narrow worst 90.9%, overload share 0%, danger marked 100%, shot corridor defenders 0, empty-box shots 100%, pattern touches 0, real crosses 0
- Tuning Efficiency: 75 (watch) — low-tweak debt: forced shots <=55%, final-third backpasses <=18, lateral flips <=90, direct-blocker passes <=70, broken rows <=10%
  - Inputs: forced shots 100%, final-third backpasses 0, zigzag flips 0, direct-blocker passes 0, broken shot rows 0%

## MLS Baseline Comparison
- Total goals: 0 vs 2.78 baseline (drift -2.78)
- Total shots: 4 vs 26.2 baseline (drift -22.2)
- Total shots on target: 1 vs 9.4 baseline (drift -8.4)
- Total corners: 0 vs 8 baseline (drift -8)

## Match Summary Telemetry
- Event count: 116
- Pass log events: 24
- Carrier traces: 0
- Attacker zone traces: 0
- Shot decisions: 3
- Pass decisions: 0
- Interceptions: 0
- Turnovers: 0

## Decision Telemetry
- Forced shots: 3 of 3
- AI_SIMPLE broken rows: 0 of 0
- AI_SIMPLE forced broken rows: 0
- Long-range shot decisions: 3
- Pressured long-range shot decisions: 3
- Attacker final-third backpasses: 0
- Attacker in-box backpasses: 0
- Direct-blocker pass decisions: 0

## Movement / Facing
- Carrier traces analyzed: 0
- Carriers tracked: 0
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
- Nashville SC: avg width 13.28, avg |avgZ| 1.27, center-locked 86.4%, center+narrow 81.8%
- St. Louis City SC: avg width 14.66, avg |avgZ| 0.64, center-locked 100%, center+narrow 90.9%
- Nashville SC wide touches vs central touches: 0 vs 0
- St. Louis City SC wide touches vs central touches: 0 vs 0
- Nashville SC wide shots vs central shots: 0 vs 0
- St. Louis City SC wide shots vs central shots: 0 vs 0
- Position owner samples: 0
- Nashville SC owner mix: (none)
- St. Louis City SC owner mix: (none)
- Nashville SC wide owner avg |z| 0, target |z| 0: (none)
- St. Louis City SC wide owner avg |z| 0, target |z| 0: (none)

## Phase Time Distribution
- Nashville SC: buildup 0% | progression 0% | chance 0% | finish 0% (0 samples)
- St. Louis City SC: buildup 0% | progression 0% | chance 0% | finish 0% (0 samples)

## Pass Decisions By Zone
- Evaluated: 
- Executed (shouldPass): 

## Pattern Tempo (realism fit per pattern type)

## Neo-Play Effectiveness
- Starts: 0; deliveries: 0; shot-producing deliveries: 0 (0%); goal-producing deliveries: 0 (0%)
(no neo-play delivery data)

## Defenders In Box At Goal (defensive presence)
- Goals: 0, avg 0 defenders + 0 attackers in box at moment of goal
- Distribution: (none)

## Shot Box Defense
- Shots sampled: 3
- Avg defenders in box: 0
- Avg defenders in goal corridor: 0
- Empty-box shots: 3
- Empty-corridor shots: 3
- Samples:
  - Team B Chris Durkin RM @ 44.8s: 0 box, 0 corridor defenders
  - Team B Chris Durkin RM @ 46s: 0 box, 0 corridor defenders
  - Team B João Klauss de Mello ST @ 191.3s: 0 box, 0 corridor defenders

## Final-Third Overloads (attacking commitment)
- Nashville SC: 0/0 1s-windows had 3+ attackers in opp final third (max 0)
- St. Louis City SC: 0/0 1s-windows had 3+ attackers in opp final third (max 0)

## Danger-Zone Marking
- Samples: 0
- Nashville SC attackers marked: 0/0 (0%), avg nearest defender 0
- St. Louis City SC attackers marked: 0/0 (0%), avg nearest defender 0

## Multi-Touch Opp-Half Sequences (build-up quality)
- Sequences with 2+ distinct players touching ball in opp half: 3 of 8
- Opp-half touches total: 25
- Avg distinct players per possession: 1.5
- Examples:
  - Team B @ 0.0s: 13 touches by Chris Durkin → Cedric Teuchert → João Klauss de Mello → Timo Baumgartl → Marcel Hartel
  - Team A @ 35.9s: 2 touches by Sam Surridge → Jacob Shaffelburg
  - Team B @ 44.8s: 8 touches by RM → Chris Durkin → Marcel Hartel

## Kickoff Receiver / Goal Correlation
- Kickoff passes recorded: 1; kickoff receives recorded: 0; scorer events: 0
- Nashville SC: 0/0 goals scored by latest kickoff receiver (0%)
- St. Louis City SC: 0/0 goals scored by latest kickoff receiver (0%)
- Nashville SC kickoff receivers: (none)
- St. Louis City SC kickoff receivers: Chris Durkin RM recv:0 intended:1 goals:0

## Pattern Engine (Phase 2.5)
- Total pattern starts: 0 (A 0, B 0)
- Distinct types per team: A 0, B 0
- Types A: (none)
- Types B: (none)
- Avg duration by type: (none)
- End reasons: (none)
- Shots by active pattern: NONE 3
- Goals by active pattern: (none)

## Role Positions (team-in-possession frames)
- Nashville SC:
- St. Louis City SC:

## Event Stream Review
- Event-stream shots: 3
- Event-stream on-target shots: 0
- Long-range on-target shots: 0
- Close-range bad-angle shots: 0
- On-target toe pokes: 0
- Attacker reset passes (BACK/WALL): 6

## Suggested Improvements
- Final-third recycling is still too common. Tighten attacker backpass vetoes and extend the carry-or-shoot window before resets are allowed.
- Shape is still too central. Strengthen weak-side width anchors and reduce carrier-gravity pull on wide roles and midfield support.
- Too many shots are arriving with an empty defensive box. Keep one presser, but pull two non-pressing defenders into the goal corridor when the carrier reaches shooting range.
- Too much of the final action still comes through central roles. Encourage wider occupation and more wing-led creation before the finish.
- Corner volume is still unrealistically low. Review deflection, blocked-shot, and out-of-play logic so wider attacks can produce restarts naturally.
