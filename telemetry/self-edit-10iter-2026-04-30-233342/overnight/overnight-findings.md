# Overnight Telemetry Findings

Generated: 2026-05-01T04:28:42.879Z

Mode: evaluation-only. No code edits were performed.

## KPI Averages

- Overall: 52.4
- Baseline fit: 16.5
- Soccer structure: 62.5
- Tuning efficiency: 78.1

## MLS Baseline Comparison

- Goals: 3 vs 27.8 baseline (drift -24.8)
- Shots: 46 vs 262 baseline (drift -216)
- Shots on target: 8 vs 94 baseline (drift -86)
- Corners: 20 vs 80 baseline (drift -60)

## What Seems To Be Working

- Tuning efficiency is holding (78.1). Forced shots, direct-blocker passes, and broken rows are under guardrail.

## What Does Not Seem To Be Working

- Team shape is still too narrow or centralized (width 18.42/17.95, center+narrow worst 51.56%).
- Baseline production is under target: goals drift -24.8, shots drift -216, SOT drift -86.
- Danger-zone marking is below target (74.18% marked vs 78% target).
- Pattern possessions are resolving too quickly (0.95 touches vs 2+ target).

## Watch List

- Wide delivery volume is light (1.3 real crosses per analyzed match).
- Corner volume remains low: drift -60.

## Recurring Recommendations

- 10x: Carrier zigzagging is still present. Reduce repeated lateral sign flips by holding the current carry lane longer and tightening the link between desired heading, facing heading, and actual movement heading.
- 10x: Final-third recycling is still too common. Tighten attacker backpass vetoes and extend the carry-or-shoot window before resets are allowed.
- 10x: Shape is still too central. Strengthen weak-side width anchors and reduce carrier-gravity pull on wide roles and midfield support.
- 10x: Too much of the final action still comes through central roles. Encourage wider occupation and more wing-led creation before the finish.
- 9x: Some shots still lack second-wave support. Nudge nearby midfielders to arrive a little earlier into the edge-of-box support band.
- 3x: Attackers are still lingering in the opponent box. Force dynamic box roles so extra attackers vacate, rotate, or resolve instead of standing in occupied central lanes.
- 3x: Corner volume is still unrealistically low. Review deflection, blocked-shot, and out-of-play logic so wider attacks can produce restarts naturally.
- 3x: Danger-zone attackers are still too often unmarked. Tighten goal-side marking assignments for box, cutback, and far-post runners without pulling the ball presser out of shape.

## Matches

- Cycle 1: Houston Dynamo vs Colorado Rapids 0-0 | overall 53.4 | shots 2 | goals 0
- Cycle 2: Toronto FC vs Minnesota United 0-1 | overall 52 | shots 5 | goals 1
- Cycle 3: Atlanta United vs Columbus Crew 0-1 | overall 54.8 | shots 5 | goals 1
- Cycle 4: Houston Dynamo vs New York City FC 0-0 | overall 44.5 | shots 3 | goals 0
- Cycle 5: Vancouver Whitecaps vs LA Galaxy 0-0 | overall 55.6 | shots 7 | goals 0
- Cycle 6: New England Revolution vs St. Louis City SC 0-0 | overall 55.5 | shots 8 | goals 0
- Cycle 7: Columbus Crew vs Austin FC 0-0 | overall 52 | shots 4 | goals 0
- Cycle 8: Toronto FC vs LAFC 0-0 | overall 45.9 | shots 7 | goals 0
- Cycle 9: DC United vs New England Revolution 0-1 | overall 52.5 | shots 4 | goals 1
- Cycle 10: Columbus Crew vs Toronto FC 0-0 | overall 57.6 | shots 1 | goals 0
