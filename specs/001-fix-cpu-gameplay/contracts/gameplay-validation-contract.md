# Gameplay Validation Contract

This feature does **not** introduce a new external API. It preserves the repo's existing gameplay-validation and telemetry surfaces while improving CPU behavior.

## Stable Surfaces

| Surface | Provider | Consumers | Contract to Preserve |
|---|---|---|---|
| `?newarch=1` / `setUseNewArchitecture(true)` | `src/components/RetroFootball.tsx`, `src/gameEngine.ts` | Browser validation, developers, automation | Continues to enable the orchestrator-backed gameplay path without changing menu/control flow |
| `window.__gameRef.getMatchSnapshot()` | `src/gameEngine.ts` | `scripts/headless-sim.mjs`, telemetry recorder, dashboard code | Remains callable through kickoff, restart, live-play, and full-time states |
| `window.__gameRef.getTuningBundle()` | `src/gameEngine.ts` | Headless sim, tuning/analysis tooling | Keeps returning the persisted match bundle used for SQLite-backed analysis |
| `window.pslTelemetry` | `src/telemetry/recorder.ts` | Browser console tools, dashboards, analysis helpers | Existing telemetry helper methods remain available and compatible |
| `POST /__db/match-result` and `GET /__db/matches` | `vite.config.ts`, `src/server/psl-db.ts` | Match history dashboard, telemetry analysis workflows | No schema or endpoint contract change for this feature |

## Behavioral Guarantees

- CPU gameplay fixes may change the **content** of match outcomes and action selection, but not the shape of the published snapshot, bundle, or match-history surfaces.
- Restart handling must continue to produce valid snapshots and persisted bundles; fixes must not create ghost rows or break match filtering.
- Headless/full-match automation must be able to run the same commands before and after the feature with no new flags required.

## Validation Implications

- Any code change that risks one of the surfaces above must add focused automated coverage before merge.
- If a CPU fix requires a contract change after all, this file and the relevant inline documentation must be updated in the same implementation change.
