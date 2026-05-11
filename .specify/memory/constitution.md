<!--
Sync Impact Report
- Version change: template -> 1.0.0
- Modified principles:
  - Core principle slot 1 -> I. Code Quality Is Gameplay Safety
  - Core principle slot 2 -> II. Test Evidence Before Merge
  - Core principle slot 3 -> III. UX Consistency Preserves Match Readability
  - Core principle slot 4 -> IV. Performance Budgets Are Feature Requirements
- Added sections:
  - Engineering Constraints
  - Delivery Workflow
- Removed sections:
  - Placeholder fifth core principle slot removed to match the requested four principles
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md
  - ✅ .specify/templates/spec-template.md
  - ✅ .specify/templates/tasks-template.md
  - ⚠ pending: .specify/templates/commands/ (directory not present in this repo)
- Follow-up TODOs:
  - None
-->
# Pixel Soccer League Constitution

## Core Principles

### I. Code Quality Is Gameplay Safety
All production changes MUST preserve clear boundaries between engine, renderer,
telemetry, tooling, and UI code. New logic MUST be expressed through small,
named modules or functions with explicit inputs and outputs, and contributors
MUST remove dead code, temporary probes, and duplicate branches before merge.
Any change to public contracts such as match snapshots, telemetry events,
tuning bundles, or CLI surfaces MUST update the relevant spec or inline
documentation in the same change. Rationale: gameplay regressions in this repo
often hide inside mixed-responsibility code, so maintainability is a direct
reliability requirement.

### II. Test Evidence Before Merge
Every behavior change MUST ship with automated verification at the lowest
practical level, and new behavior or bug fixes MUST show failing test evidence
before implementation when feasible. Simulation, telemetry, and contract
changes MUST add deterministic, fixture-based, or parity-oriented tests;
user-visible changes MUST add reproducible integration coverage or documented
manual verification steps when automation is not yet practical. Before merge,
contributors MUST run `npm run lint`, `npm run test`, and the smallest relevant
simulation or workflow command for the affected surface. Rationale: this
project depends on repeatable simulation outputs, so unverified changes are not
acceptable.

### III. UX Consistency Preserves Match Readability
User-facing changes MUST preserve the repo's retro broadcast presentation,
terminology, controls, and dashboard interaction patterns unless a spec
explicitly approves a replacement. Visible changes MUST document the affected
surfaces, reuse established labels and shortcuts where possible, and verify
that match readability remains intact during live play, paused review, and
telemetry inspection. Rationale: inconsistent UX makes debugging harder and
reduces trust in both the simulation and the supporting analysis tools.

### IV. Performance Budgets Are Feature Requirements
Browser gameplay MUST protect smooth rendering, and headless or analysis
workflows MUST prefer deterministic, low-overhead execution. Changes that touch
frame-time-sensitive code, telemetry volume, persistence, or batch simulation
paths MUST define expected performance impact up front and provide measurement
or benchmark evidence when risk is non-trivial. Refactors for speed MUST
preserve browser-to-headless output parity for affected contracts. Rationale:
performance regressions directly slow tuning loops and can distort gameplay
behavior.

## Engineering Constraints

- Primary implementation work MUST fit the existing TypeScript, Node, Vite,
  React, and Three.js stack unless a spec justifies a new dependency.
- Engine or simulation logic MUST avoid new browser-only dependencies when a
  plain-state or adapter-based interface is possible.
- Telemetry schemas, match snapshot shapes, and analyzer-facing outputs MUST
  remain stable or include coordinated migration updates in the same change.
- Temporary scripts, debug artifacts, and local probes MUST not become required
  production workflow dependencies.

## Delivery Workflow

- Every implementation plan MUST complete a Constitution Check covering code
  quality boundaries, required tests, UX validation, and performance evidence.
- Every feature specification MUST state affected user-facing surfaces and any
  performance-sensitive paths when they are in scope.
- Every task list MUST include explicit work for tests and MUST include UX or
  performance validation tasks whenever those principles are touched.
- Pull requests and reviews MUST block merges that lack required cleanup, test
  evidence, UX validation, or performance verification.

## Governance

This constitution supersedes informal delivery habits for Pixel Soccer League.
Amendments MUST be proposed in writing, update dependent Spec Kit templates in
the same change, and record a semantic versioning rationale: MAJOR for removing
or materially redefining a principle, MINOR for adding a principle or expanding
governance requirements, and PATCH for clarifications that do not change
obligations. Compliance review is required for every plan, task list, and pull
request, and reviewers MUST block work that violates these principles or lacks
documented justification in the relevant planning artifact. Ratification and
amendment dates MUST use ISO 8601 `YYYY-MM-DD`.

**Version**: 1.0.0 | **Ratified**: 2026-05-08 | **Last Amended**: 2026-05-08
