# Telemetry Analysis

## Match
- Fixture: Simple Model Aggregate 0.1-0.1 MLS KPI Target
- Session: simple-kpi-aggregate:simple-model-kpi.json
- Timestamp: 2026-05-14T18:34:57.016Z
- Runtime duration: 90 minutes total (2700s halves)
- Simulated match duration: 90 minutes
- Shots: 1.3-1.3
- Shots on target: 0.6-0.6

## Tuning KPIs
- Overall: 72 (watch)
- Baseline Fit: 16 (red) — one-match MLS full-match raw stat fit: goals ~2.8, shots ~26, SOT ~9.5, corners ~8
  - Inputs: goals 0.2, shots 2.6, SOT 1.2, long-range SOT 0, corners 0.8
- Soccer Structure: 100 (green) — advanced shape/pattern/cross structure is out of scope for simple-v1
  - Inputs: width 0/0, center+narrow worst 0%, overload share 0%, danger marked undefined%, shot corridor defenders undefined, empty-box shots undefined%, pattern touches undefined, real crosses undefined
- Tuning Efficiency: 100 (green) — low-tweak debt: forced shots <=55%, final-third backpasses <=18, lateral flips <=90, direct-blocker passes <=70, broken rows <=10%
  - Inputs: forced shots 0%, final-third backpasses 0, zigzag flips 0, direct-blocker passes 0, broken shot rows 0%

## MLS Baseline Comparison
- Baselines below are full-match MLS raw expectations; selected runtime length does not scale KPI targets.
- Total goals: 0.2 vs 2.78 baseline (drift -2.58)
- Total shots: 2.6 vs 26.2 baseline (drift -23.6)
- Total shots on target: 1.2 vs 9.4 baseline (drift -8.2)
- Total corners: 0.8 vs 8 baseline (drift -7.2)

## Match Summary Telemetry
- Event count: 0
- Pass log events: 0
- Carrier traces: 0
- Attacker zone traces: 0
- Shot decisions: 0
- Pass decisions: 0
- Interceptions: 0
- Tackles: 3.8
- Fouls: 3.2
- Offsides: 5.8
- Turnovers: 0
- Keeper saves: 0.5-0.5
- Restart counters: corners 0.8, throw-ins 0, goal kicks 0, free kicks 0

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
- Simple Model Aggregate: avg width 0, avg |avgZ| 0, center-locked 0%, center+narrow 0%
- MLS KPI Target: avg width 0, avg |avgZ| 0, center-locked 0%, center+narrow 0%
- Simple Model Aggregate wide touches vs central touches: 0 vs 0
- MLS KPI Target wide touches vs central touches: 0 vs 0
- Simple Model Aggregate wide shots vs central shots: 0 vs 0
- MLS KPI Target wide shots vs central shots: 0 vs 0
- Position owner samples: 0
- Simple Model Aggregate owner mix: (none)
- MLS KPI Target owner mix: (none)
- Simple Model Aggregate wide owner avg |z| 0, target |z| 0: (none)
- MLS KPI Target wide owner avg |z| 0, target |z| 0: (none)

## Phase Time Distribution
- Simple Model Aggregate: buildup 0% | progression 0% | chance 0% | finish 0% (0 samples)
- MLS KPI Target: buildup 0% | progression 0% | chance 0% | finish 0% (0 samples)

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
- Shots sampled: 0
- Avg defenders in box: 0
- Avg defenders in goal corridor: 0
- Empty-box shots: 0
- Empty-corridor shots: 0

## Final-Third Overloads (attacking commitment)
- Simple Model Aggregate: 0/0 1s-windows had 3+ attackers in opp final third (max 0)
- MLS KPI Target: 0/0 1s-windows had 3+ attackers in opp final third (max 0)

## Danger-Zone Marking
- Samples: 0
- Simple Model Aggregate attackers marked: 0/0 (0%), avg nearest defender 0
- MLS KPI Target attackers marked: 0/0 (0%), avg nearest defender 0

## Multi-Touch Opp-Half Sequences (build-up quality)
- Sequences with 2+ distinct players touching ball in opp half: 0 of 0
- Opp-half touches total: 0
- Avg distinct players per possession: 0

## Kickoff Receiver / Goal Correlation
- Kickoff passes recorded: 0; kickoff receives recorded: 0; scorer events: 0
- Simple Model Aggregate: 0/0 goals scored by latest kickoff receiver (0%)
- MLS KPI Target: 0/0 goals scored by latest kickoff receiver (0%)
- Simple Model Aggregate kickoff receivers: (none)
- MLS KPI Target kickoff receivers: (none)

## Pattern Engine (Phase 2.5)
- Total pattern starts: 0 (A 0, B 0)
- Distinct types per team: A 0, B 0
- Types A: (none)
- Types B: (none)
- Avg duration by type: (none)
- End reasons: (none)
- Shots by active pattern: (none)
- Goals by active pattern: (none)

## Role Positions (team-in-possession frames)
- Simple Model Aggregate:
- MLS KPI Target:

## Event Stream Review
- Event-stream shots: 0
- Event-stream on-target shots: 0
- Long-range on-target shots: 0
- Close-range bad-angle shots: 0
- On-target toe pokes: 0
- Attacker reset passes (BACK/WALL): 0

## Suggested Improvements
- Full-match attacking volume is too low: 2.6 shots vs the 20-35 MLS target. Increase action cadence and shot selection; do not treat compressed runtime as a partial-match sample.
- Full-match shot-on-target volume is too low: 1.2 SOT vs the 7-16 MLS target. Raise credible shot frequency before accepting goalkeeper or finishing tuning.
- Full-match pass volume is too low: 151.8 passes vs the 450-750 MLS target. Runtime length must not lower possession/action production KPIs.
