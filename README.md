<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

[![CI](https://github.com/Plicerin/Pixel-Soccer-League/actions/workflows/ci.yml/badge.svg)](https://github.com/Plicerin/Pixel-Soccer-League/actions/workflows/ci.yml)

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e23bf68b-d920-483f-b5a4-63603a407f5a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Persistent Telemetry Database

The app now includes a permanent, non-volatile telemetry database backed by IndexedDB (via Dexie).

Stored data includes:
- Match/session metadata and time-series snapshots
- Selected offense/defense player snapshots with stat/modifier payloads
- Performance samples (frame delta and FPS estimate)
- Generic telemetry events
- Real-world baselines for comparison
- Correction actions for tuning and calibration history

Database name:
- `PixelSoccerTelemetryDB`

Debug API (browser console):
- `window.pslTelemetry.counts()`
- `window.pslTelemetry.exportAll()`
- `window.pslTelemetry.latestSummary()`
- `window.pslTelemetry.findMatches({ teamAName: 'Inter Miami', teamBName: 'LA Galaxy', scoreA: 1, scoreB: 0, limit: 5 })`
- `window.pslTelemetry.clearAll()`
- `window.pslTelemetry.addBaseline({...})`
- `window.pslTelemetry.addCorrection({...})`
- `window.pslTelemetry.compareDrift({ thresholdPct: 10 })`
- `window.pslTelemetry.generateRecommendations({ thresholdPct: 10 })`

In-app dashboard:
- Open menu with `ESC`
- Go to `STATS`
- Use `Telemetry Drift Dashboard` to refresh drift metrics and auto-generate correction recommendations for metrics above threshold.

Example baseline insert:
```ts
await window.pslTelemetry.addBaseline({
   metricKey: 'team.goals_for_per_game',
   source: 'MLS Stats 2025',
   scopeType: 'team',
   scopeId: 'Inter Miami',
   value: 2.38,
   unit: 'goals/game',
   notes: 'Regular season baseline',
});
```

Example correction insert:
```ts
await window.pslTelemetry.addCorrection({
   sessionId: 'optional-session-id',
   metricKey: 'sim.pass.success_rate',
   previousValue: 0.81,
   updatedValue: 0.78,
   rationale: 'Simulation overperforming versus MLS baseline',
   status: 'applied',
   notes: 'Reduced short-pass boost by 3pp',
});
```
