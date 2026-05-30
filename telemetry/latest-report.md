# Telemetry Analysis

## Match
- Fixture: Canada 0-0 Belgium
- Session: ft-1780086053904
- Timestamp: 2026-05-29T20:20:53.905Z
- Runtime duration: 90 minutes total (2700s halves)
- Simulated match duration: 90 minutes
- Shots: 4-2
- Shots on target: 2-0

## Tuning KPIs
- Overall: 72 (watch)
- Baseline Fit: 16 (red) — one-match MLS full-match raw stat fit: goals ~2.8, shots ~26, SOT ~9.5, corners ~8
  - Inputs: goals 0, shots 6, SOT 2, long-range SOT 0, corners 0
- Soccer Structure: 100 (green) — advanced shape/pattern/cross structure is out of scope for simple-v1
  - Inputs: width 31.38/30.12, center+narrow worst 0%, overload share 0%, danger marked undefined%, shot corridor defenders undefined, empty-box shots undefined%, pattern touches undefined, real crosses undefined
- Tuning Efficiency: 100 (green) — low-tweak debt: forced shots <=55%, final-third backpasses <=18, lateral flips <=90, direct-blocker passes <=70, broken rows <=10%
  - Inputs: forced shots 0%, final-third backpasses 0, zigzag flips 0, direct-blocker passes 0, broken shot rows 0%

## MLS Baseline Comparison
- Baselines below are full-match MLS raw expectations; selected runtime length does not scale KPI targets.
- Total goals: 0 vs 2.78 baseline (drift -2.78)
- Total shots: 6 vs 26.2 baseline (drift -20.2)
- Total shots on target: 2 vs 9.4 baseline (drift -7.4)
- Total corners: 0 vs 8 baseline (drift -8)

## Match Summary Telemetry
- Event count: 5000
- Pass log events: 287
- Carrier traces: 789
- Attacker zone traces: 945
- Shot decisions: 6
- Pass decisions: 270
- Interceptions: 13
- Tackles: 6
- Fouls: 9
- Offsides: 0
- Turnovers: 13
- Keeper saves: 0-2
- Restart counters: corners 0, throw-ins 2, goal kicks 6, free kicks 9, penalties 0

## Decision Telemetry
- Forced shots: 0 of 6
- AI_SIMPLE broken rows: 0 of 0
- AI_SIMPLE forced broken rows: 0
- Long-range shot decisions: 5
- Pressured long-range shot decisions: 0
- Attacker final-third backpasses: 0
- Attacker in-box backpasses: 0
- Direct-blocker pass decisions: 0

## Movement / Facing
- Carrier traces analyzed: 789
- Carriers tracked: 18
- Forward-carry samples: 40
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
- Canada: avg width 31.38, avg |avgZ| 2.01, center-locked 83.5%, center+narrow 0%
- Belgium: avg width 30.12, avg |avgZ| 2.01, center-locked 80.6%, center+narrow 0%
- Canada wide touches vs central touches: 118 vs 17
- Belgium wide touches vs central touches: 97 vs 7
- Canada wide shots vs central shots: 0 vs 4
- Belgium wide shots vs central shots: 0 vs 2
- Position owner samples: 3165
- Canada owner mix: RCB:144 | LW:288 | LCM:144 | RCM:144 | RW:288 | ST:144 | GK:143 | LCB:143 | CB:143
- Belgium owner mix: GK:144 | LCB:144 | CB:144 | RCB:144 | LW:288 | LCM:144 | RCM:144 | RW:288 | ST:144
- Canada wide owner avg |z| 13.73, target |z| 12.68: LW:288 | RW:288
- Belgium wide owner avg |z| 13.61, target |z| 12.99: LW:288 | RW:288

## Phase Time Distribution
- Canada: buildup 0% | progression 82.4% | chance 17.6% | finish 0% (392 samples)
- Belgium: buildup 13.4% | progression 82.4% | chance 4.3% | finish 0% (397 samples)

## Pass Decisions By Zone
- Evaluated: KICKOFF:2 | BUILDUP:248 | PROGRESSION:20
- Executed (shouldPass): KICKOFF:2 | BUILDUP:248 | PROGRESSION:20

## Pattern Tempo (realism fit per pattern type)

## Neo-Play Effectiveness
- Starts: 0; deliveries: 0; shot-producing deliveries: 0 (0%); goal-producing deliveries: 0 (0%)
(no neo-play delivery data)

## Defenders In Box At Goal (defensive presence)
- Goals: 0, avg 0 defenders + 0 attackers in box at moment of goal
- Distribution: (none)

## Shot Box Defense
- Shots sampled: 6
- Avg defenders in box: 1
- Avg defenders in goal corridor: 1
- Empty-box shots: 0
- Empty-corridor shots: 0
- Samples:
  - Team A C ST 10 ST @ 2376.8s: 1 box, 1 corridor defenders
  - Team A C ST 10 ST @ 2144.4s: 1 box, 1 corridor defenders
  - Team A C ST 10 ST @ 2293.7s: 1 box, 1 corridor defenders
  - Team B B ST 10 ST @ 2397.9s: 1 box, 1 corridor defenders
  - Team A C ST 10 ST @ 2518.2s: 1 box, 1 corridor defenders
  - Team B B ST 10 ST @ 2668.1s: 1 box, 1 corridor defenders

## Final-Third Overloads (attacking commitment)
- Canada: 0/97 1s-windows had 3+ attackers in opp final third (max 2)
- Belgium: 0/144 1s-windows had 3+ attackers in opp final third (max 1)

## Danger-Zone Marking
- Samples: 254
- Canada attackers marked: 0/110 (0%), avg nearest defender 7.79
- Belgium attackers marked: 0/144 (0%), avg nearest defender 6.31
- Worst unmarked samples:
  - Canada C ST 10 ST @ 2113.2s: nearest defender 8.99, 18.4u from goal (ST)
  - Canada C ST 10 ST @ 2104.2s: nearest defender 8.96, 18.5u from goal (ST)
  - Canada C ST 10 ST @ 2122.2s: nearest defender 8.92, 18.3u from goal (ST)
  - Belgium B ST 10 ST @ 1321.2s: nearest defender 8.92, 19.2u from goal (ST)
  - Belgium B ST 10 ST @ 1330.2s: nearest defender 8.86, 19.2u from goal (ST)
  - Belgium B ST 10 ST @ 1339.2s: nearest defender 8.75, 19.1u from goal (ST)

## Multi-Touch Opp-Half Sequences (build-up quality)
- Sequences with 2+ distinct players touching ball in opp half: 9 of 16
- Opp-half touches total: 62
- Avg distinct players per possession: 1.44
- Examples:
  - Team A @ 1326.2s: 2 touches by C RCM 7 → C RM 8
  - Team B @ 1470.5s: 23 touches by B RCM 7 → B RM 8 → B LCM 6 → B LM 5
  - Team A @ 1719.3s: 4 touches by C RM 8 → C RCM 7
  - Team B @ 1781.7s: 4 touches by B RCB 4 → B CB 3 → B LCB 2
  - Team B @ 2098.3s: 2 touches by B LCM 6 → B LM 5
  - Team A @ 2180.4s: 5 touches by C RM 8 → C RCM 7

## Kickoff Receiver / Goal Correlation
- Kickoff passes recorded: 0; kickoff receives recorded: 0; scorer events: 0
- Canada: 0/0 goals scored by latest kickoff receiver (0%)
- Belgium: 0/0 goals scored by latest kickoff receiver (0%)
- Canada kickoff receivers: (none)
- Belgium kickoff receivers: (none)

## Pattern Engine (Phase 2.5)
- Total pattern starts: 0 (A 0, B 0)
- Distinct types per team: A 0, B 0
- Types A: (none)
- Types B: (none)
- Avg duration by type: (none)
- End reasons: (none)
- Shots by active pattern: NONE 5
- Goals by active pattern: (none)

## Role Positions (team-in-possession frames)
- Canada:
  - ST: avgX -13.1, avg|Z| 1.46, avgDistToGoal 19.76 (144 samples); opp-half fwdX n/a (0); final-third |z| 1.11 (97)
  - W: avgX -9.85, avg|Z| 13.7, avgDistToGoal 26.77 (320 samples); opp-half fwdX n/a (0); final-third |z| 12.33 (13)
- Belgium:
  - ST: avgX 16.7, avg|Z| 1.58, avgDistToGoal 16.19 (144 samples); opp-half fwdX n/a (0); final-third |z| 1.58 (144)
  - W: avgX 9.86, avg|Z| 13.77, avgDistToGoal 26.87 (337 samples); opp-half fwdX n/a (0); final-third |z| n/a (0)

## Event Stream Review
- Event-stream shots: 5
- Event-stream on-target shots: 2
- Long-range on-target shots: 0
- Close-range bad-angle shots: 0
- On-target toe pokes: 0
- Attacker reset passes (BACK/WALL): 0

### Top Zigzag Offenders
- Team A W C LW 9: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B CM B RCM 7: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B W B RM 8: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B CM B LCM 6: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A W C LM 5: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A W C RM 8: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A ST C ST 10: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B W B LM 5: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%

## Suggested Improvements
- Full-match attacking volume is too low: 6 shots vs the 20-35 MLS target. Increase action cadence and shot selection; do not treat compressed runtime as a partial-match sample.
- Full-match shot-on-target volume is too low: 2 SOT vs the 7-16 MLS target. Raise credible shot frequency before accepting goalkeeper or finishing tuning.
- Full-match pass volume is too low: 287 passes vs the 450-750 MLS target. Runtime length must not lower possession/action production KPIs.
- Scoreless output with very low shot volume is not a defensive 0-0; it is an underproduction failure. Tune shot creation first, then finishing.
- Final-third recycling is still too common. Tighten attacker backpass vetoes and extend the carry-or-shoot window before resets are allowed.
