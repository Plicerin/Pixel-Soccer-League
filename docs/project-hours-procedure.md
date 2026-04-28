# Project Hours Procedure

The hours report separates human engineering time from machine runtime.

## Generate The Report

```powershell
npm run hours:report
Get-Content docs\project-hours-report.md
```

## Raw Summary

```powershell
npm run hours
npm run hours -- --json
```

## Manual Work Sessions

```powershell
npm run hours:start -- --note "fielding tuning"
npm run hours:status
npm run hours:stop -- --note "built and verified"
```

Manual sessions are stored in `project-hours-worklog.jsonl`.

## Start The 24-Hour Updater

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-project-hours-report-loop.ps1 -IntervalHours 24
```

The loop writes:

- `project-hours-report-loop.pid`
- `project-hours-report-stdout.log`
- `project-hours-report-host-stderr.log`

## Stop The Updater

```powershell
Stop-Process -Id (Get-Content project-hours-report-loop.pid)
```

## Accounting Rules

Human work estimate uses this precedence:

1. Manual worklog hours from `hours:start` / `hours:stop`
2. Codex CLI session blocks from `%USERPROFILE%\.codex\sessions`
3. Activity estimate from Git and file timestamps

Codex CLI sessions are filtered by `session_meta.payload.cwd`, so sessions from other projects are not counted. Codex events are grouped into blocks with a 30-minute idle cutoff.

Automated nightly/headless runtime is wall-clock machine runtime and should stay separate from human work. Telemetry game-session runtime is in-game match time from `psl.db`.
