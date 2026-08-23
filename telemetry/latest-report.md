# Telemetry Analysis

## Match
- Fixture: Brazil 0-0 Argentina
- Session: simple-1783720261962-k0fug9
- Timestamp: 2026-07-10T21:57:01.015Z
- Runtime duration: 5 minutes total (150s halves)
- Simulated match duration: 90 minutes
- Runtime provenance: token 1783720260845-rcrb8qb5geh, booted 2026-07-10T21:51:00.999Z
- Runtime config: scale 18, speed 1, restart delays 2/3, cpuVsCpu true, interactive halftime true, persisted from snapshot yes
- Shots: 4-5
- Shots on target: 1-1

## Tuning KPIs
- Overall: 70.1 (watch)
- Baseline Fit: 35.3 (red) — one-match MLS runtime-scaled raw stat fit: goals ~0.16, shots ~1.44, SOT ~0.53, corners ~0.44
  - Inputs: goals 0, shots 9, SOT 2, long-range SOT 0, corners 2
- Soccer Structure: 100 (green) — advanced shape/pattern/cross structure is out of scope for simple-v1
  - Inputs: width 27.52/28.6, center+narrow worst 3.1%, overload share 18.9%, danger marked undefined%, shot corridor defenders undefined, empty-box shots undefined%, pattern touches undefined, real crosses undefined
- Tuning Efficiency: 75 (watch) — low-tweak debt: forced shots <=55%, final-third backpasses <=18, lateral flips <=90, direct-blocker passes <=70, broken rows <=10%
  - Inputs: forced shots 55.6%, final-third backpasses 0, zigzag flips 0, direct-blocker passes 0, broken shot rows 0%

## MLS Baseline Comparison
- Baselines below are runtime-scaled MLS raw expectations for 5 runtime minutes.
- Total goals: 0 vs 0.15 baseline (drift -0.15)
- Total shots: 9 vs 1.46 baseline (drift 7.54)
- Total shots on target: 2 vs 0.52 baseline (drift 1.48)
- Total corners: 2 vs 0.44 baseline (drift 1.56)

## Match Summary Telemetry
- Event count: 5000
- Pass log events: 60
- Carrier traces: 1022
- Attacker zone traces: 944
- Shot decisions: 9
- Pass decisions: 44
- Interceptions: 0
- Tackles: 11
- Fouls: 3
- Offsides: 0
- Turnovers: 7
- Keeper saves: 1-1
- Restart counters: corners 3, throw-ins 0, goal kicks 7, free kicks 7, penalties 0

## Decision Telemetry
- Forced shots: 5 of 9
- AI_SIMPLE broken rows: 0 of 0
- AI_SIMPLE forced broken rows: 0
- Long-range shot decisions: 1
- Pressured long-range shot decisions: 0
- Attacker final-third backpasses: 0
- Attacker in-box backpasses: 0
- Direct-blocker pass decisions: 0

## Movement / Facing
- Carrier traces analyzed: 1022
- Carriers tracked: 15
- Forward-carry samples: 400
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
- Brazil: avg width 27.52, avg |avgZ| 1.26, center-locked 93.2%, center+narrow 3.1%
- Argentina: avg width 28.6, avg |avgZ| 1.08, center-locked 94.2%, center+narrow 1.4%
- Brazil wide touches vs central touches: 9 vs 26
- Argentina wide touches vs central touches: 13 vs 0
- Brazil wide shots vs central shots: 0 vs 4
- Argentina wide shots vs central shots: 0 vs 0
- Position owner samples: 2970
- Brazil owner mix: GK:135 | LB:135 | LCB:135 | RCB:135 | RB:135 | LCM:135 | DM:135 | RCM:135 | LW:135 | ST:135 | RW:135
- Argentina owner mix: GK:135 | LB:135 | LCB:135 | RCB:135 | RB:135 | LW:135 | LCM:135 | RCM:135 | RW:135 | LST:135 | RST:135
- Brazil wide owner avg |z| 12.34, target |z| 12.72: LB:135 | RB:135 | LW:135 | RW:135
- Argentina wide owner avg |z| 13.7, target |z| 13.98: LB:135 | RB:135 | LW:135 | RW:135

## Phase Time Distribution
- Brazil: buildup 35.3% | progression 60.4% | chance 4.3% | finish 0% (439 samples)
- Argentina: buildup 7.7% | progression 61.6% | chance 30.7% | finish 0% (583 samples)

## Pass Decisions By Zone
- Evaluated: KICKOFF:2 | BUILDUP:22 | PROGRESSION:16 | CHANCE_CREATION:4
- Executed (shouldPass): KICKOFF:2 | BUILDUP:22 | PROGRESSION:16 | CHANCE_CREATION:4

## Pattern Tempo (realism fit per pattern type)

## Neo-Play Effectiveness
- Starts: 0; deliveries: 0; shot-producing deliveries: 0 (0%); goal-producing deliveries: 0 (0%)
(no neo-play delivery data)

## Defenders In Box At Goal (defensive presence)
- Goals: 0, avg 0 defenders + 0 attackers in box at moment of goal
- Distribution: (none)

## Shot Box Defense
- Shots sampled: 9
- Avg defenders in box: 2.33
- Avg defenders in goal corridor: 3.89
- Empty-box shots: 1
- Empty-corridor shots: 0
- Samples:
  - Team B A LST 10 ST @ 1008.1s: 4 box, 5 corridor defenders
  - Team B A LST 10 ST @ 1435.2s: 4 box, 5 corridor defenders
  - Team A B DM 7 DM @ 1665.6s: 1 box, 5 corridor defenders
  - Team A B ST 10 ST @ 1713.7s: 4 box, 7 corridor defenders
  - Team A B ST 10 ST @ 2076.7s: 4 box, 2 corridor defenders
  - Team B A LST 10 ST @ 2263.9s: 1 box, 1 corridor defenders
  - Team B A LST 10 ST @ 1005.5s: 1 box, 4 corridor defenders
  - Team B A LCM 7 CM @ 1192.5s: 2 box, 4 corridor defenders

## Final-Third Overloads (attacking commitment)
- Brazil: 26/116 1s-windows had 3+ attackers in opp final third (max 4)
- Argentina: 20/130 1s-windows had 3+ attackers in opp final third (max 9)

## Danger-Zone Marking
- Samples: 485
- Brazil attackers marked: 8/229 (3.5%), avg nearest defender 6.12
- Argentina attackers marked: 149/256 (58.2%), avg nearest defender 2.51
- Worst unmarked samples:
  - Brazil B ST 10 ST @ 2262.6s: nearest defender 12.43, 15.2u from goal (ST)
  - Brazil B ST 10 ST @ 2516.9s: nearest defender 12.21, 15.3u from goal (ST)
  - Brazil B ST 10 ST @ 1737.4s: nearest defender 11.8, 15.3u from goal (ST)
  - Argentina A LM 6 W @ 1051.1s: nearest defender 15.14, 21.1u from goal (LW)
  - Argentina A LM 6 W @ 1033.1s: nearest defender 15.02, 20.8u from goal (LW)
  - Argentina A RST 11 ST @ 318.7s: nearest defender 8.12, 19.6u from goal (RST)

## Multi-Touch Opp-Half Sequences (build-up quality)
- Sequences with 2+ distinct players touching ball in opp half: 8 of 12
- Opp-half touches total: 21
- Avg distinct players per possession: 1.67
- Examples:
  - Team B @ 274.5s: 2 touches by A LCM 7 → A LM 6
  - Team A @ 552.4s: 2 touches by B RB 5 → B DM 7
  - Team B @ 732.6s: 4 touches by A RCB 4 → A LCB 3 → A LCM 7
  - Team A @ 1366.9s: 3 touches by B RCB 4 → B DM 7 → B LCM 6
  - Team B @ 1645.4s: 2 touches by A RM 9 → A RCM 8
  - Team A @ 1887.3s: 2 touches by B LB 2 → B DM 7

## Kickoff Receiver / Goal Correlation
- Kickoff passes recorded: 0; kickoff receives recorded: 0; scorer events: 0
- Brazil: 0/0 goals scored by latest kickoff receiver (0%)
- Argentina: 0/0 goals scored by latest kickoff receiver (0%)
- Brazil kickoff receivers: (none)
- Argentina kickoff receivers: (none)

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
- Brazil:
  - CM: avgX -2.63, avg|Z| 9.06, avgDistToGoal 31.51 (23 samples); opp-half fwdX n/a (0); final-third |z| n/a (0)
  - DM: avgX -4.49, avg|Z| 1.22, avgDistToGoal 28.34 (13 samples); opp-half fwdX n/a (0); final-third |z| 1.26 (1)
  - FB: avgX -3.66, avg|Z| 12.2, avgDistToGoal 31.61 (4 samples); opp-half fwdX n/a (0); final-third |z| n/a (0)
  - ST: avgX -17.04, avg|Z| 1.94, avgDistToGoal 15.93 (122 samples); opp-half fwdX n/a (0); final-third |z| 1.67 (110)
  - W: avgX -14.81, avg|Z| 13.41, avgDistToGoal 22.75 (253 samples); opp-half fwdX n/a (0); final-third |z| 12.93 (118)
- Argentina:
  - CB: avgX 7.22, avg|Z| 6.83, avgDistToGoal 26.63 (10 samples); opp-half fwdX n/a (0); final-third |z| 9.4 (1)
  - CM: avgX 6.25, avg|Z| 6.06, avgDistToGoal 27.31 (99 samples); opp-half fwdX n/a (0); final-third |z| 4.75 (22)
  - FB: avgX 12.13, avg|Z| 6.73, avgDistToGoal 21.89 (14 samples); opp-half fwdX n/a (0); final-third |z| 4.74 (8)
  - ST: avgX 16.42, avg|Z| 5.8, avgDistToGoal 17.6 (255 samples); opp-half fwdX n/a (0); final-third |z| 5.65 (217)
  - W: avgX 7.68, avg|Z| 14.86, avgDistToGoal 29.41 (151 samples); opp-half fwdX n/a (0); final-third |z| 9.52 (8)

## Event Stream Review
- Event-stream shots: 3
- Event-stream on-target shots: 1
- Long-range on-target shots: 0
- Close-range bad-angle shots: 0
- On-target toe pokes: 0
- Attacker reset passes (BACK/WALL): 0

### Top Zigzag Offenders
- Team B CM A LCM 7: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A DM B DM 7: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B ST A LST 10: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A FB B LB 2: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B W A LM 6: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team A CM B LCM 6: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B CB A LCB 3: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%
- Team B CM A RCM 8: flips 0, avg progress/flip 0, switch requests 0, blocked 0, facing mismatch 0%

## Suggested Improvements
- Scoreless output with very low shot volume is not a defensive 0-0; it is an underproduction failure. Tune shot creation first, then finishing.
- Final-third recycling is still too common. Tighten attacker backpass vetoes and extend the carry-or-shoot window before resets are allowed.
