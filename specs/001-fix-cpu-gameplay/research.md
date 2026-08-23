# Research: Fix CPU Gameplay Model

## Decision 1: Put the gameplay fix in the orchestrator/AI stack and only use legacy-engine edits for host parity

- **Decision**: Treat `src/core/gameOrchestrator.ts` plus the AI modules under `src/ai/` as the primary implementation surface. Limit `src/core/gameEngineBridge.ts` and `src/gameEngine.ts` changes to adapter parity, match-state handoff, and snapshot/telemetry continuity.
- **Rationale**: The repo already documents the newer layered architecture as the correct direction for CPU behavior, and the bridge/orchestrator path already owns player intent selection, restart handling, and event emission. Keeping decision fixes there preserves cleaner boundaries and reduces the chance of adding more competing movement writers into the host engine.
- **Alternatives considered**:
  - Patch only `src/gameEngine.ts`: rejected because it reinforces the monolith the architecture plan is trying to retire.
  - Rewrite the UI or telemetry flows: rejected because the spec requires behavior improvement without presentation or workflow changes.

## Decision 2: Preserve existing runtime and automation contracts instead of creating new feature-specific interfaces

- **Decision**: Keep `?newarch=1`, `window.__gameRef.getMatchSnapshot()`, `window.__gameRef.getTuningBundle()`, `window.pslTelemetry`, and the existing Vite `/__db/*` endpoints stable while CPU behavior is fixed.
- **Rationale**: Headless simulation, telemetry recording, dashboard views, and regression scripts already depend on these surfaces. The feature is a gameplay-quality repair, not a contract migration, so compatibility is cheaper and safer than expanding the API surface.
- **Alternatives considered**:
  - Add new CPU-debug endpoints or a new persistence path: rejected because they would widen the public/dev contract for a bug-fix feature.
  - Remove old host hooks and require orchestrator-only tooling: rejected because current scripts and dashboards still consume the host-facing APIs.

## Decision 3: Use the existing TypeScript/Vite/React/Three.js + SQLite stack as-is

- **Decision**: Keep the existing repository stack: TypeScript-based Vite app, React/Three.js rendering, IndexedDB browser telemetry, and SQLite (`better-sqlite3`) for dev-server match history and tuning relay.
- **Rationale**: The user planning context correctly identified the Vite + Three.js + SQLite direction, and the repo already has those technologies integrated. No unresolved clarification remains around stack selection; the only correction is that the implementation is TypeScript-first rather than plain JavaScript.
- **Alternatives considered**:
  - Introduce a new rules engine or external service: rejected because it adds complexity without solving the immediate CPU regression.
  - Move telemetry storage entirely into SQLite or entirely into browser-only storage: rejected because the current split serves both live browser inspection and server-side analysis workflows.

## Decision 4: Validation must combine focused failing tests, headless match runs, and telemetry evidence

- **Decision**: Require failing-first automated coverage in controller/restart tests, then validate full-match behavior with `npm run sim:match` or `npm run sim:headless:*`, and use `npm run telemetry:analyze` when reviewing persisted match bundles.
- **Rationale**: Focused tests catch deterministic AI/regression failures early, while headless matches and telemetry reports are the existing repo-supported proof that CPU behavior stays coherent over a full match. This directly maps to the constitution's testing and performance requirements and to the feature spec's 20-match completion / match-credibility goals.
- **Alternatives considered**:
  - Manual playtesting only: rejected because it is not sufficient evidence under the constitution.
  - Repo-wide tests only: rejected because they do not by themselves prove full-match behavior quality or runtime budget compliance.
