# Telemetry Analysis

## Match
- Fixture: Colorado Rapids 2-1 CF Montreal
- Session: ft-1776972163820
- Timestamp: 2026-04-23T19:22:43.820Z
- Shots: 24-22
- Shots on target: 18-15

## MLS Baseline Comparison
- Total goals: 3 vs 2.78 baseline (drift 0.22)
- Total shots: 46 vs 26.2 baseline (drift 19.8)
- Total shots on target: 33 vs 9.4 baseline (drift 23.6)
- Total corners: 0 vs 8 baseline (drift -8)

## Match Summary Telemetry
- Event count: 7269
- Pass log events: 116
- Carrier traces: 707
- Attacker zone traces: 603
- Shot decisions: 46
- Pass decisions: 306
- Interceptions: 6
- Turnovers: 12

## Decision Telemetry
- Forced shots: 45 of 46
- AI_SIMPLE broken rows: 46 of 46
- AI_SIMPLE forced broken rows: 45
- Long-range shot decisions: 6
- Pressured long-range shot decisions: 0
- Attacker final-third backpasses: 27
- Attacker in-box backpasses: 0
- Direct-blocker pass decisions: 83

## Movement / Facing
- Carrier traces analyzed: 707
- Carriers tracked: 20
- Forward-carry samples: 287
- Lateral direction flips: 109
- Avg forward progress per flip: 2.04
- Switch requests: 58
- Blocked switch requests: 58
- Carry lock samples: 18
- Facing vs movement mismatch: 10.6%
- Desired vs steer mismatch: 10.1%

## Box Behavior
- Box traces analyzed: 8
- Attackers tracked in box: 2

## Heat Map / Shape
- Colorado Rapids: avg width 15.64, avg |avgZ| 1.72, center-locked 87.3%, center+narrow 57.6%
- CF Montreal: avg width 16.06, avg |avgZ| 1.71, center-locked 84.7%, center+narrow 54.2%
- Colorado Rapids wide touches vs central touches: 27 vs 11
- CF Montreal wide touches vs central touches: 26 vs 11
- Colorado Rapids wide shots vs central shots: 14 vs 5
- CF Montreal wide shots vs central shots: 12 vs 6

## Event Stream Review
- Event-stream shots: 46
- Event-stream on-target shots: 33
- Long-range on-target shots: 4
- Close-range bad-angle shots: 0
- On-target toe pokes: 0
- Attacker reset passes (BACK/WALL): 3

### Long-Range On-Target Shots
- Team A ST: 1', LACES_DRIVE, 29.6y, angle 0.12, pressure 3, goal
- Team A ST: 4', LACES_DRIVE, 31.1y, angle 0.04, pressure 1
- Team B ST: 4', LACES_DRIVE, 25.7y, angle 0.01, pressure 1
- Team B ST: 42', LACES_DRIVE, 25.5y, angle 0.05, pressure 1

### Top Zigzag Offenders
- Team A RM Calvin Harris: flips 17, avg progress/flip 1.96, switch requests 1, blocked 1, facing mismatch 14%
- Team B LM Matty Longstaff: flips 12, avg progress/flip 1.99, switch requests 7, blocked 7, facing mismatch 13.5%
- Team B LM Fabian Herbers: flips 12, avg progress/flip 1.97, switch requests 2, blocked 2, facing mismatch 15.8%
- Team B RM Dante Sealy: flips 10, avg progress/flip 1.9, switch requests 4, blocked 4, facing mismatch 4.5%
- Team A RM Rafael Navarro Leal: flips 9, avg progress/flip 4.05, switch requests 4, blocked 4, facing mismatch 14.5%
- Team B CB Samuel Piette: flips 7, avg progress/flip 1.34, switch requests 8, blocked 8, facing mismatch 3.9%
- Team A ST Theodore Ku-DiPietro: flips 7, avg progress/flip 1.75, switch requests 2, blocked 2, facing mismatch 10.5%
- Team A LM Alexis Manyoma: flips 7, avg progress/flip 1.9, switch requests 2, blocked 2, facing mismatch 5.9%

### Top Box Loiterers
- Team B ST Giacomo Vrioni: max dwell 2.03s, max idle 0s, max camp 0s, crowded 0%
- Team B RM Dante Sealy: max dwell 0s, max idle 0s, max camp 0s, crowded 0%

## Suggested Improvements
- AI_SIMPLE shot decisions are still collapsing into zeroed/null evaluation rows. Separate computed shot/pass values from forced overrides and block forced shots when the real evaluation is missing.
- Long-range shot accuracy is still too clean. Push more off-frame bias onto 20+ yard attempts, especially central shots and pressured strikes.
- Final-third recycling is still too common. Tighten attacker backpass vetoes and extend the carry-or-shoot window before resets are allowed.
- Shape is still too central. Strengthen weak-side width anchors and reduce carrier-gravity pull on wide roles and midfield support.
- Corner volume is still unrealistically low. Review deflection, blocked-shot, and out-of-play logic so wider attacks can produce restarts naturally.
- Some shots still lack second-wave support. Nudge nearby midfielders to arrive a little earlier into the edge-of-box support band.
- Carrier zigzagging is still present. Reduce repeated lateral sign flips by holding the current carry lane longer and tightening the link between desired heading, facing heading, and actual movement heading.
- Attackers are still lingering in the opponent box. Force dynamic box roles so extra attackers vacate, rotate, or resolve instead of standing in occupied central lanes.
