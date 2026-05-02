# SPEC — Pixel Soccer League

## §G Goal

Pixel Soccer League: accurate soccer simulation with voxel/pixelated aesthetic and deep tactical AI. Stats, spacing, shot quality, and team shape match MLS 2025 baselines. CPU vs CPU games are indistinguishable from real broadcast footage in structure and variety.

---

## §C Constraints

- C1. Browser-first (Vite + Three.js/React Three Fiber). No native app.
- C2. MLS 2025 teams, rosters, ratings as ground truth for tuning.
- C3. Pixelated voxel art style — no photorealism.
- C4. CPU-vs-CPU as primary testing loop. Human play optional layer.
- C5. Telemetry-driven development — every gameplay claim must be measurable.
- C6. CPU vs CPU match = 150s/half (5 min total) for iteration speed.
- C7. TypeScript + `npm run lint` must pass clean after every change.
- C8. SQLite telemetry DB on server (`localhost:3001/__db/matches`). Browser telemetry in IndexedDB.
- C9. No external AI inference at match runtime — all decisions local/deterministic.

---

## §I Interfaces

- I.browser — `localhost:3001` serves game (Vite dev) + REST API
- I.dashboard — `localhost:3001/dashboard.html` live WebSocket tuning dashboard
- I.db — `GET /__db/matches?limit=N` returns match bundles with full telemetry
- I.ws — `ws://localhost:8081` pushes live events/shots/passes to dashboard
- I.cli.sim — `npm run sim:headless` headless Playwright sim, `--half-seconds`, `--speed`, `--games`
- I.cli.telemetry — `npm run telemetry:analyze` → `telemetry/latest-report.md` + `.json`
- I.cli.overnight — `npm run iterate:overnight` batch fixture scheduling with status files
- I.gameapi — `window.game.*` exposed functions: `setCpuVsCpu`, `setHalfDurationSeconds`, `setSeriesSpeedMul`, etc.

---

## §V Invariants

- V1. Shot decisions: `passChance > 0` on ≥ 60% of rows. `forceShotNow` rate < 40%. (Was 46/48 forced before pass model fix.)
- V2. Shape: `avgWidth ≥ 18` both teams. `center+narrow` < 45%. (Was 15.5 / 68%.)
- V3. Pass variety: `hasForwardPassOption` rate ≥ 35% of logged pass decisions. (Was 20%.)
- V4. CB shots: ≤ 2 per team per match. CBs must not reach shooting range via carry alone.
- V5. Corners: ≥ 4 per match (MLS baseline 8). Currently 0 — deflection/out-of-play logic broken.
- V6. Goals: 2.0–4.0 per match (MLS baseline 2.78). Drift within ±1.5.
- V7. Shots: 20–35 per match (MLS baseline 26.2). Drift within ±10.
- V8. Shots on target: 7–16 per match (MLS baseline 9.4). Long-range SOT must not dominate.
- V9. Zigzag: lateral flips per carrier < 8 avg. Avg forward progress per flip > 3.0m.
- V10. Keeper: must claim/punch all reachable balls inside penalty area before outfield defender. No pickpocket while holding.
- V11. Throw-ins: taker must not jitter. Ball must leave from outside touchline cleanly.
- V12. Match end: full-time screen must hold. No auto-restart into new game.
- V13. Goal balls: stay inside net after scoring. Never re-enter play.
- V14. Possession: each team 40–60% across match. No monopoly.
- V15. Shot style: wide-angle shooter at distToGoal ≤ 18 → `CURLED` unless chip/tap-in/cross override.
- V16. DB match history: `/__db/matches` must not return rows whose stored bundle has `sessionActive=false`.
- V17. Goals: awarded goals must be shot-backed. Non-shot goal crossings are blocked until explicit own-goal classification exists.
- V18. Cross telemetry: `PATTERN_CROSS_EXECUTED` means wide-channel passer to central/box target. Other launched pattern passes use `PATTERN_DELIVERY_EXECUTED`.
- V19. Kickoff: first touch must have an intended teammate staged in a short forward/lateral lane; no blind back-pass rolling to keeper.
- V20. Defense: coach cover targets must preserve goalmouth spacing; ≥4 outfield defenders may not collapse within 8m of own goal center lane.
- V21. Coach authority: in live CPU-vs-CPU, player movement and defensive challenges must be coach-commanded; uncommanded movement, off-route movement, out-of-bounds positions, speed above coach cap, or unauthorized challenges are corrected/blocked and logged as `COACH_AUTHORITY_VIOLATION`.
- V22. Match start: every UI path that calls `startKickoffPresentation` must clear splash scene mode first; splash hard-block must not swallow a user-initiated start.
- V23. Real-data replay: replay mode is tracking-only from Metrica data; coach, AI, ball physics, shots, passes, tackles, and possession are disabled while players and the tracked ball mimic recorded coordinates.
- V24. Real-data replay pitch mapping: normalized source tracking coordinates must be scaled by the recorded pitch dimensions, then centered in the local field; replay must not stretch a 105x68m source pitch to a 120x80yd local pitch.
- V25. Real-data replay facing: replay mode must derive player side/front/back facing from frame-to-frame movement and preserve last facing only when movement is below idle threshold.
- V26. Real-data replay ball/smoothing: replay mode must render tracked ball coordinates from the source data and interpolate player/ball positions between sampled frames instead of snapping at sample boundaries.
- V27. Real-data replay visual pitch: when source pitch dimensions differ from the local field, replay mode must scale visible field markings, flags, and goals to the recorded pitch so corners and touchlines align with replay coordinates.
- V28. Live movement authority: during live CPU-vs-CPU halves, every player and ball position update must pass a frame-level max-speed gate; untagged teleports are capped and logged, only explicit restart/dead-ball/reset states may bypass.

---

## §T Tasks

| id | status | task | cites |
|----|--------|------|-------|
| T1 | `done` | Fix pass model — allow cutbacks/laterals/layoffs in final third | V1,V3 |
| T2 | `done` | Fix shape width — exempt wingers from ball z-pull, raise width anchors | V2,V3 |
| T3 | `done` | Reduce game duration to 150s/half for iteration speed | C6 |
| T4 | `.` | Validate T1+T2 on fresh match — confirm passChance > 0, avgWidth ≥ 18 | V1,V2,V3 |
| T5 | `.` | Suppress CB shooting — isDeepRole gate on forceShotNow outside penalty area | V4 |
| T6 | `.` | Fix corners — trace deflection/blocked-shot/out-of-play logic to produce restarts | V5 |
| T7 | `.` | Instrument keeper — telemetry for claim opportunities, hesitation, loose ball, off-line distance | V10 |
| T8 | `.` | Keeper: claim all reachable loose balls in box before defenders | V10 |
| T9 | `.` | Keeper: come off line to smother danger (shot-stopping positioning) | V10 |
| T10 | `.` | Keeper: distribute quickly after save/catch (long kick, throw, or short outlet) | V10,I.gameapi |
| T11 | `.` | Fix throw-in jitter — taker stable outside touchline during presentation | V11 |
| T12 | `.` | Fix match end — full-time screen holds, no auto-transition | V12 |
| T13 | `.` | Fix goal ball — stays inside net, cannot escape back into play | V13 |
| T14 | `.` | Reduce zigzag — hold carry lane longer, tighten facing/heading link | V9 |
| T15 | `x` | Reduce final-third recycling — attacker backpass rate target < 10/match (was 21) | V1,V3 |
| T16 | `.` | Foul system — tune tackle angle/speed so free kicks appear 8–14/match | V6,V7 |
| T17 | `.` | Stadium: mowing stripes on pitch | C3 |
| T18 | `.` | Stadium: floodlight pylons at corner towers | C3 |
| T19 | `.` | Stadium: corner flags with animated cloth | C3 |
| T20 | `.` | Stadium: camera flashes in crowd on goal | C3 |
| T21 | `.` | Pre-match setup dropdown — fix immediate-close bug | I.browser |
| T22 | `.` | Reduce GK punt/goal-kick out-of-bounds frequency | V10 |
| T23 | `.` | Telemetry: add keeper events to analyzer summary | V10,I.cli.telemetry |
| T24 | `.` | Telemetry: add corner/free-kick/throw-in counters to report | V5,I.cli.telemetry |
| T25 | `x` | Structured attack v1 — deterministic wing move slots + carrier delivery trigger | V1,V2,V3,V7 |

---

## §B Bug Log

| id | date | cause | fix |
|----|------|-------|-----|
| B1 | 2026-04-23 | `chooseSimplePassTarget` forward-only gates blocked all final-third passes → passChance=0 → forceShotNow always true | V1 |
| B2 | 2026-04-23 | `attackerBackpassVeto` fired on lateral passes (progress≈0) → killed simplePassChance even when target found | V1 |
| B3 | 2026-04-23 | `tacticalPositioning.ts` applied ball z-pull to LW/RW → far-flank ball collapsed winger from z=-12 to z=-8.7 | V2 |
| B4 | 2026-04-23 | `anyBoxBackpassVeto` had no cutback exemption — fired for in-box carriers killing hardBackpassVeto | V1 |
| B5 | 2026-04-23 | `isLargeBackpass` at -5 blocked CM cutbacks before cutback logic ran in simpleOffenseModel | V1 |
| B6 | 2026-04-23 | `boxIndecisionShotForce` had no pass-availability check — forced shot even when valid pass existed | V1 |
| B7 | 2026-04-23 | `resolveShotNow` passChance threshold 0.45 too high — cutback passChance (0.18-0.30) didn't suppress | V1 |
| B8 | 2026-04-23 | `forceShotRoleAllowed` allowed CBs to force-shoot anywhere in penalty area (not just face-to-face) | V4 |
| B9 | 2026-04-23 | `tacticalPositioning.ts` ST de-privileging lerp pulled striker toward home+1.4 — 10-18 units behind carrier | V1,V3 |
| B10 | 2026-04-23 | ST forward-run from tactical ideal diluted by 0.36 blend in gameEngine — no dedicated post-blend ST enforcement like winger width | V1,V3 |
| B11 | 2026-04-23 | Goal scorer attribution fallback used `players.find()` which returns first non-GK = first CB (shirt #2). ALL 8 goals in Charlotte-StLouis credited to Tim Ream / Eduard Löwen incorrectly | V6 |
| B12 | 2026-04-25 | `chooseSimpleShotStyle` used `< 18` wide-angle curl gate → boundary chose `LACES_DRIVE` at distToGoal=18 | V15 |
| B13 | 2026-04-26 | `/__db/matches` returned historical splash/demo rows with `bundle.sessionActive=false`, so ghost Inter Miami-LA Galaxy matches appeared in dashboard history | V16 |
| B14 | 2026-04-26 | Legal goal-crossing path allowed non-shot goals, producing zero-shot scorelines from loose/restart drift | V17 |
| B15 | 2026-04-26 | Pattern delivery telemetry counted every launched structured delivery as `PATTERN_CROSS_EXECUTED`, inflating cross totals with cutbacks/recycles | V18 |
| B16 | 2026-05-01 | Coach real-data feed was advisory only; kickoff and coach-defense cover still used legacy targets, causing blind kickoff back-passes and goalmouth defender bunching | V19,V20 |
| B17 | 2026-05-01 | Coach authority was advisory; legacy loose-ball, pressure, shape, velocity, and direct position paths could still move players after coach targets, causing impossible defender speed/teleport drift | V21 |
| B18 | 2026-05-01 | UI kickoff path could call `startKickoffPresentation` while engine `splashSceneMode` was still true, so the splash hard-block rejected the user start | V22 |
| B19 | 2026-05-01 | Real-data replay stored Metrica pitch dimensions but ignored them in coordinate conversion, stretching 105x68m tracking onto the full 120x80yd local field and misaligning players with penalty markings | V24 |
| B20 | 2026-05-01 | Real-data replay bypassed the normal sprite-facing pass and only updated `dir` from x velocity, so position-only replay players appeared to face one direction | V25 |
| B21 | 2026-05-01 | Replay generator dropped the tracked ball and replay render hid the ball, even though Metrica tracking contains ball x/y coordinates | V26 |
| B22 | 2026-05-01 | Replay sampled at 0.2s but rendered with frame snapping, producing visible 5 FPS positional jumps instead of smooth motion | V26 |
| B23 | 2026-05-01 | Replay coordinates were correctly centered to the 105x68m source pitch, but field flags/markings remained at the larger 120x80yd local field, so corner takers appeared several feet from the flag | V27 |
| B24 | 2026-05-02 | Live movement authority began after early movement paths and only guarded command-driven players, so legacy steering/collisions/ball attachment could create untagged player and ball teleports | V28 |
