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
- V45. Half length pacing: selected half length is runtime only; simulated half remains 45:00, `matchClockScale = 2700 / runtimeHalfSeconds`, and player movement/ball-flight readability remain at 100% simulation speed.
- V46. Runtime-aware telemetry: dashboard, simple KPI guard, and telemetry analyzer must label selected half length as runtime only; KPI baselines compare the completed simulation to full-match MLS raw outputs, not runtime-scaled partial samples.
- V47. Goalmouth production floor: if a live match has no shots yet, first controlled possession inside the central goalmouth must resolve as a shot, saved shot, or shot-backed goal; keeper smothers there cannot leave full-time stats at 0 shots.
- V48. Dashboard KPI reporting: live/history dashboard must show duration-aware raw KPI status, baseline fit score, zero-shot full-time guard, and actual-vs-expected goals/shots/SOT/passes; invalid KPI state cannot exist only in CLI telemetry.
- V49. Final-whistle shot floor: a match cannot enter FULL_TIME with 0 shots while an outfield carrier controls the ball; late no-shot pressure must create a real shot decision and ball flight before expiry, not a stat-only correction.
- V50. Distance-shot readability: normal attacking play must produce explicit 20-36 yard `distance_shot` decisions with visible shot ball flights; shot KPIs must report distance bins so "walking the ball into goal" cannot hide behind aggregate shot totals.
- V51. Smother visual semantics: keeper smothers/recoveries before a shot cannot emit `save` ball-flight telemetry; only counted shots-on-target may create `save` flights, otherwise visual KPI can imply phantom shots.
- V52. Compressed-runtime KPI guard: a 2/5/15 minute-half match represents a full 90-minute soccer match for statistics; 1 SOT, 2 shots, or ~60 passes in a completed 10-minute runtime must fail full-match KPI checks.
- V53. Held-ball production cadence: 5-minute halves must preserve held-ball action floors without increasing player movement speed or creating visual-reality violations; full-match raw pass targets cannot override V74 visible hold constraints.
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
- V71. Controlled dribble ball: during live possession with no flight active, ball position must chase a dribble target under capped speed and stay within a short carrier leash; it must not snap exactly onto the carrier each tick or create `BALL_CARRIER_GAP` violations.
- V72. Visible shot origin: shot/save/goal flights must start from the visible ball position when the carrier controls it, not from an invisible foot snap; intercepted carriers must get a short visible settling beat before they can shoot.
- V73. Straight kicked-ball flight: once pass/interception/restart/shot/save/miss flight starts, its horizontal target is fixed; receivers may move to meet the landing point, but the ball path must not retarget or curve toward a moving player.
- V74. Controlled ball hold time: normal possession decision delay must apply a 1.5x hold-time multiplier over the base tempo cadence and receivers must visibly hold 1.5-3.0s after pass/restart/interception arrival; player movement speed and ball-flight speed must not change.
- V75. Held-ball KPI mode: when V74 visible holds are enabled, 5-minute halves must use held-ball action floors instead of full MLS pass/shot volume targets; 450+ pass attempts in 10 real minutes conflicts with a single ball and 1.5-3.0s receiver holds.
- V76. Zero-shot full-time floor: full time must not persist zero total shots; if the final tick arrives during a ball flight, keeper possession, or deep possession, the model must force one shot-backed attempt before publishing full-time stats.
- V77. Penalty-area shot preference: outfield carriers inside the attacking penalty area must prefer shooting by a large margin over passing; keeper smother/recovery can override, but generic pass-heavy circulation must not.
- V78. Restart animation visibility: throw-in and corner renderer presentations must keep the taker on the dedicated restart sprite path through both setup and release phases, with visible non-idle motion while the ball is released.
- V79. Goal-kick keeper presentation: goal-kick setup/release events must identify the goalkeeper as taker, pin the ball at the restart spot during setup, and render the keeper through a dedicated visible kick action on release.
- V80. Goal-kick enablement: off-target attacking shots crossing the goal line must preserve the attacking last touch, classify as `goal_kick`, increment live goal-kick counters, and surface those counters in browser telemetry.
- V81. Visible back-line exit: goal-line OOB from missed shots must let the ball visibly travel behind the goal line before restart setup; telemetry must keep the behind-line miss target instead of truncating the flight to the line.
- V82. Law 16 goal kicks: goal kicks must be taken by the defending keeper from a stationary ball inside the goal area, wait for opponents to leave the penalty area before release, and mark the direct receiver as offside-exempt.
- V83. Corner taker animation: corner-kick presentation must animate the taker mesh through a visible run-up and follow-through; the ball flight alone is not sufficient visual evidence of a corner kick.
- V84. Player collision: player model centers must maintain at least two player radii of separation after every movement pass, including live play and restart setup; overlapping players are a model failure, not a renderer artifact.
- V85. Back-of-net goals: scored shots must target inside the goal net, keep the ball visible in the goal dead-ball state until it reaches and settles in the net, and deform the net at the back-net target on ball arrival, not at shot release.
- V86. Shot-distance discipline: normal shot selection must strongly prefer penalty-area and near-box looks; non-forced attempts beyond 36 yards are recycled into possession instead of counting as shots, and distance shots are limited to central 20-30 yard windows.
- V87. Kickoff setup completion: non-snapped kickoff restarts must target legal formation restart positions, not current player positions, and must leave `KICKOFF` within a bounded setup window after halftime or goals.
- V88. Player movement intensity: normal-speed CPU-vs-CPU live play must produce readable runs (p90 instant player speed >=5.5 m/s) while keeping visible instant displacement <=7.8 m/s except static overlap recovery.
- V89. Corner taker visibility: corner setup and release must retain the same taker id, keep that player on a dedicated outside-flag run-up/follow-through presentation for >=1.2s on release, and launch the ball from the corner spot.
- V90. Headers: aerial restart/lofted danger arrivals may resolve as `HEADER_SHOT` or `HEADER_CLEARANCE`, must increment team/player header telemetry and renderer header cue, and ground passes must produce zero header telemetry.
- V91. Defensive telemetry counters: tackles, fouls, and offsides must be first-class match/team/role telemetry; snapshot/live/bundle/dashboard inputs cannot hardcode them to zero, and the model must emit `TACKLE`/`FOUL`/`OFFSIDE` events when those counters move.
- V92. Infraction consequences: offside and foul calls must immediately leave live play, clear active possession/flight, stage a `free_kick` restart for the non-offending team at the infraction spot, and resume only through a visible free-kick release.
- V93. Restart announcer sync: restart announcer clips must fire on the awarded/setup event for throw-ins/corners/free kicks, while release events drive ball/player motion only; audio cannot lag until after the visible restart begins.
- V94. Pre-pass offside visual continuity: if the model flags an intended receiver offside before launching a pass flight, the free-kick setup spot must stay at the ball-at-touch origin; it must not snap the rendered ball to the offside runner across the field.
- V95. Offside call spacing: after an offside call, AI pass target selection must suppress intentional offside runners for a visible cooldown window so the browser cannot produce back-to-back offside calls in rapid succession from normal CPU decisions.
- V96. Full-time identity integrity: browser full-time overlay, persisted `psl_fullTimeScore`, and end-screen stats must capture the active match teams and final score exactly once; they must not fall back to initial menu defaults or be overwritten after full time.
- V97. Post-goal restart readiness: after a goal, visible player reset to legal kickoff positions must complete during `GOAL_SCORED`; `KICKOFF` may start only when setup is ready and must release to live play within a short bounded window.
- V98. Pre-match dropdown stability: pre-match setup dropdown components must be module-stable and option arrays memoized so live game-loop React renders cannot remount or close an opened dropdown.
- V99. Pre-match lineups: each playable world team must expose an 11-player synthetic Starting XI with country-appropriate names, shirt numbers, roles, and selected formation shape; the pre-match lineup button must open this data instead of a placeholder.
- V100. Explicit new match start: every UI-driven new match start must reset stale model state before kickoff, begin at half 1 elapsed 0.0, place the ball on the center spot, stage legal kickoff players, and disable underlying menu input while pre-match setup is open.
- V101. Kickoff receiver side: home and away kickoff receivers must be staged in the kicking team's own half at pass launch; sign-convention helpers cannot place the first receiver past halfway for either attack direction.
- V102. Goal-kick regression harness: goal-kick/corner simulation scripts must observe the actual `ball_out` restart state with `restartType`/`restartTeam`, and must fail non-zero if the expected goal-kick or corner restart is not observed.
- V103. Orchestrator dt fidelity: orchestrator ball previous-position estimates, belief construction, and AI controller ticks must use the actual `tick(dt, now)` value; no fixed 60 Hz `0.016` timestep may drive AI timing.
- V104. Shot-angle geometry: shot selection angle penalties must compute the attacking goal from the active field geometry (`FIELD_W / 2` or equivalent goal constants), not stale ±60 pitch endpoints.
- V105. Kickoff center spot: every kickoff-visible model state must keep the stationary ball and the single kicker on the center spot `(0,0)` until the first visible kickoff pass launches; no pre-setup or possession helper may offset either object from the center circle.
- V106. Restart one-shot audio: throw-in announcer audio must play exactly once per awarded/setup restart, never on legacy/out marker or release events, and one-shot clip playback must preserve the full audio buffer with any fade applied only at the tail.
- V107. Whistle audibility: `whistle.mp3` must be byte-preloaded before match start, decoded and Web Audio unlocked/resumed from the user-triggered match-start gesture, played through one audible asset-backed helper with boosted volume, bounded cooldown/audit telemetry, and used for kickoff, goals, fouls, offsides, penalties, restart setups, half time, and full time.
- V108. Keeper claim save idempotency: a clean goalkeeper catch/claim of one shot may emit exactly one `save` event; any later shot-clear or last-held bookkeeping for that same possession transition must not emit a second save.
- V109. Tackle rating sensitivity: backup tackle resolution must feed standing tackle, defending, defensive awareness, and dribbling/control ratings into the contact score; it must not compress skill edge with `/400` or hard-cap wins at 10% so elite-vs-weak and even matchups resolve differently.
- V110. Simple-offense offside buffer scope: pass target selection must derive offside risk buffer from the current candidate inside both primary and fallback loops; fallback filters must not capture a stale buffer value from a previous teammate iteration.
- V111. Structured attack side hint: central carriers with `pos.z === 0` must not be coerced through `|| 1`; side selection must use explicit zero-aware `pos.z`/`homePos.z` fallback so center-field attacks can use either wing.
- V112. Pattern-engine Vec2 compatibility: backup pattern selectors must compute player distance with plain `{x,z}` math, not `THREE.Vector3.distanceTo`, so orchestrator `Vec2` positions cannot crash team-pattern selection.
- V113. Pattern outlet side fallback: when a center carrier needs an outlet target and the outlet lacks `homePos.z`, the backup pattern engine must use an explicit nullish `0` fallback before side comparison; it must not rely on `undefined >= 0`.
- V114. Player animation render isolation: active match player animation must pre-mount sprite frame meshes and switch frames through Three.js `.visible` refs; it must not call React `setState` from per-frame animation callbacks for every player.
- V115. React polling setter guards: browser 100ms polling loops must compare new values against refs before calling React setters for selected player stats, defense stats, pause/live flags, or match snapshots; unchanged poll samples must not force React re-renders.
- V116. Live telemetry derived-list memoization: telemetry panels must memoize reversed/capped event and decision lists with `useMemo`; JSX render paths must not allocate `slice().reverse()` views every render.
- V117. Shipping UI debug logging: active browser UI files must not call `console.log` directly from normal render, input, or polling paths; repeated diagnostics must route through an opt-in debug helper.
- V118. Menu control accessibility: main-menu and pre-match controls must use native select semantics or explicit button semantics, expose accessible labels/expanded-control relationships, provide visible focus rings, and avoid delayed outside-click listener races.
- V119. Pre-match modal accessibility: pre-match setup must be a focus-managed modal dialog with role/aria labeling, Escape close, Tab containment, clickable backdrop, balanced heading text, and decorative emoji hidden from screen readers.
- V120. Practice panel control accessibility: practice setup and in-game practice selects must have explicit `label htmlFor`/`select id` pairings and visible `focus-visible` rings; practice action/toggle buttons must be explicit `type="button"`.
- V121. Browser infinite free-play script: a browser-loadable script must expose `window.pslInfiniteGame`, auto-start unless manual mode is requested, prevent full time by hardening model half duration, lock score snapshots/telemetry to 0-0, hide scoreboards in scoreless mode, and restore patched engine methods on stop.
- V122. Browser console script paste safety: loadable standalone helper scripts must start with a defensive semicolon, document a one-line `;var s=document.createElement("script")...` loader, and provide a short alias loader so console evaluation/typing errors cannot easily concatenate with previous input, reject newer syntax, or request an HTML fallback as JavaScript.
- V123. Independent home/away dropdowns: main-menu and pre-match Home/Away team dropdowns must be side-addressable button/list controls with stable ids/data markers, pointer-active layering, visible clickable option elements, listbox semantics, and direct wiring to the correct home/away state setter; away controls must not depend on native-select shortcuts or the home dropdown path.
- V124. Ball trail scope: regular play movement, dribbles, passes, restarts, and loose-ball motion must not render the 3D ball trail; the trail may render only during active `shot` ball flights, and the options menu must expose a setting that disables even shot trails.
- V125. Keeper possession buffer: when the goalkeeper has controlled ball-in-hands possession, opposing players cannot hound or contact the keeper; they must maintain a several-feet standoff until distribution begins, while teammates can move into outlet positions.
- V126. Player hair variation: active player rendering must select deterministic varied hair/head materials per player identity instead of returning one shared all-black hair palette for every player.
- V127. Player animation desync: active player rendering must assign deterministic per-player animation phase offsets for run/idle sprite timing and must restore that offset after state/facing changes so players do not animate in lockstep.
- V128. Menu welcome audio: the first user-gesture splash music start must schedule `welcome.mp3` about 2 seconds after `Pixel Soccer League.mp3`, must not mark the callout played until the decoded buffer actually starts, and must clear stale timers when splash music stops.
- V129. Post-goal reset speed: player movement back to kickoff setup after a goal may use a temporary 1.3x movement speed and displacement-cap multiplier only while `GOAL_SCORED` reset positioning is active; ordinary kickoff, halftime, live play, and match-clock compression must keep normal player speed.
- V130. Visual-only player scale: player readability scaling must live in the renderer as a bounded mesh-scale multiplier and must not change `PLAYER_RADIUS`, player separation, ball contact, camera FOV, movement speed, or KPI simulation outputs.
- V131. Keeper animation telemetry: every renderer-consumed `SAVE` or `SMOTHER` live event that finds a goalkeeper must install a keeper reaction and append a bounded `keeperAnimationEvents` tuning-bundle row with action, keeper id/name, direction, duration, phase, clock, and source event index.
- V132. Visible header summary: every renderer-consumed `HEADER_SHOT` or `HEADER_CLEARANCE` live event that finds a player must install a header reaction and append a bounded `headerAnimationEvents` tuning-bundle row; the full-time overlay must display header counts from these visible animation rows rather than raw model counters.
- V133. Menu background isolation: while splash or main menu is visible, the canvas may render the current field scene but must not step the model, process live-event audio, or produce match actions/telemetry; real match kickoff must explicitly clear menu/splash guards before starting.
- V134. CPU phase pacing: CPU-vs-CPU presentation phases must hold for roughly 1-2 real seconds before kickoff/restart/goal/halftime release, must not spend accelerated match-clock time during that hold, and must emit bounded `phasePacingTelemetry` rows so the browser and telemetry can prove the pause happened.
- V135. Kickoff whistle idempotency: kickoff setup and kickoff ball release may both emit `KICKOFF` telemetry, but only setup may play the referee whistle; release must be tagged separately and play only ball-kick audio so every kickoff has exactly one whistle.
- V136. Asset-only audio: gameplay audio must not synthesize sounds with oscillators or generated tones; if an MP3/WAV asset is missing or not decoded, the cue is silent rather than replaced by a synthetic fallback.
- V137. Goal-mouth crossing priority: when the full ball crosses either goal line inside the posts, the model must resolve a field-backed goal or own goal before any corner/goal-kick classification; goal-mouth crossings must not create `ball_out` restart telemetry.
- V138. Dev-server supervision: dev/preview wrappers must treat the game server as a critical child, terminate managed helper children when it exits unexpectedly, expose `/__health`, and reuse an already-listening WebSocket helper instead of spawning a duplicate that crashes on port conflict.
- V139. Corner taker visibility: every renderer-consumed corner setup/release event must resolve to an existing non-GK player mesh at the flag/run-up path and emit bounded `cornerPresentationEvents` telemetry; if the model-provided taker id has no visual, the renderer must use a visible same-team non-GK fallback instead of animating only the ball.

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
| B65 | 2026-05-13 | Possession tick snapped `ball.pos` directly to the carrier before the visual offset, making controlled dribbles look magnetized to player feet | V71 |
| B66 | 2026-05-13 | Interception-to-shot could fire in ~0.3s and `resolveShot()` used the carrier position as the shot origin, so a statistically valid goal could look like an invisible or phantom finish in the browser | V72 |
| B67 | 2026-05-13 | Ball-flight update retargeted `flight.to` to a moving receiver every frame, bending passes/restarts/interceptions unnaturally toward their destination | V73 |
| B68 | 2026-05-13 | With 1.5-3.0s receiver holds, full time could arrive during a pass flight or keeper/deep possession, bypassing the old zero-shot guard and publishing 0-shot matches | V76 |
| B69 | 2026-05-13 | Throw-in and corner renderer hooks only changed idle setup poses and dropped the dedicated sprite path on release, so restarts could count in telemetry while looking visually unanimated | V78 |
| B70 | 2026-05-13 | Goal-kick events named the goalkeeper as taker in the model but the renderer had no goal-kick sprite path, so the keeper fell through to generic idle/run and did not visibly perform the kick | V79 |
| B71 | 2026-05-13 | Off-target shots could retouch/claim possession during miss flight and some miss targets stayed inside the goal line, so goal kicks existed in forced tests but looked disabled in normal browser play and live telemetry hid the counter | V80 |
| B72 | 2026-05-13 | Goal-line OOB detection truncated missed-shot flights to the exact back line and immediately installed restart setup, so goal kicks counted but the browser never showed the ball going out behind the goal | V81 |
| B73 | 2026-05-13 | Goal-kick restarts used a generic restart spot outside the 6-yard box and did not hold release for opponents to leave the penalty area, so the visual restart did not match Law 16 | V82 |
| B74 | 2026-05-13 | Corner release animated the ball and only deformed the taker sprite in place, so the browser looked like the ball kicked itself from the flag | V83 |
| B75 | 2026-05-13 | Player movement only chased independent targets and clamped to the field, so two player models could finish a tick at the same coordinates and visually overlap | V84 |
| B76 | 2026-05-13 | Goal shots targeted the goal line and the renderer deformed the net immediately on the GOAL event, while kickoff setup could reset the ball before it visibly entered the net | V85 |
| B77 | 2026-05-13 | The shot model allowed high-volume 30-100+ yard attempts while penalty-area preference existed, inflating shot/SOT/goals and making average shot distance unrealistic | V86 |
| B78 | 2026-05-13 | Non-snapped kickoff setup used current player positions as legal restart target seeds, so halftime after a lopsided first half could give players invalid midfield targets and stall forever in `KICKOFF` | V87 |
| B79 | 2026-05-13 | Player speed checks only capped maximum velocity and used a misleading conversion in manual measurement, so sustained live runs could look slow while kickoff/collision corrections still produced hidden spikes | V88 |
| B80 | 2026-05-13 | Faster restart movement exposed halftime end-switch jams: opposing players crossed through identical formation lanes and could collision-lock in `KICKOFF` despite legal targets | V87 |
| B81 | 2026-05-13 | Corner tests allowed ball-only presentation: model launch metadata did not require same-taker ownership through release, and renderer only made a weak in-place sprite swing for 0.8s | V89 |
| B82 | 2026-05-14 | Header counters existed in UI/DB but active simple model hardcoded `headersA/B=0` and emitted no header events, so legacy header animations/telemetry were unreachable | V90 |
| B83 | 2026-05-14 | Browser half-length setting used selected runtime as simulated half duration, so 5-minute halves showed a 0:00-5:00 clock instead of accelerated 0:00-45:00 match time | V45 |
| B84 | 2026-05-14 | Dashboard tackle/foul/offside bars read team bundle fields, but the simple model hardcoded fouls, omitted team tackle/foul bundle fields, and normal pass selection almost never selected offside receivers | V91 |
| B85 | 2026-05-14 | Offside and foul calls incremented counters and played whistle/live events but did not enter a dead-ball restart, so players could continue as if the infraction had no consequence | V92 |
| B86 | 2026-05-14 | Infraction restarts still depended on a pending event/install path and the renderer ignored `FREE_KICK`, so offside could look called while visible play did not clearly stop for the free kick | V92 |
| B87 | 2026-05-14 | `throw.mp3` was wired to the throw-in release event instead of the setup/award event, so the announcer lagged behind the visible sideline restart | V93 |
| B88 | 2026-05-14 | Pre-pass offside detection staged the free kick at the intended receiver position even though no pass flight had launched, so the browser showed the ball teleporting across the field to the runner | V94 |
| B89 | 2026-05-14 | AI target selection could immediately choose another deliberate offside runner after an offside free-kick restart, making the browser call offsides twice in rapid succession | V95 |
| B90 | 2026-05-15 | Full-time React polling closed over initial `United States`/`Mexico` menu state and rewrote the final overlay every tick, so random/current fixtures could end on a default 0-0 screen | V96 |
| B91 | 2026-05-15 | Goal-scored timer could expire before kickoff setup players were ready, exposing a long `KICKOFF` dead state after goals that looked like the game would not restart | V97 |
| B92 | 2026-05-15 | `TeamSetupSection` was declared inside `PreMatchSetupScreen` while live game-loop state kept re-rendering the parent, so React remounted the select subtree and the dropdown closed immediately after opening | V98 |
| B93 | 2026-05-15 | Starting XI panel was a non-interactive placeholder and world teams had no lineup roster source, so the pre-match lineup button could not show selected-team players | V99 |
| B94 | 2026-05-15 | Explicit pre-match start reused non-`pre_match` model state because `startMatch()` only reset from `full_time`; stale live/kickoff clock and player positions could carry into a new match, while hidden menu input stayed active behind setup | V100 |
| B95 | 2026-05-16 | Legacy kickoff receiver staging used the attack direction as a forward pass lane, so the away-team receiver could be placed past halfway instead of in the kicking team's own half | V101 |
| B96 | 2026-05-16 | Goal-kick simulation harness waited for a non-existent `restart_awarded` event, leaving restart observations null and allowing the script to report success without detecting goal-kick/corner classification | V102 |
| B97 | 2026-05-16 | Backup orchestrator hardcoded `0.016` for ball previous-position estimates, belief construction, and controller ticks, so non-60 Hz simulations under-advanced AI timers and predicted ball motion from the wrong frame length | V103 |
| B98 | 2026-05-16 | Backup shot angle penalty used stale ±60 goal coordinates while the local field goal line is ±32.8, so wide realistic shooting positions looked central and escaped the angle penalty | V104 |
| B99 | 2026-05-16 | Kickoff possession/setup helpers offset the starter to `±0.65–0.8` from midfield, so browser kickoff could appear to start outside the center spot even while the ball was later pinned to `(0,0)` | V105 |
| B100 | 2026-05-16 | One-shot audio used the fade value as the source stop time and legacy `THROW` events could also trigger the throw announcer, so throw-in audio repeated and cut off before the clip finished | V106 |
| B101 | 2026-05-16 | Whistle calls used quiet direct buffer playback after gameplay-only decoding, so early stoppage whistles could fire before `whistle.mp3` was decoded and had no audible fallback | V107 |
| B102 | 2026-05-16 | Backup orchestrator save telemetry could regress to emitting both attached-transition and shot-clear `save` events for one clean keeper claim, inflating keeper stats from one catch | V108 |
| B103 | 2026-05-16 | Backup tackle resolution previously risked making defensive ratings decorative by compressing skill edge and capping win chance at 10%; current contact scoring needed a guard and explicit defensive-awareness feed-through | V109 |
| B104 | 2026-05-16 | Backup simple-offense fallback pass filtering could regress to capturing `offsideRiskBuffer` from the preceding teammate loop, making offside decisions depend on the last iterated role instead of the current candidate | V110 |
| B105 | 2026-05-16 | Backup structured attack used `carrier.pos.z || carrier.homePos?.z || 1`, so central carriers at `z=0` ignored a valid center position and defaulted side selection to right wing | V111 |
| B106 | 2026-05-16 | Backup pattern engine called `.distanceTo()` on `any` player positions even though orchestrator players use plain `Vec2` `{x,z}`, so pattern selection could crash at runtime | V112 |
| B107 | 2026-05-16 | Backup pattern outlet targeting compared `player.homePos?.z >= 0` directly, so missing `homePos` silently evaluated false and pushed center-carrier outlets to the left side | V113 |
| B108 | 2026-05-16 | Review flagged a removed React `Player.tsx` path that scheduled `setDisplayFrame` from `useFrame`; active player rendering must stay on the existing Three.js visibility-toggle path to avoid 22 React reconciles per animation tick | V114 |
| B109 | 2026-05-16 | `RetroFootball` polled selected player stats, defense stats, pause/live flags, and snapshots every 100ms and called React setters even when values were unchanged, forcing avoidable re-renders during matches | V115 |
| B110 | 2026-05-16 | `LiveTelemetry` allocated `slice().reverse()` arrays for event, shot-decision, and pass-decision panels during every render; reported field/goalpost/canvas files are stale paths not present in this repo | V116 |
| B111 | 2026-05-16 | Review flagged repeated `RetroFootball` console logging; active dashboard bridge logs could write during polling and reported `Player.tsx`/`Ball.tsx` files are stale paths not present in this repo | V117 |
| B112 | 2026-05-16 | Main-menu/pre-match controls relied on border-only focus styles and incomplete button relationships; review notes about custom listbox keyboard handling were stale because active dropdowns are native selects | V118 |
| B113 | 2026-05-16 | Pre-match setup modal lacked dialog semantics, focus trapping, Escape close, and screen-reader-safe decorative start-button emoji; reported pointer-events-none/log/randomize findings were stale in current code | V119 |
| B114 | 2026-05-16 | Practice setup/in-game panel selects had unpaired labels and border-only focus styling, leaving keyboard and assistive-tech users without reliable control names or visible focus indicators | V120 |
| B115 | 2026-05-16 | Infinite free-play helper began with a bare IIFE and the instructions used a long multi-line/function loader; a mistyped space in `/infinite-game. js` requested the HTML fallback as JavaScript, producing `"" is not a function`, `invalid token`, or `Unexpected token '<'` before the helper loaded | V122 |
| B116 | 2026-05-16 | Home and away team dropdowns were treated as static/native-select wiring, and the browser probe used `selectOption()` for the main menu, bypassing the real visible dropdown interaction; both main-menu and pre-match selectors need real button/list option elements with side-specific markers | V123 |
| B117 | 2026-05-16 | Ball trail visibility was derived only from recent ball movement distance, so normal passes/dribbles/restarts displayed a trail; renderer needs to gate trail visibility by active shot flight kind and a user setting | V124 |
| B118 | 2026-05-16 | Keeper possession lacks a protected standoff rule; opponents cannot hound or contact the goalkeeper after he controls the ball in hands | V125 |
| B119 | 2026-05-16 | Player palette selection returned team palettes with `hairBlack` for every player, so the existing hair materials were unused and all heads looked identical | V126 |
| B120 | 2026-05-16 | Player visuals initialized animation timers at zero and reset them to zero on state/facing changes, causing nearby players to run in synchronized sprite cycles | V127 |
| B121 | 2026-05-16 | Welcome callout was scheduled at 900ms and marked played before proving `welcome.mp3` had decoded/started, so a late decode could permanently skip the expected menu callout | V128 |
| B122 | 2026-05-16 | Post-goal reset movement used the same movement/cap path as normal play, so requested faster return-to-kickoff behavior needed an explicit temporary multiplier that does not affect ordinary gameplay speed | V129 |
| B123 | 2026-05-16 | Player readability needed a larger browser sprite, but tying visual size to physical radius or ball contact would destabilize collision and KPI tuning; the scale change must remain renderer-only | V130 |
| B124 | 2026-05-16 | Keeper save telemetry proved the model emitted `SAVE`, but the browser renderer had no durable audit row proving the event installed a visible keeper reaction, so visual activation could not be verified from telemetry | V131 |
| B125 | 2026-05-16 | Full-time overlay displayed raw header counters even though the browser had no durable proof that those header events reached a visible renderer animation, so users could see header totals they did not observe | V132 |
| B126 | 2026-05-16 | Whistle MP3 decode success could suppress the synthetic fallback even when the asset was too quiet or masked by other audio, so a full match could contain stoppage events without an audible whistle | V107 |
| B127 | 2026-05-16 | Splash auto-demo startup was disabled, but the engine animation loop still stepped any pre-existing live model while the menu/splash was visible, allowing a background match to keep producing actions and audio | V133 |
| B128 | 2026-05-16 | Match-start paths could stop splash music and start play without explicitly unlocking gameplay Web Audio from that same user gesture, so later frame-driven whistle calls could be scheduled while the browser kept the context suspended | V107 |
| B129 | 2026-05-16 | Kickoff setup and kickoff release both emitted `KICKOFF` live events, and the audio mapper whistled for every `KICKOFF`, so a single kickoff produced two referee whistles | V135 |
| B130 | 2026-05-16 | Gameplay audio still included oscillator fallbacks and a layered synthetic whistle even after real MP3/WAV assets were wired, conflicting with the asset-only sound direction | V136 |
| B131 | 2026-05-16 | Goal-line restart detection handled corners/goal kicks but delegated goal-mouth crossings to shot resolution only, so a non-shot or defensive-touch ball crossing inside the posts could fall through to restart classification instead of a goal/own goal | V137 |
| B132 | 2026-05-16 | The dev/preview wrapper could leave a stale WebSocket helper alive after the game server on 3001 disappeared; restarting then crashed the duplicate WebSocket child on 8081 while the browser saw a lost game connection | V138 |
| B133 | 2026-05-16 | Corner model telemetry could include a taker id while the renderer had no proof that id mapped to a visible mesh, so the browser could show only the ball moving from the flag | V139 |
