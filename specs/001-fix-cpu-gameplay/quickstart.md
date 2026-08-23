# Quickstart: Fix CPU Gameplay Model

## 1. Read the planning artifacts

1. `specs/001-fix-cpu-gameplay/spec.md`
2. `specs/001-fix-cpu-gameplay/plan.md`
3. `specs/001-fix-cpu-gameplay/research.md`
4. `specs/001-fix-cpu-gameplay/data-model.md`
5. `specs/001-fix-cpu-gameplay/contracts/gameplay-validation-contract.md`

## 2. Install and open the project

```powershell
npm install
npm run dev
```

- Local app: `http://localhost:3001`
- Use the existing `?newarch=1` flow when validating the orchestrator-backed CPU path.

## 3. Implement in the right places

- Primary logic: `src/core/gameOrchestrator.ts`
- Supporting AI modules: `src/ai/playerController.ts`, `src/ai/goalkeeperController.ts`, `src/ai/teamTacticalService.ts`, `src/ai/restartAndDefenseRules.ts`
- Host/adapter parity only when needed: `src/core/gameEngineBridge.ts`, `src/gameEngine.ts`
- Do **not** redesign menus, controls, camera behavior, telemetry dashboards, or SQLite schemas for this feature.

## 4. Start with failing-first verification

Run the narrowest likely tests first and make them fail for the reproduced bug before implementing the fix when feasible:

```powershell
node --import tsx --test tests/newArchitectureController.test.ts
node --import tsx --test tests/restartAndDefenseRules.test.ts
```

Add or expand targeted tests if the regression lands in another AI/controller module.

## 5. Run required validation after implementation

```powershell
npm run lint
npm run test
npm run sim:match -- --home "DC United" --away "Columbus Crew"
npm run telemetry:analyze -- --home "DC United" --away "Columbus Crew"
```

If runtime or deadlock risk is still unclear, add a larger sample:

```powershell
npm run sim:headless:20
```

## 6. Manual acceptance checks

- Play a human-vs-CPU match and verify credible possession, transitions, and restart behavior.
- Watch a CPU-vs-CPU match to full time and confirm no repeated broken loop dominates play.
- Confirm controls, overlays, scoreboard, and telemetry/MATCHES workflows are unchanged.
- Compare representative match completion timing before/after to confirm the 5% runtime budget holds.
