# Pixel Soccer League — Plan

## Done (This Sprint)

- [x] Teleport fix round 4 — 5 patches (restart grace window, expanded isRestartTeleport check, isLive guard on deferred restarts)
- [x] Remove hard teleport revert — log-only now, no visual double-jump jank
- [x] Zero ball velocity on non-goal delayed restarts — prevents ball sailing past boundary during 2s delay
- [x] Remove probability-based GK parry corner teleport — all parries physics-based now
- [x] Defer Event Drought Watchdog — uses `_pendingForceRestart` flag instead of direct restart
- [x] Gamepad pause/unpause fix
- [x] P1 free kick human control (`humanWaiting` state)
- [x] CPU goalkeeper distribution out-of-bounds fix
- [x] CPU won't restart after goal fix
- [x] Goal through side netting fix (interpolation check)
- [x] **Goal detection console spam** — fixed wasBehindEndline logic to prevent re-validation loop

## Active Bugs

- [ ] **Pre-match setup dropdown closes immediately** — custom dropdown in PreMatchSetupScreen opens then auto-closes on Chrome/Edge; likely modal event handler interference or React state timing issue
- [ ] **Ball snaps to kickoff spot** — race between `stuckRestartTimer`, `restartAutoStartTimer`, and restart state flags during CPU-vs-CPU
- [ ] **Off-site penalty ball disappears** — ball invisible during flight arc for away penalties
- [ ] **Ball teleports on penalty** — related to above; ball skips trajectory and appears at destination
- [ ] **Kit color toggle not working** — voxel meshes don't reference shared material instances; `setTeamColors` has no visible effect
- [ ] **Throw-in taker vibration/jitter** during restart presentation

## Gameplay — High Priority

- [ ] **Winger pass-first bias** — encourage wingers to pass/cross instead of forcing shots; code applied (crossTargetBonus=4.5, flankShotPenalty=0.20, flankPassBoost=0.40); needs test match verification
- [ ] Tune foul frequency by tackle angle/speed — realistic free kick cadence
- [ ] Keeper distribution improvements — quick distribution, no pickpocketing in-box
- [ ] Reduce GK punt/goal-kick out-of-bounds frequency
- [ ] Match end stops on full-time screen — no auto-transition to new game
- [ ] Keep throw-in taker outside touchline briefly before play resumes

## Gameplay — Medium Priority

- [ ] Role duties by phase (build-up, progression, final-third) for pass lanes and spacing
- [ ] Telemetry counters for throw-ins, corners, goal kicks, free kicks, avg team width/depth
- [ ] Keep scored balls trapped inside the goal (bounce internally, never escape)

## Visual Polish

- [ ] Goalkeeper diving animation — voxel frames for left/right dive on shot reaction
- [ ] Net bulge/deformation when ball hits the net
- [ ] Reduce net mesh Z-fighting (overlapping surfaces shimmer)
- [ ] Mowing stripes on pitch ← next stadium polish item
- [ ] Floodlight pylons at corners
- [ ] Corner flags with animated cloth
- [ ] Stadium roof/canopy
- [ ] Camera flashes on goals
- [ ] Crowd wave on goals
- [ ] Weather particles (rain/snow)

## Deferred

- [ ] Fouls system (keeping in back pocket)
- [ ] Git commit — many uncommitted changes across features/fixes
