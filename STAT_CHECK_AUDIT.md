# Stat-Check Outcome Audit

Date: 2026-05-18

## Converted Critical Ball Outcomes

| Outcome | Status | Field proof |
|---|---|---|
| Open-play keeper saves | Converted | `keeperSaveGeometry` requires reachable shot-target contact before a non-goal save can stand. |
| Keeper parry to corner | Converted | Parry-to-corner requires reachable contact and emits `contactSource`, `contactPoint`, `keeperReachDistance`, and `keeperMaxReach`. |
| Penalty saves | Converted | Save roll is only honored when the keeper can reach the penalty shot target; unreachable save rolls become goals. |
| Goal-mouth crossings | Already field-resolved | Goal-line mouth crossings resolve as goal/own-goal before corner/goal-kick classification. |
| Goal-line OOB restarts | Already field-resolved | Goal kick/corner choice comes from crossed line, attack direction, and last touch. |
| Offside | Already field-resolved | Uses ball-at-touch, receiver position, opponent half, and second-last defender line. |

## Intentional Probability Abstractions

These remain probabilistic because they represent player skill/execution decisions between visible actors, not invisible ball-result overrides.

| Outcome | Why retained | Guardrail |
|---|---|---|
| Pass completion/interception | Models technical execution and defender pressure after a visible pass target is chosen. | Ball flight must travel to receiver/interceptor with no teleport or empty landing. |
| Tackles | Models duel quality between nearby visible players. | Requires nearby defender pressure and records tackle telemetry. |
| Fouls/penalties | Models contact severity during visible pressure. | Foul and penalty rates are KPI-guarded; penalties create visible restart. |
| Shot on-target choice | Models shooter execution. | Shot origin, target, distance, and invalid goal geometry are recorded. |
| Header shot/clearance choice | Models aerial duel execution. | Requires aerial/header-eligible flight and nearby visible participant. |
| Woodwork | Models rare shot variance. | Requires valid shot geometry and emits woodwork telemetry/sound cue. |
