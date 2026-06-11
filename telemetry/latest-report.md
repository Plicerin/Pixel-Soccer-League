# Telemetry Analysis

## Match
- Fixture: Ecuador 3-0 Portugal
- Session: simple-1780771356280-2ultig
- Timestamp: 2026-06-06T18:54:36.184Z
- Runtime duration: 10 minutes total (300s halves)
- Simulated match duration: 90 minutes
- Runtime provenance: token 1780771356128-azxiozu8b29, booted 2026-06-06T18:42:36.303Z
- Runtime config: scale 9, speed 1, restart delays 2/3, cpuVsCpu true, interactive halftime true, persisted from snapshot yes
- Shots: 5-12
- Shots on target: 3-4

## Tuning KPIs
- Overall: 71.9 (watch)
- Baseline Fit: 16 (red) — one-match MLS runtime-scaled raw stat fit: goals ~0.31, shots ~2.89, SOT ~1.06, corners ~0.89
  - Inputs: goals 3, shots 17, SOT 7, long-range SOT 0, corners 2
- Soccer Structure: 100 (green) — advanced shape/pattern/cross structure is out of scope for simple-v1
  - Inputs: width 26.59/26.82, center+narrow worst 0.7%, overload share 6.1%, danger marked undefined%, shot corridor defenders undefined, empty-box shots undefined%, pattern touches undefined, real crosses undefined
- Tuning Efficiency: 99.8 (green) — low-tweak debt: forced shots <=55%, final-third backpasses <=18, lateral flips <=90, direct-blocker passes <=70, broken rows <=10%
  - Inputs: forced shots 0%, final-third backpasses 0, zigzag flips 1, direct-blocker passes 0, broken shot rows 0%

## MLS Baseline Comparison
- Baselines below are runtime-scaled MLS raw expectations for 10 runtime minutes.
- Total goals: 3 vs 0.31 baseline (drift 2.69)
- Total shots: 17 vs 2.91 baseline (drift 14.09)
- Total shots on target: 7 vs 1.04 baseline (drift 5.96)
- Total corners: 2 vs 0.89 baseline (drift 1.11)

## Match Summary Telemetry
- Event count: 5000
- Pass log events: 410
- Carrier traces: 589
- Attacker zone traces: 1035
- Shot decisions: 17
- Pass decisions: 378
- Interceptions: 19
- Tackles: 4
- Fouls: 4
- Offsides: 1
- Turnovers: 26
- Keeper saves: 4-0
- Restart counters: corners 2, throw-ins 7, goal kicks 10, free kicks 12, penalties 0

## Decision Telemetry
- Forced shots: 0 of 17
- AI_SIMPLE broken rows: 0 of 0
- AI_SIMPLE forced broken rows: 0
- Long-range shot decisions: 11
- Pressured long-range shot decisions: 0
- Attacker final-third backpasses: 0
- Attacker in-box backpasses: 0
- Direct-blocker pass decisions: 0

## Movement / Facing
- Carrier traces analyzed: 589
- Carriers tracked: 19
- Forward-carry samples: 472
- Lateral direction flips: 1
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
- Ecuador: avg width 26.59, avg |avgZ| 2.19, center-locked 76.3%, center+narrow 0.7%
- Portugal: avg width 26.82, avg |avgZ| 2.21, center-locked 76.6%, center+narrow 0%
- Ecuador wide touches vs central touches: 93 vs 21
- Portugal wide touches vs central touches: 99 vs 48
- Ecuador wide shots vs central shots: 0 vs 5
- Portugal wide shots vs central shots: 0 vs 12
- Position owner samples: 3205
- Ecuador owner mix: RW:292 | LW:291 | ST:146 | GK:145 | LCB:145 | CB:145 | RCB:145 | LCM:145 | RCM:145
- Portugal owner mix: GK:146 | LCB:146 | CB:146 | RCB:146 | LW:292 | LCM:146 | RCM:146 | RW:292 | ST:146
- Ecuador wide owner avg |z| 12.9, target |z| 12.79: RW:292 | LW:291
- Portugal wide owner avg |z| 12.94, target |z| 13: LW:292 | RW:292

## Phase Time Distribution
- Ecuador: buildup 20.5% | progression 79.5% | chance 0% | finish 0% (322 samples)
- Portugal: buildup 9% | progression 88% | chance 3% | finish 0% (267 samples)

## Pass Decisions By Zone
- Evaluated: KICKOFF:5 | BUILDUP:323 | PROGRESSION:45 | CHANCE_CREATION:5
- Executed (shouldPass): KICKOFF:5 | BUILDUP:323 | PROGRESSION:45 | CHANCE_CREATION:5

## Pattern Tempo (realism fit per pattern type)

## Neo-Play Effectiveness
- Starts: 0; deliveries: 5; shot-producing deliveries: 0 (0%); goal-producing deliveries: 0 (0%)
- WIDE_DELIVERY: starts 0, deliveries 5, crosses 5, effective 0/5 (0%), goals 0/5 (0%)

## Defenders In Box At Goal (defensive presence)
- Goals: 3, avg 1 defenders + 0 attackers in box at moment of goal
- Distribution: 0 defenders: 1 goals, 1 defenders: 1 goals, 2 defenders: 1 goals
- Samples:
  - A E ST 10 #10 @ 38': 0 defenders, 0 attackers (undefined)
  - A E ST 10 #10 @ 59': 1 defenders, 0 attackers (undefined)
  - A E ST 10 #10 @ 78': 2 defenders, 0 attackers (undefined)

## Shot Box Defense
- Shots sampled: 17
- Avg defenders in box: 0.82
- Avg defenders in goal corridor: 1.88
- Empty-box shots: 12
- Empty-corridor shots: 5
- Samples:
  - Team B P ST 10 ST @ 207s: 0 box, 2 corridor defenders
  - Team B P ST 10 ST @ 269.3s: 0 box, 0 corridor defenders
  - Team B P ST 10 ST @ 837.5s: 0 box, 2 corridor defenders
  - Team B P ST 10 ST @ 862.4s: 5 box, 7 corridor defenders
  - Team B P ST 10 ST @ 974.2s: 2 box, 3 corridor defenders
  - Team A E ST 10 ST @ 1496.8s: 0 box, 0 corridor defenders
  - Team A E ST 10 ST @ 2264.7s: 0 box, 0 corridor defenders
  - Team B P ST 10 ST @ 2435.4s: 0 box, 2 corridor defenders

## Final-Third Overloads (attacking commitment)
- Ecuador: 2/127 1s-windows had 3+ attackers in opp final third (max 3)
- Portugal: 14/132 1s-windows had 3+ attackers in opp final third (max 9)

## Danger-Zone Marking
- Samples: 419
- Ecuador attackers marked: 31/189 (16.4%), avg nearest defender 4.73
- Portugal attackers marked: 40/230 (17.4%), avg nearest defender 4.4
- Worst unmarked samples:
  - Ecuador E RW 11 W @ 2141.7s: nearest defender 8.95, 21.6u from goal (RW)
  - Ecuador E LW 9 W @ 1902.1s: nearest defender 8.94, 20.5u from goal (LW)
  - Ecuador E LW 9 W @ 2567.9s: nearest defender 8.86, 20.9u from goal (LW)
  - Portugal P LW 9 W @ 1663.1s: nearest defender 15.42, 20.3u from goal (LW)
  - Portugal P LW 9 W @ 1672.1s: nearest defender 12.95, 17.6u from goal (LW)
  - Portugal P RW 11 W @ 1649.9s: nearest defender 10.63, 18u from goal (RW)

## Multi-Touch Opp-Half Sequences (build-up quality)
- Sequences with 2+ distinct players touching ball in opp half: 15 of 32
- Opp-half touches total: 96
- Avg distinct players per possession: 1.25
- Examples:
  - Team A @ 1431.5s: 8 touches by E LCB 2 → E CB 3 → E LCM 6
  - Team A @ 1511.5s: 2 touches by E CB 3 → E RCB 4
  - Team A @ 1605.3s: 2 touches by E LM 5 → E LCM 6
  - Team A @ 1747.5s: 4 touches by E RCM 7 → E RCB 4
  - Team B @ 1824.3s: 8 touches by P RCB 4 → P RCM 7 → P RM 8
  - Team B @ 1931.6s: 5 touches by P RCM 7 → P RW 11

## Kickoff Receiver / Goal Correlation
- Kickoff passes recorded: 0; kickoff receives recorded: 0; scorer events: 0
- Ecuador: 0/0 goals scored by latest kickoff receiver (0%)
- Portugal: 0/0 goals scored by latest kickoff receiver (0%)
- Ecuador kickoff receivers: (none)
- Portugal kickoff receivers: (none)

## Pattern Engine (Phase 2.5)
- Total pattern starts: 0 (A 0, B 0)
- Distinct types per team: A 0, B 0
- Types A: (none)
- Types B: (none)
- Avg duration by type: (none)
- End reasons: (none)
- Shots by active pattern: NONE 6
- Goals by active pattern: NONE 1

## Role Positions (team-in-possession frames)
- Ecuador:
  - CM: avgX -1.65, avg|Z| 6.69, avgDistToGoal 32.08 (13 samples); opp-half fwdX n/a (0); final-third |z| n/a (0)
  - ST: avgX -16.03, avg|Z| 2.74, avgDistToGoal 17.07 (139 samples); opp-half fwdX n/a (0); final-third |z| 2.75 (126)
  - W: avgX -9.97, avg|Z| 13, avgDistToGoal 26.49 (358 samples); opp-half fwdX n/a (0); final-third |z| 9.98 (63)
- Portugal:
  - CB: avgX 13.22, avg|Z| 5.01, avgDistToGoal 20.45 (7 samples); opp-half fwdX n/a (0); final-third |z| 4.73 (4)
  - CM: avgX 13.82, avg|Z| 5.67, avgDistToGoal 20.17 (7 samples); opp-half fwdX n/a (0); final-third |z| 5.73 (4)
  - ST: avgX 16.36, avg|Z| 2.71, avgDistToGoal 16.71 (141 samples); opp-half fwdX n/a (0); final-third |z| 2.65 (132)
  - W: avgX 10.81, avg|Z| 12.81, avgDistToGoal 25.74 (370 samples); opp-half fwdX n/a (0); final-third |z| 9.72 (90)

## Event Stream Review
- Event-stream shots: 6
- Event-stream on-target shots: 2
- Long-range on-target shots: 0
- Close-range bad-angle shots: 0
- On-target toe pokes: 0
- Attacker reset passes (BACK/WALL): 0

### Top Zigzag Offenders
- Team B ST P ST 10: flips 1, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A W E RM 8: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B CM P RCM 7: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A CM E RCM 7: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B W P RM 8: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A W E RW 11: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B CM P LCM 6: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B W P LM 5: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%

## Suggested Improvements
- Long-range shot accuracy is still too clean. Push more off-frame bias onto 20+ yard attempts, especially central shots and pressured strikes.
- Final-third recycling is still too common. Tighten attacker backpass vetoes and extend the carry-or-shoot window before resets are allowed.
