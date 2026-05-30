import assert from "node:assert/strict";
import test from "node:test";
import { summarizePositionOwners, summarizeShape, summaryCarrierTrajectories } from "../scripts/telemetry-analyze-latest.mjs";

test("telemetry analyzer rebuilds shape snapshots from legacy per-player rows", () => {
  const report = summarizeShape([
    { half: 1, t: 10, x: -20, z: -12 },
    { half: 1, t: 10, x: -6, z: -4 },
    { half: 1, t: 10, x: 4, z: 6 },
    { half: 1, t: 10, x: 12, z: 14 },
  ], "Test FC");

  assert.equal(report.snapshots, 1);
  assert.equal(report.avgWidth, 26);
  assert.equal(report.centerAndNarrowPct, 0);
});

test("telemetry analyzer classifies simple-model wide owners without UNKNOWN fallback", () => {
  const summary = summarizePositionOwners([
    { type: "POSITION_OWNER_SAMPLE", team: "A", role: "W", detail: { owner: "LW", absZ: 14, targetAbsZ: 18 } },
    { type: "POSITION_OWNER_SAMPLE", team: "A", role: "FB", detail: { owner: "RB", absZ: 12, targetAbsZ: 16 } },
    { type: "POSITION_OWNER_SAMPLE", team: "B", role: "CM", detail: { owner: "CM", absZ: 4, targetAbsZ: 6 } },
  ]);

  assert.equal(summary.samples, 3);
  assert.equal(summary.byTeam.A.LW, 1);
  assert.equal(summary.byTeam.A.RB, 1);
  assert.equal(summary.wide.A.samples, 2);
  assert.equal(summary.wide.A.avgTargetAbsZ, 17);
});

test("telemetry analyzer detects carrier trajectory segments from x/z traces", () => {
  const report = summaryCarrierTrajectories([
    { type: "CARRIER_TRACE", team: "A", half: 1, t: 1.0, detail: { carrier: "Nine", x: -10, z: -2 } },
    { type: "CARRIER_TRACE", team: "A", half: 1, t: 2.0, detail: { carrier: "Nine", x: -6, z: -1 } },
    { type: "CARRIER_TRACE", team: "A", half: 1, t: 3.0, detail: { carrier: "Nine", x: -2, z: 0 } },
    { type: "CARRIER_TRACE", team: "A", half: 1, t: 4.0, detail: { carrier: "Nine", x: 3, z: 1 } },
  ]);

  assert.equal(report.totalSegments, 1);
  assert.ok(report.avgBLineRatio > 0.9);
});
