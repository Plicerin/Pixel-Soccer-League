# Copilot Instructions

## Build, test, and lint

- Install dependencies with `npm install`.
- Start local development with `npm run dev`. This runs the Vite app on `http://localhost:3001` and starts the WebSocket server on port `8081`. `README.md` expects `GEMINI_API_KEY` in `.env.local` for local app work.
- Type-check with `npm run lint` (`tsc --noEmit`).
- Run the full test suite with `npm run test`.
- Run a single test file with `node --import tsx --test tests\matchFilters.test.ts`.
- Run one named test with `node --import tsx --test --test-name-pattern "psl doctor emits stable JSON" tests\pslCli.test.ts`.
- Build the production bundle with `npm run build`.
- Launch Copilot with the repo-local MCP configuration by running `powershell -ExecutionPolicy Bypass -File scripts\copilot-local.ps1`.

## High-level architecture

- The runtime entrypoint is `src\main.tsx` -> `src\App.tsx` -> `src\components\RetroFootball.tsx`. `RetroFootball` owns the React UI, menu state, telemetry recorder lifecycle, and creates the simulation by calling `initGame()` from `src\gameEngine.ts`.
- `src\gameEngine.ts` is still the large simulation/rendering monolith. The newer layered soccer AI is not the default replacement; it is wired in behind `setUseNewArchitecture(true)` and the `?newarch=1` URL flag.
- When the new path is enabled, `src\core\gameEngineBridge.ts` adapts the legacy game-engine objects into `src\core\gameOrchestrator.ts`. The orchestrator runs the match state machine, belief-state builders, tactical blackboards, team tactical service, per-player and goalkeeper controllers, motion layer, and ball physics, then syncs the results back into the legacy engine.
- Telemetry and tuning are split across browser and dev-server storage. Browser telemetry lives in IndexedDB via Dexie (`src\telemetry\db.ts`) and is exposed through `window.pslTelemetry`. Dev-only persistence is implemented in Vite middleware (`vite.config.ts`): telemetry mirror endpoints append JSON/NDJSON files, and tuning/match history endpoints use SQLite through `src\server\psl-db.ts` (`psl.db`).
- `scripts\psl.mjs` is a read-only CLI for telemetry, KPI scoreboard, and overnight-run status; tests assert its machine-readable JSON behavior. The separate `rl` Python stack is a sidecar that talks to the running app on port `3001`, not part of the TypeScript build/test pipeline.

## Key conventions

- Keep the legacy engine path and the orchestrator path consistent. Changes to live match behavior often need updates in both `src\gameEngine.ts` and the bridge/orchestrator files rather than only one side.
- Treat `?newarch=1` as the switch for the orchestrator path and overlay. If you change bootstrap or URL-driven behavior in `RetroFootball`, preserve that flag-driven entrypoint.
- `@/*` is a repo-root alias, not a `src` alias. Imports using `@/...` resolve from the repository root because `tsconfig.json` maps `@/*` to `./*`.
- `npm run lint` is type-check only. There is no separate ESLint workflow in this repo, so do not document or assume one.
- Tests use the built-in `node:test` runner with `tsx`, and they live in `tests\*.test.ts`. Add or update tests in that style instead of introducing a different harness.
- Client automation hooks are part of the working surface: `window.pslTelemetry`, `window.pslGame`, `window.__gameRef`, and `window.getKeeperKickStats` are intentionally exposed for debugging, telemetry scripts, and smoke-style workflows.
- The dev server is more than static hosting. If you touch telemetry export, tuning relay, or match-history flows, check both the client callers and the custom Vite endpoints under `/__telemetry/*`, `/__tuning/*`, and `/__db/*`.
- Server-side match history deliberately filters ghost/default splash matches before returning rows. Preserve the `matchFilters` guardrail when changing SQLite writes or reads.
- Repo-local MCP configuration lives under `.copilot\mcp-config.json`. Use `scripts\copilot-local.ps1` when you want Copilot CLI to load the committed Playwright MCP setup for this repository.
