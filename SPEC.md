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
- C6. CPU vs CPU match length is configurable; browser default is 300s/half, and KPI/analyzer tools must respect selected half length.
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
- V29. Live restarts: if the ball has already settled outside the field during live play, restart classification must still award the correct goal kick / corner / throw-in from the actual last-touch team.
- V30. Short CPU-vs-CPU halves: selected half length must not scale decision cadence; short matches are partial-match samples, not compressed full-match stat replicas.
- V31. Visible ball flight: rendered pass/shot flight must remain readable at every half length; ball travel must remain visible without teleporting.
- V32. Ball-speed telemetry: KPI suite must report rendered pass/shot ball speed avg/max from `ballFlightTelemetry`; guard fails unreadable short-half speed spikes.
- V33. Moving receiver flight: completed pass/interception/save flights must follow intended receiver/player until arrival; ball must not settle on empty grass because target moved.
- V34. Visual reality audit: KPI suite must fail when visual state contradicts good stats: empty flight landings, missing flight targets, or carrier-ball gap violations > 0.
- V35. Live dashboard telemetry: per-tick browser dashboard payloads must be bounded and recent; long-running matches must not send unbounded event/decision/history arrays over WebSocket or relay storage.
- V36. Full-time match persistence: completed-match DB/history rows must serialize the full raw final telemetry bundle, not the compact live-dashboard payload.
- V37. Watched fixture timing: UI watched-fixture timeout budget must exceed expected visual runtime at configured speed, and slow/stalled browser clocks must be reported separately from match timeout.
- V38. Watched fixture slow-clock handling: browser clock lag must not terminate a watched fixture while simulated time is still advancing; only no-progress stalls or wall-time budget may stop it.
- V39. Browser match length: pre-match setup must offer 2, 5, 15, and 45 minute halves; the default browser match length is 5 minutes per half, while 45 minutes remains the full-regulation option.
- V40. Player normal speed: a 45-minute-half, speedMul=1 controlled 10s model sample must advance match clock by 10s and keep top player instant speed <= 7.8 m/s, top 10s average <= 5.1 m/s.
- V41. Live player boundaries: during live CPU-vs-CPU play, all player positions must remain inside the field rectangle every frame; acceleration or target changes must not carry players beyond touchlines or goal lines.
- V42. Goalmouth fidelity: controlled possession inside the central goalmouth with the keeper beaten must resolve as an immediate shot-backed `OPEN_NET_FINISH` goal; generic pass/shot/save RNG must not override obvious visual geometry.
- V43. Full-time stat integrity: final snapshot, bundle, and browser full-time overlay must report shots and shots-on-target greater than or equal to shot-backed goals for each team; a nonzero score with `0` shots is invalid.
- V44. Early scoring burst guard: a normal-speed 180s browser/model sample must not exceed 3 total goals or 2 `OPEN_NET_FINISH` goals; early double-digit scores are invalid even if full-match KPI averages pass.
- V45. Half length pacing: selected half length changes only when the half ends; movement speed and ball-flight readability must remain at 100% simulation speed for 2, 5, 15, and 45 minute halves, while action production may compress to represent a full 90-minute match.
- V46. Runtime-aware telemetry: dashboard, simple KPI guard, and telemetry analyzer must label selected half length as runtime only; KPI baselines compare the completed simulation to full-match MLS raw outputs, not runtime-scaled partial samples.
- V47. Goalmouth production floor: if a live match has no shots yet, first controlled possession inside the central goalmouth must resolve as a shot, saved shot, or shot-backed goal; keeper smothers there cannot leave full-time stats at 0 shots.
- V48. Dashboard KPI reporting: live/history dashboard must show duration-aware raw KPI status, baseline fit score, zero-shot full-time guard, and actual-vs-expected goals/shots/SOT/passes; invalid KPI state cannot exist only in CLI telemetry.
- V49. Final-whistle shot floor: a match cannot enter FULL_TIME with 0 shots while an outfield carrier controls the ball; late no-shot pressure must create a real shot decision and ball flight before expiry, not a stat-only correction.
- V50. Distance-shot readability: normal attacking play must produce explicit 20-36 yard `distance_shot` decisions with visible shot ball flights; shot KPIs must report distance bins so "walking the ball into goal" cannot hide behind aggregate shot totals.
- V51. Smother visual semantics: keeper smothers/recoveries before a shot cannot emit `save` ball-flight telemetry; only counted shots-on-target may create `save` flights, otherwise visual KPI can imply phantom shots.
- V52. Compressed-runtime KPI guard: a 2/5/15 minute-half match represents a full 90-minute soccer match for statistics; 1 SOT, 2 shots, or ~60 passes in a completed 10-minute runtime must fail full-match KPI checks.
- V53. Full-match production cadence: 5-minute halves must produce aggregate full-match action volume (>=450 passes, >=20 shots, >=7 SOT) without increasing player movement speed or creating visual-reality violations.
- V54. Browser fixture harness: reused-tab navigation/context destruction during reload must be retried until stable `window.pslSmokeTest.runFixture`; first destroyed context must not fail fixture run.
- V55. Kickoff law: before each kickoff the ball is stationary on the center spot, only the kicker may be inside the center circle, all players remain in their own half, and live play starts with a visible first touch/pass to a teammate other than the kicker.
- V56. Ball speed realism: rendered short/medium passes average 16–20 m/s, driven long balls stay 25–31 m/s, and shot/save/miss flights stay 31–38 m/s; telemetry must report these bands from `ballFlightTelemetry`.
- V57. Ball-flight exclusivity: no pass, shot, save, interception, or restart flight may begin before the previous visible ball flight has arrived; possession handoff may stage the receiver, but the receiver cannot act until ball arrival.
- V58. Match clock continuity: regulation clock advances during goal-scored restart delays; restart presentation may delay play, but it must not pause elapsed match time.
- V59. Offside: at a teammate's pass/touch, an intended receiver in the opponent half and nearer to the opponent goal than both the ball and second-last defender is flagged only when involved; no pass flight launches, attacking offside counter increments, and defending team restarts with possession.
- V60. Two-player pass loop cap: once two consecutive completed passes involve the same two teammates, the next pass target must be a different teammate or a non-pass action; model/telemetry cannot hide 5+ visible ping-pong exchanges as acceptable possession.
- V61. Ball-flight physics readability: normal passes must travel at near-constant horizontal speed with low ground-skimming height; renderer must not add extra ball-height offset beyond the model position, and flight interpolation must not ease in/out inside one pass.
- V62. Dashboard telemetry completeness: completed simple-model matches must persist through the server used on port 3001, dashboard event enrichment must use bundle metadata session ids, pass intelligence must analyze full pass-decision rows, and role behavior stats must never render `undefined`.
- V63. Restart kickoff movement: goal/halftime restart kickoff setup must not directly rewrite visible player positions; players move back to legal kickoff targets under the normal speed cap, and live play remains held until the setup is actually ready.
- V64. Post-kickoff midfield release: non-kicker runners must not appear across the halfway line immediately after kickoff; kickoff setup stages them visibly inside their own half and live attacking shape release holds midfield before gradually opening.
- V65. Active roster sync: UI team-name/formation synchronization during an active match must not rebuild rosters or rewrite player positions; roster rebuilds are allowed only pre-match or after full time.
- V66. Out-of-bounds restarts: balls crossing the touchline or goal line must enter a dead-ball restart state, classify throw-in/goal-kick/corner from the actual last touch, increment restart counters, and resume through a visible restart flight without player or ball teleporting.
- V67. Goal geometry validity: a shot-backed goal is valid only if the shooter role and distance are credible; defender/GK long-range shots beyond their goal-distance envelope may count as shots/on-target/saves, but cannot increment score or appear in `goalLog`.

---

## §T Tasks

| id | status | task | cites |
|----|--------|------|-------|
| T1 | `done` | Fix pass model — allow cutbacks/laterals/layoffs in final third | V1,V3 |
| T2 | `done` | Fix shape width — exempt wingers from ball z-pull, raise width anchors | V2,V3 |
| T3 | `done` | Reduce game duration to 150s/half for iteration speed | C6 |
| T4 | `.` | Validate T1+T2 on fresh match — confirm passChance > 0, avgWidth ≥ 18 | V1,V2,V3 |
| T5 | `.` | Suppress CB shooting — isDeepRole gate on forceShotNow outside penalty area | V4 |
| T6 | `x` | Fix corners — trace deflection/blocked-shot/out-of-play logic to produce restarts | V5,V66 |
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
| B25 | 2026-05-03 | Orchestrator out-of-play logic skipped `dead` balls, so a slow ball settling just beyond the line could lose its goal-kick/corner restart classification and hide last-touch bugs | V29 |
| B26 | 2026-05-11 | Full-length KPI pass volume hid sparse browser passing because shortened halves kept full-match decision delay | V30 |
| B27 | 2026-05-11 | Short-half cadence scaling also compressed rendered ball flights to ~0.28s, making passes read as near-teleports | V31 |
| B28 | 2026-05-11 | Pass flights targeted receiver snapshot position while receiver kept moving, so ball arrived and paused on empty grass | V33 |
| B29 | 2026-05-11 | Aggregate stat KPIs passed while browser reality failed; no telemetry class detected visual/model contradictions | V34 |
| B30 | 2026-05-11 | Live dashboard bridge sent growing tuning bundles over WebSocket/relay; large payloads stalled dashboard flow and left stale match state visible | V35 |
| B31 | 2026-05-11 | Full-time save reused compact live-dashboard bundle, so Austin FC 0-1 Inter Miami history row only retained capped telemetry windows | V36 |
| B32 | 2026-05-11 | Watched fixture timeout equaled nominal match duration at speed=1, so rendering/telemetry overhead caused false `Timed out at FIRST_HALF ...` reports | V37 |
| B33 | 2026-05-11 | Slow-clock detector treated under-target browser progression as terminal, causing `Clock stalled at FIRST_HALF 156.2s` even though sim time was still advancing | V38 |
| B34 | 2026-05-11 | Browser default still used 5-minute halves; even with speedMul=1 the simple model applied short-half movement/cadence compression, so it was not true normal speed | V39 |
| B35 | 2026-05-11 | Player steering applied max velocity immediately every frame; normal clock speed still looked too fast because players could snap to near-sprint speed without acceleration | V40 |
| B36 | 2026-05-11 | Acceleration fix preserved vector inertia, so a target flip near the goal line could keep carrying a player away from the legal target and outside the field | V41 |
| B37 | 2026-05-11 | Full-length KPI run showed safe passing/possession but attacks recycled too often; shot selection and SOT chance were too conservative for V6-V8 | V6,V7,V8 |
| B38 | 2026-05-12 | Urgent goalmouth possession still used generic finish/on-target/goal RNG, so attackers could visibly beat the keeper at the mouth of goal and fail without a credible save/miss | V42 |
| B39 | 2026-05-12 | Browser full-time screen could show goal-log scores from a stale/broken resolver while stat counters stayed at zero, producing impossible results like 8-8 with 0 shots | V43 |
| B40 | 2026-05-12 | Open-net geometry ran before credible keeper recovery while GK target stayed off the line, causing repeated `OPEN_NET_FINISH` goals and 5-7 scores inside 3 minutes | V44,V10,V42 |
| B41 | 2026-05-12 | Half-length selection still compressed cadence/movement/shot urge, so 2/5/15 minute games did not play at 100% speed | V45 |
| B42 | 2026-05-12 | Telemetry initially projected or judged short runtime stats as partial-match samples, which hid that a completed 10-minute runtime was far below full-match MLS output | V46 |
| B43 | 2026-05-12 | Goalmouth keeper recoveries and defender carries could consume all close chances without recording a shot, producing Atlanta-Seattle 0-0 with 0 shots despite 65 passes and goalmouth entries | V47 |
| B44 | 2026-05-12 | Dashboard overview showed raw counts but did not report KPI pass/fail status or zero-shot guard, so invalid matches required CLI/analyzer inspection | V48 |
| B45 | 2026-05-12 | The action timer could still block the next attacking action as the second half expired, allowing full time with 0 shots even when an outfield carrier had possession | V49 |
| B46 | 2026-05-12 | Shot totals could pass while browser play still looked like players walked the ball to goal because normal 20-36 yard shooting was not called out as a visible model KPI | V50 |
| B47 | 2026-05-12 | Charlotte-Houston tuning bundle had 23 keeper recoveries and 5 smothers rendered as `save` ball flights without counted shots, making visual play look like shooting while shot telemetry stayed empty | V51 |
| B48 | 2026-05-12 | Toronto-Philadelphia 0-0 with 2 shots and 1 SOT passed dashboard KPI because selected 5-minute halves were incorrectly treated as a 10-minute partial sample instead of a compressed full-match simulation | V52 |
| B49 | 2026-05-12 | LAFC-Austin completed a 10-minute runtime with only 65 passes, 1 shot, and 1 SOT because action delay remained 4-8.5s instead of compressing production for a full-match simulation | V53 |
| B50 | 2026-05-12 | Reused Edge tab reloaded while browser harness evaluated fixture API, so first `Execution context was destroyed` aborted model+graphics smoke | V54 |
| B51 | 2026-05-12 | Legal kickoff placement initially released full attacking shape immediately after the first touch, causing post-kickoff sprint-speed and SOT production regressions | V40,V53,V55 |
| B52 | 2026-05-12 | Ball-flight duration used readability caps instead of soccer speed bands, producing regular passes around 72 mph and occasional 120 mph rendered flights | V56 |
| B53 | 2026-05-12 | Possession transferred at pass launch and action timers kept running while the rendered ball was still traveling, so receivers could pass/shoot before the ball arrived and appear invisible | V57 |
| B54 | 2026-05-12 | Goal-scored state paused `elapsedInHalf`, so early goals made normal-speed clock samples look slow and restart delays removed match time | V58 |
| B55 | 2026-05-12 | Offside was still listed as disabled, so through balls to attackers beyond the second-last defender could continue as legal passes | V59 |
| B56 | 2026-05-13 | Pass target selection scored each pass independently with no recent-pair memory, so two players could exchange 5+ consecutive visible passes | V60 |
| B57 | 2026-05-13 | Ball flights used ease-in/ease-out interpolation, high pass arcs, and an extra renderer height offset, so normal passes visibly floated and sped up/slowed down mid-flight | V61 |
| B58 | 2026-05-13 | Minnesota-Columbus telemetry existed only in the browser runtime because preview mode lacked DB middleware; dashboard also read sparse event rows and missing role stat keys, producing empty history and `undefined` panels | V62 |
| B59 | 2026-05-13 | Restart kickoff setup snapped all players directly to legal center-kickoff positions after goals/halftime, so the browser showed players teleporting before or after kickoff despite valid aggregate telemetry | V63 |
| B60 | 2026-05-13 | Kickoff non-kickers were staged just inside midfield and the attacking-shape release ramp opened immediately, so a few runners crossed the halfway line within the first visible second and looked like teleports | V64 |
| B61 | 2026-05-13 | React team/formation sync could fire after kickoff and call `rebuildTeams()`, snapping wingers and forwards to normal attacking home positions across midfield while release targets tried to pull them back | V65 |
| B62 | 2026-05-13 | Simple model movement never fed out-of-bounds crossings into the match state machine, so corners/throw-ins/goal kicks stayed disabled or invisible and dashboard restart counters could not be trusted | V66 |
| B63 | 2026-05-13 | `resolveShot()` applied a nonzero minimum goal chance after on-target resolution, so a center back could score a shot-backed phantom goal from 98.7 yards and pass old shot/stat guards | V67 |
| B64 | 2026-05-13 | Restart flight telemetry gained rendered arc data but `BallFlightTelemetry` type was not updated, so lint caught the runtime/type contract drift | lint |
