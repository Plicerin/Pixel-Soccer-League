# Implementation Plan: Fix CPU Gameplay Model

**Branch**: `[001-fix-cpu-gameplay]` | **Date**: 2026-05-08 | **Spec**: [`specs/001-fix-cpu-gameplay/spec.md`](spec.md)
**Input**: Feature specification from `/specs/001-fix-cpu-gameplay/spec.md`

## Summary

Restore believable CPU match behavior by tightening the orchestrator-era team/player decision stack, restart handling, and legacy-engine bridge points that still host live gameplay, telemetry snapshots, and headless automation. The implementation stays inside the existing Vite + React + Three.js app, preserves SQLite-backed telemetry/match-history flows, and validates improvements through deterministic tests plus headless full-match runs.

## Technical Context

**Language/Version**: TypeScript 5.8 on Node.js 22; browser runtime via Vite 6 and React 19  
**Primary Dependencies**: Vite, React, Three.js, @react-three/fiber, better-sqlite3, Dexie  
**Storage**: SQLite (`psl.db`) for dev-server tuning/match history; IndexedDB via Dexie for browser telemetry  
**Testing**: `node:test` with `tsx`, plus headless simulation and telemetry analysis scripts  
**Target Platform**: Desktop browser gameplay with local Node/Vite dev server and headless Node simulation workflows  
**Project Type**: Web application with embedded dev-only telemetry/SQLite endpoints and simulation tooling  
**Performance Goals**: Preserve live match smoothness/readability and keep standard-match completion within 5% of current baseline  
**Constraints**: Preserve existing controls/camera/scoreboard UX, keep `window.__gameRef`/`window.pslTelemetry` and `/__db/*` automation surfaces stable, avoid new mixed-responsibility gameplay code, maintain legacy-host ↔ orchestrator parity  
**Scale/Scope**: Single-repo feature touching CPU behavior for human-vs-CPU and CPU-vs-CPU matches, validated against the spec's 20-match completion target

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate — PASS

- **Code Quality Gate**: Expected code surface is limited to `src/core/gameOrchestrator.ts`, `src/core/gameEngineBridge.ts`, `src/ai/playerController.ts`, `src/ai/goalkeeperController.ts`, `src/ai/teamTacticalService.ts`, `src/ai/restartAndDefenseRules.ts`, and narrow host parity points in `src/gameEngine.ts`. Renderer/UI files remain consumers only; telemetry and SQLite modules stay contract-stable and are only touched if snapshot parity requires it. Any temporary probes added during diagnosis must be removed before merge.
- **Testing Gate**: Start with failing-first coverage in focused controller/restart tests (`tests/newArchitectureController.test.ts`, `tests/restartAndDefenseRules.test.ts`, and adjacent AI tests as needed), then verify repo-wide behavior with `npm run lint`, `npm run test`, and the smallest relevant simulation workflow: `npm run sim:match -- --home "DC United" --away "Columbus Crew"`. Use `npm run telemetry:analyze -- --home "DC United" --away "Columbus Crew"` when validating full-match output quality against persisted bundles.
- **UX Consistency Gate**: Visible change is limited to on-pitch CPU behavior in live matches. Menus, controls, overlays, scoreboard usage, telemetry dashboards, and `?newarch=1` activation flow remain unchanged; validation must confirm players do not relearn any controls or menu flows.
- **Performance Gate**: Risk is concentrated in the live simulation loop plus headless full-match throughput. Measure before/after by comparing representative `sim:match` or `sim:headless` runs and confirm no noticeable gameplay stutter plus no more than 5% match-duration regression; SQLite writes remain at existing volume and schema.

### Post-Design Re-check — PASS

- **Code Quality Gate**: Design keeps decision logic in orchestrator/AI layers, treats `src/gameEngine.ts` and `src/core/gameEngineBridge.ts` as host/adapter boundaries, and preserves telemetry/server contracts in documentation instead of widening the runtime surface.
- **Testing Gate**: Design artifacts require targeted failing tests first, then full repo verification and at least one headless match + telemetry review path before implementation is considered complete.
- **UX Consistency Gate**: No new screens, controls, or labels are introduced; quickstart validation explicitly checks existing live-play and MATCHES/telemetry surfaces without UI changes.
- **Performance Gate**: Research and quickstart both require baseline-vs-after timing comparison on existing simulation commands, keeping runtime and persistence risk measurable before merge.

## Project Structure

### Documentation (this feature)

```text
specs/001-fix-cpu-gameplay/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── gameplay-validation-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── ai/
│   ├── goalkeeperController.ts
│   ├── playerController.ts
│   ├── restartAndDefenseRules.ts
│   └── teamTacticalService.ts
├── components/
│   ├── MatchHistoryDashboard.tsx
│   └── RetroFootball.tsx
├── core/
│   ├── beliefState.ts
│   ├── blackboard.ts
│   ├── gameEngineBridge.ts
│   ├── gameOrchestrator.ts
│   └── matchStateMachine.ts
├── server/
│   ├── matchFilters.ts
│   └── psl-db.ts
├── telemetry/
│   ├── db.ts
│   └── recorder.ts
└── gameEngine.ts

scripts/
├── headless-sim.mjs
└── telemetry-analyze-latest.mjs

tests/
├── newArchitectureController.test.ts
├── restartAndDefenseRules.test.ts
├── matchStartUi.test.ts
└── telemetryCoach.test.ts
```

**Structure Decision**: Keep the existing single-project Vite application. Concentrate gameplay changes in `src/ai` and `src/core`, preserve `src/gameEngine.ts` as the host integration seam, and treat scripts/tests as the verification surface rather than introducing a new package or service boundary.

## Complexity Tracking

No constitution violations currently require justification.
