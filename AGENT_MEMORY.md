## Gameplay Debugging Rules

- Do not claim a gameplay behavior is "fixed" after a heuristic tweak unless the exact live branch/path causing it has been traced.
- For repeated movement or decision regressions, instrument first, patch second.
- Before further striker/carrier tuning, add telemetry for:
  - active carrier decision branch
  - chosen dribble target and steering heading
  - hold/pass/shoot decision flags
  - striker zone/field position during attacks
  - corner or edge-stall state, including the forces and vetoes affecting the carrier
- If the symptom is "same issue again," stop threshold tweaking and add targeted tracing on the next pass.

## Overnight Tuning Loop Rules

- Use full-length, full-speed overnight tuning runs as the baseline before enabling any self-editing behavior.
- Do not convert the overnight runner into a self-editing loop until runner stability and telemetry quality have been verified across a larger sample.
- When self-editing is enabled later, keep it controlled:
  - restrict edits to the gameplay/tuning surface and analyzer scripts
  - cap change size per cycle
  - keep per-cycle reports and diffs
  - only keep changes that improve telemetry drift against MLS baselines
  - stop automatically if runner health or gameplay realism degrades sharply

## Goalkeeper Follow-Up

- Patch after the current match: the goalkeeper should treat the full penalty area as an active control zone, not just the goalmouth.
- If a loose ball or slow ball is reachable inside the keeper's area, the keeper should come collect it before a defender makes a long recovery run.
- Keepers should also come off the line to smother, block, or intercept nearby danger in the box instead of staying planted near goal.
- Specific failure to fix: balls landing a few feet in front of the keeper are sometimes ignored while a defender runs 20+ yards to recover them.
