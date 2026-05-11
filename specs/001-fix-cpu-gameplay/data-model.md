# Data Model: Fix CPU Gameplay Model

## Core Runtime Entities

### 1. CPU Team State

| Field | Type | Description |
|---|---|---|
| `team` | `home \| away` | Team side the tactical state belongs to |
| `phase` | phase enum | Current tactical phase (`build_up`, `progression`, `final_third`, `defensive_block`, `counterattack`, `counterpress`, `set_piece`, `transition`) |
| `ballZone` | zone enum | Field-zone classification used by tactical service |
| `scoreDiff` | integer | Score differential from the team's perspective |
| `matchMinute` | integer | Time context used for urgency/tempo decisions |
| `pressLine` | number | Defensive line depth / pressure reference |
| `compactness` | number | Shape tightness value used by tactical service |
| `intent` | team-intent union | Team-level attacking/defending objective on the blackboard |
| `transitionAge` | number | Seconds since latest possession swing |
| `restartMode` | restart enum/null | Set-piece or restart context when live play is interrupted |

**Validation rules**
- Exactly one tactical blackboard exists per team per orchestrator tick.
- `phase`, `ballZone`, and `intent` must be derived from the same match belief snapshot.
- `restartMode` must be null during ordinary live play and one of the supported restart types during dead-ball states.

### 2. CPU Decision Opportunity

| Field | Type | Description |
|---|---|---|
| `playerId` | string | Actor whose next visible action is being selected |
| `team` | `home \| away` | Team ownership |
| `role` | role enum | Current tactical role or slot |
| `hasBall` | boolean | Whether the player is the current carrier |
| `currentIntent` | intent union/null | Last selected actionable intent |
| `candidateIntents` | list | Evaluated options from behavior tree / utility layer |
| `selectedIntent` | intent union | Exactly one chosen action for the controller tick |
| `target` | position/null | Spatial target for move/pass/shoot/support actions |
| `urgencyOrWeight` | number | Relative action commitment used by motion/ball layers |
| `decisionReason` | string/list | Supporting tactical factors (pressure, restart, support lane, shot quality, etc.) |

**Validation rules**
- Each player controller emits at most one actionable `selectedIntent` per controller tick.
- `selectedIntent` must remain compatible with possession state (for example, only carriers can directly choose pass/shoot/carry actions).
- Decision opportunities for restarts must respect restart ownership and protected-receiver rules.

### 3. Match Context

| Field | Type | Description |
|---|---|---|
| `half` | integer | Current half |
| `elapsedInHalf` | number | Elapsed match time inside the half |
| `scoreHome` / `scoreAway` | integer | Scoreline context |
| `ballState` | enum | `attached`, `loose`, `in_flight`, or dead-ball equivalent |
| `ownerPlayerId` | string/null | Current carrier, if any |
| `ownerTeam` | `home \| away \| null` | Possession team |
| `restartType` | enum/null | Kickoff / throw-in / goal kick / corner / free kick context |
| `pressureWindow` | derived flag | Whether the situation is loose-ball, transition, late-game chase/hold, etc. |
| `attackSigns` | pair | Direction of attack for each side |

**Validation rules**
- Possession ownership must align with ball attachment state.
- Restart type must match the current match-state-machine state.
- Attack signs and score context must remain stable across bridge synchronization.

### 4. Validation Match Run

| Field | Type | Description |
|---|---|---|
| `sessionId` | string | Match/session identifier used by telemetry and SQLite |
| `teams` | pair | Home/away matchup under test |
| `completionState` | enum | Completed, deadlocked, invalid restart, other failure |
| `durationMs` | number | End-to-end runtime used for performance comparison |
| `bundleJson` | JSON blob | Persisted match/tuning evidence in SQLite |
| `qaNotes` | text/null | Human review notes for credibility sampling |

**Validation rules**
- Successful runs must complete without deadlock or restart-required CPU failure.
- Runtime comparisons use the same match setup before/after the implementation.
- Persisted bundles must remain readable by existing telemetry analysis scripts.

## Relationships

- One **Match Context** produces one **CPU Team State** per side for each orchestrator update.
- One **CPU Team State** informs many **CPU Decision Opportunities** for that team's players.
- Many **CPU Decision Opportunities** resolve into one evolving **Validation Match Run** when observed through tests or headless simulation.
- **Validation Match Run** persists evidence only after gameplay is complete; CPU decision entities themselves remain in-memory runtime state.

## State Transitions

### CPU Team State

`set_piece`/`transition` → `build_up`/`defensive_block` → `progression`/`counterattack` → `final_third`/`counterpress` → back to `transition` or another restart state

### CPU Decision Opportunity

`observed state` → `candidate generation` → `utility scoring` → `selected intent` → `motion/ball execution` → `next belief snapshot`

### Validation Match Run

`scheduled` → `running` → `completed` or `failed` → `telemetry analyzed`
